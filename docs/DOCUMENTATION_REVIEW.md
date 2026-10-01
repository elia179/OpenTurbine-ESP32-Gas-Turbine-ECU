# Documentation review — 30 September 2026

This revision reviews the complete public GitHub Pages documentation: installation, guided builds and parts, hardware, User Guide, example system, troubleshooting, FAQ, safety, developer information, and About. The current editable interface sources were checked for controller creation, operating states, calibration, sequence blocks, manual tests, and backup locations. Linked setup and migration references were checked where they affect these workflows.

## Improvements

- Shared documentation layout with a desktop outline and a collapsible phone outline, consistent spacing and headings, direct learning/reference/troubleshooting paths, and a return-to-top link.
- A local topic and setting finder, containing 160 page/section entries plus 158 configuration fields. Common-task links remain usable without JavaScript. The field reference also has its own filter and stable per-field anchors.
- Optional screenshot hiding for readers checking a detail quickly. The setting is remembered; wiring diagrams and written instructions stay available.
- Beginner gaps filled: required Start/Stop inputs, explicit creation of a missing fuel controller, the new-controller defaults, controller mode ownership and release behavior, and targeted troubleshooting.
- Outdated controller, sequence, test-settings and backup instructions corrected against the interface. Existing reference anchors preserved. The old long contents list is collapsed rather than duplicated beside the new outline.
- Older ECU overview and sensor/switch drawings regenerated with the same clean palette, terminal labels and visual system as the guided builds. Voltage filtering is drawn explicitly. Functional diagrams remain clearly distinguished from physical connector pin order.
- Header navigation simplified, mobile-menu Escape handling made consistent, JavaScript-free navigation retained, and keyboard focus styling shared across controls.

The guide retains progressive learning detail and captioned UI screenshots. Longer explanatory material is reached through sections, hints and reference groups rather than added to the entry page. The follow-up below changes browser-interface presentation only; no commissioned engine configuration, physical wiring qualification or deployment is supplied.

## Verification

Completed for this revision:

- Jekyll production build with SEO and sitemap plugins.
- Source and built public-content validation, including internal links, images, anchors, metadata, canonical routes, sitemap, and all 318 search destinations.
- JavaScript syntax checks and whitespace checks.
- SVG XML parsing and visual inspection of rasterized updated overview, sensor/switch mosaic and voltage drawings.
- Regeneration checks for diagram, configuration-reference and documentation-index outputs.

The revised browser audit passed locally using installed Google Chrome: 16 public routes at six widths (320–1440 pixels), in light and dark appearance. It also passed topic lookup, the Maximum N1 Speed deep setting link, field filtering, reading-preference persistence, lightbox opening/closing and focus restoration, menu Escape, and JavaScript-free navigation. Every page image loaded and no page-level horizontal overflow or JavaScript errors were found. All generated wiring SVG text bounds were checked. Verification screenshots are included in the local review package.

## Local UX follow-up

- Full setup order now renders as 16 clickable list entries rather than raw Markdown.
- Guided builds use displayed device names, not internal channel identifiers. The reference no longer asks users to enter an internal ID.
- Dry-contact examples show internal pull-up or pull-down options, with the Classic ESP32 GPIO 34–39 limitation and external-bias/noisy-wiring caveats retained. OneWire and I²C bus pull-ups remain separate electrical requirements.
- Level 1 includes focused, configured N1 and MAX31855 Hardware-card captures from the isolated simulator. Shared SPI activation and throttle inversion are explicit.
- Removed the decorative signal-flow animation and the unsimulated design challenge. Level 3 now has supported same-shaft phase-torque and NAU7802 I²C thrust walkthroughs, including bus activation, calibration, expected readings and signal-loss checks.
- Improved DS18B20 resistor spacing and added terminal-labelled torque and thrust diagrams and separate cumulative example GPIO allocations.
- Built locally with portable Ruby 3.3.12 and the Jekyll 4.4.1 build API, SEO and sitemap plugins. No system Ruby installation, firmware changes or GitHub deployment were made.

## Configured examples and newcomer review

