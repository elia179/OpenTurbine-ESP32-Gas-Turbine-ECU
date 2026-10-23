#pragma once

namespace OperatorAdc {
// Calibration insets the command range by 2%/1%. Those are command deadbands,
// not wiring faults: allow 5% beyond the calibrated range, as the legacy path
// does. Uncommissioned inputs still reject a short-to-high throttle.
inline bool healthy(int raw, float low, float high) {
    if (low <= 0.0f && high >= 4095.0f) return raw >= 0 && raw <= 4085;
    float margin = (high - low) / 20.0f;
    if (margin < 8.0f) margin = 8.0f;
    return raw >= 0 && raw <= 4095 && raw >= low - margin && raw <= high + margin;
}
}
