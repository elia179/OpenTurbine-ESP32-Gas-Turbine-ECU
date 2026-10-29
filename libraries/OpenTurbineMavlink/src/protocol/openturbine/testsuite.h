/** @file
 *    @brief MAVLink comm protocol testsuite generated from openturbine.xml
 *    @see https://mavlink.io/en/
 */
#pragma once
#ifndef OPENTURBINE_TESTSUITE_H
#define OPENTURBINE_TESTSUITE_H

#ifdef __cplusplus
extern "C" {
#endif

#ifndef MAVLINK_TEST_ALL
#define MAVLINK_TEST_ALL
static void mavlink_test_openturbine_standard(uint8_t, uint8_t, mavlink_message_t *last_msg);
static void mavlink_test_openturbine(uint8_t, uint8_t, mavlink_message_t *last_msg);

static void mavlink_test_all(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
    mavlink_test_openturbine_standard(system_id, component_id, last_msg);
    mavlink_test_openturbine(system_id, component_id, last_msg);
}
#endif

#include "../openturbine_standard/testsuite.h"


static void mavlink_test_ot_link_info(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
    mavlink_status_t *status = mavlink_get_channel_status(MAVLINK_COMM_0);
        if ((status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) && MAVLINK_MSG_ID_OT_LINK_INFO >= 256) {
            return;
        }
#endif
    mavlink_message_t msg;
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t i;
    mavlink_ot_link_info_t packet_in = {
        963497464,963497672,963497880,17859,17963,18067,"STUVWXYZABCDEFGHIJKLMNOPQRSTUVW"
    };
    mavlink_ot_link_info_t packet1, packet2;
        memset(&packet1, 0, sizeof(packet1));
        packet1.boot_id = packet_in.boot_id;
        packet1.catalog_revision = packet_in.catalog_revision;
        packet1.capabilities = packet_in.capabilities;
        packet1.channel_count = packet_in.channel_count;
        packet1.input_timeout_ms = packet_in.input_timeout_ms;
        packet1.telemetry_interval_ms = packet_in.telemetry_interval_ms;
        
        mav_array_memcpy(packet1.engine_name, packet_in.engine_name, sizeof(char)*32);
        
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
        if (status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) {
           // cope with extensions
           memset(MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN + (char *)&packet1, 0, sizeof(packet1)-MAVLINK_MSG_ID_OT_LINK_INFO_MIN_LEN);
        }
#endif
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_link_info_encode(system_id, component_id, &msg, &packet1);
    mavlink_msg_ot_link_info_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_link_info_pack(system_id, component_id, &msg , packet1.boot_id , packet1.catalog_revision , packet1.capabilities , packet1.channel_count , packet1.input_timeout_ms , packet1.telemetry_interval_ms , packet1.engine_name );
    mavlink_msg_ot_link_info_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_link_info_pack_chan(system_id, component_id, MAVLINK_COMM_0, &msg , packet1.boot_id , packet1.catalog_revision , packet1.capabilities , packet1.channel_count , packet1.input_timeout_ms , packet1.telemetry_interval_ms , packet1.engine_name );
    mavlink_msg_ot_link_info_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
        mavlink_msg_to_send_buffer(buffer, &msg);
        for (i=0; i<mavlink_msg_get_send_buffer_length(&msg); i++) {
            comm_send_ch(MAVLINK_COMM_0, buffer[i]);
        }
    mavlink_msg_ot_link_info_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);
        
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_link_info_send(MAVLINK_COMM_1 , packet1.boot_id , packet1.catalog_revision , packet1.capabilities , packet1.channel_count , packet1.input_timeout_ms , packet1.telemetry_interval_ms , packet1.engine_name );
    mavlink_msg_ot_link_info_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

#ifdef MAVLINK_HAVE_GET_MESSAGE_INFO
    MAVLINK_ASSERT(mavlink_get_message_info_by_name("OT_LINK_INFO") != NULL);
    MAVLINK_ASSERT(mavlink_get_message_info_by_id(MAVLINK_MSG_ID_OT_LINK_INFO) != NULL);
#endif
}

