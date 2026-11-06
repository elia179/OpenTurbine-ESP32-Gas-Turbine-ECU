# OpenTurbine PCB v1.0 software reconciliation

Local work for OpenTurbine 2.6.1-dev, started 2 November 2026. Not pushed,
not published, not electrically qualified. No attached hardware was reflashed
as part of this reconciliation; the previous bare-S3 test does not qualify
this board revision. See the [board profile and recovery notes](../../pcb_profiles/official/openturbine-s3-20261102.md).

## Evidence

The handoff and PCB_REVIEW were read before editing. The importer parsed the
exact reviewed EasyEDA project and checked driver, expander, module and output
connector nets. The resolved review JSON and module pin map were inspected;
the fresh Gerber archive inventory was checked. Copper connectivity conclusions
come from the supplied PCB review, not a new electrical qualification by this
software change. The withdrawn cached-pour warning is not used.

- `OpenTurbine_PCB_2.0_reviewed_source.epro2`: `f3d77f6a5ef8931c1d90470fe6a58b8756b5f76afff5dd4e65246dec9d0d79fe`
- `current_board_components_and_nets.json`: `bc6af75f709957bec6498fdafa245b7d942792c43107f352716eea4bea4ae963`
- `current_board_pinmap.json`: `c377aaa6a4b6a3786b15adee65b2193ea299489eecc0ac27d1e3879e29a59072`
- `Gerber_live_reviewed_2026-11-02.zip`: `5874281d7c5bb5f2df23095d8e668faa4ae7d20fd80f71c5602006d484159471`

## Changes

- Current bundled board profile becomes `openturbine-s3-20261102`, revision
  `1.0-20261104`, target N8/no PSRAM. Generic devboards remain profile-free.
- Format 2.0 makes old firmware fail closed instead of ignoring a new driver
  contract. The parser, Python source validator, package marker and Setup Tool
  agree on this contract. Setup Tool is 0.7.9; the package minimum is 0.7.9.
- Dedicated 0x21 expander gets safe latch 0x03 before output direction. Its
  entire byte is reserved from user channels and generic I2C reconfiguration.
  CS transfers preserve phase-enable bits, with a common recursive transaction
  lock covering all relevant I2C and thermocouple/driver SPI users.
- INH low and INL disabled precede the software-progress heartbeat. Driver
  configuration begins after a 250 ms safe wake period. Both DRV8350S chips
  require configuration/status readback; configuration is locked afterward.
  There is no guessed hardware-valid input and no automatic OCP retry.
- Six power outputs use six MCPWM timers/operators over two groups, freeing
  LEDC for six signal outputs. Nominal staggered carrier phases have software
  synchronization skew; different frequencies drift. Peripheral allocation
  failures inhibit startup. LEDC timer combinations are checked as well as
  channel count. The power editor exposes 100–20,000 Hz and the actual 5 MHz
  timebase, not a fictitious user-selectable LEDC resolution.
- Zero power demand forces INH low and clears INL, avoiding a low-side command
  remaining active at STOP. Core actuator wrappers and generic registry outputs
  share the protected backend. They cannot fall back to ordinary GPIO/LEDC.
- The heartbeat is generated only after a completed control/safety/output
  cycle, with a 75 ms software deadline and a minimum 100 Hz configured ECU
  loop. It is never a free-running peripheral. Ordinary engine shutdown keeps
  controlled cooldown authority; board/driver failures force outputs off,
  stop the heartbeat and report `PCB_OUTPUT_STAGE_FAULT`.
- Physical RESET/EN or power cycle is required to clear the independent
  hardware latch. ESP.restart/fault acknowledgement is not presented as a
  latch clear. Wi-Fi OTA can therefore require a physical reset afterward.
- Supply measurement uses calibrated ADC millivolts and divider 37.0; explicit
  measured raw calibration tables still take precedence. I2C starts at 100 kHz;
  driver SPI is software mode 1 at no more than 100 kHz. MAX31856 retains its
  independent SPI mode, readback and open-probe protection. TLA2528 framing,
  channel-ID isolation, reference and filter behavior were reviewed and the
  existing native tests retained.

## Check boundaries

Detailed local logs are under `artifacts/pcb2/`. Focused native tests execute
the actual board state machine and profile parser with simulated peripherals;
they are not a claim that hardware timing, current, voltage or temperatures
were measured. Profile/source and setup-tool tests also reject malformed and
incompatible contracts. Browser checks exercise the connector UI in Chromium,
Firefox and WebKit, source and compressed assets. Final build/check results
are recorded alongside the review artifacts.

