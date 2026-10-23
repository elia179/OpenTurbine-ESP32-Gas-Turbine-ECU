#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstring>
#include <iostream>
class Print;
#include <freertos/FreeRTOS.h>
using std::max;using std::min;
#include "../../src/engine/SafetyMonitor.h"
#include "../../src/engine/controllers/ThrottleSlew.h"
#include "temperature_test_bindings.h"
static int trips=0;
static void trip(){++trips;}
static void close(float a,float b){assert(std::fabs(a-b)<.001f);}
int main(){
 auto& ed=EngineData::instance();SafetyMonitor monitor;
 HardwareConfig::hasTot=true;HardwareConfig::hasThrottle=true;
 HardwareConfig::safetyOvertemp=true;Config::totLimit=700;Config::egtSource=1;
 Config::startupEgtLimitC=900;Config::startupEgtDwellC=800;Config::startupEgtDwellMs=500;
 ed.mode=SysMode::STARTUP;ed.totHealthy=true;ed.tot=750;
 auto reset=[&](){trips=0;monitor.begin(trip,trip);monitor.clearFault();fakeMillisClock()=100;};
 reset();Config::startupEgtGuardEnabled=false;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"OVERTEMP"));
 reset();Config::startupEgtGuardEnabled=true;monitor.check();assert(trips==0);
 ed.tot=900;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"STARTUP_OVERTEMP"));
 reset();HardwareConfig::safetyOvertemp=false;ed.tot=800;monitor.check();assert(trips==0);
 fakeMillisClock()=599;monitor.check();assert(trips==0);fakeMillisClock()=600;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"STARTUP_TEMP_DWELL"));
 reset();ed.tot=850;monitor.check();ed.mode=SysMode::STANDBY;fakeMillisClock()=500;monitor.check();ed.mode=SysMode::STARTUP;fakeMillisClock()=600;monitor.check();assert(trips==0);
 reset();ed.totHealthy=false;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"STARTUP_TEMP_SENSOR"));ed.totHealthy=true;
 // Explicit missing-temperature start override applies to the startup guard
 // too, but another override and healthy temperature trips remain authoritative.
 reset();ed.totHealthy=false;ed.limpMode=true;ed.limpOverrideSensor=FeedbackRequirements::EGT;
 monitor.check();assert(trips==0);fakeMillisClock()=700;monitor.check();assert(trips==0);
 reset();ed.limpOverrideSensor=FeedbackRequirements::N1;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"STARTUP_TEMP_SENSOR"));
 reset();ed.limpOverrideSensor=FeedbackRequirements::EGT;ed.totHealthy=true;ed.tot=950;
 monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"STARTUP_OVERTEMP"));
 ed.limpMode=false;ed.limpOverrideSensor=FeedbackRequirements::NONE;
 reset();ed.mode=SysMode::RUNNING;HardwareConfig::safetyOvertemp=true;ed.tot=750;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"OVERTEMP"));
 reset();HardwareConfig::hasTit=true;Config::egtSource=2;Config::titLimit=720;ed.titHealthy=true;ed.tit=710;ed.tot=950;monitor.check();assert(trips==0);ed.tit=730;fakeMillisClock()=200;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"OVERTEMP"));
 Config::egtSource=1;ed.tot=750;ed.mode=SysMode::STARTUP;ed.throttleDemand=.8f;
 ThrottleSlew slew;slew.rampUpMs=0;slew.rampDownMs=0;slew.n1PullbackEnabled=false;slew.totSoftLimit=700;slew.totHardLimit=750;slew.minPullbackThrottle=.1f;
 slew.begin();fakeMillisClock()+=10;slew.tick();close(ed.throttleDemand,.8f); // startup-only guard owns temperature
 ed.mode=SysMode::RUNNING;fakeMillisClock()+=10;slew.tick();close(ed.throttleDemand,.1f);
 Config::startupEgtGuardEnabled=false;ed.mode=SysMode::STARTUP;ed.throttleDemand=.8f;slew.begin();fakeMillisClock()+=10;slew.tick();close(ed.throttleDemand,.1f); // fallback
 Config::startupEgtGuardEnabled=true;ed.throttleDemand=.8f;ed.p1=10;ed.p1Healthy=true;slew.p1PullbackEnabled=true;slew.p1SoftLimit=5;slew.p1HardLimit=10;slew.begin();fakeMillisClock()+=10;slew.tick();close(ed.throttleDemand,.1f); // other pullbacks unchanged
 HardwareConfig::safetyOvertemp=false;HardwareConfig::safetyHotStart=false;Config::pullbackEgtEnabled=false;
 ed.mode=SysMode::RUNNING;ed.totHealthy=false;slew.p1PullbackEnabled=false;ed.throttleDemand=.1f;slew.begin();ed.throttleDemand=.8f;
 fakeMillisClock()+=10;slew.tick();close(ed.throttleDemand,.8f); // startup-only guard must not demand its sensor in Running
 HardwareConfig::safetyHotStart=true;ed.throttleDemand=.1f;slew.begin();ed.throttleDemand=.8f;fakeMillisClock()+=10;slew.tick();close(ed.throttleDemand,.8f);
 ed.mode=SysMode::STANDBY;assert(FeedbackRequirements::egtForProtectionOrControl());

 // Display the actual guard, not the mere presence of an unhealthy sensor.
 ed.mode=SysMode::RUNNING;ed.totHealthy=false;HardwareConfig::safetyOvertemp=false;
 ed.throttleDemand=.1f;slew.begin();ed.throttleDemand=.8f;fakeMillisClock()+=10;slew.tick();
 assert(!ed.throttleFeedbackInhibited);close(ed.throttleDemand,.8f);
 HardwareConfig::safetyOvertemp=true;ed.throttleDemand=.1f;slew.begin();ed.throttleDemand=.8f;
 fakeMillisClock()+=10;slew.tick();assert(ed.throttleFeedbackInhibited);close(ed.throttleDemand,.1f);
 ed.limpOverrideSensor=FeedbackRequirements::EGT;ed.limpMode=true;
 fakeMillisClock()+=10;slew.tick();assert(!ed.throttleFeedbackInhibited);close(ed.throttleDemand,.8f);
 ed.limpOverrideSensor=FeedbackRequirements::NONE;ed.limpMode=false;ed.totHealthy=true;ed.tot=20;
 fakeMillisClock()+=10;slew.tick();assert(!ed.throttleFeedbackInhibited);
 ed.throttleFeedbackInhibited=true;slew.reset();assert(!ed.throttleFeedbackInhibited);
 // Individual startup switches preserve values but suppress their own trips.
 HardwareConfig::safetyHotStart=false;HardwareConfig::safetyOvertemp=false;ed.totHealthy=true;
 Config::startupEgtGuardEnabled=true;Config::startupEgtImmediateEnabled=false;Config::startupEgtDwellEnabled=false;
 reset();ed.mode=SysMode::STARTUP;ed.tot=950;monitor.check();fakeMillisClock()=700;monitor.check();assert(trips==0);
 assert(Config::startupEgtLimitC==900 && Config::startupEgtDwellC==800);
 Config::startupEgtImmediateEnabled=true;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"STARTUP_OVERTEMP"));
 Config::startupEgtGuardEnabled=false;HardwareConfig::hasP1=true;ed.p1Healthy=true;ed.p1=10;
 Config::p1TripLimit=4;Config::p1TripConfirmMs=0;Config::p1TripEnabled=false;
 reset();ed.mode=SysMode::RUNNING;monitor.check();assert(trips==0);assert(!FeedbackRequirements::p1ForProtectionOrControl());
 Config::p1TripEnabled=true;assert(FeedbackRequirements::p1ForProtectionOrControl());monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"P1_HIGH"));Config::p1TripEnabled=false;
 HardwareConfig::hasP2=true;ed.p2Healthy=true;ed.p2=10;Config::p2TripLimit=4;Config::p2TripConfirmMs=0;
 reset();Config::p2TripEnabled=false;monitor.check();assert(trips==0);Config::p2TripEnabled=true;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"P2_HIGH"));Config::p2TripEnabled=false;
 HardwareConfig::hasTorque=true;ed.torqueHealthy=true;ed.torque=100;Config::torqueTripLimit=50;Config::torqueTripConfirmMs=0;
 reset();Config::torqueTripEnabled=false;monitor.check();assert(trips==0);Config::torqueTripEnabled=true;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"TORQUE_HIGH"));Config::torqueTripEnabled=false;
 HardwareConfig::hasN1Rpm=true;ed.n1Healthy=true;ed.n1Rpm=1000;monitor.minRpm=5000;
 reset();Config::underspeedEnabled=false;monitor.check();assert(trips==0);Config::underspeedEnabled=true;fakeMillisClock()=700;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"UNDERSPEED"));
 std::cout<<"Independent pressure/torque/underspeed/startup switches suppress only their own trips and preserve limits.\n";
 // One configurable oil-pressure trip: one threshold, confirmation and enable.
 Config::underspeedEnabled=false;HardwareConfig::hasOilPress=true;
 HardwareConfig::hasOilLoop=false;HardwareConfig::safetyLowOil=true;
 ed.oilHealthy=true;ed.oilMinBar=1.2f;ed.oilPressure=.8f;monitor.lowOilConfirmMs=250;monitor.checkIntervalMs=1;
 reset();ed.mode=SysMode::RUNNING;monitor.check();assert(trips==0);
 fakeMillisClock()=349;monitor.check();assert(trips==0);
 fakeMillisClock()=350;monitor.check();assert(trips==1&&!strcmp(monitor.lastFault(),"LOW_OIL"));
 reset();ed.oilPressure=1.2f;monitor.check();fakeMillisClock()=500;monitor.check();assert(trips==0);
 HardwareConfig::safetyLowOil=false;ed.oilPressure=0;
 monitor.check();fakeMillisClock()=900;monitor.check();assert(trips==0);
 assert(ed.oilMinBar==1.2f); // disabling preserves its reference
 // Every phase choice, both sensor types, disabled phases and fresh timers.
 HardwareConfig::safetyLowOil=true;Config::oilRunningMin=1.2f;
 for(int modes : {2,4,6}) for(SysMode mode : {SysMode::STANDBY,SysMode::STARTUP,SysMode::RUNNING,SysMode::SHUTDOWN,SysMode::FAULT}) {
   Config::oilSafetyModes=modes;ed.mode=mode;ed.oilPressure=.8f;
   reset();monitor.check();fakeMillisClock()=350;monitor.check();
   assert((trips==1)==PressureSafety::monitors(modes,mode));
 }
 HardwareConfig::safetyLowOil=false;HardwareConfig::safetyFuelPressLow=true;
 HardwareConfig::hasFuelPress=true;ed.fuelPressHealthy=true;ed.fuelPressure=.8f;
 monitor.fuelPressMin=1.2f;monitor.fuelPressConfirmMs=250;
 for(int modes : {2,4,6}) for(SysMode mode : {SysMode::STANDBY,SysMode::STARTUP,SysMode::RUNNING,SysMode::SHUTDOWN,SysMode::FAULT}) {
   Config::fuelPressureSafetyModes=modes;ed.mode=mode;
   reset();monitor.check();fakeMillisClock()=350;monitor.check();
   assert((trips==1)==PressureSafety::monitors(modes,mode));
 }
 Config::fuelPressureSafetyModes=4;ed.mode=SysMode::STARTUP;
 reset();monitor.check();fakeMillisClock()=1000;monitor.check();assert(trips==0);
 ed.mode=SysMode::RUNNING;fakeMillisClock()=1100;monitor.check();assert(trips==0);
 fakeMillisClock()=1349;monitor.check();assert(trips==0);fakeMillisClock()=1350;monitor.check();assert(trips==1);
 // A disabled phase clears partially accumulated confirmation time.
 reset();ed.mode=SysMode::RUNNING;monitor.check();fakeMillisClock()=200;monitor.check();
 ed.mode=SysMode::STARTUP;fakeMillisClock()=300;monitor.check();ed.mode=SysMode::RUNNING;
 fakeMillisClock()=400;monitor.check();fakeMillisClock()=649;monitor.check();assert(trips==0);
 fakeMillisClock()=650;monitor.check();assert(trips==1);
 for(const char* role : {"low_oil_switch","oil_zero_switch"}) {
   assert(!PressureSafety::blocksStart(role,true,true,true));
   assert(!PressureSafety::blocksStart(role,true,false,true));
   assert(PressureSafety::blocksStart(role,false,false,true));
   assert(!PressureSafety::blocksStart(role,false,false,false));
 }
 for(const char* role : {"inhibit_start","fault","estop"}) {
   assert(PressureSafety::blocksStart(role,true,true,false));
   assert(PressureSafety::blocksStart(role,false,false,false));
   assert(!PressureSafety::blocksStart(role,true,false,true));
 }
 assert(!PressureSafety::blocksStart("generic",false,true,true));
 std::cout<<"Oil/fuel phase matrices, fresh confirmation, pressure-switch START and independent interlocks passed.\n";
 std::cout<<"Production temperature safety: startup immediate/dwell, independent enable, normal fallback, Running takeover, selected TOT/TIT, sensor loss, new-start reset, temperature-only pullback pause and pressure limiting passed.\n";
}
