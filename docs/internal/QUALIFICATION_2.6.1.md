# 2.7.0 qualification worksheet (including 2.6.1 development history)

Updated 5 November 2026. Current implementation and evidence boundaries are
recorded in [PCB_1_IMPLEMENTATION.md](PCB_1_IMPLEMENTATION.md). The dated
[28 October evidence](HARDWARE_2.6.1_20261028.md) is historical and does not
identify the current binaries or qualify the OpenTurbine PCB v1.0 switching stage.

## Identify the installation

Use the build IDs in the current local package manifest and compare them with
`/api/device_info`. Verify the package against its sibling `.sha256` file.
Do not copy old build IDs into a new signoff. Web assets must also match the
package; the live browser audit compared all 12 files on each target.

Final source: `OpenTurbine_ECU_V2_READY_TO_ORDER_2026_11_04.epro2`, SHA256
`e3b5d7a43a73c9dabf93fa2271849bcefa8bc327156b16c4f1a752bba0f073c4`.
PCB target is **ESP32-S3-WROOM-1-N8, 8 MB flash, no PSRAM**. The current
compatible profile remains `openturbine-s3-20261102`, revision `1.0-20261105`,
format 2.0. Final component/filter and SPI-series-resistor changes preserve
its complete generated connector profile. Read the
[profile notes](../../pcb_profiles/official/openturbine-s3-20261102.md).
Bare Classic/S3 development boards use no PCB profile.

## Earlier bare-board evidence

Logs and private identity/configuration checkpoints are under
`artifacts/pcb2/nov4-hardware/`. Original full 4 MB Classic and 16 MB S3 flash
images were backed up before installing DUT/tester firmware. Those private
backups are not committed or included in the public package.

| Check | Current result and scope |
| --- | --- |
| Firmware builds, OTA/linker and filesystem budgets | Both targets pass; see current build/budget records |
| USB install, reset and post-install identity | Verified writes on both; final installed Classic matches the local package build ID |
| Web upload and served bytes | Complete transfers on both; all 12 served assets match |
| Live browser | Both pass touch fullscreen/style checks at phone/tablet widths; no JS errors, writes or reboot in the read-only audit |
| Three engine profiles per target | Turbojet, turboshaft and turboprop I/O, START/RUNNING and physical STOP pass on both |
| Engine-file restoration | Exact readback verified; Classic initially rejected cleanup as storage-busy, then restored exactly; both records retained |
| Shared I2C peripherals | 14 checks per chip pass against the wired tester emulator, including calibration and disconnect health |
| Separate Status/Fault indicators | Both targets pass separate cadence, clear and exact configuration restoration |
| N1 overspeed and STOP isolation | Classic dedicated campaign passes both physical fuel-isolation cases; S3 STOP also covered in all three profiles |
| Production MCPWM backend | 63 fixture assertions pass with real S3 MCPWM/LEDC and simulated driver/expander replies |
| Independent PWM frequencies | Two wired paths retain 5 kHz and 2.5 kHz with six distinct MCPWM frequencies and six LEDC channels allocated |
| PCB UI | Source/compressed catalogue cases pass Chromium, Firefox and WebKit; broader audit results are tracked separately |
| Native feedback-control executable | Blocked by Windows Application Control enterprise signing policy; no complete full-native gate pass is claimed |

The waveform fixture measures MCU output behavior at 1/5/10/20 kHz,
25/50/75% duty, OFF/continuous ON, reported-fault recovery and loop stall.
The other four carriers' relative edges and all real power-stage behavior
remain unmeasured. Tester pulse capture is not an independent oscilloscope.
Classic intermediate ADC sweeps are unavailable with the S3 tester.
The three profiles use timed dry startup; they are not a causal turbine plant.

## Assembled PCB qualification

The PCB is not available yet. These items remain future prototype work and
must not be represented as bare-board test results.

