#include <cassert>
#include <cstring>
#include <deque>
#include <string>
#include <cstdio>
#include <cmath>
#include <limits>
#include <vector>
class Print;
#include "../../src/system/Config.h"
#include "../../src/system/SessionCapture.h"
#include "../../src/system/ByteRecordRing.h"
#include "../../src/system/SessionMemory.h"
#include "../../src/system/SessionArchivePlan.h"

int main() {
    const size_t minimum = 16 * 1024;
    assert(SessionMemory::externalBudget(0,0,minimum)==0);
    assert(SessionMemory::externalBudget(SessionMemory::EXTERNAL_RESERVE,1024*1024,minimum)==0);
    assert(SessionMemory::externalBudget(SessionMemory::EXTERNAL_RESERVE+minimum-1,1024*1024,minimum)==0);
    assert(SessionMemory::externalBudget(2*1024*1024,minimum-1,minimum)==0);
    assert(SessionMemory::externalBudget(2*1024*1024,minimum,minimum)==minimum);
    assert(SessionMemory::externalBudget(2*1024*1024,2*1024*1024,minimum)==1024*1024);
    assert(SessionMemory::externalBudget(300*1024,100*1024,minimum)==44*1024);
    // More than 65535 short records: fill, overwrite, and read back the exact
    // newest tail across wraps. This exercises the expanded budget, not merely
    // the old small-ring path with a larger capacity estimate.
    std::vector<uint8_t> largeStorage(SessionMemory::EXTERNAL_LIMIT);
    ByteRecordRing large(largeStorage.data(),largeStorage.size(),sizeof(uint32_t));
    const uint32_t largeCapacity = largeStorage.size()/sizeof(uint32_t);
    static_assert(SessionMemory::EXTERNAL_LIMIT/sizeof(uint32_t)>UINT16_MAX);
    for(uint32_t i=0;i<largeCapacity+1000;++i) {
        uint32_t dropped=0;
        assert(large.push(reinterpret_cast<const char*>(&i),sizeof(i),true,dropped));
        assert(dropped==(i>=largeCapacity?1U:0U));
    }
    assert(large.count()==largeCapacity);
    SessionArchivePlan plan;
    plan.begin(large);
    char plannedRecord[sizeof(uint32_t)+1];
    const auto csvSize=[](const char* data,size_t bytes)->size_t {
        assert(bytes==sizeof(uint32_t));uint32_t value;std::memcpy(&value,data,bytes);
        return 8+value%17; // Variable rendered lengths, including newline.
    };
    size_t expectedBytes=0;
    for(uint32_t value=1000;value<largeCapacity+1000;++value)expectedBytes+=8+value%17;
    while(!plan.ready())plan.scanOne(plannedRecord,sizeof(plannedRecord),csvSize);
    assert(plan.bytes()==expectedBytes && large.count()==largeCapacity);
    for(uint32_t expected=1000;expected<largeCapacity+1000;++expected) {
        char record[sizeof(uint32_t)+1];
        assert(large.peek(record,sizeof(record)));
        uint32_t actual;std::memcpy(&actual,record,sizeof(actual));
        assert(actual==expected);large.pop();
    }
    assert(large.count()==0);
    // A changing flash budget discards oldest rows, retaining the newest tail.
    uint32_t dropped=0;
    for(uint32_t value=0;value<1000;++value)assert(large.push(reinterpret_cast<const char*>(&value),sizeof(value),false,dropped));
    plan.begin(large);
    while(!plan.ready())plan.scanOne(plannedRecord,sizeof(plannedRecord),csvSize);
    uint32_t firstKept=0;
    for(size_t available:{size_t(4096),size_t(2048)}) {
        while(plan.bytes()>available) {
            assert(large.peek(plannedRecord,sizeof(plannedRecord)));
            plan.consumed(csvSize(plannedRecord,sizeof(uint32_t)));large.pop();++firstKept;
        }
        assert(large.count()==1000-firstKept);
    }
    assert(firstKept>0&&large.count()>0);
    for(uint32_t value=firstKept;value<1000;++value) {
        assert(large.peek(plannedRecord,sizeof(plannedRecord)));
        uint32_t actual;std::memcpy(&actual,plannedRecord,sizeof(actual));assert(actual==value);
        plan.consumed(csvSize(plannedRecord,sizeof(actual)));large.pop();
    }
    assert(plan.bytes()==0);
    using Row = SessionCapture::Row<24>;
    SessionCapture::Layout layout;
    assert((SessionCapture::configure<Config,24>(layout,Config::SLOG_DEFAULT,0)));
    assert(layout.bytes()==12); // timestamp + raw RPM + tenths C + hundredths bar
    const size_t capacity=64*sizeof(Row)/layout.storedBytes();
    assert(capacity>=900);
    Row input{}, output{};
    input.t_ms=0xffffffff; input.n1=60000.125f; input.tot=-123.25f;
    uint32_t nanBits=0x7fc12345;
    std::memcpy(&input.oilPressure,&nanBits,4);
    input.n2=42;
    uint8_t packed[2*sizeof(Row)]{};
    size_t length=0;
    length=layout.pack(&input,packed,sizeof(packed));assert(length && layout.unpack(packed,length,&output));
    assert(output.t_ms==input.t_ms && output.n1==input.n1 && std::abs(output.tot-input.tot)<=.0501f);
    assert(std::memcmp(&output.oilPressure,&input.oilPressure,4)==0 && output.n2==0);
    assert((SessionCapture::configure<Config,24>(layout,Config::SLOG_MODE | Config::SLOG_AB | Config::SLOG_LOOP | Config::SLOG_TORQUE,(1U<<23)|(1U<<0))));
    input.sysMode=5;input.abMode=3;input.abFlameOn=true;input.abRequest=true;
    input.abPermitted=true;input.abExecuting=true;input.abEvidence=true;
    input.abUnconfirmedFuelMs=4000000000U;input.abPumpDemand=.125f;input.abFuelOffset=-.25f;
    input.loopHz=1000;input.loopPeriodMaxMs=3.25f;input.loopExecAvgMs=.125f;
    input.loopExecMaxMs=1.75f;input.loopOverrunCount=0xf1234567;
    input.torque=-200.5f;input.shaftPower=12345.25f;
    input.registryInputs[0]=-1.2345f;input.registryInputs[23]=999.75f;
    length=layout.pack(&input,packed,sizeof(packed));assert(length && layout.unpack(packed,length,&output));
    assert(output.sysMode==5 && output.abMode==3 && output.abFlameOn && output.abRequest);
    assert(output.abPermitted && output.abExecuting && output.abEvidence);
    assert(output.abUnconfirmedFuelMs==4000000000U && output.abPumpDemand==.125f && output.abFuelOffset==-.25f);
    assert(output.loopHz==1000 && output.loopPeriodMaxMs==3.25f && output.loopExecAvgMs==.125f);
    assert(output.loopExecMaxMs==1.75f && output.loopOverrunCount==0xf1234567);
    assert(output.torque==-200.5f && output.shaftPower==12345.25f);
    assert(output.registryInputs[0]==-1.2345f && output.registryInputs[23]==999.75f && output.n1==0);
    assert((SessionCapture::configure<Config,24>(layout,0x07ffffff,0x00ffffff)));
    assert(layout.bytes()<=sizeof(Row) && 64*sizeof(Row)/layout.storedBytes()>=64);
    // Every named field except the per-run mask must survive the all-fields layout.
    const auto fullBytes=layout.bytes();
    uint8_t original[sizeof(Row)];std::memset(original,0x5a,sizeof(original));
    length=layout.pack(original,packed,sizeof(packed));assert(length && layout.unpack(packed,length,&output));
    uint8_t repacked[2*sizeof(Row)];const auto repeated=layout.pack(&output,repacked,sizeof(repacked));
    assert(repeated==length && std::memcmp(packed,repacked,length)==0);
    // Per-reading escapes preserve unusual values instead of clipping them.
    assert((SessionCapture::configure<Config,24>(layout,Config::SLOG_TOT|Config::SLOG_OIL|Config::SLOG_THR,0)));
    const float cases[]={0.f,-0.f,4.12345f,-4.12345f,327.67f,-327.67f,327.675f,-327.675f,
        3276.7f,-3276.7f,1e30f,-1e30f,std::numeric_limits<float>::infinity(),-std::numeric_limits<float>::infinity()};
    for(float value:cases){
        input.tot=input.oilPressure=input.throttleDemand=value;
        length=layout.pack(&input,packed,sizeof(packed));assert(length && layout.unpack(packed,length,&output));
        const float in[]={input.tot,input.oilPressure,input.throttleDemand};
        const float out[]={output.tot,output.oilPressure,output.throttleDemand};
        const double scales[]={10,100,1000};
        for(int i=0;i<3;++i){
            const double rounded=std::isfinite(in[i])?std::round(double(in[i])*scales[i]):0;
            if(!std::isfinite(in[i])||rounded < -32767 || rounded > 32767)
                assert(std::memcmp(&in[i],&out[i],4)==0);
            else assert(std::abs(double(out[i])-in[i])<=.5002/scales[i]+std::abs(double(in[i]))*1e-7);
        }
        assert(!layout.unpack(packed,length-1,&output));
        assert(!layout.unpack(packed,length+1,&output));
        assert(!layout.pack(&input,packed,length-1));
    }
    assert((SessionCapture::configure<Config,24>(layout,Config::SLOG_OIL,0)));
    std::memcpy(&input.oilPressure,&nanBits,4);
    length=layout.pack(&input,packed,sizeof(packed));assert(length==10 && layout.unpack(packed,length,&output));
    assert(std::memcmp(&input.oilPressure,&output.oilPressure,4)==0);
    input.oilPressure=4.125f;length=layout.pack(&input,packed,sizeof(packed));
    assert(length==6 && layout.unpack(packed,length,&output));assert(std::abs(output.oilPressure-4.13f)<.00001f);
    input.oilPressure=-4.125f;length=layout.pack(&input,packed,sizeof(packed));
    assert(layout.unpack(packed,length,&output));assert(std::abs(output.oilPressure+4.13f)<.00001f);
    layout.reset(sizeof(Row));assert(!layout.add(sizeof(Row),1));
    assert(!layout.add(0,sizeof(Row)+1));assert(layout.bytes()==0);
    assert(layout.add(0,4)&&layout.add(0,4)&&layout.bytes()==4);

    uint8_t fixedStorage[12];ByteRecordRing fixed(fixedStorage,sizeof(fixedStorage),4);
    uint32_t fixedDropped=0;
    assert(fixed.push("1111",4,true,fixedDropped));assert(fixed.push("2222",4,true,fixedDropped));
    assert(fixed.push("3333",4,true,fixedDropped));assert(fixed.used()==12 && fixed.count()==3);
    assert(!fixed.push("x",1,true,fixedDropped));assert(!fixed.push("4444",4,false,fixedDropped));
    assert(fixed.push("4444",4,true,fixedDropped)&&fixedDropped==1);
    char fixedOut[5];assert(fixed.peek(fixedOut,sizeof(fixedOut))&&std::string(fixedOut)=="2222");
    fixed.pop();fixed.pop();fixed.pop();assert(!fixed.count()&&!fixed.used());
    fixed.attach(fixedStorage,sizeof(fixedStorage),4);assert(fixed.push("5555",4,true,fixedDropped));
    assert(fixed.peek(fixedOut,sizeof(fixedOut))&&std::string(fixedOut)=="5555");
    uint8_t storage[257];ByteRecordRing ring(storage,sizeof(storage));
    std::deque<std::string> model;size_t used=0;
    uint32_t seed=1234567,totalDropped=0;
    for(unsigned i=0;i<10000;++i) {
        seed=seed*1664525+1013904223;
        const size_t len=1+(seed%190);
        const bool overwrite=(i%3)!=0;
        std::string item(len,static_cast<char>('A'+i%26));
        uint32_t dropped=99;
        const bool expected=overwrite || used+len+2<=sizeof(storage);
        assert(ring.push(item.data(),len,overwrite,dropped)==expected);
        uint32_t removed=0;
        if(expected) {
            while(used+len+2>sizeof(storage)){used-=model.front().size()+2;model.pop_front();++removed;}
            model.push_back(item);used+=len+2;
        }
        assert(dropped==removed);totalDropped+=dropped;
        assert(ring.count()==model.size() && ring.used()==used);
        if(!model.empty()) {
            char out[258];assert(ring.peek(out,sizeof(out)));assert(out==model.front());
            assert(!ring.peek(out,model.front().size()));
            if(i%7==0){ring.pop();used-=model.front().size()+2;model.pop_front();}
        }
        if(i%137==0){ring.clear();model.clear();used=0;}
    }
    assert(totalDropped>1000);
    const auto count=ring.count();
    assert(!ring.push("",0,true,dropped));
    assert(!ring.push("x",70000,true,dropped));assert(ring.count()==count);
    ring.clear();char out[8];assert(!ring.peek(out,sizeof(out)));
    // At an illustrative 80-byte event, the unchanged 7500 B budget holds 91.
    static uint8_t eventStorage[7500];ByteRecordRing events(eventStorage,sizeof(eventStorage));
    std::string event(80,'x');for(int i=0;i<91;++i)assert(events.push(event.data(),80,false,dropped));
    assert(events.count()==91);assert(!events.push(event.data(),80,false,dropped));
    std::printf("LOG_MEMORY_PASS row=%u default_stored_bytes=14 capacity=%u all_bytes=%u events80=%u\n",
      unsigned(sizeof(Row)),unsigned(capacity),unsigned(fullBytes),unsigned(events.count()));
    return 0;
}
