#pragma once
// MESSAGE OT_ENGINE_STATE PACKING

#include <stdint.h>

#define MAVLINK_MSG_ID_OT_ENGINE_STATE 520103


typedef struct __mavlink_ot_engine_state_t {
 uint32_t boot_id; /*<  ECU boot identity.*/
 uint32_t time_boot_ms; /*< [ms] ECU timestamp.*/
 uint32_t allowed_commands; /*<  Currently available command bitmask.*/
 uint32_t flags; /*<  Engine readiness/fault/input-state flags.*/
 float requested_throttle; /*< [%] Requested main-fuel command before throttle protection, not a physical throttle measurement.*/
 float fuel_demand; /*< [%] Actual main-fuel output demand.*/
 uint8_t mode; /*<  OpenTurbine engine mode.*/
 uint8_t ab_mode; /*<  Afterburner mode.*/
 uint8_t sequence_index; /*<  Current sequence step.*/
 uint8_t sequence_count; /*<  Sequence step count.*/
 char sequence_step[32]; /*<  Current step name.*/
 char fault[80]; /*<  Current fault description.*/
 char reason[80]; /*<  Current operation/start restriction or event.*/
} mavlink_ot_engine_state_t;

#define MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN 220
#define MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN 220
#define MAVLINK_MSG_ID_520103_LEN 220
#define MAVLINK_MSG_ID_520103_MIN_LEN 220

#define MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC 82
#define MAVLINK_MSG_ID_520103_CRC 82

#define MAVLINK_MSG_OT_ENGINE_STATE_FIELD_SEQUENCE_STEP_LEN 32
#define MAVLINK_MSG_OT_ENGINE_STATE_FIELD_FAULT_LEN 80
#define MAVLINK_MSG_OT_ENGINE_STATE_FIELD_REASON_LEN 80

#if MAVLINK_COMMAND_24BIT
#define MAVLINK_MESSAGE_INFO_OT_ENGINE_STATE { \
    520103, \
    "OT_ENGINE_STATE", \
    13, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_engine_state_t, boot_id) }, \
         { "time_boot_ms", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_engine_state_t, time_boot_ms) }, \
         { "allowed_commands", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_engine_state_t, allowed_commands) }, \
         { "flags", NULL, MAVLINK_TYPE_UINT32_T, 0, 12, offsetof(mavlink_ot_engine_state_t, flags) }, \
         { "requested_throttle", NULL, MAVLINK_TYPE_FLOAT, 0, 16, offsetof(mavlink_ot_engine_state_t, requested_throttle) }, \
         { "fuel_demand", NULL, MAVLINK_TYPE_FLOAT, 0, 20, offsetof(mavlink_ot_engine_state_t, fuel_demand) }, \
         { "mode", NULL, MAVLINK_TYPE_UINT8_T, 0, 24, offsetof(mavlink_ot_engine_state_t, mode) }, \
         { "ab_mode", NULL, MAVLINK_TYPE_UINT8_T, 0, 25, offsetof(mavlink_ot_engine_state_t, ab_mode) }, \
         { "sequence_index", NULL, MAVLINK_TYPE_UINT8_T, 0, 26, offsetof(mavlink_ot_engine_state_t, sequence_index) }, \
         { "sequence_count", NULL, MAVLINK_TYPE_UINT8_T, 0, 27, offsetof(mavlink_ot_engine_state_t, sequence_count) }, \
         { "sequence_step", NULL, MAVLINK_TYPE_CHAR, 32, 28, offsetof(mavlink_ot_engine_state_t, sequence_step) }, \
         { "fault", NULL, MAVLINK_TYPE_CHAR, 80, 60, offsetof(mavlink_ot_engine_state_t, fault) }, \
         { "reason", NULL, MAVLINK_TYPE_CHAR, 80, 140, offsetof(mavlink_ot_engine_state_t, reason) }, \
         } \
}
#else
#define MAVLINK_MESSAGE_INFO_OT_ENGINE_STATE { \
    "OT_ENGINE_STATE", \
    13, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_engine_state_t, boot_id) }, \
         { "time_boot_ms", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_engine_state_t, time_boot_ms) }, \
         { "allowed_commands", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_engine_state_t, allowed_commands) }, \
         { "flags", NULL, MAVLINK_TYPE_UINT32_T, 0, 12, offsetof(mavlink_ot_engine_state_t, flags) }, \
         { "requested_throttle", NULL, MAVLINK_TYPE_FLOAT, 0, 16, offsetof(mavlink_ot_engine_state_t, requested_throttle) }, \
         { "fuel_demand", NULL, MAVLINK_TYPE_FLOAT, 0, 20, offsetof(mavlink_ot_engine_state_t, fuel_demand) }, \
         { "mode", NULL, MAVLINK_TYPE_UINT8_T, 0, 24, offsetof(mavlink_ot_engine_state_t, mode) }, \
         { "ab_mode", NULL, MAVLINK_TYPE_UINT8_T, 0, 25, offsetof(mavlink_ot_engine_state_t, ab_mode) }, \
         { "sequence_index", NULL, MAVLINK_TYPE_UINT8_T, 0, 26, offsetof(mavlink_ot_engine_state_t, sequence_index) }, \
         { "sequence_count", NULL, MAVLINK_TYPE_UINT8_T, 0, 27, offsetof(mavlink_ot_engine_state_t, sequence_count) }, \
         { "sequence_step", NULL, MAVLINK_TYPE_CHAR, 32, 28, offsetof(mavlink_ot_engine_state_t, sequence_step) }, \
         { "fault", NULL, MAVLINK_TYPE_CHAR, 80, 60, offsetof(mavlink_ot_engine_state_t, fault) }, \
         { "reason", NULL, MAVLINK_TYPE_CHAR, 80, 140, offsetof(mavlink_ot_engine_state_t, reason) }, \
         } \
}
#endif

