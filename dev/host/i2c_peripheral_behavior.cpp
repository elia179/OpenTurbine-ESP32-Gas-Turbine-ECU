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

static void tick(unsigned ms) {
    for (unsigned t=0; t<ms; t+=2) {
        fakeMillisClock() += 2;
        I2CDeviceManager::tick(false);
    }
}
static bool read(unsigned i, int expected) {
    float value; int32_t raw; uint32_t sequence, sampleMs;
    const bool valid = I2CDeviceManager::input(i, value, raw, sequence, sampleMs);
    if (valid) assert(raw == expected);
    return valid;
}
int main() {
    fakeMillisClock() = 1000;
    ChannelRegistry r;
    r.inputCount = r.outputCount = 1;
    auto& input = r.inputs[0];
    input.installed = true; input.driver = ChannelRegistry::I2cDigital;
    input.i2cAddress = 0x20; input.deviceChannel = 0; input.activeHigh = true;
    auto& output = r.outputs[0];
    output.installed = true; output.driver = ChannelRegistry::I2cRelay;
    output.i2cAddress = 0x20; output.deviceChannel = 1; output.safeDemand = 0;
    Wire.tcaPresent = true;
    Wire.tcaFailRegister = 3; // ACKs its address/latch, but rejects direction setup.
    I2CDeviceManager::begin(true,21,22,-1,100000,r);
    assert(!I2CDeviceManager::writeOutput(output,1));
    assert(!I2CDeviceManager::channelAvailable(output));
    Wire.tcaFailRegister = -1;
    assert(I2CDeviceManager::writeOutput(output,1));
    assert(Wire.tca[3] == 0xFD && Wire.tca[1] == 2 && Wire.tca[2] == 0);
    tick(10); assert(read(0,1));
    // Peripheral resets without vanishing from the bus: the old code happily
    // ACKed every relay write while the output stayed an input indefinitely.
    Wire.tca[3] = 255; Wire.tca[1] = 255;
    fakeMillisClock() += 300;
    assert(!I2CDeviceManager::writeOutput(output,1));
    assert(!I2CDeviceManager::channelAvailable(output));
    assert(I2CDeviceManager::writeOutput(output,1));
    assert(Wire.tca[3] == 0xFD && Wire.tca[1] == 2);
    std::cout << "TCA9554 failed-setup retry, safe direction/latch, polarity and reset recovery passed\n";

    r.outputCount = 0; r.inputCount = 2;
    for (unsigned i=0; i<2; ++i) {
        auto& c=r.inputs[i];
        c.installed=true; c.driver=ChannelRegistry::I2cAnalog;
        c.i2cAddress=0x10; c.deviceChannel=i+2;
        c.minValue=0; c.maxValue=4095; c.filterAlpha=1;
    }
    Wire = FakeWire{}; Wire.tlaPresent=true;
    Wire.tla[5]=255; Wire.tla[3]=7; Wire.tla[0x10]=1; Wire.tla[2]=0x80;
    I2CDeviceManager::begin(true,21,22,-1,100000,r);
    tick(50);
    assert(Wire.tla[5]==0 && Wire.tla[3]==0 && Wire.tla[0x10]==0 && Wire.tla[2]==0x10);
    // A selected-channel change can expose an old latched result. Every
    // published value must carry its own ID, including alternating channels.
    for(unsigned i=0; i<40; ++i) { tick(2); read(0,1500); read(1,2000); }
    Wire.tla[2]=0; // reset removes the appended ID; driver must recover it.
    tick(50); assert(Wire.tla[2]==0x10);
    std::cout << "TLA2528 retained-configuration recovery, channel-ID isolation and reset recovery passed\n";

    r.inputCount = 1;
    auto& analog = r.inputs[0];
    analog.deviceChannel = 0; analog.minValue = 100; analog.maxValue = 4000;
    analog.filterAlpha = 0.2f; analog.analogMvPerUnit = 1;
    std::strcpy(analog.role,"pressure");
    Wire = FakeWire{}; Wire.tlaPresent = true; Wire.tlaSamples[0] = 1000;
    I2CDeviceManager::begin(true,21,22,-1,100000,r); tick(20);
    auto valueAt = [&](int counts) {
        float value; int32_t raw; uint32_t seq, ms;
        assert(I2CDeviceManager::input(0,value,raw,seq,ms));
        assert(std::fabs(value-counts*3300.0f/4095.0f)<0.01f);
    };
    valueAt(1000);
    Wire.tlaSamples[0] = 4095; tick(2); assert(!read(0,4095));
    Wire.tlaSamples[0] = 2000; tick(2); valueAt(2000);
    Wire.tlaSamples[0] = 1000; tick(2); valueAt(1800);
    fakeMillisClock() += 510; assert(!read(0,1000));
    Wire.tlaSamples[0] = 3000; tick(2); valueAt(3000);
    std::cout << "TLA2528 invalid range rejection, healthy smoothing and stale filter recovery passed\n";
    // Pot calibration has command deadbands at its physical endpoints. They
    // must remain usable on an external ADC too, including reversed wiring.
    for (const char* purpose : {"throttle", "idle"}) {
        std::strcpy(analog.role,"operator"); std::strcpy(analog.purpose,purpose);
        analog.minValue=41; analog.maxValue=4013; analog.inverted=true;
        analog.filterAlpha=1;
        Wire=FakeWire{}; Wire.tlaPresent=true;
        I2CDeviceManager::begin(true,21,22,-1,100000,r); tick(20);
        for (int counts : {4095,4013,2027,41,0}) {
            Wire.tlaSamples[0]=counts; tick(6);
            float value; int32_t raw; uint32_t sequence, sampleMs;
            assert(I2CDeviceManager::input(0,value,raw,sequence,sampleMs));
            assert(raw==counts);
            const float expected=1.0f-constrain((counts-41)/3972.0f,0.0f,1.0f);
            assert(std::fabs(value-expected)<0.0001f);
        }
        analog.minValue=0; analog.maxValue=4095; analog.inverted=false;
        Wire.tlaSamples[0]=4095; tick(6); assert(!read(0,4095));
        Wire.tlaSamples[0]=0; tick(6); assert(read(0,0));
        analog.minValue=500; analog.maxValue=3500;
        tick(6); assert(!read(0,0));
    }
    std::cout << "TLA2528 throttle/idle deadbands, reversed mapping, raw endpoints and fault windows passed\n";
    for(const char* purpose:{"low_oil_switch","flame","ab_flame"}) {
        std::strcpy(analog.role,"generic");std::strcpy(analog.purpose,purpose);
        analog.minValue=0;analog.maxValue=4095;analog.digitalThresholdRaw=2048;analog.digitalHysteresisRaw=64;
        for(bool high:{false,true}) {
            analog.activeHigh=high;Wire=FakeWire{};Wire.tlaPresent=true;Wire.tlaSamples[0]=1000;
            I2CDeviceManager::begin(true,21,22,-1,100000,r);tick(20);
            auto logical=[&](int counts,bool physicalHigh){
                Wire.tlaSamples[0]=counts;tick(6);
                float value;int32_t raw;uint32_t seq,ms;
                assert(I2CDeviceManager::input(0,value,raw,seq,ms));
                assert(raw==counts&&value==(physicalHigh==high?1.0f:0.0f));
            };
            logical(1000,false);logical(3000,true);logical(2040,true);logical(1000,false);
        }
    }
    std::cout << "TLA2528 switch/flame inputs publish logical ON/OFF with polarity and threshold hysteresis before common contact filtering.\n";

}
