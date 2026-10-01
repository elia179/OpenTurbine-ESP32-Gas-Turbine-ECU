---
layout: document
title: Choose parts for the guided builds
description: Select compatible beginner OpenTurbine sensors, driver interfaces and bench loads, with a cumulative example pin plan for an ESP32-S3 development board.
lede: Choose parts by their electrical interface, then check the exact module documentation before wiring.
permalink: /guided-builds/parts/
---

{% include guided-nav.html %}

## A small teaching kit

You do not need to buy all three levels at once. Start with the Level 1 items. These are selection examples and documented circuit patterns, not a claim that a particular marketplace kit has been physically tested with OpenTurbine.

| Level | Part or interface | What to look for |
| --- | --- | --- |
| 1 | Supported ESP32 development board and data USB cable | Classic ESP32 with at least 4 MB flash, or supported ESP32-S3 with at least 8 MB; select the actual target in Hardware. |
| 1 | DRV5033 Hall sensor or equivalent documented open-drain sensor | Operation at 3.3 V, a documented pinout, a 10 kΩ signal pull-up and 100 nF local bypass capacitor for the shown bench circuit. A small handheld magnet demonstrates pulses. |
| 1 | K-type thermocouple and MAX31855 K-type breakout | A board documented for 3.3 V supply and logic, thermocouple terminals, and CLK/DO/CS connections. MAX6675 and MAX31856 are alternatives with their own wiring. |
| 1 | 10 kΩ linear potentiometer | Three accessible terminals; connect its ends to 3.3 V and GND, not 5 V. |
| 1 | Two momentary Start/Stop buttons | Dry contacts on separate input pins with internal pull-ups enabled; these are required ECU commands, separate from the independent physical stop. |
| 1 | Unloaded hobby servo and separate regulated supply | Correct servo supply voltage; documented compatibility with a 3.3 V command pulse or a suitable signal buffer. Do not power it from GPIO. |
| 1 | PWM power-driver module and low-power lamp or DC load | Documented 3.3 V-compatible IN, the needed PWM frequency, correct load voltage/current, and defined off behavior. Include module-specified suppression. |
| 1 | Relay interface module and low-power DC lamp | A documented 3.3 V-compatible control input, rated coil supply, and contact ratings for the lamp. Avoid mains loads for this exercise. |
| 2 | Pressure transducer and signal conditioner | Known pressure range, supply, output range and fault behavior. The worked divider illustrates a 0.5–4.5 V signal; the sensor's plumbing and pressure rating still matter. |
| 2 | Fuel shutoff interface and oil-pump driver | Required valve/driver voltage and current, a verified safe physical state, and the same relay/PWM signal patterns already learned. Use dummy loads while learning. |
| 2 | Second 10 kΩ potentiometer, dimmable low-power light and PWM driver | Separate brightness input and light output; LED module needs its specified current limiting. Low-voltage DC only; no mains dimming. |
| 3 | Second conditioned RPM signal | Separate N2 pickup, appropriate pulse bandwidth and PPR; the handheld Hall exercise is not qualification for a turbine shaft. |
| 3 | DS18B20 and 4.7 kΩ resistor | Three-wire externally powered probe with documented lead functions; use for oil/enclosure temperature, not turbine gas. |
| 3 | INA180A1 breakout, 0.1 Ω shunt and bench load | Gain 20; shunt rated at least 0.5 W for the bounded 0–1 A exercise. Other gains require a different sensitivity calculation. |
| 3 | 68 kΩ and 12 kΩ 1% resistors, 100 nF capacitor and fused sensing lead | Isolated 12 V nominal battery measurement bounded to 16 V; no charger, starter or inductive load attached. Live engine/vehicle buses need a protected interface. |
| 3 | Dry-contact switch | A contact with no external voltage; use as a cover-status input. |
| 3 | Two conditioned shaft-twist pickups | Matching effective tooth counts on one torque-carrying shaft; 3.3 V-compatible square waves and a known rotating torque reference for calibration. |
| 3 | Thrust load cell and NAU7802 breakout | Correct bridge range and mounting; documented 3.3 V-compatible I²C interface, excitation and differential bridge terminals. |
| All | Meter, reliable leads, connectors and fused/current-limited supplies | Check signal voltages before connecting GPIO. Real load wiring, fuses and protection depend on the installation. |

