#pragma once

namespace MavlinkMigration {
struct Link {
    bool enabled=false, commands=false, review=false;
    int tx=-1, rx=-1, baud=57600, interval=100;
};
inline Link resolve(Link current,const Link& legacy) {
    if(legacy.enabled){
        if(!current.enabled){
            current.enabled=true;current.tx=legacy.tx;current.rx=legacy.rx;
            current.baud=legacy.baud;current.interval=legacy.interval<20?20:legacy.interval;
            current.commands=false;
        }else if(current.tx!=legacy.tx||current.rx!=legacy.rx)current.review=true;
    }
    if(current.review){current.enabled=false;current.commands=false;}
    return current;
}
}
