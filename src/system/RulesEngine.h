#pragma once
#include "../hal/actuators/RelayDemand.h"
#include "../hal/SwitchTiming.h"
// ============================================================
//  RulesEngine — deterministic threshold and linear-map simple controls,
//  evaluated every control tick.
//
//  Simple controls are edited on Controllers and stored in the settings
//  section of ecu_config.json under "rules".
//
//  Scheduled controllers own their outputs from activation until explicit or
//  state-entry deactivation. Release applies the Hardware safe demand. Older
//  mode-mask definitions retain their previous phase/overlay behavior until
//  timing is reviewed. Protective turbine functions retain final authority.
// ============================================================
#include "Config.h"
#include "ConfigInternal.h"
#include "FeedbackControlMath.h"
#include "HardwareConfig.h"
#include "../engine/EngineData.h"
#include "../engine/controllers/IdleFuelFloor.h"
#include "../engine/controllers/ControllerActivation.h"

class RulesEngine {
public:
    static bool lifecycleActive(uint8_t index) { return _activation.active(index); }
    static ControllerActivation::Target controllerTarget(uint8_t index) {
        const auto act=Config::rules[index].actuator;
        // Independent shutdown requests do not own a shared physical output.
        if (act==REQUEST_SHUTDOWN || act==REQUEST_FAULT) return {uint8_t(128+index),255};
        return {act, uint8_t(act==STARTER ? STARTER_ENABLE : 255)};
    }


    static void cancelActivation() {
        releaseOwnedTargets();
        _activation.fault([](uint8_t i) { safeController(i); });
        _activation.reset();
        // Saving is not an engine-state entry and must not re-engage a rule.
        // Retain 255 on the first boot load so initial state entry still runs.
        if (_activationMode != 255) _activationMode = (uint8_t)EngineData::instance().mode;
    }
    static void releaseForConfiguration() { cancelActivation(); }

    static int8_t controllerIndex(uint16_t id) {
        for (int i = 0; i < Config::ruleCount; ++i)
            if (Config::rules[i].controllerId == id) return (int8_t)i;
        return -1;
    }

    static void blockDisplayName(const char* key, char* out, size_t size) {
        bool on=false;
        const uint16_t id=ControllerActivation::blockId(key,&on);
        const int8_t index=id?controllerIndex(id):-1;
        if(index>=0)snprintf(out,size,"%s: %s",on?"On":"Off",Config::rules[index].name);
        else strlcpy(out,key?key:"",size);
    }

    static void safeController(uint8_t index) {
        _confirmation[index].reset();
        const uint8_t actuator = Config::rules[index].actuator;
        _applyActuator(actuator, Config::rules[index].safeDemand, EngineData::instance(), nullptr);
        _ruleLatched[index] = false;
        FeedbackControlMath::reset(_feedbackState[index]);
    }

    static void prepareStart() {
        releaseOwnedTargets();
        const uint16_t mask = EngineData::instance().controllerInhibitMask;
        for (uint8_t i=0; i<Config::ruleCount; ++i)
            if (mask & (uint16_t(1)<<i)) _activation.deactivate(i, [](uint8_t j) { safeController(j); });
        _activation.inhibit(mask);
    }

    static void modeEntered(SysMode mode) {
        const auto& ed = EngineData::instance();
        if (mode == SysMode::FAULT || ed.faultLatched || ed.faultShutdownActive) {
            releaseOwnedTargets();
            _activation.fault([](uint8_t i) { safeController(i); });
            _activationMode = (uint8_t)mode;
            return;
        }
        if (_activationMode == (uint8_t)mode) return;
        if (mode==SysMode::STANDBY) _activation.inhibit(ed.controllerInhibitMask);
        releaseOwnedTargets();
        _activationMode = (uint8_t)mode;
        const auto event = mode == SysMode::STANDBY ? ControllerActivation::Standby :
            mode == SysMode::STARTUP ? ControllerActivation::Startup :
            mode == SysMode::RUNNING ? ControllerActivation::Running : ControllerActivation::Shutdown;
        const auto result = _activation.enter(event, Config::rules, Config::ruleCount,
            [](uint8_t i) { return controllerTarget(i); },
            [](uint8_t i) { safeController(i); });
        if (result == ControllerActivation::Conflict && _faultCb) _faultCb("CONTROLLER_OWNERSHIP");
    }

    static bool inactiveControllerBlock(const char* name) {
        bool on=false;
        const uint16_t id=ControllerActivation::blockId(name,&on);
        if (!id) return false;
        const int8_t index=controllerIndex(id);
        return index<0 || !Config::rules[index].enabled || _activation.inhibited(index) ||
            !((on?Config::rules[index].activateEvents:Config::rules[index].deactivateEvents)&1);
    }

