#pragma once

namespace GpioInputBias {
constexpr bool available(int pin) {
    if (pin < 0) return false;
#if defined(OT_PLATFORM_ESP32S3) || defined(CONFIG_IDF_TARGET_ESP32S3)
    return true;
#else
    // Classic's GPIO34-39 lack both pull resistors. Input-only is not a
    // portable proxy: S3 has different pad capabilities.
    return pin < 34 || pin > 39;
#endif
}

constexpr unsigned safeMode(int pin, unsigned requested, unsigned floating) {
    return available(pin) ? requested : floating;
}
}
