---
layout: document
title: Level 2 Understand control and protection
description: Extend the basic OpenTurbine system with isolation, pressure feedback, a custom controller, soft limits, hard trips and verified sequence handover.
lede: Keep the hardware you understand. Add relationships that make measurements influence commands.
permalink: /guided-builds/control/
build_level: 2
---

{% include guided-nav.html %}

## Your starting point

You have **N1 Speed**, **Main TOT**, **Throttle Input**, **Starter**, **Main Fuel Metering** and **Igniter**, with tested inputs, known output polarity and a reviewed dry sequence. If entering here directly, use the [Level 1 verification checklist]({{ '/guided-builds/basic/#verify' | relative_url }}) first. Back up the engine file in System before editing.

This level adds fuel isolation, an oil-pressure measurement and proportional oil-pump interface, plus a separate brightness knob and low-power dimmable light to teach a useful custom controller. If your engine already required an item in Level 1, reuse its existing channel. You are not postponing required safety or lubrication until this lesson.

<figure class="build-figure"><img src="{{ '/assets/images/guided-builds/level-2-hardware.png' | relative_url }}" width="1600" height="1100" loading="lazy" alt="Simulated Level 2 Hardware inventory keeps the required controls and Level 1 inputs while adding oil pressure."><figcaption>Simulated Level 2 input inventory. The previously fitted channels remain; oil pressure is the new measurement. Output hardware is configured in the steps below.</figcaption></figure>


{% include build-figure.html file="level-2" alt="Level 1 channels remain while oil pressure, brightness input, fuel shutoff, oil-pump command and bench light are added." caption="Orange borders show additions. Existing devices retain their assignments; the light dimmer is separate from engine control." %}

<h2 id="isolation">1 · Verify fuel isolation</h2>

**Add:** a fuel shutoff interface if it is not already fitted. A zero fuel-pump command is a software request; a shutoff valve is a separate physical device. Neither replaces the independent physical stop that removes fuel or relevant energy even if the ECU fails.

**Wire:** use the already learned [relay/driver pattern]({{ '/guided-builds/basic/#ignition' | relative_url }}) with a suitably rated valve driver and load suppression. Decide the physical safe valve state from the actual fuel system. Do not choose a relay contact just because it made a lamp turn on in Level 1. Test without fuel pressure or fuel flow.

**Configure:** on Hardware, add output **Fuel Shutoff**, purpose **Fuel shutoff**, with its actual on/off driver, GPIO, polarity and fault-safe demand. Save. Include explicit valve actions in startup and shutdown where required. Select the exact displayed device in each action rather than an unspecified relay.

{% include build-screen.html file="shutoff-configured" step="A configured shutoff command" alt="Fuel Shutoff Hardware card on GPIO 18 with relay signal type, direction and off initialization/fault behavior." caption="This card describes a command interface, not proof that a valve is physically fail-closed. Verify direction and the de-energized state on the actual assembly without fuel." %}

**Verify:** confirm open/closed direction using a benign test, then verify that STOP, timeout and fault commands produce the intended valve state. Independently test the physical stop without relying on an ECU command. A fail-closed valve still needs a suitable installation; the display cannot prove that it physically closed.

<p class="build-next"><a href="#pressure">Next: add a pressure reading →</a></p>

<h2 id="pressure">2 · Add pressure feedback</h2>

**Add:** an oil-pressure transducer with a known supply and output specification. This introduces a useful analog measurement: voltage must become an engineering value such as bar. Check transducer pressure range, materials and plumbing suitability separately from its electrical output.

For a documented 0.5–4.5 V sensor, the illustrated divider uses 15 kΩ above the ADC node and 10 kΩ below it. Its ratio is 0.4, so the normal ADC signal is 0.2–1.8 V. This calculation teaches scaling. It does not provide transient, short-to-battery or reverse-polarity protection; add conditioning appropriate to the actual installation before connecting GPIO.

