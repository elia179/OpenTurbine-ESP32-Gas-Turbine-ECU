#include <algorithm>
#include <cassert>
#include <cmath>
#include <iostream>
class Print;
#include <freertos/FreeRTOS.h>
using std::max;
using std::min;
#include "../../src/system/RulesEngine.h"
#include "../../src/engine/sequencer/SequenceEngine.h"

// Minimal storage/bindings; all demand and lifecycle logic below is production code.
EngineData& EngineData::instance() { static EngineData ed; return ed; }
ChannelRegistry registry;
ChannelRegistry& HardwareConfig::channelRegistry = registry;
HardwareConfig::DiChannel HardwareConfig::diCh[HardwareConfig::MAX_DI] = {};
Config::Rule Config::rules[Config::MAX_RULES] = {};
int Config::ruleCount = 0;
namespace ConfigInternal { int8_t ruleSourceHandle(const char*) { return -1; } }
int HardwareConfig::abInputPin = {};
bool HardwareConfig::hasMAVLink=true;
int HardwareConfig::mavlinkRxPin=16;
bool HardwareConfig::hasAbFlame = {};
bool HardwareConfig::hasAbPump = {};
bool HardwareConfig::hasAbSol = {};
bool HardwareConfig::hasAfterburner = {};
bool HardwareConfig::hasAirstarterSol = {};
bool HardwareConfig::hasBattVoltage = {};
bool HardwareConfig::hasBleedValve = {};
bool HardwareConfig::hasCoolFan = {};
bool HardwareConfig::hasDynamicIdle = {};
bool HardwareConfig::hasFlame = {};
bool HardwareConfig::hasFuelFlow = {};
bool HardwareConfig::hasFuelPress = {};
bool HardwareConfig::hasFuelPump2 = {};
bool HardwareConfig::hasFuelSol = {};
bool HardwareConfig::hasGlowCurrentSensor = {};
bool HardwareConfig::hasGlowPlug = {};
bool HardwareConfig::hasIdleInput = {};
bool HardwareConfig::hasIgniter = {};
bool HardwareConfig::hasIgniter2 = {};
bool HardwareConfig::hasIgniter2CurrentSensor = {};
bool HardwareConfig::hasIgniterCurrentSensor = {};
bool HardwareConfig::hasN1Rpm = {};
bool HardwareConfig::hasN2Rpm = {};
bool HardwareConfig::hasOilPress = {};
bool HardwareConfig::hasOilPump = {};
bool HardwareConfig::hasOilPumpCurrentSensor = {};
bool HardwareConfig::hasOilScavengePump = {};
bool HardwareConfig::hasOilTemp = {};
bool HardwareConfig::hasP1 = {};
bool HardwareConfig::hasP2 = {};
bool HardwareConfig::hasPropPitch = {};
bool HardwareConfig::hasStarter = {};
bool HardwareConfig::hasStarterEn = {};
bool HardwareConfig::hasThrottle = {};
bool HardwareConfig::hasThrottleInput = {};
bool HardwareConfig::hasThrust = {};
bool HardwareConfig::hasTit = {};
bool HardwareConfig::hasTorque = {};
bool HardwareConfig::hasTot = {};
bool HardwareConfig::idleInputRcPwm = {};
bool HardwareConfig::throttleInputRcPwm = {};
float Config::fuelPumpMinPct = 0;
float Config::throttleIdleMaxPct = 50;
float Config::fuelIdleFixedPct = 0;
float Config::fuelIdleInputLow = 0;
float Config::fuelIdleInputHigh = 1;
char Config::fuelIdleInputId[20] = {};
int Config::fuelIdleMode = 1;
int Config::idleMinRaw = 0;
int Config::idleMaxRaw = 4095;
int Config::throttleMinRaw = 0;
int Config::throttleMaxRaw = 4095;

