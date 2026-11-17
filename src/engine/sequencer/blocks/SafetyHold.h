#pragma once
#include "../IBlock.h"
#include "../../EngineData.h"
#include "../../../system/HardwareConfig.h"
#include "../../../system/Config.h"
#include "../../../system/FeedbackRequirements.h"
#include "../SequenceIgnition.h"
#include <Arduino.h>

// User-facing "Final Startup Checks". Every enabled and installed check must
// remain continuously valid for holdMs before RUNNING is allowed.
class SafetyHold : public IBlock {
public:
    unsigned long holdMs = 1000;
    unsigned long timeoutMs = 15000;
    float finalCheckRpm = 31000.0f;
    float finalCheckN2Rpm = 0.0f;
    float finalCheckP1 = 0.0f;
    float finalCheckP2 = 0.0f;
    float finalCheckEgt = 0.0f;
    float maxN1 = NAN, maxN2 = NAN, maxP1 = NAN, maxP2 = NAN, maxEgt = NAN;
    float minOil = NAN, maxOil = NAN, minBattery = NAN, maxBattery = NAN;
    float runningOilMin = 2.8f;
    bool checkN1 = true;
    bool checkN2 = false;
    bool checkP1 = false;
    bool checkP2 = false;
    bool checkOil = false;
    bool checkEgt = false;
    bool checkFlame = false;
    bool checkBattery = false;
    bool oilUseSharedMin = true;

    bool turnOffStarterOnExit = true;
    bool turnOffStarterEnOnExit = true;
    bool turnOffIgniterOnExit = true;

    const char* name() override { return "SafetyHold"; }

    void onEnter() override {
        _entryMs = millis();
        _stableSinceMs = 0;
        if (EngineData::instance().oilMinBar < runningOilMin)
            EngineData::instance().oilMinBar = runningOilMin;
    }

    BlockResult tick() override {
        auto& ed = EngineData::instance();
        const unsigned long now = millis();
        const unsigned long elapsed = now - _entryMs;
        if (ed.benchMode) {
            if (elapsed >= holdMs) { clearWaitReason(); return BlockResult::Complete; }
            snprintf(_reason, sizeof(_reason), "Final checks (bench): %lu ms remaining", holdMs - elapsed);
            setWaitReason(_reason);
            return BlockResult::Running;
        }

        bool any = false;
        const char* failed = nullptr;
        auto require = [&](bool enabled, bool installed, bool healthy, bool passed,
                           FeedbackRequirements::Sensor sensor, const char* label) {
            if (!enabled) return;
            any = true;
            if (FeedbackRequirements::bypassUnhealthyStartupCheck(ed, sensor,
                                                                   installed && healthy))
                return;
            if ((!installed || !passed) && !failed) failed = label;
        };
        const auto within = [](float value, float lower, float upper) {
            return isfinite(value) && (isnan(lower) || value >= lower) &&
                (isnan(upper) || value <= upper);
        };
        require(checkN1, HardwareConfig::hasN1Rpm, ed.n1Healthy,
                ed.n1Healthy && within(ed.n1Rpm, finalCheckRpm, maxN1),
                FeedbackRequirements::N1, "N1");
        require(checkN2, HardwareConfig::hasN2Rpm, ed.n2Healthy,
                ed.n2Healthy && within(ed.n2Rpm, finalCheckN2Rpm, maxN2),
                FeedbackRequirements::N2, "N2");
        require(checkP1, HardwareConfig::hasP1, ed.p1Healthy,
                ed.p1Healthy && within(ed.p1, finalCheckP1, maxP1),
                FeedbackRequirements::P1, "P1 pressure");
        require(checkP2, HardwareConfig::hasP2, ed.p2Healthy,
                ed.p2Healthy && within(ed.p2, finalCheckP2, maxP2),
                FeedbackRequirements::P2, "P2 pressure");
        require(checkOil, HardwareConfig::hasOilPress, ed.oilHealthy,
                ed.oilHealthy && within(ed.oilPressure, oilUseSharedMin ? runningOilMin : minOil, maxOil),
                FeedbackRequirements::OIL_PRESSURE, "oil pressure");
        const bool egtInstalled = Config::effectiveEgtSource() != 0;
        const bool egtHealthy = Config::primaryEgtHealthy(ed);
        require(checkEgt, egtInstalled, egtHealthy,
                egtHealthy && within(Config::primaryEgtC(ed), finalCheckEgt, maxEgt),
                FeedbackRequirements::EGT, "engine temperature");
        require(checkBattery, HardwareConfig::hasBattVoltage, ed.battHealthy,
                ed.battHealthy && within(ed.battVoltage, minBattery, maxBattery),
                FeedbackRequirements::BATTERY, "battery voltage");
        require(checkFlame, HardwareConfig::hasFlame, ed.flameHealthy,
                ed.flameHealthy && ed.flameDetected,
                FeedbackRequirements::FLAME, "flame");

        if (!any) return BlockResult::Fault;
        if (failed) {
            _stableSinceMs = 0;
            snprintf(_reason, sizeof(_reason), "Final checks: waiting for %s", failed);
            setWaitReason(_reason);
        } else {
            if (_stableSinceMs == 0) _stableSinceMs = now;
            const unsigned long stable = now - _stableSinceMs;
            if (stable >= holdMs) { clearWaitReason(); return BlockResult::Complete; }
            snprintf(_reason, sizeof(_reason), "Final checks stable: %lu ms remaining", holdMs - stable);
            setWaitReason(_reason);
        }
        const unsigned long finiteTimeout = timeoutMs ? timeoutMs : 15000UL;
        if (elapsed >= finiteTimeout) return BlockResult::Fault;
        return BlockResult::Running;
    }

    void onExit() override {
        auto& ed = EngineData::instance();
        if (turnOffStarterOnExit) ed.starterDemand = 0;
        if (turnOffStarterEnOnExit) ed.starterEnabled = false;
        if (turnOffIgniterOnExit) {
            clearSequenceIgnitionOutputs();
        }
    }

private:
    unsigned long _entryMs = 0;
    unsigned long _stableSinceMs = 0;
    char _reason[96] = {};
};