/**
 * @brief Pack a ot_engine_state message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  ECU boot identity.
 * @param time_boot_ms [ms] ECU timestamp.
 * @param allowed_commands  Currently available command bitmask.
 * @param flags  Engine readiness/fault/input-state flags.
 * @param requested_throttle [%] Requested main-fuel command before throttle protection, not a physical throttle measurement.
 * @param fuel_demand [%] Actual main-fuel output demand.
 * @param mode  OpenTurbine engine mode.
 * @param ab_mode  Afterburner mode.
 * @param sequence_index  Current sequence step.
 * @param sequence_count  Sequence step count.
 * @param sequence_step  Current step name.
 * @param fault  Current fault description.
 * @param reason  Current operation/start restriction or event.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_engine_state_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t time_boot_ms, uint32_t allowed_commands, uint32_t flags, float requested_throttle, float fuel_demand, uint8_t mode, uint8_t ab_mode, uint8_t sequence_index, uint8_t sequence_count, const char *sequence_step, const char *fault, const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, allowed_commands);
    _mav_put_uint32_t(buf, 12, flags);
    _mav_put_float(buf, 16, requested_throttle);
    _mav_put_float(buf, 20, fuel_demand);
    _mav_put_uint8_t(buf, 24, mode);
    _mav_put_uint8_t(buf, 25, ab_mode);
    _mav_put_uint8_t(buf, 26, sequence_index);
    _mav_put_uint8_t(buf, 27, sequence_count);
    _mav_put_char_array(buf, 28, sequence_step, 32);
    _mav_put_char_array(buf, 60, fault, 80);
    _mav_put_char_array(buf, 140, reason, 80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN);
#else
    mavlink_ot_engine_state_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.allowed_commands = allowed_commands;
    packet.flags = flags;
    packet.requested_throttle = requested_throttle;
    packet.fuel_demand = fuel_demand;
    packet.mode = mode;
    packet.ab_mode = ab_mode;
    packet.sequence_index = sequence_index;
    packet.sequence_count = sequence_count;
    mav_array_memcpy(packet.sequence_step, sequence_step, sizeof(char)*32);
    mav_array_memcpy(packet.fault, fault, sizeof(char)*80);
    mav_array_memcpy(packet.reason, reason, sizeof(char)*80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_ENGINE_STATE;
    return mavlink_finalize_message(msg, system_id, component_id, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC);
}

/**
 * @brief Pack a ot_engine_state message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  ECU boot identity.
 * @param time_boot_ms [ms] ECU timestamp.
 * @param allowed_commands  Currently available command bitmask.
 * @param flags  Engine readiness/fault/input-state flags.
 * @param requested_throttle [%] Requested main-fuel command before throttle protection, not a physical throttle measurement.
 * @param fuel_demand [%] Actual main-fuel output demand.
 * @param mode  OpenTurbine engine mode.
 * @param ab_mode  Afterburner mode.
 * @param sequence_index  Current sequence step.
 * @param sequence_count  Sequence step count.
 * @param sequence_step  Current step name.
 * @param fault  Current fault description.
 * @param reason  Current operation/start restriction or event.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_engine_state_pack_status(uint8_t system_id, uint8_t component_id, mavlink_status_t *_status, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t time_boot_ms, uint32_t allowed_commands, uint32_t flags, float requested_throttle, float fuel_demand, uint8_t mode, uint8_t ab_mode, uint8_t sequence_index, uint8_t sequence_count, const char *sequence_step, const char *fault, const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, allowed_commands);
    _mav_put_uint32_t(buf, 12, flags);
    _mav_put_float(buf, 16, requested_throttle);
    _mav_put_float(buf, 20, fuel_demand);
    _mav_put_uint8_t(buf, 24, mode);
    _mav_put_uint8_t(buf, 25, ab_mode);
    _mav_put_uint8_t(buf, 26, sequence_index);
    _mav_put_uint8_t(buf, 27, sequence_count);
    _mav_put_char_array(buf, 28, sequence_step, 32);
    _mav_put_char_array(buf, 60, fault, 80);
    _mav_put_char_array(buf, 140, reason, 80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN);
#else
    mavlink_ot_engine_state_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.allowed_commands = allowed_commands;
    packet.flags = flags;
    packet.requested_throttle = requested_throttle;
    packet.fuel_demand = fuel_demand;
    packet.mode = mode;
    packet.ab_mode = ab_mode;
    packet.sequence_index = sequence_index;
    packet.sequence_count = sequence_count;
    mav_array_memcpy(packet.sequence_step, sequence_step, sizeof(char)*32);
    mav_array_memcpy(packet.fault, fault, sizeof(char)*80);
    mav_array_memcpy(packet.reason, reason, sizeof(char)*80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_ENGINE_STATE;
#if MAVLINK_CRC_EXTRA
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC);
#else
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN);
#endif
}

/**
 * @brief Pack a ot_engine_state message on a channel
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param boot_id  ECU boot identity.
 * @param time_boot_ms [ms] ECU timestamp.
 * @param allowed_commands  Currently available command bitmask.
 * @param flags  Engine readiness/fault/input-state flags.
 * @param requested_throttle [%] Requested main-fuel command before throttle protection, not a physical throttle measurement.
 * @param fuel_demand [%] Actual main-fuel output demand.
 * @param mode  OpenTurbine engine mode.
 * @param ab_mode  Afterburner mode.
 * @param sequence_index  Current sequence step.
 * @param sequence_count  Sequence step count.
 * @param sequence_step  Current step name.
 * @param fault  Current fault description.
 * @param reason  Current operation/start restriction or event.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_engine_state_pack_chan(uint8_t system_id, uint8_t component_id, uint8_t chan,
                               mavlink_message_t* msg,
                                   uint32_t boot_id,uint32_t time_boot_ms,uint32_t allowed_commands,uint32_t flags,float requested_throttle,float fuel_demand,uint8_t mode,uint8_t ab_mode,uint8_t sequence_index,uint8_t sequence_count,const char *sequence_step,const char *fault,const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, allowed_commands);
    _mav_put_uint32_t(buf, 12, flags);
    _mav_put_float(buf, 16, requested_throttle);
    _mav_put_float(buf, 20, fuel_demand);
    _mav_put_uint8_t(buf, 24, mode);
    _mav_put_uint8_t(buf, 25, ab_mode);
    _mav_put_uint8_t(buf, 26, sequence_index);
    _mav_put_uint8_t(buf, 27, sequence_count);
    _mav_put_char_array(buf, 28, sequence_step, 32);
    _mav_put_char_array(buf, 60, fault, 80);
    _mav_put_char_array(buf, 140, reason, 80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN);
#else
    mavlink_ot_engine_state_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.allowed_commands = allowed_commands;
    packet.flags = flags;
    packet.requested_throttle = requested_throttle;
    packet.fuel_demand = fuel_demand;
    packet.mode = mode;
    packet.ab_mode = ab_mode;
    packet.sequence_index = sequence_index;
    packet.sequence_count = sequence_count;
    mav_array_memcpy(packet.sequence_step, sequence_step, sizeof(char)*32);
    mav_array_memcpy(packet.fault, fault, sizeof(char)*80);
    mav_array_memcpy(packet.reason, reason, sizeof(char)*80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_ENGINE_STATE;
    return mavlink_finalize_message_chan(msg, system_id, component_id, chan, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC);
}

/**
 * @brief Encode a ot_engine_state struct
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 * @param ot_engine_state C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_engine_state_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_ot_engine_state_t* ot_engine_state)
{
    return mavlink_msg_ot_engine_state_pack(system_id, component_id, msg, ot_engine_state->boot_id, ot_engine_state->time_boot_ms, ot_engine_state->allowed_commands, ot_engine_state->flags, ot_engine_state->requested_throttle, ot_engine_state->fuel_demand, ot_engine_state->mode, ot_engine_state->ab_mode, ot_engine_state->sequence_index, ot_engine_state->sequence_count, ot_engine_state->sequence_step, ot_engine_state->fault, ot_engine_state->reason);
}

/**
 * @brief Encode a ot_engine_state struct on a channel
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param ot_engine_state C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_engine_state_encode_chan(uint8_t system_id, uint8_t component_id, uint8_t chan, mavlink_message_t* msg, const mavlink_ot_engine_state_t* ot_engine_state)
{
    return mavlink_msg_ot_engine_state_pack_chan(system_id, component_id, chan, msg, ot_engine_state->boot_id, ot_engine_state->time_boot_ms, ot_engine_state->allowed_commands, ot_engine_state->flags, ot_engine_state->requested_throttle, ot_engine_state->fuel_demand, ot_engine_state->mode, ot_engine_state->ab_mode, ot_engine_state->sequence_index, ot_engine_state->sequence_count, ot_engine_state->sequence_step, ot_engine_state->fault, ot_engine_state->reason);
}

/**
 * @brief Encode a ot_engine_state struct with provided status structure
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 * @param ot_engine_state C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_engine_state_encode_status(uint8_t system_id, uint8_t component_id, mavlink_status_t* _status, mavlink_message_t* msg, const mavlink_ot_engine_state_t* ot_engine_state)
{
    return mavlink_msg_ot_engine_state_pack_status(system_id, component_id, _status, msg,  ot_engine_state->boot_id, ot_engine_state->time_boot_ms, ot_engine_state->allowed_commands, ot_engine_state->flags, ot_engine_state->requested_throttle, ot_engine_state->fuel_demand, ot_engine_state->mode, ot_engine_state->ab_mode, ot_engine_state->sequence_index, ot_engine_state->sequence_count, ot_engine_state->sequence_step, ot_engine_state->fault, ot_engine_state->reason);
}

/**
 * @brief Send a ot_engine_state message
 * @param chan MAVLink channel to send the message
 *
 * @param boot_id  ECU boot identity.
 * @param time_boot_ms [ms] ECU timestamp.
 * @param allowed_commands  Currently available command bitmask.
 * @param flags  Engine readiness/fault/input-state flags.
 * @param requested_throttle [%] Requested main-fuel command before throttle protection, not a physical throttle measurement.
 * @param fuel_demand [%] Actual main-fuel output demand.
 * @param mode  OpenTurbine engine mode.
 * @param ab_mode  Afterburner mode.
 * @param sequence_index  Current sequence step.
 * @param sequence_count  Sequence step count.
 * @param sequence_step  Current step name.
 * @param fault  Current fault description.
 * @param reason  Current operation/start restriction or event.
 */
