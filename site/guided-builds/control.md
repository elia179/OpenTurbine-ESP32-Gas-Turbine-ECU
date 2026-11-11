---
layout: document
title: Build 2 Improve control and protection
description: Set up combustor-pressure feedback, fuel limiting, automatic idle, and a temperature guard for startup.
lede: Add combustor-pressure feedback, fuel limiting, automatic idle, and a startup temperature guard.
permalink: /guided-builds/control/
build_level: 2
---

{% assign e = site.data.guided_example %}

{% include build-brief.html begin="#pressure" start="The checked Build 1 setup and its backup." change="Add P1 with pressure protection, then automatic idle and a startup guard." finish="Changed-function checks and the original start/stop pass; save the Build 2 backup." %}

{% include guided-nav.html %}

## Start from the basic turbojet

Complete the [Build 1 checks and backup]({{ '/guided-builds/basic/#verify' | relative_url }}) first. Keep your existing inputs and outputs and add **Combustor Pressure**.

The [engine worksheet]({{ '/guided-builds/parts/#engine-worksheet' | relative_url }}) supplies the example numbers. {{ e.n1_full_rpm }} RPM full-power N1, {{ e.p1_normal_min_bar }}–{{ e.p1_normal_max_bar }} bar combustor pressure and 4–5 bar oil pressure describe normal operation. Other numbers are assumed examples, requiring verification for an actual engine.

{% include build-figure.html file="level-2" alt="Build 2 adds combustor pressure to the basic turbojet and develops fuel and oil control without adding duplicate pumps." caption="The wiring grows by one pressure input. Most of this build changes how existing measurements and outputs work together." %}

<h2 id="pressure">1 · Add combustor pressure</h2>

This pressure is measured at the identified combustor tap, in **bar gauge** for the example. It is not fuel delivery pressure or oil supply pressure. Use plumbing and a transducer arrangement rated for the gas, temperature and pressure; the ECU guide covers its electrical signal, not hot-gas plumbing design.

1. Reuse the [conditioned pressure-input pattern]({{ '/guided-builds/basic/#pressure' | relative_url }}) with a separate sensor and ADC pin.
2. In **Hardware → Add input**, choose **Pressure 1 / P1**, enter your own name (suggested: **Combustor Pressure**), select **Analog voltage input (ADC)** and assign its GPIO. Save.
3. With a trusted gauge, measure ADC-pin voltage at depressurized zero and a known pressure. In **Hardware → Combustor Pressure → Edit**, enter **Zero offset (mV)** and **mV per bar**, then save. Sensitivity = (reference ADC mV − zero ADC mV) ÷ reference bar. The illustrated circuit gives (760 − 200) ÷ 3.5 = **160 mV/bar**; use your measured values and verify another pressure.

{% include build-screen.html file="combustor-configured" step="Identify the new measurement" alt="Combustor Pressure input assigned to P1 with the worked ADC scale." caption="Use a separate ADC from Oil Pressure. The display name will identify this pressure in Controllers and Dashboard." %}

**Check:** depressurized gauge zero and at least two known points agree with the reference. At the example's {{ e.p1_normal_bar }} bar nominal pressure, the illustrated ADC signal is 760 mV. A sensor's 10 bar measuring range is not the engine's pressure limit.

<h2 id="limits">2 · Set the new pressure protection</h2>

Open **Controllers → Shutdown & Protection → Combustor Pressure protection**. The card separates three jobs:

| Function | Result | Teaching pressure example |
| --- | --- | --- |
| Dashboard reference | Scale, approach colours and limit marker | Retained {{ e.p1_trip_bar }} bar high-pressure limit |
| Fuel limiting | Gradually reduces fuel as pressure rises | Begin {{ e.p1_soft_bar }} bar; full reduction {{ e.p1_full_reduction_bar }} bar |
| Fault shutdown | Cuts combustion after the confirmed trip | ON, {{ e.p1_trip_bar }} bar, 500 ms confirmation |

