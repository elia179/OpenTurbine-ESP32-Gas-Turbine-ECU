#pragma once
// MESSAGE OT_CHANNEL_INFO PACKING

#include <stdint.h>

#define MAVLINK_MSG_ID_OT_CHANNEL_INFO 520101


typedef struct __mavlink_ot_channel_info_t {
 uint32_t boot_id; /*<  ECU boot identity.*/
 uint32_t catalog_revision; /*<  Catalogue revision.*/
 float display_min; /*<  Display range minimum, NaN if unspecified.*/
 float display_max; /*<  Display range maximum, NaN if unspecified.*/
 float warning; /*<  Warning reference, NaN if unspecified.*/
 float limit; /*<  Limit reference, NaN if unspecified.*/
 uint16_t channel_id; /*<  Stable signal ID.*/
 uint16_t index; /*<  Catalogue entry index.*/
 uint16_t flags; /*<  Signal kind and display flags.*/
 char key[24]; /*<  Configuration/protocol channel key.*/
 char name[32]; /*<  User-visible channel name.*/
 char unit[8]; /*<  Canonical unit, independent of browser preferences.*/
} mavlink_ot_channel_info_t;

#define MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN 94
#define MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN 94
#define MAVLINK_MSG_ID_520101_LEN 94
#define MAVLINK_MSG_ID_520101_MIN_LEN 94

#define MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC 183
#define MAVLINK_MSG_ID_520101_CRC 183

#define MAVLINK_MSG_OT_CHANNEL_INFO_FIELD_KEY_LEN 24
#define MAVLINK_MSG_OT_CHANNEL_INFO_FIELD_NAME_LEN 32
#define MAVLINK_MSG_OT_CHANNEL_INFO_FIELD_UNIT_LEN 8

#if MAVLINK_COMMAND_24BIT
#define MAVLINK_MESSAGE_INFO_OT_CHANNEL_INFO { \
    520101, \
    "OT_CHANNEL_INFO", \
    12, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_channel_info_t, boot_id) }, \
         { "catalog_revision", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_channel_info_t, catalog_revision) }, \
         { "display_min", NULL, MAVLINK_TYPE_FLOAT, 0, 8, offsetof(mavlink_ot_channel_info_t, display_min) }, \
         { "display_max", NULL, MAVLINK_TYPE_FLOAT, 0, 12, offsetof(mavlink_ot_channel_info_t, display_max) }, \
         { "warning", NULL, MAVLINK_TYPE_FLOAT, 0, 16, offsetof(mavlink_ot_channel_info_t, warning) }, \
         { "limit", NULL, MAVLINK_TYPE_FLOAT, 0, 20, offsetof(mavlink_ot_channel_info_t, limit) }, \
         { "channel_id", NULL, MAVLINK_TYPE_UINT16_T, 0, 24, offsetof(mavlink_ot_channel_info_t, channel_id) }, \
         { "index", NULL, MAVLINK_TYPE_UINT16_T, 0, 26, offsetof(mavlink_ot_channel_info_t, index) }, \
         { "flags", NULL, MAVLINK_TYPE_UINT16_T, 0, 28, offsetof(mavlink_ot_channel_info_t, flags) }, \
         { "key", NULL, MAVLINK_TYPE_CHAR, 24, 30, offsetof(mavlink_ot_channel_info_t, key) }, \
         { "name", NULL, MAVLINK_TYPE_CHAR, 32, 54, offsetof(mavlink_ot_channel_info_t, name) }, \
         { "unit", NULL, MAVLINK_TYPE_CHAR, 8, 86, offsetof(mavlink_ot_channel_info_t, unit) }, \
         } \
}
#else
#define MAVLINK_MESSAGE_INFO_OT_CHANNEL_INFO { \
    "OT_CHANNEL_INFO", \
    12, \
    {  { "boot_id", NULL, MAVLINK_TYPE_UINT32_T, 0, 0, offsetof(mavlink_ot_channel_info_t, boot_id) }, \
         { "catalog_revision", NULL, MAVLINK_TYPE_UINT32_T, 0, 4, offsetof(mavlink_ot_channel_info_t, catalog_revision) }, \
         { "display_min", NULL, MAVLINK_TYPE_FLOAT, 0, 8, offsetof(mavlink_ot_channel_info_t, display_min) }, \
         { "display_max", NULL, MAVLINK_TYPE_FLOAT, 0, 12, offsetof(mavlink_ot_channel_info_t, display_max) }, \
         { "warning", NULL, MAVLINK_TYPE_FLOAT, 0, 16, offsetof(mavlink_ot_channel_info_t, warning) }, \
         { "limit", NULL, MAVLINK_TYPE_FLOAT, 0, 20, offsetof(mavlink_ot_channel_info_t, limit) }, \
         { "channel_id", NULL, MAVLINK_TYPE_UINT16_T, 0, 24, offsetof(mavlink_ot_channel_info_t, channel_id) }, \
         { "index", NULL, MAVLINK_TYPE_UINT16_T, 0, 26, offsetof(mavlink_ot_channel_info_t, index) }, \
         { "flags", NULL, MAVLINK_TYPE_UINT16_T, 0, 28, offsetof(mavlink_ot_channel_info_t, flags) }, \
         { "key", NULL, MAVLINK_TYPE_CHAR, 24, 30, offsetof(mavlink_ot_channel_info_t, key) }, \
         { "name", NULL, MAVLINK_TYPE_CHAR, 32, 54, offsetof(mavlink_ot_channel_info_t, name) }, \
         { "unit", NULL, MAVLINK_TYPE_CHAR, 8, 86, offsetof(mavlink_ot_channel_info_t, unit) }, \
         } \
}
#endif