    static bool controllerCommand(uint16_t id, bool activate) {
        modeEntered(EngineData::instance().mode);
        const int8_t index = controllerIndex(id);
        if (index < 0) return true; // orphan controller link: inert
        const auto& rule = Config::rules[index];
        if (!rule.enabled || _activation.inhibited(index)) return true; // explicitly disabled: linked blocks are inert
        if (!activate) {
            if (!(rule.deactivateEvents & 1)) return true;
            releaseOwnedTargets();
            _activation.deactivate(index, [](uint8_t i) { safeController(i); });
            return true;
        }
        if (!(rule.activateEvents & 1)) return true;
        const bool wasActive = _activation.active(index);
        const auto result = _activation.activate(index, Config::rules, Config::ruleCount,
            [](uint8_t i) { return controllerTarget(i); });
        if (result == ControllerActivation::Ok && !wasActive) {
            _ruleLatched[index] = false;
            FeedbackControlMath::reset(_feedbackState[index]);
        }
        return result == ControllerActivation::Ok;
    }

    static int8_t controllerOwner(uint8_t actuator) {
        for (int i = 0; i < Config::ruleCount; ++i)
            if (Config::rules[i].enabled && _activation.active(i) &&
                controllerTarget(i) == ControllerActivation::Target{actuator, uint8_t(actuator==STARTER ? STARTER_ENABLE : 255)}) return (int8_t)i;
        return -1;
    }

    // Sensor indices (match UI dropdown order)
    enum Sensor   : uint8_t { OIL_TEMP=0, TOT=1, N1_RPM=2, OIL_PRESS=3, TIT=4, BATT_V=5, N2_RPM=6,
                              DI_CH0=7, DI_CH1=8, DI_CH2=9, DI_CH3=10, FUEL_PRESS=11,
                              FUEL_FLOW=12, P1=13, P2=14, TORQUE=15, FLAME=16,
                              THROTTLE_INPUT=17, IDLE_INPUT=18, AB_FLAME=19,
                              GLOW_CURRENT=20, IGNITER_CURRENT=21, IGNITER2_CURRENT=22,
                              OIL_PUMP_CURRENT=23, AB_INPUT=24, START_SWITCH=25, STOP_SWITCH=26,
                              THRUST=27 };
    // Comparison operators
    enum Op       : uint8_t { GT=0, LT=1, GTE=2, LTE=3, EQ=4 };
    // Controllable actuators
    enum Actuator : uint8_t { COOL_FAN=0, BLEED_VALVE=1, FUEL_PUMP2=2, OIL_SCAVENGE=3,
                              THROTTLE=4, STARTER=5, STARTER_ENABLE=6, OIL_PUMP=7,
                              FUEL_SOL=8, IGNITER=9, IGNITER2=10, AB_SOL=11, AB_PUMP=12,
                              REQUEST_SHUTDOWN=13, REQUEST_FAULT=14, AIRSTARTER=15,
                              GLOW_PLUG=16, PROP_PITCH=17 };

    using ShutdownCallback = void (*)();
    using FaultCallback = void (*)(const char*);
    static void begin(ShutdownCallback shutdownCb, FaultCallback faultCb) {
        _shutdownCb = shutdownCb;
        _faultCb = faultCb;
    }

    static bool actuatorUsable(uint8_t act) {
        return _actuatorUsable(act);
    }

    static bool applyActuatorDemand(uint8_t act, float dem) {
        if (!_actuatorUsable(act) || controllerOwner(act) >= 0) return false;
        _applyActuator(act, constrain(dem, 0.0f, 1.0f), EngineData::instance(), nullptr);
        return true;
    }

    static void applyProtectedActuatorDemand(uint8_t act, float dem) {
        if (_actuatorUsable(act))
            _applyActuator(act, constrain(dem,0.0f,1.0f), EngineData::instance(), nullptr);
    }

