#include "SessionFiles.h"

#include <climits>
#include <cstring>

namespace SessionFiles {

bool parseRunNumber(const char* path, int& runNumber) {
    if (!path) return false;

    const char* slash = strrchr(path, '/');
    const char* text = slash ? slash + 1 : path;
    static constexpr char PREFIX[] = "session_";
    static constexpr char SUFFIX[] = ".csv";

    if (strncmp(text, PREFIX, sizeof(PREFIX) - 1) != 0) return false;
    text += sizeof(PREFIX) - 1;
    if (*text < '0' || *text > '9') return false;

    unsigned value = 0;
    do {
        const unsigned digit = static_cast<unsigned>(*text - '0');
        if (value > (static_cast<unsigned>(INT_MAX) - digit) / 10U) return false;
        value = value * 10U + digit;
        ++text;
    } while (*text >= '0' && *text <= '9');

    if (strcmp(text, SUFFIX) != 0) return false;
    runNumber = static_cast<int>(value);
    return true;
}

bool nextSessionNumber(uint32_t persistedStartAttempts,
                       uint32_t highestStored,
                       uint32_t& sessionNumber) {
    // parseRunNumber() and the web API intentionally use positive signed
    // integers, so refuse an identity they could not subsequently enumerate.
    if (highestStored >= static_cast<uint32_t>(INT_MAX)) return false;

    const uint32_t nextStored = highestStored + 1U;
    const uint32_t durableAttempt = persistedStartAttempts > 0U
        ? persistedStartAttempts : 1U;
    const uint32_t selected = durableAttempt > nextStored
        ? durableAttempt : nextStored;
    if (selected > static_cast<uint32_t>(INT_MAX)) return false;

    sessionNumber = selected;
    return true;
}

}  // namespace SessionFiles
