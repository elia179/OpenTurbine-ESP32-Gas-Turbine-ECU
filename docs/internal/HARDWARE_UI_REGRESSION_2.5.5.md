# 2.5.5 Hardware review and movable Dashboard warnings qualification

## Scope

Hardware's review now includes dedicated wet-glow/current settings, ignition profiles, phase-torque fields, pulse bias, shared buses and PCB connector metadata. Small numeric differences remain readable. The Dashboard has one full-width movable Warnings slot. A thin placeholder appears in Edit cards; outside editing, only active warnings occupy space. Warning text, severity, links and actions are retained. The slot cannot be hidden, reduced or resized. Existing layouts retain warnings above their cards until explicitly moved.

Two existing visibility defects were also corrected: active config-schema and engine-name mismatch banners must set an explicit display state because their CSS defaults to hidden. No ECU control-loop, timing, driver-protocol or safety-policy code changes are included; the firmware version is 2.5.5.

## Browser and automated coverage

- `ui_hardware_single_edit_audit.cjs`: Classic and S3 configurations, source and delivered gzip pages; 57 isolated edits and coverage of 423 rendered registry controls. The exact wet-glow timing-only edit survives closing its editor, review, confirmation and persisted mock PATCH without a rename. Includes no-op defaults, precision and narrow-screen review.
- `ui_dashboard_warning_layout_audit.cjs`: Chromium, Firefox and WebKit, source and gzip. Real touch drag in Chromium, mouse drag elsewhere, keyboard reorder, reload/navigation persistence, old-order migration, stale hidden/minimal preferences, reset, all 11 warning appearance/clear lifecycles and links. Widths 1366, 768, 390 and 320 px; no horizontal overflow, ECU writes or JavaScript errors. The healthy Edit cards placeholder is 44 px high. Screenshots were visually inspected.
- All 26 UI audit programs were covered locally. Initial full-suite runs exposed timing assumptions in an existing calibration fixture: injected healthy samples were too sparse and background heartbeats could mark the fake stream disconnected. The fixture now presents every invalid vector followed by a sustained healthy connected stream. The calibration audit passed on recheck, and the remaining UI audits passed in sequence. Production calibration code is unchanged.
- Safety regression: 319 checks. Turbine setup matrix: 17 profiles. I2C/load-cell audit, extended native sensor vectors, 15 Python release-tool tests, 36 HIL harness tests and setup-tool Go tests passed.
- The complete local native behavior runner was interrupted by Windows Application Control (WinError 4551). No policy bypass was attempted. Full canonical GitHub checks are required to pass on the pushed commit before creating the release tag; the Windows release workflow repeats them before publication. Local coverage is not represented as one uninterrupted canonical-gate pass.

## Physical idle-bench qualification

Both boards received the candidate firmware and all 12 web files through the built-in HTTP update paths. Each browser web update used 54 bounded chunks, retained the complete original engine configuration and returned to STANDBY with outputs inactive.

- Classic: build `0a8edec8519f59bd`. The real delay-only Hardware edit saved 8000 to 9000 ms without a rename or other hardware/settings change, then restored the complete original file. The 423-second session completed 23 page navigations, two persisted setting saves, browser engine-file download/upload, fullscreen/unit checks and four warning-edit checks. No soak assertion failures or HTTP error responses; 25 transient GET resets during page handoffs recovered. Final served-file audit matched all 12 assets. CSV/NDJSON log downloads, backup download and invalid-restore handling passed.
- S3: build `751746f998022e10`. The same real delay-only edit saved successfully. Its old bench file retained disabled Cluster TX on GPIO17, already used by oil temperature. Save's existing inactive-pin cleanup was explicitly reviewed and verified; no active channel, name, enable flag or setting changed. The complete original file was restored afterward. The 188-second session completed 13 page navigations, two persisted setting saves, engine-file download/upload, fullscreen/unit checks and three warning-edit checks. No assertion failures or HTTP error responses; two top-level document retries and six transient GET resets recovered, and all pages reached CONNECTED. CSV/NDJSON exports passed.
- On both physical servers, the new warning slot was moved below an available instrument and retained its position after navigation. Browser-only injected warning frames verified appearance, clearing, links and 800/400/320 px layouts, without writing ECU state, issuing commands or causing a restart.

Both complete original configurations were compared and retained exactly after all writes. Serial captures showed only expected software resets for the update/save/restore operations, with no panic, assertion, watchdog or corruption signatures. Final served-file checks matched all 12 assets on both targets. All original engine files and receipts are preserved under `artifacts/v255-qualification/`. These are idle-bench UI/file tests, not fueled-run qualification.

## Image budgets

Both firmware and final LittleFS builds passed the canonical budgets. Classic firmware is 1,670,384 bytes with 33,552 bytes of OTA slot headroom and 18,616 bytes of static DRAM headroom. S3 firmware is 1,655,488 bytes with 1,490,240 bytes of OTA headroom and 149,032 bytes of static DRAM headroom. Compressed source payload is 405,596 bytes; Classic retains 184,228 bytes before filesystem overhead.

## Publication gate

Push main only after physical checks pass. Require the complete GitHub safety gate to succeed before tagging v2.5.5. Require the tagged safety gate, Windows matched-release workflow and public-site deployment to succeed. Verify the actual Latest package and setup-tool downloads, SHA256 sidecars, archive integrity, clean source commit, both firmware entries and exact web files before reporting the flasher default live.
