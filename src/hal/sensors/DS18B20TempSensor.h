#pragma once
#include "ISensor.h"
#include <Arduino.h>
#include <OneWire.h>
#include <new>
#include "SensorProtocolDecode.h"

// ============================================================
//  DS18B20TempSensor — Dallas/Maxim DS18B20 1-Wire digital thermometer
//
//  Single-pin OneWire interface; auto-discovers the first device
//  on the bus (address cached in begin() — no per-read bus search).
//  Supports 9–12-bit resolution (default 10-bit).
//
//  Conversion is fully asynchronous — update() triggers the next
//  conversion at the end of each read, and the scratchpad read is
//  split across ticks (select on one tick, 3 data bytes per tick)
//  so no single ECU-loop tick blocks for the whole transaction.
//
//  Conversion times:
//    9-bit  →  94 ms   (0.5 °C resolution)
//   10-bit  → 188 ms   (0.25 °C)
//   11-bit  → 375 ms   (0.125 °C)
//   12-bit  → 750 ms   (0.0625 °C)
//
//  Healthy range: −55 °C to +125 °C (sensor spec).
//  85 °C is also a legitimate temperature; publish only after a requested
//  conversion and a valid scratchpad with the configured resolution.
//  Scratchpad CRC failure / missing presence pulse — fault.
//
//  Uses placement-new (no heap allocation after begin()).
// ============================================================

class DS18B20TempSensor : public ISensor {
public:
    // One configured sensor per bus/pin. External VDD power is required;
    // parasite-powered two-wire mode needs a strong pull-up that is not fitted.
    explicit DS18B20TempSensor(const char* sensorName)
        : _pin(-1), _resolution(10), _name(sensorName),
          _ow(nullptr) {}

    // Runtime init — call once at boot (or on pin/resolution change).
    void begin(int pin, uint8_t resolution = 10) {
        _pin        = (int8_t)pin;
        _resolution = (uint8_t)constrain((int)resolution, 9, 12);

        // Placement-new: destruct any previous instance first.
        if (_ow) { _ow->~OneWire(); }
        _ow = new (_owBuf) OneWire(_pin);

        _haveAddr  = false;
        // Discover and cache the first DS18B20 directly. Search is boot-only;
        // runtime sampling never scans the bus.
        _ow->reset_search();
        while (_ow->search(_addr)) {
            if (_addr[0] == 0x28 && OneWire::crc8(_addr, 7) == _addr[7]) {
                _haveAddr = true;
                break;
            }
        }
        _ow->reset_search();
        _resolutionVerified = _haveAddr && _setResolution();
        if (_haveAddr) _startConversion(millis());
        else _state = ST_IDLE;

        _temp    = 0.0f;
        _healthy = false;
        _sampleSeq = 0;
        _sampleMs = 0;
    }

    // ISensor::begin() — re-init with current pin and resolution.
    void begin() override { begin(_pin, _resolution); }

    void update() override {
        if (!_ow || !_haveAddr) return;

        unsigned long now = millis();

        switch (_state) {
        case ST_IDLE:
            // Safety: restart conversion if somehow never started.
            _startConversion(now);
            break;

        case ST_CONVERTING:
            if ((int32_t)(now - _convReadyMs) < 0) return; // wrap-safe deadline check
            // Address the cached device and issue READ SCRATCHPAD; the nine
            // data bytes are clocked out over the following ticks (1-Wire
            // tolerates idle gaps between byte slots).
            if (!_ow->reset()) {              // no presence pulse — device gone
                _healthy = false;
                _startConversion(now);        // retry at conversion cadence
                return;
            }
            _ow->select(_addr);
            _ow->write(0xBE);                 // READ SCRATCHPAD
            _scratchIdx = 0;
            _state = ST_READING;
            break;

        case ST_READING:
            for (int i = 0; i < 3 && _scratchIdx < 9; i++)
                _scratch[_scratchIdx++] = _ow->read();
            if (_scratchIdx < 9) return;
            _processScratchpad();
            // Request the next conversion immediately.
            _startConversion(now);
            break;
        }
    }