/**
 * @brief Pack a ot_channel_info message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param display_min  Display range minimum, NaN if unspecified.
 * @param display_max  Display range maximum, NaN if unspecified.
 * @param warning  Warning reference, NaN if unspecified.
 * @param limit  Limit reference, NaN if unspecified.
 * @param channel_id  Stable signal ID.
 * @param index  Catalogue entry index.
 * @param flags  Signal kind and display flags.
 * @param key  Configuration/protocol channel key.
 * @param name  User-visible channel name.
 * @param unit  Canonical unit, independent of browser preferences.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_channel_info_pack(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t catalog_revision, float display_min, float display_max, float warning, float limit, uint16_t channel_id, uint16_t index, uint16_t flags, const char *key, const char *name, const char *unit)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_float(buf, 8, display_min);
    _mav_put_float(buf, 12, display_max);
    _mav_put_float(buf, 16, warning);
    _mav_put_float(buf, 20, limit);
    _mav_put_uint16_t(buf, 24, channel_id);
    _mav_put_uint16_t(buf, 26, index);
    _mav_put_uint16_t(buf, 28, flags);
    _mav_put_char_array(buf, 30, key, 24);
    _mav_put_char_array(buf, 54, name, 32);
    _mav_put_char_array(buf, 86, unit, 8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN);
#else
    mavlink_ot_channel_info_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.display_min = display_min;
    packet.display_max = display_max;
    packet.warning = warning;
    packet.limit = limit;
    packet.channel_id = channel_id;
    packet.index = index;
    packet.flags = flags;
    mav_array_memcpy(packet.key, key, sizeof(char)*24);
    mav_array_memcpy(packet.name, name, sizeof(char)*32);
    mav_array_memcpy(packet.unit, unit, sizeof(char)*8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CHANNEL_INFO;
    return mavlink_finalize_message(msg, system_id, component_id, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC);
}

/**
 * @brief Pack a ot_channel_info message
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param display_min  Display range minimum, NaN if unspecified.
 * @param display_max  Display range maximum, NaN if unspecified.
 * @param warning  Warning reference, NaN if unspecified.
 * @param limit  Limit reference, NaN if unspecified.
 * @param channel_id  Stable signal ID.
 * @param index  Catalogue entry index.
 * @param flags  Signal kind and display flags.
 * @param key  Configuration/protocol channel key.
 * @param name  User-visible channel name.
 * @param unit  Canonical unit, independent of browser preferences.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_channel_info_pack_status(uint8_t system_id, uint8_t component_id, mavlink_status_t *_status, mavlink_message_t* msg,
                               uint32_t boot_id, uint32_t catalog_revision, float display_min, float display_max, float warning, float limit, uint16_t channel_id, uint16_t index, uint16_t flags, const char *key, const char *name, const char *unit)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_float(buf, 8, display_min);
    _mav_put_float(buf, 12, display_max);
    _mav_put_float(buf, 16, warning);
    _mav_put_float(buf, 20, limit);
    _mav_put_uint16_t(buf, 24, channel_id);
    _mav_put_uint16_t(buf, 26, index);
    _mav_put_uint16_t(buf, 28, flags);
    _mav_put_char_array(buf, 30, key, 24);
    _mav_put_char_array(buf, 54, name, 32);
    _mav_put_char_array(buf, 86, unit, 8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN);
#else
    mavlink_ot_channel_info_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.display_min = display_min;
    packet.display_max = display_max;
    packet.warning = warning;
    packet.limit = limit;
    packet.channel_id = channel_id;
    packet.index = index;
    packet.flags = flags;
    mav_array_memcpy(packet.key, key, sizeof(char)*24);
    mav_array_memcpy(packet.name, name, sizeof(char)*32);
    mav_array_memcpy(packet.unit, unit, sizeof(char)*8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CHANNEL_INFO;
#if MAVLINK_CRC_EXTRA
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC);
#else
    return mavlink_finalize_message_buffer(msg, system_id, component_id, _status, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN);
#endif
}

/**
 * @brief Pack a ot_channel_info message on a channel
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param display_min  Display range minimum, NaN if unspecified.
 * @param display_max  Display range maximum, NaN if unspecified.
 * @param warning  Warning reference, NaN if unspecified.
 * @param limit  Limit reference, NaN if unspecified.
 * @param channel_id  Stable signal ID.
 * @param index  Catalogue entry index.
 * @param flags  Signal kind and display flags.
 * @param key  Configuration/protocol channel key.
 * @param name  User-visible channel name.
 * @param unit  Canonical unit, independent of browser preferences.
 * @return length of the message in bytes (excluding serial stream start sign)
 */
