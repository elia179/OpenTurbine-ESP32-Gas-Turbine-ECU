# Local 2.5.4 qualification — 2026-10-20

Bench qualification for 2.5.4, completed before publication. User approved publication and flasher-default promotion on 2026-10-20. Web cache token: `20261020b`.

## Changes under test

- Dashboard Fullscreen/Exit fullscreen matches Edit cards. Direct user activation, browser exit tracking, unsupported-browser hiding and rejected-request feedback; no added ECU polling or persistent fullscreen preference.
- Retire an old singleton adapter only after the last fitted channel leaves its purpose. This fixes a former flame input still claiming GPIO35 after conversion into a low-oil-pressure switch.
- Identify registry safety-input mirrors by physical assignment and serialize `registry_id`. Moving, renaming, reversing polarity, removing and repurposing a channel updates/retires its runtime copy during PATCH, complete-engine restore and boot loading. Preserve independent legacy inputs, debounce, mode masks and slot indexes; reject real duplicate pin assignments.
- Grey unavailable Classic pull controls and explain external bias. S3 capabilities remain independent, including GPIO46 pull support.
- S3 negative testing exposed a failed in-place rollback: rejecting a duplicate hardware channel could leave the runtime Hardware endpoint on compiled defaults while the committed engine file was intact. Recover rejected updates and failed hardware writes at reboot on both targets; test the live Hardware endpoint as well as the saved file after rollback.
- Hardware testing found a separate runtime path forcing active-low legacy safety inputs to use pull-ups. Honor the registry's explicit bias and clamp unavailable Classic GPIO34–39 pulls to floating INPUT at initialization. Cover START/STOP, registry/legacy switches, pulse inputs, thermocouple MISO, I2C interrupt and HX711. Sensor protocols and timing remain unchanged.

## Automated release gate

All release-gate components passed across invocations. The initial complete gate passed before the final S3 rollback fix. The final rerun passed all UI/safety/profile checks, then Windows Application Control blocked the native servo executable before it could run (`final-release-gate.log`). A normal native-suite rerun completed with exit 0 and all behavior tests passing; no policy bypass was used. The remaining checks and final builds/budgets were completed separately (`final-remaining-checks.log`, `rollback-final-build.log`, `rollback-final-budgets.log`). The final rerun is not reported as one uninterrupted gate invocation.

Passed: all 24 UI audit programs, 319 safety checks, 17 engine profiles, full native behavior suite, extended sensor vectors, I2C/load-cell audit, Python release tools, HIL harness tests, setup-tool Go tests, both firmware/filesystem builds and all configured image/linker budgets. Native coverage includes Classic/S3 bias capability, safety-mirror lifecycle, real GPIO conflicts, MAX thermocouple input modes and signed HX711 values. Source and compressed-asset touch-browser audits cover fullscreen entry/exit/external exit, unsupported/rejected requests and purpose reassignment for 15 sensor and six actuator types.

| Target | Final build ID | Firmware bytes | OTA headroom | Static DRAM free |
| --- | --- | ---: | ---: | ---: |
| ESP32 Classic | `12fdd0f8d998b598` | 1,670,384 | 33,552 | 18,616 |
| ESP32-S3 | `0d0b053849fdb0f5` | 1,655,488 | 1,490,240 | 149,032 |

Compressed web payload: 404,141 bytes. Classic raw filesystem headroom before filesystem overhead: 185,683 bytes.

## Classic physical bench

Final firmware and assets installed. Original complete engine configuration backed up before testing.

