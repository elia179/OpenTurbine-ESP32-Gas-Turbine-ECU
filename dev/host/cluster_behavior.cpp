#include <cassert>
#include <iostream>
#include <algorithm>
using std::max;
class Print;
#include "src/system/ClusterSerial.cpp"
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
QueueHandle_t CommandQueue::_queue=nullptr;
int main(){
 auto& ed=EngineData::instance();assert(!hasN1());
 HardwareConfig::hasN1Rpm=true;assert(hasN1());
 ed.n1Healthy=true;assert(healthFlags(ed)&1);
 HardwareConfig::hasP1=HardwareConfig::hasP2=true;
 HardwareConfig::hasFuelFlow=HardwareConfig::hasThrust=true;
 ed.p1Healthy=ed.p2Healthy=ed.fuelFlowHealthy=ed.thrustHealthy=true;
 assert((healthFlags(ed)&0xf0000)==0xf0000);
 ed.p1Healthy=false;assert(!(healthFlags(ed)&(1UL<<16)));
 HardwareConfig::hasP2=false;assert(!(healthFlags(ed)&(1UL<<17)));
 // Actual production frame encoder: no partial packet if FIFO is full.
 uint8_t data[]={1,2,3};_port.capacity=8;assert(!sendFrame(FT_TELEMETRY,7,data,3));assert(_port.bytes.empty());
 _port.capacity=4096;assert(sendFrame(FT_TELEMETRY,7,data,3));
 const auto& b=_port.bytes;assert(b.size()==12&&b[0]=='O'&&b[1]=='T'&&b[2]==1&&b[3]==4&&b[4]==7&&b[5]==3);
 // Independent CRC16-CCITT-FALSE verification.
 uint16_t crc=0xffff;for(size_t i=2;i<10;i++){crc^=uint16_t(b[i])<<8;for(int j=0;j<8;j++)crc=crc&0x8000?(crc<<1)^0x1021:crc<<1;}
 assert(b[10]==(crc&255)&&b[11]==(crc>>8));
 // Full production schema must omit unfitted N1 and advertise compatible minor 1.
 auto schema=[&](bool n1){
  HardwareConfig::hasClusterSerial=true;HardwareConfig::hasN1Rpm=n1;
  _port.bytes.clear();ClusterSerial::begin();bool found=false,hello=false,end=false;
  for(size_t i=0;i<_port.bytes.size();){
   const auto& p=_port.bytes;assert(i+9<=p.size()&&p[i]=='O'&&p[i+1]=='T');
   const size_t length=p[i+5]+(size_t(p[i+6])<<8);assert(i+9+length<=p.size());
   if(p[i+3]==FT_HELLO){hello=true;assert(p[i+7]==1&&p[i+8]==1);}
   if(p[i+3]==FT_FIELD_DEF&&p[i+8]==F_N1_RPM)found=true;
   if(p[i+3]==FT_SCHEMA_END)end=true;
   i+=length+9;
  }
  assert(hello&&end&&found==n1);
 };
 schema(false);schema(true);
 std::cout<<"Cluster fitment/health and production frame CRC/FIFO checks passed\n";
}
