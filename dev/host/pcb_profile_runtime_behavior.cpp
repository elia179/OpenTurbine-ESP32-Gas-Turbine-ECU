#include <Arduino.h>
#include <cassert>
#include <fstream>
#include <iostream>
using std::isfinite;
constexpr int LOW=0,HIGH=1,OUTPUT=1;
static int gpio[49]={};
inline void digitalWrite(int p,int v){gpio[p]=v;}
inline void pinMode(int,int){}
#include "../../src/system/pcb/PcbProfileManager.cpp"
static uint32_t crc(const std::string& s){uint32_t c=~0u;for(uint8_t b:s){c^=b;for(int n=0;n<8;n++)c=(c>>1)^((c&1)?0xedb88320u:0);}return ~c;}
static void load(JsonDocument& doc){
 std::string payload;serializeJson(doc,payload);
 ProfileHeader h={};memcpy(h.magic,"OTPB",4);h.containerVersion=1;h.encoding=1;h.formatMajor=doc["format_version"]["major"];h.formatMinor=doc["format_version"]["minor"];h.targetChip=2;h.origin=2;h.headerSize=32;h.payloadLength=payload.size();h.payloadCrc32=crc(payload);
 fakePartitionData.resize(32+payload.size());memcpy(fakePartitionData.data(),&h,32);memcpy(fakePartitionData.data()+32,payload.data(),payload.size());
 EngineData::instance().hardwareReady=true;PcbProfileManager::begin();
}
int main(){
 std::ifstream in("pcb_profiles/official/openturbine-s3-20261102.otpcb.json");assert(in);JsonDocument source;assert(!deserializeJson(source,in));
 load(source);assert(PcbProfileManager::active());const auto* p=PcbProfileManager::catalog();
 assert(p->hasPowerStage&&p->healthHeartbeat&&p->powerControlDevice>=0&&p->portCount==34&&p->supplyVoltageDivider==37);
 PcbProfileManager::driveEarlySafeStates();for(int pin:p->powerInh)assert(gpio[pin]==LOW);
 PcbProfileManager::setOutputsEnabled(true);assert(gpio[45]==LOW);
 ChannelRegistry registry;ChannelRegistry::Channel output;output.installed=true;output.direction=ChannelRegistry::Output;output.driver=ChannelRegistry::Pwm;
 strlcpy(output.id,"power_test",sizeof(output.id));strlcpy(output.name,"Power test",sizeof(output.name));strlcpy(output.role,"generic",sizeof(output.role));strlcpy(output.purpose,"generic",sizeof(output.purpose));
 output.pin=37;output.minValue=0;output.maxValue=1;output.safeDemand=0;output.pwmTimingConfigured=true;output.pwmFrequency=20000;output.pwmResolution=14;
 assert(registry.add(output)&&registry.validate());
 registry.outputs[0].pin=18;assert(!registry.validate()); // signal LEDC retains its real timer constraints

 for(const char* bad:{"format","bus","pin","control","cs-steal","inverted","safe"}){
  JsonDocument doc;doc.set(source);
  auto power=doc["fixed_functions"]["power_stage"];
  if(!strcmp(bad,"format"))doc["format_version"]["major"]=3;
  if(!strcmp(bad,"bus"))doc["buses"][0]["frequency_hz"]=400000;
  if(!strcmp(bad,"pin"))power["inh_gpio"][1]=37;
  if(!strcmp(bad,"control"))power["control_device"]="missing";
  if(!strcmp(bad,"cs-steal"))for(auto port:doc["ports"].as<JsonArray>())if(!strcmp(port["id"]|"","status_led"))port["modes"][0]["device"]="gate_io";
  if(!strcmp(bad,"inverted"))for(auto port:doc["ports"].as<JsonArray>())if(!strcmp(port["id"]|"","power_out_1"))port["modes"][0]["active_high"]=false;
  if(!strcmp(bad,"safe"))for(auto port:doc["ports"].as<JsonArray>())if(!strcmp(port["id"]|"","power_out_1"))port["modes"][0]["safe_demand"]=1;
  load(doc);if(!PcbProfileManager::faulted()){std::cerr<<"accepted "<<bad<<"\n";return 1;}
 }
 load(source);assert(PcbProfileManager::active());
 std::cout<<"PASS real PCB profile reader: format 2, pin/resource claims, safe boot and malformed power contract rejection\n";
}