static void mavlink_test_ot_channel_info(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
    mavlink_status_t *status = mavlink_get_channel_status(MAVLINK_COMM_0);
        if ((status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) && MAVLINK_MSG_ID_OT_CHANNEL_INFO >= 256) {
            return;
        }
#endif
    mavlink_message_t msg;
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t i;
    mavlink_ot_channel_info_t packet_in = {
        963497464,963497672,73.0,101.0,129.0,157.0,18483,18587,18691,"EFGHIJKLMNOPQRSTUVWXYZA","CDEFGHIJKLMNOPQRSTUVWXYZABCDEFG","IJKLMNO"
    };
    mavlink_ot_channel_info_t packet1, packet2;
        memset(&packet1, 0, sizeof(packet1));
        packet1.boot_id = packet_in.boot_id;
        packet1.catalog_revision = packet_in.catalog_revision;
        packet1.display_min = packet_in.display_min;
        packet1.display_max = packet_in.display_max;
        packet1.warning = packet_in.warning;
        packet1.limit = packet_in.limit;
        packet1.channel_id = packet_in.channel_id;
        packet1.index = packet_in.index;
        packet1.flags = packet_in.flags;
        
        mav_array_memcpy(packet1.key, packet_in.key, sizeof(char)*24);
        mav_array_memcpy(packet1.name, packet_in.name, sizeof(char)*32);
        mav_array_memcpy(packet1.unit, packet_in.unit, sizeof(char)*8);
        
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
        if (status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) {
           // cope with extensions
           memset(MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN + (char *)&packet1, 0, sizeof(packet1)-MAVLINK_MSG_ID_OT_CHANNEL_INFO_MIN_LEN);
        }
#endif
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_channel_info_encode(system_id, component_id, &msg, &packet1);
    mavlink_msg_ot_channel_info_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_channel_info_pack(system_id, component_id, &msg , packet1.boot_id , packet1.catalog_revision , packet1.display_min , packet1.display_max , packet1.warning , packet1.limit , packet1.channel_id , packet1.index , packet1.flags , packet1.key , packet1.name , packet1.unit );
    mavlink_msg_ot_channel_info_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_channel_info_pack_chan(system_id, component_id, MAVLINK_COMM_0, &msg , packet1.boot_id , packet1.catalog_revision , packet1.display_min , packet1.display_max , packet1.warning , packet1.limit , packet1.channel_id , packet1.index , packet1.flags , packet1.key , packet1.name , packet1.unit );
    mavlink_msg_ot_channel_info_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
        mavlink_msg_to_send_buffer(buffer, &msg);
        for (i=0; i<mavlink_msg_get_send_buffer_length(&msg); i++) {
            comm_send_ch(MAVLINK_COMM_0, buffer[i]);
        }
    mavlink_msg_ot_channel_info_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);
        
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_channel_info_send(MAVLINK_COMM_1 , packet1.boot_id , packet1.catalog_revision , packet1.display_min , packet1.display_max , packet1.warning , packet1.limit , packet1.channel_id , packet1.index , packet1.flags , packet1.key , packet1.name , packet1.unit );
    mavlink_msg_ot_channel_info_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

#ifdef MAVLINK_HAVE_GET_MESSAGE_INFO
    MAVLINK_ASSERT(mavlink_get_message_info_by_name("OT_CHANNEL_INFO") != NULL);
    MAVLINK_ASSERT(mavlink_get_message_info_by_id(MAVLINK_MSG_ID_OT_CHANNEL_INFO) != NULL);
#endif
}

