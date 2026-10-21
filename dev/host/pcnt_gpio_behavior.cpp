#include <Arduino.h>
#include <array>
#include <cassert>
#include <iostream>
constexpr int INPUT=0, OUTPUT=1, INPUT_PULLUP=2;
static std::array<int,49> pinModes{};
inline void pinMode(int pin,int mode) { pinModes.at(pin)=mode; }
bool fakePcntPadIsInput(int pin) { return pinModes.at(pin)!=OUTPUT; }
#include "../../src/hal/sensors/PCNTRpmSensor.h"
int main() {
 pinModes[4]=OUTPUT;
 PCNTRpmSensor sensor(4,1.0f,"N1");
 sensor.begin();assert(sensor.hardwareReady());
 fakePcntLastUnit->count=25;fakeMillisClock()=250;sensor.update();
 assert(sensor.getValue()==6000.0f);assert(sensor.sampleSequence()==1);
 assert(sensor.isHealthy());assert(pinModes[4]==INPUT);
 pinModes[18]=OUTPUT;sensor.begin(18,2.0f,INPUT_PULLUP);assert(fakePcntLiveUnits==1);
 fakePcntLastUnit->count=50;fakeMillisClock()+=250;sensor.update();
 assert(sensor.getValue()==6000.0f);assert(pinModes[18]==INPUT_PULLUP);
 fakePcntFailAllocation=true;sensor.begin(4,1.0f);
 assert(!sensor.hardwareReady());assert(!sensor.isHealthy());assert(fakePcntLiveUnits==0);
 std::cout<<"PCNT GPIO behavior passed: prior output role released, both input routes count, reinitialization frees resources, allocation failure remains unhealthy.\n";
}