#ifdef MAVLINK_USE_CONVENIENCE_FUNCTIONS

static inline void mavlink_msg_ot_engine_state_send(mavlink_channel_t chan, uint32_t boot_id, uint32_t time_boot_ms, uint32_t allowed_commands, uint32_t flags, float requested_throttle, float fuel_demand, uint8_t mode, uint8_t ab_mode, uint8_t sequence_index, uint8_t sequence_count, const char *sequence_step, const char *fault, const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, allowed_commands);
    _mav_put_uint32_t(buf, 12, flags);
    _mav_put_float(buf, 16, requested_throttle);
    _mav_put_float(buf, 20, fuel_demand);
    _mav_put_uint8_t(buf, 24, mode);
    _mav_put_uint8_t(buf, 25, ab_mode);
    _mav_put_uint8_t(buf, 26, sequence_index);
    _mav_put_uint8_t(buf, 27, sequence_count);
    _mav_put_char_array(buf, 28, sequence_step, 32);
    _mav_put_char_array(buf, 60, fault, 80);
    _mav_put_char_array(buf, 140, reason, 80);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_ENGINE_STATE, buf, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC);
#else
    mavlink_ot_engine_state_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.allowed_commands = allowed_commands;
    packet.flags = flags;
    packet.requested_throttle = requested_throttle;
    packet.fuel_demand = fuel_demand;
    packet.mode = mode;
    packet.ab_mode = ab_mode;
    packet.sequence_index = sequence_index;
    packet.sequence_count = sequence_count;
    mav_array_memcpy(packet.sequence_step, sequence_step, sizeof(char)*32);
    mav_array_memcpy(packet.fault, fault, sizeof(char)*80);
    mav_array_memcpy(packet.reason, reason, sizeof(char)*80);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_ENGINE_STATE, (const char *)&packet, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC);
