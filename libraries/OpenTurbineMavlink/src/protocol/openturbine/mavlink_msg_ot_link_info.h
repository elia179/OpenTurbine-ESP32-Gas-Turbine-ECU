#pragma once
// MESSAGE OT_LINK_INFO PACKING

#include <stdint.h>

#define MAVLINK_MSG_ID_OT_LINK_INFO 520100


typedef struct __mavlink_ot_link_info_t {
 uint32_t boot_id; /*<  ECU boot identity.*/
 uint32_t catalog_revision; /*<  Catalogue revision.*/
 uint32_t capabilities; /*<  Supported engine operations bitmask.*/
 uint16_t channel_count; /*<  Number of catalogue entries.*/
 uint16_t input_timeout_ms; /*< [ms] Remote-input expiry interval.*/
 uint16_t telemetry_interval_ms; /*< [ms] Interval between channel-value batches.*/
 char engine_name[32]; /*<  Configured engine name.*/
} mavlink_ot_link_info_t;

#define MAVLINK_MSG_ID_OT_LINK_INFO_LEN 50
#define MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN 50
#define MAVLINK_MSG_ID_520100_LEN 50
#define MAVLINK_MSG_ID_520100_MIN_LEN 50

#define MAVLINK_MSG_ID_OT_LINK_INFO_CRC 33
#define MAVLINK_MSG_ID_520100_CRC 33

#define MAVLINK_MSG_OT_LINK_INFO_FIELD_ENGINE_NAME_LEN 32

#if MAVLINK_COMMAND_24BIT
#define MAVLINK_MESSAGE_INFO_OT_LINK_INFO { \
    520100, \
    "OT_LINK_INFO", \
    7, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_link_info_t, boot_id) }, \
         { "catalog_revision", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_link_info_t, catalog_revision) }, \
         { "capabilities", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_link_info_t, capabilities) }, \
         { "channel_count", NULL, MAVLINK_TYPE_UINT16_T, 0, 12, offsetof(mavlink_ot_link_info_t, channel_count) }, \
         { "input_timeout_ms", NULL, MAVLINK_TYPE_UINT16_T, 0, 14, offsetof(mavlink_ot_link_info_t, input_timeout_ms) }, \
         { "telemetry_interval_ms", NULL, MAVLINK_TYPE_UINT16_T, 0, 16, offsetof(mavlink_ot_link_info_t, telemetry_interval_ms) }, \
         { "engine_name", NULL, MAVLINK_TYPE_CHAR, 32, 18, offsetof(mavlink_ot_link_info_t, engine_name) }, \
         } \
}
#else
#define MAVLINK_MESSAGE_INFO_OT_LINK_INFO { \
    "OT_LINK_INFO", \
    7, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_link_info_t, boot_id) }, \
         { "catalog_revision", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_link_info_t, catalog_revision) }, \
         { "capabilities", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_link_info_t, capabilities) }, \
         { "channel_count", NULL, MAVLINK_TYPE_UINT16_T, 0, 12, offsetof(mavlink_ot_link_info_t, channel_count) }, \
         { "input_timeout_ms", NULL, MAVLINK_TYPE_UINT16_T, 0, 14, offsetof(mavlink_ot_link_info_t, input_timeout_ms) }, \
         { "telemetry_interval_ms", NULL, MAVLINK_TYPE_UINT16_T, 0, 16, offsetof(mavlink_ot_link_info_t, telemetry_interval_ms) }, \
         { "engine_name", NULL, MAVLINK_TYPE_CHAR, 32, 18, offsetof(mavlink_ot_link_info_t, engine_name) }, \
         } \
}
#endif

