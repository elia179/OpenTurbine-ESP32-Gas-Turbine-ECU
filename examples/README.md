# OpenTurbine companion examples

The [MAVLink Cluster example](cluster/README.md) provides a reusable receiver for
named engine channels and optional engine operation. The [MAVLink interface
reference](../docs/MAVLINK_TELEMETRY.md) covers the ECU connection and ArduPilot.

The old OTC receiver is replaced by `OpenTurbineMavlink`. Existing OTC displays
need the new receiver firmware; changing the ECU alone cannot upgrade a display.
