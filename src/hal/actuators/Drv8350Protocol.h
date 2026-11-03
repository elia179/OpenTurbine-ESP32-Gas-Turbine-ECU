#pragma once
#include <stdint.h>
namespace Drv8350Protocol {
// SLVSDY6A tables 14-17. DRV8350S has no CSA register (DRV8353 only).
constexpr uint16_t control=0x4A0; // all phases OCP, OTW report, 3x PWM; protections ON
constexpr uint16_t gateHS=0x344; // unlocked, 300 mA source / 600 mA sink
constexpr uint16_t gateHSLocked=0x644; // lock configuration after successful setup
constexpr uint16_t gateLS=0x344; // CBC=0, TDRIVE=4 us, same gate currents
constexpr uint16_t ocp=0x312; // 400 ns dead time, latched OCP, 2 us deglitch, 80 mV VDS
constexpr uint16_t dataMask=0x7ff;
constexpr uint16_t frame(bool read,uint8_t address,uint16_t data=0){return (read?0x8000:0)|(uint16_t(address&15)<<11)|(data&dataMask);}
// Inactive CS high, all INL low. Never write a raw CS mask over active phases.
constexpr uint8_t safeLatch=0x03;
constexpr uint8_t csLatch(uint8_t latch,uint8_t chip,bool selected){return selected?uint8_t((latch|3)&~(1U<<chip)):uint8_t(latch|3);}
constexpr uint8_t phaseLatch(uint8_t latch,uint8_t phase,bool enabled){return enabled?uint8_t(latch|(1U<<(phase+2))):uint8_t(latch&~(1U<<(phase+2)));}
constexpr bool deadlineMissed(uint32_t now,uint32_t last){return uint32_t(now-last)>75;}
}
