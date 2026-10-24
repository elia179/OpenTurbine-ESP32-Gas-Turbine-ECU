# Three-build learning guide redesign

Planning draft, 24 October 2026. This is a proposal and a desk walkthrough, not a published guide or a completed beginner usability test. The released firmware and public documentation have not been changed for this proposal.

## Purpose and agreed example

Teach a new reader how to configure OpenTurbine by developing the same installation through three builds. Preserve detailed, explicit instructions, but give each build one main result and one configuration path. Move alternative methods and specialist explanations to the appropriate later build or linked reference.

The example is a homemade, HX80-sized liquid-fuel turbine. All commands come from the ECU: electric starter, fuel pump, spark ignition, electric oil delivery and fitted shutoff hardware. Build 1 uses the gas generator as a turbojet. Build 3 adds a separate free power turbine. This is a general development-board guide, not a particular PCB installation.

User-provided operating anchors:

| Quantity | Example operating value | Meaning |
| --- | --- | --- |
| N1 at normal full power | About 60,000 RPM | Gas-generator shaft speed; not an overspeed-trip setting |
| Combustor pressure | About 3–4 bar | Pressure at the identified combustor tap; explicitly specify gauge/absolute convention before drafting numeric calibration |
| Oil supply pressure | About 4–5 bar | At the identified supply measurement point; not the low-pressure trip |
| Fuel delivery pressure | Not supplied | Separate from oil and combustor pressures |

Use 3.5 bar combustor pressure and 4.5 bar oil pressure as nominal illustrative readings within those ranges. Do not infer fuel-pump duty, idle RPM, ignition speed, starter release, temperature limits, trip margins or N2 speed from these anchors. Distinguish N1 and N2 and show the exact temperature-probe location, especially after adding the power turbine.

## Review findings

- Current source counts: basic approximately 6,754 whitespace-separated words, 31 screenshot includes and 9 diagram includes; control 3,368 words; extend 4,320 words. Counts include markup/captions and exclude rendered wiring tables.
- Basic contains all idle alternatives, response tuning, migration behavior, display-reference details, conceptual startup and a separate timer-only dummy-load sequence. It changes the main-fuel controller from a throttle mapping to fixed zero during the lesson.
- Essential oil delivery and shutoff hardware appear as Level 2 additions even though the proposed engine needs them in the basic installation.
- Current screenshot fixtures deliberately use signal-generator numbers such as 600 RPM idle, 800 RPM cutoff, 1,000 RPM maximum and a 60 °C temperature limit. Disclaimers explain them, but they make a poor engine example.
- Basic still refers to Primary Engine Temperature and says other sensor scales are only display preferences. The current UI labels/pressure-limit integration need to be reflected accurately.
- The pressure-calibration text says later stages can operate a pump without clearly choosing the manual reference method versus optional pump assistance.
- Full-page 1600-pixel screenshots become small in the reading column and contain unrelated UI and footer overlays. Focused screenshots are clearer, but must show enough context to locate the card.
- Existing website audits check structure, images and layout. They cannot establish that a beginner can reproduce a complete configuration or that the example's numbers are coherent.

## Proposed learning progression

### Build 1: Configure the basic turbojet

Outcome: a complete, understandable single-shaft ECU configuration, calibrated channels, a reviewed startup/shutdown path and verified dry behavior. No N2 or optional instrument project is required.

1. **Identify the system.** One engine diagram, a small vocabulary panel (N1, TOT, GPIO, input, driver), a minimal parts list and a signal/connection table. Put the engine worksheet and normal readings here. Identify independent energy removal once and add specific precautions only at the relevant actions.
2. **Connect the ECU and controls.** Install/open the UI, identify the board, back up an existing file, adapt/remove example channels, assign Start/Stop and save. Explain what is allowed to be connected during each test.
3. **Add and prove the inputs.** N1, exhaust temperature, throttle and oil pressure. Give a short exact recipe and expected reading for each. Put SPI setup before the thermocouple. Explain ADC-pin voltage versus sensor voltage beside the pressure wiring. Calibrate before assigning protection.
4. **Add and prove the outputs.** Starter ESC, fuel-pump driver, spark command, oil pump and shutoff. Teach pulse, PWM and on/off interfaces at the point of use. Check polarity, zero command and test expiry. Use one Tools procedure, with short device-specific checks.
5. **Set normal fuel and oil control.** One named Main Fuel controller and one supported oil-controller arrangement using a simple fixed pressure target. Explain minimum reliable pump command versus engine idle in two sentences. Use measured fuel mapping/idle figures from the worksheet. Detailed oil-loop tuning and alternative idle methods belong in Build 2; Build 1 still needs a verified working oil arrangement.
6. **Set the essential protections.** N1 overspeed, normal temperature shutdown and oil-pressure supervision appropriate to startup/running. Explain when oil monitoring begins and when oil pressure must already be established. Separate normal readings, limits, enable toggles and confirmation times. Include a brief link from Dashboard bars to their retained limit settings.
7. **Assemble startup and shutdown.** One ordered, annotated sequence for this example: establish lubrication, crank, enable ignition/admit fuel, confirm light-off, confirm acceleration, release starter/ignition and hand over to Running. Every wait has a defined condition and finite timeout. Show the actual supported blocks, side actions and final-state preview. Show shutdown fuel isolation and required oil/cooling continuation until safe. Verify actual engine behavior before fixing numerical thresholds.
8. **Prove and save it.** Short dry acceptance checklist covering normal transition, unsatisfied condition, STOP, sensor loss, handover and saved configuration. Download and label a backup. Explain what has been demonstrated and what still requires actual engine commissioning.

