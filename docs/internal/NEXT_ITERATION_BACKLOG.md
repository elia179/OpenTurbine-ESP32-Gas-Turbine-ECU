# 2.6.1 follow-ups � implementation and qualification

Local implementation is recorded in [IMPLEMENTATION_2.6.1.md](IMPLEMENTATION_2.6.1.md).
The reports, source observations and acceptance lists below are the original
pre-implementation record. Their unchecked boxes must not be read as current
implementation status. Physical-board and real Wi-Fi update qualification remain
open; no 2.6.1 release has been published.

## Setup Tool Wi-Fi update: final reconnect appears stuck

Recorded 24 October 2026. Open for the next software iteration; investigation only, no released executable or ECU behavior changed.

### User report

During a Wi-Fi update, **Reconnect for final verification** appeared stuck. Clicking **Wi-Fi connected, continue** did not visibly advance it. One attempt failed; a second eventually completed after a long interval with seemingly nothing happening. Exact executable build, error message and board target for these attempts are not confirmed. Do not mark the intermittent failure reproduced from this report alone.

### Confirmed from source

- `tools/setup_tool/main.go`, `Job.runExistingUpdate` final step: after `waitContinue`, the job calls `waitForECU(75 * time.Second)` and `verifyUpdatedECU` without changing the waiting screen to a running/checking screen. The prompt and button can remain visible after the click was consumed.
- `verifyUpdatedECU` checks firmware identity and then each web asset sequentially. Each identity/asset request has an 8-second timeout. It provides no per-file progress, elapsed time or intermediate log entries. Reconnect polling plus verification can therefore produce a substantial silent wait; there is no single overall deadline covering both phases.
- `waitForECU` probes `/` and accepts any HTTP status from 200 through 599 as reachable. This does not prove that the correct OpenTurbine identity or web assets are ready. The request context is cancelled before the response body is drained; review this handling rather than treating it as a confirmed cause.
- Final identity/file verification is single-pass: a transient read error after the reachability probe immediately fails the update. The final reconnect failure currently recommends rerunning the whole update, even when uploads may already have succeeded.
- Local standard Setup Tool log/backup locations were inspected read-only; only older September logs were found, so neither reported attempt has been diagnosed from a matching log.

The missing UI transition/progress is confirmed. The failed attempt's network/HTTP cause remains unconfirmed.

### Required next-iteration work

- [ ] Immediately acknowledge Continue: replace the reconnect prompt with a running state, consume/disable the button, and prevent repeated clicks from queuing future continuation events.
- [ ] Distinguish waiting for Wi-Fi/ECU, checking firmware identity, and verifying dashboard file **n of total**, with elapsed time and bounded retry status. Keep the interface responsive and provide useful cancellation/retry behavior.
- [ ] Require valid OpenTurbine identity/readiness before advancing; distinguish wrong network/device, HTTP failures, reboot readiness and transfer/verification errors.
- [ ] Add bounded retries for transient reconnect/read failures, with a defined overall timeout. Preserve mandatory target/version/build and complete asset-content comparisons; never turn a mismatch into success.
- [ ] Offer **Retry verification** after uploads have succeeded, without automatically repeating firmware/dashboard writes. Preserve the engine-file backup and avoid duplicate writes after ambiguous responses.
- [ ] Record timestamps, retry counts, HTTP/transport errors, firmware identity and per-asset verification durations/results in the support log. Avoid logging configuration secrets.

### Acceptance evidence before release

- [ ] Simulate delayed AP return, Windows remaining on another network, stale connections and a request failing after the first successful probe. Confirm visible progress and recoverable outcomes.
- [ ] Cover double-clicks, early Continue, cancellation, timeout, wrong identity, HTTP error responses, partial/mismatched assets and verification-only retry. Verify no false success or duplicated upload.
- [ ] Repeat real Wi-Fi updates on Classic ESP32 and ESP32-S3, including reconnect after both reboots and final verification. Check saved configuration/calibration preservation and inspect the resulting support log.
- [ ] Verify that the user can tell whether the tool is waiting for input, waiting for the board, actively checking files, finished or failed throughout the final step.

