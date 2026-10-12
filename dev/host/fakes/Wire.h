#pragma once
#include <Arduino.h>
#include <array>
#include <vector>

// A register-level NAU7802 double. It rejects premature calibration and
// provides a previous-channel latched conversion after channel selection.
struct FakeWire {
    struct Write { uint8_t reg, value; uint32_t ms; };
    std::array<uint8_t, 32> regs{};
    std::vector<uint8_t> tx, rx;
    std::vector<Write> writes;
    std::array<int32_t, 2> samples{{10000, -20000}};
    uint8_t address = 0, pointer = 0, calibrated = 0, previousChannel = 0;
    size_t readIndex = 0;
    uint32_t analogStarted = 0, calibrationStarted = 0;
    bool present = true, failNextWrite = false, calibrationError = false;
    bool calibrationStuck = false, powerStuck = false, conversionsStuck = false;
    bool staleConversion = false, prematureCalibration = false;
    unsigned calibrations[2] = {};
    void begin(int, int, uint32_t) {}
    void setTimeOut(unsigned) {}
    void beginTransmission(uint8_t a) { address = a; tx.clear(); }
    void write(uint8_t b) { tx.push_back(b); }
    int endTransmission(bool = true) {
        if (!present || address != 0x2A) return 2;
        if (tx.empty()) return 0;
        pointer = tx[0];
        if (tx.size() == 1) return 0;
        if (failNextWrite) { failNextWrite = false; return 2; }
        const uint8_t reg = tx[0], value = tx[1];
        writes.push_back({reg, value, millis()});
        if (reg == 0 && (value & 1)) { regs.fill(0); calibrated = 0; staleConversion = false; }
        if (reg == 0 && (value & 0x80) && !(regs[0] & 0x80)) analogStarted = millis();
        if (reg == 2) {
            if ((regs[2] ^ value) & 0x80) {
                previousChannel = (regs[2] >> 7) & 1;
                staleConversion = true;
            }
            if (value & 4) {
                calibrationStarted = millis();
                ++calibrations[(value >> 7) & 1];
                prematureCalibration |= (regs[0] & 0x96) != 0x96 ||
                    (regs[1] & 0x38) != 0x28 || regs[0x15] != 0x30 ||
                    millis() - analogStarted < 600;
            }
        }
        regs[reg & 31] = value;
        return 0;
    }
    uint8_t requestFrom(uint8_t a, uint8_t count) {
        if (!present || a != 0x2A) return 0;
        rx.clear(); readIndex = 0;
        if ((regs[2] & 4) && !calibrationStuck && millis() - calibrationStarted >= 40) {
            regs[2] &= (uint8_t)~4;
            if (calibrationError || prematureCalibration) regs[2] |= 8;
            else { regs[2] &= (uint8_t)~8; calibrated |= (uint8_t)(1 << (regs[2] >> 7)); }
        }
        if (pointer == 0x12 && count == 3) {
            const uint8_t channel = staleConversion ? previousChannel : (regs[2] >> 7);
            staleConversion = false;
            const uint32_t sample = (uint32_t)samples[channel] & 0xFFFFFF;
            rx = {(uint8_t)(sample >> 16), (uint8_t)(sample >> 8), (uint8_t)sample};
        } else {
            uint8_t value = regs[pointer & 31];
            if (pointer == 0) {
                if ((value & 2) && !powerStuck) value |= 8;
                if ((value & 0x96) == 0x96 && (calibrated & (1 << (regs[2] >> 7))) && !conversionsStuck) value |= 0x20;
            }
            rx.push_back(value);
        }
        return (uint8_t)rx.size();
    }
    int read() { return readIndex < rx.size() ? rx[readIndex++] : -1; }
};
inline FakeWire Wire;
