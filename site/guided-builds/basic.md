---
layout: document
title: Build 1 Configure a basic turbojet
description: Configure one HX80-sized teaching turbojet with starter, fuel, ignition, lubrication, essential protection and a complete dry startup and shutdown walkthrough.
lede: Follow one configuration from wiring to a saved, tested system. Add more control methods in Build 2.
permalink: /guided-builds/basic/
build_level: 1
---

{% include guided-nav.html %}
{% assign e = site.data.guided_example %}

## What you will build

Our example is a homemade, HX80-sized **turbojet**: one compressor/turbine shaft, liquid fuel, spark ignition and an electric starter. OpenTurbine commands its fuel pump, starter, ignition, oil pump and fuel shutoff. A separate free power turbine comes in Build 3.

Normal full-power readings are about **{{ e.n1_full_rpm }} RPM N1**, **3–4 bar combustor pressure** and **4–5 bar oil pressure**. N1 means gas-generator shaft speed. TOT means temperature measured after its turbine. Pressure examples use **bar gauge**, measured above atmospheric pressure. Fuel delivery pressure is a different measurement.

**Example numbers teach configuration.** The [engine worksheet]({{ '/guided-builds/parts/#engine-worksheet' | relative_url }}) distinguishes these operating readings from assumed idle, fuel and protection values. Replace assumed settings with your engine's verified data before live operation. The guide configures an existing engine; it does not design its combustor, bearings or starter coupling.

Start with [installation]({{ '/get-started/' | relative_url }}), the [parts and pin tables]({{ '/guided-builds/parts/' | relative_url }}) and a meter. During initial checks, disconnect real fuel, ignition energy and starter power; use signal observation or suitable dummy loads. An independent physical stop must remove hazardous energy without the ECU or browser. Lubrication is part of the installation from the beginning.

{% include build-figure.html file="level-1" alt="Basic turbojet inputs are N1, exhaust temperature, throttle and oil pressure; commands go to starter, ignition, fuel pump, oil pump and shutoff." caption="Build 1 contains the whole basic installation. Combustor pressure measurement and N2 are later additions." %}

<h2 id="power">1 · Connect the ECU and Start/Stop</h2>

An **input** reports a measurement or request. An **output** sends a command to a **driver**, which switches load power. GPIO means a numbered signal pin on the ESP32; it does not supply a pump or starter.

1. Power the board by USB alone for this first check. Open OpenTurbine and select the correct target/profile in **Hardware**.
2. Back up an existing setup using **System → Maintenance → Full engine file backup / restore**. Review preloaded channels; edit matching ones and remove unfitted examples before adding devices. Assign each physical device once.
3. Choose your board's column in the [connection table]({{ '/guided-builds/parts/#pin-plan' | relative_url }}). Follow signal names; S3 GPIO numbers are not Classic GPIO numbers.
4. Edit **Start** and **Stop** in Hardware. Connect each momentary dry contact from its assigned GPIO to GND. Select **Active LOW**, enable **Pull-up** and leave Pull-down off. Save and allow the restart.

{% include build-figure.html file="power" alt="Separate fused ECU and load power paths with an independent physical stop in the hazardous load path." caption="Use USB alone initially. The final regulated ECU and load supplies must match the actual equipment." %}

{% include build-figure.html file="switch" alt="A contact connects its GPIO to ground; the enabled internal pull-up holds it high when released." caption="Repeat for Start and Stop. A dry contact contributes no external voltage." %}

{% include build-screen.html file="stop-configured" step="Configure the Stop input" alt="Expanded Stop card with active-low polarity and internal pull-up selected." caption="Use the pin from your board column. Repeat on the separate Start input." %}

**Check:** both contacts read inactive when released and active when pressed. Release Start after boot before trying a new press. These are ECU commands, separate from the physical energy-removing stop. Classic GPIO34–39 have no internal pull-ups; the example assigns the buttons elsewhere.

<h2 id="n1">2 · Add speed, temperature and throttle</h2>

