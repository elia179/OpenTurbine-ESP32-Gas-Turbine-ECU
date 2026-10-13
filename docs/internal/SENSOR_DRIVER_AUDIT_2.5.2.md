# Sensor driver audit for 2.5.2 (unreleased)

Reviewed on 2026-10-13 against the current driver implementations and manufacturer documentation. Version 2.5.1 remains the published flasher default. These changes are being prepared on the `fix/sensor-drivers-2.5.2` development branch.

## Confirmed fixes

| Device | Failure in 2.5.1 | Local 2.5.2 change |
| --- | --- | --- |
| TCA9554 | A rejected direction write could leave relay pins as inputs while later latch writes still ACKed. A peripheral-only reset could do the same indefinitely during RUNNING, when discovery is disabled. Retained polarity could reverse digital inputs. | Retry incomplete setup before accepting demands; program safe latch before direction and clear polarity. A 256 ms readback heartbeat checks direction, polarity, and latch. Failed verification makes the output unavailable until configuration is restored. |
| TLA2528 | The driver assumed power-on analog/manual/no-averaging output settings and accepted every two-byte frame as the requested channel. Retained GPIO/averaging/sequencer settings could invalidate interpretation. | Explicitly configure analog/manual/no averaging and append channel IDs. Reject a mismatched ID, hold the pending channel for a bounded retry, and restore the output format if it is lost. |
| MAX31856 | A successful setup retry reused the boot settling timestamp, permitting a healthy-looking reset 0 C after only 120 ms. Filter/type writes could occur with conversions running. Peripheral configuration loss was not detected. | Stop conversions before setting filter/type; start a new 250 ms settling interval on each successful setup. Check CR0/CR1 and reconfigure if lost. |
| MAX31855 / shared SPI | The first read could work but leave SCLK HIGH. On the next read its first falling edge shifted out D31 before sampling, doubling positive temperature readings or shifting fault bits. Shared mode-3 clocks had the same issue. | Sample MAX31855 on rising edges; restore the required idle level before asserting each CS. MAX31856 explicitly restores mode-3 idle HIGH. Wait 200 ms before the first MAX31855 read. |
| DS18B20 | Nine zero bytes have a valid zero CRC and were accepted as 0 C. A discovered sensor was permanently discarded after a transient resolution-setup failure. Peripheral reset could restore 12-bit mode while the driver used its shorter requested conversion timer. | Validate the scratchpad configuration signature, retain the cached ROM after failed setup, wait conservatively until resolution is verified, and restore the requested resolution after configuration loss. Start the deadline after the conversion command finishes. |

These are protocol/configuration and recovery fixes; engine sequencing and RUNNING controller behavior are not changed.

The surrounding calibration review also found that HX711/NAU7802 zero offsets were not constrained to signed 24-bit ADC counts. A malformed file could make `raw - zero` overflow a 32-bit signed integer on the ESP32. Registry validation now rejects such offsets; legacy HX711 settings use the same bounds. Mismatched NAU7802 gain/rate settings now return an actionable validation error instead of an empty generic rejection.

TLA2528 settings also accepted reversed/out-of-ADC raw ranges and unbounded conversion parameters. Match the native ADC's raw bounds and voltage-divider limits, and reject nonfinite offsets/scales. This prevents a valid chip being rendered permanently unhealthy by a saved range it can never satisfy.

The load-cell calibration wizard now requires a connected, healthy signed 24-bit sample. It rejects missing raw data rather than treating null as zero, clears the captured zero when the channel changes or disappears, and rejects nonfinite calibration scales. Browser regressions cover faulted/disconnected samples and channel replacement.

The HX711 scale instructions now divide known Nm by (loaded count minus zero count), rather than the loaded count alone. Calibration shows torque/thrust health and faults the torque bar when unhealthy.

The broader UI review also rejects missing/disconnected readings during ADC, phase and throttle calibration, hides uninstalled analog switches, displays missing ADC data as unavailable, and restores switch capture controls after errors. Throttle/idle RC captures accept only the native driver's 500–2500 µs pulse range, so signal-loss zero cannot become an endpoint. A regression verifies valid pulses, signal loss and legitimate zero ADC counts.