static inline uint16_t mavlink_msg_ot_channel_info_pack_chan(uint8_t system_id, uint8_t component_id, uint8_t chan,
                               mavlink_message_t* msg,
                                   uint32_t boot_id,uint32_t catalog_revision,float display_min,float display_max,float warning,float limit,uint16_t channel_id,uint16_t index,uint16_t flags,const char *key,const char *name,const char *unit)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_float(buf, 8, display_min);
    _mav_put_float(buf, 12, display_max);
    _mav_put_float(buf, 16, warning);
    _mav_put_float(buf, 20, limit);
    _mav_put_uint16_t(buf, 24, channel_id);
    _mav_put_uint16_t(buf, 26, index);
    _mav_put_uint16_t(buf, 28, flags);
    _mav_put_char_array(buf, 30, key, 24);
    _mav_put_char_array(buf, 54, name, 32);
    _mav_put_char_array(buf, 86, unit, 8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), buf, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN);
#else
    mavlink_ot_channel_info_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.display_min = display_min;
    packet.display_max = display_max;
    packet.warning = warning;
    packet.limit = limit;
    packet.channel_id = channel_id;
    packet.index = index;
    packet.flags = flags;
    mav_array_memcpy(packet.key, key, sizeof(char)*24);
    mav_array_memcpy(packet.name, name, sizeof(char)*32);
    mav_array_memcpy(packet.unit, unit, sizeof(char)*8);
        memcpy(_MAV_PAYLOAD_NON_CONST(msg), &packet, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN);
#endif

    msg->msgid = MAVLINK_MSG_ID_OT_CHANNEL_INFO;
    return mavlink_finalize_message_chan(msg, system_id, component_id, chan, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC);
}

