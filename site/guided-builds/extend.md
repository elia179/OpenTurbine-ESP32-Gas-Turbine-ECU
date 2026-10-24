---
layout: document
title: Build 3 Add a free power turbine
description: Extend the same turbojet with a separate N2 shaft, a feedback governor, independent overspeed protection and optional instruments.
lede: Keep the gas generator you understand. Add the second shaft and its control deliberately.
permalink: /guided-builds/extend/
build_level: 3
---

{% include guided-nav.html %}
{% assign e = site.data.guided_example %}

## What changes in this build

Start with the tested [Build 2]({{ '/guided-builds/control/#verify' | relative_url }}) configuration and backup. The gas generator still has its N1 shaft, fuel system, ignition and oil system. A **free power turbine** extracts energy from its exhaust and drives a separate load. It is mechanically independent of the compressor shaft; its measured speed is **N2**.

The mechanical turbine, containment, coupling, load and lubrication must already be designed for this installation. Adding a sensor or governor does not establish their ratings. Check whether the second stage needs an additional oil circuit; configure and test it using the same pump/pressure patterns before rotation.

The gas generator's normal full-power example is {{ e.n1_full_rpm }} RPM. That does **not** establish N2's speed. For this lesson only, assume a power shaft with {{ e.n2_target_rpm }} RPM normal governed speed and {{ e.n2_trip_rpm }} RPM hard trip. These are teaching assumptions, independent of a gearbox's output speed. Use the [worksheet]({{ '/guided-builds/parts/#engine-worksheet' | relative_url }}) for the actual shaft and gearbox values.

{% include build-figure.html file="level-3" alt="The gas generator's N1 shaft supplies gas to a mechanically separate free turbine and load, measured by N2." caption="Two measured shafts, one gas path. The governor in this lesson changes main fuel; no propeller-pitch actuator is assumed." %}

<h2 id="n2">1 · Add and identify N2</h2>

Reuse the [conditioned N1 pulse-input pattern]({{ '/guided-builds/basic/#n1' | relative_url }}) on a separate pin. Select a pickup and conditioner suitable for the actual shaft speed, target and environment. Do not reuse N1's electrical signal as N2.

1. In **Hardware → Add input**, choose **N2 speed**, enter your own name (suggested: **N2 Power Shaft**), select **Hardware pulse counter (PCNT)** and assign its GPIO.
2. Enter the actual counted **pulses per shaft revolution**. If sensing after gearing, account for that ratio so the channel represents the shaft named in the guide. Write the relationship on the worksheet.
3. Match the input bias to the conditioner. Open-drain needs an appropriate pull-up; push-pull typically does not. A raw magnetic pickup requires conditioning, not just a pull-up.
4. Save, reopen and check the configured card.

{% include build-screen.html file="n2-configured" step="A separate power-shaft measurement" alt="N2 Power Shaft input has its own pulse GPIO and pulses-per-revolution setting." caption="Name the measured shaft clearly and establish its actual PPR. Never copy N1's speed limit simply because both are RPM inputs." %}

**Check:** drive N1 and N2 test inputs independently. Only the intended instrument should change. For an exact 1 PPR input, RPM equals frequency in Hz × 60; {{ e.n2_target_rpm }} RPM needs about 333.33 Hz. Verify against an independent reference at more than one point. During a rotating/test-signal check, verify the configured loss-of-N2 response. Zero RPM while legitimately stopped is different from losing expected running feedback.

<h2 id="limits">2 · Give N2 its own protection</h2>

Open **Controllers → Shutdown & Protection → N2 Power Shaft protection**. Set **Maximum N2 Speed = {{ e.n2_trip_rpm }} RPM** for the teaching dataset, then turn **N2 overspeed shutdown ON**. Keep the independent N1 and engine-temperature protections from Build 2.

{% include build-screen.html file="n2-protection" step="Set the separate N2 overspeed protection" alt="N2 safety card showing its retained maximum speed and enabled overspeed shutdown." caption="Use the power shaft's own verified limit. The teaching trip is 24000 RPM; it is independent of N1's limit." %}

