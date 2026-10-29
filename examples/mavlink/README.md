# Python companion / ArduPilot example

This development example is not flight-qualified. It provides a serial engine
console and an optional explicit ArduPilot throttle bridge. It never starts an
engine automatically and never arms a flight controller.

Install `pyserial` for the engine console, and `pymavlink==2.4.50` for the optional
ArduPilot connection. Run from the repository so `protocol/openturbine.py` is
available:

```
python examples/mavlink/engine_console.py COM7 --baud 115200
```

Match ECU System → MAVLink permitted sender to 255/190. Fit ECU RX and explicitly
enable remote engine commands if needed. Type `start`, `stop`, `ack`, `ab on`,
`ab off`, `throttle 25`, `throttle off` or `quit`. Receiving throttle does nothing
until you select it as a Controllers input. Set the controller's input-loss
output before using it. Stale ECU state stops the stream and requires a new
explicit throttle selection.

For an ArduPilot companion arrangement, connect the companion to both ECU and
flight controller. For example:

```
python examples/mavlink/engine_console.py COM7 --autopilot COM8 --servo 3 --pwm-min 1000 --pwm-max 2000
```

This forwards only standard ECU HEARTBEAT and EFI_STATUS frames to ArduPilot,
preserving their ECU source IDs. Enable ArduPilot's MAVLink EFI backend (type 9,
where included in your installed build). The bridge asks for SERVO_OUTPUT_RAW
at 10 Hz, reads the explicitly chosen output from flight-controller component 1,
and maps the configured PWM endpoints into 0..1. Choose the output that actually
represents your intended engine throttle; output 3 is only an example.

Type `throttle ap` to explicitly begin forwarding demand. It requires fresh ECU
state, fresh autopilot heartbeat/output, and an armed autopilot reporting ACTIVE.
Loss of any of those stops forwarding and requires another explicit selection.
ArduPilot's own RC/failsafe setup still determines the output being observed.
Do not rely on this example as a complete aircraft failsafe design. Bench-test
arming, disarming, RC loss, serial loss, computer loss and ECU restart first.

The console's engine operations stay explicit. They are not inferred from
ArduPilot arming, an RC switch or a nonzero throttle. A dedicated RC switch/start
policy can be designed on top of the same public engine operations after its
behavior and integration have been validated. The script does not require stock
ArduPilot to recognise or route OpenTurbine's custom dialect.