/**
 * @brief Pack a ot_link_info message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param capabilities  Supported engine operations bitmask.
 * @param channel_count  Number of catalogue entries.
 * @param input_timeout_ms [ms] Remote-input expiry interval.
 * @param telemetry_interval_ms [ms] Interval between channel-value batches.
 * @param engine_name  Configured engine name.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_link_info_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t catalog_revision, uint32_t capabilities, uint16_t channel_count, uint16_t input_timeout_ms, uint16_t telemetry_interval_ms, const char *engine_name)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_LINK_INFO_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, capabilities);
    _mav_put_uint16_t(buf, 12, channel_count);
    _mav_put_uint16_t(buf, 14, input_timeout_ms);
    _mav_put_uint16_t(buf, 16, telemetry_interval_ms);
    _mav_put_char_array(buf, 18, engine_name, 32);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_LINK_INFO_LEN);
#else
    mavlink_ot_link_info_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.capabilities = capabilities;
    packet.channel_count = channel_count;
    packet.input_timeout_ms = input_timeout_ms;
    packet.telemetry_interval_ms = telemetry_interval_ms;
    mav_array_memcpy(packet.engine_name, engine_name, sizeof(char)*32);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_LINK_INFO_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_LINK_INFO;
    return mavlink_finalize_message(msg, system_id, component_id, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_CRC);
}

/**
 * @brief Pack a ot_link_info message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param capabilities  Supported engine operations bitmask.
 * @param channel_count  Number of catalogue entries.
 * @param input_timeout_ms [ms] Remote-input expiry interval.
 * @param telemetry_interval_ms [ms] Interval between channel-value batches.
 * @param engine_name  Configured engine name.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_link_info_pack_status(uint8_t system_id, uint8_t component_id, mavlink_status_t *_status, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t catalog_revision, uint32_t capabilities, uint16_t channel_count, uint16_t input_timeout_ms, uint16_t telemetry_interval_ms, const char *engine_name)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_LINK_INFO_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, capabilities);
    _mav_put_uint16_t(buf, 12, channel_count);
    _mav_put_uint16_t(buf, 14, input_timeout_ms);
    _mav_put_uint16_t(buf, 16, telemetry_interval_ms);
    _mav_put_char_array(buf, 18, engine_name, 32);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_LINK_INFO_LEN);
#else
    mavlink_ot_link_info_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.capabilities = capabilities;
    packet.channel_count = channel_count;
    packet.input_timeout_ms = input_timeout_ms;
    packet.telemetry_interval_ms = telemetry_interval_ms;
    mav_array_memcpy(packet.engine_name, engine_name, sizeof(char)*32);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_LINK_INFO_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_LINK_INFO;
#if MAVLINK_CRC_EXTRA
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_CRC);
#else
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN);
#endif
}

/**
 * @brief Pack a ot_link_info message on a channel
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param capabilities  Supported engine operations bitmask.
 * @param channel_count  Number of catalogue entries.
 * @param input_timeout_ms [ms] Remote-input expiry interval.
 * @param telemetry_interval_ms [ms] Interval between channel-value batches.
 * @param engine_name  Configured engine name.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_link_info_pack_chan(uint8_t system_id, uint8_t component_id, uint8_t chan,
                               mavlink_message_t* msg,
                                   uint32_t boot_id,uint32_t catalog_revision,uint32_t capabilities,uint16_t channel_count,uint16_t input_timeout_ms,uint16_t telemetry_interval_ms,const char *engine_name)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_LINK_INFO_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, capabilities);
    _mav_put_uint16_t(buf, 12, channel_count);
    _mav_put_uint16_t(buf, 14, input_timeout_ms);
    _mav_put_uint16_t(buf, 16, telemetry_interval_ms);
    _mav_put_char_array(buf, 18, engine_name, 32);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_LINK_INFO_LEN);
#else
    mavlink_ot_link_info_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.capabilities = capabilities;
    packet.channel_count = channel_count;
    packet.input_timeout_ms = input_timeout_ms;
    packet.telemetry_interval_ms = telemetry_interval_ms;
    mav_array_memcpy(packet.engine_name, engine_name, sizeof(char)*32);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_LINK_INFO_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_LINK_INFO;
    return mavlink_finalize_message_chan(msg, system_id, component_id, chan, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_CRC);
}

/**
 * @brief Encode a ot_link_info struct
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 * @param ot_link_info C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_link_info_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_ot_link_info_t* ot_link_info)
{
    return mavlink_msg_ot_link_info_pack(system_id, component_id, msg, ot_link_info->boot_id, ot_link_info->catalog_revision, ot_link_info->capabilities, ot_link_info->channel_count, ot_link_info->input_timeout_ms, ot_link_info->telemetry_interval_ms, ot_link_info->engine_name);
}

/**
 * @brief Encode a ot_link_info struct on a channel
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param ot_link_info C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_link_info_encode_chan(uint8_t system_id, uint8_t component_id, uint8_t chan, mavlink_message_t* msg, const mavlink_ot_link_info_t* ot_link_info)
{
    return mavlink_msg_ot_link_info_pack_chan(system_id, component_id, chan, msg, ot_link_info->boot_id, ot_link_info->catalog_revision, ot_link_info->capabilities, ot_link_info->channel_count, ot_link_info->input_timeout_ms, ot_link_info->telemetry_interval_ms, ot_link_info->engine_name);
}

/**
 * @brief Encode a ot_link_info struct with provided status structure
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 * @param ot_link_info C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_link_info_encode_status(uint8_t system_id, uint8_t component_id, mavlink_status_t* _status, mavlink_message_t* msg, const mavlink_ot_link_info_t* ot_link_info)
{
    return mavlink_msg_ot_link_info_pack_status(system_id, component_id, _status, msg,  ot_link_info->boot_id, ot_link_info->catalog_revision, ot_link_info->capabilities, ot_link_info->channel_count, ot_link_info->input_timeout_ms, ot_link_info->telemetry_interval_ms, ot_link_info->engine_name);
}

/**
 * @brief Send a ot_link_info message
 * @param chan MAVLink channel to send the message
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param capabilities  Supported engine operations bitmask.
 * @param channel_count  Number of catalogue entries.
 * @param input_timeout_ms [ms] Remote-input expiry interval.
 * @param telemetry_interval_ms [ms] Interval between channel-value batches.
 * @param engine_name  Configured engine name.
 */
