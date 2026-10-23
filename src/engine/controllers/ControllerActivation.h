#pragma once
#include <stdint.h>
#include <string.h>

// Small, allocation-free activation state. Configuration and stable IDs live
// elsewhere; this object contains only the current runtime ownership bits.
class ControllerActivation {
public:
    enum Event : uint8_t { Sequence = 0, Startup = 1, Running = 2, Shutdown = 3, Standby = 4 };
    enum Result : uint8_t { Ok, Disabled, Conflict, Invalid, Faulted };
    static constexpr uint8_t Capacity = 16;
    struct Target {
        uint8_t primary, coupled = 255;
        bool operator==(const Target& other) const {
            return primary == other.primary || primary == other.coupled || coupled == other.primary;
        }
    };


    static uint16_t blockId(const char* name, bool* activate = nullptr) {
        if (!name) return 0;
        const bool on = !strncmp(name, "ControllerOn_", 13);
        if (!on && strncmp(name, "ControllerOff_", 14)) return 0;
        const char* digit = name + (on ? 13 : 14);
        if (*digit < '1' || *digit > '9') return 0;
        uint32_t id = 0;
        for (; *digit; ++digit) {
            if (*digit < '0' || *digit > '9') return 0;
            id = id * 10 + (*digit - '0');
            if (id > 65535) return 0;
        }
        if (activate) *activate = on;
        return (uint16_t)id;
    }

    bool active(uint8_t index) const { return index < Capacity && (_active & (uint16_t(1) << index)); }
    void reset() { _active = 0; _inhibited = 0; _fault = false; }
    bool inhibited(uint8_t i) const { return i < Capacity && (_inhibited & (uint16_t(1) << i)); }
    void inhibit(uint16_t mask) { _inhibited = mask; }

    template<class Rules, class Target>
    Result activate(uint8_t index, const Rules& rules, uint8_t count, Target target) {
        if (index >= count || index >= Capacity) return Invalid;
        if (_fault) return Faulted;
        if (!rules[index].enabled || inhibited(index)) return Disabled;
        if (active(index)) return Ok;
        for (uint8_t i = 0; i < count && i < Capacity; ++i)
            if (active(i) && target(i) == target(index)) return Conflict;
        _active |= uint16_t(1) << index;
        return Ok;
    }

    template<class Safe>
    void deactivate(uint8_t index, Safe safe) {
        // Inactive commands must not disturb an output now owned elsewhere.
        if (!active(index)) return;
        safe(index);
        _active &= ~(uint16_t(1) << index);
    }

    template<class Rules, class Target, class Safe>
    Result enter(Event event, const Rules& rules, uint8_t count, Target target, Safe safe) {
        if (event == Sequence || event > Standby) return Invalid;
        _fault = false;
        // All releases precede all acquisitions, independent of card order.
        for (uint8_t i = 0; i < count && i < Capacity; ++i)
            if (active(i) && (!rules[i].enabled || inhibited(i) || (rules[i].deactivateEvents & (1u << event))))
                deactivate(i, safe);
        Result result = Ok;
        for (uint8_t i = 0; i < count && i < Capacity; ++i)
            if (rules[i].enabled && !inhibited(i) && (rules[i].activateEvents & (1u << event))) {
                const Result next = activate(i, rules, count, target);
                if (next != Ok) result = next;
            }
        return result;
    }

    template<class Safe>
    void fault(Safe safe) {
        for (uint8_t i = 0; i < Capacity; ++i) deactivate(i, safe);
        _fault = true;
    }

private:
    uint16_t _active = 0, _inhibited = 0;
    bool _fault = false;
};