static void mavlink_test_ot_channel_values(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
    mavlink_status_t *status = mavlink_get_channel_status(MAVLINK_COMM_0);
        if ((status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) && MAVLINK_MSG_ID_OT_CHANNEL_VALUES >= 256) {
            return;
        }
#endif
    mavlink_message_t msg;
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t i;
    mavlink_ot_channel_values_t packet_in = {
        963497464,963497672,963497880,{ 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0 },{ 19523, 19524, 19525, 19526, 19527, 19528, 19529, 19530 },{ 185, 186, 187, 188, 189, 190, 191, 192 },209
    };
    mavlink_ot_channel_values_t packet1, packet2;
        memset(&packet1, 0, sizeof(packet1));
        packet1.boot_id = packet_in.boot_id;
        packet1.catalog_revision = packet_in.catalog_revision;
        packet1.time_boot_ms = packet_in.time_boot_ms;
        packet1.count = packet_in.count;
        
        mav_array_memcpy(packet1.values, packet_in.values, sizeof(float)*8);
        mav_array_memcpy(packet1.channel_ids, packet_in.channel_ids, sizeof(uint16_t)*8);
        mav_array_memcpy(packet1.flags, packet_in.flags, sizeof(uint8_t)*8);
        
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
        if (status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) {
           // cope with extensions
           memset(MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN + (char *)&packet1, 0, sizeof(packet1)-MAVLINK_MSG_ID_OT_CHANNEL_VALUES_MIN_LEN);
        }
#endif
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_channel_values_encode(system_id, component_id, &msg, &packet1);
    mavlink_msg_ot_channel_values_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_channel_values_pack(system_id, component_id, &msg , packet1.boot_id , packet1.catalog_revision , packet1.time_boot_ms , packet1.values , packet1.channel_ids , packet1.flags , packet1.count );
    mavlink_msg_ot_channel_values_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_channel_values_pack_chan(system_id, component_id, MAVLINK_COMM_0, &msg , packet1.boot_id , packet1.catalog_revision , packet1.time_boot_ms , packet1.values , packet1.channel_ids , packet1.flags , packet1.count );
    mavlink_msg_ot_channel_values_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
        mavlink_msg_to_send_buffer(buffer, &msg);
        for (i=0; i<mavlink_msg_get_send_buffer_length(&msg); i++) {
            comm_send_ch(MAVLINK_COMM_0, buffer[i]);
        }
    mavlink_msg_ot_channel_values_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);
        
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_channel_values_send(MAVLINK_COMM_1 , packet1.boot_id , packet1.catalog_revision , packet1.time_boot_ms , packet1.values , packet1.channel_ids , packet1.flags , packet1.count );
    mavlink_msg_ot_channel_values_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

#ifdef MAVLINK_HAVE_GET_MESSAGE_INFO
    MAVLINK_ASSERT(mavlink_get_message_info_by_name("OT_CHANNEL_VALUES") != NULL);
    MAVLINK_ASSERT(mavlink_get_message_info_by_id(MAVLINK_MSG_ID_OT_CHANNEL_VALUES) != NULL);
#endif
}

static void mavlink_test_ot_engine_state(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
    mavlink_status_t *status = mavlink_get_channel_status(MAVLINK_COMM_0);
        if ((status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) && MAVLINK_MSG_ID_OT_ENGINE_STATE >= 256) {
            return;
        }
#endif
    mavlink_message_t msg;
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t i;
    mavlink_ot_engine_state_t packet_in = {
        963497464,963497672,963497880,963498088,129.0,157.0,77,144,211,22,"CDEFGHIJKLMNOPQRSTUVWXYZABCDEFG","IJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHI","KLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJK"
    };
    mavlink_ot_engine_state_t packet1, packet2;
        memset(&packet1, 0, sizeof(packet1));
        packet1.boot_id = packet_in.boot_id;
        packet1.time_boot_ms = packet_in.time_boot_ms;
        packet1.allowed_commands = packet_in.allowed_commands;
        packet1.flags = packet_in.flags;
        packet1.requested_throttle = packet_in.requested_throttle;
        packet1.fuel_demand = packet_in.fuel_demand;
        packet1.mode = packet_in.mode;
        packet1.ab_mode = packet_in.ab_mode;
        packet1.sequence_index = packet_in.sequence_index;
        packet1.sequence_count = packet_in.sequence_count;
        
        mav_array_memcpy(packet1.sequence_step, packet_in.sequence_step, sizeof(char)*32);
        mav_array_memcpy(packet1.fault, packet_in.fault, sizeof(char)*80);
        mav_array_memcpy(packet1.reason, packet_in.reason, sizeof(char)*80);
        
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
        if (status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) {
           // cope with extensions
           memset(MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN + (char *)&packet1, 0, sizeof(packet1)-MAVLINK_MSG_ID_OT_ENGINE_STATE_MIN_LEN);
        }
#endif
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_engine_state_encode(system_id, component_id, &msg, &packet1);
    mavlink_msg_ot_engine_state_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_engine_state_pack(system_id, component_id, &msg , packet1.boot_id , packet1.time_boot_ms , packet1.allowed_commands , packet1.flags , packet1.requested_throttle , packet1.fuel_demand , packet1.mode , packet1.ab_mode , packet1.sequence_index , packet1.sequence_count , packet1.sequence_step , packet1.fault , packet1.reason );
    mavlink_msg_ot_engine_state_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_engine_state_pack_chan(system_id, component_id, MAVLINK_COMM_0, &msg , packet1.boot_id , packet1.time_boot_ms , packet1.allowed_commands , packet1.flags , packet1.requested_throttle , packet1.fuel_demand , packet1.mode , packet1.ab_mode , packet1.sequence_index , packet1.sequence_count , packet1.sequence_step , packet1.fault , packet1.reason );
    mavlink_msg_ot_engine_state_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
        mavlink_msg_to_send_buffer(buffer, &msg);
        for (i=0; i<mavlink_msg_get_send_buffer_length(&msg); i++) {
            comm_send_ch(MAVLINK_COMM_0, buffer[i]);
        }
    mavlink_msg_ot_engine_state_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);
        
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_engine_state_send(MAVLINK_COMM_1 , packet1.boot_id , packet1.time_boot_ms , packet1.allowed_commands , packet1.flags , packet1.requested_throttle , packet1.fuel_demand , packet1.mode , packet1.ab_mode , packet1.sequence_index , packet1.sequence_count , packet1.sequence_step , packet1.fault , packet1.reason );
    mavlink_msg_ot_engine_state_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

