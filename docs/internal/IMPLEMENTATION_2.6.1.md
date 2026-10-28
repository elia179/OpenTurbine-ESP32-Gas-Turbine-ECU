# 2.6.1 local implementation — 28 October 2026

Status: implemented and checked locally; **not released, flashed or qualified on the new PCB**. The user selected ESP32-S3-WROOM-1-N8 (8 MB flash, no PSRAM) with the existing routing and confirmed all components will be fitted. Plain development boards remain supported without a profile.

## Delivered behavior

- Setup Tool 0.7.4 immediately consumes Continue, shows reconnect/identity/file progress and elapsed time, retries transient GET failures within deadlines, and offers verification-only retry after successful uploads. Firmware target/version/build and every web asset still require exact comparison. A wrong identity or byte mismatch is never accepted. The original intermittent Windows/network failure has not been reproduced on hardware.
- Expanded compound sequencer blocks show actual fitted output names and logical commands, grouped by entry, running and exit phase. One resolved-command model also feeds the final recap. ImmediateCut includes additional registry-defined hazardous outputs and explicitly retains lubrication. The afterburner preview no longer invents valve/pump commands for ABIgnite.
- System initially opens its three main sections; manual collapsing survives internal rerendering.
- One shared short-viewport scroll policy covers Hardware, Controllers, System and Sequence save bars. Scrolling down compacts the controls, scrolling up restores them, and persistent touch targets restore search/save controls. Focus, active saves, dialogs and visible errors keep controls available. Dirty state is not changed.
- Optional dedicated Fault LED configuration supports native GPIO on Classic/S3 and fixed TCA9534/TCA9554 endpoints on S3 profiles. It takes fault blinking from the Status LED; absence retains legacy fault blinking. Fixed indicators share the expander latch with input pull-up controls without overwriting one another.
- New board profile maps the supplied export, including external ADC reference, thermocouples, conditioned pulse inputs, external pull-up controls, both indicators and shared output-enable. Outputs stay gated through initialization, including installations with no servo channels.
- Format 1.1 PCB capabilities require S3 and a 2.6.1-or-newer package in Setup Tool. Classic retains format 1.0 profiles. The new Setup Tool is the minimum version for the new package.
- Web cache key updated to `20261028a`.

## PCB artifact and reproducibility

[Profile](../../pcb_profiles/official/openturbine-s3-20261028.otpcb.json) and [routing/assembly notes](../../pcb_profiles/official/openturbine-s3-20261028.md).

`tools/import_openturbine_pcb.py` reads the supplied EasyEDA archive as data, checks its source fingerprint and component pad nets, and leaves it unchanged. Regeneration matched the checked-in JSON byte-for-byte. The input SHA256 is `29f260f731b2d72e9c8ff08bcb7c71bdce4a03e769cc2c65b509bc37a70b4eda`.

## Local evidence

Ignored detailed logs are under `artifacts/`; they are workstation evidence, not substitutes for physical tests.

| Check | Result / log |
| --- | --- |
| Classic firmware + LittleFS | Passed; `build-261-classic.txt`, `fs-261-classic.txt` |
| S3 firmware + LittleFS | Passed; `build-261-s3.txt`, `fs-261-s3.txt` |
| Existing release memory/storage margins | Both passed; `budget-261-classic.txt`, `budget-261-s3.txt` |
| Native behavior runner | All 25 programs passed, including I2C latch/recovery and Classic/S3 LED lifecycle; `native-261-final.txt` |
| Safety regressions | 318 checks passed; `safety-261-tests.txt` |
| Profile validator | 12 tests passed; `profile-261-tests.txt` |
| Setup package staging | Passed; `package-261-tests.txt` |
| Go Setup Tool suite and Windows build | Passed; `setup-261-tests.txt`; local unsigned executable |
| Focused new UI behavior | Passed, including optional Fault LED discoverability, output-only GPIO selection and save recap; `ui-261-tests.txt` |
| Sequence placement/recap | Chromium/Firefox/WebKit, source and gzip passed; `sequence-261-final.txt` |
| Beta browser audit | 14 groups passed after cache-key update; `beta-261-final.txt` |
| Broader browser suite | First 17 programs passed before a WebKit warning visibility timing assertion failed. The assertion now waits for visibility; that audit passed in all three engines/source+gzip. All 28 remaining programs passed. Logs: `ui-261-full.txt`, `dashboard-261-retest.txt`, `ui-261-remaining.txt`. This was resumed coverage, not one uninterrupted suite run. |

