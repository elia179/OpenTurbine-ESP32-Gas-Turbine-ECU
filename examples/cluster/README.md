# Build a MAVLink Cluster receiver

This development example replaces the OTC Cluster client. Wired no-load command,
throttle and fault-acknowledgement tests have passed on Classic ESP32 and ESP32-S3.
Assembled-PCB and live-engine qualification remain separate requirements.

1. Copy `libraries/OpenTurbineMavlink` into your Arduino sketchbook's `libraries`
   directory, or add that directory as a local PlatformIO library dependency.
2. Open `MavlinkClusterExample/MavlinkClusterExample.ino`. Select your receiver
   ESP32 board and change its example RX/TX pins to free pins on that board.
3. Connect ECU TX to receiver RX, optional ECU RX to receiver TX, and GND to GND.
   Use compatible 3.3 V logic. Board interface circuitry may change connector
   voltage levels; follow its electrical documentation.
4. On the ECU, assign TX and optional RX in Hardware → Communications → MAVLink.
   In System → MAVLink connection, enable it and set 115200 baud / 100 ms to
   match this sketch. Save and allow the ECU reboot.
5. Open the receiver's USB console at 115200 baud. It displays named channels,
   values and units. Unhealthy, missing or expired data displays as unavailable.
6. For commands, enable Remote engine commands on the ECU. Match the permitted
   sender to the sketch: system 255 / component 190. The ECU defaults to 1/200.
   Type `start`, `stop`, `ack`, `ab on` or `ab off` explicitly. Check the returned
   result **and** achieved engine state. No operation is sent at boot.
7. Optional: type `throttle 25` for a repeating 25% demand, or `throttle off` to
   stop it. The ECU only uses it after you explicitly select **MAVLink throttle
   demand** as a controller input. Configure the controller's input-loss output.
   The example stops transmitting demand when engine state becomes stale.

The library exposes `Client<Serial>` with `update(millis())`, `catalogueReady()`,
`channelCount()`, `channel(index)`, `valid(channel, millis())`, `signalLost()`,
`start()`, `stop()`, `acknowledgeFault()`, `afterburner()` and `throttle(0..1)`.
Call `update` continuously without blocking delays. The default channel capacity
is 160; it is intended for an ESP32-class receiver, not a small AVR.

A receiver must display stale state visibly, use the provided validity checks,
and never replay Start or a throttle setting automatically after reconnecting.
Do not identify signals by their display name: use metadata keys and the current
catalogue revision. Numeric IDs may change after a configuration edit.

The example uses an unsigned trusted UART link. Sender IDs are a filter, not a
password. Signed MAVLink packets are rejected; signing is not implemented.