| Check | Required evidence |
| --- | --- |
| GPIO45 health heartbeat and hardware latch | LOW near end of setup, nominal 5 ms high/low only with loop progress; measure actual rail/heartbeat dropout, delayed startup and EN recovery |
| Both DRV8350S devices | Safe 0x03 gate-expander latch before direction; sleep/wake and repeated configuration/readback before switching |
| OFF/PWM/continuous ON | Verify INL-low high-impedance OFF versus enabled complementary switching and 100% high-side ON |
| Six power outputs | Connector mapping, polarity, VGS/VDS, dead time, overshoot, OCP and cross-channel behavior |
| Phasing and combined operation | Scope all six relative carriers, group skew and ripple with representative leads |
| Six signal outputs | Real 5 V levels, servo/PWM timing, safe startup and shared hardware enable |
| Inputs and pull-ups | All six conditioned pulse inputs; all 64 pull-up combinations and active-low LEDs on actual U17 |
| ADC and battery | Eight known-voltage sweeps against measured AVDD; battery calibrated mV multiplied by 37.0 and compared with a meter |
| Thermocouples | Both MAX31856 devices, unassigned-CS parking, type/filter configuration, open probe, stale/recovery and bus contention |
| Start/Stop, UART and buses | Physical connector wiring, debounce, compatible voltage levels and communication faults |
| Current/thermal envelope | Current-limited low-load bring-up, temperatures/ripple and staged voltage/current increases; no measured per-channel current exists |

Start with explicit 50 mA source / 100 mA sink, 4 us TDRIVE, retained
protection/readback and lower PWM frequency such as 5 kHz. The 20 kHz limit
and 30 A/channel / 100 A combined labels are not qualified continuous ratings.
Preserve the final single-point ground scheme; the extra-link proposal was
withdrawn. Hardware latch recovery requires physical RESET/EN or power cycle.
Normal reported driver faults use explicit Dashboard acknowledgement after
safe-state/readback checks. Neither path automatically restarts the engine.

## Release decision

Finish the independent release stages and retain their results. An execution
blocked by OS signing policy is an unresolved gate, not a passing assertion.
Complete that native test in an approved environment before claiming the full
release gate passes. Do not weaken OS policy or firmware safety restrictions.

A devboard software release can precede assembled-PCB qualification when the
PCB support is identified as unqualified prototype support and the limitations
above are retained. No turbine run or maximum-load approval follows from these
checks. Keep changes local until the user authorizes pushing/publication.


## Follow-up workflow changes under requalification

Web generation 20261104b and the working-tree firmware include further fixes
for connector/header ownership, immediate SPI/ADC metadata, mirrored output
assignment, optional indicator GPIO routing/polarity, saved offline devices,
pre-save PWM resources and canonicalization of imported PCB wiring before
registry validation. GPIO46 output support is now correctly allowed on S3;
its fixed PCB pull-down and GPIO47's fixed pull-up are declared in the profile.
These changes have not been installed on the attached development boards and
are not represented by the older local setup ZIP or live-chip build IDs.

Source/compressed PCB browser workflows and three complete simulated engines
pass; these include controller cleanup when removing just one of two oil
circuits. Peripheral behavior passes for Classic and S3 host variants, including
scan/sample interleaving and all 64 external pull-up combinations. The PCB
source audit now contains 231 passing checks. Both firmware targets compile.

Windows Application Control now also blocks the expanded PCB parser/resolver
executable and the standalone S3 GPIO-bias executable after bounded retries.
The expanded parser/resolver test compiles; its new import assertions have not
executed here. Existing browser GPIO regression passes, but is not a substitute
for that native execution. Retain these unresolved checks in release signoff.


2026-11-04 broader browser follow-up: all 55 existing UI programs completed in
staged runs (with corrected obsolete GPIO46 restrictions), plus three new
source/compressed save-acknowledgement programs passed. Shared save handling
now rejects malformed success replies and preserves drafts. Focused
System/Controllers lifecycle checks pass in Chromium, Firefox and WebKit;
Hardware single-edit and restore/calibration recovery checks pass after the
change. These checks do not remove the native execution-policy gaps above or
qualify the not-yet-built physical PCB. No new changes were flashed or pushed.


## Candidate qualification, 4–5 November 2026

