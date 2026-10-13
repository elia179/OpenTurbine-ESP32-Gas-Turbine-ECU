# 2.5.2 two-board regression — 2026-10-13

This is a dry regression of the 2.5.2 candidate approved by the user for
publication and promotion to the flasher default on 2026-10-13. It is not the
full hardware qualification described in `dev/bench/README.md`.

## Exact ECU images

ECU source: `37ea51900e75fddc2aada3acf74d6c9c9f1f1bdc`.

| DUT | Runtime build ID | Firmware SHA-256 |
| --- | --- | --- |
| Classic ESP32, 4 MB | `bb91cd6c6b85d9a5` | `bf8bfd1c85191bac8abdb2a5037b87943beffa3887558fd72f77474c19515e05` |
| ESP32-S3, PSRAM disabled | `a654abe9953b34ad` | `bdeecb1971fcc32cc61fc534a5ed0c8cb63187fdc25e986ec7b44ab44f64de53` |

The complete GitHub release-validation workflow passed for that source, with
publication skipped: [run 38416850626](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/38416850626).
The images were kept fixed throughout this regression. Subsequent edits concern
the bench firmware, campaigns and records, not the ECU.

## Completed checks

Classic is the primary target, using S3 as OTBench. The roles are reversed for
S3 coverage. See the sanitized JSON records in `dev/bench/results`.

- Classic browser session: 442 seconds, 22 navigations, Dashboard and all seven pages,
  two persisted saves, complete engine-file download and browser restore.
  No unexpected ECU reboot. Transient GET resets during planned reconnects
  recovered; these are recorded rather than suppressed.
- Classic firmware upload through the browser: 408 bounded chunks, successful
  reboot into the same candidate, original complete engine configuration retained.
- Classic pin/function campaign: 11/11, including frequency inputs, ADC endpoints,
  digital input, relay/PWM/servo outputs, Tools timeout and physical STOP.
- Classic turbojet, dual-shaft turboshaft and PWM-pitch turboprop: each reaches
  STARTUP and RUNNING with Bench Mode off; physical fuel, ignition and servo
  activity is captured, followed by physical STOP and fuel isolation.
- Classic final safety: 6/6, three N1 overspeed and three physical STOP runs,
  each started through the physical START input. Measured fuel shutoff,
  ignition and servo isolation pass every time; complete original file restored.
- Classic temperature protection: 3/3, hot-start block, dedicated startup EGT
  trip and running EGT trip. Each active trip cuts the measured fuel shutoff,
  ignition and servo after a verified positive-output baseline.
- Classic digital sensor campaign: 9/9, MAX6675/MAX31855/MAX31856 values and
  open-circuit health, HX711 positive/negative calibration and timeout health.
- Classic NAU7802: 3/3, discovery at 0x2A, analog startup delay, calibration on
  both channels, torque/thrust conversion from signed ADC counts.
- S3 browser session: 255 seconds, 17 navigations, Dashboard and all seven pages,
  two persisted saves, complete engine-file download and restore, no unexpected reboot.
- S3 web assets: all 12 uploaded, first/final chunk replay accepted, served gzip
  bytes match local assets, original engine configuration preserved.
- S3 turbojet, dual-shaft turboshaft and PWM-pitch turboprop: all three pass
  input sweeps, physical outputs, normal STARTUP/RUNNING and physical STOP.
- S3 hard-trip removal/repurposing/restoration: 9/9. Unavailable P1/P2/torque
  positive trip thresholds are cleared; configured inputs retain their limits.
  A complete engine-file restore reinstates the fitted sensors and thresholds.
- S3 protection campaign: 10/10, hot-start blocking, dedicated startup EGT
  limit, manual/automatic reduced-power cap, N1/N2 overspeed, running overtemperature,
  low oil, near-zero oil, flameout and physical STOP. Fuel cut paths verify the
  physical shutoff, ignition and main-fuel servo.
- S3 I2C: 14/14, TCA9554 input/output, safe return and reconnect, TLA2528
  calibrated ADC and disconnect health, NAU7802 startup/calibration and disconnect
  health, discovery and rejection of unfitted new assignments.