- Each of the 20 introduced Hardware channels has a focused configured-card screenshot, including Start/Stop bias, output electrical ranges and advanced safe-state settings. SPI, I²C and current feedback have their own configured views.
- Level 1 now explains web Dashboard references, its fixed 85% approach advisory, independent hard-protection switches and the separate external-display settings. Benign simulated values are explicitly not turbine limits.
- A complete eight-block dummy-load Startup and matching four-block Shutdown show demands, timing and final off states. A temporary Running-only fixed-zero fuel owner prevents a knob demand from returning at handover. This is not an engine startup recipe.
- Level 2 teaches a useful separate-potentiometer bench-light dimmer, including configured input/output cards, controller creation, normalized source units, PWM range, Standby-only ownership and save review.
- Level 3 measures an isolated nominal 12 V battery with an explicitly bounded 0–16 V bench divider, 68 kΩ / 12 kΩ, a fused sensing lead and 100 nF filtering. Real engine-bus transient protection remains a separate design requirement.
- A newcomer browser walkthrough checked the learning path, configured cards and image enlargement. Findings prompted clearer Dashboard-warning navigation, a direct complete-sequence jump, concrete level-selection descriptions, and one shared image/simulator note instead of repeated caption boilerplate. Focused screenshots preserve actual UI fields; none are fabricated mockups.
- Phase-torque optional shaft-speed exports remain unselected in this cumulative example because separate N1/N2 inputs already exist. Physical torque calibration and all engine limits remain pending; illustrative Ready cards do not certify these values.

## Clean presentation and dashboard-value follow-up

- Numeric readings are normal text colour (white in dark themes) or red at the existing critical boundary. Removed the low-limit green/yellow gradient and its transitional tints; cooldown remaining also uses normal text. Status dots and bars keep their distinct meanings. No threshold, controller, telemetry or hard-protection logic was changed.
- Regenerated the compressed ECU web assets and recaptured public interface screenshots. The homepage shows the corrected oil-pressure and battery readings; its preview focuses on the main measurements and controls.
- Reworked the public homepage around four concrete paths: Install, Build step by step, Find a setting and Fix a problem. Secondary interface previews are optional rather than a long default gallery.
- Refined dark/light colours, readable headings, flat cards, spacing, focus states and image borders. Removed repeated page eyebrows and filler from the homepage, README, guide introductions and reference pages while retaining installation requirements and safety instructions.
- Corrected remaining generic-device setup text to match displayed names and automatically assigned internal IDs. Documented numeric colours separately from status dots, advisory bars and hard protection.
- Source and packaged web assets each passed 546 numeric colour, threshold, advisory-switch and theme checks (1,092 total), plus simulated healthy/fault/recovery checks. The broader ECU UI audit passed all 14 groups. JavaScript syntax, source/built validation and the full responsive documentation audit passed again.
- A final newcomer browser review checked the homepage, guided learning entry, optional interface gallery, screenshot enlargement/closing, Maximum N1 Speed search and setting destination, and User Guide. The local browser is left on the User Guide.

At the end of the initial cosmetic review, no physical ECU or turbine test had been performed. The following follow-up supersedes that initial verification scope.

## Sensor displays and explicit Running idle follow-up

