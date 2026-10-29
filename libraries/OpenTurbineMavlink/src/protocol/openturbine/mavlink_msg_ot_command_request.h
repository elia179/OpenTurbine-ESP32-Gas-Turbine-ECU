#pragma once
// MESSAGE OT_COMMAND_REQUEST PACKING

#include <stdint.h>

#define MAVLINK_MSG_ID_OT_COMMAND_REQUEST 520106


typedef struct __mavlink_ot_command_request_t {
 uint32_t boot_id; /*<  Expected ECU boot identity; required except for Stop.*/
 uint32_t time_boot_ms; /*<  Estimated current ECU time; required for new non-stop operations.*/
 uint32_t sender_session; /*<  Nonzero sender boot/session identity.*/
 uint32_t request_id; /*<  Nonzero request identity within the sender session.*/
 uint8_t operation; /*<  OpenTurbine engine operation enum.*/
 uint8_t target_system; /*<  Target ECU system.*/
 uint8_t target_component; /*<  Target ECU component.*/
} mavlink_ot_command_request_t;

#define MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN 19
#define MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN 19
#define MAVLINK_MSG_ID_520106_LEN 19
#define MAVLINK_MSG_ID_520106_MIN_LEN 19

#define MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC 250
#define MAVLINK_MSG_ID_520106_CRC 250



