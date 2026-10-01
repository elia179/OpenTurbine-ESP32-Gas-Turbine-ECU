---
layout: document
title: Learn OpenTurbine with three guided builds
description: Build one OpenTurbine system through three clear levels, learning wiring, hardware configuration, feedback, protection and independent extensions.
lede: Wire, configure and test one device at a time. Choose the stage that matches your experience.
permalink: /guided-builds/
---

<div class="card-grid three build-cards">
<a class="card" href="{{ '/guided-builds/basic/' | relative_url }}"><p class="eyebrow">Level 1 · Follow</p><h2>Basic system</h2><p>Connect N1, temperature and throttle. Learn servo, PWM and relay outputs. Tie the pieces together in a dry start/stop sequence.</p><p><strong>Start here if:</strong> wiring or the Hardware page is new to you.</p><span class="button secondary">Start Level 1 →</span></a>
<a class="card" href="{{ '/guided-builds/control/' | relative_url }}"><p class="eyebrow">Level 2 · Understand</p><h2>Control and protection</h2><p>Add pressure feedback and fuel isolation, build a knob-controlled bench light, and verify limits and output ownership.</p><p><strong>Start here if:</strong> you can already add and test inputs and outputs.</p><span class="button secondary">Start Level 2 →</span></a>
<a class="card" href="{{ '/guided-builds/extend/' | relative_url }}"><p class="eyebrow">Level 3 · Extend</p><h2>Extend your system</h2><p>Add N2, current and 12 V battery monitoring, a cooling fan and a cover switch. Measure shaft torque with two pickups and thrust with an I²C load cell.</p><p><strong>Start here if:</strong> controllers, sequences and protection already make sense.</p><span class="button secondary">Start Level 3 →</span></a>
</div>

## One installation that grows

These are three stages of the same teaching system. Level 2 keeps the Level 1 channels; Level 3 keeps both. You can choose a level directly, but check its starting inventory before you begin. The levels measure how much guidance you want, not whether your actual engine needs safety equipment.

Each device follows the same order: **wire → configure in Hardware → calibrate → assign control → verify**.

{% include build-figure.html file="level-1" alt="Functional view of N1, turbine temperature and throttle entering the ECU, with starter, ignition and fuel commands leaving it." caption="Level 1 starts with six essential signal paths. Drivers, load power and the independent stop are physical requirements outside this simplified software map." %}

## Learn on a bench first

Install on a supported spare board using [Get Started]({{ '/get-started/' | relative_url }}). Use a potentiometer, a handheld magnet, a temperature probe, an unloaded servo and low-power dummy loads while learning. A bench demonstration lets you check the interface without introducing fuel, ignition energy or starter power.

**The basic topology is a learning model, not a complete specification for operating an engine.** Fit the lubrication, isolation, sensing and protections your real engine requires from the beginning. Keep an independent physical fuel/power stop. The complete [Safety guide]({{ '/safety/' | relative_url }}) and the engine's requirements apply at every level.

You will see placeholders such as **your verified N1 limit** where values must come from the actual engine. There is no ready-to-run fuel schedule here. Fixed resistor values are for explicitly bounded bench exercises; they do not size real load wiring or protection.

## What each step gives you

Each addition has a wiring diagram, configured-card screenshot and expected test result. Check the result before adding the next device. Screenshots use simulated hardware; select any image to enlarge it.

Keep only one browser tab connected to the ECU at a time. You can read these public guides in another tab; the restriction concerns multiple live ECU interface sessions.

## Keep these references nearby

- [Example parts and a cumulative pin plan]({{ '/guided-builds/parts/' | relative_url }}) — how to choose compatible teaching hardware.
- [Hardware guide]({{ '/hardware/' | relative_url }}) — electrical requirements and supported interfaces.
- [User Guide]({{ '/user-guide/' | relative_url }}) — the detailed procedure and field reference.
- [Existing single-shaft overview]({{ '/example-system/' | relative_url }}) — another view of the conceptual installation.

<p class="document-nav"><a class="button" href="{{ '/guided-builds/basic/' | relative_url }}">Begin with Level 1</a></p>