The candidate uses web revision `20261104c`, Classic build `774fc8d5d32dd321`
and S3 build `0a558ef756b1185d`. The 187 recorded candidate input hashes still
match. The local setup ZIP includes both images and the single current official
PCB profile. Both images meet the configured flash, filesystem and memory
reserves.

All 60 browser programs passed across staged runs of the frozen candidate.
The first full run timed out on a protection-navigation scroll assertion. The
same program passed in isolation in Chromium, Firefox and WebKit with source
and compressed assets, and the continuation passed. The safety audit passed
322 assertions. The 17-setup matrix, independent MAVLink decoding, sensor
vectors, I2C/load-cell audit, Go tests, 31 Python tool tests and 39 bench harness
tests passed.

Both bare boards passed 50 wired checks across turbojet, turboshaft and
turboprop profiles, plus physical STOP, N1 overspeed, 14 shared-I2C checks per
board and separate fault/status indicator checks. The Classic also passed
startup and running temperature protection and controller activation checks.
The campaigns verified exact restoration of the original engine files. These
runs used an unloaded, protected two-development-board fixture.

The Classic passed 72 live page checks across three browsers and three screen
sizes, all 12 served asset hashes, Dashboard touch fullscreen, a complete
browser firmware update, configuration download, invalid restore, MAVLink
edit/revert and archived CSV download. The S3 passed the same 72 page checks,
all 12 served hashes, touch fullscreen, complete browser firmware update,
configuration download, invalid restore and archived CSV download. Both web
transfers acknowledged early and final chunk replays. The unloaded S3 waveform
probe passed all 63 checks, with simulated driver and expander replies.

Windows Code Integrity event 3077 identifies the blocking policy as Smart App
Control (`VerifiedAndReputableDesktop`). The expanded PCB reader passed in the
fresh native run. Feedback control and both GPIO-bias tests passed when the
existing binaries were retried. The native servo-actuator executable still
fails to launch with WinError 4551. The same C++ assertion source and fake
clock/LEDC functions were cross-compiled with assertions enabled and executed
on the unloaded S3. The serial runner reported `OT_SERVO_VECTORS result=0`.
This verifies the servo assertions on-device. The Windows-native launch remains
blocked. Build, upload and serial logs are in `artifacts/pcb2/nov5-servo-device`.

The Classic is serving `tester1` in STANDBY with the owner's previous test
engine settings. Readback matches the saved test engine file apart from the
runtime statistics. The S3 uses `tester2` with the official PCB profile in its
profile partition. Set `OTBENCH_WIFI_PROFILE` to the active fixture name for
bench campaigns.

The live S3 profile check verified the flash write, official profile identity
and revision, 34 connector entries with matching labels and modes, the Stop
assignment, and all 12 web assets. The PCB-compatible settings survived a
reboot and Chromium rendered all 34 live connector entries. The bare board
reported FAULT and inhibited power because the PCB peripherals were absent.
The development module has embedded PSRAM. The production profile targets the
specified ESP32-S3-WROOM-1-N8 routing, so this is a profile boot, persistence,
and UI check. Actual PCB signals and load operation require the assembled board.

For handoff, the profile remains flashed and the S3 is parked in the ROM
bootloader while the state of the bench jumpers is unconfirmed. Disconnect any
signal jumpers between the two boards before resetting the S3 to open `tester2`.
Both USB cables can stay connected. The Classic remains available at `tester1`.

Logs are in `artifacts/pcb2/nov4-final-hardware` and `artifacts/pcb2/nov5-*`.
Release approval is pending. An assembled PCB and its loaded power stage
remain outside this bare-board qualification.

### 5 November UI follow-up

Web revision `20261105a` supersedes `20261104c` for the UI. The firmware
build IDs above still apply. Expanded Dashboard command details and Tools
component tests take a full row. Page changes show a loading notice while
navigation is pending and a Loading connection badge until the first status
response.

