#pragma once
#include <ArduinoJson.h>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <limits>

// A synchronous JSON builder can reuse its idle serialization workspace.
// The workspace remains reserved throughout: an engine transition cannot steal
// it, and restoring the web service never depends on a fresh large allocation.
class JsonWorkspaceAllocator final : public ArduinoJson::Allocator {
    struct alignas(std::max_align_t) Header { size_t size; };
    uint8_t* workspace_;
    size_t capacity_;
    size_t used_ = 0;
    bool (*allowFallback_)(size_t);
    bool inWorkspace(const void* p) const {
        const auto address = reinterpret_cast<uintptr_t>(p);
        const auto begin = reinterpret_cast<uintptr_t>(workspace_);
        return address >= begin && address - begin < capacity_;
    }
public:
    JsonWorkspaceAllocator(void* workspace, size_t capacity,
                           bool (*allowFallback)(size_t) = nullptr)
        : workspace_(static_cast<uint8_t*>(workspace)), capacity_(workspace ? capacity : 0),
          allowFallback_(allowFallback) {}
    void* allocate(size_t size) override {
        if (!size || size > std::numeric_limits<size_t>::max() - sizeof(Header)) return nullptr;
        const size_t total = size + sizeof(Header);
        const auto begin = reinterpret_cast<uintptr_t>(workspace_);
        const auto next = (begin + used_ + alignof(Header) - 1) & ~(uintptr_t(alignof(Header) - 1));
        const size_t offset = next - begin;
        Header* header = nullptr;
        if (offset <= capacity_ && total <= capacity_ - offset) {
            header = reinterpret_cast<Header*>(next);
            used_ = offset + total;
        } else if (!allowFallback_ || allowFallback_(total)) {
            header = static_cast<Header*>(std::malloc(total));
        }
        if (!header) return nullptr;
        header->size = size;
        return header + 1;
    }
    void deallocate(void* pointer) override {
        if (pointer && !inWorkspace(static_cast<Header*>(pointer) - 1))
            std::free(static_cast<Header*>(pointer) - 1);
    }
    void* reallocate(void* pointer, size_t size) override {
        if (!pointer) return allocate(size);
        if (!size) { deallocate(pointer); return nullptr; }
        const size_t previous = (static_cast<Header*>(pointer) - 1)->size;
        if (size <= previous) return pointer;
        void* replacement = allocate(size);
        if (!replacement) return nullptr;
        std::memcpy(replacement, pointer, previous);
        deallocate(pointer);
        return replacement;
    }
};
