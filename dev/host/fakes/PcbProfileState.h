#pragma once
#include "../../../src/system/pcb/PcbProfileManager.h"
// Peripheral-only host tests have no flash partition. Start in generic mode.
inline PcbProfileManager::State PcbProfileManager::_state=PcbProfileManager::State::Absent;
inline PcbProfileManager::Catalog* PcbProfileManager::_catalog=nullptr;