1. Set the retained pressure limit. Turn **Fault shutdown** ON and set its confirmation time.
2. Turn **Fuel limiting** ON. Choose **Simple — measured value** first; enter Begin/Full values and review Reduction Strength. Predictive additionally uses rate of change and needs separate validation.
   The common fuel floor is in **Shutdown & Protection → Shared Fuel-Limiting Settings → Minimum Fuel During Gradual Protection**. Keep it at a measured stable-running value; each enabled gradual limiter uses that floor.
3. Save and compare the Dashboard. With a positive saved limit, P1/P2/torque bars use its reference, colours and limit marker. With no positive limit they use automatic range. Switching shutdown OFF preserves the saved reference and advisory display; it only disables automatic shutdown.

{% include build-screen.html file="pressure-protection" step="Two independent protection switches" alt="Combustor Pressure protection showing separate enabled fault shutdown and fuel limiting, with ordered thresholds." caption="The limiting band sits below the independent hard trip. A coloured instrument is not proof that shutdown is enabled or tested." %}

N1 and engine temperature also use retained reference limits for colours; their shutdown marker follows enable state. Find fields via **Dashboard → Edit cards → Edit limit & safety**. Manual instrument scale preferences do not recalibrate a sensor or enable protection. Oil pressure is a low-limit instrument: do not copy a high-pressure trip interpretation onto it.

The illustrative limiting band starts above the example's {{ e.p1_normal_min_bar }}–{{ e.p1_normal_max_bar }} bar normal range. On your engine, establish the actual permissible operating range and margin before choosing a band; a limiter set inside normal operation will deliberately reduce normal fuel demand.

{% include build-screen.html file="dashboard-pressure-limit" step="Recognize the Dashboard reference" alt="Combustor-pressure instrument approaching its retained 4.5 bar reference, with an approach colour and limit marker." caption="An example 4 bar reading illustrates the approach. The configured fault shutdown and fuel limiter are separate decisions." %}

The example also enables **Temperature protection → Fuel limiting**. Select **Simple — measured value**, set Begin to {{ e.tot_soft_c }} °C and Full reduction to {{ e.tot_full_reduction_c }} °C. Keep the {{ e.tot_trip_c }} °C normal shutdown limit from Build 1. Verify the warning, fuel reduction and confirmed trip with safe test inputs.

<h2 id="idle">3 · Add automatic idle</h2>

Build 1 maps the lowest throttle position to a fixed {{ e.fuel_idle_pct }}% fuel command. Automatic idle instead adjusts the Running fuel floor to hold a measured speed. This helps explain feedback: **target speed → compare actual N1 → adjust fuel → change N1**.

<h3 id="fuel-minimum">Measure the fuel pump minimum</h3>

Calibrate the actual fuel pump through **Calibration → Minimum Reliable Fuel-Metering Output** on an isolated flow rig. Follow sweep, stop and repeatable-restart prompts, using the pump's specified priming and lubrication. This measures reliable metering, **not engine idle**. The assumed teaching results are {{ e.fuel_min_pct }}% reliable minimum and {{ e.fuel_idle_pct }}% idle; your measurements replace both.

{% include build-screen.html file="fuel-minimum-calibration" step="Measure reliable fuel-metering output" alt="Fuel-metering minimum calibration panel with sweep and repeatable restart checks." caption="Use an isolated flow rig. The measured reliable minimum is different from the engine's idle command." %}

<h3 id="idle-setup">Configure automatic idle</h3>

1. Open **Controllers → Main Fuel** and change mapped **Output low** to the measured reliable pump minimum ({{ e.fuel_min_pct }}% in the example). Leave Output high at {{ e.fuel_max_pct }}% and the Running activation unchanged.
2. Open **Fuel-metering support → Idle**, select **Running Idle Mode → Automatic Idle**, and select **N1 Speed** as feedback.
3. Enter the example settings below. Keep the standard method initially; predictive settings are a later tuning choice.

