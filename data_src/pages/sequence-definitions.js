// Local applyContextTooltips (this page does not load app.js): hover help built
// from each .param-field's visible label + description; a MutationObserver keeps
// the dynamically-built block-editor fields covered too.
function applyContextTooltips(root) {
  (root || document).querySelectorAll('.param-field').forEach(function (el) {
    if (el.title) return;
    var lab = el.querySelector('.param-label');
    var des = el.querySelector('.param-desc');
    var l = lab && lab.textContent ? lab.textContent.trim() : '';
    var d = des && des.textContent ? des.textContent.trim() : '';
    var blockHelp = el.closest('.block-card')?.querySelector('.block-header')?.title || '';
    if (d || blockHelp) el.title = l ? l + ': ' + (d || blockHelp) : (d || blockHelp);
  });
}
document.addEventListener('DOMContentLoaded', function () {
  applyContextTooltips();
  new MutationObserver(function (recs) {
    recs.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) applyContextTooltips(n); }); });
  }).observe(document.body, { childList: true, subtree: true });
});

// ------ Block definitions ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// type: 'while'=waits for condition  'action'=instant  'wait'=timer  'check'=verify+fault
// timeout_action: 'fault'|'abort'|'continue'|null
function finalCheckBounds(lowerKey, upperKey, label, sensor, unit, min, max, lowerDefault, lowerVisible = () => true) {
  return [[lowerKey, 'Minimum', lowerDefault], [upperKey, 'Maximum', null]].map(([key, limit, def]) => ({
    key, label:`${limit} accepted ${label}`, type:'float', min, max, step:'any', def,
    ...(unit === 'temp' ? {unitType:'temp'} : {unit}),
    configKey:key, optional:true, visibleIf:sensor.visibleIf,
    showWhen:vals => !!vals['SafetyHold.' + sensor.key] && (key !== lowerKey || lowerVisible(vals))
  }));
}

const finalCheckSensors = Object.fromEntries([
  ['n1', 'Require N1', ['n1_rpm'], true],
  ['n2', 'Require N2', ['n2_rpm']],
  ['p1', 'Require P1 pressure', ['p1']],
  ['p2', 'Require P2 pressure', ['p2']],
  ['oil', 'Require oil pressure', ['oil_press']],
  ['egt', 'Require engine temperature', ['tot', 'tit']],
  ['battery', 'Require battery voltage', ['batt_voltage']],
  ['flame', 'Require flame detected', ['flame']]
].map(([name, label, keys, def = false]) => {
  const key = `final_check_${name}_enabled`;
  return [name, {key, label, type:'bool', def, configKey:key, visibleIf:() => keys.some(sensorEnabled)}];
}));
const anyFinalCheckSensorFitted = () => Object.values(finalCheckSensors).some(p => p.visibleIf());

