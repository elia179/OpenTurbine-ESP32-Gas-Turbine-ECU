#pragma once
#include "ISensor.h"
#include <Arduino.h>
#include "CalibrationMath.h"

// ============================================================
//  Analog sensor variants — all share an ADC rolling average
//  buffer, then apply different calibration to get a value.
//
//  Uses analogRead() (raw 12-bit counts, 0–4095).
//  Calibration coefficients must be derived from raw counts.
//  ADC1 channels only: GPIO 32-39. ADC2 conflicts with WiFi.
//
//  Three variants:
//    AnalogPolySensor    — cubic polynomial cal (oil pressure)
//    AnalogLinearSensor  — linear two-point cal (flow, pressure)
//    AnalogThSensor      — threshold (flame detector)
// ============================================================

// ── Shared rolling average buffer ────────────────────────────
template <int N>
class RollingAvg {
public:
    void push(int v) {
        _buf[_idx] = v;
        _idx = (_idx + 1) % N;
        if (_filled < N) _filled++;
    }
    float avg() const {
        if (_filled == 0) return 0;
        long s = 0;
        for (int i = 0; i < _filled; i++) s += _buf[i];
        return (float)s / _filled;
    }
private:
    int _buf[N]  = {};
    int _idx     = 0;
    int _filled  = 0;
};

// ── Base analog sensor ────────────────────────────────────────
class AnalogBase : public ISensor {
public:
    AnalogBase(int pin, const char* sensorName)
        : _pin(pin), _name(sensorName) {}

    // Runtime-pin overload — update pin then initialise.
    void begin(int pin) {
        _pin = pin;
        begin();
    }

    void begin() override {
        _lastMs = 0;
        _sampleSeq = 0;
        analogSetAttenuation(ADC_11db); // maximum attenuation; usable range depends on the chip
        analogReadResolution(12);       // 12-bit (0–4095), portable across ESP32 targets
    }

    void update() override {
        // No pin assigned (begin() was pin-gated) — analogRead(-1) would
        // spam core error logs every sample and feed 0 counts into the avg.
        if (_pin < 0) return;
        unsigned long now = millis();
        if (now - _lastMs < SAMPLE_INTERVAL_MS) return;
        _lastMs = now;
        ++_sampleSeq;
        _avg.push(analogRead(_pin));    // raw 12-bit counts
    }

    int         rawCounts()  const { return (int)_avg.avg(); }
    bool        railHealthy() const { return _railCheck(); }
    float finiteValue() {
        const float value = getValue();
        return isfinite(value) ? value : 0.0f;
    }
    const char* name()       override { return _name; }
    uint32_t sampleSequence() override { return _sampleSeq; }
    uint32_t sampleTimestampMs() override { return _lastMs; }
    void setHealthyRawRange(int minRaw, int maxRaw) {
        _healthyMinRaw = constrain(minRaw, 0, 4094);
        _healthyMaxRaw = constrain(maxRaw, _healthyMinRaw + 1, 4095);
    }

protected:
    static constexpr unsigned long SAMPLE_INTERVAL_MS = 10;

    int         _pin;
    const char* _name;
    unsigned long _lastMs = 0;
    uint32_t _sampleSeq = 0;
    RollingAvg<4> _avg;
    int _healthyMinRaw = 10;
    int _healthyMaxRaw = 4085;

    // ADC rail detection — stuck at 0 or 4095 → sensor fault
    bool _railCheck() const {
        int v = (int)_avg.avg();
        return v >= _healthyMinRaw && v <= _healthyMaxRaw;
    }
};

// ── Polynomial calibrated (e.g. oil pressure transducer) ─────
// y = a*x^3 + b*x^2 + c*x + d   (x = raw counts, y = bar or unit)
struct PolyCal {
    float a = 0, b = 0, c = 0, d = 0;
    float xMin = 0, xMax = 4095;
};

class AnalogPolySensor : public AnalogBase {
public:
    AnalogPolySensor(int pin, const char* n) : AnalogBase(pin, n) {}

    void setCal(const PolyCal& cal) { _cal = cal; }

    float getValue() override {
        return CalibrationMath::polynomial(_avg.avg(), _cal.a, _cal.b, _cal.c, _cal.d,
                                           _cal.xMin, _cal.xMax);
    }
    bool isHealthy() override { return _railCheck() && isfinite(getValue()); }

private:
    PolyCal _cal;
};

// ── Linear two-point calibrated (flow, aux pressure) ─────────
struct LinearCal {
    float rawMin = 0,    rawMax = 4095;
    float valMin = 0.0f, valMax = 1.0f;
};

class AnalogLinearSensor : public AnalogBase {
public:
    AnalogLinearSensor(int pin, const char* n) : AnalogBase(pin, n) {}

    void setCal(const LinearCal& cal) { _cal = cal; }

    float getValue() override {
        float raw = _avg.avg();
        if (!isfinite(_cal.rawMin) || !isfinite(_cal.rawMax) ||
            !isfinite(_cal.valMin) || !isfinite(_cal.valMax) || _cal.rawMax <= _cal.rawMin) return NAN;
        float t = (raw - _cal.rawMin) / (_cal.rawMax - _cal.rawMin);
        const float result = _cal.valMin + t * (_cal.valMax - _cal.valMin);
        return CalibrationMath::validMeasurement(result) ? result : NAN;
    }
    bool isHealthy() override { return _railCheck() && isfinite(getValue()); }

private:
    LinearCal _cal;
};

// ── Threshold (flame detector) ───────────────────────────────
// Returns 1.0 when raw > threshold, 0.0 otherwise.
// isHealthy() is always true (no good way to detect failure).
class AnalogThSensor : public AnalogBase {
public:
    AnalogThSensor(int pin, const char* n) : AnalogBase(pin, n) {}

    void setThreshold(int threshold) { _threshold = threshold; }

    float getValue() override {
        return (_avg.avg() > _threshold) ? 1.0f : 0.0f;
    }
    bool isHealthy() override { return true; }

    // Rail check exposed separately: railed/disconnected wiring is worth
    // surfacing on the dashboard, but a strong flame can legitimately
    // saturate the ADC, so this must not gate the safety-side
    // flameDetected logic (isHealthy stays unconditionally true).
    bool railHealthy() const { return _railCheck(); }

    int rawCounts() const { return (int)_avg.avg(); }

private:
    int _threshold = 500;
};
