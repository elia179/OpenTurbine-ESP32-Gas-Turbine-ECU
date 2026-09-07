#pragma once
#include <cstdint>
#include <algorithm>
#include <cmath>
#include <cstring>

inline uint32_t& fakeMillisClock() { static uint32_t value = 0; return value; }
inline uint32_t millis() { return fakeMillisClock(); }
inline void delay(uint32_t ms) { fakeMillisClock() += ms; }

inline unsigned& fakeLedcWriteCount() { static unsigned value = 0; return value; }
inline uint8_t& fakeLedcLastPin() { static uint8_t value = 0; return value; }
inline uint32_t& fakeLedcLastDuty() { static uint32_t value = 0; return value; }
inline bool ledcAttach(uint8_t, uint32_t, uint8_t) { return true; }
inline bool ledcWrite(uint8_t pin, uint32_t duty) {
    fakeLedcWriteCount()++;
    fakeLedcLastPin() = pin;
    fakeLedcLastDuty() = duty;
    return true;
}

template <typename T>
inline T constrain(T value, T low, T high) {
    return std::min(std::max(value, low), high);
}

inline size_t strlcpy(char* dst, const char* src, size_t size) {
    const size_t len = std::strlen(src);
    if (size) {
        const size_t copied = std::min(len, size - 1);
        std::memcpy(dst, src, copied);
        dst[copied] = '\0';
    }
    return len;
}

struct FakeSerialPort {
    template <typename... Args> void printf(const char*, Args...) {}
    template <typename T> void println(const T&) {}
};
inline FakeSerialPort Serial;
