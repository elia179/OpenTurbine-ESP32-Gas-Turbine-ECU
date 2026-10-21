#pragma once
#include <stdint.h>

namespace WetGlowControl {
    // GLOW_TEST iParam: preserve 0 as the original combined test.
    enum Selection : uint8_t { Combined = 0, HeaterOnly = 1, FuelOnly = 2 };

    inline float fuelDemand(uint8_t selection, bool heaterOn, float demand,
                            uint32_t now, uint32_t delayMs,
                            bool& active, uint32_t& since) {
        if (selection != Combined || !heaterOn) {
            active = false;
            since = 0;
            return selection == FuelOnly ? demand : 0.0f;
        }
        if (!active) { active = true; since = now; }
        return uint32_t(now - since) >= delayMs ? demand : 0.0f;
    }
}
