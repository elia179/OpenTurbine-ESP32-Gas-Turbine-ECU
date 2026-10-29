#include "MavlinkService.h"
#include "TelemetryCatalog.h"
#include "Config.h"
#include "OutputActivity.h"
#include "web/WebServer.h"
#include "RulesEngine.h"
#include <math.h>
#include <esp_system.h>
#include <string.h>
using namespace OpenTurbineMavlink;

// ESP32 targets are little-endian. Generated packet structs already have the
// canonical wire field order; copy them once instead of unpacking/repacking
// every member. Lengths and CRC extras remain generated MAVLink definitions.
static_assert(!MAVLINK_NEED_BYTE_SWAP && MAVLINK_ALIGNED_FIELDS,"ECU packet layout requires little-endian generated structs");
#define OT_ENCODE(type, packet) encode(&(packet),MAVLINK_MSG_ID_##type,MAVLINK_MSG_ID_##type##_LEN,MAVLINK_MSG_ID_##type##_MIN_LEN,MAVLINK_MSG_ID_##type##_CRC)
void MavlinkService::encode(const void* payload,uint32_t id,uint8_t length,uint8_t minimum,uint8_t crc){
    message_.msgid=id;memcpy(_MAV_PAYLOAD_NON_CONST(&message_),payload,length);
    mavlink_finalize_message_buffer(&message_,writer_.system,writer_.component,writer_.status(),minimum,length,crc);
}


namespace {
uint32_t bootId(){static const uint32_t nonce=esp_random();return nonce?nonce:1;}
bool stopping(uint8_t op){return op==Stop||op==AfterburnerStop;}
uint32_t capabilities(){return CanStart|CanStop|CanClearFault|(HardwareConfig::hasAfterburner?(CanStartAfterburner|CanStopAfterburner):0);}
uint32_t available(){
    const auto& ed=EngineData::instance();uint32_t mask=CanStop;
    if(!WebServer::startRejectReason())mask|=CanStart;
    if(ed.mode==SysMode::FAULT&&ed.faultLatched&&!ed.dryOilStopActive&&ed.hardwareReady&&ed.watchdogReady&&
       Config::profileMatch&&!ed.configLocked&&!OutputActivity::anyPhysicalDemand(false))mask|=CanClearFault;
    if(HardwareConfig::hasAfterburner){
        mask|=CanStopAfterburner;
        if(ed.mode==SysMode::RUNNING&&!ed.limpMode&&!ed.stopSwitchActive&&HardwareConfig::abTriggerSource==0&&
           (HardwareConfig::hasAbSol||HardwareConfig::hasAbPump)&&(!HardwareConfig::abRequiresArmSwitch||ed.abArmSwitchOn)&&
           (ed.abMode==ABMode::Off||ed.abMode==ABMode::Fault))mask|=CanStartAfterburner;
    }
    return mask;
}
OTCommand operationCommand(uint8_t op){
    switch(op){case Start:return OTCommand::START;case Stop:return OTCommand::STOP;
    case AcknowledgeFault:return OTCommand::CLEAR_FAULT;case AfterburnerStart:return OTCommand::AB_FIRE;
    default:return OTCommand::AB_STOP;}
}
}

