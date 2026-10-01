#include "../../src/system/ChannelRegistry.h"
#include <cassert>
#include <cstring>
#include <iostream>

static ChannelRegistry::Channel phaseTorque() {
    ChannelRegistry::Channel c;
    c.installed = true;
    c.direction = ChannelRegistry::Input;
    c.driver = ChannelRegistry::Pulse;
    std::strcpy(c.id, "torque_main");
    std::strcpy(c.name, "Shaft Torque");
    std::strcpy(c.role, "torque");
    std::strcpy(c.purpose, "torque");
    c.pin = 34;
    c.phasePin = 35;
    c.torqueInterface = 2;
    c.pulsesPerUnit = 2;
    c.phasePulsesPerUnit = 2;
    c.phaseZeroDeg = 3;
    c.phaseDegPerNm = 0.04f;
    return c;
}

static ChannelRegistry::Channel shaftSpeed(const char* purpose) {
    ChannelRegistry::Channel c;
    c.installed = true;
    c.direction = ChannelRegistry::Input;
    c.driver = ChannelRegistry::Pulse;
    std::strcpy(c.id, !std::strcmp(purpose, "n1_speed") ? "n1_main" : "n2_main");
    std::strcpy(c.role, "speed");
    std::strcpy(c.purpose, purpose);
    c.pin = 32;
    c.maxValue = 100000;
    return c;
}

static ChannelRegistry::Channel torqueShaftSpeed() {
    ChannelRegistry::Channel c;
    c.installed = true;
    c.direction = ChannelRegistry::Input;
    c.driver = ChannelRegistry::Pulse;
    std::strcpy(c.id, "torque_shaft_speed");
    std::strcpy(c.name, "Torque Shaft Speed");
    std::strcpy(c.role, "speed");
    std::strcpy(c.purpose, "shaft_speed");
    std::strcpy(c.mirrorOf, "torque_main");
    c.pin = 34;
    c.pulsesPerUnit = 2;
    c.maxValue = 200000;
    return c;
}

