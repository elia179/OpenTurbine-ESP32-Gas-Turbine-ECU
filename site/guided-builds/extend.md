---
layout: document
title: Level 3 Extend your OpenTurbine system
description: Extend an OpenTurbine system with N2, voltage, current, cooling, shaft-torsion torque and I2C load-cell thrust measurement, with wiring and calibration steps.
lede: Extend the same system with useful measurements and verify each addition from wiring to calibrated reading.
permalink: /guided-builds/extend/
build_level: 3
---

{% include guided-nav.html %}

## Your starting point

Keep the Level 1 channels and the Level 2 pressure, oil-pump, shutoff and demonstration output. You should know how to add Hardware, calibrate a measurement, identify normal ownership and verify a transition. If entering directly, check [Level 2's final tests]({{ '/guided-builds/control/#verify' | relative_url }}). Save a backup before expanding.

N2 introduces a second physical shaft. Voltage, current, a cover switch and a cooling fan demonstrate optional instrumentation and auxiliaries. Optional does not mean every item is harmless in every engine: a real free turbine needs appropriate N2 protection, and an engine depending on active cooling needs an independently considered cooling-failure response.


{% include build-figure.html file="level-3" alt="Level 3 keeps earlier channels and adds N2, auxiliary measurements, shaft torque, I2C thrust and a fan." caption="The system grows through familiar interfaces. Torque and thrust are separate measurements; each needs its own calibration. New software relationships still need explicit ownership and failure behavior." %}

<h2 id="n2">1 · Add a second shaft</h2>

**Recognize the pattern:** N2 is another pulse measurement, electrically like [N1]({{ '/guided-builds/basic/#n1' | relative_url }}). Reuse that wiring pattern with an independent conditioned input. The actual sensor needs the bandwidth, mounting and environmental rating for this shaft.

The same [internal/external pull-up choice]({{ '/guided-builds/basic/#n1' | relative_url }}) applies: a compatible open-drain pickup can use **N2 Speed → Input bias → Pull-up** on a suitable GPIO. Verify pulse edges at the real rate; do not enable Pull-down as well.

{% include build-figure.html file="rpm" alt="The same Hall/open-drain wiring pattern used for N1 now goes to a separate N2 GPIO with its own pull-up." caption="For this step, replace the diagram's generic pulse GPIO with the selected N2 connection. N1 remains connected to its original input." %}

Add **N2 Speed**, purpose **N2 speed**, with the actual pulse interface, GPIO and PPR. N1 is the gas generator; N2 is a separate power turbine in this example. Two pickups measuring the same shaft do not make it a two-shaft engine. Verify N2 against an independent reference before relying on it.

{% include build-screen.html file="n2-configured" step="A configured N2 input" alt="N2 Speed Hardware card using a separate pulse input on GPIO 40 with its own pulses-per-revolution field." caption="N2 has a separate pin, shaft identity and target count. Set the actual PPR and N2 protection, not a copied N1 limit." %}

**Configure protection:** use the actual N2 hard limit and appropriate governor/limiting margins. N1 and N2 can have very different speeds and target-wheel counts. Check startup/run applicability and input-loss behavior. A real power turbine's overspeed response is important even if the other instrumentation in this level is optional.

**Verify:** exercise N1 and N2 independently. Changing the N2 test signal should not change the displayed N1 measurement. Check missing N2, implausible pulses and the configured N2 trip with hazardous power isolated. Record which output action occurs and how recovery works.

<h2 id="governor">2 · Choose the feedback relationship</h2>

On Controllers, review the fitted power-turbine governor and select the supported actuator relationship appropriate to the installation. A governor using main fuel and a governor using propeller pitch are different arrangements; adding N2 does not automatically choose between them.

For this teaching topology, inspect a main-fuel governor relationship without adding a physical propeller system. The requested N2 target is compared with N2 feedback, but N1, temperature and the configured fuel limits remain relevant. Do not add a second custom feedback controller that competes for the same fuel output. Review the existing dedicated controller's supported handover and authority instead.

**Check before enabling:** target and feedback units, correction direction, output authority, mode applicability, sensor-loss response, N1/N2 hard limits and sequence handover. Test configuration and simulated transitions with hazardous loads disconnected. Stable real two-shaft control requires a suitable restrained physical test and engine-specific tuning; the simulator cannot demonstrate it.

**Transfer the pattern:** a feedback target, a measurement and one compatible owned output form the same relationship you learned with oil pressure. The new difficulty is how that loop interacts with other constraints, not a completely new Hardware page.

<h2 id="voltage">3 · Measure a 12 V battery</h2>

**Recognize the pattern:** a divider reduces battery voltage to an ADC-safe measurement. This example measures a **12 V nominal battery, disconnected from its charger, starter and all inductive loads**, with the measured source bounded to **0–16 V**. Start with a current-limited adjustable supply to check the circuit, then use the isolated battery with a fused sensing lead. Nominal 12 V does not mean the battery always measures exactly 12 V.

Use **68 kΩ above the ADC node**, **12 kΩ from the node to GND**, both 1%, and **100 nF from the node to GND**. Source negative and ECU reference ground join deliberately. The fuse belongs close to battery positive; a battery can deliver dangerous fault current even when the sensing circuit draws very little.

{% include build-figure.html file="voltage" alt="An isolated nominal 12 volt battery feeds a fused sensing lead, 68 kiloohm upper divider resistor and ADC node; a 12 kiloohm lower resistor and 100 nanofarad capacitor return to ground." caption="Bounded to 16 V with no charger or switched loads. This is a measurement exercise, not an automotive/engine-bus transient-protection design." %}

| Source voltage | Nominal ADC-node voltage |
| --- | --- |
| 12.0 V | 1.80 V |
| 14.4 V | 2.16 V |
| 16.0 V maximum for this exercise | 2.40 V |

The hardware ratio is **12 / (68 + 12) = 0.15**. The UI asks for the reciprocal: **Voltage divider ratio = (68 + 12) / 12 = 6.6667**. The card may display **6.67**. Battery volts = measured ADC-pin volts × this ratio. The ADC's measurable range depends on target and attenuation; it is not simply the GPIO's maximum electrical voltage. Check the [Espressif ADC documentation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc/index.html) for the selected target and verify the node with a meter before connecting GPIO.

**Configure:** add **Battery / bus voltage**, name it **Battery Voltage**, choose **Analog / ADC**, and use **GPIO 4** in the cumulative S3 plan. Enter **6.6667** for **Voltage divider ratio**, leave analog input bias off, and keep the measured-signal validity window consistent with this 0–2.4 V circuit. Save and reopen.

{% include build-screen.html file="battery-configured" step="A configured 12 V battery input" alt="Battery Voltage ADC card on GPIO 4 showing voltage divider ratio 6.67 and ADC-pin validity fields." caption="The displayed ratio belongs to 68 kΩ / 12 kΩ. It converts the voltage at GPIO back to battery volts. It is not a voltage to apply to the pin." %}

**Verify:** compare the source with a trusted meter at two or more known voltages and compare the node with the table. Correct scale using the actual resistor ratio and measured calibration; do not hide a wiring or saturation problem with a multiplier. Disconnect the sensing lead with the circuit safe and inspect the reading/health. A disconnected divider may read zero rather than identify an open wire; this is not a supervised battery sensor.

An enabled ADC input with no sensor or divider attached floats: its value and trend can jump even though the channel appears healthy. Disable unfitted devices in Hardware. If readings fluctuate with the circuit connected, check ground, wiring, supply noise and calibration; do not assume it is normal or conceal it with averaging.

**For a live engine bus:** do not carry this bare divider into starter, alternator, ignition or switched-pump wiring. Load dump, inductive spikes, reverse polarity, ground offset and pin back-power require a properly rated protected measurement front end. Size that interface for maximum voltage and credible faults, not the battery label. Reuse the software steps and verified scale only after checking that interface.

Decide whether this is monitoring only or an enabled low-supply protection. On **Controllers → Shutdown & Protection → Auxiliary Protection → Low supply voltage**, choose the actual threshold, confirmation time and enable state only after measurement is proven. There is no universal low-voltage trip suitable for every battery chemistry and oil/cooling arrangement.

<h2 id="current">4 · Measure current</h2>

**Recognize the pattern:** an analog voltage can represent amps. This exercise uses an **INA180A1** shunt amplifier on a small fused 5 V load, limited to **0–1 A**. Use a 0.1 Ω shunt rated at least 0.5 W, gain 20, 3.3 V amplifier supply and 100 nF local bypass. Nominal output sensitivity is **20 × 0.1 = 2 V/A**, so 1 A gives about 2 V. Actual offset and sensitivity need calibration.

{% include build-figure.html file="current" alt="Supply current passes through a 0.1 ohm shunt to a low-power load; INA180A1 IN plus and IN minus sense the shunt, OUT feeds the current ADC, and the amplifier uses 3.3 V and reference ground." caption="The load current flows through the shunt, not GPIO. Use separate sense connections at the shunt and observe the exact amplifier package pinout." %}

For the cumulative example, open **Oil Pump** on **Hardware** and its **Current sensing** subcard. Enable sensing and choose the separate current ADC pin. Enter the sensor's zero voltage and sensitivity at the ECU pin: the nominal sensitivity of this exact bounded circuit is **2000 mV/A**, not the value shown for a different Hall sensor. Save and use the available Calibration wizard to capture zero and a known reference where offered.

{% include build-screen.html file="current-configured" step="The configured current-sensing subcard" alt="Oil Pump Current sensing enabled on GPIO 5 with 2000 mV per amp, zero volts at zero current and overcurrent shutdown zero." caption="This subcard adds the sensor to the existing output; it is not a second assignment of GPIO 5. Zero overcurrent threshold means that trip is disabled in this example. Verify the measured sensitivity and choose real protection separately." %}

When learning, measure a separate benign load through the shunt while the real pump power is disconnected; label this as a demonstration reading. It does not measure or validate the real oil pump until installed in that actual path. You can instead add a **General current** analog channel for a separate instrument, but do not assign the same physical ADC pin twice.

**Verify:** compare with a trusted current meter at zero and a known load. Near-zero offsets and noise are normal measurement considerations. A negative/reversed sense connection or the wrong amplifier gain invalidates the calculation. Decide whether overcurrent protection is enabled; a zero shutdown threshold disables that output's overcurrent trip in the current UI. Do not choose a trip from the dummy load's rating and carry it into a real pump.

The shunt circuit is not isolated and does not size high-power pump/starter conductors or transient protection. A different module can have a 5 V analog output even when its listing says “current sensor”; condition it before GPIO.

<h2 id="fan">5 · Add temperature and a cooling fan</h2>

**Add temperature:** use a three-wire DS18B20 for an oil/enclosure temperature lesson. It uses a separate OneWire data GPIO and external 4.7 kΩ pull-up. It is not a turbine-gas temperature sensor. Confirm the probe pinout and physical temperature rating.

{% include build-figure.html file="temperature" alt="DS18B20 VDD connects to 3.3 V, GND to reference ground, and DQ to OneWire GPIO with a 4.7 kiloohm pull-up to 3.3 V." caption="This is an externally powered OneWire pattern. It does not use the thermocouple's SPI pins." %}

Add **Oil Temp**, purpose **Oil / gearbox temperature**, with the **DS18B20** interface and actual GPIO. Save. Check a plausible room reading, gentle warming and input health before using it as control feedback.

{% include build-screen.html file="oil-temperature-configured" step="A configured OneWire temperature input" alt="Oil Temp Hardware card with DS18B20 on OneWire GPIO 7 and its resolution setting." caption="This card uses the OneWire pin and external data pull-up, not the SPI or I²C bus. Higher resolution takes longer to update; choose it for the actual measurement." %}

**Add the fan:** use a suitably rated PWM fan driver or on/off interface, reusing the [PWM]({{ '/guided-builds/basic/#fuel' | relative_url }}) or [relay]({{ '/guided-builds/basic/#ignition' | relative_url }}) pattern. Add **Cooling Fan**, purpose **Cooling fan**, with the real driver, pin and safe demand. Keep the output unowned before creating its custom controller. A four-wire fan with a dedicated PWM input has different wiring from a two-wire fan whose supply is switched—follow its documentation.

{% include build-screen.html file="fan-configured" step="A configured fan output" alt="Cooling Fan Hardware card with its output interface on GPIO 39 and advanced output settings." caption="The screenshot describes the example driver. Match the physical fan's interface, PWM requirements and safe behavior before adding the temperature controller." %}

On **Controllers → Output controllers**, expand **+ Create controller**, choose **Cooling Fan**, create it and open its card. Choose method **On / Off with hysteresis**, source **Oil Temp**, and the required above-threshold relationship. The output command values must suit the chosen driver. Select only the operating states in which this controller should own the fan.

For a benign warming exercise, you might demonstrate **on above 30 °C, off again below 28 °C**, using 2 °C hysteresis. These are observation values for the bench probe, not oil/cooling limits for an engine. Hysteresis prevents chatter around one threshold.

**Find the threshold fields:** choose **On / Off with hysteresis** to expose **Controlled by**, **Direction**, **Switch point** and **Hysteresis**. Select **Oil Temp**, then **Turn on above**. Review the on/off commands for the fitted fan driver. Expand **When this controller is active** and deliberately choose the states for the bench lesson; save using the same change recap as Level 2.

{% include build-screen.html file="fan-hysteresis" step="Build the fan relationship" alt="Bench cooling fan controller with oil temperature source, Turn on above direction, 30-degree switch point and two-degree hysteresis." caption="The pictured 30 °C/2 °C values match the benign warming exercise. They are not an engine oil-temperature limit. On/off percentages are commands through the selected Hardware driver." %}

**Verify:** raise and lower the measured temperature around both boundaries, then check STANDBY, STARTUP, RUNNING and SHUTDOWN as applicable. Check mode exit, unplugged sensor and FAULT behavior too. Custom controllers are released in FAULT; the output then follows the relevant fault/ordinary behavior. Do not assume cooling continues through a fault. If cooling is essential, design the complete physical and software loss response for that requirement.

<h2 id="switch">6 · Add a cover switch</h2>

**Recognize the pattern:** a dry contact becomes a digital state. Connect a maintenance-cover switch between its GPIO and GND. On a pin with internal bias, choose **Pull-up** and active-low in Hardware; this short bench circuit needs no external resistor. Alternatively, wire the contact to 3.3 V and choose **Pull-down** and active-high. Use an external bias resistor where the pin lacks internal bias or the wiring needs stronger conditioning.

{% include build-figure.html file="switch" alt="An ESP32 internal pull-up holds the input high; closing the dry contact connects the input to ground." caption="Choose Pull-up and active-low for this wiring. A dry contact supplies no external voltage." %}

Add **Cover closed**, purpose **Digital interlock**, driver **On/off switch input**. Use the actual pin and active polarity. For closed-is-active in the shown wiring, select active-low. Verify the displayed input state while opening and closing the switch. Choose whether “active” means cover closed or cover open and name it accordingly; do not rely on the word interlock alone to create an action.

{% include build-screen.html file="cover-configured" step="A configured cover-status switch" alt="Cover closed digital Hardware card on GPIO 35 with active-low polarity and internal Pull-up selected." caption="GPIO 35 is reserved for this switch on the specified no-PSRAM S3 teaching board. The earlier GPIO 8 now belongs to the brightness knob. Check your board before copying either pin." %}

For the lesson, use it as a visible status/custom-controller source. If the actual purpose is to block startup, review the separate **Inhibit-start switch** role and the current documented DI behavior rather than assuming any generic switch automatically prevents START. Use only one saved assignment for each physical input.

**Verify both states and disconnect a wire.** A simple single-contact circuit may confuse an open wire with one ordinary state; it is not a supervised safety circuit. An ECU-connected emergency-stop input is also not the independent physical stop. Keep that distinction when adapting the switch pattern to other functions.

<h2 id="challenge">7 · Measure shaft torque with two pickups</h2>

**What this measures:** the angular twist between two points on the same torque-carrying shaft. OpenTurbine measures the phase difference between matching conditioned pulse trains, removes the calibrated running zero and converts shaft degrees to Nm. These are two pickups on one shaft, not the N1 and N2 speeds of different shafts. Two RPM values alone cannot supply torque.

{% include build-figure.html file="phase-torque" alt="Two conditioned pickups at separate points on one torque-carrying shaft feed reference and phase GPIO inputs. Matching tooth counts allow shaft twist to be measured." caption="The mechanical shaft span and target wheels establish the measurement. Each conditioner must provide a clean 3.3 V-compatible square wave." %}

**Wire it:** use two conditioned 3.3 V square-wave pickups at mechanically defined points along the shaft. Connect their reference grounds as their conditioners require; reference output goes to one spare input GPIO and phase output to another. The cumulative S3 example reserves GPIO **41** and **42**. Both wheels must produce the same effective pulses per shaft revolution, including gearing. Unmatched, unindexed tooth counts are rejected; a static tooth offset cannot correct them. This interface uses native capture inputs and needs no SPI or I²C bus.

**Configure Hardware:**

1. Choose **Add input → Torque**, open the **Torque** card, then select **Sensor interface → Shaft torsion by phase difference (two pickups)**.
2. In **Reference shaft pickup**, choose **Reference GPIO** and set **Reference pulses per shaft revolution** to the actual target count.
3. In **Torque phase pickup**, choose **Phase GPIO** and set **Torque pickup pulses per shaft revolution** to the matching effective count.
4. In this cumulative example leave **Use reference as shaft speed (optional)** unchecked: N1 and N2 already have their own fitted speed sensors. If you need another speed role in a different installation, confirm it saves without a conflict rather than duplicating a primary shaft assignment.
5. Use a trusted previously measured **Zero-torque phase (shaft degrees)** and **Sensitivity (shaft degrees / Nm)**, or complete the calibration below. A placeholder sensitivity is not a calibrated torque reading. Save and reopen the card.

{% include build-screen.html file="torque-configured" step="A configured phase-torque card" alt="Torque card with reference GPIO 41, phase GPIO 42, matching one-pulse counts and separate zero-phase and sensitivity fields." caption="The screenshot demonstrates a complete conflict-free assignment. Its 0-degree zero and 0.01-degree-per-Nm sensitivity are simulator fixture values, not shaft calibration. Capture actual rotating zero and known torque before trusting Nm." %}

**Calibrate:** use a suitable rotating test rig with independent torque reference. Open **Calibration → Torque**, spin at verified zero load and select **Capture zero phase**. Keep the shaft rotating, apply known torque, enter **Known torque (Nm)** and select **Capture known torque**. Static alignment is not a running zero. Captures made while RUNNING are staged in that browser tab: stop and choose **Save captured calibration in STANDBY** to apply them. The ECU does not change calibration mid-run.

{% include build-screen.html file="phase-torque-calibration" step="Find the phase-calibration controls" alt="Shaft torsion calibration panel with Capture zero phase, Known torque in Nm and Capture known torque controls." caption="Both captures need fresh pulses from a spinning shaft. The save-pending button appears only when captures were staged in Running; keep that browser tab open until they are saved in Standby." %}

**A working result:** zero-load torque stays near zero at several speeds; known loads produce the expected sign and Nm across the usable range. If calculating shaft power, the selected speed must belong to the same measured torque-carrying shaft; verify it independently. Loss of the phase pickup must invalidate torque; a healthy reference may still provide configured speed telemetry. Loss of the reference invalidates the phase calculation. Keep torque trips and fuel limiting off until the measurement is proven.

<h2 id="thrust">8 · Measure thrust with an I²C load cell</h2>

**What we are adding:** a mechanically mounted thrust load cell and **NAU7802** bridge amplifier. The amplifier reads the small bridge signal and sends data over I²C. Thrust uses force in **newtons**, while torque uses **Nm**. Select a load cell with the required range and mounting arrangement; the wiring does not define the mechanical test stand.

{% include build-figure.html file="thrust-loadcell" alt="ESP32 3.3 V and ground power a compatible NAU7802 module; SDA and SCL connect to shared I2C GPIOs. Load-cell excitation and differential signal connect to the amplifier's E plus, E minus, A plus and A minus terminals." caption="Use the exact module and load-cell terminal labels. Lead colors and breakout pin positions are not universal." %}

**Wire it:** with power removed, connect the bridge excitation to **E+ / E−** and its differential signal to **A+ / A−** on the module. Connect the documented 3.3 V-compatible module supply and reference ground to the ECU. Connect SDA and SCL to separate spare bus GPIOs (GPIO **11 / 47** in the cumulative S3 plan). Use SDA/SCL pull-ups to 3.3 V appropriate for the bus; many breakouts already include them. Check the module circuit before adding more resistors. The dry-contact internal-bias lesson does not replace I²C bus pull-ups.

**Activate the bus before adding the sensor:**

1. Open **Hardware → Shared sensor buses → Edit buses** and turn on **Enable shared I2C bus**.
2. Select **SDA GPIO** and **SCL GPIO** to match the wires; start with **100 kHz** bus speed. Save and let the ECU restart.
3. Return to the bus section and confirm **NAU7802** appears as a detected, connected device. The typical address is **0x2A**. If it is missing, check power, SDA/SCL, pull-ups and address before adding an assignment.
4. Choose **Add input → Thrust**, open the card and choose **NAU7802 load cell**. Select the detected device and the bridge channel actually wired. Save. Only a detected chip can receive a new assignment.

{% include build-screen.html file="i2c-configured" step="An enabled and detected I²C bus" alt="I2C bus enabled on SDA GPIO 11 and SCL GPIO 47 at 100 kHz with detected NAU7802." caption="The simulator lists supported devices to demonstrate discovery. Only assign chips physically present on your bus. The thrust module needs to appear connected before its card can be completed." %}

{% include build-screen.html file="thrust-configured" step="A configured thrust channel" alt="Thrust Hardware card using NAU7802 device address 0x2A and its bridge channel, gain and sample-rate fields." caption="Choose the actual connected chip and channel. Gain/sample rate are shared by the two channels of that NAU7802; the displayed scale is a simulator fixture, not load-cell calibration." %}

**Calibrate:** open **Calibration → Thrust**. With the complete stand unloaded, select **Capture zero**. Apply a known force or mass in the measurement direction, enter **Known load**, and choose the matching **Unit**: for example **N** for force or **kg mass** for mass. Select **Capture known load & save**. Remove the reference load and check the return to zero, then test a second known load. If the sign is wrong, correct the signal polarity or signed calibration as offered by the interface and repeat the check.

{% include build-screen.html file="thrust-calibration" step="Find the thrust-calibration wizard" alt="Thrust calibration card with raw load-cell reading, unloaded-zero capture, known reference and scale-save controls." caption="Choose the reference unit to match what you apply: mass and force are not the same quantity. The displayed fixture values are not a measured zero or scale." %}

**A working result:** the dashboard reports near-zero **N** unloaded, the known test forces agree with the reference, and the reading returns to zero after unloading. Disconnect the amplifier with loads made safe and confirm the input becomes unhealthy rather than retaining a believable live force. This addition is measurement only until you deliberately configure another relationship.

**Using both measurements:** the phase pickups and I²C load cell use different interfaces and can coexist with the earlier N1/N2 sensors. The example reserves their pins separately. A fixed-address NAU7802 cannot share one unmodified bus with a second device at the same address; check address compatibility before adding another bridge amplifier.

<h2 id="finish">9 · Review the complete system</h2>


By now, the installation contains familiar patterns:

| Addition | Pattern reused | New decision |
| --- | --- | --- |
| N2 | N1 pulse input | Separate shaft identity, PPR, governor and hard limit |
| Bus voltage | Analog pressure/throttle input | Divider, protection, scale and warning/trip intent |
| Current | Analog engineering measurement | Shunt/amplifier path, zero, sensitivity and trip intent |
| Cooling fan | Relay/PWM output plus custom controller | Hysteresis, modes and loss/fault cooling behavior |
| Cover switch | Digital input | Active meaning, intended action and broken-wire ambiguity |
| Shaft torque | Two conditioned pulse inputs | Matching tooth counts, running zero, signed shaft sensitivity and optional shaft speed |
| Thrust | I²C bridge amplifier | Bus activation, detected device, mechanical zero and force calibration |

Check the complete inventory, identify every channel by its displayed name and make an ownership table. Exercise each input, output, normal relationship, mode transition and failure path with hazardous energy isolated. Verify the independent physical stop again. Save and label the engine-file backup, and distinguish physical tests from simulated ones in your notes.

**For the next device:** identify the physical signal → check electrical limits → plan a conflict-free connection → add Hardware → calibrate → choose the controller/sequence/protection relationship → test normal and failed states → back up. That is the method these guides are meant to teach.

You do not need a tutorial for every new sensor. Use the [Hardware reference]({{ '/hardware/' | relative_url }}) and [User Guide]({{ '/user-guide/' | relative_url }}) for device-specific details, while keeping that method.

<p class="document-nav"><a href="{{ '/guided-builds/' | relative_url }}">Choose a level</a><a href="{{ '/guided-builds/control/' | relative_url }}">Review control and protection</a><a href="{{ '/user-guide/' | relative_url }}">Continue with the reference</a></p>
