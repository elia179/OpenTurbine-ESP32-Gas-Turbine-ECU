#pragma once
// MESSAGE OT_COMMAND_RESULT PACKING

#include <stdint.h>

#define MAVLINK_MSG_ID_OT_COMMAND_RESULT 520107


typedef struct __mavlink_ot_command_result_t {
 uint32_t sender_session; /*<  Echoed sender session.*/
 uint32_t request_id; /*<  Echoed request identity.*/
 uint8_t operation; /*<  Echoed operation.*/
 uint8_t result; /*<  Command result.*/
 uint8_t target_system; /*<  Requesting system.*/
 uint8_t target_component; /*<  Requesting component.*/
 char reason[80]; /*<  Human-readable rejection or acceptance detail.*/
} mavlink_ot_command_result_t;

#define MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN 92
#define MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN 92
#define MAVLINK_MSG_ID_520107_LEN 92
#define MAVLINK_MSG_ID_520107_MIN_LEN 92

#define MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC 8
#define MAVLINK_MSG_ID_520107_CRC 8

#define MAVLINK_MSG_OT_COMMAND_RESULT_FIELD_REASON_LEN 80

#if MAVLINK_COMMAND_24BIT
#define MAVLINK_MESSAGE_INFO_OT_COMMAND_RESULT { \
    520107, \
    "OT_COMMAND_RESULT", \
    7, \
    {  { "sender_session", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_command_result_t, sender_session) }, \
         { "request_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_command_result_t, request_id) }, \
         { "operation", NULL, MAVLINK_TYPE_UINT8_T, 0, 8, offsetof(mavlink_ot_command_result_t, operation) }, \
         { "result", NULL, MAVLINK_TYPE_UINT8_T, 0, 9, offsetof(mavlink_ot_command_result_t, result) }, \
         { "target_system", NULL, MAVLINK_TYPE_UINT8_T, 0, 10, offsetof(mavlink_ot_command_result_t, target_system) }, \
         { "target_component", NULL, MAVLINK_TYPE_UINT8_T, 0, 11, offsetof(mavlink_ot_command_result_t, target_component) }, \
         { "reason", NULL, MAVLINK_TYPE_CHAR, 80, 12, offsetof(mavlink_ot_command_result_t, reason) }, \
         } \
}
#else
#define MAVLINK_MESSAGE_INFO_OT_COMMAND_RESULT { \
    "OT_COMMAND_RESULT", \
    7, \
    {  { "sender_session", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_command_result_t, sender_session) }, \
         { "request_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_command_result_t, request_id) }, \
         { "operation", NULL, MAVLINK_TYPE_UINT8_T, 0, 8, offsetof(mavlink_ot_command_result_t, operation) }, \
         { "result", NULL, MAVLINK_TYPE_UINT8_T, 0, 9, offsetof(mavlink_ot_command_result_t, result) }, \
         { "target_system", NULL, MAVLINK_TYPE_UINT8_T, 0, 10, offsetof(mavlink_ot_command_result_t, target_system) }, \
         { "target_component", NULL, MAVLINK_TYPE_UINT8_T, 0, 11, offsetof(mavlink_ot_command_result_t, target_component) }, \
         { "reason", NULL, MAVLINK_TYPE_CHAR, 80, 12, offsetof(mavlink_ot_command_result_t, reason) }, \
         } \
}
#endif

/**
 * @brief Pack a ot_command_result message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 *
 * @param sender_session  Echoed sender session.
 * @param request_id  Echoed request identity.
 * @param operation  Echoed operation.
 * @param result  Command result.
 * @param target_system  Requesting system.
 * @param target_component  Requesting component.
 * @param reason  Human-readable rejection or acceptance detail.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_command_result_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg,
                               uint32_t sender_session, uint32_t request_id, uint8_t operation, uint8_t result, uint8_t target_system, uint8_t target_component, const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN];
    _mav_put_uint32_t(buf, 0, sender_session);
    _mav_put_uint32_t(buf, 4, request_id);
    _mav_put_uint8_t(buf, 8, operation);
    _mav_put_uint8_t(buf, 9, result);
    _mav_put_uint8_t(buf, 10, target_system);
    _mav_put_uint8_t(buf, 11, target_component);
    _mav_put_char_array(buf, 12, reason, 80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN);
#else
    mavlink_ot_command_result_t packet;
    packet.sender_session = sender_session;
    packet.request_id = request_id;
    packet.operation = operation;
    packet.result = result;
    packet.target_system = target_system;
    packet.target_component = target_component;
    mav_array_memcpy(packet.reason, reason, sizeof(char)*80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_COMMAND_RESULT;
    return mavlink_finalize_message(msg, system_id, component_id, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC);
}

/**
 * @brief Pack a ot_command_result message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 *
 * @param sender_session  Echoed sender session.
 * @param request_id  Echoed request identity.
 * @param operation  Echoed operation.
 * @param result  Command result.
 * @param target_system  Requesting system.
 * @param target_component  Requesting component.
 * @param reason  Human-readable rejection or acceptance detail.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_command_result_pack_status(uint8_t system_id, uint8_t component_id, mavlink_status_t *_status, mavlink_message_t* msg,
                               uint32_t sender_session, uint32_t request_id, uint8_t operation, uint8_t result, uint8_t target_system, uint8_t target_component, const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN];
    _mav_put_uint32_t(buf, 0, sender_session);
    _mav_put_uint32_t(buf, 4, request_id);
    _mav_put_uint8_t(buf, 8, operation);
    _mav_put_uint8_t(buf, 9, result);
    _mav_put_uint8_t(buf, 10, target_system);
    _mav_put_uint8_t(buf, 11, target_component);
    _mav_put_char_array(buf, 12, reason, 80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN);
#else
    mavlink_ot_command_result_t packet;
    packet.sender_session = sender_session;
    packet.request_id = request_id;
    packet.operation = operation;
    packet.result = result;
    packet.target_system = target_system;
    packet.target_component = target_component;
    mav_array_memcpy(packet.reason, reason, sizeof(char)*80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_COMMAND_RESULT;
#if MAVLINK_CRC_EXTRA
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC);
#else
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN);
#endif
}

/**
 * @brief Pack a ot_command_result message on a channel
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param sender_session  Echoed sender session.
 * @param request_id  Echoed request identity.
 * @param operation  Echoed operation.
 * @param result  Command result.
 * @param target_system  Requesting system.
 * @param target_component  Requesting component.
 * @param reason  Human-readable rejection or acceptance detail.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_command_result_pack_chan(uint8_t system_id, uint8_t component_id, uint8_t chan,
                               mavlink_message_t* msg,
                                   uint32_t sender_session,uint32_t request_id,uint8_t operation,uint8_t result,uint8_t target_system,uint8_t target_component,const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN];
    _mav_put_uint32_t(buf, 0, sender_session);
    _mav_put_uint32_t(buf, 4, request_id);
    _mav_put_uint8_t(buf, 8, operation);
    _mav_put_uint8_t(buf, 9, result);
    _mav_put_uint8_t(buf, 10, target_system);
    _mav_put_uint8_t(buf, 11, target_component);
    _mav_put_char_array(buf, 12, reason, 80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN);
#else
    mavlink_ot_command_result_t packet;
    packet.sender_session = sender_session;
    packet.request_id = request_id;
    packet.operation = operation;
    packet.result = result;
    packet.target_system = target_system;
    packet.target_component = target_component;
    mav_array_memcpy(packet.reason, reason, sizeof(char)*80);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_COMMAND_RESULT;
    return mavlink_finalize_message_chan(msg, system_id, component_id, chan, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC);
}

/**
 * @brief Encode a ot_command_result struct
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 * @param ot_command_result C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_command_result_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_ot_command_result_t* ot_command_result)
{
    return mavlink_msg_ot_command_result_pack(system_id, component_id, msg, ot_command_result->sender_session, ot_command_result->request_id, ot_command_result->operation, ot_command_result->result, ot_command_result->target_system, ot_command_result->target_component, ot_command_result->reason);
}

/**
 * @brief Encode a ot_command_result struct on a channel
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param ot_command_result C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_command_result_encode_chan(uint8_t system_id, uint8_t component_id, uint8_t chan, mavlink_message_t* msg, const mavlink_ot_command_result_t* ot_command_result)
{
    return mavlink_msg_ot_command_result_pack_chan(system_id, component_id, chan, msg, ot_command_result->sender_session, ot_command_result->request_id, ot_command_result->operation, ot_command_result->result, ot_command_result->target_system, ot_command_result->target_component, ot_command_result->reason);
}

/**
 * @brief Encode a ot_command_result struct with provided status structure
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 * @param ot_command_result C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_command_result_encode_status(uint8_t system_id, uint8_t component_id, mavlink_status_t* _status, mavlink_message_t* msg, const mavlink_ot_command_result_t* ot_command_result)
{
    return mavlink_msg_ot_command_result_pack_status(system_id, component_id, _status, msg,  ot_command_result->sender_session, ot_command_result->request_id, ot_command_result->operation, ot_command_result->result, ot_command_result->target_system, ot_command_result->target_component, ot_command_result->reason);
}

/**
 * @brief Send a ot_command_result message
 * @param chan MAVLink channel to send the message
 *
 * @param sender_session  Echoed sender session.
 * @param request_id  Echoed request identity.
 * @param operation  Echoed operation.
 * @param result  Command result.
 * @param target_system  Requesting system.
 * @param target_component  Requesting component.
 * @param reason  Human-readable rejection or acceptance detail.
 */
#ifdef MAVLINK_USE_CONVENIENCE_FUNCTIONS

static inline void mavlink_msg_ot_command_result_send(mavlink_channel_t chan, uint32_t sender_session, uint32_t request_id, uint8_t operation, uint8_t result, uint8_t target_system, uint8_t target_component, const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN];
    _mav_put_uint32_t(buf, 0, sender_session);
    _mav_put_uint32_t(buf, 4, request_id);
    _mav_put_uint8_t(buf, 8, operation);
    _mav_put_uint8_t(buf, 9, result);
    _mav_put_uint8_t(buf, 10, target_system);
    _mav_put_uint8_t(buf, 11, target_component);
    _mav_put_char_array(buf, 12, reason, 80);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_RESULT, buf, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC);
#else
    mavlink_ot_command_result_t packet;
    packet.sender_session = sender_session;
    packet.request_id = request_id;
    packet.operation = operation;
    packet.result = result;
    packet.target_system = target_system;
    packet.target_component = target_component;
    mav_array_memcpy(packet.reason, reason, sizeof(char)*80);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_RESULT, (const char *)&packet, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC);
