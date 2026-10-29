#pragma once
// MESSAGE OT_REMOTE_INPUT PACKING

#include <stdint.h>

#define MAVLINK_MSG_ID_OT_REMOTE_INPUT 520104


typedef struct __mavlink_ot_remote_input_t {
 uint32_t boot_id; /*<  Current ECU boot identity.*/
 uint32_t time_boot_ms; /*<  Estimated current ECU time from fresh engine state; delayed samples expire.*/
 uint32_t sender_session; /*<  Sender boot/session identity, nonzero.*/
 uint32_t sequence; /*<  Monotonically increasing sample counter within the session.*/
 float value; /*<  Normalized requested demand, 0 through 1.*/
 uint16_t input_id; /*<  Remote input ID; 0 is throttle demand.*/
 uint8_t target_system; /*<  Target ECU system.*/
 uint8_t target_component; /*<  Target ECU component.*/
} mavlink_ot_remote_input_t;

#define MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN 24
#define MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN 24
#define MAVLINK_MSG_ID_520104_LEN 24
#define MAVLINK_MSG_ID_520104_MIN_LEN 24

#define MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC 188
#define MAVLINK_MSG_ID_520104_CRC 188



#if MAVLINK_COMMAND_24BIT
#define MAVLINK_MESSAGE_INFO_OT_REMOTE_INPUT { \
    520104, \
    "OT_REMOTE_INPUT", \
    8, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_remote_input_t, boot_id) }, \
         { "time_boot_ms", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_remote_input_t, time_boot_ms) }, \
         { "sender_session", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_remote_input_t, sender_session) }, \
         { "sequence", NULL, MAVLINK_TYPE_UINT32_T, 0, 12, offsetof(mavlink_ot_remote_input_t, sequence) }, \
         { "value", NULL, MAVLINK_TYPE_FLOAT, 0, 16, offsetof(mavlink_ot_remote_input_t, value) }, \
         { "input_id", NULL, MAVLINK_TYPE_UINT16_T, 0, 20, offsetof(mavlink_ot_remote_input_t, input_id) }, \
         { "target_system", NULL, MAVLINK_TYPE_UINT8_T, 0, 22, offsetof(mavlink_ot_remote_input_t, target_system) }, \
         { "target_component", NULL, MAVLINK_TYPE_UINT8_T, 0, 23, offsetof(mavlink_ot_remote_input_t, target_component) }, \
         } \
}
#else
#define MAVLINK_MESSAGE_INFO_OT_REMOTE_INPUT { \
    "OT_REMOTE_INPUT", \
    8, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_remote_input_t, boot_id) }, \
         { "time_boot_ms", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_remote_input_t, time_boot_ms) }, \
         { "sender_session", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_remote_input_t, sender_session) }, \
         { "sequence", NULL, MAVLINK_TYPE_UINT32_T, 0, 12, offsetof(mavlink_ot_remote_input_t, sequence) }, \
         { "value", NULL, MAVLINK_TYPE_FLOAT, 0, 16, offsetof(mavlink_ot_remote_input_t, value) }, \
         { "input_id", NULL, MAVLINK_TYPE_UINT16_T, 0, 20, offsetof(mavlink_ot_remote_input_t, input_id) }, \
         { "target_system", NULL, MAVLINK_TYPE_UINT8_T, 0, 22, offsetof(mavlink_ot_remote_input_t, target_system) }, \
         { "target_component", NULL, MAVLINK_TYPE_UINT8_T, 0, 23, offsetof(mavlink_ot_remote_input_t, target_component) }, \
         } \
}
#endif