- Added green bars and 30-sample, 1 Hz histories to suitable continuous sensor cards. Browser-only auto/fixed ranges include unit conversion, persistence, signed values, unhealthy-input clearing and keyboard/mobile checks. Output bars remain blue; reading values retain white/red semantics. No protection threshold was changed.
- Clarified internal RPM pull-ups and their GPIO/electrical limitations, separated SPI setup from temperature-card setup, corrected calibration ordering, and recaptured pump calibration without theme-transition ghosting. The saved 0% bench minimum is consistent with the caption; Stop is disabled only before a sweep starts.
- Added Running Idle Source: Off, Fixed fuel percentage, Idle input, Automatic feedback and Existing setup (unchanged). Existing files default to the previous source precedence. Fixed replaces retained startup idle only in Running. Off ignores the idle floor and preserves an intentional zero Main Fuel Output low. Nonzero fixed values retain the calibrated reliable minimum. Startup, STOP/fault/shutdown authority and legacy source behavior are unchanged.
- Throttle/idle controller input fields now display 0–100%, while stored configuration stays 0–1. Decimal percentages are not integer-rounded. Input low shows its conditional idle-floor note only when a Running floor is configured. Idle Off and fixed zero omit it. Unrelated edits and built-in card open state survive rerendering.
- Source and compressed-page idle audits passed mode switching, decimal conversion, persistence/reload, preserved edits and 320/390/768/1200 px layout checks. The 12-core-sensor visual audit passed both bundles, including six themes, four widths, unit conversion, faults/recovery and no ECU writes. All 1,092 colour checks and the 14-group regression audit passed again.
- Classic firmware built successfully. Native tests compiled with the installed MSVC compiler and passed real controller/I2C behavior plus new idle-selection and legacy-precedence cases.
- Physically mapped the shared-ground Classic/S3 wiring using temporary input-only weak bias probes, then restored OpenTurbine on COM3 and OTBench on COM5. Tester N1/N2 pulses produced about 5,901/12,000 RPM; STOP asserted and released. Pressure ADC rail stimulus produced 0 → 6.6 bar; this was not physical sensor calibration.
- No-load servo handover test measured Startup about 1,500 µs (50%) in every case. Running measured 1,125 µs (12.5%) for Fixed, about 1,000 µs (0%) for Off, and 1,499 µs (50%) for the legacy retained-sequence setting. Physical STOP returned all cases to the zero-command endpoint. Original engine configuration was restored; DUT Standby, outputs inactive, tester reset.
- Fixed a Classic hardware-save memory failure found during repeated bench configuration changes by lending the no-longer-needed RX workspace during settings serialization. RX ownership stays claimed; the existing guarded reboot/rollback paths remain intact. Repeated hardware/settings fixture saves and original-configuration restoration succeeded afterward.
- All twelve web assets were accepted through the ECU's HTTP update path, including idempotent replay of the first chunk. Built guide pages, search for Maximum N1 Speed, its destination and the new screenshot lightbox were verified in the user's browser. Exact intrinsic PNG dimensions prevent lazy-image layout shifts.
- Final browser checks on 1 October passed a full engine-file download/upload/restore round trip and System page-only and combined saves across reboot. Unsaved-navigation cancellation, exact settings preservation and restoration of the original description also passed. These checks did not command actuators.

These are no-load bench and browser checks, not fuel-pump calibration, turbine testing or full release qualification. No GitHub push or deployment was performed.

## Additional newcomer audit — 1 October 2026

- Found that the new idle controls were absent from the generated field reference/search despite appearing in the illustrated guide. Regenerated from the editable schema: 160 fields plus 165 page/section entries. Generators now have read-only freshness checks, enforced by public validation, to catch this drift.
- An existing browser initially reused old script/search data. Script/style URLs now change with each Jekyll build, and search fetches a fresh index. Verified Running Idle Source and Fixed Running Idle Fuel searches and their expanded reference destinations; the browser audit also tests index reload under long cache headers.
- Added direct common-task links for idle choice, pump minimum, Dashboard scales and engine-file restoration. Added concise troubleshooting for nonzero fuel at low throttle, the deliberately disabled pre-sweep Stop button, and automatic display-scale changes.
- Completed backup/restore instructions with actual System menu/button names, Downloads verification, restore/reboot consequences and post-restore checks. Added a focused Backup & restore card. Corrected old System/N2/protection paths in the repository User Guide and clarified that downloaded backup names need not be changed.
- Added focused phase-torque and thrust calibration panels. Thrust instructions now name Known load, Unit and Capture known load & save; phase instructions explain that Running captures remain in the originating tab until saved in Standby. These are simulator views, not calibration evidence.
- Clarified that disabling automatic feedback alone is not Idle Off, and kept the installation handoff on the illustrated Level 1 path. Updated maintainer instructions for cropped images, exact dimensions and current generator sources.
- Rebuilt the preview and reran source/generated-content validation plus the 16-route browser audit at six widths in light/dark appearance. Search, deep links, all page images, every wiring SVG's text bounds, keyboard/lightbox focus, compact-reading persistence, reduced-motion and JavaScript-free navigation passed. Review captures are under verification/final-doc-audit in the local package.

This pass changed documentation, its search/navigation assets and audit tooling only. Firmware/device configuration was not changed, and no push or deployment was performed.

## Final 2.5.0 pre-push checks — 1 October 2026