const BLOCKS = {
  SetOutput: {
    label:'Set Output', type:'action', badgeClass:'badge-action',
    condition:null, timeout_action:null,
    desc:'Commands one fitted output. Choose the device and set ON/OFF or a 0–100% demand according to its configured hardware driver.',
    params:[]
  },
  OilPrime: {
    label:'Build Oil Pressure', type:'while', badgeClass:'badge-while',
    visibleIf: hw => actuatorEnabled('oil_pump'),
    condition: hw => sensorEnabled('oil_press')
      ? `Until ${sequenceSensorLabel('oil_press','Oil pressure')} ≥ ${hw.oil_arm_min_bar ?? 1.5} bar`
      : `Timed run (no sensor)`,
    timeout_action:'abort',
    desc:'Runs the oil pump before ignition. With pressure feedback, waits for the minimum pressure and aborts if it is not reached. Without a pressure sensor, runs for the configured time. A fitted pressure sensor with the oil-control loop Off still uses fixed pump demand while checking pressure.',
    hwWarnings:[
      { check: hw => actuatorEnabled('oil_pump'),
        msg: 'Warning: No oil pump output is configured, so this block cannot pump oil. Add one under Hardware -> Outputs.' },
    ],
    params:[
      // ------ With oil pressure sensor ------------------------------------------------------------------------------------------------------------------------------
      {key:'startup_oil_demand', label:'Oil pressure target', unit:'bar', type:'float', min:0, max:20, step:0.1, def:2.5,
        visibleIf: hw => sensorEnabled('oil_press') && hw.controllers?.oil_loop && actuatorEnabled('oil_pump'),
        configKey:'startup_oil_demand'},
      {key:'oil_arm_min_bar',    label:'Minimum pressure before ignition', unit:'bar', type:'float', min:0, max:20, step:0.1, def:1.5,
        visibleIf: hw => sensorEnabled('oil_press'), configKey:'oil_arm_min_bar'},
      // ------ Without oil pressure sensor ---------------------------------------------------------------------------------------------------------------------
      {key:'startup_oil_pct',    label:'Pump duty %',         unit:'%',  type:'float', min:0, max:100, step:5, def:80,
        visibleIf: hw => (!sensorEnabled('oil_press') || !hw.controllers?.oil_loop) && actuatorHasProportionalOutput('oil_pump'),
        configKey:'startup_oil_pct',
        desc:'Direct pump demand when there is no active oil-pressure control loop. With a fitted pressure sensor, the block still waits for the minimum pressure; without one, it runs until the timer completes.'},
      // ------ Common ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
      {key:'oil_arm_timeout_ms', label:'Timeout', unit:'ms', type:'int', min:500, max:30000, step:100, def:3000, configKey:'oil_arm_timeout_ms'},
      {key:'oil_prime_use_scavenge', label:'Run scavenge pump', type:'bool', def:false,
        configKey:'oil_prime_use_scavenge',
        visibleIf: hw => actuatorEnabled('oil_scavenge_pump')},
    ]
  },
  StarterSpin: {
    label:'Set Starter', type:'while', badgeClass:'badge-while',
    visibleIf: hw => actuatorEnabled('starter') && sensorEnabled('n1_rpm'),
    condition: hw => `Until ${sequenceSensorLabel('n1_rpm','N1')} ≥ ${hw.pre_ign_rpm ?? 5000} rpm`,
    timeout_action:'fault',
    desc:'Asserts the starter-enable output when fitted, then drives the starter until N1 reaches the pre-ignition target. A relay switches fully on; a proportional starter can ramp to its requested demand. The device enable delay is applied first. Normal completion preserves starter demand for the next block; timeout causes a fault shutdown and cuts the starter.',
    hwWarnings:[
      { check: hw => actuatorEnabled('starter'),
        msg: 'Warning: No starter output is configured, so this block has no physical effect. Add one under Hardware -> Outputs.',
        level: 'error' },
      { check: hw => sensorEnabled('n1_rpm'),
        msg: 'Warning: No N1 RPM sensor - block cannot verify target RPM. It will run for the full timeout, then FAULT SHUTDOWN. Enable bench mode for timer-only testing.' },
    ],
    params:[
      {key:'starter_demand',      label:'Starter demand',unit:'%',   type:'float', min:0,   max:100,   step:1,   def:60,    configKey:'starter_demand',
        visibleIf: hw => actuatorHasProportionalOutput('starter')},
      {key:'ramp_pct_per_s',     label:'Starter acceleration (ramp rate)', unit:'%/s', type:'float', min:0, max:200, step:5, def:30, configKey:'ramp_pct_per_s',
        visibleIf: hw => actuatorHasProportionalOutput('starter'),
        desc:'Limits how quickly Starter Spin reaches its requested demand. Example: 30%/s reaches 60% in 2 seconds. Set 0 for an immediate step. STOP and FAULT always cut the starter immediately.'},
      {key:'pulsed_assist_enabled', label:'Use pulsed low-speed assist', type:'bool', def:false, configKey:'pulsed_assist_enabled',
        visibleIf: hw => actuatorHasProportionalOutput('starter'),
        desc:'Optional engagement aid for Bendix-drive, splined-coupling, and similar starters. Pulses stop at the selected N1 speed, then the normal ramp takes over.'},
      {key:'pulsed_assist_pwm_pct', label:'Assist pulse demand', unit:'%', type:'float', min:0, max:100, step:1, def:15, configKey:'pulsed_assist_pwm_pct',
        visibleIf: hw => actuatorHasProportionalOutput('starter'),
        showWhen: vals => !!vals['StarterSpin.pulsed_assist_enabled']},
      {key:'pulsed_assist_until_rpm', label:'Assist until N1', unit:'rpm', type:'float', min:0, max:50000, step:100, def:1000, configKey:'pulsed_assist_until_rpm',
        visibleIf: hw => actuatorHasProportionalOutput('starter') && sensorEnabled('n1_rpm'),
        showWhen: vals => !!vals['StarterSpin.pulsed_assist_enabled']},
      {key:'pulsed_assist_on_ms', label:'Assist pulse ON time', unit:'ms', type:'int', min:1, max:60000, step:10, def:500, configKey:'pulsed_assist_on_ms',
        visibleIf: hw => actuatorHasProportionalOutput('starter'),
        showWhen: vals => !!vals['StarterSpin.pulsed_assist_enabled']},
      {key:'pulsed_assist_off_ms', label:'Assist pulse OFF time', unit:'ms', type:'int', min:1, max:60000, step:10, def:250, configKey:'pulsed_assist_off_ms',
        visibleIf: hw => actuatorHasProportionalOutput('starter'),
        showWhen: vals => !!vals['StarterSpin.pulsed_assist_enabled']},
      {key:'pre_ign_rpm',        label:'Pre-ignition N1 target', unit:'rpm', type:'float', min:0, max:50000, step:100, def:5000, configKey:'pre_ign_rpm',
        visibleIf: hw => sensorEnabled('n1_rpm'),
        desc:'This block completes when N1 exceeds this speed. A target of 0 accepts healthy N1 without requiring positive speed. Starter demand carries forward, including into Running. Add a cut action if the starter should disengage before Running. Without healthy N1 feedback it runs to timeout and causes a fault shutdown.'},
      {key:'starter_timeout_ms', label:'Timeout',       unit:'ms',  type:'int',   min:1000,max:60000, step:500, def:8000,
        configKey:'starter_timeout_ms',
        desc:'Maximum spin time before fault shutdown. Bench Mode is the only mode where this timeout completes without verified N1 feedback.'},
      {key:'oil_startup_min_bar',label:'Minimum oil pressure before ignition', unit:'bar', type:'float', min:0, max:20, step:0.1, def:1.5,
        visibleIf: hw => sensorEnabled('oil_press'), configKey:'oil_startup_min_bar',
        desc:'Shared with OilPrime arm threshold - both use the same config value.'},
    ]
  },
  FuelOpen: {
    label:'Open Main Fuel Shutoff', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('fuel_sol'),
    condition: null, timeout_action:null,
    desc:'Opens the main fuel shutoff. Instant action.',
    params:[]
  },
  FlameConfirm: {
    label:'Wait for Flame Signal', type:'while', badgeClass:'badge-while',
    visibleIf: hw => sensorEnabled('flame'),
    condition: hw => `Until ${hw.flame_required_count ?? 3} ${sequenceSensorLabel('flame','flame')} detections`,
    timeout_action:'abort',
    desc:'Waits for consecutive flame-present readings. An already-active input can pass. To check for new light-off, verify the input is inactive before admitting fuel. Timeout aborts startup.',
    hwWarnings:[
      { check: hw => sensorEnabled('flame'),
        msg: 'Blocked: No flame sensor configured - flame count will never increment. This block will always timeout and ABORT. Use TempConfirm as a replacement if a temperature sensor is fitted.',
        level: 'error' },
    ],
    params:[
      {key:'flame_required_count',    label:'Required detections',     type:'int', min:1, max:20, step:1, def:3, configKey:'flame_required_count',
        desc:'Number of consecutive flame-present readings required to advance.'},
      {key:'flame_check_interval_ms', label:'Detection interval', unit:'ms', type:'int', min:50, max:2000, step:50, def:250, configKey:'flame_check_interval_ms',
        desc:'Time window for each required flame detection. Longer is more tolerant of slow/noisy sensors but delays startup.'},
      {key:'flame_timeout_ms',       label:'Timeout',                 unit:'ms', type:'int',  min:1000, max:30000, step:500, def:5000, configKey:'flame_timeout_ms'},
      {key:'flame_turn_off_igniter', label:'Release sequence ignition on exit', type:'bool', def:true, configKey:'flame_turn_off_igniter',
        desc:'Turns off only ignition devices energized by dedicated ignition blocks in this sequence. Unrelated controller or subsystem outputs are not changed.'},
    ]
  },
  TempConfirm: {
    label:'Wait for Temperature Threshold', type:'while', badgeClass:'badge-while',
    visibleIf: hw => sensorEnabled('tot') || sensorEnabled('tit'),
    condition: hw => `Until ${sequenceTemperatureLabel()} ≥ ${fmtSeqTemp(hw.temp_confirm_target ?? 200)}`,
    timeout_action:'abort',
    desc:'Waits for consecutive selected TOT/TIT readings at or above the target. Temperature already above the target can pass. Use a relative temperature check when you need evidence of a new rise. Timeout aborts startup.',
    hwWarnings:[
      { check: hw => sensorEnabled('tot') || sensorEnabled('tit'),
        msg: 'Blocked: No temperature (TOT/TIT) sensor configured - EGT will never rise above ambient. This block will always timeout and ABORT.',
        level: 'error' },
    ],
    params:[
      {key:'temp_confirm_target',  label:'Target EGT', unitType:'temp', type:'float', min:0, max:1000, step:10, def:200,  configKey:'temp_confirm_target'},
      {key:'temp_confirm_timeout', label:'Timeout',   unit:'ms', type:'int',   min:1000, max:60000, step:1000, def:10000, configKey:'temp_confirm_timeout'},
    ]
  },
  TimedDelay: {
    label:'Timed Delay', type:'wait', badgeClass:'badge-wait',
    condition: hw => `Wait ${seqRound((hw.timed_delay_ms ?? 1000) / 1000)} s`,
    timeout_action:null,
    desc:'Pauses the sequence for the configured duration. No actuator changes - all outputs remain in whatever state the previous block left them.',
    params:[
      {key:'timed_delay_ms', label:'Delay', unit:'s', unitType:'duration_ms_as_s', type:'float', min:100, max:60000, step:100, def:1000, configKey:'timed_delay_ms',
        desc:'How long the sequence waits while leaving every output in the state set by the preceding block.'},
    ]
  },
  FuelPumpIdle: {
    label:'Set Main Fuel for Idle', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorHasProportionalOutput('throttle'),
    condition: null, timeout_action:null,
    desc:'Sets startup fuel from the fitted Idle Input, mapping its calibrated travel from the minimum reliable fuel output to Max%. Without an Idle Input, uses Max% as a fixed startup demand. Completes immediately. After startup, Controllers > Fuel-metering support > Idle determines the Running fuel floor, including whether the retained startup demand is used.',
    params:[
      {key:'fp_idle_max_pct', label:'Maximum / fixed idle metering output', unit:'%', type:'float', min:0, max:100, step:0.5, def:50, configKey:'fp_idle_max_pct',
        desc:'Upper end of the idle-input range. With no idle input fitted, this is the fixed idle demand. Nonzero values are constrained between the calibrated minimum reliable output and this idle limit.'},
    ]
  },
  ModifiedIdle: {
    label:'Set Main Fuel for Raised Idle', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorHasProportionalOutput('throttle'),
    condition: null, timeout_action:null,
    desc:'Sets main-fuel demand from the fitted idle input across the calibrated minimum-to-maximum idle range, then applies the multiplier. Use a value above 1.0 for a raised first-spool idle. It completes immediately; this temporary sequence demand is released when the engine enters RUNNING.',
    params:[
      {key:'modified_idle_multiplier', label:'Idle fuel multiplier', unit:'x', type:'float', min:0.1, max:5, step:0.05, def:1.0, configKey:'modified_idle_multiplier'},
    ]
  },
  Spool: {
    label:'Accelerate to Idle', type:'while', badgeClass:'badge-while',
    visibleIf: hw => actuatorHasProportionalOutput('throttle') && sensorEnabled('n1_rpm'),
    condition: hw => `Until ${sequenceSensorLabel('n1_rpm','N1')} ≥ ${hw.rpm_target ?? 32000} rpm`,
    timeout_action:'fault',
    desc:'Sets main fuel demand to the calibrated minimum reliable metering output and holds until N1 reaches the idle-entry target. The automatic combustion-loss trip starts in Running. Choose Startup and Running in oil protection if you need that general pressure trip during spool-up.',
    hwWarnings:[
      { check: hw => sensorEnabled('n1_rpm'),
        msg: 'Warning: No N1 RPM sensor - Spool cannot verify target RPM has been reached. Block will run until timeout -> FAULT SHUTDOWN.' },
    ],
    params:[
      {key:'rpm_target',                label:'Idle-entry N1 target', unit:'rpm',type:'float', min:0, max:200000, step:500, def:32000, configKey:'rpm_target', desc:'A target of 0 accepts healthy N1 without requiring positive speed.'},
      {key:'rpm_timeout_ms',            label:'Timeout',                    unit:'ms', type:'int',   min:1000, max:120000, step:1000, def:12000, configKey:'rpm_timeout_ms'},
      {key:'spool_cut_starter_on_exit', label:'Cut starter demand on exit',            type:'bool',                                  def:true,  configKey:'spool_cut_starter_on_exit'},
      {key:'spool_cut_starter_en_on_exit',label:'Cut starter enable output on exit',   type:'bool',                                  def:true,  configKey:'spool_cut_starter_en_on_exit',
        visibleIf: hw => actuatorEnabled('starter_en')},
    ]
  },
  SafetyHold: {
    label:'Final Startup Checks', type:'check', badgeClass:'badge-check',
    visibleIf: anyFinalCheckSensorFitted,
    condition: hw => `Stable for ${hw.safety_hold_ms ?? 1000} ms`,
    timeout_action:'fault',
    desc:'Use this near the end of startup to confirm the engine is ready for Running. Select the fitted sensors that must pass before the sequence moves on.',
    hwWarnings:[
      { check: anyFinalCheckSensorFitted,
        level: 'error',
        msg: 'No fitted sensor is available for Final Startup Checks. Fit a sensor, remove this block, or use Bench Mode for timer-only testing.' },
    ],
    params:[
      {key:'safety_hold_ms', label:'Stable time required',unit:'ms', type:'int', min:100, max:10000, step:100, def:1000, configKey:'safety_hold_ms'},
      {key:'safety_hold_timeout_ms', label:'Overall timeout',unit:'ms', type:'int', min:100, max:120000, step:500, def:15000, configKey:'safety_hold_timeout_ms'},
      finalCheckSensors.n1,
      ...finalCheckBounds('final_check_rpm','final_check_n1_max_rpm','N1',finalCheckSensors.n1,'rpm',0,1e9,31000),
      finalCheckSensors.n2,
      ...finalCheckBounds('final_check_n2_rpm','final_check_n2_max_rpm','N2',finalCheckSensors.n2,'rpm',0,1e9,0),
      finalCheckSensors.p1,
      ...finalCheckBounds('final_check_p1_bar','final_check_p1_max_bar','P1',finalCheckSensors.p1,'bar',-1000,1000,0),
      finalCheckSensors.p2,
      ...finalCheckBounds('final_check_p2_bar','final_check_p2_max_bar','P2',finalCheckSensors.p2,'bar',-1000,1000,0),
      finalCheckSensors.oil,
      {key:'final_check_oil_use_shared_min',label:'Use shared minimum',type:'bool',def:true,configKey:'final_check_oil_use_shared_min',visibleIf:finalCheckSensors.oil.visibleIf,showWhen:vals=>!!vals['SafetyHold.final_check_oil_enabled']},
      ...finalCheckBounds('final_check_oil_min_bar','final_check_oil_max_bar','oil pressure',finalCheckSensors.oil,'bar',-1000,1000,null,vals=>!vals['SafetyHold.final_check_oil_use_shared_min']),
      finalCheckSensors.egt,
      ...finalCheckBounds('final_check_egt_c','final_check_egt_max_c','EGT',finalCheckSensors.egt,'temp',-273.15,100000,0),
      finalCheckSensors.battery,
      ...finalCheckBounds('final_check_battery_min_v','final_check_battery_max_v','battery voltage',finalCheckSensors.battery,'V',0,1000,null),
      finalCheckSensors.flame,
      {key:'safety_turn_off_starter',    label:'Turn off starter on exit',             type:'bool', def:true, configKey:'safety_turn_off_starter',
        visibleIf: () => actuatorEnabled('starter')},
      {key:'safety_turn_off_starter_en', label:'Turn off starter enable output on exit',type:'bool', def:true, configKey:'safety_turn_off_starter_en',
        visibleIf: hw => actuatorEnabled('starter_en')},
      {key:'safety_turn_off_igniter',    label:'Turn off startup igniters on exit',    type:'bool', def:true, configKey:'safety_turn_off_igniter',
        visibleIf: hasIgnitionOutput,
        desc:'Turns off the igniters and glow plugs energized by the startup sequence.'},
    ]
  },
  AirstarterOn: {
    label:'Air Starter Valve Open', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('airstarter_sol'),
    condition: null, timeout_action:null,
    desc:'Open the air starter valve so compressed air can spool the turbine.',
    params:[]
  },
  AirstarterOff: {
    label:'Air Starter Valve Close', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('airstarter_sol'),
    condition: null, timeout_action:null,
    desc:'Close the air starter valve.',
    params:[]
  },
  CoolFanOn: {
    label:'Cooling Fan On', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('cool_fan'),
    condition: null, timeout_action:null,
    desc:'Enable the cooling fan.',
    params:[]
  },
  CoolFanOff: {
    label:'Cooling Fan Off', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('cool_fan'),
    condition: null, timeout_action:null,
    desc:'Disable the cooling fan.',
    params:[]
  },
  // ------ Explicit actuator control blocks ------------------------------------------------------------------------------------------------------------
  IgniterOn: {
    label:'Ignition Output On', type:'action', badgeClass:'badge-action',
    visibleIf: hw => hasIgnitionOutput(hw),
    condition: null, timeout_action:null,
    desc:'Command the selected igniter or glow plug on. A relay turns on immediately; a proportional device uses its Hardware On level and optional ramp. Wet-glow pilot fuel starts after its device delay. Add Timed Delay after this card if ignition needs a lead-in before fuel.',
    params:[]
  },
  IgniterOff: {
    label:'Ignition Output Off', type:'action', badgeClass:'badge-action',
    visibleIf: hw => hasIgnitionOutput(hw),
    condition: null, timeout_action:null,
    desc:'Switch the selected ignition output off.',
    params:[]
  },
  FuelSolClose: {
    label:'Close Main Fuel Shutoff', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('fuel_sol'),
    condition: null, timeout_action:null,
    desc:'Close the main fuel shutoff. Use to cut fuel without triggering the full emergency-stop path.',
    params:[]
  },
  StarterEnOn: {
    label:'Starter Enable On', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('starter_en'),
    condition: null, timeout_action:null,
    desc:'Assert the starter enable output or gate. Required on hardware with a separate starter arm circuit.',
    params:[]
  },
  StarterEnOff: {
    label:'Starter Enable Off', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('starter_en'),
    condition: null, timeout_action:null,
    desc:'De-assert the starter enable output.',
    params:[]
  },
  OilPumpOn: {
    label:'Oil Pump On', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('oil_pump'),
    condition: null, timeout_action:null,
    desc:'Start oil pump at the specified direct output demand. This sequence setting is independent of the closed-loop oil controller minimum duty.',
    params:[
      {key:'oil_pump_on_pct', label:'Startup oil pump demand', unit:'%', type:'float', min:0, max:100, step:5, def:100, configKey:'oil_pump_on_pct',
        visibleIf: hw => actuatorHasProportionalOutput('oil_pump'),
        desc:'Direct PWM output for this sequence step; it is not limited by Controllers > Oil & Lubrication Controllers > Minimum Pump Command.'},
    ]
  },
  OilPumpOff: {
    label:'Oil Pump Off', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('oil_pump'),
    condition: null, timeout_action:null,
    desc:'Stop the oil pump. For post-stop oil cut-off or intentional dry motoring.',
    params:[]
  },
  OilScavengeOn: {
    label:'Scavenge On', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('oil_scavenge_pump'),
    condition: null, timeout_action:null,
    desc:'Activates the dedicated oil scavenge pump. Use during startup priming, warmup holds, or anywhere you need scavenge running independently of the main oil pressure loop.',
    params:[]
  },
  OilScavengeOff: {
    label:'Scavenge Off', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('oil_scavenge_pump'),
    condition: null, timeout_action:null,
    desc:'Deactivates the oil scavenge pump.',
    params:[]
  },
  DrainValveOpen: {
    label:'Open Drain Valve', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('drain_valve'),
    condition:null, timeout_action:null,
    desc:'Opens the fitted electric drain valve. The Hardware output type and inversion determine the physical relay, PWM, or servo signal.',
    params:[]
  },
  DrainValveClose: {
    label:'Close Drain Valve', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('drain_valve'),
    condition:null, timeout_action:null,
    desc:'Closes the fitted electric drain valve.',
    params:[]
  },
  StarterOff: {
    label:'Starter Off', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('starter'),
    condition: null, timeout_action:null,
    desc:'Set starter demand to zero. Use after spool is established to disengage the starter motor.',
    params:[]
  },
  // ------ Shutdown blocks ---------------------------------------------------------------------------------------------------------------------------------------------------------------
  ImmediateCut: {
    label:'Immediate Fuel and Ignition Cut', type:'action', badgeClass:'badge-action',
    condition: null, timeout_action:null,
    desc:'Immediately removes main, start, and afterburner fuel demand; closes fuel valves; and turns off ignition and starter outputs. Use as the first emergency-shutdown action.',
    params:[]
  },
  RPMDrop: {
    label:'Wait for Rotor to Slow', type:'while', badgeClass:'badge-while',
    condition: hw => `Until ${sequenceSensorLabel('n1_rpm','N1')} < ${hw.rpm_drop_threshold ?? 5000} rpm`,
    timeout_action:'continue',
    desc:'Waits for N1 to fall below the threshold RPM before proceeding to cooldown. Ensures the starter motor is not fighting against residual turbine spin. On timeout -> continues anyway. No actuator changes.',
    hwWarnings:[
      { check: hw => sensorEnabled('n1_rpm'),
        msg: 'Warning: No N1 RPM sensor - RPM drop cannot be verified. Block will proceed after timeout (safe - timeout action is continue).' },
    ],
    params:[
      {key:'rpm_drop_threshold', label:'RPM threshold',unit:'rpm',type:'float',min:100, max:50000, step:100,  def:5000,   configKey:'rpm_drop_threshold'},
      {key:'rpm_drop_timeout_ms',label:'Timeout',      unit:'ms', type:'int',  min:1000,max:60000, step:1000, def:15000,  configKey:'rpm_drop_timeout_ms'},
    ]
  },
  CooldownSpin: {
    label:'Cooldown', type:'while', badgeClass:'badge-while',
    condition: hw => `Until ${sequenceTemperatureLabel()} < ${fmtSeqTemp(hw.tot_cooldown_target ?? 150)}`,
    timeout_action:'continue',
    desc:'Runs the selected starter and oil outputs after an ignition attempt or recorded heat. Ends at the temperature target or timeout. With oil-pressure feedback, the selected main pump regulates to the pressure target. Cooldown cards share these settings.',
    hwWarnings:[
      { check: hw => sensorEnabled('tot') || sensorEnabled('tit'),
        msg: 'Warning: No temperature sensor - cooldown cannot verify EGT has dropped. Block will run for the full timeout then continue (safe).' },
      { check: () => {
          const source = Number(cfg?.safety?.egt_source || 0);
          const hasTot = sensorEnabled('tot');
          const hasTit = sensorEnabled('tit');
          const limit = source === 1 && hasTot ? Number(cfg?.engine?.tot_limit || 0) :
                        source === 2 && hasTit ? Number(cfg?.safety?.tit_limit_c || 0) :
                        hasTot ? Number(cfg?.engine?.tot_limit || 0) :
                        hasTit ? Number(cfg?.safety?.tit_limit_c || 0) : 0;
          return limit <= 0 || Number(cfg?.engine?.tot_cooldown_target || 0) < limit;
        },
        msg: 'Warning: Cooldown EGT target is at or above the selected engine-temperature shutdown limit. Cooldown may complete immediately while the turbine is still hot; use a verified bearing/storage-safe target.' },
    ],
    params:[
      {key:'tot_cooldown_target',       label:'EGT target',              unitType:'temp', type:'float',min:0, max:100000, step:10, def:150, configKey:'tot_cooldown_target'},
      {key:'cooldown_timeout_ms',       label:'Timeout',                 unit:'ms', type:'int',  min:10000,max:600000, step:10000, def:60000, configKey:'cooldown_timeout_ms'},
      {key:'cooldown_skip_hold_ms',     label:'Manual skip hold',        unit:'ms', type:'int',  min:500,  max:30000,  step:500,   def:1000,  configKey:'cooldown_skip_hold_ms',
        desc:'Hold START and STOP together for this long while this card is active to continue to the next shutdown step.'},
      {key:'cooldown_use_starter',      label:'Use starter motor',                  type:'bool',                                  def:true,   configKey:'cooldown_use_starter',
        visibleIf: hw => actuatorEnabled('starter')},
      {key:'cooldown_starter_pct',      label:'Starter speed',           unit:'%',  type:'float',min:0,    max:100,    step:5,     def:40,     configKey:'cooldown_starter_pct',
        visibleIf: hw => actuatorHasProportionalOutput('starter'), showWhen: vals => !!vals['CooldownSpin.cooldown_use_starter']},
      {key:'cooldown_use_oil_pump',     label:'Run oil pump',                       type:'bool',                                  def:true,   configKey:'cooldown_use_oil',
        visibleIf: hw => actuatorEnabled('oil_pump'),
        desc:'On by default. Turn it off if oil is supplied independently or this step does not need the pump.'},
      {key:'cooldown_keep_oil_on_exit', label:'Keep last oil pump command', type:'bool', def:false, configKey:'cooldown_keep_oil_on_exit',
        visibleIf: hw => actuatorEnabled('oil_pump'), showWhen: vals => !!vals['CooldownSpin.cooldown_use_oil_pump'],
        desc:'Carries the last command, including zero, into the next step. Pressure regulation ends here. Use a later output card for a fixed coast-down command, or Wait for Complete Stop to cut oil.'},
      {key:'cooldown_oil_pct',          label:'Oil pump start / manual duty', unit:'%',  type:'float',min:0,    max:100,    step:5,     def:30,     configKey:'cooldown_oil_pct',
        visibleIf: hw => actuatorHasProportionalOutput('oil_pump'), showWhen: vals => !!vals['CooldownSpin.cooldown_use_oil_pump'],
        desc:'Starting duty for pressure-regulated cooldown. Also used for fixed-duty cooldown and Tools → Extra Cooldown.'},
      {key:'cooldown_oil_pressure_bar', label:'Oil pressure target',     unit:'bar',type:'float',min:0.5,  max:10,     step:0.1,   def:2.0,    configKey:'cooldown_oil_pressure_bar',
        visibleIf: hw => actuatorEnabled('oil_pump') && sensorEnabled('oil_press'), showWhen: vals => !!vals['CooldownSpin.cooldown_use_oil_pump']},
      {key:'cooldown_use_scavenge',     label:'Run scavenge pump',                  type:'bool',                                  def:false,  configKey:'cooldown_use_scavenge',
        visibleIf: hw => actuatorEnabled('oil_scavenge_pump')},
    ]
  },
  FinalStop: {
    label:'Wait for Complete Stop', type:'while', badgeClass:'badge-while',
    condition: hw => {
      const source = hw.final_stop_speed_source ?? 0;
      if (source === 3) return 'Timed spool-down';
      const shafts = [
        {key:'n1_rpm', label:'N1', source:0},
        {key:'n2_rpm', label:'N2', source:1}
      ].filter(shaft => source === shaft.source || (source === 2 && sensorEnabled(shaft.key)));
      if (!shafts.length || shafts.some(shaft => !sensorEnabled(shaft.key)))
        return 'Timed spool-down (speed feedback missing)';
      const labels = shafts.map(shaft => sequenceSensorLabel(shaft.key, shaft.label));
      return `Until ${labels.join(' and ')} ≤ ${hw.rpm_zero_threshold ?? 100} rpm, or timeout`;
    },
    timeout_action:'continue',
    desc:'The main oil pump cuts when the selected shaft speeds reach the stop threshold or the delay expires. If required feedback is missing or unhealthy, the card waits the full delay. A fitted scavenge pump can continue afterward.',
    params:[
      {key:'final_stop_speed_source', label:'Speed source', type:'select', def:0, configKey:'final_stop_speed_source',
        options:[{v:0,l:'Core shaft (N1)'},{v:1,l:'Power shaft (N2)'},{v:2,l:'Both fitted shafts'},{v:3,l:'Timer only'}],
        desc:'Choose the shaft or shafts that receive oil from the main pump. Timer only always waits the full delay.'},
      {key:'rpm_zero_threshold',    label:'Stop threshold',   unit:'rpm',type:'float',min:0,   max:1000,  step:10,   def:100,
        showWhen: params => Number(params['FinalStop.final_stop_speed_source']) !== 3,
        configKey:'rpm_zero_threshold',
        desc:'All selected shafts must be at or below this speed to end the wait early.'},
      {key:'final_stop_timeout_ms', label:'Timeout',          unit:'ms', type:'int',  min:1000,max:60000, step:1000, def:10000, configKey:'final_stop_timeout_ms'},
      {key:'oil_scavenge_ms', label:'Scavenge pump run time', unit:'ms', type:'int',
        min:0, max:120000, step:1000, def:0, configKey:'oil_scavenge_ms',
        visibleIf: hw => actuatorEnabled('oil_scavenge_pump')},
    ]
  },
  // ------ Extended / optional blocks ---------------------------------------------------------------------------------------------------------------------------------
  FuelPulse: {
    label:'Pulse Main Fuel Shutoff', type:'wait', badgeClass:'badge-wait',
    visibleIf: hw => actuatorEnabled('fuel_sol'),
    condition: hw => `fuel ${hw.fuel_pulse_ms ?? 200}ms`,
    timeout_action:null,
    desc:'Opens the main fuel shutoff for a brief pulse to wet the atomiser or clear the dead-leg before ignition. Does NOT mark combustion as attempted - use before Igniter 1 Timed On as a pre-prime step. The shutoff closes after the pulse, then the block waits before completing.',
    params:[
      {key:'fuel_pulse_ms', label:'Pulse duration',  unit:'ms', type:'int', min:50,  max:2000, step:50,  def:200, configKey:'fuel_pulse_ms'},
      {key:'fuel_off_ms',   label:'Wait after close', unit:'ms', type:'int', min:0,   max:5000, step:100, def:300, configKey:'fuel_off_ms'},
    ]
  },
  WaitTOTCool: {
    label:'Wait for Safe Restart Temperature', type:'while', badgeClass:'badge-while',
    visibleIf: hw => sensorEnabled('tot') || sensorEnabled('tit'),
    condition: hw => `Until ${sequenceTemperatureLabel()} ≤ ${fmtSeqTemp(hw.wait_tot_target ?? 150)}`,
    timeout_action:null,
    desc:'Holds until selected EGT is healthy and below the target. In STARTUP, an unhealthy/hot timeout aborts the start. In SHUTDOWN, timeout permits completion so shutdown cannot hang indefinitely.',
    params:[
      {key:'wait_tot_target',  label:'Target EGT', unitType:'temp', type:'float', min:0,    max:500,    step:10,   def:150,    configKey:'wait_tot_target'},
      {key:'wait_tot_timeout', label:'Timeout',    unit:'ms', type:'int',  min:5000, max:600000, step:5000, def:120000, configKey:'wait_tot_timeout'},
    ]
  },
  ThrottleSet: {
    label:'Set Main Fuel Demand', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorHasProportionalOutput('throttle'),
    condition: null, timeout_action:null,
    desc:'Immediately sets throttleDemand to a fixed percentage and completes. Use for a precise idle hold, warm-up step, or test point. If the throttle slew controller is active it will ramp to this setpoint.',
    params:[
      {key:'throttle_set_pct', label:'Main fuel demand', unit:'%', type:'float', min:0, max:100, step:1, def:10, configKey:'throttle_set_pct'},
    ]
  },
  WaitForInput: {
    label:'Wait for External Input', type:'while', badgeClass:'badge-while',
    visibleIf: hw => hw.di_channels?.some(ch => ch.pin >= 0),
    condition:null,
    timeout_action:'abort',
    desc:'Holds the sequence until this card\'s selected digital input becomes active or inactive. Each card has its own channel, condition, and finite timeout; failure aborts the sequence.',
    hwWarnings:[
      { check: hw => hw.di_channels?.some(ch => ch.pin >= 0),
        msg: 'Warning: No digital inputs configured in Hardware. This block will never receive a signal and will always timeout/abort.',
        level: 'error' },
    ],
    params:[]
  },
  WaitForInputOff: {
    label:'Wait for External Input to Release', type:'while', badgeClass:'badge-while',
    visibleIf: hw => hw.di_channels?.some(ch => ch.pin >= 0),
    condition:null,
    timeout_action:'abort',
    desc:'Older shutdown-only input-release step. Its selected channel and timeout now belong to this card; use Wait for External Input for new steps.',
    hwWarnings:[
      { check: hw => hw.di_channels?.some(ch => ch.pin >= 0),
        msg: 'No digital inputs configured in Hardware. This block will never receive a switch signal.',
        level: 'error' },
    ],
    params:[]
  },
  // ------ Afterburner blocks ---------------------------------------------------------------------------------------------------------------------------------------------------------
  ABPumpOn: {
    label:'Afterburner Fuel Pump On', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('ab_pump'),
    condition: null, timeout_action:null,
    desc:'Enables the afterburner fuel pump at the light-up demand configured under Controllers -> Afterburner.',
    params:[]
  },
  ABPumpOff: {
    label:'Afterburner Fuel Pump Off', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('ab_pump'),
    condition: null, timeout_action:null,
    desc:'Disable the afterburner fuel pump.',
    params:[]
  },
  ABIgnOn: {
    label:'AB Igniter On', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('igniter2'),
    condition: null, timeout_action:null,
    desc:'Enable the afterburner / secondary igniter.',
    params:[]
  },
  ABIgnOff: {
    label:'AB Igniter Off', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('igniter2'),
    condition: null, timeout_action:null,
    desc:'Disable the afterburner igniter.',
    params:[]
  },
  ABSolOpen: {
    label:'Afterburner Fuel Valve Open', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('ab_sol'),
    condition: null, timeout_action:null,
    desc:'Opens the afterburner fuel valve immediately.',
    params:[]
  },
  ABSolClose: {
    label:'Afterburner Fuel Valve Close', type:'action', badgeClass:'badge-action',
    visibleIf: hw => actuatorEnabled('ab_sol'),
    condition: null, timeout_action:null,
    desc:'Closes the afterburner fuel valve immediately.',
    params:[]
  },
  ABCheckReady: {
    label:'Check Afterburner Entry Conditions', type:'check', badgeClass:'badge-check',
    condition: hw => 'Check entry conditions',
    timeout_action:'abort',
    desc:'Gate block: checks the entry conditions configured above before proceeding with AB ignition. Aborts if any condition fails.',
    params:[]
  },
  ABIgnite: {
    label:'Ignite Afterburner', type:'wait', badgeClass:'badge-wait',
    condition: () => `Wait ${seqRound(Number(cfg?.afterburner?.torch_duration_ms ?? 400) / 1000)} s ignition`, timeout_action:null,
    desc:'Fires the method selected under Controllers -> Afterburner Ignition: torch, afterburner igniter, or both. The block completes after the configured ignition duration.',
    params:[]
  },
  ABFlameConfirm: {
    label:'Verify Afterburner Light-up', type:'while', badgeClass:'badge-while',
    condition: () => `Until light-up evidence · ${cfg?.afterburner?.flame_timeout_ms ?? 3000} ms overall deadline`,
    timeout_action:'fault',
    desc:'Uses the selected light-up evidence. The overall deadline starts at the first afterburner fuel command.',
    settingsInControllers:true,
    params:[]
  },
  ABStabilize: {
    label:'Stabilize Afterburner', type:'while', badgeClass:'badge-while',
    condition: () => `Hold ${cfg?.afterburner?.stabilize_ms ?? 1000} ms${Number(cfg?.afterburner?.stabilize_max_tot) > 0 ? '; check EGT' : ''}`,
    timeout_action:'complete',
    desc:'Holds after light-up and checks the optional stabilization temperature limit. Afterburner enters Running when the light-up sequence finishes.',
    settingsInControllers:true,
    params:[]
  },

  // ------ Advanced hardware blocks ------------------------------------------------------------------------------------------------
  BleedOpen: {
    label:'Bleed Valve Open', type:'action', badgeClass:'badge-action',
    condition: null, timeout_action: null,
    desc:'Opens the compressor bleed valve immediately. Use near the start of a startup sequence when opening the bleed reduces surge risk during spool-up.',
    params:[],
    visibleIf: hw => actuatorEnabled('bleed_valve'),
  },
  BleedClose: {
    label:'Bleed Valve Close', type:'action', badgeClass:'badge-action',
    condition: null, timeout_action: null,
    desc:'Closes the compressor bleed valve immediately. Use after spool-up when full pressure recovery is required.',
    params:[],
    visibleIf: hw => actuatorEnabled('bleed_valve'),
  },
  FuelPumpRamp: {
    label:'Secondary / Auxiliary Fuel Pump Ramp', type:'action', badgeClass:'badge-action',
    condition: null, timeout_action: null,
    desc:'Ramps the secondary or auxiliary fuel-pump demand linearly from the selected start value to the end value over the configured duration. Useful for pilot-fuel staging, turboshaft pre-metering, or other staged fuel delivery.',
    params:[
      {key:'fp2_start_pct',      label:'Start %',                     unit:'%',  type:'float', min:0,  max:100,   step:1,   def:0,    configKey:'fp2_start_pct'},
      {key:'fp2_end_pct',        label:'End %',                       unit:'%',  type:'float', min:0,  max:100,   step:1,   def:80,   configKey:'fp2_end_pct'},
      {key:'fp2_ramp_ms',        label:'Ramp duration',               unit:'ms', type:'int',   min:100,max:60000, step:100, def:3000, configKey:'fp2_ramp_ms'},
    ],
    visibleIf: hw => actuatorHasProportionalOutput('fuel_pump2'),
  },
  FuelPump2Set: {
    label:'Secondary / Auxiliary Fuel Pump Set', type:'action', badgeClass:'badge-action',
    condition: null, timeout_action: null,
    desc:'Sets secondary / auxiliary fuel pump demand to a fixed value immediately. Use for known set-points after a ramp or as a quick preset.',
    params:[
      {key:'fp2_demand_pct',     label:'Demand %',                    unit:'%',  type:'float', min:0, max:100, step:1, def:0, configKey:'fp2_demand_pct'},
    ],
    visibleIf: hw => actuatorHasProportionalOutput('fuel_pump2'),
  },
  FuelPump2On: {
    label:'Secondary / Auxiliary Fuel Pump On', type:'action', badgeClass:'badge-action',
    condition: null, timeout_action: null,
    desc:'Switches relay-type secondary / auxiliary fuel pump on. This card is shown only when that pump is configured as an on/off output.',
    params:[],
    visibleIf: hw => actuatorEnabled('fuel_pump2') && actuatorIsRelay('fuel_pump2'),
  },
  FuelPump2Off: {
    label:'Secondary / Auxiliary Fuel Pump Off', type:'action', badgeClass:'badge-action',
    condition: null, timeout_action: null,
    desc:'Switches relay-type secondary / auxiliary fuel pump off.',
    params:[],
    visibleIf: hw => actuatorEnabled('fuel_pump2') && actuatorIsRelay('fuel_pump2'),
  },
  GovernorHold: {
    label:'Wait for N2 Speed Control', type:'while', badgeClass:'badge-while',
    condition: hw => `Until N2 within ${hw.gov_hold_band_rpm ?? 500} rpm of target`,
    timeout_action:'fault',
    desc:'Engages the real N2 speed controller bumplessly from the current demand, then requires healthy N2 feedback inside the selected band for 500 ms. Timeout faults startup and enters safe shutdown.',
    params:[
      {key:'gov_hold_timeout_ms', label:'Timeout', unit:'ms',  type:'int',   min:1000, max:60000, step:500,  def:10000, configKey:'gov_hold_timeout_ms'},
      {key:'gov_hold_band_rpm',   label:'Band',    unit:'rpm', type:'float', min:0, max:1000000000, step:50, def:500, configKey:'gov_hold_band_rpm'},
    ],
    visibleIf: hw => !!(hw.controllers?.governor && sensorEnabled('n2_rpm') &&
      (actuatorEnabled('throttle') || actuatorHasProportionalOutput('prop_pitch'))),
  },
};

