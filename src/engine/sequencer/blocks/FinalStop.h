#pragma once
#include "../IBlock.h"
#include "../../EngineData.h"
#include "../../../system/HardwareConfig.h"
#include <Arduino.h>
#include <math.h>

// Final shutdown: wait for the selected shafts or the configured delay, then cut main oil.
class FinalStop : public IBlock {
public:
    enum class SpeedSource : uint8_t { N1, N2, BothFitted, TimerOnly };
    SpeedSource   speedSource      = SpeedSource::N1;
    float         rpmZeroThreshold = 100.0f;
    unsigned long timeoutMs        = 10000;
    unsigned long oilScavengeMs    = 0;      // scavenge pump extra runtime after main oil cut (0 = disabled)

    const char* name() override { return "FinalStop"; }

    static bool hasRequiredSpeedInputs(SpeedSource source) {
        const uint8_t required = requiredShafts(source);
        return source == SpeedSource::TimerOnly ||
               (required != 0 && (required & fittedShafts()) == required);
    }

    void onEnter() override {
        _entryMs    = millis();
        _stoppedMs  = 0;
        _phase      = 0;
        _timedOut   = false;
    }

    BlockResult tick() override {
        auto& ed = EngineData::instance();
        unsigned long now = millis();

        if (_phase == 0) {
            const uint8_t required = requiredShafts(speedSource);
            const bool needN1 = (required & N1Mask) != 0;
            const bool needN2 = (required & N2Mask) != 0;
            const float n1 = ed.n1Rpm;
            const float n2 = ed.n2Rpm;
            const bool n1Valid = ed.n1Healthy && isfinite(n1) && n1 >= 0.0f;
            const bool n2Valid = ed.n2Healthy && isfinite(n2) && n2 >= 0.0f;
            const bool timedOnly = speedSource == SpeedSource::TimerOnly;
            const bool inputsFitted = hasRequiredSpeedInputs(speedSource);
            const bool stopped = !timedOnly && inputsFitted &&
                                 (!needN1 || (n1Valid && n1 <= rpmZeroThreshold)) &&
                                 (!needN2 || (n2Valid && n2 <= rpmZeroThreshold));
            const unsigned long elapsed = now - _entryMs;
            const bool delayEnded = elapsed >= timeoutMs;
            _timedOut = !timedOnly && !stopped && delayEnded;
            if (stopped || delayEnded) {
                // Cut main oil pump
                ed.oilTargetBar    = 0;
                ed.oilPumpPct = 0;
                // Start scavenge phase if pump is fitted and duration > 0
                if (oilScavengeMs > 0 && HardwareConfig::hasOilScavengePump) {
                    ed.oilScavengeDemand = 1.0f;
                    _stoppedMs = now;
                    _phase     = 1;
                } else {
                    clearWaitReason();
                    return _timedOut ? BlockResult::TimeoutContinue : BlockResult::Complete;
                }
            } else {
                char reason[80];
                if (timedOnly)
                    snprintf(reason, sizeof(reason), "Spool-down delay: %lu ms remaining", timeoutMs - elapsed);
                else if (!inputsFitted)
                    snprintf(reason, sizeof(reason), "Required speed sensor missing (%lu ms left)", timeoutMs - elapsed);
                else if ((needN1 && !n1Valid) || (needN2 && !n2Valid))
                    snprintf(reason, sizeof(reason), "%s speed unavailable (%lu ms left)",
                             needN1 && !n1Valid ? "N1" : "N2", timeoutMs - elapsed);
                else if (needN1 && needN2)
                    snprintf(reason, sizeof(reason), "Waiting for stop: N1 %.0f RPM, N2 %.0f RPM", n1, n2);
                else
                    snprintf(reason, sizeof(reason), "Waiting for stop: %s %.0f RPM", needN1 ? "N1" : "N2", needN1 ? n1 : n2);
                setWaitReason(reason);
            }
        }
        if (_phase == 1) {
            if ((now - _stoppedMs) >= oilScavengeMs) {
                clearWaitReason();
                return _timedOut ? BlockResult::TimeoutContinue : BlockResult::Complete;
            }
            char _buf[80];
            snprintf(_buf, sizeof(_buf), "Scavenge: %lu ms remaining", oilScavengeMs - (now - _stoppedMs));
            setWaitReason(_buf);
        }
        return BlockResult::Running;
    }

    void onExit() override {
        auto& ed = EngineData::instance();
        ed.oilTargetBar     = 0;
        ed.oilPumpPct  = 0;
        ed.oilScavengeDemand = 0.0f;
    }

private:
    static constexpr uint8_t N1Mask = 1;
    static constexpr uint8_t N2Mask = 2;

    static uint8_t fittedShafts() {
        return (HardwareConfig::hasN1Rpm ? N1Mask : 0) |
               (HardwareConfig::hasN2Rpm ? N2Mask : 0);
    }

    static uint8_t requiredShafts(SpeedSource source) {
        switch (source) {
            case SpeedSource::N1: return N1Mask;
            case SpeedSource::N2: return N2Mask;
            case SpeedSource::BothFitted: return fittedShafts();
            case SpeedSource::TimerOnly: return 0;
        }
        return 0;
    }

    unsigned long _entryMs   = 0;
    unsigned long _stoppedMs = 0;
    int           _phase     = 0;
    bool          _timedOut  = false;
};