#endif
}

/**
 * @brief Send a ot_command_result message
 * @param chan MAVLink channel to send the message
 * @param struct The MAVLink struct to serialize
 */
static inline void mavlink_msg_ot_command_result_send_struct(mavlink_channel_t chan, const mavlink_ot_command_result_t* ot_command_result)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    mavlink_msg_ot_command_result_send(chan, ot_command_result->sender_session, ot_command_result->request_id, ot_command_result->operation, ot_command_result->result, ot_command_result->target_system, ot_command_result->target_component, ot_command_result->reason);
#else
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_RESULT, (const char *)ot_command_result, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC);
#endif
}

#if MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN <= MAVLINK_MAX_PAYLOAD_LEN
/*
  This variant of _send() can be used to save stack space by reusing
  memory from the receive buffer.  The caller provides a
  mavlink_message_t which is the size of a full mavlink message. This
  is usually the receive buffer for the channel, and allows a reply to an
  incoming message with minimum stack space usage.
 */
static inline void mavlink_msg_ot_command_result_send_buf(mavlink_message_t *msgbuf, mavlink_channel_t chan,  uint32_t sender_session, uint32_t request_id, uint8_t operation, uint8_t result, uint8_t target_system, uint8_t target_component, const char *reason)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char *buf = (char *)msgbuf;
    _mav_put_uint32_t(buf, 0, sender_session);
    _mav_put_uint32_t(buf, 4, request_id);
    _mav_put_uint8_t(buf, 8, operation);
    _mav_put_uint8_t(buf, 9, result);
    _mav_put_uint8_t(buf, 10, target_system);
    _mav_put_uint8_t(buf, 11, target_component);
    _mav_put_char_array(buf, 12, reason, 80);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_RESULT, buf, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC);