- Verified the latest published release is 2.4.3 and current remote main remains the original source baseline, `aec379d1e557521e3f168ca4d9868ef61a31366b`. Bumped firmware, site metadata and README to 2.5.0, added release notes, and refreshed all ECU shared-asset cache keys to `20261001a`.
- The complete local release gate passed: all 16 UI audit programs, 315 safety assertions, the turbine setup matrix, I2C/load-cell support, all eight real native behavior groups, extended sensor protocol vectors, 15 Python release-tool tests, 33 HIL harness tests, Windows Setup Tool Go tests, and Classic/S3 firmware plus LittleFS builds and partition/linker budgets. Native tooling now supports the installed MSVC developer environment with tested flag conversion. A stale unit-label assertion and a fixed-delay calibration-save race in tests were corrected without relaxing their expected values.
- Classic firmware image is 1,664,048 bytes with 39,888 bytes of OTA-slot reserve; mapped static DRAM has 18,680 bytes of headroom. These exceed the existing 32 KiB/16 KiB gate floors, but Classic remains tight and future additions must retain the gates. S3 image is 1,649,008 bytes with 1,496,720 bytes of OTA reserve. Filesystem payload is 385,908 bytes; both targets pass their working-space floors.
- Chromium and WebKit passed the five-width browser matrix. Firefox was downloaded but cannot launch on this Windows host (`spawn UNKNOWN`); the local matrix explicitly skipped it. The required CI matrix remains responsible for Firefox coverage. No security setting was changed to bypass that limitation.
- Real browser firmware OTA upgraded the Classic DUT from 2.4.3 to 2.5.0 in 407 bounded chunks. The updated build returned in STANDBY with outputs inactive; complete Hardware and Settings sections were unchanged. All twelve web assets uploaded successfully, including replay of the first chunk.
- Extended the no-load physical idle proof to Input and Automatic modes as well as Fixed, Off and legacy. RC input endpoints/midpoint produced approximately 10%/30%/50% Running fuel with a configured 10% pump minimum. Automatic N1 feedback raised the floor below target and released it above its cutoff. Startup remained at its separate 50% command; physical PWM and STOP endpoints were verified. Original engine file restored, DUT STANDBY, outputs inactive, S3 tester reset.
- Repeated full engine-file browser download/upload/restore and System page-only/combined saves across reboot on 2.5.0. Exact settings preservation, unsaved-navigation cancellation and description restoration passed.
- Recaptured version-matched public screenshots and rebuilt the preview. Final newcomer browser review caught the obsolete top-of-page SPI-bus location and old switch-default/internal-ID instructions; corrected these and added onboard RPM pull-up guidance to the quick-reference table. Removed a repeated backup instruction. Regenerated the search index and passed source/built-content validation plus the full 16-route responsive/search/image/keyboard/no-JS audit again.
- Prepared a separate local Git review checkout against current main; no commit, release tag, push or deployment was performed. Build caches, native probes and generated Jekyll output are ignored. The local preview serves only its preview root on 127.0.0.1:8765, and the browser is left on the updated User Guide.

These results qualify this local software revision's checks, not an actual engine installation, fuel-pump calibration or fueled operation.

## Selectable idle input and colour review — 1 October 2026

