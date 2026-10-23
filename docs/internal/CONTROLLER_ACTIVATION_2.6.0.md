# Controller activation — local 2.6.0

Branch: `work/controller-activation-2.6.0`. Unreleased; 2.5.6 remains the published baseline. Selected no-fuel hardware checks now pass on Classic and S3; see the follow-up evidence below. This is not full transport or live-turbine qualification.

## Contract

Each user output controller has Enabled, multiple Activate when and Deactivate when choices: Sequencer block or entering Startup, Running, Shutdown, Standby. State entries are events; an active controller follows its input on every control tick until deactivated. New definitions default to entering Running, stopping on Shutdown/Standby. Older mode-mask definitions retain their behavior until timing is reviewed.

Choosing sequence activation/deactivation derives a required named block in Needs placement. Users drag a card into a sequence position, or select the card and a placement gap. Missing required blocks inhibit only that controller for the run, with a named Dashboard warning; START still checks unknown blocks and missing hardware. Disabling a controller makes its blocks inactive; removing a required block returns it to the placement area, and Sequence Save rejects the missing placement. Stable numeric IDs survive rename/reorder. Controller save review removes obsolete links, preserving unrelated sequence slots and parallel metadata; fresh sequence read precedes writes, and a changed removal set rejects stale review.

Activation owns the output continuously. Ordinary conflicting blocks, custom steps and side actions are ghosted in the editor and rejected by runtime ownership checks. Deactivation commands the output's Hardware safe demand before release. State deactivations precede activations and sequence entry. Repeated inactive deactivation is inert. Several scheduled controllers may share an output at different times; overlapping activation is a setup/runtime error. The core starter also owns its enable relay. Optional afterburner and core shutdown paths are checked for overlap.

Fault, aborted startup and configuration replacement clear transient activation. Relight, emergency cuts and protective oil/cooldown retain authority. One-shot FuelPumpIdle/ModifiedIdle/SetOutput remain usable when their outputs are unowned. Dedicated governor, automatic-idle, oil-loop and afterburner subsystems retain their existing settings, with no unsupported timing controls presented.

## Implementation

- Allocation-free 16-bit ControllerActivation state, strict stable block-key decoder and shared ownership-footprint checking.
- JSON identity/event fields, unique IDs for imported legacy definitions, validation and cached safe demands. Release old ownership before replacing definitions.
- Controller commands reuse per-slot targeted-block storage; no additional command-block pool.
- Shared small editor timing fragment, five activation choices, multiple stops, plain Starts/Stops and setup status. Stable-ID save review formats event names and detects same-output reorder correctly.
- Required placement, inactive blocks, ownership ghosting and explicit repair routes in Sequence. Structural errors remain START interlocks even in bench mode.
- Shared channel-reference resolution and browser fault/abort repair guidance preserve Classic flash headroom. Device diagnostics retain code/detail and old descriptive frames still display. No partition or reserve reductions.

## Local verification

Evidence lives under `artifacts/v260-*` (not committed):

- Native behavior suite passed, including existing drivers, controllers, command queue, session files, GPIO behavior and feedback. Windows policy scanning caused a bounded retry on one existing probe; it subsequently passed.
- Final real RulesEngine/SequenceEngine integration passed: live potentiometer tracking, ownership rejection, safe release, inactive no-op, state handover, disable/re-enable, fault inhibition, nonzero servo parking, protective ignition and coupled starter ownership.
- Controller source and gzip pages passed at mobile width in Chromium, Firefox and WebKit: five choices, stable names/IDs, placement, unplace/reinsert and save interlock, explicit disable, ghosting, deactivation handover, metadata cleanup, stale-save rejection before writes, readable timing review and coupled-output conflicts.
- Safety regression audit: 319 checks passed. Turbine setup matrix and I2C/load-cell audits passed.
- Both targets built successfully. Classic budget: firmware 1,670,848 bytes, OTA headroom 33,088 bytes (minimum 32,768); static DRAM headroom 18,680 bytes (minimum 16,384), IRAM 40,096 free, RTC slow 116 free. S3 firmware 1,654,800 bytes, OTA headroom 1,490,928; static DRAM headroom 149,096. Both filesystem builds and configured reserves passed.
- All 35 UI audit programs passed across the complete/remaining/final batches (`v260-complete-ui.log`, `v260-ui-remaining.log`, `v260-ui-last.log`). Final controller and fault-presentation matrices also passed after their targeted additions. Both final filesystem images were rebuilt from the current packaged pages. Public-content validation and 15 Python release-tool tests passed.
- Runtime controller progress/fault fields and event logs use the configured controller name; stored sequence keys remain stable IDs. Startup fuel/starter warnings recognize controller-supplied commands. Controller name input matches the firmware storage limit.

