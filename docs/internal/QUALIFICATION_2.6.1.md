# 2.6.1 qualification worksheet

Updated 4 November 2026. Current implementation and evidence boundaries are
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
compatible profile remains `openturbine-s3-20261102`, revision `1.0-20261104`,
format 2.0. Final component/filter and SPI-series-resistor changes preserve
its complete generated connector profile. Read the
[profile notes](../../pcb_profiles/official/openturbine-s3-20261102.md).
Bare Classic/S3 development boards use no PCB profile.

## Current bare-board evidence

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
