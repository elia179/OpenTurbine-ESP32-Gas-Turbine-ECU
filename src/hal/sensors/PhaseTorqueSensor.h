#pragma once

#include <Arduino.h>
#include <driver/mcpwm_cap.h>
#include <math.h>
#include "PhaseTorqueMath.h"

// One reference and one phase pickup on the same MCPWM capture timer. The ISR
// only remembers edge timestamps; period, phase, health and filtering are main-
// loop work. A missing phase pickup cannot invalidate the reference speed.
class PhaseTorqueSensor {
public:
    bool begin(int referencePin, int phasePin, float pulsesPerRev,
               float phasePulsesPerRev) {
        if (referencePin < 0 || phasePin < 0 || referencePin == phasePin ||
            !isfinite(pulsesPerRev) || pulsesPerRev <= 0 ||
            !isfinite(phasePulsesPerRev) || phasePulsesPerRev <= 0 ||
            fabsf(phasePulsesPerRev - pulsesPerRev) > 0.0001f) return false;
        _ppr = pulsesPerRev;
        mcpwm_capture_timer_config_t timerConfig = {};
        timerConfig.group_id = 0;
        timerConfig.clk_src = MCPWM_CAPTURE_CLK_SRC_DEFAULT;
        if (mcpwm_new_capture_timer(&timerConfig, &_timer) != ESP_OK) return fail();
        if (mcpwm_capture_timer_get_resolution(_timer, &_resolution) != ESP_OK || !_resolution)
            return fail();
        mcpwm_capture_channel_config_t channelConfig = {};
        channelConfig.prescale = 1;
        channelConfig.flags.pos_edge = true;
        channelConfig.gpio_num = referencePin;
        if (mcpwm_new_capture_channel(_timer, &channelConfig, &_referenceChannel) != ESP_OK)
            return fail();
        channelConfig.gpio_num = phasePin;
        if (mcpwm_new_capture_channel(_timer, &channelConfig, &_phaseChannel) != ESP_OK)
            return fail();
        _referenceContext = {this, true};
        _phaseContext = {this, false};
        mcpwm_capture_event_callbacks_t callbacks = {};
        callbacks.on_cap = &onCapture;
        if (mcpwm_capture_channel_register_event_callbacks(_referenceChannel, &callbacks,
                                                           &_referenceContext) != ESP_OK ||
            mcpwm_capture_channel_register_event_callbacks(_phaseChannel, &callbacks,
                                                           &_phaseContext) != ESP_OK ||
            mcpwm_capture_timer_enable(_timer) != ESP_OK ||
            mcpwm_capture_channel_enable(_referenceChannel) != ESP_OK ||
            mcpwm_capture_channel_enable(_phaseChannel) != ESP_OK ||
            mcpwm_capture_timer_start(_timer) != ESP_OK) return fail();
        _ready = true;
        return true;
    }

    void update(float zeroDeg, float degreesPerNm, float alpha, float maxRpm) {
        if (!_ready) return;
        const uint32_t now = millis();
        if (now - _lastProcessMs < 50U) return;
        _lastProcessMs = now;
        Snapshot s;
        portENTER_CRITICAL(&_lock);
        s = {_lastReference, _previousReference, _referenceSeq,
             _lastPhase, _previousPhase, _phaseSeq};
        portEXIT_CRITICAL(&_lock);
        if (s.referenceSeq != _seenReferenceSeq) {
            _seenReferenceSeq = s.referenceSeq;
            _lastReferenceMs = now;
            const uint32_t ticks = s.lastReference - s.previousReference;
            const float rpm = ticks ? 60.0f * _resolution / (ticks * _ppr) : 0.0f;
            const float ceiling = isfinite(maxRpm) && maxRpm > 0 ? maxRpm * 2.0f : 120000.0f;
            // Reject edge rates above 20 kHz per pickup: repeated callbacks
            // beyond that rate would consume too much ECU loop time.
            _speedHealthy = s.referenceSeq >= 2 && ticks >= _resolution / 20000U &&
                            ticks <= _resolution * 2U && rpm <= ceiling;
            if (_speedHealthy) {
                _periodTicks = ticks;
                _rpm = rpm;
                ++_speedSampleSeq;
                _speedSampleMs = now;
            }
        }
        if (now - _lastReferenceMs > pulseTimeoutMs()) _speedHealthy = false;

        if (s.phaseSeq != _seenPhaseSeq) {
            _seenPhaseSeq = s.phaseSeq;
            _lastPhaseMs = now;
            if (_speedHealthy && _periodTicks && s.phaseSeq >= 2) {
                const uint32_t phasePeriod = s.lastPhase - s.previousPhase;
                // Reject doubled/missing edges; speed still uses the reference.
                const bool phasePeriodGood = phasePeriod >= _periodTicks * 0.7f &&
                                             phasePeriod <= _periodTicks * 1.3f;
                if (phasePeriodGood) {
                    // Signed nearest tooth phase; unsigned subtraction survives
                    // hardware timer wrap. One tooth is 360 / pulses-per-rev shaft degrees.
                    _phaseDeg = PhaseTorqueMath::shaftPhaseDegrees(
                        s.lastPhase, s.lastReference, _periodTicks, _ppr);
                    const float shifted = PhaseTorqueMath::wrappedDeltaDegrees(
                        _phaseDeg, zeroDeg, _ppr);
                    if (isfinite(degreesPerNm) && fabsf(degreesPerNm) >= 0.000001f) {
                        const float measured = shifted / degreesPerNm;
                        alpha = constrain(alpha, 0.001f, 1.0f);
                        _torque = _torqueHealthy ? _torque + alpha * (measured - _torque) : measured;
                        _torqueHealthy = isfinite(_torque);
                        if (_torqueHealthy) { ++_torqueSampleSeq; _torqueSampleMs = now; }
                    }
                } else _torqueHealthy = false;
            }
        }
        if (!_speedHealthy || now - _lastPhaseMs > pulseTimeoutMs()) _torqueHealthy = false;
    }