{% include build-figure.html file="pressure" alt="Pressure sensor output connects through a 15 kiloohm upper resistor to the ADC node, with a 10 kiloohm lower resistor to common ground; sensor power uses its documented supply." caption="Check the conditioned voltage with a meter before connecting the ADC. A 0.5–4.5 V sensor cannot be connected directly to a 3.3 V input." %}

**Configure:** add **Oil Pressure**, purpose **Oil pressure**, driver **Analog voltage input (ADC)**. Choose the actual ADC pin and engineering range. Save. In Calibration, use the pressure wizard/two-point method with the real plumbing depressurized for zero, then a trusted gauge at a suitable known pressure. The ECU sees the divided voltage, so use the voltage measured at the ADC pin, not the original sensor voltage, when entering a manual scale.

{% include build-screen.html file="pressure-configured" step="A configured pressure input" alt="Oil Pressure analog Hardware card on GPIO 2 with 200 mV zero offset and 160 mV per bar." caption="The illustrated 0.5–4.5 V, 0–10 bar sensor through a 0.4 divider becomes 200 mV at zero and 160 mV/bar. Those numbers only match that exact example; verify the real transducer with a gauge." %}

**Find the calibration:** open **Calibration** and jump to **Oil Pressure**. The first wizard page asks for the pump-off reference. Choose gauge or absolute pressure correctly, make the physical circuit safe and depressurized, then follow the wizard. Do not press **Start calibration** just to dismiss the page: later steps can operate the fitted pump.

{% include build-screen.html file="pressure-calibration" cropped=true step="Find the pressure wizard" alt="Oil Pressure calibration card showing ADC voltage, engineering pressure, health and pressure-reference selection." caption="The card separates raw ADC voltage from pressure in bar. Check the reference choice before starting and follow the actual wizard prompts." %}

**Verify:** compare zero and at least one reference point; use more points when practical. Readings should rise in the expected direction. An apparently plausible number can still have the wrong scale. A reading stuck at maximum suggests saturation, wiring or calibration trouble. Do not enable pressure-dependent protection until the input is healthy and the scale is proven.

<p class="build-next"><a href="#feedback">Next: let a measurement control an output →</a></p>

<h2 id="feedback">3 · Make a feedback loop</h2>

**Add:** proportional oil delivery where appropriate for the engine. Use the same rated [PWM driver wiring]({{ '/guided-builds/basic/#fuel' | relative_url }}) as before, with a separate fused supply and correct pump/load protection. A relay pump only supports on/off operation. The dedicated loop can use hysteresis with an appropriate accumulator system, but this lesson uses a proportional pump to teach continuously variable delivery.

On Hardware, create **Oil Pump**, purpose **Oil pump**, with its real proportional driver and safe behavior. On Controllers, open the fitted oil-pressure controller and review its feedback source, target behavior and permitted output authority. Use the verified pressure input. Required startup/run pressure, minimum reliable pump demand and response settings must come from the actual oil circuit.

{% include build-screen.html file="oil-pump-configured" step="A configured oil-pump output" alt="Oil Pump Hardware card with PWM on GPIO 21, duty endpoints and advanced output settings." caption="Match the physical driver and verify its command direction first. This Hardware card does not tune the pressure loop; that relationship is configured next on Controllers." %}

**Find the feedback controller:** in **Controllers → Output controllers**, expand **+ Create controller**. If no dedicated loop already owns the pump, choose **Oil Pump** and **Oil Pressure** in the dedicated selectors, then choose **Create oil-pressure controller**. Open the **Oil Pump** card, then its nested **Oil Pressure Control** card. If a loop already exists, inspect it instead of creating another.

{% include build-screen.html file="oil-feedback" step="Open the nested pressure card" alt="Oil Pump controller card containing the nested Oil Pressure Control section." caption="The outer card identifies the pump owner. Open Oil Pressure Control to expose feedback, targets and failure behavior." %}