// ------ Config section mapping ---------------------------------------------------------------------------------------------------------------------------------------------------
// Maps each block parameter to its JSON path in the settings section of ecu_config.json.
// The "section" is doc["sequence"]["startup"] or doc["sequence"]["shutdown"] etc.
const CONFIG_SECTIONS = {
  // startup sequence params (doc.sequence.startup.*)
  startup_oil_demand:      {sec:'oil',              key:'startup_pressure'},   // bar target (with sensor)
  startup_oil_pct:         {sec:'oil',              key:'startup_pct'},        // pump % (without sensor)
  oil_arm_min_bar:         {sec:'oil',              key:'startup_min_bar'},    // arm threshold (shared with StarterSpin)
  oil_startup_min_bar:     {sec:'oil',              key:'startup_min_bar'},    // same value, shown in StarterSpin context
  oil_arm_timeout_ms:      {sec:'sequence.startup', key:'oil_arm_timeout_ms'},
  starter_demand:          {sec:'sequence.startup', key:'starter_demand'},
  starter_timeout_ms:      {sec:'sequence.startup', key:'starter_timeout_ms'},
  temp_confirm_target:     {sec:'sequence.startup', key:'temp_confirm_target'},
  temp_confirm_timeout:    {sec:'sequence.startup', key:'temp_confirm_timeout'},
  pre_ign_rpm:             {sec:'sequence.startup', key:'pre_ign_rpm'},
  flame_required_count:    {sec:'sequence.startup', key:'flame_required_count'},
  flame_check_interval_ms: {sec:'sequence.startup', key:'flame_check_interval_ms'},
  flame_timeout_ms:        {sec:'sequence.startup', key:'flame_timeout_ms'},
  rpm_target:              {sec:'sequence.startup', key:'rpm_target'},
  rpm_timeout_ms:          {sec:'sequence.startup', key:'rpm_timeout_ms'},
  safety_hold_ms:          {sec:'sequence.startup', key:'safety_hold_ms'},
  safety_hold_timeout_ms:  {sec:'sequence.startup', key:'safety_hold_timeout_ms'},
  ...Object.fromEntries(BLOCKS.SafetyHold.params.filter(p => p.key.startsWith('final_check_')).map(p =>
    [p.key, {sec:'sequence.startup', key:p.key}])),
  // shutdown params (doc.sequence.shutdown.*)
  rpm_drop_threshold:      {sec:'sequence.shutdown', key:'rpm_drop_threshold'},
  rpm_drop_timeout_ms:     {sec:'sequence.shutdown', key:'rpm_drop_timeout_ms'},
  tot_cooldown_target:     {sec:'engine',            key:'tot_cooldown_target'},
  cooldown_skip_hold_ms:   {sec:'misc',              key:'cooldown_skip_hold_ms'},
  cooldown_starter_pct:        {sec:'sequence.shutdown', key:'cooldown_starter_pct'},
  cooldown_oil_pct:            {sec:'sequence.shutdown', key:'cooldown_oil_pct'},
  cooldown_timeout_ms:         {sec:'sequence.shutdown', key:'cooldown_timeout_ms'},
  cooldown_use_starter:        {sec:'sequence.shutdown', key:'cooldown_use_starter'},
  cooldown_use_oil:            {sec:'sequence.shutdown', key:'cooldown_use_oil'},
  cooldown_keep_oil_on_exit:   {sec:'sequence.shutdown', key:'cooldown_keep_oil_on_exit'},
  cooldown_oil_pressure_bar:   {sec:'sequence.shutdown', key:'cooldown_oil_pressure_bar'},
  final_stop_timeout_ms:   {sec:'sequence.shutdown', key:'final_stop_timeout_ms'},
  final_stop_speed_source: {sec:'sequence.shutdown', key:'final_stop_speed_source'},
  oil_scavenge_ms:         {sec:'sequence.shutdown', key:'oil_scavenge_ms'},
  rpm_zero_threshold:      {sec:'sequence.shutdown', key:'rpm_zero_threshold'},
  ramp_pct_per_s:          {sec:'starter_control', key:'startup_ramp_pct_per_s'},
  pulsed_assist_enabled:   {sec:'starter_control', key:'pulsed_assist_enabled'},
  pulsed_assist_pwm_pct:   {sec:'starter_control', key:'pulsed_assist_pwm_pct'},
  pulsed_assist_until_rpm: {sec:'starter_control', key:'pulsed_assist_until_rpm'},
  pulsed_assist_on_ms:     {sec:'starter_control', key:'pulsed_assist_on_ms'},
  pulsed_assist_off_ms:    {sec:'starter_control', key:'pulsed_assist_off_ms'},
  // new blocks
  timed_delay_ms:          {sec:'sequence.startup', key:'timed_delay_ms'},
  modified_idle_multiplier:{sec:'sequence.startup', key:'modified_idle_multiplier'},
  fuel_pulse_ms:           {sec:'sequence.startup', key:'fuel_pulse_ms'},
  fuel_off_ms:             {sec:'sequence.startup', key:'fuel_off_ms'},
  wait_tot_target:         {sec:'sequence.startup', key:'wait_tot_target'},
  wait_tot_timeout:        {sec:'sequence.startup', key:'wait_tot_timeout'},
  throttle_set_pct:        {sec:'sequence.startup', key:'throttle_set_pct'},
  oil_pump_on_pct:         {sec:'sequence.startup', key:'oil_pump_on_pct'},
  fp_idle_max_pct:         {sec:'throttle',         key:'idle_max_pct'},
  // FlameConfirm / SafetyHold exit action bools
  flame_turn_off_igniter:     {sec:'sequence.startup', key:'flame_turn_off_igniter'},
  safety_turn_off_starter:    {sec:'sequence.startup', key:'safety_turn_off_starter'},
  safety_turn_off_starter_en: {sec:'sequence.startup', key:'safety_turn_off_starter_en'},
  safety_turn_off_igniter:    {sec:'sequence.startup', key:'safety_turn_off_igniter'},
  // Spool exit action bools
  spool_cut_starter_on_exit:    {sec:'sequence.startup', key:'spool_cut_starter_on_exit'},
  spool_cut_starter_en_on_exit: {sec:'sequence.startup', key:'spool_cut_starter_en_on_exit'},
  // Oil scavenge pump sequence params
  oil_prime_use_scavenge: {sec:'sequence.startup', key:'oil_prime_use_scavenge'},
  cooldown_use_scavenge:  {sec:'sequence.shutdown', key:'cooldown_use_scavenge'},
  // Advanced block params (stored in cfg.sequence.startup and cfg.governor)
  fp2_start_pct:         {sec:'sequence.startup', key:'fp2_start_pct'},
  fp2_end_pct:           {sec:'sequence.startup', key:'fp2_end_pct'},
  fp2_ramp_ms:           {sec:'sequence.startup', key:'fp2_ramp_ms'},
  fp2_demand_pct:        {sec:'sequence.startup', key:'fp2_demand_pct'},
  gov_hold_timeout_ms:   {sec:'sequence.startup', key:'gov_hold_timeout_ms'},
  gov_hold_band_rpm:     {sec:'governor',         key:'band_rpm'},
  // AB sequence params (stored in cfg.afterburner.*)
  ab_min_n1:           {sec:'afterburner', key:'min_n1'},
  ab_max_n1:           {sec:'afterburner', key:'max_n1'},
  ab_max_tot_for_light:{sec:'afterburner', key:'max_tot_for_light'},
  ab_throttle_thr:     {sec:'afterburner', key:'throttle_threshold'},
  ab_use_torch:        {sec:'afterburner', key:'use_torch'},
  ab_use_igniter:      {sec:'afterburner', key:'use_igniter'},
  ab_torch_pct:        {sec:'afterburner', key:'torch_spike_pct'},
  ab_torch_ms:         {sec:'afterburner', key:'torch_duration_ms'},
  ab_torch_tl:         {sec:'afterburner', key:'torch_tot_limit'},
  ab_flame_mode:       {sec:'afterburner', key:'flame_mode'},
  ab_tot_rise:         {sec:'afterburner', key:'tot_rise_deg_c'},
  ab_tot_rise_win:     {sec:'afterburner', key:'tot_rise_window_ms'},
  ab_assume_ms:        {sec:'afterburner', key:'assume_ignited_ms'},
  ab_pump_min_pct:     {sec:'afterburner', key:'pump_min_pct'},
  ab_pump_max_pct:     {sec:'afterburner', key:'pump_max_pct'},
  ab_main_offset:      {sec:'afterburner', key:'main_fuel_offset_pct'},
  // WaitForInput block params
  wait_for_input_ch:      {sec:'sequence.startup', key:'wait_for_input_ch'},
  wait_for_input_state:   {sec:'sequence.startup', key:'wait_for_input_state'},
  wait_for_input_timeout: {sec:'sequence.startup', key:'wait_for_input_timeout'},
};