The focused navigation and wet-glow checks passed in Chromium, Firefox and
WebKit. The cross-browser matrix passed at five viewport widths in each engine.
Both LittleFS images rebuilt successfully. The S3 served all 12 updated web
assets after reboot, with its PCB profile and engine settings intact.
The Classic also served all 12 updated assets in STANDBY with its engine file intact. The local setup package was rebuilt for both targets.

The subsequent loading appearance follow-up uses web revision `20261105b`.
Both loading notices say Loading and show a spinner. The connection loading dot
is grey. Reduced-motion preferences stop the spinner. Focused navigation,
spinner and loading-to-connected checks passed in Chromium, Firefox and WebKit.
Both filesystem images and the local setup package were rebuilt. The Classic
served all 12 updated assets after a complete upload retry.

For the S3 review handoff, the Classic is parked in its ROM bootloader and the
S3 is online as tester2. This supersedes the earlier handoff arrangement above
and isolates the shared fixture signal wires while the S3 application runs.
The S3 also served all 12 matching assets with its engine settings intact. After reconnecting Wi-Fi following reboot, the live Hardware browser check passed and rendered all 34 connectors.

### 5 November PCB connection review

The follow-up uses web revision `20261105d`. Firmware builds passed for both
targets. The S3 was flashed with build `087eab566e0ef86b` and the profile
partition was retained. The Classic remains parked for fixture isolation.

UART TX/RX are defaults with profile-provided GPIO labels. An enabled MAVLink
link claims its current GPIO, while disabled links leave those connections
available to ordinary input/output assignments. The advanced serial editor
shows and changes routing. On the live S3, TX GPIO 47 and unassigned RX survived
save/reboot. Original MAVLink settings were restored. Comparison with the saved
engine export found only refreshed derived PCB metadata, with engine settings
equal. The initial strict whole-export comparison flagged that metadata change;
the follow-up comparison verified its scope.

Shared bus diagnostics lists all five PCB devices and the protected driver
pair. I2C entries use reported discovery state, assigned thermocouples use
registry input health, and unassigned SPI devices explicitly say Not checked.
The output-stage initialization fault now points to board power and Hardware >
Shared sensor buses. The devices are absent on the bare-board fixture.

The updated source and packaged UI audit passed in Chromium, Firefox and WebKit,
including UART labels and availability, active-link pin conflicts, and one entry
per fitted I2C expander. Both filesystem images and the local setup package were
rebuilt. Physical PCB operation still requires the assembled board.
The final S3 readback verified the revised Hardware page, and the live browser rendered all 34 connector entries. Live invalid-pin PATCH checks rejected reserved SPI GPIO 12 and occupied Start GPIO 17 while retaining saved settings. Device diagnostics reported six entries and the dashboard fault used the revised wording. The serial editor fits within its card at a 390-pixel viewport in all three browser engines.

### 5 November peripheral and event-export follow-up

The final web revision for this review is `20261105f`. Both firmware targets
and both filesystem images built successfully. The Classic remains parked in
ROM for bench isolation. The S3 retains the official PCB profile.

The live log fault was reproduced as an HTTP 200 array missing its closing
bracket. The CSV route was also reproduced ending inside a quoted field.
Both routes now construct complete bounded payloads and use checked owned
responses. The newest complete records that fit are retained. Full NDJSON
remains a separate full-history download. A live comparison verified 110 JSON
records and 110 complete CSV rows against the newest records in a 627-record
NDJSON file. Browser CSV and NDJSON download buttons passed after the audit
acknowledged first-use overlays and waited for the event list to load.

Bus device detail is restricted to Edit buses. Onboard devices explain their
roles. Dashboard excludes Status/Fault LED command rows. Output availability
is included in snapshots and compact telemetry so Tools blocks missing devices
and does not display a missing device's commanded blink as an active output.

External SPI thermocouples and off-board I2C sensors no longer require a dummy
primary GPIO. Onboard reserved I2C devices still require their named connectors.
Shared SPI claims are counted as shared bus signals. HX711, phase and OneWire
selection uses digital GPIO capability and preserves its sensor interface.
Disabled connection choices explain the source-device or ownership problem.

