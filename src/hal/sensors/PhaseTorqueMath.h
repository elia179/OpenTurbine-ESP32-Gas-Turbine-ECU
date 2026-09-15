#pragma once
#include <stdint.h>
#include <math.h>

namespace PhaseTorqueMath {
// Returns signed mechanical shaft angle, in the nearest tooth interval.
// Unsigned tick subtraction remains correct when the 32-bit timer rolls over.
inline float shaftPhaseDegrees(uint32_t phaseTick, uint32_t referenceTick,
                               uint32_t periodTicks, float pulsesPerRev) {
    if (!periodTicks || !isfinite(pulsesPerRev) || pulsesPerRev <= 0) return NAN;
    const uint32_t offset = (phaseTick - referenceTick) % periodTicks;
    float fraction = (float)offset / periodTicks;
    if (fraction >= 0.5f) fraction -= 1.0f;
    return fraction * 360.0f / pulsesPerRev;
}
inline float wrappedDeltaDegrees(float phase, float zero, float pulsesPerRev) {
    if (!isfinite(phase) || !isfinite(zero) || !isfinite(pulsesPerRev) ||
        pulsesPerRev <= 0) return NAN;
    const float tooth = 360.0f / pulsesPerRev;
    float delta = fmodf(phase - zero, tooth);
    if (delta >= tooth * 0.5f) delta -= tooth;
    if (delta < -tooth * 0.5f) delta += tooth;
    return delta;
}
}
