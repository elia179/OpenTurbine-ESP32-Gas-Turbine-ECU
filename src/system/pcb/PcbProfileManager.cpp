#include "PcbProfileManager.h"

#include <esp_partition.h>
#include <new>
#include "../../engine/EngineData.h"
#include "../../hal/actuators/RelayDemand.h"

namespace {
static constexpr uint8_t PROFILE_SUBTYPE = 0x40;
static constexpr uint8_t CONTAINER_VERSION = 1;
static constexpr uint8_t ENCODING_JSON = 1;
static constexpr uint8_t TARGET_ESP32 = 1;
static constexpr uint8_t TARGET_ESP32S3 = 2;

struct __attribute__((packed)) ProfileHeader {
    char magic[4];
    uint8_t containerVersion;
    uint8_t encoding;
    uint8_t formatMajor;
    uint8_t formatMinor;
    uint8_t targetChip;
    uint8_t origin;
    uint16_t headerSize;
    uint32_t payloadLength;
    uint32_t payloadCrc32;
    uint8_t reserved[12];
};
static_assert(sizeof(ProfileHeader) == 32, "PCB profile container header changed");

__attribute__((noinline)) bool idValid(const char* value, size_t maxLength) {
    if (!value || !value[0] || strlen(value) >= maxLength) return false;
    if (!(value[0] >= 'a' && value[0] <= 'z') && !(value[0] >= '0' && value[0] <= '9'))
        return false;
    for (const char* p = value; *p; ++p)
        if (!((*p >= 'a' && *p <= 'z') || (*p >= '0' && *p <= '9') || *p == '_' || *p == '-'))
            return false;
    return true;
}

PcbProfileManager::Adapter parseAdapter(const char* value) {
    using Adapter = PcbProfileManager::Adapter;
    for (uint8_t i = 1; i <= static_cast<uint8_t>(Adapter::I2cDigitalOutput); ++i)
        if (!strcmp(PcbProfileManager::adapterName(static_cast<Adapter>(i)), value))
            return static_cast<Adapter>(i);
    return Adapter::Unknown;
}

bool adapterDriver(PcbProfileManager::Adapter adapter, ChannelRegistry::Driver& driver) {
    using Adapter = PcbProfileManager::Adapter;
    using Driver = ChannelRegistry::Driver;
    switch (adapter) {
        case Adapter::DigitalInput: driver = Driver::Digital; break;
        case Adapter::AnalogInput:
        case Adapter::SpiThermocouple:
        case Adapter::OneWireTemperature: driver = Driver::Analog; break;
        case Adapter::PcntInput: driver = Driver::Pulse; break;
        case Adapter::RcPwmInput: driver = Driver::RcPwm; break;
        case Adapter::PwmDutyInput: driver = Driver::PwmDuty; break;
        case Adapter::I2cDigitalInput: driver = Driver::I2cDigital; break;
        case Adapter::I2cAdcInput:
        case Adapter::I2cAdcDigitalInput: driver = Driver::I2cAnalog; break;
        case Adapter::I2cLoadCell: driver = Driver::I2cLoadCell; break;
        case Adapter::DigitalOutput:
        case Adapter::RelayOutput: driver = Driver::Relay; break;
        case Adapter::PwmOutput: driver = Driver::Pwm; break;
        case Adapter::ServoOutput: driver = Driver::Servo; break;
        case Adapter::I2cDigitalOutput: driver = Driver::I2cRelay; break;
        default: return false;
    }
    return true;
}

int jsonPin(JsonObjectConst pins, const char* key) {
    return pins[key].is<int>() ? pins[key].as<int>() : -1;
}
}

PcbProfileManager::State PcbProfileManager::_state = PcbProfileManager::State::Absent;
PcbProfileManager::Catalog* PcbProfileManager::_catalog = nullptr;
char PcbProfileManager::_fault[128] = {};

const char* PcbProfileManager::adapterName(Adapter adapter) {
    static const char* const names[] = {
        "unknown", "digital_input", "analog_input", "pcnt_input", "rc_pwm_input",
        "pwm_duty_input", "spi_thermocouple", "onewire_temperature",
        "i2c_digital_input", "i2c_adc_input", "i2c_adc_digital_input", "i2c_load_cell",
        "digital_output", "relay_output", "pwm_output", "servo_output",
        "i2c_digital_output"
    };
    const uint8_t index = static_cast<uint8_t>(adapter);
    return index < sizeof(names) / sizeof(names[0]) ? names[index] : names[0];
}

void PcbProfileManager::setFault(const char* reason) {
    _state = State::Fault;
    strlcpy(_fault, reason ? reason : "unknown PCB profile error", sizeof(_fault));
    if (_catalog) {
        delete _catalog;
        _catalog = nullptr;
    }
    auto& ed = EngineData::instance();
    ed.configLocked = true;
    snprintf(ed.faultDescription, sizeof(ed.faultDescription),
             "Cannot start: flashed PCB profile is invalid (%s). Reinstall the correct board profile over USB.",
             _fault);
    Serial.printf("[PCBProfile] FAULT: %s\n", _fault);
}

uint32_t PcbProfileManager::crc32(const uint8_t* data, size_t length) {
    uint32_t crc = 0xFFFFFFFFU;
    for (size_t i = 0; i < length; ++i) {
        crc ^= data[i];
        for (uint8_t bit = 0; bit < 8; ++bit)
            crc = (crc >> 1) ^ (0xEDB88320U & (0U - (crc & 1U)));
    }
    return ~crc;
}

__attribute__((noinline)) bool PcbProfileManager::copyText(char* dst, size_t size, const char* value,
                                 bool required, const char* field) {
    if (!value) value = "";
    if ((required && !value[0]) || strlen(value) >= size) {
        snprintf(_fault, sizeof(_fault), "%s is missing or too long", field);
        return false;
    }
    strlcpy(dst, value, size);
    return true;
}