Still required on the assembled PCB: rail thresholds, heartbeat startup/dropout
and EN recovery; real I2C rise times and SPI readback; VGS/VDS waveforms,
complementary dead time/polarity, fault/OCP behavior, carrier skew and ripple;
load/connector/capacitor/MOSFET temperatures with the real leads. Requested
30 A/channel and 100 A combined limits are not measured ratings and cannot be
enforced as measured current without sensors. No real turbine run is authorized.

## Final local verification — 3 November 2026

Both firmware builds and both LittleFS builds passed. Classic OTA headroom
is 74,720 bytes; S3 headroom is 1,510,432 bytes. Both linker-memory and
filesystem reserve checks passed. Profile tests (16), package staging test,
321 safety regression checks, public-content validation and Setup Tool Go
tests passed. The actual profile reader and power backend native tests passed,
including buffered-PWM preload, watchdog loss and latched fault behavior.
Existing TCA/TLA peripheral tests, all 64 external pull-up combinations, S3
indicator behavior and servo tests passed. One Windows policy launch delay
resolved on the bounded retry of the same binary; no policy bypass was used.
Chromium/Firefox/WebKit each passed source and compressed PCB UI cases.
These focused results do not constitute the full release gate or any physical
qualification. Firmware and profile were not installed onto attached boards.

## Dashboard driver-fault acknowledgement correction

Reported DRV8350 faults now park outputs while retaining a health-controlled
heartbeat. Dashboard CLEAR_FAULT sends CLR_FLT only after normal fault-clear
guards pass, then verifies both driver statuses/configuration. A failed clear
keeps the ECU faulted and outputs disabled. Fault text includes driver number,
fault category and status registers. The native test covers successful explicit
clear, inhibited output commands while faulted and failed communication during
clear. Only unsafe communication/configuration, watchdog/progress failures or
a real physical hardware latch trip retain the physical-reset requirement.
Earlier statements above treating every driver fault as requiring reset are
superseded by this correction. No automatic retry/restart is introduced.

Recovery edge-case follow-up: acknowledgeFault rechecks the control deadline
before clearing the recoverable driver state, so a late clear request cannot
erase a real loop stall. Native tests pass STOP during PWM preload, all-off
recovery, repeated clear idempotence, rejected low-loop-rate acknowledgement
and heartbeat loss while a recoverable driver fault is awaiting clear.

PWM-routing follow-up: do not reconfigure MCPWM-owned pins with pinMode at
board startup or repeated attachment. Native fake GPIO tracks this ownership.
Tests pass at 100/10000/20000 Hz for six channels, period/phase settings,
partial-duty startup and 0%/100% overrides. Driver configuration is now verified
before interpreting status bits, preventing a pulled-high/disconnected MISO
from being reported as recoverable overcurrent. S3 servo attach starts at its
native 14-bit limit. The pinned Arduino LEDC implementation was inspected: it
reuses only matching timer frequency/resolution and rejects timer exhaustion;
buzzer timing remains separate through its unique resolution. Physical waveform
and six-power-plus-six-signal coexistence checks await the OTBench fixture.

Also reject repeated attach after a partial MCPWM allocation failure; an
allocated timer alone is not evidence of a usable generator. Boundary tests
cover this failed-allocation retry and pulled-high SPI data as well. All three
carrier-frequency runs pass. No serial ports were visible during this review,
so no physical output waveform or hardware coexistence result is claimed.

## Final PCB source reconciliation — 3 November 2026

Authoritative final source: `OpenTurbine_ECU_V2_READY_TO_ORDER_2026_11_04.epro2`,
SHA256 `e3b5d7a43a73c9dabf93fa2271849bcefa8bc327156b16c4f1a752bba0f073c4`.
Compared every component pad/net and generated profile against the earlier
reviewed source: both match exactly. R72/R73 are now 2.2 kΩ; MISO R2130 stays
4.7 kΩ. Retain 100 kHz I²C/driver SPI, the existing profile identity, and all
current/thermal qualification limits. Importer now fingerprints the final source.

Fault-clear now checks the heartbeat deadline again after the bus transaction,
preventing a slow recovery transaction from restoring Ready after a loop stall.
A simulated transaction delay crosses the deadline and proves outputs remain
off, heartbeat stops, and recovery requires physical reset. Native backend tests
pass at 100 Hz, 10 kHz and 20 kHz. Physical waveform/coexistence checks remain
pending: no serial ports were present.

