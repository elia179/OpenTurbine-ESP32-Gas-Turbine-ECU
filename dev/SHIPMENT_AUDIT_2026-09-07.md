# OpenTurbine 2.3.3 shipment audit — 2026-09-07

Status: release gates passed; this audit accompanies the pushed release-candidate branch.

## Verified release gates

- Full `tools/run_release_checks.py` passed after the loop/registry changes: 11 UI audits, 17 turbine configurations, native behavior, sensor protocol vectors, 31 HIL-contract tests, setup-tool tests, both firmware targets, and both LittleFS images.
- Classic and ESP32-S3 firmware compile successfully.
- Classic image fits its OTA slot with about 40 KiB remaining; static internal DRAM has about 19 KiB remaining.
- Classic JU4 live starter transition passed: 2.8% to 25.0%, no sampled interval below 100 Hz, original sequence restored, all outputs off.
- S3 OTBench role-reversed output check passed 5/5 for Classic servo, PWM, fuel solenoid, igniter, and starter-enable signals.
- Latest Classic boot: profile JU4, STANDBY, hardware ready, no hardware fault, approximately 386–393 Hz at idle.
- JU4 was exported before OTA. The channel registry and buzzer configuration were unchanged after reboot.

## Deep defects fixed locally

- Coalesced servo duty writes to the physical 50 Hz frame rate. Logical activation and every safe/off command remain immediate. This removes the multi-second 25 Hz loop windows during starter ramps.
- Generic PWM outputs skip redundant duty writes.
- Loop-rate telemetry now reports a one-second average instead of one arbitrary last period; worst period remains separately visible.
- Loop pacing recalculates the remaining sub-millisecond wait after yielding to FreeRTOS.
- ESP32 and ESP32-S3 PWM frequency/resolution validation now uses the correct target clock.
- Proportional starter-enable and air-starter outputs are included in LEDC channel budgeting.
- General MAX6675, MAX31855, and MAX31856 registry temperature channels now instantiate and sample real drivers instead of remaining permanently unhealthy.
- The passive buzzer now owns a reserved LEDC channel/timer and cannot retune a pump, starter, servo, or igniter timer.
- Uncalibrated native throttle/idle potentiometers accept the fail-safe 0 V endpoint but reject the high ADC rail, preventing a short-to-high throttle from being accepted as a healthy 100% command.
- Explicit reduced-power start can bypass one unavailable feedback-dependent startup confirmation while keeping every healthy threshold, unrelated interlock, output action, and timer authoritative. Closed-loop oil pressure remains non-overridable.
- Healthy zero-valued operator inputs use the normal dashboard text color; red is reserved for unhealthy feedback.

## Known limitations that fail safe or do not affect JU4

- Pre-save validation counts LEDC channels but not every target/order-specific timer-pair combination. An unusually diverse PWM layout can save, then fail an LEDC attach at boot. Firmware sets `hardware_ready=false` and inhibits START; JU4 uses only three compatible timer pairs.
- Up to two direct HX711 channels are supported. A read briefly masks interrupts (roughly 0.25 ms per ready sample); PCNT shaft-speed capture is hardware-backed, but very high-rate software-interrupt inputs should not share a heavily loaded HX711 arrangement without HIL validation.
- Many generic analog inputs sample on the same 10 ms boundary, so a maximum-size analog registry can create a small periodic latency burst. JU4's measured loop remains well above the 100 Hz shipment threshold.
- General SPI thermocouple runtime support is protocol/build verified but not physically exercised on the connected rig. Canonical JU4 MAX6675 TOT uses the established driver path.
- The loop diagnostic section breakdown omits some prelude/telemetry bookkeeping, so its named section values do not always sum to the reported whole-loop maximum. Control timing itself is measured correctly.

## Capacity warning for subsequent development

- Classic OTA flash headroom is now roughly 40 KiB and RTC slow-memory headroom is very small. Future features should be budget-checked on every change; this is not a current runtime fault.
