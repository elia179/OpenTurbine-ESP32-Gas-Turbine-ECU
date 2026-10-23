// Storage-only bindings for production SafetyMonitor and ThrottleSlew tests.
// All protection, timer, phase-selection and pullback logic is production code.
EngineData& EngineData::instance(){static EngineData data;return data;}
ChannelRegistry testRegistry;
ChannelRegistry& HardwareConfig::channelRegistry=testRegistry;
HardwareConfig::OilLoopDef HardwareConfig::oilLoops[HardwareConfig::MAX_OIL_LOOPS]={};
float Config::minRpm={};
bool Config::safetyHoldCheckN1={};
bool Config::safetyHoldCheckN2={};
bool Config::safetyHoldCheckP1={};
bool Config::safetyHoldCheckP2={};
bool Config::safetyHoldCheckOil={};
bool Config::safetyHoldCheckEgt={};
bool Config::safetyHoldCheckFlame={};
bool Config::pullbackN1Enabled={};
bool Config::pullbackN2Enabled={};
bool Config::pullbackEgtEnabled={};
bool Config::pullbackP1Enabled={};
bool Config::pullbackP2Enabled={};
bool Config::pullbackTorqueEnabled={};
float Config::pullbackN1SoftRpm={};
float Config::pullbackN1HardRpm={};
float Config::pullbackN2SoftRpm={};
float Config::pullbackN2HardRpm={};
float Config::pullbackEgtSoftC={};
float Config::pullbackEgtHardC={};
float Config::pullbackP1Soft={};
float Config::pullbackP1Hard={};
float Config::pullbackP2Soft={};
float Config::pullbackP2Hard={};
float Config::pullbackTorqueSoft={};
float Config::pullbackTorqueHard={};
bool Config::p1TripEnabled=false;
bool Config::p2TripEnabled=false;
bool Config::torqueTripEnabled=false;
bool Config::underspeedEnabled=true;
bool Config::startupEgtImmediateEnabled=true;
bool Config::startupEgtDwellEnabled=true;
float Config::p1TripLimit={};
float Config::p2TripLimit={};
float Config::torqueTripLimit={};
int Config::p1TripConfirmMs={};
int Config::p2TripConfirmMs={};
int Config::torqueTripConfirmMs={};
float Config::rpmAccelFilter={};
int Config::idleSource={};
int Config::flameoutSource={};
bool Config::relightEnabled={};
float Config::relightConfirmRpm={};
float Config::oilZeroBar={};
float Config::oilRunningMin={};
int Config::oilSafetyModes=4;
int Config::fuelPressureSafetyModes=4;
uint32_t Config::oilPumpUnderflowDelayMs={};
bool Config::shutdownOnOilUnderflow={};
float Config::standbyOilFeedPct={};
float Config::startupEgtLimitC={};
bool Config::startupEgtGuardEnabled={};
float Config::startupEgtDwellC={};
int Config::startupEgtDwellMs={};
bool HardwareConfig::hasN1Rpm={};
bool HardwareConfig::hasN2Rpm={};
bool HardwareConfig::hasOilPress={};
bool HardwareConfig::hasFlame={};
bool HardwareConfig::hasFuelPress={};
bool HardwareConfig::hasP1={};
bool HardwareConfig::hasP2={};
bool HardwareConfig::hasThrottleInput={};
bool HardwareConfig::hasIdleInput={};
bool HardwareConfig::hasOilTemp={};
bool HardwareConfig::hasBattVoltage={};
bool HardwareConfig::hasTorque={};
bool HardwareConfig::hasThrottle={};
bool HardwareConfig::hasGovernor={};
bool HardwareConfig::hasOilLoop={};
bool HardwareConfig::hasDynamicIdle={};
uint8_t HardwareConfig::oilLoopCount={};
bool HardwareConfig::safetyOverspeed={};
bool HardwareConfig::safetyN2Overspeed={};
bool HardwareConfig::safetyOvertemp={};
bool HardwareConfig::safetyLowOil={};
bool HardwareConfig::safetyOilZero={};
bool HardwareConfig::safetyFlameout={};
bool HardwareConfig::safetyHotStart={};
bool HardwareConfig::safetyOilTempHigh={};
bool HardwareConfig::safetyFuelPressLow={};
bool HardwareConfig::safetyBattLow={};
bool HardwareConfig::safetySurge={};
char HardwareConfig::startupSeq[MAX_SEQ_BLOCKS][24]={};
int HardwareConfig::startupSeqLen={};
int Config::effectiveEgtSource() {
    if (egtSource == 1 && HardwareConfig::hasTot) return 1;
    if (egtSource == 2 && HardwareConfig::hasTit) return 2;
    if (HardwareConfig::hasTot) return 1;
    if (HardwareConfig::hasTit) return 2;
    return 0;
}
bool Config::primaryEgtHealthy(const EngineData& ed) {
    switch (effectiveEgtSource()) {
        case 1: return ed.totHealthy;
        case 2: return ed.titHealthy;
        default: return false;
    }
}
float Config::primaryEgtC(const EngineData& ed) {
    switch (effectiveEgtSource()) {
        case 1: return ed.tot;
        case 2: return ed.tit;
        default: return 0.0f;
    }
}
float Config::primaryEgtLimitC() {
    switch (effectiveEgtSource()) {
        case 1: return totLimit;
        case 2: return titLimit;
        default: return 0.0f;
    }
}
float Config::effectiveRelightMinRpm() {
    // relightMinRpm remains independently tunable, but automatic ignition
    // must never be fired below the engine's configured minimum
    // running/self-sustained N1 speed.
    return fmaxf(relightMinRpm, minRpm);
}
int Config::egtSource={};
float Config::totLimit={};
float Config::titLimit={};
float Config::relightMinRpm={};

bool HardwareConfig::hasTot=false;
bool HardwareConfig::hasTit=false;