## Before release

Local checks and the selected no-fuel bench checks documented below are complete. Broader transport coverage, installation-specific calibration and live-engine qualification remain outstanding. Do not tag, release, push or change flasher default without user authorization.

## Oil/calibration/logging follow-up — 2026-10-22

- Sensor-only oil-pressure calibration is the default and sends no actuator commands. Two-point linear calibration and optional four-point cubic fitting coexist with the explicitly selected electric-pump/minimum-output workflow. Sensor-only saves retain the pump minimum.
- Registry-owned oil/interlock inputs no longer appear a second time in the read-only legacy DI summary.
- Request Fault Shutdown is exposed as a threshold action alongside normal shutdown. Existing normal-shutdown definitions are not silently converted.
- Activation fields are directly inside an opened controller card, with no nested timing card and no added timing line in the collapsed summary. Details state uses stable controller IDs and protection/subcard keys, including closed states; IDs are assigned before first render.
- Browser log JSON/CSV select the last 120 valid records from the file independently of the recorder's cached count, filter malformed/oversized records, and preserve legacy trailing-comma handling. Invalid responses show an error rather than an empty summary. Event persistence can reclaim oldest eligible session CSVs when they consume its working-space reserve.

Verification evidence (`artifacts/v260-followup-*`, intentionally untracked):

- New oil workflow audit passed source/gzip in Chromium, Firefox and WebKit, including no pump commands, real save payloads, direct activation controls, edit/rerender expansion, mirrored-switch suppression and malformed-log response handling.
- Existing 36 UI audit programs passed across the initial and final remaining batches; native behavior suite passed including the new 300-record damaged/oversized/legacy-comma event-tail vector. Safety regression audit: 319 checks. Public content and 15 Python release-tool tests passed.
- Classic: firmware OTA, twelve-file browser web upload, complete engine-file browser download/upload/restore, CSV/NDJSON event downloads, 40-page browser soak, and a wired oil-switch test from RUNNING. The S3 tester measured both fuel-valve and ignition outputs cut; CONTROL_RULE and RUN_SUMMARY persisted and appeared through the event API.
- S3: same wired fault/output/event test with Classic as tester; browser engine-file round trip, event downloads and 16-page soak. Optional manual oil-pump PWM reached the tester and returned OFF.
- Real S3 ADC sensor-only calibration with Classic DAC: captured 0.5/2.5-V reference equivalents as 0/5 bar; a 1.5-V midpoint read 2.43 bar. Both points saved; zero command requests, pump stayed OFF, minimum pump setting unchanged. Complete original engine configuration restored afterward.
- Final image budgets: Classic 1,671,152 bytes, OTA headroom 32,784 (required 32,768), static DRAM headroom 18,680. S3 1,655,152 bytes, OTA headroom 1,490,576, static DRAM headroom 149,096. Both filesystem builds passed with unchanged partitions/reserves.

The tester's original old-history failure was already cleared, so its exact original cause cannot be conclusively reproduced. Damaged-history selection is covered by native vectors; flash-exhaustion recovery was reviewed without deliberately filling/clearing the user's saved historical CSVs. These checks used electrical bench stimuli, not actual oil pressure, a turbine or fuel. No release/push/default-flasher change is authorized for this work.