{% include build-screen.html file="oil-feedback-settings" step="Review feedback and authority" alt="Expanded Oil Pressure Control showing pressure feedback, target source, target, output bounds and loss-response settings." caption="Start by verifying the feedback source and target selection, then inspect command bounds and loss/low-pressure responses. Values shown are UI defaults, not a recommended oil-system tune." %}

The relationship is **target pressure → controller**, with **measured pressure → controller → pump driver → pressure** closing the loop. If pressure is below target, the normal correction should increase delivery. If a pump or valve has the opposite effect, a copied controller setting can drive it further from the target.

**Verify in stages:** first confirm the pressure input and output direction separately. Then test an appropriate restrained, nonhazardous fluid circuit if available. Observe a small target change, settling and output limits. Confirm sensor-loss behavior and recovery. A simulator can illustrate the setting screens; it does not prove pump response, priming or stable control. Do not tune a real process merely by moving sliders until the display looks smooth.

**Ownership check:** this output has one normal owner—the dedicated oil controller where enabled. Sequence can still command startup/shutdown transitions as supported. Do not add an enabled custom controller on the same pump and leave both competing. If no appropriate physical oil-loop rig is available, keep this as a reviewed configuration exercise and record the physical test as pending.

<p class="build-next"><a href="#custom">Next: make a custom controller →</a></p>

<h2 id="custom">4 · Build a light-dimming controller</h2>

**Useful result:** a separate brightness knob adjusts a low-power bench light. Turning the knob from minimum through midpoint to maximum changes the PWM demand from 0% through 50% to 100%. It uses a general-purpose input and output; it does not commandeer fuel, starter or oil hardware.

**Wire the knob:** reuse the [potentiometer pattern]({{ '/guided-builds/basic/#throttle' | relative_url }}) with a second 10 kΩ potentiometer. Its outer terminals go to 3.3 V and GND; the wiper goes to a spare ADC1 input, **GPIO 8** in this cumulative S3 plan. Add **Generic automation input**, name it **Brightness knob**, and choose **Analog / ADC**. Leave internal pull-up/down off. Calibrate the actual endpoints; the example normalized source range is **0–1**. Use **Invert input** if clockwise movement reduces the intended brightness.

{% include build-figure.html file="throttle" alt="Potentiometer outer terminals connect to 3.3 V and ground, and its wiper connects to the separate brightness ADC input." caption="Reuse this potentiometer circuit for a separate brightness knob, not the engine throttle. Replace the generic ADC label with GPIO 8 for the cumulative example." %}

{% include build-screen.html file="brightness-configured" step="Configure the brightness input" alt="Brightness knob Hardware card with Generic automation input, Analog ADC, GPIO 8 and no internal input bias." caption="The card reports a normalized 0–1 value. Check real endpoints and smooth movement before creating the controller. These source units are not raw ADC counts." %}

For this generic input, inspect its measured endpoints and the **Minimum valid signal / Maximum valid signal** fields on the Hardware card. Set the electrical range to the verified endpoint readings so the normalized value spans 0–1; test the middle as well. Do not assume the dedicated Throttle calibration wizard edits this separate generic input.

**Wire the light:** reuse the [PWM-driver pattern]({{ '/guided-builds/basic/#fuel' | relative_url }}) with a documented 3.3 V-compatible MOSFET driver and separately supplied low-power dimmable LED module or suitable small lamp. Use the lamp/module's specified current limiting—do not connect a bare LED directly to a power supply or GPIO. This is low-voltage DC only, not a mains dimmer.

{% include build-figure.html file="pwm" alt="A GPIO PWM command feeds a power driver; the separately fused low-power light is powered through the driver rather than GPIO." caption="Here the dummy load is the bench light. Match driver polarity and PWM compatibility to the actual light." %}

Add **Generic automation output**, name it **Bench light**, choose **PWM** and the spare output **GPIO 38**. The fixture uses **1000 Hz**, **10 bits**, normal direction and 0–100% electrical duty endpoints. Set **Power-on demand** to 0%. Verify physical off at logical zero before permitting the controller to own it.

