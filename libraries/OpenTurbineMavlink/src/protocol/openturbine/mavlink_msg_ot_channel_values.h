#pragma once
// MESSAGE OT_CHANNEL_VALUES PACKING

#include <stdint.h>

#define MAVLINK_MSG_ID_OT_CHANNEL_VALUES 520102


typedef struct __mavlink_ot_channel_values_t {
 uint32_t boot_id; /*<  ECU boot identity.*/
 uint32_t catalog_revision; /*<  Catalogue revision.*/
 uint32_t time_boot_ms; /*< [ms] Sample timestamp.*/
 float values[8]; /*<  Values in each channel's canonical units.*/
 uint16_t channel_ids[8]; /*<  Stable signal IDs.*/
 uint8_t flags[8]; /*<  Per-sample validity flags.*/
 uint8_t count; /*<  Number of populated samples, 0 through 8.*/
} mavlink_ot_channel_values_t;

#define MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN 69
#define MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN 69
#define MAVLINK_MSG_ID_520102_LEN 69
#define MAVLINK_MSG_ID_520102_MIN_LEN 69

#define MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC 42
#define MAVLINK_MSG_ID_520102_CRC 42

#define MAVLINK_MSG_OT_CHANNEL_VALUES_FIELD_VALUES_LEN 8
#define MAVLINK_MSG_OT_CHANNEL_VALUES_FIELD_CHANNEL_IDS_LEN 8
#define MAVLINK_MSG_OT_CHANNEL_VALUES_FIELD_FLAGS_LEN 8

#if MAVLINK_COMMAND_24BIT
#define MAVLINK_MESSAGE_INFO_OT_CHANNEL_VALUES { \
    520102, \
    "OT_CHANNEL_VALUES", \
    7, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_channel_values_t, boot_id) }, \
         { "catalog_revision", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_channel_values_t, catalog_revision) }, \
         { "time_boot_ms", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_channel_values_t, time_boot_ms) }, \
         { "values", NULL, MAVLINK_TYPE_FLOAT, 8, 12, offsetof(mavlink_ot_channel_values_t, values) }, \
         { "channel_ids", NULL, MAVLINK_TYPE_UINT16_T, 8, 44, offsetof(mavlink_ot_channel_values_t, channel_ids) }, \
         { "flags", NULL, MAVLINK_TYPE_UINT8_T, 8, 60, offsetof(mavlink_ot_channel_values_t, flags) }, \
         { "count", NULL, MAVLINK_TYPE_UINT8_T, 0, 68, offsetof(mavlink_ot_channel_values_t, count) }, \
         } \
}
#else
#define MAVLINK_MESSAGE_INFO_OT_CHANNEL_VALUES { \
    "OT_CHANNEL_VALUES", \
    7, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_channel_values_t, boot_id) }, \
         { "catalog_revision", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_channel_values_t, catalog_revision) }, \
         { "time_boot_ms", NULL, MAVLINK_TYPE_UINT32_T, 0, 8, offsetof(mavlink_ot_channel_values_t, time_boot_ms) }, \
         { "values", NULL, MAVLINK_TYPE_FLOAT, 8, 12, offsetof(mavlink_ot_channel_values_t, values) }, \
         { "channel_ids", NULL, MAVLINK_TYPE_UINT16_T, 8, 44, offsetof(mavlink_ot_channel_values_t, channel_ids) }, \
         { "flags", NULL, MAVLINK_TYPE_UINT8_T, 8, 60, offsetof(mavlink_ot_channel_values_t, flags) }, \
         { "count", NULL, MAVLINK_TYPE_UINT8_T, 0, 68, offsetof(mavlink_ot_channel_values_t, count) }, \
         } \
}
#endif