The live S3 saved and rebooted an external TOT/MAX6675 with CS GPIO 43,
DS18B20/OneWire on GPIO 47, and NAU7802 at I2C address 0x2A. Original engine
settings were restored, including inactive legacy TOT wiring and label defaults
that the normal registry projection retained during the temporary TOT test.
Sensor electrical communication remains untested without those peripherals.

The driver diagnostics now separates PWM 1-3 and PWM 4-6 using atomic per-chip
cached check results. No new SPI access is performed by the web endpoint.
Source and gzip browser checks passed in Chromium, Firefox and WebKit with
one driver responding and the other unavailable, plus external OneWire selection.

The original C++ driver behavior assertions and the expanded event-tail
assertions were cross-compiled and run on the bare S3 with an isolated fake HAL.
They reported `OT_PCB_VECTORS power=0 log=0`. Driver fault/configuration errors
were checked independently for each chip. Clock, GPIO, MCPWM and Wire fake symbols
were isolated from the real framework. This is simulated peripheral logic,
not assembled-PCB qualification. ECU firmware was restored after the assertions.

The computer briefly associated with tester2 without an IPv4 lease after an
update reboot. A clean AP restart and reconnect restored 192.168.4.2. Subsequent
web readback verified all 12 assets and the live Hardware page with 34 connectors.
The local setup package was rebuilt. Publication remains pending approval.

Final live follow-up confirmed both driver groups independently. The bare S3
reports Not checked for each because the PCB devices are absent. The updated
Hardware UI passed the two-card summary and expanded role checks. Dashboard
hid the indicator rows. A final JSON and CSV comparison matched 97 complete
recent records in the 934-record NDJSON history. Original active and inactive
engine settings were fully restored. A later PC Wi-Fi disassociation recovered
with a normal tester2 reconnect and a 192.168.4.2 lease.


### November 5 live device-status usability follow-up (20261105g)

Connection choices now follow the latest bus-device status instead of the initial
profile snapshot. Recovered devices become selectable without reloading. Failed
or malformed discovery responses explicitly show status unavailable, retain
saved assignments and retry automatically. Device polling is serialized and
updates badges and connection options in place, preserving editor focus,
unsaved text and the change summary. Calibration validation takes precedence
over a missing-device warning.

Read-only event exports retry temporary HTTP 429/503 responses up to three
attempts; permanent errors are reported without repeated requests. Source and
gzip checks passed in Chromium, Firefox and WebKit for recovery, unavailable
status, overlapping polls, preservation of edits, invalid calibration and
transient/permanent download failures. Focus and Hardware save acknowledgement
checks also passed. Both target filesystem images built successfully.

All 12 web assets were installed and read back on tester2. The engine file was
unchanged. The live S3 Hardware page rendered all 34 PCB connections and passed
compact bus summary, expanded roles, separate MOSFET-driver groups, Dashboard
indicator exclusion and event-list loading checks. This follow-up changes web
assets only. Classic remains parked to isolate fixture jumpers. No publication
or assembled-PCB electrical qualification was performed.

The live browser subsequently downloaded a complete 14,418-byte Event CSV and
130,427-byte Event NDJSON twice. A preceding audit wait timed out; two instrumented
repeats returned HTTP 200 and passed the raw-format assertions.


### November 5 logging-memory follow-up (20261105h)

Session capture now packs only selected fields into its existing 64-worst-case-row
RAM budget, using a small byte-selection bitmap. Float and integer bit patterns
are preserved, including NaNs. The channel mask, interval and glow-output type
are captured once per run. CSV headers and row schemas retain that mask through
persistence. Event capture now shares its existing 7500-byte Classic / 8000-byte
S3 RAM allocation between length-prefixed complete JSON records, instead of
reserving 500 bytes for each event. Overflow still keeps the newest complete
records and reports every dropped record. Flash writes remain restricted to safe
storage windows; the persistent CSV and NDJSON formats are unchanged.

Closing a larger session now drains at most eight rows or approximately 10 ms per
web-task pass before closing the file. The Log page shows saved-selection/active
buffer capacity and approximate retention time. Its health note distinguishes
capture in RAM from pending persistence. Both target firmware and filesystem
builds passed. Native assertion source compiled; Windows Application Control
still blocked execution, so the assertions were run on the S3 fixture instead.

