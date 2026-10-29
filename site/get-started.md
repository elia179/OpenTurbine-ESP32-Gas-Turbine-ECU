---
layout: document
title: Install OpenTurbine from Windows
description: Install OpenTurbine on a supported ESP32 using the Windows Setup Tool, then connect to its Wi-Fi dashboard.
lede: The normal installation does not require Git, PlatformIO or source-code compilation.
---

{% include safety-note.html %}

After installation, choose a level in [Guided Builds]({{ '/guided-builds/' | relative_url }}) to connect and configure one item at a time. Start with the basic level if electronics or the Hardware page is new to you.

## 1. Prepare the board

You need:

- A Classic ESP32 board with at least 4 MB flash, or an ESP32-S3 DevKitC-1-compatible board with at least 8 MB flash. The universal S3 image runs on 8 MB and 16 MB modules and does not require PSRAM.
- A Windows computer.
- A USB **data cable**. A charge-only cable can power the board but cannot install firmware.

Keep fuel, ignition energy, starter power and actuator/load power physically disconnected during installation.

## 2. Download the Setup Tool

[Download `OpenTurbineSetupTool.exe` for Windows]({{ site.data.project.windows_download_url }}).

Use the executable above, not GitHub's **Download ZIP** source-code button. If Windows displays a warning, confirm that the file came from the official [OpenTurbine Releases]({{ site.data.project.releases_url }}) page before using **More info → Run anyway**. Do not disable Windows protection globally.

<p class="expected"><strong>Expected:</strong> Windows opens the OpenTurbine Setup Tool.</p>

## 3. Choose install or update

Open the Setup Tool while connected to your normal internet Wi-Fi so it can prepare the package. It shows the package version before you proceed.

- **New board or intentional fresh start:** choose **Clean install / reinstall**. This USB path erases the selected board.
- **Working OpenTurbine ECU:** choose **Update and keep my setup**. The tool saves a complete engine-file backup before uploading and preserves the existing setup.

## 4. Follow the selected path

For **USB installation**, connect the board with a data cable and continue. The tool checks the available COM ports. If several boards are found, select the intended chip and port. Choose the matching development-board or PCB profile, review the final erase confirmation, then select **Erase board and install**. Progress separates checking, erasing and writing/verification. Keep USB power connected until it finishes.

If a USB driver is missing, the tool opens the matching official CP210x/WCH vendor download page. Install the driver, reconnect the board and choose **Try Again**. If a COM port is busy, close serial monitors. Follow the BOOT/RESET instructions only when normal detection needs help.

For a **Wi-Fi update**, switch to the existing ECU network when prompted and confirm that connection once. The tool handles both restarts and final verification automatically. If Windows leaves that network, reconnect when prompted. A final verification retry checks the installed files without uploading them again. Keep ECU power connected throughout.

<p class="expected"><strong>Expected:</strong> the tool reports completion and the installed version. Wi-Fi updates also confirm that all dashboard files match the package.</p>

<p class="inline-help">No board or COM port? <a href="{{ '/troubleshooting/#board-does-not-appear-as-a-com-port' | relative_url }}">Use board-detection help.</a> Installation failed? <a href="{{ '/troubleshooting/#flashing-fails' | relative_url }}">Open flashing help.</a></p>

## 5. Open the dashboard

Join the Wi-Fi network created by the board, remain connected even if Windows says the network has no internet, and open [`http://192.168.4.1`](http://192.168.4.1) in a browser.

<p class="expected"><strong>Expected:</strong> the OpenTurbine dashboard loads and shows the ECU state.</p>

<p class="inline-help">Wi-Fi missing or dashboard not loading? See <a href="{{ '/troubleshooting/#openturbine-wi-fi-is-missing' | relative_url }}">Wi-Fi help</a> or <a href="{{ '/troubleshooting/#dashboard-does-not-open' | relative_url }}">dashboard help</a>.</p>

## 6. Continue with your own hardware

OpenTurbine does not require one fixed engine layout. Describe only the sensors and actuators your system actually has, then configure and test them in this order:

**Hardware → Controllers → System → Calibration → Sequence → Tools → Dashboard**

Start with [Level 1: build a basic system]({{ '/guided-builds/basic/' | relative_url }}) for wiring, configured cards and checks in order. The [complete User Guide]({{ '/user-guide/' | relative_url }}) is the detailed reference; the [single-shaft overview]({{ '/example-system/' | relative_url }}) shows the overall relationships.

Do not connect fuel or ignition energy until the independent stop and every configured shutdown path have been dry-tested.

<p class="document-nav"><a href="{{ '/guided-builds/basic/' | relative_url }}">Begin Level 1</a><a href="{{ '/user-guide/' | relative_url }}">Open the User Guide</a><a href="{{ '/hardware/' | relative_url }}">Hardware requirements</a><a href="{{ '/troubleshooting/' | relative_url }}">Troubleshooting</a></p>
