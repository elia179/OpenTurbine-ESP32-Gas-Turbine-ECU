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
    bool tcaPresent = false, tlaPresent = false, tlaStale = false;
    std::array<uint8_t, 4> tca{{1,255,255,0}};
    std::array<uint8_t, 32> tla{};
    std::array<uint16_t, 8> tlaSamples{{500,1000,1500,2000,2500,3000,3500,4000}};
    uint8_t tlaPreviousChannel = 0;
    int tcaFailRegister = -1;
    void begin(int, int, uint32_t) {}
    void setTimeOut(unsigned) {}
    void beginTransmission(uint8_t a) { address = a; tx.clear(); }
    void write(uint8_t b) { tx.push_back(b); }
    int endTransmission(bool = true) {
        if (address == 0x20 && tcaPresent) {
            if (tx.empty()) return 0;
            pointer = tx[0];
            if (tx.size() == 2) {
                if (pointer == tcaFailRegister) return 2;
                tca[pointer & 3] = tx[1];
            }
            return 0;
        }
        if (address == 0x10 && tlaPresent) {
            if (tx.empty()) return 0;
            if (tx.size() < 2) return 2;
            pointer = tx[1];
            if (tx[0] == 0x08 && tx.size() == 3) {
                if (pointer == 0x11 && tla[0x11] != tx[2]) {
                    tlaPreviousChannel = tla[0x11];
                    tlaStale = true;
                }
                tla[pointer & 31] = tx[2];
            }
            return 0;
        }
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
        if ((a == 0x20 && tcaPresent) || (a == 0x10 && tlaPresent)) {
            rx.clear(); readIndex = 0;
            if (a == 0x20) rx.push_back(pointer == 0 ? tca[0] ^ tca[2] : tca[pointer & 3]);
            else if (count == 1) rx.push_back(pointer == 0 ? 0x80 : tla[pointer & 31]);
            else {
                const uint8_t channel = tlaStale ? tlaPreviousChannel : tla[0x11];
                tlaStale = false;
                // Retained GPIO/sequencer/OSR settings invalidate this frame.
                const bool configured = !tla[5] && !tla[0x10] && !tla[3];
                const uint16_t frame = configured ? (uint16_t)((tlaSamples[channel] << 4) |
                    ((tla[2] & 0x10) ? channel : 0)) : 0xFFFF;
                rx = {(uint8_t)(frame >> 8), (uint8_t)frame};
            }
            return (uint8_t)rx.size();
        }
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