/**
 * @brief Pack a ot_remote_input message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  Current ECU boot identity.
 * @param time_boot_ms  Estimated current ECU time from fresh engine state; delayed samples expire.
 * @param sender_session  Sender boot/session identity, nonzero.
 * @param sequence  Monotonically increasing sample counter within the session.
 * @param value  Normalized requested demand, 0 through 1.
 * @param input_id  Remote input ID; 0 is throttle demand.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_remote_input_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t time_boot_ms, uint32_t sender_session, uint32_t sequence, float value, uint16_t input_id, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, sequence);
    _mav_put_float(buf, 16, value);
    _mav_put_uint16_t(buf, 20, input_id);
    _mav_put_uint8_t(buf, 22, target_system);
    _mav_put_uint8_t(buf, 23, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN);
#else
    mavlink_ot_remote_input_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.sender_session = sender_session;
    packet.sequence = sequence;
    packet.value = value;
    packet.input_id = input_id;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_REMOTE_INPUT;
    return mavlink_finalize_message(msg, system_id, component_id, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC);
}

/**
 * @brief Pack a ot_remote_input message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  Current ECU boot identity.
 * @param time_boot_ms  Estimated current ECU time from fresh engine state; delayed samples expire.
 * @param sender_session  Sender boot/session identity, nonzero.
 * @param sequence  Monotonically increasing sample counter within the session.
 * @param value  Normalized requested demand, 0 through 1.
 * @param input_id  Remote input ID; 0 is throttle demand.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_remote_input_pack_status(uint8_t system_id, uint8_t component_id, mavlink_status_t *_status, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t time_boot_ms, uint32_t sender_session, uint32_t sequence, float value, uint16_t input_id, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, sequence);
    _mav_put_float(buf, 16, value);
    _mav_put_uint16_t(buf, 20, input_id);
    _mav_put_uint8_t(buf, 22, target_system);
    _mav_put_uint8_t(buf, 23, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN);
#else
    mavlink_ot_remote_input_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.sender_session = sender_session;
    packet.sequence = sequence;
    packet.value = value;
    packet.input_id = input_id;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_REMOTE_INPUT;
#if MAVLINK_CRC_EXTRA
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC);
#else
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN);
#endif
}

/**
 * @brief Pack a ot_remote_input message on a channel
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param boot_id  Current ECU boot identity.
 * @param time_boot_ms  Estimated current ECU time from fresh engine state; delayed samples expire.
 * @param sender_session  Sender boot/session identity, nonzero.
 * @param sequence  Monotonically increasing sample counter within the session.
 * @param value  Normalized requested demand, 0 through 1.
 * @param input_id  Remote input ID; 0 is throttle demand.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_remote_input_pack_chan(uint8_t system_id, uint8_t component_id, uint8_t chan,
                               mavlink_message_t* msg,
                                   uint32_t boot_id,uint32_t time_boot_ms,uint32_t sender_session,uint32_t sequence,float value,uint16_t input_id,uint8_t target_system,uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, sequence);
    _mav_put_float(buf, 16, value);
    _mav_put_uint16_t(buf, 20, input_id);
    _mav_put_uint8_t(buf, 22, target_system);
    _mav_put_uint8_t(buf, 23, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN);
#else
    mavlink_ot_remote_input_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.sender_session = sender_session;
    packet.sequence = sequence;
    packet.value = value;
    packet.input_id = input_id;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_REMOTE_INPUT;
    return mavlink_finalize_message_chan(msg, system_id, component_id, chan, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC);
}

/**
 * @brief Encode a ot_remote_input struct
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 * @param ot_remote_input C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_remote_input_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_ot_remote_input_t* ot_remote_input)
{
    return mavlink_msg_ot_remote_input_pack(system_id, component_id, msg, ot_remote_input->boot_id, ot_remote_input->time_boot_ms, ot_remote_input->sender_session, ot_remote_input->sequence, ot_remote_input->value, ot_remote_input->input_id, ot_remote_input->target_system, ot_remote_input->target_component);
}

/**
 * @brief Encode a ot_remote_input struct on a channel
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param ot_remote_input C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_remote_input_encode_chan(uint8_t system_id, uint8_t component_id, uint8_t chan, mavlink_message_t* msg, const mavlink_ot_remote_input_t* ot_remote_input)
{
    return mavlink_msg_ot_remote_input_pack_chan(system_id, component_id, chan, msg, ot_remote_input->boot_id, ot_remote_input->time_boot_ms, ot_remote_input->sender_session, ot_remote_input->sequence, ot_remote_input->value, ot_remote_input->input_id, ot_remote_input->target_system, ot_remote_input->target_component);
}

/**
 * @brief Encode a ot_remote_input struct with provided status structure
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 * @param ot_remote_input C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_remote_input_encode_status(uint8_t system_id, uint8_t component_id, mavlink_status_t* _status, mavlink_message_t* msg, const mavlink_ot_remote_input_t* ot_remote_input)
{
    return mavlink_msg_ot_remote_input_pack_status(system_id, component_id, _status, msg,  ot_remote_input->boot_id, ot_remote_input->time_boot_ms, ot_remote_input->sender_session, ot_remote_input->sequence, ot_remote_input->value, ot_remote_input->input_id, ot_remote_input->target_system, ot_remote_input->target_component);
}

/**
 * @brief Send a ot_remote_input message
 * @param chan MAVLink channel to send the message
 *
 * @param boot_id  Current ECU boot identity.
 * @param time_boot_ms  Estimated current ECU time from fresh engine state; delayed samples expire.
 * @param sender_session  Sender boot/session identity, nonzero.
 * @param sequence  Monotonically increasing sample counter within the session.
 * @param value  Normalized requested demand, 0 through 1.
 * @param input_id  Remote input ID; 0 is throttle demand.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 */
