#include <Arduino.h>
#include <cassert>
#include <iostream>
#include <array>
using std::isfinite;
static constexpr int INPUT=0, OUTPUT=1, INPUT_PULLUP=2, LOW=0, HIGH=1;
static std::array<uint8_t,16> maxRegs{};
static bool spiSelected=false, spiWrites=true;
static bool spiReadOnly=false;
static uint32_t readOnlyFrame=0;
static unsigned readOnlyBits=32;
static int clockLevel=HIGH;
static unsigned spiBits=0, spiByte=0, spiAddress=0;
static int mosi=0, sdo=1;
static uint32_t configuredMs=0;
static bool spiOrderingViolation=false;
static bool hxReady=false;
static unsigned hxPulses=0;
static uint32_t hxFrame=0;
static int hxBit=HIGH;
inline void pinMode(int,int) {}
inline void delayMicroseconds(unsigned) {}
inline void noInterrupts() {}
inline void interrupts() {}
inline void digitalWrite(int pin,int value) {
    if(pin==8 && value==HIGH && hxReady) {
        hxBit=hxPulses<24 ? (hxFrame>>(23-hxPulses))&1 : HIGH;
        if(++hxPulses==25) hxReady=false;
    }
    if(pin==4) mosi=value;
    if(pin==2) {
        spiSelected=value==LOW;
        if(spiSelected) {spiBits=spiByte=spiAddress=0;}
        if(spiSelected && spiReadOnly) sdo=(readOnlyFrame>>(readOnlyBits-1))&1;
    }
    if(pin!=1 || value==clockLevel) return;
    clockLevel=value;
    if(!spiSelected) return;
    if(spiReadOnly) {
        if(value==LOW) {
            ++spiBits;
            sdo=spiBits<readOnlyBits ? (readOnlyFrame>>(readOnlyBits-1-spiBits))&1 : 0;
        }
        return;
    }
    if(value==LOW) {
        if(spiBits>=8 && !(spiAddress & 0x80)) {
            const unsigned index=((spiAddress & 0x7F)+(spiBits-8)/8)&15;
            // Before the first completed conversion, temperature registers
            // retain their reset value even with a successful config readback.
            if(index>=12 && index<=14 && millis()-configuredMs<250) sdo=0;
            else sdo=(maxRegs[index] >> (7-(spiBits%8))) & 1;
        }
    } else {
        spiByte=(spiByte<<1)|mosi;
        ++spiBits;
        if(spiBits==8) {spiAddress=spiByte; spiByte=0;}
        else if(spiBits%8==0) {
            if((spiAddress & 0x80) && spiWrites) {
                const unsigned index=((spiAddress & 0x7F)+(spiBits-16)/8)&15;
                if(index==1 && (maxRegs[0]&0x80)) spiOrderingViolation=true;
                if(index==0 && spiByte==0x91) configuredMs=millis();
                maxRegs[index]=(uint8_t)spiByte;
            }
            spiByte=0;
        }
    }
}
inline int digitalRead(int pin) { return pin==7 ? (hxPulses ? hxBit : (hxReady ? LOW : HIGH)) : sdo; }
#include "../../src/hal/sensors/MAX31856TempSensor.h"
#include "../../src/hal/sensors/MAX31855TempSensor.h"
#include "../../src/hal/sensors/MAX6675TempSensor.h"
#include "../../src/hal/sensors/DS18B20TempSensor.h"
#include "../../src/hal/sensors/HX711Sensor.h"