The MCU assertions reported `LOG_MEMORY_PASS row=252 default_bytes=16 capacity=1008
all_bytes=242 events80=91` and `OT_MEMORY_VECTORS result=0`. Randomized byte-ring
wraparound/overwrite tests ran 10000 operations against a reference model.
Production SessionLogger was included with an isolated in-memory filesystem:
1008 retained rows persisted over 126 batches, ten overflowed rows were counted,
no filesystem calls occurred during capture, a changed post-run mask did not
alter the captured CSV schema, and a second session used its new schema with
clean counters. No real engine files were written by the assertion firmware.
The first assertion fixture exceeded its default task stack with a large local
test array; that array was made static and the fixture task stack enlarged.
Production task stack sizes were not changed. ECU firmware was restored after
the assertions.

For the default N1/TOT/oil selection at a 1000 ms interval, the S3 sample window
is 1008 seconds (16.8 minutes), compared with 64 seconds previously. Selecting
more fields reduces that window. An illustrative 80-byte event fits 91 times in
the unchanged 7500-byte budget; real event capacity varies with record size.
Source and gzip Log UI tests passed in Chromium, Firefox and WebKit, including
capacity display, busy download retries and permanent errors.

The h bundle was installed on tester2 and all 12 assets read back exactly;
engine settings were unchanged. Live capacity telemetry showed the user's saved
25-byte selection retains 645 samples at 1000 ms, with an 8000-byte event buffer.
The current event endpoint returned 98 complete recent records and healthy
recorder status. Three consecutive instrumented Hardware-to-Log navigations
returned HTTP 200 and rendered the event list. A prior uninstrumented audit
occasionally timed out waiting for that list; the successful repeats and failed
wait evidence are retained under artifacts/pcb2. The local setup ZIP was rebuilt
for both targets. Publication remains pending user approval.

Final instrumented live downloads on the restored firmware returned complete
14,601-byte CSV and 154,409-byte NDJSON files with the expected raw event format.
These verify export integrity after the RAM-packing changes, without claiming
that the intermittent uninstrumented browser wait has been explained.


### November 5 scaled logging follow-up (20261105i)

With user approval, known measurement fields now use signed 16-bit scaled values
inside the session RAM buffer: temperatures and oil-pump percent at tenths,
pressures/voltages/currents/torque/thrust at hundredths, and normalized demands at
thousandths (0.1 percent). RPM, timestamps, timing diagnostics, fuel flow,
calculated power and arbitrary calibrated registry channels retain their original
representation. EngineData and control computations are unchanged. CSV names,
units and download formats remain unchanged; eligible logged values now have the
stated precision.

INT16_MIN is an escape followed by the original four float bytes. Nonfinite and
out-of-range values therefore cannot wrap or clip, and NaN payload bits survive.
No user-defined range can prevent a reading from being logged. Variable-size
sample records share the original byte budget. Purely exact fixed-size layouts
omit length prefixes so they do not lose capacity to unnecessary framing.
The Log estimate now explicitly says "up to" and notes that escapes shorten the
window. Per-run mask and interval freezing, safe-state-only flash writes,
newest-tail retention and bounded persistence batches are preserved.

Permanent host assertions compile. On-S3 assertions cover rounding limits,
positive/negative half steps, very large values, infinities, NaNs, insufficient
input/output buffers, raw-field preservation and fixed/variable ring operation.
The default N1/TOT/oil layout uses 14 stored bytes including framing and retains
1152 samples (19.2 minutes at 1 Hz), versus the preceding 1008. Its full-field
normal payload is 196 bytes. The real SessionLogger source persisted 1152 rows
in 144 bounded batches without filesystem calls during capture. A 1500-sample
mixed compact/escape reference test retained 896 records and counted exactly 604
replacements; decoding preserved order and exceptional values. A subsequent
mode-only session used five bytes per sample and reset its counters.

