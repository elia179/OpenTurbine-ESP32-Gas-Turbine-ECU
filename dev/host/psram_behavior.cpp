#include <cassert>
#include <cstddef>
#include <iostream>
#ifdef NDEBUG
#error "PSRAM behavior checks require assertions"
#endif
static bool found = false;
static size_t physicalBytes = 0;
static int additions = 0;
static int heapResult = 0;
bool psramFound() { return found; }
size_t esp_psram_get_size() { return physicalBytes; }
int esp_psram_extram_add_to_heap_allocator() { ++additions; return heapResult; }
#define OT_QUAD_PSRAM
#include "../../src/system/Psram.cpp"
int main() {
    assert(!__wrap_psramAddToHeap());
    assert(additions == 0);
    found = true;
    for (size_t bytes : {size_t(0),size_t(1024*1024),size_t(4*1024*1024),size_t(8*1024*1024)}) {
        physicalBytes = bytes;
        assert(!__wrap_psramAddToHeap());
        assert(additions == 0);
    }
    physicalBytes = 2*1024*1024;
    assert(__wrap_psramAddToHeap());
    assert(additions == 1);
    heapResult = -1;
    assert(!__wrap_psramAddToHeap());
    assert(additions == 2);
    std::cout << "PSRAM policy passed: only 2 MiB enters the capability heap; absent/larger memory and allocator failure retain fallback\n";
}
