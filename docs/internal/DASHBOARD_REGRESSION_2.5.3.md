# Dashboard candidate 2.5.3 — 2026-10-17

The user completed the Classic trial and approved publication on 2026-10-17,
conditional on the final Classic file/log/browser checks and successful release
checks. Final publication evidence is recorded below when complete.

## Changes

- Normal preserves the existing card contents. Reduced removes the sparkline and
  its space. Minimal retains the reading, unit, configured name, health indicator
  and active warning indications.
- Original preserves existing grouped widths. Small, Medium and Wide use thirds,
  halves and full width in the personal dashboard; phones use two small cards or
  one wider card per row. Complex control panels wrap instead of overflowing.
- Controls, routine information and auxiliary input/output cards participate in
  ordering. START/STOP cannot be hidden. Active fault banners remain outside the
  movable grid. Older personal layouts retain controls ahead of their readings.
- Preferences stay in browser storage. Hidden trends skip canvas drawing, retain
  only existing bounded browser history, and request no additional ECU data.
- Registry display names take precedence over legacy labels. Dashboard actuator
  status, Hardware, Controllers, Calibration, Sequence and Tools preserve entered
  names. Tools identifies unambiguous fitted outputs; Log pressure selections and
  legends use their configured names. Stable channel IDs and CSV headers retain
  their machine-readable meaning.

## Follow-up from the Classic trial

The first trial exposed two gaps in the initial checks: optional cards moved
outside their hidden parent sections, and built-in custom-block sensor entries
bypassed the shared naming helper. Both are now covered by explicit regressions.

- Afterburner, governor, actuator-status and switch panels retain their fitting
  visibility after custom ordering; tests exercise removal and restoration.
- Custom-block selectors, previews, saved source/target summaries, output steps
  and final-state output labels use configured names. Removed IDs remain marked
  missing instead of resolving silently to a different channel by legacy alias.
- Fixed Controllers source choices (idle feedback, oil-loop shaft targets,
  primary temperature, combustion loss, relight and standby oil) identify the
  fitted names while retaining the role/behavior and stable enum values.
- Session Data choices and chart legends use unique fitted channel names, keep
  units and CSV field identities, and fetch Hardware once per page visit.
- Historical event records lack names from the original configuration. Their
  role labels and raw codes remain stable; current names are not backfilled into
  historical event details. Additional registry CSV columns already capture
  name plus ID in the header at run start.

## Extended naming audit

The follow-up audit renamed every simulator registry input/output, including
lowercase, underscores and HTML characters, and compared all returned custom
sensor/output metadata against the saved names. It also renders the actual
legacy DI wait card and verifies named options/conditions. Further fixes cover
named current cards, primary dashboard names independent of stale legacy labels,
calibration current and flame rows/wizards, standard sequence conditions,
final-startup-check labels, live advisory/run-summary labels and fitted-input
context on safety cards. Explicit names `Main Fuel Pump` and `Main Fuel Meteri`
are preserved, and the bleed-valve compatibility path uses its actual device
name. Start/Stop workflow name edits update their fitted registry channel, pressure-setting captions use the configured names, and save-review labels preserve parentheses inside names. Role explanations, default labels for unnamed/unfitted channels, stable
machine fields and historical event details remain distinct from channel names.

## Verification

- Both ESP32 Classic and ESP32-S3 compile; no PSRAM is required. Static RAM is
  105,960 bytes on Classic and 129,236 bytes on S3.
- Actual Classic/S3 browser checks cover all detail presets, card sizes, ordering
  of controls, reload persistence, units, 320/390/768/1280-pixel layouts, all eight
  pages and complete engine-file downloads. No ECU configuration writes or engine
  commands originate from dashboard customization.
- Both boards reproduce the reported pressure naming case with **Boost Pressure**
  and **Jetpipe pressure**, including after hardware save/reboot. Calibration
  headings and Log legends identify the same inputs.
- Twelve-file browser uploads complete in 54 bounded chunks and retain the
  complete engine file. Served assets are compared with the local package.
- Source and packaged UI tests cover fault/unavailable readings, HTML escaping,
  literal lowercase/underscore names, auxiliary DOM reuse, hidden-canvas drawing,
  narrow complex cards, old-layout migration and reset.
- UI smoke: 61 checks; safety regression: 319 checks; pre-hardware UX: 45 groups.
  Dependency, beta-release, sensor-visual, session-chart, phase-torque, I2C and
  public-content audits also pass.

The checks are for this dashboard/configuration change on an idle wired bench.
They do not add a fueled-run or full engine qualification claim. Detailed local
records and private engine backups live under ignored
`artifacts/dashboard-2.5.3/`.

## Handoff

Classic uses **OpenTurbine** Wi-Fi. S3 uses **OpenTurbine-S3-253** to avoid access
point ambiguity. Both use `http://192.168.4.1` on their respective networks and
remain in STANDBY with outputs inactive. The user completed the Classic trial
and approved publication subject to final checks.

## Final Classic publication checks — 2026-10-17

- Realistic browser soak passed: 712 seconds, 39 navigations across the live ECU,
  two persisted setting saves, and the original 1000 ms ramp restored by readback.
  Complete engine-file download and same-file restore passed. No unexpected reboot,
  unresolved script failure or HTTP error; 11 transient GET resets during page
  handoff recovered. Largest free allocation remained 38,900 bytes.
- Browser Event CSV (2,293 bytes) and NDJSON (40,743 bytes) downloads passed;
  raw diagnostic event identifiers remain intact.
- Complete browser web update passed: 12 files, 54 bounded chunks, complete
  engine-file content retained exactly, STANDBY with outputs inactive afterward.
- S3's final browser check covers all pages, customization, configured-name
  selectors/previews and engine-file download. All 12 served assets match the
  final local package on S3.

## Canonical pre-publication gate

`python tools/run_release_checks.py` passed end to end: all 23 UI audit
programs, 319 safety checks, 17 engine setups, native controller/driver behavior,
extended sensor vectors, Python/package/HIL tests, Windows setup-tool Go tests,
and both firmware/filesystem builds and their image/linker budgets.

Classic firmware image: 1,668,560 bytes with 35,376 bytes of OTA headroom;
LittleFS source payload 402,973 bytes leaves 186,851 bytes before filesystem
overhead. S3 firmware: 1,653,792 bytes with 1,491,936 bytes of OTA headroom.
Classic's final served web assets also match all 12 local package files after
the browser upload. The source/UI candidate is frozen for publication.
