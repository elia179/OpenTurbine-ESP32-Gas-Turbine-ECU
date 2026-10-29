#pragma once
#include "MavlinkWire.h"
#include <math.h>

namespace OpenTurbineMavlink {
template<class Serial,size_t Capacity=160> class Client {
public:
    struct Channel {
        mavlink_ot_channel_info_t info{};
        float value=NAN;
        uint32_t received=0,sampleTime=0;
        bool described=false,sampled=false,healthy=false;
    };
    enum CommandState:uint8_t {Idle,Waiting,Accepted,Rejected,Unconfirmed};
private:
    Serial& serial_;
    Parser parser_;
    Writer writer_;
    mavlink_message_t message_{};
    Channel channels_[Capacity]{};
    uint16_t described_=0;
    uint32_t now_=0,lastState_=0,lastRequest_=0,lastCommandSend_=0,session_=1,inputSequence_=0;
    mavlink_ot_command_request_t pending_{};
    uint32_t commandSequence_=0,commandStarted_=0;
    uint8_t tries_=0;
    bool infoReceived_=false,stateReceived_=false;
    bool heartbeatSent_=false;
    uint32_t lastHeartbeat_=0;
    bool targetMatches(const mavlink_message_t& message) const {
        return message.sysid==targetSystem&&message.compid==targetComponent;
    }
    bool sendCommand(){
        mavlink_msg_ot_command_request_encode_status(writer_.system,writer_.component,writer_.status(),&message_,&pending_);
        return writer_.send(serial_,message_);
    }
    void receive(const mavlink_message_t& message,uint32_t now){
        if(!targetMatches(message))return;
        switch(message.msgid){
        case MAVLINK_MSG_ID_OT_LINK_INFO:{
            mavlink_ot_link_info_t p{};mavlink_msg_ot_link_info_decode(&message,&p);
            if(!p.catalog_revision||p.channel_count>Capacity){clearCatalogue();return;}
            if(!infoReceived_||p.boot_id!=link.boot_id||p.catalog_revision!=link.catalog_revision||p.channel_count!=link.channel_count){
                const bool reboot=infoReceived_&&p.boot_id!=link.boot_id;
                clearCatalogue();
                // A reboot invalidates command certainty; never replay an old Start.
                if(reboot&&commandState==Waiting&&pending_.operation!=Stop)commandState=Unconfirmed;
            }
            link=p;infoReceived_=true;break;
        }
        case MAVLINK_MSG_ID_OT_CHANNEL_INFO:{
            mavlink_ot_channel_info_t p{};mavlink_msg_ot_channel_info_decode(&message,&p);
            if(!infoReceived_||p.boot_id!=link.boot_id||p.catalog_revision!=link.catalog_revision||p.index>=link.channel_count||!p.channel_id)return;
            for(size_t i=0;i<link.channel_count;i++)if(i!=p.index&&channels_[i].described&&channels_[i].info.channel_id==p.channel_id)return;
            auto& channel=channels_[p.index];
            if(channel.described&&memcmp(&channel.info,&p,sizeof(p))){clearCatalogue();return;}
            if(!channel.described){channel.info=p;channel.described=true;described_++;}
            break;
        }
        case MAVLINK_MSG_ID_OT_CHANNEL_VALUES:{
            mavlink_ot_channel_values_t p{};mavlink_msg_ot_channel_values_decode(&message,&p);
            if(!catalogueReady()||p.boot_id!=link.boot_id||p.catalog_revision!=link.catalog_revision||p.count>8)return;
            // Validate the entire batch before changing any stored reading.
            for(uint8_t i=0;i<p.count;i++){
                if(!channelById(p.channel_ids[i]))return;
                for(uint8_t j=0;j<i;j++)if(p.channel_ids[i]==p.channel_ids[j])return;
            }
            for(uint8_t i=0;i<p.count;i++){
                auto* channel=channelById(p.channel_ids[i]);
                if(channel->sampled&&int32_t(p.time_boot_ms-channel->sampleTime)<=0)continue;
                channel->value=p.values[i];channel->sampleTime=p.time_boot_ms;channel->received=now;channel->sampled=true;
                channel->healthy=(p.flags[i]&SampleHealthy)&&isfinite(p.values[i]);
            }break;
        }
        case MAVLINK_MSG_ID_OT_ENGINE_STATE:{
            mavlink_ot_engine_state_t p{};mavlink_msg_ot_engine_state_decode(&message,&p);
            if(infoReceived_&&p.boot_id!=link.boot_id){clearCatalogue();return;}
            if(stateReceived_&&p.boot_id==engine.boot_id&&int32_t(p.time_boot_ms-engine.time_boot_ms)<=0)return;
            engine=p;stateReceived_=true;lastState_=now;break;
        }
        case MAVLINK_MSG_ID_OT_COMMAND_RESULT:{
            mavlink_ot_command_result_t p{};mavlink_msg_ot_command_result_decode(&message,&p);
            if(commandState!=Waiting||p.sender_session!=session_||p.request_id!=pending_.request_id||p.operation!=pending_.operation)return;
            if(p.target_system!=writer_.system||p.target_component!=writer_.component)return;
            commandResult=p.result;memcpy(commandReason,p.reason,80);commandReason[80]=0;
            if(p.result==MAV_RESULT_IN_PROGRESS){lastCommandSend_=now;break;}
            commandState=p.result==MAV_RESULT_ACCEPTED?Accepted:Rejected;break;
        }
        default:break;
        }
    }
public:
    uint8_t targetSystem=1,targetComponent=200;
    mavlink_ot_link_info_t link{};
    mavlink_ot_engine_state_t engine{};
    CommandState commandState=Idle;
    uint8_t commandResult=MAV_RESULT_FAILED;
    char commandReason[81]={};
    explicit Client(Serial& serial):serial_(serial){writer_.system=255;writer_.component=190;}
    void setIdentity(uint8_t system,uint8_t component){writer_.system=system;writer_.component=component;}
    void begin(uint32_t session){
        session_=session?session:1;inputSequence_=commandSequence_=0;parser_.reset();writer_.reset();clearCatalogue();commandState=Idle;lastRequest_=0;heartbeatSent_=false;
    }
    void clearCatalogue(){
        infoReceived_=false;stateReceived_=false;described_=0;
        for(auto& channel:channels_)channel=Channel{};
    }
    bool catalogueReady()const{return infoReceived_&&described_==link.channel_count;}
    uint16_t channelCount()const{return infoReceived_?link.channel_count:0;}
    const Channel* channel(size_t index)const{return index<channelCount()?&channels_[index]:nullptr;}
    Channel* channelById(uint16_t id){for(size_t i=0;i<channelCount();i++)if(channels_[i].described&&channels_[i].info.channel_id==id)return &channels_[i];return nullptr;}
    bool signalLost(uint32_t now,uint32_t timeout=3000)const{return !stateReceived_||uint32_t(now-lastState_)>=timeout;}
    bool valid(const Channel& channel,uint32_t now,uint32_t timeout=0)const{
        if(!timeout){timeout=uint32_t(link.telemetry_interval_ms)*((channelCount()+7)/8)*2+1000;if(timeout<1500)timeout=1500;}
        return catalogueReady()&&channel.described&&channel.sampled&&channel.healthy&&uint32_t(now-channel.received)<timeout;
    }
    bool requestCatalogue(){
        mavlink_ot_catalog_request_t p{};p.index=UINT16_MAX;p.target_system=targetSystem;p.target_component=targetComponent;
        mavlink_msg_ot_catalog_request_encode_status(writer_.system,writer_.component,writer_.status(),&message_,&p);
        return writer_.send(serial_,message_);
    }
    bool request(uint8_t operation,uint32_t now){
        if(commandState==Waiting||(operation!=Stop&&(!infoReceived_||signalLost(now))))return false;
        pending_={};pending_.boot_id=infoReceived_?link.boot_id:0;pending_.time_boot_ms=engine.time_boot_ms+uint32_t(now-lastState_);pending_.sender_session=session_;
        if(++commandSequence_==0)++commandSequence_;
        pending_.request_id=commandSequence_;pending_.operation=operation;
        pending_.target_system=targetSystem;pending_.target_component=targetComponent;
        if(!sendCommand())return false;
        tries_=1;lastCommandSend_=commandStarted_=now;commandState=Waiting;commandReason[0]=0;return true;
    }
    bool start(uint32_t now){return request(Start,now);}
    bool stop(uint32_t now){commandState=Idle;return request(Stop,now);}
    bool acknowledgeFault(uint32_t now){return request(AcknowledgeFault,now);}
    bool afterburner(bool on,uint32_t now){return request(on?AfterburnerStart:AfterburnerStop,now);}
    bool throttle(float normalized){
        if(!isfinite(normalized)||normalized<0||normalized>1||!infoReceived_||signalLost(now_))return false;
        mavlink_ot_remote_input_t p{};p.boot_id=link.boot_id;p.time_boot_ms=engine.time_boot_ms+uint32_t(now_-lastState_);p.sender_session=session_;p.sequence=++inputSequence_;p.value=normalized;
        p.target_system=targetSystem;p.target_component=targetComponent;
        mavlink_msg_ot_remote_input_encode_status(writer_.system,writer_.component,writer_.status(),&message_,&p);
        return writer_.send(serial_,message_);
    }
    void update(uint32_t now,size_t budget=384){
        now_=now;
        if(!heartbeatSent_||uint32_t(now-lastHeartbeat_)>=1000){
            mavlink_heartbeat_t heartbeat{};heartbeat.type=MAV_TYPE_GCS;heartbeat.autopilot=MAV_AUTOPILOT_INVALID;
            mavlink_msg_heartbeat_encode_status(writer_.system,writer_.component,writer_.status(),&message_,&heartbeat);
            if(writer_.send(serial_,message_)){heartbeatSent_=true;lastHeartbeat_=now;}
        }
        while(budget--&&serial_.available())if(parser_.push(uint8_t(serial_.read()),message_))receive(message_,now);
        if(!catalogueReady()&&uint32_t(now-lastRequest_)>=1500){if(requestCatalogue())lastRequest_=now;}
        if(commandState==Waiting&&uint32_t(now-commandStarted_)>=6000){commandState=Unconfirmed;return;}
        if(commandState==Waiting&&uint32_t(now-lastCommandSend_)>=1000){
            if(tries_>=3){commandState=Unconfirmed;return;}
            if(sendCommand()){tries_++;lastCommandSend_=now;}
        }
    }
};
}