#endif
}

/**
 * @brief Send a ot_engine_state message
 * @param chan MAVLink channel to send the message
 * @param struct The MAVLink struct to serialize
 */
static inline void mavlink_msg_ot_engine_state_send_struct(mavlink_channel_t chan, const mavlink_ot_engine_state_t* ot_engine_state)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    mavlink_msg_ot_engine_state_send(chan, ot_engine_state->boot_id, ot_engine_state->time_boot_ms, ot_engine_state->allowed_commands, ot_engine_state->flags, ot_engine_state->requested_throttle, ot_engine_state->fuel_demand, ot_engine_state->mode, ot_engine_state->ab_mode, ot_engine_state->sequence_index, ot_engine_state->sequence_count, ot_engine_state->sequence_step, ot_engine_state->fault, ot_engine_state->reason);
#else
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_ENGINE_STATE, (const char *)ot_engine_state, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC);
#endif
}

#if MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN <= MAVLINK_MAX_PAYLOAD_LEN
/*
  This variant of _send() can be used to save stack space by reusing
  memory from the receive buffer.  The caller provides a
  mavlink_message_t which is the size of a full mavlink message. This
  is usually the receive buffer for the channel, and allows a reply to an
  incoming message with minimum stack space usage.
 */
static inline void mavlink_msg_ot_engine_state_send_buf(mavlink_message_t *msgbuf, mavlink_channel_t chan,  uint32_t boot_id, uint32_t time_boot_ms, uint32_t allowed_commands, uint32_t flags, float requested_throttle, float fuel_demand, uint8_t mode, uint8_t ab_mode, uint8_t sequence_index, uint8_t sequence_count, const char *sequence_step, const char *fault, const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char *buf = (char *)msgbuf;
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, allowed_commands);
    _mav_put_uint32_t(buf, 12, flags);
    _mav_put_float(buf, 16, requested_throttle);
    _mav_put_float(buf, 20, fuel_demand);
    _mav_put_uint8_t(buf, 24, mode);
    _mav_put_uint8_t(buf, 25, ab_mode);
    _mav_put_uint8_t(buf, 26, sequence_index);
    _mav_put_uint8_t(buf, 27, sequence_count);
    _mav_put_char_array(buf, 28, sequence_step, 32);
    _mav_put_char_array(buf, 60, fault, 80);
    _mav_put_char_array(buf, 140, reason, 80);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_ENGINE_STATE, buf, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC);
