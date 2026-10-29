#include "TelemetryCatalog.h"
#include "HardwareConfig.h"
#include "Config.h"
#include "RulesEngine.h"
#include "OutputActivity.h"
#include <math.h>
#include <string.h>
namespace {
const char* inputUnit(const ChannelRegistry::Channel& c){
    if(ChannelRegistry::isSwitchCondition(c)||c.driver==ChannelRegistry::Digital)return "bool";
    if(strstr(c.purpose,"pressure"))return "bar";
    if(strstr(c.purpose,"speed"))return "RPM";
    if(strstr(c.purpose,"temperature")||!strcmp(c.purpose,"tot")||!strcmp(c.purpose,"tit"))return "C";
    if(!strcmp(c.purpose,"throttle")||!strcmp(c.purpose,"idle")||!strcmp(c.purpose,"ab_command"))return "%";
    if(strstr(c.purpose,"current"))return "A";
    if(!strcmp(c.purpose,"battery_voltage"))return "V";
    if(!strcmp(c.purpose,"torque"))return "Nm";
    if(!strcmp(c.purpose,"thrust"))return "N";
    if(strstr(c.purpose,"flow"))return "L/min";
    if(ChannelRegistry::isSwitchCondition(c)||c.driver==ChannelRegistry::Digital)return "bool";
    return "";
}

void inputReferences(const ChannelRegistry::Channel& c,mavlink_ot_channel_info_t& info){
    const char* purpose=c.purpose;
    if(!strcmp(purpose,"n1_speed")){info.limit=Config::rpmLimit;info.warning=Config::n1WarnRpm>0?Config::n1WarnRpm:Config::rpmLimit*.9f;}
    else if(!strcmp(purpose,"n2_speed")){info.limit=Config::n2RpmLimit;info.warning=Config::n2WarnRpm;}
    else if(!strcmp(purpose,"tot")){info.limit=Config::totLimit;info.warning=Config::totWarnC>0?Config::totWarnC:info.limit-Config::totSafeMargin;}
    else if(!strcmp(purpose,"tit")){info.limit=Config::titLimit;info.warning=info.limit-Config::totSafeMargin;}
    else if(!strcmp(purpose,"oil_pressure")){info.warning=Config::oilWarnBar>0?Config::oilWarnBar:Config::oilRunningMin;info.flags|=OpenTurbineMavlink::WarningBelow;}
    else if(!strcmp(purpose,"p1_pressure"))info.limit=Config::p1TripLimit;
    else if(!strcmp(purpose,"p2_pressure"))info.limit=Config::p2TripLimit;
    else if(!strcmp(purpose,"torque"))info.limit=Config::torqueTripLimit;
    if(!strcmp(info.unit,"%")){info.display_min=0;info.display_max=100;}
    if(isfinite(info.limit)&&info.limit>0){info.display_min=0;info.display_max=info.limit;}
    else info.limit=NAN;
    if(!isfinite(info.warning)||info.warning<=0)info.warning=NAN;
}
}

