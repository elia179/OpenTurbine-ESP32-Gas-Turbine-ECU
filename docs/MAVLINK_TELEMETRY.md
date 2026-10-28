# MAVLink telemetry in OpenTurbine 2.6.1

This is a TX-only MAVLink v1 telemetry component, not a flight controller.
It sends HEARTBEAT (0), NAMED_VALUE_FLOAT (251) and fault STATUSTEXT (253).
There is no RX, parameter service, mission service or MAVLink engine control.
An inspector/logger can read it even when a ground station does not list it
as a vehicle. System ID is 1, component ID is 200, autopilot is INVALID.

## Connect and configure

1. Use compatible 3.3 V UART logic. Wire ECU MAVLink TX to receiver RX and
   connect grounds. Do not connect TX to TX, RS-232 voltage levels, or a 5 V
   adapter output to an ESP32 GPIO. A PCB's interface circuitry can change the
   connector requirements; follow its profile and electrical documentation.
2. Assign TX in **Hardware → Communications → MAVLink telemetry**, save and
   allow the reboot. A PCB profile may fix the pin and share the connector with
   OTC; use only one protocol on a shared connection.
3. In **System → Connections & runtime → MAVLink telemetry**, enable the same
   link, choose baud and sensor interval, save and allow the reboot. Start with
   57600 baud / 100 ms, matching the receiver. Hardware and System edit the same
   enable, not two independent switches.
4. Check the receiver's MAVLink inspector or decode messages using pymavlink.
   Healthy fitted primary values appear automatically. User-defined registry
   channel names do not rename these wire identifiers.

## Named values and units

| Name | Value |
| --- | --- |
| N1_RPM, N2_RPM | shaft speed, RPM |
| TOT_C, TIT_C, OIL_T_C | temperatures, Celsius |
| OIL_BAR, FUEL_BAR, P1_BAR, P2_BAR | calibrated pressures, bar |
| BATT_V | battery voltage, V |
| TORQ_NM, THRUST_N | shaft torque, Nm; thrust, N |
| FUEL_FLOW | configured/calibrated fuel-flow units, as on the ECU |
| THR_PCT | commanded main fuel output, percent |

Existing names retain their meanings. P1/P2 are additions in 2.6.1.
Values are canonical ECU units regardless of browser unit
preferences. Unfitted, unhealthy and non-finite sensor values are omitted.
Omission does not erase a receiver's cached value: mark each field stale when
its timestamp stops advancing. A live heartbeat alone does not prove a sensor
is healthy.

Heartbeat is sent at 1 Hz, independently of the sensor interval. Its custom mode
contains the ECU SysMode number; status reports standby, active during Startup/
Running, and emergency during Fault. Sensor frames share the UART capacity;
when the transmit buffer fills, the next interval resumes at the first unsent
field. The configured interval is not a guarantee that every field arrives in
one cycle. Fault text is best-effort when UART capacity is available.

## Minimal receiver

Install pymavlink on the receiving computer, set its serial port and matching
baud, then run:

```python
from pymavlink import mavutil

link = mavutil.mavlink_connection("COM7", baud=57600)
while True:
    message = link.recv_match(
        type=["HEARTBEAT", "NAMED_VALUE_FLOAT", "STATUSTEXT"], blocking=True
    )
    if message.get_srcSystem() == 1 and message.get_srcComponent() == 200:
        print(message.to_dict())
```

Use the actual receiver port (`/dev/ttyUSB0`, for example, on Linux). This
example only receives data and sends no engine commands.

Protocol references: [heartbeat](https://mavlink.io/en/services/heartbeat.html)
and [common message definitions](https://mavlink.io/en/messages/common.html).
The no-load host tests validate frame CRC, field/health behavior, heartbeat
cadence and buffer pressure on both targets. Actual UART wiring, a physical
cluster and ground-station compatibility still need receiver hardware testing.
