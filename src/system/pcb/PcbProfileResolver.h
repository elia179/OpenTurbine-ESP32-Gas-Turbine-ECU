#pragma once

#include "../ChannelRegistry.h"

class PcbProfileResolver {
public:
    // Replaces every profile-backed channel's physical fields from the
    // immutable catalog and rejects raw/unmapped channels in profile mode.
    // Canonicalize immutable wiring before registry insertion/validation, including imports.
    static int digitalMirrorPin(JsonObjectConst source);
    static bool resolveChannel(ChannelRegistry::Channel& channel, char* reason, size_t reasonSize);
    static bool resolve(ChannelRegistry& registry, char* reason, size_t reasonSize);
    static bool addProfileDefaults(ChannelRegistry& registry, char* reason, size_t reasonSize);

    // Applies immutable shared-bus wiring to HardwareConfig after its user
    // document is read.
    static void applyFixedBuses();

    // Applies soldered indicators and seeds default UART routing. Serial GPIO,
    // enable and rate choices remain under user control.
    static void applyFixedPeripherals();
};
