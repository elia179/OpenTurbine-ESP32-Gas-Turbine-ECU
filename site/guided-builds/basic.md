---
layout: document
title: Build 1 Configure a basic turbojet
description: Set up the essentials for a basic turbojet and check the startup and shutdown sequence on the bench.
lede: Connect and check the sensors and outputs, then save a backup after a dry run.
permalink: /guided-builds/basic/
build_level: 1
---

{% assign e = site.data.guided_example %}

{% include build-brief.html begin="#power" start="An installed development board, the parts/pin worksheet and isolated load power." change="Fit and check inputs/outputs, then define fuel/oil control, protection and transitions." finish="Input checks, output tests and dry start/stop pass; save the Build 1 backup." %}

{% include guided-nav.html %}

{% include guided-intro.html compact=true %}

## What you will build

Our example is a homemade, HX80-sized **turbojet**: one compressor/turbine shaft, liquid fuel, spark ignition and an electric starter. OpenTurbine commands its fuel pump, starter, ignition, and oil pump. A separate free power turbine comes in Build 3.

Normal full-power readings are about **{{ e.n1_full_rpm }} RPM N1**, **{{ e.p1_normal_min_bar }}–{{ e.p1_normal_max_bar }} bar combustor pressure** and **4–5 bar oil pressure**. N1 means gas-generator shaft speed. TOT means temperature measured after its turbine. Pressure examples use **bar gauge**, measured above atmospheric pressure. Fuel delivery pressure is a different measurement.

**Example numbers teach configuration.** The [engine worksheet]({{ '/guided-builds/parts/#engine-worksheet' | relative_url }}) distinguishes these operating readings from assumed idle, fuel and protection values. Replace assumed settings with your engine's verified data before live operation. The guide configures an existing engine; it does not design its combustor, bearings or starter coupling.

Start with [installation]({{ '/get-started/' | relative_url }}), the [parts and pin tables]({{ '/guided-builds/parts/' | relative_url }}) and a meter. During initial checks, disconnect real fuel, ignition energy and starter power; use signal observation or suitable dummy loads. An independent physical stop must remove hazardous energy without the ECU or browser. Lubrication is part of the installation from the beginning.

{% include build-figure.html file="level-1" alt="Basic turbojet inputs are N1, exhaust temperature, throttle and oil pressure; commands go to starter, ignition, fuel pump, and oil pump." caption="These are the connections used in the Build 1 bench walkthrough." %}

<h2 id="power">1 · Connect the ECU and Start/Stop</h2>

An **input** reports a measurement or request. An **output** sends a command to a **driver**, which switches load power. GPIO means a numbered signal pin on the ESP32; it does not supply a pump or starter.

1. Power the board by USB alone for this first check. Open OpenTurbine and select the correct target/profile in **Hardware**.
2. Back up an existing setup using **System → Maintenance → Full engine file backup / restore**. Review preloaded channels; edit matching ones and remove unfitted examples before adding devices. Assign each physical device once.
3. Find the Classic ESP32 pins in the [connection table]({{ '/guided-builds/parts/#pin-plan' | relative_url }}). Follow the signal names.
4. Edit **Start** and **Stop** in Hardware. Connect each momentary pushbutton from its assigned GPIO to GND. Select **Active LOW**, enable **Pull-up** and leave Pull-down off. Save and allow the restart.

{% include build-figure.html file="power" alt="Separate fused ECU and load power paths with an independent physical stop in the hazardous load path." caption="Use USB alone initially. The final regulated ECU and load supplies must match the actual equipment." %}

{% include build-figure.html file="switch" alt="Pressing the button connects its GPIO to ground. The pull-up holds the input high when released." caption="Repeat for Start and Stop. Use a simple pushbutton with no external voltage on its terminals." %}

{% include build-screen.html file="stop-configured" step="Configure the Stop input" alt="Expanded Stop card with active-low polarity and internal pull-up selected." caption="Use GPIO 14 for Stop. Repeat on the separate Start input." %}

{% include build-screen.html file="start-configured" step="Configure the separate Start input" alt="Start Hardware card with its own GPIO, active-low polarity and pull-up." caption="Start and Stop are separate inputs with separate pins; check both displayed states." %}

