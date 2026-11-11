---
layout: document
title: Guided-build parts, connections and engine worksheet
description: Prepare a Classic ESP32 development board, check the pin assignments, and record the values for your engine.
lede: Identify your parts and record their actual interfaces before following the three builds.
permalink: /guided-builds/parts/
---

{% include guided-nav.html %}
{% assign e = site.data.guided_example %}

<span id="parts-for-each-build"></span>
## Prepare for Build 1 first

Choose components by their documented electrical interface. A bare chip, a breakout with a regulator and a board with 5 V pull-ups can require different wiring. All signal connections must meet the selected ESP32's limits. Drivers carry load power; GPIO supplies commands only.

| Part / interface | Establish before connection |
| --- | --- |
| Classic ESP32-WROOM-32 development board with at least 4 MB flash, USB data cable | Exact module, exposed pins, supply and correct firmware target |
| Separate momentary Start and Stop buttons | One GPIO per button, with active-low wiring and pull-up enabled |
| Conditioned N1 pickup | Clean 3.3 V-compatible pulses, actual PPR, speed bandwidth and mounting |
| K-type probe and matching MAX31855 module | Probe location, polarity, compatible supply/logic and SPI terminals |
| 10 kΩ linear throttle potentiometer | Ends at 3.3 V/GND, identified wiper and ADC1 input |
| Oil-pressure transducer and conditioning | Example: 0–10 bar gauge, 0.5–4.5 V output; actual supply/range/reference and ADC-safe conditioning |
| Electric starter and compatible ESC/driver | Pulse interface, endpoints, arming, safe disengagement and stall/current requirements |
| Fuel pump, oil pump and separate rated PWM drivers | Supply, command frequency, reliable minimum, polarity and physical off behavior |
| Spark ignition system and command driver | Rated isolation, suppression and correct command polarity |
| Fused supplies, physical energy-removing stop, meter and test loads | Separate power paths and deliberate signal references; suitable load protection |

### Add these only when you reach a later build

| Build | Additional part / interface | Establish before connection |
| --- | --- | --- |
| 2 | Combustor-pressure transducer and conditioner | Separate sensor/tap; pressure and temperature rating; named gauge/absolute reference |
| 3 | Free turbine, suitable load and conditioned N2 pickup | Independent mechanical ratings, lubrication, PPR and any gear ratio |

