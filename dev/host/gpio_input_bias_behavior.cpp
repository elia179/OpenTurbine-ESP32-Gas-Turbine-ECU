#include "../../src/hal/GpioInputBias.h"
#include <cassert>
#include <iostream>

int main() {
    constexpr unsigned floating = 1, up = 5, down = 9;
    for (int pin : {0,4,16,21,32,33}) {
        assert(GpioInputBias::safeMode(pin, up, floating) == up);
        assert(GpioInputBias::safeMode(pin, down, floating) == down);
    }
    for (int pin : {34,35,36,37,38,39}) {
#if defined(OT_PLATFORM_ESP32S3)
        assert(GpioInputBias::safeMode(pin, up, floating) == up);
        assert(GpioInputBias::safeMode(pin, down, floating) == down);
#else
        assert(GpioInputBias::safeMode(pin, up, floating) == floating);
        assert(GpioInputBias::safeMode(pin, down, floating) == floating);
#endif
        assert(GpioInputBias::safeMode(pin, floating, floating) == floating);
    }
#if defined(OT_PLATFORM_ESP32S3)
    assert(GpioInputBias::safeMode(46, up, floating) == up);
    assert(GpioInputBias::safeMode(46, down, floating) == down);
#endif
    assert(!GpioInputBias::available(-1));
    std::cout << "target-specific GPIO input bias behavior passed\n";
}
