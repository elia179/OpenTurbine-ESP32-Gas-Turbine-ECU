#!/usr/bin/env python3
"""Validate and wrap OpenTurbine PCB profiles for the pcbprof partition.

Source profiles stay readable JSON beside the PCB design. The flash-time
container adds target identity and corruption detection without making the
source format firmware-specific.
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAGIC = b"OTPB"
CONTAINER_VERSION = 1
ENCODING_JSON = 1
ORIGIN_CUSTOM = 1
ORIGIN_OFFICIAL = 2
HEADER = struct.Struct("<4sBBBBBBHII12s")
MAX_PAYLOAD = 24 * 1024
MAX_BUSES = 8
MAX_DEVICES = 24
MAX_PORTS = 48
MAX_MODES = 4
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,23}$")
BOARD_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")
TARGET_IDS = {"esp32": 1, "esp32-s3": 2}
ADAPTERS = {
    "digital_input", "analog_input", "pcnt_input", "rc_pwm_input",
    "pwm_duty_input", "spi_thermocouple", "onewire_temperature",
    "i2c_digital_input", "i2c_adc_input", "i2c_load_cell",
    "i2c_adc_digital_input",
    "digital_output", "relay_output", "pwm_output", "servo_output",
    "i2c_digital_output",
}

ANALOG_INPUTS = {"analog_input", "i2c_adc_input"}
DIGITAL_INPUTS = {"digital_input", "i2c_digital_input", "i2c_adc_digital_input"}
GENERAL_OUTPUTS = {"digital_output", "relay_output", "pwm_output", "servo_output", "i2c_digital_output"}


def _default_compatible(adapter: str, purpose: str, role: str) -> bool:
    """Mirror the firmware's purpose/role/electrical capability contract."""
    if purpose == "generic":
        if role == "generic":
            allowed = ({"digital_input", "analog_input", "pcnt_input", "rc_pwm_input",
                        "pwm_duty_input", "i2c_digital_input", "i2c_adc_input"}
                       if not adapter.endswith("_output") else GENERAL_OUTPUTS)
            return adapter in allowed
        representatives = {
            "speed": "shaft_speed", "pressure": "coolant_pressure", "temperature": "coolant_temp",
            "flame": "flame", "flow": "oil_flow", "torque": "torque", "thrust": "thrust",
            "voltage": "battery_voltage", "operator": "idle", "digital_switch": "digital_switch",
            "fault": "fault", "estop": "estop", "inhibit_start": "inhibit_start",
            "low_oil_switch": "low_oil_switch", "oil_zero_switch": "oil_zero_switch",
            "sequence_gate": "sequence_gate", "ab_arm": "ab_arm", "ab_fire": "ab_fire",
            "limp_mode": "limp_mode", "fuel": "main_fuel", "fuel_shutoff": "fuel_shutoff",
            "starter": "starter", "starter_en": "starter_enable", "oil_pump": "oil_pump",
            "coolant_pump": "coolant_pump", "scavenge_pump": "scavenge_pump",
            "cooling_fan": "cooling_fan", "valve": "valve", "igniter": "igniter",
            "ab_igniter": "ab_igniter", "glow_plug": "glow_plug", "fuel_pump": "fuel_pump",
            "ab_pump": "ab_pump", "prop_pitch": "prop_pitch", "indicator": "warning_indicator",
        }
        representative = representatives.get(role)
        return bool(representative and _default_compatible(adapter, representative, role))

    input_groups = {
        "speed": ({"n1_speed", "n2_speed", "shaft_speed"},
                  ANALOG_INPUTS | {"pcnt_input"}),
        "flow": ({"fuel_flow", "general_flow", "oil_flow", "scavenge_flow"},
                 ANALOG_INPUTS | {"pcnt_input"}),
        "current": ({"general_current"}, ANALOG_INPUTS),
        "pressure": ({"oil_pressure", "fuel_pressure", "p1_pressure", "p2_pressure", "coolant_pressure", "general_pressure"},
                     ANALOG_INPUTS),
        "flame": ({"flame", "ab_flame"}, ANALOG_INPUTS | DIGITAL_INPUTS),
        "torque": ({"torque", "general_torque"}, ANALOG_INPUTS | {"i2c_load_cell"}),
        "thrust": ({"thrust", "general_thrust"}, ANALOG_INPUTS | {"i2c_load_cell"}),
        "voltage": ({"battery_voltage", "general_voltage"}, ANALOG_INPUTS),
    }
    for expected_role, (purposes, adapters) in input_groups.items():
        if purpose in purposes:
            return role == expected_role and adapter in adapters
    if purpose in {"tot", "tit"}:
        return role == "temperature" and adapter in ANALOG_INPUTS | {"spi_thermocouple"}
    if purpose in {"oil_temperature", "coolant_temp", "intake_temperature", "general_temperature"}:
        return role == "temperature" and adapter in ANALOG_INPUTS | {"spi_thermocouple", "onewire_temperature"}
    if purpose == "throttle":
        return role == "operator" and adapter in ANALOG_INPUTS | {"pcnt_input", "rc_pwm_input", "pwm_duty_input"}
    if purpose == "idle":
        return role == "operator" and adapter in ANALOG_INPUTS | DIGITAL_INPUTS | {"pcnt_input", "rc_pwm_input", "pwm_duty_input"}
    if purpose == "ab_command":
        return role == "operator" and adapter in ANALOG_INPUTS | {"rc_pwm_input", "pwm_duty_input"}

    switch_roles = {
        "start_switch": "digital_switch", "stop_switch": "digital_switch",
        "digital_switch": "digital_switch", "chip_detector": "digital_switch", "diff_press_switch": "digital_switch", "inhibit_start": "inhibit_start",
        "estop": "estop", "fault": "fault", "low_oil_switch": "low_oil_switch",
        "oil_zero_switch": "oil_zero_switch", "sequence_gate": "sequence_gate",
        "ab_arm": "ab_arm", "ab_fire": "ab_fire", "limp_mode": "limp_mode",
    }
    if purpose in switch_roles:
        return role == switch_roles[purpose] and adapter in DIGITAL_INPUTS

    output_roles = {
        "main_fuel": ("fuel", {"pwm_output", "servo_output"}),
        "fuel_shutoff": ("fuel_shutoff", {"digital_output", "relay_output", "i2c_digital_output"}),
        "starter": ("starter", GENERAL_OUTPUTS), "starter_enable": ("starter_en", GENERAL_OUTPUTS),
        "oil_pump": ("oil_pump", GENERAL_OUTPUTS), "coolant_pump": ("coolant_pump", GENERAL_OUTPUTS),
        "scavenge_pump": ("scavenge_pump", GENERAL_OUTPUTS), "cooling_fan": ("cooling_fan", GENERAL_OUTPUTS),
        "fuel_pump": ("fuel_pump", GENERAL_OUTPUTS),
        "igniter": ("igniter", {"digital_output", "relay_output", "pwm_output", "i2c_digital_output"}),
        "ab_igniter": ("ab_igniter", {"digital_output", "relay_output", "pwm_output", "i2c_digital_output"}),
        "glow_plug": ("glow_plug", {"digital_output", "relay_output", "pwm_output", "i2c_digital_output"}),
        "valve": ("valve", GENERAL_OUTPUTS), "ab_valve": ("valve", {"digital_output", "relay_output", "i2c_digital_output"}),
        "air_starter": ("starter", GENERAL_OUTPUTS), "pilot_fuel": ("valve", GENERAL_OUTPUTS),
        "purge_valve": ("valve", GENERAL_OUTPUTS), "drain_valve": ("valve", GENERAL_OUTPUTS),
        "nozzle_actuator": ("prop_pitch", {"pwm_output", "servo_output"}),
        "ab_pump": ("ab_pump", GENERAL_OUTPUTS), "prop_pitch": ("prop_pitch", GENERAL_OUTPUTS),
        "status_led": ("indicator", {"digital_output", "relay_output", "i2c_digital_output"}),
        "fault_led": ("indicator", {"digital_output", "relay_output", "i2c_digital_output"}),
        "warning_indicator": ("indicator", {"digital_output", "relay_output", "pwm_output", "i2c_digital_output"}),
    }
    expected = output_roles.get(purpose)
    return bool(expected and role == expected[0] and adapter in expected[1])