    static uint32_t sequenceOutputMask(const char* name) {
        if (!strcmp(name,"FuelPumpIdle") || !strcmp(name,"ModifiedIdle")) return 1u<<THROTTLE;
        if (!strcmp(name,"Spool")) return (1u<<THROTTLE)|(1u<<STARTER)|(1u<<STARTER_ENABLE);
        if (!strcmp(name,"StarterSpin") || !strcmp(name,"SafetyHold")) return (1u<<STARTER)|(1u<<STARTER_ENABLE);
        if (!strcmp(name,"OilPrime")) return (1u<<OIL_PUMP)|(1u<<OIL_SCAVENGE);
        if (!strcmp(name,"ABIgnite")) return (1u<<AB_PUMP)|(1u<<AB_SOL)|(1u<<IGNITER2)|(1u<<THROTTLE)|(1u<<GLOW_PLUG);
        return 0;
    }
    static bool sequenceBlockConflict(const char* name) {
        const uint32_t mask=sequenceOutputMask(name);
        for (int i=0;i<Config::ruleCount;++i)
            if (_activation.active(i) && Config::rules[i].actuator<32 &&
                (mask&(1u<<Config::rules[i].actuator))) return true;
        return false;
    }

    static bool sensorConditionMet(uint8_t sensor, uint8_t op, float threshold) {
        auto& ed = EngineData::instance();
        return _sensorUsable(sensor, ed) && _evalOp(_readSensor(sensor, ed), op, threshold, sensor);
    }

    // Clear per-rule hysteresis latches. Called after the rules array is
    // reloaded or compacted so a previous rule's latched state cannot apply
    // to a different rule that now occupies the same index.
    static void resetLatches() {
        _activation.reset();
        for (int i = 0; i < Config::MAX_RULES; i++) {
            _ruleLatched[i] = false;
            _confirmation[i].reset();
            FeedbackControlMath::reset(_feedbackState[i]);
        }
    }

    // Called before sequencers/controllers calculate this tick's ordinary
    // demands. It removes last tick's rule overlay so those owners always
    // start from the last non-rule command rather than their own stale value.
    static void releaseOwnedTargets() {
        auto& ed = EngineData::instance();
        for (uint8_t i = 0; i < _ownedTargetCount; ++i)
            if (_actuatorUsable(_ownedTargets[i]))
                _applyActuator(_ownedTargets[i], _ownedBaseDemands[i], ed, nullptr);
        _ownedTargetCount = 0;
    }

