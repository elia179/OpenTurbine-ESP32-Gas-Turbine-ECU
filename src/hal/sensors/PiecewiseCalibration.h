#pragma once

#include <math.h>
#include <stdint.h>
#include "CalibrationMath.h"

// Small, deterministic calibration helper for ordinary analog sensors.
// Raw points are ordered ADC counts. Values may consistently rise or fall,
// which covers voltage/current transmitters and common resistive senders.
namespace PiecewiseCalibration {
static constexpr uint8_t MAX_POINTS = 6;

inline bool valid(uint8_t count, const uint16_t* raw, const float* value) {
    if (count == 0) return true;       // legacy/default linear calibration
    if (count < 2 || count > MAX_POINTS || !raw || !value) return false;
    if (!isfinite(value[0])) return false;
    int8_t direction = 0;
    for (uint8_t i = 1; i < count; ++i) {
        if (raw[i] <= raw[i - 1] || !isfinite(value[i])) return false;
        const float delta = value[i] - value[i - 1];
        if (!isfinite(delta) || delta == 0.0f) return false;
        const int8_t stepDirection = delta > 0.0f ? 1 : -1;
        if (!direction) direction = stepDirection;
        else if (direction != stepDirection) return false;
    }
    return true;
}

// Physical measurements continue using the nearest end segment. Calibration
// coverage is not an electrical validity window; callers still check that.
inline float apply(float input, uint8_t count, const uint16_t* raw, const float* value,
                   bool clampEndpoints = false) {
    if (!isfinite(input) || count < 2 || !valid(count, raw, value)) return NAN;
    if (clampEndpoints) input = fminf(fmaxf(input, raw[0]), raw[count - 1]);
    uint8_t upper = 1;
    while (upper < count - 1 && input > raw[upper]) ++upper;
    const float fraction = (input - raw[upper - 1]) / (float)(raw[upper] - raw[upper - 1]);
    const float result = input == raw[upper] ? value[upper] :
        value[upper - 1] + fraction * (value[upper] - value[upper - 1]);
    return (clampEndpoints ? isfinite(result) : CalibrationMath::validMeasurement(result)) ? result : NAN;
}

// Operator/flame mappings retain endpoint saturation, including curves whose
// saved endpoint values intentionally cover less than the full 0..1 command.
inline float applyClamped(float input, uint8_t count, const uint16_t* raw, const float* value) {
    return apply(input, count, raw, value, true);
}
} // namespace PiecewiseCalibration
