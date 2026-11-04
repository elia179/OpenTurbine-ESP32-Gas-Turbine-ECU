#define OT_PCB_POWER_TEST
#define OT_PLATFORM_ESP32S3
#include "../../src/hal/actuators/PcbPowerStage.cpp"
#include <iostream>
#include <cstdlib>
using namespace PcbPowerStage;
static void reset(){
 Mock::transactionDelayMs=0;state=State::Off;recoverableFault=false;latch=3;heartbeat=false;Mock::i2cFail=Mock::lockFail=Mock::readCorrupt=Mock::persistentFault=false;
 Mock::regs[0]=255;Mock::regs[1]=255;Mock::regs[2]=0;Mock::regs[3]=255;
 Mock::selected=-1;Mock::bit=0;Mock::spiWrites=Mock::unsafeConfig=0;Mock::writes.clear();
 memset(Mock::driver,0,sizeof(Mock::driver));memset(Mock::gpio,0,sizeof(Mock::gpio));
 EngineData::instance().hardwareReady=true;EngineData::instance().hardwareFault[0]=0;clockMs=1000;
}
static void run(unsigned ms){for(unsigned i=0;i<ms;i+=5){clockMs+=5;service(true);}}
int main(int argc,char** argv){
 const unsigned frequency=argc>1?std::atoi(argv[1]):10000;
 assert(Drv8350Protocol::gateHS==0x300 && Drv8350Protocol::gateHSLocked==0x600 && Drv8350Protocol::gateLS==0x300);
 assert((Drv8350Protocol::control & 0x400)==0);assert((Drv8350Protocol::ocp & 15)==1);
 reset();for(int pin:profile()->powerInh)assert(attach(pin,frequency));
 begin(true);assert(!ready());assert(Mock::writes.size()>=3);
 assert((Mock::writes[0]==std::array<int,2>{1,3}));assert((Mock::writes[2]==std::array<int,2>{3,0}));
 write(37,1);assert(Mock::regs[1]==3);run(200);assert(!ready()&&Mock::spiWrites==0);run(100);
 assert(ready()&&EngineData::instance().hardwareReady&&Mock::spiWrites==10&&Mock::unsafeConfig==0);
 for(int i=0;i<6;i++)assert(waves[i].timer&&waves[i].gen&&waves[i].timer->group==i/3);
 assert(!attach(37,99)&&!attach(37,20001));assert(attach(37,frequency));
 for(int i=0;i<6;i++){assert(waves[i].period==5000000UL/frequency);assert(waves[i].timer->phase==(uint64_t(waves[i].period)*((i%3)*2+(i/3?1:0))/6)%waves[i].period);}
 // Each INL control preserves every unrelated phase/CS bit, including SPI polls.
 for(int i=0;i<6;i++)write(profile()->powerInh[i],.5f);
 assert(Mock::regs[1]==3);run(20);assert(Mock::regs[1]==255);run(100);assert(ready()&&Mock::regs[1]==255);
 for(int i=0;i<6;i++){write(profile()->powerInh[i],0);assert(!(Mock::regs[1]&(1<<(i+2))));}
 for(int i=0;i<6;i++){write(profile()->powerInh[i],1);assert(waves[i].gen->force==1);write(profile()->powerInh[i],0);assert(waves[i].gen->force==0);}
 assert(Mock::regs[1]==3);write(37,NAN);assert(Mock::regs[1]==3);
 // Fault-status and configuration corruption latch off, never auto-retry.
 write(37,1);Mock::driver[0][0]=1;run(1000);assert(state==State::Fault&&EngineData::instance().hardwareReady&&recoverableFault);
 assert(Mock::regs[1]==3&&waves[0].gen->force==0);
 run(500);write(37,1);assert(state==State::Fault&&Mock::regs[1]==3);
 Mock::persistentFault=true;assert(!acknowledgeFault()&&faulted()&&Mock::regs[1]==3);Mock::persistentFault=false;
 assert(acknowledgeFault()&&ready()&&Mock::regs[1]==3);
 reset();begin(true);run(300);Mock::driver[0][0]=1;run(1000);Mock::i2cFail=true;assert(!acknowledgeFault());
 reset();begin(true);run(300);assert(ready());clockMs+=76;checkDeadline();assert(state==State::Fault);run(100);assert(state==State::Fault);
 reset();Mock::i2cFail=true;begin(true);assert(state==State::Fault&&Mock::gpio[45]==LOW);
 reset();begin(false);assert(state==State::Fault&&Mock::spiWrites==0);
 reset();begin(true);run(300);assert(ready());Mock::i2cFail=true;write(37,1);assert(state==State::Fault&&waves[0].gen->force==0);
 reset();begin(true);run(300);assert(ready());Mock::driver[1][2]=0;run(1000);assert(state==State::Fault);
 reset();Config::controlLoopHz=50;begin(true);assert(state==State::Fault);Config::controlLoopHz=400;
 reset();begin(true);run(300);service(false);assert(state==State::Fault);
 reset();Mock::readCorrupt=true;begin(true);assert(state==State::Fault);
 // STOP cancels an in-flight carrier preload; later service cannot enable it.
 reset();begin(true);run(300);write(37,.4f);assert(waves[0].pending);write(37,0);run(30);
 assert(!waves[0].pending&&Mock::regs[1]==3&&waves[0].demand==0);
 // Acknowledgement preserves all-off; repeated requests do not write CLR_FLT again.
 Mock::driver[0][0]=1;run(1000);assert(recoverableFault);
 Config::controlLoopHz=50;assert(!acknowledgeFault());Config::controlLoopHz=400;
 assert(acknowledgeFault());const int writesAfterAck=Mock::spiWrites;
 assert(acknowledgeFault()&&Mock::spiWrites==writesAfterAck);run(100);assert(Mock::regs[1]==3);
 // Even a clear request arriving after a stall cannot revive the heartbeat.
 reset();begin(true);run(300);Mock::driver[0][0]=1;run(1000);assert(recoverableFault);
 clockMs+=76;assert(!acknowledgeFault()&&!recoverableFault&&Mock::gpio[45]==LOW);
 run(100);assert(faulted()&&!ready()&&!acknowledgeFault());
 // Configuration that stalls must never authorize a pending power command.
 reset();begin(true);run(255);Mock::transactionDelayMs=5;run(5);
 assert(faulted()&&!ready()&&Mock::gpio[45]==LOW&&Mock::regs[1]==3);
 // Hardware reset/sleep clears driver registers; boot must configure both again.
 reset();begin(true);run(300);assert(ready()&&Mock::spiWrites==10);
 // A stall during the recovery transaction must not restore Ready.
 reset();begin(true);run(300);Mock::driver[0][0]=1;run(1000);assert(recoverableFault);
 Mock::transactionDelayMs=5;assert(!acknowledgeFault()&&!recoverableFault&&Mock::gpio[45]==LOW);
 // A disconnected/pulled-high SPI bus is not a recoverable overcurrent.
 reset();begin(true);run(300);for(auto& driver:Mock::driver)for(auto& reg:driver)reg=0x7ff;
 run(1000);assert(faulted()&&!recoverableFault);assert(std::string(faultReason()).find("communication")!=std::string::npos);
 // A partially allocated timer must not make a repeated attach appear successful.
 waves[0]=Wave{};mcpwmMapped[37]=false;mcpwmFailure=true;assert(!attach(37,frequency));mcpwmFailure=false;assert(!attach(37,frequency));
 // Unsigned deadline arithmetic remains correct across millis rollover.
 assert(!Drv8350Protocol::deadlineMissed(20,0xfffffff0));assert(Drv8350Protocol::deadlineMissed(100,0xfffffff0));
 std::cout<<"PASS real PCB backend: safe initialization, both driver readbacks, 6 MCPWM channels, phase enables, fault and I2C failures, deadline latch\n";
}
