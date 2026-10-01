---
layout: landing
title: Open-source ESP32 turbine ECU
description: OpenTurbine is experimental ESP32 turbine ECU software with Windows installation, browser configuration, editable sequences, calibration and logging.
---

<section class="hero"><div class="shell hero-grid"><div>
<h1>OpenTurbine</h1>
<p class="lede">Open-source control software for experimental turbine engines, running on Classic ESP32 and ESP32-S3 boards.</p>
<p>Configure sensors, outputs, fuel and oil control, startup/shutdown sequences and protection in your browser. The ECU hosts the interface; no internet connection is needed to use it.</p>
{% include download-cta.html %}
<p class="quiet">Windows installer. Classic ESP32: 4 MB flash minimum. ESP32-S3 DevKitC-1-compatible: 8 MB minimum; PSRAM not required.</p>
</div><figure><img class="screenshot" src="{{ '/assets/images/hero-dashboard.png' | relative_url }}" width="1000" height="936" alt="Simulated OpenTurbine dashboard showing N1 speed, temperature, oil pressure and battery voltage"><figcaption>Simulated readings—not an engine tune. Select to enlarge.</figcaption></figure></div></section>

<section class="section"><div class="shell"><h2>Choose your next step</h2><div class="card-grid four">
<a class="card" href="{{ '/get-started/' | relative_url }}"><h3>Install</h3><p>Flash a supported board, connect to its Wi-Fi and open the dashboard.</p></a>
<a class="card" href="{{ '/guided-builds/' | relative_url }}"><h3>Build step by step</h3><p>Follow wiring diagrams, configured cards and bench checks through three builds.</p></a>
<a class="card" href="{{ '/reference/' | relative_url }}"><h3>Find a setting</h3><p>Search a screen label, sensor or task. Open the full User Guide for reference.</p></a>
<a class="card" href="{{ '/troubleshooting/' | relative_url }}"><h3>Fix a problem</h3><p>Get help with USB, installation, Wi-Fi, configuration and updates.</p></a>
</div></div></section>

<section class="section alt"><div class="shell"><h2>What it controls</h2><div class="card-grid three">
<div class="card"><h3>Starting and shutdown</h3><p>Editable timed and feedback-driven sequences for starters, ignition, fuel valves, oil delivery and cooldown.</p></div>
<div class="card"><h3>Running and protection</h3><p>Fuel metering, idle, oil-pressure regulation and shaft governing. Configure gradual fuel limiting separately from hard shutdowns.</p></div>
<div class="card"><h3>Measurement and custom control</h3><p>Speed, temperature, pressure, voltage, current, torque and thrust inputs. Add threshold or input-to-output controllers; inspect event and run logs.</p></div>
</div><p><a href="{{ '/hardware/' | relative_url }}">Check supported boards, sensors and electrical interfaces →</a></p></div></section>

<section class="section"><div class="shell"><h2>Interface preview</h2>
<details><summary>View Hardware, Controllers, Calibration, Sequence, System and Tools</summary>
<div class="ui-gallery">
<figure><img class="screenshot" src="{{ '/assets/images/hardware-page.png' | relative_url }}" width="1800" height="1050" loading="lazy" alt="OpenTurbine Hardware page with fitted inputs and outputs"><figcaption><strong>Hardware</strong> — add and configure fitted devices.</figcaption></figure>
<figure><img class="screenshot" src="{{ '/assets/images/controllers-page.png' | relative_url }}" width="1800" height="1050" loading="lazy" alt="OpenTurbine Controllers page with configurable turbine controls"><figcaption><strong>Controllers</strong> — assign output control and protection.</figcaption></figure>
<figure><img class="screenshot" src="{{ '/assets/images/calibration-page.png' | relative_url }}" width="1800" height="1050" loading="lazy" alt="OpenTurbine Calibration page with sensor and actuator tools"><figcaption><strong>Calibration</strong> — measure sensor endpoints and output ranges.</figcaption></figure>
<figure><img class="screenshot" src="{{ '/assets/images/sequence-page.png' | relative_url }}" width="1800" height="1050" loading="lazy" alt="OpenTurbine Sequence page with editable startup blocks"><figcaption><strong>Sequence</strong> — order startup and shutdown actions.</figcaption></figure>
<figure><img class="screenshot" src="{{ '/assets/images/system-page.png' | relative_url }}" width="1800" height="1050" loading="lazy" alt="OpenTurbine System page with device and interface settings"><figcaption><strong>System</strong> — manage connections, backups and updates.</figcaption></figure>
<figure><img class="screenshot" src="{{ '/assets/images/tools-page.png' | relative_url }}" width="1800" height="1050" loading="lazy" alt="OpenTurbine Tools page with diagnostics and bench controls"><figcaption><strong>Tools</strong> — run bounded output tests and inspect diagnostics.</figcaption></figure>
</div></details></div></section>

<section class="section alt"><div class="shell">
<h2>Before connecting an engine</h2>
<p>OpenTurbine is experimental, not certified. Use rated drivers, fusing, signal conditioning and an independent physical fuel/power stop. Keep fuel, ignition energy and starter/load power isolated while configuring and dry-testing.</p>
<p><a href="{{ '/safety/' | relative_url }}">Safety requirements</a> · <a href="{{ '/user-guide/' | relative_url }}">Complete User Guide</a> · <a href="{{ site.data.project.repository_url }}">Source and releases on GitHub</a></p>
</div></section>
