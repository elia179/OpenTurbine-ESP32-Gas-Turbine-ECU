#pragma once
#include <ArduinoJson.h>

// ArduinoJson treats const character arrays as borrowed string literals. A
// snapshot also contains const arrays in a temporary stack copy; asynchronous
// responses must own those values before that copy leaves scope. Copy linked
// values recursively while the snapshot and registry references are valid.
static void _ownLinkedJsonValues(JsonVariant value) {
    if (value.is<JsonObject>()) {
        for (JsonPair item : value.as<JsonObject>())
            _ownLinkedJsonValues(item.value());
    } else if (value.is<JsonArray>()) {
        for (JsonVariant item : value.as<JsonArray>())
            _ownLinkedJsonValues(item);
    } else if (value.is<JsonString>()) {
        const JsonString text = value.as<JsonString>();
        if (text.isStatic()) value.set(static_cast<const char*>(text.c_str()));
    }
}

