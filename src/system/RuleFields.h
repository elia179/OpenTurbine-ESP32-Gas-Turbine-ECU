#pragma once
#include "Config.h"

// Preserve the rule-file schema/defaults while sharing JSON lookup code.
namespace RuleFields {
struct Field {const char* key;float Config::Rule::*member;float fallback;};
inline constexpr Field floats[] = {
    {"threshold",&Config::Rule::threshold,0.0f},
    {"on_value",&Config::Rule::onValue,1.0f},
    {"off_value",&Config::Rule::offValue,0.0f},
    {"hysteresis",&Config::Rule::hysteresis,0.0f},
    {"input_min",&Config::Rule::inputMin,0.0f},
    {"input_max",&Config::Rule::inputMax,1.0f},
    {"output_min",&Config::Rule::outputMin,0.0f},
    {"output_max",&Config::Rule::outputMax,1.0f},
    {"target_fixed",&Config::Rule::targetFixed,0.0f},
    {"target_low",&Config::Rule::targetLow,0.0f},
    {"target_high",&Config::Rule::targetHigh,1.0f},
    {"target_input_min",&Config::Rule::targetInputMin,0.0f},
    {"target_input_max",&Config::Rule::targetInputMax,1.0f},
    {"response_gain",&Config::Rule::responseGain,0.01f},
    {"integral_gain",&Config::Rule::integralGain,0.001f},
    {"deadband",&Config::Rule::deadband,0.0f},
};
inline void read(Config::Rule& rule,JsonObjectConst object) {
    for(const auto& field:floats) rule.*field.member=object[field.key]|field.fallback;
}
inline void write(JsonObject object,const Config::Rule& rule) {
    for(const auto& field:floats) object[field.key]=rule.*field.member;
}
}
