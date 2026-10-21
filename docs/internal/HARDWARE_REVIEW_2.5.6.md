# Local 2.5.6 hardware regression — 2026-10-21

This record covers the existing dry, pin-to-pin Classic/S3 fixture. The candidate is local and has not been published. Evidence is stored under `artifacts/v256-hardware/`; build identity and SHA-256 hashes are in `artifact-manifest.json`.

## Candidate identity

| Target | Firmware build ID | Firmware bytes | OTA headroom |
| --- | --- | ---: | ---: |
| Classic | `c1a9e528344b0625` | 1,670,912 | 33,024 |
| S3 | `376622f134d63e2c` | 1,655,056 | 1,490,672 |

Final compressed web payload: 409,288 bytes. Classic has 18,616 bytes static DRAM headroom and 116 bytes RTC slow-memory headroom. Both image/filesystem budget gates pass. Classic is close to the configured OTA reserve; any further firmware change requires rebuilding and rechecking the budget.

## Failures found and corrected

1. Classic N1 sometimes stayed at zero after PCNT initialization. Input-pad initialization before PCNT attachment restored counting; reflashing the original candidate reproduced the failure on unchanged wiring. The final driver initializes the input pad and honors supported configured bias for N1, N2, pulse fuel flow and generic pulse-speed channels. See `classic-n1-*.log` and the production-driver host test.
2. The real Tools page rejected compact telemetry before decoding it and kept its controls disabled. Compact-frame validation/decoding is now covered with a captured device frame. The final web assets passed actual browser upload and the real component-controls test.

Earlier attempts are retained for diagnosis and do not qualify the final candidate. No safety threshold or interlock was relaxed to obtain a pass.

## Classic results completed

- Three dry profiles: turbojet, turboshaft and turboprop; input sweeps/calibration, fitted actuator tests, STARTUP → RUNNING and physical STOP. Complete engine file restored. `classic-profiles-final.json`.
- Repeated physical START/STOP and overspeed: 4/4 checks across two repetitions. `classic-safety-final.log`.
- MAX6675 emulation: hot-start rejection, startup overtemperature, running overtemperature and combustion-output cutoff. `classic-temperature-final.log`.
- Wet-glow combined, heater-only and fuel-only tests with relay, PWM and servo pilot outputs; configured levels/delay, timer cutoff, STOP before pilot delay, held STOP and invalid selection. Actual Tools browser duration save/reload and all three buttons. `classic-wet*-result.json`.
- Two-minute RUNNING browser/physical-output monitoring with development/bench bypasses off: 180 samples, stable boot/mode, physical STOP cutoff. Event CSV/NDJSON and session CSV (53 data rows, 10 columns) downloaded and parsed. `classic-running-result.json`.
- Browser engine-file download/upload/restore, exact registry/sequence preservation and inactive outputs. `classic-engine-roundtrip.log`.
- Browser firmware OTA: 408 acknowledged chunks; expected final build returned in STANDBY. `classic-browser-ota.log`.
- System recap, unsaved-navigation cancel, page-only and combined Hardware/settings saves across intentional reboots, exact unrelated-settings preservation and original-description restoration. `classic-page-save.log`.

- Extended Classic browser session: 710 seconds total, with a full ten-minute browsing interval after setup; 41 navigations, two persisted settings saves, engine-file download/restore and exact setting restoration. No unexpected reset, unrecovered request failure or JavaScript failure. Ten transient API GET resets during page handoffs recovered. `classic-soak/classic-result.json`.
- All twelve served web assets match the packaged payload; touch fullscreen and toolbar styles pass at 800/400 px. No writes or reboot. `esp32dev-readonly.json`.
- Delay-only Hardware save: 8,000 → 9,000 ms accepted without changing name, enabled state, registry or settings. The immediate direct-POST cleanup received an explicit HTTP 503 memory guard rejection. A separate actual browser restore was acknowledged; independent complete JSON readback matched the original, including UTF-8 description, and outputs remained inactive. `esp32dev-single-edit-recovery-result.json`. Preserve the failed cleanup log rather than counting it as a clean first-attempt restore.

