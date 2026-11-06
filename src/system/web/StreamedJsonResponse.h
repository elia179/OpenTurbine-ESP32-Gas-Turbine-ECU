#pragma once
#include <AsyncJson.h>
#include "LargeReadBudget.h"
#include <utility>

// Serialize one owned tree a chunk at a time, releasing its pool as soon as
// the final bytes reach the transmit buffer rather than waiting for peer FIN.
class StreamedJsonResponse final : public AsyncJsonResponse {
public:
    StreamedJsonResponse() : AsyncJsonResponse(false) {}
    explicit StreamedJsonResponse(JsonDocument&& doc) : AsyncJsonResponse(false) {
        _jsonBuffer = std::move(doc);
        _root = _jsonBuffer.as<JsonVariant>();
        setLength();
    }
    ~StreamedJsonResponse() override { releaseJson(); }
    size_t _fillBuffer(uint8_t* data, size_t len) override {
        if (_jsonReleased) return 0;
        const size_t written = AsyncJsonResponse::_fillBuffer(data, len);
        if (written != RESPONSE_TRY_AGAIN && _sentLength + written >= _contentLength)
            releaseJson();
        return written;
    }
private:
    LargeReadBudget::Lease _budget;
    bool _jsonReleased = false;
    void releaseJson() {
        if (_jsonReleased) return;
        _root = JsonVariant();
        _jsonBuffer.clear();
        _jsonBuffer.shrinkToFit();
        _jsonReleased = true;
        _budget.release();
    }
};