#else
    mavlink_ot_engine_state_t *packet = (mavlink_ot_engine_state_t *)msgbuf;
    packet->boot_id = boot_id;
    packet->time_boot_ms = time_boot_ms;
    packet->allowed_commands = allowed_commands;
    packet->flags = flags;
    packet->requested_throttle = requested_throttle;
    packet->fuel_demand = fuel_demand;
    packet->mode = mode;
    packet->ab_mode = ab_mode;
    packet->sequence_index = sequence_index;
    packet->sequence_count = sequence_count;
    mav_array_memcpy(packet->sequence_step, sequence_step, sizeof(char)*32);
    mav_array_memcpy(packet->fault, fault, sizeof(char)*80);
    mav_array_memcpy(packet->reason, reason, sizeof(char)*80);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_ENGINE_STATE, (const char *)packet, MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN, MAVLINK_MSG_ID_OT_ENGINE_STATE_CRC);
#endif
}
#endif

#endif

// MESSAGE OT_ENGINE_STATE UNPACKING


/**
 * @brief Get field boot_id from ot_engine_state message
 *
 * @return  ECU boot identity.
 */
static inline uint32_t mavlink_msg_ot_engine_state_get_boot_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  0);
}

/**
 * @brief Get field time_boot_ms from ot_engine_state message
 *
 * @return [ms] ECU timestamp.
 */
