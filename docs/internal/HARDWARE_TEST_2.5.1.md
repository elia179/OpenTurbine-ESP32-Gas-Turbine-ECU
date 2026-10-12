# OpenTurbine 2.5.1 local hardware-test candidate

Based on main c7cb1fe, with local uncommitted changes. Hardware testing is now authorized and in progress. Nothing has been published.

## Images

Frozen images and SHA-256 manifest: `artifacts/hardware-test-2.5.1/`.
`dut-esp32dev` is Classic; `dut-esp32s3dev` is S3. Each includes firmware,
ELF, bootloader, partitions and LittleFS. `tester-otbench` is Classic;
`tester-otbench_s3` is S3. Tester version is 0.11. Both use platform 55.03.37.
Match chip type, flash size and board roles before uploading. Preserve the
existing engine configuration before replacing the LittleFS image.

## Changes under test

- NAU7802 internal 3.0 V excitation, ADC clock setup, digital power/reset sequencing,
  nonblocking 600 ms settling, AFE calibration for both assigned channels,
  initialization retries and stale conversion discard after switching channels.
- Actionable warning banners navigate to the relevant fields or diagnostics,
  reveal collapsed destinations and preserve unsaved edits during local navigation.
- Tester uses addressed NAU registers and validates setup/calibration instead
  of assuming a fixed request order. The focused NAU campaign now has its own
  correct result count; full I2C coverage includes an explicit startup check.
- Firmware version 2.5.1; asset cache 20261012a. Intentional save reboot retained.

## Bench sequence

1. Verify the physical jumpers and common ground against the appropriate pinmap.
   Use `dev/bench/pinmap.json` for S3 DUT / Classic tester, or
   `dev/bench/pinmap-classic-role-reversed.json` for Classic DUT / S3 tester.
   Identify current serial ports; historical COM3/COM4 defaults are not evidence.
2. Install the matching DUT, web assets and tester images. Confirm API firmware
   version 2.5.1 and its build_id against manifest.json. Keep connected real
   actuators isolated; use the existing protected signal fixture/dummy loads.
3. Run the existing bench smoke, startup/STOP, output and sensor campaigns.
   Qualification entrypoint: `dev/bench/harness/qualification.py`; its final
   release contract additionally requires a setup package, PCB profile and
   independent timing/powered-load evidence. This candidate is not release signoff.
4. For S3 DUT / Classic tester, run `dev/bench/campaign/i2c_devices_hil.py`
   with OTBENCH_PORT and OPENTURBINE_DUT_PORT set to verified ports. Set
   I2C_ONLY_NAU=1 for the focused three-check startup/calibration campaign;
   unset it for all fourteen I2C checks. Existing fixture repurposes START/STOP
   jumpers as SDA/SCL. Verify register-pointer callback timing on the real tester.
   The S3 tester currently has no I2CEMU command; do not run this campaign in
   the reverse role expecting an emulated NAU7802.
5. Test the actual Adafruit #4538 on Classic ESP32: 3.3 V supply/common ground,
   configured SDA/SCL, ACK at 0x2A, E+ approximately 3.0 V, A+/A- assigned
   to channel 1. Raw counts must change with applied load. Zero and known-load
   calibration must give correct units and sign; verify both channels if wired.
   Disconnect/stall acquisition and confirm readings become unhealthy; reconnect
   and verify recovery. Save, reconnect Wi-Fi, and confirm persistence after reboot.
6. Click P2 hard-trip and representative Hardware, Controllers, System and
   Dashboard warning links on the ECU; verify the intended field is revealed,
   keyboard activation works and local links preserve an unsaved edit.

## Local validation

Both DUT firmware and LittleFS images and both tester firmware images build.
Both DUT image/linker/filesystem budgets pass. The real-driver NAU behavioral
suite passes startup, retries, calibration errors/timeouts, signed force/torque,
both-channel calibration, stale sample rejection and freshness recovery.
Safety audit: 316 checks. Warning audit: 36 firmware labels and 16 inline routes.
HIL harness unit tests: 33 passing; native-runner unit tests: 7 passing.

The full native suite is incomplete: Windows Application Control (4551) blocks
feedback_control_behavior.exe and phase_registry.exe even after bounded retries.
These are not reported as passes. Physical testing and real bridge accuracy,
noise, excitation and slave callback timing remain unverified.

## Hardware run in progress (2026-10-12)

Classic DUT COM3 / S3 tester COM4 was identified from live API, serial PING and
esptool chip identity. The full Classic flash and complete engine file were
backed up in the artifact directory before installing the candidate.
Classic initially rejected a browser OTA from the pre-existing 2.5.0 image
after 257 acknowledged chunks. Its partition table matches the correct layout.
After USB installation, the 2.5.1 browser OTA passed all 407 chunks; the original
rejection is retained as an observation with no confirmed root cause. The OTA
rejection now exposes the flash error or offset mismatch and logs context.

Completed on Classic: twelve web files / 53 chunks with exact engine preservation;
engine-file browser round trip (32,406 bytes); invalid restore rejection without
Hardware changes; CSV and NDJSON log downloads; five physically measured output
paths; overspeed and physical STOP isolate fuel/ignition and park the fuel servo.
Further browser tests and the role swap are pending. Serial and test logs are
under the artifact directory, with detailed safety results in dev/bench/results.
