# OpenTurbine 2.5.1 hardware-test record

Based on main c7cb1fe. Publication requires completed local hardware checks and the canonical GitHub release workflow; the flasher selects the latest stable release's matched recommended package.

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
- Large configuration reads can borrow the reserved transfer workspace if an owned heap snapshot allocation fails. Writes remain excluded until that response releases its lease.

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
These are not reported as local passes. The GitHub Windows runner executes the full required native and Go gates before publishing. Real Adafruit bridge accuracy, noise and physical excitation still require the tester's actual sensor board.

Verification run 38306419486 passed the complete canonical required gate, generated-asset check, Windows setup-tool build, matched package build, and version/checksum verification. Its artifact upload failed because the verification branch name contained a slash. Artifact names now use run ID and attempt; the tagged release must still complete its own full workflow before being considered live.

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
Classic also passed System page saves and Sequence output persistence with exact restoration, live warning navigation, and a ten-minute ordinary-browsing interval (707 seconds total, 39 navigations, two persisted saves, no unexpected reboot). That long run used build a8cb1bd69f6b62fb. A later read-response fallback rebuild, ec44a23e86186b8d, passed live warning navigation and a second 407-chunk browser OTA with exact configuration preservation. After the S3 role swap, that rebuild passed final complete-engine-file download/restore and page checks: 247 seconds, 11 navigations, two persisted saves, settings restored and no unexpected reboot during browsing. Classic was left as DUT and S3 as tester.

S3 DUT COM4 / Classic tester COM3 passed twelve web-file uploads (53 chunks), a 31,028-byte complete-engine-file round trip, CSV/NDJSON downloads, a 404-chunk browser OTA, and all five wired actuator paths (1,500 us fuel servo, full oil duty, shutoff, igniter and starter enable). Build b081c8b18065fb68 then passed a short browser session: 190 seconds total, 13 navigations, two persisted saves, settings restored, and no unexpected reboot. The original S3 engine file was restored before that session.

The focused physical I2C campaign passed 3/3: NAU discovery, correct analog startup and both-channel calibration, and raw 102,000 counts converted to 2 Nm torque and 4 N thrust. Result: `dev/bench/results/i2c_devices_hil_20261012_235739.json`. The Classic slave must preload its FIFO after receiving the addressed register; filling it only in onRequest delivered stale bytes. Correcting the tester preload allowed the unchanged ECU driver to pass. The focused sensor campaign also omits unrelated tool/controller fast-setting patches. Initial failed runs are retained in the local artifact logs.

Full flash backups for both chips and all serial/browser logs are under the ignored artifact directory. The wired emulator proves digital acquisition and conversion, not a physically loaded Adafruit bridge. The fixture does not provide independent powered-load or oscilloscope timing evidence.