#ifdef MAVLINK_USE_CONVENIENCE_FUNCTIONS

static inline void mavlink_msg_ot_link_info_send(mavlink_channel_t chan, uint32_t boot_id, uint32_t catalog_revision, uint32_t capabilities, uint16_t channel_count, uint16_t input_timeout_ms, uint16_t telemetry_interval_ms, const char *engine_name)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_LINK_INFO_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, capabilities);
    _mav_put_uint16_t(buf, 12, channel_count);
    _mav_put_uint16_t(buf, 14, input_timeout_ms);
    _mav_put_uint16_t(buf, 16, telemetry_interval_ms);
    _mav_put_char_array(buf, 18, engine_name, 32);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_LINK_INFO, buf, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_CRC);
#else
    mavlink_ot_link_info_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.capabilities = capabilities;
    packet.channel_count = channel_count;
    packet.input_timeout_ms = input_timeout_ms;
    packet.telemetry_interval_ms = telemetry_interval_ms;
    mav_array_memcpy(packet.engine_name, engine_name, sizeof(char)*32);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_LINK_INFO, (const char *)&packet, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_CRC);
#endif
}

/**
 * @brief Send a ot_link_info message
 * @param chan MAVLink channel to send the message
 * @param struct The MAVLink struct to serialize
 */
static inline void mavlink_msg_ot_link_info_send_struct(mavlink_channel_t chan, const mavlink_ot_link_info_t* ot_link_info)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    mavlink_msg_ot_link_info_send(chan, ot_link_info->boot_id, ot_link_info->catalog_revision, ot_link_info->capabilities, ot_link_info->channel_count, ot_link_info->input_timeout_ms, ot_link_info->telemetry_interval_ms, ot_link_info->engine_name);
#else
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_LINK_INFO, (const char *)ot_link_info, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_CRC);
#endif
}

#if MAVLINK_MSG_ID_OT_LINK_INFO_LEN <= MAVLINK_MAX_PAYLOAD_LEN
/*
  This variant of _send() can be used to save stack space by reusing
  memory from the receive buffer.  The caller provides a
  mavlink_message_t which is the size of a full mavlink message. This
  is usually the receive buffer for the channel, and allows a reply to an
  incoming message with minimum stack space usage.
 */
static inline void mavlink_msg_ot_link_info_send_buf(mavlink_message_t *msgbuf, mavlink_channel_t chan,  uint32_t boot_id, uint32_t catalog_revision, uint32_t capabilities, uint16_t channel_count, uint16_t input_timeout_ms, uint16_t telemetry_interval_ms, const char *engine_name)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char *buf = (char *)msgbuf;
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, capabilities);
    _mav_put_uint16_t(buf, 12, channel_count);
    _mav_put_uint16_t(buf, 14, input_timeout_ms);
    _mav_put_uint16_t(buf, 16, telemetry_interval_ms);
    _mav_put_char_array(buf, 18, engine_name, 32);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_LINK_INFO, buf, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_CRC);