/**
 * @brief Pack a ot_channel_values message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param time_boot_ms [ms] Sample timestamp.
 * @param values  Values in each channel's canonical units.
 * @param channel_ids  Stable signal IDs.
 * @param flags  Per-sample validity flags.
 * @param count  Number of populated samples, 0 through 8.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_channel_values_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t catalog_revision, uint32_t time_boot_ms, const float *values, const uint16_t *channel_ids, const uint8_t *flags, uint8_t count)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, time_boot_ms);
    _mav_put_uint8_t(buf, 68, count);
    _mav_put_float_array(buf, 12, values, 8);
    _mav_put_uint16_t_array(buf, 44, channel_ids, 8);
    _mav_put_uint8_t_array(buf, 60, flags, 8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN);
#else
    mavlink_ot_channel_values_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.time_boot_ms = time_boot_ms;
    packet.count = count;
    mav_array_memcpy(packet.values, values, sizeof(float)*8);
    mav_array_memcpy(packet.channel_ids, channel_ids, sizeof(uint16_t)*8);
    mav_array_memcpy(packet.flags, flags, sizeof(uint8_t)*8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CHANNEL_VALUES;
    return mavlink_finalize_message(msg, system_id, component_id, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC);
}

/**
 * @brief Pack a ot_channel_values message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param time_boot_ms [ms] Sample timestamp.
 * @param values  Values in each channel's canonical units.
 * @param channel_ids  Stable signal IDs.
 * @param flags  Per-sample validity flags.
 * @param count  Number of populated samples, 0 through 8.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_channel_values_pack_status(uint8_t system_id, uint8_t component_id, mavlink_status_t *_status, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t catalog_revision, uint32_t time_boot_ms, const float *values, const uint16_t *channel_ids, const uint8_t *flags, uint8_t count)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, time_boot_ms);
    _mav_put_uint8_t(buf, 68, count);
    _mav_put_float_array(buf, 12, values, 8);
    _mav_put_uint16_t_array(buf, 44, channel_ids, 8);
    _mav_put_uint8_t_array(buf, 60, flags, 8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN);
#else
    mavlink_ot_channel_values_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.time_boot_ms = time_boot_ms;
    packet.count = count;
    mav_array_memcpy(packet.values, values, sizeof(float)*8);
    mav_array_memcpy(packet.channel_ids, channel_ids, sizeof(uint16_t)*8);
    mav_array_memcpy(packet.flags, flags, sizeof(uint8_t)*8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CHANNEL_VALUES;
#if MAVLINK_CRC_EXTRA
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC);
#else
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN);
#endif
}

/**
 * @brief Pack a ot_channel_values message on a channel
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param time_boot_ms [ms] Sample timestamp.
 * @param values  Values in each channel's canonical units.
 * @param channel_ids  Stable signal IDs.
 * @param flags  Per-sample validity flags.
 * @param count  Number of populated samples, 0 through 8.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_channel_values_pack_chan(uint8_t system_id, uint8_t component_id, uint8_t chan,
                               mavlink_message_t* msg,
                                   uint32_t boot_id,uint32_t catalog_revision,uint32_t time_boot_ms,const float *values,const uint16_t *channel_ids,const uint8_t *flags,uint8_t count)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, time_boot_ms);
    _mav_put_uint8_t(buf, 68, count);
    _mav_put_float_array(buf, 12, values, 8);
    _mav_put_uint16_t_array(buf, 44, channel_ids, 8);
    _mav_put_uint8_t_array(buf, 60, flags, 8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN);
#else
    mavlink_ot_channel_values_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.time_boot_ms = time_boot_ms;
    packet.count = count;
    mav_array_memcpy(packet.values, values, sizeof(float)*8);
    mav_array_memcpy(packet.channel_ids, channel_ids, sizeof(uint16_t)*8);
    mav_array_memcpy(packet.flags, flags, sizeof(uint8_t)*8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CHANNEL_VALUES;
    return mavlink_finalize_message_chan(msg, system_id, component_id, chan, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC);
}

/**
 * @brief Encode a ot_channel_values struct
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 * @param ot_channel_values C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_channel_values_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_ot_channel_values_t* ot_channel_values)
{
    return mavlink_msg_ot_channel_values_pack(system_id, component_id, msg, ot_channel_values->boot_id, ot_channel_values->catalog_revision, ot_channel_values->time_boot_ms, ot_channel_values->values, ot_channel_values->channel_ids, ot_channel_values->flags, ot_channel_values->count);
}

/**
 * @brief Encode a ot_channel_values struct on a channel
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param ot_channel_values C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_channel_values_encode_chan(uint8_t system_id, uint8_t component_id, uint8_t chan, mavlink_message_t* msg, const mavlink_ot_channel_values_t* ot_channel_values)
{
    return mavlink_msg_ot_channel_values_pack_chan(system_id, component_id, chan, msg, ot_channel_values->boot_id, ot_channel_values->catalog_revision, ot_channel_values->time_boot_ms, ot_channel_values->values, ot_channel_values->channel_ids, ot_channel_values->flags, ot_channel_values->count);
}

/**
 * @brief Encode a ot_channel_values struct with provided status structure
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 * @param ot_channel_values C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_channel_values_encode_status(uint8_t system_id, uint8_t component_id, mavlink_status_t* _status, mavlink_message_t* msg, const mavlink_ot_channel_values_t* ot_channel_values)
{
    return mavlink_msg_ot_channel_values_pack_status(system_id, component_id, _status, msg,  ot_channel_values->boot_id, ot_channel_values->catalog_revision, ot_channel_values->time_boot_ms, ot_channel_values->values, ot_channel_values->channel_ids, ot_channel_values->flags, ot_channel_values->count);
}

/**
 * @brief Send a ot_channel_values message
 * @param chan MAVLink channel to send the message
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param time_boot_ms [ms] Sample timestamp.
 * @param values  Values in each channel's canonical units.
 * @param channel_ids  Stable signal IDs.
 * @param flags  Per-sample validity flags.
 * @param count  Number of populated samples, 0 through 8.
 */