**Check:** both buttons read inactive when released and active when pressed. Release Start after boot before trying a new press. These are ECU commands, separate from the physical energy-removing stop. Classic GPIO34–39 have no internal pull-ups; the example assigns the buttons elsewhere.

<h2 id="n1">2 · Add speed, temperature and throttle</h2>

Set up N1 speed, exhaust temperature, and throttle in any order. Save each input in **Hardware** so it appears in **Calibration** or on the **Dashboard**. Check its reading before using it for control or protection.

**Choose your own names.** Use names that make sense on your engine; **N1 Speed** (or simply **N1**) and **Main TOT** are suggestions. Screenshots use these example names. In later selectors, choose the corresponding device you named.

<h3 id="n1-setup">2.1 · N1 speed</h3>

Select **N1 speed**, enter your chosen name (suggested: **N1 Speed**), choose **Hardware pulse counter (PCNT)** under **Signal type** and assign its GPIO. Enter the pickup's actual **pulses per revolution** (PPR). The example uses one counted pulse per revolution. Its conditioner supplies clean 3.3 V-compatible pulses; raw magnetic pickups and 5 V outputs need conditioning.

{% include build-figure.html file="rpm" alt="A 3.3 V open-drain Hall demonstration input has supply bypass and an external pull-up on the pulse signal." caption="Open-drain Hall input example. Choose a pickup, target and mounting suitable for the shaft speed and environment." %}

{% include build-screen.html file="n1-configured" step="Configure the gas-generator speed input" alt="Expanded N1 Hardware card showing its name, pulse input, GPIO and pulses per revolution." caption="The example counts one pulse per revolution. Enter your pickup's actual PPR and your board's assigned GPIO; the name is your choice." %}

The diagram uses an external pull-up. For compatible short bench wiring, **Input bias → Pull-up** can supply bias on a suitable pin instead. Verify pulse quality at the required rate. At {{ e.n1_full_rpm }} RPM and 1 PPR, a generator supplies **1000 Hz**; at 100 Hz the display should show 6000 RPM. Compare against an independent reference.

<h3 id="temperature">2.2 · Exhaust temperature</h3>

Connect a K-type probe to a matching MAX31855 converter, not directly to GPIO. This converter does not use MOSI.

{% include build-figure.html file="thermocouple" alt="K-type probe connects to MAX31855; the ECU provides compatible supply, ground, shared SPI clock/data and unique CS." caption="CLK/SCK is clock, DO/MISO returns data, and CS selects the converter. Use a documented 3.3 V-compatible module." %}

In **Hardware → Shared sensor buses → Edit buses**, enable SPI, assign **SCK** and **MISO** and save.

{% include build-screen.html file="spi-configured" step="Configure the shared SPI bus first" alt="Hardware shared SPI bus editor with the bus enabled and clock and MISO pins assigned." caption="Use GPIO 18 for SCK and GPIO 19 for MISO. These bus signals are shared; each converter gets a separate CS pin." %}

Add **TOT / EGT**, enter your chosen name (suggested: **Main TOT**), choose **MAX31855** and assign its separate **CS** pin.

{% include build-screen.html file="tot-configured" step="Check the saved temperature interface" alt="Main TOT card with MAX31855, shared SPI pins and unique chip-select." caption="Enable the bus first. Use the Classic ESP32 pin table." %}

**Check:** a healthy room-temperature reading, rising with gentle warming and falling with cooling. Check probe polarity if incorrect. This proves basic response, not high-temperature accuracy.

<h3 id="throttle">2.3 · Throttle</h3>

Wire a 10 kΩ linear potentiometer with its ends at 3.3 V and GND and its wiper at the throttle ADC pin.

{% include build-figure.html file="throttle" alt="Potentiometer ends go to 3.3 V and ground; its wiper goes to the throttle ADC input." caption="Identify the wiper with a meter. This development-board circuit uses 3.3 V and GND at the ends." %}

Add **Throttle Input → Analog voltage input (ADC)**, assign the wiper's ADC GPIO and save.

{% include build-screen.html file="throttle-configured" step="Save the throttle Hardware input" alt="Throttle Hardware card with analog voltage interface and its ADC GPIO." caption="Configure and save the physical input before opening Calibration." %}

On **Calibration**, open **Throttle Input**, hold the knob at intended minimum and select **Capture Min**; repeat at maximum with **Capture Max**, then **Save**.