- Separated Running Idle Source from Idle Input Channel. Input channel defaults to Automatic: configured Idle Input; any other fitted input can be explicitly selected. Its low/high endpoints use the source's displayed units, allow reversal and clamp out-of-range readings. Stable IDs preserve the choice after Hardware reordering. Missing sources and equal endpoints block saving; an unhealthy source uses the bounded retained-startup fallback. Startup Idle actions still use the Hardware Idle Input. Source/range changes remain Standby-only, not Developer Mode live tuning.
- Replaced yellow whole-section unsaved glows with local theme-accent field outlines and a small Unsaved label. Actual warning/error colours are unchanged. Added configured automatic/explicit input screenshots, refreshed all setup captures, and updated both User Guides and generated reference/search (163 fields plus 165 section entries).
- Corrected the contradictory RPM wiring-table sentence. Internal pull-up is supported on suitable GPIOs; Classic GPIO34–39 have no internal pull-up/down. The drawing's external resistor remains a valid option. Internal bias is weak, so pulse quality at maximum speed and wiring capacitance still need verification. OneWire and I2C electrical pull-up requirements are unchanged.
- Source and packaged UI audits passed all five modes, percent/engineering-unit conversion, save/reopen, unsaved-change preservation, missing-source/equal-range rejection, six themes and four viewport sizes. The full release gate passed again, including all 16 UI programs and Classic/S3 firmware/LittleFS builds. Classic image: 1,664,832 bytes, 39,104 bytes OTA reserve, 18,656 bytes mapped static-DRAM headroom. S3 image: 1,649,808 bytes, 1,495,920 bytes OTA reserve. Both pass the existing floors; Classic remains tight. Firefox retains the previously documented local launch limitation.
- The wired Classic DUT/S3 tester proved a spare RC input with no Idle-purpose channel, low/mid/high mapping, reversed endpoints, Hardware list reordering, RPM engineering-unit mapping, clamping, disconnected-input fallback and physical STOP. Three invalid settings candidates were rejected without changing settings. Startup remained its separate 50% bench command. A repeat initially missed the brief Startup observation; the final test uses an eight-second observation window and passes without weakening behavior checks. Transient HTTP acknowledgements/maintenance-memory rejections were retried only for idempotent Standby writes. Original Hardware and Settings were restored exactly, DUT Standby with outputs inactive, tester reset. Evidence: physical-selected-idle-input-2.5.0.log/json.
- Rebuilt the preview and passed the responsive documentation audit. In the user's browser, the new screenshot enlarged and closed, and the revised RPM table and input-selection instructions were inspected. No commit, tag, push or deployment was performed.
- The final build returned through real browser OTA in 407 chunks, version 2.5.0/build 9aed1eeafb8ee567. All twelve web assets installed with first-chunk replay. Browser engine-file download/upload/restore passed again with the new neutral idle fields included and existing Hardware/Settings preserved. Cache keys are now 20261001b. Evidence: browser-firmware-idle-source-2.5.0.log, web-assets-idle-source-2.5.0.log, browser-engine-file-idle-source-2.5.0.log.

These remain no-load software and signal-path checks, not engine commissioning or sensor/pump calibration.

## Clear Idle modes and colocated Automatic settings — 1 October 2026

- Running Idle Mode now has four choices: Off, Fixed fuel percentage, Input channel and Automatic Idle. Removed the user-facing legacy choice and duplicate Automatic Idle checkbox. Automatic source, target, band, cutoff and method are immediately below the mode; response tuning and method-specific predictive settings have their own collapsible groups.
- Older files are interpreted for display without rewriting their saved mode or dormant input fields. Existing automatic/input configurations show the corresponding mode. A Startup-retained configuration asks for an explicit mode before Idle edits; unrelated saves preserve its behavior and no fixed percentage is guessed from Startup.
- Missing hardware no longer creates an empty Automatic settings heading. The settings remain visible, inactive controls retain their values, one specific explanation links to Hardware, and saving an incomplete Automatic setup is blocked. Removed obsolete Hardware > Controllers instructions and repeated per-field error copy. The effective fuel range includes the Automatic multiplier, capped at 100%; field help distinguishes that ceiling from Input, Fixed and Off behavior.
- Updated both User Guides, the basic build, troubleshooting, example-system walkthrough, generated field reference/search and configured screenshots. The Automatic capture includes the complete settings card, not a cut-off viewport. Browser review followed the Running Idle Mode search result to its expanded reference and opened/closed the complete configured-card image.
- Source and compressed-page Idle audits cover all four choices, missing hardware, old-file preservation and one-time review, source-specific settings, predictive visibility, stable input IDs, engineering units, save/reopen, six themes and four widths. The complete release gate and 16-route responsive documentation audit passed again. Firefox retains the previously recorded local launch limitation.
- Repeated the wired Classic DUT/S3 tester checks: Startup remained about 50%, Running handed over to 12.5% Fixed, 0% Off or the preserved 50% Startup-retained behavior. Idle input low/mid/high produced approximately 10%/30%/50%. Automatic N1 feedback increased fuel below target and released it above cutoff; measured servo pulses and physical STOP matched those demands. Original Hardware and Settings restored exactly, Standby with outputs inactive, tester reset. Evidence: physical-clean-idle-2.5.0.log and physical-running-idle-2.5.0.json.
- Installed all twelve updated web assets with first-chunk replay, final cache key 20261001d. Firmware behavior is unchanged from the prior 2.5.0 build 9aed1eeafb8ee567. Real-device browser verification checked inferred Input mode, Automatic settings visibility, incomplete-setup rejection and draft discard. Full engine-file download/upload/restore passed again with original configuration preserved.