/**
 * @brief Encode a ot_channel_info struct
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param msg The MAVLink message to compress the data into
 * @param ot_channel_info C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_channel_info_encode(uint8_t system_id, uint8_t component_id, mavlink_message_t* msg, const mavlink_ot_channel_info_t* ot_channel_info)
{
    return mavlink_msg_ot_channel_info_pack(system_id, component_id, msg, ot_channel_info->boot_id, ot_channel_info->catalog_revision, ot_channel_info->display_min, ot_channel_info->display_max, ot_channel_info->warning, ot_channel_info->limit, ot_channel_info->channel_id, ot_channel_info->index, ot_channel_info->flags, ot_channel_info->key, ot_channel_info->name, ot_channel_info->unit);
}

/**
 * @brief Encode a ot_channel_info struct on a channel
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param chan The MAVLink channel this message will be sent over
 * @param msg The MAVLink message to compress the data into
 * @param ot_channel_info C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_channel_info_encode_chan(uint8_t system_id, uint8_t component_id, uint8_t chan, mavlink_message_t* msg, const mavlink_ot_channel_info_t* ot_channel_info)
{
    return mavlink_msg_ot_channel_info_pack_chan(system_id, component_id, chan, msg, ot_channel_info->boot_id, ot_channel_info->catalog_revision, ot_channel_info->display_min, ot_channel_info->display_max, ot_channel_info->warning, ot_channel_info->limit, ot_channel_info->channel_id, ot_channel_info->index, ot_channel_info->flags, ot_channel_info->key, ot_channel_info->name, ot_channel_info->unit);
}

/**
 * @brief Encode a ot_channel_info struct with provided status structure
 *
 * @param system_id ID of this system
 * @param component_id ID of this component (e.g. 200 for IMU)
 * @param status MAVLink status structure
 * @param msg The MAVLink message to compress the data into
 * @param ot_channel_info C-struct to read the message contents from
 */
static inline uint16_t mavlink_msg_ot_channel_info_encode_status(uint8_t system_id, uint8_t component_id, mavlink_status_t* _status, mavlink_message_t* msg, const mavlink_ot_channel_info_t* ot_channel_info)
{
    return mavlink_msg_ot_channel_info_pack_status(system_id, component_id, _status, msg,  ot_channel_info->boot_id, ot_channel_info->catalog_revision, ot_channel_info->display_min, ot_channel_info->display_max, ot_channel_info->warning, ot_channel_info->limit, ot_channel_info->channel_id, ot_channel_info->index, ot_channel_info->flags, ot_channel_info->key, ot_channel_info->name, ot_channel_info->unit);
}

/**
 * @brief Send a ot_channel_info message
 * @param chan MAVLink channel to send the message
 *
 * @param boot_id  ECU boot identity.
 * @param catalog_revision  Catalogue revision.
 * @param display_min  Display range minimum, NaN if unspecified.
 * @param display_max  Display range maximum, NaN if unspecified.
 * @param warning  Warning reference, NaN if unspecified.
 * @param limit  Limit reference, NaN if unspecified.
 * @param channel_id  Stable signal ID.
 * @param index  Catalogue entry index.
 * @param flags  Signal kind and display flags.
 * @param key  Configuration/protocol channel key.
 * @param name  User-visible channel name.
 * @param unit  Canonical unit, independent of browser preferences.
 */
#ifdef MAVLINK_USE_CONVENIENCE_FUNCTIONS

static inline void mavlink_msg_ot_channel_info_send(mavlink_channel_t chan, uint32_t boot_id, uint32_t catalog_revision, float display_min, float display_max, float warning, float limit, uint16_t channel_id, uint16_t index, uint16_t flags, const char *key, const char *name, const char *unit)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char buf[MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN];
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_float(buf, 8, display_min);
    _mav_put_float(buf, 12, display_max);
    _mav_put_float(buf, 16, warning);
    _mav_put_float(buf, 20, limit);
    _mav_put_uint16_t(buf, 24, channel_id);
    _mav_put_uint16_t(buf, 26, index);
    _mav_put_uint16_t(buf, 28, flags);
    _mav_put_char_array(buf, 30, key, 24);
    _mav_put_char_array(buf, 54, name, 32);
    _mav_put_char_array(buf, 86, unit, 8);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_INFO, buf, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC);
#else
    mavlink_ot_channel_info_t packet;
    packet.boot_id = boot_id;
    packet.catalog_revision = catalog_revision;
    packet.display_min = display_min;
    packet.display_max = display_max;
    packet.warning = warning;
    packet.limit = limit;
    packet.channel_id = channel_id;
    packet.index = index;
    packet.flags = flags;
    mav_array_memcpy(packet.key, key, sizeof(char)*24);
    mav_array_memcpy(packet.name, name, sizeof(char)*32);
    mav_array_memcpy(packet.unit, unit, sizeof(char)*8);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_INFO, (const char *)&packet, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC);