| Field | Teaching value | Meaning |
| --- | --- | --- |
| Idle Target (N1/N2) | {{ e.n1_idle_rpm }} RPM | Desired idle, not full-power speed |
| No-Correction Band | {{ e.n1_idle_deadband_rpm }} RPM | Avoids correcting every small fluctuation |
| Stop Controlling Above | {{ e.n1_idle_cutoff_rpm }} RPM | Releases added idle correction above this speed |
| Maximum Normal Idle Fuel Output | {{ e.fuel_idle_ceiling_pct }}% | Limits how much fuel automatic idle can add |
| Maximum Fuel Range Multiplier | 1 | Keeps this example's ceiling at {{ e.fuel_idle_ceiling_pct }}% |

{% include build-screen.html file="automatic-idle-configured" step="Automatic idle uses engine-scale values" alt="Automatic Idle selected with N1 feedback, 25000 RPM target, 500 RPM band and 30000 RPM cutoff." caption="The example idle range is 12–25% fuel with multiplier 1. Full-power operator demand is configured separately." %}

Open **Response tuning**, review Fuel Increase/Decrease Time and save. Their correct values depend on engine response; slower changes give more time to observe a controlled test. Test correction direction, settling and fuel bounds with an appropriate test setup before relying on the loop.

**Check:** below the target, idle may add fuel up to its configured ceiling. It must not demand beyond the ceiling; above the cutoff it releases its added floor. Verify feedback-loss response, STOP and handover. An unhealthy input does not supply valid closed-loop control.

**Other idle choices:** Off uses the mapped low command; Fixed fuel percentage supplies a separate Running floor; Input channel follows a selected calibrated input. They are alternatives, not additional required controllers. Their full procedures are in the [Idle reference]({{ '/user-guide/#field-fi_mode' | relative_url }}).

<h2 id="startup">4 · Give Startup its own temperature guard</h2>

Some engines specify different temperature limits for starting and running. Open **Shutdown & Protection → Temperature protection → Startup protection** and enable **Separate startup temperature guard** only when your engine's data supports that distinction.

| Teaching setting | Value |
| --- | --- |
| Immediate startup overtemperature | ON, {{ e.tot_start_trip_c }} °C |
| Sustained startup temperature | ON, {{ e.tot_start_dwell_c }} °C |
| Allowed time above threshold | {{ e.tot_start_dwell_ms }} ms |

{% include build-screen.html file="startup-temperature-protection" step="Separate startup temperature limits" alt="The separate startup temperature guard is on, with immediate and sustained startup trips both enabled." caption="This is the Build 2 example after enabling the guard and setting both trips. Use limits verified for your engine." %}

With this guard enabled, normal temperature shutdown and temperature fuel limiting apply in **Running**; the separate guard protects **Startup**. With it OFF, normal temperature protection/limiting also apply during Startup. Other protections retain their normal monitoring phases.

A sustained-temperature trip does not measure acceleration. Keep the N1/finite-time startup checks from Build 1 to detect failure to reach the required speed. Test immediate trip, sustained trip, cooling below the dwell threshold and a failed acceleration separately.

The example also enables the **Hot-engine start interlock** and sets the pre-start maximum to {{ e.tot_prestart_c }} °C. This interlock checks temperature before Startup begins. Verify that it blocks a hot start and accepts a healthy, cool input.

<details class="build-hint" markdown="1"><summary>Optional reference: oil-loop tuning and failure responses</summary>

<h2 id="feedback">Optional oil-loop reference</h2>

Your Build 1 oil controller can stay as it is. Open this reference when you want to understand its tuning or failure responses.

Open **Controllers → Oil Pump → Oil Pressure Control**, the controller already created in Build 1. Keep **Pressure feedback = Oil Pressure**, **Controlled pump = Oil Pump**, **Pressure target set by = Fixed pressure**, **Pressure target = {{ e.oil_target_bar }} bar**. Variable targets based on fuel demand or shaft speed are optional; the basic engine does not need them to explain a pressure loop.

{% include build-screen.html file="oil-feedback-settings" step="Read the oil controller in groups" alt="Oil pressure controller with fixed 4.5 bar target, pump bounds, response settings and feedback-loss fallback." caption="Set pressure regulation here. The link opens this oil circuit’s low-pressure protection under Shutdown & Protection." %}

