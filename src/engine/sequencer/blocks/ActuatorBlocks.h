#pragma once
#include "../IBlock.h"
#include "../../EngineData.h"
#include <Arduino.h>

// Fixed blocks used only by the built-in afterburner fallback sequence.
// User-configured actuator blocks are target-aware objects built in main.cpp.
class ABPumpOn : public IBlock {
public:
    float demandPct = 80.0f;
    const char* name() override { return "ABPumpOn"; }
    void onEnter() override {
        auto& ed = EngineData::instance();
        ed.abPumpDemand = demandPct / 100.0f;
        if (!ed.abFirstFuelMs) ed.abFirstFuelMs = millis();
    }
    BlockResult tick() override { return BlockResult::Complete; }
    void onExit() override {}
};

class ABPumpOff : public IBlock {
public:
    const char* name() override { return "ABPumpOff"; }
    void onEnter() override { EngineData::instance().abPumpDemand = 0; }
    BlockResult tick() override { return BlockResult::Complete; }
    void onExit() override {}
};

class ABSolOpen : public IBlock {
public:
    const char* name() override { return "ABSolOpen"; }
    void onEnter() override {
        auto& ed = EngineData::instance();
        ed.abSolOpen = true;
        if (!ed.abFirstFuelMs) ed.abFirstFuelMs = millis();
    }
    BlockResult tick() override { return BlockResult::Complete; }
    void onExit() override {}
};

class ABSolClose : public IBlock {
public:
    const char* name() override { return "ABSolClose"; }
    void onEnter() override { EngineData::instance().abSolOpen = false; }
    BlockResult tick() override { return BlockResult::Complete; }
    void onExit() override {}
};
