---
layout: document
title: Level 1 Build a basic OpenTurbine system
description: Add a small set of OpenTurbine inputs and outputs one at a time, pair simple wiring with actual software configuration, and verify a start and stop sequence dry.
lede: Follow each connection from the physical part to its software object, then check it before moving on.
permalink: /guided-builds/basic/
build_level: 1
---

{% include guided-nav.html %}

## Before you begin

Already wired? Jump to [output ownership and Dashboard warnings](#ownership) or the [complete dummy-load sequence](#a-complete-very-basic-dummy-load-sequence).

Install OpenTurbine and open its interface using [Get Started]({{ '/get-started/' | relative_url }}). Have a meter and the [Level 1 teaching parts]({{ '/guided-builds/parts/' | relative_url }}) available. This guide starts with a supported development board; PCB profiles show board-labelled connections instead of editable raw GPIOs.

This is a minimal **learning topology**: N1, turbine temperature, throttle, starter command, ignition command and fuel command, plus the required physical Start and Stop inputs. Begin with a handheld magnet, an unloaded servo and low-power dummy loads. Fuel, ignition energy and starter power stay disconnected. Your actual engine may require oil delivery, a shutoff valve and further feedback from the outset; fit those requirements before any operating attempt. An independent physical fuel/power stop applies at every level.


{% include build-figure.html file="level-1" alt="The Level 1 functional map: N1, turbine temperature and throttle inputs, and starter, ignition and fuel outputs." caption="Every signal path will be added separately. This is a functional view; it omits the detailed power circuits." %}

<h2 id="power">1 · Power and understand the ECU</h2>

**What we are adding:** the controller itself. An input reports something to the ECU. An output sends a command. The driver between an output and a motor, valve or igniter handles load power.

**Connect it.** For the first session, use the board's USB power alone. Confirm your board's permitted power arrangement before adding an external regulator or another source; do not join supplies casually. In a real installation, fuse the regulated ECU supply and each load supply separately. Route heavy load returns to a deliberate supply return, not through the ECU's sensor ground wiring. Join logic grounds only for interfaces that are not intentionally isolated.

{% include build-figure.html file="power" alt="The installation supply feeds a fused regulator for ECU power and a separate fused physical-stop path for driver and load power, with deliberate return wiring." caption="This is a functional power arrangement, not the component design or rating of an emergency-stop circuit. Verify your actual board power-input requirements." %}

**In OpenTurbine:** open **Hardware**, select the correct ESP32 target if using an editable development-board profile, and inspect the installed inventory. A fresh/default configuration can already contain example channels. Remove or adapt defaults you have not fitted before building this inventory; do not add duplicates on the same pin. An installer update is different from a clean install, so back up any existing configuration first.

**Add the required Start and Stop buttons.** Use two momentary dry contacts, each on its own GPIO. In Hardware, edit the existing **Start** and **Stop** control cards and assign the physical pins. For the short bench connections shown below, connect each contact between its GPIO and GND, select active-low and enable its internal pull-up. No external pull-up resistor is needed on a pin that supports internal bias. These ECU inputs are separate from the independent physical stop that removes energy.

**Choose the bias to match the wiring.** A switch to GND uses **Pull-up** and active-low; a switch to **3.3 V** uses **Pull-down** and active-high. Select one bias only. Classic ESP32 GPIO 34–39 have neither internal pull-up nor pull-down: use a suitable external resistor there. Longer or noisy wiring may also need an external resistor and conditioning. Start and Stop use their own control-card bias options; the generic switch card exposes **Input bias**.

{% include build-figure.html file="switch" alt="Internal pull-up inside the ESP32 holds the GPIO high; a dry contact connects GPIO to ground when pressed." caption="Repeat this circuit once for Start and once for Stop. Enable each input's pull-up and select active-low in Hardware." %}

{% include build-screen.html file="stop-configured" step="A configured Stop switch" alt="Stop Hardware card on GPIO 10 with Active LOW selected, Pull-up checked and Pull-down unchecked." caption="For the switch-to-ground wiring, choose Active LOW and enable Pull-up only. Released means inactive; pressed means shutdown requested. This is an ECU command, not the independent energy-removing stop." %}

{% include build-screen.html file="start-configured" step="A configured Start switch" alt="Start Hardware card on GPIO 9 with Active LOW and internal Pull-up enabled." caption="Repeat the same wiring pattern on a separate pin. Verify release and press separately; the Start input must be released after boot before a new press is accepted." %}

Hardware says what exists. Controllers says who normally commands an output. System holds ECU-wide settings. Calibration gives readings and output ranges meaning. Sequence handles ordered transitions. Tools tests the result; Dashboard shows live operation.

**Verify:** confirm the selected board matches reality and the UI can save/reload. With all load power isolated, measure the ECU supply and reference ground. If a board resets when a motor starts later, investigate supply/return/transient wiring before changing software.

<p class="build-next"><a href="#n1">Next: add N1 →</a></p>

<h2 id="n1">2 · Add N1 speed</h2>

**What we are adding:** a pulse signal measuring the gas-generator shaft's speed. For learning, a DRV5033 Hall sensor and handheld magnet make the electrical pattern visible. This sensor demonstration does not qualify a magnet or mounting arrangement for a high-speed turbine.

**Parts:** the documented 3.3 V Hall sensor, 100 nF bypass capacitor and leads; add a 10 kΩ resistor if using the external pull-up shown below. Confirm the actual package terminal order before applying power. An open-drain output pulls the signal low; a pull-up brings it high again.

{% include build-figure.html file="rpm" alt="Hall sensor VCC to 3.3 V, GND to ground, OUT to pulse GPIO, and an external 10 kiloohm pull-up from OUT to 3.3 V." caption="Use a clean 3.3 V-compatible pulse. A raw magnetic pickup or a 5 V push-pull sensor requires different conditioning." %}

**Internal pull-up is also an option for N1 and N2.** For a compatible open-drain/open-collector RPM sensor on short bench wiring, you can omit the external resistor and select **Hardware → N1 Speed → Input bias → Pull-up** (or the N2 card). Leave **Pull-down** off. The card below leaves internal bias off because its diagram uses the external resistor. Internal pull-ups are weak: check clean pulse edges at the highest required pulse rate; longer/noisy wires or excessive capacitance may need a suitable external pull-up and conditioning. Classic ESP32 GPIO 34–39 have no internal pull-up/down. A push-pull conditioner normally needs no bias; neither kind of pull-up makes a 5 V signal GPIO-safe. See [Espressif's GPIO restrictions](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html) and the [DRV5033 datasheet](https://www.ti.com/lit/ds/symlink/drv5033.pdf).

**In OpenTurbine:** on **Hardware**, choose **Add input → N1 speed**, open the new card and choose **Pulse / frequency input**. Name it **N1 speed**, then choose the actual connected GPIO. Set pulses per revolution from the pickup/target geometry; one magnet producing one counted pulse each revolution means 1 PPR. Resolve validation warnings, then save. Readable names identify the devices throughout these lessons; stable channel IDs are maintained by the interface and are not names to search for in the Add input menu.

{% include build-screen.html file="n1-configured" step="A configured N1 input" alt="Expanded N1 speed Hardware card showing the pulse interface, GPIO 6 and one pulse per revolution in the simulated ESP32-S3 example." caption="Compare the complete card with your wiring. GPIO 6 and 1 PPR belong to this teaching fixture; use your physical pin and actual target count. Save, reopen the card and check that its values remain." %}

**Verify:** pass the magnet repeatedly while watching the live N1 reading in Tools/Dashboard. A single slow pass may not produce a sustained RPM display because the measurement is time-based. For a meaningful speed check, use a bounded repetitive signal or safely driven test wheel and an independent tachometer. Never spin the real turbine just to prove this connection.

**If it stays at zero:** check VCC and GND, observe OUT switching high/low with the magnet, check the selected internal or external pull-up and GPIO, then check the saved N1 purpose/PPR. A magnet held stationary gives a state, not continuing pulses. A reading that changes still needs calibration against a known speed before overspeed protection can be trusted.

<p class="build-next"><a href="#temperature">Next: add turbine temperature →</a></p>

<h2 id="temperature">3 · Add turbine temperature</h2>

**What we are adding:** a K-type thermocouple and converter. The probe generates a small signal; the MAX31855 module converts it to digital data. The thermocouple never connects directly to ESP32 GPIO. OpenTurbine calls the outlet-temperature purpose **Turbine outlet temperature (TOT / EGT)**.

**Parts:** K-type probe and a breakout documented for 3.3 V power/logic. Check its actual terminal labels and grounding requirements. Use the correct thermocouple connector/extension materials and polarity.

{% include build-figure.html file="thermocouple" alt="K-type probe connects to the converter; MAX31855 VCC and GND connect to 3.3 V and ground, CLK and DO use shared SPI pins, and CS uses a unique GPIO." caption="CLK is clock; DO/MISO is data coming into the ECU; CS selects this converter. MAX31855 has no required MOSI connection." %}

**Set up the shared bus first:** open **Hardware → Shared sensor buses → Edit buses**. Turn on **Enable shared SPI bus**, select **SCK / clock GPIO** and **MISO / data from device GPIO**, then save. The example S3 pin plan uses SCK 12 and MISO 13. MAX31855 does not need MOSI. Confirm these match your wires before continuing.

{% include build-screen.html file="spi-configured" step="Enable SPI before adding the sensor" alt="Enable shared SPI bus is checked with SCK GPIO 12, MISO GPIO 13 and MOSI unassigned." caption="Save these bus settings first. MAX31856 also needs MOSI; do not leave MOSI unassigned for that converter." %}

**Add the sensor:** choose **Add input → TOT / EGT**, name the card **Main TOT**, and open it. Its purpose is **Turbine outlet temperature (TOT / EGT)**. Select **MAX31855** under **Sensor interface** and assign **CS GPIO** to the converter's actual chip-select wire (14 in this example). MAX31855 uses a converter matched to the thermocouple alloy; a selectable **Thermocouple type** field applies to MAX31856. Save and reopen the card.

{% include build-screen.html file="tot-configured" step="A configured temperature input" alt="Expanded Main TOT Hardware card with the MAX31855 interface, enabled shared SPI pins and its own chip-select GPIO in the simulated S3 setup." caption="A finished card identifies the converter and CS connection and shows the shared SPI bus. A disabled bus or missing-pin warning means setup is incomplete. The example uses SCK 12, MISO 13 and CS 14." %}

**Verify:** the probe should report a plausible room temperature and a healthy input. Warm the probe gently with a suitable safe heat source, then let it cool. Compare against a reference where practical. A fault or implausible negative reading calls for a probe/polarity/converter check, not a changed safety threshold. Room-temperature plausibility does not validate high-temperature accuracy or probe placement.

<p class="build-next"><a href="#throttle">Next: add throttle demand →</a></p>

<h2 id="throttle">4 · Add throttle demand</h2>

**What we are adding:** an operator input. Use a 10 kΩ linear potentiometer for the bench; its wiper supplies an analog voltage. An RC receiver can supply an alternative pulse input later, but its output must also be 3.3 V-compatible or conditioned.

{% include build-figure.html file="throttle" alt="A 10 kiloohm potentiometer has its ends connected to 3.3 V and ground, with the wiper connected to an ADC GPIO." caption="The potentiometer provides a request, not a direct motor-power path." %}

**In OpenTurbine:** add **Throttle Input**, purpose **Throttle input**, driver **Analog voltage input (ADC)**. Choose a valid ADC pin. On Classic ESP32, use ADC1 while Wi-Fi is active; the optional [ESP32-S3 pin plan]({{ '/guided-builds/parts/#an-optional-cumulative-pin-plan' | relative_url }}) uses GPIO 1. Save, then use **Calibration** to capture both throttle endpoints. Follow the wizard's prompts and save its result.

{% include build-screen.html file="throttle-configured" step="Configure the input before calibrating it" alt="Throttle Input Hardware card configured as an analog input on GPIO 1, with input direction and signal validity fields." caption="The Hardware card describes the electrical input. Save it first; your measured endpoints belong in Calibration." %}

**Find the wizard:** open **Calibration**, choose **Throttle Input** in **Jump to fitted calibration**, then find **Capture Min**, **Capture Max** and **Save**. Hold the physical knob at each endpoint while capturing; save after both captures. The screenshot shows the starting screen, before this lesson's endpoints have been measured.

{% include build-screen.html file="throttle-calibration" cropped=true step="Capture both endpoints" alt="Focused Throttle Input calibration card showing Capture Min, Capture Max and Save." caption="Capture each real endpoint, then save. The starting 0–3300 mV range is a default, not proof of measured travel. Save may already be available when endpoint values exist; recapture both for your actual input. Fuel-pump calibration is separate." %}

**If the knob works backwards:** open **Hardware → Throttle Input → Input direction**, switch **Invert input** on or off, then save. You can reverse the command in software without moving the wires. Return to Calibration and verify minimum, middle and maximum again; the intended minimum must read 0% and maximum 100%.

**Verify:** turn the knob through minimum, middle and maximum. The calibrated demand should move smoothly in the intended direction. A jumpy input suggests a poor wiper/ground connection or noise. Confirm minimum again before every output test.

<p class="build-next"><a href="#starter">Next: learn a servo or ESC command →</a></p>

<h2 id="starter">5 · Add a servo or ESC command</h2>

**What we are adding:** the starter's command interface. A servo-style signal is a train of timed pulses; it is different from high-frequency duty PWM. Start by observing it on an unloaded compatible hobby servo. An actual starter ESC needs its own arming, power and stop arrangement.

{% include build-figure.html file="servo" alt="ECU signal GPIO connects to the servo or ESC signal, grounds provide a common reference, and a separate device-rated supply powers the device." caption="The control wire carries a command. The separate supply carries servo or motor energy." %}

**In OpenTurbine:** add output **Starter**, purpose **Starter**, driver **RC servo / ESC pulse output**. Choose its GPIO and the endpoints required by your device. The driver's displayed 1000–2000 µs family describes a common pulse convention; it does not establish correct endpoints or arming for every ESC. Set inversion/parked behavior deliberately and save.

{% include build-screen.html file="starter-configured" step="A configured starter signal" alt="Starter Hardware card on GPIO 15 with servo signal type, normal direction and pulse endpoints." caption="Compare Signal type, GPIO, direction, pulse at 0% and pulse at 100%. Expand Advanced output settings to check initialized and fault behavior. These example pulse endpoints are for the unloaded bench servo, not an automatically suitable starter ESC setup." %}

**Verify:** in **Tools**, with the ECU in STANDBY, open the fitted starter test and its test settings. Use a short bounded test on the unloaded servo or observe the signal without starter power. Check both endpoints and the state after the test expires. Do not attach a servo arm that can strike something. If the servo does not respond, verify separate power, common reference, pulse compatibility and GPIO before changing its endpoints.

**Find the test controls:** open **Tools** and locate **Starter Test**. Open **Tool settings** first to review duration, demand and the confirmation preference, then save/close the dialog. Return to the fitted test card and choose **Run** only when the unloaded bench arrangement is ready. Opening settings does not run the actuator.

{% include build-screen.html file="manual-tests" step="Find the fitted test" alt="Tools page in Standby with Starter Test, Igniter 1 Test and Tool settings." caption="The Starter Test card is on the right. Keep Developer Mode off for ordinary timed output checks; select the fitted test rather than an unrelated assist test." %}

{% include build-screen.html file="tool-settings" step="Review test settings" alt="Tool settings dialog showing Starter Test duration and output, safety confirmation, and Save settings." caption="Find Starter tests, choose the appropriate bounded demand and duration, leave confirmation enabled, then select Save settings. The displayed numbers only illustrate the fields." %}

<p class="build-next"><a href="#fuel">Next: learn a PWM driver →</a></p>

<h2 id="fuel">6 · Add PWM fuel-command hardware</h2>

**What we are adding:** a proportional output through a power driver. For learning, the driver feeds a small suitable DC dummy load. In the actual installation, it commands the correctly rated fuel pump or other metering hardware.

{% include build-figure.html file="pwm" alt="ECU PWM GPIO and reference ground connect to a nonisolated low-side driver; fused load power reaches the load positive, its negative connects to the driver's switched output, and driver power ground returns to the supply." caption="This is one low-side driver pattern. A high-side, isolated or differently labelled module must be wired using its own documentation." %}

**In OpenTurbine:** add **Main Fuel Metering**, purpose **Main fuel metering**, driver **High-frequency duty PWM output**. Choose GPIO, frequency and resolution compatible with the driver, then define inversion and safe demand. A logical 0% must produce the intended physical off state; a driver advertised as active-low may need different polarity. Save the channel.

{% include build-screen.html file="fuel-configured" step="A configured PWM fuel-command output" alt="Main Fuel Metering card on GPIO 16 with normal PWM direction, 0–100% duty endpoints, 1000 Hz carrier and 10-bit resolution." caption="The bench driver example uses 1000 Hz and 10 bits. Advanced output settings shows the carrier and the fixed off initialization/fault behavior. Minimum reliable pump command is a separate calibration; do not substitute PWM endpoints for it." %}

**Verify:** first check logic-level polarity without load power. Then test only the benign dummy load with a bounded output test in Tools. Confirm low/middle/high commands and parked state afterward. A percentage on screen means commanded output, not verified fuel flow or motor speed. Real pumps need calibration and a separately verified shutoff path; do not use this lesson's dummy-load demands as a fuel schedule.

**For a real metering pump:** after checking its driver, use **Calibration → Minimum Reliable Fuel-Metering Output** on a suitable safe rig, with ignition disabled and fuel routed away from the engine. Select **Start 1%/s sweep**, then **Metering started — stop** at the first reliable metering. Fine-adjust, run **Test restart**, then save only if all three starts are repeatable. Follow the pump manufacturer's priming/lubrication requirements; do not run a pump dry unless permitted. This calibrates the pump's usable command, **not engine idle speed**. Leave 0% for this dummy-load lesson; it is not a measured pump calibration.

{% include build-screen.html file="fuel-minimum-calibration" cropped=true step="The separate pump-minimum calibration" alt="Minimum Reliable Fuel-Metering Output card with enabled Start sweep, Test restart and Save buttons and a disabled stop button before a sweep." caption="Stop is disabled until a sweep starts. The other controls are available; 0% is this dummy-load fixture's saved minimum, not a real pump result." %}

<p class="build-next"><a href="#ignition">Next: learn on/off switching →</a></p>

<h2 id="ignition">7 · Add an on/off ignition command</h2>

**What we are adding:** a binary output. A relay interface lets a small logic signal control a separate low-power lamp circuit. The lamp stands in for the ignition command during learning. A real igniter requires its specified driver/isolation; this figure is not an ignition-coil design.

{% include build-figure.html file="relay" alt="Relay module IN receives ECU GPIO, VCC receives its rated coil supply and GND shares the logic reference; COM receives fused lamp power, NO goes to lamp positive, and lamp negative returns to the supply." caption="COM and NO are switched contacts. They are separate from VCC, GND and IN on the control side." %}

**In OpenTurbine:** add **Igniter**, purpose **Igniter**, driver **On/off relay output**. Assign GPIO, active polarity and safe/parked state. Save. Keep the switched load supply disconnected while confirming that the control behaves as intended.

{% include build-screen.html file="igniter-configured" step="A configured igniter command" alt="Igniter Hardware card configured as a relay output on GPIO 17 with direction, off initialization and combustion fault behavior." caption="Use a lamp instead of an igniter for this exercise. Normal direction only suits a driver whose physical off/on behavior matches it; confirm that with a meter. No coil or lamp current flows through GPIO." %}

**Verify:** run the igniter's short test in Tools with the lamp circuit only. Confirm the lamp is off in STANDBY, turns on only during the test and turns off afterward. Check what happens during reboot with load power isolated. A relay's click does not prove that its correct contact or load is connected. If it remains on, check active-low behavior, NO versus NC, and the parked command.

<p class="build-next"><a href="#ownership">Next: connect the software relationships →</a></p>

<h2 id="ownership">8 · Output ownership and Dashboard warnings</h2>

Your Hardware inventory now describes three sensor/operator inputs, the required Start/Stop controls, and three outputs. It has not yet said when each output should operate.

<figure class="build-figure"><img src="{{ '/assets/images/guided-builds/level-1-hardware.png' | relative_url }}" width="1600" height="1100" loading="lazy" alt="Simulated Level 1 Hardware inputs showing assigned Stop and Start controls, N1 Speed, Main TOT and analog Throttle Input on the example S3 pins."><figcaption>The current Hardware interface with the completed Level 1 inputs. This is a simulated inventory, not an engine tune; output cards continue below it. Select the image to enlarge.</figcaption></figure>

Open **Controllers**. Under **Output controllers**, inspect any existing controller for **Main Fuel Metering**. If no controller owns it, expand **+ Create controller**, choose your fuel output in **What do you want to control?** (it appears under its configured display name), then select **Create controller**. Open the resulting card and inspect **Controlled output**, **Control method** and **Controlled by**. The default for a fitted main-fuel output with a throttle input is a mapped input; verify the source, calibrated range, output authority and operating states for your actual fuel system before saving.

Understand the configured normal owner before enabling optional idle or governor features. A throttle request passes through the applicable controller and protections; it does not bypass STOP or limits.
{% include build-screen.html file="controllers-overview" step="Find output ownership" alt="Controllers overview showing Output controllers, Create controller, built-in subsystems and Shutdown and Protection." caption="Output controllers is where ordinary ownership is defined. Fuel-metering support contains optional supporting behavior; fitting hardware alone does not create a normal owner." %}

{% include build-screen.html file="main-fuel-controller" step="Inspect the fuel controller" alt="Expanded main-fuel controller showing its controlled output, mapping method and throttle input." caption="Confirm that the output and input refer to the intended devices. Review this card rather than assuming the Hardware purpose automatically selected a suitable controller." %}

<h3 id="fuel-without-idle">Fuel pump control with or without idle</h3>

Adding **Main Fuel Metering** does not require idle control. For this bench lesson, set **Controllers → Fuel-metering support → Idle → Running Idle Mode = Off**, then use the mapped throttle owner with **Input low = 0%**, **Input high = 100%**, **Output low = 0%**, **Output high = 100%**, and **RUNNING only**. Save and reopen. A new fuel controller normally seeds Output low from the saved pump minimum, so inspect it rather than assuming zero.

{% include build-screen.html file="automatic-idle-off" cropped=true step="Running idle switched off" alt="Fuel-metering support Idle card showing Running Idle Mode set to Off, with no idle floor." caption="Off removes the Running idle floor. It does not change startup commands or the fuel controller's Output low." %}

| Running Idle Mode | What it does after Startup finishes |
| --- | --- |
| **Off** | Adds no idle floor, even if an Idle Input is fitted or Startup retained an idle value. Throttle can reach zero when **Output low = 0%**. |
| **Fixed fuel percentage** | Uses **Fixed Running Idle Fuel (%)** instead of retained startup idle. Throttle can command more. A nonzero fixed value below pump minimum is raised to that minimum. |
| **Input channel** | Defaults to the configured Idle Input. You can choose any other fitted input and map its endpoints to pump minimum through Maximum Normal Idle Fuel Output. An unhealthy input keeps the retained-startup fallback. |
| **Automatic Idle** | Regulates the Running fuel floor using N1, N2, P1 or P2 feedback. Its source, target, cutoff and tuning settings appear directly below the mode. |

**Output low (%)** remains a separate mapped minimum. **Input low** shows a short Running-only note when an idle source supplies a floor; Off and fixed zero show no idle-floor note. Input percentages are display units: 50% is stored as 0.5, with decimal percentages supported.

{% include build-screen.html file="fixed-running-idle" cropped=true step="Optional fixed Running idle" alt="Idle card with Fixed fuel percentage selected and Fixed Running Idle Fuel set to 12.5 percent." caption="This illustrative 12.5% is not an engine recommendation. The fixed floor begins in Running, replacing the retained startup idle value; startup commands remain unchanged." %}

**To regulate idle automatically:** select **Automatic Idle**, then choose a fitted **Idle Feedback Source** and set its **Idle Target**, **No-Correction Band** and **Stop Controlling Above**. Only RPM or pressure fields relevant to that source are shown. Zero target or cutoff disables correction. A missing proportional fuel output or feedback input is explained on the card and blocks saving an enabled setup; settings do not disappear.

{% include build-screen.html file="automatic-idle-configured" cropped=true step="Automatic Idle settings are here" alt="Automatic Idle selected with N1 feedback, an illustrative 600 RPM target, 50 RPM no-correction band and 800 RPM cutoff; response tuning is collapsed." caption="These are low-speed signal-generator examples, not turbine settings. Use independently established targets and prove the response with hazardous loads isolated." %}

**Response tuning** contains fuel increase/decrease times, long-term correction and the fuel-range multiplier. The effective fuel ceiling is **Maximum Normal Idle Fuel Output × Maximum Fuel Range Multiplier**, capped at 100%. For example, **35% × 1.5 = 52.5%**: 35% is the base ceiling; 52.5% is Automatic Idle's extended authority, not a fixed fuel command. The summary shows both the calculation and the resulting range. **Predictive tuning** appears only when its method is selected. Above the cutoff or with unhealthy feedback, Automatic Idle releases its added floor; separate input-loss and engine protections still apply. It does not override Startup, STOP or hard shutdown.

**Opening an older engine file:** an existing automatic or input-based setup appears under the corresponding mode without rewriting the file. If it instead retains a Startup idle value, the card asks you to choose a mode before changing Idle settings. Unrelated settings can still be saved without changing its current behavior. No fixed fuel percentage is guessed from Startup.

**To use an idle knob:** configure and calibrate its input in Hardware, then select **Input channel**. **Idle Input Channel = Automatic: configured Idle Input** uses the channel assigned the Idle purpose, with its calibrated 0–100% travel. You do not need to select it again.

{% include build-screen.html file="idle-input-auto" cropped=true step="Configured Idle Input selected automatically" alt="Idle card with Input channel mode and Automatic: configured Idle Input selected." caption="The default uses the fitted Idle Input and shows its effective Running fuel range." %}

**To use another input:** choose it under **Idle Input Channel**, then set **Idle Input Low** and **Idle Input High**. Low maps to pump minimum; high maps to **Maximum Normal Idle Fuel Output**. Operator inputs use %, other sensors use their engineering units (V, bar, RPM, etc.); generic inputs use their calibrated numeric value. Values outside the endpoints are clamped; reverse the endpoints to invert the mapping. An explicit choice stays tied to that input if the Hardware list is reordered. A missing selection blocks saving instead of choosing another sensor.

{% include build-screen.html file="idle-input-selected" cropped=true step="Explicit input and mapping endpoints" alt="Idle card with a fitted Idle Input explicitly selected and its endpoints shown as 0 and 100 percent." caption="An explicit selection exposes its own mapping endpoints. These example fuel percentages are illustrative, not an engine tune." %}

This selection controls the **Running floor only**. **Set Main Fuel for Idle** and **Set Modified Idle** in Startup still use the Hardware Idle Input; changing the Running channel does not rewrite those actions. If a selected input becomes unhealthy, its Running floor falls back to retained startup idle within the configured idle fuel range; prove that behavior on a safe bench before operation.

The pump-minimum calibration remains separate: outside STANDBY, a nonzero command below that minimum becomes off; it does not create an RPM-holding controller or force a zero command on. Do not erase a measured pump minimum merely to disable idle. Real engines may require a stable minimum fuel schedule—this no-idle dummy-load example is not an engine operating recommendation. STOP and hard shutdown remain fuel-cut paths.


The starter and igniter operate during startup transitions. Main fuel receives explicit sequence commands during the necessary stages, then hands over to its running controller. Hardware contains physical polarity/endpoints and safe states. System is not the place to add another physical pump channel.


Configure and verify the engine's N1/temperature protections before any real operation. Use measured/manufacturer limits and healthy calibrated inputs. A displayed warning zone is not evidence that a hard trip is enabled. [Level 2]({{ '/guided-builds/control/#limits' | relative_url }}) explains the distinction more fully; the underlying safety requirement already applies here.

### Set up Dashboard references and warnings now

Do this in Level 1, immediately after the sensors work. N1 and engine-temperature references come from **Controllers**. Open **Shutdown & Protection → Fuel Limiting & Hard Shutdowns**:

1. Open **N1 core speed** and enter your verified **Maximum N1 Speed**. The web Dashboard displays its approach advisory from **85% of this reference**. There is no separate web-Dashboard N1 warning-RPM field.
2. Open **Turbine temperature**. Select **Primary Engine Temperature** to match the fitted probe, enter the correct outlet or inlet limit, and configure **Maximum EGT During Startup** deliberately. Zero for the startup setting inherits the normal reference. The web Dashboard approach advisory also starts at 85% of its applicable temperature reference.
3. Review **Temperature Warning Margin** separately. It supports the default temperature pullback start and the external cluster's automatic temperature warning; it does not replace the web Dashboard's 85% approach advisory.
4. Decide and test the separate **N1 overspeed enabled** and **Engine overtemperature enabled** switches. A limit with the protection off is advisory only; entering a number does not enable the hard shutdown. Save, reload Controllers, then compare Dashboard units and references.

{% include build-screen.html file="n1-warnings-configured" step="Find the N1 reference and protection switch" alt="N1 core speed card with Maximum N1 Speed 1000 RPM and N1 overspeed disabled for a simulator advisory example." caption="1000 RPM is only a simulator display example. It is not an engine limit. The unchecked overspeed switch deliberately demonstrates advisory-only behavior; a real engine needs its independently verified protection settings." %}

{% include build-screen.html file="temperature-warnings-configured" step="Find the temperature reference and startup choice" alt="Turbine temperature card with automatic TOT source, 60 degree simulator reference, startup inheritance and overtemperature disabled." caption="60 °C and 5 °C margin are simulator illustration values, not turbine settings. Select the actual probe source and engine-specific limits; review the independent enable switch." %}

{% include build-screen.html file="dashboard-n1-advisory" cropped=true step="Recognize an advisory-only Dashboard" alt="N1 Dashboard card showing 900 RPM against a 1000 RPM reference and an advisory-only approach message." caption="The simulated signal is at 90% of the reference. The words advisory only mean the hard protection is not enabled. Do not interpret a colored bar as an armed trip." %}

**Check the result:** units and sensor source are correct, references agree with the saved settings, unhealthy inputs are not treated as valid readings, and the displayed advisory/active status agrees with the intended protection. Test actual shutdown response with hazardous loads isolated. **System → External Display Thresholds** controls an optional external cluster, not these web-Dashboard warnings. Continue in [Level 2]({{ '/guided-builds/control/#limits' | relative_url }}) for gradual limiting and hard-trip verification.

**Other sensor scales:** pressure, voltage, current, flow, thrust, torque and additional continuous inputs have a bar and recent trend. Select the scale below a bar to set a fixed **Low/High** range in the displayed units, or use auto scaling. Choose a useful instrument span, not an invented safety limit. This view preference stays in this browser and does not change calibration or protection. Switches remain On/Off indicators.

{% include build-screen.html file="dashboard-oil-trend" cropped=true step="Oil pressure: reading, minimum, scale and recent trend" alt="Oil pressure card showing a white 2.4 bar reading, 1.4 bar minimum, a green bar with a 0–5 bar automatic display scale and a recent trend." caption="The green sensor bar uses the labelled display range. Select 0–5 bar · auto to choose a fixed range; the 1.4 bar minimum remains a separate protection reference." %}

**Verify:** you should be able to point to the physical fuel output and identify the ordinary controller, any sequence commands and the shutdown behavior. If two enabled normal controllers claim the same output, resolve the ownership rather than hoping the last one wins.

<h2 id="sequence">9 · Build a sequence</h2>

**What we are adding:** ordered transitions. On **Sequence**, review any default blocks before using them. They are not automatically a suitable tune for your engine. Select the current fitted output by its displayed name; ordinary device actions appear as **Set Output** cards, while supported specialized blocks provide feedback checks.

**Find the block picker:** open **Sequence**, select **Startup** (or **Shutdown** for the other path), then choose **+ Add block**. Read both the title and explanation. In this inventory there are two **Set Starter** entries: the **UNTIL** block waits for N1 evidence, while the **ACTION** entry simply commands the fitted output. They are different operations.

{% include build-screen.html file="sequence-picker" step="Choose the correct kind of block" alt="Add Startup block dialog listing until, action, timed-delay and combustion-confirmation blocks." caption="The short type description explains whether a block commands, waits or checks. Adding a block appends it to the current path." %}

After adding a block, click its card header to expand its settings. Ordinary device cards expose the selected output and its demand/state. For a feedback wait, inspect the completion condition and finite timeout. Use the grip to reorder steps. The examples below are isolated editor demonstrations, not a complete startup sequence.

{% include build-screen.html file="sequence-output" step="Open an output action" alt="Expanded Set Igniter action and final-state preview in the Startup editor." caption="An ACTION block commands the fitted igniter. Review the on/off command and the final-state preview. An isolated command that leaves ignition on is not a finished sequence." %}

{% include build-screen.html file="sequence-feedback-wait" step="Inspect a feedback wait" alt="Expanded Set Starter until block showing N1 completion target, ramp settings, timeout and side actions." caption="The UNTIL card exposes speed evidence and a timeout. Review all displayed defaults against the actual engine; add the required subsequent release and shutdown actions." %}

Build and inspect a dry conceptual path:

| Stage | Meaning | What must be decided for the real engine |
| --- | --- | --- |
| Prepare | Verify required readiness and lubrication | Required evidence and safe entry conditions |
| Crank | Command the starter | Demand, speed evidence and finite timeout |
| Ignite and admit fuel | Explicit igniter/fuel/shutoff actions | Actual order and calibrated demands |
| Confirm combustion | Require appropriate temperature/flame/RPM evidence | Valid indication, confirmation and failure timeout |
| Accelerate and hand over | Reach verified conditions before RUNNING | Target, starter release and final checks |
| Stop | Remove fuel/ignition commands, perform required cooldown | Fuel isolation, oil/cooldown needs and final states |

Every wait must have a finite timeout and defined safe failure outcome. When a required shutoff or oil system exists, include it; do not leave it out to keep the teaching picture small. The sequence editor's structural errors block START, while warnings require review. Do not use Bench Mode to hide a structural problem in an operating setup.

### A complete, very basic dummy-load sequence

This example makes the unloaded starter servo move and the two dummy loads light briefly, then leaves every output off. It teaches a finished sequence without pretending to light a turbine. Keep real fuel, ignition and starter energy physically disconnected. In **Controllers**, use **Fixed output in selected states**, **0%**, **Running** for the bench Main Fuel Metering owner so handover cannot reapply a nonzero knob demand. Do not use this fixed-zero controller for engine operation.

{% include build-screen.html file="bench-fuel-zero-configured" step="The bench-only Running owner" alt="Main Fuel Metering controller configured as Fixed output in selected states with zero demand." caption="This temporary bench relationship prevents a raised throttle knob from restoring a fuel command after the demonstration sequence. Set it to Running only and verify the saved state selection. It is not an engine fuel controller." %}

On **Startup**, add the following eight blocks in this order. For the ordinary commands choose the **ACTION** entry, expand it, select **Output device**, and set its percentage or ON/OFF value. Keep any transition time at zero for this exercise.

| Order | Block | Configured value |
| --- | --- | --- |
| 1 | Set Starter — ACTION | Starter, 20% on the unloaded servo |
| 2 | Timed Delay | 1 s |
| 3 | Set Igniter — ACTION | Igniter, ON for the dummy lamp |
| 4 | Set Main Fuel Metering — ACTION | Main Fuel Metering, 20% for the dummy PWM load |
| 5 | Timed Delay | 2 s |
| 6 | Set Main Fuel Metering — ACTION | Main Fuel Metering, 0% |
| 7 | Set Igniter — ACTION | Igniter, OFF |
| 8 | Set Starter — ACTION | Starter, 0% |

{% include build-screen.html file="sequence-bench-startup" cropped=true step="The complete bench Startup path" alt="Eight configured startup blocks ending with Main Fuel Metering at zero, Igniter off and Starter off in the final-state preview." caption="The table gives every block's demand and delay. Reopen each action to compare its fields. The final-state preview must show fuel 0%, igniter off and starter off; the sequence then enters Running with the bench fixed-zero fuel owner." %}

{% include build-screen.html file="sequence-bench-fuel-action" cropped=true step="One fully configured ACTION card" alt="Expanded Set Main Fuel Metering action with Main Fuel Metering selected and demand set to 20 percent." caption="This is block 4 in the complete path. Block 6 uses the same output with 0%. Keep transition time zero for the illustrated immediate change; the two-second wait is a separate Timed Delay block." %}

On **Shutdown**, add **Immediate Fuel and Ignition Cut**, then explicit ACTION commands for **Main Fuel Metering 0%**, **Igniter OFF** and **Starter 0%**. The extra off actions make this learning path easy to inspect; the immediate-cut action comes first.

{% include build-screen.html file="sequence-bench-shutdown" cropped=true step="The matching bench Shutdown path" alt="Immediate Fuel and Ignition Cut followed by explicit fuel zero, igniter off and starter off commands; final Standby preview shows all off." caption="Save and reopen both paths. Check their final-state previews and test STOP during the dummy-load cycle, not just after it ends." %}

**What this does not prove:** timer-only actions do not confirm rotation, combustion, lubrication or stable idle. The editor may correctly warn about those missing engine checks. Review them; do not dismiss them to operate a turbine. If structural validation refuses a test, correct it or keep this as a simulator exercise. Before any engine operation replace this lesson with the actual starter feedback, combustion confirmation, oil requirements, shutoff actions and finite fault timeouts described above. The screenshots are a fully configured editor example, not a physically verified engine startup.

**Verify:** keep hazardous power physically disconnected. Run the intended dry path using only legitimate safe test evidence. Also leave a required condition unsatisfied and confirm the bounded failure outcome. If you cannot exercise sensor evidence on the bench, inspect it in the simulator or postpone physical START testing; do not defeat the actual protection. Use [the full Sequence guidance]({{ '/user-guide/#part-12-build-startup-and-shutdown-sequences' | relative_url }}) for the complete block procedure.

<h2 id="verify">10 · Verify and save the system</h2>

Work through this checklist before introducing another feature:

- Each input has its actual pin/interface, readable name, correct purpose and plausible healthy reading.
- Throttle endpoints, N1 PPR and temperature response have been checked; real protection needs independent calibration evidence.
- Servo, PWM and relay commands reach the expected interface and return to the intended state after tests.
- STOP, timeout and sensor-loss behavior produce the expected commands with fuel, ignition and starter energy isolated.
- The independent physical stop removes relevant energy without the browser, Wi-Fi or ESP32 functioning.
- The configuration saves and reappears after reload/reboot; there are no unresolved pin conflicts or missing dependencies.

Use the configuration backup/engine-file function in **System** and give the file a meaningful name before expanding it. A completed reading checklist is not a hardware certification or permission to start an engine. Operating commissioning still needs the actual engine's limits, plumbing, load ratings and controlled test plan.

**You can now:** add and test an input, tell servo pulses from duty PWM, separate a control signal from load power, identify an output's software owner, and explain a sequence's purpose. Those same patterns will cover most additions in the next two levels.

<p class="document-nav"><a class="button" href="{{ '/guided-builds/control/' | relative_url }}">Continue to Level 2 →</a><a href="{{ '/guided-builds/' | relative_url }}">Choose another level</a><a href="{{ '/user-guide/' | relative_url }}">Detailed reference</a></p>
