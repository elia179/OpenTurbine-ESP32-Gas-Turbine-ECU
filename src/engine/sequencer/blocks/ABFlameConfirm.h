#pragma once
#include "../IBlock.h"
#include "../SequenceIgnition.h"
#include "../../EngineData.h"
#include "../../../system/Config.h"
#include <Arduino.h>

// ============================================================
//  ABFlameConfirm — waits for afterburner flame confirmation
//
//  flameMode:
//    0 = verified sensor: require a fresh OFF-to-ON transition
//    1 = EGT rise  : wait for selected EGT to rise >= totRiseDegC within totRiseWindowMs
//    2 = timed     : wait assumeIgnitedMs then assume lit
//    3 = external level: accept a fresh conditioned ON level
//
//  If flameTimeoutMs elapses without confirmation → Fault.
//  Clears igniter2On on exit regardless of mode.
// ============================================================

class ABFlameConfirm : public IBlock {
public:
    int   flameMode        = 2;       // 0=verified edge, 1=EGT rise, 2=timed, 3=external level
    float totRiseDegC      = 30.0f;   // required EGT rise (mode 1)
    int   totRiseWindowMs  = 2000;    // window for EGT rise (mode 1)
    int   assumeIgnitedMs  = 1500;    // timed mode delay (mode 2)
    int   flameTimeoutMs   = 3000;    // overall timeout → Fault

    const char* name() override { return "ABFlameConfirm"; }

    void onEnter() override {
        _startMs     = millis();
        clearWaitReason();
        _onSampleSeen = false;
        Serial.printf("[AB] FlameConfirm: mode=%d timeout=%d ms\n", flameMode, flameTimeoutMs);
    }

