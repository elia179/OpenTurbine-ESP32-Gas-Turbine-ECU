---
layout: document
title: "OpenTurbine troubleshooting: USB, flashing and Wi-Fi"
description: Diagnose OpenTurbine USB-driver, board-detection, flashing, Wi-Fi, dashboard, and update problems for supported ESP32 turbine ECU boards.
lede: Find the symptom first; do not treat a setup or wiring question as a software bug.
---

Keep fuel, ignition, starter power, and other hazardous loads isolated while diagnosing an OpenTurbine installation. Use a direct USB port and a known data-capable cable before changing drivers or firmware.

## Windows blocks the Setup Tool

Use the official OpenTurbine download link. Windows can warn about a new or unsigned application; choose **More info → Run anyway** when Windows offers it. Do not disable Windows protection globally or use a copy from another website. Normal installation does not require understanding checksums, and the Setup Tool automatically verifies the firmware package it downloads.

## CP210x driver installation fails

Disconnect and reconnect the intended board, then let the Setup Tool identify the connected CP210x bridge before installing a driver. Use a direct port, close serial monitors, and avoid installing a CP210x driver for an unrelated COM device. If Windows reports a specific installation error, restart only when Windows asks, then reconnect the board and rescan.

## CH340/WCH driver installation fails

The Setup Tool offers a WCH driver only for a matching connected WCH bridge. Check the data cable and direct USB connection first. Do not install a WCH driver merely because an unrelated serial device exists. After a successful driver install, reconnect or rescan as the tool instructs.

## Board does not appear as a COM port

Try a known data cable, another direct USB port, and no USB hub. Check whether the connected bridge has a missing driver; the tool should offer the matching CP210x or WCH driver. Remove power only if the board documentation permits it, then reconnect. An unrelated existing COM port does not prove the intended board has one.

## COM port exists but the ESP32 does not answer

Close PlatformIO, terminal programs, and any serial monitor using that port. Use the board's BOOT/RESET sequence: commonly hold BOOT, tap EN/RESET, start the connection, and release BOOT when the uploader begins. Follow the Setup Tool's device-specific boot-mode guidance instead of reinstalling a driver that is already working.

## Flashing fails

Keep the cable short and directly connected. Confirm the selected board is a supported Classic ESP32 or supported ESP32-S3 target. Retry with the BOOT/RESET procedure, no other application holding the COM port, and stable board power. A Clean install/reinstall erases the selected board; use it only when that is intended.

## OpenTurbine Wi-Fi is missing

Wait for a successful firmware boot, confirm stable ECU power, and look for the configured board network name. If the board was just installed or reset, reconnect after it finishes booting. If no network appears after a confirmed USB install, retry the installation with the correct target and inspect the diagnostic logs before reporting a problem.

## Dashboard does not open

Join the board Wi-Fi and browse directly to `http://192.168.4.1`. Keep only one OpenTurbine tab or browser client open; this limit applies to both Classic ESP32 and ESP32-S3 ECUs. Close duplicate tabs or dashboards on other devices before retrying. Mobile data, VPN, captive-portal behavior, and automatic network switching can send the browser elsewhere; temporarily disable them if needed. If Wi-Fi is visible but pages still fail, reinstall or update the web assets without interrupting power.

## A fitted output is missing from Create controller

Check that the output was saved in Hardware, has the intended electrical driver and is not already claimed by a controller or dedicated subsystem. A display-name change does not change its stable ID or release ownership. Review the existing owner before deleting or disabling anything. See the [controller creation screenshots]({{ '/guided-builds/control/#custom' | relative_url }}).

## A setting is unavailable or a save is blocked

Read the displayed prerequisite or validation message. **Configured system** focuses on fitted features; **Explore all features** exposes other settings but does not supply missing hardware. Open the warning's link to the relevant field, correct conflicts, then review the change recap. An amber future-hardware value is different from a blocked enable switch. Use the [field reference]({{ '/user-guide/#part-10-configure-controllers-and-system' | relative_url }}) to check its meaning.

## A reading is stuck, wrong or moves backward

Start with raw signal voltage/counts and input health, then check the selected electrical type, polarity, range and calibration. A plausible engineering value can still be incorrectly scaled. Verify the wiring with power isolated and use a trusted reference before changing a protection. See [calibration checks]({{ '/user-guide/#part-11-calibrate-inputs-and-outputs' | relative_url }}).

## A sequence waits or times out

Open the active card and read its completion condition, input health and timeout result. An ACTION command and an UNTIL wait can have similar names but different behavior. Resolve the missing evidence; do not bypass a condition just to advance the sequence. The [picker and card examples]({{ '/guided-builds/basic/#sequence' | relative_url }}) show where to look.

## Fuel does not fall to zero at low throttle

With hazardous loads isolated, check **Controllers → Fuel-metering support → Idle → Running Idle Mode**, then the Main Fuel owner's **Output low (%)**. Idle **Off** removes the Running floor but does not change Output low; both must permit zero for a full-range bench mapping. Fixed, input and automatic idle can hold a floor in Running. Startup has its own Sequence commands. Do not erase a measured pump minimum to disable idle. Follow the [illustrated idle choices]({{ '/guided-builds/basic/#fuel-without-idle' | relative_url }}).

## The fuel calibration Stop button is grey

**Metering started — stop** becomes available after **Start 1%/s sweep**. Before a sweep it is intentionally disabled, not evidence of a missing pump. If the sweep or another calibration action is unavailable, check the displayed prerequisite, ECU state and active tests. See the [pump calibration card]({{ '/guided-builds/basic/#fuel' | relative_url }}).

## A sensor bar changes its scale

Auto scaling follows recent valid readings; it is not a changing protection limit. Select the range below the bar and set a fixed **Low/High** span when comparing runs. A fault clears recent history. The scale is a browser preference, not sensor calibration or an engine setting. See [Dashboard scales]({{ '/user-guide/#dashboard-readings-and-display-scales' | relative_url }}).

## Update fails

Back up the full engine file before an update. Use **Update and keep my setup** for a working controller, and do not interrupt power while it runs. If the board cannot be reached over Wi-Fi, recover over USB. If a restore is rejected, use a complete matching engine file rather than partial configuration sections.

## Where diagnostic logs are stored

Setup Tool diagnostics are stored in `%LOCALAPPDATA%\OpenTurbine\SetupTool\logs`. Wi-Fi-update backups are normally stored under `Documents\OpenTurbine\Backups`. Remove Wi-Fi passwords, personal network details, and unreviewed engine configuration before attaching material to [Setup Help](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/issues/new?template=setup_help.yml).

## Before reporting a bug

Include the supported board target, connection method, fitted hardware, exact symptom, expected behavior, observed behavior, and sanitized logs. Use [Setup Help](https://github.com/elia179/OpenTurbine-ESP32-Gas-Turbine-ECU/issues/new?template=setup_help.yml) for installation, USB, driver, flashing, Wi-Fi, and dashboard questions. Use a bug report only for reproducible software behavior.
