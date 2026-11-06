#include <Arduino.h>
#include <cassert>
#include <fstream>
#include <iostream>
using std::isfinite;
constexpr int LOW=0,HIGH=1,OUTPUT=1;
static int gpio[49]={};static bool configured[49]={};
inline void digitalWrite(int p,int v){gpio[p]=v;}
inline void pinMode(int pin,int){configured[pin]=true;}
#include "../../src/system/pcb/PcbProfileManager.cpp"
#include "../../src/system/pcb/PcbProfileResolver.cpp"
ChannelRegistry HardwareConfig::channelRegistry;
bool  HardwareConfig::i2cEnabled = {};
int   HardwareConfig::i2cSdaPin = {};
int   HardwareConfig::i2cSclPin = {};
int   HardwareConfig::i2cInterruptPin = {};
uint32_t HardwareConfig::i2cFrequencyHz = {};
bool  HardwareConfig::spiEnabled = {};
int   HardwareConfig::spiSckPin = {};
int   HardwareConfig::spiMisoPin = {};
int   HardwareConfig::spiMosiPin = {};
bool  HardwareConfig::hasStatusLed = {};
int   HardwareConfig::statusLedPin = {};
int   HardwareConfig::statusLedType = {};
int   HardwareConfig::statusLedMode = {};
bool  HardwareConfig::statusLedActiveH = {};
bool HardwareConfig::hasFaultLed = {};
int HardwareConfig::faultLedPin = {};
bool HardwareConfig::faultLedActiveH = {};
bool  HardwareConfig::hasBuzzer = {};
int   HardwareConfig::buzzerPin = {};
bool  HardwareConfig::hasMAVLink = {};
int   HardwareConfig::mavlinkTxPin = {};
int   HardwareConfig::mavlinkRxPin = {};
static uint32_t crc(const std::string& s){uint32_t c=~0u;for(uint8_t b:s){c^=b;for(int n=0;n<8;n++)c=(c>>1)^((c&1)?0xedb88320u:0);}return ~c;}
static void load(JsonDocument& doc){
 std::string payload;serializeJson(doc,payload);
 ProfileHeader h={};memcpy(h.magic,"OTPB",4);h.containerVersion=1;h.encoding=1;h.formatMajor=doc["format_version"]["major"];h.formatMinor=doc["format_version"]["minor"];h.targetChip=2;h.origin=2;h.headerSize=32;h.payloadLength=payload.size();h.payloadCrc32=crc(payload);
 fakePartitionData.resize(32+payload.size());memcpy(fakePartitionData.data(),&h,32);memcpy(fakePartitionData.data()+32,payload.data(),payload.size());
 EngineData::instance().hardwareReady=true;PcbProfileManager::begin();
}
int main(int argc,char** argv){
 std::ifstream in("pcb_profiles/official/openturbine-s3-20261102.otpcb.json");assert(in);JsonDocument source;assert(!deserializeJson(source,in));
 load(source);assert(PcbProfileManager::active());const auto* p=PcbProfileManager::catalog();
 assert(p->hasPowerStage&&p->healthHeartbeat&&p->powerControlDevice>=0&&p->portCount==34&&p->supplyVoltageDivider==37);
 assert(p->gpioHeaderCount==4);for(int pin:p->powerInh)assert(PcbProfileManager::gpioReserved(pin));
 for(int pin:{17,48,46,47})assert(!PcbProfileManager::gpioReserved(pin));

 // Exercise canonicalization even when the release runner supplies no exported files.
 JsonDocument oldChannel;oldChannel["inputs"].to<JsonArray>();
 auto tc=oldChannel["inputs"].as<JsonArray>().add<JsonObject>();
 tc["id"]="tot_main";tc["name"]="TOT";tc["purpose"]="tot";tc["role"]="temperature";tc["driver"]=1;tc["pin"]=-1;
 tc["physical_port"]="thermocouple_1";tc["physical_mode"]="temperature";tc["temp_interface"]=3;tc["min"]=0;tc["max"]=4095;
 ChannelRegistry canonical;assert(!canonical.fromJson(oldChannel.as<JsonObjectConst>()));
 assert(canonical.fromJson(oldChannel.as<JsonObjectConst>(),PcbProfileResolver::resolveChannel));
 assert(canonical.inputs[0].spiCs==14&&canonical.inputs[0].spiClk==12&&canonical.inputs[0].spiMiso==13&&canonical.inputs[0].spiMosi==11);
 assert(strstr(p->gpioHeaderNotes[2],"pull-down"));
 JsonDocument metadata;PcbProfileManager::toJson(metadata.to<JsonObject>());
 bool lastAdc=false;for(JsonObjectConst port:metadata["ports"].as<JsonArrayConst>())if(!strcmp(port["id"]|"","analog_8"))for(JsonObjectConst mode:port["modes"].as<JsonArrayConst>()){assert(mode["i2c_address"]==16&&mode["device_channel"]==7);lastAdc=true;}assert(lastAdc);
 for(int arg=1;arg<argc;arg++){std::ifstream setup(argv[arg]);assert(setup);JsonDocument channels;assert(!deserializeJson(channels,setup));ChannelRegistry r;if(!r.fromJson(channels.as<JsonObjectConst>())){std::cerr<<argv[arg]<<": "<<ChannelRegistry::validationError()<<"\n";return 1;}std::cout<<"PASS saved PCB engine registry "<<argv[arg]<<"\n";
 JsonDocument stale;stale.set(channels);
 for(const char* direction:{"inputs","outputs"})for(JsonObject c:stale[direction].as<JsonArray>())if(c["physical_port"].is<const char*>()){
     c["pin"]=0;c["i2c_address"]=0;c["device_channel"]=0;
     if(!strcmp(c["physical_mode"]|"","temperature"))for(const char* key:{"spi_clk","spi_cs","spi_miso","spi_mosi"})c[key]=-1;
 }
 ChannelRegistry imported;assert(!imported.fromJson(stale.as<JsonObjectConst>()));
 assert(imported.fromJson(stale.as<JsonObjectConst>(),PcbProfileResolver::resolveChannel));
 char why[128]={};assert(PcbProfileResolver::resolve(imported,why,sizeof(why)));
 assert(imported.inputCount==r.inputCount && imported.outputCount==r.outputCount);
 for(uint8_t i=0;i<r.inputCount;i++){assert(imported.inputs[i].pin==r.inputs[i].pin);assert(imported.inputs[i].deviceChannel==r.inputs[i].deviceChannel);}
 JsonDocument invalid;invalid.set(stale);invalid["inputs"][3]["physical_port"]="missing_port";
 assert(!imported.fromJson(invalid.as<JsonObjectConst>(),PcbProfileResolver::resolveChannel));
 assert(strstr(ChannelRegistry::validationError(),"missing PCB connector"));
 std::cout<<"PASS stale wiring import canonicalization and missing-connector rejection "<<argv[arg]<<"\n";
}

 PcbProfileManager::driveEarlySafeStates();for(int pin:p->powerInh)assert(gpio[pin]==LOW);
 assert(!configured[45]); // heartbeat initialization belongs to end-of-setup backend begin
 assert(gpio[14]==HIGH && gpio[3]==HIGH); // even unassigned thermocouples stay deselected
 PcbProfileManager::setOutputsEnabled(true);assert(gpio[45]==LOW);
 ChannelRegistry registry;ChannelRegistry::Channel output;output.installed=true;output.direction=ChannelRegistry::Output;output.driver=ChannelRegistry::Pwm;
 strlcpy(output.id,"power_test",sizeof(output.id));strlcpy(output.name,"Power test",sizeof(output.name));strlcpy(output.role,"generic",sizeof(output.role));strlcpy(output.purpose,"generic",sizeof(output.purpose));
 output.pin=37;output.minValue=0;output.maxValue=1;output.safeDemand=0;output.pwmTimingConfigured=true;output.pwmFrequency=20000;output.pwmResolution=14;
 assert(registry.add(output)&&registry.validate());

 JsonDocument saved;registry.toJson(saved.to<JsonObject>());ChannelRegistry restored;
 assert(saved["outputs"][0]["pwm_zero_mode"].isNull());assert(restored.fromJson(saved.as<JsonObjectConst>())&&restored.outputs[0].pwmZeroMode==0);
 registry.outputs[0].pwmZeroMode=1;registry.toJson(saved.to<JsonObject>());
 assert(saved["outputs"][0]["pwm_zero_mode"]==1);assert(restored.fromJson(saved.as<JsonObjectConst>())&&restored.outputs[0].pwmZeroMode==1);
 for(const char* invalid:{"-1","2","256","0.5","true","\"1\""}){JsonDocument bad;bad.set(saved);JsonDocument value;assert(!deserializeJson(value,invalid));bad["outputs"][0]["pwm_zero_mode"].set(value.as<JsonVariantConst>());assert(!restored.fromJson(bad.as<JsonObjectConst>()));}
 registry.outputs[0].pin=18;registry.outputs[0].pwmFrequency=1000;assert(!registry.validate()); // Coast does not apply to a logic output
 registry.outputs[0].pin=37;registry.outputs[0].driver=ChannelRegistry::Relay;assert(!registry.validate());
 registry.outputs[0].driver=ChannelRegistry::Pwm;registry.outputs[0].pwmFrequency=20000;registry.outputs[0].pwmZeroMode=0;
 registry.outputs[0].pin=18;assert(!registry.validate()); // signal LEDC retains its real timer constraints

 for(const char* bad:{"format","bus","pin","control","cs-steal","inverted","safe","header-reserved","header-power","header-duplicate"}){
  JsonDocument doc;doc.set(source);
  auto power=doc["fixed_functions"]["power_stage"];
  if(!strcmp(bad,"format"))doc["format_version"]["major"]=3;
  if(!strcmp(bad,"bus"))doc["buses"][0]["frequency_hz"]=400000;
  if(!strcmp(bad,"pin"))power["inh_gpio"][1]=37;
  if(!strcmp(bad,"control"))power["control_device"]="missing";
  if(!strcmp(bad,"cs-steal"))for(auto port:doc["ports"].as<JsonArray>())if(!strcmp(port["id"]|"","status_led"))port["modes"][0]["device"]="gate_io";
  if(!strcmp(bad,"inverted"))for(auto port:doc["ports"].as<JsonArray>())if(!strcmp(port["id"]|"","power_out_1"))port["modes"][0]["active_high"]=false;
  if(!strcmp(bad,"header-reserved"))doc["gpio_headers"][0]=4;
  if(!strcmp(bad,"header-power"))doc["gpio_headers"][0]=37;
  if(!strcmp(bad,"header-duplicate"))doc["gpio_headers"][1]=17;
  if(!strcmp(bad,"safe"))for(auto port:doc["ports"].as<JsonArray>())if(!strcmp(port["id"]|"","power_out_1"))port["modes"][0]["safe_demand"]=1;
  load(doc);if(!PcbProfileManager::faulted()){std::cerr<<"accepted "<<bad<<"\n";return 1;}
 }
 load(source);assert(PcbProfileManager::active());
 std::cout<<"PASS real PCB profile reader: format 2, pin/resource claims, safe boot and malformed power contract rejection\n";
}
