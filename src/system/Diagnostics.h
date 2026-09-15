#pragma once

// Release firmware keeps fault, warning, recovery and useful boot messages on
// Serial. Enable this flag for verbose state-transition and bench diagnostics.
#ifndef OT_ENABLE_DEBUG_SERIAL
#define OT_ENABLE_DEBUG_SERIAL 0
#endif

#if OT_ENABLE_DEBUG_SERIAL
#define OT_DEBUG_PRINTF(...)  Serial.printf(__VA_ARGS__)
#define OT_DEBUG_PRINTLN(...) Serial.println(__VA_ARGS__)
#else
#define OT_DEBUG_PRINTF(...)  do { } while (0)
#define OT_DEBUG_PRINTLN(...) do { } while (0)
#endif