    BlockResult tick() override {
        auto& ed = EngineData::instance();
        const uint32_t now = millis();
        const uint32_t elapsed = now - _startMs;

        // Bench mode: simulate confirmed AB flame after assumeIgnitedMs — no real sensor needed.
        // Uses the timed path regardless of flameMode so mode 0/1 don't fault on timeout.
        if (ed.benchMode) {
            if (elapsed >= (unsigned long)assumeIgnitedMs) {
                clearWaitReason();
                ed.abEvidenceValid = true;
                ed.abConfirmedMs = now;
                Serial.println("[AB] FlameConfirm: BENCH - simulating AB flame confirmed");
                return BlockResult::Complete;
            }
            return BlockResult::Running;
        }

        const uint32_t fuelElapsed = now - ed.abFirstFuelMs;
        if ((ed.abFuelStarted ? fuelElapsed : elapsed) > static_cast<uint32_t>(flameTimeoutMs)) {
            return fault(ed, "AB FLAME NOT CONFIRMED - RELEASE CONTROL TO RETRY");
        }
        if (!ed.abFuelStarted) {
            setWaitReason("Waiting for afterburner fuel demand");
            return BlockResult::Running;
        }
        setWaitReason("Waiting for light-up evidence");

        switch (flameMode) {
            case 0: // dedicated sensor
                if (!ed.abFlameHealthy) {
                    return fault(ed, "AB FLAME INPUT UNAVAILABLE - RELEASE CONTROL TO RETRY");
                }
                if (!ed.abFlameOffObserved) {
                    return fault(ed, "AB FLAME INPUT WAS NOT OFF BEFORE FUEL - RELEASE CONTROL TO RETRY");
                }
                if (confirmedFlameLevel(ed, ed.abFlameSampleSeq != ed.abFlameOffSampleSeq)) {
                    clearWaitReason();
                    ed.abEvidenceValid = true;
                    ed.abConfirmedMs = now;
                    Serial.println("[AB] FlameConfirm: sensor detected flame");
                    return BlockResult::Complete;
                }
                break;

            case 1: // EGT rise
            {
                // EGT-rise confirmation cannot be trusted without the selected sensor.
                if (!Config::primaryEgtHealthy(ed)) {
                    return fault(ed, "EGT INPUT UNAVAILABLE DURING AB IGNITION - RELEASE CONTROL TO RETRY");
                }
                if (!ed.abEgtBaselineValid) {
                    return fault(ed, "PRE-IGNITION EGT BASELINE UNAVAILABLE - RELEASE CONTROL TO RETRY");
                }
                const bool useTit = Config::effectiveEgtSource() == 2;
                const uint32_t seq = useTit ? ed.titSampleSeq : ed.totSampleSeq;
                const uint32_t sampleMs = useTit ? ed.titSampleMs : ed.totSampleMs;
                const uint32_t sampleElapsed = sampleMs - ed.abFirstFuelMs;
                const float rise = Config::primaryEgtC(ed) - ed.abEgtBaseline;
                const bool withinRiseWindow = totRiseWindowMs == 0 ||
                    sampleElapsed <= static_cast<uint32_t>(totRiseWindowMs);
                if (seq != ed.abEgtBaselineSampleSeq && static_cast<int32_t>(sampleElapsed) > 0 &&
                    withinRiseWindow && rise >= totRiseDegC) {
                    clearWaitReason();
                    ed.abEvidenceValid = true;
                    ed.abConfirmedMs = now;
                    Serial.printf("[AB] FlameConfirm: EGT rose %.1f C - confirmed\n",
                                  (double)rise);
                    return BlockResult::Complete;
                }
                if (totRiseWindowMs > 0 &&
                    fuelElapsed >= static_cast<uint32_t>(totRiseWindowMs)) {
                    return fault(ed, "EGT DID NOT RISE IN AB WINDOW - RELEASE CONTROL TO RETRY");
                }
                break;
            }

            case 2: // timed assumption
                if (elapsed >= static_cast<uint32_t>(assumeIgnitedMs) &&
                    fuelElapsed >= static_cast<uint32_t>(assumeIgnitedMs)) {
                    clearWaitReason();
                    ed.abEvidenceValid = true;
                    ed.abConfirmedMs = now;
                    Serial.printf("[AB] FlameConfirm: timed - assuming lit after %d ms\n",
                                  assumeIgnitedMs);
                    return BlockResult::Complete;
                }
                break;

            case 3: // externally conditioned level; no pre-attempt OFF requirement
                if (!ed.abFlameHealthy)
                    return fault(ed, "AB FLAME INPUT UNAVAILABLE - RELEASE CONTROL TO RETRY");
                if (confirmedFlameLevel(ed, ed.abFlameSampleSeq != 0)) {
                    ed.abEvidenceValid = true;
                    ed.abConfirmedMs = now;
                    clearWaitReason();
                    return BlockResult::Complete;
                }
                break;

            default:
                // Unknown mode cannot verify AB flame — fail safe. Completing
                // here would leave the AB solenoid open with zero verification.
                return fault(ed, "INVALID AB FLAME MODE - RELEASE CONTROL TO RETRY");
        }

        return BlockResult::Running;
    }

    void onExit() override {
        clearWaitReason();
        // Release the exact ignition device(s) used by this sequence.
        clearSequenceIgnitionOutputs();
    }

private:
    uint32_t _startMs = 0;
    bool _onSampleSeen = false;
    uint32_t _firstOnSampleMs = 0;

    bool confirmedFlameLevel(const EngineData& ed, bool validSequence) {
        const uint32_t sampleMs = ed.abFlameSampleMs;
        if (!validSequence || !ed.abFlameOn ||
            static_cast<int32_t>(sampleMs - ed.abFirstFuelMs) <= 0) {
            _onSampleSeen = false;
            return false;
        }
        if (!_onSampleSeen) {
            _onSampleSeen = true;
            _firstOnSampleMs = sampleMs;
        }
        return sampleMs - _firstOnSampleMs >= 100U;
    }

    BlockResult fault(EngineData& ed, const char* reason) {
        clearWaitReason();
        snprintf(ed.abFaultReason, sizeof(ed.abFaultReason), "%s", reason);
        Serial.printf("[AB] FlameConfirm fault: %s\n", reason);
        return BlockResult::Fault;
    }
};
