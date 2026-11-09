# NAU7802 acquisition and calibration review

Review date: 2026-11-09. Development branch: 2.7.1.

## Report and limits

A tester using 2.6.0 reported roughly −170 N unloaded after zero/200 N
calibration. Another, unidentified version reportedly zeroed correctly, then
decreased below zero before increasing under additional load. No engine file,
raw-count trace, module schematic or physical bridge is available.

These are different observations. A wrong tare can explain a shifted straight
line; a decrease followed by an increase cannot come from a fixed affine
conversion applied to monotonic raw counts. Check acquisition, changing
calibration/channel identity, and the physical measurement separately.

An ESP I2C slave tests digital transactions, signed decoding, saved coefficients,
scheduling, telemetry and recovery. It cannot qualify the NAU analog front end,
bridge wiring, excitation, interference or mechanical mounting.

## Primary references

- [Nuvoton NAU7802 datasheet, revision 2.6](https://www.nuvoton.com/export/resource-files/en-us--DS_NAU7802_DataSheet_EN_Rev2.6.pdf):
  sections 1.2, 1.8–1.12, 1.14, 2.1–2.4 and 4.1–4.16.
- [Adafruit driver](https://github.com/adafruit/Adafruit_NAU7802/blob/master/Adafruit_NAU7802.cpp).
- [SparkFun driver](https://github.com/sparkfun/SparkFun_Qwiic_Scale_NAU7802_Arduino_Library/blob/main/src/SparkFun_Qwiic_Scale_NAU7802_Arduino_Library.cpp).

The datasheet specifies a latched three-byte result starting at 0x12; a new
conversion cannot tear those bytes. Internal calibration disconnects the external
inputs, so calibration under an applied reference load is not an external tare.
Its LDO load limit is 10 mA and required voltage headroom is 0.3 V. Differential
full scale is ±0.5 × reference/gain. Input common-mode range also matters.
The optional PGA capacitor occupies channel-2 input pins; it is not a setting
to enable blindly when both bridge channels are used.

SparkFun also uses a STOP between register-pointer write and read. Our STOP-based
transaction is therefore not, by itself, evidence of a protocol failure.

## Implementation audit

The following are observations of OpenTurbine source, checked against the
references above, rather than evidence from the tester's physical sensor:

| Path | Current implementation / outcome |
|---|---|
| Address | Fixed 0x2A; explicitly assigned registry input |
| Reset | RR asserted, released on a later loop tick |
| Power | Digital ready polled before configuration; bounded timeout |
| Excitation | CTRL1 LDO code 5; PU_CTRL internal-LDO selection |
| Gain | User gain encoded from 1 through 128 |
| Rate | 10/20/40/80/320 SPS encoded as 0/1/2/3/7 |
| ADC setup | 0x15 = 0x30; 0x1B = 0; normal bridge path |
| PGA capacitor | Left at reset default; both input channels remain available |
| Settling | Nonblocking 600 ms before internal calibration |
| Calibration | CALMOD 0; CALS polled; timeout and CAL_ERR rejected |
| Two channels | Each assigned channel calibrated; shared gain/rate validated |
| Sample readiness | PU_CTRL CR checked before reading |
| Result | One three-byte read from 0x12; explicit MSB/middle/LSB reads |
| Sign | Signed 24-bit counts decoded before tare subtraction |
| Force | `(raw - loadcell_zero) * loadcell_n_per_count` |
| Torque | Calibrated force multiplied by perpendicular lever arm |
| Bounds | Near-rail raw samples invalidated before filtering |
| Filtering | Invalid/stale samples excluded; recovery seeds a fresh value |
| Channel scheduling | Pending-channel lock; first post-switch sample discarded |
| Save | Calibration-only PATCH, registry validation and persisted JSON |
| ADC-only reset | Detect lost power/conversion configuration; invalidate and initialize again |

The previous expression combined three `Wire.read()` calls with bitwise OR.
C++ does not prescribe operand evaluation order there. Separate statements remove
that ambiguity. Published 2.6.0 on the S3 nevertheless passed physical digital
load sweeps; the change is not a proven diagnosis of the original report.

The ADC-only reset regression is distinct: a still-acknowledging reset ADC could
previously remain unconfigured indefinitely. A native failing test demonstrates
the missing recovery. The new path checks the configured power/conversion bits.

Channel switching has analog/filter settling behavior beyond the emulator's
previous-channel sample model. Independent physical bridge measurements remain
necessary to qualify the real chip during multiplexing.

## Electrical and setup checks still requiring the tester

- Check load-cell terminal identification against the exact module and bridge;
  cable colors alone are insufficient evidence.
- Measure excitation and both signal wires unloaded and under load. A usable
  differential voltage alone does not establish usable common-mode voltage.
- Calculate excitation load. At our selected 3.0 V, one 350-ohm bridge draws
  approximately 8.6 mA; two in parallel draw approximately 17.1 mA. A 120-ohm
  bridge draws approximately 25 mA. These are illustrative circuit calculations,
  not a claim about the tester's unknown sensor.
- Check raw-count progression before changing calibration. A monotonic raw
  sequence and fixed coefficients must yield a monotonic converted force.
- Record unloaded raw counts before and after the reference load. A changed
  mechanical zero, wrong capture, shifted excitation, or different active channel
  must be distinguished from byte corruption.
- Inspect mounting, cable strain and repeatability in both directions. A sensor
  can be correct at its chosen reference while the complete stand is not linear.
- Repeat with other high-current/ignition equipment inactive to isolate coupling.

## Regression assets

`dev/host/i2c_loadcell_behavior.cpp` exercises the real manager and registry JSON
at byte carries, signed zero, both calibration polarities, loading/unloading,
saturation, reset and save/restart. Its compile-time guard rejects NDEBUG.

OTBench 0.15 adds `NAURAW <CH1> [CH2]` without resetting registers, per-rate
conversion-ready timing, consumed conversions, distinct channel values, an old
sample after switching, and `NAURESET` for ADC-only reset injection.

`dev/bench/campaign/nau_linearity_hil.py` drives the physical I2C wires and the
real ECU API. `--rates` checks every supported rate; `--adc-reset` checks recovery;
`--reset-only` isolates the reset regression. It checks raw counts as well as
force/torque, changes stimulus after reset to exclude cached telemetry, and
reports configuration restoration separately from measurement assertions.

Capture exact firmware identity and result JSON under
`artifacts/nau-investigation-20261109/`. Full flash backups of both boards precede
all temporary firmware changes. A migrated 2.6.0 setup is normalized before
current-firmware restore comparisons; additions from migration must not be
mistaken for a successful exact restoration.
