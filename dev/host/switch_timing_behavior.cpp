#include <cassert>
#include <iostream>
#include "../../src/hal/SwitchTiming.h"

int main() {
    SwitchDebounce sw;
    assert(!sw.sample(false,1,0));
    assert(!sw.sample(true,2,5));
    assert(!sw.sample(false,3,10));
    assert(!sw.sample(true,4,12));
    assert(!sw.sample(true,4,40)); // cached sample cannot confirm a transition
    assert(!sw.sample(true,5,31));
    assert(sw.sample(true,6,32));
    assert(sw.sample(false,7,40));
    assert(sw.sample(false,8,59));
    assert(!sw.sample(false,9,60));
    sw.reset();assert(sw.sample(true,10,100)); // boot level, not a fabricated press
    sw.reset();assert(!sw.sample(false,11,0xfffffff0U));
    assert(!sw.sample(true,12,0xfffffffaU));
    assert(!sw.sample(true,13,0x0dU));
    assert(sw.sample(true,14,0x0eU));

    ConditionConfirmation a,b;
    assert(!a.update(true,0,100));
    assert(!a.update(true,99,100));assert(a.update(true,100,100));
    assert(!b.update(true,100,100)); // independent controller
    assert(!a.update(false,101,100));assert(!a.update(true,102,100));
    assert(!a.update(true,201,100));assert(a.update(true,202,100));
    a.reset();assert(!a.update(true,300,100));
    assert(!a.update(true,1400,100)); // missing observations restart confirmation
    assert(a.update(true,1500,100));
    assert(a.update(true,1501,0));assert(!a.update(false,1502,0));
    assert(a.update(true,1600,0));assert(!a.update(true,1601,20));assert(a.update(true,1621,20));
    a.reset();assert(!a.update(true,0xfffffff0U,32));
    assert(!a.update(true,0x0fU,32));assert(a.update(true,0x10U,32));

    // The two stages add: contact filtering first, then the user's delay.
    sw.reset();a.reset();assert(!sw.sample(false,1,0));
    for(uint32_t now=10,seq=2;now<=130;now+=10,++seq){
        bool active=sw.sample(true,seq,now);
        assert(a.update(active,now,100)==(now>=130));
    }
    assert(!a.update(false,140,100));
    std::cout<<"Switch timing: 20 ms both edges, bounce, fresh samples, boot/reconnect baseline, independent continuous confirmation, reset, gaps, zero and clock wrap passed.\n";
}
