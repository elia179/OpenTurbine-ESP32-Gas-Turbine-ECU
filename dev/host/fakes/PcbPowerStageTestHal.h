#pragma once
#include <cstdint>
#include <cstring>
#include <cstdio>
#include <cmath>
#include <algorithm>
#include <vector>
#include <cassert>
#include <array>
#include <string>
constexpr int LOW=0,HIGH=1,INPUT=0,OUTPUT=1;
inline uint32_t clockMs=1000;
inline uint32_t millis(){return clockMs;}
inline uint32_t micros(){return clockMs*1000;}
inline void delayMicroseconds(int){}
inline bool mcpwmMapped[49]={};
inline void pinMode(int pin,int){assert(!mcpwmMapped[pin]);}
inline size_t strlcpy(char* dst,const char* src,size_t n){auto l=strlen(src);if(n){memcpy(dst,src,std::min(l,n-1));dst[std::min(l,n-1)]=0;}return l;}
template<typename T,typename U,typename V>T constrain(T a,U b,V c){return a<T(b)?T(b):a>T(c)?T(c):a;}
using std::isfinite;
namespace Mock {
inline int gpio[49]={};inline bool i2cFail=false,lockFail=false,readCorrupt=false,persistentFault=false;
inline uint8_t regs[4]={255,255,0,255};inline int selected=-1,bit=0;inline uint16_t tx=0;
inline uint16_t driver[2][6]={};inline int spiWrites=0,unsafeConfig=0;inline uint32_t transactionDelayMs=0;
inline std::vector<std::array<int,2>> writes;
inline void latch(uint8_t next){
 for(int chip=0;chip<2;chip++){
  const bool was=!(regs[1]&(1<<chip)),now=!(next&(1<<chip));
  if(!was&&now){selected=chip;bit=0;tx=0;}
  if(was&&!now&&selected==chip){
   assert(bit==16);int addr=(tx>>11)&15;
   if(!(tx&0x8000)&&addr>=2&&addr<=5){driver[chip][addr]=tx&0x7ff;if(addr==2 && (tx&1)){if(!Mock::persistentFault)driver[chip][0]=driver[chip][1]=0;driver[chip][2]&=~1;}spiWrites++;if(next&0xfc)unsafeConfig++;}
   selected=-1;
  }
 }
 regs[1]=next;
}
}
inline void digitalWrite(int pin,int v){Mock::gpio[pin]=v;}
using gpio_num_t=int;
inline int gpio_set_level(gpio_num_t pin,int value){digitalWrite(pin,value);return 0;}
inline int digitalRead(int){
 if(Mock::selected<0)return 1;
 const int chip=Mock::selected;Mock::tx=uint16_t((Mock::tx<<1)|Mock::gpio[11]);
 const int b=Mock::bit++;int addr=(Mock::tx>>(b<5?0:b-4))&15;
 // The register address is complete after the first five clocked bits.
 if(b<5)return 0;
 addr=(Mock::tx>>(b-4))&15;
 return addr<6?((Mock::driver[chip][addr]>>(15-b))&1):1;
}
inline bool ledcWrite(int pin,uint32_t v){Mock::gpio[pin]=v?1:0;return true;}
class FakeWire {
 std::vector<uint8_t> data;uint8_t selectedReg=0;
public:
 void beginTransmission(uint8_t address){assert(address==0x21);data.clear();}
 void write(uint8_t v){data.push_back(v);}
 int endTransmission(bool=true){
  clockMs+=Mock::transactionDelayMs;
  if(Mock::i2cFail)return 4;
  selectedReg=data[0];
  if(data.size()>1){Mock::writes.push_back({selectedReg,data[1]});
   if(selectedReg==1)Mock::latch(data[1]);else Mock::regs[selectedReg]=data[1];}
  return 0;
 }
 int requestFrom(uint8_t,uint8_t){return Mock::i2cFail?0:1;}
 int read(){return Mock::regs[selectedReg]^(Mock::readCorrupt?1:0);}
};inline FakeWire Wire;
namespace SharedPeripheralBus {struct Guard{explicit operator bool()const{return !Mock::lockFail;}};}
class Config {public:inline static uint32_t controlLoopHz=400;};
class EngineData {public:bool hardwareReady=true;char hardwareFault[128]={};static EngineData& instance(){static EngineData ed;return ed;}};
class ChannelRegistry {public:enum Driver {Relay=4,Pwm=5,Servo=6};struct Channel {bool installed=true,inverted=false;int pin=-1;uint8_t pwmZeroMode=0;Driver driver=Servo;};uint8_t outputCount=0;Channel outputs[16];};
class HardwareConfig {public:inline static ChannelRegistry channelRegistry;};
class PcbProfileManager {
public:
 struct Bus{int sck=12,mosi=11,miso=13;};
 struct Catalog {bool hasPowerStage=true;int powerInh[6]={37,38,41,42,2,1};char powerSpiBusId[24]="shared_spi";int outputEnableGpio=45;};
 inline static bool enabled=true;
 static bool active(){return enabled;}
 static const Catalog* catalog(){static Catalog p;return &p;}
 static const Bus* findBus(const char*){static Bus b;return &b;}
};
using esp_err_t=int;constexpr int ESP_OK=0;
constexpr int MCPWM_TIMER_CLK_SRC_DEFAULT=0,MCPWM_TIMER_COUNT_MODE_UP=0,MCPWM_TIMER_DIRECTION_UP=0,MCPWM_TIMER_EVENT_EMPTY=0,MCPWM_GEN_ACTION_HIGH=1,MCPWM_GEN_ACTION_LOW=0,MCPWM_TIMER_START_NO_STOP=0;
struct Timer{int group=0;uint32_t phase=0;};struct Oper{};struct Compare{uint32_t value=0;};struct Gen{int pin=-1,force=-1;};struct Sync{bool software=true;Timer* owner=nullptr;bool propagate=false;};
using mcpwm_timer_handle_t=Timer*;using mcpwm_oper_handle_t=Oper*;using mcpwm_cmpr_handle_t=Compare*;using mcpwm_gen_handle_t=Gen*;using mcpwm_sync_handle_t=Sync*;
struct mcpwm_timer_config_t{int group_id,clk_src;uint32_t resolution_hz,period_ticks;int count_mode;};
struct mcpwm_operator_config_t{int group_id;};struct mcpwm_comparator_config_t{struct{bool update_cmp_on_tez;}flags;};
struct mcpwm_generator_config_t{int gen_gpio_num;};struct mcpwm_soft_sync_config_t{};
struct mcpwm_timer_sync_src_config_t{int timer_event;struct{bool propagate_input_sync;}flags;};
struct mcpwm_timer_sync_phase_config_t{Sync* sync_src;uint32_t count_value;int direction;};
inline bool mcpwmFailure=false;
inline int mcpwm_new_timer(const mcpwm_timer_config_t* c,Timer** t){*t=new Timer;(*t)->group=c->group_id;return mcpwmFailure?1:0;}
inline int mcpwm_new_operator(const mcpwm_operator_config_t*,Oper** o){*o=new Oper;return 0;}
inline int mcpwm_operator_connect_timer(Oper*,Timer*){return 0;}
inline int mcpwm_new_comparator(Oper*,const mcpwm_comparator_config_t*,Compare** c){*c=new Compare;return 0;}
inline int mcpwm_new_generator(Oper*,const mcpwm_generator_config_t* c,Gen** g){*g=new Gen;(*g)->pin=c->gen_gpio_num;mcpwmMapped[c->gen_gpio_num]=true;return 0;}
inline int mcpwm_generator_set_force_level(Gen* g,int v,bool){g->force=v;Mock::gpio[g->pin]=v>0;return 0;}
#define MCPWM_GEN_TIMER_EVENT_ACTION(...) 0
#define MCPWM_GEN_COMPARE_EVENT_ACTION(...) 0
inline int mcpwm_generator_set_action_on_timer_event(Gen*,int){return 0;}
inline int mcpwm_generator_set_action_on_compare_event(Gen*,int){return 0;}
inline int mcpwm_comparator_set_compare_value(Compare* c,uint32_t v){c->value=v;return 0;}
inline int mcpwm_new_soft_sync_src(const mcpwm_soft_sync_config_t*,Sync** s){*s=new Sync;return 0;}
inline int mcpwm_new_timer_sync_src(Timer* t,const mcpwm_timer_sync_src_config_t* c,Sync** s){*s=new Sync;(*s)->software=false;(*s)->owner=t;(*s)->propagate=c->flags.propagate_input_sync;return 0;}
inline int mcpwm_timer_set_phase_on_sync(Timer* t,const mcpwm_timer_sync_phase_config_t* p){
 if(!p->sync_src)return 1;
 if(p->sync_src->software){if(p->sync_src->owner&&p->sync_src->owner!=t)return 1;p->sync_src->owner=t;}
 t->phase=p->count_value;return 0;
}
inline int mcpwm_timer_enable(Timer*){return 0;}
inline int mcpwm_timer_start_stop(Timer*,int){return 0;}
inline int mcpwm_soft_sync_activate(Sync*){return 0;}
