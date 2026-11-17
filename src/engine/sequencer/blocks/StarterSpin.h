#pragma once
#include "../IBlock.h"
#include "../PulsedStarterAssist.h"
#include "../../EngineData.h"
#include "../../../system/FeedbackRequirements.h"
#include <Arduino.h>

// Spin to pre-ignition RPM. Optional proportional-starter assist pulses at low
// N1, then latches complete so ordinary ramped starter control can take over.
class StarterSpin : public IBlock {
public:
    float         starterDemand    = 0.60f;
    float         targetRpm        = 5000.0f;
    unsigned long timeoutMs        = 8000;
    float         oilStartupMinBar = 1.5f;
    float         rampPctPerSec    = 10.0f;
    bool          assistEnabled    = false;
    float         assistDemand     = 0.15f;
    float         assistUntilRpm   = 1000.0f;
    unsigned long assistOnMs       = 500;
    unsigned long assistOffMs      = 250;

    const char* name() override { return "StarterSpin"; }

    void onEnter() override {
        _entryMs = millis();
        _lastRampMs = _entryMs;
        _currentDemand = 0.0f;
        _completedNormally = false;
        _assistStarted = false;
        _assist.begin(false, (uint32_t)_entryMs);
        auto& ed = EngineData::instance();
        ed.starterEnabled = true;
        ed.starterDemand = 0.0f;
        ed.oilMinBar = oilStartupMinBar;
    }

    BlockResult tick() override {
        auto& ed = EngineData::instance();
        const unsigned long now = millis();
        const bool n1Bypassed = FeedbackRequirements::bypassUnhealthyStartupCheck(
            ed, FeedbackRequirements::N1, ed.n1Healthy);

        if (!_assistStarted && ed.starterOutputReady) {
            _assistStarted = true;
            _assist.begin(assistEnabled && !n1Bypassed, (uint32_t)now);
            _lastRampMs = now;
        }
        const bool wasPulsing = _assist.phase() == PulsedStarterAssist::Phase::On ||
                                _assist.phase() == PulsedStarterAssist::Phase::Off;
        if (wasPulsing && !ed.starterOutputReady && !n1Bypassed) _assist.cancel();
        const auto assistPhase = _assist.update((uint32_t)now, ed.n1Healthy,
                                                ed.n1Rpm, assistUntilRpm,
                                                (uint32_t)assistOnMs,
                                                (uint32_t)assistOffMs);
        if (n1Bypassed) {
            // No RPM feedback is available for pulsed assist or target release.
            // Keep the ordinary configured ramp and use timeoutMs as the bounded
            // open-loop crank duration instead of suppressing the starter.
            _assist.begin(false, (uint32_t)now);
        } else if (assistPhase == PulsedStarterAssist::Phase::Cancelled) {
            ed.starterEnabled = false;
        }

        if (_assist.cancelled() || (!ed.n1Healthy && !n1Bypassed) || !ed.starterOutputReady) {
            ed.starterDemand = 0.0f;
            _currentDemand = 0.0f;
            _lastRampMs = now;
        } else if (!_assist.complete()) {
            ed.starterDemand = _assist.pulseOn() ? assistDemand : 0.0f;
        } else {
            if (wasPulsing) {
                _currentDemand = fminf(ed.effectiveStarterDemand, starterDemand);
                _lastRampMs = now;
            }
            applyNormalRamp(ed, now);
        }

        if (!_assist.cancelled() && ed.n1Healthy && ed.n1Rpm >= targetRpm) {
            // Hand off the applied command when the target is reached during
            // a pulse, without advancing the pulse or forcing full demand.
            if (wasPulsing) ed.starterDemand = ed.effectiveStarterDemand;
            _completedNormally = true;
            clearWaitReason();
            return BlockResult::Complete;
        }
        const unsigned long elapsed = now - _entryMs;
        if (elapsed > timeoutMs) {
            if (n1Bypassed) {
                _completedNormally = true;
                clearWaitReason();
                Serial.println("[StarterSpin] REDUCED POWER: timed crank completed without N1 feedback");
                return BlockResult::TimeoutContinue;
            }
            ed.starterDemand = 0.0f;
            ed.starterEnabled = false;
            clearWaitReason();
            return ed.benchMode ? BlockResult::Complete : BlockResult::Fault;
        }
        char message[80];
        if (n1Bypassed)
            snprintf(message, sizeof(message), "Reduced-power timed crank - %lu ms remaining", timeoutMs - elapsed);
        else if (_assist.cancelled())
            snprintf(message, sizeof(message), "Starter assist cancelled - %lu ms remaining", timeoutMs - elapsed);
        else if (!ed.starterOutputReady)
            snprintf(message, sizeof(message), "Waiting for starter enable - %lu ms remaining", timeoutMs - elapsed);
        else if (ed.benchMode)
            snprintf(message, sizeof(message), "[BENCH] Starter sim - %lu ms remaining", timeoutMs - elapsed);
        else
            snprintf(message, sizeof(message), "N1: %d / %d RPM", (int)ed.n1Rpm, (int)targetRpm);
        setWaitReason(message);
        return BlockResult::Running;
    }

    void onExit() override {
        if (_completedNormally) return;
        auto& ed = EngineData::instance();
        ed.starterDemand = 0.0f;
        ed.starterEnabled = false;
    }

private:
    void applyNormalRamp(EngineData& ed, unsigned long now) {
        if (rampPctPerSec > 0.0f && _currentDemand < starterDemand) {
            const float dtSec = (now - _lastRampMs) * 0.001f;
            _lastRampMs = now;
            const float step = rampPctPerSec * 0.01f * dtSec;
            _currentDemand = fminf(_currentDemand + step, starterDemand);
            ed.starterDemand = _currentDemand;
        } else {
            ed.starterDemand = starterDemand;
        }
    }

    unsigned long _entryMs = 0;
    unsigned long _lastRampMs = 0;
    float         _currentDemand = 0.0f;
    bool          _completedNormally = false;
    bool          _assistStarted = false;
    PulsedStarterAssist _assist;
};