__attribute__((noinline)) bool PcbProfileManager::validTargetPin(int pin, bool output) {
    if (pin == -1) return true;
#if defined(OT_PLATFORM_ESP32S3)
    static const int8_t pins[] = {
        0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21,
        35,36,37,38,39,40,41,42,43,44,45,46,47,48
    };
    if (output && pin == 46) return false;
#else
    static const int8_t pins[] = {
        0,1,2,3,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,
        32,33,34,35,36,39
    };
    if (output && (pin == 34 || pin == 35 || pin == 36 || pin == 39)) return false;
#endif
    for (int8_t candidate : pins) if (candidate == pin) return true;
    return false;
}

void PcbProfileManager::begin() {
    _state = State::Absent;
    _fault[0] = '\0';
    if (_catalog) {
        delete _catalog;
        _catalog = nullptr;
    }

    const esp_partition_t* partition = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, (esp_partition_subtype_t)PROFILE_SUBTYPE, "pcbprof");
    if (!partition) {
        setFault("pcbprof partition is missing; USB clean install required");
        return;
    }

    ProfileHeader header = {};
    if (esp_partition_read(partition, 0, &header, sizeof(header)) != ESP_OK) {
        setFault("profile partition could not be read");
        return;
    }
    bool erased = true;
    const uint8_t* headerBytes = reinterpret_cast<const uint8_t*>(&header);
    for (size_t i = 0; i < sizeof(header); ++i)
        if (headerBytes[i] != 0xFF) { erased = false; break; }
    if (erased) {
        Serial.println("[PCBProfile] No profile - generic development-board mode");
        return;
    }
    if (memcmp(header.magic, "OTPB", 4) != 0) {
        setFault("profile partition contains unrecognized data");
        return;
    }
    if (header.containerVersion != CONTAINER_VERSION ||
        header.encoding != ENCODING_JSON || header.headerSize != sizeof(ProfileHeader)) {
        setFault("unsupported profile container");
        return;
    }
    if (header.formatMajor != 1) {
        setFault("unsupported PCB profile format");
        return;
    }
#if defined(OT_PLATFORM_ESP32S3)
    const uint8_t expectedTarget = TARGET_ESP32S3;
#else
    const uint8_t expectedTarget = TARGET_ESP32;
#endif
    if (header.targetChip != expectedTarget) {
        setFault("PCB profile targets a different ESP32 chip");
        return;
    }
    if (!header.payloadLength || header.payloadLength > MAX_PAYLOAD ||
        header.headerSize + header.payloadLength > partition->size) {
        setFault("PCB profile payload size is invalid");
        return;
    }

    uint8_t* payload = static_cast<uint8_t*>(malloc(header.payloadLength + 1));
    if (!payload) {
        setFault("not enough memory to read PCB profile");
        return;
    }
    if (esp_partition_read(partition, header.headerSize, payload, header.payloadLength) != ESP_OK) {
        free(payload);
        setFault("PCB profile payload could not be read");
        return;
    }
    payload[header.payloadLength] = '\0';
    if (crc32(payload, header.payloadLength) != header.payloadCrc32) {
        free(payload);
        setFault("PCB profile CRC does not match");
        return;
    }
    Origin origin = header.origin == 2 ? Origin::Official :
                    header.origin == 1 ? Origin::Custom : Origin::Unknown;
    const bool ok = parsePayload(payload, header.payloadLength,
                                 header.formatMajor, header.formatMinor, origin);
    free(payload);
    if (!ok) {
        char reason[sizeof(_fault)];
        strlcpy(reason, _fault[0] ? _fault : "PCB profile content is invalid", sizeof(reason));
        setFault(reason);
        return;
    }
    _state = State::Valid;
    driveEarlySafeStates();
    Serial.printf("[PCBProfile] %s rev %s (%s, %u ports)\n",
                  _catalog->boardName, _catalog->revision,
                  _catalog->origin == Origin::Official ? "official" : "custom",
                  _catalog->portCount);
}

void PcbProfileManager::driveEarlySafeStates() {
    if (_state != State::Valid || !_catalog) return;

    auto driveLevel = [](int pin, bool high) {
        if (pin < 0) return;
        digitalWrite(pin, high ? HIGH : LOW);
        pinMode(pin, OUTPUT);
    };
    auto driveInactive = [&](int pin, bool activeHigh) {
        driveLevel(pin, !activeHigh);
    };

    // Fixed indicators are always defined with a safe demand of zero.
    // For a NeoPixel, holding the data line inactive prevents spurious frames;
    // StatusLED initialization clears any previously latched pixel later.
    if (_catalog->hasStatusLed)
        driveInactive(_catalog->statusLedGpio, _catalog->statusLedActiveHigh);
    if (_catalog->hasBuzzer)
        driveInactive(_catalog->buzzerGpio, _catalog->buzzerActiveHigh);
#if !defined(OT_PLATFORM_ESP32)
    if (_catalog->hasFaultLed)
        driveInactive(_catalog->faultLedGpio, _catalog->faultLedActiveHigh);
    if (_catalog->hasOutputEnable)
        driveInactive(_catalog->outputEnableGpio, _catalog->outputEnableActiveHigh);
#endif
    if (_catalog->hasServoOutputEnable)
        driveInactive(_catalog->servoOutputEnableGpio,
                      _catalog->servoOutputEnableActiveHigh);

    for (uint8_t i = 0; i < _catalog->portCount; ++i) {
        const Port& port = _catalog->ports[i];
        for (uint8_t j = 0; j < port.modeCount; ++j) {
            const Mode& mode = port.modes[j];
            const char* adapter = adapterName(mode.adapter);
            if (mode.gpio < 0 || !strstr(adapter, "output") ||
                !strncmp(adapter, "i2c_", 4))
                continue;

            // PWM and servo outputs must not emit a waveform before their
            // driver owns the pin. Static inactive is safer than attempting
            // to approximate a fractional demand with a constant level.
            if (!strcmp(adapter, "pwm_output") ||
                !strcmp(adapter, "servo_output")) {
                driveInactive(mode.gpio, mode.activeHigh);
            } else {
                const bool commandedOn = RelayDemand::requested(mode.safeDemand);
                driveLevel(mode.gpio, mode.activeHigh ? commandedOn : !commandedOn);
            }
        }
    }
}