#ifdef MAVLINK_USE_CONVENIENCE_FUNCTIONS

static inline void mavlink_msg_ot_channel_values_send(mavlink_channel_t chan, uint32_t boot_id, uint32_t catalog_revision, uint32_t time_boot_ms, const float *values, const uint16_t *channel_ids, const uint8_t *flags, uint8_t count)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, time_boot_ms);
    _mav_put_uint8_t(buf, 68, count);
    _mav_put_float_array(buf, 12, values, 8);
    _mav_put_uint16_t_array(buf, 44, channel_ids, 8);
    _mav_put_uint8_t_array(buf, 60, flags, 8);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_VALUES, buf, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC);
#else
    mavlink_ot_channel_values_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.time_boot_ms = time_boot_ms;
    packet.count = count;
    mav_array_memcpy(packet.values, values, sizeof(float)*8);
    mav_array_memcpy(packet.channel_ids, channel_ids, sizeof(uint16_t)*8);
    mav_array_memcpy(packet.flags, flags, sizeof(uint8_t)*8);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_VALUES, (const char *)&packet, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC);
#endif
}

/**
 * @brief Send a ot_channel_values message
 * @param chan MAVLink channel to send the message
 * @param struct The MAVLink struct to serialize
 */
static inline void mavlink_msg_ot_channel_values_send_struct(mavlink_channel_t chan, const mavlink_ot_channel_values_t* ot_channel_values)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    mavlink_msg_ot_channel_values_send(chan, ot_channel_values->boot_id, ot_channel_values->catalog_revision, ot_channel_values->time_boot_ms, ot_channel_values->values, ot_channel_values->channel_ids, ot_channel_values->flags, ot_channel_values->count);
#else
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_VALUES, (const char *)ot_channel_values, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC);
#endif
}

#if MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN <= MAVLINK_MAX_PAYLOAD_LEN
/*
  This variant of _send() can be used to save stack space by reusing
  memory from the receive buffer.  The caller provides a
  mavlink_message_t which is the size of a full mavlink message. This
  is usually the receive buffer for the channel, and allows a reply to an
  incoming message with minimum stack space usage.
 */
static inline void mavlink_msg_ot_channel_values_send_buf(mavlink_message_t *msgbuf, mavlink_channel_t chan,  uint32_t boot_id, uint32_t catalog_revision, uint32_t time_boot_ms, const float *values, const uint16_t *channel_ids, const uint8_t *flags, uint8_t count)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char *buf = (char *)msgbuf;
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_uint32_t(buf, 8, time_boot_ms);
    _mav_put_uint8_t(buf, 68, count);
    _mav_put_float_array(buf, 12, values, 8);
    _mav_put_uint16_t_array(buf, 44, channel_ids, 8);
    _mav_put_uint8_t_array(buf, 60, flags, 8);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_VALUES, buf, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC);