For initial output checks, use suitable low-power dummy loads or observe the command signal without starter/fuel/ignition energy. For an open-drain pulse-input bench exercise, a [DRV5033](https://www.ti.com/lit/ds/symlink/drv5033.pdf), 100 nF bypass and suitable pull-up illustrate the circuit; they do not qualify a rotor target or high-speed installation. See [MAX31855 documentation](https://www.analog.com/en/products/max31855.html) for the thermocouple interface. A generic board pin labelled 5 V is not a suitable substitute for 3.3 V signal wiring.

<h2 id="pin-plan">Classic ESP32 pin assignments</h2>

The guides and screenshots use a **Classic ESP32-WROOM-32 development board without PSRAM**. Verify that your board exposes the listed pins. GPIO numbers refer to the labels on the board. Other boards need their own pin assignments.

| Signal / displayed name | Classic GPIO |
| --- | --- |
| Start / Stop | 13 / 14 |
| N1 Speed | 27 |
| SPI SCK / MISO | 18 / 19 |
| Main TOT chip select | 23 |
| Throttle Input, ADC1 | 34 |
| Oil Pressure, ADC1 | 35 |
| Starter ESC command | 32 |
| Main Fuel Metering PWM | 25 |
| Igniter command | 33 |
| Oil Pump PWM | 26 |
| Combustor Pressure, ADC1 (Build 2) | 36 |
| N2 Power Shaft (Build 3) | 22 |

The Classic analogue inputs are ADC1 for Wi-Fi compatibility. GPIO34–39 are input-only and have no internal pull-up/down; the Start/Stop and optional switch use other pins. A named PCB profile uses its own labelled ports rather than these raw GPIO numbers. See [target restrictions]({{ '/hardware/#adc-restrictions' | relative_url }}) and your board documentation.

<span id="an-optional-cumulative-pin-plan"></span>

<h2 id="engine-worksheet">The shared engine worksheet</h2>

Fill the rows needed for your current build; later-build values are here for reference, not extra settings to enable now.

Use this as a record, not an installation preset. **Operating anchors** come from the example brief. **Assumed values** make the lesson concrete; they have not been measured on an HX80 engine. **Measured interface values** come from your sensor, driver, calibration rig and engine. A turbocharger model does not determine a fuel schedule.

| Quantity | Teaching example | Source / what to record for your engine |
| --- | --- | --- |
| Normal full-power N1 | {{ e.n1_full_rpm }} RPM | Operating anchor; record actual shaft and independently measured speed |
| Normal combustor pressure | {{ e.p1_normal_min_bar }}–{{ e.p1_normal_max_bar }} bar gauge | Operating anchor; identify tap and reference |
| Normal oil supply | 4–5 bar gauge | Operating anchor; identify where measured and oil temperature |
| Nominal oil target | {{ e.oil_target_bar }} bar | Midpoint example; validate supply, flow and bearing requirements |
| N1 idle / maximum trip | {{ e.n1_idle_rpm }} / {{ e.n1_trip_rpm }} RPM | Assumed teaching values; establish actual stable idle and permissible limit independently |
| Normal TOT / running trip | {{ e.tot_normal_c }} / {{ e.tot_trip_c }} °C | Assumed; identify exact probe location and actual engine limits |
| Separate startup trip / sustained threshold | {{ e.tot_start_trip_c }} °C / {{ e.tot_start_dwell_c }} °C for {{ e.tot_start_dwell_ms }} ms | Example only. Use your engine's startup temperature limits. |
| Pre-start maximum / light-off confirmation | {{ e.tot_prestart_c }} / {{ e.tot_lightoff_c }} °C | Assumed; different jobs, not interchangeable |
| Reliable fuel minimum / idle / full command | {{ e.fuel_min_pct }} / {{ e.fuel_idle_pct }} / {{ e.fuel_max_pct }}% | Assumed pump results, not transferable flow or power percentages |
| Pre-ignition N1 / starter demand | {{ e.n1_crank_rpm }} RPM / {{ e.starter_pct }}% | Assumed; verify actual airflow, starter and coupling |
| Oil minimum / confirmation | {{ e.oil_min_bar }} bar / {{ e.oil_confirm_ms }} ms | Assumed; check bearing requirements and all enabled oil-failure sources |
| P1 limiting begin / full / shutdown | {{ e.p1_soft_bar }} / {{ e.p1_full_reduction_bar }} / {{ e.p1_trip_bar }} bar | Assumed; preserve operating margin, not sensor full scale |
| N2 target / hard trip | {{ e.n2_target_rpm }} / {{ e.n2_trip_rpm }} RPM | Assumed for a separate teaching power shaft; include gearing if sensed elsewhere |

Record fuel type, nozzle/flow calibration, pump/ESC models, temperature-probe position, actual starter release, all finite wait timeouts, oil cooldown requirements and each failed-sensor response alongside this table. **No fuel-delivery pressure is inferred from the combustor's {{ e.p1_normal_min_bar }}–{{ e.p1_normal_max_bar }} bar.**

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

<h2 id="optional-instruments">Example device connections</h2>

The [setup examples]({{ '/guided-builds/instruments/' | relative_url }}) use spare Classic ESP32 pins. Try each example independently. If two devices need the same pin, move one to another compatible free pin or use a supported expansion interface.

| Device | Example Classic ESP32 connection |
| --- | --- |
| Battery voltage, current sensing, thermistor, or brightness knob | ADC1 GPIO39, one input at a time |
| DS18B20 temperature sensor, cover switch, or second oil-pressure switch | GPIO4, one input at a time. The DS18B20 uses an external 4.7 kΩ pull-up. |
| Cooling fan, fuel shutoff solenoid, or bench light | GPIO21, one driver command at a time |
| Shaft torque pickups | GPIO16 reference and GPIO17 phase |
| NAU7802 thrust sensor | I²C SDA GPIO16 and SCL GPIO17. Use different pins if the torque pickups use this pair. |

Check [DS18B20 documentation](https://www.analog.com/en/products/ds18b20.html) and [INA180 documentation](https://www.ti.com/lit/ds/symlink/ina180.pdf) for the actual parts. Repeat the pin-conflict check whenever adding a device. An input can feed several software relationships, but the physical pin should only be assigned once.

<p class="document-nav"><a href="{{ '/guided-builds/basic/' | relative_url }}">Begin Build 1 →</a><a href="{{ '/hardware/' | relative_url }}">Electrical reference</a></p>
