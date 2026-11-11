---
layout: document
title: Build 3 Add a free power turbine
description: Configure N2 speed, a governor, and independent overspeed protection for a free power turbine.
lede: Set up speed measurement, governing, and overspeed protection for a free power turbine.
permalink: /guided-builds/extend/
build_level: 3
---

{% assign e = site.data.guided_example %}

{% include build-brief.html begin="#n2" start="The checked Build 2 setup and backup; an independently designed free-turbine/load system." change="Add N2 and its protection; convert the existing fuel controller into a governor." finish="Dry handover/failure checks pass; save the Build 3 backup and pending mechanical tests." %}

{% include guided-nav.html %}

## What changes in this build

Start with the tested [Build 2]({{ '/guided-builds/control/#verify' | relative_url }}) configuration and backup. The gas generator still has its N1 shaft, fuel system, ignition and oil system. A **free power turbine** extracts energy from its exhaust and drives a separate load. It is mechanically independent of the compressor shaft; its measured speed is **N2**.

Start with the mechanical turbine, coupling, load and lubrication specified for your installation. If the second stage uses a separate oil circuit, set it up with the pump/pressure pattern from Build 1.

The gas generator's {{ e.n1_full_rpm }} RPM example and the power shaft's speed are independent. For this lesson only, assume a power shaft with {{ e.n2_target_rpm }} RPM normal governed speed and {{ e.n2_trip_rpm }} RPM hard trip. These are teaching assumptions, independent of a gearbox's output speed. Use the [worksheet]({{ '/guided-builds/parts/#engine-worksheet' | relative_url }}) for the actual shaft and gearbox values.

{% include build-figure.html file="level-3" alt="The gas generator's N1 shaft supplies gas to a mechanically separate free turbine and load, measured by N2." caption="Two measured shafts, one gas path. The governor in this lesson changes main fuel; no propeller-pitch actuator is assumed." %}

<h2 id="n2">1 · Add and identify N2</h2>

Reuse the [conditioned N1 pulse-input pattern]({{ '/guided-builds/basic/#n1' | relative_url }}) on a separate pin. Select a pickup and conditioner suitable for the actual shaft speed, target and environment. Use a separate pickup and input for the power shaft.

1. In **Hardware → Add input**, choose **N2 speed**, enter your own name (suggested: **N2 Power Shaft**), select **Hardware pulse counter (PCNT)** and assign its GPIO.
2. Enter the actual counted **pulses per shaft revolution**. If sensing after gearing, account for that ratio so the channel represents the shaft named in the guide. Write the relationship on the worksheet.
3. Match the input bias to the conditioner. Open-drain needs an appropriate pull-up; push-pull typically does not. A raw magnetic pickup requires conditioning, not just a pull-up.
4. Save, reopen and check the configured card.

{% include build-screen.html file="n2-configured" step="A separate power-shaft measurement" alt="N2 Power Shaft input has its own pulse GPIO and pulses-per-revolution setting." caption="Use the power shaft's own name, PPR and speed limit." %}

**Check:** drive N1 and N2 test inputs independently. Only the intended instrument should change. For an exact 1 PPR input, RPM equals frequency in Hz × 60; {{ e.n2_target_rpm }} RPM needs about 333.33 Hz. Verify against an independent reference at more than one point.

<h2 id="limits">2 · Give N2 its own protection</h2>

Open **Controllers → Shutdown & Protection → N2 Power Shaft protection**. Set **Maximum N2 Speed = {{ e.n2_trip_rpm }} RPM** for the example, then turn **N2 overspeed shutdown ON**. Keep the independent N1 and engine-temperature protections from Build 2.

{% include build-screen.html file="n2-protection" step="Set the separate N2 overspeed protection" alt="N2 safety card showing its retained maximum speed and enabled overspeed shutdown." caption="Use the power shaft's own verified limit. The teaching trip is 24000 RPM; it is independent of N1's limit." %}

If using N2 fuel limiting, its gradual-reduction band must sit below this trip with operating margin around the normal target. Start with the **Simple** method and review how much fuel it can cut. Predictive uses acceleration as well and requires separate validation. Use the enable switch to turn automatic shutdown off while keeping the reference limit.

**Check:** apply suitable test feedback approaching and exceeding the limit. Confirm instrument colour/status, actual commanded fuel cut and the named fault. Repeat with N1 held steady to distinguish the two sources. The governor is ordinary regulation; its existence does not replace independent overspeed protection.

<h2 id="governor">3 · Convert the fuel controller into an N2 governor</h2>

The example uses a load capable of absorbing power from the free turbine. Below the target, more fuel tends to add turbine power; above it, less fuel reduces power. A sudden load removal can accelerate the free turbine rapidly; use test feedback for these initial command checks.

First set **Fuel-metering support → Idle → Off** for this governor exercise. The governor will use the earlier {{ e.fuel_idle_pct }}% stable-idle command as its lower fuel bound.

Open the existing **Main Fuel** controller and change its method to **Hold a feedback target**. Select the feedback and target method first, then enter the bounds below. This replaces the earlier throttle mapping while keeping one owner of the fuel output:

| Field | Teaching setup |
| --- | --- |
| Controller name | Main Fuel N2 Governor |
| Controlled output | Main Fuel Metering |
| Feedback signal | N2 Power Shaft |
| How is the target selected? | Fixed value |
| Target | {{ e.n2_target_rpm }} RPM |
| Minimum / maximum output | {{ e.fuel_idle_pct }}% / {{ e.fuel_max_pct }}% example fuel range |
| Activate when | Entering Running |
| Deactivate when | Entering Shutdown and Entering Standby |

