#include "src/system/SessionFiles.h"

#include <cassert>
#include <climits>
#include <cstdint>
#include <iostream>

int main() {
    uint32_t selected = 0;

    assert(SessionFiles::nextSessionNumber(0, 0, selected) && selected == 1);
    assert(SessionFiles::nextSessionNumber(1, 0, selected) && selected == 1);
    assert(SessionFiles::nextSessionNumber(2, 1, selected) && selected == 2);
    assert(SessionFiles::nextSessionNumber(0, 9, selected) && selected == 10);
    assert(SessionFiles::nextSessionNumber(4, 9, selected) && selected == 10);
    assert(SessionFiles::nextSessionNumber(42, 9, selected) && selected == 42);
    assert(!SessionFiles::nextSessionNumber(static_cast<uint32_t>(INT_MAX) + 1U,
                                            0, selected));
    assert(!SessionFiles::nextSessionNumber(1,
                                            static_cast<uint32_t>(INT_MAX), selected));

    int parsed = -1;
    assert(SessionFiles::parseRunNumber("/logs/session_42.csv", parsed));
    assert(parsed == 42);
    assert(!SessionFiles::parseRunNumber("/logs/session_42.csv.tmp", parsed));

    std::cout << "Session file identity behavior passed\n";
    return 0;
}
