# External MAVLink replacement — approved scope, 28 October 2026

Replace the old OTC wire protocol with MAVLink for engine operation and live
monitoring. This is ongoing implementation work, not a qualified release.
The connected Classic remains on the prior review build until the replacement
passes its gates. Do not publish or flash an incomplete interface.

## Product contract

- One connection in Hardware/System, with TX, optional RX, baud, data rate,
  system/component identity, command permission, permitted controller identity
  and remote-input timeout. TX-only remains a valid monitoring installation.
- Commands: engine Start, normal Stop, fault acknowledgement/clear and fitted
  afterburner start/stop. Explicit actions, no toggle commands. No log operations,
  reset peaks, configuration writes, actuator tests or protection bypasses.
- MAVLink throttle is a virtual controller input, normalized internally and shown
  as 0–100%. Merely receiving it does not choose it or start the engine. The
  existing controller mapping and input-loss policy apply when selected.
- Data includes fitted primary and additional named channels, units, values,
  health, display references, engine/fault/sequence state and output/controller
  state. Failed readings must never be mistaken for fresh healthy values.
- The Cluster client/example and an ArduPilot integration example ship together.
  ArduPilot's EFI backend consumes standard EFI_STATUS; custom engine controls
  and richer channels require the supplied integration, not an assertion that
  unmodified ArduPilot forwards/implements all commands automatically.

## Wire and implementation

Use generated MAVLink 2 C bindings and matching Python definitions from pinned
pymavlink 2.4.50. Select standard messages without changing their layouts/CRCs:
HEARTBEAT, COMMAND_LONG, COMMAND_ACK, EFI_STATUS, STATUSTEXT and the existing
NAMED_VALUE_FLOAT compatibility stream. Add project-specific metadata, batched
channel values, engine state, catalogue request and normalized remote input
messages. Project-local message IDs must be checked against the pinned dialects;
they are not represented as an upstream-allocated public dialect range.

The generator is a development dependency. Checked-in bindings allow ordinary
firmware and receiver builds without Python or a network connection. Preserve
the upstream/generated library license and record input hashes. Decode with
bounded buffers and per-tick byte budgets; do not allocate a packet per reading.

Registry keys identify signals independently of display names. Numeric IDs are
scoped to their catalogue revision. Registry channels
have distinct IDs even when their purposes match. Catalogue revision and ECU
boot identity accompany data. The client requires complete metadata before
mapping values, rejects incomplete/out-of-range batches, and expires readings
independently of heartbeat. A reconnect clears stale schema/value validity and
refreshes capabilities; unknown future messages/fields are ignored.

Standard engine control maps supported MAV_CMD_DO_ENGINE_CONTROL parameters to
Start/Stop. Unsupported delayed/choke/options requests are rejected explicitly.
OpenTurbine fault acknowledgement and afterburner operations use a documented
user-command mapping. Target and configured sender checks precede every action.
Command permission is disabled by default; identity filters are not advertised
as cryptographic authentication. Signed packets must not be accepted as verified
without signature verification; unsigned wired operation must be explicit.

Commands pass through the existing core command boundary, including maintenance,
readiness, STOP, phase and fault restrictions. Report the core's result, not just
successful queue insertion. Stop retains priority. Pending requests have bounded
lifetimes. Duplicate requests return their prior result rather than repeating
an action; reconnect never causes automatic Start or replays a queued request.
Requested state and achieved engine state remain distinct.

Remote-input freshness is based on valid demand samples, not heartbeat. Only the
configured sender may refresh it. Reject non-finite/out-of-range values and old
samples; values from a different source cannot silently take ownership. Selecting
another source is a configuration action. Timeout makes the input unhealthy and
lets the configured controller's existing loss handling act. No automatic source
fallback is introduced.

## Configuration and migration

Consolidate the current Cluster and MAVLink cards into one MAVLink card. Preserve
physical wiring and rates where possible when migrating old engine files, but
never automatically enable remote engine commands. If both old links were active
on separate UARTs, report the conflict and require an explicit connection choice;
do not silently drop an operating link. Existing PCB profiles need RX resolution
for their MAVLink UART. Plain development boards remain profile-free.

Remove OTC sender/parser/client/example and obsolete public setup instructions
only after the new sender/receiver pair passes its tests. Preserve old profile
parsing only where needed to interpret physical routing; it must not retain a
second wire protocol. Review package/tool/schema compatibility and update guides.

## Gates

1. Generated standard frames independently decode with pymavlink.
2. ECU and receiver round-trip catalogue, batched values, state and commands.
3. Malformed CRC/length/targets, unsupported commands and invalid throttle cannot
   change output demand or refresh validity.
4. Lost ACK, duplicates, missing metadata, reboots and stale inputs are tested.
5. Host engine-boundary tests prove rejected requests cannot be ACKed as success.
6. Source and packaged UI tests cover intuitive setup, unavailable RX and input
   selection, migration, no-op edits and input-loss explanations.
7. Both chip image/RAM/filesystem budgets retain their current reserves.
8. Actual UART no-load testing on both targets and a receiver/client precedes
   claims of hardware qualification. The assembled PCB remains a separate gate.

## Implementation and evidence, 29 October 2026

The legacy transport and receiver are removed. The generated MAVLink dialect,
ECU service, registry catalogue, reusable Cluster receiver and console/ArduPilot
companion example are implemented. One connection card now owns the UART,
permission and identities; throttle is an explicitly selected controller input.

