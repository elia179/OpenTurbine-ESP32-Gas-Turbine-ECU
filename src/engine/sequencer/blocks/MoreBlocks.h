#pragma once
#include "../IBlock.h"
#include "../../EngineData.h"
#include "../../../system/Config.h"
#include "../../../system/FeedbackRequirements.h"
#include <Arduino.h>

// Hold until the selected engine temperature falls below the threshold.
// Device-targeted blocks formerly colocated here are now built by main.cpp.
class WaitTOTCool : public IBlock {
public:
    float         targetTot = 150.0f;
    unsigned long timeoutMs = 120000;

    const char* name() override { return "WaitTOTCool"; }

    void onEnter() override { _entryMs = millis(); }

    BlockResult tick() override {
        auto& ed = EngineData::instance();
        if (FeedbackRequirements::bypassUnhealthyStartupCheck(
                ed, FeedbackRequirements::EGT, Config::primaryEgtHealthy(ed))) {
            clearWaitReason();
            Serial.println("[WaitTOTCool] REDUCED POWER: unavailable EGT check skipped");
            return BlockResult::Complete;
        }
        if (!Config::primaryEgtHealthy(ed)) {
            setWaitReason("Selected EGT feedback unavailable");
            if ((millis() - _entryMs) > timeoutMs)
                return ed.mode == SysMode::STARTUP ? BlockResult::Abort : BlockResult::TimeoutContinue;
            return BlockResult::Running;
        }
        if (Config::primaryEgtC(ed) <= targetTot) return BlockResult::Complete;
        if ((millis() - _entryMs) > timeoutMs)
            return ed.mode == SysMode::STARTUP ? BlockResult::Abort : BlockResult::TimeoutContinue;
        return BlockResult::Running;
    }

    void onExit() override { clearWaitReason(); }

private:
    unsigned long _entryMs = 0;
};