#endif
}

/**
 * @brief Send a ot_channel_info message
 * @param chan MAVLink channel to send the message
 * @param struct The MAVLink struct to serialize
 */
static inline void mavlink_msg_ot_channel_info_send_struct(mavlink_channel_t chan, const mavlink_ot_channel_info_t* ot_channel_info)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    mavlink_msg_ot_channel_info_send(chan, ot_channel_info->boot_id, ot_channel_info->catalog_revision, ot_channel_info->display_min, ot_channel_info->display_max, ot_channel_info->warning, ot_channel_info->limit, ot_channel_info->channel_id, ot_channel_info->index, ot_channel_info->flags, ot_channel_info->key, ot_channel_info->name, ot_channel_info->unit);
#else
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_INFO, (const char *)ot_channel_info, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC);
#endif
}

#if MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN <= MAVLINK_MAX_PAYLOAD_LEN
/*
  This variant of _send() can be used to save stack space by reusing
  memory from the receive buffer.  The caller provides a
  mavlink_message_t which is the size of a full mavlink message. This
  is usually the receive buffer for the channel, and allows a reply to an
  incoming message with minimum stack space usage.
 */
static inline void mavlink_msg_ot_channel_info_send_buf(mavlink_message_t *msgbuf, mavlink_channel_t chan,  uint32_t boot_id, uint32_t catalog_revision, float display_min, float display_max, float warning, float limit, uint16_t channel_id, uint16_t index, uint16_t flags, const char *key, const char *name, const char *unit)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    char *buf = (char *)msgbuf;
    _mav_put_uint32_t(buf, 0, boot_id);
    _mav_put_uint32_t(buf, 4, catalog_revision);
    _mav_put_float(buf, 8, display_min);
    _mav_put_float(buf, 12, display_max);
    _mav_put_float(buf, 16, warning);
    _mav_put_float(buf, 20, limit);
    _mav_put_uint16_t(buf, 24, channel_id);
    _mav_put_uint16_t(buf, 26, index);
    _mav_put_uint16_t(buf, 28, flags);
    _mav_put_char_array(buf, 30, key, 24);
    _mav_put_char_array(buf, 54, name, 32);
    _mav_put_char_array(buf, 86, unit, 8);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_INFO, buf, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC);
#else
    mavlink_ot_channel_info_t *packet = (mavlink_ot_channel_info_t *)msgbuf;
    packet->boot_id = boot_id;
    packet->catalog_revision = catalog_revision;
    packet->display_min = display_min;
    packet->display_max = display_max;
    packet->warning = warning;
    packet->limit = limit;
    packet->channel_id = channel_id;
    packet->index = index;
    packet->flags = flags;
    mav_array_memcpy(packet->key, key, sizeof(char)*24);
    mav_array_memcpy(packet->name, name, sizeof(char)*32);
    mav_array_memcpy(packet->unit, unit, sizeof(char)*8);
    _mav_finalize_message_chan_send(chan, MAVLINK_MSG_ID_OT_CHANNEL_INFO, (const char *)packet, MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN, MAVLINK_MSG_ID_OT_CHANNEL_INFO_CRC);
#endif
}
#endif

#endif

// MESSAGE OT_CHANNEL_INFO UNPACKING


/**
 * @brief Get field boot_id from ot_channel_info message
 *
 * @return  ECU boot identity.
 */
static inline uint32_t mavlink_msg_ot_channel_info_get_boot_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  0);
}

/**
 * @brief Get field catalog_revision from ot_channel_info message
 *
 * @return  Catalogue revision.
 */
static inline uint32_t mavlink_msg_ot_channel_info_get_catalog_revision(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint32_t(msg,  4);
}

/**
 * @brief Get field display_min from ot_channel_info message
 *
 * @return  Display range minimum, NaN if unspecified.
 */
static inline float mavlink_msg_ot_channel_info_get_display_min(const mavlink_message_t* msg)
{
    return _MAV_RETURN_float(msg,  8);
}

/**
 * @brief Get field display_max from ot_channel_info message
 *
 * @return  Display range maximum, NaN if unspecified.
 */
