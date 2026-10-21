#include "src/hal/actuators/WetGlowControl.h"
#include <cassert>
#include <cstdio>
#include <initializer_list>

int main() {
    using namespace WetGlowControl;
    bool active = false;
    uint32_t since = 0;
    auto fuel = [&](uint8_t mode, bool heat, float demand, uint32_t now, uint32_t delay = 8000) {
        return fuelDemand(mode, heat, demand, now, delay, active, since);
    };
    // The production helper preserves normal delayed operation and resets it
    // whenever heating stops. PWM/servo demand and relay ON are unchanged.
    assert(fuel(Combined, true, .35f, 100) == 0);
    assert(fuel(Combined, true, .35f, 8099) == 0);
    assert(fuel(Combined, true, .35f, 8100) == .35f);
    assert(fuel(Combined, false, .35f, 8101) == 0 && !active);
    assert(fuel(Combined, true, 1, 9000, 0) == 1);
    // Heater-only never starts fuel, including after a previous combined run.
    assert(fuel(HeaterOnly, true, 1, 10000) == 0 && !active && since == 0);
    assert(fuel(HeaterOnly, true, 1, 100000) == 0);
    // Fuel-only starts immediately without any heater demand or delay.
    for (float demand : {0.0f, .35f, 1.0f}) {
        assert(fuel(FuelOnly, false, demand, 100001) == demand);
        assert(!active && since == 0);
    }
    // Timer expiry / STOP handoff uses Combined with heater off.
    assert(fuel(Combined, false, 1, 100002) == 0);
    assert(fuel(Combined, true, 1, 100003) == 0);
    assert(fuel(Combined, true, 1, 108002) == 0);
    assert(fuel(Combined, true, 1, 108003) == 1);
    // Retain unsigned elapsed-time behavior across millis rollover.
    active = false;
    assert(fuel(Combined, true, 1, 0xfffffff0u, 32) == 0);
    assert(fuel(Combined, true, 1, 15, 32) == 0);
    assert(fuel(Combined, true, 1, 16, 32) == 1);
    assert(fuel(99, true, 1, 17) == 0);
    puts("Wet-glow combined delay, isolated heater/fuel, stop handoff and rollover passed");
}