Keep the engine configuration consistent while testing. Describe isolated loads/test signals as a test arrangement, rather than replacing the real sequence with another operating recipe. If a separate synthetic exercise is useful, make it a clearly optional reference example.

### Build 2: Improve control and protection

Outcome: the same turbojet gains useful feedback and operating behavior without rebuilding its Hardware inventory.

1. Restore/check the Build 1 baseline; a compact table shows what is new.
2. Add combustor-pressure measurement and calibrate it against a reference. Use this to teach engineering scaling and dashboard markers, preserving separate protection enable states.
3. Add automatic idle using verified N1 feedback. Explain target, release/cutoff, available fuel authority and gradual response. Other idle modes become a compact comparison with reference links.
4. Review oil-pressure feedback and demonstrate controlled tuning, output bounds and sensor-loss behavior. This develops the already fitted oil system; it does not introduce lubrication as an optional extra.
5. Add gradual fuel limiting and separate startup-temperature protection. Explain running/startup applicability, immediate versus sustained heat, and why a temperature dwell alone does not detect failed acceleration. Keep hard trips independent.
6. Build one useful switch-based fault controller, such as a second oil circuit, to teach naming, ON/OFF condition, confirmation and activation events. Built-in 20 ms debounce is explained once. Do not duplicate an already protected physical input merely to demonstrate another controller type.
7. Teach sequencer activation/deactivation with an actual required controller block: drag, remove, re-place, verify missing-block behavior and handover. A compact state table identifies who commands each affected output.
8. Verify the changes and save a second milestone backup.

Move the separate brightness-knob/light project out of the mandatory engine path. Preserve it as an optional custom-controller exercise in the reference material if useful.

### Build 3: Add a free power turbine and useful instruments

Outcome: the reader understands the new shaft, governor relationship and loss/load behavior and can extend the system using familiar patterns.

1. Show what physically changes: gas generator drives the gas flow, a mechanically separate free turbine drives the load. Identify N2 measurement location and any gearbox ratio. Preserve N1 identity.
2. Add and prove N2; independently establish its normal, governing and hard-limit speeds. Never copy the gas generator's 60,000 RPM into N2 by default.
3. Configure one supported governor relationship and explain its fuel authority, interaction with N1/temperature constraints, activation and sequence handover. Check the actual firmware behavior before writing a click-by-click recipe.
4. Add N2 protection and demonstrate the response to loss of feedback and load rejection in a controlled simulation/dry test. Identify what cannot be demonstrated without the real mechanical system.
5. Offer small optional instrument modules: oil temperature/cooling fan, battery voltage and current, then torque or thrust. The core path does not require every instrument. Detailed shunt design, phase-torque rig construction and load-cell mechanics move to linked reference pages.
6. Review the final ownership/state table, record validation and save the third backup.

Target main-path lengths: Build 1 approximately 2,500–3,000 words; Build 2 2,000–2,700; Build 3 1,800–2,500, excluding optional reference modules. These are editing goals, not permission to omit a required instruction. Keep three main builds; split them into short numbered tasks with clear resume links.

## Recipe and writing rules

Each task has the same compact shape:

1. **Goal:** what this device/setting contributes.
2. **Connect:** exact named terminals and necessary electrical check.
3. **Set:** actual page → section → card, values and Save action.
4. **Check:** an observable result with units/states; identify the next action if it fails.

Use an extra calibration step where needed. Keep each numbered action short and in order. Define jargon before use. Explain a concept once; link to detail when repeated. Put common failure diagnosis in a short optional panel, not between every two actions.

