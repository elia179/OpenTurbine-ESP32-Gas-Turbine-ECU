#pragma once
#include <stdint.h>
#include <stddef.h>
#include <cstring>
#include <cmath>
#include <limits>

// Logging-only compact values. ECU calculations and CSV columns stay unchanged.
namespace SessionCapture {
template<size_t InputCount> struct Row {
    uint32_t t_ms;
    uint32_t mask;
    float    n1, n2, tot, tit, oilTemp, oilPressure, p1, p2;
    float    throttleDemand, battVoltage, fuelPressure, fuelFlow;
    float    torque, shaftPower, thrust, starterDemand;
    float    glowPlugDemand, fuelPump2Demand, propPitchDemand, oilPumpPct;
    float    wetGlowFuelDemand;
    float    glowCurrentAmps, igniterCurrentAmps, igniter2CurrentAmps, oilPumpCurrentAmps;
    float    abPumpDemand, abFuelOffset;
    float    loopHz, loopPeriodMaxMs, loopExecAvgMs, loopExecMaxMs;
    uint32_t loopOverrunCount;
    int      abMode;
    bool     abFlameOn;
    bool     abRequest, abPermitted, abExecuting, abEvidence;
    uint32_t abUnconfirmedFuelMs;
    float    registryInputs[InputCount];
    uint8_t  sysMode;   // SysMode cast to byte
};

// Selected values share a byte budget. Suitable floats normally use signed
// 16-bit fixed point. INT16_MIN escapes to the original float for nonfinite or
// out-of-range readings, so a range change can never clip or wrap logged data.
class Layout {
public:
    enum Scale : uint8_t { Exact = 0, Tenths = 1, Hundredths = 2, Thousandths = 3 };
    void reset(size_t rowSize) {
        bytes_ = rawBytes_ = scaledCount_ = 0;
        rowSize_ = rowSize <= MAX_ROW_BYTES ? rowSize : 0;
        std::memset(selected_, 0, sizeof(selected_));
        std::memset(scales_, 0, sizeof(scales_));
    }
    bool add(size_t offset, size_t size) {
        if (!size || offset > rowSize_ || size > rowSize_ - offset) return false;
        for (size_t i=offset; i<offset+size; ++i)
            if (!selected(i)) {
                selected_[i/8] |= 1U << (i%8);
                ++bytes_; ++rawBytes_;
            }
        return true;
    }
    bool addScaled(size_t offset, Scale scale) {
        if (scale == Exact) return add(offset, sizeof(float));
        if (scale > Thousandths || offset%sizeof(float) || !add(offset, sizeof(float))) return false;
        if (!scales_[offset/sizeof(float)]) { bytes_ -= 2; ++scaledCount_; }
        scales_[offset/sizeof(float)] = scale;
        return true;
    }
    size_t bytes() const { return bytes_; } // typical payload; escaped values use more
    bool hasScaledFields() const { return scaledCount_ != 0; }
    size_t storedBytes() const { return bytes_ + (hasScaledFields() ? 2 : 0); }
    size_t maxBytes() const { return rawBytes_ + 2*scaledCount_; }
    size_t pack(const void* row, void* packed, size_t capacity) const {
        const auto src = static_cast<const uint8_t*>(row);
        auto dst = static_cast<uint8_t*>(packed);
        size_t used = 0;
        for (size_t i=0; i<rowSize_;) {
            if (!selected(i)) { ++i; continue; }
            const Scale scale = scaleAt(i);
            if (scale != Exact) {
                float value; std::memcpy(&value, src+i, sizeof(value));
                const double rounded = std::isfinite(value) ? std::round(double(value)*factor(scale)) : 0;
                const bool fits = std::isfinite(value) && rounded >= -32767 && rounded <= 32767;
                const size_t needed = fits ? 2 : 6;
                if (needed > capacity-used) return 0;
                const int16_t encoded = fits ? static_cast<int16_t>(rounded) : INT16_MIN;
                std::memcpy(dst+used, &encoded, 2); used += 2;
                if (!fits) { std::memcpy(dst+used, &value, 4); used += 4; }
                i += sizeof(float);
            } else {
                if (used == capacity) return 0;
                dst[used++] = src[i++];
            }
        }
        return used;
    }
    bool unpack(const void* packed, size_t length, void* row) const {
        std::memset(row, 0, rowSize_);
        const auto src = static_cast<const uint8_t*>(packed);
        auto dst = static_cast<uint8_t*>(row);
        size_t used = 0;
        for (size_t i=0; i<rowSize_;) {
            if (!selected(i)) { ++i; continue; }
            const Scale scale = scaleAt(i);
            if (scale != Exact) {
                if (length-used < 2) return false;
                int16_t encoded; std::memcpy(&encoded, src+used, 2); used += 2;
                float value;
                if (encoded == INT16_MIN) {
                    if (length-used < 4) return false;
                    std::memcpy(&value, src+used, 4); used += 4;
                } else value = float(double(encoded)/factor(scale));
                std::memcpy(dst+i, &value, 4); i += 4;
            } else {
                if (used == length) return false;
                dst[i++] = src[used++];
            }
        }
        return used == length;
    }
private:
    static_assert(sizeof(float)==4, "Session capture requires 32-bit float");
    static constexpr size_t MAX_ROW_BYTES = 512;
    uint8_t selected_[(MAX_ROW_BYTES+7)/8]{};
    uint8_t scales_[MAX_ROW_BYTES/sizeof(float)]{};
    size_t bytes_ = 0, rawBytes_ = 0, scaledCount_ = 0, rowSize_ = 0;
    bool selected(size_t i) const { return selected_[i/8] & (1U << (i%8)); }
    Scale scaleAt(size_t i) const {
        return i%sizeof(float) ? Exact : static_cast<Scale>(scales_[i/sizeof(float)]);
    }
    static double factor(Scale scale) { return scale==Tenths ? 10.0 : scale==Hundredths ? 100.0 : 1000.0; }
};
template<class Flags, size_t InputCount>
bool configure(Layout& layout, uint32_t mask, uint32_t registryMask) {
    using SessionRow = Row<InputCount>;
    layout.reset(sizeof(SessionRow));
    bool valid = true;
    #define CAPTURE_FIELD(field) valid = layout.add(offsetof(SessionRow, field), sizeof(((SessionRow*)nullptr)->field)) && valid
    #define CAPTURE_SCALED(field, scale) valid = layout.addScaled(offsetof(SessionRow, field), Layout::scale) && valid
    CAPTURE_FIELD(t_ms);
    if (mask & Flags::SLOG_N1) { CAPTURE_FIELD(n1); }
    if (mask & Flags::SLOG_N2) { CAPTURE_FIELD(n2); }
    if (mask & Flags::SLOG_TOT) { CAPTURE_SCALED(tot, Tenths); }
    if (mask & Flags::SLOG_TIT) { CAPTURE_SCALED(tit, Tenths); }
    if (mask & Flags::SLOG_OIL_TEMP) { CAPTURE_SCALED(oilTemp, Tenths); }
    if (mask & Flags::SLOG_OIL) { CAPTURE_SCALED(oilPressure, Hundredths); }
    if (mask & Flags::SLOG_P1) { CAPTURE_SCALED(p1, Hundredths); }
    if (mask & Flags::SLOG_P2) { CAPTURE_SCALED(p2, Hundredths); }
    if (mask & Flags::SLOG_THR) { CAPTURE_SCALED(throttleDemand, Thousandths); }
    if (mask & Flags::SLOG_BATT) { CAPTURE_SCALED(battVoltage, Hundredths); }
    if (mask & Flags::SLOG_FUEL_PRESS) { CAPTURE_SCALED(fuelPressure, Hundredths); }
    if (mask & Flags::SLOG_FUEL_FLOW) { CAPTURE_FIELD(fuelFlow); }
    if (mask & Flags::SLOG_GLOW) { CAPTURE_SCALED(glowPlugDemand, Thousandths); }
    if (mask & Flags::SLOG_WET_GLOW) { CAPTURE_SCALED(wetGlowFuelDemand, Thousandths); }
    if (mask & Flags::SLOG_GLOW_CURRENT) { CAPTURE_SCALED(glowCurrentAmps, Hundredths); }
    if (mask & Flags::SLOG_IGN_CURRENT) { CAPTURE_SCALED(igniterCurrentAmps, Hundredths); }
    if (mask & Flags::SLOG_IGN2_CURRENT) { CAPTURE_SCALED(igniter2CurrentAmps, Hundredths); }
    if (mask & Flags::SLOG_OIL_CURRENT) { CAPTURE_SCALED(oilPumpCurrentAmps, Hundredths); }
    if (mask & Flags::SLOG_FP2) { CAPTURE_SCALED(fuelPump2Demand, Thousandths); }
    if (mask & Flags::SLOG_AB) { CAPTURE_FIELD(abMode); CAPTURE_FIELD(abFlameOn); CAPTURE_SCALED(abPumpDemand, Thousandths); CAPTURE_SCALED(abFuelOffset, Thousandths); CAPTURE_FIELD(abRequest); CAPTURE_FIELD(abPermitted); CAPTURE_FIELD(abExecuting); CAPTURE_FIELD(abEvidence); CAPTURE_FIELD(abUnconfirmedFuelMs); }
    if (mask & Flags::SLOG_PROP) { CAPTURE_SCALED(propPitchDemand, Thousandths); }
    if (mask & Flags::SLOG_OIL_PCT) { CAPTURE_SCALED(oilPumpPct, Tenths); }
    if (mask & Flags::SLOG_LOOP) { CAPTURE_FIELD(loopHz); CAPTURE_FIELD(loopPeriodMaxMs); CAPTURE_FIELD(loopExecAvgMs); CAPTURE_FIELD(loopExecMaxMs); CAPTURE_FIELD(loopOverrunCount); }
    if (mask & Flags::SLOG_TORQUE) { CAPTURE_SCALED(torque, Hundredths); CAPTURE_FIELD(shaftPower); }
    if (mask & Flags::SLOG_THRUST) { CAPTURE_SCALED(thrust, Hundredths); }
    if (mask & Flags::SLOG_STARTER) { CAPTURE_SCALED(starterDemand, Thousandths); }
    if (mask & Flags::SLOG_MODE) { CAPTURE_FIELD(sysMode); }
    #undef CAPTURE_FIELD
    #undef CAPTURE_SCALED
    for (uint8_t i=0; i<InputCount; ++i)
        if (registryMask & (1UL << i))
            valid = layout.add(offsetof(SessionRow, registryInputs) + i*sizeof(float), sizeof(float)) && valid;
    return valid;
}
} // namespace SessionCapture