The final MCU report was `OT_MEMORY_VECTORS result=0`. The assertion firmware used
an isolated in-memory filesystem and did not alter engine files. A verification
scheduling error briefly overlapped two USB jobs and a build/output-file read;
that run was rejected. Sequential reruns passed both firmware builds and the
MCU assertions, then restored the ECU image from a stable copied binary with
esptool hash verification. Native execution remains blocked by Windows policy;
no security settings were changed. Source and gzip Log UI checks passed in
Chromium, Firefox and WebKit, including the revised capacity wording.

The i web bundle was installed on tester2, all 12 assets read back exactly, and
the engine file was unchanged. The saved test selection is mode plus exact loop
diagnostics, so its 25-byte records still retain 645 samples: fixed-layout
framing avoids any regression for these unquantized fields. Live recorder
health was good and the event endpoint returned a valid recent-record array.
The real browser downloaded complete 14,607-byte CSV and 186,385-byte NDJSON
exports. Both filesystem images and the local two-target setup ZIP were rebuilt.
No publication or assembled-PCB electrical test was performed.


### November 5 PCB connection and Log usability follow-up (20261105k)

Known fitted PCB I2C connectors now separate configurability from live health:
users can assign an offline ADC connector to an analog EGT or other supported
function while the unavailable warning remains visible. Conflicting connectors
remain blocked. Undiscovered external I2C devices remain unavailable. The
analog-temperature editor no longer shows an irrelevant native-ADC GPIO picker
alongside its named connection. Shaft-torsion pickup fields use labelled native
input connectors and exposed GPIOs instead of every ESP32 pin. The shared raw-pin
builder also restricts auxiliary output/CS choices to exposed GPIOs and labels
shared Start/header conflicts explicitly.

The Log page's row-interval help is now one short sentence. A separate Recording
memory field reports minutes for current checkbox/interval edits without saving.
The lightweight session-status endpoint supplies storage-budget and per-field
size/scaling metadata from the actual C++ codec; this avoids a second hardcoded
UI estimate. It also supplies compact channel names, eliminating Log's extra
full-hardware fetch. The saved mode/loop selection displays 10.8 min; doubling
the interval displays 21.5 min, and adding supply voltage changes it to 18.5 min.

Recent-event reads now use the existing reserved-memory fallback when a contiguous
owned response allocation fails. The same checked workspace path supports CSV
content type and download disposition. Formatting overflow reports a permanent
NDJSON alternative instead of retrying an impossible CSV as a busy condition.
The event-list loader consumes and retries temporary 429/503 responses, with
latest-request protection against stale results.

Both target firmware builds passed. Source and gzip PCB and Log checks passed
in Chromium, Firefox and WebKit. Focus/save-acknowledgement checks passed, as did
simulated turbojet, free-power and dual-oil setups. Tests were updated to drive
live discovery health rather than stale cached mode flags. The actual S3 UI
passed offline analog EGT selection, labelled shaft-pin lists, dynamic minute
estimates and absence of an unnecessary hardware read. The standard live browser
download audit passed CSV (14,591 bytes) and NDJSON (202,373 bytes).

An actual S3 full-engine save/reboot test accepted a general ADC temperature on
ADC 1 and shaft torsion on IN 3/IN 4. Both assignments survived reboot. The full
original engine was restored and compared exactly apart from derived profile
metadata. A first test request omitted the profile binding and was correctly
rejected without changing the engine; the corrected test retained the binding.
No assembled-PCB electrical sensor test or publication was performed.

Final k-bundle readback matched all 12 assets on tester2. The restored engine
file was unchanged by the web update. The final live UI check passed the ADC
selector, filtered pickup options, dynamic estimate and event list; a screenshot
confirmed aligned interval fields, short help and the separate minute field.
Both filesystem images and the local setup ZIP were rebuilt. No push was made.


### 2026-11-05 — HX711 signal model and broad 2.7.0 development checks

HX711 is now presented as **Digital / HX711 (DOUT and SCK)**. The generic
analogue PCB source selector is omitted; its actual DOUT input and SCK output
remain independently selectable. Dual-pickup torque likewise has an explicit
digital signal label. The regression uses the real Add Thrust → HX711 flow in
Chromium, Firefox and WebKit against source and compressed assets.