#ifdef MAVLINK_HAVE_GET_MESSAGE_INFO
    MAVLINK_ASSERT(mavlink_get_message_info_by_name("OT_ENGINE_STATE") != NULL);
    MAVLINK_ASSERT(mavlink_get_message_info_by_id(MAVLINK_MSG_ID_OT_ENGINE_STATE) != NULL);
#endif
}

static void mavlink_test_ot_remote_input(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
    mavlink_status_t *status = mavlink_get_channel_status(MAVLINK_COMM_0);
        if ((status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) && MAVLINK_MSG_ID_OT_REMOTE_INPUT >= 256) {
            return;
        }
#endif
    mavlink_message_t msg;
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t i;
    mavlink_ot_remote_input_t packet_in = {
        963497464,963497672,963497880,963498088,129.0,18275,199,10
    };
    mavlink_ot_remote_input_t packet1, packet2;
        memset(&packet1, 0, sizeof(packet1));
        packet1.boot_id = packet_in.boot_id;
        packet1.time_boot_ms = packet_in.time_boot_ms;
        packet1.sender_session = packet_in.sender_session;
        packet1.sequence = packet_in.sequence;
        packet1.value = packet_in.value;
        packet1.input_id = packet_in.input_id;
        packet1.target_system = packet_in.target_system;
        packet1.target_component = packet_in.target_component;
        
        
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
        if (status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) {
           // cope with extensions
           memset(MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN + (char *)&packet1, 0, sizeof(packet1)-MAVLINK_MSG_ID_OT_REMOTE_INPUT_MIN_LEN);
        }
#endif
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_remote_input_encode(system_id, component_id, &msg, &packet1);
    mavlink_msg_ot_remote_input_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_remote_input_pack(system_id, component_id, &msg , packet1.boot_id , packet1.time_boot_ms , packet1.sender_session , packet1.sequence , packet1.value , packet1.input_id , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_remote_input_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_remote_input_pack_chan(system_id, component_id, MAVLINK_COMM_0, &msg , packet1.boot_id , packet1.time_boot_ms , packet1.sender_session , packet1.sequence , packet1.value , packet1.input_id , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_remote_input_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
        mavlink_msg_to_send_buffer(buffer, &msg);
        for (i=0; i<mavlink_msg_get_send_buffer_length(&msg); i++) {
            comm_send_ch(MAVLINK_COMM_0, buffer[i]);
        }
    mavlink_msg_ot_remote_input_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);
        
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_remote_input_send(MAVLINK_COMM_1 , packet1.boot_id , packet1.time_boot_ms , packet1.sender_session , packet1.sequence , packet1.value , packet1.input_id , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_remote_input_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

#ifdef MAVLINK_HAVE_GET_MESSAGE_INFO
    MAVLINK_ASSERT(mavlink_get_message_info_by_name("OT_REMOTE_INPUT") != NULL);
    MAVLINK_ASSERT(mavlink_get_message_info_by_id(MAVLINK_MSG_ID_OT_REMOTE_INPUT) != NULL);
#endif
}

static void mavlink_test_ot_catalog_request(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
    mavlink_status_t *status = mavlink_get_channel_status(MAVLINK_COMM_0);
        if ((status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) && MAVLINK_MSG_ID_OT_CATALOG_REQUEST >= 256) {
            return;
        }
#endif
    mavlink_message_t msg;
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t i;
    mavlink_ot_catalog_request_t packet_in = {
        963497464,17443,151,218
    };
    mavlink_ot_catalog_request_t packet1, packet2;
        memset(&packet1, 0, sizeof(packet1));
        packet1.catalog_revision = packet_in.catalog_revision;
        packet1.index = packet_in.index;
        packet1.target_system = packet_in.target_system;
        packet1.target_component = packet_in.target_component;
        
        
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
        if (status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) {
           // cope with extensions
           memset(MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN + (char *)&packet1, 0, sizeof(packet1)-MAVLINK_MSG_ID_OT_CATALOG_REQUEST_MIN_LEN);
        }
#endif
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_catalog_request_encode(system_id, component_id, &msg, &packet1);
    mavlink_msg_ot_catalog_request_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_catalog_request_pack(system_id, component_id, &msg , packet1.catalog_revision , packet1.index , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_catalog_request_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_catalog_request_pack_chan(system_id, component_id, MAVLINK_COMM_0, &msg , packet1.catalog_revision , packet1.index , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_catalog_request_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
        mavlink_msg_to_send_buffer(buffer, &msg);
        for (i=0; i<mavlink_msg_get_send_buffer_length(&msg); i++) {
            comm_send_ch(MAVLINK_COMM_0, buffer[i]);
        }
    mavlink_msg_ot_catalog_request_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);
        
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_catalog_request_send(MAVLINK_COMM_1 , packet1.catalog_revision , packet1.index , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_catalog_request_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

#ifdef MAVLINK_HAVE_GET_MESSAGE_INFO
    MAVLINK_ASSERT(mavlink_get_message_info_by_name("OT_CATALOG_REQUEST") != NULL);
    MAVLINK_ASSERT(mavlink_get_message_info_by_id(MAVLINK_MSG_ID_OT_CATALOG_REQUEST) != NULL);
#endif
}

static void mavlink_test_ot_command_request(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
    mavlink_status_t *status = mavlink_get_channel_status(MAVLINK_COMM_0);
        if ((status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) && MAVLINK_MSG_ID_OT_COMMAND_REQUEST >= 256) {
            return;
        }
#endif
    mavlink_message_t msg;
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t i;
    mavlink_ot_command_request_t packet_in = {
        963497464,963497672,963497880,963498088,53,120,187
    };
    mavlink_ot_command_request_t packet1, packet2;
        memset(&packet1, 0, sizeof(packet1));
        packet1.boot_id = packet_in.boot_id;
        packet1.time_boot_ms = packet_in.time_boot_ms;
        packet1.sender_session = packet_in.sender_session;
        packet1.request_id = packet_in.request_id;
        packet1.operation = packet_in.operation;
        packet1.target_system = packet_in.target_system;
        packet1.target_component = packet_in.target_component;
        
        
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
        if (status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) {
           // cope with extensions
           memset(MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN + (char *)&packet1, 0, sizeof(packet1)-MAVLINK_MSG_ID_OT_COMMAND_REQUEST_MIN_LEN);
        }
#endif
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_command_request_encode(system_id, component_id, &msg, &packet1);
    mavlink_msg_ot_command_request_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_command_request_pack(system_id, component_id, &msg , packet1.boot_id , packet1.time_boot_ms , packet1.sender_session , packet1.request_id , packet1.operation , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_command_request_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_command_request_pack_chan(system_id, component_id, MAVLINK_COMM_0, &msg , packet1.boot_id , packet1.time_boot_ms , packet1.sender_session , packet1.request_id , packet1.operation , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_command_request_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
        mavlink_msg_to_send_buffer(buffer, &msg);
        for (i=0; i<mavlink_msg_get_send_buffer_length(&msg); i++) {
            comm_send_ch(MAVLINK_COMM_0, buffer[i]);
        }
    mavlink_msg_ot_command_request_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);
        
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_command_request_send(MAVLINK_COMM_1 , packet1.boot_id , packet1.time_boot_ms , packet1.sender_session , packet1.request_id , packet1.operation , packet1.target_system , packet1.target_component );
    mavlink_msg_ot_command_request_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

#ifdef MAVLINK_HAVE_GET_MESSAGE_INFO
    MAVLINK_ASSERT(mavlink_get_message_info_by_name("OT_COMMAND_REQUEST") != NULL);
    MAVLINK_ASSERT(mavlink_get_message_info_by_id(MAVLINK_MSG_ID_OT_COMMAND_REQUEST) != NULL);
#endif
}

static void mavlink_test_ot_command_result(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
    mavlink_status_t *status = mavlink_get_channel_status(MAVLINK_COMM_0);
        if ((status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) && MAVLINK_MSG_ID_OT_COMMAND_RESULT >= 256) {
            return;
        }
#endif
    mavlink_message_t msg;
        uint8_t buffer[MAVLINK_MAX_PACKET_LEN];
        uint16_t i;
    mavlink_ot_command_result_t packet_in = {
        963497464,963497672,29,96,163,230,"MNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLM"
    };
    mavlink_ot_command_result_t packet1, packet2;
        memset(&packet1, 0, sizeof(packet1));
        packet1.sender_session = packet_in.sender_session;
        packet1.request_id = packet_in.request_id;
        packet1.operation = packet_in.operation;
        packet1.result = packet_in.result;
        packet1.target_system = packet_in.target_system;
        packet1.target_component = packet_in.target_component;
        
        mav_array_memcpy(packet1.reason, packet_in.reason, sizeof(char)*80);
        
#ifdef MAVLINK_STATUS_FLAG_OUT_MAVLINK1
        if (status->flags & MAVLINK_STATUS_FLAG_OUT_MAVLINK1) {
           // cope with extensions
           memset(MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN + (char *)&packet1, 0, sizeof(packet1)-MAVLINK_MSG_ID_OT_COMMAND_RESULT_MIN_LEN);
        }
#endif
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_command_result_encode(system_id, component_id, &msg, &packet1);
    mavlink_msg_ot_command_result_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_command_result_pack(system_id, component_id, &msg , packet1.sender_session , packet1.request_id , packet1.operation , packet1.result , packet1.target_system , packet1.target_component , packet1.reason );
    mavlink_msg_ot_command_result_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_command_result_pack_chan(system_id, component_id, MAVLINK_COMM_0, &msg , packet1.sender_session , packet1.request_id , packet1.operation , packet1.result , packet1.target_system , packet1.target_component , packet1.reason );
    mavlink_msg_ot_command_result_decode(&msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

        memset(&packet2, 0, sizeof(packet2));
        mavlink_msg_to_send_buffer(buffer, &msg);
        for (i=0; i<mavlink_msg_get_send_buffer_length(&msg); i++) {
            comm_send_ch(MAVLINK_COMM_0, buffer[i]);
        }
    mavlink_msg_ot_command_result_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);
        
        memset(&packet2, 0, sizeof(packet2));
    mavlink_msg_ot_command_result_send(MAVLINK_COMM_1 , packet1.sender_session , packet1.request_id , packet1.operation , packet1.result , packet1.target_system , packet1.target_component , packet1.reason );
    mavlink_msg_ot_command_result_decode(last_msg, &packet2);
        MAVLINK_ASSERT(memcmp(&packet1, &packet2, sizeof(packet1)) == 0);

#ifdef MAVLINK_HAVE_GET_MESSAGE_INFO
    MAVLINK_ASSERT(mavlink_get_message_info_by_name("OT_COMMAND_RESULT") != NULL);
    MAVLINK_ASSERT(mavlink_get_message_info_by_id(MAVLINK_MSG_ID_OT_COMMAND_RESULT) != NULL);
#endif
}

static void mavlink_test_openturbine(uint8_t system_id, uint8_t component_id, mavlink_message_t *last_msg)
{
    mavlink_test_ot_link_info(system_id, component_id, last_msg);
    mavlink_test_ot_channel_info(system_id, component_id, last_msg);
    mavlink_test_ot_channel_values(system_id, component_id, last_msg);
    mavlink_test_ot_engine_state(system_id, component_id, last_msg);
    mavlink_test_ot_remote_input(system_id, component_id, last_msg);
    mavlink_test_ot_catalog_request(system_id, component_id, last_msg);
    mavlink_test_ot_command_request(system_id, component_id, last_msg);
    mavlink_test_ot_command_result(system_id, component_id, last_msg);
}

#ifdef __cplusplus
}
#endif // __cplusplus
#endif // OPENTURBINE_TESTSUITE_H