void FlightRecorder::logBlockEnter(const char*) {}
void FlightRecorder::logBlockExit(const char*,const char*) {}
static int sequenceFaults=0;
static void sequenceFault(const char*,BlockResult) { sequenceFaults++; }
class WriteBlock : public IBlock {
public:
    bool entered=false;
    const char* name() override { return "TestWrite"; }
    int8_t outputTarget() const override { return RulesEngine::THROTTLE; }
    void onEnter() override { entered=true;RulesEngine::applyActuatorDemand(RulesEngine::THROTTLE,.25f); }
    BlockResult tick() override { return BlockResult::Complete; }
};
class ProtectedCut : public IBlock {
public:
    bool entered=false;
    const char* name() override { return "ImmediateCut"; }
    int8_t outputTarget() const override { return RulesEngine::THROTTLE; }
    void onEnter() override { entered=true;RulesEngine::applyProtectedActuatorDemand(RulesEngine::THROTTLE,0); }
    BlockResult tick() override { return BlockResult::Complete; }
};
class DisabledControllerStep : public IBlock {
public:
    bool entered=false,exited=false,ticked=false;
    const char* name() override { return "ControllerOn_201"; }
    void onEnter() override { entered=true; }
    BlockResult tick() override { ticked=true;return BlockResult::Fault; }
    void onExit() override { exited=true; }
};
static void near(float actual,float expected) { assert(std::fabs(actual-expected)<.002f); }
static int faultRequests=0;
static void requestFault(const char*) { ++faultRequests; }
static Config::Rule& rule(int index,uint16_t id,uint8_t actuator,uint8_t event,uint8_t stops) {
    auto& r=Config::rules[index];r={};r.enabled=true;r.controllerId=id;r.actuator=actuator;
    r.kind=3;r.onValue=.4f;r.activateEvents=1u<<event;r.deactivateEvents=stops;
    return r;
}
int main() {
    assert(RulesEngine::supportedSensor(RulesEngine::MAVLINK_THROTTLE));
    assert(RulesEngine::supportedSensor(ChannelRegistry::INPUT_SENSOR_BASE));
    assert(!RulesEngine::supportedSensor(29));
    auto& ed=EngineData::instance();
    HardwareConfig::hasThrottle=true;HardwareConfig::hasIdleInput=true;
    HardwareConfig::hasPropPitch=true;HardwareConfig::hasIgniter=true;
    ed.idleInputValid=true;ed.mode=SysMode::STARTUP;
    Config::ruleCount=2;
    auto& startup=rule(0,101,RulesEngine::THROTTLE,ControllerActivation::Sequence,21);
    startup.kind=1;startup.sensor=RulesEngine::IDLE_INPUT;startup.inputMin=0;startup.inputMax=1;
    startup.outputMin=.1f;startup.outputMax=.5f;
    rule(1,102,RulesEngine::THROTTLE,ControllerActivation::Running,24);
    RulesEngine::modeEntered(ed.mode);
    assert(RulesEngine::controllerCommand(101,true));
    ed.idleInputRaw=0;RulesEngine::evaluate();near(ed.throttleDemand,.1f);
    RulesEngine::releaseOwnedTargets();ed.idleInputRaw=2048;RulesEngine::evaluate();near(ed.throttleDemand,.3f);
    RulesEngine::releaseOwnedTargets();ed.idleInputRaw=4095;RulesEngine::evaluate();near(ed.throttleDemand,.5f);
    assert(!RulesEngine::applyActuatorDemand(RulesEngine::THROTTLE,.9f));near(ed.throttleDemand,.5f);
    assert(RulesEngine::controllerCommand(101,false));near(ed.throttleDemand,0);
    assert(RulesEngine::applyActuatorDemand(RulesEngine::THROTTLE,.62f));
    assert(RulesEngine::controllerCommand(101,false));near(ed.throttleDemand,.62f);
    assert(RulesEngine::controllerCommand(101,true));
    ed.mode=SysMode::RUNNING;RulesEngine::modeEntered(ed.mode);
    assert(!RulesEngine::lifecycleActive(0)&&RulesEngine::lifecycleActive(1));
    RulesEngine::evaluate();near(ed.throttleDemand,.4f);
    ed.mode=SysMode::SHUTDOWN;RulesEngine::modeEntered(ed.mode);near(ed.throttleDemand,0);
    assert(RulesEngine::applyActuatorDemand(RulesEngine::THROTTLE,.2f));near(ed.throttleDemand,.2f);
    ed.mode=SysMode::STARTUP;RulesEngine::modeEntered(ed.mode);RulesEngine::controllerCommand(101,true);
    RulesEngine::evaluate();RulesEngine::releaseForConfiguration();near(ed.throttleDemand,0);
    startup.enabled=false;RulesEngine::resetLatches();RulesEngine::modeEntered(ed.mode);RulesEngine::evaluate();
    assert(RulesEngine::controllerOwner(RulesEngine::THROTTLE)<0);near(ed.throttleDemand,0);
    startup.enabled=true;RulesEngine::modeEntered(ed.mode);assert(!RulesEngine::lifecycleActive(0));
    RulesEngine::controllerCommand(101,true);ed.mode=SysMode::FAULT;RulesEngine::modeEntered(ed.mode);
    near(ed.throttleDemand,0);assert(!RulesEngine::controllerCommand(101,true));
    Config::ruleCount=3;auto& pitch=rule(2,103,RulesEngine::PROP_PITCH,ControllerActivation::Startup,8);
    pitch.safeDemand=1;pitch.onValue=.3f;
    ed.mode=SysMode::STARTUP;RulesEngine::modeEntered(ed.mode);RulesEngine::evaluate();near(ed.propPitchDemand,.3f);
    ed.mode=SysMode::SHUTDOWN;RulesEngine::modeEntered(ed.mode);near(ed.propPitchDemand,1);
    Config::ruleCount=4;rule(3,104,RulesEngine::IGNITER,ControllerActivation::Startup,8).onValue=0;
    ed.mode=SysMode::STARTUP;RulesEngine::modeEntered(ed.mode);RulesEngine::evaluate();assert(!ed.igniterOn);
    assert(!RulesEngine::applyActuatorDemand(RulesEngine::IGNITER,1));
    RulesEngine::applyProtectedActuatorDemand(RulesEngine::IGNITER,1);assert(ed.igniterOn);
    RulesEngine::evaluate();assert(ed.igniterOn);
    RulesEngine::releaseOwnedTargets();RulesEngine::evaluate();assert(!ed.igniterOn);
    assert(RulesEngine::controllerCommand(101,true));
    WriteBlock write;IBlock* blocks[]={&write};SequenceEngine sequence;
    sequence.setCallbacks(nullptr,nullptr,sequenceFault);
    sequence.startSequence(blocks,1);
    assert(sequenceFaults==1&&!write.entered&&!sequence.isRunning());
    RulesEngine::controllerCommand(101,false);
    sequence.startSequence(blocks,1);sequence.tick();assert(write.entered);near(ed.throttleDemand,.25f);
    RulesEngine::controllerCommand(101,true);
    ProtectedCut cut;IBlock* protective[]={&cut};sequence.startSequence(protective,1);
    assert(cut.entered&&sequenceFaults==1);near(ed.throttleDemand,0);
    sequence.tick();
    ed.faultShutdownActive=true;RulesEngine::modeEntered(ed.mode);
    assert(!RulesEngine::lifecycleActive(0)&&!RulesEngine::controllerCommand(101,true));
    ed.faultShutdownActive=false;ed.mode=SysMode::STANDBY;RulesEngine::modeEntered(ed.mode);
    char display[40];strlcpy(Config::rules[0].name,"Main fuel <pot>",sizeof(Config::rules[0].name));
    RulesEngine::blockDisplayName("ControllerOn_101",display,sizeof(display));assert(!strcmp(display,"On: Main fuel <pot>"));
    RulesEngine::blockDisplayName("ImmediateCut",display,sizeof(display));assert(!strcmp(display,"ImmediateCut"));
    RulesEngine::releaseForConfiguration();Config::ruleCount=2;
    HardwareConfig::hasStarter=true;HardwareConfig::hasStarterEn=true;
    rule(0,201,RulesEngine::STARTER,ControllerActivation::Sequence,24);
    rule(1,202,RulesEngine::STARTER_ENABLE,ControllerActivation::Sequence,24);
    assert(RulesEngine::controllerCommand(201,true));
    assert(!RulesEngine::controllerCommand(202,true));
    assert(!RulesEngine::applyActuatorDemand(RulesEngine::STARTER_ENABLE,0));
    RulesEngine::controllerCommand(201,false); // Not a selected stop: inert.
    assert(RulesEngine::lifecycleActive(0));
    RulesEngine::releaseForConfiguration();
    ed.controllerInhibitMask=1;
    RulesEngine::prepareStart();
    assert(!RulesEngine::lifecycleActive(0));
    DisabledControllerStep skipped;IBlock* disabledSteps[]={&skipped};
    HardwareConfig::SeqSideAction actions[1][HardwareConfig::MAX_SEQ_SIDE_ACTIONS]={};
    actions[0][0].enabled=true;actions[0][0].actuator=RulesEngine::THROTTLE;actions[0][0].value=.9f;
    ed.throttleDemand=.17f;sequence.startSequence(disabledSteps,1,actions,actions);sequence.tick();
    assert(!sequence.isRunning()&&!skipped.entered&&!skipped.ticked&&!skipped.exited);
    near(ed.throttleDemand,.17f);
    assert(RulesEngine::controllerCommand(201,true)); // inhibited blocks are inert
    assert(!RulesEngine::lifecycleActive(0));
    assert(RulesEngine::controllerCommand(65535,true)); // removed controller is inert
    assert(RulesEngine::controllerCommand(202,true)); // unrelated controller still usable
    RulesEngine::evaluate();
    assert(!RulesEngine::lifecycleActive(0)&&RulesEngine::lifecycleActive(1));
    assert(Config::rules[0].enabled); // never persistently disabled
    ed.controllerInhibitMask=0;RulesEngine::prepareStart();
    RulesEngine::controllerCommand(202,false);RulesEngine::releaseForConfiguration();
    assert(RulesEngine::controllerCommand(201,true)); // repaired next run can engage
    RulesEngine::releaseForConfiguration();
    Config::ruleCount=1;rule(0,301,RulesEngine::STARTER,ControllerActivation::Standby,1);
    ed.controllerInhibitMask=1;ed.mode=SysMode::SHUTDOWN;RulesEngine::modeEntered(ed.mode);
    ed.mode=SysMode::STANDBY;RulesEngine::modeEntered(ed.mode);
    assert(!RulesEngine::lifecycleActive(0)); // bad Standby links cannot energize an output and block START
    ed.controllerInhibitMask=0;RulesEngine::prepareStart();
    assert(RulesEngine::controllerCommand(301,true));assert(!RulesEngine::lifecycleActive(0));
    RulesEngine::releaseForConfiguration();
    // Safety requests are independent actions, including simultaneous activation.
    ed.controllerInhibitMask=0;ed.faultShutdownActive=false;
    RulesEngine::releaseForConfiguration();Config::ruleCount=2;
    rule(0,401,RulesEngine::REQUEST_FAULT,ControllerActivation::Running,24);
    rule(1,402,RulesEngine::REQUEST_FAULT,ControllerActivation::Running,24);
    ed.mode=SysMode::STARTUP;RulesEngine::modeEntered(ed.mode);
    ed.mode=SysMode::RUNNING;RulesEngine::modeEntered(ed.mode);
    assert(RulesEngine::lifecycleActive(0)&&RulesEngine::lifecycleActive(1));
    assert(!(RulesEngine::controllerTarget(0)==RulesEngine::controllerTarget(1)));
    registry.inputCount=2;
    for(int i=0;i<2;++i){
        auto& input=registry.inputs[i];input={};input.installed=true;
        input.direction=ChannelRegistry::Input;input.driver=ChannelRegistry::Digital;input.pin=32+i;
        auto& r=Config::rules[i];r.kind=0;r.sensor=ChannelRegistry::INPUT_SENSOR_BASE+i;r.op=RulesEngine::GT;
        r.threshold=.5f;r.hysteresis=0;r.onValue=1;r.offValue=0;
        snprintf(r.name,sizeof(r.name),"Oil pressure %d",i+1);
        ed.registryInputHealthy[i]=true;ed.registryInputValue[i]=0;
    }
    RulesEngine::begin(nullptr,requestFault);
    RulesEngine::evaluate();assert(faultRequests==0);
    ed.registryInputValue[1]=1;RulesEngine::evaluate();
    assert(faultRequests==1&&strstr(ed.faultDescription,"Oil pressure 2"));
    ed.registryInputValue[1]=0;ed.registryInputValue[0]=1;RulesEngine::evaluate();
    assert(faultRequests==2&&strstr(ed.faultDescription,"Oil pressure 1"));
    Config::rules[0].op=RulesEngine::LT;ed.registryInputValue[0]=1;
    RulesEngine::evaluate();assert(faultRequests==2);
    ed.registryInputValue[0]=0;RulesEngine::evaluate();assert(faultRequests==3);
    RulesEngine::releaseForConfiguration();
    Config::ruleCount=1;Config::rules[0].op=RulesEngine::GT;Config::rules[0].confirmMs=100;
    ed.mode=SysMode::STARTUP;RulesEngine::modeEntered(ed.mode);
    ed.mode=SysMode::RUNNING;RulesEngine::modeEntered(ed.mode);
    fakeMillisClock()=100;ed.registryInputValue[0]=1;RulesEngine::evaluate();assert(faultRequests==3);
    fakeMillisClock()=199;RulesEngine::evaluate();assert(faultRequests==3);
    fakeMillisClock()=200;RulesEngine::evaluate();assert(faultRequests==4);
    fakeMillisClock()=210;ed.registryInputValue[0]=0;RulesEngine::evaluate();
    fakeMillisClock()=220;ed.registryInputValue[0]=1;RulesEngine::evaluate();
    fakeMillisClock()=270;ed.registryInputHealthy[0]=false;RulesEngine::evaluate();
    fakeMillisClock()=280;ed.registryInputHealthy[0]=true;RulesEngine::evaluate();assert(faultRequests==4);
    fakeMillisClock()=379;RulesEngine::evaluate();assert(faultRequests==4);
    fakeMillisClock()=380;RulesEngine::evaluate();assert(faultRequests==5);
    ed.mode=SysMode::SHUTDOWN;RulesEngine::modeEntered(ed.mode);
    ed.mode=SysMode::STARTUP;RulesEngine::modeEntered(ed.mode);
    ed.mode=SysMode::RUNNING;RulesEngine::modeEntered(ed.mode);
    fakeMillisClock()=400;RulesEngine::evaluate();assert(faultRequests==5);
    fakeMillisClock()=499;RulesEngine::evaluate();assert(faultRequests==5);
    fakeMillisClock()=500;RulesEngine::evaluate();assert(faultRequests==6);
    RulesEngine::releaseForConfiguration();
    // A selected virtual throttle uses exactly the same mapping and loss output.
    Config::ruleCount=1;auto& remote=Config::rules[0];remote={};remote.enabled=true;
    remote.kind=1;remote.sensor=RulesEngine::MAVLINK_THROTTLE;remote.actuator=RulesEngine::THROTTLE;
    remote.modeMask=4;remote.inputMin=0;remote.inputMax=1;remote.outputMin=.1f;remote.outputMax=.8f;remote.offValue=.05f;
    ed.mode=SysMode::RUNNING;ed.faultLatched=false;ed.faultShutdownActive=false;
    ed.mavlinkThrottleValid=true;ed.mavlinkThrottleDemand=.5f;
    RulesEngine::begin(nullptr,requestFault);RulesEngine::evaluate();near(ed.throttleDemand,.45f);
    ed.mavlinkThrottleValid=false;RulesEngine::releaseOwnedTargets();RulesEngine::evaluate();near(ed.throttleDemand,.05f);
    RulesEngine::releaseForConfiguration();
    std::cout<<"Production RulesEngine: continuous pot tracking, ownership, event handover, safe shutdown, inactive no-op, disable/re-enable, fault, servo park and protective ignition passed.\n";
}