Loop timing is excluded from `SLOG_DEFAULT`; absent `session_log.loop` also
loads as false. Existing saved diagnostic selections are retained intentionally.

The n-bundle was installed on tester2 (S3, official PCB profile). All twelve
web files matched readback, with the engine file unchanged. Actual-device
Chromium navigation passed 24 page/viewport cases (all eight pages at desktop,
tablet and phone widths), with no JavaScript errors, horizontal overflow,
configuration writes or reboot. Browser CSV and NDJSON downloads passed.
This bare-board device remains in its expected missing-PCB-peripheral fault;
the navigation harness checks that the initial fault state is preserved.

Safety regression passed 322 checks, the turbine setup matrix passed 17 setups,
Python release tooling passed 31 tests, and the HIL harness passed 39 tests.
Setup-tool Go tests, independent MAVLink interoperability, extended sensor
protocol vectors, both filesystem builds and both image/linker budgets passed.
All 37 native behavior programs executed successfully across the main collector
and exact-binary retries. Windows Application Control initially blocked
`feedback_control` and `gpio_input_bias_s3`; the identical compiled binaries
subsequently passed without changing security settings.

Older audit expectations were aligned with the implemented byte-ring logger,
compact session status (no full Hardware fetch), configurable serial connection,
live I2C health, immediate unsaved-channel removal and hidden dashboard LED rows.
Browser launch/navigation timeouts are recorded in the initial collector log;
individual retry logs distinguish transient failures from completed checks.
Evidence is under `artifacts/pcb2/nov5-broad*`. This is development qualification,
not assembled-PCB electrical qualification or publication. No push was made.

Final browser accounting: 54 UI programs passed in the initial complete collector;
the six failures subsequently passed as individual runs after stale assertions
were corrected or transient browser timeouts were retried. All 60 expected UI
programs therefore have passing evidence; the general smoke test contains 61
workflow checks. `nov5-broad-summary.json` verifies coverage against the current
tool inventory. The temporary collector itself reported an invalid boolean
Node exitCode after printing its counts; this did not omit any test program.


### 2026-11-05 — Connector switching and board reference follow-up

Corrected UTF-8 mojibake in the official PCB ADC descriptions and the EasyEDA
profile generator. The generated profile matches the original reviewed PCB
source exactly, including the new descriptive metadata (revision 1.0-20261105).
Thermocouple and Start/Stop connector descriptions now explain the probe/switch
connection. No electrical routing or driver policy changed.

PCB source selection now evaluates the compatible native interface for each
exposed GPIO instead of treating the selected external ADC as a permanent
interface restriction. An analog N2 assignment can move to GPIO 47 as a pulse
counter. Analog-only inputs still cannot select non-ADC GPIOs. The regression
checks ADC → GPIO → IN → ADC transitions, repeatability, and analog-only
rejection, in Chromium/Firefox/WebKit against source and compressed assets.
All six cases passed. Cross-platform conflict and GPIO/pull-capability audits
and all 17 profile unit tests also passed.

The Hardware board overview now provides a grouped profile-derived connector
reference: electrical descriptions, typical uses, GPIO voltage/bias notes and
separation of signal outputs, VIN power switching and unqualified current
ratings. A live S3 browser check passed source switching, readable Unicode,
the connector guide and 390/800/1024-pixel layouts without saving test edits.

The revised descriptive profile was installed on tester2. The revision identity
check correctly rejected the older engine binding; the original engine was
rebound to the new metadata and restored. A comparison excluding only the
profile metadata verified all engine values unchanged. The updated profile
remains electrically unqualified on this bare development-board fixture.

Final q-bundle: all 12 assets matched device readback. Live S3 source switching,
Unicode, the expanded connector guide and three viewport widths passed after
the final spacing/style changes. Engine content stayed identical across the
web update. Both LittleFS builds, both image/linker budgets, public content
validation and the rebuilt local setup ZIP passed. No publication occurred.