No commit, tag, push or deployment was performed. These checks do not commission a turbine or validate real fuel-pump/sensor calibration.

## Idle layout polish — 1 October 2026

- Put mode and the applicable fuel ceiling/percentage in one row, replaced the boxed effective-range card with a compact summary, and grouped Automatic fields under Feedback control. The method spans the group rather than leaving an orphaned half-row. Removed inherited divider/padding strips from the nested grids; narrow screens stack fields in reading order.
- Source and packaged UI audits include Automatic pressure feedback across six themes and 320/390/768/1200 px, aligned desktop mode/ceiling, full-width method, no grid divider strips and no overflow. Existing mode, mapping, preservation, validation and save/reopen cases continue to pass.
- Corrected the Hardware Automatic Idle help destination and removed unsupported proven-method wording. Dynamic field help now updates its hover title along with its visible explanation when a mode/source changes.
- Recaptured the configured Idle examples, rebuilt the preview and passed the full responsive documentation audit and release gate. Installed web assets use cache key 20261001f; firmware/controller behavior is unchanged. Browser review checked the pressure layout and screenshot enlargement. This presentation follow-up does not save device configuration. The user's N1 and Pressure 1 input additions since the earlier bench backup are retained, Settings still match that backup, and the DUT is in Standby with outputs inactive. The older Hardware backup was deliberately not restored over those additions.

No further release-blocking UX issue was found in the reviewed Idle and adjacent controls. No commit, tag, push or deployment was made. Previously documented Firefox and engine-commissioning limitations remain.

## Whole-interface clarity review — 1 October 2026

- Hardware usage summaries show named custom controllers rather than internal binding/reference counts. Removal confirmations retain detailed dependency information.
- Calibration labels the idle-input mapping as Mapped fuel demand (%). Sequence help distinguishes startup demand from the Running floor selected in Controllers. Tools identifies Automatic Idle as a temporary runtime override and links to its saved settings.
- Logs show readable events, sequence steps and measurement units, preserving raw identifiers in tooltips and unchanged downloads. The longer logging explanation is collapsed; access prerequisites stay visible. Removed obsolete original-behaviour wording from speed-limit help.
- Refreshed simulated guide screenshots and the static preview. Web assets use cache key 20261001h. These changes do not alter firmware control behaviour.
- Removed duplicated accent strips and inset bottom borders from System maintenance subcards. Six themes at 320/390/768/1200 px pass the border and overflow checks.
- Backup status cleanup no longer hides a subsequent restore failure. Restore errors include the rejected field; an overlong engine description explains the 63-byte UTF-8 limit. Both simulated and real-device rejection checks preserve Hardware.

Final two-board and release verification results are recorded with the local verification artifacts. The owner subsequently authorized publication after final checks.

### Final cache-h bench verification

- The full release gate passed for Classic and S3 firmware/LittleFS builds, UI checks, native behavior and safety tests. The refreshed static preview passed the responsive documentation/browser audit.
- Both boards passed actual browser engine-file download/upload/restore, 16 page loads with mobile checks, and the twelve-file web-asset upload (53 bounded chunks). Asset uploads preserved the complete engine file exactly. Both passed the real invalid-description restore check, retaining the visible error and unchanged Hardware.
- Classic CSV and NDJSON downloads retain raw diagnostic records. System save/reboot and combined save checks passed on both boards in the preceding cache-g round, with unchanged save logic in cache-h.
- One Classic web-asset transfer was interrupted by a network error. The complete asset set was recovered using the bounded uploader; the subsequent real-browser transfer passed. Early example restores were correctly rejected for an overlong description and invalid registry purpose strings; the example was corrected before acceptance. Rejection messages now remain visible.
- Classic is intentionally left with the no-load complex review example, not its previous baseline: ten registry inputs, six outputs, dual RPM, SPI/OneWire temperatures, battery measurement, Automatic idle, oil feedback and separate fan/scavenge controllers. It remains in Standby with outputs inactive. Most configured devices are not physically fitted. The original backup is retained. Starter GPIO15 is an unwired bench example, not a real-board wiring recommendation.
- S3 is restored as the OTBench tester and reset after its DUT checks. No commit, tag, push or deployment was made. Firefox was unavailable locally; these bench checks do not commission an engine or establish real sensor/fuel-pump calibration.

