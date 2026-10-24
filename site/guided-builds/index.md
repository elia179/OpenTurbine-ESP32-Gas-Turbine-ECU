---
layout: document
title: Learn OpenTurbine with three guided builds
description: Configure one HX80-sized teaching engine as a basic turbojet, improve its control, then add a free power turbine using three manageable guided builds.
lede: One engine, three milestones. Follow the basic path first and add complexity when it is useful.
permalink: /guided-builds/
---

{% include guided-intro.html %}

<div class="card-grid three build-cards">
<a class="card" href="{{ '/guided-builds/basic/' | relative_url }}"><p class="eyebrow">Build 1 · Configure</p><h2>Basic turbojet</h2><p>Connect and calibrate the essential inputs. Set up starter, fuel, ignition and lubrication, then verify protection and a complete dry start/stop path.</p><span class="button secondary">Begin Build 1 →</span></a>
<a class="card" href="{{ '/guided-builds/control/' | relative_url }}"><p class="eyebrow">Build 2 · Develop</p><h2>Control and protection</h2><p>Add combustor-pressure feedback, automatic idle, fuel limiting and separate startup-temperature protection. Learn configurable switch controllers and sequence activation.</p><span class="button secondary">Continue to Build 2 →</span></a>
<a class="card" href="{{ '/guided-builds/extend/' | relative_url }}"><p class="eyebrow">Build 3 · Extend</p><h2>Free power turbine</h2><p>Add a separate N2 shaft, a fuel governor and independent overspeed protection. Choose extra instruments only when needed.</p><span class="button secondary">Continue to Build 3 →</span></a>
</div>

## One example that grows

The teaching engine is a homemade HX80-sized liquid-fuel turbine with ECU-controlled starter, spark ignition, fuel and oil delivery. Build 1 operates conceptually as a turbojet. Build 3 adds a mechanically separate free power turbine and load.

Normal full-power N1 is about **60000 RPM**, combustor pressure **3–4 bar** and oil supply **4–5 bar**. These describe the example, not every engine. The [worksheet]({{ '/guided-builds/parts/#engine-worksheet' | relative_url }}) identifies which other numbers are teaching assumptions and which must come from your actual hardware.

Each task follows **connect → configure → calibrate where needed → check**. A later build reuses the earlier inventory. You do not need every supported sensor or every control method to finish the guide.

## Prepare once

Use [Get Started]({{ '/get-started/' | relative_url }}) to install OpenTurbine, then choose the appropriate [development-board pin column and parts]({{ '/guided-builds/parts/' | relative_url }}). The main instructions use device and terminal names so the method transfers between boards. PCB profiles have their own labelled connections.

Begin with hazardous load energy disconnected and suitable test loads/signals. Verify physical interfaces and command behavior before a live engine attempt. The independent physical stop and the engine's required lubrication/protection apply from Build 1. Keep notes identifying physical tests versus simulated checks.

Keep one live ECU browser session at a time; reading this guide in another tab is fine. Select a screenshot or diagram to enlarge it. Every required setting is described in text too. **Hide walkthrough screenshots** gives a shorter reading view while keeping wiring diagrams visible.

## Choose a milestone, not every feature

- **New to electronics or OpenTurbine:** start at Build 1 and verify each task before continuing.
- **Already have the basic installation:** compare its checklist and save a backup before entering Build 2.
- **Adding a free turbine:** finish the control/protection baseline before Build 3.
- **Adding a specific instrument:** use the [optional workshops]({{ '/guided-builds/instruments/' | relative_url }}) for current, battery, fan, switch, torque or thrust. They are not a fourth required build.

Use the [User Guide]({{ '/user-guide/' | relative_url }}) for alternative methods and field-by-field detail, the [Hardware reference]({{ '/hardware/' | relative_url }}) for interfaces, and [Troubleshooting]({{ '/troubleshooting/' | relative_url }}) when a check fails.

<p class="document-nav"><a class="button" href="{{ '/guided-builds/basic/' | relative_url }}">Begin with the basic turbojet →</a></p>
