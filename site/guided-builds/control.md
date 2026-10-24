---
layout: document
title: Build 2 Improve control and protection
description: Develop the same turbojet with combustor-pressure measurement, automatic idle, oil feedback, fuel limiting, startup protection and sequencer-controlled safety logic.
lede: Keep the working Build 1 installation. Add one useful relationship at a time.
permalink: /guided-builds/control/
build_level: 2
---

{% include guided-nav.html %}
{% assign e = site.data.guided_example %}

## Start from the basic turbojet

You should have the [Build 1 checklist]({{ '/guided-builds/basic/#verify' | relative_url }}) completed and its engine-file backup saved. Reuse its channels. The only required new measurement here is **Combustor Pressure**; the second-circuit switch exercise is optional. Do not create another fuel or oil pump entry.

The same [teaching worksheet]({{ '/guided-builds/parts/#engine-worksheet' | relative_url }}) supplies the example numbers. {{ e.n1_full_rpm }} RPM full-power N1, 3–4 bar combustor pressure and 4–5 bar oil pressure describe normal operation. Other numbers are assumed examples, requiring verification for an actual engine.

{% include build-figure.html file="level-2" alt="Build 2 adds combustor pressure to the basic turbojet and develops fuel and oil control without adding duplicate pumps." caption="The wiring grows by one pressure input. Most of this build changes how existing measurements and outputs work together." %}

<h2 id="pressure">1 · Add combustor pressure</h2>

This pressure is measured at the identified combustor tap, in **bar gauge** for the example. It is not fuel delivery pressure or oil supply pressure. Use plumbing and a transducer arrangement rated for the gas, temperature and pressure; the ECU guide covers its electrical signal, not hot-gas plumbing design.

1. Reuse the [conditioned pressure-input pattern]({{ '/guided-builds/basic/#pressure' | relative_url }}) with a separate sensor and ADC pin.
2. In **Hardware → Add input**, choose **Pressure 1 / P1**, name it **Combustor Pressure**, select **Analog voltage input (ADC)** and assign its GPIO. Save.
3. Calibrate the channel using a trusted external reference. With the same 0–10 bar, 0.5–4.5 V transducer/divider, the nominal ADC scale is {{ e.pressure_zero_mv }} mV zero and {{ e.pressure_mv_per_bar }} mV/bar. Use the channel's calibration/manual scale controls for the actual measured values.

{% include build-screen.html file="combustor-configured" step="Identify the new measurement" alt="Combustor Pressure input assigned to P1 with the worked ADC scale." caption="Use a separate ADC from Oil Pressure. The display name will identify this pressure in Controllers and Dashboard." %}

**Check:** depressurized gauge zero and at least two known points agree with the reference. At the example's {{ e.p1_normal_bar }} bar nominal pressure, the illustrated ADC signal is 760 mV. A sensor's 10 bar measuring range is not the engine's pressure limit.

<h2 id="idle">2 · Add automatic idle</h2>

Build 1 maps the lowest throttle position to a fixed {{ e.fuel_idle_pct }}% fuel command. Automatic idle instead adjusts the Running fuel floor to hold a measured speed. This helps explain feedback: **target speed → compare actual N1 → adjust fuel → change N1**.

1. Open **Controllers → Main Fuel** and change mapped **Output low** to the measured reliable pump minimum ({{ e.fuel_min_pct }}% in the teaching dataset). Leave Output high at {{ e.fuel_max_pct }}% and the Running activation unchanged.
2. Open **Fuel-metering support → Idle**, select **Running Idle Mode → Automatic Idle**, and select **N1 Speed** as feedback.
3. Enter the example settings below. Keep the standard method initially; predictive settings are a later tuning choice.

