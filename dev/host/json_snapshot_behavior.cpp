#include <cassert>
#include <string>
#include <utility>
#include "src/system/web/JsonSnapshot.h"
#include "src/system/web/JsonWorkspaceAllocator.h"
#include "src/system/web/LargeReadBudget.h"
#include "src/system/web/StreamedJsonResponse.h"
#include <thread>
#include <vector>

static void build(JsonDocument& doc, bool own, const char* text) {
    struct Snapshot { char owner[32]; } local{};
    snprintf(local.owner, sizeof(local.owner), "%s", text);
    const auto& snapshot = local;
    doc["owner"] = snapshot.owner;
    doc["nested"]["text"] = snapshot.owner;
    doc["array"].to<JsonArray>().add(snapshot.owner);
    doc["constant"] = "Ready";
    doc["number"] = 42;
    if (own) _ownLinkedJsonValues(doc.as<JsonVariant>());
    // Destroy the borrowed source before the asynchronous response serializes.
    memset(local.owner, 'x', sizeof(local.owner) - 1);
}

int main() {
    {
        uint8_t storage[16385]; // Deliberately unaligned caller workspace.
        JsonWorkspaceAllocator allocator(storage + 1, sizeof(storage) - 1,
                                         [](size_t) { return false; });
        JsonDocument snapshot(&allocator);
        snapshot["owner"] = std::string("Main fuel metering");
        auto rows = snapshot["channels"].to<JsonArray>();
        for (int i=0;i<12;i++) { auto row=rows.add<JsonObject>(); row["id"]=i; row["value"]=i*1.25; }
        assert(!snapshot.overflowed());
        std::string payload; serializeJson(snapshot,payload);
        snapshot.clear();
        memset(storage,0xa5,sizeof(storage));
        JsonDocument decoded; assert(deserializeJson(decoded,payload)==DeserializationError::Ok);
        assert(decoded["channels"].size()==12);assert(decoded["owner"]=="Main fuel metering");
    }
    {
        uint8_t storage[129];
        JsonWorkspaceAllocator allocator(storage+1,sizeof(storage)-1);
        JsonDocument snapshot(&allocator);
        auto rows=snapshot["channels"].to<JsonArray>();
        for(int i=0;i<1000;i++){auto row=rows.add<JsonObject>();row["id"]=i;row["name"]=std::string("Channel ")+std::to_string(i);row["value"]=i*.125;}
        assert(!snapshot.overflowed());
        std::string payload;serializeJson(snapshot,payload);assert(payload.size()==measureJson(snapshot));
        snapshot.clear();memset(storage,0xcc,sizeof(storage));
        JsonDocument decoded;assert(deserializeJson(decoded,payload)==DeserializationError::Ok);
        assert(decoded["channels"].size()==1000);assert(decoded["channels"][999]["name"]=="Channel 999");
    }
    {
        uint8_t storage[96];
        JsonWorkspaceAllocator allocator(storage,sizeof(storage));
        auto* small=static_cast<char*>(allocator.allocate(16));assert(small);memcpy(small,"snapshot",9);
        auto* grown=static_cast<char*>(allocator.reallocate(small,4096));assert(grown);assert(strcmp(grown,"snapshot")==0);
        assert(allocator.reallocate(grown,8)==grown);allocator.deallocate(grown);
        assert(allocator.allocate(0)==nullptr);
        assert(allocator.allocate(std::numeric_limits<size_t>::max())==nullptr);
    }
    {
        uint8_t storage[32];
        JsonWorkspaceAllocator allocator(storage,sizeof(storage),[](size_t) { return false; });
        JsonDocument snapshot(&allocator);snapshot["large"]=std::string(4096,'x');
        assert(snapshot.overflowed()); // No successful truncated snapshot.
    }
    assert(!LargeReadBudget::busy());
    {
        LargeReadBudget::Lease first;
        { LargeReadBudget::Lease second; first.release(); first.release(); assert(LargeReadBudget::busy()); }
        assert(!LargeReadBudget::busy());
    }
    { LargeReadBudget::Lease small(false); assert(!LargeReadBudget::busy()); }
    { LargeReadBudget::Lease abandoned; assert(LargeReadBudget::busy()); }
    assert(!LargeReadBudget::busy());
    std::vector<std::thread> workers;
    for (int i=0;i<8;i++) workers.emplace_back([] {
        for (int n=0;n<1000;n++) { LargeReadBudget::Lease reply; assert(LargeReadBudget::busy()); }
    });
    for (auto& thread : workers) thread.join();
    assert(!LargeReadBudget::busy());

    // A completed response must release its expensive tree before the HTTP
    // object itself dies; cancellation must release it as well.
    {
        StreamedJsonResponse hardware;
        hardware.getRoot()["description"] = std::string(12000, 'a');
        hardware.setLength();
        assert(LargeReadBudget::busy());
        uint8_t chunk[127];
        assert(hardware._fillBuffer(chunk, 0) == 0);
        assert(LargeReadBudget::busy());
        std::string wire;
        while (true) {
            const size_t n = hardware._fillBuffer(chunk, sizeof(chunk));
            if (!n) break;
            wire.append(reinterpret_cast<char*>(chunk), n);
            hardware.accountCopiedBytes(n);
        }
        assert(wire.size() == hardware.length());
        JsonDocument decoded;
        assert(deserializeJson(decoded, wire) == DeserializationError::Ok);
        assert(decoded["description"].as<std::string>() == std::string(12000, 'a'));
        assert(hardware.getSize() == 0);
        assert(!LargeReadBudget::busy());
    }
    {
        StreamedJsonResponse abandoned;
        abandoned.getRoot()["name"] = "Interrupted Hardware page";
        abandoned.setLength();
        uint8_t first[3];
        assert(abandoned._fillBuffer(first, sizeof(first)) == sizeof(first));
        assert(LargeReadBudget::busy());
    }
    assert(!LargeReadBudget::busy());
    JsonDocument borrowed;
    build(borrowed, false, "Fault detected");
    // The test must exercise the pinned library's borrowed-array policy.
    assert(borrowed["owner"].as<JsonString>().isStatic());
    for (const char* text : {"Fault detected", "", "PWM load 6", "Temperature source"}) {
        JsonDocument source;
        build(source, true, text);
        JsonDocument response(std::move(source));
        assert(!response.overflowed());
        assert(!response["owner"].as<JsonString>().isStatic());
        assert(response["owner"].as<std::string>() == text);
        assert(response["nested"]["text"].as<std::string>() == text);
        assert(response["array"][0].as<std::string>() == text);
        assert(response["constant"].as<std::string>() == "Ready");
        assert(response["number"] == 42);
        std::string payload;
        serializeJson(response, payload);
        assert(payload.size() == measureJson(response));
        JsonDocument decoded;
        assert(deserializeJson(decoded, payload) == DeserializationError::Ok);
        assert(decoded["owner"].as<std::string>() == text);
    }
}
