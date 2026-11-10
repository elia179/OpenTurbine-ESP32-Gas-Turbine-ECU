# 2.7.2 development — oil navigation and compact controls

Based on published 2.7.1. The final 2.7.2 images and web assets have been flashed to the unloaded Classic and S3 development-board fixture for review. Release preparation follows the completed bench and user review.

- Appearance offers a browser-local automatic-scroll option. Off keeps all four settings-page bars compact, at all viewport heights, until the persistent bottom Show controls button is pressed. Scrolling, resizing, hash navigation and validation do not reopen them. Hide controls collapses them again. The button retains dirty-state information.
- Removed the boot warning that unconditionally compared dormant legacy oil.map_min and oil.running_min. Full telemetry now reports conflicts against enabled, valid named oil loops and their enabled low-pressure responses. Fixed targets use the fixed value; mapped targets use the lowest endpoint. Each warning links to that pump's actual controller and protection.
- Dashboard oil settings links separate running target, running protection and startup minimum. Named oil faults link to their affected loop using the recorded pump index rather than matching editable names.
- With active named oil regulation, the general oil-protection card is switch-specific and no longer offers the analogue threshold ignored by that regulator. Named circuit thresholds remain under Shutdown & Protection.
- Saved oil definitions that lack an available pump are visible and removable. Recreating a controller allocates an unused ID after removal.
- Sequence links reveal startup pressure fields instead of pointing to an absent legacy controller field. Search filters are cleared when following an exact controller deep link.
- User guide, website guide and documentation search index updated. No thresholds or engine hardware settings changed automatically.

Validation: new manual-controls/oil-navigation audit in Chromium, Firefox and WebKit, source and compressed assets; existing automatic-scroll audit across four pages and desktop/mobile widths; two-oil-circuit protection/fallback/save-reload audit, source and compressed assets; protection navigation audit; public-content validation; firmware builds for Classic, S3 and S3 N8R2. Final status is recorded in the chat; this is focused development validation, not a release gate or physical PCB qualification.

## Warning-policy follow-up

- Inline and save-dialog oil comparisons now share one valid-enabled-loop selection and use only that loop's own enabled response/threshold. They do not combine the obsolete general limit with the named loop threshold. Missing inputs/outputs, changed purposes, mirrors, missing/disabled activation and inactive master settings are covered.
- Independent windmilling protection may reuse a valid enabled pressure-loop definition even while the normal-control master is off, matching runtime ownership. Its dependency checks therefore use configured loops rather than normal active ownership.
- Current Dashboard conflicts are sent in regular telemetry and clear at the next update. Firmware also skips named loops' ignored general-zero-limit warning.
- Removed the old global-polynomial calibration diagnostic: it cannot establish whether a named input's independent calibration is valid. Runtime low-pressure and feedback-loss protections remain unchanged.
- Startup cross-checks require the relevant sequence steps. Links reveal exact existing steps, or explain that a retained setting has no step in the current sequence.
- Save-dialog navigation preserves same-page drafts, clears filters to reveal the destination, and retains the cross-page unsaved-change guard. Boot limit notices link to the named field(s), including both values in a cooldown comparison.
- Added a dedicated warning-policy audit (22 eligibility cases across three browser engines and source/compressed bundles), plus same/cross-page dialog links, hidden-field reveal and present/absent startup destinations. Existing firmware issue/inline-route navigation and Dashboard warning-layout audits remain required.

Pressure warning comparisons use the same float32-to-integer-centibar representation as firmware, avoiding disagreements for values entered between field step points. Missing-oil-prime advice now requires a fitted oil pump; a standalone Final Startup Checks block no longer generates the inaccurate claim that the starter will run indefinitely.

## Further consistency review

- Pre-start temperature comparisons use one canonical Celsius policy for both inline and save warnings, compare only against enabled startup protection, and correctly handle C/F and separate immediate/timed guards. A zero disabled display limit no longer fails the warning-margin check.
- Inline warnings no longer reopen cards on every edit. Closed groups/protection cards show warning-count badges; clicking warning links still explicitly reveals the field. Verified at 390, 800 and 1280 px, with screenshots under ignored artifacts/272-ui.
- Dashboard fault links now identify speed/pressure/temperature/supply limits, startup limits/steps, oil feedback settings, or the relevant Hardware section. PCB faults open bus diagnostics. Generic LOW_OIL/OIL_ZERO faults point to the general protection, independently of retained disabled pump-loop definitions.
- New warning-consistency audit covers 20 temperature/unit cases and 23 Dashboard fault destinations per source/packaged/browser combination, with actual Dashboard clicks and nested-card visibility checks. The configuration audit's obsolete oil field destinations were updated to the semantic links; its direct-link assertion now permits pump-specific links alongside generic validation links.

## Final verification, 2026-11-10

- All 68 UI audit programs passed, alongside 323 safety checks, the 17-engine setup matrix, I2C audit, public-content validation, Python release/harness tests and Windows Setup Tool tests.
- Classic, generic S3 and S3 N8R2 firmware/filesystem builds passed partition and memory-budget checks.
- Windows Application Control intermittently refused native test executables (error 4551); the monolithic release command therefore did not finish in one run. All 37 behavior programs were instead covered by 30 passing WASI executions and seven passing S3 executions. The complete JSON snapshot ownership/streaming/concurrency program also passed on S3 and subsequently on Windows. Independent MAVLink decoder checks and extended sensor vectors passed. Windows security settings were not changed.
- Final-version browser sessions passed on Classic (407 seconds, 23 navigations, two persisted settings saves) and S3 with the valid PCB profile (347 seconds, 23 navigations). Both exercised complete engine-file download/restore. Expected configuration-save/restore reboots were distinguished from unexpected resets; bounded wireless read retries recovered to Connected.
- Both original engine configurations and all 12 served web assets were verified after the sessions. The physical OpenTurbine PCB and exact N8R2 module are unavailable: profile/UI qualification does not qualify their electrical behavior or exact-module PSRAM boot.
- Additional Classic firmware checks temporarily configured one oil-pressure circuit while stopped. Disabled master, disabled loop and disabled low-pressure response produced no conflict; an active 3.6 bar target with a 4 bar circuit limit produced exactly that warning despite a different dormant legacy limit. The original engine file was restored and verified afterward; no engine-start command was used.
- The user approved the final UI and authorized publication after these checks. Private device backups, test profiles, screenshots and logs remain under ignored artifacts.