bool MavlinkService::target(uint8_t sys,uint8_t comp)const{return sys==writer_.system&&comp==writer_.component;}
bool MavlinkService::controller(const mavlink_message_t& msg)const{
    return msg.sysid==HardwareConfig::mavlinkControllerSystem&&msg.compid==HardwareConfig::mavlinkControllerComponent;
}
void MavlinkService::begin(HardwareSerial& serial){
    port_=&serial;writer_.system=HardwareConfig::mavlinkSystemId;writer_.component=HardwareConfig::mavlinkComponentId;
    parser_.reset();writer_.reset();demand_.reset();peerSeen_=false;
    for(auto& result:results_)result={};
    channelCount_=TelemetryCatalog::count();catalogRevision_=TelemetryCatalog::revision();
    catalogIndex_=valueIndex_=0;cataloguePending_=true;statusPending_=15;lastHeartbeat_=millis()-1000UL;
}
void MavlinkService::finish(Result& r,uint8_t outcome,const char* reason){
    r.result=outcome;r.pending=false;r.send=true;strlcpy(r.reason,reason?reason:"",sizeof(r.reason));
}
void MavlinkService::sendResult(Result& r){
    if(r.standard){
        mavlink_command_ack_t p{};p.command=r.standardCommand;p.result=r.result;p.progress=255;
        p.target_system=r.system;p.target_component=r.component;
        OT_ENCODE(COMMAND_ACK,p);
    }else{
        mavlink_ot_command_result_t p{};p.sender_session=r.session;p.request_id=r.request;p.operation=r.operation;
        p.result=r.result;p.target_system=r.system;p.target_component=r.component;memcpy(p.reason,r.reason,sizeof(p.reason));
        OT_ENCODE(OT_COMMAND_RESULT,p);
    }
    if(writer_.send(*port_,message_))r.send=false;
}
void MavlinkService::pollResults(uint32_t now){
    for(auto& r:results_){
        if(r.pending){
            bool accepted=false;char reason[120]={};
            if(CommandQueue::pollResult(r.coreRequest,accepted,reason,sizeof(reason)))finish(r,accepted?MAV_RESULT_ACCEPTED:MAV_RESULT_DENIED,reason);
            else if(uint32_t(now-r.started)>3000){
                if(!stopping(r.operation))CommandQueue::cancelPendingResult(r.coreRequest);
                finish(r,MAV_RESULT_FAILED,"Result unavailable; inspect engine state");
            }
        }
        if(r.send)sendResult(r);
    }
}
void MavlinkService::command(uint32_t session,uint32_t request,uint32_t boot,uint8_t op,uint8_t sys,uint8_t comp,uint32_t now,uint16_t standard,uint32_t sampleTime){
    // Private requests are exactly correlated; standard requests follow MAVLink
    // COMMAND_LONG/ACK semantics and never acquire arbitrary actuator authority.
    const bool isStandard=standard!=UINT16_MAX;
    if(!isStandard&&(!session||!request))return;
    for(auto& old:results_)if(old.operation&&old.system==sys&&old.component==comp&&old.standard==isStandard){
        const bool same=isStandard?(old.standardCommand==standard&&old.operation==op&&uint32_t(now-old.started)<2000):
            (old.session==session&&old.request==request);
        if(same){
            if(old.operation!=op){return;} // conflicting reuse of a request ID
            old.send=true;sendResult(old);return;
        }
    }
    if(stopping(op)&&HardwareConfig::mavlinkAllowCommands&&
       sys==HardwareConfig::mavlinkControllerSystem&&comp==HardwareConfig::mavlinkControllerComponent&&
       (op==Stop||HardwareConfig::hasAfterburner)){
        for(auto& old:results_)if(old.pending&&(op==Stop||old.operation==AfterburnerStart||old.operation==AfterburnerStop)){
            CommandQueue::cancelPendingResult(old.coreRequest);finish(old,MAV_RESULT_FAILED,"Superseded by Stop");
        }
    }
    Result* slot=nullptr;
    for(uint8_t i=0;i<4;i++){auto& candidate=results_[(nextResult_+i)%4];if(!candidate.pending){slot=&candidate;nextResult_=uint8_t((nextResult_+i+1)%4);break;}}
    if(!slot)return;
    *slot={};auto& r=*slot;r.session=session;r.request=request;r.operation=op;r.system=sys;r.component=comp;
    r.standard=isStandard;r.standardCommand=standard;r.started=now;
    if(!HardwareConfig::mavlinkAllowCommands){finish(r,MAV_RESULT_DENIED,"Remote commands disabled; enable in System");return;}
    if(sys!=HardwareConfig::mavlinkControllerSystem||comp!=HardwareConfig::mavlinkControllerComponent){finish(r,MAV_RESULT_DENIED,"Sender is not the configured controller");return;}
    if(op<Start||op>AfterburnerStop){finish(r,MAV_RESULT_UNSUPPORTED,"Unsupported operation");return;}
    if(!isStandard&&!stopping(op)&&(boot!=bootId()||uint32_t(now-sampleTime)>3000)){finish(r,MAV_RESULT_DENIED,"Refresh ECU state before retrying");return;}
    if(!stopping(op)&&(!peerSeen_||uint32_t(now-lastPeerHeartbeat_)>=3000)){finish(r,MAV_RESULT_TEMPORARILY_REJECTED,"Controller heartbeat expired");return;}
    if(!isStandard){
        if(session==controllerSession_&&int32_t(request-lastControllerRequest_)<=0){finish(r,MAV_RESULT_DENIED,"Old request expired");return;}
        controllerSession_=session;lastControllerRequest_=request;
    }
    const auto& ed=EngineData::instance();
    if((op==AfterburnerStart||op==AfterburnerStop)&&!HardwareConfig::hasAfterburner){finish(r,MAV_RESULT_UNSUPPORTED,"Afterburner is not fitted");return;}
    if(op==Start&&(ed.mode==SysMode::RUNNING||ed.mode==SysMode::STARTUP)){finish(r,MAV_RESULT_ACCEPTED,"Engine already starting/running");return;}
    if(op==AcknowledgeFault&&ed.mode==SysMode::STANDBY&&!ed.faultLatched){finish(r,MAV_RESULT_ACCEPTED,"No latched fault");return;}
    if(op==Start){if(const char* reason=WebServer::startRejectReason()){finish(r,MAV_RESULT_DENIED,reason);return;}}
    if(!stopping(op)&&(WebServer::otaInProgress()||WebServer::rebootPending())){finish(r,MAV_RESULT_TEMPORARILY_REJECTED,"Maintenance/restart in progress");return;}
    OTPacket packet{};packet.cmd=operationCommand(op);packet.remote=true;packet.requestId=CommandQueue::nextRequestId();
    if(!stopping(op))packet.expiresAtMs=(now+1500UL)?now+1500UL:1;
    CommandQueue::beginResult(packet.requestId);r.coreRequest=packet.requestId;
    const bool queued=op==Stop?CommandQueue::pushEmergencyStop(packet):op==AfterburnerStop?CommandQueue::pushEmergencyFront(packet):CommandQueue::push(packet);
    if(!queued){CommandQueue::cancelPendingResult(packet.requestId);finish(r,MAV_RESULT_TEMPORARILY_REJECTED,"Engine queue busy");return;}
    r.pending=true;r.result=MAV_RESULT_IN_PROGRESS;r.send=true;
}
void MavlinkService::receive(const mavlink_message_t& msg,uint32_t now){
    switch(msg.msgid){
    case MAVLINK_MSG_ID_HEARTBEAT:
        if(controller(msg)){lastPeerHeartbeat_=now;peerSeen_=true;}break;
    case MAVLINK_MSG_ID_OT_CATALOG_REQUEST:{
        mavlink_ot_catalog_request_t p{};mavlink_msg_ot_catalog_request_decode(&msg,&p);
        if(!target(p.target_system,p.target_component))return;
        if(p.catalog_revision&&p.catalog_revision!=catalogRevision_){statusPending_|=8;return;}
        if(!cataloguePending_){catalogIndex_=p.index==UINT16_MAX?0:p.index;cataloguePending_=catalogIndex_<channelCount_;}
        statusPending_|=8;break;
    }
    case MAVLINK_MSG_ID_OT_REMOTE_INPUT:{
        mavlink_ot_remote_input_t p{};mavlink_msg_ot_remote_input_decode(&msg,&p);
        if(target(p.target_system,p.target_component)&&controller(msg)&&p.input_id==0&&
           p.boot_id==bootId()&&uint32_t(now-p.time_boot_ms)<=uint32_t(HardwareConfig::mavlinkInputTimeoutMs))
            demand_.offer(p.sender_session,p.sequence,p.value,now,HardwareConfig::mavlinkInputTimeoutMs);
        break;
    }
    case MAVLINK_MSG_ID_OT_COMMAND_REQUEST:{
        mavlink_ot_command_request_t p{};mavlink_msg_ot_command_request_decode(&msg,&p);
        if(target(p.target_system,p.target_component))command(p.sender_session,p.request_id,p.boot_id,p.operation,msg.sysid,msg.compid,now,UINT16_MAX,p.time_boot_ms);
        break;
    }
    case MAVLINK_MSG_ID_COMMAND_LONG:{
        mavlink_command_long_t p{};mavlink_msg_command_long_decode(&msg,&p);
        if(!target(p.target_system,p.target_component))return;
        uint8_t op=0;
        bool extra=p.param3!=0||p.param4!=0||p.param5!=0||p.param6!=0||p.param7!=0;
        if(p.command==MAV_CMD_DO_ENGINE_CONTROL&&!extra&&p.param2==0&&(p.param1==0||p.param1==1))op=p.param1==1?Start:Stop;
        if(p.command==MAV_CMD_USER_1&&!extra&&p.param2==0){
            if(p.param1==float(ClearFault))op=AcknowledgeFault;
            else if(p.param1==float(StartAfterburner))op=AfterburnerStart;
            else if(p.param1==float(StopAfterburner))op=AfterburnerStop;
        }
        // A standard retry returns its cached result, even after the engine
        // has subsequently stopped. It must never become another Start.
        if(op==Start&&p.confirmation){
            for(auto& r:results_)if(r.standard&&r.standardCommand==p.command&&r.operation==op&&r.system==msg.sysid&&r.component==msg.compid){r.send=true;sendResult(r);return;}
            op=0;
        }
        command(0,0,bootId(),op,msg.sysid,msg.compid,now,p.command);break;
    }
    default:break;
    }
}
bool MavlinkService::heartbeat(uint32_t now){
    mavlink_heartbeat_t p{};const auto& ed=EngineData::instance();
    p.mavlink_version=3;p.custom_mode=uint32_t(ed.mode);p.type=MAV_TYPE_GENERIC;p.autopilot=MAV_AUTOPILOT_INVALID;
    p.system_status=ed.mode==SysMode::FAULT?MAV_STATE_EMERGENCY:(ed.mode==SysMode::RUNNING||ed.mode==SysMode::STARTUP)?MAV_STATE_ACTIVE:MAV_STATE_STANDBY;
    OT_ENCODE(HEARTBEAT,p);
    return writer_.send(*port_,message_);
}
bool MavlinkService::linkInfo(){
    mavlink_ot_link_info_t p{};p.boot_id=bootId();p.catalog_revision=catalogRevision_;p.capabilities=capabilities();
    p.channel_count=channelCount_;p.input_timeout_ms=HardwareConfig::mavlinkInputTimeoutMs;p.telemetry_interval_ms=HardwareConfig::mavlinkIntervalMs;
    strlcpy(p.engine_name,HardwareConfig::profileId,sizeof(p.engine_name));
    OT_ENCODE(OT_LINK_INFO,p);return writer_.send(*port_,message_);
}
bool MavlinkService::engineState(uint32_t now){
    const auto& ed=EngineData::instance();mavlink_ot_engine_state_t p{};p.boot_id=bootId();p.time_boot_ms=now;
    p.allowed_commands=HardwareConfig::mavlinkAllowCommands?available():0;
    if(ed.faultLatched)p.flags|=FaultLatched;if(ed.mavlinkThrottleValid)p.flags|=RemoteDemandValid;
    if(HardwareConfig::mavlinkAllowCommands)p.flags|=RemoteCommandsEnabled;
    p.requested_throttle=ed.mainFuelRequestedDemand*100;p.fuel_demand=ed.mainFuelAppliedDemand*100;
    p.mode=uint8_t(ed.mode);p.ab_mode=uint8_t(ed.abMode);p.sequence_index=ed.seqBlockIdx;p.sequence_count=ed.seqBlockTotal;
    strlcpy(p.sequence_step,ed.currentBlock,sizeof(p.sequence_step));strlcpy(p.fault,ed.faultDescription,sizeof(p.fault));
    const char* reason=ed.mode==SysMode::STANDBY?WebServer::startRejectReason():nullptr;
    strlcpy(p.reason,reason?reason:(ed.seqWaitReason[0]?ed.seqWaitReason:ed.lastEvent),sizeof(p.reason));
    OT_ENCODE(OT_ENGINE_STATE,p);return writer_.send(*port_,message_);
}
bool MavlinkService::engineData(){
    const auto& ed=EngineData::instance();mavlink_efi_status_t p{};
    p.health=ed.faultLatched?0:1;p.ecu_index=0;
    p.rpm=HardwareConfig::hasN1Rpm&&ed.n1Healthy?ed.n1Rpm:NAN;
    p.exhaust_gas_temperature=Config::primaryEgtHealthy(ed)?Config::primaryEgtC(ed):NAN;
    // Fuel-flow calibration uses L/min; EFI_STATUS requires cm^3/min.
    p.fuel_flow=HardwareConfig::hasFuelFlow&&ed.fuelFlowHealthy?ed.fuelFlow*1000:NAN;
    p.fuel_consumed=NAN;p.engine_load=NAN;p.throttle_position=NAN;p.throttle_out=ed.mainFuelAppliedDemand*100;
    p.barometric_pressure=NAN;p.intake_manifold_pressure=NAN; // A named pressure input is not necessarily absolute manifold pressure.
    p.intake_manifold_temperature=NAN;p.cylinder_head_temperature=NAN;
    p.ignition_timing=NAN;p.injection_time=NAN;p.spark_dwell_time=NAN;
    OT_ENCODE(EFI_STATUS,p);return writer_.send(*port_,message_);
}
void MavlinkService::metadata(uint32_t now){
    if(!cataloguePending_||uint32_t(now-lastMetadata_)<20)return;
    mavlink_ot_channel_info_t p{};
    if(!TelemetryCatalog::describe(catalogIndex_,p)){cataloguePending_=false;return;}
    p.boot_id=bootId();p.catalog_revision=catalogRevision_;
    OT_ENCODE(OT_CHANNEL_INFO,p);
    if(writer_.send(*port_,message_)){lastMetadata_=now;if(++catalogIndex_>=channelCount_){cataloguePending_=false;lastCatalogue_=now;}}
}
void MavlinkService::values(uint32_t now){
    if(uint32_t(now-lastValues_)<uint32_t(HardwareConfig::mavlinkIntervalMs)||!channelCount_)return;
    mavlink_ot_channel_values_t p{};p.boot_id=bootId();p.catalog_revision=catalogRevision_;p.time_boot_ms=now;
    uint16_t cursor=valueIndex_;
    while(p.count<8&&cursor<channelCount_){
        uint16_t id=0;float value=NAN;bool healthy=false;
        if(TelemetryCatalog::sample(cursor++,id,value,healthy)){p.channel_ids[p.count]=id;p.values[p.count]=value;p.flags[p.count]=healthy?SampleHealthy:0;p.count++;}
    }
    OT_ENCODE(OT_CHANNEL_VALUES,p);
    if(writer_.send(*port_,message_)){valueIndex_=cursor>=channelCount_?0:cursor;lastValues_=now;}
}
void MavlinkService::sendStatusText(const char* text){
    if(!port_)return;mavlink_statustext_t p{};p.severity=MAV_SEVERITY_ERROR;strlcpy(p.text,text?text:"",sizeof(p.text));
    OT_ENCODE(STATUSTEXT,p);writer_.send(*port_,message_);
}
void MavlinkService::tick(){
    if(!port_)return;const uint32_t now=millis();
    pollResults(now);
    size_t budget=96;while(budget--&&port_->available())if(parser_.push(uint8_t(port_->read()),message_))receive(message_,now);
    auto& ed=EngineData::instance();ed.mavlinkThrottleValid=demand_.healthy(now,HardwareConfig::mavlinkInputTimeoutMs);
    ed.mavlinkThrottleDemand=demand_.value();ed.mavlinkThrottleAgeMs=demand_.age(now);
    if(uint32_t(now-lastHeartbeat_)>=1000){
        lastHeartbeat_=now;statusPending_|=15;
        const uint32_t revision=TelemetryCatalog::revision();
        if(revision!=catalogRevision_){catalogRevision_=revision;channelCount_=TelemetryCatalog::count();catalogIndex_=valueIndex_=0;cataloguePending_=true;}
    }
    if(!cataloguePending_&&HardwareConfig::mavlinkRxPin<0&&uint32_t(now-lastCatalogue_)>=10000){catalogIndex_=0;cataloguePending_=true;}
    // Reserve the link for pending state/ack packets before bulk metadata.
    // At low baud a small catalogue frame must not starve a larger fault frame.
    if((statusPending_&1)&&heartbeat(now))statusPending_&=~1;
    if((statusPending_&2)&&engineState(now))statusPending_&=~2;
    if((statusPending_&4)&&engineData())statusPending_&=~4;
    if((statusPending_&8)&&linkInfo())statusPending_&=~8;
    if(!statusPending_){metadata(now);values(now);}
}

#undef OT_ENCODE