{% include build-screen.html file="light-configured" step="Configure the light output" alt="Bench light Hardware card with PWM on GPIO 38, normal direction, 0–100 percent duty, 1000 Hz, 10 bits and zero power-on demand." caption="Choose frequency and polarity that the actual driver accepts. The initialized output is off; verify reset behavior separately because firmware cannot guarantee GPIO state before it gains control." %}

**A · Create the controller.** Open **Controllers → Output controllers → + Create controller**. Choose **Bench light** in **What do you want to control?**, then select **Create controller**. An absent output may be unfitted, incompatible or already owned; resolve that instead of duplicating it.

{% include build-screen.html file="controller-create" step="A · Choose the light" alt="Create controller panel with Bench light selected." caption="Only the bench light is selected. The dedicated oil loop remains a separate owner of Oil Pump." %}

**B · Open its card.** A new generic controller starts with **Fixed output in selected states** and zero command. Change the method to **Map input to output** before looking for the source and range fields.

{% include build-screen.html file="controller-new" step="B · Recognize the starting method" alt="New Bench light controller starting with Fixed output in selected states and zero command." caption="Creating a controller does not automatically connect it to the brightness knob." %}

**C · Configure the complete mapping:**

| Field | This bench example |
| --- | --- |
| Controller name | Knob to bench light |
| Controlled output | Bench light |
| Control method | Map input to output |
| Controlled by | Brightness knob |
| Input low / Input high | 0 / 1, after verified endpoint calibration |
| Output low / Output high | 0% / 100% |
| When this controller is active | Standby only |

{% include build-screen.html file="controller-mapping" step="C · The configured dimmer" alt="Knob to bench light controller mapping Brightness knob from 0 to 1 onto Bench light from 0 to 100 percent." caption="Input range uses the source's normalized units; output range uses percent demand. Half input produces half duty, although perceived LED brightness is not necessarily linear." %}

**D · Choose the operating state.** Expand **When this controller is active**, select **Standby**, and clear Startup, Running and Shutdown. A newly created controller defaults to Running, so change this deliberately.

{% include build-screen.html file="controller-states" step="D · Standby-only ownership" alt="Bench light custom controller active only in Standby." caption="This lets you demonstrate the light while engine outputs remain isolated. Outside selected states the controller releases ownership; FAULT also releases it." %}

**E · Save and reopen.** Select **Save to device**, resolve any validation errors and review warnings rather than using Save anyway to get past them. Confirm the change recap, save, then reopen the card and compare output, source, range and states.

{% include build-screen.html file="controller-save" step="E · Review before saving" alt="Save recap for the brightness-knob bench-light controller." caption="The pictured recap records a controller-name change. Your new-controller recap will include the actual fields you changed; check those before confirming." %}

**Verify:** low knob gives a physically off light, midpoint gives about 50% duty, and high gives full permitted duty. Check clamping beyond calibrated endpoints, smooth movement, direction, mode exit, input loss and reboot behavior. Confirm the light's power-on state and that no controller accidentally claims an engine output. A failed potentiometer may leave a plausible ADC voltage; an unsupervised knob is not a safety input.

**Adapt the lesson:** an external noncritical fan can use the same mapping, but use its own driver and permitted PWM frequency. A fan may need a nonzero minimum reliable command and separate start behavior; do not assume the light's 0–100% duty range will start or safely stop every fan. Feedback regulation is a different method: **Hold a feedback target** needs a verified measured result and failure response.

<h2 id="limits">5 · Separate limits and hard trips</h2>

Reuse the healthy N1 and turbine-temperature inputs. You do not need another sensor to learn the distinction.

| Behavior | What it does | What it does not establish |
| --- | --- | --- |
| Display warning | Draws attention to a value | Does not necessarily change an output. |
| Gradual fuel limiting / pullback | Reduces fuel as a configured boundary is approached | Is not the independent hard shutdown threshold. |
| Enabled hard protection | Takes the specified shutdown/fault action when its confirmed condition applies | Does not physically remove energy if the driver/valve/stop circuit fails. |
| Independent physical stop | Removes fuel/relevant energy without software | Does not replace the need to monitor the engine. |