Final ADC-caption export refresh: checksum matches the release manifest. All
component pad nets and the generated profile still match; R72/R73 remain
2.2 kΩ. Only source provenance changed; no firmware rebuild is required.

## Additional EMI-review starting settings

Read the corrected `pcb-emi-review-2026-11-03/EMI_REVIEW.md`: the extra
GND-link proposals and mandatory-bridge order hold are withdrawn. Preserve
the intentional single-point ground scheme; neither link was applied. The
subsequent DC scenario check showed alternate load-return current through
quiet copper. No mapping change or software workaround is appropriate. Set explicit HS/LS
source/sink currents to 50/100 mA (HS unlocked 0x300, locked 0x600; LS 0x300),
retaining 4 µs TDRIVE, 400 ns dead time, latched OCP and mandatory readback.
TI SLVSDY6A tables 15/16 confirm current codes 0000/0000. New PWM channels
already default to 5 kHz; preserve saved configuration and start high-current
qualification at that lower frequency. Model estimates are not measured edge
timing, a full EM simulation or qualified current/thermal ratings.

## Exact order-review handoff reconciliation

Read `pcb-order-check-2026-11-03/SOFTWARE_HANDOFF_FINAL.md` and
`FINAL_ORDER_REVIEW.md`. The authoritative archive is the Downloads source
named above, fingerprint 6cb89dcf…a08955. Compared every component pad/net
against the earlier reviewed source and regenerated the software profile:
all nets and the complete profile match exactly. Routing changes preserve
the intentional single-point ground; no extra ground links or firmware
workaround are required. The hardware review found no confirmed prototype
order blocker; this is not measured maximum-load or thermal qualification.

The functional contract is already implemented: N8/no-PSRAM target, safe
expander startup and serialized CS, disabled-phase 3x initialization and
readback, explicit 50/100 mA HS/LS drive with 4 µs window, 1 s per-driver
fault polling, main-loop heartbeat, deliberate MCPWM/LEDC allocation, and
battery scale 37.0. New power channels default to 5 kHz; saved settings are
preserved. Hardware waveforms/coexistence/rails and load tests remain pending.

## 4 November final brief reconciliation

Source `OpenTurbine_ECU_V2_READY_TO_ORDER_2026_11_04.epro2` supersedes
earlier revisions (SHA256 e3b5d7a4…f073c4). Importer verifies the new
R2211/R2212 MCU-to-bus SPI net split and regenerates an identical profile.
Final I²C pull-ups are 1.8 kΩ; ADC filters 100 nF; battery C2 1 µF.
GPIOs/profile identity remain compatible. Updated modeled heartbeat dropout
is 0.54/0.67 s, not a measured bound; retain the 75 ms software deadline.

Fixed missing early CS parking for both thermocouples, including unassigned
devices; auxiliary 0xFF latch before direction and before configured pull-ups;
and a post-SPI deadline check before any pending PWM phase enable. Added
nonblocking TLA2528 internal offset calibration with 100 ms timeout, explicit
OPMODE, manual sequencing/no averaging and withheld samples until completion.
Driver sleep/reset reconfiguration, configuration-delay failure and all-off
recovery are covered by focused backend tests. Hardware release validation
uses the existing bare-board tester/DUT fixture; real PCB stage qualification
will follow when that board exists. No substantial loads are authorized.

Bring-up follow-through: PCB heartbeat prerequisites now include successful
I²C-manager initialization. OTBench TLA emulation now models self-clearing
offset calibration. The broader native run found a missing generic PCB-state
fixture in the S3 controller test; added that fixture and both controller
variants pass. A separate feedback-control native executable remains blocked
by Windows Application Control after the existing bounded retries; no policy
bypass is used. Earlier compiler-cache file-access interruptions are recorded
in the local logs. These are not passing full-release results.

## Physical MCU waveform follow-up — 4 November

The new fixture-only `dev/bench/pwm_probe` compiles the actual production
PcbPowerStage.cpp against real ESP-IDF MCPWM/LEDC, with driver/expander replies
simulated and a fixture-specific GPIO map. It is never packaged as ECU firmware.
Physical testing found an SDK restriction missed by the original host fake:
a software sync source can attach to only one timer. Fixed each group to use
one software-synced master with input-sync propagation to two followers.
Propagation is one-shot; it does not periodically reset independent carriers.
The fake now enforces exclusive software-source ownership.

