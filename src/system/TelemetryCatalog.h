#pragma once
#include "../../libraries/OpenTurbineMavlink/src/MavlinkWire.h"

namespace TelemetryCatalog {
    uint16_t count();
    uint32_t revision();
    bool describe(uint16_t index,mavlink_ot_channel_info_t& info);
    bool sample(uint16_t index,uint16_t& channelId,float& value,bool& healthy);
}
