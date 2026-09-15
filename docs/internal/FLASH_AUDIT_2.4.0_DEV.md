# OpenTurbine 2.4.0 development flash audit

Classic ESP32 measurements use the pinned `esp32dev` release environment and
its 1,703,936-byte application partition. Each retained change was linked and
measured before proceeding.

| Build | Flash bytes | Static RAM bytes | Change |
|---|---:|---:|---:|
| Phase-torque 2.4 baseline | 1,665,412 | 105,408 | — |
| Direct MAX6675, external library removed | 1,665,272 | 105,384 | −140 flash, −24 RAM |
| Direct DS18B20 setup, DallasTemperature removed | 1,664,128 | 105,184 | −1,144 flash, −200 RAM |
| Routine serial diagnostics compiled out | 1,662,044 | 105,184 | −2,084 flash |
| Unused SPI include removed | 1,660,324 | 105,088 | −1,720 flash, −96 RAM |
| Actuator trace diagnostics compiled out | 1,660,028 | 105,088 | −296 flash |
| Shared MAX6675/MAX31855 read loop | 1,659,976 | 105,088 | −52 flash |

Net reduction: **5,436 flash bytes** and **320 static RAM bytes**. MAX6675 kept
its 250 ms sampling, open-circuit/range checks, and two-sample noise averaging.
DS18B20 kept OneWire, cached boot-time discovery, asynchronous conversion, CRC,
range checking, and configured resolution; direct setup also verifies the
scratchpad resolution bits.

The later optional Torque Shaft Speed registry path brings the current Classic
development image to **1,660,796 flash bytes** with static RAM unchanged at
**105,088 bytes**. It reuses the phase reference MCPWM channel and allocates no
PCNT unit or additional GPIO. The isolated optimization comparisons above are
kept against their common phase-torque baseline.

`-fno-rtti` was also tested with a clean Classic link. It produced the exact
same 1,660,796-byte flash image and 105,088-byte static-RAM result, while adding
irrelevant warnings to C compilation. The flag was therefore not retained.

The linked image is dominated by required configuration, telemetry, and route
handling rather than these small sensor drivers. Largest project text symbols
in the final map include `HardwareConfig::_fromDoc` (26,450 bytes), telemetry
JSON construction (15,458), settings validation (13,370),
`HardwareConfig::_toDoc` (12,182), platform pin validation (11,476), the main
loop (about 10,400), and `WebServer::_setupRoutes` (4,879 plus its route
lambdas). Flash sections are about 1,235,712 bytes text and 280,304 bytes
read-only data. Those areas were measured only; they were not refactored because
the requested low-risk sensor/dependency/diagnostic changes already produced a
useful margin without altering ECU features.
