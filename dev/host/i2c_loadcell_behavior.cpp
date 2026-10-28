#include <Arduino.h>
#include <cassert>
#include <iostream>
using std::max;
using std::min;
using std::isfinite;
static constexpr int INPUT = 0, INPUT_PULLUP = 2, LOW = 0;
inline void pinMode(int, int) {}
inline int digitalRead(int) { return 1; }
#include "../../src/hal/i2c/I2CDeviceManager.h"
#include "fakes/PcbProfileState.h"

static ChannelRegistry registry(bool dual = false) {
    ChannelRegistry r;
    r.inputCount = dual ? 2 : 1;
    for (uint8_t i = 0; i < r.inputCount; ++i) {
        auto& c = r.inputs[i];
        c.installed = true;
        c.driver = ChannelRegistry::I2cLoadCell;
        c.i2cAddress = 0x2A;
        c.deviceChannel = i;
        c.loadCellGain = 128;
        c.loadCellRate = 80;
        c.loadCellZero = 0;
        c.loadCellNPerCount = 0.01f;
        c.filterAlpha = 1;
        c.leverArmM = 0.5f;
        std::strcpy(c.role, i ? "torque" : "thrust");
    }
    return r;
}
static void start(ChannelRegistry& r) {
    fakeMillisClock() += 1000;
    I2CDeviceManager::begin(true, 21, 22, -1, 100000, r);
}
static void advance(unsigned ms) {
    for (unsigned t = 0; t < ms; t += 2) {
        fakeMillisClock() += 2;
        const auto before = millis();
        I2CDeviceManager::tick(false);
        assert(millis() == before); // setup never sleeps inside the control loop
    }
}
static bool input(uint8_t index, float expected) {
    float value; int32_t raw; uint32_t seq, sampleMs;
    const bool valid = I2CDeviceManager::input(index, value, raw, seq, sampleMs);
    if (valid) assert(std::fabs(value - expected) < 0.01f);
    return valid;
}
int main() {
    auto single = registry();
    Wire = FakeWire{};
    start(single);
    assert(!input(0, 100));
    advance(600);
    assert(!input(0, 100));
    assert(Wire.calibrations[0] == 0);
    advance(100);
    assert(input(0, 100));
    assert(!Wire.prematureCalibration);
    assert((Wire.regs[0] & 0x80) && (Wire.regs[1] & 0x38) == 0x28);

    // Transient failure of the very first setup write must recover without
    // relying on a discovery scan (which is disabled while an engine runs).
    Wire = FakeWire{};
    Wire.failNextWrite = true;
    start(single);
    advance(850);
    assert(input(0, 100));

    Wire = FakeWire{};
    Wire.calibrationError = true;
    start(single);
    advance(900);
    assert(!input(0, 100));
    Wire.calibrationError = false;
    advance(900);
    assert(input(0, 100));

    Wire = FakeWire{};
    Wire.calibrationStuck = true;
    start(single);
    advance(1750);
    assert(!input(0, 100));
    Wire.calibrationStuck = false;
    advance(900);
    assert(input(0, 100));

    Wire = FakeWire{};
    auto dual = registry(true);
    start(dual);
    advance(800);
    assert(Wire.calibrations[0] == 1 && Wire.calibrations[1] == 1);
    assert(input(0, 100));
    assert(input(1, -100)); // signed raw counts and torque lever arm
    for (unsigned t = 0; t < 200; t += 2) {
        advance(2);
        input(0, 100);
        input(1, -100); // no old-channel sample ever becomes a valid value
    }
    Wire.conversionsStuck = true;
    advance(510);
    assert(!input(0, 100) && !input(1, -100));
    Wire.conversionsStuck = false;
    advance(40);
    assert(input(0, 100) && input(1, -100));
    Wire = FakeWire{};
    single.inputs[0].filterAlpha = 0.2f;
    start(single); advance(800); assert(input(0,100));
    Wire.samples[0] = 8388607; // A saturated sample must never enter the filter.
    advance(2); assert(!input(0,100));
    Wire.samples[0] = 20000;
    advance(2); assert(input(0,200)); // First recovered value uses only the fresh load.
    Wire.samples[0] = 10000;
    advance(2); assert(input(0,180)); // Ordinary healthy smoothing is retained.
    Wire.conversionsStuck = true; advance(510); assert(!input(0,180));
    Wire.samples[0] = 30000; Wire.conversionsStuck = false;
    advance(2); assert(input(0,300));
    // Reproduce a zero/400 N thrust calibration across both bridge polarities,
    // signed ADC zero crossings and byte boundaries. Low loads must retain
    // their sign and magnitude on both loading and unloading, including with
    // the default smoothing. A mechanical reversal is not modeled here.
    for (const int polarity : {-1, 1}) {
        for (const float alpha : {1.0f, 0.25f}) {
            auto calibrated = registry();
            auto& c = calibrated.inputs[0];
            c.loadCellZero = -polarity * 1234567;
            c.loadCellNPerCount = polarity * 0.0001f;
            c.filterAlpha = alpha;
            Wire = FakeWire{};
            Wire.samples[0] = c.loadCellZero;
            start(calibrated);
            advance(800);
            for (const int force : {-20, 0, 1, 10, 50, 100, 150, 300, 400,
                                     300, 150, 100, 50, 10, 1, 0}) {
                const int32_t expectedRaw = c.loadCellZero + polarity * force * 10000;
                Wire.samples[0] = expectedRaw;
                advance(200); // Let each simulated steady load settle.
                float value; int32_t raw; uint32_t seq, sampleMs;
                assert(I2CDeviceManager::input(0, value, raw, seq, sampleMs));
                assert(raw == expectedRaw);
                assert(std::fabs(value - force) < 0.01f);
            }
        }
    }
    std::cout << "NAU7802 behavior passed: analog startup, nonblocking settling, write retry, calibration errors/timeouts, both-channel calibration, signed force/torque, stale-channel discard, saturation rejection, fresh filter recovery and zero/400 N load sweeps in both polarities\n";
}
