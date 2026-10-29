#pragma once
// MESSAGE OT_CATALOG_REQUEST PACKING

#include <stdint.h>

#define MAVLINK_MSG_ID_OT_CATALOG_REQUEST 520105


typedef struct __mavlink_ot_catalog_request_t {
 uint32_t catalog_revision; /*<  Expected revision, or 0 for current.*/
 uint16_t index; /*<  Requested entry, or 65535 for all entries.*/
 uint8_t target_system; /*<  Target ECU system.*/
 uint8_t target_component; /*<  Target ECU component.*/
} mavlink_ot_catalog_request_t;

#define MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN 8
#define MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN 8
#define MAVLINK_MSG_ID_520105_LEN 8
#define MAVLINK_MSG_ID_520105_MIN_LEN 8

#define MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC 123
#define MAVLINK_MSG_ID_520105_CRC 123



#if MAVLINK_COMMAND_24BIT
#define MAVLINK_MESSAGE_INFO_OT_CATALOG_REQUEST { \
    520105, \
    "OT_CATALOG_REQUEST", \
    4, \
    {  { "catalog_revision", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_catalog_request_t, catalog_revision) }, \
         { "index", NULL, MAVLINK_TYPE_UINT16_T, 0, 4, offsetof(mavlink_ot_catalog_request_t, index) }, \
         { "target_system", NULL, MAVLINK_TYPE_UINT8_T, 0, 6, offsetof(mavlink_ot_catalog_request_t, target_system) }, \
         { "target_component", NULL, MAVLINK_TYPE_UINT8_T, 0, 7, offsetof(mavlink_ot_catalog_request_t, target_component) }, \
         } \
}
#else
#define MAVLINK_MESSAGE_INFO_OT_CATALOG_REQUEST { \
    "OT_CATALOG_REQUEST", \
    4, \
    {  { "catalog_revision", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_catalog_request_t, catalog_revision) }, \
         { "index", NULL, MAVLINK_TYPE_UINT16_T, 0, 4, offsetof(mavlink_ot_catalog_request_t, index) }, \
         { "target_system", NULL, MAVLINK_TYPE_UINT8_T, 0, 6, offsetof(mavlink_ot_catalog_request_t, target_system) }, \
         { "target_component", NULL, MAVLINK_TYPE_UINT8_T, 0, 7, offsetof(mavlink_ot_catalog_request_t, target_component) }, \
         } \
}
#endif

/**
 * @brief Pack a ot_catalog_request message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 *
 * @param catalog_revision  Expected revision, or 0 for current.
 * @param index  Requested entry, or 65535 for all entries.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_catalog_request_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg,
                               uint32_t catalog_revision, uint16_t index, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN];
    _mav_put_uint32_t(buf, 0, catalog_revision);
    _mav_put_uint16_t(buf, 4, index);
    _mav_put_uint8_t(buf, 6, target_system);
    _mav_put_uint8_t(buf, 7, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN);
#else
    mavlink_ot_catalog_request_t packet;
    packet.catalog_revision = catalog_revision;
    packet.index = index;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CATALOG_REQUEST;
    return mavlink_finalize_message(msg, system_id, component_id, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC);
}

/**
 * @brief Pack a ot_catalog_request message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 *
 * @param catalog_revision  Expected revision, or 0 for current.
 * @param index  Requested entry, or 65535 for all entries.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_catalog_request_pack_status(uint8_t system_id, uint8_t component_id, mavlink_status_t *_status, mavlink_message_t* msg,
                               uint32_t catalog_revision, uint16_t index, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN];
    _mav_put_uint32_t(buf, 0, catalog_revision);
    _mav_put_uint16_t(buf, 4, index);
    _mav_put_uint8_t(buf, 6, target_system);
    _mav_put_uint8_t(buf, 7, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN);
#else
    mavlink_ot_catalog_request_t packet;
    packet.catalog_revision = catalog_revision;
    packet.index = index;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CATALOG_REQUEST;
#if MAVLINK_CRC_EXTRA
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC);
#else
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN);
#endif
}

/**
 * @brief Pack a ot_catalog_request message on a channel
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param catalog_revision  Expected revision, or 0 for current.
 * @param index  Requested entry, or 65535 for all entries.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_catalog_request_pack_chan(uint8_t system_id, uint8_t component_id, uint8_t chan,
                               mavlink_message_t* msg,
                                   uint32_t catalog_revision,uint16_t index,uint8_t target_system,uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN];
    _mav_put_uint32_t(buf, 0, catalog_revision);
    _mav_put_uint16_t(buf, 4, index);
    _mav_put_uint8_t(buf, 6, target_system);
    _mav_put_uint8_t(buf, 7, target_component);

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN);
#else
    mavlink_ot_catalog_request_t packet;
    packet.catalog_revision = catalog_revision;
    packet.index = index;
    packet.target_system = target_system;
    packet.target_component = target_component;

        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CATALOG_REQUEST;
    return mavlink_finalize_message_chan(msg, system_id, component_id, chan, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC);
}

/**
 * @brief Encode a ot_catalog_request struct
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 * @param ot_catalog_request C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_catalog_request_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_ot_catalog_request_t* ot_catalog_request)
{
    return mavlink_msg_ot_catalog_request_pack(system_id, component_id, msg, ot_catalog_request->catalog_revision, ot_catalog_request->index, ot_catalog_request->target_system, ot_catalog_request->target_component);
}

/**
 * @brief Encode a ot_catalog_request struct on a channel
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param ot_catalog_request C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_catalog_request_encode_chan(uint8_t system_id, uint8_t component_id, uint8_t chan, mavlink_message_t* msg, const mavlink_ot_catalog_request_t* ot_catalog_request)
{
    return mavlink_msg_ot_catalog_request_pack_chan(system_id, component_id, chan, msg, ot_catalog_request->catalog_revision, ot_catalog_request->index, ot_catalog_request->target_system, ot_catalog_request->target_component);
}

/**
 * @brief Encode a ot_catalog_request struct with provided status structure
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 * @param ot_catalog_request C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_catalog_request_encode_status(uint8_t system_id, uint8_t component_id, mavlink_status_t* _status, mavlink_message_t* msg, const mavlink_ot_catalog_request_t* ot_catalog_request)
{
    return mavlink_msg_ot_catalog_request_pack_status(system_id, component_id, _status, msg,  ot_catalog_request->catalog_revision, ot_catalog_request->index, ot_catalog_request->target_system, ot_catalog_request->target_component);
}

/**
 * @brief Send a ot_catalog_request message
 * @param chan MAVLink channel to send the message
 *
 * @param catalog_revision  Expected revision, or 0 for current.
 * @param index  Requested entry, or 65535 for all entries.
 * @param target_system  Target ECU system.
 * @param target_component  Target ECU component.
 */
