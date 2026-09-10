#pragma once

#include <cstdint>

namespace SessionFiles {

// Parse "session_<non-negative decimal>.csv". The input may be either a
// basename or a LittleFS path such as "/logs/session_42.csv".
bool parseRunNumber(const char* path, int& runNumber);

// Choose a durable, non-overwriting identity for a new session. The persisted
// start-attempt counter is the natural identity because session capture begins
// at START (including attempts that abort before RUNNING). Existing files remain
// authoritative if logging was restored independently of the counters.
bool nextSessionNumber(uint32_t persistedStartAttempts,
                       uint32_t highestStored,
                       uint32_t& sessionNumber);

}  // namespace SessionFiles
