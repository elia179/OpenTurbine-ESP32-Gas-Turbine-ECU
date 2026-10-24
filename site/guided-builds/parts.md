---
layout: document
title: Guided-build parts, connections and engine worksheet
description: Prepare one cumulative development-board installation, with separate Classic and S3 pin plans and a worksheet separating measured engine data from teaching assumptions.
lede: Identify your parts and record their actual interfaces before following the three builds.
permalink: /guided-builds/parts/
---

{% include guided-nav.html %}
{% assign e = site.data.guided_example %}

## Parts for each build

Choose components by their documented electrical interface. A bare chip, a breakout with a regulator and a board with 5 V pull-ups can require different wiring. All signal connections must meet the selected ESP32's limits. Drivers carry load power; GPIO supplies commands only.

| Build | Part / interface | Establish before connection |
| --- | --- | --- |
| 1 | Supported Classic ESP32 ≥4 MB or ESP32-S3 ≥8 MB, USB data cable | Exact module, exposed pins, supply and correct firmware target |
| 1 | Physical Start and Stop momentary dry contacts | Separate GPIOs, active-low wiring and appropriate bias |
| 1 | Conditioned N1 pickup | Clean 3.3 V-compatible pulses, actual PPR, speed bandwidth and mounting |
| 1 | K-type probe and matching MAX31855 module | Probe location, polarity, compatible supply/logic and SPI terminals |
| 1 | 10 kΩ linear throttle potentiometer | Ends at 3.3 V/GND, identified wiper and ADC1 input |
| 1 | Oil-pressure transducer and conditioning | Example: 0–10 bar gauge, 0.5–4.5 V output; actual supply/range/reference and ADC-safe conditioning |
| 1 | Electric starter and compatible ESC/driver | Pulse interface, endpoints, arming, safe disengagement and stall/current requirements |
| 1 | Fuel pump, oil pump and separate rated PWM drivers | Supply, command frequency, reliable minimum, polarity and physical off behavior |
| 1 | Spark ignition system and command driver | Rated isolation, suppression and correct command polarity |
| 1 | Fuel shutoff and driver | Plumbing suitability, command direction and physical de-energized state |
| 1 | Fused supplies, physical energy-removing stop, meter and test loads | Separate power paths and deliberate signal references; suitable load protection |
| 2 | Combustor-pressure transducer and conditioner | Separate sensor/tap; pressure and temperature rating; named gauge/absolute reference |
| 2 optional | Second-circuit dry pressure switch | Meaning of ON, safe wiring and desired monitoring phases |
| 3 | Free turbine, suitable load and conditioned N2 pickup | Independent mechanical ratings, lubrication, PPR and any gear ratio |

