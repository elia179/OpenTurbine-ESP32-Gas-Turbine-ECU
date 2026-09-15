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
    std::cout << "phase registry, speed ownership and named switch vectors passed\n";
}
