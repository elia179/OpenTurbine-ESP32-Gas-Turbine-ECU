#include <Arduino.h>
#include <cassert>
#include <map>
#include <vector>
#include <iostream>
using std::max;using std::min;using std::isfinite;
static constexpr int INPUT=0,OUTPUT=1,INPUT_PULLUP=2,LOW=0,HIGH=1;
static std::map<int,int> levels;
static std::map<int,int> transitions;
inline void pinMode(int,int){}
inline int digitalRead(int){return 1;}
inline void digitalWrite(int pin,int value){if(levels[pin]!=value)transitions[pin]++;levels[pin]=value;}
#include "../../src/platform/esp32/StatusLED.h"
#include "fakes/PcbProfileState.h"
bool HardwareConfig::hasStatusLed=true;
bool HardwareConfig::hasFaultLed=false;
int HardwareConfig::faultLedPin=4;
bool HardwareConfig::faultLedActiveH=true;
int HardwareConfig::statusLedPin=2;
bool HardwareConfig::statusLedActiveH=true;
int HardwareConfig::statusLedType=0;
int HardwareConfig::statusLedMode=0;
uint32_t HardwareConfig::statusLedStandbyColor=0x00ff00;
uint32_t HardwareConfig::statusLedStartupColor=0x0000ff;
uint32_t HardwareConfig::statusLedRunningColor=0x00ff00;
uint32_t HardwareConfig::statusLedShutdownColor=0xff8000;
uint32_t HardwareConfig::statusLedBlinkColor=0x0000ff;
static void run(unsigned duration){for(unsigned t=0;t<duration;t+=10){fakeMillisClock()+=10;StatusLED::tick();}}
int main(){
 auto& ed=EngineData::instance();
 fakeMillisClock()=1000;ed.mode=SysMode::FAULT;
 StatusLED::begin();transitions.clear();run(1000);
 assert(transitions[2]>=8);assert(!transitions[4]);
 HardwareConfig::hasFaultLed=true;
 StatusLED::begin();transitions.clear();run(2400);
 assert(transitions[4]>=20);assert(transitions[2]<=4);
 ed.mode=SysMode::STANDBY;run(20);assert(levels[4]==LOW);
 HardwareConfig::faultLedActiveH=false;run(20);assert(levels[4]==HIGH);
 ed.mode=SysMode::FAULT;transitions.clear();run(500);assert(transitions[4]>=4);
 HardwareConfig::hasStatusLed=false;ed.mode=SysMode::STANDBY;
 StatusLED::tickFault();assert(levels[4]==HIGH);
 std::cout<<"Fault LED: legacy fallback, separate blink, normal status, clear, polarity and fault-only lifecycle passed.\n";
}
