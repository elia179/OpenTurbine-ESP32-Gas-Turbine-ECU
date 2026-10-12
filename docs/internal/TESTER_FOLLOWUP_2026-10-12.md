# Workshop tester follow-up — 2026-10-12

Based on v2.5.0 / c7cb1fe. Local changes have not been flashed or published.

## Sequence warning links

Sequence validation banners are now keyboard-accessible links. Pressure/torque
trips and gradual limits link to their Controllers fields. Other known controller
issues link to their settings; hardware issues link to Hardware, and sequence
block issues link to the relevant sequence tab. Missing-sensor trip warnings
explain the alternatives: assign the intended sensor in Hardware, or set the
independent shutdown limit to 0 when that measurement is not used.

The P2 report specifically means `settings.safety.p2_trip_bar > 0` while the
effective hardware configuration has no P2 sensor. A calibrated pressure input
assigned to another purpose does not fulfill that requirement. The warning is
not a load-cell fault. No limits are changed automatically.

A telemetry lock-status rerender could close the destination card after a deep
link opened it. The rerender now reveals the requested destination again.

Follow-up coverage includes all 36 literal firmware issue labels, all 16 inline
Controllers/System warning routes, Hardware GPIO conflicts and required-control
guidance, state-lock notices, and Dashboard diagnostic links. System deep links
open enclosing category cards too. Obsolete governor field links now point to
the current controller editor. Connection/loading statuses and explanatory
cautions are not configuration errors and retain their status behavior.

## Classic ESP32 saves

The tester's save-triggered reboot is intentional and was confirmed by the owner.
Ordinary standby settings saves on Classic reboot into the persisted configuration
to avoid memory-pressure failures when applying a second settings tree alongside
the browser/network allocations. Hardware saves reboot too. Behavior is unchanged.

## Adafruit NAU7802: firmware lead, not a confirmed bench diagnosis

The owner confirmed Adafruit #4538 via the DigiKey product link. Detection status, wiring,
raw counts, and logs are unavailable. The previous v2.5.0 initialization wrote CTRL1
as `0x20 | gain` and PU_CTRL as `0x16`. PU_CTRL bit 7 (AVDDS) stays clear, so
the internal LDO is not selected. ADC register 0x15 chopper-clock setup is also
absent. Adafruit's driver selects the internal 3.0 V LDO and programs the ADC
chopper-clock bits before use. These discrepancies are a credible firmware lead;
the local v2.5.1 candidate now corrects the NAU7802 driver.

Adafruit documents E+ as connected to AVDD, which supplies bridge excitation.
Thus the missing internal-regulator selection is directly relevant to this board
when wired in its standard configuration. The original rev B exposes A+/A-
only; rev C also exposes B+/B-. A+/A- must use channel 1 in the Hardware editor.
The firmware fix should establish the appropriate analog supply and ADC clock
settings, allow settling, and only then run internal calibration; validate it on
the actual board before claiming the reported failure is resolved.

Primary reference:
https://github.com/adafruit/Adafruit_NAU7802/blob/master/Adafruit_NAU7802.cpp
https://learn.adafruit.com/adafruit-nau7802-24-bit-adc-stemma-qt-qwiic/pinouts

Next bench evidence:

1. Does Hardware show a responding NAU7802 at 0x2A on the configured I2C bus?
2. Is the Thrust/Torque input assigned to that device and the actual wired channel?
3. Do raw counts in Calibration change with applied load, remain fixed, or show unavailable?
4. Capture serial NAU7802 power/calibration errors and check bridge excitation.

Detection alone proves I2C communication, not successful analog acquisition.
Changing raw counts with incorrect engineering units points toward zero/known-load
calibration; no raw samples requires checking acquisition and wiring first.

## Local v2.5.1 driver fix

The driver selects internal 3.0 V AVDD, programs ADC 0x15 = 0x30, holds reset,
waits for digital power, and allows 600 ms analog settling without blocking.
It waits for calibration completion before inspecting CAL_ERR, calibrates each
assigned channel, retries transient setup failures, and discards the first
conversion after a channel switch. The real driver passes the fake-register
behavior suite for startup, retries, calibration error/timeout recovery, signed
force/torque, both channels, stale conversion rejection and freshness recovery.

OTBench 0.11 now responds by addressed register and checks analog setup/settling
before calibration; HIL records startup validity and the two-channel calibration
mask. Its old request-order shortcut could hide incorrect initialization.
The bench platform is pinned to the same 55.03.37 core as the DUT.

Hardware validation is still required, including classic ESP32 slave callback
timing, physical bridge excitation and real loaded sensor readings.