| Field | Teaching value | Meaning |
| --- | --- | --- |
| Idle Target (N1/N2) | {{ e.n1_idle_rpm }} RPM | Desired idle, not full-power speed |
| No-Correction Band | {{ e.n1_idle_deadband_rpm }} RPM | Avoids correcting every small fluctuation |
| Stop Controlling Above | {{ e.n1_idle_cutoff_rpm }} RPM | Releases added idle correction above this speed |
| Maximum Normal Idle Fuel Output | {{ e.fuel_idle_ceiling_pct }}% | Base limit on idle authority |
| Maximum Fuel Range Multiplier | 1 | Keeps this example's ceiling at {{ e.fuel_idle_ceiling_pct }}% |

{% include build-screen.html file="automatic-idle-configured" step="Automatic idle uses engine-scale values" alt="Automatic Idle selected with N1 feedback, 25000 RPM target, 500 RPM band and 30000 RPM cutoff." caption="The example idle range is 12–25% fuel with multiplier 1. Full-power operator demand is configured separately." %}

Open **Response tuning**, review Fuel Increase/Decrease Time and save. Their correct values depend on engine response; slower changes give more time to observe a controlled test. A simulator can prove field selection and limits, not tune a real rotor. Test correction direction, settling and fuel bounds with an appropriate test setup before relying on the loop.

**Check:** below the target, idle may add fuel within its authority. It must not demand beyond the ceiling; above the cutoff it releases its added floor. Verify feedback-loss response, STOP and handover. An unhealthy input does not supply valid closed-loop control.

**Other idle choices:** Off uses the mapped low command; Fixed fuel percentage supplies a separate Running floor; Input channel follows a selected calibrated input. They are alternatives, not additional required controllers. Their full procedures are in the [Idle reference]({{ '/user-guide/#field-fi_mode' | relative_url }}).

<h2 id="feedback">3 · Understand and verify oil feedback</h2>

Open **Controllers → Oil Pump → Oil Pressure Control**, the controller already created in Build 1. Keep **Pressure feedback = Oil Pressure**, **Controlled pump = Oil Pump**, **Pressure target set by = Fixed pressure**, **Pressure target = {{ e.oil_target_bar }} bar**. Variable targets based on fuel demand or shaft speed are optional; the basic engine does not need them to explain a pressure loop.

{% include build-screen.html file="oil-feedback-settings" step="Read the oil controller in groups" alt="Oil pressure controller with fixed 4.5 bar target, pump bounds, response settings and low-pressure/feedback-loss responses." caption="Target pressure, usable pump range and failure response solve different problems. Verify each on the actual oil circuit." %}

| Group | What to establish |
| --- | --- |
| Pressure deadband | A small tolerated pressure error; example {{ e.oil_deadband_bar }} bar |
| Minimum / maximum pump command | Repeatable pump operation and permitted driver authority, measured on the rig |
| Response gain | How strongly demand changes with pressure error; tune without excessive overshoot or cycling |
| Feedback-loss delay / command | How long loss must persist and what bounded pump command is used afterward |
| Low-pressure threshold / confirmation | Separate from target; example {{ e.oil_min_bar }} bar for {{ e.oil_confirm_ms }} ms |
| Failure responses | Warning, normal fault shutdown or immediate dry-oil stop, selected deliberately |

**Normal fault shutdown** cuts combustion and follows the configured shutdown handling. **Immediate dry-oil stop** has a different output policy, including a bounded selected-pump run; read its displayed explanation before choosing it. A higher pump command cannot cure an empty tank, broken line or failed pump.

There are two possible sources of a low-oil response: this loop's own low-pressure monitoring, and **Shutdown & Protection → Oil pressure protection**. Review both and align their thresholds/times deliberately. The teaching loop and general protection use the same {{ e.oil_min_bar }} bar/{{ e.oil_confirm_ms }} ms example; do not leave a second unseen threshold fighting the intended policy. The general protection's selected phases do not change the loop's independent failure behavior.

**Check:** confirm input/output direction separately, then a small target change on a suitable nonhazardous oil rig. Observe settling, bounds, low pressure, lost feedback and recovery. Repeat the startup prime and shutdown lubrication checks after tuning. Save and reload.

<h2 id="limits">4 · Separate display, limiting and shutdown</h2>