Also preload GPIO latches through gpio_set_level before pinMode: Arduino 3
rejects early digitalWrite on an unowned GPIO. This matters especially for
unassigned thermocouple CS pins and the heartbeat before bus startup.

The Classic tester captured the production MCPWM backend at 1/5/10/20 kHz,
25/50/75% duty, static OFF/ON, reported-fault off/explicit clear and a 100 ms
loop-stall injection. Six MCPWM timers and six LEDC outputs coexist; LEDC
frequencies are read back. Two wired paths retain different 5 kHz/2.5 kHz
carriers with all six timers using different frequencies. All 63 assertions
pass. These are microcontroller captures, not independent scope or real driver
measurements. Six-channel phase skew and MOSFET switching remain unqualified.

S3 ECU firmware additionally passed 14 wired I²C emulator checks, three dry
engine-profile startup/STOP campaigns, separate fault/status indicators and
a live read-only browser audit matching all 12 served web assets. Original
engine snapshots were restored by each campaign. Six source/compressed PCB
UI cases pass across Chromium/Firefox/WebKit. Full original 4/16 MB flashes
are preserved privately before tester/DUT installation.

Heartbeat timing clarification: GPIO45 does not need profile-load-time setup.
Initialize it LOW in PcbPowerStage::begin near the end of setup, then generate
pulses only from successful control-loop cycles. Early inactive-state parking
continues for chip selects and ordinary outputs before bus/driver setup.

Classic follow-through: 14/14 wired I²C checks, all three dry engine-profile
campaigns, separate indicator behavior, and physical N1-overspeed/STOP fuel
isolation pass. The profile campaign initially received an explicit HTTP 503
pre-write storage-busy rejection during final restoration. The original engine
was subsequently restored and compared exactly; the initial failed result and
separate successful restoration evidence are both retained. Added bounded
retries only for that explicit rejection to shared harness restoration. Safety,
validation and ambiguous transport failures are not replayed. All 39 harness
unit tests pass. No firmware storage restriction was relaxed.

Final bare-board handoff: both targets build and pass image/linker/filesystem
budgets; Classic live browser audit matches all 12 assets with no writes or
reboot. The final Classic image was written with verified flash hash, boots
in STANDBY with outputs inactive and retains the exact engine file. S3 remains
OTBench tester firmware. The local package is refreshed separately. One native
feedback-control executable remains blocked by Windows Application Control;
there is no complete full-release-gate pass, and no security bypass was used.
Actual PCB power/rail/thermal qualification remains a later prototype task.

Board-name correction: the user-facing product is **OpenTurbine PCB v1.0**.
Its profile revision is 1.0-20261104; the stable profile ID and all routing
remain unchanged. Historical source/archive filenames containing PCB 2.0/V2
are retained verbatim for provenance. Profile format 2.0 is a software
compatibility version, not the physical board version.

## Final naming and UI audit maintenance

Use the exact user-specified display name OpenTurbine PCB v1.0 throughout the
profile, Setup Tool package catalogue and current documentation. The stable
profile ID is retained; revision is 1.0-20261104. Source filenames containing
V2 are provenance, not the product name. Package tests assert the exact label.

Refreshed the qualification worksheet/changelog. Removed stale October-only
cache-key expectations from UI audits; they now compare all links/assets to
the dashboard generation. Web revision is 20261104a. Protection shortcuts
reveal shared controls before calculating sticky-header clearance. Native
keyboard toggle coverage waits for smooth-scroll destinations; separate
pointer-navigation audits cover real button navigation. Clarified PCB fault
guidance for hard failures that stop the heartbeat. Cross-browser focused
source/compressed cases pass; broader-suite results are logged separately.

Broader release follow-up: 17 turbine setup variants, I²C/load-cell source audit,
independent MAVLink decoder, extended real sensor vectors and 26 release-tool
unit tests pass. Updated cache-generation assertions no longer require an old
October web revision. WebKit scroll focus tests explicitly request keyboard
focus on System buttons instead of assuming mouse clicks focus buttons.
Classic served-file/browser verification passes again after the 20261104a web
upload, preserving STANDBY and inactive outputs. The Windows enterprise signing
policy block on the native feedback-control executable remains unresolved.

All 53 UI audit programs now pass across the staged runs after correcting stale
cache-key and browser-input test assumptions. Coverage is recorded per program
in artifacts/pcb2/nov4-ui-coverage.json. This is not represented as a single
uninterrupted full release-runner pass. Scroll controls pass all 24 browser/
viewport/page combinations; safety matrix passes 29 cases / 85 fields / 8,713
checks per source/compressed browser variant. The enterprise-policy-blocked
native feedback-control executable still prevents a complete release gate.


