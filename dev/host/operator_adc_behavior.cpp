#include "src/hal/OperatorAdc.h"
#include <cassert>
#include <iostream>
int main() {
    using OperatorAdc::healthy;
    // Defaults retain the high-short guard, accepting zero as fail-safe.
    assert(healthy(0,0,4095)); assert(healthy(4085,0,4095));
    assert(!healthy(4095,0,4095));
    // Captured full travel, with the UI's 2%/1% command deadbands.
    for (int raw=0; raw<=4095; ++raw) assert(healthy(raw,82,4054));
    // Limited travel still rejects readings beyond the commissioning window.
    assert(healthy(460,500,3500)); assert(healthy(3540,500,3500));
    assert(!healthy(0,500,3500)); assert(!healthy(4095,500,3500));
    assert(!healthy(-1,82,4054)); assert(!healthy(4096,82,4054));
    std::cout << "Operator ADC endpoint health passed\n";
}
