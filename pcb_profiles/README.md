# OpenTurbine PCB profile authoring

A PCB profile is a chip-specific, immutable description of hardware soldered to
an ECU board. It is selected by the Windows setup tool during a USB clean
install. It is not an engine configuration and cannot be edited from the web
interface.

If no profile is flashed, OpenTurbine retains the full generic development-board
GPIO workflow.

## Profile offered by the installer

The only bundled official choice is [OpenTurbine PCB revision 1.0-20261028](official/openturbine-s3-20261028.md), for the supplied ESP32-S3-WROOM-1-N8 routing. It requires OpenTurbine 2.6.1 or newer. Plain development boards still work without a profile; Custom PCB profile remains available.

`tools/build_setup_package.py` lists the shipped profile explicitly. The older `openturbine-ecu-s3-v1.otpcb.json` is retained for historical compatibility tests and is not included in the installer. Do not choose a profile from a similar-looking board: connector routing, voltage conditioning and output-enable polarity can differ.

## Start a profile

1. Copy `examples/esp32s3-example.otpcb.json`.
2. Set `target.chip` to `esp32` or `esp32-s3`.
3. Give the board and revision stable lowercase IDs. Changing physical routing
   requires a new revision.
4. Describe fixed buses and devices.
5. Describe each user-facing physical connection as one port with one or more
   electrical modes.
6. Validate it with the target catalog:

```powershell
python -X utf8 tools/pcb_profile.py pcb_profiles/examples/esp32s3-example.otpcb.json
```

To build a test container:

```powershell
python -X utf8 tools/pcb_profile.py my-board.otpcb.json --output my-board.bin
```

The setup tool accepts the JSON source file and builds this container itself.
Do not ask end users to flash the `.bin` manually.

## Mental model

- A **bus** owns fixed I2C, SPI, UART, or OneWire routing.
- A **device** is a fitted chip on a bus, or a chip with a fixed select GPIO.
- A **port** is one physical connector/channel the user recognizes.
- A **mode** says which firmware adapter can use that port.
- An engine **purpose** such as TOT, N1, idle input, or oil pump is selected by
  the end user and is not hard-coded into the PCB profile.

A multipurpose physical input can declare several modes over the same endpoint:

```json
{
  "id": "signal_input_1",
  "label": "Servo / pulse input 1",
  "connector": "J7",
  "modes": [
    {"id": "rc", "adapter": "rc_pwm_input", "endpoint": {"gpio": 16}},
    {"id": "frequency", "adapter": "pcnt_input", "endpoint": {"gpio": 16}},
    {"id": "switch", "adapter": "digital_input", "endpoint": {"gpio": 16}, "pull": "up"}
  ]
}
```

Once the user assigns the port, the whole physical port is reserved regardless
of which mode is selected.

## Supported adapters

Inputs:

- `digital_input`
- `analog_input`
- `pcnt_input`
- `rc_pwm_input`
- `pwm_duty_input`
- `spi_thermocouple`
- `onewire_temperature`
- `i2c_digital_input`
- `i2c_adc_input`
- `i2c_adc_digital_input`
- `i2c_load_cell`

Outputs:

- `digital_output`
- `relay_output`
- `pwm_output`
- `servo_output`
- `i2c_digital_output`

Unknown adapters are retained so a newer firmware can use them, but the current
firmware will not offer that mode.

Supported fitted I2C drivers currently include `tca9554`, `tla2528`, and
`nau7802`. An expected device that is absent at runtime is a PCB hardware fault.
Its ports remain visible for diagnosis but cannot be newly assigned.

## Fixed functions

`fixed_functions` can define:

- a GPIO or NeoPixel status LED;
- a buzzer;
- a global servo-output buffer enable;
- a fixed supply-voltage monitor;
- a cluster UART bus;
- a MAVLink UART bus.

These functions own their physical routing. The web UI exposes only operational
choices such as colours, baud rate, and update interval where applicable.

### 2.6.1 profile additions

The 28 October 2026 board uses `official/openturbine-s3-20261028.otpcb.json`;
see its adjacent routing/assembly note. It requires an **ESP32-S3-WROOM-1-N8**,
not N8R8. It is distinct from the older official S3 board profile.