#else
    mavlink_ot_command_result_t *packet = (mavlink_ot_command_result_t *)msgbuf;
    packet->sender_session = sender_session;
    packet->request_id = request_id;
    packet->operation = operation;
    packet->result = result;
    packet->target_system = target_system;
    packet->target_component = target_component;
    mav_array_memcpy(packet->reason, reason, sizeof(char)*80);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_RESULT, (const char *)packet, MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN, MAVLINK_MSG_ID_OT_COMMAND_RESULT_CRC);
#endif
}
#endif

#endif

// MESSAGE OT_COMMAND_RESULT UNPACKING


/**
 * @brief Get field sender_session from ot_command_result message
 *
 * @return  Echoed sender session.
 */
static inline uint32_t mavlink_msg_ot_command_result_get_sender_session(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  0);
}

/**
 * @brief Get field request_id from ot_command_result message
 *
 * @return  Echoed request identity.
 */
static inline uint32_t mavlink_msg_ot_command_result_get_request_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  4);
}

/**
 * @brief Get field operation from ot_command_result message
 *
 * @return  Echoed operation.
 */
static inline uint8_t mavlink_msg_ot_command_result_get_operation(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  8);
}

/**
 * @brief Get field result from ot_command_result message
 *
 * @return  Command result.
 */