| Group | What to establish |
| --- | --- |
| Pressure deadband | A small tolerated pressure error; example {{ e.oil_deadband_bar }} bar |
| Minimum / maximum pump command | Repeatable pump operation and permitted pump output, measured on the rig |
| Response gain | How strongly demand changes with pressure error, in the displayed pressure unit; tune without excessive overshoot or cycling |
| Feedback-loss delay / command | How long loss must persist and what bounded pump command is used afterward |
| Low-pressure threshold / confirmation | Under **Shutdown & Protection → Oil circuit pressure protection → Oil Pump · low pressure**; example {{ e.oil_min_bar }} bar for {{ e.oil_confirm_ms }} ms |
| Feedback-loss response | Stays with the controller because it handles an unavailable pressure input |

{% include build-screen.html file="oil-circuit-protection" step="Set the separate low-pressure response" alt="Named Oil Pump low-pressure protection under Shutdown and Protection, with pressure threshold, confirmation time and response." caption="This monitor checks for low pressure during Running while this pump’s pressure controller is enabled. Its threshold is separate from the pressure target." %}

**Normal fault shutdown** cuts combustion and follows the configured shutdown handling. **Immediate dry-oil stop** has a different output policy, including a bounded selected-pump run; read its displayed explanation before choosing it.

The named oil-circuit card uses the analogue pressure sensor during Running. Use **Oil-pressure switch protection** only for a fitted low-oil switch. Its phase selection applies to that switch.

**Check:** confirm input/output direction separately, then a small target change on a suitable nonhazardous oil rig. Observe settling, bounds, low pressure, lost feedback and recovery. Repeat the startup prime and shutdown lubrication checks after tuning. Save and reload.

</details>

<h2 id="bench-checks">Bench checks before live commissioning</h2>

Use these checks after the basic dry walkthrough. They apply to the existing Build 1 hardware as well as the additions in Build 2.

<h3 id="pressure-signal-checks">Check pressure range and signal loss</h3>

If the card shows **estimated**, the signal is outside the saved calibration points. Check the reading against your gauge and add a measured point to cover that pressure. [See how calibration range and electrical limits differ.]({{ '/user-guide/#outside-calibrated-range' | relative_url }})

Review **Minimum/Maximum valid signal** against the sensor and conditioning specifications. This voltage window checks plausibility; it is not the pressure range or a shutdown limit. A disconnected ADC can still look healthy, so test the actual loss-of-signal response.

<h2 id="verify">5 · Check the changes and save Build 2</h2>

Keep hazardous load energy isolated while checking the updated configuration:

- **P1:** zero/reference readings agree; its Dashboard reference uses the saved pressure limit.
- **Oil:** the original pressure loop, low-pressure response and feedback-loss policy still agree.
- **Idle:** N1 below target adds bounded fuel; above cutoff the added floor releases.
- **Protection:** limiting reduces fuel before hard shutdown; startup immediate/dwell guards behave separately.
- **Whole system:** repeat normal start, STOP and failed-start timeout after the changes.

Save/reload and download **Build 2 — controlled turbojet**. Retain the Build 1 backup; record the checks completed and any commissioning work still needed.

{% include build-screen.html file="engine-backup-restore" step="Save your Build 2 backup" alt="System maintenance card with engine-file backup and restore controls." caption="Download a fresh engine file after saving and reopening the updated settings; keep your Build 1 backup too." %}

You should be able to point to a reading, its ordinary controller, its limiting behavior and its independent shutdown setting. Continue to Build 3 for a second shaft; see the [setup examples]({{ '/guided-builds/instruments/' | relative_url }}) whenever you want to add a specific device.

<span id="isolation"></span><span id="custom"></span><span id="handover"></span>
See the setup examples for a [fuel shutoff solenoid]({{ '/guided-builds/instruments/#fuel-shutoff' | relative_url }}), a [second oil-pressure switch]({{ '/guided-builds/instruments/#second-oil-switch' | relative_url }}), or [starting a controller at a specific sequence step]({{ '/guided-builds/instruments/#handover' | relative_url }}).

<p class="document-nav"><a href="{{ '/guided-builds/basic/' | relative_url }}">← Build 1</a><a class="button" href="{{ '/guided-builds/extend/' | relative_url }}">Build 3 →</a></p>
