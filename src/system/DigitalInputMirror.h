#pragma once
#include "ChannelRegistry.h"

// Runtime safety slots also contain adapters for registry switches. Their
// identity is electrical and functional; channel IDs need not start with di_.
inline bool registryMirrorsDigitalInput(const ChannelRegistry::Channel& channel,
                                       int pin, const char* role, bool activeHigh) {
    return channel.installed && !channel.mirrorOf[0] &&
        channel.driver == ChannelRegistry::Digital && pin >= 0 &&
        channel.pin == pin && channel.activeHigh == activeHigh && role &&
        (!strcmp(channel.role, role) || !strcmp(channel.purpose, role));
}

inline bool registryRuntimeDiRole(const char* role) {
    return role && (!strcmp(role, "fault") || !strcmp(role, "estop") ||
        !strcmp(role, "inhibit_start") || !strcmp(role, "low_oil_switch") ||
        !strcmp(role, "oil_zero_switch") || !strcmp(role, "sequence_gate") ||
        !strcmp(role, "ab_arm") || !strcmp(role, "ab_fire") || !strcmp(role, "limp_mode"));
}

// Preserve slot indexes, debounce and mode masks, but source wiring and purpose
// from the canonical device. A removed or repurposed device must not leave a
// second, invisible safety input behind. Unmarked legacy inputs remain intact.
inline void reconcileRegistryDigitalInputs(JsonDocument& doc) {
    if (!doc["channel_registry"]["inputs"].is<JsonArray>()) return;
    for (JsonObject di : doc["di_channels"].as<JsonArray>()) {
        const char* id = di["registry_id"] | "";
        if (!id[0]) continue;
        JsonObject source;
        for (JsonObject candidate : doc["channel_registry"]["inputs"].as<JsonArray>()) {
            if (!strcmp(candidate["id"] | "", id)) { source = candidate; break; }
        }
        const char* role = source["role"] | "";
        if (!source.isNull() && (source["installed"] | true) &&
            (source["driver"] | -1) == ChannelRegistry::Digital &&
            (source["pin"] | -1) >= 0 && registryRuntimeDiRole(role)) {
            di["pin"] = source["pin"];
            di["role"] = role;
            di["active_h"] = source["active_high"] | true;
            di["label"] = source["name"] | id;
        } else {
            di.clear();
            di["pin"] = -1;
            di["role"] = "none";
        }
    }
}