    // Called once per configured control-loop tick on Core 1.
    static void evaluate() {
        auto& ed = EngineData::instance();
        const SysMode modeAtStart = ed.mode;
        // FAULT is never an automation state. The caller has already released
        // the previous overlay; do not claim or alter any target here.
        if (ed.mode == SysMode::FAULT) {
            for (int i = 0; i < Config::MAX_RULES; ++i) {
                _confirmation[i].reset();
                FeedbackControlMath::reset(_feedbackState[i]);
            }
            return;
        }

        for (int i = 0; i < Config::ruleCount; i++) {
            const Config::Rule& r = Config::rules[i];
            const uint8_t modeBit = (uint8_t)(1u << (int)ed.mode);
            const bool activeState = r.enabled && !_activation.inhibited(i) &&
                                     (r.activateEvents == 0 ? (r.modeMask & modeBit) != 0 : _activation.active(i)) &&
                                     _actuatorUsable(r.actuator);
            if (!activeState) {
                _ruleLatched[i] = false;
                _confirmation[i].reset();
                FeedbackControlMath::reset(_feedbackState[i]);
                continue;
            }
            const float baseDemand = _readActuatorDemand(r.actuator, ed);
            if (!_targetPresent(_ownedTargets, _ownedTargetCount, r.actuator) &&
                _ownedTargetCount < Config::MAX_RULES) {
                _ownedTargets[_ownedTargetCount] = r.actuator;
                _ownedBaseDemands[_ownedTargetCount] = r.activateEvents == 0 ? baseDemand : r.safeDemand;
                ++_ownedTargetCount;
            }
            const bool inputHealthy = r.kind == 3 || _sensorUsable(r.sensor, ed);
            const bool targetHealthy = r.kind != 2 || r.targetSourceType == 0 ||
                                       _sensorUsable(r.targetSensor, ed);
            const bool applies = inputHealthy && targetHealthy;
            float demand = r.activateEvents == 0 ? r.offValue : r.safeDemand;

            if (applies) {
                if (r.kind!=0) _confirmation[i].reset();
                const float value = r.kind == 3 ? 0.0f : _readSensor(r.sensor, ed);
                if (r.kind == 3) {
                    demand = r.onValue;
                    _ruleLatched[i] = false;
                    FeedbackControlMath::reset(_feedbackState[i]);
                } else if (r.kind == 2) {
                    float target = r.targetFixed;
                    if (r.targetSourceType == 1) {
                        target = _readSensor(r.targetSensor, ed) >= 0.5f
                            ? r.targetHigh : r.targetLow;
                    } else if (r.targetSourceType == 2) {
                        const float source = _readSensor(r.targetSensor, ed);
                        const float span = r.targetInputMax - r.targetInputMin;
                        const float mapped = span != 0.0f
                            ? constrain((source - r.targetInputMin) / span, 0.0f, 1.0f)
                            : 0.0f;
                        target = r.targetLow + mapped * (r.targetHigh - r.targetLow);
                    }
                    demand = FeedbackControlMath::step(_feedbackState[i], millis(),
                        baseDemand, value, target, r.responseGain, r.integralGain,
                        r.deadband, r.outputMin, r.outputMax);
                    _ruleLatched[i] = false;
                } else if (r.kind == 1) {
                    const float span = r.inputMax - r.inputMin;
                    const float mapped = span != 0.0f
                        ? constrain((value - r.inputMin) / span, 0.0f, 1.0f)
                        : 0.0f;
                    demand = r.outputMin + mapped * (r.outputMax - r.outputMin);
                    _ruleLatched[i] = false;
                } else {
                    const bool condition = _evalRuleState(i, value, r.op, r.threshold,
                                                          r.hysteresis, r.sensor);
                    const bool met = _confirmation[i].update(condition,millis(),r.confirmMs);
                    demand = met ? r.onValue : r.offValue;
                }
            } else {
                _ruleLatched[i] = false;
                _confirmation[i].reset();
                FeedbackControlMath::reset(_feedbackState[i]);
            }

            // Automatic Idle is a floor, and a selected physical idle input is
            // the equivalent manual floor under the normal Main Fuel request.
            // When Automatic Idle is fitted, its selected N1/N2/P1/P2 feedback owns
            // the floor. Otherwise a configured, healthy idle potentiometer
            // continuously maps the calibrated reliable pump minimum through
            // the configured maximum normal-idle output. The throttle remains
            // free to command above either floor.
            //
            // Do not use baseDemand here: releaseOwnedTargets() restores the
            // previous non-rule demand before controllers run, so that value
            // can contain yesterday's idle floor and prevent an idle source
            // from backing down.
            if (r.activateEvents == 0 && r.actuator == THROTTLE && ed.mode == SysMode::RUNNING) {
                int8_t idleSensor = IDLE_INPUT;
                const bool explicitInput = Config::fuelIdleMode == 3 && Config::fuelIdleInputId[0];
                if (explicitInput)
                    idleSensor = ConfigInternal::ruleSourceHandle(Config::fuelIdleInputId);
                const bool idleHealthy = idleSensor >= 0 && _sensorUsable((uint8_t)idleSensor, ed);
                float idleValue = idleHealthy ? _readSensor((uint8_t)idleSensor, ed) : 0.0f;
                if (explicitInput)
                    idleValue = IdleFuelFloor::normalizedInput(idleValue,
                        Config::fuelIdleInputLow, Config::fuelIdleInputHigh);
                const float idleFloor = IdleFuelFloor::select(
                    Config::fuelIdleMode, HardwareConfig::hasDynamicIdle,
                    idleHealthy, ed.dynamicIdleFloorDemand,
                    idleValue, ed.sequencerIdleDemand,
                    Config::fuelIdleFixedPct / 100.0f,
                    Config::fuelPumpMinPct / 100.0f,
                    Config::throttleIdleMaxPct / 100.0f);
                demand = IdleFuelFloor::apply(demand, idleFloor);
            }

            // Sequence and built-in subsystem requests share auxiliary
            // outputs with optional user controllers. Either owner may ask
            // for starter, oil or ignition, but an ordinary rule may not
            // cancel an active startup/relight/protection request. This keeps
            // a custom RUNNING igniter controller compatible with relight and
            // leaves every output usable without a custom controller.
            if (_usesAdditiveSubsystemAuthority(r.actuator))
                demand = max(demand, baseDemand);

            if (_actuatorUsable(r.actuator))
                _applyActuator(r.actuator, constrain(demand, 0.0f, 1.0f), ed, r.name);
            if (modeAtStart != SysMode::SHUTDOWN && ed.mode == SysMode::SHUTDOWN) return;
        }

    }

