#pragma once
#include "IActuator.h"
#include <Arduino.h>

// Servo / ESC actuator: maps 0.0-1.0 to configured microsecond pulses.
// Uses Arduino-ESP32 3.x LEDC directly to generate standard 50 Hz servo PWM.
class ServoActuator : public IActuator {
public:
    ServoActuator(int pin, int minUs, int maxUs, const char* actuatorName)
        : _pin(pin), _minUs(minUs), _maxUs(maxUs), _name(actuatorName) {}

    // Runtime-pin overload: update params then initialise.
    void begin(int pin, int minUs, int maxUs, bool inverted = false) {
        _pin   = pin;
        _minUs = minUs;
        _maxUs = maxUs;
        _inverted = inverted;
        begin();
    }

    void begin() override {
        if (_minUs > _maxUs) { int tmp = _minUs; _minUs = _maxUs; _maxUs = tmp; }
        // ledcAttach only succeeds when 2^bits <= clk/freq. The ESP32-S3's LEDC
        // clock is lower than the classic ESP32's, so 50 Hz @ 16-bit FAILS to
        // attach there — leaving the servo/ESC pin dead and the throttle with no
        // signal (LEDCActuator hits the same wall and handles it the same way).
        // Retry at progressively lower resolution — a servo only needs a few
        // thousand steps across its 1-2 ms band — and track the resolution
        // actually used so the duty scaling stays correct.
        _resBits = MAX_RES_BITS;
        _maxDuty = (1UL << _resBits) - 1UL;
        bool ok = _pin >= 0 && ledcAttach(_pin, PWM_FREQ_HZ, _resBits);
        while (!ok && _resBits > MIN_RES_BITS) {
            _resBits--;
            _maxDuty = (1UL << _resBits) - 1UL;
            ok = ledcAttach(_pin, PWM_FREQ_HZ, _resBits);
        }
        Serial.printf("[%s] servo attach pin=%d freq=%uHz bits=%u %s\n",
                      _name, _pin, (unsigned)PWM_FREQ_HZ, (unsigned)_resBits,
                      ok ? "OK" : "FAILED");
        _ready = ok;
        _lastUs = -1;
        _pendingUs = -1;
        _hasWritten = false;
        _lastCommandOff = true;
        if (_ready) off(); // logical safe/off demand on boot
    }

    void set(float value) override {
        value = constrain(value, 0.0f, 1.0f);
        const bool commandOff = value <= 0.0f;
        const bool wasOff = _lastCommandOff;
        _lastCommandOff = commandOff;
        if (_inverted) value = 1.0f - value;
        const int us = _minUs + (int)(value * (_maxUs - _minUs));

        // A 50 Hz receiver observes at most one new command per 20 ms frame.
        // Queueing LEDC duty updates faster than that can make the ESP32 LEDC
        // driver wait for successive frame-boundary latches, blocking the ECU
        // loop for roughly 20-40 ms throughout a smooth ramp. Coalesce normal
        // changes to the newest command once per frame. The first activation
        // and every logical-off command remain immediate, so this optimization
        // cannot delay START response, STOP, fault shutdown, or allOff().
        if (commandOff || wasOff) {
            _pendingUs = -1;
            writePulseNow(us);
        } else {
            writePulseCoalesced(us);
        }
    }

    void off() override {
        _lastCommandOff = true;
        _pendingUs = -1;
        const float safeValue = _inverted ? 1.0f : 0.0f;
        writePulseNow(_minUs + (int)(safeValue * (_maxUs - _minUs)));
    }

    const char* name() override { return _name; }
    bool isReady() const override { return _ready; }

private:
    static constexpr uint32_t PWM_FREQ_HZ  = 50;
    static constexpr uint8_t  MAX_RES_BITS = 16;
    // Floor for the attach-retry. At 50 Hz a 12-bit timer still gives ~4.9 us
    // duty steps (~200 steps across a 1000 us servo band) — plenty for an ESC.
    static constexpr uint8_t  MIN_RES_BITS = 12;

    static constexpr uint32_t FRAME_INTERVAL_MS = 20;

    void writePulseCoalesced(int us) {
        if (!_ready) return;
        us = constrain(us, _minUs, _maxUs);
        if (us == _lastUs) {
            _pendingUs = -1;
            return;
        }
        _pendingUs = us;
        if (_hasWritten && millis() - _lastWriteMs < FRAME_INTERVAL_MS) return;
        const int pending = _pendingUs;
        _pendingUs = -1;
        writePulseNow(pending);
    }

    void writePulseNow(int us) {
        if (!_ready) return;
        us = constrain(us, _minUs, _maxUs);
        if (us == _lastUs) return;
        uint32_t duty = ((uint64_t)us * PWM_FREQ_HZ * _maxDuty) / 1000000ULL;
        ledcWrite(_pin, duty);
        _lastUs = us;
        // Measure from completion, not entry. On Classic, an update submitted
        // while the previous 50 Hz latch is pending is exactly what can block;
        // require a complete quiet frame after the driver returns.
        _lastWriteMs = millis();
        _hasWritten = true;
    }

    int         _pin;
    int         _minUs;
    int         _maxUs;
    int         _lastUs = -1;
    int         _pendingUs = -1;
    const char* _name;
    uint8_t     _resBits = MAX_RES_BITS;
    uint32_t    _maxDuty = (1UL << MAX_RES_BITS) - 1UL;
    bool        _ready = false;
    bool        _inverted = false;
    bool        _hasWritten = false;
    bool        _lastCommandOff = true;
    uint32_t    _lastWriteMs = 0;
};