Open **Controllers → Shutdown & Protection → Combustor Pressure protection**. Three concepts must stay distinct:

| Function | Result | Teaching pressure example |
| --- | --- | --- |
| Dashboard reference | Scale, approach colours and limit marker | Retained {{ e.p1_trip_bar }} bar high-pressure limit |
| Fuel limiting | Gradually reduces fuel as pressure rises | Begin {{ e.p1_soft_bar }} bar; full reduction {{ e.p1_full_reduction_bar }} bar |
| Fault shutdown | Cuts combustion after the confirmed trip | ON, {{ e.p1_trip_bar }} bar, 500 ms confirmation |

1. Set the retained pressure limit. Turn **Fault shutdown** ON and set its confirmation time.
2. Turn **Fuel limiting** ON. Choose **Simple — measured value** first; enter Begin/Full values and review Reduction Strength. Predictive additionally uses rate of change and needs separate validation.
3. Save and compare the Dashboard. With a positive saved limit, P1/P2/torque bars use its reference, colours and limit marker. With no positive limit they use automatic range. Switching shutdown OFF preserves the saved reference and advisory display; it only disables automatic shutdown.

{% include build-screen.html file="pressure-protection" step="Two independent protection switches" alt="Combustor Pressure protection showing separate enabled fault shutdown and fuel limiting, with ordered thresholds." caption="The limiting band sits below the independent hard trip. A coloured instrument is not proof that shutdown is enabled or tested." %}

N1 and engine temperature also use retained reference limits for colours; their shutdown marker follows enable state. Find fields via **Dashboard → Edit cards → Edit limit & safety**. Manual instrument scale preferences do not recalibrate a sensor or enable protection. Oil pressure is a low-limit instrument: do not copy a high-pressure trip interpretation onto it.

{% include build-screen.html file="dashboard-pressure-limit" step="Recognize the Dashboard reference" alt="Combustor-pressure instrument approaching its retained 4.5 bar reference, with an approach colour and limit marker." caption="A simulated 4 bar reading illustrates the approach. The configured fault shutdown and fuel limiter are separate decisions." %}

For temperature limiting, the teaching band is {{ e.tot_soft_c }}–{{ e.tot_full_reduction_c }} °C below the {{ e.tot_trip_c }} °C running trip. For each real limit, verify an approach, a confirmed trip and the disabled/advisory state using safe test inputs.

<h2 id="startup">5 · Give Startup its own temperature guard</h2>

Some engines have a justified transient starting-temperature envelope different from their running limit. Open **Shutdown & Protection → Temperature protection → Startup protection** and enable **Separate startup temperature guard** only when your engine's data supports that distinction.

| Teaching setting | Value |
| --- | --- |
| Immediate startup overtemperature | ON, {{ e.tot_start_trip_c }} °C |
| Sustained startup temperature | ON, {{ e.tot_start_dwell_c }} °C |
| Allowed time above threshold | {{ e.tot_start_dwell_ms }} ms |

{% include build-screen.html file="startup-temperature-protection" step="The separate Startup envelope" alt="Startup protection has independent immediate and sustained temperature switches and thresholds." caption="These assumed teaching values illustrate a transient envelope; they are not established HX80 temperature limits." %}

With this guard enabled, normal temperature shutdown and temperature fuel limiting apply in **Running**; the separate guard protects **Startup**. With it OFF, normal temperature protection/limiting also apply during Startup. Other protections are not automatically suspended by this temperature choice.

A sustained-temperature trip does not measure acceleration. Keep the N1/finite-time startup checks from Build 1 to detect failure to reach the required speed. Test immediate trip, sustained trip, cooling below the dwell threshold and a failed acceleration separately.

The **Hot engine start interlock** in the temperature card is another decision: it checks temperature **before starting**. The example pre-start maximum is {{ e.tot_prestart_c }} °C. It is not the ignition-confirmation temperature or a startup overtemperature threshold. Verify it blocks a hot start and accepts a healthy cool input.