bool PcbProfileManager::parsePayload(uint8_t* payload, size_t length,
                                     uint8_t formatMajor, uint8_t formatMinor,
                                     Origin origin) {
#if defined(OT_PLATFORM_ESP32)
    if(formatMinor>0){strlcpy(_fault,"PCB profile capabilities require S3",sizeof(_fault));return false;}
#endif
    JsonDocument doc;
    // The partition payload already belongs exclusively to this boot-time
    // parser. ArduinoJson can therefore tokenize it in place instead of
    // duplicating every string while the original payload is still resident.
    // All strings retained after this function returns are copied into the
    // fitted Catalog before begin() releases the payload.
    DeserializationError error = deserializeJson(
        doc, reinterpret_cast<char*>(payload), length);
    if (error) {
        snprintf(_fault, sizeof(_fault), "profile JSON: %s", error.c_str());
        return false;
    }
    JsonObjectConst root = doc.as<JsonObjectConst>();
    if (strcmp(root["format"] | "", "openturbine-pcb-profile") ||
        (root["format_version"]["major"] | 0) != formatMajor ||
        (root["format_version"]["minor"] | 0) != formatMinor) {
        strlcpy(_fault, "profile identity/version does not match its container", sizeof(_fault));
        return false;
    }
#if defined(OT_PLATFORM_ESP32S3)
    const char* expectedChip = "esp32-s3";
#else
    const char* expectedChip = "esp32";
#endif
    if (strcmp(root["target"]["chip"] | "", expectedChip)) {
        strlcpy(_fault, "profile JSON targets a different ESP32 chip", sizeof(_fault));
        return false;
    }

    Catalog* catalog = new (std::nothrow) Catalog();
    if (!catalog) {
        strlcpy(_fault, "not enough memory for PCB port catalog", sizeof(_fault));
        return false;
    }
    // Share catalog cleanup across validation failures without duplicating it
    // at every field check on the flash-constrained Classic target.
    auto reject = [&](const char* reason) __attribute__((noinline)) {
        delete catalog;
        strlcpy(_fault, reason, sizeof(_fault));
        return false;
    };
    catalog->formatMajor = formatMajor;
    catalog->formatMinor = formatMinor;
    catalog->origin = origin;
    if (!copyText(catalog->boardId, sizeof(catalog->boardId), root["board"]["id"] | "", true, "board.id") ||
        !copyText(catalog->boardName, sizeof(catalog->boardName), root["board"]["name"] | "", true, "board.name") ||
        !copyText(catalog->revision, sizeof(catalog->revision), root["board"]["revision"] | "", true, "board.revision") ||
        !copyText(catalog->manufacturer, sizeof(catalog->manufacturer), root["board"]["manufacturer"] | "", false, "board.manufacturer") ||
        !copyText(catalog->description, sizeof(catalog->description), root["board"]["description"] | "", false, "board.description") ||
        !copyText(catalog->targetChip, sizeof(catalog->targetChip), expectedChip, true, "target.chip") ||
        !idValid(catalog->boardId, sizeof(catalog->boardId))) {
        delete catalog;
        return false;
    }

    JsonArrayConst buses = root["buses"].as<JsonArrayConst>();
    if (buses.size() > MAX_BUSES) {
        return reject("too many PCB buses");
    }
    if (buses.size()) {
        catalog->buses = new (std::nothrow) Bus[buses.size()];
        if (!catalog->buses) {
            return reject("not enough memory for PCB buses");
        }
    }
    for (JsonObjectConst source : buses) {
        Bus& bus = catalog->buses[catalog->busCount++];
        if (!copyText(bus.id, sizeof(bus.id), source["id"] | "", true, "bus.id") ||
            !copyText(bus.kind, sizeof(bus.kind), source["kind"] | "", true, "bus.kind") ||
            !idValid(bus.id, sizeof(bus.id))) { delete catalog; return false; }
        JsonObjectConst pins = source["pins"].as<JsonObjectConst>();
        bus.sda = jsonPin(pins, "sda"); bus.scl = jsonPin(pins, "scl");
        bus.interrupt = jsonPin(pins, "interrupt");
        bus.sck = jsonPin(pins, "sck"); bus.miso = jsonPin(pins, "miso");
        bus.mosi = jsonPin(pins, "mosi"); bus.tx = jsonPin(pins, "tx");
        bus.rx = jsonPin(pins, "rx"); bus.data = jsonPin(pins, "data");
        bus.frequencyHz = source["frequency_hz"] | 0U;
        const bool validKind = !strcmp(bus.kind, "i2c") || !strcmp(bus.kind, "spi") ||
                               !strcmp(bus.kind, "uart") || !strcmp(bus.kind, "onewire");
        const bool requiredPins = (!strcmp(bus.kind, "i2c") && bus.sda >= 0 && bus.scl >= 0 && bus.sda != bus.scl) ||
                                  (!strcmp(bus.kind, "spi") && bus.sck >= 0 && bus.miso >= 0 && bus.sck != bus.miso) ||
                                  (!strcmp(bus.kind, "uart") && bus.tx >= 0 && bus.tx != bus.rx) ||
                                  (!strcmp(bus.kind, "onewire") && bus.data >= 0);
        if (!validKind || !requiredPins) {
            return reject("PCB bus kind or required pins are invalid");
        }
        const int inputPins[] = {bus.miso, bus.rx, bus.interrupt, bus.data};
        const int outputPins[] = {bus.sda, bus.scl, bus.sck, bus.mosi, bus.tx};
        for (int pin : inputPins) if (!validTargetPin(pin, false)) {
            return reject("bus uses invalid input GPIO");
        }
        for (int pin : outputPins) if (!validTargetPin(pin, true)) {
            return reject("bus uses invalid output GPIO");
        }
    }

    JsonArrayConst devices = root["devices"].as<JsonArrayConst>();
    if (devices.size() > MAX_DEVICES) {
        return reject("too many PCB devices");
    }
    if (devices.size()) {
        catalog->devices = new (std::nothrow) Device[devices.size()];
        if (!catalog->devices) {
            return reject("not enough memory for PCB devices");
        }
    }
    for (JsonObjectConst source : devices) {
        Device& device = catalog->devices[catalog->deviceCount++];
        if (!copyText(device.id, sizeof(device.id), source["id"] | "", true, "device.id") ||
            !copyText(device.driver, sizeof(device.driver), source["driver"] | "", true, "device.driver") ||
            !copyText(device.busId, sizeof(device.busId), source["bus"] | "", false, "device.bus") ||
            !idValid(device.id, sizeof(device.id))) { delete catalog; return false; }
        device.address = source["address"] | 0;
        device.selectGpio = source["select"]["gpio"] | -1;
        device.expected = source["expected"] | false;
        if (device.busId[0]) {
            bool found = false;
            for (uint8_t i = 0; i < catalog->busCount; ++i)
                if (!strcmp(catalog->buses[i].id, device.busId)) { found = true; break; }
            if (!found) { return reject("device refers to missing bus"); }
        }
        if (!validTargetPin(device.selectGpio, true)) {
            return reject("device uses invalid select GPIO");
        }
    }

    JsonObjectConst fixed = root["fixed_functions"].as<JsonObjectConst>();
    if (!fixed.isNull()) {
        auto readFixedOutput = [&](const char* key, bool& present, int8_t& gpio,
                                   bool& activeHigh, uint8_t* type) {
            JsonObjectConst source = fixed[key].as<JsonObjectConst>();
            if (source.isNull()) return true;
#if !defined(OT_PLATFORM_ESP32)
            if(!strcmp(key,"output_enable") && source["active_high"].isNull())return false;
#endif
#if !defined(OT_PLATFORM_ESP32)
            if (!source["device"].isNull() && (!strcmp(key,"status_led") || !strcmp(key,"fault_led"))) {
                const char* id=source["device"] | "";
                const int channel=source["channel"] | -1;
                if(strcmp(source["type"] | "gpio","gpio"))return false;
                if(channel<0 || channel>7 || (source["safe_demand"] | -1.0f)!=0) return false;
                int index=-1;
                for(uint8_t i=0;i<catalog->deviceCount;i++)
                    if(!strcmp(catalog->devices[i].id,id) && (!strcmp(catalog->devices[i].driver,"tca9534") || !strcmp(catalog->devices[i].driver,"tca9554"))) index=i;
                if(index<0 || catalog->devices[index].address<0x20 || catalog->devices[index].address>0x27) return false;
                if(!strcmp(key,"status_led")){catalog->statusLedDeviceIndex=index;catalog->statusLedChannel=channel;}
                else {catalog->faultLedDeviceIndex=index;catalog->faultLedChannel=channel;}
                present=true; gpio=-1; activeHigh=source["active_high"] | true;
                if(type)*type=0;
                return true;
            }
#endif
            if (source["gpio"].isNull() || source["safe_demand"].isNull() ||
                (source["safe_demand"] | -1.0f) != 0.0f) return false;
            const int pin = source["gpio"].as<int>();
            if (pin<0 || !validTargetPin(pin, true)) return false;
            present = true;
            gpio = static_cast<int8_t>(pin);
            activeHigh = source["active_high"] | true;
            if (type) {
                const char* kind = source["type"] | "gpio";
                if (!strcmp(kind, "gpio")) *type = 0;
                else if (!strcmp(kind, "neopixel")) *type = 1;
                else return false;
            }
            return true;
        };
        if (!readFixedOutput("status_led", catalog->hasStatusLed,
                             catalog->statusLedGpio, catalog->statusLedActiveHigh,
                             &catalog->statusLedType) ||
#if !defined(OT_PLATFORM_ESP32)
            !readFixedOutput("fault_led", catalog->hasFaultLed,
                             catalog->faultLedGpio, catalog->faultLedActiveHigh,nullptr) ||
            !readFixedOutput("output_enable", catalog->hasOutputEnable,
                             catalog->outputEnableGpio, catalog->outputEnableActiveHigh,nullptr) ||
#endif
            !readFixedOutput("buzzer", catalog->hasBuzzer,
                             catalog->buzzerGpio, catalog->buzzerActiveHigh, nullptr)) {
            return reject("fixed PCB output has invalid GPIO or safe state");
        }
        JsonObjectConst servoEnable = fixed["servo_output_enable"].as<JsonObjectConst>();
        if (!servoEnable.isNull()) {
            if (servoEnable["gpio"].isNull() ||
                servoEnable["active_high"].isNull() ||
                (servoEnable["safe_demand"] | -1.0f) != 0.0f) {
                return reject("servo-output enable has invalid safe state");
            }
            const int pin = servoEnable["gpio"].as<int>();
            if (!validTargetPin(pin, true)) {
                return reject("servo-output enable uses invalid GPIO");
            }
            catalog->hasServoOutputEnable = true;
            catalog->servoOutputEnableGpio = static_cast<int8_t>(pin);
            catalog->servoOutputEnableActiveHigh = servoEnable["active_high"].as<bool>();
        }
        JsonObjectConst supply = fixed["supply_voltage"].as<JsonObjectConst>();
        if (!supply.isNull()) {
            const int pin = supply["gpio"] | -1;
            const float divider = supply["divider"] | 0.0f;
            if (!validTargetPin(pin, false) || divider < 1.0f || divider > 100.0f ||
                !copyText(catalog->supplyVoltageLabel,
                          sizeof(catalog->supplyVoltageLabel),
                          supply["label"] | "ECU supply voltage", false,
                          "supply_voltage.label")) {
                return reject("fixed supply-voltage monitor is invalid");
            }
            catalog->hasSupplyVoltage = true;
            catalog->supplyVoltageGpio = static_cast<int8_t>(pin);
            catalog->supplyVoltageDivider = divider;
        }
        auto readSerial = [&](const char* key, char* destination, size_t size) {
            JsonObjectConst source = fixed[key].as<JsonObjectConst>();
            if (source.isNull()) return true;
            const char* busId = source["bus"] | "";
            for (uint8_t i = 0; i < catalog->busCount; ++i)
                if (!strcmp(catalog->buses[i].id, busId) &&
                    !strcmp(catalog->buses[i].kind, "uart")) {
                    strlcpy(destination, busId, size);
                    return true;
                }
            return false;
        };
        if (!readSerial("cluster_serial", catalog->clusterSerialBusId,
                        sizeof(catalog->clusterSerialBusId)) ||
            !readSerial("mavlink", catalog->mavlinkBusId,
                        sizeof(catalog->mavlinkBusId))) {
            return reject("fixed serial function refers to a missing UART bus");
        }
    }

    JsonArrayConst ports = root["ports"].as<JsonArrayConst>();
    if (!ports.size() || ports.size() > MAX_PORTS) {
        return reject("PCB profile needs 1..48 ports");
    }
    catalog->ports = new (std::nothrow) Port[ports.size()];
    if (!catalog->ports) {
        return reject("not enough memory for PCB ports");
    }
    uint16_t defaultCount = 0;
    for (JsonObjectConst source : ports)
        for (JsonObjectConst modeSource : source["modes"].as<JsonArrayConst>())
            if (!modeSource["default"].as<JsonObjectConst>().isNull()) ++defaultCount;
    if (defaultCount > UINT8_MAX) {
        return reject("too many PCB default assignments");
    }
    if (defaultCount) {
        catalog->defaults = new (std::nothrow) DefaultAssignment[defaultCount];
        if (!catalog->defaults) {
            return reject("not enough memory for PCB default assignments");
        }
    }
    for (JsonObjectConst source : ports) {
        Port& port = catalog->ports[catalog->portCount++];
        if (!copyText(port.id, sizeof(port.id), source["id"] | "", true, "port.id") ||
            !copyText(port.label, sizeof(port.label), source["label"] | "", true, "port.label") ||
            !copyText(port.connector, sizeof(port.connector), source["connector"] | "", false, "port.connector") ||
            !copyText(port.description, sizeof(port.description), source["description"] | "", false, "port.description") ||
            !idValid(port.id, sizeof(port.id))) { delete catalog; return false; }
        for (uint8_t i = 0; i + 1 < catalog->portCount; ++i)
            if (!strcmp(catalog->ports[i].id, port.id)) {
                return reject("duplicate PCB port ID");
            }
        JsonArrayConst modes = source["modes"].as<JsonArrayConst>();
        if (!modes.size() || modes.size() > MAX_MODES_PER_PORT) {
            return reject("PCB port needs 1..4 modes");
        }
        for (JsonObjectConst modeSource : modes) {
            Mode& mode = port.modes[port.modeCount++];
            if (!copyText(mode.id, sizeof(mode.id), modeSource["id"] | "", true, "mode.id") ||
                !idValid(mode.id, sizeof(mode.id))) { delete catalog; return false; }
            const char* adapterText = modeSource["adapter"] | "";
            mode.adapter = parseAdapter(adapterText);
            const char* deviceId = modeSource["device"] | "";
            if (deviceId[0]) {
                for (uint8_t deviceIndex = 0; deviceIndex < catalog->deviceCount; ++deviceIndex)
                    if (!strcmp(catalog->devices[deviceIndex].id, deviceId)) {
                        mode.deviceIndex = static_cast<int8_t>(deviceIndex);
                        break;
                    }
            }
            JsonObjectConst defaultSource = modeSource["default"].as<JsonObjectConst>();
            const char* defaultId = defaultSource["id"] | "";
            const char* defaultName = defaultSource["name"] | "";
            const char* defaultRole = defaultSource["role"] | "";
            const char* defaultPurpose = defaultSource["purpose"] | "";
            const bool hasDefault = !defaultSource.isNull();
            const bool completeDefault = defaultId[0] && defaultName[0] &&
                                         defaultRole[0] && defaultPurpose[0] &&
                                         strlen(defaultId) < sizeof(catalog->defaults[0].id) &&
                                         strlen(defaultName) < sizeof(catalog->defaults[0].name) &&
                                         strlen(defaultRole) < sizeof(catalog->defaults[0].role) &&
                                         strlen(defaultPurpose) < sizeof(catalog->defaults[0].purpose);
            if (hasDefault && (!completeDefault ||
                !idValid(defaultId, sizeof(catalog->defaults[0].id)))) {
                return reject("PCB port mode has an incomplete or invalid default assignment");
            }
            mode.channel = modeSource["channel"] | 0;
            mode.gpio = modeSource["endpoint"]["gpio"] | -1;
            mode.activeHigh = modeSource["active_high"] | true;
            const char* pull = modeSource["pull"] | "none";
#if !defined(OT_PLATFORM_ESP32)
            if(modeSource["pull_control"].is<JsonObjectConst>()) {
                auto control=modeSource["pull_control"];
                const char* device=control["device"] | "";
                const int channel=control["channel"] | -1;
                for(uint8_t d=0;d<catalog->deviceCount;d++) if(!strcmp(catalog->devices[d].id,device)) mode.pullDeviceIndex=d;
                if(mode.pullDeviceIndex<0 || channel<0 || channel>7 ||
                   mode.gpio<0 || (mode.adapter!=Adapter::DigitalInput && mode.adapter!=Adapter::PcntInput && mode.adapter!=Adapter::RcPwmInput && mode.adapter!=Adapter::PwmDutyInput) ||
                   (strcmp(catalog->devices[mode.pullDeviceIndex].driver,"tca9534") && strcmp(catalog->devices[mode.pullDeviceIndex].driver,"tca9554"))) {
                    return reject("Invalid PCB pull-control endpoint");
                }
                mode.pullChannel=channel; mode.pullActiveHigh=control["active_high"] | true;
            }
#endif
            if (!strcmp(pull, "none")) mode.pull = 0;
            else if (!strcmp(pull, "up")) mode.pull = 1;
            else if (!strcmp(pull, "down")) mode.pull = 2;
            else {
                return reject("PCB port mode has invalid pull setting");
            }
            mode.hasSafeDemand = modeSource["safe_demand"].is<float>() || modeSource["safe_demand"].is<int>();
            mode.safeDemand = modeSource["safe_demand"] | 0.0f;
            mode.minimumHz = modeSource["limits"]["minimum_hz"] | 0.0f;
            mode.maximumHz = modeSource["limits"]["maximum_hz"] | 0.0f;
            mode.minimumMv = modeSource["limits"]["minimum_mv"] | 0.0f;
            mode.maximumMv = modeSource["limits"]["maximum_mv"] | 3300.0f;
            mode.referenceMv = modeSource["reference_mv"] | 3300.0f;
            if (mode.referenceMv < 1000.0f || mode.referenceMv > 5500.0f) {
                return reject("PCB port mode has invalid ADC reference");
            }
            if (mode.adapter == Adapter::Unknown) {
                // Forward-compatible: retain the port so UI can report that a
                // newer firmware is required, but never resolve this mode.
                continue;
            }
            const bool output = strstr(adapterText, "output") != nullptr;
            if (hasDefault) {
                const auto direction = output ? ChannelRegistry::Output : ChannelRegistry::Input;
                ChannelRegistry::Driver driver;
                const bool lowTemperatureDefault = !strcmp(defaultRole,"temperature") &&
                    (!strcmp(defaultPurpose,"oil_temperature") || !strcmp(defaultPurpose,"coolant_temp") ||
                     !strcmp(defaultPurpose,"intake_temperature") || !strcmp(defaultPurpose,"general_temperature") ||
                     !strcmp(defaultPurpose,"generic"));
                const bool thermocoupleDefault = lowTemperatureDefault ||
                    !strcmp(defaultPurpose,"tot") || !strcmp(defaultPurpose,"tit");
                if (!ChannelRegistry::roleValid(direction, defaultRole) ||
                    !ChannelRegistry::purposeValid(direction, defaultPurpose) ||
                    !adapterDriver(mode.adapter, driver) ||
                    !ChannelRegistry::purposeRoleDriverValid(direction, defaultPurpose,
                                                             defaultRole, driver) ||
                    (!strcmp(adapterText,"spi_thermocouple") && !thermocoupleDefault) ||
                    (!strcmp(adapterText,"onewire_temperature") && !lowTemperatureDefault)) {
                    return reject("PCB port mode default is incompatible with its electrical adapter");
                }
            }
            if (!validTargetPin(mode.gpio, output) ||
                (output && (!mode.hasSafeDemand || mode.safeDemand < 0.0f || mode.safeDemand > 1.0f))) {
                return reject("PCB port mode has invalid GPIO or safe state");
            }
            if (deviceId[0] && mode.deviceIndex < 0) {
                return reject("port mode refers to missing device");
            }
            if (hasDefault) {
                DefaultAssignment& assignment = catalog->defaults[catalog->defaultCount++];
                assignment.portIndex = catalog->portCount - 1;
                assignment.modeIndex = port.modeCount - 1;
                strlcpy(assignment.id, defaultId, sizeof(assignment.id));
                strlcpy(assignment.name, defaultName, sizeof(assignment.name));
                strlcpy(assignment.role, defaultRole, sizeof(assignment.role));
                strlcpy(assignment.purpose, defaultPurpose, sizeof(assignment.purpose));
            }
        }
        // A multipurpose connector may offer multiple adapters over one GPIO,
        // but every output interpretation must agree on the physical boot
        // level. Otherwise firmware could not park that pin deterministically
        // before the user configuration is loaded.
        for (uint8_t a = 0; a < port.modeCount; ++a) {
            const Mode& first = port.modes[a];
            const char* firstAdapter = adapterName(first.adapter);
            if (first.gpio < 0 || !strstr(firstAdapter, "output") ||
                !strncmp(firstAdapter, "i2c_", 4))
                continue;
            const bool firstProportional = !strcmp(firstAdapter, "pwm_output") ||
                                           !strcmp(firstAdapter, "servo_output");
            const bool firstLevel = firstProportional ? !first.activeHigh :
                RelayDemand::physicalLevel(first.safeDemand, !first.activeHigh);
            for (uint8_t b = a + 1; b < port.modeCount; ++b) {
                const Mode& second = port.modes[b];
                const char* secondAdapter = adapterName(second.adapter);
                if (second.gpio != first.gpio || !strstr(secondAdapter, "output") ||
                    !strncmp(secondAdapter, "i2c_", 4))
                    continue;
                const bool secondProportional = !strcmp(secondAdapter, "pwm_output") ||
                                                !strcmp(secondAdapter, "servo_output");
                const bool secondLevel = secondProportional ? !second.activeHigh :
                    RelayDemand::physicalLevel(second.safeDemand, !second.activeHigh);
                if (firstLevel != secondLevel) {
                    return reject("multipurpose PCB output modes disagree on boot-safe level");
                }
            }
        }
    }
    // Reject impossible aliases before the catalog becomes authoritative.
    // Modes on one multipurpose port may share their endpoint, but separate
    // ports may not silently name the same GPIO or device channel.
    int16_t gpioOwner[49];
    for (auto& owner : gpioOwner) owner = -1;
    auto claimGpio = [&](int pin, int16_t owner, bool sameOwnerAllowed) __attribute__((noinline)) {
        if (pin < 0) return true;
        if (pin >= static_cast<int>(sizeof(gpioOwner) / sizeof(gpioOwner[0])))
            return false;
        if (gpioOwner[pin] >= 0 &&
            !(sameOwnerAllowed && gpioOwner[pin] == owner)) return false;
        gpioOwner[pin] = owner;
        return true;
    };
    int16_t fixedOwner = 100;
    for (uint8_t i = 0; i < catalog->busCount; ++i) {
        const Bus& bus = catalog->buses[i];
        for (int pin : {bus.sda, bus.scl, bus.interrupt, bus.sck, bus.miso,
                        bus.mosi, bus.tx, bus.rx, bus.data})
            if (!claimGpio(pin, fixedOwner++, false)) {
                return reject("PCB buses share an exclusive GPIO");
            }
    }
    for (uint8_t i = 0; i < catalog->deviceCount; ++i)
        if (!claimGpio(catalog->devices[i].selectGpio, fixedOwner++, false)) {
            return reject("PCB device select conflicts with another GPIO use");
        }
    if (
#if !defined(OT_PLATFORM_ESP32)
        (catalog->hasFaultLed && !claimGpio(catalog->faultLedGpio,fixedOwner++,false)) ||
        (catalog->hasOutputEnable && !claimGpio(catalog->outputEnableGpio,fixedOwner++,false)) ||
#endif
        (catalog->hasStatusLed &&
         !claimGpio(catalog->statusLedGpio, fixedOwner++, false)) ||
        (catalog->hasBuzzer &&
         !claimGpio(catalog->buzzerGpio, fixedOwner++, false)) ||
        (catalog->hasServoOutputEnable &&
         !claimGpio(catalog->servoOutputEnableGpio, fixedOwner++, false)) ||
        (catalog->hasSupplyVoltage &&
         !claimGpio(catalog->supplyVoltageGpio, fixedOwner++, false))) {
        return reject("fixed PCB output conflicts with another GPIO use");
    }
    for (uint8_t i = 0; i < catalog->portCount; ++i) {
        const Port& port = catalog->ports[i];
        for (uint8_t j = 0; j < port.modeCount; ++j) {
            const Mode& mode = port.modes[j];
            if (!claimGpio(mode.gpio, i, true)) {
                return reject("separate PCB ports share an exclusive GPIO");
            }
            if (mode.deviceIndex < 0) continue;
            for (uint8_t priorPort = 0; priorPort < i; ++priorPort) {
                const Port& prior = catalog->ports[priorPort];
                for (uint8_t priorMode = 0; priorMode < prior.modeCount; ++priorMode)
                    if (prior.modes[priorMode].deviceIndex == mode.deviceIndex &&
                        prior.modes[priorMode].channel == mode.channel) {
                        return reject("separate PCB ports share a device channel");
                    }
            }
        }
    }
#if !defined(OT_PLATFORM_ESP32)
    uint8_t channelOwners[MAX_DEVICES][8] = {};
    auto claimChannel=[&](int device,int channel,uint8_t owner){
        if(device<0)return true;
        if(device>=catalog->deviceCount || channel<0 || channel>7)return false;
        uint8_t& prior=channelOwners[device][channel];
        if(prior && prior!=owner)return false;
        prior=owner; return true;
    };
    bool endpointOk=claimChannel(catalog->statusLedDeviceIndex,catalog->statusLedChannel,253) &&
                    claimChannel(catalog->faultLedDeviceIndex,catalog->faultLedChannel,254);
    for(uint8_t i=0;i<catalog->portCount;i++) for(uint8_t j=0;j<catalog->ports[i].modeCount;j++){
        const auto& m=catalog->ports[i].modes[j];
        endpointOk=endpointOk && claimChannel(m.deviceIndex,m.channel,i+1) && claimChannel(m.pullDeviceIndex,m.pullChannel,i+60);
    }
    if(!endpointOk){return reject("PCB fixed/port/control device channels conflict");}
#endif
    _catalog = catalog;
    return true;
}