Add one input at a time in **Hardware → Add input**. Save, then check its reading before continuing.

**N1 speed.** Select **N1 speed**, name it **N1 Speed**, choose **Pulse / frequency input** and assign its GPIO. Enter the pickup's actual **pulses per revolution** (PPR). The example uses one counted pulse per revolution. Its conditioner supplies clean 3.3 V-compatible pulses; raw magnetic pickups and 5 V outputs need conditioning.

{% include build-figure.html file="rpm" alt="A 3.3 V open-drain Hall demonstration input has supply bypass and an external pull-up on the pulse signal." caption="This explains an open-drain interface on the bench. The actual pickup and mounting must suit turbine speed; never attach the teaching magnet to a turbine rotor." %}

The diagram uses an external pull-up. For compatible short bench wiring, **Input bias → Pull-up** can supply bias on a suitable pin instead. Verify pulse quality at the required rate. At {{ e.n1_full_rpm }} RPM and 1 PPR, a generator supplies **1000 Hz**; at 100 Hz the display should show 6000 RPM. Compare against an independent reference. A stationary magnet does not generate continuing RPM.

<span id="temperature"></span>
**Exhaust temperature.** Connect a K-type probe to a matching MAX31855 converter, not directly to GPIO. In **Hardware → Shared sensor buses → Edit buses**, enable SPI, assign **SCK** and **MISO** and save. This converter does not use MOSI. Add **TOT / EGT**, name it **Main TOT**, choose **MAX31855** and assign its separate **CS** pin.

{% include build-figure.html file="thermocouple" alt="K-type probe connects to MAX31855; the ECU provides compatible supply, ground, shared SPI clock/data and unique CS." caption="CLK/SCK is clock, DO/MISO returns data, and CS selects the converter. Use a documented 3.3 V-compatible module." %}

{% include build-screen.html file="tot-configured" step="Check the saved temperature interface" alt="Main TOT card with MAX31855, shared SPI pins and unique chip-select." caption="Enable the bus first. Use your board's pin table rather than copying S3 numbers onto Classic." %}

**Check:** a healthy room-temperature reading, rising with gentle warming and falling with cooling. Check probe polarity if incorrect. This proves basic response, not high-temperature accuracy.

<span id="throttle"></span>
**Throttle.** Wire a 10 kΩ linear potentiometer with its ends at 3.3 V and GND and its wiper at the throttle ADC pin. Add **Throttle Input → Analog voltage input (ADC)** and save. On **Calibration**, jump to **Throttle Input**, hold the knob at intended minimum and select **Capture Min**; repeat with **Capture Max**, then **Save**.

{% include build-figure.html file="throttle" alt="Potentiometer ends go to 3.3 V and ground; its wiper goes to the throttle ADC input." caption="Identify the wiper with a meter. Never use 5 V for this connection." %}

{% include build-screen.html file="throttle-calibration" step="Capture the actual endpoints" alt="Throttle calibration card with endpoint capture and Save controls." caption="Capture at the physical command minimum and maximum. Saved endpoints are measurements, not numbers to copy." %}

**Check:** minimum/middle/maximum give about 0%/50%/100% smoothly. If reversed, correct **Hardware → Throttle Input → Input direction** and verify again. Classic ADC inputs here use ADC1 for Wi-Fi compatibility.

<h2 id="pressure">3 · Add oil-pressure feedback</h2>

The example uses a **0–10 bar gauge transducer with 0.5–4.5 V output**. Its specified supply powers it; a divider conditions its output. Do not connect 4.5 V directly to GPIO.

{% include build-figure.html file="pressure" alt="A 15 kiloohm upper resistor and 10 kiloohm lower resistor divide the pressure output to 40 percent at the ADC." caption="This exact transducer produces 0.2–1.8 V at the ADC. Actual installations also need suitable fault/transient protection." %}