Do not reflash, rewrite configuration or reproduce on a live engine without a separately authorized stopped-bench session. The current report requests investigation and retention for the next iteration.

## Sequencer: show the individual actions inside compound blocks

Requested 24 October 2026 for **2.6.1**. Open; no sequencer implementation changed yet.

### Intended behavior

Opening **Immediate Fuel and Ignition Cut** should show individual action cards inside the parent block, using the installed outputs' actual names. A typical installation would show **Main Fuel Metering → 0%**, **Fuel Shutoff → CLOSED**, **Main Igniter → OFF**, **Starter → 0%** and **Starter Enable → OFF**. If secondary ignition, glow, secondary fuel or afterburner outputs are fitted, show each affected output separately. A general sentence about cutting ignition is insufficient to identify which devices are commanded.

Keep the parent block compact when collapsed. Its expanded contents should use the normal sequencer action-card style and make the concrete commands easy to inspect. Fixed protective actions remain part of the parent block, rather than becoming extra user-placed blocks or removable shutdown commands. Show commands as commands, not as proof of measured electrical output state.

### Source evidence and scope

`src/engine/sequencer/blocks/ImmediateCut.h::onEnter` clears main fuel demand, fuel shutoff, both igniter flags, glow demand, starter demand/enable, secondary fuel demand and afterburner valve/pump demand. It also clears relight/flame-monitor state and oil pressure targets. **It deliberately does not zero the oil-pump output**: retained lubrication through rotor slowdown must not be represented by an invented Oil Pump OFF card. Explain relevant retained behavior separately.

`data_src/sequence.html` already models several compound commands for the final-state recap, including ImmediateCut. Review and reuse a common resolved-action representation where possible, with tests against actual firmware behavior; avoid another independent list that drifts from runtime or the recap.

- [ ] Add expanded per-output action cards for ImmediateCut, resolving registry names, fitted ignition sources and output types/polarity into clear logical values (percent, OFF or CLOSED).
- [ ] Review **every compound block** for the same treatment, including oil prime, starter/spool steps, final startup checks with optional release actions, cooldown/final stop and afterburner ignition/stabilization/shutdown steps. Show only actions that block actually takes under the selected options.
- [ ] Distinguish entry actions, commands maintained while waiting, and exit/release actions where they differ. A sensor wait alone must not appear as an output command.
- [ ] Account for selected targets, additional named outputs, linked outputs, controller ownership and custom entry/exit actions so the displayed behavior is complete and not contradictory.
- [ ] Unfitted devices should not produce misleading action cards. Missing required assignments must instead have a clear, actionable explanation.
- [ ] Preserve the existing protective semantics and saved sequence format unless a separately justified change is required. This request primarily makes existing compound behavior visible.

### Acceptance evidence

- [ ] Compare expanded actions with firmware commands and the final-state recap across Classic/S3 profiles: primary ignition only, secondary ignition/glow, auxiliary fuel/afterburner, renamed channels and absent optional hardware.
- [ ] Check conditional entry/exit settings, normal controller ownership, lubrication carry-through and shutdown end state. No card may imply that ImmediateCut stops the oil pump.
- [ ] Verify compact collapsed cards, readable expanded subcards and mobile layout, with no extra blocks the user must place or save.

## System page: expand all three main sections on entry

Requested 24 October 2026 for **2.6.1**. Open; no implementation changed yet.

On opening **System**, automatically expand all three main cards: **Identity & access**, **Connections & runtime**, and **Maintenance**. Currently only Identity & access opens. Users should immediately see the contents of all three rather than having to discover the collapsed sections.

- [ ] Apply the expanded default on initial load, navigation back into System and page reload. Keep manual collapsing available while the user is on the page.
- [ ] Do not automatically expand every nested advanced setting or execute maintenance actions; this request concerns the three top-level cards only.
- [ ] Check desktop/mobile layout and direct links into each section. Expanding sections must not change or save ECU configuration.

