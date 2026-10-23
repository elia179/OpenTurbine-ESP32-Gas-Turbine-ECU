#include "../../src/engine/StartupTemperatureGuard.h"
#include <cassert>
#include <iostream>
int main(){
    using G=StartupTemperatureGuard;G g;
    auto check=[&](float value,uint32_t now,bool enabled=true,bool startup=true,bool healthy=true){return g.check(enabled,startup,healthy,value,900,800,500,now);};
    assert(check(900,0)==G::Immediate);g.reset();
    assert(check(800,0)==G::None);assert(check(850,499)==G::None);assert(check(800,500)==G::Sustained);
    g.reset();assert(check(850,1)==G::None);assert(check(799,400)==G::None);assert(check(850,501)==G::None);assert(check(850,1001)==G::Sustained);
    for(int mode=0;mode<3;++mode){g.reset();assert(check(850,1)==G::None);assert(check(850,400,mode!=0,mode!=1,mode!=2)==G::None);assert(check(850,500)==G::None);assert(check(850,1000)==G::Sustained);}
    g.reset();assert(check(850,1)==G::None);assert(check(850,2001)==G::None);assert(check(850,2501)==G::Sustained);
    g.reset();assert(check(850,0xffffff00u)==G::None);assert(check(850,0x000000f3u)==G::None);assert(check(850,0x000000f4u)==G::Sustained);
    g.reset();assert(g.check(true,true,true,950,0,800,1,0)==G::None);assert(g.check(true,true,true,950,0,800,1,1)==G::Sustained);
    g.reset();assert(g.check(true,true,true,800,900,0,500,1)==G::None);assert(g.check(true,true,true,900,900,0,500,2)==G::Immediate);
    std::cout<<"Startup temperature: immediate and sustained equality, continuous dwell, cooling, disable, phase, health, scheduling-gap and clock-wrap resets passed.\n";
}
