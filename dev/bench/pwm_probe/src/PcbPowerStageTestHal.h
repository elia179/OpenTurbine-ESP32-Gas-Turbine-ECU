#pragma once
#include <Arduino.h>
#include <driver/mcpwm_prelude.h>
#include <driver/gpio.h>
#include <vector>
#include <array>
#include <algorithm>
#include <cmath>
#include <cassert>
using std::isfinite;
namespace Mock {
inline int gpio[128]={};inline bool i2cFail=false,lockFail=false,readCorrupt=false,persistentFault=false;
inline uint8_t regs[4]={255,255,0,255};inline int selected=-1,bit=0;inline uint16_t tx=0;
inline uint16_t driver[2][6]={};inline int spiWrites=0,unsafeConfig=0;inline uint32_t transactionDelayMs=0;
inline std::vector<std::array<int,2>> writes;
inline void latch(uint8_t next){
 for(int chip=0;chip<2;chip++){
  const bool was=!(regs[1]&(1<<chip)),now=!(next&(1<<chip));
  if(!was&&now){selected=chip;bit=0;tx=0;}
  if(was&&!now&&selected==chip){
   assert(bit==16);int addr=(tx>>11)&15;
   if(!(tx&0x8000)&&addr>=2&&addr<=5){driver[chip][addr]=tx&0x7ff;if(addr==2 && (tx&1)){if(!Mock::persistentFault)driver[chip][0]=driver[chip][1]=0;driver[chip][2]&=~1;}spiWrites++;if(next&0xfc)unsafeConfig++;}
   selected=-1;
  }
 }
 regs[1]=next;
}
}
inline int probeRead(int pin){
 if(pin!=102)return digitalRead(pin);
 if(Mock::selected<0)return 1;
 const int chip=Mock::selected;Mock::tx=uint16_t((Mock::tx<<1)|Mock::gpio[101]);
 const int b=Mock::bit++;int addr=(Mock::tx>>(b<5?0:b-4))&15;
 // The register address is complete after the first five clocked bits.
 if(b<5)return 0;
 addr=(Mock::tx>>(b-4))&15;
 return addr<6?((Mock::driver[chip][addr]>>(15-b))&1):1;
}
class FakeWire {
 std::vector<uint8_t> data;uint8_t selectedReg=0;
public:
 void beginTransmission(uint8_t address){assert(address==0x21);data.clear();}
 void write(uint8_t v){data.push_back(v);}
 int endTransmission(bool=true){
  if(Mock::transactionDelayMs)delay(Mock::transactionDelayMs);
  if(Mock::i2cFail)return 4;
  selectedReg=data[0];
  if(data.size()>1){Mock::writes.push_back({selectedReg,data[1]});
   if(selectedReg==1)Mock::latch(data[1]);else Mock::regs[selectedReg]=data[1];}
  return 0;
 }
 int requestFrom(uint8_t,uint8_t){return Mock::i2cFail?0:1;}
 int read(){return Mock::regs[selectedReg]^(Mock::readCorrupt?1:0);}
};inline FakeWire Wire;
namespace SharedPeripheralBus {struct Guard{explicit operator bool()const{return !Mock::lockFail;}};}
class Config {public:inline static uint32_t controlLoopHz=400;};
class EngineData {public:bool hardwareReady=true;char hardwareFault[128]={};static EngineData& instance(){static EngineData ed;return ed;}};
class ChannelRegistry {public:enum Driver {Relay=4,Pwm=5,Servo=6};struct Channel {bool installed=true,inverted=false;int pin=-1;Driver driver=Servo;};uint8_t outputCount=0;Channel outputs[16];};
class HardwareConfig {public:inline static ChannelRegistry channelRegistry;};
class PcbProfileManager {
public:
 struct Bus{int sck=100,mosi=101,miso=102;};
 struct Catalog {bool hasPowerStage=true;int powerInh[6]={11,12,18,21,39,40};char powerSpiBusId[24]="shared_spi";int outputEnableGpio=47;};
 inline static bool enabled=true;
 static bool active(){return enabled;}
 static const Catalog* catalog(){static Catalog p;return &p;}
 static const Bus* findBus(const char*){static Bus b;return &b;}
};

// Virtual SPI pins never reach GPIO. Real power/heartbeat writes and MCPWM use
// the actual ESP-IDF peripherals on the disconnected development-board fixture.
inline void probeWrite(int pin,int value){Mock::gpio[pin]=value;if(pin<49)digitalWrite(pin,value);}
inline void probeMode(int pin,int mode){if(pin<49)pinMode(pin,mode);}
#define digitalWrite probeWrite
#define digitalRead probeRead
#define pinMode probeMode