static inline uint32_t mavlink_msg_ot_engine_state_get_time_boot_ms(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  4);
}

/**
 * @brief Get field allowed_commands from ot_engine_state message
 *
 * @return  Currently available command bitmask.
 */
static inline uint32_t mavlink_msg_ot_engine_state_get_allowed_commands(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  8);
}

/**
 * @brief Get field flags from ot_engine_state message
 *
 * @return  Engine readiness/fault/input-state flags.
 */
static inline uint32_t mavlink_msg_ot_engine_state_get_flags(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  12);
}

/**
 * @brief Get field requested_throttle from ot_engine_state message
 *
 * @return [%] Requested main-fuel command before throttle protection, not a physical throttle measurement.
 */
static inline float mavlink_msg_ot_engine_state_get_requested_throttle(const mavlink_message_t* msg)
{
    return _MAV_RETURN_float(msg,  16);
}

/**
 * @brief Get field fuel_demand from ot_engine_state message
 *
 * @return [%] Actual main-fuel output demand.
 */
static inline float mavlink_msg_ot_engine_state_get_fuel_demand(const mavlink_message_t* msg)
{
    return _MAV_RETURN_float(msg,  20);
}

/**
 * @brief Get field mode from ot_engine_state message
 *
 * @return  OpenTurbine engine mode.
 */
