# Next software iteration after 2.6.0

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
