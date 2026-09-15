#pragma once
#include <Arduino.h>

namespace SoftwareSpiRead {
// Shared by simple read-only thermocouple converters. noinline keeps one copy
// of the GPIO clock loop in flash; sampleHigh preserves each device's timing.
__attribute__((noinline)) inline uint32_t bits(int clockPin, int chipSelectPin,
                                              int dataPin, uint8_t count,
                                              bool sampleHigh,
                                              unsigned int halfPeriodUs = 5) {
    uint32_t raw = 0;
    digitalWrite(chipSelectPin, LOW);
    delayMicroseconds(1);
    for (uint8_t i = 0; i < count; ++i) {
        digitalWrite(clockPin, sampleHigh ? HIGH : LOW);
        delayMicroseconds(halfPeriodUs);
        raw = (raw << 1) | (digitalRead(dataPin) ? 1U : 0U);
        digitalWrite(clockPin, sampleHigh ? LOW : HIGH);
        delayMicroseconds(halfPeriodUs);
    }
    digitalWrite(chipSelectPin, HIGH);
    return raw;
}
}