    static bool sensorReading(uint8_t sensor, float& value) {
        auto& ed = EngineData::instance();
        if (!_sensorUsable(sensor, ed)) return false;
        value = _readSensor(sensor, ed);
        return true;
    }

private:
    static bool _usesAdditiveSubsystemAuthority(uint8_t act) {
        if (ChannelRegistry::isOutputActuator(act)) {
            const uint8_t idx = ChannelRegistry::outputIndexFromActuator(act);
            if (idx >= HardwareConfig::channelRegistry.outputCount) return false;
            const char* purpose = HardwareConfig::channelRegistry.outputs[idx].purpose;
            return !strcmp(purpose, "starter") || !strcmp(purpose, "starter_enable") ||
                   !strcmp(purpose, "oil_pump") || !strcmp(purpose, "igniter") ||
                   !strcmp(purpose, "ab_igniter") || !strcmp(purpose, "glow_plug") ||
                   !strcmp(purpose, "air_starter");
        }
        return act == STARTER || act == STARTER_ENABLE || act == OIL_PUMP ||
               act == IGNITER || act == IGNITER2 || act == GLOW_PLUG ||
               act == AIRSTARTER;
    }

    static bool _targetPresent(const uint8_t* targets, uint8_t count, uint8_t target) {
        for (uint8_t i = 0; i < count; ++i) if (targets[i] == target) return true;
        return false;
    }
    static float _readActuatorDemand(uint8_t act, const EngineData& ed) {
        if (ChannelRegistry::isOutputActuator(act)) {
            const uint8_t idx = ChannelRegistry::outputIndexFromActuator(act);
            return idx < ChannelRegistry::MAX_OUTPUT_CHANNELS
                ? ed.registryOutputDemand[idx] : 0.0f;
        }
        switch (act) {
            case COOL_FAN: return ed.coolFanDemand;
            case BLEED_VALVE: return ed.bleedValveDemand;
            case FUEL_PUMP2: return ed.fuelPump2Demand;
            case OIL_SCAVENGE: return ed.oilScavengeDemand;
            case THROTTLE: return ed.throttleDemand;
            case STARTER: return ed.starterDemand;
            case STARTER_ENABLE: return ed.starterEnabled ? 1.0f : 0.0f;
            case OIL_PUMP: return ed.oilPumpPct / 100.0f;
            case FUEL_SOL: return ed.fuelSolOpen ? 1.0f : 0.0f;
            case IGNITER: return ed.igniterOn ? 1.0f : 0.0f;
            case IGNITER2: return ed.igniter2On ? 1.0f : 0.0f;
            case AB_SOL: return ed.abSolOpen ? 1.0f : 0.0f;
            case AB_PUMP: return ed.abPumpDemand;
            case AIRSTARTER: return ed.airstarterOpen ? 1.0f : 0.0f;
            case GLOW_PLUG: return ed.glowPlugDemand;
            case PROP_PITCH: return ed.propPitchDemand;
            default: return 0.0f;
        }
    }
    static bool _registryInputPurposePresent(const char* purpose) {
        for (uint8_t i = 0; i < HardwareConfig::channelRegistry.inputCount; ++i) {
            const auto& channel = HardwareConfig::channelRegistry.inputs[i];
            if (!strcmp(channel.purpose, purpose) &&
                ChannelRegistry::channelAddressable(channel)) return true;
        }
        return false;
    }
    static bool _sensorUsable(uint8_t s, const EngineData& ed) {
        if (ChannelRegistry::isInputSensor(s)) {
            uint8_t idx = ChannelRegistry::inputIndexFromSensor(s);
            if (idx >= HardwareConfig::channelRegistry.inputCount) return false;
            const auto& channel = HardwareConfig::channelRegistry.inputs[idx];
            return ChannelRegistry::channelAddressable(channel) && ed.registryInputHealthy[idx];
        }
        switch (s) {
            case OIL_TEMP:        return HardwareConfig::hasOilTemp && ed.oilTempHealthy;
            case TOT:             return HardwareConfig::hasTot && ed.totHealthy;
            case N1_RPM:          return HardwareConfig::hasN1Rpm && ed.n1Healthy;
            case OIL_PRESS:       return HardwareConfig::hasOilPress && ed.oilHealthy;
            case TIT:             return HardwareConfig::hasTit && ed.titHealthy;
            case BATT_V:          return HardwareConfig::hasBattVoltage && ed.battHealthy;
            case N2_RPM:          return HardwareConfig::hasN2Rpm && ed.n2Healthy;
            case DI_CH0:          return HardwareConfig::diCh[0].pin >= 0;
            case DI_CH1:          return HardwareConfig::diCh[1].pin >= 0;
            case DI_CH2:          return HardwareConfig::diCh[2].pin >= 0;
            case DI_CH3:          return HardwareConfig::diCh[3].pin >= 0;
            case FUEL_PRESS:      return HardwareConfig::hasFuelPress && ed.fuelPressHealthy;
            case FUEL_FLOW:       return HardwareConfig::hasFuelFlow && ed.fuelFlowHealthy;
            case P1:              return HardwareConfig::hasP1 && ed.p1Healthy;
            case P2:              return HardwareConfig::hasP2 && ed.p2Healthy;
            case TORQUE:          return HardwareConfig::hasTorque && ed.torqueHealthy;
            case FLAME:           return HardwareConfig::hasFlame && ed.flameHealthy;
            case THROTTLE_INPUT:  return HardwareConfig::hasThrottleInput && ed.throttleInputValid;
            case IDLE_INPUT:      return HardwareConfig::hasIdleInput && ed.idleInputValid;
            case AB_FLAME:        return HardwareConfig::hasAfterburner && HardwareConfig::hasAbFlame && ed.abFlameHealthy;
            case GLOW_CURRENT:    return HardwareConfig::hasGlowPlug && HardwareConfig::hasGlowCurrentSensor && ed.glowCurrentHealthy;
            case IGNITER_CURRENT: return HardwareConfig::hasIgniter && HardwareConfig::hasIgniterCurrentSensor && ed.igniterCurrentHealthy;
            case IGNITER2_CURRENT:return HardwareConfig::hasIgniter2 && HardwareConfig::hasIgniter2CurrentSensor && ed.igniter2CurrentHealthy;
            case OIL_PUMP_CURRENT:return HardwareConfig::hasOilPump && HardwareConfig::hasOilPumpCurrentSensor && ed.oilPumpCurrentHealthy;
            case AB_INPUT:        return HardwareConfig::hasAfterburner &&
                                         (HardwareConfig::abInputPin >= 0 ||
                                          _registryInputPurposePresent("ab_command")) &&
                                         ed.abInputValid;
            case START_SWITCH:    return ed.startSwitchConfigured && ed.startSwitchHealthy;
            case STOP_SWITCH:     return ed.stopSwitchConfigured && ed.stopSwitchHealthy;
            case THRUST:          return HardwareConfig::hasThrust && ed.thrustHealthy;
            default:              return false;
        }
    }

