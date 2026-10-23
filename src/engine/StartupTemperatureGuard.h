#pragma once
#include <stdint.h>
#include <math.h>

// Independent startup temperature envelope. Time must be continuously observed;
// sensor loss, leaving startup, bypass, and long scheduling gaps reset the dwell.
class StartupTemperatureGuard {
public:
    enum Trip : uint8_t { None, Immediate, Sustained };
    void reset() { _pending=false; _observed=false; }
    Trip check(bool enabled, bool startup, bool healthy, float temperature,
               float ceiling, float threshold, uint32_t duration, uint32_t now) {
        if (!enabled || !startup || !healthy || !isfinite(temperature)) { reset(); return None; }
        if (_observed && uint32_t(now-_last)>1000) _pending=false;
        _last=now;_observed=true;
        if (ceiling>0 && temperature>=ceiling) return Immediate;
        if (threshold<=0 || temperature<threshold) { _pending=false;return None; }
        if (!_pending) { _since=now;_pending=true; }
        return uint32_t(now-_since)>=duration ? Sustained : None;
    }
private:
    uint32_t _since=0, _last=0;
    bool _pending=false, _observed=false;
};