For initial output checks, use suitable low-power dummy loads or observe the command signal without starter/fuel/ignition energy. For an open-drain pulse-input bench exercise, a [DRV5033](https://www.ti.com/lit/ds/symlink/drv5033.pdf), 100 nF bypass and suitable pull-up illustrate the circuit; they do not qualify a rotor target or high-speed installation. See [MAX31855 documentation](https://www.analog.com/en/products/max31855.html) for the thermocouple interface. A generic board pin labelled 5 V is not a suitable substitute for 3.3 V signal wiring.

<h2 id="pin-plan">One pin plan, two board columns</h2>

Main recipes use signal names. Pick **one column** and keep it throughout. These plans apply only to development boards exposing the listed pins: a **Classic ESP32-WROOM-32 without PSRAM**, or **ESP32-S3-WROOM-1 with 8 MB flash and no PSRAM**. Other modules can reserve pins internally. Check the exact board schematic and Hardware validation before copying assignments. GPIO numbers are not physical header positions.

| First used | Signal / displayed name | Classic GPIO | S3 GPIO |
| --- | --- | --- | --- |
| 1 | Start / Stop | 13 / 14 | 9 / 10 |
| 1 | N1 Speed | 27 | 6 |
| 1 | SPI SCK / MISO | 18 / 19 | 12 / 13 |
| 1 | Main TOT chip select | 23 | 14 |
| 1 | Throttle Input, ADC1 | 34 | 1 |
| 1 | Oil Pressure, ADC1 | 35 | 2 |
| 1 | Starter ESC command | 32 | 15 |
| 1 | Main Fuel Metering PWM | 25 | 16 |
| 1 | Igniter command | 33 | 17 |
| 1 | Oil Pump PWM | 26 | 21 |
| 1 | Fuel Shutoff command | 21 | 18 |
| 2 | Combustor Pressure, ADC1 | 36 | 3 |
| 2 optional | Oil circuit 2 switch | 4 | 35 |
| 3 | N2 Power Shaft | 22 | 40 |

The Classic analogue inputs are ADC1 for Wi-Fi compatibility. GPIO34–39 are input-only and have no internal pull-up/down; the Start/Stop and optional switch use other pins. A named PCB profile uses its own labelled ports rather than these raw GPIO numbers. See [target restrictions]({{ '/hardware/#adc-restrictions' | relative_url }}) and your board documentation.

<span id="an-optional-cumulative-pin-plan"></span>
Screenshots use the S3 column. The electrical function and configuration order are the same on Classic; substitute its column when assigning pins.

<h2 id="engine-worksheet">The shared engine worksheet</h2>

Use this as a record, not an installation preset. **Operating anchors** come from the example brief. **Assumed values** make the lesson concrete; they have not been measured on an HX80 engine. **Measured interface values** come from your sensor, driver, calibration rig and engine. A turbocharger model does not determine a fuel schedule.

| Quantity | Teaching example | Source / what to record for your engine |
| --- | --- | --- |
| Normal full-power N1 | {{ e.n1_full_rpm }} RPM | Operating anchor; record actual shaft and independently measured speed |
| Normal combustor pressure | 3–4 bar gauge | Operating anchor; identify tap and reference |
| Normal oil supply | 4–5 bar gauge | Operating anchor; identify where measured and oil temperature |
| Nominal oil target | {{ e.oil_target_bar }} bar | Midpoint example; validate supply, flow and bearing requirements |
| N1 idle / maximum trip | {{ e.n1_idle_rpm }} / {{ e.n1_trip_rpm }} RPM | Assumed teaching values; establish actual stable idle and permissible limit independently |
| Normal TOT / running trip | {{ e.tot_normal_c }} / {{ e.tot_trip_c }} °C | Assumed; identify exact probe location and actual engine limits |
| Separate startup trip / sustained threshold | {{ e.tot_start_trip_c }} °C / {{ e.tot_start_dwell_c }} °C for {{ e.tot_start_dwell_ms }} ms | Assumed transient envelope; justify before using |
| Pre-start maximum / light-off confirmation | {{ e.tot_prestart_c }} / {{ e.tot_lightoff_c }} °C | Assumed; different jobs, not interchangeable |
| Reliable fuel minimum / idle / full command | {{ e.fuel_min_pct }} / {{ e.fuel_idle_pct }} / {{ e.fuel_max_pct }}% | Assumed pump results, not transferable flow or power percentages |
| Pre-ignition N1 / starter demand | {{ e.n1_crank_rpm }} RPM / {{ e.starter_pct }}% | Assumed; verify actual airflow, starter and coupling |
| Oil minimum / confirmation | {{ e.oil_min_bar }} bar / {{ e.oil_confirm_ms }} ms | Assumed; check bearing requirements and all enabled oil-failure sources |
| P1 limiting begin / full / shutdown | {{ e.p1_soft_bar }} / {{ e.p1_full_reduction_bar }} / {{ e.p1_trip_bar }} bar | Assumed; preserve operating margin, not sensor full scale |
| N2 target / hard trip | {{ e.n2_target_rpm }} / {{ e.n2_trip_rpm }} RPM | Assumed for a separate teaching power shaft; include gearing if sensed elsewhere |

Record fuel type, nozzle/flow calibration, pump/ESC models, temperature-probe position, actual starter release, all finite wait timeouts, oil cooldown requirements and each failed-sensor response alongside this table. **No fuel-delivery pressure is inferred from the combustor's 3–4 bar.**

The [Holset family service manual](https://www.turbomaster.info/eng/turbos/data/HX80.pdf) covers the original turbocharger's identification, installation and service requirements. It is not a validated homemade turbojet start schedule. Treat the guide's assumed numbers accordingly.

## A worked pressure conversion

For a documented 0.5–4.5 V, 0–10 bar gauge transducer, the 15 kΩ upper / 10 kΩ lower divider multiplies output by **0.4**:

| Pressure | Sensor output | ADC-pin voltage |
| --- | --- | --- |
| 0 bar | 0.50 V | 0.20 V |
| 3.5 bar | 1.90 V | 0.76 V |
| 4.5 bar | 2.30 V | 0.92 V |
| 10 bar | 4.50 V | 1.80 V |

ADC zero is {{ e.pressure_zero_mv }} mV and sensitivity {{ e.pressure_mv_per_bar }} mV/bar. The sensor's 10 bar span, the oil controller's 4.5 bar target and a low-pressure fault limit are three different settings. Measure and calibrate the actual circuit. A resistor divider alone does not provide installation-level fault or transient protection.

<h2 id="optional-instruments">Optional workshop connections</h2>

The [optional workshops]({{ '/guided-builds/instruments/' | relative_url }}) use this additional **S3-only** pin plan, reserved alongside the S3 core column above. They do not imply that every accessory fits on a Classic board simultaneously. On Classic, allocate and validate the spare pins or supported expansion interface needed for your chosen accessory.

| Accessory | Example S3 connection / part |
| --- | --- |
| Brightness knob / bench light | ADC GPIO8 / PWM GPIO38; separate low-power learning circuit |
| Battery voltage | ADC GPIO4; protected/conditioned input; bounded bench divider lesson uses 68 kΩ / 12 kΩ and 100 nF |
| Oil-pump current | ADC GPIO5; bounded INA180A1/0.1 Ω shunt exercise, not a high-power pump shunt design |
| Oil temperature | GPIO7, DS18B20 three-wire, external 4.7 kΩ pull-up |
| Cooling fan | Output GPIO39 to a suitable driver |
| Cover-status switch | GPIO35 if not used by the optional oil-circuit switch; choose one or reserve another valid pin |
| Torque reference / phase | GPIO41 / 42; matching conditioned pickups on one shaft |
| Shared I²C SDA / SCL | GPIO11 / 47; NAU7802 bridge amplifier for thrust |

Check [DS18B20 documentation](https://www.analog.com/en/products/ds18b20.html) and [INA180 documentation](https://www.ti.com/lit/ds/symlink/ina180.pdf) for the actual parts. Repeat the pin-conflict check whenever adding a workshop. An input can feed several software relationships, but the physical pin should only be assigned once.

<p class="document-nav"><a href="{{ '/guided-builds/basic/' | relative_url }}">Begin Build 1 →</a><a href="{{ '/hardware/' | relative_url }}">Electrical reference</a></p>