static inline uint8_t mavlink_msg_ot_engine_state_get_mode(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  24);
}

/**
 * @brief Get field ab_mode from ot_engine_state message
 *
 * @return  Afterburner mode.
 */
static inline uint8_t mavlink_msg_ot_engine_state_get_ab_mode(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  25);
}

/**
 * @brief Get field sequence_index from ot_engine_state message
 *
 * @return  Current sequence step.
 */
static inline uint8_t mavlink_msg_ot_engine_state_get_sequence_index(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  26);
}

/**
 * @brief Get field sequence_count from ot_engine_state message
 *
 * @return  Sequence step count.
 */
static inline uint8_t mavlink_msg_ot_engine_state_get_sequence_count(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  27);
}

/**
 * @brief Get field sequence_step from ot_engine_state message
 *
 * @return  Current step name.
 */
static inline uint16_t mavlink_msg_ot_engine_state_get_sequence_step(const mavlink_message_t* msg, char *sequence_step)
{
    return _MAV_RETURN_char_array(msg, sequence_step, 32,  28);
}

/**
 * @brief Get field fault from ot_engine_state message
 *
 * @return  Current fault description.
 */
static inline uint16_t mavlink_msg_ot_engine_state_get_fault(const mavlink_message_t* msg, char *fault)
{
    return _MAV_RETURN_char_array(msg, fault, 80,  60);
}

/**
 * @brief Get field reason from ot_engine_state message
 *
 * @return  Current operation/start restriction or event.
 */
static inline uint16_t mavlink_msg_ot_engine_state_get_reason(const mavlink_message_t* msg, char *reason)
{
    return _MAV_RETURN_char_array(msg, reason, 80,  140);
}

/**
 * @brief Decode a ot_engine_state message into a struct
 *
 * @param msg The message to decode
 * @param ot_engine_state C-struct to decode the message contents into
 */
static inline void mavlink_msg_ot_engine_state_decode(const mavlink_message_t* msg, mavlink_ot_engine_state_t* ot_engine_state)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    ot_engine_state->boot_id = mavlink_msg_ot_engine_state_get_boot_id(msg);
    ot_engine_state->time_boot_ms = mavlink_msg_ot_engine_state_get_time_boot_ms(msg);
    ot_engine_state->allowed_commands = mavlink_msg_ot_engine_state_get_allowed_commands(msg);
    ot_engine_state->flags = mavlink_msg_ot_engine_state_get_flags(msg);
    ot_engine_state->requested_throttle = mavlink_msg_ot_engine_state_get_requested_throttle(msg);
    ot_engine_state->fuel_demand = mavlink_msg_ot_engine_state_get_fuel_demand(msg);
    ot_engine_state->mode = mavlink_msg_ot_engine_state_get_mode(msg);
    ot_engine_state->ab_mode = mavlink_msg_ot_engine_state_get_ab_mode(msg);
    ot_engine_state->sequence_index = mavlink_msg_ot_engine_state_get_sequence_index(msg);
    ot_engine_state->sequence_count = mavlink_msg_ot_engine_state_get_sequence_count(msg);
    mavlink_msg_ot_engine_state_get_sequence_step(msg, ot_engine_state->sequence_step);
    mavlink_msg_ot_engine_state_get_fault(msg, ot_engine_state->fault);
    mavlink_msg_ot_engine_state_get_reason(msg, ot_engine_state->reason);
#else
        uint8_t len = msg->len < MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN? msg->len : MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN;
        memset(ot_engine_state, 0, MAVLINK_MSG_ID_OT_ENGINE_STATE_LEN);
    memcpy(ot_engine_state, _MAV_PAYLOAD(msg), len);
#endif
}
