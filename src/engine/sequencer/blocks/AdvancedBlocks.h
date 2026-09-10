#pragma once
#include "../IBlock.h"
#include "../../EngineData.h"
#include "../../../system/Config.h"
#include "../../../system/FeedbackRequirements.h"
#include <Arduino.h>

// Wait until the power-turbine governor has held N2 within its configured
// band. Device-targeted one-shot and ramp blocks are built by main.cpp's
// target-aware sequence pool; keeping parallel implementations here gave
// unreachable classes different actuator semantics.
class GovernorHold : public IBlock {
public:
    unsigned long timeoutMs = 10000;
    float         bandRpm   = 500.0f;

    const char* name() override { return "GovernorHold"; }

    void onEnter() override {
        _startMs = millis();
        _inBandSinceMs = 0;
        EngineData::instance().governorHandoffActive = true;
    }

    BlockResult tick() override {
        auto& ed = EngineData::instance();
        const bool n2Bypassed = FeedbackRequirements::bypassUnhealthyStartupCheck(
            ed, FeedbackRequirements::N2, ed.n2Healthy);
        if ((millis() - _startMs) >= timeoutMs)
            return n2Bypassed ? BlockResult::TimeoutContinue : BlockResult::Fault;
        if (!ed.n2Healthy) { _inBandSinceMs = 0; return BlockResult::Running; }
        const float targetRpm = Config::governorTargetRpm;
        if (targetRpm <= 0) return BlockResult::Fault;
        if (fabsf(ed.n2Rpm - targetRpm) < bandRpm) {
            if (_inBandSinceMs == 0) _inBandSinceMs = millis();
            if (millis() - _inBandSinceMs >= 500) return BlockResult::Complete;
        } else {
            _inBandSinceMs = 0;
        }
        return BlockResult::Running;
    }

    void onExit() override { EngineData::instance().governorHandoffActive = false; }

private:
    unsigned long _startMs = 0;
    unsigned long _inBandSinceMs = 0;
};
