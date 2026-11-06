# OpenTurbine 2.7.0 release qualification

Date: 6 November 2026. Setup Tool 0.7.9. This record supplements the
[development worksheet](QUALIFICATION_2.6.1.md), which retains the earlier
hardware-fixture and development evidence.

## Scope

The attached hardware is an unloaded two-board OTBench fixture: Classic ESP32
and ESP32-S3 development boards. No engine loads or assembled OpenTurbine PCB
are attached. The S3 uses OpenTurbine PCB v1.0, profile
`openturbine-s3-20261102`, revision `1.0-20261105`. Firmware is built for 8 MB
flash without requiring PSRAM. Plain development boards need no PCB profile.

Real-board browser sessions exercise navigation, settings save and reversal,
complete engine-file backup/restore, and firmware OTA through the System page.
Read-only Chromium/Firefox/WebKit checks cover desktop, landscape tablet and
phone layouts. Original engine files are compared after restoration. Private
engine files, full flash backups, serial identifiers and Wi-Fi credentials are
excluded from the public qualification record.

## Problems found before publication

- Persistent missing-PCB output-stage faults repeatedly entered shutdown and
  flooded the event log. A per-episode notification latch keeps the first fault
  immediate and rearms after recovery/acknowledgement. The native regression
  exercises 24,000 checks; live S3 boot capture confirms bounded notifications.
- A legal large S3 engine restore exhausted memory and reported invalid JSON.
  Restore now lends idle transfer buffers on both targets, streams settings
  parsing and distinguishes memory errors from malformed input. Committed
  configuration stayed unchanged on the rejected restore.
- Large initial telemetry exceeded its general response buffer. Large snapshots
  now use complete owned replies instead of truncating them. S3 builds its
  temporary tree in the reserved transmit workspace plus checked heap fallback,
  then retains only serialized bytes during TCP transfer. Borrowed
  strings from the temporary EngineData snapshot are copied before asynchronous
  transmission. The pinned-ArduinoJson host test checks nested/array/empty
  strings after the original stack data is overwritten and the document moves.

- Concurrent large hardware/telemetry replies exhausted the S3 heap during the
  final rich-configuration soak. Request admission now protects both targets,
  serializes expensive replies and releases their JSON storage at the last
  copied chunk or cancellation. A radio-mode A/B did not solve the failure and
  was discarded; production retains its normal Wi-Fi modes.
- Snapshot contention previously closed otherwise healthy browser connections.
  Expensive reads now receive a retryable response while smaller live reads and
  device discovery remain available. Actual low-memory protection stays active.
- The fixture reconnect helper repeatedly rejoined an already connected access
  point while waiting for reboot settling. It now checks the exact current SSID
  before requesting a join; this avoids interrupting its own verification.

- Hardware save still looked for the old Status LED purpose and incorrectly
  asked for a GPIO when the indicator used its PCB expander connector. The
  validator recognizes the named assignment, with a save-review regression.
- The browser fetch wrapper detached caller timeouts at POST response headers.
  A stalled acknowledgement body could then wait indefinitely. JSON mutation
  acknowledgements and CSV/binary API downloads retain the abort relationship
  until the complete body is read; three-browser stalled-body tests cover it.

- A metadata read waiting behind another large response did not settle when
  its own browser timeout expired. Queued reads now reject cancellation
  promptly while retaining single-flight transmission. A stalled-head / cancelled-tail
  regression covers both direct fetch and the metadata helper in source and
  compressed assets on Chromium, Firefox and WebKit, including queue recovery.

## Evidence boundaries

Earlier fixture tests cover MCU PWM/servo behavior, simulated driver replies,
input health, indicators, dry engine profiles, STOP and loop-stall behavior as
recorded in the development worksheet. They do not establish real MOSFET
switching, all-carrier phase/skew, load current, thermal margins, external
watchdog latch behavior or live-engine safety. Those require the assembled PCB
and appropriate instruments. The official profile is the sole supported
routing, with prototype electrical qualification explicitly still outstanding.

Windows Application Control blocked some earlier freshly compiled test
programs with WinError 4551. No Windows security settings were changed. The
final fresh run executed all 35 C++ behavior programs as Windows-native
executables. The PCB backend assertions were additionally checked as a
single-threaded WASI build under the installed Node runtime, including an
intentional assertion-failure negative control; the final native run did not
need that alternative.

The fresh Setup Tool executable created its initial window and responded to
the message-loop probe; no install action was invoked by that smoke check.
The standard release workflow retains its native Windows checks and must run
after owner approval to push, before publication.

## Final local results

| Check | Result |
|---|---|
| Browser UI programs | 62 passed on the final web generation |
| Safety assertions / C++ behavior programs | 322 / 35 passed (35 Windows native; 0 portable WASI) |
| Firmware, LittleFS and memory/partition budgets | Both targets passed |
| Classic live soak | 1003 seconds, 57 page changes, 2 persisted edits; original restored |
| S3 PCB-profile stress soak | 970 seconds, 62 page changes, 2 persisted edits; original restored |
| Live browser matrix | 72 cases per target; Chromium, Firefox, WebKit at three sizes |
| Web files / fullscreen / reverted edits / event exports | Passed on both targets |
| Archived session CSV | 15 rows, 8 columns downloaded and parsed on Classic |
| Local installer package | Matched firmware/web assets, sole current profile, checksums passed |
| Fresh Windows setup-tool window | Created and responsive; no install action invoked |

Classic build: `409d421bfbaf9534`. S3 build: `b0767a92296e45d1`.
Web revision: `20261106d`. Both original engine files were restored exactly.
Transparent transport retries are counted in the [machine-readable record](../../dev/bench/results/qualification_2.7.0_20261106.json); passing does not mean zero retried requests.

The S3 stress setup covered 21 inputs and 16 outputs before restoring the
owner's smaller PCB setup. Actual PCB devices were absent and correctly
reported unavailable. MCU/driver simulations and prior unloaded fixture
campaigns remain documented in the development worksheet.

The owner approved both Classic and S3 interfaces on 6 November, conditional
on confirming the 5 V calibration range. That check passed: the PCB ADC uses
0–5000 mV, while native ESP32 ADC channels use 0–3300 mV. Throttle/idle
endpoints were checked in all three browsers with source and compressed assets;
threshold, pressure, battery, torque and oil calibration saves were also checked.
This verifies software scaling, not the unbuilt PCB’s physical reference accuracy.

The owner authorized publication after this check. Clean remote build/package
checks remain required before the release is published.