ADC calibration does not require an already-correct calibrated physical value; it accepts connected raw counts so calibration can repair invalid scaling.

## Other drivers reviewed

- **MAX6675:** user-proven working; its driver and sampling mode are unchanged. Its shared SPI helper now explicitly restores the same idle LOW before CS, protecting it from other SPI modes on shared lines.
- **MAX31855:** frame width, signed temperature, fault flag, range, software clock and disconnected pull-up reviewed; the repeated-read/shared-clock defect above is fixed.
- **HX711:** 24-bit signed read, 25-clock channel A/gain 128 selection, interrupt-protected clock timing, startup settling, saturation and stale-sample handling reviewed. Clear the median history on stale/saturated faults so a recovered sensor cannot publish its old load as the first fresh sample.
- **NAU7802:** retain the 2.5.1 fixes and run the existing actual-driver regression for power/settling/calibration, both channels, stale conversion rejection and retry.
- **Native analog/NTC:** ADC resolution/attenuation, divider orientation, calibration, rail checks and platform pin restrictions reviewed. No comparable chip setup defect found.
- **PCNT RPM / MCPWM phase capture:** initialization error handling, capture timing, wrap arithmetic and loss handling reviewed. Existing behavior/math tests cover the supported configuration. No comparable device startup defect found.

## Verification and limits

New native tests include the actual `I2CDeviceManager`, `MAX31856TempSensor`, `MAX31855TempSensor`, `MAX6675TempSensor`, `DS18B20TempSensor` and `HX711Sensor` headers, with register/GPIO/OneWire models. They exercise failed setup, peripheral reset, alternate ADC channels, fault recovery, stuck-low scratchpads, and a genuine 85 C reading. They are part of the normal required native gate, rather than only testing a copied decoder.

The local NAU7802 regression ran successfully. Windows Application Control blocked the new local native executables (WinError 4551), so execution was verified by [development-branch GitHub run 38347513857](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/38347513857): all actual-driver models, the complete canonical gate, both firmware/filesystem targets, budgets and package validation passed. The final combined [GitHub run 38350093119](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/38350093119) also passed at code commit `f9b6c32ee623fd65ee5529dec2f529353da0d49f`, including all 18 browser audit programs, all 316 safety checks, native driver models, both target builds/budgets and package validation. Generated assets matched the committed files. Publication was skipped; v2.5.1 remains the live release. This verification-note update changes documentation only. Local Classic/S3 ECU and tester 0.12 builds pass. No release tag or publication is authorized for this future update.

No physical TCA9554, TLA2528, MAX31856, DS18B20, or HX711 module is attached to this bench. Datasheet review and protocol models cannot establish real breakout-board wiring, excitation, electrical noise or calibration accuracy. A DS18B20 absent during initial ROM discovery still requires a reboot after connection; runtime discovery is deliberately avoided because a ROM search can block the ECU loop. Parasite-powered DS18B20 operation remains unsupported and requires external VDD. MAX31855/HX711 cannot distinguish every possible wiring failure from a valid zero reading.

## Follow-up UI review

RC signal loss after calibration publishes the saved minimum pulse width, not necessarily zero. The browser now requires `rc_throttle_valid` / `rc_idle_valid` before capturing receiver endpoints. Focused browser regressions reject plausible 1000/1200 µs fallback values with invalid flags, while accepting healthy 1500 µs pulses and zero ADC counts. These follow-up UI changes pass the calibration browser regression and all 316 safety checks; the full GitHub result above refers to the preceding `f9b6c32` code commit. No firmware driver changed in this follow-up.

## Guided force calibration follow-up

Calibration now provides a zero/known-load wizard for HX711 torque and analog thrust on native ADC or TLA2528 channels. The existing NAU7802 wizard shares the same unit conversion and capture controls.

