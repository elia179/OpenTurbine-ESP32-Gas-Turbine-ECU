#pragma once
#include <atomic>
#include <cstdint>

// Keep large metadata replies from building competing heap-backed snapshots.
// Release when the last bytes have been copied, or when a reply is abandoned.
class LargeReadBudget {
    inline static std::atomic<uint32_t> active_{0};
public:
    static bool busy() { return active_.load(std::memory_order_acquire) != 0; }
    class Lease {
        bool held_;
    public:
        explicit Lease(bool enabled = true) : held_(enabled) {
            if (held_) active_.fetch_add(1, std::memory_order_acq_rel);
        }
        Lease(const Lease&) = delete;
        Lease& operator=(const Lease&) = delete;
        ~Lease() { release(); }
        void release() {
            if (held_) {
                held_ = false;
                active_.fetch_sub(1, std::memory_order_release);
            }
        }
    };
};