class ProfileError(ValueError):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ProfileError(message)


def _load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ProfileError(f"cannot read valid UTF-8 JSON: {exc}") from exc
    _require(isinstance(value, dict), "profile root must be an object")
    return value


def _target_catalog(chip: str) -> dict:
    path = ROOT / "pcb_profiles" / "targets" / f"{chip}.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ProfileError(f"target catalog for {chip!r} is unavailable: {exc}") from exc


def _utf8_size(value: str) -> int:
    """Match the firmware's fixed byte buffers, including non-ASCII labels."""
    if "\0" in value:
        raise ProfileError("Text fields cannot contain NUL UTF-8 bytes")
    try:
        return len(value.encode("utf-8"))
    except UnicodeError as exc:
        raise ProfileError("Text fields must contain valid UTF-8") from exc


def validate_profile(profile: dict, *, strict: bool = False) -> list[str]:
    warnings: list[str] = []
    _require(profile.get("format") == "openturbine-pcb-profile",
             "format must be 'openturbine-pcb-profile'")
    version = profile.get("format_version")
    _require(isinstance(version, dict) and version.get("major") in (1,2),
             "format_version.major must be 1 or 2")
    _require(isinstance(version.get("minor"), int) and 0 <= version["minor"] <= 255,
             "format_version.minor must be 0..255")

    board = profile.get("board")
    _require(isinstance(board, dict), "board must be an object")
    _require(isinstance(board.get("id"), str) and BOARD_ID_RE.fullmatch(board["id"]),
             "board.id must be a stable lowercase ID up to 40 characters")
    for key, limit in (("name", 47), ("revision", 15)):
        _require(isinstance(board.get(key), str) and 0 < _utf8_size(board[key]) <= limit,
                 f"board.{key} must be 1..{limit} UTF-8 bytes")
    for key, limit in (("manufacturer", 31), ("description", 95)):
        value = board.get(key, "")
        _require(isinstance(value, str) and _utf8_size(value) <= limit,
                 f"board.{key} must be at most {limit} UTF-8 bytes")

    target = profile.get("target")
    _require(isinstance(target, dict) and target.get("chip") in TARGET_IDS,
             "target.chip must be esp32 or esp32-s3")
    chip = target["chip"]
    _require(chip != "esp32" or (version["major"] == 1 and version["minor"] == 0),
             "Classic ESP32 supports format 1.0 profiles; newer capabilities require S3")
    catalog = _target_catalog(chip)
    valid_gpio = set(catalog["gpio"])
    input_only = set(catalog.get("input_only_gpio", []))
    straps = set(catalog.get("strapping_gpio", []))
    reviewed_straps = target.get("reviewed_strapping_gpio", [])
    _require(isinstance(reviewed_straps, list) and
             all(isinstance(pin, int) and pin in straps for pin in reviewed_straps),
             "target.reviewed_strapping_gpio must contain only target strapping GPIOs")
    reviewed_straps = set(reviewed_straps)

    buses = profile.get("buses", [])
    devices = profile.get("devices", [])
    ports = profile.get("ports")
    _require(isinstance(buses, list) and len(buses) <= MAX_BUSES,
             f"buses must contain at most {MAX_BUSES} entries")
    _require(isinstance(devices, list) and len(devices) <= MAX_DEVICES,
             f"devices must contain at most {MAX_DEVICES} entries")
    _require(isinstance(ports, list) and 0 < len(ports) <= MAX_PORTS,
             f"ports must contain 1..{MAX_PORTS} entries")

    all_ids: set[str] = set()

    def stable_id(owner: dict, where: str) -> str:
        value = owner.get("id")
        _require(isinstance(value, str) and ID_RE.fullmatch(value),
                 f"{where}.id is not a valid stable ID")
        _require(value not in all_ids, f"duplicate stable ID {value!r}")
        all_ids.add(value)
        return value

    def gpio(value: object, where: str, *, output: bool = False) -> None:
        if value == -1:
            return
        _require(isinstance(value, int) and value in valid_gpio,
                 f"{where} GPIO {value!r} does not exist on {chip}")
        _require(not output or value not in input_only,
                 f"{where} GPIO {value} is input-only on {chip}")
        if value in straps and value not in reviewed_straps:
            warnings.append(f"{where} uses boot-strapping GPIO {value}")

    gpio_owners: dict[int, str] = {}
    device_channel_owners: dict[tuple[str, int], str] = {}

    def claim_gpio(value: object, owner: str, *, same_owner_ok: bool = False) -> None:
        if value == -1:
            return
        prior = gpio_owners.get(value)
        _require(prior is None or (same_owner_ok and prior == owner),
                 f"GPIO {value} is claimed by both {prior} and {owner}")
        gpio_owners[value] = owner

    bus_ids: set[str] = set()
    bus_kinds: dict[str, str] = {}
    for index, bus in enumerate(buses):
        _require(isinstance(bus, dict), f"buses[{index}] must be an object")
        bus_id = stable_id(bus, f"buses[{index}]")
        bus_ids.add(bus_id)
        bus_kinds[bus_id] = bus.get("kind")
        _require(bus.get("kind") in {"i2c", "spi", "uart", "onewire"},
                 f"bus {bus_id} has unsupported kind")
        pins = bus.get("pins")
        _require(isinstance(pins, dict), f"bus {bus_id} requires pins")
        required = {
            "i2c": {"sda", "scl"},
            "spi": {"sck", "miso"},
            "uart": {"tx"},
            "onewire": {"data"},
        }[bus["kind"]]
        _require(required.issubset(pins) and all(isinstance(pins[key], int) and pins[key] >= 0 for key in required),
                 f"bus {bus_id} is missing required {bus['kind']} pins")
        _require(len([pins[key] for key in required]) == len(set(pins[key] for key in required)),
                 f"bus {bus_id} reuses one GPIO for multiple required signals")
        for key, value in pins.items():
            gpio(value, f"bus {bus_id}.{key}", output=key in {"sck", "mosi", "sda", "scl", "tx"})
            claim_gpio(value, f"bus {bus_id}.{key}")

    device_ids: set[str] = set()
    for index, device in enumerate(devices):
        _require(isinstance(device, dict), f"devices[{index}] must be an object")
        device_id = stable_id(device, f"devices[{index}]")
        device_ids.add(device_id)
        _require(isinstance(device.get("driver"), str) and ID_RE.fullmatch(device["driver"]),
                 f"device {device_id} has invalid driver")
        if "bus" in device:
            _require(device["bus"] in bus_ids, f"device {device_id} refers to missing bus")
        if "address" in device:
            _require(isinstance(device["address"], int) and 0 <= device["address"] <= 127,
                     f"device {device_id} has invalid I2C address")
        select = device.get("select", {})
        if isinstance(select, dict) and "gpio" in select:
            gpio(select["gpio"], f"device {device_id}.select", output=True)
            claim_gpio(select["gpio"], f"device {device_id}.select")

    fixed = profile.get("fixed_functions", {})
    _require(isinstance(fixed, dict), "fixed_functions must be an object")
    def claim_device_channel(device, channel, owner):
        _require(device in device_ids and isinstance(channel,int) and 0 <= channel < 8,
                 f"{owner} requires a fitted device and channel 0..7")
        component=next(d for d in devices if d['id']==device)
        _require(component.get('driver') in {'tca9534','tca9554'} and 0x20 <= component.get('address',0) <= 0x27,
                 f"{owner} requires a TCA9534/TCA9554 endpoint")
        prior=device_channel_owners.get((device,channel))
        _require(prior is None or prior == owner,f"{owner} conflicts with device channel owned by {prior}")
        device_channel_owners[(device,channel)]=owner

    power = fixed.get('power_stage')
    if power is not None:
        _require(version=={'major':2,'minor':0} and chip=='esp32-s3', 'protected power stage requires format 2.0 and S3')
        _require(power.get('driver')=='drv8350s' and power.get('spi_hz')==100000 and power.get('maximum_pwm_hz')==20000,'unsupported DRV8350 power-stage settings')
        enable=fixed.get('output_enable',{})
        _require(enable.get('mode')=='health_heartbeat' and enable.get('frequency_hz')==100 and enable.get('active_high') is True,'power stage needs the 100 Hz health heartbeat')
        control=power.get('control_device')
        _require(control in device_ids, 'power stage control device missing')
        device=next(d for d in devices if d['id']==control)
        _require(device.get('driver')=='tca9534' and device.get('address')==0x21,'power control needs a dedicated 0x21 TCA9534')
        bus=next((b for b in buses if b['id']==device.get('bus')), {})
        _require(bus.get('kind')=='i2c' and bus.get('frequency_hz')==100000,'power control requires 100 kHz I2C')
        spi=next((b for b in buses if b['id']==power.get('spi_bus')), {})
        _require(spi.get('kind')=='spi' and spi.get('pins',{}).get('mosi',-1)>=0, 'power stage SPI bus incomplete')
        pins=power.get('inh_gpio',[])
        _require(len(pins)==6 and len(set(pins))==6,'power stage requires six unique INH pins')
        for pin in pins:
            gpio(pin,'power INH',output=True)
            modes=[m for p in ports for m in p.get('modes',[]) if m.get('endpoint',{}).get('gpio')==pin]
            _require(modes and all(m['adapter'] in {'relay_output','pwm_output'} and m.get('active_high',True) and m.get('safe_demand')==0 for m in modes),'power INH must have a safe named PWM/on-off connector')
        for ch in range(8): claim_device_channel(control,ch,'fixed_functions.power_stage')
    else:
        _require(version['major']==1 and fixed.get('output_enable',{}).get('mode','static')=='static','heartbeat/format 2.0 requires protected power stage')

    for key in ("status_led", "fault_led", "buzzer", "output_enable"):
        if key not in fixed:
            continue
        item = fixed[key]
        if key in {'fault_led','output_enable'}:
            _require((version['major'] == 2 or version['minor'] >= 1), f'{key} requires profile format 1.1')
            _require(chip=='esp32-s3','These fixed PCB functions require ESP32-S3; generic GPIO Fault LEDs remain available on Classic')
        if key in {'status_led','fault_led'} and isinstance(item,dict) and 'device' in item:
            _require((version['major'] == 2 or version['minor'] >= 1), f'{key} expander endpoint requires profile format 1.1')
            _require(chip=='esp32-s3','Expander-backed fixed indicators require ESP32-S3')
            _require(item.get('type','gpio')=='gpio','Expander-backed indicators must use plain GPIO type')
            _require('gpio' not in item and item.get('safe_demand')==0,f"{key} needs one endpoint and safe_demand 0")
            claim_device_channel(item['device'],item.get('channel'),f"fixed_functions.{key}")
            continue
        _require(isinstance(item, dict) and isinstance(item.get("gpio"), int),
                 f"fixed_functions.{key} requires gpio")
        _require(item['gpio']>=0,f"fixed_functions.{key} requires an assigned GPIO")
        _require(item.get("safe_demand") == 0,
                 f"fixed_functions.{key} requires safe_demand 0")
        if key == "status_led":
            _require(item.get("type", "gpio") in {"gpio", "neopixel"},
                     "fixed status_led type must be gpio or neopixel")
        gpio(item["gpio"], f"fixed_functions.{key}", output=True)
        claim_gpio(item["gpio"], f"fixed_functions.{key}")
    if "servo_output_enable" in fixed:
        item = fixed["servo_output_enable"]
        _require(isinstance(item, dict) and isinstance(item.get("gpio"), int),
                 "fixed_functions.servo_output_enable requires gpio")
        _require(isinstance(item.get("active_high"), bool),
                 "fixed_functions.servo_output_enable requires active_high")
        _require(item.get("safe_demand") == 0,
                 "fixed_functions.servo_output_enable requires safe_demand 0")
        gpio(item["gpio"], "fixed_functions.servo_output_enable", output=True)
        claim_gpio(item["gpio"], "fixed_functions.servo_output_enable")
    if "supply_voltage" in fixed:
        item = fixed["supply_voltage"]
        _require(isinstance(item, dict) and isinstance(item.get("gpio"), int),
                 "fixed_functions.supply_voltage requires gpio")
        _require(isinstance(item.get("divider"), (int, float)) and
                 1 <= item["divider"] <= 100,
                 "fixed_functions.supply_voltage divider must be 1..100")
        label = item.get("label", "ECU supply voltage")
        _require(isinstance(label, str) and _utf8_size(label) <= 31,
                 "fixed_functions.supply_voltage label must be at most 31 UTF-8 bytes")
        gpio(item["gpio"], "fixed_functions.supply_voltage")
        claim_gpio(item["gpio"], "fixed_functions.supply_voltage")
    for key in ("cluster_serial", "mavlink"):
        if key not in fixed:
            continue
        item = fixed[key]
        _require(isinstance(item, dict) and bus_kinds.get(item.get("bus")) == "uart",
                 f"fixed_functions.{key} must refer to a UART bus")

    for index, port in enumerate(ports):
        _require(isinstance(port, dict), f"ports[{index}] must be an object")
        port_id = stable_id(port, f"ports[{index}]")
        _require(isinstance(port.get("label"), str) and 0 < _utf8_size(port["label"]) <= 31,
                 f"port {port_id} label must be 1..31 UTF-8 bytes")
        connector = port.get("connector", "")
        description = port.get("description", "")
        _require(isinstance(connector, str) and _utf8_size(connector) <= 23,
                 f"port {port_id} connector must be at most 23 UTF-8 bytes")
        _require(isinstance(description, str) and _utf8_size(description) <= 79,
                 f"port {port_id} description must be at most 79 UTF-8 bytes")
        modes = port.get("modes")
        _require(isinstance(modes, list) and 0 < len(modes) <= MAX_MODES,
                 f"port {port_id} must have 1..{MAX_MODES} modes")
        mode_ids: set[str] = set()
        native_output_levels: dict[int, bool] = {}
        for mode_index, mode in enumerate(modes):
            _require(isinstance(mode, dict), f"port {port_id} mode {mode_index} must be an object")
            mode_id = mode.get("id")
            _require(isinstance(mode_id, str) and ID_RE.fullmatch(mode_id),
                     f"port {port_id} has invalid mode ID")
            _require(mode_id not in mode_ids, f"port {port_id} repeats mode {mode_id}")
            mode_ids.add(mode_id)
            adapter = mode.get("adapter")
            _require(isinstance(adapter, str) and ID_RE.fullmatch(adapter),
                     f"port {port_id}/{mode_id} has invalid adapter")
            _require(mode.get("pull", "none") in {"none", "up", "down"},
                     f"port {port_id}/{mode_id} pull must be none, up, or down")
            if "active_high" in mode:
                _require(isinstance(mode["active_high"], bool),
                         f"port {port_id}/{mode_id} active_high must be boolean")
            if "reference_mv" in mode:
                _require(isinstance(mode["reference_mv"], (int, float)) and
                         1000 <= mode["reference_mv"] <= 5500,
                          f"port {port_id}/{mode_id} reference_mv must be 1000..5500")
            if "default" in mode:
                default = mode["default"]
                _require(isinstance(default, dict),
                         f"port {port_id}/{mode_id} default must be an object")
                _require(isinstance(default.get("id"), str) and
                         len(default["id"]) <= 19 and ID_RE.fullmatch(default["id"]),
                         f"port {port_id}/{mode_id} default ID is invalid")
                _require(isinstance(default.get("name"), str) and
                         0 < _utf8_size(default["name"]) <= 23,
                         f"port {port_id}/{mode_id} default name must be 1..23 UTF-8 bytes")
                _require(isinstance(default.get("role"), str) and
                         0 < _utf8_size(default["role"]) <= 17,
                         f"port {port_id}/{mode_id} default role must be 1..17 UTF-8 bytes")
                _require(isinstance(default.get("purpose"), str) and
                          0 < _utf8_size(default["purpose"]) <= 19,
                          f"port {port_id}/{mode_id} default purpose must be 1..19 UTF-8 bytes")
                _require(adapter in ADAPTERS and
                         _default_compatible(adapter, default["purpose"], default["role"]),
                         f"port {port_id}/{mode_id} default is incompatible with adapter {adapter}")
            if adapter not in ADAPTERS:
                warnings.append(f"port {port_id}/{mode_id} uses adapter {adapter!r} not supported by this firmware")
            if "device" in mode:
                _require(mode["device"] in device_ids,
                         f"port {port_id}/{mode_id} refers to missing device")
            endpoint = mode.get("endpoint", {})
            if 'pull_control' in mode:
                _require((version['major'] == 2 or version['minor'] >= 1), 'pull_control requires profile format 1.1')
                _require(chip=='esp32-s3','External PCB pull control requires ESP32-S3')
                control=mode['pull_control']
                _require(isinstance(control,dict) and isinstance(control.get('active_high'),bool),f"port {port_id} has invalid pull control")
                _require(adapter in {'pcnt_input','rc_pwm_input','pwm_duty_input','digital_input'},f"port {port_id} pull control requires native digital input")
                claim_device_channel(control.get('device'),control.get('channel'),f"pull_control.{port_id}")
            if isinstance(endpoint, dict) and "gpio" in endpoint:
                output = adapter.endswith("_output") or adapter in {"relay_output", "pwm_output", "servo_output"}
                gpio(endpoint["gpio"], f"port {port_id}/{mode_id}", output=output)
                claim_gpio(endpoint["gpio"], f"port {port_id}", same_owner_ok=True)
            if "device" in mode:
                resource = (mode["device"], mode.get("channel", 0))
                prior = device_channel_owners.get(resource)
                _require(prior is None or prior == port_id,
                         f"device channel {resource[0]}:{resource[1]} is claimed by ports {prior} and {port_id}")
                device_channel_owners[resource] = port_id
            if adapter.endswith("_output") or adapter in {"relay_output", "pwm_output", "servo_output"}:
                _require("safe_demand" in mode, f"output port {port_id}/{mode_id} requires safe_demand")
                _require(isinstance(mode["safe_demand"], (int, float)) and 0 <= mode["safe_demand"] <= 1,
                         f"port {port_id}/{mode_id} safe_demand must be 0..1")
                pin = endpoint.get("gpio") if isinstance(endpoint, dict) else None
                if isinstance(pin, int) and not adapter.startswith("i2c_"):
                    active_high = mode.get("active_high", True)
                    proportional = adapter in {"pwm_output", "servo_output"}
                    physical_level = (not active_high) if proportional else (
                        mode["safe_demand"] >= 0.5 if active_high
                        else mode["safe_demand"] < 0.5
                    )
                    prior_level = native_output_levels.get(pin)
                    _require(prior_level is None or prior_level == physical_level,
                             f"multipurpose port {port_id} output modes disagree on GPIO {pin} boot-safe level")
                    native_output_levels[pin] = physical_level

    if strict and warnings:
        raise ProfileError("strict validation warnings:\n- " + "\n- ".join(warnings))
    headers=profile.get('gpio_headers',[])
    _require(isinstance(headers,list) and len(headers)<=12,'gpio_headers must contain at most 12 GPIOs')
    _require(all(type(pin) is int for pin in headers) and len(set(headers))==len(headers),'gpio_headers must contain unique GPIO numbers')
    for pin in headers:
        gpio(pin,'GPIO header')
        owner=gpio_owners.get(pin,'')
        _require(not owner or owner.startswith('port '),'GPIO header conflicts with fixed PCB wiring')
        _require(pin not in profile.get('fixed_functions',{}).get('power_stage',{}).get('inh_gpio',[]),'power driver input cannot be a raw GPIO header')
    notes=profile.get('gpio_header_notes',{})
    _require(isinstance(notes,dict),'gpio_header_notes must be an object')
    for key,value in notes.items():
        _require(key in {str(pin) for pin in headers} and isinstance(value,str) and _utf8_size(value)<64,'GPIO header note must refer to a header and fit 63 UTF-8 bytes')
    return warnings


