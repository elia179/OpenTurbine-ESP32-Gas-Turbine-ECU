#define OT_PCB_POWER_TEST
#define OT_PLATFORM_ESP32S3
#include "../../src/hal/actuators/PcbPowerStage.cpp"
#include <iostream>
using namespace PcbPowerStage;
static void reset(){
 state=State::Off;latch=3;heartbeat=false;Mock::i2cFail=Mock::lockFail=Mock::readCorrupt=false;
 Mock::regs[0]=255;Mock::regs[1]=255;Mock::regs[2]=0;Mock::regs[3]=255;
 Mock::selected=-1;Mock::bit=0;Mock::spiWrites=Mock::unsafeConfig=0;Mock::writes.clear();
 memset(Mock::driver,0,sizeof(Mock::driver));memset(Mock::gpio,0,sizeof(Mock::gpio));
 EngineData::instance().hardwareReady=true;EngineData::instance().hardwareFault[0]=0;clockMs=1000;
}
static void run(unsigned ms){for(unsigned i=0;i<ms;i+=5){clockMs+=5;service(true);}}
int main(){
 assert((Drv8350Protocol::control & 0x400)==0);assert((Drv8350Protocol::ocp & 15)==1);
 reset();for(int pin:profile()->powerInh)assert(attach(pin,10000));
 begin(true);assert(!ready());assert(Mock::writes.size()>=3);
 assert((Mock::writes[0]==std::array<int,2>{1,3}));assert((Mock::writes[2]==std::array<int,2>{3,0}));
 write(37,1);assert(Mock::regs[1]==3);run(200);assert(!ready()&&Mock::spiWrites==0);run(100);
 assert(ready()&&EngineData::instance().hardwareReady&&Mock::spiWrites==10&&Mock::unsafeConfig==0);
 for(int i=0;i<6;i++)assert(waves[i].timer&&waves[i].gen&&waves[i].timer->group==i/3);
 // Each INL control preserves every unrelated phase/CS bit, including SPI polls.
 for(int i=0;i<6;i++)write(profile()->powerInh[i],.5f);
 assert(Mock::regs[1]==3);run(5);assert(Mock::regs[1]==255);run(100);assert(ready()&&Mock::regs[1]==255);
 for(int i=0;i<6;i++){write(profile()->powerInh[i],0);assert(!(Mock::regs[1]&(1<<(i+2))));}
 assert(Mock::regs[1]==3);write(37,NAN);assert(Mock::regs[1]==3);
 // Fault-status and configuration corruption latch off, never auto-retry.
 write(37,1);Mock::driver[0][0]=1;run(1000);assert(state==State::Fault&&!EngineData::instance().hardwareReady);
 assert(Mock::gpio[45]==LOW&&Mock::regs[1]==3&&waves[0].gen->force==0);
 Mock::driver[0][0]=0;run(500);write(37,1);assert(state==State::Fault&&Mock::regs[1]==3);
 reset();begin(true);run(300);assert(ready());clockMs+=76;checkDeadline();assert(state==State::Fault);run(100);assert(state==State::Fault);
 reset();Mock::i2cFail=true;begin(true);assert(state==State::Fault&&Mock::gpio[45]==LOW);
 reset();begin(false);assert(state==State::Fault&&Mock::spiWrites==0);
 reset();begin(true);run(300);assert(ready());Mock::i2cFail=true;write(37,1);assert(state==State::Fault&&waves[0].gen->force==0);
 reset();begin(true);run(300);assert(ready());Mock::driver[1][2]=0;run(1000);assert(state==State::Fault);
 reset();Config::controlLoopHz=50;begin(true);assert(state==State::Fault);Config::controlLoopHz=400;
 reset();begin(true);run(300);service(false);assert(state==State::Fault);
 reset();Mock::readCorrupt=true;begin(true);assert(state==State::Fault);
 // Unsigned deadline arithmetic remains correct across millis rollover.
 assert(!Drv8350Protocol::deadlineMissed(20,0xfffffff0));assert(Drv8350Protocol::deadlineMissed(100,0xfffffff0));
 std::cout<<"PASS real PCB backend: safe initialization, both driver readbacks, 6 MCPWM channels, phase enables, fault and I2C failures, deadline latch\n";
}