Previous iteration bench state: Classic COM3 ran the 2.6.0 ECU, build `15f0011fb3b4bca5`, original registry/sequence verified, STANDBY and outputs inactive. S3 COM4 is restored to OTBench tester firmware. Final page cache token: `20261022b`. No push/release performed.


## October 23 controller and temperature follow-up

- Activation is now a five-bit selection with multiple events; existing single-event settings migrate without changing their selected event. Required controller links remain drag-placeable, including links stranded in a disabled afterburner sequence. Missing links and planned ownership conflicts inhibit only the affected controllers, including Standby activation; genuine unknown blocks and hardware errors still block START. Saved Enabled settings are retained.
- Independent startup selected-TOT/TIT protection supports an immediate ceiling, continuous time above a threshold, or both. With it enabled, normal temperature trip/pullback resume in Running; with it disabled, those protections also apply during Startup. Sensor loss during a guarded start faults. Startup-only and pre-start-only guards do not demand their sensor later in Running when no Running function uses it.
- Safety settings now separate Startup protection, Running fault shutdown, and gradual fuel limiting. Each is an open rounded card with a coloured top edge. Hardware toggle rerenders retain unsaved values and expansion state. Navigation and labels use configured channel names.
- Production-native controller and safety integration tests pass, including Standby inhibition, safe release, temperature-only phase gating, selected TOT/TIT, dwell resets, sensor loss and unchanged pressure limiting. Full native suite and 319 structural safety checks passed. Chromium, Firefox and WebKit source/gzip and mobile layout/placement audits passed.
- Classic dry temperature HIL passed immediate startup trip, continuous temperature trip with cooling/reset, Running overtemperature, and normal-startup fallback. S3 supplied MAX6675 stimulus; tester measured fuel/ignition relays off and fuel servo at about 1000 us after trips. Exact original settings restoration passed.
- Classic controller HIL measured approximately 1400 us for the multi-event fuel controller in Startup/Running while an incomplete Standby/sequencer ignition controller remained inactive; START remained available. Shutdown released safely to approximately 1000 us with ignition and fuel valve off. The campaign's automatic restoration did not verify; a subsequent complete-file restore returned HTTP 200 and was checked against the pre-test user snapshot with zero differences after the documented schema/default migration. See artifacts/controller-hil-reconciled-result.json.
- Classic browser session passed file download/upload/restore and 284 s across 15 navigations, with two persisted settings saves and original settings restored. No unexpected reboot, JavaScript error, HTTP error, or unrecovered failure; nine transient page-handoff GET resets recovered.

This remains unreleased. These are dry electrical/software checks, not a fueled turbine qualification. No push or flasher-default change is authorized.

S3 basic verification completed: 205 s, 13 navigations, 2 settings saves, complete engine-file download/upload/restore, no unexpected reboot or unrecovered browser/HTTP error. Original settings restored. The 29 transient page-handoff GET resets recovered. S3 is returned to OTBench 0.14; Classic ECU/native user configuration was verified exactly after role restoration. Final web cache token: `20261023b`. Nothing pushed.


### Oil/switch UI follow-up (23 October, review build 20261023k)

One primary oil-pressure shutdown now uses the retained running minimum and confirmation time. The former oil_zero enable imports into low_oil; its separate analogue near-zero threshold no longer runs. Both existing switch roles use the same enable and retain Hardware polarity/debounce/mode handling. Additional independently named pressure or switch protections use custom controllers with Request Fault Shutdown; these actions do not claim a shared physical output.

Switch conditions use logical ON/OFF throughout the editor and save recap, including ADC threshold switches, I2C digital and flame inputs. Numeric switch settings from old controllers require explicit conversion if they do not represent a valid logical ON/OFF comparison. Missing input selections retain their identity instead of displaying another device. Relay output states use ON/OFF choices. Hot-start interlock is inside the selected temperature card; local safety summaries use boxed state badges.