Write for a new installation, not the recent development history. Replace phrases such as "still uses", "remains unchanged", legacy migration discussion and long implementation distinctions with direct explanations of the current behavior. Retain separate migration/reference documentation where needed.

Do not make a reader choose among all supported methods in the middle of the main path. Each alternative states when to use it and links out. Do not hide required settings or saves in collapsed optional content.

## Numerical example policy

Create one shared example-data definition consumed by the screenshot fixture and guide validation. It records value, unit, measurement location, purpose and provenance: user-supplied operating example, documented sensor/interface value, or explicitly assumed teaching value.

- Normal operating data: 60,000 RPM N1, 3.5 bar combustor and 4.5 bar oil, based on the user's ranges. Confirm gauge/absolute pressure convention and actual measurement locations in the worksheet.
- Documented electrical example: a 0–10 bar, 0.5–4.5 V transducer through a 0.4 divider gives 200 mV at zero and 160 mV/bar. At 4.5 bar it gives 920 mV at the ADC. Verify the actual transducer specification and reference calibration; sensor span is not the oil target or trip.
- Speed-test example: with one counted pulse per shaft revolution, 60,000 RPM corresponds to 1,000 Hz. With a different PPR, change the frequency accordingly. This checks scaling, not mechanical sensor suitability.
- Temperature limits need the identified probe location and engine data. Do not transplant another turbine's inlet limit to this example's outlet probe, or use the 900/800 °C screenshot defaults as established HX80 limits.
- Fuel duty percentages, minimum reliable command and startup ramp need the actual pump/nozzle/driver calibration. They cannot be inferred from combustor pressure or a generic turbo model.
- Setpoint, approach/limiting threshold, fault threshold and instrument span are separate concepts. Validate their relationships, startup/running applicability and switch states.
- Any fictional complete engine schedule must be conspicuously labelled as an assumed teaching dataset, consistently used throughout, and kept distinct from measured limits. Do not disguise missing evidence with invented precision.

Research boundary: the Holset/Cummins HC5A/HX80 family service manual identifies application-specific matching and installation requirements; it does not establish a ready-to-run homemade turbojet fuel/start schedule. Use manufacturer primary documents for electrical/interface requirements and documented engine evidence for engine settings. Source: https://www.turbomaster.info/eng/turbos/data/HX80.pdf (manufacturer-authored manual hosted by a distributor).

## Images and page design

- Audit every reused image for current labels, values, visible controls and exact lesson state. Recreate images that do not match the recipe.
- Use one engine overview per build; show only additions prominently in later overviews. Distinguish physical signal, load power and fluid/gas paths. Annotate sensor location and pressure convention.
- Use a small number of orientation screenshots, followed by focused real UI captures. Include the card title and relevant Save action/context; avoid unrelated page padding and sticky footers covering content.
- Put numbered callouts beside the fields used by that task. Keep labels readable in the rendered article, not merely when opened at full resolution. Use separately captured narrow arrangements or focused details on small screens rather than shrinking a whole desktop form.
- Start with roughly 8–12 essential screenshots in Build 1, then add only when a distinct action would otherwise be hard to find. Do not impose a screenshot quota at the expense of clarity.
- Put entered values and expected readings in selectable HTML text/tables too. Images support the instructions; they are not the only place an instruction appears.
- Use source SVG for wiring diagrams and actual UI capture for screenshots. Check contrast, label overlap, terminal names, units and clipping at article width, phone width and lightbox size.
- Preserve public paths or add redirects for moved sections; update guided navigation, search index, reference links, captions, alt text and image dimensions.

## Beginner desk walkthrough performed for this plan

Role: can identify USB, a meter and labelled wires, but does not know GPIO, SPI, PWM, controller ownership or ECU operating states. Read the existing recipes and inspected representative actual captures; no physical assembly or independent beginner test was performed.

| Attempt | Where the current guide becomes difficult | Required improvement |
| --- | --- | --- |
| Start with an installed board | Existing defaults may look like completed hardware | Explicit adapt/remove checklist before adding channels; show the expected inventory |
| Copy the board pins | S3 screenshots look like general ESP32 instructions | Named functions in the main recipe; clearly separated target pin tables tied to exact modules |
| Add the thermocouple | New vocabulary and bus dependency arrive together | Define converter/SPI and save the bus before adding the input |
| Calibrate a pressure sensor | Sensor voltage, ADC voltage and bar can be confused | One worked conversion and a manual-reference recipe; pump assist shown only if selected |
| Select a starter output | Servo demonstration can look like the intended engine hardware | Use the chosen ESC example consistently; identify measured endpoints/arming as hardware-specific |
| Configure fuel | Mapping, idle modes, pump minimum and fixed-zero bench ownership are mixed | One initial controller and one explicit idle choice; later alternatives in Build 2 |
| Enter safety values | 600/1,000 RPM and 60 °C look copyable despite captions | Coherent engine example; normal versus trip values explained beside the fields |
| Build startup | Conceptual stages and an eight-block timer demonstration compete | One supported sequence with evidence, timeouts, final states and a clear dry-test method |
| Understand oil delivery | It appears to be a later upgrade | Include the example's required oil hardware and protection in Build 1 |
| Add a free turbine | "Inspect the relationship" does not tell me how to finish | Explicit governor source/target/authority/activation recipe with prerequisites and expected result |
| Check a screenshot | Overview text is too small after shrinking | Focused captures, visible field names and HTML value tables |