namespace TelemetryCatalog {
uint16_t count(){
    uint16_t n=0;
    const auto& reg=HardwareConfig::channelRegistry;
    for(uint8_t i=0;i<reg.inputCount;i++)if(reg.inputs[i].installed)n++;
    for(uint8_t i=0;i<reg.outputCount;i++)if(reg.outputs[i].installed)n++;
    for(uint8_t i=0;i<reg.outputCount;i++)if(reg.outputs[i].installed&&reg.outputs[i].hasCurrent)n++;
    n+=Config::ruleCount;
    if(HardwareConfig::hasMAVLink&&HardwareConfig::mavlinkRxPin>=0)n++;
    return n;
}
bool describe(uint16_t index,mavlink_ot_channel_info_t& info){
    memset(&info,0,sizeof(info));info.index=index;
    info.display_min=info.display_max=info.warning=info.limit=NAN;
    using namespace OpenTurbineMavlink;
    const auto& reg=HardwareConfig::channelRegistry;
    for(uint8_t i=0;i<reg.inputCount;i++)if(reg.inputs[i].installed&&index--==0){
        const auto& c=reg.inputs[i];info.channel_id=256+i;info.flags=Input;
        strlcpy(info.key,c.id,sizeof(info.key));strlcpy(info.name,c.name,sizeof(info.name));strlcpy(info.unit,inputUnit(c),sizeof(info.unit));inputReferences(c,info);return true;
    }
    for(uint8_t i=0;i<reg.outputCount;i++)if(reg.outputs[i].installed&&index--==0){
        const auto& c=reg.outputs[i];info.channel_id=512+i;info.flags=Output;
        strlcpy(info.key,c.id,sizeof(info.key));strlcpy(info.name,c.name,sizeof(info.name));strlcpy(info.unit,"%",sizeof(info.unit));info.display_min=0;info.display_max=100;return true;
    }
    for(uint8_t i=0;i<reg.outputCount;i++)if(reg.outputs[i].installed&&reg.outputs[i].hasCurrent&&index--==0){
        const auto& c=reg.outputs[i];info.channel_id=768+i;info.flags=Input;
        snprintf(info.key,sizeof(info.key),"i_%.19s",c.id);snprintf(info.name,sizeof(info.name),"%.23s current",c.name);strlcpy(info.unit,"A",sizeof(info.unit));return true;
    }
    if(index<uint16_t(Config::ruleCount)){
        const auto& r=Config::rules[index];info.channel_id=1024+index;info.flags=Controller;
        snprintf(info.key,sizeof(info.key),"controller_%u",unsigned(r.controllerId?r.controllerId:index+1));strlcpy(info.name,r.name,sizeof(info.name));strlcpy(info.unit,"bool",sizeof(info.unit));return true;
    }
    index-=Config::ruleCount;
    if(index==0&&HardwareConfig::hasMAVLink&&HardwareConfig::mavlinkRxPin>=0){
        info.channel_id=2048;info.flags=Input;strlcpy(info.key,"mavlink_throttle",sizeof(info.key));strlcpy(info.name,"MAVLink throttle demand",sizeof(info.name));strlcpy(info.unit,"%",sizeof(info.unit));info.display_min=0;info.display_max=100;return true;
    }
    return false;
}
bool sample(uint16_t index,uint16_t& id,float& value,bool& healthy){
    mavlink_ot_channel_info_t info{};if(!describe(index,info))return false;id=info.channel_id;
    auto& ed=EngineData::instance();const auto& reg=HardwareConfig::channelRegistry;healthy=true;
    if(id>=256&&id<512){
        uint8_t i=id-256;value=ed.registryInputValue[i];healthy=ed.registryInputHealthy[i];
        if(!strcmp(info.unit,"%"))value*=100;
    }else if(id<768){uint8_t i=id-512;value=OutputActivity::logicalDemand(reg.outputs[i],i,ed)*100;healthy=ed.hardwareReady&&ChannelRegistry::channelAddressable(reg.outputs[i]);
    }else if(id<1024){uint8_t i=id-768;value=ed.registryOutputCurrentAmps[i];healthy=ed.registryOutputCurrentHealthy[i];
    }else if(id<2048){uint8_t i=id-1024;value=Config::rules[i].enabled&&RulesEngine::controllerActive(i)?1:0;
    }else{value=ed.mavlinkThrottleDemand*100;healthy=ed.mavlinkThrottleValid;}
    healthy=healthy&&isfinite(value);if(!healthy)value=NAN;return true;
}
uint32_t revision(){
    uint32_t hash=2166136261u;
    const uint16_t total=count();
    for(uint16_t i=0;i<total;i++){
        mavlink_ot_channel_info_t info{};describe(i,info);
        const auto* bytes=reinterpret_cast<const uint8_t*>(&info);
        for(size_t j=0;j<sizeof(info);j++){hash^=bytes[j];hash*=16777619u;}
    }
    return hash?hash:1;
}
}
