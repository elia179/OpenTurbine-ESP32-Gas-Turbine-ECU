#pragma once
#include <math.h>

namespace CalibrationMath {
// The most precise legacy telemetry fields use signed milliunits. Reject
// unusable conversions before they can overflow that representation.
inline bool validMeasurement(float value) {
    return isfinite(value) && fabsf(value) <= 2000000.0f;
}

// Older files can contain a fitted cubic without its original point table.
// Preserve that fit inside its domain, with continuous linear tangent tails
// outside it. Never extend the cubic itself into an unchecked range.
inline float polynomial(float raw, float a, float b, float c, float d,
                        float low, float high) {
    if (!isfinite(raw) || !isfinite(a) || !isfinite(b) || !isfinite(c) ||
        !isfinite(d) || !isfinite(low) || !isfinite(high) || high <= low) return NAN;
    const auto evaluate = [=](float x) { return ((a * x + b) * x + c) * x + d; };
    const float edge = fminf(fmaxf(raw, low), high);
    float result = evaluate(edge);
    if (raw != edge) {
        float slope = (3.0f * a * edge + 2.0f * b) * edge + c;
        const float trend = (evaluate(high) - evaluate(low)) / (high - low);
        // A legacy cubic can turn back near an edge. Extend the overall
        // direction in that case so pressure cannot reverse beyond the fit.
        if (!isfinite(slope) || slope == 0 || ((slope < 0) != (trend < 0))) slope = trend;
        if (trend == 0) slope = 0;
        result += (raw - edge) * slope;
    }
    return validMeasurement(result) ? result : NAN;
}
} // namespace CalibrationMath
