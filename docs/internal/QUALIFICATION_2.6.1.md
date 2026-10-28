# 2.6.1 hardware qualification worksheet

Updated 28 October 2026. Both bare-board targets completed the focused no-load
checks below; see [hardware evidence](HARDWARE_2.6.1_20261028.md). Assembled-PCB
results remain pending. Do not reuse 2.6.0 evidence as proof for this build.

## Identify the installation

Record target, module marking, measured flash size, firmware build ID, package
SHA256, PCB revision/profile ID (or explicitly no profile), attached test fixture,
and the original engine-file backup. The current application IDs are Classic
`268cf1be3900e35d` and S3 `b1668964bf92625e`. Web files must match the current
review package byte-for-byte; an application ID alone does not identify the web UI.

For the new PCB use **ESP32-S3-WROOM-1-N8**, all components fitted, and profile
`openturbine-s3-20261028`, revision `1.0-20261028`. The older official S3 profile
has different routing. Bare Classic/S3 development boards use no profile.

## Both development-board targets

| Check | Evidence to retain | Result |
| --- | --- | --- |
| USB installation, cold boot, reset and warm reboot | Tool log, serial boot output, exact identity | USB writes/reset/warm reboot passed both; cold power cycle pending |
| Hardware/Controllers/System/Sequence browsing | Desktop and short landscape screenshots, console errors, repeated navigation | Passed both targets; no JS errors in focused UI audits |
| Engine-file download and identical restore | Before/after semantic comparison and original backup | Passed both; backups retained privately |
| Invalid engine-file rejection | Response and unchanged current configuration | Passed both |
| Wi-Fi application and web update | Both reconnects, visible verification progress, complete byte comparisons | Windows Setup Tool passed both; 12/12 served files matched on each |
| Delayed AP return and wrong Wi-Fi | Recoverable waiting/retry and useful support log | Classic disconnected timeout/recovery passed; deliberately wrong board pending |
| Interrupted verification | Verification-only retry, no duplicate uploads, no false success | Passed Classic Windows tool; one firmware and one web upload |
| Native Fault LED, Status LED and legacy configurations | Fault/clear, active-high/low, fallback, reboot persistence | Active-high separate indicator and clear passed both; other physical variants pending (host tests passed) |
| Sequencer expanded commands | Compare renamed and optional outputs with requested logical commands on a no-load fixture | Live ImmediateCut cards/retained oil note passed both; broader variants host-tested |
| Short viewport controls | Touch/keyboard focus, dirty strip, save/error states, orientation changes | Live restore/clean state passed both at 1024 and 390 width; actual tablet review pending |
| Short soak and memory | No resets, unexplained stalls or declining memory during browsing/transfers | Passed focused browsing/saves/restores: Classic 248 s, S3 214 s; recovered transport resets recorded |

Existing helpers include `tools/live_release_readonly_audit.cjs`,
`tools/live_system_maintenance_audit.cjs`, `tools/live_engine_file_roundtrip.cjs`
and the Classic/S3 bench smoke scripts. Read their fixture requirements before
execution. Write-capable helpers require their explicit bench/write switches;
do not invoke them against an unidentified board or copy old fixture pin plans
onto the new PCB.

## Assembled PCB only

A bare S3 module cannot establish these results. Use the actual assembled board
and appropriate no-load/dummy-load fixtures and measurement equipment.

| Check | Expected observation | Result |
| --- | --- | --- |
| Output-enable GPIO45 | Inactive through boot/reset/profile validation; enabled only after output initialization, also with power-only or pulse-only assignments | Pending |
| Power outputs 1–6 | Correct connector, inactive polarity, switching and reset behavior | Pending |
| Pulse outputs 1–6 | Correct connector, waveform, level shifting and shared enable | Pending |
| Pulse inputs 1–6 | Conditioned input response, frequency/count scaling and correct GPIO mapping | Pending |
| External pull-ups | P0–P5 independent; changing or recovering one does not change either LED | Pending |
| Status and Fault LEDs | P6/P7 active-low; fault blinking moves to Fault LED and clears correctly | Pending |
| I2C faults/recovery | No unintended pull-up or LED latch changes; useful missing-device diagnosis | Pending |
| Eight TLA2528 ADC channels | 0x10 address, measured AVDD/reference, channel isolation and known-voltage sweeps | Pending |
| Both MAX31856 inputs | Independent CS, configuration, temperature, disconnect and recovery | Pending |
| Battery measurement | Measured resistor population/ratio and comparison against meter | Pending |
| Start/Stop, UART and exposed buses | Correct physical routing and configured behavior | Pending |

## Release decision

Fix failures, repeat affected checks, then run `tools/run_release_checks.py` and
the applicable hardware qualification campaigns against the exact final build.
Record the user's UI approval and physical results before tagging/publishing.
The local unsigned Setup Tool and review ZIP are not a signed public release.