#ifdef MAVLINK_USE_CONVENIENCE_FUNCTIONS

static inline void mavlink_msg_ot_catalog_request_send(mavlink_channel_t chan, uint32_t catalog_revision, uint16_t index, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN];
    _mav_put_uint32_t(buf, 0, catalog_revision);
    _mav_put_uint16_t(buf, 4, index);
    _mav_put_uint8_t(buf, 6, target_system);
    _mav_put_uint8_t(buf, 7, target_component);

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CATALOG_REQUEST, buf, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC);
#else
    mavlink_ot_catalog_request_t packet;
    packet.catalog_revision = catalog_revision;
    packet.index = index;
    packet.target_system = target_system;
    packet.target_component = target_component;

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CATALOG_REQUEST, (const char *)&packet, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC);
#endif
}

/**
 * @brief Send a ot_catalog_request message
 * @param chan MAVLink channel to send the message
 * @param struct The MAVLink struct to serialize
 */
static inline void mavlink_msg_ot_catalog_request_send_struct(mavlink_channel_t chan, const mavlink_ot_catalog_request_t* ot_catalog_request)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    mavlink_msg_ot_catalog_request_send(chan, ot_catalog_request->catalog_revision, ot_catalog_request->index, ot_catalog_request->target_system, ot_catalog_request->target_component);
#else
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CATALOG_REQUEST, (const char *)ot_catalog_request, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC);
#endif
}

#if MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN <= MAVLINK_MAX_PAYLOAD_LEN
/*
  This variant of _send() can be used to save stack space by reusing
  memory from the receive buffer.  The caller provides a
  mavlink_message_t which is the size of a full mavlink message. This
  is usually the receive buffer for the channel, and allows a reply to an
  incoming message with minimum stack space usage.
 */
static inline void mavlink_msg_ot_catalog_request_send_buf(mavlink_message_t *msgbuf, mavlink_channel_t chan,  uint32_t catalog_revision, uint16_t index, uint8_t target_system, uint8_t target_component)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char *buf = (char *)msgbuf;
    _mav_put_uint32_t(buf, 0, catalog_revision);
    _mav_put_uint16_t(buf, 4, index);
    _mav_put_uint8_t(buf, 6, target_system);
    _mav_put_uint8_t(buf, 7, target_component);

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CATALOG_REQUEST, buf, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC);
#else
    mavlink_ot_catalog_request_t *packet = (mavlink_ot_catalog_request_t *)msgbuf;
    packet->catalog_revision = catalog_revision;
    packet->index = index;
    packet->target_system = target_system;
    packet->target_component = target_component;

    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CATALOG_REQUEST, (const char *)packet, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_CRC);
#endif
}
#endif

#endif

// MESSAGE OT_CATALOG_REQUEST UNPACKING


/**
 * @brief Get field catalog_revision from ot_catalog_request message
 *
 * @return  Expected revision, or 0 for current.
 */
static inline uint32_t mavlink_msg_ot_catalog_request_get_catalog_revision(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  0);
}

/**
 * @brief Get field index from ot_catalog_request message
 *
 * @return  Requested entry, or 65535 for all entries.
 */
static inline uint16_t mavlink_msg_ot_catalog_request_get_index(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint16_t(msg,  4);
}

/**
 * @brief Get field target_system from ot_catalog_request message
 *
 * @return  Target ECU system.
 */
static inline uint8_t mavlink_msg_ot_catalog_request_get_target_system(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  6);
}

/**
 * @brief Get field target_component from ot_catalog_request message
 *
 * @return  Target ECU component.
 */
static inline uint8_t mavlink_msg_ot_catalog_request_get_target_component(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  7);
}

/**
 * @brief Decode a ot_catalog_request message into a struct
 *
 * @param msg The message to decode
 * @param ot_catalog_request C-struct to decode the message contents into
 */
static inline void mavlink_msg_ot_catalog_request_decode(const mavlink_message_t* msg, mavlink_ot_catalog_request_t* ot_catalog_request)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    ot_catalog_request->catalog_revision = mavlink_msg_ot_catalog_request_get_catalog_revision(msg);
    ot_catalog_request->index = mavlink_msg_ot_catalog_request_get_index(msg);
    ot_catalog_request->target_system = mavlink_msg_ot_catalog_request_get_target_system(msg);
    ot_catalog_request->target_component = mavlink_msg_ot_catalog_request_get_target_component(msg);
#else
        uint8_t len = msg->len < MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN? msg->len : MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN;
        memset(ot_catalog_request, 0, MAVLINK_MSG_ID_OT_CATALOG_REQUEST_LEN);
    memcpy(ot_catalog_request, _MAV_PAYLOAD(msg), len);
#endif
}