UI source and generated gzip checks passed in Chromium, Firefox and WebKit. The 29-configuration/83-field safety matrix passed, including pressure/torque colours and markers. Production oil-threshold/confirmation integration passed. Simultaneous fault-action activation passed its first integration probe; an expanded follow-up that also exercises independent input callbacks compiled but Windows Application Control blocked launching the new executable (4551). Do not report that expanded case as passed; retry/complete it during release validation. Classic firmware and web assets are installed for user UI review; release checks and pushing still await user approval.


### Fixed switch debounce and confirmation (review build 20261023l)

All switch paths now publish a common built-in 20 ms contact-filtered logical state, including native GPIO, TCA9554 and native/external ADC threshold switches. Dedicated Start/Stop bypass a second debounce when consuming registry inputs; held-Start boot/reconnect release requirements remain. Dedicated AB switch paths use the same contact filtering; analogue AB command conditioning remains separate. Input health is never contact-debounced. Native/external flame adapters consume the same thresholded/debounced logical state, retaining raw calibration samples.

Oil-switch shutdown uses the oil protection card's existing low_oil_confirm_ms after debounce. The field is now available with either switch role even without an analogue sensor. Custom ON/OFF controllers export/import confirm_ms (0 by default for old files), with independent continuous timers reset on false/unhealthy/inactive conditions, explicit deactivation, fault, configuration changes and observation gaps. The UI distinguishes fixed contact filtering from confirmation and highlights intermediate safety section headings.

Targeted native tests passed for debounce, continuous confirmation, production RulesEngine callbacks/reset, production SafetyMonitor, all sixteen shared rule JSON float fields/defaults and I2C recovery/threshold/polarity behaviour. The previously blocked expanded callback integration now ran and passed. Source/gzip switch UI tests passed in Chromium/Firefox/WebKit; the 29-hardware/83-safety-field matrix also passed. Classic budget passes with app reserve intact: 33,216 bytes OTA headroom and 17,936 bytes static DRAM free. Classic is updated for UI review; no release campaign or push yet.

### Pressure-safety monitoring phases (review build 20261023m)

Oil-pressure and low-fuel-pressure safeguards now select Startup, Running (default), or both. Each selection is independent of its enable switch and retained limits. Missing fields in older engine files default to Running rather than inheriting another file's phase selection. Startup oil-pressure monitoring uses the configured advisory minimum even before any sequence block sets oilMinBar. Explicit Sequence checks and per-pump loop protections remain independent.

Oil-switch ON while stopped is a pressure condition, not a pre-start stop interlock. The web and ECU core share the same START role decision: an active healthy oil switch is permitted; an enabled but unreadable oil switch remains a blocker. Fault, emergency and inhibit inputs retain their independent START checks. Oil-switch confirmation is gated by the selected phases for both native and registry inputs; inactive phases reset timing. The legacy DI mode mask no longer silently overrides the oil safety card's phase selection. Web preflight reports other interlocks before generic sensor feedback errors.

Source/gzip UI checks passed in Chromium, Firefox and WebKit, including the two phase selectors, old-file Running defaults, live summary updates and narrow layouts. Classic builds and budgets passed (33,152 bytes OTA headroom; 17,936 static DRAM free). Expanded production SafetyMonitor tests compile and cover phase matrices, fresh confirmation timing and shared START decisions, but Windows Application Control blocked executing the changed native binary (4551), including the bounded retry and a later retry. Do not report those new native cases as passed. Existing rule JSON, switch timing and production RulesEngine native cases passed before that blocked test. Release validation remains pending user UI approval.

Classic firmware and all twelve web assets were installed successfully for review. Live browser verification confirmed both phase defaults are Running, the switch-only oil selector is visible/enabled, the summary matches, and the deployed controller HTML matches generated bytes. With TOT unavailable and the healthy oil switch still ON, limited_start_allowed is now true for engine temperature. The ECU stayed in STANDBY; no START command was sent. All pre-existing settings/hardware values matched the fresh pre-install snapshot exactly.

### Named switch faults and restart review (review build 20261023n)