- Real Hardware editor: flame GPIO35 saved; repurposed to low-oil digital safety input without rejection; unavailable pulls disabled with note; switch renamed, moved to GPIO34 and polarity reversed; linked runtime slot followed exactly once; real duplicate GPIO rejected without committing it; repurpose/removal retired obsolete adapters. Original hardware/settings restored exactly (`esp32dev-gpio-result.json`). Final UART capture includes active-low GPIO35 initialization with no unsupported-pull error or panic.
- Browser web update: all 12 files, 54 bounded chunks, complete engine configuration retained exactly (`classic-web-roundtrip.log`).
- Browser soak after the input-bias fix: 403 seconds, 22 page navigations, two persisted setting saves, fullscreen toggles, complete engine-file download and same-file browser restore; original ramp restored. No unexpected restart, JavaScript failure or HTTP-error response. Eight transient GET resets at page handoff recovered; every resulting page reached connected state (`classic-final-soak/classic-final-result.json`). Earlier candidate soak also passed 740 seconds and 40 navigations.
- Actual System browser firmware upload: 408 chunks of 4,096 bytes, successful completion and normal software restart (`classic-browser-firmware-result.json`).
- Complete-engine backup download and invalid-file rejection passed, with hardware unchanged (`classic-maintenance-connected.log`). Initial disconnected-PC attempts were rerun after joining the AP.
- Event CSV (2,277 bytes) and NDJSON (3,138 bytes) exports passed (`classic-log-downloads.log`).
- Live tablet/phone touch-browser fullscreen and matching button styles, no horizontal overflow/JavaScript errors/unintended writes/restart, and exact decompressed matches for all 12 served assets passed (`esp32dev-readonly.json`).
- Final complete configuration matches `classic-before-ecu_config.json`; STANDBY, outputs inactive.
- After the S3 rollback follow-up, installed final Classic build `12fdd0f8d998b598` through OTA and repeated the browser/file session: 238 seconds, 11 navigations, two persisted setting saves, complete engine-file download/re-upload and original ramp restored. No unexpected reboot, JavaScript failure or HTTP-error response; 25 transient GET resets during handoff recovered and every resulting page connected (`classic-release-soak/classic-release-result.json`). Complete engine configuration again matches the pre-update backup exactly (`classic-final-config-verified.json`).
- Final Classic served-file/style/fullscreen checks passed again (`classic-release-readonly.log`, `esp32dev-readonly.json`), followed by browser Event CSV (2,608 bytes) and NDJSON (3,599 bytes) downloads (`classic-release-log-downloads.log`). Final serial capture has no panic, watchdog, brownout or unsupported-pull error.

## S3 physical bench

Final corrected firmware OTA and browser web update passed: 12 files, 54 bounded chunks, complete engine configuration retained exactly (`s3-rollback-final-ota.log`, `s3-web-roundtrip.log`).

- Seven live GPIO lifecycle checks passed on the final build: initial flame ADC input, conversion to safety switch, rename/move/polarity, explicit pulldown and active-low reboot, real duplicate rejection, reverse repurpose and removal. After deliberate rejection, both the saved file and live Hardware endpoint retain the committed channel map after the expected reboot. Original hardware/settings restored exactly (`esp32s3dev-gpio-result.json`, `s3-gpio-final.log`).
- Earlier negative runs exposed the rollback defect above and were not counted as passes. Their cleanup restored the original engine file.
- Final browser session passed in 189 seconds: 13 navigations, two persisted setting saves, engine-file browser download/upload, fullscreen use and original ramp restored. No unexpected reboot, JavaScript failure or HTTP-error response; six transient GET resets and two document retries recovered with every resulting page connected (`s3-soak/s3-result.json`). Complete final engine configuration matches the pre-update backup exactly (`s3-final-config-verified.json`).
- Final tablet/phone touch-browser fullscreen/styles and all 12 served-asset hashes passed without writes or restart (`esp32s3dev-readonly.json`). Browser Event CSV (6,679 bytes) and NDJSON (25,452 bytes) downloads preserve the raw diagnostic format (`s3-log-downloads.log`).

## Scope and evidence

Qualification complete. Both targets were left on the final 2.5.4 firmware and current web assets, original complete configurations restored, STANDBY and outputs inactive. PC Wi-Fi returned to Classic's OpenTurbine AP for user review. Publication follows the user's subsequent approval; release workflow and live package verification are separate from this bench record.

Evidence is under ignored local `artifacts/v254-qualification/`; configurations and logs are not added to the public repository. These are idle bench, configuration, file-transfer and browser tests. No START or actuator command was issued; this does not represent a fueled-run test. Browser touch emulation is not a substitute for testing every Android tablet/browser combination.

S3 pull capability references: [Espressif GPIO documentation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/gpio.html), [S3 datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf), and the installed SDK GPIO implementation.