### November 4 — connector workflows and zero-demand behaviour

The PCB profile now declares the exposed J18 GPIOs (17, 48, 46, 47). The
ordinary GPIO editor remains available for them; Start/Stop connectors and
GPIO17/48 cannot claim the same resource simultaneously. User-facing PCB
choices use Connector names; GPIO choices use spaced GPIO labels. Legacy
extension-port IDs remain readable. The six MOSFET INH pins remain reserved
for their named power connectors even when no channel is assigned, preventing
an unrelated bus or raw GPIO assignment from reusing a backend-owned pin.

New assignments immediately carry GPIO/I2C/SPI transport metadata from the
profile into the editor. This fixes wrong power-timer editors before reboot,
multiple new ADCs sharing placeholder channel zero, and new thermocouples
being rejected by registry validation before profile resolution. Read-only
Advanced connection details expose these values without adding normal setup
fields. Selecting the same input connector preserves the user's pull-up choice.
ADC inputs never offer unsupported bias toggles.

Power PWM now offers Brake (default, continuous low-side on at zero) and Coast
(both off at zero). Both retain complementary PWM above zero. Initialization,
reported driver faults, communication faults and missed progress deadlines
inhibit both FETs. Coast is cleared when moving to a logic connector or on/off
mode; its JSON value is strictly validated. DRV8350 OCP deglitch is now 4 us,
with the 70 mV threshold and latched shutdown retained. Exhaustive chip-select
mask checks preserve every INL bit and deselect the other driver.

Three simulated PCB workflows (turbojet, free-power, dual-oil/auxiliaries) pass
Hardware setup, mock storage/reload and Controllers/Calibration/Sequence/Tools
page checks. Their exported registries also pass the real S3 registry parser.
The largest setup uses all eight ADC connectors and both thermocouples; the
free-power setup includes a raw GPIO47 PWM auxiliary. Named Start/GPIO17
ownership is checked in both directions. The initial GPIO46 input-only restriction
was later corrected against the S3 datasheet and framework capabilities.
The source and compressed PCB audit passes Chromium, Firefox and WebKit.
Seventeen profile validator tests, 217 source wiring/driver checks, backend
behaviour at 100/5000/10000/20000 Hz, both firmware/filesystem builds and their
memory budgets pass. No physical power PCB was exercised. No hardware flash
or publication was performed during this review. Web revision: 20261104b.

The final header workflow also covers switching an existing Start assignment
between Start Connector and GPIO17 in place, without removing/recreating the
channel. Focused complete setups pass Chromium source and Firefox/WebKit
compressed assets, including normal signal-type controls on GPIO47.


### Follow-up: mutation and import hardening

Continued review found additional issues beyond initial successful setups:

- Profile-backed wiring is canonicalized before registry insertion, avoiding
  premature rejection of imported placeholder/stale GPIO, ADC and SPI fields.
  A generic parser callback keeps PCB routing in the resolver. Final resource
  and capability checks still run. Failed channel parsing clears partial state
  and inhibits START rather than leaving a partial inventory active.
- Legacy digital safety mirrors source their GPIO from profile metadata before
  reconciliation; stale imported physical pins cannot survive in hidden slots.
- Mirrored outputs expose a connector picker immediately and do not inherit a
  power-specific Coast setting until they acquire a compatible power endpoint.
- Saved offline assignments warn without blocking unrelated edits; genuinely
  new unavailable assignments remain blocked. The web preflight no longer
  accepts installed:false as a bypass: registry membership means installed.
- Indicators support exposed GPIOs and normal polarity controls, including
  disable/re-enable without losing the selected wiring. Connector defaults are
  discovered from profile metadata rather than connector IDs.
- GPIO46 was incorrectly treated as input-only throughout the S3 UI, firmware
  and profile tools. Espressif's S3 datasheet and pinned IDF capability mask
  confirm output support; the restriction was removed. Its boot strap warning
  remains. GPIO46 has a physical 10 kOhm pull-down and GPIO47 a physical 10 kOhm
  pull-up; profile-provided notes explain that software bias cannot remove them.
- Background discovery alternates address scans with input sampling instead
  of suspending samples for the whole scan. The focused test measured a 4 ms
  maximum sample gap during discovery. I2C recovery and all 64 PCB pull-up/LED
  combinations pass. This is host scheduling evidence, not a bus timing bound.
