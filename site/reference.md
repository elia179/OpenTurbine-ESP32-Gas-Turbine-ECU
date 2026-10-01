---
layout: document
title: Find a topic or setting
description: Search OpenTurbine documentation, look up Controllers and System fields, or jump directly to wiring, calibration, sequence, backup and troubleshooting instructions.
lede: Choose a task, or search a screen label, sensor, setting or symptom.
permalink: /reference/
---

<div class="doc-search" data-doc-search data-index="{{ '/docs-search.json' | relative_url }}" data-base="{{ site.baseurl }}" hidden>
<label for="docs-query">Search documentation and settings</label>
<input id="docs-query" type="search" placeholder="Try oil pressure, servo, timeout or Maximum N1 Speed" autocomplete="off">
<p class="quiet" data-search-status role="status" aria-live="polite">Search runs in your browser.</p>
<ol class="search-results" data-search-results></ol>
</div>

## Learn or look something up

| Your goal | Start here |
| --- | --- |
| I am new to the board or wiring | [Install and connect]({{ '/get-started/' | relative_url }}), then [Level 1]({{ '/guided-builds/basic/' | relative_url }}) |
| I want to add one input or output | [Wiring patterns]({{ '/hardware/#connection-patterns' | relative_url }}) and the [illustrated builds]({{ '/guided-builds/' | relative_url }}) |
| I need a field definition | [Controllers and System field reference]({{ '/user-guide/#part-10-configure-controllers-and-system' | relative_url }}) |
| I want the full setup procedure | [User Guide]({{ '/user-guide/' | relative_url }}) |
| Something is not working | [Troubleshooting by symptom]({{ '/troubleshooting/' | relative_url }}) |

## Common tasks

| Task | Direct instructions |
| --- | --- |
| Choose a supported board or sensor | [Boards]({{ '/hardware/#supported-esp32-targets' | relative_url }}) · [Compatible interfaces]({{ '/hardware/#supported-sensor-and-expansion-devices' | relative_url }}) |
| Name a device and assign its connection | [Channel fields]({{ '/user-guide/#83-what-every-channel-card-field-means' | relative_url }}) · [Example S3 pin plan]({{ '/guided-builds/parts/#an-optional-cumulative-pin-plan' | relative_url }}) |
| Set up Dashboard warnings | [References and enable switches]({{ '/guided-builds/basic/#set-up-dashboard-references-and-warnings-now' | relative_url }}) |
| Choose fixed, input or automatic idle—or turn idle off | [Running idle choices and screenshots]({{ '/guided-builds/basic/#fuel-without-idle' | relative_url }}) |
| Calibrate the fuel pump minimum | [Pump calibration and button states]({{ '/guided-builds/basic/#fuel' | relative_url }}) |
| Change a sensor bar's display range | [Dashboard scales and recent trends]({{ '/user-guide/#dashboard-readings-and-display-scales' | relative_url }}) |
| Create a controller | [Illustrated input-to-output mapping]({{ '/guided-builds/control/#custom' | relative_url }}) · [Controller methods and ownership]({{ '/user-guide/#part-13-use-custom-controllers' | relative_url }}) |
| Calibrate an input | [Calibration checklist]({{ '/user-guide/#part-11-calibrate-inputs-and-outputs' | relative_url }}) · [Throttle wizard]({{ '/guided-builds/basic/#throttle' | relative_url }}) · [Pressure wizard]({{ '/guided-builds/control/#pressure' | relative_url }}) |
| Test an output | [Tools and settings screenshots]({{ '/guided-builds/basic/#starter' | relative_url }}) · [Dry-test checklist]({{ '/user-guide/#part-14-dry-test-the-complete-ecu' | relative_url }}) |
| Add a sequence block | [Block picker and expanded cards]({{ '/guided-builds/basic/#sequence' | relative_url }}) · [Sequence reference]({{ '/user-guide/#part-12-build-startup-and-shutdown-sequences' | relative_url }}) |
| Check a limit or shutdown response | [Limits and hard trips]({{ '/guided-builds/control/#limits' | relative_url }}) · [Safety-function reference]({{ '/user-guide/#92-safety-functions' | relative_url }}) |
| Back up or restore a complete setup | [Engine-file backup and restore]({{ '/user-guide/#backups' | relative_url }}) |
| Update firmware and web pages | [Updates]({{ '/user-guide/#updates' | relative_url }}) |

## Reading shortcuts

Every guide has an **On this page** outline. On a phone, expand it to jump to a section. Pages with illustrated walkthroughs also offer **Hide walkthrough screenshots**; the wiring diagrams and written instructions remain visible. Select any diagram or screenshot to enlarge it.

A setting link opens the relevant collapsed field-reference section. Use the field filter there for another lookup. Without JavaScript, the task links, outlines and expandable reference tables remain available; browser Find also works on visible text.