// Available block names per tab
const STARTUP_BLOCKS = [
  'OilPrime','StarterSpin','SetOutput','FlameConfirm','TempConfirm',
  'TimedDelay','FuelPumpIdle','Spool','SafetyHold','WaitForInput'
];
const SHUTDOWN_BLOCKS    = [
  'ImmediateCut','RPMDrop','CooldownSpin','FinalStop','TimedDelay','SetOutput',
  'WaitTOTCool','WaitForInput'
];
// AB ignition sequence blocks (ab_seq)
const AFTERBURNER_BLOCKS = [
  'ABCheckReady','SetOutput','ABIgnite','ABFlameConfirm','ABStabilize','TimedDelay',
];
// AB light-off sequence blocks (ab_shut_seq)
const AB_SHUT_BLOCKS = [
  'SetOutput','TimedDelay',
];

// User-defined custom blocks (stored in hwCfg.custom_blocks or local state)
const MAX_CUSTOM_BLOCKS = 8;
const MAX_CUSTOM_STEPS = 8;
const MAX_CUSTOM_KEY_LEN = 23;
const MAX_CUSTOM_LABEL_LEN = 31;
const MAX_CUSTOM_DESC_LEN = 95;
let customBlocks = {};

// ------ Block info map - describes what config each block uses ---------------------------------------------------
const BLOCK_INFO = {
  OilPrime: {
    desc: 'Runs the oil pump before ignition. With pressure feedback it waits for the minimum pressure and aborts if that is not reached. Without feedback it runs for the configured time. If the pressure-control loop is Off, it uses fixed pump demand even when a pressure sensor is fitted.',
    links: []
  },
  StarterSpin: {
    desc: 'Enables the starter until N1 reaches the pre-ignition target. Relay starters switch fully on; proportional starters can ramp. Normal completion leaves starter demand active for a later cut action; timeout causes a fault shutdown.',
    links: []
  },
  FuelOpen: {
    desc: 'Opens the main fuel shutoff.',
    links: []
  },
  FlameConfirm: {
    desc: 'Waits for consecutive flame-present readings. A detector already active at entry can pass. Use a separate inactive check before fuel admission if the sequence must establish a new light-off. This step can release sequence-owned ignition on exit.',
    links: [
      { label: 'Combustion-Loss Confirmation Time', url: '/controllers.html#safety-monitor' },
    ]
  },
  TempConfirm: {
    desc: 'Checks an absolute EGT threshold. Use a relative condition in a custom block when you need evidence of a new temperature rise.',
    links: [
      { label: 'Engine Temperature Source', url: '/controllers.html#engine-limits' },
    ]
  },
  Spool: {
    desc: 'Holds main fuel at the calibrated minimum reliable metering output and waits for N1 to reach the idle-entry target. Automatic combustion-loss monitoring applies in Running.',
    links: [
      { label: 'Minimum Reliable Fuel-Metering Output', url: '/calibration.html#fuelpump-min-cal-row' },
      { label: 'Throttle Open Speed', url: '/controllers.html#throttle' },
      { label: 'Shared Oil Low-Pressure Limit', url: '/controllers.html#cf-oil_rm' },
    ]
  },
  SafetyHold: {
    desc: 'All selected sensors must be healthy and meet their criteria at the same time. The stable timer restarts when any check fails. The overall timeout never restarts and faults startup if the card has not passed. The oil pressure check uses the shared low-pressure limit. Starter and ignition exit actions are separate from the checks. When used in a sequence more than once, this card shares its settings across copies. In Bench Mode, the card waits for the stable time with sensor checks bypassed.',
    links: [
      { label: 'Min RPM',         url: '/controllers.html#engine-limits' },
      { label: 'Shared Oil Low-Pressure Limit', url: '/controllers.html#cf-oil_rm' },
    ]
  },
  CooldownSpin: {
    desc: 'Runs selected cooling outputs after an ignition attempt or recorded heat. Other outputs keep their sequence commands.',
    links: []
  },
  FinalStop: {
    desc: 'Waits on the selected shaft speeds or a fixed delay before cutting main oil. The scavenge pump can continue afterward.',
    links: []
  },
  RPMDrop: {
    desc: 'Waits for N1 to fall below threshold RPM before proceeding to cooldown. Continues on timeout.',
    links: [
      { label: 'Min RPM', url: '/controllers.html#engine-limits' },
    ]
  },
  ImmediateCut: {
    desc: 'Emergency cut: zeros all main/start/afterburner fuel demands, closes fuel valves, and turns off ignition and starter outputs instantly.',
    links: []
  },
  FuelPumpIdle: {
    desc: 'Maps the fitted idle input from the calibrated minimum reliable fuel output to the configured maximum idle output. With no idle input, that maximum is used as the fixed demand.',
    links: [
      { label: 'Minimum Reliable Fuel-Metering Output', url: '/calibration.html#fuelpump-min-cal-row' },
    ]
  },
  ModifiedIdle: {
    desc: 'Sets main-fuel demand from the calibrated minimum reliable metering output to the configured maximum idle output, then applies the multiplier.',
    links: [
      { label: 'Minimum Reliable Fuel-Metering Output', url: '/calibration.html#fuelpump-min-cal-row' },
      { label: 'Throttle Idle Max %', url: '/controllers.html#throttle' },
    ]
  },
  TimedDelay: {
    desc: 'Pauses the sequence for the configured duration. No actuator changes.',
    links: []
  },
  ABCheckReady: {
    desc: 'Gate block: checks N1, selected EGT, and throttle conditions before proceeding with AB ignition.',
    links: []
  },
  ABIgnite: {
    desc: 'Fires AB ignition - torch (fuel spike through turbine), AB igniter, or both.',
    links: [
      { label: 'Afterburner Ignition Method', url: '/controllers.html#ab-ign-section' },
    ]
  },
  ABFlameConfirm: {
    desc: 'Waits for AB flame confirmation using sensor, selected EGT rise, or timed mode.',
    links: [
      { label: 'Afterburner Flame Confirmation', url: '/controllers.html#ab-flame-section' },
    ]
  },
  ABStabilize: {
    desc: 'Hold period after AB lights. Monitors selected EGT - faults if too hot. Transitions to AB Running on exit.',
    links: [
      { label: 'Stabilize Hold', url: '/controllers.html#cf-ab_sms' },
      { label: 'Stabilize Max EGT', url: '/controllers.html#cf-ab_smt' },
    ]
  },
  GovernorHold: {
    desc: 'Waits until N2 remains within the configured band around the governor target before completing.',
    links: [
      { label: 'Automatic N2 Speed Control', url: '/controllers.html#governor-cfg-section' },
    ]
  },
  FuelPumpRamp: {
    desc: 'Ramps the secondary or auxiliary fuel pump from the selected start demand to the end demand over the configured duration.',
    links: []
  },
  FuelPump2Set: {
    desc: 'Sets secondary / auxiliary fuel pump demand to a fixed value immediately.',
    links: []
  },
  FuelPump2On: {
    desc: 'Switches relay-type secondary / auxiliary fuel pump on.',
    links: []
  },
  FuelPump2Off: {
    desc: 'Switches relay-type secondary / auxiliary fuel pump off.',
    links: []
  },
};