    float       getValue()  override { return _temp; }
    bool        isHealthy() override { return _healthy && _haveAddr; }
    const char* name()      override { return _name; }
    uint32_t sampleSequence() override { return _sampleSeq; }
    uint32_t sampleTimestampMs() override { return _sampleMs; }

private:
    enum ReadState : uint8_t { ST_IDLE, ST_CONVERTING, ST_READING };

    unsigned long _convDelayMs() const {
        // After a failed setup or peripheral power cycle the chip can still
        // be at its 12-bit default. Do not read it on the shorter 10-bit timer.
        if (!_resolutionVerified) return 750UL;
        switch (_resolution) {
            case 9:  return  94UL;
            case 10: return 188UL;
            case 11: return 375UL;
            default: return 750UL;   // 12-bit
        }
    }

    // Address CONVERT T and arm the timer after the command has finished.
    bool _startConversion(unsigned long) {
        const bool present = _ow && _ow->reset();
        if (present) {
            _ow->select(_addr);
            _ow->write(0x44, 0);              // CONVERT T, external power
        } else {
            _healthy = false;
        }
        _conversionStarted = present;
        _convReadyMs = millis() + _convDelayMs();
        _state = ST_CONVERTING;
        return present;
    }

    bool _readScratchpad(uint8_t* data) {
        if (!_ow->reset()) return false;
        _ow->select(_addr);
        _ow->write(0xBE);
        for (uint8_t i = 0; i < 9; ++i) data[i] = _ow->read();
        return OneWire::crc8(data, 8) == data[8];
    }

    bool _setResolution() {
        uint8_t data[9];
        if (!_readScratchpad(data)) return false;
        const uint8_t config = (uint8_t)(0x1F | ((_resolution - 9U) << 5));
        if (!_ow->reset()) return false;
        _ow->select(_addr);
        _ow->write(0x4E); // WRITE SCRATCHPAD
        _ow->write(data[2]); // preserve alarm-high setting
        _ow->write(data[3]); // preserve alarm-low setting
        _ow->write(config);
        if (!_readScratchpad(data)) return false;
        return (data[4] & 0x7F) == config;
    }

    void _processScratchpad() {
        float t = 0.0f;
        if (!_conversionStarted ||
            !SensorProtocolDecode::ds18b20(_scratch, _resolution, t)) {
            _healthy = false;                 // garbled read / device gone
            return;
        }
        const uint8_t config = (uint8_t)(0x1F | ((_resolution - 9U) << 5));
        if (_scratch[4] != config) {
            _healthy = false;
            _resolutionVerified = false;
            // Restore settings using the cached ROM, without a runtime search
            // or a blocking scratchpad verification. Verify on the next read.
            if (_ow->reset()) {
                _ow->select(_addr);
                _ow->write(0x4E);
                _ow->write(_scratch[2]);
                _ow->write(_scratch[3]);
                _ow->write(config);
            }
            return;
        }
        _resolutionVerified = true;
        if (t >= -55.0f && t <= 125.0f) {
            _temp    = t;
            _healthy = true;
            _sampleMs = millis();
            ++_sampleSeq;
        } else {
            _healthy = false;
        }
    }

    int8_t      _pin;
    uint8_t     _resolution;
    const char* _name;
    // Placement-new storage — avoids heap allocation.
    alignas(OneWire) uint8_t _owBuf[sizeof(OneWire)];
    OneWire* _ow;

    uint8_t       _addr[8]      = {};
    bool          _haveAddr     = false;
    bool          _resolutionVerified = false;
    bool          _conversionStarted = false;
    uint8_t       _scratch[9]   = {};
    uint8_t       _scratchIdx   = 0;
    ReadState     _state        = ST_IDLE;
    float         _temp         = 0.0f;
    bool          _healthy      = false;
    unsigned long _convReadyMs  = 0;
    uint32_t      _sampleSeq    = 0;
    uint32_t      _sampleMs     = 0;
};