#ifdef MAVLINK_USE_CONVENIENCE_FUNCTIONS

static inline void mavlink_msg_ot_remote_input_send(mavlink_channel_t chan, uint32_t boot_id, uint32_t time_boot_ms, uint32_t sender_session, uint32_t sequence, float value, uint16_t input_id, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, sequence);
    _mav_put_float(buf, 16, value);
    _mav_put_uint16_t(buf, 20, input_id);
    _mav_put_uint8_t(buf, 22, target_system);
    _mav_put_uint8_t(buf, 23, target_component);

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_REMOTE_INPUT, buf, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC);
#else
    mavlink_ot_remote_input_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.sender_session = sender_session;
    packet.sequence = sequence;
    packet.value = value;
    packet.input_id = input_id;
    packet.target_system = target_system;
    packet.target_component = target_component;

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_REMOTE_INPUT, (const char *)&packet, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC);
#endif
}

/**
 * @brief Send a ot_remote_input message
 * @param chan MAVLink channel to send the message
 * @param struct The MAVLink struct to serialize
 */
static inline void mavlink_msg_ot_remote_input_send_struct(mavlink_channel_t chan, const mavlink_ot_remote_input_t* ot_remote_input)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    mavlink_msg_ot_remote_input_send(chan, ot_remote_input->boot_id, ot_remote_input->time_boot_ms, ot_remote_input->sender_session, ot_remote_input->sequence, ot_remote_input->value, ot_remote_input->input_id, ot_remote_input->target_system, ot_remote_input->target_component);
#else
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_REMOTE_INPUT, (const char *)ot_remote_input, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC);
#endif
}

#if MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN <= MAVLINK_MAX_PAYLOAD_LEN
/*
  This variant of _send() can be used to save stack space by reusing
  memory from the receive buffer.  The caller provides a
  mavlink_message_t which is the size of a full mavlink message. This
  is usually the receive buffer for the channel, and allows a reply to an
  incoming message with minimum stack space usage.
 */