Read the [DRV5033 manufacturer datasheet](https://www.ti.com/lit/ds/symlink/drv5033.pdf), [MAX31855 product documentation](https://www.analog.com/en/products/max31855.html), [DS18B20 documentation](https://www.analog.com/en/products/ds18b20.html), and [INA180 manufacturer datasheet](https://www.ti.com/lit/ds/symlink/ina180.pdf). Use terminal names from the exact package/module you buy. A bare chip, a regulated breakout and a board with hidden 5 V pull-ups can require different wiring.

## An optional cumulative pin plan

The main diagrams use named GPIO functions so they work with different boards. If you want a concrete example, this plan is for an **ESP32-S3 DevKitC-1-compatible board with an 8 MB ESP32-S3-WROOM-1 module without PSRAM**, with the listed pins exposed. It reserves the whole three-level inventory, including required Start/Stop controls, before you begin. It avoids native USB, flash and boot-strapping pins. It is not a Classic ESP32 or universal PCB pinout.

| First used | Device name or bus | Example connection | Why |
| --- | --- | --- | --- |
| 1 | Required Start / Stop controls | GPIO 9 / 10 | Separate active-low inputs with internal pull-ups enabled. |
| 1 | **N1 Speed** | GPIO 6 | Pulse input with the shown external Hall pull-up. |
| 1 | Shared SPI clock / MISO | GPIO 12 / 13 | Used by the thermocouple bus. |
| 1 | **Main TOT** CS | GPIO 14 | Unique output-capable select; MAX31855 needs no MOSI. |
| 1 | **Throttle Input** | GPIO 1 | ADC1. |
| 1 | **Starter** servo signal | GPIO 15 | Output-capable. |
| 1 | **Main Fuel Metering** PWM | GPIO 16 | Output-capable; goes to the rated driver. |
| 1 | **Igniter** relay command | GPIO 17 | Output-capable; dummy lamp for learning. |
| 2 | **Oil Pressure** | GPIO 2 | ADC1, with appropriate signal conditioning. |
| 2 | **Fuel Shutoff** | GPIO 18 | Output-capable. |
| 2 | **Oil Pump** PWM | GPIO 21 | Output-capable. |
| 2 | **Brightness knob** | GPIO 8 | Separate ADC1 input; no internal bias. |
| 2 | **Bench light** | GPIO 38 | PWM command to a suitable light driver. |
| 3 | **N2 Speed** | GPIO 40 | Separate pulse input. |
| 3 | **Battery Voltage** | GPIO 4 | ADC1; conditioned measurement only. |
| 3 | Oil-pump current subcard | GPIO 5 | ADC1; dedicated current input, not a second assignment of this pin. |
| 3 | **Oil Temp** OneWire | GPIO 7 | Digital bus with external 4.7 kΩ pull-up. |
| 3 | **Cooling Fan** | GPIO 39 | Output-capable. |
| 3 | **Cover closed** | GPIO 35 | Internal pull-up, active-low; this no-PSRAM module must expose the pin. |
| 3 | Torque reference / phase pickups | GPIO 41 / 42 | Separate native capture inputs; matching pulses per shaft revolution. |
| 3 | Shared I²C SDA / SCL | GPIO 11 / 47 | Enable the bus before assigning the detected NAU7802 thrust channel. |

Confirm the board/module schematic and every Hardware conflict warning before using this plan. Other S3, Classic ESP32 and PCB-profile arrangements differ. Classic ESP32 GPIO 34–39 have no internal pull-ups and its ADC2 is unsuitable with Wi-Fi. For a PCB profile, use its board-labelled ports rather than forcing raw GPIO values. Check the [target restrictions]({{ '/hardware/#adc-restrictions' | relative_url }}) and your manufacturer's board documentation.

**Use the displayed device names when following the guides.** Add each physical channel once. The interface keeps stable references behind those names; you do not need to enter an internal identifier to follow these lessons.

## Before connecting a real engine

Replace dummy loads with correctly rated equipment only after the command direction, parked state, wiring and stop path are verified. Hall bandwidth, probe temperature rating, connector metals, ESC arming, motor stall current, transient protection and physical fuel isolation all require installation-specific checks. The learning kit proves a pattern; it does not commission an engine.

<p class="document-nav"><a href="{{ '/guided-builds/basic/' | relative_url }}">Return to Level 1</a><a href="{{ '/hardware/' | relative_url }}">Hardware reference</a></p>
