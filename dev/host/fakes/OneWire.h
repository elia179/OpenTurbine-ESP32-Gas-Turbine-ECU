#pragma once
#include <Arduino.h>
#include <array>
#include "../../../src/hal/sensors/SensorProtocolDecode.h"

struct FakeOneWireDevice {
    bool present=true, stuckLow=false, rejectConfig=false;
    uint8_t command=0, writeIndex=0;
    size_t readIndex=0;
    std::array<uint8_t,9> scratch{{0x90,0x01,75,70,0x7F,255,12,16,0}};
    unsigned conversions=0;
    void crc() { scratch[8]=SensorProtocolDecode::dallasCrc8(scratch.data(),8); }
};
inline FakeOneWireDevice oneWireDevice;
class OneWire {
public:
    explicit OneWire(int) {}
    void reset_search() { searched=false; }
    bool search(uint8_t* rom) {
        if(searched || !oneWireDevice.present) return false;
        searched=true;
        const uint8_t address[7]={0x28,1,2,3,4,5,6};
        std::memcpy(rom,address,7); rom[7]=crc8(rom,7); return true;
    }
    bool reset() { oneWireDevice.command=0; return oneWireDevice.present; }
    void select(const uint8_t*) {}
    void write(uint8_t byte, uint8_t=0) {
        auto& d=oneWireDevice;
        if(d.command==0x4E && d.writeIndex<3) {
            if(!d.rejectConfig) d.scratch[2+d.writeIndex]=byte;
            ++d.writeIndex; d.crc(); return;
        }
        d.command=byte; d.writeIndex=0;
        if(byte==0xBE) {d.readIndex=0; d.crc();}
        if(byte==0x44) ++d.conversions;
    }
    uint8_t read() {
        auto& d=oneWireDevice;
        if(d.stuckLow) return 0;
        if(!d.present) return 255;
        return d.scratch[d.readIndex++%9];
    }
    static uint8_t crc8(const uint8_t* p,uint8_t n) {
        return SensorProtocolDecode::dallasCrc8(p,n);
    }
private:
    bool searched=false;
};
