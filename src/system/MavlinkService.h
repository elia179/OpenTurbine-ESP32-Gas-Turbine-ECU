#pragma once
#include "HardwareConfig.h"
#include "CommandQueue.h"
#include "../../libraries/OpenTurbineMavlink/src/MavlinkWire.h"
#include "../../libraries/OpenTurbineMavlink/src/RemoteDemand.h"
#include <HardwareSerial.h>

class MavlinkService {
    struct Result {
        uint32_t session=0,request=0,coreRequest=0,started=0;
        uint8_t operation=0,result=MAV_RESULT_FAILED,system=0,component=0;
        bool pending=false,send=false,standard=false;
        uint16_t standardCommand=0;
        char reason[80]={};
    };
    HardwareSerial* port_=nullptr;
    OpenTurbineMavlink::Parser parser_;
    OpenTurbineMavlink::Writer writer_;
    OpenTurbineMavlink::RemoteDemand demand_;
    mavlink_message_t message_{};
    Result results_[4]{};
    uint8_t nextResult_=0;
    uint32_t catalogRevision_=0,lastHeartbeat_=0,lastValues_=0,lastMetadata_=0,lastCatalogue_=0;
    uint32_t controllerSession_=0,lastControllerRequest_=0;
    uint32_t lastPeerHeartbeat_=0;
    bool peerSeen_=false;
    uint16_t channelCount_=0,catalogIndex_=0,valueIndex_=0;
    bool cataloguePending_=true;
    uint8_t statusPending_=15;
    bool target(uint8_t system,uint8_t component)const;
    bool controller(const mavlink_message_t& message)const;
    void encode(const void* payload,uint32_t id,uint8_t length,uint8_t minimum,uint8_t crc);
    void receive(const mavlink_message_t& message,uint32_t now);
    void command(uint32_t session,uint32_t request,uint32_t boot,uint8_t operation,
                 uint8_t system,uint8_t component,uint32_t now,uint16_t standard=UINT16_MAX,uint32_t sampleTime=0);
    void finish(Result& result,uint8_t outcome,const char* reason);
    void sendResult(Result& result);
    void pollResults(uint32_t now);
    bool heartbeat(uint32_t now);
    bool linkInfo();
    bool engineState(uint32_t now);
    bool engineData();
    void metadata(uint32_t now);
    void values(uint32_t now);
public:
    void begin(HardwareSerial& serial);
    void tick();
    void sendStatusText(const char* text);
};