On Controllers, inspect the protections available for the fitted system. Set engine-specific N1/EGT hard limits and the intended confirmation/failure behavior only after calibration. A gradual boundary must leave appropriate margin below the hard trip. Startup temperature limits and running limits can differ; use the real engine requirements. Do not copy an N1 trip to a future N2 shaft.

**Find the protection cards:** on **Controllers**, expand **Shutdown & Protection**. Open the relevant nested protection card to inspect its enable setting, source, limit and response. Keep **Configured system** selected to focus on fitted features; **Explore all features** also shows unavailable features and their prerequisites.

{% include build-screen.html file="protection-overview" step="Find limits and hard protection" alt="Expanded Shutdown and Protection area showing nested protection cards for fitted signals." caption="Read the individual cards rather than assuming a colored gauge means shutdown is enabled. Use calibrated, engine-specific limits and explicitly verify the intended enable/response settings." %}

**Verify:** use safe simulated/test evidence with hazardous power isolated to exercise both ordinary limiting and the hard action. Check the actual output commands and event information, not only gauge color. A display scale or warning color can exist without an enabled hard trip. Also test disconnected/unhealthy inputs—the last displayed plausible number is not evidence of a healthy sensor.

Custom automation can request supported actions, but a custom rule is not automatically a separately implemented hard protection. In particular, a normal shutdown request is not the same thing as a latched FAULT. Use the documented action and recovery behavior for your intended purpose.

<h2 id="handover">6 · Review sequence handover</h2>

Reopen Sequence with the expanded inventory. Add required pre-oil, pressure confirmation and shutoff actions at the places the engine requires them. Choose the displayed device in ordinary **Set Output** actions. Add finite timeouts to feedback waits. Inspect the final-state preview and verify when starter and ignition are released and normal fuel/oil ownership begins.

Build a small ownership table for your actual configuration:

| Output | Ordinary ownership | Startup / shutdown role | Verify |
| --- | --- | --- | --- |
| **Main Fuel Metering** | Configured Main Fuel Metering path | Explicit admission/cut and supported handover | No surprise jump on handover; stop removes intended command. |
| **Oil Pump** | Dedicated oil control if enabled | Required prime/run/cooldown behavior | Oil behavior remains appropriate while rotation continues. |
| **Fuel Shutoff** | Defined fitted shutoff behavior | Explicit admit/isolate actions | Physical state agrees with command. |
| **Bench light** | Brightness knob mapping in Standby | No engine-critical role | Physical off, dimming, mode exit and fault-safe state are understood. |

This table describes the intended roles; confirm the detailed implementation from the current preview, diagnostics and dry tests. Software ownership is not a guarantee that the physical load obeyed.

<h2 id="verify">7 · Test the relationships</h2>

Keep hazardous supplies physically disconnected. Save and run the checks that apply to your bench hardware:

- Pressure input zero/reference and normal direction.
- Proportional output minimum, midpoint, maximum and safe state.
- Feedback direction, limited authority, loss response and physical settling where a suitable rig exists.
- Custom mapping, clamping, selected modes, mode exit and reboot persistence.
- Startup wait success, timeout and safe failure result.
- STOP, hard protection and sensor health behavior, plus the independent physical stop.

Save another engine-file backup. Record which checks used actual hardware and which were simulator/configuration review only.

**Explain it before moving on:** which object describes the oil sensor? Which controls the pump? Who can command that output during shutdown? What is the difference between a soft limit, a hard trip and the physical stop? If you can answer those questions, you understand enough to extend the system.

<p class="document-nav"><a class="button" href="{{ '/guided-builds/extend/' | relative_url }}">Continue to Level 3 →</a><a href="{{ '/guided-builds/basic/' | relative_url }}">Review Level 1</a><a href="{{ '/user-guide/#part-13-use-custom-controllers' | relative_url }}">Custom-controller reference</a></p>