// ------ Block info panel ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
let _openBlockInfoPanel = null;

function showBlockInfo(bname, trigger) {
  const card = trigger?.closest('.block-card');
  const panel = card?.querySelector('.block-info-panel');
  if (!panel) return;

  if (_openBlockInfoPanel === panel && !panel.hidden) {
    hideBlockInfo(panel);
    return;
  }

  hideBlockInfo();
  const def = BLOCKS[bname] || {};
  const starter = !!card.querySelector('[data-starter-ramp-preview]');
  const info = bname === 'SetOutput' ? {
    desc: `<p>${def.desc} For proportional outputs, 0% is off and 100% is the configured full output.</p>` +
      (starter ? '<p>Speed change time sets how long the starter command takes to reach its new target. Set it to 0 for an immediate change. STOP and faults still cut starter demand immediately.</p><p>Rate is in percentage points per second (pp/s). If a new command arrives before the previous ramp finishes, it starts from the demand reached so far. After a condition wait, the starting demand depends on when the wait ends.</p>' :
        '<p>Hardware sets the output level and any ramp for an on/off ignition command.</p>')
  } : BLOCK_INFO[bname] || { desc: def.desc || 'This block is configured entirely within the sequence.', links: [] };
  const infoLinks = info.links || [];
  const linksHtml = infoLinks.length
    ? `<div class="bip-links-label">Related settings:</div><div class="bip-links">` +
      infoLinks.map(l => `<a class="bip-link" href="${l.url}">${l.label}</a>`).join('') +
      '</div>'
    : bname === 'SetOutput' ? '' : '<div class="bip-links-label" style="color:var(--dim)">No external settings - all parameters are set directly on this block.</div>';
  panel.innerHTML = `
    <div class="bip-header">
      <span class="bip-name">${esc(card.querySelector('.block-name')?.textContent || def.label || bname)}</span>
      <button type="button" class="bip-close" aria-label="Close block explanation" onclick="hideBlockInfo(this.closest('.block-info-panel'))">Close</button>
    </div>
    <div class="bip-desc">${info.desc}</div>
    ${linksHtml}`;
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  trigger.classList.add('active');
  _openBlockInfoPanel = panel;
}

function hideBlockInfo(panel = _openBlockInfoPanel) {
  if (!panel) return;
  panel.hidden = true;
  const trigger = panel.closest('.block-card')?.querySelector('.bip-btn');
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('active');
  }
  if (_openBlockInfoPanel === panel) _openBlockInfoPanel = null;
}