## Landscape/tablet space: shared scroll-aware search and save bars

Requested 25 October 2026 for **2.6.1**. Open design follow-up; no UI implementation changed yet.

The Controllers page's sticky search/filter workspace and bottom save bar can leave only a narrow strip of usable content on a landscape tablet. Resolve this by viewport **height** as well as width, and apply the same save-bar behavior throughout the application.

### Preferred interaction

- Scroll down to read/edit: collapse the large heading/search/filter workspace to a compact page heading and collapse the bottom save controls. With unsaved changes, keep a small, clearly labelled **Unsaved changes · Show save controls** strip rather than losing all indication of pending edits.
- Scroll up a short, deliberate distance: reveal the full search/filter and save controls immediately. Tapping the compact heading/search affordance or unsaved strip also reveals the respective controls; reveal alone never saves or discards anything.
- At the page top, show the full workspace. At the bottom, make save controls available. Initial navigation should not open with controls mysteriously hidden.
- Keep controls visible while their search/input/button has keyboard focus, a save/confirmation is in progress or an error needs attention. Keyboard focus navigation must reveal hidden controls. Do not slide the search box away while typing.
- Use direction thresholds/hysteresis so tiny scroll movements, touch bounce, programmatic field jumps and orientation/keyboard changes do not make the bars flicker. Respect reduced motion and avoid content jumps or obscured focused fields.
- Prioritize compact behavior on short viewports, especially landscape tablets; preserve comfortable desktop behavior when vertical space is ample. The user must always have an obvious non-gesture way to bring controls back.

### Implementation scope and acceptance

- [ ] Use one shared behavior for all persistent save bars, including Hardware, Controllers/Config, System and Sequence (`.save-bar` / `.seq-save-bar`), rather than separate page-specific scroll hacks. Ordinary inline calibration/action buttons are not floating save bars.
- [ ] Coordinate Controllers' sticky workspace with the shared header/save-bar heights; account for the existing navigation bar, safe-area insets and scroll-to-field offsets.
- [ ] Preserve dirty counts, errors, save/discard/recap semantics and unsaved-navigation warnings. Collapse is visual only and must not write configuration or discard state.
- [ ] Verify landscape tablet, portrait phone, short desktop window, browser zoom and on-screen keyboard; cover touch, wheel and keyboard scrolling, field deep links, long cards, page bottom, orientation changes, validation failures and active saves.
- [ ] Measure the recovered content area and check that no fields are trapped behind bars. Confirm the behavior is consistent on every page with a persistent save bar and that the unsaved strip remains readable/tappable.

## Optional dedicated Fault LED alongside Status LED

Requested 28 October 2026 for **2.6.1**. Open; no implementation changed yet.

Add an optional, separately configured **Fault LED** in addition to the existing Status LED. When the Fault LED is fitted/enabled, route the fault blink indication to it and suppress fault blinking on the Status LED; the Status LED continues its ordinary status indication. Without a fitted/enabled Fault LED, retain the existing Status LED fault indication for backward compatibility. This is a separate physical indicator, not a replacement for the existing Status LED.

- [ ] Provide clear Hardware configuration for the Fault LED's GPIO and electrical polarity, with appropriate pin validation and an inactive safe state. Do not allocate a pin or assume an additional LED exists in old configurations.
- [ ] Reuse the existing fault blink meaning/pattern on the dedicated indicator. Avoid duplicating fault blinking on both LEDs when the dedicated LED is configured.
- [ ] Keep the Fault LED inactive when no fault indication is required; clearing the fault must clear its indication according to the existing fault lifecycle.
- [ ] Review `src/platform/esp32/StatusLED.h` and Hardware configuration persistence together. Cover normal status behavior, existing RGB/status LED options, reboot and configuration changes.
- [ ] Test Status LED only, both LEDs, Fault LED only and neither fitted on Classic ESP32 and ESP32-S3; check fault entry/clear, polarity, pin conflicts, save/reload and old engine-file compatibility.
