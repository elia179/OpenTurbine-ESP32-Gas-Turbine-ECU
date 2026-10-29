#pragma once
#include "HardwareConfig.h"

// Shared descriptors keep parsing, validation and serialization in agreement.
// They also avoid separate ArduinoJson conversion code for every field.
namespace MavlinkConfigFields {
struct Integer { const char* key; int* value; int fallback, minimum, maximum; };
extern const Integer integers[6];
}
