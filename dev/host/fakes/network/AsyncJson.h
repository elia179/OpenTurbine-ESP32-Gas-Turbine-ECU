#pragma once
#include <ArduinoJson.h>
#include <algorithm>
#include <cstring>
#include <string>
#include <cstddef>
#include <cstdint>
constexpr size_t RESPONSE_TRY_AGAIN = static_cast<size_t>(-1);
// Model the pinned library's document ownership, root, offsets and chunk API.
// The production wrapper is compiled unchanged against this transport fake.
class AsyncJsonResponse {
protected:
    JsonDocument _jsonBuffer;
    JsonVariant _root;
    size_t _contentLength = 0;
    size_t _sentLength = 0;
public:
    explicit AsyncJsonResponse(bool) { _root = _jsonBuffer.add<JsonObject>(); }
    virtual ~AsyncJsonResponse() = default;
    JsonVariant& getRoot() { return _root; }
    size_t getSize() const { return _jsonBuffer.size(); }
    size_t setLength() { return _contentLength = measureJson(_root); }
    size_t length() const { return _contentLength; }
    void accountCopiedBytes(size_t count) { _sentLength += count; }
    virtual size_t _fillBuffer(uint8_t* out, size_t len) {
        std::string payload;
        serializeJson(_root, payload);
        if (_sentLength >= payload.size()) return 0;
        const size_t count = std::min(len, payload.size() - _sentLength);
        if (count) std::memcpy(out, payload.data() + _sentLength, count);
        return count;
    }
};
