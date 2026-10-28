#pragma once
#include "../engine/EngineData.h"
#include "HardwareConfig.h"
#include <Arduino.h>
#include <HardwareSerial.h>

// ============================================================
//  MAVLinkOutput — minimal MAVLink v1 UART telemetry
//
//  Sends three MAVLink message types over UART2 (configurable):
//
//  1. HEARTBEAT (id 0)     — system/autopilot type, mode, status
//  2. NAMED_VALUE_FLOAT (id 251) — engine sensor values by name
//  3. STATUSTEXT (id 253)  — fault description / last event text
//
//  No external library required — messages hand-crafted per the
//  MAVLink v1 wire format (start, len, seq, sys, comp, msgid,
//  payload, crc16-X25).
//
//  Typical use: connect a ground station (Mission Planner,
//  QGroundControl, MAVProxy) to the UART TX pin.  Engine data
//  appears as named floats visible in the "Status" tab.
//
//  Enable: set HardwareConfig::hasMAVLink = true and configure
//  mavlinkTxPin / mavlinkBaud / mavlinkIntervalMs.
//
//  Note: this is a TX-only implementation — no RX / command
//  handling.  The MAVLink system ID is 1 (component 200).
// ============================================================

class MAVLinkOutput {
public:
    static constexpr uint8_t SYS_ID   = 1;
    static constexpr uint8_t COMP_ID  = 200;  // onboard computer
    static constexpr uint8_t MAV_TYPE_GENERIC          = 0;
    static constexpr uint8_t MAV_AUTOPILOT_INVALID     = 8;
    static constexpr uint8_t MAV_STATE_ACTIVE          = 4;
    static constexpr uint8_t MAV_STATE_STANDBY         = 3;
    static constexpr uint8_t MAV_STATE_EMERGENCY       = 6;

    void begin(HardwareSerial& serial) {
        _serial = &serial;
        _seq    = 0;
        _rrStart = 0;
        _lastMs = 0;
        _lastHeartbeatMs = millis() - 1000UL;
    }

    // Call each ECU loop tick — internally rate-limited
    void tick() {
        if (!_serial) return;
        unsigned long now = millis();
        // Link discovery must not depend on the selected sensor update rate.
        if (now - _lastHeartbeatMs >= 1000UL) {
            if (_sendHeartbeat()) _lastHeartbeatMs = now;
        }
        auto& hw = HardwareConfig::instance();
        unsigned long interval = hw.mavlinkIntervalMs >= 20
                               ? (unsigned long)hw.mavlinkIntervalMs : 100UL;
        if ((now - _lastMs) < interval) return;
        _lastMs = now;

        _sendEngineData();
    }

    // Call when a fault/event occurs — sends a STATUSTEXT message immediately
    void sendStatusText(const char* text) {
        if (!_serial) return;
        _sendStatusText(text);
    }

private:
    HardwareSerial* _serial = nullptr;
    uint8_t  _seq           = 0;
    uint8_t  _rrStart       = 0;   // round-robin start for NAMED_VALUE_FLOATs
    unsigned long _lastMs   = 0;
    unsigned long _lastHeartbeatMs = 0;

    // ── CRC-16/MCRF4XX (X25) ─────────────────────────────────
    static uint16_t _crc16(const uint8_t* buf, size_t len, uint8_t extra) {
        uint16_t crc = 0xFFFF;
        for (size_t i = 0; i <= len; ++i) {
            uint8_t t = (i < len ? buf[i] : extra) ^ (uint8_t)crc;
            t ^= t << 4;
            crc = (crc >> 8) ^ ((uint16_t)t << 8) ^ ((uint16_t)t << 3) ^ (t >> 4);
        }
        return crc;
    }

    // Returns false when the TX buffer could not take the packet.
    bool _sendPacket(uint8_t msgId, uint8_t crcExtra,
                     const uint8_t* payload, uint8_t payLen) {
        size_t packetLen = (size_t)payLen + 8;
        if (_serial->availableForWrite() < (int)packetLen) return false;

        // Largest supported payload is STATUSTEXT (51 bytes). Build one
        // bounded packet so CRC framing is shared and the UART gets one write.
        if (payLen > 51) return false;
        uint8_t packet[59];
        packet[0]=0xFE; packet[1]=payLen; packet[2]=_seq++;
        packet[3]=SYS_ID; packet[4]=COMP_ID; packet[5]=msgId;
        memcpy(packet + 6, payload, payLen);
        const uint16_t crc = _crc16(packet + 1, (size_t)payLen + 5, crcExtra);
        packet[6 + payLen] = (uint8_t)crc;
        packet[7 + payLen] = (uint8_t)(crc >> 8);
        return _serial->write(packet, packetLen) == packetLen;
    }

