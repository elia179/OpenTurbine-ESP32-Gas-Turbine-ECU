#if defined(OT_QUAD_PSRAM)
#include <cstddef>
#include <esp32-hal-psram.h>
#include <esp_psram.h>
#include <esp_private/esp_psram_extram.h>
#include "SessionMemory.h"

// The pinned Arduino core normally enables PSRAM for ordinary malloc here.
// Add it only to the capability heap instead: ordinary allocations retain
// their internal-RAM policy. The logger opts in
// explicitly with MALLOC_CAP_SPIRAM. No external stacks or static data.
extern "C" bool __wrap_psramAddToHeap() {
    return psramFound() && SessionMemory::supportedExternalSize(esp_psram_get_size()) &&
           esp_psram_extram_add_to_heap_allocator() == ESP_OK;
}
#endif