If using N2 fuel limiting, its gradual-reduction band must sit below this trip with operating margin around the normal target. Start with the **Simple** method and review its reduction authority. Predictive uses acceleration as well and requires separate validation. Do not clear a retained limit merely to disable automatic shutdown; use the enable switch.

**Check:** inject a safely simulated approach and overspeed. Confirm instrument colour/status, actual commanded fuel cut and the named fault. Repeat with N1 held steady to distinguish the two sources. The governor is ordinary regulation; its existence does not replace independent overspeed protection.

<h2 id="governor">3 · Convert the fuel controller into an N2 governor</h2>

The example uses a load capable of absorbing power from the free turbine. Below the target, more fuel tends to add turbine power; above it, less fuel reduces power. A disconnected or suddenly removed load can accelerate the free turbine rapidly. Do not test a real load rejection until its physical setup and independent protection are ready.

Open the existing **Main Fuel** controller. **Edit this controller rather than creating a second owner of Main Fuel Metering.** Change its method from mapping to **Hold a feedback target**:

| Field | Teaching setup |
| --- | --- |
| Controller name | Main Fuel N2 Governor |
| Controlled output | Main Fuel Metering |
| Feedback signal | N2 Power Shaft |
| How is the target selected? | Fixed value |
| Target | {{ e.n2_target_rpm }} RPM |
| Minimum / maximum output | {{ e.fuel_idle_pct }}% / {{ e.fuel_max_pct }}% teaching fuel authority |
| Activate when | Entering Running |
| Deactivate when | Entering Shutdown and Entering Standby |

{% include build-screen.html file="n2-governor" step="One fuel owner holding N2" alt="Main Fuel N2 Governor uses N2 feedback, a fixed target and explicit fuel authority and activation events." caption="The previous throttle-to-fuel mapping has been replaced. There is one normal fuel owner." %}

Open **Response tuning**. Set **Target deadband**, **Immediate response**, **Correction rate** and **Feedback-loss output** from controlled testing of the actual plant. The response fields use percentages per measured unit, so RPM-scale gains are very different from pressure-scale gains. Record both the displayed units and the resulting command change. Do not tune using an unrelated oil controller's numbers.

Re-enter the output bounds after changing method or source: the UI can initialize method-specific defaults. Check every field in the table before saving rather than assuming the previous mapping's range was retained.

The earlier automatic idle is a Running fuel floor, not a second governor. For the first N2-governor exercise, set **Fuel-metering support → Idle → Off** and verify the governor's permitted minimum sustains the core in the actual operating envelope. The example starts with its {{ e.fuel_idle_pct }}% stable-idle command as the lower bound, rather than treating the {{ e.fuel_min_pct }}% reliable pump minimum as an engine-idle guarantee. Reintroduce an idle floor only after checking how it constrains N2 control, especially during load rejection. Startup fuel and starter-release checks remain explicit in Sequence.

With **Fixed value**, the throttle knob no longer directly sets fuel. That is intentional for this fixed-speed teaching load. For variable speed demand, later choose **Variable input**, **Target input = Throttle Input**, its 0–100% endpoints and separately verified low/high **N2 target speeds**. Those target values are RPM, not fuel percentages. A fixed-speed generator and a variable-speed load should not silently share one demand interpretation.

**Check:** below/above-target test feedback moves fuel in the intended direction while respecting output bounds. Check target acquisition, deadband, sustained error and sensor loss. Simulated input changes demonstrate command logic; stability and load response need the real constrained mechanical system.

<h2 id="sequence">4 · Review startup and ownership again</h2>

Startup first establishes lubrication, gas-generator speed and combustion. Starting the free turbine under load may require different N1/fuel conditions from the original turbojet. Do not assume the unchanged Build 1 fuel schedule will reach a loaded power-turbine target.

