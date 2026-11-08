#pragma once
#include "ByteRecordRing.h"

// A cursor copies ring metadata only, never the recording buffer. Once capture
// has stopped, measure CSV size in bounded steps before touching the real tail.
class SessionArchivePlan {
public:
    void begin(const ByteRecordRing& ring) { cursor_ = ring; bytes_ = 0; }
    bool ready() const { return cursor_.count() == 0; }
    size_t bytes() const { return bytes_; }
    template<class Measure>
    void scanOne(char* packed, size_t capacity, Measure measure) {
        if (ready()) return;
        const size_t size = cursor_.frontSize();
        if (cursor_.peek(packed, capacity)) bytes_ += measure(packed, size);
        cursor_.pop();
    }
    void consumed(size_t bytes) { bytes_ = bytes < bytes_ ? bytes_ - bytes : 0; }
private:
    ByteRecordRing cursor_{nullptr, 0};
    size_t bytes_ = 0;
};
