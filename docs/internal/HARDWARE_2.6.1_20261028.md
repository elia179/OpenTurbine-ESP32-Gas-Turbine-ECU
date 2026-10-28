# 2.6.1 focused hardware results — 28 October 2026

Both bare development-board targets passed focused no-load OTBench testing.
The user confirmed the existing two-board fixture with no engine loads. No
assembled OpenTurbine PCB was connected. No runtime firmware/UI changes were
needed during this session, and this is not a release authorization.

## Exact builds and fixture

| ECU | Application build | Firmware SHA256 |
| --- | --- | --- |
| Classic ESP32, COM3, 4 MB flash | `268cf1be3900e35d` | `3e14803032eeeee768df0b17657a2f23deec1378f2f9c3841777b4732d508aa7` |
| ESP32-S3, COM4, 16 MB fitted flash using universal 8 MB application layout | `b1668964bf92625e` | `1cf5b1e739cd3a20b5066fdd130ca9338b4e3d81b800d726bff427b9400ff29a` |

Neither ECU used a PCB profile. The other board ran OTBench 0.14, with the
existing protected signal wiring. S3 testing on this development module does
not qualify the proposed N8 PCB module or the assembled board circuitry.

## Results

| Check | Classic | S3 |
| --- | --- | --- |
| Physical signal campaign | 11/11 pin-function checks | 17/17 single-shaft profile checks |
| Dedicated Fault LED | 2/2; fault cadence moves to separate pin and clears | 2/2; same assertions |
| Fuel isolation | 4/4; repeated N1 overspeed and physical STOP | 4/4; same assertions |
| Browser backup / identical restore | Passed | Passed |
| Invalid restore | Rejected; current configuration preserved | Rejected; current configuration preserved |
| Served web files | 12/12 exact matches | 12/12 exact matches |
| Windows Setup Tool 0.7.4 Wi-Fi update | Passed, including interrupted final verification and recovery | Passed, both reconnects and final verification |
| Browsing, temporary save, file transfer and cleanup | 248 s, 11 navigations, 2 saves; original ramp restored | 214 s, 13 navigations, 2 saves; original ramp restored |
| New UI on real ECU | Passed | Passed |

The signal campaigns exercised PWM/digital/servo outputs, pulse RPM input,
analogue input/calibration and digital input paths; S3 also exercised simulated
MAX6675 temperature feedback. Isolation checks first established active fuel
commands, then observed fuel/ignition outputs low and servo at its cut command.
This is physical signal evidence, not independent oscilloscope certification of
shutdown latency or a powered-load test.

The Windows Classic test deliberately disconnected Wi-Fi at final verification,
observed progress and the bounded timeout, then reconnected and retried only
verification. Support logs show one firmware and one web upload, with all files
verified after retry. Both updates retained hardware and tuning. Expected test
usage counters advanced. No configuration backups are committed here.

Both live UI audits checked three initially open System sections, manual
collapse surviving rerender, Page controls restoration at 1024x600 and 390x600,
absence of a redundant clean Save handle, and expanded ImmediateCut command
cards with the retained-lubrication note. Those audits made zero writes and
reported no JavaScript errors.

The browsing campaigns recovered 31 Classic and 35 S3 transient API GET resets
during page handoff; S3 also recovered two document navigation attempts. They
completed with no recorded HTTP errors or failed checks. Intended Classic save
reboots were handled; S3 boot count remained unchanged during its session.
These were short sessions, not endurance qualification.

## Harness corrections and retained evidence

Only test tooling changed: target-specific S3 pin mappings, canonical OVERSPEED
event spelling, bounded retry for the explicit storage-busy 409 on restoration,
and the correct Developer/Bench/start flow for an actuator-free indicator test.
An initial harness failure is not counted as a successful final run; affected
campaigns were corrected and rerun. Physical isolation assertions were retained.

Private workstation logs, downloaded engine files, screenshots, result JSON and
the original Classic full-flash backup are in `artifacts/261-hardware/` (ignored).
`progress.json` indexes coverage. Principal logs: `classic-pinfunc.txt`,
`classic-safety-retest.txt`, `s3-single-shaft.txt`, `s3-safety-retest.txt`,
`classic-fault-led.txt`, `s3-fault-led.txt`, both `*-windows-update-log.txt`,
both `*-soak.txt`, and both `*-usability.txt`. Raw generated bench results are
archived under `raw-results/` there.

## Handoff and outstanding checks

Classic is restored to the user's original hardware/tuning/calibration with
2.6.1 and current web files. S3 is restored as the OTBench tester. Final handoff
requires Classic STANDBY with outputs inactive, not an automatic engine start.

Still pending: actual tablet touch/keyboard review; cold power/brownout/EMI and
powered-load tests; physical active-low/legacy indicator variants; deliberately
wrong-board Wi-Fi recovery; and all assembled-PCB checks in the
[qualification worksheet](QUALIFICATION_2.6.1.md), including output gate,
TCA9534 indicators/pull-ups, TLA2528, both MAX31856 inputs and voltage scaling.
The complete strict release qualification campaign has not been run in this
session. No tag or public release was created.
