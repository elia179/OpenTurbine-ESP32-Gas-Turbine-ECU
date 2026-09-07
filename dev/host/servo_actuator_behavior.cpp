#include "src/hal/actuators/ServoActuator.h"

#include <cassert>

int main() {
    fakeMillisClock() = 0;
    fakeLedcWriteCount() = 0;

    ServoActuator starter(23, 1000, 2000, "STARTER_TEST");
    starter.begin();
    assert(starter.isReady());
    assert(fakeLedcWriteCount() == 1); // safe pulse at boot

    // First activation is immediate.
    starter.set(0.10f);
    assert(fakeLedcWriteCount() == 2);
    const uint32_t firstActiveDuty = fakeLedcLastDuty();

    // Multiple ramp samples inside one receiver frame are coalesced.
    starter.set(0.20f);
    fakeMillisClock() = 19;
    starter.set(0.30f);
    assert(fakeLedcWriteCount() == 2);
    assert(fakeLedcLastDuty() == firstActiveDuty);

    fakeMillisClock() = 20;
    starter.set(0.40f);
    assert(fakeLedcWriteCount() == 3);
    assert(fakeLedcLastDuty() != firstActiveDuty);

    // Subsequent updates are measured from the completed write.
    fakeMillisClock() = 39;
    starter.set(0.50f);
    assert(fakeLedcWriteCount() == 3);
    fakeMillisClock() = 40;
    starter.set(0.50f);
    assert(fakeLedcWriteCount() == 4);

    // Logical off bypasses the frame limiter and cancels a pending ramp value.
    fakeMillisClock() = 41;
    starter.set(0.80f);
    assert(fakeLedcWriteCount() == 4);
    starter.off();
    assert(fakeLedcWriteCount() == 5);
    const uint32_t safeDuty = fakeLedcLastDuty();
    fakeMillisClock() = 100;
    starter.set(0.0f);
    assert(fakeLedcWriteCount() == 5);
    assert(fakeLedcLastDuty() == safeDuty);

    // Inverted outputs retain the same immediate logical-off behavior.
    ServoActuator inverted(22, 1000, 2000, "INVERTED_TEST");
    inverted.begin(22, 1000, 2000, true);
    const uint32_t invertedSafeDuty = fakeLedcLastDuty();
    inverted.set(0.5f);
    fakeMillisClock()++;
    inverted.off();
    assert(fakeLedcLastDuty() == invertedSafeDuty);
    return 0;
}