    static float _readSensor(uint8_t s, const EngineData& ed) {
        if (ChannelRegistry::isInputSensor(s)) {
            uint8_t idx = ChannelRegistry::inputIndexFromSensor(s);
            return idx < ChannelRegistry::MAX_INPUT_CHANNELS ? ed.registryInputValue[idx] : 0.0f;
        }
        switch (s) {
            case OIL_TEMP:  return ed.oilTemp;
            case TOT:       return ed.tot;
            case N1_RPM:    return ed.n1Rpm;
            case OIL_PRESS: return ed.oilPressure;
            case TIT:       return ed.tit;
            case BATT_V:    return ed.battVoltage;
            case N2_RPM:    return ed.n2Rpm;
            case DI_CH0:    return ed.diState[0] ? 1.0f : 0.0f;
            case DI_CH1:    return ed.diState[1] ? 1.0f : 0.0f;
            case DI_CH2:    return ed.diState[2] ? 1.0f : 0.0f;
            case DI_CH3:    return ed.diState[3] ? 1.0f : 0.0f;
            case FUEL_PRESS:return ed.fuelPressure;
            case FUEL_FLOW: return ed.fuelFlow;
            case P1:        return ed.p1;
            case P2:        return ed.p2;
            case TORQUE:    return ed.torque;
            case FLAME:     return ed.flameDetected ? 1.0f : 0.0f;
            case THROTTLE_INPUT: {
                if (HardwareConfig::throttleInputRcPwm)
                    return ed.rcThrottleValid ? ed.rcThrottleNorm : 0.0f;
                int range = Config::throttleMaxRaw - Config::throttleMinRaw;
                return range ? constrain((ed.throttleInputRaw - Config::throttleMinRaw) /
                                         (float)range, 0.0f, 1.0f) : 0.0f;
            }
            case IDLE_INPUT: {
                if (HardwareConfig::idleInputRcPwm)
                    return ed.rcIdleValid ? ed.rcIdleNorm : 0.0f;
                int range = Config::idleMaxRaw - Config::idleMinRaw;
                return range ? constrain((ed.idleInputRaw - Config::idleMinRaw) /
                                         (float)range, 0.0f, 1.0f) : 0.0f;
            }
            case AB_FLAME:  return ed.abFlameOn ? 1.0f : 0.0f;
            case GLOW_CURRENT: return ed.glowCurrentAmps;
            case IGNITER_CURRENT: return ed.igniterCurrentAmps;
            case IGNITER2_CURRENT: return ed.igniter2CurrentAmps;
            case OIL_PUMP_CURRENT: return ed.oilPumpCurrentAmps;
            case AB_INPUT:   return ed.abInputValid ? constrain(ed.abInputNorm, 0.0f, 1.0f) : 0.0f;
            case START_SWITCH:return ed.startSwitchActive ? 1.0f : 0.0f;
            case STOP_SWITCH: return ed.stopSwitchActive ? 1.0f : 0.0f;
            case THRUST:      return ed.thrust;
            default:        return 0.0f;
        }
    }

