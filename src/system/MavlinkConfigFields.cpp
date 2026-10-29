#include "MavlinkConfigFields.h"
namespace MavlinkConfigFields {
const Integer integers[6] = {
    {"rx_pin", &HardwareConfig::mavlinkRxPin, -1, -1, 48},
    {"system_id", &HardwareConfig::mavlinkSystemId, 1, 1, 255},
    {"component_id", &HardwareConfig::mavlinkComponentId, 200, 1, 255},
    {"controller_system", &HardwareConfig::mavlinkControllerSystem, 255, 1, 255},
    {"controller_component", &HardwareConfig::mavlinkControllerComponent, 190, 1, 255},
    {"input_timeout_ms", &HardwareConfig::mavlinkInputTimeoutMs, 500, 100, 5000},
};
}