Native and registry fault inputs now record their configured names in compact INPUT_FAULT / OIL_SWITCH / INPUT_UNAVAILABLE descriptions. Custom DI fault messages and recorder fault codes remain intact. The UI also resolves previous generic "DI fault: channel N triggered" text using that channel's telemetry label, role and GPIO. Switch faults link to Hardware and, for oil switches, the oil protection card; unrelated analogue-calibration/tool links are hidden. Reduced-start availability is an advisory rather than a red startup-lock heading.

START is available in a latched FAULT only when existing firmware telemetry explicitly permits fault acknowledgment. It first runs the existing user-confirmed CLEAR_FAULT flow, waits for a fresh full snapshot proving STANDBY, and then opens the separate ordinary start review. A queued command alone is never treated as a successful clear. No START command is sent by acknowledgment. The final confirmation uses START_LIMITED only when the authoritative reduced-start flag is true. Pressure-switch trips remain real latched faults; reduced-power operation does not bypass oil pressure protection.

Source/gzip browser recovery tests passed in Chromium, Firefox and WebKit, covering named/escaped inputs, relevant links, cancel, un-clearable and remaining faults, acknowledgment with no engine start, separate reduced-start confirmation and mobile overflow. Existing compact fault-presentation audit passed. Classic firmware builds and resource budgets pass: 33,232 bytes OTA headroom and 17,936 static DRAM free. The earlier expanded pressure native test remains blocked by Windows Application Control; this UI review does not close release validation.

Classic firmware and all web assets installed and verified for review. Live browser checked deployed index/app/style byte identity, named legacy DI fault expansion, enabled START and reduced-power confirmation. No engine/command POST was sent. All settings and hardware values exactly matched the pre-install snapshot. The firmware/web reboot cleared the earlier volatile test-fault latch as expected. No release campaign or push performed.

### Dashboard command/preset audit (prepared build 20261023o; not installed)

Removed the unconditional startup idle-input range and startup oil-pump preset captions. They described legacy saved settings even when the sequence never commanded those actions. The calibrated physical main-fuel minimum remains visible in every phase. Configured automatic-idle/governor targets are labeled as configured; pressure targets are hidden when no pump/positive target exists, and automatic-idle pressure uses the selected display units.

The dashboard's former RPM/EGT warning guessed throttle inhibition from fitted unhealthy sensors. It now consumes throttle_feedback_inhibited, published by the existing ThrottleSlew guard only when it actually holds an attempted increase. The unchanged guard still respects enabled consumers and explicit single-sensor overrides. The new diagnostic is in full telemetry and compact h bit 2, clears on reset/non-operating cycles, and introduces no actuator-decision change.

Oil 'min' had displayed ed.oilMinBar (the sequence's required threshold), despite the frontend comment describing an observed session minimum. The card now explicitly shows run minimum using existing measured min_oil, includes a genuine zero, and hides the row when no running sample exists. Retired oil_min_bar, fuel_idle_max_pct and oil_pump_on_pct display-only telemetry fields were removed; configuration values and sequence behavior remain intact.

Command-details text clears previous owner labels when a new snapshot reports no owner. Default owner descriptions distinguish Standby/manual, fault protection and shutdown. Enabled oil loops publish their actual named pump/controller as owner when they compute demand, including Startup, instead of claiming an oil controller just because hasOilLoop is set. Later custom-rule ownership still wins.

Source/gzip targeted browser checks passed in Chromium, Firefox and WebKit across engine phases, reduced override/unused unhealthy sensors, actual hold flags, compact decoding, missing and zero pressure samples, output owners, target labels and narrow layouts. Fault acknowledgment/reduced-start browser checks also passed again. Expanded production SafetyMonitor/ThrottleSlew integration now ran successfully, including all pressure phase and START-role cases previously blocked by Windows Application Control, plus actual hold/override/reset diagnostics. The earlier blocked-case status is resolved. Classic final build/budget passed: firmware 1,670,928 bytes, OTA headroom 33,008 bytes, static DRAM free 17,936 bytes. ECU was still RUNNING on the final read; no upload, reboot, config write, stop or start command was sent for this follow-up. Build o is prepared locally for installation after the user's test stops. Release campaign/push remain pending UI approval.