S3 profiles can define a separate native GPIO `fault_led` and a native GPIO
`output_enable` (active polarity required, safe demand zero). On S3, fixed
`status_led` / `fault_led` may instead specify `device`, `channel` and
`active_high` on a TCA9534/TCA9554. Native digital/pulse input modes may
specify `pull_control` with the same endpoint fields to switch a physical
external pull-up. These control channels are reserved and cannot also be
assigned as ordinary user ports. Expander-backed indicators/pull controls
are S3 capabilities; Classic retains its configurable GPIO indicators and existing
format 1.0 PCB profiles. Format 1.1 profiles require S3 firmware.

## Output safety

Every output mode requires `safe_demand` from 0 to 1. Fixed LED and buzzer
functions require zero. Native relay/digital outputs are parked at the declared
physical safe level before filesystem or engine configuration loading.
PWM/servo pins are held at their inactive static level until their driver owns
the pin; no waveform is emitted early. I2C output latches are set safely by the
device manager before direction changes.

All modes sharing one native output GPIO must produce the same physical boot-safe
level. The validator rejects disagreement.

Profiles cannot make reset or bootloader time electrically safe. PCB designs
must include pull resistors and driver enable circuitry that keep fuel,
ignition, starter, and other dangerous loads off while the ESP32 pins are
high-impedance.

## Validation policy

The source validator, setup tool, and firmware reject:

- a wrong ESP32 target;
- invalid or output-incapable GPIO use;
- missing IDs/references or duplicate stable IDs;
- separate ports claiming one exclusive GPIO/device channel;
- buses, chip-selects, fixed outputs, and ports colliding;
- invalid bus pin sets;
- outputs without safe demand;
- over-limit payloads/catalogs.

Custom profiles receive warnings for boot-strapping GPIOs and can continue after
review. Official profiles are strict: every warning is a release error. An
official board may list physically reviewed strap pins in
`target.reviewed_strapping_gpio`; this records a deliberate PCB-level review
rather than silently suppressing the check.

The profile source limits are 8 buses, 24 devices, 48 ports, 4 modes per port,
and a 24 KiB canonical JSON payload.

## Official profiles

Place reviewed profiles in `pcb_profiles/official/`. The release-package builder
validates them strictly, creates flash containers, hashes them, and adds only
chip-compatible choices to the setup tool.

The official OpenTurbine ECU profile is derived from its PCB project and records
its connector capabilities, fitted buses/devices, fixed supply monitor, and
output-buffer safety control.

The complete architecture and test contract are documented in
[`dev/PCB_PROFILE_DESIGN.md`](../dev/PCB_PROFILE_DESIGN.md).

## Preview the latest PCB in the ECU interface

Run `node tools/preview_latest_pcb.cjs` from the repository root and open
`http://127.0.0.1:8792/hardware.html`. This is a local simulation using the shipped
profile, with devices assumed fitted. It does not connect to a physical ECU or
qualify the assembled board. Stop the process when finished.

The blank preview shows the profile revision and its 32 labelled connections.
Use the usual Add input/output list, then choose the compatible PCB connection.
The main labels match the PCB: Thermocouple 1–2, Input 1–6, OUT 1–6,
PWM 1–6, Start, Stop and ADC 1–8; J18 extensions remain available too.
Add an engine purpose, then choose a compatible connector under **Connected to**.
For example, N1 can use **Input 1 · J28**, temperature **Thermocouple 1 · J43**,
and pressure **ADC 1 · J20**. Names, sensor calibration and supported
operating choices remain editable. GPIO routing and fitted buses are fixed.
Start/Stop must be assigned before commissioning. Status and Fault LEDs are
built-in indicators; the Fault LED owns fault blinking separately.

`node tools/ui_latest_pcb_audit.cjs` checks source and packaged UI in Chromium,
Firefox and WebKit. `OT_PCB_PREVIEW` optionally saves focused preview images.

On OpenTurbine PCB v1, **PWM 1–6 switch VIN loads** (PWM or on/off); **OUT 1–6 are 5 V signal outputs** (servo/ESC, PWM or on/off).