static inline float mavlink_msg_ot_channel_info_get_display_max(const mavlink_message_t* msg)
{
    return _MAV_RETURN_float(msg,  12);
}

/**
 * @brief Get field warning from ot_channel_info message
 *
 * @return  Warning reference, NaN if unspecified.
 */
static inline float mavlink_msg_ot_channel_info_get_warning(const mavlink_message_t* msg)
{
    return _MAV_RETURN_float(msg,  16);
}

/**
 * @brief Get field limit from ot_channel_info message
 *
 * @return  Limit reference, NaN if unspecified.
 */
static inline float mavlink_msg_ot_channel_info_get_limit(const mavlink_message_t* msg)
{
    return _MAV_RETURN_float(msg,  20);
}

/**
 * @brief Get field channel_id from ot_channel_info message
 *
 * @return  Stable signal ID.
 */
static inline uint16_t mavlink_msg_ot_channel_info_get_channel_id(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint16_t(msg,  24);
}

/**
 * @brief Get field index from ot_channel_info message
 *
 * @return  Catalogue entry index.
 */
static inline uint16_t mavlink_msg_ot_channel_info_get_index(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint16_t(msg,  26);
}

/**
 * @brief Get field flags from ot_channel_info message
 *
 * @return  Signal kind and display flags.
 */
static inline uint16_t mavlink_msg_ot_channel_info_get_flags(const mavlink_message_t* msg)
{
    return _MAV_RETURN_uint16_t(msg,  28);
}

/**
 * @brief Get field key from ot_channel_info message
 *
 * @return  Configuration/protocol channel key.
 */
static inline uint16_t mavlink_msg_ot_channel_info_get_key(const mavlink_message_t* msg, char *key)
{
    return _MAV_RETURN_char_array(msg, key, 24,  30);
}

/**
 * @brief Get field name from ot_channel_info message
 *
 * @return  User-visible channel name.
 */
static inline uint16_t mavlink_msg_ot_channel_info_get_name(const mavlink_message_t* msg, char *name)
{
    return _MAV_RETURN_char_array(msg, name, 32,  54);
}

/**
 * @brief Get field unit from ot_channel_info message
 *
 * @return  Canonical unit, independent of browser preferences.
 */
static inline uint16_t mavlink_msg_ot_channel_info_get_unit(const mavlink_message_t* msg, char *unit)
{
    return _MAV_RETURN_char_array(msg, unit, 8,  86);
}

/**
 * @brief Decode a ot_channel_info message into a struct
 *
 * @param msg The message to decode
 * @param ot_channel_info C-struct to decode the message contents into
 */
static inline void mavlink_msg_ot_channel_info_decode(const mavlink_message_t* msg, mavlink_ot_channel_info_t* ot_channel_info)
{
#if MAVLINK_NEED_BYTE_SWAP || !MAVLINK_ALIGNED_FIELDS
    ot_channel_info->boot_id = mavlink_msg_ot_channel_info_get_boot_id(msg);
    ot_channel_info->catalog_revision = mavlink_msg_ot_channel_info_get_catalog_revision(msg);
    ot_channel_info->display_min = mavlink_msg_ot_channel_info_get_display_min(msg);
    ot_channel_info->display_max = mavlink_msg_ot_channel_info_get_display_max(msg);
    ot_channel_info->warning = mavlink_msg_ot_channel_info_get_warning(msg);
    ot_channel_info->limit = mavlink_msg_ot_channel_info_get_limit(msg);
    ot_channel_info->channel_id = mavlink_msg_ot_channel_info_get_channel_id(msg);
    ot_channel_info->index = mavlink_msg_ot_channel_info_get_index(msg);
    ot_channel_info->flags = mavlink_msg_ot_channel_info_get_flags(msg);
    mavlink_msg_ot_channel_info_get_key(msg, ot_channel_info->key);
    mavlink_msg_ot_channel_info_get_name(msg, ot_channel_info->name);
    mavlink_msg_ot_channel_info_get_unit(msg, ot_channel_info->unit);
#else
        uint8_t len = msg->len < MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN? msg->len : MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN;
        memset(ot_channel_info, 0, MAVLINK_MSG_ID_OT_CHANNEL_INFO_LEN);
    memcpy(ot_channel_info, _MAV_PAYLOAD(msg), len);
#endif
}
