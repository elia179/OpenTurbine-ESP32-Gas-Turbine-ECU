# PCB 2.0 software reconciliation

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
  `2.0-20261102`, target N8/no PSRAM. Generic devboards remain profile-free.
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
