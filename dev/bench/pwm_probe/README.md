# Bare-board MCPWM waveform probe

Fixture-only diagnostic. Never install on an assembled ECU or any board with
engine loads. Driver/expander readback is simulated; waveform generation uses
the actual production PcbPowerStage.cpp and real ESP-IDF MCPWM hardware.
The six power-test pins are 11/12/18/21/39/40 (fixture mapping, not PCB mapping).
Classic OTBench captures pin 11 through OILPUMP_OUT. Six simultaneous LEDC
outputs use otherwise unwired pins 1/6/7/9/10/16. GPIO47 carries the heartbeat.
Nothing arms until FREQ followed by ARM_NO_LOAD. Reboot between frequencies.
MIXED selects six different frequencies before arming. SET sets all six duties; FAULT/CLEAR exercise reported-driver-fault recovery;
STALL injects a 100 ms loop pause. Restore the real ECU firmware afterwards.
Measurements qualify MCU waveforms and resource coexistence only, not MOSFETs,
SPI/I2C electrical operation, current capacity, or timing of all six carriers.
