/** @file
 *  @brief MAVLink comm protocol generated from openturbine.xml
 *  @see http://mavlink.org
 */
#pragma once
#ifndef MAVLINK_OPENTURBINE_H
#define MAVLINK_OPENTURBINE_H

#ifndef MAVLINK_H
    #error Wrong include order: MAVLINK_OPENTURBINE.H MUST NOT BE DIRECTLY USED. Include mavlink.h from the same directory instead or set ALL AND EVERY defines from MAVLINK.H manually accordingly, including the #define MAVLINK_H call.
#endif

#define MAVLINK_OPENTURBINE_XML_HASH 2773594121616418836

#ifdef __cplusplus
extern "C" {
#endif

// MESSAGE LENGTHS AND CRCS

#ifndef MAVLINK_MESSAGE_LENGTHS
#define MAVLINK_MESSAGE_LENGTHS {}
#endif

#ifndef MAVLINK_MESSAGE_CRCS
#define MAVLINK_MESSAGE_CRCS {{0, 50, 9, 9, 0, 0, 0}, {76, 152, 33, 33, 3, 30, 31}, {77, 143, 3, 10, 3, 8, 9}, {225, 208, 65, 73, 0, 0, 0}, {251, 170, 18, 18, 0, 0, 0}, {253, 83, 51, 54, 0, 0, 0}, {520100, 33, 50, 50, 0, 0, 0}, {520101, 183, 94, 94, 0, 0, 0}, {520102, 42, 69, 69, 0, 0, 0}, {520103, 82, 220, 220, 0, 0, 0}, {520104, 188, 24, 24, 3, 22, 23}, {520105, 123, 8, 8, 3, 6, 7}, {520106, 250, 19, 19, 3, 17, 18}, {520107, 8, 92, 92, 3, 10, 11}}
#endif

#include "../protocol.h"

#define MAVLINK_ENABLED_OPENTURBINE

// ENUM DEFINITIONS



// MAVLINK VERSION

#ifndef MAVLINK_VERSION
#define MAVLINK_VERSION 3
#endif

#if (MAVLINK_VERSION == 0)
#undef MAVLINK_VERSION
#define MAVLINK_VERSION 3
#endif

// MESSAGE DEFINITIONS
#include "./mavlink_msg_ot_link_info.h"
#include "./mavlink_msg_ot_channel_info.h"
#include "./mavlink_msg_ot_channel_values.h"
#include "./mavlink_msg_ot_engine_state.h"
#include "./mavlink_msg_ot_remote_input.h"
#include "./mavlink_msg_ot_catalog_request.h"
#include "./mavlink_msg_ot_command_request.h"
#include "./mavlink_msg_ot_command_result.h"

// base include
#include "../openturbine_standard/openturbine_standard.h"


#if MAVLINK_OPENTURBINE_XML_HASH == MAVLINK_PRIMARY_XML_HASH
# define MAVLINK_MESSAGE_INFO {MAVLINK_MESSAGE_INFO_HEARTBEAT, MAVLINK_MESSAGE_INFO_COMMAND_LONG, MAVLINK_MESSAGE_INFO_COMMAND_ACK, MAVLINK_MESSAGE_INFO_EFI_STATUS, MAVLINK_MESSAGE_INFO_NAMED_VALUE_FLOAT, MAVLINK_MESSAGE_INFO_STATUSTEXT, MAVLINK_MESSAGE_INFO_OT_LINK_INFO, MAVLINK_MESSAGE_INFO_OT_CHANNEL_INFO, MAVLINK_MESSAGE_INFO_OT_CHANNEL_VALUES, MAVLINK_MESSAGE_INFO_OT_ENGINE_STATE, MAVLINK_MESSAGE_INFO_OT_REMOTE_INPUT, MAVLINK_MESSAGE_INFO_OT_CATALOG_REQUEST, MAVLINK_MESSAGE_INFO_OT_COMMAND_REQUEST, MAVLINK_MESSAGE_INFO_OT_COMMAND_RESULT}
# define MAVLINK_MESSAGE_NAMES {{ "COMMAND_ACK", 77 }, { "COMMAND_LONG", 76 }, { "EFI_STATUS", 225 }, { "HEARTBEAT", 0 }, { "NAMED_VALUE_FLOAT", 251 }, { "OT_CATALOG_REQUEST", 520105 }, { "OT_CHANNEL_INFO", 520101 }, { "OT_CHANNEL_VALUES", 520102 }, { "OT_COMMAND_REQUEST", 520106 }, { "OT_COMMAND_RESULT", 520107 }, { "OT_ENGINE_STATE", 520103 }, { "OT_LINK_INFO", 520100 }, { "OT_REMOTE_INPUT", 520104 }, { "STATUSTEXT", 253 }}
# if MAVLINK_COMMAND_24BIT
#  include "../mavlink_get_info.h"
# endif
#endif

#ifdef __cplusplus
}
#endif // __cplusplus
#endif // MAVLINK_OPENTURBINE_H