const PcbProfileManager::Port* PcbProfileManager::findPort(const char* id) {
    if (!_catalog || !id) return nullptr;
    for (uint8_t i = 0; i < _catalog->portCount; ++i)
        if (!strcmp(_catalog->ports[i].id, id)) return &_catalog->ports[i];
    return nullptr;
}

const PcbProfileManager::Mode* PcbProfileManager::findMode(const Port& port, const char* id) {
    if (!id) return nullptr;
    for (uint8_t i = 0; i < port.modeCount; ++i)
        if (!strcmp(port.modes[i].id, id)) return &port.modes[i];
    return nullptr;
}

const PcbProfileManager::Device* PcbProfileManager::deviceForMode(const Mode& mode) {
    if (!_catalog || mode.deviceIndex < 0 || mode.deviceIndex >= _catalog->deviceCount)
        return nullptr;
    return &_catalog->devices[mode.deviceIndex];
}

const PcbProfileManager::Bus* PcbProfileManager::findBus(const char* id) {
    if (!_catalog || !id) return nullptr;
    for (uint8_t i = 0; i < _catalog->busCount; ++i)
        if (!strcmp(_catalog->buses[i].id, id)) return &_catalog->buses[i];
    return nullptr;
}

const PcbProfileManager::Bus* PcbProfileManager::findBusKind(const char* kind) {
    if (!_catalog || !kind) return nullptr;
    for (uint8_t i = 0; i < _catalog->busCount; ++i)
        if (!strcmp(_catalog->buses[i].kind, kind)) return &_catalog->buses[i];
    return nullptr;
}