    static bool _actuatorUsable(uint8_t act) {
        if (ChannelRegistry::isOutputActuator(act)) {
            uint8_t idx = ChannelRegistry::outputIndexFromActuator(act);
            if (idx >= HardwareConfig::channelRegistry.outputCount) return false;
            const auto& out = HardwareConfig::channelRegistry.outputs[idx];
            return ChannelRegistry::channelAddressable(out) &&
                   !HardwareConfig::channelRegistry.ownsCoreOutput(out) &&
                   !HardwareConfig::channelRegistry.boundToCoreOutput(out);
        }
        switch (act) {
            case COOL_FAN:         return HardwareConfig::hasCoolFan;
            case BLEED_VALVE:      return HardwareConfig::hasBleedValve;
            case FUEL_PUMP2:       return HardwareConfig::hasFuelPump2;
            case OIL_SCAVENGE:     return HardwareConfig::hasOilScavengePump;
            case THROTTLE:         return HardwareConfig::hasThrottle;
            case STARTER:          return HardwareConfig::hasStarter;
            case STARTER_ENABLE:   return HardwareConfig::hasStarterEn;
            case OIL_PUMP:         return HardwareConfig::hasOilPump;
            case FUEL_SOL:         return HardwareConfig::hasFuelSol;
            case IGNITER:          return HardwareConfig::hasIgniter;
            case IGNITER2:         return HardwareConfig::hasIgniter2;
            case AB_SOL:           return HardwareConfig::hasAfterburner &&
                                          HardwareConfig::hasAbSol;
            case AB_PUMP:          return HardwareConfig::hasAfterburner &&
                                          HardwareConfig::hasAbPump;
            case AIRSTARTER:       return HardwareConfig::hasAirstarterSol;
            case GLOW_PLUG:        return HardwareConfig::hasGlowPlug;
            case PROP_PITCH:       return HardwareConfig::hasPropPitch;
            case REQUEST_SHUTDOWN:
            case REQUEST_FAULT:    return true;
            default:               return false;
        }
    }

    static bool _evalOp(float val, uint8_t op, float threshold, uint8_t sensor) {
        switch (op) {
            case GT:  return val >  threshold;
            case LT:  return val <  threshold;
            case GTE: return val >= threshold;
            case LTE: return val <= threshold;
            case EQ: {
                float tolerance = 0.01f;
                switch (sensor) {
                    case OIL_TEMP:
                    case TOT:
                    case TIT:
                    case N1_RPM:
                    case N2_RPM: tolerance = 1.0f; break;
                    case THROTTLE_INPUT:
                    case IDLE_INPUT:
                    case AB_INPUT: tolerance = 0.005f; break;
                    case DI_CH0:
                    case DI_CH1:
                    case DI_CH2:
                    case DI_CH3:
                    case FLAME:
                    case AB_FLAME:
                    case START_SWITCH:
                    case STOP_SWITCH: tolerance = 0.1f; break;
                    default: break;
                }
                return fabsf(val - threshold) < tolerance;
            }
            default:  return false;
        }
    }

    static bool _evalRuleState(int idx, float val, uint8_t op, float threshold, float hysteresis, uint8_t sensor) {
        if (idx < 0 || idx >= Config::MAX_RULES) return _evalOp(val, op, threshold, sensor);
        hysteresis = max(0.0f, hysteresis);
        bool& latched = _ruleLatched[idx];
        switch (op) {
            case GT:
            case GTE:
                if (latched) {
                    if (val <= threshold - hysteresis) latched = false;
                } else if (_evalOp(val, op, threshold, sensor)) {
                    latched = true;
                }
                return latched;
            case LT:
            case LTE:
                if (latched) {
                    if (val >= threshold + hysteresis) latched = false;
                } else if (_evalOp(val, op, threshold, sensor)) {
                    latched = true;
                }
                return latched;
            default:
                latched = _evalOp(val, op, threshold, sensor);
                return latched;
        }
    }

