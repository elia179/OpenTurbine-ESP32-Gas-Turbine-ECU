#pragma once

// Repeated hardware status checks must not re-enter fault shutdown or flood
// the event recorder. A cleared hardware fault, or an acknowledged engine fault,
// permits a new notification; persistent faults still remain actively checked.
class FaultEpisodeLatch {
public:
    bool shouldReport(bool faultActive, bool engineFaultLatched) {
        if (!faultActive) { _reported = false; return false; }
        if (_reported && engineFaultLatched) return false;
        _reported = true;
        return true;
    }
private:
    bool _reported = false;
};
