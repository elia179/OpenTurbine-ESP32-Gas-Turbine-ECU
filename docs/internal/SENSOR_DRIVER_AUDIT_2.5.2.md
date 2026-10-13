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

The broader UI review also rejects missing/disconnected readings during ADC, phase and throttle calibration, hides uninstalled analog switches, displays missing ADC data as unavailable, and restores switch capture controls after errors. ADC calibration does not require an already-correct calibrated physical value; it accepts connected raw counts so calibration can repair invalid scaling.

## Other drivers reviewed

- **MAX6675:** user-proven working; its driver and sampling mode are unchanged. Its shared SPI helper now explicitly restores the same idle LOW before CS, protecting it from other SPI modes on shared lines.
- **MAX31855:** frame width, signed temperature, fault flag, range, software clock and disconnected pull-up reviewed; the repeated-read/shared-clock defect above is fixed.
- **HX711:** 24-bit signed read, 25-clock channel A/gain 128 selection, interrupt-protected clock timing, startup settling, saturation and stale-sample handling reviewed. Clear the median history on stale/saturated faults so a recovered sensor cannot publish its old load as the first fresh sample.
- **NAU7802:** retain the 2.5.1 fixes and run the existing actual-driver regression for power/settling/calibration, both channels, stale conversion rejection and retry.
- **Native analog/NTC:** ADC resolution/attenuation, divider orientation, calibration, rail checks and platform pin restrictions reviewed. No comparable chip setup defect found.
- **PCNT RPM / MCPWM phase capture:** initialization error handling, capture timing, wrap arithmetic and loss handling reviewed. Existing behavior/math tests cover the supported configuration. No comparable device startup defect found.

## Verification and limits

New native tests include the actual `I2CDeviceManager`, `MAX31856TempSensor` and `DS18B20TempSensor` headers, with register/GPIO/OneWire models. They exercise failed setup, peripheral reset, alternate ADC channels, fault recovery, stuck-low scratchpads, and a genuine 85 C reading. They are part of the normal required native gate, rather than only testing a copied decoder.

The local NAU7802 regression ran successfully. New native test sources compile locally, but Windows Application Control blocked the new executables (WinError 4551); their execution must be confirmed by the development-branch GitHub check. Local Classic/S3 firmware builds and size budgets are checked separately. No release tag or publication is authorized for this future update.

No physical TCA9554, TLA2528, MAX31856, DS18B20, or HX711 module is attached to this bench. Datasheet review and protocol models cannot establish real breakout-board wiring, excitation, electrical noise or calibration accuracy. A DS18B20 absent during initial ROM discovery still requires a reboot after connection; runtime discovery is deliberately avoided because a ROM search can block the ECU loop. Parasite-powered DS18B20 operation remains unsupported and requires external VDD. MAX31855/HX711 cannot distinguish every possible wiring failure from a valid zero reading.

## Sources

- [TI TCA9554 datasheet](https://www.ti.com/lit/ds/symlink/tca9554.pdf)
- [TI TLA2528 datasheet](https://www.ti.com/lit/ds/symlink/tla2528.pdf), sections 7.3.9, 7.4.2 and 7.6
- [Analog Devices MAX31856 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/max31856.pdf), conversion timing, SPI interface and CR0/CR1
- [Analog Devices DS18B20 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ds18b20.pdf), scratchpad and resolution/conversion timing
- [Analog Devices MAX31855 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX31855.pdf)
- [Avia HX711 datasheet distributed by SparkFun](https://cdn.sparkfun.com/datasheets/Sensors/ForceFlex/hx711_english.pdf)