The supplied-file browser waiter also exposed a test-harness assumption: post-reboot uptime can exceed a very short pre-upload uptime during transfer/reconnection. Its reboot check now accounts for elapsed transfer time. This changes only the test tool; the restore acknowledgement and complete readback above remain separate evidence.

## S3 results completed

At the user's request this was a shorter target-specific verification rather than a repetition of the full Classic campaign. Classic ran OTBench 0.14 and S3 ran the final `376622f134d63e2c` candidate.

- Turboshaft profile: N1/N2 PCNT sweeps, RC input/calibration, oil/fuel/igniter/main-servo tests, normal STARTUP → RUNNING, stable RUNNING and physical STOP combustion cutoff. Complete original engine file restored. `s3-profile-final.json`.
- Wet-glow relay and PWM pilot output fixtures: all three component selections, configured levels/delay, automatic cutoff, physical STOP, held STOP rejection and invalid selection. Actual Tools browser shared-duration save/reload and component commands. Both fixtures restored. `s3-wet-result.json`, `s3-wet-pwm-result.json`.
- Short RUNNING/browser test: 108 physical/telemetry samples; 57 page visits over 67.664 seconds; no JavaScript errors, unexpected API backpressure or document retries. Normal safety/development flags verified; physical STOP cut outputs. Event CSV/NDJSON and session CSV (29 rows, 10 columns) downloaded and parsed. No dropped rows or logger error. `s3-running-result.json`, `s3-running-browser.json`.
- Actual browser web upload: twelve files, 57 acknowledged chunks; exact complete engine file retained, STANDBY and inactive outputs. `s3-web-assets.log`.
- Short browser session: 194 seconds total including a full two-minute browsing interval, thirteen navigations, two persisted settings saves, engine-file download/same-file restore and original-setting restoration. No unexpected reboot or unrecovered failures. Two top-level document retries and five transient API GET resets recovered; all pages reached CONNECTED. `s3-soak/s3-result.json`.
- All twelve served assets match the packaged payload; touch fullscreen and toolbar styles pass at 800/400 px without writes or reboot. `esp32s3dev-readonly.json`.

`qualification-summary.json` checks twenty result/log receipts and verifies the final artifact hashes. The 319-check safety regression audit, changed Tools/config browser lifecycle audits and both target budget gates also passed. No further production changes were made during the final Classic/S3 passes. The full legacy native suite is not represented as green: this Windows host blocks some older test executables; the new wet-glow and PCNT production-behavior native tests ran successfully.

The candidate remains local/unreleased. Hardware regression completion does not replace the installation-specific checks below.

Final fixture state: Classic returned to ECU duty with build `c1a9e528344b0625`; S3 returned to OTBench 0.14. Complete original Classic engine JSON read back exactly, all twelve served web files match, STANDBY and inactive outputs confirmed. `classic-final-ready.json`.

## Recording and export behavior checked

Event/session exports deliberately require STANDBY/FAULT; the RUNNING browser test verifies the rejection and visible explanation, then downloads after STOP. The session recorder deliberately retains at most 64 RAM rows while running and writes flash after STANDBY. A fast recording reached that limit without disturbing engine control; the persisted 64-row tail was downloaded and checked (`classic-high-rate-tail.json`). A 2,500 ms interval allowed the separate complete two-minute recording with no dropped rows or logger error.

## Limits of this evidence

These are dry logic and browser regressions, not a fueled-run qualification. The fixture does not establish powered-load behavior, independent oscilloscope cutoff timing, real turbine dynamics, every sensor breakout, or a 24-hour endurance run. The profiles use timed startup rather than a causal turbine plant; the S3 tester cannot supply calibrated intermediate analog voltages to Classic. Known loom limitations are recorded in the bench documentation. Installation-specific sensors, actuator polarity, calibration and trip settings still need verification on the actual turbine.