- S3 event-log download: 21,106 bytes containing 304 valid NDJSON events.
- Final Classic browser engine-file round-trip: 32,406 bytes downloaded and
  uploaded successfully. All 12 served gzip assets match local bytes. Final
  log download contains 757 valid NDJSON events in 49,993 bytes.

## Handoff state

Classic on COM3 is the DUT, running 2.5.2 build `bb91cd6c6b85d9a5`, in STANDBY
with outputs inactive and complete authoritative pre-test hardware/settings
restored. S3 on COM4 is OTBench 0.14. S3's own ECU configuration was restored
and verified before returning it to tester duty. Test clients are closed.

The curated evidence manifest is
`dev/bench/results/qualification_2.5.2_20261013.json`; it includes exact image
hashes, campaign-record hashes, browser results and remaining qualification limits.
The user approved publication after the local handoff. Publish the matched
2.5.2 package through the canonical GitHub release workflow and verify its
latest-release download before considering the flasher-default promotion complete.

## Fixture corrections and excluded attempts

These failures were investigated before rerunning; failed attempts are retained
locally under ignored `artifacts/hardware-test-2.5.2`, not counted as passes.

- S3 OTBench initially lacked the I2C emulator and subsequently returned a stale
  FIFO byte. It now fills its response inside `onRequest`; Classic retains its
  required FIFO preloading behavior. Classic NAU tests passed after correction.
- An inherited automatic-idle fuel mode and rules referenced devices removed
  by the temporary profile. The ECU correctly rejected those settings. Temporary
  profiles now explicitly select manual fuel mode and clear inherited rules.
- Campaign cleanup previously restored only selected settings. This could lose
  auxiliary rules or alter start counters. Cleanup now restores and compares
  the complete canonical engine file. Classic's authoritative backup was restored
  independently after discovering the earlier cleanup defect.
- The Windows client could retain an AP association with an APIPA address while
  repeatedly asking to connect. The harness now drops that stale association,
  allows DHCP time to recover, and preserves healthy custom-SSID connections.
  All 36 harness unit checks passed, including reconnect regression checks.
- Classic OTBench's MAX6675 emulator advanced on a rising clock edge, producing
  doubled temperatures on S3. OTBench 0.14 changes SO on the falling edge, as
  already required by the S3 emulator. Safety stimuli are checked before use.
- The first S3 safety attempt was interrupted during a lost DHCP connection
  after its temporary hardware profile had applied. Subsequent campaigns correctly
  restored that local snapshot, but the independent final comparison caught the
  difference from the authoritative pre-test backup. The authoritative engine
  file was then restored and its complete hardware/settings equality verified.
- The S3 I2C diagnostic serial thread stopped on a Windows stdout encoding
  error. All 14 API/physical checks and exact campaign restore still completed;
  the record marks serial capture incomplete. Subsequent runs use UTF-8 stdout.
- Initial Classic temperature attempts reached the expected protective trip but
  failed campaign recovery. The harness was waiting only for STANDBY while a
  protective shutdown correctly ended in latched FAULT. Recovery now waits for
  shutdown to settle, explicitly acknowledges the fault, and waits for that
  queued command to apply before another START. The final three-check run passes.

## Evidence limits

No fuel, rotating turbine, powered actuator loads, independent scope timing,
or 24-hour causal-plant soak was used. HTTP timestamps are not interrupt latency
measurements. Profiles use timed startup; these results do not qualify real
combustion confirmation, engine tuning or hot relight behavior.

The role-reversed fixture lacks a transport for Classic's starter PWM output,
and S3 has no DAC for a continuous Classic ADC sweep. Starter-enable is captured;
Classic ADC endpoint and servo/PWM tests do not replace powered-load checks.
Existing causal-plant wiring concerns remain outside this regression.

Before fueled commissioning, verify real sensor calibration/health, actuator
direction and safe positions, powered fuel isolation and emergency STOP on the
actual engine installation. Full release qualification remains a separate gate.