{% include build-screen.html file="throttle-calibration" step="Capture the actual endpoints" alt="Throttle calibration card with endpoint capture and Save controls." caption="Capture at the physical command minimum and maximum. Saved endpoints are measurements, not numbers to copy." %}

**Check:** minimum/middle/maximum give about 0%/50%/100% smoothly. If reversed, correct **Hardware → Throttle Input → Input direction** and verify again. Classic ADC inputs here use ADC1 for Wi-Fi compatibility.

<h2 id="pressure">3 · Add oil-pressure feedback</h2>

The example uses a **0–10 bar gauge transducer with 0.5–4.5 V output**. Its specified supply powers it; a divider conditions its output. Do not connect 4.5 V directly to GPIO.

{% include build-figure.html file="pressure" alt="A 15 kiloohm upper resistor and 10 kiloohm lower resistor divide the pressure output to 40 percent at the ADC." caption="This exact transducer produces 0.2–1.8 V at the ADC. Actual installations also need suitable fault/transient protection." %}

**Configure:** add **Oil Pressure → Analog voltage input (ADC)**, assign its ADC GPIO and save.

{% include build-screen.html file="pressure-configured" step="Configure the oil-pressure Hardware input" alt="Oil Pressure Hardware card with analog voltage input and its assigned ADC pin." caption="Save this sensor before calibration. Its supply and divider must match your actual transducer." %}

**Calibrate:**

1. Open **Calibration → Oil Pressure**. Leave **Include electric oil-pump control and minimum-output calibration** unchecked for **Sensor only** mode. It uses your external pressure source and sends no pump commands. Select **0 bar (gauge pressure)** for this sensor.
2. With the circuit safely depressurized, press **Start Calibration** to capture ambient. Apply a known pressure measured by a trusted gauge, enter it and select **Capture point**. Repeat at another point, select a straight-line fit for this sensor, then select **Compute Fit →** and **Save calibration**. Release pressure and verify zero.

For this circuit, zero is **{{ e.pressure_zero_mv }} mV** and sensitivity **{{ e.pressure_mv_per_bar }} mV/bar at the ADC**. {{ e.oil_target_bar }} bar corresponds to 920 mV. Verify your actual transducer and gauge instead of assuming identical calibration. Optional pump-assisted calibration is separate and can operate the pump.

{% include build-screen.html file="pressure-calibration" step="Start oil-pressure calibration against a gauge" alt="Oil-pressure calibration panel with sensor-only mode, zero-bar gauge reference and Start Calibration button." caption="Leave pump-assisted calibration unchecked. Start with the circuit depressurized, then follow the point-capture and fit steps above using your own gauge readings." %}

**Check:** zero and at least two reference pressures agree with the gauge, returning to zero afterward. An incorrectly scaled reading is not ready for protection.

Check any **estimated** reading against the gauge before relying on it. See [pressure signal checks]({{ '/guided-builds/control/#pressure-signal-checks' | relative_url }}) for range and signal-loss checks.

<h2 id="outputs">4 · Add and test the four outputs</h2>

Use rated external drivers and separate fused load power. Keep load current out of sensor grounds. Join references where required by nonisolated interfaces; follow module documentation for isolated ones.

| Add output / name | Example interface | Establish before saving |
| --- | --- | --- |
| **Starter** | RC servo / ESC pulse | Actual endpoints/arming; logical zero stops it |
| **Main Fuel Metering** | High-frequency duty PWM | Compatible frequency, polarity, physical off at 0% |
| **Igniter** | On/off driver | Spark command polarity and de-energized state |
| **Oil Pump** | High-frequency duty PWM | Ratings, direction and permitted command range |

For each device below, choose **Hardware → Add output**, its named purpose, driver and GPIO, then save. The teaching PWM driver accepts **{{ e.pwm_hz }} Hz, {{ e.pwm_bits }} bits**; match your driver. ESC pulses are a different signal from duty PWM.

<h3 id="starter">4.1 · Starter ESC</h3>

{% include build-figure.html file="servo" alt="An ESC receives command and signal ground; separate rated power supplies it." caption="Confirm arming and stop behavior before connecting starter power." %}

**ESC with a BEC:** the red receiver lead supplies power. With a separately powered ECU, leave it insulated. It belongs on neither GPIO nor the 3.3 V rail.

<details class="build-hint" markdown="1"><summary>Can the BEC power the ECU?</summary>