<h2 id="custom">6 · Make a named switch safety controller</h2>

Optional example: a second oil circuit has its own switch. Add it only if you want to learn a separate controller; do not duplicate the existing oil measurement as another hidden protection.

1. Wire a dry contact using the [Start/Stop pattern]({{ '/guided-builds/basic/#power' | relative_url }}). Add **On/off switch input**, name it **Oil circuit 2 switch**, choose its purpose/pin and set polarity so **ON means pressure fault**. Check both physical states.
2. In **Controllers → + Create controller**, choose **Request Fault Shutdown** and create a controller named **Oil circuit 2**.
3. Select **Controlled by → Oil circuit 2 switch** and **Control method → Switch state**. Choose the request condition **Switch is ON** and a **500 ms confirmation**. A switch has no analogue switch point or hysteresis to tune.
4. Choose **Activate when → Entering Running**; choose **Deactivate when → Entering Shutdown / Entering Standby**. Save and reload.

{% include build-screen.html file="switch-fault-controller" step="A switch condition, not an analogue threshold" alt="Oil circuit 2 controller requesting fault shutdown when its digital switch is on, with confirmation and phase activation." caption="Each circuit can have its own name, input and activation. All switch inputs have fixed 20 ms debounce; controller confirmation is additional." %}

**Check:** a brief contact disturbance shorter than confirmation does not trip, a sustained fault does, and the displayed reason identifies this controller. Test in each chosen phase. An active pressure-fault switch while stopped should not become an unintended Standby fault; monitoring starts at the selected event. Inspect the consequences of a broken wire—simple contacts are not supervised circuits.

<h2 id="handover">7 · Place controller activation in Sequence</h2>

Entering a mode is convenient; sometimes a controller should start at an exact point inside Startup. To learn this, edit the optional **Oil circuit 2** controller: select **Activate when → Sequencer block** instead of Entering Running. Keep Shutdown/Standby deactivation. Save and read the sequence-placement notice.

1. Open **Sequence**. The **Controller blocks — needs placement** area contains **Activate Oil circuit 2**.
2. Drag it into Startup **after Build Oil Pressure**, before fuel admission. This arms that switch only after the pressure-building stage.
3. If you also select **Deactivate when → Sequencer block**, drag its separate Deactivate card to the intended location. An unused card stays in the placement area.
4. To move a placed block to another path, remove it and drag it back from the placement area. Save only after all required blocks are placed; check the editor's explanation if a controller is incomplete.

{% include build-screen.html file="controller-block-placement" step="Drag the required controller card" alt="Pending controller activation card with its controller name and drag-placement instructions." caption="The card identifies which controller needs placement. Its location determines when that controller takes control or begins monitoring." %}

When an output controller is active, conflicting sequence commands for its output are ghosted with a reason. Deactivation sends the Hardware safe demand before releasing ownership; later discrete blocks can then command that output. Fault/STOP handling remains authoritative. A Request Fault Shutdown controller is a virtual action, not ownership of a physical fuel-pump output.

<h2 id="verify">8 · Check the changes and save Build 2</h2>

Repeat the affected dry checks: calibrated P1 readings, idle correction/limits, oil feedback and loss policy, gradual limiting versus hard trip, startup-temperature envelope, switch confirmation and controller placement. Verify the normal start/stop path again after changing control or activation. Save/reload and download **Build 2 — controlled turbojet**.

You should be able to point to a reading, its ordinary controller, its limiting behavior and its independent shutdown setting. Continue to Build 3 for a second shaft; extra sensors are optional [workshops]({{ '/guided-builds/instruments/' | relative_url }}).

<span id="isolation"></span>
Fuel isolation and basic oil delivery are part of [Build 1]({{ '/guided-builds/basic/#outputs' | relative_url }}).

<p class="document-nav"><a href="{{ '/guided-builds/basic/' | relative_url }}">← Build 1</a><a class="button" href="{{ '/guided-builds/extend/' | relative_url }}">Build 3 →</a></p>
