#pragma once
#include <stddef.h>

namespace SessionMemory {
// PSRAM is supported only on the 2 MiB variant. Other capacities retain
// internal-RAM logging. Leave external headroom and cap capture at 1 MiB.
static constexpr size_t SUPPORTED_EXTERNAL_BYTES = 2 * 1024 * 1024;
static constexpr size_t EXTERNAL_LIMIT = 1024 * 1024;
static constexpr size_t EXTERNAL_RESERVE = 256 * 1024;
constexpr bool supportedExternalSize(size_t bytes) {
    return bytes == SUPPORTED_EXTERNAL_BYTES;
}
constexpr size_t externalBudget(size_t freeBytes, size_t largestBlock, size_t minimum) {
    if (freeBytes <= EXTERNAL_RESERVE) return 0;
    const size_t available = freeBytes - EXTERNAL_RESERVE;
    const size_t contiguous = available < largestBlock ? available : largestBlock;
    const size_t budget = contiguous < EXTERNAL_LIMIT ? contiguous : EXTERNAL_LIMIT;
    return budget >= minimum ? budget : 0;
}
}