def canonical_payload(profile: dict) -> bytes:
    payload = (json.dumps(profile, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")
    _require(len(payload) <= MAX_PAYLOAD, f"canonical profile is {len(payload)} bytes; maximum is {MAX_PAYLOAD}")
    return payload


def build_container(profile: dict, *, official: bool = False) -> bytes:
    validate_profile(profile, strict=official)
    payload = canonical_payload(profile)
    version = profile["format_version"]
    target_id = TARGET_IDS[profile["target"]["chip"]]
    origin = ORIGIN_OFFICIAL if official else ORIGIN_CUSTOM
    header = HEADER.pack(
        MAGIC, CONTAINER_VERSION, ENCODING_JSON, version["major"], version["minor"],
        target_id, origin, HEADER.size, len(payload), zlib.crc32(payload) & 0xFFFFFFFF,
        b"\0" * 12,
    )
    return header + payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", type=Path)
    parser.add_argument("--output", "-o", type=Path, help="write flashable .bin container")
    parser.add_argument("--official", action="store_true", help="treat warnings as errors and mark official")
    args = parser.parse_args()
    try:
        profile = _load_json(args.profile)
        warnings = validate_profile(profile, strict=args.official)
        for warning in warnings:
            print(f"warning: {warning}", file=sys.stderr)
        if args.output:
            data = build_container(profile, official=args.official)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_bytes(data)
            print(f"Wrote {args.output} ({len(data)} bytes)")
        else:
            print(f"Valid {profile['target']['chip']} profile: {profile['board']['name']} rev {profile['board']['revision']}")
        return 0
    except ProfileError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