No-load wired tests passed with both Classic ESP32 and ESP32-S3 acting as the
ECU, and the other board running the matching receiver. They covered permission
off/on, Start, normal Stop, 25%/50% mapped demand, physical servo pulses, input
expiry, a controller-requested fault and remote fault acknowledgement. A real
boot test found and fixed a stale load-time sensor ceiling that disabled the
new virtual input. Loading and full engine-file restore now retain the rule.
Both targets matched all twelve served web files and downloaded/restored their
complete engine file. The S3 also passed tablet/phone touch browser checks.
Private raw backups, test fixtures, serial captures and transfer evidence are
under ignored artifacts/mavlink-hardware; never publish engine files or Wi-Fi
credentials from that directory.

Generated standard frames and actual compact ECU packets independently decode
with pymavlink. Native client, service (both platform definitions), catalogue,
migration, command queue and controller integration checks passed. Source and
packaged MAVLink setup/input-loss UI checks passed in Chromium, Firefox and
WebKit; the 318-check safety audit passed. Both ECU images, receiver examples
and constrained-memory budgets passed without reducing the Classic reserves.

Windows Application Control blocked an unchanged native log probe locally.
Independent CI subsequently passed the full native behavior suite and Windows
Go tests; [run 40833524099](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/40833524099)
records those passes. Later branch runs repeat both independently. The companion
console also has deterministic tests for explicit ArduPilot throttle selection,
wrong-source rejection, disarming, invalid PWM, stale output and ECU reboot;
resumption requires another explicit selection.

The Classic keep-setup update completed through the actual Windows GUI:
firmware identity and all twelve web files verified, and the original profile,
Wi-Fi credentials, Hardware inventory, controls, calibration, rules and safety
settings matched afterward. The final web update also acknowledged replayed
first/final chunks and passed byte-for-byte readback. Both boards passed
phone/tablet browser checks with no unintended writes or reboot. Classic is left
in Standby with its original setup and 2.6.1-dev; S3 is restored to OTBench 0.14.

The complete required CI gate passed on 30b2209, including all 51 UI audit
programs, both firmware/filesystem builds and budgets, native behavior, Python
and Windows Go tests: [run 40840035723](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/40840035723).
Earlier aggregate CI attempts
stopped on stale UI-test assumptions: direct clicks on hidden Save bars, edits
injected before the editor's saved baseline loaded, and fabricated dirty classes
that the no-op detector correctly cleared. Tests now wait for loaded baselines,
make/revert real edits and use the visible reveal control. Source and packaged
scroll tests pass in Chromium, Firefox and WebKit. These corrections do not
weaken the required release gate. Warning guidance now uses the Fault shutdown
switch rather than zeroing a retained Dashboard limit (web token 20261029a).

Setup Tool 0.7.6 passed actual Windows keep-setup updates on both Classic and
S3. Each run needed one initial Wi-Fi confirmation and zero confirmations after
either restart. The tool waited for the expected project, version, target and
build with maintenance readiness, then verified all twelve dashboard files.
This also exercised same-image updates, where matching build identity alone
cannot prove a restart. Profile, credentials, hardware, controls, calibration,
rules and safety settings matched the saved pre-update setup on both targets.
The S3 raw backup was restored afterward, esptool verified the written hash,
and the board answered `OK OTBench 0.14`. The temporary qualification Wi-Fi
profile was removed. Classic remains in Standby with outputs inactive.

The complete 0.7.6 aggregate repeat on bcda937 passed, including native and
Windows Go jobs:
[run 40865173277](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/40865173277).

The working firmware is labelled 2.6.1-dev. No release or tag has been published.
Assembled-PCB and actual ArduPilot integration tests remain separate hardware
requirements. This bare-board UART test does not qualify those integrations.

## Final usability/documentation pass, 29 October 2026

Setup Tool 0.7.7 passed the physical S3 USB erase/write/checksum path; both chip
families were detected and selected through the Windows UI. S3 was restored to
its verified raw backup and answered OTBench 0.14. The complete required gate on
3346858 passed: https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/40869092789.

The next tool revision 0.7.8 names the final erase action, simplifies profile
wording and confirms chip identity from the pre-erase capacity response. Erase
and write commands also specify the selected family. Wrong/unknown chips are
rejected before erase. The ECU web revision 20261029b hides receive-only tuning
in TX-only MAVLink setups without changing retained settings and gives setup
links the active theme colour. Cross-browser source/packaged MAVLink tests and
the configuration audit passed. Guide recipes now reveal compact save controls
through the normal visible user action.

Installation docs, backup/log locations, driver behavior and troubleshooting
were checked against current code. The public guide has focused MAVLink
monitoring/receiver screenshots. All three cumulative teaching inventories and
both development-board pin plans were rechecked while regenerating screenshots.
The Pages workflow permits branch previews but only main can deploy; branch
validation cannot publish an unreleased guide.

## Latest PCB installer/appearance follow-up

The installer now ships only `openturbine-s3-20261028` revision 1.0-20261028.
The old routing remains a repository compatibility fixture, not an installer
choice. Package tests assert both the single S3 choice and absence of the old
binary; Classic still offers development-board/custom paths.

A simulator fixture is derived from the actual latest profile. Its source and
packaged UI passed in Chromium, Firefox and WebKit: all 32 connections loaded,
N1/TOT/oil/starter selected the expected labelled connectors, temperature chose
MAX31856, pressure retained its 5 V ADC reference, buses stayed fixed, and both
built-in LEDs plus MAVLink appeared correctly. This found and fixed a Status LED
summary/type assumption for expander-driven indicators (web revision 20261029c).
These checks simulate fitted devices and do not qualify an assembled PCB.

The documentation draft on b235acd passed Jekyll, built links/anchors/images,
browser review and guide recipes; deploy was skipped as intended:
https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/actions/runs/40874111220.
