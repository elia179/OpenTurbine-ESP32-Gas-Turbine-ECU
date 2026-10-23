#pragma once
#include "../engine/Types.h"
#include <string.h>

namespace PressureSafety {
inline bool monitors(int modes, SysMode mode) {
    return (mode == SysMode::STARTUP || mode == SysMode::RUNNING) &&
           (modes & (1u << (unsigned)mode));
}
inline bool oilSwitch(const char* role) {
    return !strcmp(role,"low_oil_switch") || !strcmp(role,"oil_zero_switch");
}
// Pressure is expected to be absent before starting. Only missing pressure
// switch feedback blocks START; its active condition is timed after activation.
inline bool blocksStart(const char* role, bool healthy, bool active, bool oilEnabled) {
    if (oilSwitch(role)) return oilEnabled && !healthy;
    return (!strcmp(role,"inhibit_start") || !strcmp(role,"estop") ||
            !strcmp(role,"fault")) && (!healthy || active);
}
}
