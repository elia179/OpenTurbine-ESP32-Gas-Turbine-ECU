#include <cassert>
#include <deque>
#include <vector>
#include <fstream>
#include <iostream>
#include "libraries/OpenTurbineMavlink/src/OpenTurbineMavlinkClient.h"
#include "libraries/OpenTurbineMavlink/src/RemoteDemand.h"
using namespace OpenTurbineMavlink;
struct Transport {
    std::deque<uint8_t> incoming;
    std::vector<uint8_t> outgoing;
    int available()const{return int(incoming.size());}
    int read(){int c=incoming.front();incoming.pop_front();return c;}
    int availableForWrite()const{return 4096;}
    size_t write(const uint8_t* p,size_t n){outgoing.insert(outgoing.end(),p,p+n);return n;}
    void feed(const mavlink_message_t& message){uint8_t bytes[MAVLINK_MAX_PACKET_LEN];size_t n=mavlink_msg_to_send_buffer(bytes,&message);incoming.insert(incoming.end(),bytes,bytes+n);}
};
int main(){
    RemoteDemand demand;
    assert(!demand.healthy(0,500));
    assert(demand.offer(11,1,.5f,100,500));
    assert(!demand.offer(11,1,.9f,400,500)); // duplicate cannot refresh age
    assert(!demand.offer(12,2,.9f,400,500)); // no fresh-session takeover
    assert(!demand.offer(11,2,NAN,400,500));
    assert(!demand.healthy(600,500));
    assert(demand.offer(12,1,.25f,600,500));
    assert(!demand.offer(12,0,.5f,700,500));
    demand.reset();assert(demand.offer(1,UINT32_MAX,.5f,UINT32_MAX-50,500));
    assert(demand.offer(1,0,.6f,20,500));assert(demand.healthy(50,500));

    // Actual generated parser: corrupt CRC, oversized lengths and signed frames
    // cannot be accepted, and a later good packet must resynchronise.
    Writer source; mavlink_message_t frame{},decoded{};mavlink_heartbeat_t beat{};
    mavlink_msg_heartbeat_encode_status(1,200,source.status(),&frame,&beat);
    struct FullPort {int availableForWrite(){return 0;} size_t write(const uint8_t*,size_t){assert(false);return 0;}} full;
    assert(!source.send(full,frame));
    mavlink_msg_heartbeat_encode_status(1,200,source.status(),&frame,&beat);
    assert(frame.seq==0); // local backpressure does not invent wire loss
    uint8_t wire[MAVLINK_MAX_PACKET_LEN];size_t length=mavlink_msg_to_send_buffer(wire,&frame);
    Parser parser;wire[length-1]^=0x80;bool accepted=false;
    for(size_t i=0;i<length;i++)accepted|=parser.push(wire[i],decoded);
    assert(!accepted);parser.reset();
    uint8_t invalid[]={0xfd,255,0,0,0,1,200,0,0,0};
    for(auto c:invalid)assert(!parser.push(c,decoded));
    length=mavlink_msg_to_send_buffer(wire,&frame);accepted=false;
    for(size_t i=0;i<length;i++)accepted|=parser.push(wire[i],decoded);
    assert(accepted);parser.reset();
    frame.incompat_flags=MAVLINK_IFLAG_SIGNED;frame.len=MAVLINK_MSG_ID_HEARTBEAT_LEN;
    uint16_t crc;crc_init(&crc);
    uint8_t header[]={frame.len,frame.incompat_flags,frame.compat_flags,frame.seq,frame.sysid,frame.compid,0,0,0};
    crc_accumulate_buffer(&crc,reinterpret_cast<const char*>(header),sizeof(header));
    crc_accumulate_buffer(&crc,_MAV_PAYLOAD(&frame),frame.len);crc_accumulate(MAVLINK_MSG_ID_HEARTBEAT_CRC,&crc);frame.checksum=crc;
    length=mavlink_msg_to_send_buffer(wire,&frame);accepted=false;
    for(size_t i=0;i<length;i++)accepted|=parser.push(wire[i],decoded);
    assert(!accepted);

    using TestClient=Client<Transport,4>;
    Transport serial;TestClient client(serial);client.begin(100);
    Writer ecu;mavlink_message_t message{};
    mavlink_ot_link_info_t info{};info.boot_id=1;info.catalog_revision=10;info.channel_count=2;info.telemetry_interval_ms=100;
    auto hello=[&](uint32_t now){mavlink_msg_ot_link_info_encode_status(ecu.system,ecu.component,ecu.status(),&message,&info);serial.feed(message);client.update(now);};
    hello(100);assert(!client.catalogueReady());
    mavlink_ot_channel_info_t channel{};channel.boot_id=1;channel.catalog_revision=10;channel.channel_id=256;channel.index=0;
    auto description=[&](uint32_t now){mavlink_msg_ot_channel_info_encode_status(ecu.system,ecu.component,ecu.status(),&message,&channel);serial.feed(message);client.update(now);};
    description(110);description(120);assert(!client.catalogueReady());
    mavlink_ot_channel_values_t values{};values.boot_id=1;values.catalog_revision=10;values.time_boot_ms=200;values.count=2;
    values.channel_ids[0]=256;values.channel_ids[1]=257;values.values[0]=3.5f;values.values[1]=NAN;values.flags[0]=values.flags[1]=SampleHealthy;
    auto samples=[&](uint32_t now){mavlink_msg_ot_channel_values_encode_status(ecu.system,ecu.component,ecu.status(),&message,&values);serial.feed(message);client.update(now);};
    samples(130);assert(!client.channel(0)->sampled);
    channel.index=1;channel.channel_id=257;description(140);assert(client.catalogueReady());
    values.count=9;samples(150);assert(!client.channel(0)->sampled);
    values.count=2;values.channel_ids[1]=999;samples(160);assert(!client.channel(0)->sampled);
    values.channel_ids[1]=257;samples(200);
    assert(client.valid(*client.channel(0),200));assert(!client.valid(*client.channel(1),200));
    samples(1000);assert(!client.valid(*client.channel(0),1700)); // replay does not refresh
    values.time_boot_ms=300;samples(1800);assert(client.valid(*client.channel(0),1800));

    mavlink_ot_engine_state_t state{};state.boot_id=1;state.time_boot_ms=1990;
    mavlink_msg_ot_engine_state_encode_status(ecu.system,ecu.component,ecu.status(),&message,&state);serial.feed(message);client.update(1990);
    assert(client.start(2000));
    Parser outgoing;mavlink_message_t request{};bool found=false;
    mavlink_ot_command_request_t start{};
    for(uint8_t c:serial.outgoing)if(outgoing.push(c,request)&&request.msgid==MAVLINK_MSG_ID_OT_COMMAND_REQUEST){found=true;mavlink_msg_ot_command_request_decode(&request,&start);}
    assert(found);
    assert(start.operation==Start&&start.boot_id==1&&start.sender_session==100);
    serial.outgoing.clear();assert(client.stop(2001));
    mavlink_ot_command_result_t result{};result.sender_session=100;result.request_id=start.request_id;result.operation=Start;
    result.target_system=255;result.target_component=190;result.result=MAV_RESULT_ACCEPTED;
    auto answer=[&](uint32_t now){mavlink_msg_ot_command_result_encode_status(ecu.system,ecu.component,ecu.status(),&message,&result);serial.feed(message);client.update(now);};
    answer(2010);assert(client.commandState==TestClient::Waiting); // old Start ACK cannot complete Stop
    result.request_id++;result.operation=Stop;answer(2020);assert(client.commandState==TestClient::Accepted);
    assert(client.start(2100));info.boot_id=2;hello(2110);assert(client.commandState==TestClient::Unconfirmed);
    serial.outgoing.clear();client.update(3200);
    Parser afterReboot;for(uint8_t c:serial.outgoing)if(afterReboot.push(c,request))assert(request.msgid!=MAVLINK_MSG_ID_OT_COMMAND_REQUEST);

    // Independently decode these standard frames with upstream pymavlink.
    Transport golden;mavlink_heartbeat_t heartbeat{};heartbeat.type=MAV_TYPE_GENERIC;heartbeat.autopilot=MAV_AUTOPILOT_INVALID;
    mavlink_msg_heartbeat_encode_status(ecu.system,ecu.component,ecu.status(),&message,&heartbeat);ecu.send(golden,message);
    mavlink_efi_status_t efi{};efi.rpm=60000;efi.exhaust_gas_temperature=650;efi.fuel_flow=250;
    mavlink_msg_efi_status_encode_status(ecu.system,ecu.component,ecu.status(),&message,&efi);ecu.send(golden,message);
    std::ofstream file("artifacts/mavlink-standard-golden.bin",std::ios::binary);file.write(reinterpret_cast<const char*>(golden.outgoing.data()),golden.outgoing.size());
    std::cout<<"MAVLink client metadata completeness, stale/invalid batches, correlated ACKs, reboot behavior and remote-demand freshness passed\n";
}