1. Add **Oil Pressure → Analog voltage input (ADC)**, assign its ADC GPIO and save.
2. Open **Calibration → Oil Pressure**. Leave **Include electric oil-pump control and minimum-output calibration** unchecked for **Sensor only** mode. It uses your external pressure source and sends no pump commands. Select **0 bar (gauge pressure)** for this sensor.
3. With the circuit safely depressurized, press **Start Calibration** to capture ambient. Apply a known pressure measured by a trusted gauge, enter it and select **Capture point**. Repeat at another point, select a straight-line fit for this sensor, then select **Compute Fit →** and **Save calibration**. Release pressure and verify zero.

For this circuit, zero is **{{ e.pressure_zero_mv }} mV** and sensitivity **{{ e.pressure_mv_per_bar }} mV/bar at the ADC**. {{ e.oil_target_bar }} bar corresponds to 920 mV. Verify your actual transducer and gauge instead of assuming identical calibration. Optional pump-assisted calibration is separate and can operate the pump.

**Check:** zero and at least two reference pressures agree with the gauge, returning to zero afterward. An incorrectly scaled reading is not ready for protection.

<h2 id="outputs">4 · Add and test the five outputs</h2>

Use rated external drivers and separate fused load power. Keep load current out of sensor grounds. Join references where required by nonisolated interfaces; follow module documentation for isolated ones.

| Add output / name | Example interface | Establish before saving |
| --- | --- | --- |
| **Starter** | RC servo / ESC pulse | Actual endpoints/arming; logical zero stops it |
| **Main Fuel Metering** | High-frequency duty PWM | Compatible frequency, polarity, physical off at 0% |
| **Igniter** | On/off driver | Spark command polarity and de-energized state |
| **Oil Pump** | High-frequency duty PWM | Ratings, direction and permitted command range |
| **Fuel Shutoff** | On/off driver | Open/closed direction and de-energized isolation |

<span id="starter"></span><span id="fuel"></span><span id="ignition"></span>
For each, choose **Hardware → Add output**, its named purpose, driver and GPIO, then save. The teaching PWM driver accepts **{{ e.pwm_hz }} Hz, {{ e.pwm_bits }} bits**; match your driver. ESC pulses are a different signal from duty PWM.

{% include build-figure.html file="servo" alt="An ESC receives command and signal ground; separate rated power supplies it." caption="Confirm arming and stop behavior before connecting starter power." %}

{% include build-figure.html file="pwm" alt="PWM signal and reference connect to a driver; separate fused power carries load current." caption="Reuse this pattern for compatible fuel and oil drivers, each with its own load protection." %}

{% include build-figure.html file="relay" alt="A relay interface receives a logic command; separately powered contacts switch a low-power demonstration load." caption="On/off wiring example: VCC supplies the module; COM is the contact common and NO is normally open. Use the actual ignition/valve driver's documented interface for the installation." %}

{% include build-screen.html file="fuel-configured" step="Check a PWM output" alt="Fuel output card showing frequency, resolution, polarity and safe settings." caption="Minimum reliable pump command is calibrated separately from electrical endpoints." %}

For each output, open **Tools → Tool settings**, review short test duration and demand, save, then run its test. Begin with dummy loads or signal measurement. Check physical direction and return to the safe state after expiry. Prove shutoff direction with a benign unpressurized test. A relay click does not prove valve state.

Calibrate the actual fuel pump through **Calibration → Minimum Reliable Fuel-Metering Output** on an isolated flow rig. Follow sweep, stop and repeatable-restart prompts. Do not run it dry unless permitted. This measures reliable metering, **not engine idle**. The assumed teaching results are {{ e.fuel_min_pct }}% reliable minimum and {{ e.fuel_idle_pct }}% idle; your measurements replace both.

<h2 id="ownership">5 · Give fuel and oil their normal commands</h2>

Hardware describes connections; **Controllers** defines normal control; **Sequence** handles transitions. Configure one normal controller per output.

In **Controllers → Output controllers → + Create controller**, choose **Main Fuel Metering**, create it if absent, and open it:

| Setting | Teaching configuration |
| --- | --- |
| Controller name | Main Fuel |
| Control method / Controlled by | Map input to output / Throttle Input |
| Input low / high | 0% / 100% |
| Output low / high | {{ e.fuel_idle_pct }}% / {{ e.fuel_max_pct }}% |
| Activate when | Entering Running |
| Deactivate when | Entering Shutdown and Entering Standby |

Under **Fuel-metering support → Idle**, select **Off — no idle floor**. Mapping Output low supplies this example's simple idle command; no extra idle method is needed. Save. Throttle requests fuel, not a guaranteed RPM.

{% include build-screen.html file="main-fuel-controller" step="The Running fuel controller" alt="Fuel controller mapping throttle travel to the teaching fuel range, activated on Running entry." caption="Sequence commands startup fuel. Running entry hands it to this controller." %}

For oil, use the creator's separate **Oil pump** and **Pressure feedback** selectors, then **Create oil-pressure controller**. Open **Oil Pump → Oil Pressure Control**. Select **Oil Pressure**, the matching pump, **Pressure target set by → Fixed pressure**, and **{{ e.oil_target_bar }} bar**. Set its **Low-pressure threshold** to {{ e.oil_min_bar }} bar and **Low-pressure confirmation** to {{ e.oil_confirm_ms }} ms. Verify command bounds and failure responses against the oil rig. Use **Normal fault shutdown** for the teaching feedback-loss/low-pressure responses; [Build 2]({{ '/guided-builds/control/#feedback' | relative_url }}) explains the full card.

**Check:** on an appropriate oil circuit, establish target pressure without excessive overshoot and compare the gauge. Response gain and pump duty depend on the pump. The sequence establishes lubrication before ignition and retains it during shutdown.

<h2 id="limits">6 · Set essential protection</h2>

Open **Controllers → Shutdown & Protection**. These are **assumed teaching thresholds**; replace them with verified engine settings before operation:

| Card | Value and enable state |
| --- | --- |
| N1 core speed | Maximum N1 Speed {{ e.n1_trip_rpm }} RPM; overspeed ON |
| Temperature protection | Temperature Source for Safeties = Turbine outlet temperature (TOT), using Main TOT; outlet limit {{ e.tot_trip_c }} °C; running shutdown ON |
| Oil pressure protection | Low-Pressure Limit {{ e.oil_min_bar }} bar; confirmation {{ e.oil_confirm_ms }} ms; monitor Running; ON |

Startup's oil check comes next. It permits pressure to build before ignition without treating zero Standby pressure as a running fault. With separate startup-temperature guard OFF, normal temperature shutdown applies during Startup too. Build 2 teaches a separate guard.

{% include build-screen.html file="n1-warnings-configured" step="Enable protection separately from its limit" alt="N1 protection with the teaching speed limit and enabled shutdown." caption="The 60000 RPM operating example and higher assumed trip are distinct values." %}

**Dashboard:** retained N1/temperature limits set approach colours. Shutdown has its own enable switch; a marker is not proof of a physical trip test. Find limits through **Dashboard → Edit cards → Edit limit & safety**, or Controllers. [Build 2]({{ '/guided-builds/control/#limits' | relative_url }}) covers pressure markers and limiting.

<h2 id="sequence">7 · Build startup and shutdown</h2>

Open **Sequence → Startup**, reviewing any defaults before replacement. Choose **+ Add block**, add the stated type, open its card and set the fields. Use the grip to reorder. Device commands are **ACTION** entries; **Set Starter — UNTIL** waits for N1.

