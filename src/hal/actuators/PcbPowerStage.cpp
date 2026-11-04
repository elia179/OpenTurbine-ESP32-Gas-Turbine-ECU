#include "PcbPowerStage.h"
#if defined(OT_PLATFORM_ESP32S3)
#include "Drv8350Protocol.h"
#if defined(OT_PCB_POWER_TEST)
#include "PcbPowerStageTestHal.h"
#else
#include "../SharedPeripheralBus.h"
#include "../../system/pcb/PcbProfileManager.h"
#include "../../engine/EngineData.h"
#include "../../system/HardwareConfig.h"
#include "../../system/Config.h"
#include <Wire.h>
#include <driver/mcpwm_prelude.h>
#include <math.h>
#endif

namespace PcbPowerStage {
namespace {
using namespace Drv8350Protocol;
enum class State:uint8_t {Off,Wake,Configure,Ready,Fault};
State state=State::Off;
uint8_t latch=safeLatch;
bool heartbeat=false,recoverableFault=false,driverStatusFault=false;
char driverDiagnostic[96]={};
uint32_t lastEdge=0,lastProgress=0,wakeAt=0,lastPoll=0;
uint8_t setupChip=0,pollChip=0;
char reason[96]={};
struct Wave {mcpwm_timer_handle_t timer=nullptr; mcpwm_oper_handle_t oper=nullptr;
    mcpwm_cmpr_handle_t compare=nullptr; mcpwm_gen_handle_t gen=nullptr;
    uint32_t period=0,frequency=0,pendingSinceUs=0; float demand=0; bool pending=false,attached=false;};
Wave waves[6];
mcpwm_sync_handle_t sync[2]={};
const PcbProfileManager::Catalog* profile(){return PcbProfileManager::active()?PcbProfileManager::catalog():nullptr;}
int indexOf(int pin){const auto* p=profile();if(!p||!p->hasPowerStage)return -1;for(int i=0;i<6;i++)if(p->powerInh[i]==pin)return i;return -1;}
bool regWrite(uint8_t reg,uint8_t value){Wire.beginTransmission(0x21);Wire.write(reg);Wire.write(value);return Wire.endTransmission(true)==0;}
bool regRead(uint8_t reg,uint8_t& value){Wire.beginTransmission(0x21);Wire.write(reg);if(Wire.endTransmission(false)!=0||Wire.requestFrom(uint8_t(0x21),uint8_t(1))!=1)return false;value=Wire.read();return true;}
bool setLatch(uint8_t value){if(value==latch)return true;if(!regWrite(1,value))return false;latch=value;return true;}
void forceLow(int i){if(waves[i].gen)mcpwm_generator_set_force_level(waves[i].gen,0,true);else digitalWrite(profile()->powerInh[i],LOW);waves[i].demand=0;waves[i].pending=false;}
bool verifyExpander();
void fail(const char* why,bool recoverable=false){
    if(state==State::Fault && (recoverable || !recoverableFault))return;
    state=State::Fault;strlcpy(reason,why,sizeof(reason));
    for(int i=0;i<6;i++)forceLow(i);
    // INH is already low; clear INL, then stop the health heartbeat. Failure
    // to write the expander cannot keep the pulse buffer/driver gate enabled.
    {SharedPeripheralBus::Guard guard;recoverable=guard && regWrite(1,safeLatch) && recoverable;
     latch=safeLatch;recoverable=recoverable && verifyExpander();}
    for(uint8_t i=0;i<HardwareConfig::channelRegistry.outputCount;i++){
        const auto& c=HardwareConfig::channelRegistry.outputs[i];
        if(!c.installed || c.pin<0 || indexOf(c.pin)>=0)continue;
        if(c.driver==ChannelRegistry::Pwm || c.driver==ChannelRegistry::Servo)ledcWrite(c.pin,0);
        else if(c.driver==ChannelRegistry::Relay)digitalWrite(c.pin,c.inverted?HIGH:LOW);
    }
    latch=safeLatch;recoverableFault=recoverable;
    if(!recoverable){heartbeat=false;digitalWrite(profile()->outputEnableGpio,LOW);}
    auto& ed=EngineData::instance();ed.hardwareReady=recoverable;
    snprintf(ed.hardwareFault,sizeof(ed.hardwareFault),recoverable?"PCB: %s; inspect, then acknowledge fault":"PCB: %s; inspect, then RESET (EN)/power-cycle",why);
}
bool frame(uint8_t chip,uint16_t tx,uint16_t& rx){
    SharedPeripheralBus::Guard guard;if(!guard)return false;
    const auto* bus=PcbProfileManager::findBus(profile()->powerSpiBusId);
    // CPOL=0, CPHA=1 (TI SLVSDY6A figure 54): data launched on rising
    // clock and captured on falling clock. 5 us half-period <=100 kHz.
    digitalWrite(bus->sck,LOW);
    if(!setLatch(csLatch(latch,chip,true)))return false;
    delayMicroseconds(5);rx=0;
    for(int bit=15;bit>=0;--bit){
        digitalWrite(bus->mosi,(tx>>bit)&1);digitalWrite(bus->sck,HIGH);delayMicroseconds(5);
        digitalWrite(bus->sck,LOW);delayMicroseconds(5);rx=uint16_t((rx<<1)|(digitalRead(bus->miso)?1:0));
    }
    const bool ok=setLatch(csLatch(latch,chip,false));
    delayMicroseconds(1);rx&=dataMask;return ok;
}
bool read(uint8_t chip,uint8_t address,uint16_t& value){return frame(chip,Drv8350Protocol::frame(true,address),value);}
bool program(uint8_t chip,uint8_t address,uint16_t value){uint16_t ignored,actual;return frame(chip,Drv8350Protocol::frame(false,address,value),ignored)&&read(chip,address,actual)&&actual==value;}
bool verifyExpander(){uint8_t dir,pol,out;return regRead(3,dir)&&regRead(2,pol)&&regRead(1,out)&&dir==0&&pol==0&&out==latch;}
bool verifyDriver(uint8_t chip){
    driverStatusFault=false;uint16_t value,status;
    if(!read(chip,0,status)||!read(chip,1,value))return false;
    // Prove chip identity/configuration before interpreting fault bits. An
    // unplugged, pulled-high MISO also returns 0x7ff, not a real overcurrent.
    for(uint8_t addr=2;addr<=5;addr++){
        uint16_t actual;const uint16_t expected=addr==2?control:addr==3?gateHSLocked:addr==4?gateLS:ocp;
        if(!read(chip,addr,actual)||actual!=expected)return false;
    }
    if(status||value){
        driverStatusFault=true;
        const char* kind=(status&0x23f)?"overcurrent":(status&0x40)?"overtemperature":(status&0x80)||(value&0x40)?"undervoltage":(value&0x80)?"temperature warning":"gate-drive fault";
        snprintf(driverDiagnostic,sizeof(driverDiagnostic),"Driver %u %s (status %03X/%03X)",unsigned(chip+1),kind,unsigned(status),unsigned(value));return false;
    }
    return true;
}
}
bool active(){const auto* p=profile();return p&&p->hasPowerStage;}
bool ownsPin(int pin){return indexOf(pin)>=0;}
bool ready(){return !active()||state==State::Ready;}
bool faulted(){return active()&&state==State::Fault;}
const char* stateName(){return !active()?"not fitted":state==State::Ready?"ready":state==State::Fault?"fault":state==State::Off?"off":"initializing";}
const char* faultReason(){return reason;}
bool acknowledgeFault(){
    if(!active() || state!=State::Fault)return true;
    checkDeadline(); // acknowledgement must not erase evidence of a stalled loop
    if(!recoverableFault || Config::controlLoopHz<100)return false;
    SharedPeripheralBus::Guard guard;if(!guard || !verifyExpander())return false;
    for(int i=0;i<6;i++)forceLow(i);
    if(latch!=safeLatch)return false;
    for(uint8_t chip=0;chip<2;chip++){
        uint16_t ignored;
        if(!frame(chip,Drv8350Protocol::frame(false,2,control|1),ignored) || !verifyDriver(chip))return false;
    }
    // Slow bus recovery must not erase a deadline crossed during CLR_FLT/readback.
    checkDeadline();
    if(!recoverableFault)return false;
    recoverableFault=false;state=State::Ready;reason[0]=0;
    auto& ed=EngineData::instance();ed.hardwareReady=true;ed.hardwareFault[0]=0;lastPoll=millis();return true;
}
bool attach(int pin,uint32_t frequency){
    const int i=indexOf(pin);if(i<0)return false;
    if(frequency && (frequency<100 || frequency>20000))return false;
    Wave& w=waves[i];if(w.timer)return w.attached && frequency && w.frequency==frequency;
    digitalWrite(pin,LOW);pinMode(pin,OUTPUT);
    if(!frequency)return true;
    w.frequency=frequency;w.period=5000000UL/frequency;
    const int group=i/3;
    mcpwm_timer_config_t tc={};tc.group_id=group;tc.clk_src=MCPWM_TIMER_CLK_SRC_DEFAULT;
    tc.resolution_hz=5000000;tc.period_ticks=w.period;tc.count_mode=MCPWM_TIMER_COUNT_MODE_UP;
    mcpwm_operator_config_t op={};op.group_id=group;
    mcpwm_comparator_config_t cp={};cp.flags.update_cmp_on_tez=true;
    mcpwm_generator_config_t gp={};gp.gen_gpio_num=pin;
    bool ok=mcpwm_new_timer(&tc,&w.timer)==ESP_OK && mcpwm_new_operator(&op,&w.oper)==ESP_OK &&
        mcpwm_operator_connect_timer(w.oper,w.timer)==ESP_OK && mcpwm_new_comparator(w.oper,&cp,&w.compare)==ESP_OK &&
        mcpwm_new_generator(w.oper,&gp,&w.gen)==ESP_OK &&
        mcpwm_generator_set_force_level(w.gen,0,true)==ESP_OK &&
        mcpwm_generator_set_action_on_timer_event(w.gen,MCPWM_GEN_TIMER_EVENT_ACTION(MCPWM_TIMER_DIRECTION_UP,MCPWM_TIMER_EVENT_EMPTY,MCPWM_GEN_ACTION_HIGH))==ESP_OK &&
        mcpwm_generator_set_action_on_compare_event(w.gen,MCPWM_GEN_COMPARE_EVENT_ACTION(MCPWM_TIMER_DIRECTION_UP,w.compare,MCPWM_GEN_ACTION_LOW))==ESP_OK &&
        mcpwm_comparator_set_compare_value(w.compare,1)==ESP_OK;
    if(ok){
        if(!sync[group]){mcpwm_soft_sync_config_t cfg={};ok=mcpwm_new_soft_sync_src(&cfg,&sync[group])==ESP_OK;}
        mcpwm_timer_sync_phase_config_t phase={};phase.sync_src=sync[group];
        // Six nominal phases; independent-frequency channels naturally drift.
        // Group software triggers have a small skew, not a hardware global sync.
        phase.count_value=(uint64_t(w.period)*((i%3)*2+(group?1:0)) / 6)%w.period;
        phase.direction=MCPWM_TIMER_DIRECTION_UP;
        ok=ok&&mcpwm_timer_set_phase_on_sync(w.timer,&phase)==ESP_OK && mcpwm_timer_enable(w.timer)==ESP_OK &&
            mcpwm_timer_start_stop(w.timer,MCPWM_TIMER_START_NO_STOP)==ESP_OK;
    }
    if(!ok){forceLow(i);return false;}w.attached=true;return true;
}
void write(int pin,float demand){
    const int i=indexOf(pin);if(i<0)return;
    Wave& w=waves[i];demand=isfinite(demand)?constrain(demand,0.0f,1.0f):0;
    if(state!=State::Ready){forceLow(i);return;}
    if(demand==w.demand)return;
    SharedPeripheralBus::Guard guard;if(!guard){fail("peripheral bus timeout");return;}
    if(demand<=0){
        forceLow(i);
        if(!setLatch(phaseLatch(latch,i,false)))fail("phase disable I2C failure");
        return;
    }
    if(w.gen){
        // A phase returning from OFF must not expose a stale buffered compare
        // value when continuous force is released. Preload one complete carrier
        // period with INL disabled; no per-edge ISR/autonomous re-enable is used.
        if(demand<1 && (w.demand<=0 || w.demand>=1)){
            forceLow(i);
            if(!setLatch(phaseLatch(latch,i,false)) || mcpwm_comparator_set_compare_value(w.compare,constrain(uint32_t(demand*w.period),1UL,w.period-1))!=ESP_OK){fail("PWM preload failed");return;}
            w.pending=true;w.pendingSinceUs=micros();w.demand=demand;return;
        }
        if(w.pending && demand<1)return; // complete the first verified preload
        w.pending=false;
        if(demand>=1){if(mcpwm_generator_set_force_level(w.gen,1,true)!=ESP_OK){fail("PWM force failed");return;}}
        else if(mcpwm_comparator_set_compare_value(w.compare,constrain(uint32_t(demand*w.period),1UL,w.period-1))!=ESP_OK ||
                mcpwm_generator_set_force_level(w.gen,-1,true)!=ESP_OK){fail("PWM update failed");return;}
    }else digitalWrite(pin,HIGH);
    // First prepare INH with the phase disabled, then enable complementary
    // operation. A zero command clears INL: low-side is not left on at STOP.
    if(!setLatch(phaseLatch(latch,i,true))){fail("phase enable I2C failure");return;}
    w.demand=demand;
}
bool parkControlExpander(){
    if(!active())return true;
    SharedPeripheralBus::Guard guard;
    if(!guard || !regWrite(1,safeLatch) || !regWrite(2,0) || !regWrite(3,0))return false;
    latch=safeLatch;return verifyExpander();
}
void begin(bool prerequisitesReady){
    if(!active())return;
    state=State::Off;recoverableFault=false;reason[0]=0;
    for(int i=0;i<6;i++){
        // Reconfiguring an attached pin as GPIO can disconnect its MCPWM route.
        if(!waves[i].gen){digitalWrite(profile()->powerInh[i],LOW);pinMode(profile()->powerInh[i],OUTPUT);}
        forceLow(i);
    }
    digitalWrite(profile()->outputEnableGpio,LOW);pinMode(profile()->outputEnableGpio,OUTPUT);
    if(!prerequisitesReady){fail("peripheral/watchdog initialization failed");return;}
    if(Config::controlLoopHz<100){fail("set System loop target to at least 100 Hz");return;}
    SharedPeripheralBus::Guard guard;
    // Preload *all* outputs before direction, even if the separately powered
    // expander retained an old state. No read/modify of unknown startup bits.
    if(!guard||!regWrite(1,safeLatch)||!regWrite(2,0)||!regWrite(3,0)){fail("power expander initialization failed");return;}
    latch=safeLatch;if(!verifyExpander()){fail("power expander readback failed");return;}
    const auto* bus=PcbProfileManager::findBus(profile()->powerSpiBusId);
    digitalWrite(bus->sck,LOW);pinMode(bus->sck,OUTPUT);digitalWrite(bus->mosi,LOW);pinMode(bus->mosi,OUTPUT);pinMode(bus->miso,INPUT);
    for(auto s:sync)if(s && mcpwm_soft_sync_activate(s)!=ESP_OK){fail("PWM synchronization failed");return;}
    auto& ed=EngineData::instance();ed.hardwareReady=false;strlcpy(ed.hardwareFault,"PCB drivers initializing",sizeof(ed.hardwareFault));
    state=State::Wake;lastProgress=lastEdge=wakeAt=millis();heartbeat=false;
}
void checkDeadline(){if(active() && state!=State::Off && (state!=State::Fault || recoverableFault) && deadlineMissed(millis(),lastProgress))fail("control heartbeat deadline missed");}
void service(bool controlHealthy){
    if(!active()||state==State::Off||(state==State::Fault&&!recoverableFault))return;
    checkDeadline();if(state==State::Fault&&!recoverableFault)return;
    if(state==State::Fault){
        if(!controlHealthy){fail("control prerequisites failed");return;}
        lastProgress=millis();
        if(lastProgress-lastEdge>=5){heartbeat=!heartbeat;digitalWrite(profile()->outputEnableGpio,heartbeat?HIGH:LOW);lastEdge=lastProgress;}
        return;
    }
    auto& ed=EngineData::instance();
    const bool initializing=state!=State::Ready && !strcmp(ed.hardwareFault,"PCB drivers initializing");
    if(Config::controlLoopHz<100){fail("set System loop target to at least 100 Hz");return;}
    if(!controlHealthy || (!ed.hardwareReady && !initializing)){fail("control prerequisites failed");return;}
    lastProgress=millis();
    if(lastProgress-lastEdge>=5){heartbeat=!heartbeat;digitalWrite(profile()->outputEnableGpio,heartbeat?HIGH:LOW);lastEdge=lastProgress;}
    // The physical rail-valid latch is not readable. Keep every phase off
    // while the heartbeat charges its front end, then require real SPI proof.
    if(state==State::Wake){if(lastProgress-wakeAt>=250){state=State::Configure;setupChip=0;}return;}
    if(state==State::Configure){
        bool ok=program(setupChip,3,gateHS)&&program(setupChip,4,gateLS)&&program(setupChip,5,ocp)&&program(setupChip,2,control)&&program(setupChip,3,gateHSLocked)&&verifyDriver(setupChip);
        if(!ok){fail("DRV8350 setup/readback failed");return;}
        checkDeadline();if(state==State::Fault)return;
        if(++setupChip==2){state=State::Ready;ed.hardwareReady=true;ed.hardwareFault[0]=0;lastPoll=millis();}
    }else if(lastProgress-lastPoll>=500){
        SharedPeripheralBus::Guard guard;
        if(!guard||!verifyExpander()){fail("power expander communication/readback failure");return;}
        if(!verifyDriver(pollChip)){fail(driverStatusFault?driverDiagnostic:"DRV8350 communication/configuration failure",driverStatusFault);return;}
        // Alternate at 500 ms: each driver is checked once per second.
        pollChip^=1;lastPoll=millis();
    }
    checkDeadline();if(state==State::Fault)return;
    if(state==State::Ready)for(int i=0;i<6;i++){
        Wave& w=waves[i];
        if(!w.pending || uint32_t(micros()-w.pendingSinceUs)<(1000000UL+w.frequency-1)/w.frequency)continue;
        SharedPeripheralBus::Guard guard;
        if(!guard || mcpwm_generator_set_force_level(w.gen,-1,true)!=ESP_OK || !setLatch(phaseLatch(latch,i,true))){fail("PWM phase start failed");return;}
        w.pending=false;
    }
}
}
#endif