#else
    mavlink_ot_link_info_t *packet = (mavlink_ot_link_info_t *)msgbuf;
    packet->boot_id = boot_id;
    packet->catalog_revision = catalog_revision;
    packet->capabilities = capabilities;
    packet->channel_count = channel_count;
    packet->input_timeout_ms = input_timeout_ms;
    packet->telemetry_interval_ms = telemetry_interval_ms;
    mav_array_memcpy(packet->engine_name, engine_name, sizeof(char)*32);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_LINK_INFO, (const char *)packet, MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_LEN, MAVLINK_MSG_ID_OT_LINK_INFO_CRC);
#endif
}
#endif

#endif

// MESSAGE OT_LINK_INFO UNPACKING


/**
 * @brief Get field boot_id from ot_link_info message
 *
 * @return  ECU boot identity.
 */
static inline uint32_t mavlink_msg_ot_link_info_get_boot_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  0);
}

/**
 * @brief Get field catalog_revision from ot_link_info message
 *
 * @return  Catalogue revision.
 */
static inline uint32_t mavlink_msg_ot_link_info_get_catalog_revision(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  4);
}

/**
 * @brief Get field capabilities from ot_link_info message
 *
 * @return  Supported engine operations bitmask.
 */
static inline uint32_t mavlink_msg_ot_link_info_get_capabilities(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  8);
}

/**
 * @brief Get field channel_count from ot_link_info message
 *
 * @return  Number of catalogue entries.
 */
static inline uint16_t mavlink_msg_ot_link_info_get_channel_count(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint16_t(msg,  12);
}

/**
 * @brief Get field input_timeout_ms from ot_link_info message
 *
 * @return [ms] Remote-input expiry interval.
 */
static inline uint16_t mavlink_msg_ot_link_info_get_input_timeout_ms(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint16_t(msg,  14);
}

/**
 * @brief Get field telemetry_interval_ms from ot_link_info message
 *
 * @return [ms] Interval between channel-value batches.
 */
static inline uint16_t mavlink_msg_ot_link_info_get_telemetry_interval_ms(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint16_t(msg,  16);
}

/**
 * @brief Get field engine_name from ot_link_info message
 *
 * @return  Configured engine name.
 */
static inline uint16_t mavlink_msg_ot_link_info_get_engine_name(const mavlink_message_t* msg, char *engine_name)
{
    return _MAV_RETURN_char_array(msg, engine_name, 32,  18);
}

/**
 * @brief Decode a ot_link_info message into a struct
 *
 * @param msg The message to decode
 * @param ot_link_info C-struct to decode the message contents into
 */
static inline void mavlink_msg_ot_link_info_decode(const mavlink_message_t* msg, mavlink_ot_link_info_t* ot_link_info)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    ot_link_info->boot_id = mavlink_msg_ot_link_info_get_boot_id(msg);
    ot_link_info->catalog_revision = mavlink_msg_ot_link_info_get_catalog_revision(msg);
    ot_link_info->capabilities = mavlink_msg_ot_link_info_get_capabilities(msg);
    ot_link_info->channel_count = mavlink_msg_ot_link_info_get_channel_count(msg);
    ot_link_info->input_timeout_ms = mavlink_msg_ot_link_info_get_input_timeout_ms(msg);
    ot_link_info->telemetry_interval_ms = mavlink_msg_ot_link_info_get_telemetry_interval_ms(msg);
    mavlink_msg_ot_link_info_get_engine_name(msg, ot_link_info->engine_name);
#else
        uint8_t len = msg->len < MAVLINK_MSG_ID_OT_LINK_INFO_LEN? msg->len : MAVLINK_MSG_ID_OT_LINK_INFO_LEN;
        memset(ot_link_info, 0, MAVLINK_MSG_ID_OT_LINK_INFO_LEN);
    memcpy(ot_link_info, _MAV_PAYLOAD(msg), len);
#endif
}