1. In **Sequence → Startup**, review the existing fuel commands and N1 checks against the new load. Keep all evidence waits finite.
2. Open **Final Startup Checks**. If startup must establish a minimum N2 before Running, select **Require N2**, enter that verified minimum and review the overall timeout. Do not use the maximum governed speed as a minimum-start check.
3. With the governor activated on Entering Running, Sequence controls startup fuel until that handover. Check its entry command and authority for an unwanted fuel step.
4. Review **Shutdown**: governor deactivation releases fuel to its safe demand, the cut block isolates combustion, and the required oil systems continue while shafts slow. Gas-generator N1 reaching zero does not prove the free turbine is stopped.

If a controller must take over before Running, use the **sequencer activation** procedure from [Build 2]({{ '/guided-builds/control/#handover' | relative_url }}). While it owns an output, conflicting discrete sequence commands are ghosted. Place deactivation before a later discrete command that needs that output.

| Phase | Fuel authority | Checks to retain |
| --- | --- | --- |
| Startup | Explicit sequence commands until chosen activation event | Oil, light-off, acceleration, finite timeout |
| Running | Main Fuel N2 Governor, bounded by protections | N1, N2, temperature, oil and sensor health |
| Shutdown | Deactivation safe state, combustion cut and shutdown handling | Physical fuel isolation and both shafts' lubrication needs |
| Fault | Authoritative fault/protective handling | Actual output states, recorded reason and recovery condition |

<h2 id="verify">5 · Verify the second-shaft behavior</h2>

Keep hazardous energy isolated for command tests; use test signals or the simulator. Record real mechanical commissioning separately.

- Check N1/N2 identities, PPR and any gearbox conversion independently.
- Check normal handover, governor direction, output bounds and loss of N2.
- Simulate an increase in N2 representing loss of load; verify fuel reduction and independent overspeed response. This does not physically qualify load rejection.
- Confirm temperature/N1 constraints can reduce the governor's requested fuel.
- Repeat STOP, failed-start timeout, shutdown and configured oil-loss policies.
- Review lubrication for a free turbine that may continue spinning after the core stops. Add an independently configured oil circuit or windmilling protection if required by the design, and test its own shaft source.
- Save/reload and download **Build 3 — free power turbine**, with a short list of completed and pending physical tests.

At this point, you should be able to identify every measurement, controller and protection without following a different recipe for each one. That is the transferable skill: **check the interface → add Hardware → calibrate → define control → test normal and failed behavior → back up**.

{% include build-screen.html file="engine-backup-restore" step="Save the Build 3 milestone" alt="System maintenance backup controls for downloading the complete engine configuration." caption="Keep this free-turbine configuration and its test notes separate from the earlier turbojet backups." %}

<h2 id="instruments">6 · Choose useful instruments</h2>

Add only what helps your installation. These are independent [optional workshops]({{ '/guided-builds/instruments/' | relative_url }}), not requirements for finishing this build:

| Addition | What you learn |
| --- | --- |
| Oil temperature and cooling fan | Temperature input, hysteresis, activation and fault-safe behavior |
| Battery voltage / current | Conditioned analogue measurements, zero and sensitivity |
| Cover-status switch | Digital polarity and the difference between status and an actual interlock |
| Shaft torque | Two pickups on the **same** torque-carrying shaft, running zero and calibrated twist |
| Thrust | I²C discovery, load-cell zero, known reference and force units |

Two speeds on different shafts do not measure torque. For power calculation, torque and speed must refer to the same shaft. Instruments also need their own mechanical mounting and calibration; a plausible display alone does not prove them.

<span id="voltage"></span><span id="current"></span><span id="fan"></span><span id="switch"></span><span id="challenge"></span><span id="thrust"></span><span id="finish"></span>
Looking for an earlier instrument section? Its full instructions are now in [Optional instruments and bench workshops]({{ '/guided-builds/instruments/' | relative_url }}).

<p class="document-nav"><a href="{{ '/guided-builds/control/' | relative_url }}">← Build 2</a><a href="{{ '/guided-builds/instruments/' | relative_url }}">Optional workshops</a><a href="{{ '/user-guide/' | relative_url }}">Detailed reference</a></p>
