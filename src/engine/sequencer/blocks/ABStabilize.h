#pragma once
#include "../IBlock.h"
#include "../../EngineData.h"
#include "../../../system/Config.h"
#include <Arduino.h>

// ============================================================
//  ABStabilize - hold after AB lights, monitor selected EGT.
//
//  Waits stabilizeMs to confirm a stable AB burn.
//  If stabilizeMaxTot > 0 and selected EGT exceeds it, fault.
//  The ignition sequence promotes to Running after all its blocks finish.
// ============================================================

class ABStabilize : public IBlock {
public:
    int   stabilizeMs     = 1000;
    float stabilizeMaxTot = 0.0f;    // 0 = disabled

    const char* name() override { return "ABStabilize"; }

    void onEnter() override {
        _startMs = millis();
        Serial.printf("[AB] Stabilize: holding %d ms\n", stabilizeMs);
    }

    BlockResult tick() override {
        auto& ed = EngineData::instance();

        if (!ed.abEvidenceValid) {
            snprintf(ed.abFaultReason, sizeof(ed.abFaultReason),
                     "%s", "AB FLAME EVIDENCE LOST - RELEASE CONTROL TO RETRY");
            return BlockResult::Fault;
        }
        // EGT guard.
        if (stabilizeMaxTot > 0 && !Config::primaryEgtHealthy(ed)) {
            Serial.println("[AB] Stabilize fault: EGT sensor unavailable");
            return BlockResult::Fault;
        }
        if (stabilizeMaxTot > 0 && Config::primaryEgtHealthy(ed)
            && Config::primaryEgtC(ed) > stabilizeMaxTot) {
            Serial.printf("[AB] Stabilize: EGT %.1f > limit %.1f - FAULT\n",
                          (double)Config::primaryEgtC(ed), (double)stabilizeMaxTot);
            return BlockResult::Fault;
        }

        if ((millis() - _startMs) >= (unsigned long)stabilizeMs)
            return BlockResult::Complete;
        return BlockResult::Running;
    }

private:
    unsigned long _startMs = 0;
};
