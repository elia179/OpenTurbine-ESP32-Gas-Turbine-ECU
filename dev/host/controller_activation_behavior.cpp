#include <cassert>
#include <iostream>
#include "../../src/engine/controllers/ControllerActivation.h"

struct Rule { bool enabled; uint8_t activateEvents, deactivateEvents, target; };
int main() {
    using C = ControllerActivation;
    C state;
    Rule rules[] = {{true,1<<C::Sequence,1<<C::Shutdown,1},
                    {true,1<<C::Shutdown,1<<C::Standby,1},
                    {true,1<<C::Startup,(1<<C::Running)|(1<<C::Standby),2}};
    int safe[3] = {}; int order = 0;
    auto target = [&](uint8_t i) { return rules[i].target; };
    auto off = [&](uint8_t i) { safe[i]++; order++; };
    assert(state.enter(C::Startup,rules,3,target,off)==C::Ok);
    assert(state.active(2) && !state.active(0));
    assert(state.activate(0,rules,3,target)==C::Ok);
    assert(state.activate(0,rules,3,target)==C::Ok); // no restart
    assert(state.activate(1,rules,3,target)==C::Conflict);
    assert(state.enter(C::Running,rules,3,target,off)==C::Ok);
    assert(!state.active(2) && state.active(0) && safe[2]==1);
    assert(state.enter(C::Shutdown,rules,3,target,off)==C::Ok);
    assert(!state.active(0) && state.active(1) && safe[0]==1);
    state.deactivate(0,off); assert(safe[0]==1); // cannot disturb new owner
    state.fault(off); assert(safe[1]==1 && !state.active(1));
    assert(state.activate(0,rules,3,target)==C::Faulted);
    assert(state.enter(C::Standby,rules,3,target,off)==C::Ok);
    rules[0].enabled=false;
    assert(state.activate(0,rules,3,target)==C::Disabled);
    rules[0].enabled=true; assert(state.activate(0,rules,3,target)==C::Ok);
    rules[0].enabled=false;
    state.enter(C::Running,rules,3,target,off);
    assert(!state.active(0) && safe[0]==2);
    assert(state.enter(C::Sequence,rules,3,target,off)==C::Invalid);
    assert(state.activate(16,rules,3,target)==C::Invalid);
    state.reset(); assert(!state.active(0));
    rules[0].enabled=true;rules[0].activateEvents=(1<<C::Startup)|(1<<C::Running);
    state.inhibit(1);state.enter(C::Startup,rules,3,target,off);
    assert(!state.active(0)&&state.inhibited(0));
    assert(state.activate(0,rules,3,target)==C::Disabled);
    state.reset();state.enter(C::Startup,rules,3,target,off);assert(state.active(0));
    state.deactivate(0,off);state.enter(C::Running,rules,3,target,off);assert(state.active(0));
    bool on=false;assert(C::blockId("ControllerOn_65535",&on)==65535&&on);
    assert(C::blockId("ControllerOff_42",&on)==42&&!on);
    assert(!C::blockId("ControllerOn_0")&&!C::blockId("ControllerOn_65536"));
    assert(!C::blockId("ControllerOn_42junk")&&!C::blockId("ControllerOn_01"));
    std::cout << "Controller activation: event handover, continuous ownership, idempotence, disable, conflict and fault/reset behavior passed.\n";
}