- The hardware save review catches excess signal PWM channels and distinct
  timer settings before submission; dedicated MCPWM power outputs are excluded.

The expanded phase/digital-mirror tests and peripheral tests execute and pass.
The updated combined PCB parser/resolver test compiles, but Windows Application
Control blocks its executable after the bounded same-file retries (WinError
4551). Its new import-runtime assertions remain unverified here. Do not claim
that the earlier parser pass covers the expanded test. Physical PCB testing,
release gate completion, hardware flashing and publication remain separate.

Follow-up execution note: S3 peripheral behavior passes; the standalone S3 GPIO
bias executable is additionally blocked by Windows Application Control after
bounded retries. The browser GPIO regression passes independently.


### Broader software review

The next review expanded beyond PCB workflows. Hardware channels now reject
oversized names/IDs/references before copying them into fixed buffers; UI
preflight uses UTF-8 byte lengths. Channel registry lists explicitly reject
non-array JSON instead of silently becoming empty lists. Controller names have
the same byte-sized UI/backend check. Custom sequence block names/descriptions
are checked by encoded bytes both in the dialog and before saving. Native
registry/schema tests and source/compressed browser boundary tests pass.

Setup Tool chunk writes require a parsed ok:true acknowledgement, not just a
2xx HTTP status. Empty, malformed and explicit-failure responses stop without
an automatic repeat; transport-loss retries retain exact offsets. Backup
snapshots use unique directories even within one second, preventing overwrite.
Go tests pass for both changes. Public-content validation, 27 release-tool
unit tests, 39 harness tests, independent MAVLink decoding, 17 turbine setup
variants and 321 safety checks pass. The broader UI run is staged: outdated
GPIO46 output restrictions in two tests were corrected to match Espressif's
S3 capability documentation; subsequent runs resume from those failures.
Final all-program coverage must be recorded after the remaining audits finish.


### Shared save handling and completed broader browser review (2026-11-04)

The staged browser review completed all 55 programs present when it started.
Two stale test expectations for S3 GPIO46 were corrected; subsequent runs
resumed from the failing programs. This is staged coverage, not an uninterrupted
release gate. Three additional source/compressed acknowledgement regressions
bring current browser program coverage to 58.

Save transport is now shared in ui_dialog.js, which is loaded by standalone
Sequence as well as app.js pages. Config and Hardware wrappers retain their
page-owned telemetry and validation behavior. Hardware previously accepted a
malformed 2xx response as saved/rebooting; Sequence and Calibration could also
accept responses without explicit ok:true. All now require a valid positive
acknowledgement. Lost responses and timeouts never automatically replay a write.
Sequence and Hardware reject duplicate save attempts, lock editing while a
request is pending, retain the draft after failure and release the editor.
Calibration only runs its success callback after confirmed success or a verified
no-op. Config HTTP rejection objects remain available for detailed field errors.

New source and packaged-page tests cover malformed/empty/explicitly rejected
acknowledgements, successful saves, draft retention and duplicate locks; Sequence
also covers timeout recovery. System/Controllers lifecycle checks pass in all
three browsers after consolidation. Restore/calibration recovery and Hardware
single-edit audits pass. Logs are in artifacts/pcb2/nov4-*-save-*.txt and
nov4-shared-save-*.txt. No firmware was flashed and no changes were published.


### Final maintenance transport review (2026-11-04)

Browser firmware chunks now have a 20-second response/body timeout and require
boolean ok:true acknowledgements. Explicit rejection or malformed replies stop
without replay; transport loss retries the same offset with visible progress.
Web-file uploads also require a successful HTTP status and boolean ok:true.
The old unreachable Tools update functions were removed; System > Maintenance
is the sole browser update implementation. This removes roughly 6 KB of source
and approximately 1 KB of compressed installed code without removing UI controls.
All three browsers pass source/compressed tests for malformed/false/string
acknowledgements, HTTP errors, header/body stalls, exact-offset retries and
complete firmware/web progress (tools/ui_update_transport_audit.cjs).

The two command-line uploaders share acknowledgement validation and retry only
transport exceptions, never explicit HTTP/application rejection. Empty web sets
and nonpositive chunk/retry values are rejected before starting. Four focused
unit tests pass. Final live evidence is being collected separately under
artifacts/pcb2/nov4-final-hardware; do not infer a completed release gate from
these implementation checks.
