#include <cassert>
#include <iostream>
#include "src/system/MavlinkMigration.h"
int main(){
    using namespace MavlinkMigration;
    Link current,old;old.enabled=true;old.tx=17;old.rx=16;old.baud=115200;old.interval=10;
    auto migrated=resolve(current,old);
    assert(migrated.enabled&&!migrated.commands&&!migrated.review);
    assert(migrated.tx==17&&migrated.rx==16&&migrated.baud==115200&&migrated.interval==20);
    current.enabled=true;current.commands=true;current.tx=20;current.rx=21;
    auto conflict=resolve(current,old);assert(conflict.review&&!conflict.enabled&&!conflict.commands);
    current.tx=17;current.rx=16;auto shared=resolve(current,old);assert(shared.enabled&&!shared.review);
    old.enabled=false;auto unchanged=resolve(current,old);assert(unchanged.enabled&&unchanged.commands);
    current.review=true;auto pending=resolve(current,old);assert(!pending.enabled&&!pending.commands);
    current.review=false;auto chosen=resolve(current,old);assert(chosen.enabled);
    std::cout<<"Legacy link migration: retained wiring/rate, default permissions, conflicting and shared routes, explicit resolution passed\n";
}
