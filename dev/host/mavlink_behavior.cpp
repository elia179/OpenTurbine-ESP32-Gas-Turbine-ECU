#include <cassert>
#include <cmath>
#include <map>
#include <string>
#include <iostream>
#include "src/system/MAVLinkOutput.h"
bool HardwareConfig::hasN1Rpm=false, HardwareConfig::hasN2Rpm=false;
bool HardwareConfig::hasTot=false, HardwareConfig::hasTit=false;
bool HardwareConfig::hasOilPress=false, HardwareConfig::hasOilTemp=false;
bool HardwareConfig::hasBattVoltage=false, HardwareConfig::hasFuelPress=false;
bool HardwareConfig::hasTorque=false, HardwareConfig::hasThrust=false;
bool HardwareConfig::hasFuelFlow=false, HardwareConfig::hasThrottle=false;
bool HardwareConfig::hasP1=false, HardwareConfig::hasP2=false;
bool HardwareConfig::hasThrottleInput=false, HardwareConfig::hasIdleInput=false;
int HardwareConfig::mavlinkIntervalMs=200;
struct Frames {int heartbeats=0;std::map<std::string,float> values;};
Frames decode(const std::vector<uint8_t>& bytes){
 Frames result;
 for(size_t i=0;i<bytes.size();){
  assert(bytes[i]==0xfe);const size_t length=bytes[i+1];assert(i+length+8<=bytes.size());
  const auto id=bytes[i+5];uint8_t extra=id==0?50:id==251?170:83;
  // Independent byte-wise MAVLink X25 accumulator, including CRC_EXTRA.
  uint16_t crc=0xffff;
  auto accumulate=[&](uint8_t b){crc^=b;for(int bit=0;bit<8;bit++)crc=(crc&1)?(crc>>1)^0x8408:crc>>1;};
  for(size_t j=i+1;j<i+length+6;j++)accumulate(bytes[j]);accumulate(extra);
  assert(bytes[i+length+6]==(crc&255)&&bytes[i+length+7]==(crc>>8));
  assert(bytes[i+3]==1&&bytes[i+4]==200);
  if(id==0)result.heartbeats++;
  if(id==251){float value;memcpy(&value,&bytes[i+10],4);assert(std::isfinite(value));result.values[std::string(reinterpret_cast<const char*>(&bytes[i+14]),strnlen(reinterpret_cast<const char*>(&bytes[i+14]),10))]=value;}
  i+=length+8;
 }return result;
}
int main(){
 HardwareSerial serial;MAVLinkOutput output;output.begin(serial);
 auto& ed=EngineData::instance();ed.p1=3.5;ed.p2=1.2;ed.p1Healthy=ed.p2Healthy=true;
 HardwareConfig::hasP1=HardwareConfig::hasP2=true;
 HardwareConfig::hasThrottleInput=HardwareConfig::hasIdleInput=true;
 ed.rcThrottleValid=ed.rcIdleValid=true;ed.rcThrottleNorm=.75;ed.rcIdleNorm=.25;
 fakeMillisClock()=200;output.tick();auto f=decode(serial.bytes);
 assert(f.heartbeats==1&&f.values["P1_BAR"]==3.5f&&f.values["P2_BAR"]==1.2f);
 serial.bytes.clear();fakeMillisClock()=400;ed.p1Healthy=false;ed.p2=NAN;output.tick();f=decode(serial.bytes);
 assert(f.heartbeats==0&&!f.values.count("P1_BAR")&&!f.values.count("P2_BAR"));
 // Heartbeat still runs at 1 Hz with a 5-second sensor interval.
 HardwareConfig::mavlinkIntervalMs=5000;serial.bytes.clear();fakeMillisClock()=1200;output.tick();assert(decode(serial.bytes).heartbeats==1);
 // FIFO pressure never emits a partial frame and retries heartbeat.
 output.begin(serial);serial.bytes.clear();serial.capacity=8;fakeMillisClock()=1400;output.tick();assert(serial.bytes.empty());
 serial.capacity=4096;fakeMillisClock()=1401;output.tick();assert(decode(serial.bytes).heartbeats==1);
 output.sendStatusText("test fault");decode(serial.bytes);
 // A small FIFO must eventually send every fitted value, not starve tail fields.
 HardwareConfig::hasN1Rpm=HardwareConfig::hasN2Rpm=HardwareConfig::hasTot=HardwareConfig::hasTit=true;
 HardwareConfig::hasOilPress=HardwareConfig::hasOilTemp=HardwareConfig::hasBattVoltage=HardwareConfig::hasFuelPress=true;
 HardwareConfig::hasTorque=HardwareConfig::hasThrust=HardwareConfig::hasFuelFlow=HardwareConfig::hasThrottle=true;
 ed.n1Healthy=ed.n2Healthy=ed.totHealthy=ed.titHealthy=ed.oilHealthy=ed.oilTempHealthy=true;
 ed.battHealthy=ed.fuelPressHealthy=ed.torqueHealthy=ed.thrustHealthy=ed.fuelFlowHealthy=ed.p1Healthy=true;
 ed.p2=1.2;HardwareConfig::mavlinkIntervalMs=100;serial.capacity=80;
 std::map<std::string,float> seen;
 for(int i=0;i<12;i++){serial.bytes.clear();fakeMillisClock()+=100;output.tick();auto frame=decode(serial.bytes);seen.insert(frame.values.begin(),frame.values.end());}
 assert(seen.size()==14);
 std::cout<<"MAVLink framing/CRC, pressure values, health, heartbeat and FIFO checks passed\n";
}
