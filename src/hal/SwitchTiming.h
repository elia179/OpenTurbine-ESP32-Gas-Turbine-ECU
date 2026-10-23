#pragma once
#include <stdint.h>

// Establish the boot/reconnect level without inventing a switch press.
// Subsequent transitions must be present in fresh samples for 20 ms.
class SwitchDebounce {
public:
    static constexpr uint32_t DelayMs = 20;
    bool sample(bool raw, uint32_t sequence, uint32_t now) {
        if (!_ready) {
            _ready=true;_raw=_value=raw;_sequence=sequence;_changed=now;
        } else if (sequence!=_sequence) {
            _sequence=sequence;
            if (raw!=_raw) {_raw=raw;_changed=now;}
            if (uint32_t(now-_changed)>=DelayMs) _value=raw;
        }
        return _value;
    }
    void reset() {_ready=false;}
private:
    uint32_t _changed=0,_sequence=0;
    bool _ready=false,_raw=false,_value=false;
};

// A delay belongs to the condition, independent of contact filtering.
// Missing observations, false conditions and inactive monitoring reset it.
class ConditionConfirmation {
public:
    bool update(bool condition,uint32_t now,uint32_t delayMs) {
        if (!condition) {reset();return false;}
        if (!delayMs) {reset();return true;}
        if (!_active || uint32_t(now-_last)>1000U) {_since=now;_active=true;}
        _last=now;
        return uint32_t(now-_since)>=delayMs;
    }
    void reset() {_active=false;}
private:
    uint32_t _since=0,_last=0;
    bool _active=false;
};
