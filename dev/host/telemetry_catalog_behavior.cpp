#include <freertos/FreeRTOS.h>
#include <cassert>
#include <iostream>
#include <algorithm>
using std::max;
class Print;
#include "src/system/TelemetryCatalog.cpp"
bool HardwareConfig::hasN1Rpm=false, HardwareConfig::hasN2Rpm=false;
bool HardwareConfig::hasTot=false, HardwareConfig::hasTit=false;
bool HardwareConfig::hasOilPress=false, HardwareConfig::hasOilTemp=false;
bool HardwareConfig::hasBattVoltage=false, HardwareConfig::hasFuelPress=false;
bool HardwareConfig::hasTorque=false, HardwareConfig::hasThrust=false;
bool HardwareConfig::hasP1=false, HardwareConfig::hasP2=false;
bool HardwareConfig::hasFuelFlow=false, HardwareConfig::hasFlame=false;
bool HardwareConfig::hasAfterburner=false, HardwareConfig::hasAbFlame=false;
bool HardwareConfig::hasThrottleInput=false, HardwareConfig::hasIdleInput=false;
// Fixture configuration only; the encoder/schema/health logic below is production code.
#define FLAG(name) bool HardwareConfig::name=false;
FLAG(hasAbPump) FLAG(hasAbSol) FLAG(hasAirstarterSol) FLAG(hasBleedValve)
FLAG(hasClusterSerial) FLAG(hasCoolFan) FLAG(hasFuelPump2) FLAG(hasFuelSol)
FLAG(hasGlowCurrentSensor) FLAG(hasGlowPlug) FLAG(hasIgniter) FLAG(hasIgniter2)
FLAG(hasIgniter2CurrentSensor) FLAG(hasIgniterCurrentSensor) FLAG(hasOilPump)
FLAG(hasOilPumpCurrentSensor) FLAG(hasOilScavengePump) FLAG(hasPropPitch)
FLAG(hasStarter) FLAG(hasStarterEn) FLAG(hasThrottle)
#undef FLAG
#if defined(OT_PLATFORM_ESP32S3)
ChannelRegistry HardwareConfig::channelRegistry;
#else
static ChannelRegistry registry;
ChannelRegistry& HardwareConfig::channelRegistry=registry;
#endif
HardwareConfig::DiChannel HardwareConfig::diCh[HardwareConfig::MAX_DI] = {};
int HardwareConfig::abInputPin=-1,HardwareConfig::abTriggerSource=0;
int HardwareConfig::clusterBaud=115200,HardwareConfig::clusterIntervalMs=50;
int HardwareConfig::clusterRxPin=-1,HardwareConfig::clusterTxPin=17;
char HardwareConfig::profileId[64]="Test ECU";
float Config::rpmLimit=60000,Config::totWarnC=0,Config::n1WarnRpm=0,Config::n2WarnRpm=0;
float Config::totSafeMargin=50,Config::oilRunningMin=2,Config::oilWarnBar=0,Config::oilZeroBar=.2;
int Config::abPumpControlMode=0;
int Config::effectiveEgtSource(){return HardwareConfig::hasTot?1:0;}
float Config::primaryEgtLimitC(){return 750;}
float Config::primaryEgtC(const EngineData& ed){return ed.tot;}
bool Config::primaryEgtHealthy(const EngineData& ed){return ed.totHealthy;}

float Config::n2RpmLimit=60000,Config::totLimit=750,Config::titLimit=950;
float Config::p1TripLimit=4,Config::p2TripLimit=2,Config::torqueTripLimit=20;
int Config::ruleCount=0;
bool HardwareConfig::hasMAVLink=false;
int HardwareConfig::mavlinkRxPin=-1;
char HardwareConfig::labelN1[32]="Core speed",HardwareConfig::labelN2[32]="Output speed";
char HardwareConfig::labelTot[32]="Exhaust",HardwareConfig::labelTit[32]="Inlet";
char HardwareConfig::labelOilPress[32]="Oil pressure",HardwareConfig::labelOilTemp[32]="Oil temperature";
char HardwareConfig::labelP1[32]="Boost",HardwareConfig::labelP2[32]="Jetpipe";
char HardwareConfig::labelFuelPress[32]="Fuel pressure",HardwareConfig::labelFuelFlow[32]="Fuel flow";
bool HardwareConfig::idleInputRcPwm=false,HardwareConfig::throttleInputRcPwm=false;
int Config::idleMinRaw=0,Config::idleMaxRaw=3300,Config::throttleMinRaw=0,Config::throttleMaxRaw=3300;
Config::Rule Config::rules[Config::MAX_RULES]={};
int main(){
 auto& reg=HardwareConfig::channelRegistry;
 assert(TelemetryCatalog::count()==0);reg.inputCount=1;
 auto& input=reg.inputs[0];input.installed=true;strlcpy(input.id,"core",sizeof(input.id));strlcpy(input.name,"Core speed",sizeof(input.name));strlcpy(input.purpose,"n1_speed",sizeof(input.purpose));
 assert(TelemetryCatalog::count()==1);
 mavlink_ot_channel_info_t info{};assert(TelemetryCatalog::describe(0,info));
 assert(info.channel_id==256);assert(!strcmp(info.name,"Core speed"));assert(info.limit==60000);
 auto& ed=EngineData::instance();ed.registryInputValue[0]=60000;ed.registryInputHealthy[0]=false;
 uint16_t id;float value;bool healthy;assert(TelemetryCatalog::sample(0,id,value,healthy));assert(!healthy&&isnan(value));
 ed.registryInputHealthy[0]=true;assert(TelemetryCatalog::sample(0,id,value,healthy));assert(healthy&&value==60000);
 const auto revision=TelemetryCatalog::revision();Config::rpmLimit=65000;assert(revision!=TelemetryCatalog::revision());
 input.installed=false;assert(TelemetryCatalog::count()==0);assert(!TelemetryCatalog::describe(0,info));
 std::cout<<"Fitted catalogue, labels, limits, revision and health checks passed\n";
}
