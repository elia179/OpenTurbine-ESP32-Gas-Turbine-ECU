# OpenTurbine PCB 1.0 — 28 October 2026 routing

Profile: `openturbine-s3-20261028.otpcb.json`. Requires the **2.6.1 implementation**; do not install this profile with 2.6.0. This is the latest supplied PCB, not the older `openturbine-ecu-s3-v1` routing. Bench validation on an assembled board remains required.

Source: `ProPrj_OpenTurbine PCB v1.0_2026-10-28 (1).epro2`, SHA256 `29f260f731b2d72e9c8ff08bcb7c71bdce4a03e769cc2c65b509bc37a70b4eda`. The importer reads the main PCB's component pad nets and checks connector/device routing. The source project is preserved unchanged.

User confirmed **all parts will be fitted**, including the hand-fit module/connectors marked DNP for assembly. Module: **ESP32-S3-WROOM-1-N8**, 8 MB flash, no PSRAM. **N8R8 is incompatible with this routing:** GPIO35–37 are used by the PCB and are occupied internally by octal PSRAM on that variant. See [Espressif's module pin definitions](https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf).

Plain development boards continue to work without any PCB profile. On this PCB, select its matching profile at installation; engine input/output purposes remain user-configurable. The profile fixes the physical routing, not the engine tune.

| Physical connection | Firmware endpoint |
| --- | --- |
| I²C J15 | SDA GPIO4, SCL GPIO5 |
| SPI J17 | SCK GPIO12, MISO GPIO13, MOSI GPIO11 |
| Serial J16 | TX GPIO43, RX GPIO44; MAVLink engine connection |
| Thermocouple 1 J43 / U20 | MAX31856, CS GPIO14 |
| Thermocouple 2 J44 / U21 | MAX31856, CS GPIO3 |
| Analog inputs J20–J27 | U8 TLA2528 channels 0–7, address 0x10, 5 V reference |
| Pulse inputs J28–J33 | GPIO35, 36, 6, 7, 15, 16 respectively |
| Pulse outputs J34–J39 | GPIO18, 8, 9, 39, 40, 21 respectively |
| Power outputs J3, J5, J7, J9, J11, J13 | GPIO37, 38, 41, 42, 2, 1 respectively |
| Start / J_START | GPIO17, active-low, pull-up |
| Stop / J_STOP | GPIO48, active-low, pull-up |
| J18 additional inputs | GPIO46 (input-only), GPIO47 |
| Shared output enable | GPIO45, active-high; held low before output initialization |
| Battery measurement | GPIO10; divider 37:1 with all listed resistors fitted |
| Status LED / J_STATUS_LED | U17 TCA9534 address 0x20, P6, active-low |
| Fault LED / J_FAULT_LED | U17 TCA9534 address 0x20, P7, active-low |
| Pulse-input pull-up controls | U17 P0–P5; active-low PMOS gates |

The battery divider uses R1 + R2 = 60 kΩ above the ADC node and R3 ∥ R4 = 2 kΩ ∥ 10 kΩ below it: ratio `1 + 60000 / (2000 × 10000 / 12000) = 37`. If fitting differs, the profile must change; this is not the older board's divider.

U8 ADDR is left unconnected in this project: TI's address table specifies **0x10** with both selection resistors unpopulated. AVDD is +5V_ADC and DVDD is +3V3. The ADC conversion reference follows AVDD; calibrate the actual rail and sensor circuit. [TI TLA2528 datasheet, address selection and supply reference](https://www.ti.com/lit/ds/symlink/tla2528.pdf).

U17 A0–A2 are grounded, so its address is **0x20**. Initialize all six pull-up controls high (off) and both LED outputs high (off) before changing expander directions. A pulse channel's pull-up setting controls the external PMOS circuit, not an internal resistor on the conditioned MCU input. [TI TCA9534 documentation](https://www.ti.com/product/TCA9534).

The power-stage output-enable also enables the pulse buffers through board logic. It must stay inactive through boot, profile validation and actuator initialization. Do not infer current ratings from software labels; actual load limits require thermal/electrical qualification. J4/J6/J8/J10/J12/J14 expose power-command service signals and are not additional independent output channels.

Regenerate and validate:

```powershell
python -X utf8 tools/import_openturbine_pcb.py 'path/to/project.epro2' --output pcb_profiles/official/openturbine-s3-20261028.otpcb.json
python -X utf8 tools/pcb_profile.py pcb_profiles/official/openturbine-s3-20261028.otpcb.json
```

Use the JSON through the Setup Tool's custom-profile path while this profile is under test. Do not flash the raw container manually or publish it as a qualified board until the assembled-board checks pass.