static void dsTick(DS18B20TempSensor& sensor,unsigned ms) {
    for(unsigned i=0;i<ms;i+=2) {fakeMillisClock()+=2;sensor.update();}
}
int main() {
    fakeMillisClock()=1000;
    const uint32_t raw=(uint32_t)(750/0.0078125)<<5;
    maxRegs[12]=(uint8_t)(raw>>16); maxRegs[13]=(uint8_t)(raw>>8); maxRegs[14]=(uint8_t)raw;
    MAX31856TempSensor max56(1,2,3,4,"K","MAX31856");
    spiWrites=false;
    max56.begin();
    fakeMillisClock()+=300; max56.update(); assert(!max56.isHealthy());
    spiWrites=true;
    fakeMillisClock()+=300; max56.update(); assert(!max56.isHealthy());
    fakeMillisClock()+=120; max56.update(); assert(!max56.isHealthy());
    fakeMillisClock()+=140; max56.update();
    assert(max56.isHealthy() && max56.getValue()==750);
    // Peripheral reset must not publish the reset 0 C as a real conversion.
    maxRegs[0]=maxRegs[1]=0;
    fakeMillisClock()+=120; max56.update(); assert(!max56.isHealthy());
    fakeMillisClock()+=260; max56.update(); assert(max56.isHealthy());
    maxRegs[15]=1;
    fakeMillisClock()+=120; max56.update(); assert(!max56.isHealthy());
    maxRegs[15]=0;
    fakeMillisClock()+=120; max56.update(); assert(max56.isHealthy());
    assert(!spiOrderingViolation);
    std::cout<<"MAX31856 configuration retry/settling, retained-mode ordering, reset and fault recovery passed\n";

    spiReadOnly=true;
    readOnlyFrame=(uint32_t)(650*4)<<18;
    MAX31855TempSensor max55(1,2,3,"MAX31855");
    max55.begin();
    fakeMillisClock()+=100; max55.update(); assert(!max55.isHealthy());
    fakeMillisClock()+=100; max55.update();
    assert(max55.isHealthy() && max55.getValue()==650);
    for(unsigned i=0;i<3;++i) {
        fakeMillisClock()+=100; max55.update();
        assert(max55.isHealthy() && max55.getValue()==650);
    }
    // Force mode-3 idle HIGH from another chip; CS must still capture D31
    // before the first falling edge instead of doubling the temperature.
    digitalWrite(1,HIGH);
    fakeMillisClock()+=100; max55.update();
    assert(max55.isHealthy() && max55.getValue()==650);
    readOnlyFrame=0x00010001;
    fakeMillisClock()+=100; max55.update(); assert(!max55.isHealthy());
    readOnlyBits=16;
    readOnlyFrame=(uint32_t)(640*4)<<3;
    MAX6675TempSensor max75(1,2,3,"MAX6675");
    max75.begin();
    for(unsigned i=0;i<3;++i) {
        digitalWrite(1,HIGH);
        fakeMillisClock()+=250; max75.update();
        assert(max75.isHealthy() && max75.getValue()==640);
    }
    spiReadOnly=false;
    fakeMillisClock()+=120; max56.update(); assert(max56.isHealthy() && max56.getValue()==750);
    std::cout<<"MAX31855 repeated reads, power-up wait, fault detection, shared-clock mode switching and unchanged MAX6675 reads passed\n";

    DS18B20TempSensor ds("DS18B20");
    oneWireDevice=FakeOneWireDevice{};
    ds.begin(5,10);
    dsTick(ds,200); assert(ds.isHealthy() && ds.getValue()==25);
    oneWireDevice.stuckLow=true;
    dsTick(ds,210); assert(!ds.isHealthy());
    oneWireDevice.stuckLow=false;
    dsTick(ds,210); assert(ds.isHealthy());
    oneWireDevice.scratch[4]=0x7F; // separately powered sensor returned to 12-bit.
    dsTick(ds,210); assert(!ds.isHealthy());
    dsTick(ds,760); assert(ds.isHealthy() && oneWireDevice.scratch[4]==0x3F);
    oneWireDevice.rejectConfig=true;
    oneWireDevice.scratch[4]=0x7F;
    ds.begin(5,10); // ROM discovery succeeds, configuration temporarily fails.
    oneWireDevice.rejectConfig=false;
    dsTick(ds,1520); assert(ds.isHealthy());
    // 85 C is legitimate after an actual conversion, including the first one.
    oneWireDevice.scratch[0]=0x50; oneWireDevice.scratch[1]=0x05;
    dsTick(ds,210); assert(ds.isHealthy() && ds.getValue()==85);
    std::cout<<"DS18B20 stuck-low rejection, transient setup recovery, resolution recovery and real 85 C passed\n";
    HX711Sensor hx(7,8,"HX711"); hx.begin();
    fakeMillisClock()+=400;
    auto hxSample=[&](int32_t raw) {
        hxFrame=(uint32_t)raw&0xFFFFFF; hxPulses=0; hxReady=true;
        hx.update(); assert(hxPulses==25);
    };
    for(unsigned i=0;i<3;++i) {hxSample(-1000);fakeMillisClock()+=100;}
    assert(hx.isHealthy() && hx.rawCounts()==-1000);
    hxReady=false; hxPulses=0;
    fakeMillisClock()+=501; hx.update(); assert(!hx.isHealthy());
    hxSample(500); assert(hx.isHealthy() && hx.rawCounts()==500);
    hxSample(0x7FFFFF); hxSample(0x7FFFFF); hxSample(0x7FFFFF);
    assert(!hx.isHealthy());
    hxSample(-200); assert(hx.isHealthy() && hx.rawCounts()==-200);
    std::cout<<"HX711 signed samples, 25-clock selection, stale/saturated recovery and old-median rejection passed\n";
}