#if MAVLINK_COMMAND_24BIT
#define MAVLINK_MESSAGE_INFO_OT_COMMAND_REQUEST { \
    520106, \
    "OT_COMMAND_REQUEST", \
    7, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_command_request_t, boot_id) }, \
         { "time_boot_ms", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_command_request_t, time_boot_ms) }, \
         { "sender_session", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_command_request_t, sender_session) }, \
         { "request_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 12, offsetof(mavlink_ot_command_request_t, request_id) }, \
         { "operation", NULL, MAVLINK_TYPE_UINT8_T, 0, 16, offsetof(mavlink_ot_command_request_t, operation) }, \
         { "target_system", NULL, MAVLINK_TYPE_UINT8_T, 0, 17, offsetof(mavlink_ot_command_request_t, target_system) }, \
         { "target_component", NULL, MAVLINK_TYPE_UINT8_T, 0, 18, offsetof(mavlink_ot_command_request_t, target_component) }, \
         } \
}
#else
#define MAVLINK_MESSAGE_INFO_OT_COMMAND_REQUEST { \
    "OT_COMMAND_REQUEST", \
    7, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_command_request_t, boot_id) }, \
         { "time_boot_ms", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_command_request_t, time_boot_ms) }, \
         { "sender_session", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_command_request_t, sender_session) }, \
         { "request_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 12, offsetof(mavlink_ot_command_request_t, request_id) }, \
         { "operation", NULL, MAVLINK_TYPE_UINT8_T, 0, 16, offsetof(mavlink_ot_command_request_t, operation) }, \
         { "target_system", NULL, MAVLINK_TYPE_UINT8_T, 0, 17, offsetof(mavlink_ot_command_request_t, target_system) }, \
         { "target_component", NULL, MAVLINK_TYPE_UINT8_T, 0, 18, offsetof(mavlink_ot_command_request_t, target_component) }, \
         } \
}
#endif

/**
 * @brief Pack a ot_command_request message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  Expected ECU boot identity; required except for Stop.
 * @param time_boot_ms  Estimated current ECU time; required for new non-stop operations.
 * @param sender_session  Nonzero sender boot/session identity.
 * @param request_id  Nonzero request identity within the sender session.
 * @param operation  OpenTurbine engine operation enum.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_command_request_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t time_boot_ms, uint32_t sender_session, uint32_t request_id, uint8_t operation, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, request_id);
    _mav_put_uint8_t(buf, 16, operation);
    _mav_put_uint8_t(buf, 17, target_system);
    _mav_put_uint8_t(buf, 18, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN);
#else
    mavlink_ot_command_request_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.sender_session = sender_session;
    packet.request_id = request_id;
    packet.operation = operation;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_COMMAND_REQUEST;
    return mavlink_finalize_message(msg, system_id, component_id, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC);
}

/**
 * @brief Pack a ot_command_request message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  Expected ECU boot identity; required except for Stop.
 * @param time_boot_ms  Estimated current ECU time; required for new non-stop operations.
 * @param sender_session  Nonzero sender boot/session identity.
 * @param request_id  Nonzero request identity within the sender session.
 * @param operation  OpenTurbine engine operation enum.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_command_request_pack_status(uint8_t system_id, uint8_t component_id, mavlink_status_t *_status, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t time_boot_ms, uint32_t sender_session, uint32_t request_id, uint8_t operation, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, request_id);
    _mav_put_uint8_t(buf, 16, operation);
    _mav_put_uint8_t(buf, 17, target_system);
    _mav_put_uint8_t(buf, 18, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN);
#else
    mavlink_ot_command_request_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.sender_session = sender_session;
    packet.request_id = request_id;
    packet.operation = operation;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_COMMAND_REQUEST;
#if MAVLINK_CRC_EXTRA
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC);
#else
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN);
#endif
}

/**
 * @brief Pack a ot_command_request message on a channel
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param boot_id  Expected ECU boot identity; required except for Stop.
 * @param time_boot_ms  Estimated current ECU time; required for new non-stop operations.
 * @param sender_session  Nonzero sender boot/session identity.
 * @param request_id  Nonzero request identity within the sender session.
 * @param operation  OpenTurbine engine operation enum.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_command_request_pack_chan(uint8_t system_id, uint8_t component_id, uint8_t chan,
                               mavlink_message_t* msg,
                                   uint32_t boot_id,uint32_t time_boot_ms,uint32_t sender_session,uint32_t request_id,uint8_t operation,uint8_t target_system,uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, request_id);
    _mav_put_uint8_t(buf, 16, operation);
    _mav_put_uint8_t(buf, 17, target_system);
    _mav_put_uint8_t(buf, 18, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN);
#else
    mavlink_ot_command_request_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.sender_session = sender_session;
    packet.request_id = request_id;
    packet.operation = operation;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_COMMAND_REQUEST;
    return mavlink_finalize_message_chan(msg, system_id, component_id, chan, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC);
}

/**
 * @brief Encode a ot_command_request struct
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 * @param ot_command_request C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_command_request_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_ot_command_request_t* ot_command_request)
{
    return mavlink_msg_ot_command_request_pack(system_id, component_id, msg, ot_command_request->boot_id, ot_command_request->time_boot_ms, ot_command_request->sender_session, ot_command_request->request_id, ot_command_request->operation, ot_command_request->target_system, ot_command_request->target_component);
}

/**
 * @brief Encode a ot_command_request struct on a channel
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param ot_command_request C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_command_request_encode_chan(uint8_t system_id, uint8_t component_id, uint8_t chan, mavlink_message_t* msg, const mavlink_ot_command_request_t* ot_command_request)
{
    return mavlink_msg_ot_command_request_pack_chan(system_id, component_id, chan, msg, ot_command_request->boot_id, ot_command_request->time_boot_ms, ot_command_request->sender_session, ot_command_request->request_id, ot_command_request->operation, ot_command_request->target_system, ot_command_request->target_component);
}

/**
 * @brief Encode a ot_command_request struct with provided status structure
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 * @param ot_command_request C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_command_request_encode_status(uint8_t system_id, uint8_t component_id, mavlink_status_t* _status, mavlink_message_t* msg, const mavlink_ot_command_request_t* ot_command_request)
{
    return mavlink_msg_ot_command_request_pack_status(system_id, component_id, _status, msg,  ot_command_request->boot_id, ot_command_request->time_boot_ms, ot_command_request->sender_session, ot_command_request->request_id, ot_command_request->operation, ot_command_request->target_system, ot_command_request->target_component);
}

/**
 * @brief Send a ot_command_request message
 * @param chan MAVLink channel to send the message
 *
 * @param boot_id  Expected ECU boot identity; required except for Stop.
 * @param time_boot_ms  Estimated current ECU time; required for new non-stop operations.
 * @param sender_session  Nonzero sender boot/session identity.
 * @param request_id  Nonzero request identity within the sender session.
 * @param operation  OpenTurbine engine operation enum.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 */
#ifdef MAVLINK_USE_CONVENIENCE_FUNCTIONS

static inline void mavlink_msg_ot_command_request_send(mavlink_channel_t chan, uint32_t boot_id, uint32_t time_boot_ms, uint32_t sender_session, uint32_t request_id, uint8_t operation, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, request_id);
    _mav_put_uint8_t(buf, 16, operation);
    _mav_put_uint8_t(buf, 17, target_system);
    _mav_put_uint8_t(buf, 18, target_component);

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_REQUEST, buf, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC);
#else
    mavlink_ot_command_request_t packet;
    packet.boot_id = boot_id;
    packet.time_boot_ms = time_boot_ms;
    packet.sender_session = sender_session;
    packet.request_id = request_id;
    packet.operation = operation;
    packet.target_system = target_system;
    packet.target_component = target_component;

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_REQUEST, (const char *)&packet, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC);
#endif
}

/**
 * @brief Send a ot_command_request message
 * @param chan MAVLink channel to send the message
 * @param struct The MAVLink struct to serialize
 */
