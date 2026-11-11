---
layout: document
title: Additional setup examples
description: Worked OpenTurbine examples for battery voltage, current sensing, automotive NTC thermistors, cooling fans, switches, shaft torque and thrust.
lede: Pick a device to see its wiring, OpenTurbine settings, calibration and checks.
permalink: /guided-builds/instruments/
---

{% include guided-nav.html %}

## Find an example

Use these independent examples with any of the three guided builds or an existing installation. Reuse an existing channel when it already measures the same thing, and check which pins are free on your board.

- [Battery voltage](#voltage) and [current](#current)
- [Automotive thermistor on an ADC](#automotive-thermistor) or [digital temperature and cooling fan](#fan)
- [Fuel shutoff solenoid](#fuel-shutoff)
- [Cover switch](#switch), [second oil-pressure switch](#second-oil-switch), and [sequence activation](#handover)
- [Shaft torque](#challenge) and [thrust](#thrust)
- [Light-dimming controller](#light-dimming)

The examples use a **Classic ESP32-WROOM-32** development board. See [Example device connections]({{ '/guided-builds/parts/#optional-instruments' | relative_url }}) before combining examples. Several use the same spare pins.

[Back to the three builds]({{ '/guided-builds/' | relative_url }}) · [Field-by-field User Guide]({{ '/user-guide/' | relative_url }})

<h2 id="voltage">Measure a 12 V battery</h2>

**Recognize the pattern:** a divider reduces battery voltage to an ADC-safe measurement. This example measures a **12 V nominal battery, disconnected from its charger, starter and all inductive loads**, with the measured source bounded to **0–16 V**. Start with a current-limited adjustable supply to check the circuit, then use the isolated battery with a fused sensing lead. Nominal 12 V does not mean the battery always measures exactly 12 V.

Use **68 kΩ above the ADC node**, **12 kΩ from the node to GND**, both 1%, and **100 nF from the node to GND**. Source negative and ECU reference ground join deliberately. The fuse belongs close to battery positive; a battery can deliver dangerous fault current even when the sensing circuit draws very little.

{% include build-figure.html file="voltage" alt="An isolated nominal 12 volt battery feeds a fused sensing lead, 68 kiloohm upper divider resistor and ADC node; a 12 kiloohm lower resistor and 100 nanofarad capacitor return to ground." caption="Bounded to 16 V with no charger or switched loads. This is a measurement exercise, not an automotive/engine-bus transient-protection design." %}

| Source voltage | Nominal ADC-node voltage |
| --- | --- |
| 12.0 V | 1.80 V |
| 14.4 V | 2.16 V |
| 16.0 V maximum for this exercise | 2.40 V |

The hardware ratio is **12 / (68 + 12) = 0.15**. The UI asks for the reciprocal: **Voltage divider ratio = (68 + 12) / 12 = 6.6667**. The card may display **6.67**. Battery volts = measured ADC-pin volts × this ratio. The ADC's measurable range depends on target and attenuation; it is not simply the GPIO's maximum electrical voltage. Check the [Espressif ADC documentation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/adc/index.html) for the selected target and verify the node with a meter before connecting GPIO.

**Configure:** add **Battery voltage**, enter your own name (suggested: **Battery Voltage**), choose **Analog voltage input (ADC)**, and use **GPIO 39**. Enter **6.6667** for **Voltage divider ratio**, leave analog input bias off, and keep the measured-signal validity window consistent with this 0–2.4 V circuit. Save and reopen.

{% include build-screen.html file="battery-configured" step="A configured 12 V battery input" alt="Battery Voltage ADC card on GPIO 39 showing voltage divider ratio 6.67 and ADC-pin validity fields." caption="The displayed ratio belongs to 68 kΩ / 12 kΩ. It converts the voltage at GPIO back to battery volts. It is not a voltage to apply to the pin." %}

**Verify:** compare the source with a trusted meter at two or more known voltages and compare the node with the table. Correct scale using the actual resistor ratio and measured calibration; do not hide a wiring or saturation problem with a multiplier. Disconnect the sensing lead with the circuit safe and inspect the reading/health. A disconnected divider may read zero rather than identify an open wire; this is not a supervised battery sensor.

An enabled ADC input with no sensor or divider attached floats: its value and trend can jump even though the channel appears healthy. Disable unfitted devices in Hardware. If readings fluctuate with the circuit connected, check ground, wiring, supply noise and calibration; do not assume it is normal or conceal it with averaging.

**For a live engine bus:** do not carry this bare divider into starter, alternator, ignition or switched-pump wiring. Load dump, inductive spikes, reverse polarity, ground offset and pin back-power require a properly rated protected measurement front end. Size that interface for maximum voltage and credible faults, not the battery label. Reuse the software steps and verified scale only after checking that interface.

Decide whether this is monitoring only or an enabled low-supply protection. On **Controllers → Shutdown & Protection → Auxiliary Protection → Low supply voltage**, choose the actual threshold, confirmation time and enable state only after measurement is proven. There is no universal low-voltage trip suitable for every battery chemistry and oil/cooling arrangement.

<h2 id="current">Measure current</h2>

**Recognize the pattern:** an analog voltage can represent amps. This exercise uses an **INA180A1** shunt amplifier on a small fused 5 V load, limited to **0–1 A**. Use a 0.1 Ω shunt rated at least 0.5 W, gain 20, 3.3 V amplifier supply and 100 nF local bypass. Nominal output sensitivity is **20 × 0.1 = 2 V/A**, so 1 A gives about 2 V. Actual offset and sensitivity need calibration.

{% include build-figure.html file="current" alt="Supply current passes through a 0.1 ohm shunt to a low-power load; INA180A1 IN plus and IN minus sense the shunt, OUT feeds the current ADC, and the amplifier uses 3.3 V and reference ground." caption="The load current flows through the shunt, not GPIO. Use separate sense connections at the shunt and observe the exact amplifier package pinout." %}

Open **Oil Pump** on **Hardware** and its **Current sensing** subcard. Enable sensing and choose GPIO 39 for the current signal. Enter the sensor's zero voltage and sensitivity at the ECU pin: the nominal sensitivity of this exact bounded circuit is **2000 mV/A**, not the value shown for a different Hall sensor. Save and use the available Calibration wizard to capture zero and a known reference where offered.

{% include build-screen.html file="current-configured" step="The configured current-sensing subcard" alt="Oil Pump Current sensing enabled on GPIO 39 with 2000 mV per amp, zero volts at zero current and overcurrent shutdown zero." caption="This subcard adds the sensor to the existing output; it is not a second assignment of GPIO 39. The overcurrent threshold is disabled in this bounded demonstration. Verify the measured sensitivity and choose real protection separately." %}

When learning, measure a separate benign load through the shunt while the real pump power is disconnected; label this as a demonstration reading. It does not measure or validate the real oil pump until installed in that actual path. You can instead add a **General current** analog channel for a separate instrument, but do not assign the same physical ADC pin twice.

**Verify:** compare with a trusted current meter at zero and a known load. Near-zero offsets and noise are normal measurement considerations. A negative/reversed sense connection or the wrong amplifier gain invalidates the calculation. Decide whether overcurrent protection is enabled; a zero shutdown threshold disables that output's overcurrent trip in the current UI. Do not choose a trip from the dummy load's rating and carry it into a real pump.

The shunt circuit is not isolated and does not size high-power pump/starter conductors or transient protection. A different module can have a 5 V analog output even when its listing says “current sensor”; condition it before GPIO.

<h2 id="automotive-thermistor">Read an automotive thermistor on an ADC</h2>

This example adds coolant or oil temperature monitoring using a two-wire NTC sensor. Confirm the part number, pinout and suitability for the fluid. The worked example uses the resistance table for a [Bosch Motorsport NTC M12-H](https://www.bosch-motorsport.com/media/catalog_content/downloads_catalog/pdf_catalog/data_sheet_70115595_temperature_sensor_ntc_m12-h.pdf).

1. Use a free ADC-capable pin. The example uses **GPIO 39** on the Classic ESP32. Connect **3.3 V → 2.2 kΩ fixed resistor → ADC node → NTC → sensor ground**. Use the ECU's sensor ground as the reference and leave internal GPIO bias off.
2. In **Hardware**, add **Coolant temperature** or **Oil / gearbox temperature** and select **NTC thermistor (ADC divider)**. Choose **Fixed resistor to 3.3 V, NTC to ground** and enter the actual fixed resistor value. For this example it is **2200 Ω**.
3. If your sensor specifies **resistance at 25 °C** and **beta**, enter both in the NTC settings and leave the multipoint curve disabled. Use the 25 °C specification even if the datasheet also lists resistance at 20 °C.
4. If the datasheet gives a resistance table, open **Advanced sensor curve → Use multi-point curve**. Enter up to six **ADC reading** and **Physical value (°C)** pairs, ordered from low to high ADC count. The temperature values fall in this wiring because a hotter NTC has lower resistance.

{% include build-figure.html file="automotive-thermistor" alt="ECU 3.3 V feeds a 2.2 kΩ fixed resistor. Its junction with the NTC goes to the ADC pin. The other thermistor wire returns to ECU sensor ground." caption="Wire the divider as shown, then select the matching orientation on the Hardware card." %}

{% include build-screen.html file="automotive-thermistor-settings" step="Set the sensor interface and wiring" alt="Oil temperature Hardware card with Analog / ADC, NTC thermistor, fixed resistor to 3.3 V, a 2200 ohm divider resistor and GPIO 39." caption="This card uses the six-point resistance table below. Use the beta and 25 °C resistance fields for the beta-only method." %}

For an ideal 12-bit ADC with a 3.3 V full-scale reading, the starting count is **4095 × R_NTC / (2200 Ω + R_NTC)**. For example, the Bosch table gives **243 Ω at 90 °C**, which yields about **407 counts**. Actual ESP32 ADC readings can differ from this ideal scale. Use the ADC counts observed at known temperatures to refine the points, or substitute the corresponding known resistances on the bench and record the counts from the actual input.

| ADC reading (counts, nominal) | Physical value (°C) | Datasheet resistance (Ω) |
| ---: | ---: | ---: |
| 252 | 110 | 144 |
| 407 | 90 | 243 |
| 677 | 70 | 436 |
| 1126 | 50 | 834 |
| 1426 | 40 | 1175 |
| 2178 | 20 | 2500 |

{% include build-screen.html file="automotive-thermistor-curve" step="Enter the six calibration pairs" alt="Expanded Advanced sensor curve with the six ADC readings and their corresponding temperatures, from 252 counts at 110 °C to 2178 counts at 20 °C." caption="Enter your measured counts for the installed board before relying on the displayed temperature." %}

**Verify:** save the channel and compare the Dashboard against a reference thermometer between the saved points, especially around the temperature you expect to monitor. A reading beyond the saved points is an estimate. A 20–50 °C calibration alone can substantially under-read at typical coolant temperatures.

<h2 id="fan">Add temperature and a cooling fan</h2>

**Add temperature:** use a three-wire DS18B20 for an oil/enclosure temperature lesson. It uses a separate OneWire data GPIO and external 4.7 kΩ pull-up. It is not a turbine-gas temperature sensor. Confirm the probe pinout and physical temperature rating.

{% include build-figure.html file="temperature" alt="DS18B20 VDD connects to 3.3 V, GND to reference ground, and DQ to OneWire GPIO with a 4.7 kiloohm pull-up to 3.3 V." caption="This is an externally powered OneWire pattern. It does not use the thermocouple's SPI pins." %}

Add **Oil Temp**, purpose **Oil / gearbox temperature**, with the **DS18B20** interface and actual GPIO. Save. Check a plausible room reading, gentle warming and input health before using it as control feedback.

{% include build-screen.html file="oil-temperature-configured" step="A configured OneWire temperature input" alt="Oil Temp Hardware card with DS18B20 on OneWire GPIO 4 and its resolution setting." caption="This card uses the OneWire pin and external data pull-up, not the SPI or I²C bus. Higher resolution takes longer to update; choose it for the actual measurement." %}

**Add the fan:** use a suitably rated PWM fan driver or on/off interface, reusing the [PWM]({{ '/guided-builds/basic/#outputs' | relative_url }}) or [relay]({{ '/guided-builds/basic/#outputs' | relative_url }}) pattern. Add **Cooling Fan**, purpose **Cooling fan**, with the real driver, pin and safe demand. Keep the output unowned before creating its custom controller. A four-wire fan with a dedicated PWM input has different wiring from a two-wire fan whose supply is switched—follow its documentation.

{% include build-screen.html file="fan-configured" step="A configured fan output" alt="Cooling Fan Hardware card with its output interface on GPIO 21 and advanced output settings." caption="The screenshot describes the example driver. Match the physical fan's interface, PWM requirements and safe behavior before adding the temperature controller." %}

On **Controllers → Output controllers**, expand **+ Create controller**, choose **Cooling Fan**, create it and open its card. Choose method **On / Off with hysteresis**, source **Oil Temp**, and the required above-threshold relationship. The output command values must suit the chosen driver. Choose the events that activate and deactivate it.

For a benign warming exercise, you might demonstrate **on above 30 °C, off again below 28 °C**, using 2 °C hysteresis. These are observation values for the bench probe, not oil/cooling limits for an engine. Hysteresis prevents chatter around one threshold.

**Find the threshold fields:** choose **On / Off with hysteresis** to expose **Controlled by**, **Direction**, **Switch point** and **Hysteresis**. Select **Oil Temp**, then **Turn on above**. Review the on/off commands for the fitted fan driver. For this bench lesson choose **Activate when → Entering Standby** and **Deactivate when → Entering Startup, Entering Running, Entering Shutdown** directly in the open card. Test the next appropriate state entry and save using the same change recap as Build 2.

{% include build-screen.html file="fan-hysteresis" step="Build the fan relationship" alt="Bench cooling fan controller with oil temperature source, Turn on above direction, 30-degree switch point and two-degree hysteresis." caption="The pictured 30 °C/2 °C values match the benign warming exercise. They are not an engine oil-temperature limit. On/off percentages are commands through the selected Hardware driver." %}

**Verify:** raise and lower the measured temperature around both boundaries, then check STANDBY, STARTUP, RUNNING and SHUTDOWN as applicable. Check deactivation, unplugged sensor and FAULT behavior too. Deactivation sends Hardware safe demand before release; custom controllers are also released in FAULT, whose protective output handling remains authoritative. Do not assume cooling continues through a fault. If cooling is essential, design the complete physical and software loss response for that requirement.

<h2 id="switch">Add a cover switch</h2>

Connect a simple maintenance-cover switch with no external voltage between its GPIO and GND. On a pin with internal bias, choose **Pull-up** and active-low in Hardware; this short bench circuit needs no external resistor. Alternatively, wire the contact to 3.3 V and choose **Pull-down** and active-high. Use an external bias resistor where the pin lacks internal bias or the wiring needs stronger conditioning.

{% include build-figure.html file="switch" alt="An ESP32 internal pull-up holds the input high; closing the switch connects the input to ground." caption="Choose Pull-up and active-low for this wiring. Use a switch that supplies no voltage of its own." %}

Add **Cover closed**, purpose **Digital interlock**, driver **On/off switch input**. Use the actual pin and active polarity. For closed-is-active in the shown wiring, select active-low. Verify the displayed input state while opening and closing the switch. Choose whether “active” means cover closed or cover open and name it accordingly; do not rely on the word interlock alone to create an action.

{% include build-screen.html file="cover-configured" step="A configured cover-status switch" alt="Cover closed digital Hardware card on GPIO 4 with active-low polarity and internal Pull-up selected." caption="Use GPIO 4 if it is free. The DS18B20 and second oil-pressure switch examples also use that pin." %}

For the lesson, use it as a visible status/custom-controller source. If the actual purpose is to block startup, review the separate **Inhibit-start switch** role and the current documented DI behavior rather than assuming any generic switch automatically prevents START. Use only one saved assignment for each physical input.

**Verify both states and disconnect a wire.** A simple single-contact circuit may confuse an open wire with one ordinary state; it is not a supervised safety circuit. An ECU-connected emergency-stop input is also not the independent physical stop. Keep that distinction when adapting the switch pattern to other functions.

<h2 id="challenge">Measure shaft torque with two pickups</h2>

**What this measures:** the angular twist between two points on the same torque-carrying shaft. OpenTurbine measures the phase difference between matching conditioned pulse trains, removes the calibrated running zero and converts shaft degrees to Nm. These are two pickups on one shaft, not the N1 and N2 speeds of different shafts. Two RPM values alone cannot supply torque.

{% include build-figure.html file="phase-torque" alt="Two conditioned pickups at separate points on one torque-carrying shaft feed reference and phase GPIO inputs. Matching tooth counts allow shaft twist to be measured." caption="The mechanical shaft span and target wheels establish the measurement. Each conditioner must provide a clean 3.3 V-compatible square wave." %}

**Wire it:** use two conditioned 3.3 V square-wave pickups at mechanically defined points along the shaft. Connect their reference grounds as their conditioners require; reference output goes to one spare input GPIO and phase output to another. This example uses GPIO **16** for the reference and GPIO **17** for the phase signal. Both wheels must produce the same effective pulses per shaft revolution, including gearing. Unmatched, unindexed tooth counts are rejected; a static tooth offset cannot correct them. This interface uses native capture inputs and needs no SPI or I²C bus.

**Configure Hardware:**

1. Choose **Add input → Torque**, open the **Torque** card, then select **Sensor interface → Shaft torsion by phase difference (two pickups)**.
2. In **Reference shaft pickup**, choose **Reference GPIO** and set **Reference pulses per shaft revolution** to the actual target count.
3. In **Torque phase pickup**, choose **Phase GPIO** and set **Torque pickup pulses per shaft revolution** to the matching effective count.
4. Leave **Use reference as shaft speed (optional)** unchecked: N1 and N2 already have their own fitted speed sensors. If you need another speed role in a different installation, confirm it saves without a conflict rather than duplicating a primary shaft assignment.
5. Use a trusted previously measured **Zero-torque phase (shaft degrees)** and **Sensitivity (shaft degrees / Nm)**, or complete the calibration below. A placeholder sensitivity is not a calibrated torque reading. Save and reopen the card.

{% include build-screen.html file="torque-configured" step="A configured phase-torque card" alt="Torque card with reference GPIO 16, phase GPIO 17, matching one-pulse counts and separate zero-phase and sensitivity fields." caption="The screenshot demonstrates a complete conflict-free assignment. Its 0-degree zero and 0.01-degree-per-Nm sensitivity are example values; replace them with the shaft’s calibration. Capture actual rotating zero and known torque before trusting Nm." %}

**Calibrate:** use a suitable rotating test rig with independent torque reference. Open **Calibration → Torque**, spin at verified zero load and select **Capture zero phase**. Keep the shaft rotating, apply known torque, enter **Known torque (Nm)** and select **Capture known torque**. Static alignment is not a running zero. Captures made while RUNNING are staged in that browser tab: stop and choose **Save captured calibration in STANDBY** to apply them. The ECU does not change calibration mid-run.

{% include build-screen.html file="phase-torque-calibration" step="Find the phase-calibration controls" alt="Shaft torsion calibration panel with Capture zero phase, Known torque in Nm and Capture known torque controls." caption="Both captures need fresh pulses from a spinning shaft. The save-pending button appears only when captures were staged in Running; keep that browser tab open until they are saved in Standby." %}

**A working result:** zero-load torque stays near zero at several speeds; known loads produce the expected sign and Nm across the usable range. If calculating shaft power, the selected speed must belong to the same measured torque-carrying shaft; verify it independently. Loss of the phase pickup must invalidate torque; a healthy reference may still provide configured speed telemetry. Loss of the reference invalidates the phase calculation. Keep torque trips and fuel limiting off until the measurement is proven.

<h2 id="thrust">Measure thrust with an I²C load cell</h2>

**What we are adding:** a mechanically mounted thrust load cell and **NAU7802** bridge amplifier. The amplifier reads the small bridge signal and sends data over I²C. Thrust uses force in **newtons**, while torque uses **Nm**. Select a load cell with the required range and mounting arrangement; the wiring does not define the mechanical test stand.

{% include build-figure.html file="thrust-loadcell" alt="ESP32 3.3 V and ground power a compatible NAU7802 module; SDA and SCL connect to shared I2C GPIOs. Load-cell excitation and differential signal connect to the amplifier's E plus, E minus, A plus and A minus terminals." caption="Use the exact module and load-cell terminal labels. Lead colors and breakout pin positions are not universal." %}

**Wire it:** with power removed, connect the bridge excitation to **E+ / E−** and its differential signal to **A+ / A−** on the module. Connect the documented 3.3 V-compatible module supply and reference ground to the ECU. Connect SDA and SCL to separate spare bus GPIOs (GPIO **16 / 17** in this example). Use SDA/SCL pull-ups to 3.3 V appropriate for the bus; many breakouts already include them. Check the module circuit before adding more resistors.

**Activate the bus before adding the sensor:**

1. Open **Hardware → Shared sensor buses → Edit buses** and turn on **Enable shared I2C bus**.
2. Select **SDA GPIO** and **SCL GPIO** to match the wires; start with **100 kHz** bus speed. Save and let the ECU restart.
3. Return to the bus section and confirm **NAU7802** appears as a detected, connected device. The typical address is **0x2A**. If it is missing, check power, SDA/SCL, pull-ups and address before adding an assignment.
4. Choose **Add input → Thrust**, open the card and choose **NAU7802 load cell**. Select the detected device and the bridge channel actually wired. Save. Only a detected chip can receive a new assignment.

{% include build-screen.html file="i2c-configured" step="An enabled and detected I²C bus" alt="I2C bus enabled on SDA GPIO 16 and SCL GPIO 17 at 100 kHz with detected NAU7802." caption="The list shows detected devices. Choose a chip connected to your bus. The thrust module needs to appear connected before its card can be completed." %}

{% include build-screen.html file="thrust-configured" step="A configured thrust channel" alt="Thrust Hardware card using NAU7802 device address 0x2A and its bridge channel, gain and sample-rate fields." caption="Choose the actual connected chip and channel. Gain/sample rate are shared by the two channels of that NAU7802; replace the example scale with your load-cell calibration." %}

**Calibrate:** open **Calibration → Thrust**. With the complete stand unloaded, select **Capture zero**. Apply a known force or mass in the measurement direction, enter **Known load**, and choose the matching **Unit**: for example **N** for force or **kg mass** for mass. Select **Capture known load & save**. Remove the reference load and check the return to zero, then test a second known load. If the sign is wrong, correct the signal polarity or signed calibration as offered by the interface and repeat the check.

{% include build-screen.html file="thrust-calibration" step="Find the thrust-calibration wizard" alt="Thrust calibration card with raw load-cell reading, unloaded-zero capture, known reference and scale-save controls." caption="Choose the reference unit to match what you apply: mass and force are not the same quantity. Capture your own unloaded zero and known-load scale." %}

**A working result:** the dashboard reports near-zero **N** unloaded, the known test forces agree with the reference, and the reading returns to zero after unloading. Disconnect the amplifier with loads made safe and confirm the input becomes unhealthy rather than retaining a believable live force. This addition is measurement only until you deliberately configure another relationship.

**Using both measurements:** the phase pickups and I²C load cell use different interfaces and can coexist with the earlier N1/N2 sensors. The example reserves their pins separately. A fixed-address NAU7802 cannot share one unmodified bus with a second device at the same address; check address compatibility before adding another bridge amplifier.


<h2 id="fuel-shutoff">Set up a fuel shutoff solenoid</h2>

The example uses a valve that closes when de-energized. Check the valve’s rated supply and use a compatible on/off driver. The [relay wiring example]({{ '/guided-builds/basic/#ignition' | relative_url }}) shows the distinction between the GPIO command and the switched load supply.

1. Open **Hardware → Add output**, choose **Fuel Shutoff**, and select the on/off driver and assigned GPIO.
2. Set the command direction to match the driver, then save and reopen the card.
3. With the circuit unpressurized and fuel isolated, verify that the open command opens the valve. Check that STOP and loss of valve power both close it. If the ECU opens the valve during Startup, add its open command before the fuel-metering command. Repeat the dry startup, shutdown, and fault checks with fuel isolated.

{% include build-screen.html file="shutoff-configured" step="Configure the fuel-shutoff command" alt="Fuel Shutoff Hardware card showing its on/off output and direction." caption="Verify which command opens and closes the valve, including loss of power." %}

<h2 id="second-oil-switch">Set up a second oil-pressure switch</h2>

Example: a second oil circuit has its own switch. Give that circuit a separate name and controller.

1. If the pressure switch supplies no voltage of its own, wire it using the [Start/Stop pattern]({{ '/guided-builds/basic/#power' | relative_url }}). Choose **Hardware → Add input → Generic digital input**, enter your own name (suggested: **Oil circuit 2 switch**), select **On/off switch input**, assign its GPIO and set polarity so **ON means pressure fault**. Check both physical states.
2. In **Controllers → + Create controller**, choose **Request Fault Shutdown** and create a controller named **Oil circuit 2**.
3. Select **Controlled by → Oil circuit 2 switch** and **Control method → Switch state**. Choose the request condition **Switch is ON** and a **500 ms confirmation**. The switch supplies an ON/OFF condition, with confirmation set here.
4. Choose **Activate when → Entering Running**; choose **Deactivate when → Entering Shutdown / Entering Standby**. Save and reload.

{% include build-screen.html file="switch-fault-controller" step="A switch condition, not an analogue threshold" alt="Oil circuit 2 controller requesting fault shutdown when its digital switch is on, with confirmation and phase activation." caption="Each circuit can have its own name, input and activation. All switch inputs have fixed 20 ms debounce; controller confirmation is additional." %}

**Check:** a brief contact disturbance shorter than confirmation does not trip, a sustained fault does, and the displayed reason identifies this controller. Test in each chosen phase. An active pressure-fault switch while stopped should not become an unintended Standby fault; monitoring starts at the selected event. Inspect the consequences of a broken wire—simple contacts are not supervised circuits.

<h2 id="handover">Start monitoring at a specific sequence step</h2>

Start with a working [second-circuit switch controller](#second-oil-switch).

Entering a mode is convenient; sometimes a controller should start at an exact point inside Startup. To learn this, edit the optional **Oil circuit 2** controller: select **Activate when → Sequencer block** instead of Entering Running. Keep Shutdown/Standby deactivation. Save and read the sequence-placement notice.

1. Open **Sequence**. The **Controller blocks — needs placement** area contains **Activate Oil circuit 2**.
2. Drag it into Startup after the stage that establishes pressure in the monitored circuit, before fuel admission. **After Build Oil Pressure** is appropriate only if that block supplies this circuit too; an independent circuit needs its own preparation.
3. If you also select **Deactivate when → Sequencer block**, drag its separate Deactivate card to the intended location. An unused card stays in the placement area.
4. To move a placed block to another path, remove it and drag it back from the placement area. Save only after all required blocks are placed; check the editor's explanation if a controller is incomplete.

{% include build-screen.html file="controller-block-placement" step="Drag the required controller card" alt="Pending controller activation card with its controller name and drag-placement instructions." caption="The card identifies which controller needs placement. Its location determines when that controller takes control or begins monitoring." %}

When an output controller is active, conflicting sequence commands for its output are ghosted with a reason. Deactivation sends the Hardware safe demand before releasing ownership; later discrete blocks can then command that output. Fault/STOP handling remains authoritative. A Request Fault Shutdown controller is a virtual action, not ownership of a physical fuel-pump output.

<span id="custom"></span>

<h2 id="light-dimming">Build a light-dimming controller</h2>

**Useful result:** a separate brightness knob adjusts a low-power bench light. Turning the knob from minimum through midpoint to maximum changes the PWM demand from 0% through 50% to 100%. It uses a general-purpose input and output; it does not commandeer fuel, starter or oil hardware.

**Wire the knob:** reuse the [potentiometer pattern]({{ '/guided-builds/basic/#throttle' | relative_url }}) with a second 10 kΩ potentiometer. Its outer terminals go to 3.3 V and GND; the wiper goes to a spare ADC1 input, **GPIO 39** in this example. Choose **Hardware → Add input → Generic analog input**, enter your own name (suggested: **Brightness knob**), and choose **Analog voltage input (ADC)**. Leave internal pull-up/down off. Calibrate the actual endpoints; the example normalized source range is **0–1**. Use **Invert input** if clockwise movement reduces the intended brightness.

{% include build-figure.html file="throttle" alt="Potentiometer outer terminals connect to 3.3 V and ground, and its wiper connects to the separate brightness ADC input." caption="Reuse this potentiometer circuit for a separate brightness knob, not the engine throttle. Replace the generic ADC label with GPIO 39 for this example." %}

{% include build-screen.html file="brightness-configured" step="Configure the brightness input" alt="Brightness knob Hardware card with Generic automation input, Analog ADC, GPIO 39 and no internal input bias." caption="The card reports a normalized 0–1 value. Check real endpoints and smooth movement before creating the controller. These source units are not raw ADC counts." %}

For this generic input, inspect its measured endpoints and the **Minimum valid signal / Maximum valid signal** fields on the Hardware card. Set the electrical range to the verified endpoint readings so the normalized value spans 0–1; test the middle as well. Do not assume the dedicated Throttle calibration wizard edits this separate generic input.

**Wire the light:** reuse the [PWM-driver pattern]({{ '/guided-builds/basic/#fuel' | relative_url }}) with a documented 3.3 V-compatible MOSFET driver and separately supplied low-power dimmable LED module or suitable small lamp. Use the lamp/module's specified current limiting—do not connect a bare LED directly to a power supply or GPIO. This is low-voltage DC only, not a mains dimmer.

{% include build-figure.html file="pwm" alt="A GPIO PWM command feeds a power driver; the separately fused low-power light is powered through the driver rather than GPIO." caption="Here the dummy load is the bench light. Match driver polarity and PWM compatibility to the actual light." %}

Choose **Hardware → Add output → PWM output**, enter your own name (suggested: **Bench light**), choose **PWM** and the spare output **GPIO 21**. This example uses **1000 Hz**, **10 bits**, normal direction and 0–100% electrical duty endpoints. Set **Power-on demand** to 0%. Verify physical off at logical zero before permitting the controller to own it.

{% include build-screen.html file="light-configured" step="Configure the light output" alt="Bench light Hardware card with PWM on GPIO 21, normal direction, 0–100 percent duty, 1000 Hz, 10 bits and zero power-on demand." caption="Choose frequency and polarity that the actual driver accepts. The initialized output is off; verify reset behavior separately because firmware cannot guarantee GPIO state before it gains control." %}

**A · Create the controller.** Open **Controllers → Output controllers → + Create controller**. Choose **Bench light** in **What do you want to control?**, then select **Create controller**. An absent output may be unfitted, incompatible or already owned; resolve that instead of duplicating it.

{% include build-screen.html file="controller-create" step="A · Choose the light" alt="Create controller panel with Bench light selected." caption="Only the bench light is selected. The dedicated oil loop remains a separate owner of Oil Pump." %}

**B · Open its card.** A new generic controller starts with **Fixed output** and zero command. Change the method to **Map input to output** before looking for the source and range fields.

{% include build-screen.html file="controller-new" step="B · Recognize the starting method" alt="New Bench light controller starting with Fixed output and zero command." caption="Creating a controller does not automatically connect it to the brightness knob." %}

**C · Configure the complete mapping:**

| Field | This bench example |
| --- | --- |
| Controller name | Brightness control |
| Controlled output | Bench light |
| Control method | Map input to output |
| Controlled by | Brightness knob |
| Input low / Input high | 0 / 1, after verified endpoint calibration |
| Output low / Output high | 0% / 100% |
| Active when | Entering Standby |
| Deactivate when | Entering Startup, Entering Running, Entering Shutdown |

{% include build-screen.html file="controller-mapping" step="C · The configured dimmer" alt="Brightness control controller mapping Brightness knob from 0 to 1 onto Bench light from 0 to 100 percent." caption="Input range uses the source's normalized units; output range uses percent demand. Half input produces half duty, although perceived LED brightness is not necessarily linear." %}

**D · Choose activation and deactivation.** The open controller card directly shows both sets of choices. Select **Entering Standby** under **Active when**; select **Entering Startup**, **Entering Running** and **Entering Shutdown** under **Deactivate when**. Clear the default Running activation. State entries are events, not continuous mode checkboxes: the light follows the knob after its selected entry until a selected stop event. Test the next appropriate state entry; saving while already in Standby does not invent that entry.

{% include build-screen.html file="controller-states" step="D · Standby-entry activation" alt="Bench-light controller configured to activate on entering Standby and stop on entering Startup, Running or Shutdown." caption="Deactivation commands the output's Hardware safe demand before releasing ownership. Faults also release custom control. Keep this example on an isolated non-engine bench light." %}

**E · Save and reopen.** Select **Save to device**, resolve any validation errors and review warnings rather than using Save anyway to get past them. Confirm the change recap, save, then reopen the card and compare output, source, range and states.

{% include build-screen.html file="controller-save" step="E · Review before saving" alt="Save recap for the brightness-knob bench-light controller." caption="The pictured recap records a controller-name change. Your new-controller recap will include the actual fields you changed; check those before confirming." %}

**Verify:** low knob gives a physically off light, midpoint gives about 50% duty, and high gives full permitted duty. Check clamping beyond calibrated endpoints, smooth movement, direction, mode exit, input loss and reboot behavior. Confirm the light's power-on state and that no controller accidentally claims an engine output. A failed potentiometer may leave a plausible ADC voltage; an unsupervised knob is not a safety input.

**Adapt the lesson:** an external noncritical fan can use the same mapping, but use its own driver and permitted PWM frequency. A fan may need a nonzero minimum reliable command and separate start behavior; do not assume the light's 0–100% duty range will start or safely stop every fan. Feedback regulation is a different method: **Hold a feedback target** needs a verified measured result and failure response.
