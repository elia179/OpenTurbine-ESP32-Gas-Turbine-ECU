#pragma once
#include <stddef.h>
#include <stdint.h>
#include <cstring>

// Caller supplies synchronization. Length-prefixed records share one bounded
// byte budget instead of reserving worst-case space for every short event.
class ByteRecordRing {
public:
    ByteRecordRing(uint8_t* storage, size_t capacity, size_t fixedLength=0) : data_(storage), capacity_(capacity), fixedLength_(fixedLength) {}
    void attach(uint8_t* storage, size_t capacity, size_t fixedLength=0) { data_ = storage; capacity_ = capacity; fixedLength_ = fixedLength; clear(); }
    size_t frontSize() const { return count_ ? frontLength() : 0; }
    void clear() { head_ = tail_ = used_ = count_ = 0; }
    size_t count() const { return count_; }
    size_t used() const { return used_; }
    // Rejected input leaves the ring untouched. dropped counts overwritten
    // oldest records only, so the caller can report every loss explicitly.
    bool push(const char* text, size_t length, bool overwrite, uint32_t& dropped) {
        dropped = 0;
        const size_t prefix = fixedLength_ ? 0 : 2;
        if (!text || !length || length > UINT16_MAX || (fixedLength_ && length!=fixedLength_) || length + prefix > capacity_) return false;
        if (!overwrite && capacity_ - used_ < length + prefix) return false;
        while (capacity_ - used_ < length + prefix) { pop(); ++dropped; }
        if (prefix) {
            write(head_, static_cast<uint8_t>(length));
            write(head_+1, static_cast<uint8_t>(length >> 8));
        }
        copyIn(head_+prefix, reinterpret_cast<const uint8_t*>(text), length);
        head_ = (head_ + length + prefix) % capacity_;
        used_ += length + prefix;
        ++count_;
        return true;
    }
    bool peek(char* output, size_t capacity) const {
        if (!count_) return false;
        const size_t length = frontLength();
        if (capacity <= length) return false;
        copyOut(tail_+(fixedLength_ ? 0 : 2), reinterpret_cast<uint8_t*>(output), length);
        output[length] = 0;
        return true;
    }
    void pop() {
        if (!count_) return;
        const size_t bytes = frontLength() + (fixedLength_ ? 0 : 2);
        tail_ = (tail_ + bytes) % capacity_;
        used_ -= bytes;
        --count_;
    }
private:
    uint8_t* data_;
    size_t capacity_, fixedLength_ = 0, head_ = 0, tail_ = 0, used_ = 0, count_ = 0;
    void write(size_t at, uint8_t value) { data_[at % capacity_] = value; }
    size_t frontLength() const {
        if (fixedLength_) return fixedLength_;
        return data_[tail_] | (static_cast<size_t>(data_[(tail_+1)%capacity_]) << 8);
    }
    void copyIn(size_t at, const uint8_t* source, size_t length) {
        at %= capacity_;
        const size_t first = length < capacity_-at ? length : capacity_-at;
        std::memcpy(data_+at, source, first);
        std::memcpy(data_, source+first, length-first);
    }
    void copyOut(size_t at, uint8_t* target, size_t length) const {
        at %= capacity_;
        const size_t first = length < capacity_-at ? length : capacity_-at;
        std::memcpy(target, data_+at, first);
        std::memcpy(target+first, data_, length-first);
    }
};
