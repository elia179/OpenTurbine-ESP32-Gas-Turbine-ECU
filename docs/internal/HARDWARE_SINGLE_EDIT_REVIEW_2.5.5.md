# Hardware single-edit save review — local 2.5.5 candidate

The user reported that changing only wet-glow pilot-fuel timing produced “No reviewable hardware changes were found”; renaming the channel made the save proceed.

The review combined legacy DOM fields and selected registry properties. New actuator subcards changed dedicated actuator state without either a legacy field ID or a corresponding registry review row. The payload itself included those values once an unrelated reviewable change allowed Save.

Corrections:

- Snapshot and compare dedicated wet-glow pilot-fuel settings and current-sensing settings for glow, oil-pump and both igniter adapters. Use the configured channel display name; suppress duplicate rows when the synchronized registry value already explains the change.
- Include ignition profiles, phase-torque fields, pulse-input pull bias and glow hot-status current in registry review relevance. Respect context-dependent phase/NAU filter defaults.
- Review I2C/SPI model state after closing the shared-bus editor, including TCA9554 interrupt wiring; avoid duplicate DOM/model bus rows and counts.
- Review PCB connector/mode changes even when the resolved pin and driver are unchanged.
- Preserve small calibration and sensitivity values in before/after text instead of rounding both sides to zero.
- Local version 2.5.5 and browser cache token 20261020c. No ECU timing or driver protocol changes; extra comparison work runs in the browser while editing/reviewing, with no added ECU polling.

Verification:

- `tools/ui_hardware_single_edit_audit.cjs`: 57 independent edits and review coverage for 423 rendered registry controls, on Classic and S3 configurations using source and gzip-packaged pages.
- Exact user path: change only the visible wet-glow delay from 8 to 9.5 seconds; close the card; open Save review; confirm; observe the submitted hardware PATCH and stored 9500 ms value. Channel name stays unchanged. No JavaScript error or unexpected dialog.
- Covers wet-glow type/signal/polarity/pin/delay/PWM/servo/demand, dedicated current settings, ignition dwell/rest/current/level/ramp, phase torque, pulse pull-up, closed shared-bus edits and PCB connection/mode metadata. Unchanged defaults produce no phantom review row; small sensitivity edits remain distinguishable.
- The companion qualification record, `HARDWARE_UI_REGRESSION_2.5.5.md`, records physical-board checks and the wider regression results. Test receipts are retained under `artifacts/v255-qualification/`.

This record explains the review defect and its automated coverage. Physical qualification is an idle-bench check; it does not establish fueled-run behavior.