{% include build-screen.html file="n2-governor" step="Configure the N2 governor" alt="Main Fuel N2 Governor uses N2 feedback, a fixed target and fuel limits and activation events." caption="The governor takes over fuel control when the ECU enters Running." %}

Open **Response tuning** and set **Target deadband**, **Immediate response**, **Correction rate** and **Feedback-loss output** for the test setup. Gains are expressed per measured unit: RPM feedback uses a different numerical scale from pressure feedback. Record the units and resulting command change as you tune.

Save and reopen the controller; compare its feedback, target and output bounds with the table.

With **Fixed value**, the governor holds {{ e.n2_target_rpm }} RPM; the throttle knob no longer directly commands fuel.

<details class="build-hint" markdown="1"><summary>Later options: idle support and variable speed demand</summary>

Automatic idle adds a Running fuel floor. Reintroduce it after checking how that floor constrains the governor, especially as load falls. The reliable pump minimum ({{ e.fuel_min_pct }}%) and an engine-sustaining idle command ({{ e.fuel_idle_pct }}% in this example) serve different purposes.

For variable speed demand, choose **Variable input**, select **Throttle Input**, map its 0–100% travel to the desired low/high **N2 target speeds**, and verify the range. These endpoints are RPM rather than fuel percentages. Startup fuel and starter-release checks remain in Sequence.

</details>

**Check:** below/above-target test feedback moves fuel in the intended direction while respecting output bounds. Check target acquisition, deadband and sustained error, then remove expected N2 feedback to verify the loss response configured above. Zero while legitimately stopped is a separate condition. Test input changes demonstrate command logic; stability and load response need the real constrained mechanical system.

<h2 id="sequence">4 · Review startup and ownership again</h2>

Startup first establishes lubrication, gas-generator speed and combustion. Starting the free turbine under load may require different N1/fuel conditions from the original turbojet. Review that schedule for the actual starting load.

1. In **Sequence → Startup**, review the existing fuel commands and N1 checks against the new load. Keep all evidence waits finite.
2. Open **Final Startup Checks**. If startup must establish a minimum N2 before Running, select **Require N2**, enter that verified minimum and review the overall timeout. Use a startup minimum distinct from the normal governed target.
3. With the governor activated on Entering Running, Sequence controls startup fuel until that handover. Check its starting command and output limits for an unwanted fuel step.
4. Review **Shutdown**: governor deactivation releases fuel to its safe demand, the cut block isolates combustion, and the required oil systems continue while shafts slow. Gas-generator N1 reaching zero does not prove the free turbine is stopped.

If a controller must take over before Running, follow the [sequence activation example]({{ '/guided-builds/instruments/#handover' | relative_url }}). While it owns an output, conflicting discrete sequence commands are ghosted. Place deactivation before a later discrete command that needs that output.

| Phase | What controls fuel | Checks to retain |
| --- | --- | --- |
| Startup | Explicit sequence commands until chosen activation event | Oil, light-off, acceleration, finite timeout |
| Running | Main Fuel N2 Governor, bounded by protections | N1, N2, temperature, oil and sensor health |
| Shutdown | Deactivation safe state, combustion cut and shutdown handling | Physical fuel isolation and both shafts' lubrication needs |
| Fault | Authoritative fault/protective handling | Actual output states, recorded reason and recovery condition |

<h2 id="verify">5 · Verify the second-shaft behavior</h2>

Keep hazardous energy isolated for command tests; use suitable test signals. Record real mechanical commissioning separately.

- Check N1/N2 identities, PPR and any gearbox conversion independently.
- Check normal handover, governor direction, output bounds and loss of N2.
- Apply an N2 test signal representing loss of load; verify fuel reduction and independent overspeed response. This does not physically qualify load rejection.
- Confirm temperature/N1 constraints can reduce the governor's requested fuel.
- Repeat STOP, failed-start timeout, shutdown and configured oil-loss policies.
- Review lubrication for a free turbine that may continue spinning after the core stops. Add an independently configured oil circuit or windmilling protection if required by the design, and test its own shaft source.
- Save/reload and download **Build 3 — free power turbine**, with a short list of completed and pending physical tests.

At this point, you should be able to identify every measurement, controller and protection without following a different recipe for each one. That is the transferable skill: **check the interface → add Hardware → calibrate → define control → test normal and failed behavior → back up**.

{% include build-screen.html file="engine-backup-restore" step="Save your Build 3 backup" alt="System maintenance backup controls for downloading the complete engine configuration." caption="Keep this free-turbine configuration and its test notes separate from the earlier turbojet backups." %}

<h2 id="instruments">Additional setup examples</h2>

Build 3 is complete once you save the backup. Use the [setup examples]({{ '/guided-builds/instruments/' | relative_url }}) whenever you want to add a device such as a temperature sensor, cooling fan or load cell.

<span id="voltage"></span><span id="current"></span><span id="fan"></span><span id="switch"></span><span id="challenge"></span><span id="thrust"></span><span id="finish"></span>

<p class="document-nav"><a href="{{ '/guided-builds/control/' | relative_url }}">← Build 2</a><a href="{{ '/guided-builds/instruments/' | relative_url }}">Setup examples</a><a href="{{ '/user-guide/' | relative_url }}">Detailed reference</a></p>