static inline void mavlink_msg_ot_command_request_send_struct(mavlink_channel_t chan, const mavlink_ot_command_request_t* ot_command_request)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    mavlink_msg_ot_command_request_send(chan, ot_command_request->boot_id, ot_command_request->time_boot_ms, ot_command_request->sender_session, ot_command_request->request_id, ot_command_request->operation, ot_command_request->target_system, ot_command_request->target_component);
#else
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_REQUEST, (const char *)ot_command_request, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC);
#endif
}

#if MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN <= MAVLINK_MAX_PAYLOAD_LEN
/*
  This variant of _send() can be used to save stack space by reusing
  memory from the receive buffer.  The caller provides a
  mavlink_message_t which is the size of a full mavlink message. This
  is usually the receive buffer for the channel, and allows a reply to an
  incoming message with minimum stack space usage.
 */
static inline void mavlink_msg_ot_command_request_send_buf(mavlink_message_t *msgbuf, mavlink_channel_t chan,  uint32_t boot_id, uint32_t time_boot_ms, uint32_t sender_session, uint32_t request_id, uint8_t operation, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char *buf = (char *)msgbuf;
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, time_boot_ms);
    _mav_put_uint32_t(buf, 8, sender_session);
    _mav_put_uint32_t(buf, 12, request_id);
    _mav_put_uint8_t(buf, 16, operation);
    _mav_put_uint8_t(buf, 17, target_system);
    _mav_put_uint8_t(buf, 18, target_component);

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_REQUEST, buf, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC);
#else
    mavlink_ot_command_request_t *packet = (mavlink_ot_command_request_t *)msgbuf;
    packet->boot_id = boot_id;
    packet->time_boot_ms = time_boot_ms;
    packet->sender_session = sender_session;
    packet->request_id = request_id;
    packet->operation = operation;
    packet->target_system = target_system;
    packet->target_component = target_component;

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_COMMAND_REQUEST, (const char *)packet, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_CRC);
#endif
}
#endif

#endif

// MESSAGE OT_COMMAND_REQUEST UNPACKING


/**
 * @brief Get field boot_id from ot_command_request message
 *
 * @return  Expected ECU boot identity; required except for Stop.
 */
static inline uint32_t mavlink_msg_ot_command_request_get_boot_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  0);
}

/**
 * @brief Get field time_boot_ms from ot_command_request message
 *
 * @return  Estimated current ECU time; required for new non-stop operations.
 */
static inline uint32_t mavlink_msg_ot_command_request_get_time_boot_ms(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  4);
}

/**
 * @brief Get field sender_session from ot_command_request message
 *
 * @return  Nonzero sender boot/session identity.
 */
static inline uint32_t mavlink_msg_ot_command_request_get_sender_session(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  8);
}

/**
 * @brief Get field request_id from ot_command_request message
 *
 * @return  Nonzero request identity within the sender session.
 */
static inline uint32_t mavlink_msg_ot_command_request_get_request_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  12);
}

/**
 * @brief Get field operation from ot_command_request message
 *
 * @return  OpenTurbine engine operation enum.
 */
static inline uint8_t mavlink_msg_ot_command_request_get_operation(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  16);
}

/**
 * @brief Get field target_system from ot_command_request message
 *
 * @return  Target ECU system.
 */
static inline uint8_t mavlink_msg_ot_command_request_get_target_system(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  17);
}

/**
 * @brief Get field target_component from ot_command_request message
 *
 * @return  Target ECU component.
 */
static inline uint8_t mavlink_msg_ot_command_request_get_target_component(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  18);
}

/**
 * @brief Decode a ot_command_request message into a struct
 *
 * @param msg The message to decode
 * @param ot_command_request C-struct to decode the message contents into
 */
static inline void mavlink_msg_ot_command_request_decode(const mavlink_message_t* msg, mavlink_ot_command_request_t* ot_command_request)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    ot_command_request->boot_id = mavlink_msg_ot_command_request_get_boot_id(msg);
    ot_command_request->time_boot_ms = mavlink_msg_ot_command_request_get_time_boot_ms(msg);
    ot_command_request->sender_session = mavlink_msg_ot_command_request_get_sender_session(msg);
    ot_command_request->request_id = mavlink_msg_ot_command_request_get_request_id(msg);
    ot_command_request->operation = mavlink_msg_ot_command_request_get_operation(msg);
    ot_command_request->target_system = mavlink_msg_ot_command_request_get_target_system(msg);
    ot_command_request->target_component = mavlink_msg_ot_command_request_get_target_component(msg);
#else
        uint8_t len = msg->len < MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN? msg->len : MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN;
        memset(ot_command_request, 0, MAVLINK_MSG_ID_OT_COMMAND_REQUEST_LEN);
    memcpy(ot_command_request, _MAV_PAYLOAD(msg), len);
#endif
}