#else
    mavlink_ot_channel_values_t *packet = (mavlink_ot_channel_values_t *)msgbuf;
    packet->boot_id = boot_id;
    packet->catalog_revision = catalog_revision;
    packet->time_boot_ms = time_boot_ms;
    packet->count = count;
    mav_array_memcpy(packet->values, values, sizeof(float)*8);
    mav_array_memcpy(packet->channel_ids, channel_ids, sizeof(uint16_t)*8);
    mav_array_memcpy(packet->flags, flags, sizeof(uint8_t)*8);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_VALUES, (const char *)packet, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_CRC);
#endif
}
#endif

#endif

// MESSAGE OT_CHANNEL_VALUES UNPACKING


/**
 * @brief Get field boot_id from ot_channel_values message
 *
 * @return  ECU boot identity.
 */
static inline uint32_t mavlink_msg_ot_channel_values_get_boot_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  0);
}

/**
 * @brief Get field catalog_revision from ot_channel_values message
 *
 * @return  Catalogue revision.
 */
static inline uint32_t mavlink_msg_ot_channel_values_get_catalog_revision(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  4);
}

/**
 * @brief Get field time_boot_ms from ot_channel_values message
 *
 * @return [ms] Sample timestamp.
 */
static inline uint32_t mavlink_msg_ot_channel_values_get_time_boot_ms(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  8);
}

/**
 * @brief Get field values from ot_channel_values message
 *
 * @return  Values in each channel's canonical units.
 */
static inline uint16_t mavlink_msg_ot_channel_values_get_values(const mavlink_message_t* msg, float *values)
{
    return _MAV_RETURN_float_array(msg, values, 8,  12);
}

/**
 * @brief Get field channel_ids from ot_channel_values message
 *
 * @return  Stable signal IDs.
 */
static inline uint16_t mavlink_msg_ot_channel_values_get_channel_ids(const mavlink_message_t* msg, uint16_t *channel_ids)
{
    return _MAV_RETURN_uint16_t_array(msg, channel_ids, 8,  44);
}

/**
 * @brief Get field flags from ot_channel_values message
 *
 * @return  Per-sample validity flags.
 */
static inline uint16_t mavlink_msg_ot_channel_values_get_flags(const mavlink_message_t* msg, uint8_t *flags)
{
    return _MAV_RETURN_uint8_t_array(msg, flags, 8,  60);
}

/**
 * @brief Get field count from ot_channel_values message
 *
 * @return  Number of populated samples, 0 through 8.
 */
static inline uint8_t mavlink_msg_ot_channel_values_get_count(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint8_t(msg,  68);
}

/**
 * @brief Decode a ot_channel_values message into a struct
 *
 * @param msg The message to decode
 * @param ot_channel_values C-struct to decode the message contents into
 */
static inline void mavlink_msg_ot_channel_values_decode(const mavlink_message_t* msg, mavlink_ot_channel_values_t* ot_channel_values)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    ot_channel_values->boot_id = mavlink_msg_ot_channel_values_get_boot_id(msg);
    ot_channel_values->catalog_revision = mavlink_msg_ot_channel_values_get_catalog_revision(msg);
    ot_channel_values->time_boot_ms = mavlink_msg_ot_channel_values_get_time_boot_ms(msg);
    mavlink_msg_ot_channel_values_get_values(msg, ot_channel_values->values);
    mavlink_msg_ot_channel_values_get_channel_ids(msg, ot_channel_values->channel_ids);
    mavlink_msg_ot_channel_values_get_flags(msg, ot_channel_values->flags);
    ot_channel_values->count = mavlink_msg_ot_channel_values_get_count(msg);
#else
        uint8_t len = msg->len < MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN? msg->len : MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN;
        memset(ot_channel_values, 0, MAVLINK_MSG_ID_OT_CHANNEL_VALUES_LEN);
    memcpy(ot_channel_values, _MAV_PAYLOAD(msg), len);
#endif
}
