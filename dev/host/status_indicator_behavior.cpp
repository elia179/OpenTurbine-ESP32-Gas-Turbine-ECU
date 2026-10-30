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
class Print;
#include "../../src/system/OutputActivity.h"
#include "fakes/PcbProfileState.h"
#if defined(OT_PLATFORM_ESP32)
static ChannelRegistry indicatorRegistry;
ChannelRegistry& HardwareConfig::channelRegistry=indicatorRegistry;
#else
ChannelRegistry HardwareConfig::channelRegistry;
#endif
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
float Config::standbyOilFeedPct=0;
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
 // Reassignable indicators use the selected registry pin and preserve active-low polarity.
 auto& reg=HardwareConfig::channelRegistry;reg=ChannelRegistry{};
 ChannelRegistry::Channel c;c.installed=true;c.direction=ChannelRegistry::Output;c.driver=ChannelRegistry::Relay;c.pin=9;c.inverted=true;
 strlcpy(c.id,"pcb_status",sizeof(c.id));strlcpy(c.name,"Status",sizeof(c.name));strlcpy(c.role,"indicator",sizeof(c.role));strlcpy(c.purpose,"status_led",sizeof(c.purpose));assert(reg.add(c));
 c.pin=10;c.inverted=false;strlcpy(c.id,"pcb_fault",sizeof(c.id));strlcpy(c.purpose,"fault_led",sizeof(c.purpose));assert(reg.add(c));
 HardwareConfig::hasFaultLed=false;HardwareConfig::statusLedPin=-1;
 ed.mode=SysMode::FAULT;StatusLED::begin();transitions.clear();run(2400);
 assert(transitions[10]>=20);assert(transitions[9]<=4);
 StatusLED::_writeRegistryIndicator(false,true);StatusLED::off();assert(levels[9]==HIGH);
 ed.mode=SysMode::STANDBY;run(20);assert(levels[10]==LOW);
 // Temporary Tools ownership holds the selected LED on instead of letting
 // the automatic blink writer overwrite its demand. Releasing it resumes
 // ordinary indication and permits STOP/timeout cancellation.
 ed.registryOutputTestIndex=1;ed.registryOutputDemand[1]=1.0f;
 run(2400);assert(levels[10]==HIGH);
 ed.registryOutputTestIndex=255;StatusLED::tickFault();assert(levels[10]==LOW);
 ed.registryOutputTestIndex=0;ed.registryOutputDemand[0]=1.0f;
 run(2400);assert(levels[9]==LOW);
 ed.registryOutputDemand[0]=0.0f;StatusLED::_writeRegistryIndicator(false,false);assert(levels[9]==HIGH);
 ed.registryOutputTestIndex=255;
 ed.registryOutputDemand[0]=1.0f;assert(!OutputActivity::anyPhysicalDemand());
 // Repurposing the LED releases it from the automatic blink writer.
 strlcpy(reg.outputs[0].purpose,"warning_indicator",sizeof(reg.outputs[0].purpose));
 assert(!StatusLED::_registryIndicator(false));
 assert(OutputActivity::anyPhysicalDemand());
 transitions.clear();StatusLED::begin();run(500);assert(!transitions[9]);
 std::cout<<"Fault LED: legacy fallback, separate blink, normal status, clear, polarity and fault-only lifecycle passed.\n";
}
