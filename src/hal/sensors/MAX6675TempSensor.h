#pragma once
#include "ISensor.h"
#include "SensorProtocolDecode.h"
#include "SoftwareSpiRead.h"
#include <Arduino.h>

// MAX6675 K-type thermocouple SPI sensor.
// Returns °C. isHealthy() = false when chip reports open-circuit
// (MAX6675 sets bit 2 of response when no thermocouple connected).
//
// Ring buffer averaging: NUM_AVG samples averaged before reporting.
// Smooths igniter electrical noise spikes that could cause false TOT faults.
//
// The protocol is only a 16-bit read, so keeping it here avoids a separate
// library while retaining the same open-circuit and range checks.
class MAX6675TempSensor : public ISensor {
public:
    MAX6675TempSensor(int clkPin, int csPin, int misoPin, const char* sensorName)
        : _clkPin(clkPin), _csPin(csPin), _misoPin(misoPin),
          _name(sensorName) {}

    // Runtime-pin overload — update pins then reinitialise.
    void begin(int clk, int cs, int miso) {
        _clkPin  = clk;
        _csPin   = cs;
        _misoPin = miso;
        begin();
    }

    void begin() override {
        pinMode(_csPin, OUTPUT);
        digitalWrite(_csPin, HIGH);
        pinMode(_clkPin, OUTPUT);
        digitalWrite(_clkPin, LOW);
        // An absent converter otherwise leaves MISO floating and may appear
        // as a plausible turbine temperature.
        pinMode(_misoPin, INPUT_PULLUP);
        _filled  = 0;
        _idx     = 0;
        _temp    = 0;
        _healthy = false;
        _lastMs  = 0;
        _sampleSeq = 0;
    }

    void update() override {
        unsigned long now = millis();
        if (now - _lastMs < READ_INTERVAL_MS) return;
        _lastMs = now;
        float t = 0.0f;
        const bool valid = SensorProtocolDecode::max6675(_read16(), t);
        // D2 is the chip's open-thermocouple indication — the reliable fault
        // indication (a disconnected converter reads all-1s via the MISO
        // pull-up, which also sets D2).  0 °C is the range floor and a
        // legitimate reading at freezing ambient, so it is NOT a fault.
        // MAX6675 physical range: 0 to 1023.75 °C (0.25 °C/LSB); anything
        // outside is impossible.
        if (!valid) {
            _healthy = false;
            // Retain the last value but reset filter history after a fault.
            _filled = 0;
            _idx = 0;
            return;
        }
        ++_sampleSeq;
        _healthy     = true;
        _buf[_idx]   = t;
        _idx         = (_idx + 1) % NUM_AVG;
        if (_filled < NUM_AVG) _filled++;
        // Mean over valid samples
        float sum = 0;
        for (int i = 0; i < _filled; i++) sum += _buf[i];
        _temp = sum / _filled;
    }

    float       getValue()  override { return _temp; }
    bool        isHealthy() override { return _healthy; }
    const char* name()      override { return _name; }
    uint32_t sampleSequence() override { return _sampleSeq; }
    uint32_t sampleTimestampMs() override { return _lastMs; }

private:
    static constexpr unsigned long READ_INTERVAL_MS = 250; // MAX6675 min ~220 ms
    static constexpr int           NUM_AVG          = 2;   // light ~0.5 s smoothing

    int8_t      _clkPin;
    int8_t      _csPin;
    int8_t      _misoPin;
    const char* _name;

    float       _buf[NUM_AVG] = {};
    int         _idx          = 0;
    int         _filled       = 0;
    float       _temp         = 0;
    bool        _healthy      = false;
    unsigned long _lastMs     = 0;
    uint32_t      _sampleSeq  = 0;

    uint16_t _read16() {
        return (uint16_t)SoftwareSpiRead::bits(_clkPin, _csPin, _misoPin, 16, true);
    }
};
