# MAVLink engine connection

Development replacement for the former OTC Cluster and TX-only telemetry links.
It uses generated MAVLink 2 definitions shared by ECU and receiver. Physical
UART command, throttle, timeout and fault-acknowledgement tests have passed on
bare Classic ESP32 and ESP32-S3 boards. Assembled-PCB and ArduPilot integration
qualification remain pending.

## Wiring and setup

1. Connect ECU TX → receiver RX and shared GND. For commands or remote throttle,
   connect receiver TX → ECU RX. Use compatible 3.3 V UART logic on bare ESP32
   boards; PCB interface circuitry may change the connector's requirements.
2. Assign TX and optional RX under **Hardware → Communications → MAVLink
   connection**. A PCB profile can fix the routing. Save and allow the reboot.
3. Enable **System → MAVLink connection**. Match both ends' baud rate; start
   with 115200 baud and a 100 ms channel packet interval. Each packet carries
   up to eight channels, so a complete cycle takes longer with more channels.
4. For monitoring only, leave **Remote engine commands** off. For remote
   operation, fit RX, enable that permission and enter the controller's system
   and component IDs. Default ECU: 1/200; supplied Cluster: 255/190. Each pair
   on a network must be unique.
5. Optional throttle appears as **MAVLink throttle demand** in Controllers when
   RX is fitted. Receiving demand does not select it or start an engine. Choose
   it explicitly and review **Input loss** in that controller. Event-activated
   controllers use the output's safe demand from Hardware; older operating-state
   controllers expose their input-loss output directly. Valid samples must arrive
   before the configured timeout; heartbeat alone does not keep throttle alive.

The supplied [Cluster library/example](../examples/cluster/README.md) handles
metadata, stale readings, command results and reconnects. Telemetry and input
validity are independent of permission to issue engine commands.

## Messages and units

Standard messages retain upstream wire layouts and CRCs:

| Message | Use |
| --- | --- |
| HEARTBEAT (0) | ECU presence, engine mode, 1 Hz |
| EFI_STATUS (225) | Healthy N1 RPM, selected exhaust temperature °C, measured fuel flow cm³/min; unavailable fields NaN |
| COMMAND_LONG / COMMAND_ACK | Supported standard engine operations and their ECU result |
| STATUSTEXT | Best-effort fault text; durable fault state is also sent separately |

EFI intake manifold pressure is unavailable: a configurable gauge pressure
channel must not be relabelled as absolute manifold pressure. All named pressure
channels remain available in their native bar units in the catalogue. Output
values are **commands**, not proof that an actuator physically moved.

`protocol/openturbine.xml` defines the OpenTurbine MAVLink dialect:

| ID | Message | Purpose |
| --- | --- | --- |
| 520100 | OT_LINK_INFO | Boot identity, catalogue revision, channel count, capabilities and rates |
| 520101 | OT_CHANNEL_INFO | Key, user name, unit and display limit references |
| 520102 | OT_CHANNEL_VALUES | Eight readings with independent health flags and sample time |
| 520103 | OT_ENGINE_STATE | Engine/AB/sequence/fault state, operation availability and reason |
| 520104 | OT_REMOTE_INPUT | Normalized throttle demand 0..1, sender session and sequence |
| 520105 | OT_CATALOG_REQUEST | Recover missing metadata |
| 520106 | OT_COMMAND_REQUEST | Boot/session/request-correlated engine operation |
| 520107 | OT_COMMAND_RESULT | Matching result and concise rejection reason |

These are project-local IDs, checked against the pinned upstream definitions;
they are not an upstream allocation. Custom channels require this dialect.
Every installed input/output and controller has its own entry, including two
user-named oil-pressure circuits. Channel numeric IDs are scoped to the current
catalogue revision; registry keys identify channels across display-name edits.
NaN or an unhealthy flag must never be displayed as a healthy zero.

## Engine operation

Preferred operations use correlated request/results: 1 Start, 2 normal Stop,
3 acknowledge/clear fault, 4 afterburner start, 5 afterburner stop. Stop may
supersede a pending operation. Acknowledgement does not bypass readiness or an
active fault cause. There are no configuration, logging, test-output or bypass
commands. The core engine command handler remains authoritative.

Standard `MAV_CMD_DO_ENGINE_CONTROL` (223) supports param1=1 for Start or 0 for
Stop, param2=0 and all remaining parameters=0. Delayed-start, choke and other
options are rejected. `MAV_CMD_USER_1` (31010) param1=1 acknowledges a fault,
2 starts AB, 3 stops AB; remaining parameters must be zero. Target the exact ECU
system/component. Standard ACKs do not carry a request ID: send one standard
operation at a time. The supplied client uses correlated messages to prevent
late Start results being mistaken for a Stop result.

New non-stop operations require a fresh sender heartbeat. Remote demand has its
own freshness timer and rejects duplicate, old, non-finite or out-of-range
samples. Boot identity and ECU time references also reject buffered samples from
a previous boot or outside their age window. The supplied client never starts
the engine or replays a previous Start after reconnect. Standard COMMAND_LONG
has no request timestamp or boot identity; integrations using it must discard
buffered commands across reconnects.

## ArduPilot and RC links

ArduPilot's [MAVLink EFI backend](https://github.com/ArduPilot/ardupilot/blob/master/libraries/AP_EFI/AP_EFI_MAV.cpp)
consumes EFI_STATUS. Its [EFI_TYPE definition](https://github.com/ArduPilot/ardupilot/blob/master/libraries/AP_EFI/AP_EFI.cpp)
assigns MAVLink backend **9**, where that backend is included in the installed
ArduPilot build. Configure a MAVLink 2 serial port at matching baud and EFI_TYPE=9,
then reboot. Verify the installed flight-controller version's parameters before
changing them. Standard EFI telemetry does not automatically provide custom
Cluster channels, remote engine controls or a throttle mapping.

The [Python companion example](../examples/mavlink/README.md) forwards standard EFI
telemetry and can explicitly bridge a selected ArduPilot servo demand to the
virtual throttle input. It is a development example, not flight-qualified.

For richer integration, use the supplied dialect on a companion/controller or
add explicit ArduPilot scripting/firmware support. Do not assume stock ArduPilot
routes unknown project-local message IDs. A transparent UART radio can carry
these frames if its available bandwidth and MAVLink 2 support are adequate.
CRSF, Smart Port and other RC sensor formats need a translation bridge; this
change does not make every RC receiver a MAVLink receiver.

## Migration and generation

An enabled old Cluster-only connection retains its wiring and becomes MAVLink;
remote engine commands default off. Two enabled old connections on different
wiring produce a visible Hardware choice; both routes are retained for review
until one is chosen. Existing OTC displays need new receiver firmware.

Bindings are generated with pymavlink 2.4.50 by `tools/generate_mavlink.py` and
checked in, so ECU and Arduino builds need no generator. The input hashes and
license are included. The development interface is unsigned; IDs are not
cryptographic authentication and signed frames are rejected.

For independent protocol checks, install the development dependency
`python -m pip install pymavlink==2.4.50`, then run
`python tools/run_mavlink_checks.py`. The generated library remains buildable
without that Python dependency.
