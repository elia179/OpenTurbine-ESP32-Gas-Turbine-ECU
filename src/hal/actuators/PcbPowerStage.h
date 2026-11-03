#pragma once
#include <stdint.h>
// The backend is inert on devboards and old profiles. Power endpoints never
// fall back to LEDC or raw GPIO if their protected driver is unavailable.
namespace PcbPowerStage {
#if defined(OT_PLATFORM_ESP32S3)
bool active();
bool ownsPin(int pin);
bool attach(int pin,uint32_t frequencyHz); // 0 = static on/off
void write(int pin,float demand);
bool parkControlExpander();
void begin(bool prerequisitesReady);
void checkDeadline();
void service(bool controlHealthy);
bool ready();
bool faulted();
bool acknowledgeFault();
const char* stateName();
const char* faultReason();
#else
inline bool active(){return false;}inline bool ownsPin(int){return false;}inline bool attach(int,uint32_t){return false;}
inline bool parkControlExpander(){return true;}
inline void write(int,float){}inline void begin(bool){}inline void checkDeadline(){}inline void service(bool){}inline bool ready(){return true;}inline bool faulted(){return false;}inline bool acknowledgeFault(){return true;}
inline const char* stateName(){return "not fitted";}inline const char* faultReason(){return "";}
#endif
}