### Long output-binding follow-up

The expanded review example exposed a pre-existing 20-byte binding-key buffer, too short for several built-in names. Binding keys now have a separate 32-byte capacity; channel IDs retain their 20-byte capacity. Loading repairs only the four unambiguous old 19-character prefixes. Overlong keys/channel IDs are rejected rather than silently truncated. Native vectors cover complete JSON round-trips, old-prefix migration, typed compatibility and length rejection. The complex example's complete scavenge binding now survives actual browser restore and reboot on Classic.

The complete release gate passed again (`release-gate-binding-fix-2.5.0.log`). On the final firmware, both Classic and S3 passed engine-file download/upload/restore, the real rejected-description/border checks, 16 page loads with mobile checks, and all twelve web assets uploaded through the browser with the complete engine file retained exactly. S3 CSV/NDJSON downloads also passed. Final board evidence is in `final-classic-binding-browser.log` and `final-s3-binding-browser.log`; the rebuilt documentation audit is `final-documentation-audit-2.5.0.log`.

### Final reconnect, snapshot and electrical checks

- Cache `20261001j` prevents compact telemetry from replacing a dashboard's fitted-channel metadata after reboot. Full metadata is retried after failed or deferred responses; START remains locked while loading and STOP stays available. Source and compressed-asset regression tests exercise startup and reboot failures. The Classic live test recovered without reload after one deliberately failed response and retained complete Hardware and Settings.
- JSON snapshots now own runtime registry strings and oil-loop IDs. Native tests clear the original runtime arrays after serialization and verify that the snapshot remains intact. Actual Classic and S3 System page-only and combined saves preserve the complex configuration across reboot.
- Automatic Idle explicitly shows the base-ceiling calculation (35% × 1.5 = 52.5%). Oil-pressure controller cards expose their enabled state and an individual enable control. Configured screenshots and the guide were refreshed.
- The final local release gate passed all 17 UI programs, 316 safety checks, setup matrix, native behavior/sensor vectors, tooling tests and Classic/S3 firmware plus filesystem budgets (`release-gate-final-j-2.5.0.log`). The responsive documentation/search/lightbox audit passed. Firefox remains unverified on this workstation and is required in CI.
- Classic DUT with S3 tester passed 11/11 electrical smoke checks and 9/9 digital sensor checks on build `baa6c04114e596c4`: PWM, digital outputs, servo timing, RPM, ADC rails, digital input, bounded starter behavior, physical STOP, three SPI thermocouple protocols and HX711 positive/negative/missing-data cases. The MAX6675 tester edge was corrected against its datasheet before the passing rerun.
- On the protected S3 GPIO18 → Classic GPIO35 oil-input jumper, 40 floating samples spanned −1.25 to 1.03 bar. Forty samples each at driven LOW and HIGH were stable at −1.25 and 11.25 bar respectively. Undriven Pressure 1 and battery inputs continued to wander. This verifies the wired ADC path and floating-input explanation, not intermediate-voltage accuracy or a real sensor's calibration. The guide warns to disable unfitted inputs; apparent healthy status is not open-wire detection.

These are no-load software/electrical bench checks, not combustion qualification, precision calibration or a long-duration engine test. Full engine backups and detailed workstation logs are retained privately rather than committed because backups contain the Wi-Fi password. Earlier failed/interrupted runs are retained alongside successful reruns.

Final cache-j verification on both chips passed the live dashboard reboot recovery. S3 additionally passed the complex engine-file install and download/upload/restore, System page-only and combined save, invalid-file rejection, twelve-file browser web upload (53 chunks), 16 page loads with mobile checks and raw CSV/NDJSON downloads. Classic passed the corresponding checks in cache-i plus the final cache-j asset upload/reboot test. Both retained complete configuration through the final uploads. The final public documentation browser audit passed (`final-j-documentation-audit.log`). Passing no-load electrical result summaries are committed under `dev/bench/results/`; complete configuration backups are not.