bool PcbProfileManager::ownsBusKind(const char* kind) {
    return findBusKind(kind) != nullptr;
}

bool PcbProfileManager::gpioReserved(int gpio) {
    if (!_catalog || gpio < 0) return false;
    for (uint8_t i = 0; i < _catalog->busCount; ++i) {
        const Bus& bus = _catalog->buses[i];
        for (int pin : {bus.sda, bus.scl, bus.interrupt, bus.sck, bus.miso,
                        bus.mosi, bus.tx, bus.rx, bus.data})
            if (pin == gpio) return true;
    }
    for (uint8_t i = 0; i < _catalog->deviceCount; ++i)
        if (_catalog->devices[i].selectGpio == gpio) return true;
    if (
#if !defined(OT_PLATFORM_ESP32)
        (_catalog->hasFaultLed && _catalog->faultLedGpio == gpio) ||
        (_catalog->hasOutputEnable && _catalog->outputEnableGpio == gpio) ||
#endif
        (_catalog->hasStatusLed && _catalog->statusLedGpio == gpio) ||
        (_catalog->hasBuzzer && _catalog->buzzerGpio == gpio) ||
        (_catalog->hasServoOutputEnable && _catalog->servoOutputEnableGpio == gpio) ||
        (_catalog->hasSupplyVoltage && _catalog->supplyVoltageGpio == gpio))
        return true;
    // Labelled connector GPIOs are resources, not permanently-owned fixed
    // functions. They are reserved by the resolved channel that actually
    // claims the connector. Keeping every possible port mode in this list made
    // an otherwise unused header pin unavailable for a user-added I2C/SPI bus.
    return false;
}