    bool hardwareReady() const { return _ready; }
    bool speedHealthy() const { return _speedHealthy; }
    bool torqueHealthy() const { return _torqueHealthy; }
    float rpm() const { return _rpm; }
    float torqueNm() const { return _torque; }
    float phaseDegrees() const { return _phaseDeg; }
    uint32_t speedSampleSeq() const { return _speedSampleSeq; }
    uint32_t speedSampleMs() const { return _speedSampleMs; }
    uint32_t torqueSampleSeq() const { return _torqueSampleSeq; }
    uint32_t torqueSampleMs() const { return _torqueSampleMs; }

private:
    struct Context { PhaseTorqueSensor* sensor; bool reference; };
    struct Snapshot {
        uint32_t lastReference, previousReference, referenceSeq;
        uint32_t lastPhase, previousPhase, phaseSeq;
    };
    uint32_t pulseTimeoutMs() const {
        if (!_periodTicks || !_resolution) return 600U;
        // Allow three expected tooth periods at low shaft speed while still
        // invalidating a missing pickup promptly at normal operating speed.
        const uint64_t threePeriodsMs = 3000ULL * _periodTicks / _resolution;
        return (uint32_t)constrain((float)threePeriodsMs, 600.0f, 3000.0f);
    }
    static bool IRAM_ATTR onCapture(mcpwm_cap_channel_handle_t,
                                    const mcpwm_capture_event_data_t* event, void* user) {
        auto* context = static_cast<Context*>(user);
        auto* self = context->sensor;
        portENTER_CRITICAL_ISR(&self->_lock);
        if (context->reference) {
            self->_previousReference = self->_lastReference;
            self->_lastReference = event->cap_value;
            self->_referenceSeq = self->_referenceSeq + 1U;
        } else {
            self->_previousPhase = self->_lastPhase;
            self->_lastPhase = event->cap_value;
            self->_phaseSeq = self->_phaseSeq + 1U;
        }
        portEXIT_CRITICAL_ISR(&self->_lock);
        return false;
    }
    bool fail() {
        // A failed allocation leaves the ECU visibly unready. Release partial
        // timer/channel claims so another MCPWM user is not starved.
        if (_timer) mcpwm_capture_timer_stop(_timer);
        if (_phaseChannel) {
            mcpwm_capture_channel_disable(_phaseChannel);
            mcpwm_del_capture_channel(_phaseChannel);
            _phaseChannel = nullptr;
        }
        if (_referenceChannel) {
            mcpwm_capture_channel_disable(_referenceChannel);
            mcpwm_del_capture_channel(_referenceChannel);
            _referenceChannel = nullptr;
        }
        if (_timer) {
            mcpwm_capture_timer_disable(_timer);
            mcpwm_del_capture_timer(_timer);
            _timer = nullptr;
        }
        _ready = false;
        return false;
    }
    portMUX_TYPE _lock = portMUX_INITIALIZER_UNLOCKED;
    mcpwm_cap_timer_handle_t _timer = nullptr;
    mcpwm_cap_channel_handle_t _referenceChannel = nullptr, _phaseChannel = nullptr;
    Context _referenceContext = {}, _phaseContext = {};
    volatile uint32_t _lastReference = 0, _previousReference = 0, _referenceSeq = 0;
    volatile uint32_t _lastPhase = 0, _previousPhase = 0, _phaseSeq = 0;
    uint32_t _resolution = 0, _periodTicks = 0;
    float _ppr = 1.0f, _rpm = 0.0f, _phaseDeg = 0.0f, _torque = 0.0f;
    uint32_t _seenReferenceSeq = 0, _seenPhaseSeq = 0;
    uint32_t _lastProcessMs = 0;
    uint32_t _lastReferenceMs = 0, _lastPhaseMs = 0;
    uint32_t _speedSampleSeq = 0, _speedSampleMs = 0;
    uint32_t _torqueSampleSeq = 0, _torqueSampleMs = 0;
    bool _ready = false, _speedHealthy = false, _torqueHealthy = false;
};
