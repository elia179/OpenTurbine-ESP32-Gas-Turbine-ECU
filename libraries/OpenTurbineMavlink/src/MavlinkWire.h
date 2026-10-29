#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>

// Every selected wire definition fits in 220 bytes. Keep the same bound in
// ECU and receiver builds; no hidden global parser/channel buffers are used.
#ifndef MAVLINK_MAX_PAYLOAD_LEN
#define MAVLINK_MAX_PAYLOAD_LEN 224
#endif
#ifndef MAVLINK_COMM_NUM_BUFFERS
#define MAVLINK_COMM_NUM_BUFFERS 1
#endif
// Signing is deliberately unsupported; Parser rejects every signed frame.
#define MAVLINK_NO_SIGN_PACKET
#define MAVLINK_NO_SIGNATURE_CHECK
#include "protocol/openturbine/mavlink.h"

namespace OpenTurbineMavlink {
enum CommandBit : uint32_t {
    CanStart=1u<<0, CanStop=1u<<1, CanClearFault=1u<<2,
    CanStartAfterburner=1u<<3, CanStopAfterburner=1u<<4
};
enum SampleFlag : uint8_t { SampleHealthy=1u<<0 };
enum ChannelFlag : uint16_t { Input=1u<<0, Output=1u<<1, Controller=1u<<2, Primary=1u<<3, WarningBelow=1u<<4 };
enum EngineFlag : uint32_t { FaultLatched=1u<<0, RemoteDemandValid=1u<<1, RemoteCommandsEnabled=1u<<2 };
// MAV_CMD_USER_1 parameters: operation in param1, all remaining parameters zero.
// Start/Stop use MAV_CMD_DO_ENGINE_CONTROL instead.
enum UserOperation : uint8_t { ClearFault=1, StartAfterburner=2, StopAfterburner=3 };
enum EngineOperation : uint8_t { Start=1, Stop=2, AcknowledgeFault=3, AfterburnerStart=4, AfterburnerStop=5 };

class Parser {
    mavlink_message_t buffer_{};
    mavlink_status_t state_{};
public:
    bool push(uint8_t byte,mavlink_message_t& message) {
        const auto result=mavlink_frame_char_buffer(&buffer_,&state_,byte,&message,nullptr);
        // This wired implementation does not claim to authenticate signing.
        // Never accept a signed packet without configured signature verification.
        return result==MAVLINK_FRAMING_OK && !(message.incompat_flags&MAVLINK_IFLAG_SIGNED);
    }
    void reset(){memset(&buffer_,0,sizeof(buffer_));memset(&state_,0,sizeof(state_));}
};

class Writer {
    mavlink_status_t state_{};
public:
    uint8_t system=1,component=200;
    mavlink_status_t* status(){return &state_;}
    void reset(){memset(&state_,0,sizeof(state_));}
    template<class Serial> bool send(Serial& serial,const mavlink_message_t& message) {
        uint8_t bytes[MAVLINK_MAX_PACKET_LEN];
        const uint16_t count=mavlink_msg_to_send_buffer(bytes,&message);
        if(serial.availableForWrite()<int(count)){
            // encode_status reserves a sequence number before the FIFO check.
            // An unsent packet must not look like packet loss to the receiver.
            state_.current_tx_seq=message.seq;
            return false;
        }
        return serial.write(bytes,count)==count;
    }
};
}