HX711 requires the perpendicular lever arm explicitly and saves `hx711_zero` plus torque in Nm/count as `hx711_scale`. The existing positive-scale firmware bounds remain enforced; a falling HX711 signal gives an actionable load-direction/bridge-wiring message. Raw captures require a connected, healthy signed 24-bit sample.

Analog thrust saves an ascending raw-count curve spanning 0–4095, extrapolated from the zero and known-load captures. This supports rising or falling voltage and prevents the firmware's piecewise curve clamp from clipping force at the known reference load. Connected valid raw ADC readings can repair an unhealthy existing calibration. TLA2528 voltage displays use the configured reference voltage.

The new real-browser audit clicks the controls, verifies HTTP persistence and reload, rejects a missing HX711 lever arm and invalid/unhealthy samples, checks both analog polarities and loads above the known reference, exercises mobile layout, and preserves signed NAU7802 calibration behavior. Full development-branch verification is recorded below when complete. No sensor-board accuracy is implied by these browser tests.

Local verification passed all 19 browser audit programs (the full runner passed its first 18; the final smoke test passed after its RC fixture was updated to provide the required receiver-valid flag), all 316 safety checks, public-content validation, and Classic/S3 filesystem builds and budgets. The mobile HX711 form was visually inspected. The extra generated Calibration payload is approximately 270 compressed bytes.

## TLA2528 calibration reference follow-up

The firmware already uses the configured TLA2528 reference, but older Calibration controls converted counts with a fixed 3300 mV. This made a 5 V ADC display incorrect voltages and caused entered voltage thresholds and datasheet values to save the wrong raw counts or sensitivity. Registry calibration now resolves the selected channel's ADC reference for voltage displays/conversions, threshold input limits, P1/P2 factory voltage values, pressure/flow defaults, oil datasheet sensitivity, battery divider and analog torque scale. The native ADC still uses 3300 mV. Legacy actuator-current controls retain their native ADC path.

The browser audit now exercises actual 5 V TLA switch/flame saves, a 0.5–4.5 V pressure sensor, battery divider and analog torque coefficients, plus oil datasheet slope and native-reference invariance. The I2C source audit was updated for the shared HX711/NAU/analog wizard; its former literal NAU-only heading no longer exists.

At code commit `2c0ea64`, the complete local runner passes all 19 UI audit programs, alongside 316 safety checks, the I2C/load-cell source audit, public-content validation, and both filesystem builds/budgets. The final full build/package gate is [GitHub run 38355718672](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/38355718672); its result was still pending when this note was written. The preceding run failed only the obsolete NAU-only heading assertion, which is corrected in this commit. No firmware source was changed by the calibration wizard/reference follow-ups.

## Hardware and fuel-flow UI follow-up

The wider UI review found Hardware's analog zero-offset editor still capped TLA2528 values at 3300 mV even with a 5 V reference. Its generated source modules now use the channel reference for both the input limit and edit handler. The browser regression dispatches the actual editor input event and verifies 4000 mV is retained, 5501 mV is limited to 5000 mV, and a native ADC retains its 3300 mV limit.

Calibration's initial fuel-flow visibility and telemetry fallback recognized only native analog driver 1, although the firmware supports TLA2528 driver 9 as analog fuel flow. Both now recognize drivers 1 and 9; pulse flow stays outside the voltage-calibration wizard. The focused browser audit verifies this before relying on a telemetry type field.

## Sources

- [TI TCA9554 datasheet](https://www.ti.com/lit/ds/symlink/tca9554.pdf)
- [TI TLA2528 datasheet](https://www.ti.com/lit/ds/symlink/tla2528.pdf), sections 7.3.9, 7.4.2 and 7.6
- [Analog Devices MAX31856 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/max31856.pdf), conversion timing, SPI interface and CR0/CR1
- [Analog Devices DS18B20 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ds18b20.pdf), scratchpad and resolution/conversion timing
- [Analog Devices MAX31855 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX31855.pdf)
- [Avia HX711 datasheet distributed by SparkFun](https://cdn.sparkfun.com/datasheets/Sensors/ForceFlex/hx711_english.pdf)