The Classic image is 1,670,736 bytes, leaving 33,200 bytes in its OTA slot (required reserve 32,768). S3 is 1,657,648 bytes, leaving 1,488,080 bytes. The filesystem source payload is 442,964 bytes. Static DRAM headroom is 17,912 bytes Classic and 148,136 bytes S3. Existing reserves and partition sizes were retained. Shared adapter lookup and validation cleanup reduced duplicated flash code without removing checks.

Build IDs: Classic `268cf1be3900e35d`; S3 `b1668964bf92625e`.

## Before release / physical qualification

- Review the new UI on the user's actual short-screen device.
- Repeat real Wi-Fi updates on stopped Classic and S3 boards: both reconnects, delayed AP return, wrong Wi-Fi, transient reads, verification-only retry, backup preservation and support logs.
- On the assembled N8 PCB, verify boot/reset output gate levels, power-only and pulse-only configurations, all output polarities, both LED pins, independent pull-up controls, I2C recovery and ADC scaling against measured voltage.
- Check both thermocouples, all pulse inputs and outputs, start/stop, serial routing and battery divider against the actual fitted components.
- Run the release gate, package/signing and user approval process after those checks. Do not publish this local build as a qualified release yet.

No live ECU configuration, flash, start command or actuator test was issued during this implementation.

## Readiness audit after the first local review

A second comparison with firmware found and corrected preview-only gaps:
ABIgnite retains ignition until ABFlameConfirm releases it; OilPrime releases its
optional scavenge pump on exit; no-input ModifiedIdle starts at the calibrated
minimum before its multiplier; idle previews read the shared idle ceiling.
Linked physical outputs now receive their own command cards and unwired outputs
are excluded. Oil-control cards show their pressure targets.

`tools/ui_261_command_model_audit.cjs` covers these cases in Chromium, Firefox and
WebKit against source and gzip pages (`artifacts/commands-261-audit.txt`). The
focused follow-up, sequence placement/recap and safety checks passed again.
Setup Tool tests also cover delayed readiness and immediate rejection of stale
asset bytes without a write or content-mismatch retry. These changes do not
alter sequencer firmware behavior or the application build IDs above.

Physical work is prepared in [QUALIFICATION_2.6.1.md](QUALIFICATION_2.6.1.md).
No chip or assembled-board result is inferred from host/browser tests.

The final placement audit exposed an intermittent WebKit test timing issue: it
asserted the pending-card count before the asynchronous telemetry-backed render
completed. The audit now waits for initial cards and the expected pending-card
render; all three browsers/source+gzip passed afterwards. This changed test
synchronization, not the product's placement behavior.

## Scroll controls and nearby usability review

The shared short-screen policy now restores Save beside the current field on
all four pages, including layouts whose ordinary save bar is inline. Dynamic
bottom clearance keeps the last field reachable. Clean pages have no redundant
Save shortcut; unsaved edits keep the compact affordance. Passive focus on the
restored bar does not pin it forever, while focused controls, saves, errors and
visible dialogs keep controls available. Passive layout updates no longer
restart the explicit-reveal delay.

Search restoration focuses the actual search input and returns it into view on
narrow layouts. System instead offers Page controls, since its search UI is
hidden. The shortcut remains reachable when those controls are off-screen.
All legacy channel/block dialogs participate in pinning, and floating controls
stay below dialog layers. Save-error text is visible in narrow layouts.

The review also found WebKit allowing long native option labels in Hardware's
advanced link fields to widen the page. Selects now fit their field; the advanced
field container clips intrinsic horizontal overflow without changing the values
or options.

`tools/ui_scroll_controls_audit.cjs` passed 48 page/viewport/engine/asset cases:
Hardware, Controllers, System and Sequence at 1024x600 and 390x600, Chromium,
Firefox and WebKit, source and gzip. Cases cover restoration position, focused
controls, dirty/clean state, visible errors, real recap/custom-dialog backdrops,
content clearance, horizontal overflow, and normal controls on a taller desktop.
Logs: `scroll-controls-261-tests.txt` and
`scroll-controls-261-packaged-tests.txt`. The focused follow-up and 318 safety
checks also passed. Both rebuilt filesystems and existing resource budgets pass.
Actual touch/keyboard behavior on the user's tablet remains a physical review
item; no live ECU writes were made.