    static void _applyActuator(uint8_t act, float dem, EngineData& ed, const char* ruleName) {
        if (ChannelRegistry::isOutputActuator(act)) {
            uint8_t idx = ChannelRegistry::outputIndexFromActuator(act);
            if (idx < ChannelRegistry::MAX_OUTPUT_CHANNELS) {
                ed.registryOutputDemand[idx] = dem;
                if (ruleName && idx < HardwareConfig::channelRegistry.outputCount) {
                    const char* purpose = HardwareConfig::channelRegistry.outputs[idx].purpose;
                    if (!strcmp(purpose, "main_fuel")) strlcpy(ed.throttleCommandOwner, ruleName, sizeof(ed.throttleCommandOwner));
                    else if (!strcmp(purpose, "prop_pitch")) strlcpy(ed.propPitchCommandOwner, ruleName, sizeof(ed.propPitchCommandOwner));
                    else if (!strcmp(purpose, "oil_pump") ||
                             !strcmp(HardwareConfig::channelRegistry.outputs[idx].role, "oil_pump"))
                        strlcpy(ed.oilCommandOwner, ruleName, sizeof(ed.oilCommandOwner));
                }
            }
            return;
        }
        switch (act) {
            case COOL_FAN:    ed.coolFanDemand = dem; break;
            case BLEED_VALVE: ed.bleedValveDemand = dem; break;
            case FUEL_PUMP2:  ed.fuelPump2Demand = constrain(dem, 0.0f, 1.0f); break;
            case OIL_SCAVENGE:ed.oilScavengeDemand = dem; break;
            case THROTTLE:
                ed.throttleDemand = constrain(dem, 0.0f, 1.0f);
                if (ruleName) strlcpy(ed.throttleCommandOwner, ruleName, sizeof(ed.throttleCommandOwner));
                break;
            case STARTER:
                ed.starterDemand = constrain(dem, 0.0f, 1.0f);
                // A starter automation owns the complete starter action. This
                // makes a potentiometer map usable even when an enable relay is
                // fitted, while zero demand returns both outputs to off.
                ed.starterEnabled = RelayDemand::requested(dem);
                break;
            case STARTER_ENABLE: ed.starterEnabled = (dem >= 0.5f); break;
            case OIL_PUMP:
                ed.oilPumpPct = constrain(dem, 0.0f, 1.0f) * 100.0f;
                if (ruleName) strlcpy(ed.oilCommandOwner, ruleName, sizeof(ed.oilCommandOwner));
                break;
            case FUEL_SOL:    ed.fuelSolOpen    = (dem >= 0.5f); break;
            case IGNITER:     ed.igniterOn      = (dem >= 0.5f); break;
            case IGNITER2:    ed.igniter2On     = (dem >= 0.5f); break;
            case AB_SOL:      ed.abSolOpen      = (dem >= 0.5f); break;
            case AB_PUMP:     ed.abPumpDemand   = constrain(dem, 0.0f, 1.0f); break;
            case REQUEST_SHUTDOWN:
                if (dem >= 0.5f && _shutdownCb) _shutdownCb();
                break;
            case REQUEST_FAULT:
                if (dem >= 0.5f && _faultCb) {
                    if (ruleName && ruleName[0]) {
                        snprintf(ed.faultDescription, sizeof(ed.faultDescription),
                                 "Control rule fault: %s", ruleName);
                    } else {
                        snprintf(ed.faultDescription, sizeof(ed.faultDescription),
                                 "Control rule requested a fault shutdown.");
                    }
                    _faultCb("CONTROL_RULE");
                }
                break;
            case AIRSTARTER: ed.airstarterOpen = (dem >= 0.5f); break;
            case GLOW_PLUG:  ed.glowPlugDemand = constrain(dem, 0.0f, 1.0f); break;
            case PROP_PITCH:
                ed.propPitchDemand = constrain(dem, 0.0f, 1.0f);
                if (ruleName) strlcpy(ed.propPitchCommandOwner, ruleName, sizeof(ed.propPitchCommandOwner));
                break;
            default: break;
        }
    }

    static inline ControllerActivation _activation;
    static inline uint8_t _activationMode = 255;
    static inline ShutdownCallback _shutdownCb = nullptr;
    static inline FaultCallback _faultCb = nullptr;
    static inline bool _ruleLatched[Config::MAX_RULES] = {};
    static inline ConditionConfirmation _confirmation[Config::MAX_RULES];
    static inline FeedbackControlMath::State _feedbackState[Config::MAX_RULES] = {};
    static inline uint8_t _ownedTargets[Config::MAX_RULES] = {};
    static inline float _ownedBaseDemands[Config::MAX_RULES] = {};
    static inline uint8_t _ownedTargetCount = 0;
};
