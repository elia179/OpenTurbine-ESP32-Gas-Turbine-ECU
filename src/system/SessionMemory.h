#pragma once
#include <stddef.h>

namespace SessionMemory {
// Leave at least 256 KiB of external memory free, and bound even larger
// modules to 1 MiB of capture. Fragmentation can reduce this estimate.
static constexpr size_t EXTERNAL_LIMIT = 1024 * 1024;
static constexpr size_t EXTERNAL_RESERVE = 256 * 1024;
constexpr size_t externalBudget(size_t freeBytes, size_t largestBlock, size_t minimum) {
    if (freeBytes <= EXTERNAL_RESERVE) return 0;
    const size_t available = freeBytes - EXTERNAL_RESERVE;
    const size_t contiguous = available < largestBlock ? available : largestBlock;
    const size_t budget = contiguous < EXTERNAL_LIMIT ? contiguous : EXTERNAL_LIMIT;
    return budget >= minimum ? budget : 0;
}
}