    bool _sendHeartbeat() {
        // HEARTBEAT: msg_id=0, CRC_EXTRA=50, payload=9 bytes
        // custom_mode(4), type(1), autopilot(1), base_mode(1), system_status(1), mavlink_version(1)
        const auto& ed = EngineData::instance();
        uint8_t sysStatus = MAV_STATE_STANDBY;
        if (ed.mode == SysMode::RUNNING || ed.mode == SysMode::STARTUP) sysStatus = MAV_STATE_ACTIVE;
        if (ed.mode == SysMode::FAULT)   sysStatus = MAV_STATE_EMERGENCY;

        uint8_t payload[9];
        // custom_mode = (uint32_t)mode — little endian
        uint32_t cm = (uint32_t)ed.mode;
        memcpy(payload, &cm, sizeof(cm));
        payload[4] = MAV_TYPE_GENERIC;
        payload[5] = MAV_AUTOPILOT_INVALID;
        payload[6] = 0;              // base_mode
        payload[7] = sysStatus;
        payload[8] = 3;              // mavlink_version
        return _sendPacket(0, 50, payload, 9);
    }

    // Send one NAMED_VALUE_FLOAT message (msg_id=251, CRC_EXTRA=170)
    // payload: time_boot_ms(4) + value(4) + name(10) = 18 bytes
    bool _sendNamedFloat(const char* name, float value) {
        if (!isfinite(value)) return true; // unhealthy numeric samples are not live values
        uint8_t payload[18];
        uint32_t t = millis();
        memcpy(payload, &t, sizeof(t));
        // value at offset 4 (little-endian IEEE754)
        memcpy(payload + 4, &value, 4);
        // name: 10 bytes, null-padded
        strncpy((char*)(payload + 8), name, 10);
        return _sendPacket(251, 170, payload, 18);
    }

    void _sendEngineData() {
        const auto& ed = EngineData::instance();
        struct Item { const char* name; float value; };
        Item items[14];
        uint8_t n = 0;
        if (HardwareConfig::hasN1Rpm && ed.n1Healthy)       items[n++] = { "N1_RPM",   ed.n1Rpm };
        if (HardwareConfig::hasTot && ed.totHealthy)        items[n++] = { "TOT_C",    ed.tot };
        if (HardwareConfig::hasOilPress && ed.oilHealthy)   items[n++] = { "OIL_BAR",  ed.oilPressure };
        if (HardwareConfig::hasN2Rpm && ed.n2Healthy)       items[n++] = { "N2_RPM",   ed.n2Rpm };
        if (HardwareConfig::hasOilTemp && ed.oilTempHealthy) items[n++] = { "OIL_T_C",  ed.oilTemp };
        if (HardwareConfig::hasBattVoltage && ed.battHealthy) items[n++] = { "BATT_V",   ed.battVoltage };
        if (HardwareConfig::hasFuelPress && ed.fuelPressHealthy) items[n++] = { "FUEL_BAR", ed.fuelPressure };
        if (HardwareConfig::hasTorque && ed.torqueHealthy)  items[n++] = { "TORQ_NM",  ed.torque };
        if (HardwareConfig::hasThrust && ed.thrustHealthy)  items[n++] = { "THRUST_N", ed.thrust };
        if (HardwareConfig::hasTit && ed.titHealthy)        items[n++] = { "TIT_C",    ed.tit };
        if (HardwareConfig::hasFuelFlow && ed.fuelFlowHealthy) items[n++] = { "FUEL_FLOW", ed.fuelFlow };
        if (HardwareConfig::hasP1 && ed.p1Healthy) items[n++] = { "P1_BAR", ed.p1 };
        if (HardwareConfig::hasP2 && ed.p2Healthy) items[n++] = { "P2_BAR", ed.p2 };
        if (HardwareConfig::hasThrottle) items[n++] = { "THR_PCT",  ed.throttleDemand * 100.0f };
        if (!n) return;

        // Rotate the start channel: with no TX ring buffer only ~4 messages
        // fit in the 128-byte HW FIFO per tick, and a fixed order would
        // starve the tail channels forever. On a full buffer, remember the
        // first unsent channel and resume there next tick.
        if (_rrStart >= n) _rrStart = 0;
        for (uint8_t i = 0; i < n; i++) {
            uint8_t idx = (uint8_t)((_rrStart + i) % n);
            if (!_sendNamedFloat(items[idx].name, items[idx].value)) {
                _rrStart = idx;
                return;
            }
        }
    }

    void _sendStatusText(const char* text) {
        // STATUSTEXT: msg_id=253, CRC_EXTRA=83, payload=51 bytes
        // severity(1) + text(50)
        uint8_t payload[51];
        payload[0] = 3; // MAV_SEVERITY_ERROR
        strncpy((char*)(payload + 1), text, 50);
        _sendPacket(253, 83, payload, 51);
    }
};