static inline uint8_t mavlink_msg_ot_command_result_get_result(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  9);
}

/**
 * @brief Get field target_system from ot_command_result message
 *
 * @return  Requesting system.
 */
static inline uint8_t mavlink_msg_ot_command_result_get_target_system(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  10);
}

/**
 * @brief Get field target_component from ot_command_result message
 *
 * @return  Requesting component.
 */
static inline uint8_t mavlink_msg_ot_command_result_get_target_component(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  11);
}

/**
 * @brief Get field reason from ot_command_result message
 *
 * @return  Human-readable rejection or acceptance detail.
 */
static inline uint16_t mavlink_msg_ot_command_result_get_reason(const mavlink_message_t* msg, char *reason)
{
    return _MAV_RETURN_char_array(msg, reason, 80,  12);
}

/**
 * @brief Decode a ot_command_result message into a struct
 *
 * @param msg The message to decode
 * @param ot_command_result C-struct to decode the message contents into
 */
static inline void mavlink_msg_ot_command_result_decode(const mavlink_message_t* msg, mavlink_ot_command_result_t* ot_command_result)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    ot_command_result->sender_session = mavlink_msg_ot_command_result_get_sender_session(msg);
    ot_command_result->request_id = mavlink_msg_ot_command_result_get_request_id(msg);
    ot_command_result->operation = mavlink_msg_ot_command_result_get_operation(msg);
    ot_command_result->result = mavlink_msg_ot_command_result_get_result(msg);
    ot_command_result->target_system = mavlink_msg_ot_command_result_get_target_system(msg);
    ot_command_result->target_component = mavlink_msg_ot_command_result_get_target_component(msg);
    mavlink_msg_ot_command_result_get_reason(msg, ot_command_result->reason);
#else
        uint8_t len = msg->len < MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN? msg->len : MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN;
        memset(ot_command_result, 0, MAVLINK_MSG_ID_OT_COMMAND_RESULT_LEN);
    memcpy(ot_command_result, _MAV_PAYLOAD(msg), len);
#endif
}