A regulated **5 V** BEC with enough current may feed the development board's documented **5 V power input**, with GND connected. Check its actual output: some BECs supply higher voltage. Use one supply path unless the board supports combining it with USB or another supply. See [Espressif's DevKitC power-input guidance](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html#power-supply-options).

</details>

{% include build-screen.html file="starter-configured" step="Configure the starter ESC signal" alt="Starter Hardware card showing RC servo or ESC output and pulse settings." caption="Match the ESC's signal endpoints and arming procedure. This GPIO carries the command, not starter power." %}

<h3 id="fuel">4.2 · Main fuel metering</h3>

{% include build-figure.html file="pwm" alt="PWM signal and reference connect to a driver; separate fused power carries load current." caption="Reuse this pattern for compatible fuel and oil drivers, each with its own load protection." %}

{% include build-screen.html file="fuel-configured" step="Check a PWM output" alt="Fuel output card showing frequency, resolution, polarity and safe settings." caption="Minimum reliable pump command is calibrated separately from electrical endpoints." %}

<h3 id="ignition">4.3 · Spark ignition</h3>

{% include build-figure.html file="relay" alt="The ECU Igniter GPIO drives a relay module. Its normally open contacts switch fused low-voltage power to a self-contained spark ignition unit; the unit supplies the spark plug." caption="This example switches the low-voltage supply to a self-contained spark unit: VCC powers the relay module; COM and NO switch the unit. Bare coils need their own ignition driver. Match contact ratings and command polarity." %}

{% include build-screen.html file="igniter-configured" step="Configure the ignition command" alt="Igniter Hardware card showing its on/off interface, GPIO and safe state." caption="Confirm physical off at logical zero using a dummy load before connecting ignition energy." %}

<h3 id="oil-pump">4.4 · Oil pump</h3>

Reuse the PWM wiring pattern with this pump's own rated driver and assigned GPIO.

{% include build-screen.html file="oil-pump-configured" step="Configure the oil-pump driver" alt="Oil Pump Hardware card with its PWM pin and electrical output settings." caption="Match the driver and direction to this oil pump." %}

<span id="fuel-shutoff"></span>
If your installation uses an ECU-controlled fuel shutoff valve, follow the [fuel shutoff solenoid example]({{ '/guided-builds/instruments/#fuel-shutoff' | relative_url }}). This bench example keeps fuel isolated independently of the ECU.

<h3 id="output-tests">4.5 · Test each output separately</h3>

For each output, open **Tools → Tool settings**, review short test duration and demand, save, then run its test. Begin with dummy loads or signal measurement. Check physical direction and return to the safe state after expiry.

{% include build-screen.html file="tool-settings" step="Review each test's demand and duration" alt="Tools settings showing actuator-test levels and timed durations." caption="Save conservative test settings before starting a test; connected outputs can energize." %}

{% include build-screen.html file="manual-tests" step="Find the individual actuator tests" alt="Manual actuator test cards for the configured engine outputs." caption="Test one output at a time with suitable dummy loads or isolated equipment, and verify it stops." %}

<span id="fuel-minimum"></span>
For this dry walkthrough, use the teaching fuel commands with the real fuel system isolated. Before running the real pump through the engine sequence, [measure its minimum reliable output]({{ '/guided-builds/control/#fuel-minimum' | relative_url }}) and use verified engine fuel commands.

<h2 id="ownership">5 · Give fuel and oil their normal commands</h2>

Hardware describes connections; **Controllers** defines normal control; **Sequence** handles transitions. Configure one normal controller per output.

<h3 id="main-fuel-control">5.1 · Main fuel</h3>

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

{% include build-screen.html file="automatic-idle-off" step="Keep this first build's idle support simple" alt="Idle support panel with the separate idle mode set to Off." caption="The Main Fuel controller's output-low value supplies this build's assumed idle demand." %}

<h3 id="oil-control">5.2 · Oil pressure</h3>

For oil, edit the existing pressure controller if one is already assigned to Oil Pump. Otherwise use the creator's separate **Oil pump** and **Pressure feedback** selectors, then **Create oil-pressure controller**. Open **Oil Pump → Oil Pressure Control**. Select **Oil Pressure**, the matching pump, **Pressure target set by → Fixed pressure**, and **{{ e.oil_target_bar }} bar**. Set the controller’s feedback-loss response to **Normal fault shutdown** and verify its command bounds against the oil rig.

Follow its **Low-pressure protection** link to **Shutdown & Protection → Oil circuit pressure protection → Oil Pump · low pressure**. Set **Low-pressure threshold** to {{ e.oil_min_bar }} bar, **Low-pressure confirmation** to {{ e.oil_confirm_ms }} ms and **Normal fault shutdown**. [Build 2]({{ '/guided-builds/control/#feedback' | relative_url }}) explains both cards.

**Check:** on an appropriate oil circuit, establish target pressure without excessive overshoot and compare the gauge. Response gain and pump duty depend on the pump. The sequence establishes lubrication before ignition and retains it during shutdown.

{% include build-screen.html file="oil-feedback-settings" step="Set the oil-pressure target and feedback-loss response" alt="Oil-pressure controller showing the fixed pressure target, pump command bounds and feedback-loss response." caption="Select your named sensor and pump. The low-pressure protection link opens the separate threshold and confirmation settings." %}

<h2 id="limits">6 · Set essential protection</h2>

Open **Controllers → Shutdown & Protection**. These are **assumed teaching thresholds**; replace them with verified engine settings before operation:

| Card | Value and enable state |
| --- | --- |
| N1 core speed | Maximum N1 Speed {{ e.n1_trip_rpm }} RPM; overspeed ON |
| Temperature protection | Temperature Source for Safeties = Turbine outlet temperature (TOT), using Main TOT; outlet limit {{ e.tot_trip_c }} °C; running shutdown ON |
| Oil circuit pressure protection → Oil Pump · low pressure | Threshold {{ e.oil_min_bar }} bar; confirmation {{ e.oil_confirm_ms }} ms; Normal fault shutdown. This is the setting from step 5.2. |

Startup's oil check comes next. It permits pressure to build before ignition without treating zero Standby pressure as a running fault. With separate startup-temperature guard OFF, normal temperature shutdown applies during Startup too. Build 2 teaches a separate guard.

{% include build-screen.html file="n1-warnings-configured" step="Enable protection separately from its limit" alt="N1 protection with the teaching speed limit and enabled shutdown." caption="The 60000 RPM operating example and higher assumed trip are distinct values." %}

{% include build-screen.html file="temperature-warnings-configured" step="Check the temperature source and shutdown" alt="Main TOT temperature protection with normal shutdown on and the separate startup guard and its two trips off." caption="Normal temperature shutdown covers Startup and Running in Build 1. Build 2 shows how to set separate startup limits." %}

{% include build-screen.html file="oil-circuit-protection" step="Verify the running low-pressure protection" alt="Oil Pump low-pressure card showing the threshold, confirmation time and Normal fault shutdown response." caption="This card uses the analogue pressure reading. The separate Oil-pressure switch protection card requires a fitted switch." %}

**Dashboard:** retained N1/temperature limits set approach colours. Shutdown has its own enable switch; a marker is not proof of a physical trip test. Find limits through **Dashboard → Edit cards → Edit limit & safety**, or Controllers. [Build 2]({{ '/guided-builds/control/#limits' | relative_url }}) covers pressure markers and limiting.

<h2 id="sequence">7 · Build startup and shutdown</h2>

<h3 id="startup">7.1 · Startup</h3>

Open **Sequence → Startup**, reviewing any defaults before replacement. Choose **+ Add block**, add the stated type, open its card and set the fields. Use the grip to reorder. Device commands are **ACTION** entries; **Set Starter — UNTIL** waits for N1.

| Order | Startup block | Teaching setting / purpose |
| --- | --- | --- |
| 1 | Build Oil Pressure | Target {{ e.oil_target_bar }} bar; minimum {{ e.oil_min_bar }}; timeout {{ e.prime_timeout_ms }} ms |
| 2 | Set Starter — UNTIL | {{ e.starter_pct }}%, ramp {{ e.starter_ramp_pct_s }}%/s; N1 {{ e.n1_crank_rpm }}; timeout {{ e.crank_timeout_ms }} ms |
| 3 | Set Igniter — ACTION | ON |
| 4 | Set Main Fuel Metering — ACTION | {{ e.fuel_idle_pct }}% assumed starting fuel |
| 5 | Confirm Combustion by Temperature | {{ e.tot_lightoff_c }} °C; timeout {{ e.lightoff_timeout_ms }} ms |
| 6 | Final Startup Checks | Require N1 ≥ {{ e.n1_final_min_rpm }} RPM, oil ≥ {{ e.oil_min_bar }} bar, TOT ≥ {{ e.tot_lightoff_c }} °C; stable {{ e.stable_ms }} ms; timeout {{ e.stable_timeout_ms }} ms |
| 7 | Set Starter — ACTION | 0% |
| 8 | Set Igniter — ACTION | OFF |
| 9 | Final Startup Checks | Repeat after starter release to verify sustained operation |

Both Final Startup Checks instances share settings. Leave their optional output-release switches off: explicit actions perform release. The second check must pass without starter assistance. This path uses an explicit fuel command instead of **Accelerate to Idle**, whose built-in fuel behavior is different.

{% include build-screen.html file="sequence-engine-startup" step="The complete Startup" alt="Startup builds oil pressure, cranks, ignites, admits fuel, checks temperature and stable readings, releases starter and ignition, then checks again." caption="Follow this one path. Use suitable test signals to check the order; timers alone do not prove combustion." %}

<h3 id="shutdown">7.2 · Shutdown</h3>

On **Shutdown**, add **Immediate Fuel and Ignition Cut → Wait for Rotor to Slow → Cooldown → Wait for Complete Stop**. Fuel and ignition cut first. Set the N1-drop threshold below the actual starter's safe re-engagement speed. In **Cooldown**, choose oil pumping ON, {{ e.oil_target_bar }} bar target and {{ e.tot_cooldown_c }} °C temperature target; starter cooling stays OFF unless its mechanism supports it. Give every wait a finite, engine-appropriate timeout. Shutdown can continue after cooling timeout: check final oil behavior deliberately.

{% include build-screen.html file="sequence-engine-shutdown" step="The matching Shutdown" alt="Shutdown cuts combustion, waits for speed drop, cools with oil delivery and waits for stop." caption="Check final fuel/ignition off states and required lubrication on the actual installation." %}

<h3 id="sequence-review">7.3 · Save and review both paths</h3>

Save and reopen both paths. This recipe uses Final Startup Checks and explicit fuel/starter actions instead of Accelerate to Idle. Verify that the Starter 0% action is before the second Final Startup Checks and the final preview shows Starter 0%. Check the handover to Main Fuel on entering Running; the Shutdown preview must show combustion off and the intended oil behavior.

<h2 id="verify">8 · Check your setup and save a backup</h2>

Keep hazardous energy isolated. Use suitable test signals for conditions you cannot produce directly; do not bypass protection to force a test through.

- **Measurements:** each input agrees with its reference; calibrated throttle travel is smooth.
- **Outputs:** each individual test uses the right connection and direction, then returns to its physical safe state.
- Follow Startup with valid evidence: oil before ignition and stable checks after starter release.
- Leave a required condition unsatisfied: its timeout must produce the stated abort/fault and fuel cut.
- Test STOP during startup and Running. Check physical isolation and lubrication, not just the mode label.
- Exercise feedback loss and inspect the reason and output response. Reduced power does not restore missing protection.
- Save/reload and download the engine file from **System → Maintenance → Backup & restore → Download backup**. Record **Build 1 — basic turbojet** and the checks completed with it; keeping the automatic filename is fine.

**Build 1 is complete when** these checks pass and the saved backup exists. Record any commissioning checks still needed with it. Continue to Build 2 only when this baseline works; live commissioning still needs measured engine limits and verified starting behavior.

{% include build-screen.html file="engine-backup-restore" step="Save a complete engine-file backup" alt="System maintenance card with full engine-file download and restore controls." caption="Download the file after saving and reopening your settings. Label it with the build stage and the checks actually completed." %}

<span id="fuel-without-idle"></span><span id="a-complete-very-basic-dummy-load-sequence"></span>
Alternative methods belong in the [User Guide]({{ '/user-guide/' | relative_url }}) and [setup examples]({{ '/guided-builds/instruments/' | relative_url }}).

<p class="document-nav"><a href="{{ '/guided-builds/parts/' | relative_url }}">Parts and worksheet</a><a class="button" href="{{ '/guided-builds/control/' | relative_url }}">Build 2 →</a></p>
