#include <Arduino.h>
#include <HardwareSerial.h>
#include <esp_system.h>
#include <OpenTurbineMavlinkClient.h>

// Example receiver pins, not ECU pins. Check your board's free GPIOs.
#ifndef OT_CLUSTER_RX_PIN
#define OT_CLUSTER_RX_PIN 16
#endif
#ifndef OT_CLUSTER_TX_PIN
#define OT_CLUSTER_TX_PIN 17
#endif
constexpr int ECU_RX = OT_CLUSTER_RX_PIN; // receiver RX <- ECU TX
constexpr int ECU_TX = OT_CLUSTER_TX_PIN; // receiver TX -> ECU RX (optional for monitoring)
constexpr uint32_t LINK_BAUD = 115200;
HardwareSerial enginePort(1);
OpenTurbineMavlink::Client<HardwareSerial> engine(enginePort);
char consoleLine[40] = {};
size_t consoleLength = 0;
bool consoleOverflow = false, sendThrottle = false;
float throttleDemand = 0;
uint32_t lastPrint = 0, lastThrottle = 0;

const char* engineMode(uint8_t mode) {
    switch (mode) {
        case 0: return "STANDBY";
        case 1: return "STARTUP";
        case 2: return "RUNNING";
        case 3: return "SHUTDOWN";
        case 4: return "FAULT";
        default: return "UNKNOWN";
    }
}

void consoleCommand(const char* command) {
    const uint32_t now = millis();
    bool sent = false;
    if (!strcmp(command, "start")) sent = engine.start(now);
    else if (!strcmp(command, "stop")) sent = engine.stop(now);
    else if (!strcmp(command, "ack")) sent = engine.acknowledgeFault(now);
    else if (!strcmp(command, "ab on")) sent = engine.afterburner(true, now);
    else if (!strcmp(command, "ab off")) sent = engine.afterburner(false, now);
    else if (!strcmp(command, "throttle off")) {
        sendThrottle = false;
        Serial.println("Throttle stream stopped; the ECU input will expire.");
        return;
    } else if (!strncmp(command, "throttle ", 9)) {
        char* end = nullptr;
        const float percent = strtof(command + 9, &end);
        if (end == command + 9 || *end || !isfinite(percent) || percent < 0 || percent > 100) {
            Serial.println("Use throttle 0 through throttle 100, or throttle off.");
            return;
        }
        throttleDemand = percent / 100;
        sendThrottle = true;
        Serial.println("Throttle stream enabled by console. Select this input on the ECU to use it.");
        return;
    } else {
        Serial.println("Commands: start, stop, ack, ab on, ab off, throttle 0..100, throttle off");
        return;
    }
    Serial.println(sent ? "Request sent; wait for result and engine state." : "Request not sent: connection unavailable or another request is pending.");
}

void setup() {
    Serial.begin(115200);
    enginePort.setTxBufferSize(512);
    enginePort.begin(LINK_BAUD, SERIAL_8N1, ECU_RX, ECU_TX);
    engine.setIdentity(255, 190); // match System > MAVLink permitted controller
    engine.targetSystem = 1;
    engine.targetComponent = 200;
    engine.begin(esp_random()); // fresh sender session each receiver boot
#ifdef OT_CLUSTER_OBSERVE_PIN
    pinMode(OT_CLUSTER_OBSERVE_PIN, INPUT); // optional no-load bench observation
#endif
    Serial.println("MAVLink Cluster example. No engine operation or throttle is sent automatically.");
    consoleCommand("help");
}

void loop() {
    const uint32_t now = millis();
    engine.update(now);
    while (Serial.available()) {
        const char c = char(Serial.read());
        if (c == '\n' || c == '\r') {
            if (consoleLength && !consoleOverflow) {
                consoleLine[consoleLength] = 0;
                consoleCommand(consoleLine);
            }
            consoleLength = 0;
            consoleOverflow = false;
        } else if (consoleLength + 1 < sizeof(consoleLine)) consoleLine[consoleLength++] = c;
        else consoleOverflow = true;
    }
    // A display must not continue an old demand when ECU state disappears.
    if (sendThrottle && engine.signalLost(now)) sendThrottle = false;
    if (sendThrottle && now - lastThrottle >= 100) {
        lastThrottle = now;
        engine.throttle(throttleDemand);
    }
    if (now - lastPrint < 1000) return;
    lastPrint = now;
#ifdef OT_CLUSTER_OBSERVE_PIN
    Serial.printf("Bench servo pulse: %lu us\n", pulseIn(OT_CLUSTER_OBSERVE_PIN, HIGH, 30000));
#endif
    Serial.printf("Engine state: %s; catalogue: %u channels; command: %u, %.80s\n",
        engine.signalLost(now) ? "STALE / unavailable" : "fresh",
        engine.channelCount(), unsigned(engine.commandState), engine.commandReason);
    if (!engine.signalLost(now)) {
        Serial.printf("Mode: %s; main fuel: %.1f%%; step: %.32s\n",
            engineMode(engine.engine.mode), engine.engine.fuel_demand, engine.engine.sequence_step);
        if (engine.engine.fault[0]) Serial.printf("Fault: %.80s\n", engine.engine.fault);
        if (engine.engine.reason[0]) Serial.printf("Attention: %.80s\n", engine.engine.reason);
    }
    if (!engine.catalogueReady()) return;
    for (uint16_t i = 0; i < engine.channelCount(); ++i) {
        const auto* channel = engine.channel(i);
        if (!channel) continue;
        if (engine.valid(*channel, now))
            Serial.printf("%.32s: %.2f %.8s\n", channel->info.name, channel->value, channel->info.unit);
        else Serial.printf("%.32s: unavailable / stale\n", channel->info.name);
    }
}
