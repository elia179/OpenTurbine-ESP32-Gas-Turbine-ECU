#pragma once
#include <stdint.h>
#include <math.h>

namespace OpenTurbineMavlink {
// Source/target permissions are checked by the link before offering a sample.
// A duplicate or invalid frame must never extend input freshness.
class RemoteDemand {
    uint32_t session_=0,sequence_=0,received_=0;
    float value_=0;
    bool sampled_=false;
public:
    bool healthy(uint32_t now,uint16_t timeoutMs) const {
        return sampled_&&uint32_t(now-received_)<timeoutMs;
    }
    bool offer(uint32_t session,uint32_t sequence,float value,uint32_t now,uint16_t timeoutMs) {
        if(!session||!isfinite(value)||value<0||value>1)return false;
        if(sampled_){
            if(session==session_ && int32_t(sequence-sequence_)<=0)return false;
            if(session!=session_ && healthy(now,timeoutMs))return false;
        }
        session_=session;sequence_=sequence;received_=now;value_=value;sampled_=true;
        return true;
    }
    float value() const {return value_;}
    uint32_t age(uint32_t now) const {return sampled_?uint32_t(now-received_):UINT32_MAX;}
    void reset(){session_=sequence_=received_=0;value_=0;sampled_=false;}
};
}
