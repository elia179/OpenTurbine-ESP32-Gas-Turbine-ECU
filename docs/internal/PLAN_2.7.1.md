# OpenTurbine 2.7.1 — N8R2 and expanded logging

Recorded 8 November 2026. **Implementation in progress on `work/2.7.1-n8r2`; not released or hardware-qualified yet.** The published 2.7.0 firmware/profile remain unchanged.

## Working implementation

- Separate `esp32s3n8r2` Quad-PSRAM image, with explicit logger allocation and internal-RAM fallback; initial N8R2 firmware build passed.
- Expanded capture capped at 1 MiB with at least 256 KiB external reserve, 32-bit capacity and live allocated-budget reporting. Host ring tests pass beyond 65,535 records.
- Expanded captures now preflight their actual rendered CSV size in bounded post-run batches. Older sessions are evicted first; excess oldest buffered rows are reported and removed so limited flash retains the newest shutdown/fault tail. Native tests cover non-consuming size scans, variable row lengths and shrinking archive budgets. Real filesystem/power-interruption tests are still pending.
- PCB v1.0 revision `1.0-20261108` declares the owner's N8R2 choice while preserving source provenance. Reimport from the hashed routing source matches; profile validation passes.
- Setup Tool 0.8.0/package schema 5 selects the matching N8R2 image from the official PCB choice and preserves its identity for updates. Package/profile tests and Go tests pass.
- Owner added controller-UX scope: shutdown protection settings belong in Shutdown & Protection; controller-specific feedback-loss fallback stays with the controller. Oil-circuit and afterburner guards have been moved without changing their stored behavior. Generic controller warnings and obsolete legacy oil warnings are removed; user-facing guides avoid simulator/fixture commentary.
- Initial source and packaged UI tests pass for two independent oil circuits, feedback-loss fallback, save/reload and narrow layout in Chromium, Firefox and WebKit. Full current-tree/release and real N8R2 qualification are still required.
- Current development checkpoint: all three firmware and filesystem images build; their linker/OTA/filesystem margins pass. Native expanded-memory/archive tests, 323 source regression checks, package/profile unit tests, Windows Setup Tool tests, focused source/gzip browser checks and public-content validation pass. A local `2.7.1-dev` package contains Classic, standard S3 and N8R2 images. No device was flashed and nothing was pushed during this work. This is not a full release-gate or HIL sign-off.

## Confirmed target

The owner has changed the fitted module for **OpenTurbine PCB v1.0** to
**ESP32-S3-WROOM-1-N8R2**, superseding the earlier N8/no-PSRAM choice.
This is the PCB target, not merely an optional development-board accessory.

Espressif lists N8R2 as 8 MB Quad-SPI flash with 2 MB Quad-SPI PSRAM.
The module datasheet reserves GPIO35–37 for the octal-PSRAM R8/R16V variants,
not the R2 variant. The earlier N8R8 pin-conflict warning must not be applied
to N8R2. This verifies that distinction, not the whole assembled PCB.

- Keep the name **OpenTurbine PCB v1.0** and verify its existing connector/bus routing against the exact N8R2 module.
- Update the next profile's declared module, revision, expected memory and firmware compatibility together with its generated metadata and Setup Tool package.
- Preserve design-source provenance: the earlier exported BOM specified N8; the owner's new fitted-module choice supersedes that entry without pretending the original design file changed.
- Keep plain development boards and Classic ESP32 supported. Preserve the existing no-PSRAM recording behavior as a fallback.
- Keep the unpublished PCB walkthrough private; revise it for the N8R2 target without presenting future support as already released.

## Implementation work