| Order | Startup block | Teaching setting / purpose |
| --- | --- | --- |
| 1 | Build Oil Pressure | Target {{ e.oil_target_bar }} bar; minimum {{ e.oil_min_bar }}; timeout {{ e.prime_timeout_ms }} ms |
| 2 | Set Starter — UNTIL | {{ e.starter_pct }}%, ramp {{ e.starter_ramp_pct_s }}%/s; N1 {{ e.n1_crank_rpm }}; timeout {{ e.crank_timeout_ms }} ms |
| 3 | Set Igniter — ACTION | ON |
| 4 | Set Fuel Shutoff — ACTION | Open; verify actual command polarity |
| 5 | Set Main Fuel Metering — ACTION | {{ e.fuel_idle_pct }}% assumed starting fuel |
| 6 | Confirm Combustion by Temperature | {{ e.tot_lightoff_c }} °C; timeout {{ e.lightoff_timeout_ms }} ms |
| 7 | Final Startup Checks | Require N1 ≥ {{ e.n1_final_min_rpm }} RPM, oil ≥ {{ e.oil_min_bar }} bar, TOT ≥ {{ e.tot_lightoff_c }} °C; stable {{ e.stable_ms }} ms; timeout {{ e.stable_timeout_ms }} ms |
| 8 | Set Starter — ACTION | 0% |
| 9 | Set Igniter — ACTION | OFF |
| 10 | Final Startup Checks | Repeat after starter release to verify sustained operation |

Both Final Startup Checks instances share settings. Leave their optional output-release switches off: explicit actions perform release. The second check must pass without starter assistance. This path uses an explicit fuel command instead of **Accelerate to Idle**, whose built-in fuel behavior is different.

{% include build-screen.html file="sequence-engine-startup" step="The complete Startup" alt="Startup builds oil pressure, cranks, ignites, admits fuel, checks temperature and stable readings, releases starter and ignition, then checks again." caption="Follow this one path. Test evidence comes from safe equipment or simulation; timers alone do not prove combustion." %}

On **Shutdown**, add **Immediate Fuel and Ignition Cut → Wait for Rotor to Slow → Cooldown → Wait for Complete Stop**. Fuel and ignition cut first. Set the N1-drop threshold below the actual starter's safe re-engagement speed. In **Cooldown**, choose oil pumping ON, {{ e.oil_target_bar }} bar target and {{ e.tot_cooldown_c }} °C temperature target; starter cooling stays OFF unless its mechanism supports it. Give every wait a finite, engine-appropriate timeout. Shutdown can continue after cooling timeout: check final oil behavior deliberately.

{% include build-screen.html file="sequence-engine-shutdown" step="The matching Shutdown" alt="Shutdown cuts combustion, waits for speed drop, cools with oil delivery and waits for stop." caption="Check final fuel/ignition off states and required lubrication on the actual installation." %}

Save and reopen both paths. This release can show **SafetyHold present but no Spool block** for this explicit-command path. Check that the Starter 0% action is present before the second Final Startup Checks and that the final preview shows Starter 0%; then confirm the reviewed warning. A missing starter cut or missing sensor evidence must be corrected. Startup fuel should point to the Running controller; shutdown behavior must match the installation.

<h2 id="verify">8 · Prove the setup and save it</h2>

Keep hazardous energy isolated. Use safe signal sources or simulation for conditions you cannot produce physically; do not bypass protection to force a test through.

- Verify each input, calibration, output direction and physical off state.
- Follow Startup with valid evidence: oil before ignition and stable checks after starter release.
- Leave a required condition unsatisfied: its timeout must produce the stated abort/fault and fuel cut.
- Test STOP during startup and Running. Check physical isolation and lubrication, not just the mode label.
- Exercise feedback loss and inspect the reason and output response. Reduced power does not restore missing protection.
- Save/reload and download the engine file from **System → Maintenance → Full engine file backup / restore**. Label it **Build 1 — basic turbojet**, recording physical versus simulated checks.

You have one coherent configuration and know where its settings belong. Actual commissioning needs the engine's measured limits and verified starting behavior.

<span id="fuel-without-idle"></span><span id="a-complete-very-basic-dummy-load-sequence"></span>
Alternative methods belong in the [User Guide]({{ '/user-guide/' | relative_url }}) and [optional workshops]({{ '/guided-builds/instruments/' | relative_url }}).

<p class="document-nav"><a href="{{ '/guided-builds/parts/' | relative_url }}">Parts and worksheet</a><a class="button" href="{{ '/guided-builds/control/' | relative_url }}">Build 2 →</a></p>