static inline void mavlink_msg_ot_remote_input_send_buf(mavlink_message_t *msgbuf, mavlink_channel_t chan,  uint32_t boot_id, uint32_t time_boot_ms, uint32_t sender_session, uint32_t sequence, float value, uint16_t input_id, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char *buf = (char *)msgbuf;
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, sequence);
    _mav_put_float(buf, 16, value);
    _mav_put_uint16_t(buf, 20, input_id);
    _mav_put_uint8_t(buf, 22, target_system);
    _mav_put_uint8_t(buf, 23, target_component);

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_REMOTE_INPUT, buf, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC);
#else
    mavlink_ot_remote_input_t *packet = (mavlink_ot_remote_input_t *)msgbuf;
    packet->boot_id = boot_id;
    packet->time_boot_ms = time_boot_ms;
    packet->sender_session = sender_session;
    packet->sequence = sequence;
    packet->value = value;
    packet->input_id = input_id;
    packet->target_system = target_system;
    packet->target_component = target_component;

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_REMOTE_INPUT, (const char *)packet, MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN, MAVLINK_MSG_ID_OT_REMOTE_INPUT_CRC);
#endif
}
#endif

#endif

// MESSAGE OT_REMOTE_INPUT UNPACKING


/**
 * @brief Get field boot_id from ot_remote_input message
 *
 * @return  Current ECU boot identity.
 */
static inline uint32_t mavlink_msg_ot_remote_input_get_boot_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  0);
}

/**
 * @brief Get field time_boot_ms from ot_remote_input message
 *
 * @return  Estimated current ECU time from fresh engine state; delayed samples expire.
 */
static inline uint32_t mavlink_msg_ot_remote_input_get_time_boot_ms(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  4);
}

/**
 * @brief Get field sender_session from ot_remote_input message
 *
 * @return  Sender boot/session identity, nonzero.
 */
static inline uint32_t mavlink_msg_ot_remote_input_get_sender_session(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  8);
}

/**
 * @brief Get field sequence from ot_remote_input message
 *
 * @return  Monotonically increasing sample counter within the session.
 */
static inline uint32_t mavlink_msg_ot_remote_input_get_sequence(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  12);
}

/**
 * @brief Get field value from ot_remote_input message
 *
 * @return  Normalized requested demand, 0 through 1.
 */
static inline float mavlink_msg_ot_remote_input_get_value(const mavlink_message_t* msg)
{
    return _MAV_RETURN_float(msg,  16);
}

/**
 * @brief Get field input_id from ot_remote_input message
 *
 * @return  Remote input ID; 0 is throttle demand.
 */
static inline uint16_t mavlink_msg_ot_remote_input_get_input_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint16_t(msg,  20);
}

/**
 * @brief Get field target_system from ot_remote_input message
 *
 * @return  Target ECU system.
 */
static inline uint8_t mavlink_msg_ot_remote_input_get_target_system(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  22);
}

/**
 * @brief Get field target_component from ot_remote_input message
 *
 * @return  Target ECU component.
 */
static inline uint8_t mavlink_msg_ot_remote_input_get_target_component(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  23);
}

/**
 * @brief Decode a ot_remote_input message into a struct
 *
 * @param msg The message to decode
 * @param ot_remote_input C-struct to decode the message contents into
 */
static inline void mavlink_msg_ot_remote_input_decode(const mavlink_message_t* msg, mavlink_ot_remote_input_t* ot_remote_input)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    ot_remote_input->boot_id = mavlink_msg_ot_remote_input_get_boot_id(msg);
    ot_remote_input->time_boot_ms = mavlink_msg_ot_remote_input_get_time_boot_ms(msg);
    ot_remote_input->sender_session = mavlink_msg_ot_remote_input_get_sender_session(msg);
    ot_remote_input->sequence = mavlink_msg_ot_remote_input_get_sequence(msg);
    ot_remote_input->value = mavlink_msg_ot_remote_input_get_value(msg);
    ot_remote_input->input_id = mavlink_msg_ot_remote_input_get_input_id(msg);
    ot_remote_input->target_system = mavlink_msg_ot_remote_input_get_target_system(msg);
    ot_remote_input->target_component = mavlink_msg_ot_remote_input_get_target_component(msg);
#else
        uint8_t len = msg->len < MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN? msg->len : MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN;
        memset(ot_remote_input, 0, MAVLINK_MSG_ID_OT_REMOTE_INPUT_LEN);
    memcpy(ot_remote_input, _MAV_PAYLOAD(msg), len);
#endif
}