int main() {
    ChannelRegistry reg;
    reg.inputCount = 1;
    reg.inputs[0] = phaseTorque();
    assert(reg.validate());
    reg.inputs[0].phasePulsesPerUnit = 3;
    assert(!reg.validate());
    reg.inputs[0].phasePulsesPerUnit = 2;
    assert(reg.validate());
    assert(reg.inputs[0].phaseSpeedSource == 0); // torque-only is the default

    reg.inputs[0].phaseSpeedSource = 1;
    assert(reg.validate());
    reg.inputCount = 2;
    reg.inputs[1] = shaftSpeed("n1_speed");
    assert(!reg.validate());
    reg.inputs[1] = shaftSpeed("n2_speed");
    assert(reg.validate());
    reg.inputs[0].phaseSpeedSource = 2;
    assert(!reg.validate());
    reg.inputs[0].phaseSpeedSource = 0;
    assert(reg.validate());

    reg.inputCount = 2;
    reg.inputs[0].phaseSpeedSource = 3;
    reg.inputs[1] = torqueShaftSpeed();
    assert(reg.validate());
    reg.inputs[1].pulsesPerUnit = 3;
    assert(!reg.validate());
    reg.inputs[1] = torqueShaftSpeed();
    reg.inputs[0].phaseSpeedSource = 0;
    assert(!reg.validate());
    reg.inputs[0].phaseSpeedSource = 3;
    assert(reg.validate());

    reg.inputCount = 1;
    reg.inputs[0].phaseSpeedSource = 0;
    reg.inputs[0].phasePin = reg.inputs[0].pin;
    assert(!reg.validate());
    reg.inputs[0].phasePin = 35;
    assert(reg.validate());

    JsonDocument doc;
    JsonObject root = doc.to<JsonObject>();
    reg.toJson(root);
    ChannelRegistry restored;
    assert(restored.fromJson(root));
    assert(restored.validate());
    assert(restored.inputs[0].phasePin == 35);
    assert(restored.inputs[0].phasePulsesPerUnit == 2);
    assert(restored.inputs[0].phaseSpeedSource == 0);
    assert(restored.inputs[0].phaseDegPerNm == reg.inputs[0].phaseDegPerNm);

    // JSON snapshots must remain independent of the live fixed-size buffers.
    reg.inputs[0] = ChannelRegistry::Channel{};
    assert(!std::strcmp(root["inputs"][0]["id"].as<const char*>(), "torque_main"));
    reg.inputs[0] = phaseTorque();

    reg.inputCount = 2;
    reg.inputs[0].phaseSpeedSource = 3;
    reg.inputs[1] = torqueShaftSpeed();
    JsonDocument derivedDoc;
    JsonObject derivedRoot = derivedDoc.to<JsonObject>();
    reg.toJson(derivedRoot);
    ChannelRegistry restoredDerived;
    assert(restoredDerived.fromJson(derivedRoot));
    assert(restoredDerived.validate());
    assert(!std::strcmp(restoredDerived.inputs[1].mirrorOf, "torque_main"));

    for (const char* purpose : {"chip_detector", "diff_press_switch"}) {
        ChannelRegistry switches;
        switches.inputCount = 1;
        auto& c = switches.inputs[0];
        c.installed = true;
        c.direction = ChannelRegistry::Input;
        c.driver = ChannelRegistry::Digital;
        std::strcpy(c.id, purpose);
        std::strcpy(c.role, "digital_switch");
        std::strcpy(c.purpose, purpose);
        c.pin = 33;
        assert(switches.validate());
        assert(!c.forceSafeOnFault);
    }
    const char* bindingKeys[] = {"starter_enable_output", "primary_scavenge_pump",
        "primary_aux_fuel_pump", "primary_secondary_igniter"};
    const char* purposes[] = {"starter_enable", "scavenge_pump", "fuel_pump", "ab_igniter"};
    const char* roles[] = {"starter_en", "scavenge_pump", "fuel_pump", "ab_igniter"};
    char oilLoopId[20] = "main_oil_loop";
    const auto& constOilLoopId = oilLoopId;
    JsonDocument oilSnapshot;
    oilSnapshot["id"] = JsonString(constOilLoopId);
    std::memset(oilLoopId, 0, sizeof(oilLoopId));
    assert(!std::strcmp(oilSnapshot["id"].as<const char*>(), "main_oil_loop"));
    for (int i = 0; i < 4; ++i) {
        ChannelRegistry outputs;
        outputs.outputCount = 1;
        auto& c = outputs.outputs[0];
        c.installed = true; c.direction = ChannelRegistry::Output;
        c.driver = i == 0 || i == 3 ? ChannelRegistry::Relay : ChannelRegistry::Pwm;
        c.pin = 25; c.maxValue = 1;
        std::strcpy(c.id, "selected_output");
        std::strcpy(c.purpose, purposes[i]); std::strcpy(c.role, roles[i]);
        outputs.bindingCount = 1;
        std::strcpy(outputs.bindings[0].key, bindingKeys[i]);
        std::strcpy(outputs.bindings[0].channelId, c.id);
        assert(outputs.validate()); assert(outputs.ownsCoreOutput(c));
        JsonDocument bindingDoc;
        auto bindingRoot = bindingDoc.to<JsonObject>(); outputs.toJson(bindingRoot);
        outputs.outputs[0] = ChannelRegistry::Channel{};
        outputs.bindings[0] = ChannelRegistry::Binding{};
        assert(!std::strcmp(bindingRoot["outputs"][0]["id"].as<const char*>(), "selected_output"));
        assert(!std::strcmp(bindingRoot["bindings"][0]["key"].as<const char*>(), bindingKeys[i]));
        ChannelRegistry roundTrip;
        assert(roundTrip.fromJson(bindingRoot));
        assert(!std::strcmp(roundTrip.bindings[0].key, bindingKeys[i]));
        assert(roundTrip.ownsCoreOutput(roundTrip.outputs[0]));
        const std::string oldPrefix(bindingKeys[i], 19);
        bindingRoot["bindings"][0]["key"] = oldPrefix;
        assert(roundTrip.fromJson(bindingRoot));
        assert(!std::strcmp(roundTrip.bindings[0].key, bindingKeys[i]));
        // A previously truncated key must regain its typed compatibility check.
        bindingRoot["outputs"][0]["purpose"] = "generic";
        bindingRoot["outputs"][0]["role"] = "generic";
        assert(!roundTrip.fromJson(bindingRoot));
        bindingRoot["bindings"][0]["key"] = std::string(32, 'x');
        assert(!roundTrip.fromJson(bindingRoot));
        bindingRoot["bindings"][0]["key"] = "custom";
        bindingRoot["bindings"][0]["channel"] = "selected_output_that_is_too_long";
        assert(!roundTrip.fromJson(bindingRoot));
    }
    std::cout << "phase registry, speed ownership, named switches and long binding round-trip vectors passed\n";
}