void PcbProfileManager::setOutputsEnabled(bool enabled) {
#if !defined(OT_PLATFORM_ESP32)
    if(!active() || !_catalog->hasOutputEnable || _catalog->outputEnableGpio<0) return;
    const bool high=enabled ? _catalog->outputEnableActiveHigh : !_catalog->outputEnableActiveHigh;
    digitalWrite(_catalog->outputEnableGpio,high?HIGH:LOW);
    pinMode(_catalog->outputEnableGpio,OUTPUT);
#endif
}

void PcbProfileManager::setServoOutputsEnabled(bool enabled) {
    if (!_catalog || !_catalog->hasServoOutputEnable) return;
    const bool level = enabled == _catalog->servoOutputEnableActiveHigh;
    digitalWrite(_catalog->servoOutputEnableGpio, level ? HIGH : LOW);
    pinMode(_catalog->servoOutputEnableGpio, OUTPUT);
}

void PcbProfileManager::toJson(JsonObject out, bool includePorts,
                               uint8_t portOffset, uint8_t portLimit) {
    out["state"] = _state == State::Absent ? "absent" :
                   _state == State::Valid ? "valid" : "fault";
    if (_state == State::Fault) out["error"] = _fault;
    if (!_catalog) return;
    out["id"] = _catalog->boardId;
    out["name"] = _catalog->boardName;
    out["revision"] = _catalog->revision;
    out["manufacturer"] = _catalog->manufacturer;
    out["description"] = _catalog->description;
    out["target_chip"] = _catalog->targetChip;
    out["format_major"] = _catalog->formatMajor;
    out["format_minor"] = _catalog->formatMinor;
    out["origin"] = _catalog->origin == Origin::Official ? "official" :
                    _catalog->origin == Origin::Custom ? "custom" : "unknown";
    out["port_count"] = _catalog->portCount;
    JsonObject busOwnership = out["bus_ownership"].to<JsonObject>();
    busOwnership["i2c"] = ownsBusKind("i2c");
    busOwnership["spi"] = ownsBusKind("spi");
    JsonArray reserved = out["reserved_gpio"].to<JsonArray>();
    for (int gpio = 0; gpio <= 48; ++gpio)
        if (gpioReserved(gpio)) reserved.add(gpio);
    JsonObject fixed = out["fixed_functions"].to<JsonObject>();
    if (_catalog->hasStatusLed) {
        JsonObject item = fixed["status_led"].to<JsonObject>();
        item["available"] = true;
        item["type"] = _catalog->statusLedType ? "neopixel" : "gpio";
    }
    if (_catalog->hasBuzzer)
        fixed["buzzer"]["available"] = true;
#if !defined(OT_PLATFORM_ESP32)
    if (_catalog->hasFaultLed)
        fixed["fault_led"]["available"] = true;
    if (_catalog->hasOutputEnable)
        fixed["output_enable"]["available"] = true;
#endif
    if (_catalog->hasServoOutputEnable)
        fixed["servo_output_enable"]["available"] = true;
    if (_catalog->hasSupplyVoltage) {
        JsonObject item = fixed["supply_voltage"].to<JsonObject>();
        item["available"] = true;
        item["label"] = _catalog->supplyVoltageLabel;
    }
    const char* serialBus=_catalog->mavlinkBusId[0]?_catalog->mavlinkBusId:_catalog->clusterSerialBusId;
    if (serialBus[0]) {
        fixed["mavlink"]["available"] = true;
        fixed["mavlink"]["connection"] = serialBus;
    }
    if (!includePorts) return;
    JsonArray ports = out["ports"].to<JsonArray>();
    uint8_t end = portOffset + portLimit;
    if (end < portOffset || end > _catalog->portCount) end = _catalog->portCount;
    out["port_offset"] = portOffset;
    for (uint8_t i = portOffset; i < end; ++i) {
        const Port& port = _catalog->ports[i];
        JsonObject item = ports.add<JsonObject>();
        item["id"] = port.id; item["label"] = port.label;
        item["connector"] = port.connector; item["description"] = port.description;
        JsonArray modes = item["modes"].to<JsonArray>();
        for (uint8_t j = 0; j < port.modeCount; ++j) {
            const Mode& mode = port.modes[j];
            JsonObject m = modes.add<JsonObject>();
            const char* adapter = adapterName(mode.adapter);
            m["id"] = mode.id; m["adapter"] = adapter;
            if (mode.gpio >= 0) m["gpio"] = mode.gpio;
            m["active_high"] = mode.activeHigh;
            m["pull"] = mode.pull == 1 ? "up" : mode.pull == 2 ? "down" : "none";
#if !defined(OT_PLATFORM_ESP32)
            if(mode.pullDeviceIndex>=0) m["external_pullup"] = true;
#endif
            const Device* device = deviceForMode(mode);
            if (device) {
                m["device"] = device->id;
                m["device_driver"] = device->driver;
            }
            const DefaultAssignment* defaultAssignment = nullptr;
            for (uint8_t d = 0; d < _catalog->defaultCount; ++d) {
                const DefaultAssignment& candidate = _catalog->defaults[d];
                if (candidate.portIndex == i && candidate.modeIndex == j) {
                    defaultAssignment = &candidate;
                    break;
                }
            }
            if (defaultAssignment) {
                JsonObject assignment = m["default"].to<JsonObject>();
                assignment["id"] = defaultAssignment->id;
                assignment["name"] = defaultAssignment->name;
                assignment["role"] = defaultAssignment->role;
                assignment["purpose"] = defaultAssignment->purpose;
            }
            if ((!strcmp(adapter, "i2c_adc_input") ||
                 !strcmp(adapter, "i2c_adc_digital_input")) &&
                mode.referenceMv > 0.0f)
                m["reference_mv"] = mode.referenceMv;
        }
    }
}