The rewrite now has a cumulative simulator fixture and an executable controller/sequence walkthrough. Ordinary UI controls reproduce Build 1 fuel/oil creation and both sequence paths with save/reload, Build 2 automatic idle, and Build 3 conversion of the existing fuel owner to an N2 governor. Wired/calibrated hardware is supplied as the declared starting fixture; this is not a physical assembly test or an independent beginner usability session.

## Implementation and acceptance pass after plan approval

1. Freeze example hardware/interface choices and distinguish measured data from assumed teaching values. Create the engine worksheet and target-specific pin plans; verify total pin/resource feasibility independently for each board. No universal raw pin list.
2. Rewrite Build 1 first and review its length and instructional order before expanding Builds 2/3. Keep the published guide intact while the draft is reviewed.
3. Create one cumulative example fixture per build and use it for every screenshot and value check. Verify supported controller/output ownership and transition behavior from production code/UI.
4. Walk through each draft from the declared initial state in the simulator using only the published steps and ordinary controls. Do not seed hidden configuration to make the walkthrough succeed. Simulated sensor stimuli may represent hardware; document those test inputs separately.
5. Record each question, missing click, ambiguous label, unexpected default and failed expected result. Revise the guide, reset and repeat the affected path. Follow the incremental path and direct entry with the stated prerequisites. Include save/reload and backup/restore.
6. Verify normal and failure transitions: controller handover, incomplete placement, STOP, timed-out confirmation, missing input, oil monitoring activation and independent N1/N2 identities. An instruction failure is fixed in the recipe or product, not skipped.
7. Verify article navigation and readability on phone/tablet/desktop. Actually inspect the rendered images. Automated image loading/no-overflow checks are necessary but do not establish legibility.
8. Validate every number, unit and image against the shared fixture and its provenance. Check pressure-bar auto-range versus retained-limit behavior and advisory versus enabled shutdown states against the actual implementation.
9. Run the docs/site build and relevant guide/screenshot/navigation audits. Update old tests that enforce the previous page structure to test learning outcomes and current structure. Firmware release checks are only needed if product code changes.
10. Present a local/staged preview for review. Publish the documentation only after the revised content and visuals are accepted; do not reflash either ECU as part of this documentation-planning work.

Success means a new reader can explain what each channel does, find every required setting, reproduce the example without undocumented help, identify the correct owner in each state, and know which numbers must come from their own hardware. Completing all three builds is optional; Build 1 must stand on its own as a coherent basic turbojet configuration lesson.

## Implementation review, 24 October 2026

The three drafts, parts/worksheet and optional workshops are implemented on `work/guided-hx80-builds` (draft PR #18). Build 1 is approximately 3,000 source words instead of 6,754, with eight focused screenshot includes instead of 31. Source counts include markup; rendered wiring tables add reference detail, available in expandable tables.

Meaningful walkthrough findings corrected in the draft: exact oil-calibration buttons and sensor-only selection, exact shutdown block name, explicit controller naming, P1 calibration field names and conversion, generic digital-input selection for independent switch logic, and re-entering fuel bounds after changing controller method/source. The N2 governor starts from the example's stable-idle command rather than treating reliable pump minimum as proof of stable engine idle.

The current release's SafetyHold-without-Spool warning is overbroad for an explicit starter-off path. The guide identifies the warning and requires inspection of the explicit starter cut and final preview before confirming it. No firmware/web-source fix is bundled into this documentation change.

Checks completed locally: public-source validation, actual rendered Jekyll metadata/links/images validation, desktop/mobile site audit, focused image inspection, both development-board core pin plans in Hardware, and controller/sequence recipes through ordinary UI controls. The Pages CI fixture initially looked for moved workshop screenshots on the old page; that audit route is corrected. Final updated Pages CI and review remain the publication gate. No ECU was reflashed or reconfigured for this documentation work.
