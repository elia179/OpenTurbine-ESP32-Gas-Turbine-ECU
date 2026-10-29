#include <freertos/FreeRTOS.h>
#include <fstream>
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

#include "src/system/MavlinkService.cpp"
bool HardwareConfig::mavlinkAllowCommands=true;
int HardwareConfig::mavlinkSystemId=1,HardwareConfig::mavlinkComponentId=200;
int HardwareConfig::mavlinkControllerSystem=255,HardwareConfig::mavlinkControllerComponent=190;
int HardwareConfig::mavlinkInputTimeoutMs=500,HardwareConfig::mavlinkIntervalMs=100;
bool HardwareConfig::abRequiresArmSwitch=false;
bool Config::profileMatch=true;
float Config::standbyOilFeedPct=0;
const char* preflight=nullptr;
bool WebServer::otaInProgress(){return false;}
bool WebServer::rebootPending(){return false;}
const char* WebServer::startRejectReason(){return preflight;}
int executed=0;bool acceptCore=false;
void core(const OTPacket& packet){
 if(!CommandQueue::beginExecution(packet,millis()))return;
 executed++;CommandQueue::completeResult(packet.requestId,acceptCore,acceptCore?"":"Core readiness rejection");
}
int main(){
 using namespace OpenTurbineMavlink;
 HardwareSerial port;port.capacity=65536;MavlinkService service;CommandQueue::begin();service.begin(port);
 Writer peer;peer.system=255;peer.component=190;mavlink_message_t msg{};
 auto feed=[&](){uint8_t bytes[MAVLINK_MAX_PACKET_LEN];auto count=mavlink_msg_to_send_buffer(bytes,&msg);port.incoming.insert(port.incoming.end(),bytes,bytes+count);service.tick();service.tick();};
 mavlink_heartbeat_t heartbeat{};mavlink_msg_heartbeat_encode_status(255,190,peer.status(),&msg,&heartbeat);feed();
 mavlink_ot_command_request_t request{};request.sender_session=55;request.request_id=1;request.boot_id=bootId();request.operation=Start;request.target_system=1;request.target_component=200;
 auto command=[&](){mavlink_msg_ot_command_request_encode_status(peer.system,peer.component,peer.status(),&msg,&request);feed();};
 auto result=[&](){Parser parser;mavlink_message_t answer{};mavlink_ot_command_result_t decoded{};bool found=false;for(uint8_t c:port.bytes)if(parser.push(c,answer)&&answer.msgid==MAVLINK_MSG_ID_OT_COMMAND_RESULT){mavlink_msg_ot_command_result_decode(&answer,&decoded);if(decoded.request_id==request.request_id)found=true;}assert(found);return decoded;};
 command();assert(result().result==MAV_RESULT_IN_PROGRESS);CommandQueue::drain(core);assert(executed==1);service.tick();assert(result().result==MAV_RESULT_DENIED);
 command();CommandQueue::drain(core);assert(executed==1); // lost ACK retry never repeats
 request.request_id=2;command();peer.system=10;request.operation=Stop;command();peer.system=255;CommandQueue::drain(core);assert(executed==2); // unauthorized Stop cannot cancel pending Start
 request.request_id=3;request.operation=Start;command();request.request_id=4;request.operation=Stop;command();acceptCore=true;CommandQueue::drain(core);service.tick();assert(result().result==MAV_RESULT_ACCEPTED);assert(executed==3); // only Stop survives queue priority
 mavlink_ot_remote_input_t input{};input.boot_id=bootId();input.time_boot_ms=100;input.sender_session=55;input.sequence=1;input.value=.4f;input.target_system=1;input.target_component=200;
 auto throttle=[&](){mavlink_msg_ot_remote_input_encode_status(peer.system,peer.component,peer.status(),&msg,&input);feed();};
 fakeMillisClock()=100;throttle();assert(EngineData::instance().mavlinkThrottleValid);
 fakeMillisClock()=400;throttle();fakeMillisClock()=600;service.tick();assert(!EngineData::instance().mavlinkThrottleValid); // replay does not refresh
 input.time_boot_ms=600;input.sequence=2;input.value=NAN;throttle();assert(!EngineData::instance().mavlinkThrottleValid);
 input.value=.8f;input.target_system=2;throttle();assert(!EngineData::instance().mavlinkThrottleValid);
 input.target_system=1;input.value=.8f;input.time_boot_ms=1;input.sequence=3;throttle();assert(!EngineData::instance().mavlinkThrottleValid); // buffered old demand
 input.time_boot_ms=600;input.boot_id++;throttle();assert(!EngineData::instance().mavlinkThrottleValid); // previous ECU boot
 request.operation=Start;request.request_id=10;request.time_boot_ms=0;fakeMillisClock()=5000;command();CommandQueue::drain(core);assert(executed==3); // delayed new operation cannot execute
 HardwareConfig::hasN1Rpm=HardwareConfig::hasTot=HardwareConfig::hasFuelFlow=true;
 auto& ed=EngineData::instance();ed.n1Healthy=ed.totHealthy=ed.fuelFlowHealthy=true;
 ed.n1Rpm=60000;ed.tot=650;ed.fuelFlow=.25f;fakeMillisClock()=10000;service.tick();
 std::ofstream golden("artifacts/mavlink-service-golden.bin",std::ios::binary);golden.write(reinterpret_cast<const char*>(port.bytes.data()),port.bytes.size());
 std::cout<<"MAVLink ECU core-result correlation, retries, permission, Stop priority and throttle validity passed\n";
}