1. **Boot and package selection.** Configure the pinned S3 platform for Quad-SPI PSRAM explicitly. The present `esp32s3dev` environment deliberately disables PSRAM after an earlier octal-module warm-reboot issue. Prove cold and warm boot rather than simply removing that safeguard. Prefer the simplest reliable installation path; if a separate N8R2 image is needed, the PCB selection should choose it automatically. Audit environment-keyed build scripts, packaging, update compatibility and GPIO restrictions.
2. **Explicit memory ownership.** Allocate the bulk session-capture buffer from detected, usable PSRAM with reserved headroom. Keep control/ISR state, mandatory stacks, DMA descriptors and existing internal network reserves in suitable internal memory. Avoid globally redirecting ordinary allocations into external RAM. Audit cache-disabled flash operations and the logger's critical sections before accessing a PSRAM-backed ring.
3. **Larger bounded recording.** Replace the fixed allocation budget with a validated per-run budget. Preserve compact selected-field encoding, full-float fallback for exceptional values, bounded overwrite/drop reporting and the newest fault/shutdown tail. Allocate once per run, not per sample. Handle absent PSRAM, allocation failure and fragmentation without exhausting internal RAM or making logging a new START interlock.
4. **Capacity arithmetic.** Audit counters and estimates at the larger scale: `_queueCapacity` is currently `uint16_t`; small rows can exceed that range with a megabyte-scale buffer. Check ring offsets/counts, sample timestamps, row/byte conversions and duration arithmetic for overflow. Estimates must use actual allocated memory and the selected fields/interval.
5. **Persistence and export.** More RAM is not more flash. The current 8 MB layout shares a `0x1D0000` LittleFS partition between web assets and saved logs. Account for compact RAM data expanding into exported rows, available archive space, retention and interrupted writes. Keep flushing/export bounded and responsive; protect configuration/web files and make incomplete recording/archive results visible.
6. **User-facing status.** Show detected PSRAM and the recording buffer actually used, a useful estimated recording duration, dropped rows and any fallback reason. Distinguish capture memory from saved-log space. Keep the normal setup simple; avoid exposing allocator/cache implementation details in the user's workflow.
7. **Documentation.** Update the PCB module requirement, profile notes, installer wording and memory/logging guidance for 2.7.1 together. Do not rewrite the 2.7.0 qualification history as if it tested PSRAM.

Potential later use of PSRAM for other large buffers should be assessed separately;
the first requirement is longer, reliable logging without weakening engine-loop,
network or output behavior.

## Release acceptance

- [ ] Exact N8R2 build initializes and reports its PSRAM; the fallback path remains bounded and understandable.
- [ ] Repeat power-on, RESET, software restart, Hardware Save, restore, factory reset, USB installation and Wi-Fi firmware/web updates. No pre-setup stall or boot loop.
- [ ] Qualify the N8R2 PCB-profile configuration and GPIO35–37 assignments. Actual PCB power-stage electrical testing remains a separate future requirement.
- [ ] Long-run recording at minimum/normal intervals and small/all field selections, including exceptional values, buffer wrap and more than 65535 records.
- [ ] Verify elapsed-time/capacity estimates against actual retention and both available RAM and archive capacity.
- [ ] Cover PSRAM absent/failure, allocation failure, low internal heap, full flash, saved-log retention, STOP/fault tail, interrupted flush and exports.
- [ ] Browse, save/restore and transfer large files while recording; measure control-loop timing and physical PWM/servo behavior on an unloaded fixture.
- [ ] Recheck Classic and no-PSRAM S3 behavior, existing engine-file compatibility and matching firmware/profile selection in the Setup Tool.
- [ ] Keep the 2.7.1 status planned until implementation and the relevant real N8R2 tests pass. Do not claim physical qualification from simulated or host-only tests.

## Evidence and references

Source observations: `platformio.ini`; `tools/pio_s3_dynconfig.py`;
`src/system/SessionLogger.cpp` (`SESSION_QUEUE_BYTES`, `_queueCapacity`, allocation,
ring access and exported capacity); `src/system/SessionCapture.h`;
`partitions_8mb.csv`; the current official PCB profile.

- [Espressif WROOM-1/1U datasheet v1.8, tables 1-1 and 3-1](https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf)
- [ESP-IDF external RAM allocation and restrictions](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/external-ram.html) — also verify the APIs/configuration against the project's pinned SDK when implementing.
