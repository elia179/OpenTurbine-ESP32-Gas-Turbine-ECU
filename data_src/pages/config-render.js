function startupGuardHasTrip(){
  const hard=document.getElementById('cf-sf_st_en')?.checked?Number(document.getElementById('cf-sf_st')?.value):0;
  const timed=document.getElementById('cf-sf_sd_en')?.checked?Number(document.getElementById('cf-sf_sd')?.value):0;
  return (hard>0||timed>0)&&(!document.getElementById('cf-sf_st_en')?.checked||hard>0)&&
    (!document.getElementById('cf-sf_sd_en')?.checked||(timed>0&&Number(document.getElementById('cf-sf_sm')?.value)>0))&&
    !(hard>0&&timed>=hard);
}
function refreshProtectionSummaries(){
  for(const card of document.querySelectorAll('.protection-card[data-protection]')){
    const key=card.dataset.protection,mode=card.querySelector('.protection-modes');if(!mode)continue;
    const field={n1:'pb_n1e',n2:'pb_n2e',egt:'pb_egte',p1:'pb_p1e',p2:'pb_p2e',torque:'pb_tqe'}[key];
    if(field){const checkbox=document.getElementById('cf-'+field+'_on'),available=checkbox?.closest('.cfg-field')?.dataset.hardwareUnavailable!=='1',enabled=!!checkbox?.checked;
      mode.lastElementChild.dataset.enabled=String(enabled&&available);mode.lastElementChild.dataset.state=enabled&&!available?'check':'';
      mode.lastElementChild.textContent='Fuel limiting: '+(!enabled?'OFF':!available?'unavailable':'ON — '+(Number(document.getElementById('cf-'+field)?.value)===1?'Predictive':'Simple'));}
    const phaseField={low_oil:'sf_oil_modes',fuel_press_low:'sf_fp_modes'}[key];
    if(phaseField){const status=mode.firstElementChild,phase=document.getElementById('cf-'+phaseField);
      if(status&&phase)status.textContent=status.textContent.split(' · ')[0]+' · '+({2:'Startup',4:'Running',6:'Startup and Running'}[Number(phase.value)]||'Check monitoring phases');}
    const trip=mode.querySelector('[data-trip-state]');
    if(trip){
      const prefix={p1:'sf_p1',p2:'sf_p2',torque:'sf_tq'}[key];
      const threshold=document.getElementById('cf-'+prefix+'t'),delay=document.getElementById('cf-'+prefix+'d');
      const limit=Number(threshold?.value),ms=Number(delay?.value);
      const fitted=controllerInputs({p1:'p1_pressure',p2:'p2_pressure',torque:'torque'}[key]).length>0;
      trip.textContent=!fitted?'Fault shutdown: unavailable — fit an input':
        !Number.isFinite(limit)||limit<0?'Fault shutdown: check limit':
        !document.getElementById('cf-'+prefix+'en')?.checked?'Fault shutdown: OFF — limit retained':
        limit===0?'Fault shutdown: check limit':
        'Fault shutdown: ON — '+limit+' '+(key==='torque'?'Nm':pressUnit())+
        (Number.isFinite(ms)&&ms>=0?(ms===0?' · immediate':' · '+ms+' ms confirmation'):' · check confirmation time');
      trip.dataset.enabled=String(fitted&&limit>0&&document.getElementById('cf-'+prefix+'en')?.checked);
    }
  }
  for(const input of document.querySelectorAll('.protection-enable input')){const state=input.parentElement.querySelector('[data-toggle-state]');if(state)state.textContent=input.checked?((input.closest('[data-safety-available="false"]')||input.closest('.cfg-field')?.dataset.hardwareUnavailable==='1')?'CHECK':'ON'):'OFF';}
  for(const badge of document.querySelectorAll('[data-config-safety]')){
    const input=document.getElementById('cf-'+badge.dataset.configSafety),available=input?.closest('.cfg-field')?.dataset.hardwareUnavailable!=='1',on=!!input?.checked;
    badge.textContent=on?(available?'Fault shutdown: ON':'Fault shutdown: unavailable'):'Fault shutdown: OFF';badge.dataset.enabled=String(on&&available);badge.dataset.state=on&&!available?'check':'';
  }
  const guard=document.getElementById('cf-sf_sg_en'),status=document.querySelector('[data-startup-guard-state]');
  if(guard&&status){const ready=startupGuardHasTrip(),available=guard.closest('.cfg-field')?.dataset.hardwareUnavailable!=='1';
    status.textContent='Startup guard: '+(!guard.checked?'OFF':!available?'unavailable':ready?'ON':'needs setup');
    status.dataset.enabled=String(guard.checked&&available&&ready);status.dataset.state=guard.checked&&(!available||!ready)?'check':'';}
  const underspeed=document.getElementById('cf-sf_us_en'),underStatus=document.querySelector('[data-underspeed-state]');
  if(underspeed&&underStatus){const available=underspeed.closest('.cfg-field')?.dataset.hardwareUnavailable!=='1';underStatus.textContent='Underspeed: '+(!underspeed.checked?'OFF':available?'ON':'unavailable');underStatus.dataset.enabled=String(underspeed.checked&&available);underStatus.dataset.state=underspeed.checked&&!available?'check':'';}
  refreshProtectionCount();
}
function refreshProtectionCount(){
  const group=document.querySelector('[data-group="safety"]'),badge=group?.querySelector('[data-protection-active-count]');if(!badge)return;
  // Count enabled functions, independent of filtering and engine edit locks.
  // The startup envelope is one function; its two threshold choices are not double-counted.
  const count=Array.from(group.querySelectorAll('.protection-enable input[type="checkbox"]')).filter(input=>
    input.checked&&!['cf-sf_st_en','cf-sf_sd_en'].includes(input.id)&&(input.id!=='cf-sf_sg_en'||startupGuardHasTrip())&&
    input.closest('.cfg-field')?.dataset.hardwareUnavailable!=='1'&&
    !input.closest('[data-safety-available="false"]')).length;
  badge.textContent=count+' active';badge.dataset.active=String(count>0);
  badge.title='Enabled protection functions with fitted prerequisites, including fuel limiting. Incomplete startup setup is excluded; a valid startup guard counts once. Operation also depends on engine state and each protection’s conditions.';
}
function openProtection(key){
  const card=document.querySelector(`[data-protection="${key}"]`);if(!card)return;
  for(let node=card;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
  requestAnimationFrame(()=>{
    // The desktop workspace wraps with viewport width and browser zoom.
    // Mobile uses a non-sticky workspace, so only the navigation overlaps.
    let offset=0;
    for(const header of document.querySelectorAll('body>nav,.cfg-workspace')){
      const style=getComputedStyle(header);
      if(style.position==='sticky'||style.position==='fixed')
        offset=Math.max(offset,(parseFloat(style.top)||0)+header.getBoundingClientRect().height);
    }
    window.scrollTo({top:Math.max(0,scrollY+card.getBoundingClientRect().top-offset-12),behavior:'smooth'});
  });
}
function refreshStartupGuardUi(){
  const checkbox=document.getElementById('cf-sf_sg_en');if(!checkbox)return;
  refreshProtectionSummaries();
  const enabled=checkbox.checked,part=checkbox.closest('.protection-part');
  if(part)part.querySelector('p').textContent=enabled&&!startupGuardHasTrip()?'Startup guard setup is incomplete. Enable an immediate or sustained trip below and set its positive limit.':enabled?'Separate startup guard is on. Normal temperature shutdown and temperature fuel limiting resume in Running.':'Separate startup guard is off. Normal temperature shutdown and temperature fuel limiting also apply during Startup.';
  for(const key of ['sf_st','sf_sd','sf_sm']){
    const field=document.getElementById('cf-'+key);if(!field)continue;
    field.closest('.cfg-field')?.classList.toggle('protection-dormant',!enabled);
  }
}
// ── JSON path helpers ─────────────────────────────────────────
function getPath(obj, path) {
  return path.reduce((cur, k) => (cur != null && typeof cur === 'object' ? cur[k] : undefined), obj);
}
function setPath(obj, path, val) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] == null || typeof cur[path[i]] !== 'object') cur[path[i]] = {};
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = val;
}

function _independentFittedOutputs() {
  return (hwCfg?.channel_registry?.outputs || []).filter(row =>
    registryChannelInstalled(row) && !String(row?.mirror_of || ''));
}

function _suggestedOutputOptions(path, purposes, chooseLabel) {
  const current = String(getPath(cfg, path) || '');
  const wanted = new Set((Array.isArray(purposes) ? purposes : [purposes]).map(String));
  const outputs = _independentFittedOutputs();
  const suggested = outputs.filter(row => wanted.has(String(row?.purpose || '')));
  const other = outputs.filter(row => !wanted.has(String(row?.purpose || '')));
  const options = [];
  if (current && !outputs.some(row => String(row.id || '') === current))
    options.push({v:current, l:`Missing device: ${current}`});
  if (!current) options.push({v:'', l:chooseLabel || 'Choose output'});
  suggested.forEach(row => options.push({v:String(row.id || ''), l:controllerChannelName(row), group:'Suggested'}));
  other.forEach(row => options.push({v:String(row.id || ''), l:controllerChannelName(row), group:'Other fitted outputs'}));
  return options;
}

function _installedIgnitionOutputs() {
  const wanted = new Set(['igniter','ab_igniter','glow_plug']);
  return _independentFittedOutputs().filter(row => wanted.has(String(row?.purpose || '')));
}

function ignitionOutputOptions(path) {
  return _suggestedOutputOptions(path, ['igniter','ab_igniter','glow_plug'], 'Choose ignition output');
}

function outputOptionsForPurpose(path, purpose, chooseLabel) {
  return _suggestedOutputOptions(path, [purpose], chooseLabel);
}

function migrateBuiltInOutputIds() {
  const migrate = (path, legacyPath) => {
    if (getPath(cfg, path)) return;
    const outputs = _installedIgnitionOutputs();
    if (!outputs.length) return;
    const legacy = Number(getPath(cfg, legacyPath) || 0);
    const purpose = legacy === 1 ? 'ab_igniter' : legacy === 2 ? 'glow_plug' : 'igniter';
    const matching = outputs.filter(row => String(row.purpose || '') === purpose);
    const choice = matching.length === 1 ? matching[0] : null;
    if (choice) setPath(cfg, path, String(choice.id || ''));
  };
  migrate(['relight','output_id'], ['relight','ignition_target']);
  migrate(['misc','igniter_on_start_output_id'], ['misc','igniter_on_start_target']);
  const oilOutputs = (hwCfg?.channel_registry?.outputs || []).filter(row => row?.installed !== false &&
    !String(row?.mirror_of || '') && String(row?.purpose || '') === 'oil_pump');
  if (!getPath(cfg, ['standby_oil','output_id']) && oilOutputs.length === 1)
    setPath(cfg, ['standby_oil','output_id'], String(oilOutputs[0].id || ''));
}

function controllerChannelName(row) {
  if (!row) return '';
  const purposeNames = {
    throttle:'Throttle Input', idle:'Idle Input', n1_speed:'N1 Speed', n2_speed:'N2 Speed',
    oil_pressure:'Oil Pressure', main_fuel:'Main Fuel Metering', oil_pump:'Oil Pump',
    prop_pitch:'Propeller Pitch', ab_pump:'Afterburner Fuel Pump', pilot_fuel:'Pilot Fuel',
    request_shutdown:'Request Normal Shutdown',request_fault:'Request Fault Shutdown'
  };
  const raw = String(row.name || '').trim();
  return raw || purposeNames[row.purpose] || 'Configured channel';
}

// Fixed firmware enums still identify fitted channels by their user names.
function controllerPurposeNames(purposes) {
  return [...new Set(purposes.flatMap(p => controllerInputs(p).map(controllerChannelName)).filter(Boolean))].join(' / ');
}
function controllerTemperaturePurposes() {
  const source = Number(cfg?.safety?.egt_source || 0);
  return source === 1 ? ['tot'] : source === 2 ? ['tit']
    : controllerInputs('tot').length ? ['tot'] : ['tit'];
}
function configuredFieldLabel(field) {
  return field.label.replace(/Pressure ([12])/g, (role, number) => {
    const name=controllerPurposeNames([`p${number}_pressure`]);
    return name && name!==role ? `${name} (P${number})` : role;
  });
}
function configuredSourceOptionLabel(key, option) {
  const value = Number(option.v), egt = controllerTemperaturePurposes();
  const sources = {
    eg_src: {0:controllerInputs('tot').length ? ['tot'] : ['tit'],1:['tot'],2:['tit']},
    di_src: {0:['n1_speed'],1:['n2_speed'],2:['p1_pressure'],3:['p2_pressure']},
    so_src: {0:['n1_speed'],1:['n2_speed'],2:['n1_speed','n2_speed']},
    sf_fs: {0:['flame','n1_speed',...egt],1:['flame'],2:['n1_speed'],3:egt},
    rl_ts: {0:['flame','n1_speed',...egt],1:['flame'],2:['n1_speed'],3:egt},
    rl_cs: {1:['flame'],2:['n1_speed'],3:egt},
    ab_pcm: {1:['throttle'],2:['ab_command']},
  };
  const names = controllerPurposeNames(sources[key]?.[value] || []);
  return names ? `${names} — ${option.l}` : option.l;
}

function _resolveControllerChannelId(value, rows, kind, numericValue) {
  const raw = String(value || '');
  const exact = rows.find(row => String(row.id) === raw);
  if (exact) return exact.id;
  const inputAliases = {oil_temp:'oil_temperature',tot:'tot',n1_rpm:'n1_speed',oil_press:'oil_pressure',tit:'tit',batt_v:'battery_voltage',n2_rpm:'n2_speed',fuel_press:'fuel_pressure',fuel_flow:'fuel_flow',p1:'p1',p2:'p2',torque:'torque',flame:'flame',throttle_input:'throttle',idle_input:'idle',ab_flame:'ab_flame',ab_input:'ab_input',start_switch:'start_switch',stop_switch:'stop_switch',thrust:'thrust'};
  const outputAliases = {cool_fan:'cooling_fan',bleed_valve:'bleed_valve',fuel_pump2:'fuel_pump',oil_scavenge:'oil_scavenge',throttle:'main_fuel',main_fuel:'main_fuel',starter:'starter',starter_enable:'starter_enable',oil_pump:'oil_pump',fuel_sol:'fuel_shutoff',igniter:'igniter',igniter2:'ab_igniter',ab_sol:'ab_fuel',ab_pump:'ab_pump',air_starter:'air_starter',glow_plug:'glow_plug',prop_pitch:'prop_pitch'};
  const aliases = kind === 'input' ? inputAliases : outputAliases;
  const purpose = aliases[raw] || raw;
  const purposeMatches = rows.filter(row => String(row.purpose) === purpose || String(row.role) === purpose);
  if (purposeMatches.length === 1) return purposeMatches[0].id;
  const n = Number(numericValue);
  if (Number.isFinite(n)) {
    if (n >= 64 && rows[n - 64]) return rows[n - 64].id;
    const legacy = kind === 'input'
      ? ['oil_temperature','tot','n1_speed','oil_pressure','tit','battery_voltage','n2_speed','di0','di1','di2','di3','fuel_pressure','fuel_flow','p1','p2','torque','flame','throttle','idle','ab_flame','glow_current','igniter_current','igniter2_current','oil_pump_current','ab_input','start_switch','stop_switch','thrust'][n]
      : ['cooling_fan','bleed_valve','fuel_pump','oil_scavenge','main_fuel','starter','starter_enable','oil_pump','fuel_shutoff','igniter','ab_igniter','ab_fuel','ab_pump','','','air_starter','glow_plug','prop_pitch'][n];
    const legacyMatches = rows.filter(row => String(row.purpose) === legacy || String(row.role) === legacy);
    if (legacyMatches.length === 1) return legacyMatches[0].id;
  }
  return raw;
}

function _defaultRuleForOutput(channel) {
  const inputs = simpleControlInputs();
  const relay = [4,11].includes(Number(channel.driver));
  if (['request_shutdown','request_fault'].includes(String(channel.purpose))) {
    return {enabled:true,kind:0,op:0,threshold:0,hysteresis:0,on_value:1,off_value:0,
      input_min:0,input_max:1,output_min:0,output_max:1,mode_mask:4,
      target_source_type:0,target_source:'',target_fixed:0,target_low:0,target_high:1,
      target_input_min:0,target_input_max:1,response_gain:.02,integral_gain:.005,deadband:.01,
      name:channel.name,source:'',target:channel.id};
  }
  // Main fuel naturally follows the sole throttle input. Every other new
  // controller starts as an explicit fixed command so merely creating it can
  // never make an unrelated first registry input control physical hardware.
  const source = String(channel.purpose) === 'main_fuel'
    ? inputs.find(row => String(row.purpose) === 'throttle') : null;
  const minFuel = String(channel.purpose) === 'main_fuel'
    ? Math.max(0, Math.min(1, Number(cfg?.throttle?.fuel_pump_min_pct || 0) / 100)) : 0;
  return {enabled:true,kind:source?(relay?0:1):3,op:0,threshold:0,hysteresis:0,on_value:source?1:0,off_value:0,
    input_min:0,input_max:1,output_min:minFuel,output_max:1,mode_mask:4,activate_events:4,deactivate_events:24,
    target_source_type:0,target_source:'',target_fixed:0,target_low:0,target_high:1,
    target_input_min:0,target_input_max:1,response_gain:.02,integral_gain:.005,deadband:.01,
    name:`${controllerChannelName(channel)} control`.slice(0,31),source:source?.id || '',target:channel.id};
}

function createControllerForOutput(outputId) {
  const outputs = simpleControlOutputs();
  const channel = outputs.find(row => String(row.id) === String(outputId));
  if (!channel || (cfg.rules || []).length >= 16) return;
  const purpose = String(channel.purpose || '');
  hwCfg.controllers ||= {};
  if (purpose === 'main_fuel' || purpose === 'prop_pitch') hwCfg.controllers.governor = false;
  if (purpose === 'oil_pump') {
    hwCfg.oil_loops = (hwCfg.oil_loops || []).filter(loop => String(loop.pump_output) !== String(channel.id));
    hwCfg.controllers.oil_loop = !!hwCfg.oil_loops.some(loop => loop.enabled !== false);
  }
  cfg.rules ||= [];
  cfg.rules.push(_defaultRuleForOutput(channel));
  const created=cfg.rules[cfg.rules.length-1];
  if(!OTControllerTiming.scheduled(created)){created.activate_events=4;created.deactivate_events=24;}
  window.OTControllerTiming?.ensureIds(cfg.rules);
  _controllerRulesDirty = true;
  if (!channel.virtual) _controllerHardwareDirty = true;
  _markDirty();
  renderForm(true);
  _applyAllVisibility();
  applyView();
  runValidation();
}

function migrateLegacyControllerDefinitions() {
  if (Number(cfg?.controller_schema || 0) >= 1) return false;
  const outputs = simpleControlOutputs();
  const inputs = simpleControlInputs();
  cfg.rules ||= [];
  const owns = output => cfg.rules.some(rule =>
    _resolveControllerChannelId(rule.target, outputs, 'output', rule.actuator) === output.id);
  const uniquePurpose = (rows, purpose) => {
    const matches = rows.filter(row => String(row.purpose) === purpose);
    return matches.length === 1 ? matches[0] : null;
  };
  const mainFuel = uniquePurpose(outputs, 'main_fuel');
  const propPitch = uniquePurpose(outputs, 'prop_pitch');
  const throttle = uniquePurpose(inputs, 'throttle');
  const n2 = uniquePurpose(inputs, 'n2_speed');
  let hardwareChanged = false;

  if (hwCfg.controllers?.governor && n2) {
    const usePitch = propPitch && Number(cfg?.governor?.pitch_kp || 0) > 0;
    const output = usePitch ? propPitch : mainFuel;
    if (output && !owns(output)) {
      const rule = _defaultRuleForOutput(output);
      rule.name = `${controllerChannelName(output)} N2 control`.slice(0,31);
      rule.kind = 2;
      rule.source = n2.id;
      rule.target_source_type = throttle ? 2 : 0;
      rule.target_source = throttle?.id || '';
      rule.target_fixed = Number(cfg?.governor?.target_rpm || 0);
      rule.target_input_min = 0;
      rule.target_input_max = 1;
      rule.target_low = Number(cfg?.governor?.target_rpm || 0);
      rule.target_high = Number(cfg?.governor?.target_rpm || 0);
      rule.response_gain = Math.max(0, Number(cfg?.governor?.kp || .00025));
      rule.deadband = Math.max(0, Number(cfg?.governor?.band_rpm || 500));
      cfg.rules.push(rule);
    }
    hwCfg.controllers.governor = false;
    hardwareChanged = true;
  } else if (mainFuel && throttle && !owns(mainFuel)) {
    const rule = _defaultRuleForOutput(mainFuel);
    rule.name = 'Main Fuel';
    rule.kind = 1;
    rule.source = throttle.id;
    cfg.rules.push(rule);
  }

  cfg.controller_schema = 1;
  _controllerRulesDirty = true;
  if (hardwareChanged) _controllerHardwareDirty = true;
  return true;
}

function renderControllerOverview() {
  const root = document.getElementById('controller-overview');
  if (!root || CONFIG_SURFACE !== 'controllers') return;
  const outputs = simpleControlOutputs();
  const rules = cfg.rules || [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const configuredCards = [...document.querySelectorAll('#simple-controls [data-controller-card]')];
  const configuredIds = new Set(rules.map(rule => String(rule.target || '')));
  const oilLoopOutputs = new Set((hwCfg.oil_loops || []).filter(loop => loop.enabled !== false).map(loop => String(loop.pump_output || '')));
  const configuredOilOutputs = new Set((hwCfg.oil_loops || []).map(loop => String(loop.pump_output || '')));
  const oilLoopCards = outputs.filter(channel => configuredOilOutputs.has(String(channel.id)) && !configuredIds.has(String(channel.id))).map(channel => {
    const loops = (hwCfg.oil_loops || []).filter(loop => String(loop.pump_output || '') === String(channel.id));
    const enabled = hwCfg.controllers?.oil_loop !== false ? loops.filter(loop => loop.enabled !== false).length : 0;
    const status = enabled === loops.length ? 'Enabled' : enabled ? `${enabled}/${loops.length} Enabled` : 'Disabled';
    return `<details class="control-definition-card config-group" data-group="oil-loop-${esc(channel.id)}" data-purpose="oil_pump"><summary><span class="group-heading"><span class="group-title">${esc(controllerChannelName(channel))}</span><span class="control-path">Oil pressure feedback<span class="arrow">→</span>${esc(controllerChannelName(channel))}</span><span class="group-desc">User-configured pressure controller</span></span><span class="controller-summary-status ${enabled?'enabled':'disabled'}">${status}</span></summary><div class="controller-card-body"><div class="controller-local-settings" data-oil-loop-settings="${esc(channel.id)}"></div></div></details>`;
  }).join('');
  // The built-in AB running state owns its pump continuously while active.
  // Other transition outputs remain available to a user controller; sequence,
  // relight and safety commands still take authority in their defined states.
  const unavailableToRules = new Set([...oilLoopOutputs]);
  outputs.filter(channel => String(channel.purpose) === 'ab_pump').forEach(channel => unavailableToRules.add(String(channel.id)));
  const available = outputs.filter(channel => !unavailableToRules.has(String(channel.id)));
  const freeOilPumps = outputs.filter(channel => String(channel.purpose) === 'oil_pump' &&
    !configuredIds.has(String(channel.id)) && !configuredOilOutputs.has(String(channel.id)));
  const oilPressureInputs = controllerInputs('oil_pressure');
  const canAddOilLoop = freeOilPumps.length && oilPressureInputs.length;
  const oilLoopCreator = canAddOilLoop ? `<div class="cfg-grid"><label class="cfg-field"><span class="cfg-label">Oil pump</span><select id="new-oil-loop-output">${freeOilPumps.length>1?'<option value="">Choose pump</option>':''}${freeOilPumps.map(row=>`<option value="${esc(row.id)}">${esc(controllerChannelName(row))}</option>`).join('')}</select></label><label class="cfg-field"><span class="cfg-label">Pressure feedback</span><select id="new-oil-loop-pressure">${oilPressureInputs.length>1?'<option value="">Choose pressure input</option>':''}${oilPressureInputs.map(row=>`<option value="${esc(row.id)}">${esc(controllerChannelName(row))}</option>`).join('')}</select></label></div><button type="button" onclick="addControllerOilLoop(document.getElementById('new-oil-loop-output').value,document.getElementById('new-oil-loop-pressure').value)">Create oil-pressure controller</button>` : '';
  const availableHtml = (available.length || canAddOilLoop) ? `<details class="controller-create-card" data-always-visible="1"><summary class="controller-create-title"><span>+ Create controller</span><span class="group-chevron">›</span></summary><div class="controller-create-body">${available.length?`<label class="cfg-field"><span class="cfg-label">What do you want to control?</span><select id="new-controller-output">${available.map(row=>`<option value="${esc(row.id)}">${esc(controllerChannelName(row))}</option>`).join('')}</select><span class="cfg-desc">Create a threshold, mapping, feedback-target, or fixed-state controller.</span></label><button type="button" class="primary" onclick="createControllerForOutput(document.getElementById('new-controller-output').value)">Create controller</button>`:''}${oilLoopCreator}</div></details>` : '<div class="control-empty">Every fitted normal-operation output already has an owner.</div>';
  const purposes = new Set(outputs.map(channel => String(channel.purpose || '')));
  const builtIn = (id, title, desc) => `<details class="control-definition-card config-group built-in-subsystem" data-built-in="${id}"><summary><span class="group-heading"><span class="group-title">${title}</span><span class="group-desc">${desc}</span></span><span class="group-chevron">›</span></summary><div class="controller-card-body" data-built-in-settings="${id}"></div></details>`;
  const builtIns = [
    purposes.has('main_fuel') ? builtIn('fuel-support','Fuel-metering support','Throttle shaping, automatic idle, and reduced-power behavior') : '',
    (purposes.has('igniter') || purposes.has('ab_igniter') || purposes.has('glow_plug')) ? builtIn('relight','Ignition and relight','Automatic and operator-requested relight behavior during RUNNING') : '',
    purposes.has('oil_pump') ? builtIn('windmilling-oil','Windmilling oil protection','Protective oil flow while a fitted shaft rotates outside normal running') : '',
    (purposes.has('ab_pump') || purposes.has('ab_igniter') || purposes.has('ab_fuel') || purposes.has('ab_fuel_shutoff')) ? builtIn('afterburner','Afterburner subsystem','Light-up method, flame confirmation, and lit-running fuel behavior') : ''
  ].join('');
  const needsSequence=(cfg.rules||[]).some(r=>r.enabled!==false&&window.OTControllerTiming?.status(r,hwCfg,cfg.rules)==='Sequence needs setup');
  const sequenceNotice=needsSequence?'<div class="controller-warning" role="status"><b>Sequence needs attention</b><span>Save controller changes, then place and save the required controller blocks. Affected controllers stay inactive until setup is complete, or disable the controller.</span><a href="/sequence.html">Open Sequence</a></div>':'';
  root.innerHTML = `${sequenceNotice}<div class="control-overview-head"><div><h2>Output controllers</h2><p>User-owned normal control for fitted outputs. Only one active controller per output.</p></div></div><div id="configured-controller-cards" class="controller-definition-list"></div>${oilLoopCards}<div class="controller-create-wrap">${availableHtml}</div><div class="control-overview-head built-in-heading"><div><h2>Built-in turbine subsystems</h2><p>Optional ECU behaviors that temporarily command outputs during their defined sequence, protection, or relight state. They do not prevent a separate normal output controller.</p></div></div><div id="built-in-subsystems" class="controller-definition-list">${builtIns}</div>`;
  const list = document.getElementById('configured-controller-cards');
  configuredCards.forEach(card => list?.appendChild(card));
  // Controller definitions are rendered in a temporary section so the normal
  // field builder can create them. Once moved into the overview, discard that
  // empty section instead of leaving a blank themed card in the page flow.
  document.getElementById('simple-controls')?.remove();
  root.style.display = '';
  _mountControllerLocalSettings(outputs);
}

function _mountControllerLocalSettings(outputs) {
  const sectionMap = {
    'fuel-support':['throttle','idle-control-cfg-section','reduced-power-section'],
    relight:['relight-section','manual-relight-section'],
    'windmilling-oil':['windmilling-oil-section'],
    afterburner:['ab-ign-section','ab-flame-section','ab-run-section']
  };
  const localSectionIds = new Set(Object.values(sectionMap).flat().concat(['oil-config-section','governor-cfg-section']));
  const mounted = new Set();
  const wrapSection = (host, section, title, desc='') => {
    if (!section) return null;
    const card = document.createElement('details');
    card.className = 'protection-card controller-subcard';
    card.dataset.subcard = title;
    card.innerHTML = `<summary><span><span class="protection-card-title">${_escHtml(title)}</span>${desc?`<span class="protection-card-desc">${_escHtml(desc)}</span>`:''}</span><span class="protection-card-chevron">›</span></summary><div class="controller-subcard-content"></div>`;
    card.querySelector('.controller-subcard-content').appendChild(section);
    host.appendChild(card);
    mounted.add(section.id);
    return card;
  };
  const mountOilLoop = (host, channel) => {
    const pressures = controllerInputs('oil_pressure');
    const pumps = controllerOutputs('oil_pump');
    const loopIndex = (hwCfg.oil_loops || []).findIndex(loop => String(loop.pump_output) === String(channel.id));
    if (loopIndex < 0) {
      const empty = document.createElement('div');
      empty.className = 'controller-empty-action';
      empty.innerHTML = pressures.length
        ? `<span>No pressure-feedback controller is assigned. Sequence and direct commands can still operate this pump.</span><button type="button" onclick="addControllerOilLoop('${_escHtml(String(channel.id))}')">+ Add pressure controller</button>`
        : '<span>No pressure-feedback controller is assigned. Fit an oil-pressure input to add one; sequence and direct commands remain available.</span>';
      host.appendChild(empty);
      return;
    }
    const loop = hwCfg.oil_loops[loopIndex];
    const binary = [4,11].includes(Number(channel.driver));
    const source = Number(loop.target_source || 0);
    const lowResponse = Number(loop.low_pressure_response ?? 2);
    const feedbackResponse = Number(loop.feedback_loss_response ?? 2);
    const responseOptions = selected => `<option value="0"${selected===0?' selected':''}>Disabled</option><option value="1"${selected===1?' selected':''}>Warning only</option><option value="2"${selected===2?' selected':''}>Normal fault shutdown</option><option value="3"${selected===3?' selected':''}>Immediate dry-oil stop</option>`;
    const options = (rows, selected) => rows.map(row => `<option value="${_escHtml(row.id)}"${String(row.id)===String(selected)?' selected':''}>${_escHtml(controllerChannelName(row))}</option>`).join('');
    const number = (key,label,value,step,min=0,max='',percent=false) => `<label class="cfg-field"><span class="cfg-label">${_escHtml(label)}${percent?' (%)':''}</span><input type="number" min="${min}"${max!==''?` max="${max}"`:''} step="${step}" value="${Number(value)}" onchange="updateControllerOilLoop(${loopIndex},'${key}',+this.value${percent?'/100':''})"></label>`;
    const pressure = (key,label,value,step,max=20) => `<label class="cfg-field"><span class="cfg-label">${_escHtml(label)} (${dispPressUnit()})</span><input type="number" min="0" max="${toDispPress(max)}" step="${toDispPress(step)}" value="${Math.round(toDispPress(Number(value))*1000)/1000}" onchange="updateControllerOilLoop(${loopIndex},'${key}',fromDispPress(+this.value))"></label>`;
    const card = document.createElement('details');
    card.className = 'protection-card controller-subcard';
    card.dataset.subcard = 'Oil Pressure Control';
    card.innerHTML = `<summary><span><span class="protection-card-title">Oil Pressure Control</span><span class="protection-card-desc">${binary?'On/off pressure regulation':'Variable pressure regulation'}</span></span><span class="protection-card-chevron">›</span></summary><div class="controller-subcard-content"><div class="controller-card-actions"><label class="controller-enabled"><input aria-label="Oil pressure controller enabled" type="checkbox" ${hwCfg.controllers?.oil_loop !== false && loop.enabled !== false?'checked':''} onchange="updateControllerOilLoop(${loopIndex},'enabled',this.checked)"> Enabled</label></div><div class="cfg-grid">
      <label class="cfg-field"><span class="cfg-label">Pressure feedback</span><select onchange="updateControllerOilLoop(${loopIndex},'pressure_input',this.value)">${options(pressures,loop.pressure_input)}</select></label>
      <label class="cfg-field"><span class="cfg-label">Controlled pump</span><select onchange="updateControllerOilLoop(${loopIndex},'pump_output',this.value)">${options(pumps,loop.pump_output)}</select></label>
      <label class="cfg-field"><span class="cfg-label">Pressure target set by</span><select onchange="updateControllerOilLoop(${loopIndex},'target_source',+this.value)"><option value="0"${source===0?' selected':''}>Fixed pressure</option><option value="1"${source===1?' selected':''}>Main fuel demand</option>${controllerInputs('n1_speed').length?`<option value="2"${source===2?' selected':''}>${_escHtml(controllerPurposeNames(['n1_speed']))} (N1 speed)</option>`:''}${controllerInputs('n2_speed').length?`<option value="3"${source===3?' selected':''}>${_escHtml(controllerPurposeNames(['n2_speed']))} (N2 speed)</option>`:''}</select></label>
      ${pressure('target_bar',source===0?'Pressure target':'Low pressure target',loop.target_bar??2.5,.01)}
      ${source!==0?pressure('target_high_bar','High pressure target',loop.target_high_bar??2.5,.01):''}
      ${source>=2?number('speed_min_rpm','Low shaft speed (RPM)',loop.speed_min_rpm??0,100,0,1000000):''}
      ${source>=2?number('speed_max_rpm','High shaft speed (RPM)',loop.speed_max_rpm??20000,100,0,1000000):''}
      ${pressure('deadband_bar','Pressure deadband',loop.deadband_bar??.2,.01,5)}
      ${binary?'':number('response_gain','Response gain',loop.response_gain??1.8,.05,0,100)}
      ${binary?'':number('min_demand','Minimum pump command',Math.round(Number(loop.min_demand??.18)*100),1,0,100,true)}
      ${binary?'':number('max_demand','Maximum pump command',Math.round(Number(loop.max_demand??1)*100),1,0,100,true)}
      ${number('failsafe_delay_ms','Feedback-loss delay (ms)',loop.failsafe_delay_ms??1500,100,0,60000)}
      ${number('failsafe_demand','Feedback-loss pump command',Math.round(Number(loop.failsafe_demand??.6)*100),1,0,100,true)}
      <label class="cfg-field"><span class="cfg-label">If pressure feedback is lost</span><select onchange="updateControllerOilLoop(${loopIndex},'feedback_loss_response',+this.value)">${responseOptions(feedbackResponse)}</select><span class="cfg-desc">The fixed feedback-loss pump command above remains active for Warning or Normal shutdown. Immediate mode cuts every hazardous output first.</span></label>
      ${pressure('low_pressure_bar','Low-pressure threshold',loop.low_pressure_bar??1,.01)}
      ${number('low_pressure_confirm_ms','Low-pressure confirmation (ms)',loop.low_pressure_confirm_ms??500,50,0,60000)}
      <label class="cfg-field"><span class="cfg-label">If running pressure stays low</span><select onchange="updateControllerOilLoop(${loopIndex},'low_pressure_response',+this.value)">${responseOptions(lowResponse)}</select><span class="cfg-desc">Warning reports only. Normal shutdown cuts combustion and runs the configured shutdown sequence. Immediate mode skips that sequence to protect dry bearings.</span></label>
      ${lowResponse===3||feedbackResponse===3?number('immediate_pump_run_s','Pump-only time after immediate stop (s)',loop.immediate_pump_run_s??10,.5,0,120):''}
      ${lowResponse===3||feedbackResponse===3?'<div class="cfg-field"><span class="cfg-label">Immediate dry-oil behavior</span><span class="cfg-desc">Fuel, ignition, starter, afterburner, cooling and scavenge outputs turn off immediately. Only this selected oil pump keeps its feedback-loss command for the bounded time above. Restart stays locked until the fault is cleared; reboot also clears faults.</span></div>':''}
      <div class="cfg-field"><button type="button" class="danger" onclick="removeControllerOilLoop(${loopIndex})">Remove pressure controller</button></div>
    </div></div>`;
    host.appendChild(card);
  };
  outputs.filter(channel => String(channel.purpose) === 'oil_pump').forEach(channel => {
    const host = document.querySelector(`[data-oil-loop-settings="${CSS.escape(String(channel.id))}"]`);
    if (host) mountOilLoop(host, channel);
  });
  Object.entries(sectionMap).forEach(([subsystem, ids]) => {
    const host = document.querySelector(`[data-built-in-settings="${CSS.escape(subsystem)}"]`);
    if (!host) return;
    if (subsystem === 'fuel-support') {
      wrapSection(host, document.getElementById('throttle'), 'Throttle Response', 'Normal operator-demand movement and sensitivity');
      wrapSection(host, document.getElementById('idle-control-cfg-section'), 'Idle', 'Minimum normal-running fuel authority');
      wrapSection(host, document.getElementById('reduced-power-section'), 'Reduced-Power Mode', 'Fuel cap used after selected feedback is lost or when requested manually');
      return;
    }
    ids.forEach(id => {
      if (mounted.has(id)) return;
      const section = document.getElementById(id);
      if (section) {
        const card = wrapSection(host, section, section.dataset.section || section.querySelector('.cfg-title')?.textContent || 'Settings');
        if (id === 'windmilling-oil-section' && card &&
            !controllerInputs('n1_speed').length && !controllerInputs('n2_speed').length) {
          card.querySelector('.controller-subcard-content').insertAdjacentHTML('afterbegin',
            '<div class="controller-empty-action"><span>Unavailable because no shaft-speed input is fitted. Windmilling protection needs N1 or N2 feedback to know that a stopped engine is still rotating.</span></div>');
        }
      }
    });
  });
  localSectionIds.forEach(id => {
    if (mounted.has(id)) return;
    document.getElementById(id)?.remove();
  });
  document.querySelectorAll('#cfg-form .config-group').forEach(group => {
    if (!group.querySelector('.cfg-section')) group.remove();
  });
}

function simpleControlInputs() {
  const rows=(hwCfg?.channel_registry?.inputs || []).filter(row => row && row.installed !== false);
  if(hwCfg?.mavlink?.enabled && Number(hwCfg.mavlink.rx_pin??-1)>=0) rows.push({id:'mavlink_throttle',name:'MAVLink throttle demand',purpose:'throttle',installed:true});
  return rows;
}
function controllerSwitchInput(id) {
  const row=(hwCfg?.channel_registry?.inputs||[]).find(input=>String(input.id)===String(id));
  return !!row && (registryInputIsBinary(row)||Number(row.driver)===8||['flame','ab_flame'].includes(String(row.purpose)));
}
function controllerSwitchSettingsReady(rule) {
  const threshold=Number(rule.threshold),op=Number(rule.op||0);
  return Number(rule.hysteresis||0)===0 && (op===0?threshold>=0&&threshold<1:op===1&&threshold>0&&threshold<=1);
}
function setControllerSwitchState(index,op) {
  const rule=cfg.rules?.[index];if(!rule)return;
  rule.threshold=.5;rule.hysteresis=0;
  updateSimpleControl(index,'op',Number(op));
}

// Presentation only: controller configuration keeps its existing engineering units.
function controllerInputDisplay(id) {
  const row = simpleControlInputs().find(input => String(input.id) === String(id));
  const purpose = String(row?.purpose || '');
  if (['throttle','idle','ab_input'].includes(purpose)) return {scale:100,unit:'%'};
  if (purpose.includes('pressure')) return {scale:1,unit:'bar'};
  if (['n1_speed','n2_speed','shaft_speed'].includes(purpose)) return {scale:1,unit:'RPM'};
  if (['tot','tit','oil_temperature'].includes(purpose)) return {scale:1,unit:'°C'};
  if (purpose === 'battery_voltage') return {scale:1,unit:'V'};
  if (purpose.includes('current')) return {scale:1,unit:'A'};
  if (purpose === 'torque') return {scale:1,unit:'Nm'};
  if (purpose === 'thrust') return {scale:1,unit:'N'};
  if (purpose.includes('flow')) return {scale:1,unit:'L/min'};
  return {scale:1,unit:''};
}

// Interpret old files for display only. Never rewrite their behavior on load
// or during unrelated saves. A retained Startup value needs an explicit choice.
function displayedIdleMode() {
  const mode = Number(cfg?.dynamic_idle?.fuel_mode || 0);
  if (mode) return mode;
  if (hwCfg?.controllers?.dynamic_idle) return 4;
  if (controllerInputs('idle').length) return 3;
  return 0;
}
function automaticIdleRequirements() {
  const fuel = registryOutputByPurpose('main_fuel');
  const source = Number(cfg?.dynamic_idle?.source || 0);
  const purpose = ['n1_speed','n2_speed','p1_pressure','p2_pressure'][source];
  const name = controllerChannelName(controllerInputs(purpose)[0]) ||
    ['N1 speed','N2 speed','Pressure 1','Pressure 2'][source] || 'selected feedback';
  const missing = [];
  if (!fuel || ![5,6].includes(Number(fuel.driver))) missing.push('a proportional Main Fuel output (PWM or servo/ESC)');
  if (!controllerInputs(purpose).length) missing.push(`a fitted ${name} input`);
  return missing.length ? `Automatic Idle needs ${missing.join(' and ')}. Configure it in Hardware before saving.` : '';
}
function configuredIdleSource() {
  const mode = Number(cfg?.dynamic_idle?.fuel_mode || 0);
  const minimum = Number(cfg?.throttle?.fuel_pump_min_pct || 0);
  const maximum = Number(cfg?.throttle?.idle_max_pct ?? 50);
  const range = `${minimum}%–${maximum}%`;
  if (mode === 1) return {active:false,title:'Off · no idle floor',description:'Throttle can reach zero when Main Fuel Output low is 0%. Pump minimum calibration still cuts unreliable nonzero commands to zero outside Standby.'};
  if (mode === 2) {
    const selected = Number(cfg?.dynamic_idle?.fixed_fuel_pct || 0);
    const effective = selected > 0 ? Math.max(selected,minimum) : 0;
    return {active:effective > 0,title:`Fixed · ${effective}% fuel`,description:`${effective !== selected ? `Selected ${selected}%; raised to the reliable pump minimum. ` : ''}Applies only in Running, replacing retained startup idle. Throttle can demand more; STOP, faults and shutdown can still cut fuel.`};
  }
  if (mode === 4 || (mode === 0 && hwCfg?.controllers?.dynamic_idle)) {
    const source = Number(cfg?.dynamic_idle?.source || 0);
    const feedback = controllerChannelName(controllerInputs(['n1_speed','n2_speed','p1_pressure','p2_pressure'][source])[0]) ||
      ['N1','N2','Pressure 1','Pressure 2'][source];
    const missing = automaticIdleRequirements();
    const multiplier = Number(cfg?.dynamic_idle?.max_multiplier ?? 1.5);
    const multiplied = maximum * multiplier;
    const ceiling = Math.min(100,Math.max(minimum,multiplied));
    const ceilingExplanation = `${maximum}% base ceiling × ${multiplier} range multiplier = ${Number(multiplied.toFixed(3))}%${multiplied > 100 ? ' (capped at 100%)' : minimum > multiplied ? ` (raised to the ${minimum}% pump minimum)` : ''}`;
    return {active:!missing,title:missing ? 'Automatic Idle · setup incomplete' : `Automatic Idle · ${feedback}`,
      description:missing || `Regulates the Running fuel floor using ${feedback}. ${ceilingExplanation}. Available idle-control fuel range: ${minimum}%–${Number(ceiling.toFixed(3))}%. Throttle can request more; STOP and hard protection can still cut fuel.`};
  }
  const explicitId = mode === 3 ? String(cfg?.dynamic_idle?.input_id || '') : '';
  const input = explicitId ? simpleControlInputs().find(row=>String(row.id)===explicitId) : controllerInputs('idle')[0];
  if (input) {
    const display = controllerInputDisplay(input.id);
    const endpoints = explicitId ? `${Number(((cfg.dynamic_idle.input_low ?? 0)*display.scale).toFixed(4))}–${Number(((cfg.dynamic_idle.input_high ?? 1)*display.scale).toFixed(4))}${display.unit ? ' '+display.unit : ''}` : '0–100% calibrated travel';
    return {active:true,title:`Idle input · ${controllerChannelName(input)}`,description:`Maps ${endpoints} to ${range} fuel in Running. Missing or unhealthy input falls back to retained startup idle, bounded by this fuel range. Startup actions are unchanged.`};
  }
  if (mode === 3) return {active:false,title:explicitId ? 'Selected input unavailable' : 'No Idle Input configured',description:'Choose a fitted input below or add an Idle Input in Hardware. No other sensor is selected silently.'};
  if (displayedIdleMode() === 0)
    return {active:(hwCfg?.startup_seq || []).some(step => step === 'FuelPumpIdle' || step?.type === 'FuelPumpIdle'),title:'Running idle needs a mode choice',description:'This file retains Startup idle (zero if not established). Choose a Running Idle Mode before changing Idle settings. Other settings can be saved without changing the current behavior.'};
  return {active:false,title:'No configured idle source',description:'No automatic feedback, idle input, or Set Main Fuel for Idle startup action is configured. The Main Fuel controller’s Output low still defines its mapped minimum.'};
}

function setRunningIdleSource() {
  const selected = Number(document.getElementById('cf-fi_mode')?.value || 0);
  collectConfigFields();
  cfg.dynamic_idle ||= {};
  cfg.dynamic_idle.fuel_mode = selected;
  const mode = Number(cfg.dynamic_idle?.fuel_mode || 0);
  if (mode !== 0) {
    hwCfg.controllers ||= {};
    hwCfg.controllers.dynamic_idle = mode === 4;
    _controllerHardwareDirty = true;
  }
  _markDirty();
  renderForm(true);
  _applyAllVisibility(); applyView(); runValidation();
}
function idleInputOptions() {
  const rows = simpleControlInputs(), current = String(cfg?.dynamic_idle?.input_id || '');
  const options = [{v:'',l:'Automatic: configured Idle Input'}];
  if (current && !rows.some(row=>String(row.id)===current)) options.push({v:current,l:`Missing input: ${current}`});
  return options.concat(rows.map(row=>({v:String(row.id),l:controllerChannelName(row)})));
}
function setIdleInputChannel() {
  const selected = document.getElementById('cf-fi_input')?.value || '';
  const previous = String(cfg?.dynamic_idle?.input_id || '');
  collectConfigFields();
  cfg.dynamic_idle.fuel_mode = 3;
  cfg.dynamic_idle.input_id = selected;
  hwCfg.controllers ||= {};
  hwCfg.controllers.dynamic_idle = false;
  _controllerHardwareDirty = true;
  if (previous !== String(cfg.dynamic_idle.input_id || '')) {
    cfg.dynamic_idle.input_low = 0;
    cfg.dynamic_idle.input_high = 1;
  }
  // Rerender without recollecting the previous source's endpoint controls.
  _markDirty(); renderForm(true);
  _applyAllVisibility(); applyView(); runValidation();
}
function refreshIdleInputSummary() {
  collectConfigFields();
  const summary = document.querySelector('[data-configured-idle-source]');
  const idle = configuredIdleSource();
  if (summary) {
    summary.querySelector('strong').textContent = idle.title;
    summary.querySelector('.cfg-desc').textContent = idle.description;
  }
  _markDirty(); runValidation();
}
function simpleControlOutputs() {
  const physical = (hwCfg?.channel_registry?.outputs || []).filter(row =>
    row && row.installed !== false && !String(row.mirror_of || ''));
  return physical.concat([{
    id:'request_shutdown', name:'Request Normal Shutdown', purpose:'request_shutdown',
    role:'safety_action', driver:4, installed:true, virtual:true
  },{id:'request_fault',name:'Request Fault Shutdown',purpose:'request_fault',role:'safety_action',driver:4,installed:true,virtual:true}]);
}
function feedbackDefaultsForInput(id) {
  const row = simpleControlInputs().find(input => String(input.id) === String(id));
  const purpose = String(row?.purpose || '');
  if (purpose === 'n1_speed' || purpose === 'n2_speed' || purpose === 'shaft_speed')
    return {response_gain:0.00001,integral_gain:0.000001,deadband:100};
  if (purpose.includes('pressure')) return {response_gain:0.1,integral_gain:0.02,deadband:0.05};
  if (purpose.includes('temperature') || purpose === 'tot' || purpose === 'tit')
    return {response_gain:0.005,integral_gain:0.001,deadband:1};
  return {response_gain:0.02,integral_gain:0.005,deadband:0.01};
}
function updateSimpleControl(index, key, value) {
  collectConfigFields();
  const rule = cfg.rules?.[index];
  if (!rule) return;
  const previousTarget = key === 'target'
    ? simpleControlOutputs().find(row => String(row.id) === String(rule.target))
    : null;
  rule[key] = value;
  _controllerRulesDirty = true;
  if (key === 'kind') {
    const target = simpleControlOutputs().find(row => String(row.id) === String(rule.target));
    if (target?.virtual) value = 0;
    rule[key] = value;
    // Changing topology removes the runtime effect of fields that no longer
    // apply. Defaults remain unsurprising if the user changes back later.
    if (Number(value) === 0) {
      rule.threshold ??= 0;
      rule.hysteresis ??= 0;
      rule.on_value = target && [4,11].includes(Number(target.driver)) ? 1 : 0;
      rule.off_value = 0;
    } else if (Number(value) === 1) {
      rule.input_min = 0;
      rule.input_max = 1;
      rule.output_min = 0;
      rule.output_max = 1;
    } else if (Number(value) === 2) {
      const tuning = feedbackDefaultsForInput(rule.source);
      rule.target_source_type = 0;
      rule.target_source = '';
      rule.target_fixed = 0;
      rule.target_low = 0;
      rule.target_high = 1;
      rule.target_input_min = 0;
      rule.target_input_max = 1;
      rule.output_min = 0;
      rule.output_max = 1;
      rule.off_value = 0;
      Object.assign(rule, tuning);
    } else {
      rule.on_value = 0;
    }
  }
  if (key === 'source' && Number(rule.kind) === 2)
    Object.assign(rule, feedbackDefaultsForInput(value));
  if (['source','kind','op'].includes(key) && Number(rule.kind)===0 && controllerSwitchInput(rule.source)) {
    rule.threshold=.5;rule.hysteresis=0;
  }
  if (key === 'target_source_type' && Number(value) !== 0 && !rule.target_source)
    rule.target_source = '';
  if (key === 'target') {
    const target = simpleControlOutputs().find(row => String(row.id) === String(value));
    const wasRelay = previousTarget && [4,11].includes(Number(previousTarget.driver));
    const isRelay = target && [4,11].includes(Number(target.driver));
    if (previousTarget && target && wasRelay !== isRelay) {
      rule.on_value = 0;
      rule.off_value = 0;
      rule.output_min = 0;
      rule.output_max = 1;
    }
    if (target && [4,11].includes(Number(target.driver)) && [1,2].includes(Number(rule.kind)))
      rule.kind = 0;
  }
  _markDirty();
  renderForm(true);
  _applyAllVisibility();
  applyView();
  runValidation();
}
function updateControllerTiming(index, field, value) {
  collectConfigFields();
  const rule=cfg.rules?.[index]; if(!rule)return;
  OTControllerTiming.ensureIds(cfg.rules);
  rule.activate_events=OTControllerTiming.starts(rule);
  delete rule.activate_event;
  rule[field]=Number(value)&31;
  if(field==='activate_events')rule.deactivate_events=(Number(rule.deactivate_events)||24)&~(rule.activate_events&30);
  _controllerRulesDirty=true;_markDirty();renderForm(true);_applyAllVisibility();applyView();
}
function controllerTimingHtml(rule,index) {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=window.OTControllerTiming;
  if(!api)return '';
  const action=['request_shutdown','request_fault'].includes(String(rule.target));
  api.ensureIds(cfg.rules||[]);
  const choices=(on)=>api.events.map((label,i)=>{
    const field=on?'activate_events':'deactivate_events',mask=on?api.starts(rule):Number(rule.deactivate_events)||0;
    return `<label><input type="checkbox" aria-label="${on?'Activate':'Deactivate'}: ${esc(label)}" ${!on&&i>0&&(api.starts(rule)&(1<<i))?'disabled':''} ${mask&(1<<i)?'checked':''} onchange="updateControllerTiming(${index},'${field}',this.checked?(${mask}|${1<<i}):(${mask}&~${1<<i}))"> ${esc(label)}</label>`;
  }).join('');
  return `<section class="controller-form-section"><b>${action?'When to monitor':'Activation'}</b>${action?'<p>Monitoring starts and stops below. Shutdown is requested only while monitoring and when the input condition above is met.</p>':''}<div class="cfg-grid"><div class="cfg-field"><span class="cfg-label">${action?'Start monitoring':'Activate when'}</span><span class="automation-states">${choices(true)}</span></div><div class="cfg-field"><span class="cfg-label">${action?'Stop monitoring':'Deactivate when'}</span><span class="automation-states">${choices(false)}</span></div></div><p>${esc(api.summary(rule))}</p><p>Status: <b>${esc(api.status(rule,hwCfg,cfg.rules))}</b></p>${api.status(rule,hwCfg,cfg.rules)!=='OK'?'<a href="/sequence.html">Open Sequence</a>':''}</section>`;
}
function toggleSimpleControlMode(index, bit, checked) {
  const rule = cfg.rules?.[index];
  if (!rule) return;
  const current = Number(rule.mode_mask ?? 4) & 0x0f;
  rule.mode_mask = checked ? (current | bit) : (current & ~bit);
  _controllerRulesDirty = true;
  _markDirty();
}
function removeSimpleControl(index) {
  const rule = cfg.rules?.[index];
  const target = simpleControlOutputs().find(row => String(row.id) === String(rule?.target));
  if (String(target?.purpose || '') === 'main_fuel') {
    hwCfg.controllers ||= {};
    hwCfg.controllers.dynamic_idle = false;
    hwCfg.controllers.governor = false;
    _controllerHardwareDirty = true;
  }
  cfg.rules?.splice(index, 1);
  _controllerRulesDirty = true;
  _markDirty();
  renderForm(true);
  _applyAllVisibility();
  applyView();
  runValidation();
}

function controllerInputs(purpose) {
  return (hwCfg?.channel_registry?.inputs || []).filter(row => registryChannelInstalled(row) && String(row.purpose || '') === purpose);
}
function controllerOutputs(purpose) {
  return (hwCfg?.channel_registry?.outputs || []).filter(row => registryChannelInstalled(row) &&
    !String(row.mirror_of || '') && String(row.purpose || '') === purpose);
}
function markControllerHardwareDirty() {
  collectConfigFields();
  _controllerHardwareDirty = true;
  _markDirty();
  renderForm(true);
  _applyAllVisibility();
  applyView();
  runValidation();
}
function setControllerEnabled(key, enabled) {
  hwCfg.controllers ||= {};
  hwCfg.controllers[key] = !!enabled;
  markControllerHardwareDirty();
}
function setSafetyEnabled(key, enabled) {
  hwCfg.safety ||= {};
  hwCfg.safety[key] = !!enabled;
  markControllerHardwareDirty();
}
function controllerSafetyToggle(key, label, available, requirement, locked = false) {
  const checked = !!hwCfg?.safety?.[key];
  const reason = available ? (key==='hot_start' ? 'Blocks START while the engine is already hot. Does not monitor the ignition rise.' : 'Enables this fault-shutdown protection. Gradual fuel limiting has its own setting and remains independent.') : requirement;
  return `<div class="safety-local-toggle protection-enable" data-safety-key="${key}" data-safety-available="${!!available}" title="${_escHtml(reason)}"><label><span class="cfg-label">Enable ${_escHtml(label)}</span><input aria-label="Enable ${_escHtml(label)}" type="checkbox" ${checked?'checked':''} ${(available||checked)&&!locked?'':'disabled'} onchange="setSafetyEnabled('${key}',this.checked)"><b data-toggle-state>${checked?(available?'ON':'CHECK'):'OFF'}</b></label>${available?'':`<small>${_escHtml(requirement)}</small>`}</div>`;
}
function updateControllerOilLoop(index, key, value) {
  const loop = hwCfg.oil_loops?.[index];
  if (!loop) return;
  if (key === 'enabled') {
    hwCfg.controllers ||= {};
    // An old master-off flag means every saved loop is inactive. Enabling
    // one card must not unexpectedly enable the other saved controllers.
    if (hwCfg.controllers.oil_loop === false)
      hwCfg.oil_loops.forEach(row => { row.enabled = false; });
  }
  loop[key] = value;
  if (key === 'enabled') hwCfg.controllers.oil_loop = hwCfg.oil_loops.some(row => row.enabled !== false);
  markControllerHardwareDirty();
}
function addControllerOilLoop(pumpOutputId = '', pressureInputId = '') {
  hwCfg.oil_loops ||= [];
  const used = new Set(hwCfg.oil_loops.map(loop => String(loop.pump_output || '')));
  const pressures = controllerInputs('oil_pressure');
  const pressure = pressures.find(row => String(row.id) === String(pressureInputId)) ||
    (pressures.length === 1 ? pressures[0] : null);
  const pump = controllerOutputs('oil_pump').find(row =>
    !used.has(String(row.id || '')) && (!pumpOutputId || String(row.id) === String(pumpOutputId)));
  const maxLoops = Math.max(1, Number(hwCfg?._capabilities?.max_oil_loops || 6));
  if (!pressure || !pump || hwCfg.oil_loops.length >= maxLoops) return;
  hwCfg.oil_loops.push({enabled:true,id:`oil${hwCfg.oil_loops.length + 1}`,pressure_input:pressure.id,pump_output:pump.id,
    target_source:0,target_bar:2.5,target_high_bar:2.5,speed_min_rpm:0,speed_max_rpm:20000,
    deadband_bar:.2,response_gain:1.8,failsafe_delay_ms:1500,failsafe_demand:.6,min_demand:.18,max_demand:1,
    low_pressure_bar:1,low_pressure_confirm_ms:500,low_pressure_response:2,feedback_loss_response:2,immediate_pump_run_s:10});
  hwCfg.controllers ||= {};
  hwCfg.controllers.oil_loop = true;
  markControllerHardwareDirty();
}
function removeControllerOilLoop(index) {
  hwCfg.oil_loops?.splice(index, 1);
  hwCfg.controllers ||= {};
  hwCfg.controllers.oil_loop = !!hwCfg.oil_loops?.some(loop => loop.enabled !== false);
  markControllerHardwareDirty();
}
// OT_SYSTEM_ONLY_BEGIN
function setSystemHardware(path, value) {
  if (!_systemHardwareOriginalValues.has(path)) {
    const defaults={'cluster_serial.enabled':false,'mavlink.enabled':false,
      'cluster_serial.baud':115200,'cluster_serial.interval_ms':50,
      'mavlink.baud':57600,'mavlink.interval_ms':100,'mavlink.allow_commands':false,'mavlink.controller_system':255,'mavlink.controller_component':190,'mavlink.system_id':1,'mavlink.component_id':200,'mavlink.input_timeout_ms':500,profile_desc:''};
    _systemHardwareOriginalValues.set(path, getPath(hwCfg, path.split('.')) ?? defaults[path]);
  }
  setPath(hwCfg, path.split('.'), value);
  if(OTConfigEqual(_systemHardwareOriginalValues.get(path),value))_systemHardwareChangedPaths.delete(path);
  else _systemHardwareChangedPaths.add(path);
  _systemHardwareDirty = _systemHardwareChangedPaths.size > 0;
  _markDirty();
  renderSystemSetup();
  // The System groups are rebuilt after each edit. Recompute the fixed save
  // bar after that replacement so its count and enabled state cannot retain
  // the pre-edit snapshot (notably on the slower Classic page load path).
  _updateWorkspaceState();
}
function revealSystemWifiPassword() {
  const editor = document.getElementById('system-wifi-password-editor');
  const input = document.getElementById('system-wifi-password');
  if (editor) editor.style.display = '';
  input?.focus();
}
function renderSystemSetup() {
  const root = document.getElementById('system-device-setup');
  if (!root || CONFIG_SURFACE !== 'system') return;
  const categoryState = new Map([...root.querySelectorAll('details.system-category')].map(card=>[card.id,card.open]));
  const openGroups = new Set(Array.from(root.querySelectorAll('details.config-group[open] > summary .group-title'))
    .map(node => node.textContent.trim()));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mav = hwCfg.mavlink || {};
  const group = (title, desc, body, open=true, id='') => `<details${id?` id="${id}"`:''} class="config-group"${open?' open':''}><summary><span class="group-heading"><span class="group-title">${title}</span><span class="group-desc">${desc}</span></span><span class="group-chevron" aria-hidden="true">›</span></summary><div class="group-content"><div class="cfg-section"><div class="cfg-grid">${body}</div></div></div></details>`;
  const category = (title, desc, body, open=false, id='') => `<details${id?` id="${id}"`:''} class="system-category"${open?' open':''}><summary><span class="group-heading"><span class="group-title">${title}</span><span class="group-desc">${desc}</span></span><span class="group-chevron" aria-hidden="true">›</span></summary><div class="system-category-body"><div class="system-subcard-grid">${body}</div></div></details>`;
  const identity = `
      <label class="cfg-field"><span class="cfg-label">Engine / Wi-Fi name</span><span class="cfg-desc">Identifies this engine and names its ECU access point.</span><input id="system-engine-name" maxlength="63" value="${esc(hwCfg.profile_id || 'OpenTurbine')}" onchange="setSystemHardware('profile_id',this.value.trim()||'OpenTurbine')"></label>
      <label class="cfg-field"><span class="cfg-label">Engine description</span><span class="cfg-desc">A short name or note used to distinguish this ECU and its saved engine file.</span><input id="system-engine-description" maxlength="63" value="${esc(hwCfg.profile_desc || '')}" onchange="setSystemHardware('profile_desc',this.value)"></label>`;
  const wifiPassword = String(hwCfg.wifi_password || '');
  const wifiIsOpen = !wifiPassword;
  const wifiPasswordPending = !wifiIsOpen && wifiPassword !== '__KEEP_PASSWORD__';
  const wifi = `
      <div class="cfg-field" id="system-wifi-access-state"><span class="cfg-label">Wi-Fi access</span><span class="wifi-access-state${wifiIsOpen?' open':''}">${wifiIsOpen?'Open network':'Password protected'}${wifiPasswordPending?' — new password ready to save':''}</span><span class="cfg-desc">${wifiIsOpen?'Anyone nearby can join this ECU network and access its controls. Add a password if the installation requires restricted access.':'A password is required before a device can join this ECU network.'}</span><div class="wifi-access-actions"><button type="button" id="system-wifi-password-action" onclick="revealSystemWifiPassword()">${wifiIsOpen?'Add Wi-Fi password':'Change password'}</button>${wifiIsOpen?'':`<button type="button" id="system-wifi-open-action" onclick="setSystemHardware('wifi_password','')">Use open network</button>`}</div></div>
      <label class="cfg-field" id="system-wifi-password-editor" style="display:none"><span class="cfg-label">${wifiIsOpen?'Add Wi-Fi password':'New Wi-Fi password'}</span><span class="cfg-desc">Enter 8–63 characters. The network security changes after Save and reboot.</span><input id="system-wifi-password" type="password" autocomplete="new-password" minlength="8" maxlength="63" placeholder="8–63 characters" onchange="if(this.value)setSystemHardware('wifi_password',this.value)"></label>
      <label class="cfg-field"><span class="cfg-label">Wi-Fi transmit power (dBm)</span><span class="cfg-desc">Use only as much radio power as the installation needs.</span><input id="system-wifi-tx-power" type="number" min="2" max="20" step="1" value="${Number(hwCfg.wifi_tx_power_dbm ?? 8)}" onchange="setSystemHardware('wifi_tx_power_dbm',+this.value)"></label>`;
  const mavFields = `
      <div class="cfg-field"><span class="cfg-label">MAVLink connection</span><label><input type="checkbox" ${mav.enabled?'checked':''} ${mav.migration_review?'disabled':''} onchange="setSystemHardware('mavlink.enabled',this.checked)"> Enabled</label><span class="cfg-desc">${(mav.tx_pin??-1)>=0?`TX GPIO ${mav.tx_pin}${(mav.rx_pin??-1)>=0?` / RX GPIO ${mav.rx_pin}`:' / monitoring only'}`:'Assign serial GPIO on Hardware first.'}</span><span class="cfg-desc">Send engine data to a remote display or controller. Receiving engine commands or throttle requires RX. Bare development boards use 3.3 V UART with shared ground; follow the connector ratings for a PCB.</span>${mav.migration_review?'<span class="cfg-desc">Two old serial connections were enabled. Choose which wiring to retain on Hardware before enabling MAVLink.</span>':''}</div>
      ${mav.enabled?`<label class="cfg-field"><span class="cfg-label">Baud rate</span><select onchange="setSystemHardware('mavlink.baud',+this.value)">${[9600,19200,38400,57600,115200,230400,460800,921600].map(v=>`<option value="${v}"${Number(mav.baud||57600)===v?' selected':''}>${v}</option>`).join('')}</select></label>
      <label class="cfg-field"><span class="cfg-label">Channel packet interval (ms)</span><input type="number" min="20" max="5000" value="${Number(mav.interval_ms??100)}" onchange="setSystemHardware('mavlink.interval_ms',+this.value)"><span class="cfg-desc">Each packet contains up to eight channels. A full cycle takes longer with more channels. Engine state and heartbeat update once per second.</span></label>
      <div class="cfg-field"><span class="cfg-label">Remote engine commands</span><label><input type="checkbox" ${mav.allow_commands?'checked':''} ${(mav.rx_pin??-1)<0?'disabled':''} onchange="setSystemHardware('mavlink.allow_commands',this.checked)"> Allow Start, Stop, fault acknowledgement and fitted afterburner controls</label><span class="cfg-desc">Requires RX. Existing engine checks still apply. Sender IDs filter the controller; they are not authentication. Use a trusted direct link.</span></div>
      ${(mav.rx_pin??-1)>=0?`<label class="cfg-field"><span class="cfg-label">Permitted controller system ID</span><input type="number" min="1" max="255" value="${Number(mav.controller_system??255)}" onchange="setSystemHardware('mavlink.controller_system',+this.value)"><span class="cfg-desc">Supplied Cluster example: 255. Set this and the component ID to match your sender.</span></label>
      <label class="cfg-field"><span class="cfg-label">Permitted controller component ID</span><input type="number" min="1" max="255" value="${Number(mav.controller_component??190)}" onchange="setSystemHardware('mavlink.controller_component',+this.value)"></label>
      <label class="cfg-field"><span class="cfg-label">Remote throttle timeout (ms)</span><input type="number" min="100" max="5000" value="${Number(mav.input_timeout_ms??500)}" onchange="setSystemHardware('mavlink.input_timeout_ms',+this.value)"><span class="cfg-desc">With RX fitted, MAVLink throttle demand is available as a Controllers input. Select it explicitly there. Missing valid demand makes that input unhealthy; it never selects a fallback automatically.</span></label>`:'<div class="cfg-field"><span class="cfg-label">Monitoring only</span><span class="cfg-desc">Only TX is fitted. To receive engine commands or throttle demand, assign RX in Hardware. Your receiver settings are retained.</span></div>'}
      <label class="cfg-field"><span class="cfg-label">ECU system ID</span><input type="number" min="1" max="255" value="${Number(mav.system_id??1)}" onchange="setSystemHardware('mavlink.system_id',+this.value)"></label>
      <label class="cfg-field"><span class="cfg-label">ECU component ID</span><input type="number" min="1" max="255" value="${Number(mav.component_id??200)}" onchange="setSystemHardware('mavlink.component_id',+this.value)"><span class="cfg-desc">Each component on the link needs a unique system/component pair. Defaults: engine 1/200, Cluster 255/190.</span></label>`:''}
      <div class="cfg-field"><span class="cfg-label">Physical connection</span><a href="/hardware.html#hardware-comms-panel">Configure TX and optional RX on Hardware &rarr;</a></div>`;
  const appearanceFields = `
      <div class="cfg-field" style="grid-column:1/-1">
        <div id="appearance-picker"></div>
        <span class="cfg-desc" style="margin-top:.45rem">Interface theme for this device — applies instantly.</span>
      </div>`;
  const runtimeHz = Number(getPath(cfg, ['telemetry','control_loop_hz']) ?? 400);
  const runtimeFields = `
      <div class="cfg-field" data-key="tm_lh" data-level="essential" style="grid-column:1/-1">
        <div class="cfg-field-head"><div class="cfg-label">ECU Loop Target Hz (Hz)</div></div>
        <input type="number" id="cf-tm_lh" aria-label="ECU Loop Target Hz" value="${runtimeHz}" step="50" min="50" max="1000" ${isLocked ? 'disabled' : ''}>
        <details class="cfg-help"><summary>About this setting</summary><div class="cfg-desc">Main control-loop target frequency. Default 400 Hz. Lower values reduce CPU use; higher values improve control granularity but increase load. Recommended range: 200-500 Hz. Takes effect after a reboot.</div></details>
      </div>`;
  const loopTimingFields = `
      <div class="cfg-field" style="grid-column:1/-1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
          <span class="cfg-label">Live loop metrics</span>
          <span class="tool-state off" id="loop-diag-state" style="font-size:.65rem;padding:.15rem .5rem;border-radius:999px;border:1px solid var(--border);color:var(--dim)">Live</span>
        </div>
        <div class="loop-metric-grid">
          <div class="loop-metric"><div class="cfg-desc">Loop rate (1 s average)</div><div class="loop-metric-value" id="diag-loop-hz">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Latest period</div><div class="loop-metric-value" id="diag-loop-period">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Worst period (1 s)</div><div class="loop-metric-value" id="diag-loop-period-max">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Execution average</div><div class="loop-metric-value" id="diag-loop-avg">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Execution worst (1 s)</div><div class="loop-metric-value" id="diag-loop-max">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Missed deadlines</div><div class="loop-metric-value" id="diag-loop-overruns">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Loop iterations</div><div class="loop-metric-value" id="diag-loop-count">-</div></div>
        </div>
        <div class="loop-metric-grid loop-stage-grid">
          <div class="loop-metric"><div class="cfg-desc">Sensors</div><div class="loop-metric-value" id="diag-loop-sensors">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Sequencer</div><div class="loop-metric-value" id="diag-loop-sequencer">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Controllers</div><div class="loop-metric-value" id="diag-loop-controllers">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Actuators</div><div class="loop-metric-value" id="diag-loop-actuators">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Logging</div><div class="loop-metric-value" id="diag-loop-logging">-</div></div>
          <div class="loop-metric"><div class="cfg-desc">Status LED</div><div class="loop-metric-value" id="diag-loop-led">-</div></div>
        </div>
        <span class="cfg-desc" style="margin-top:.75rem">Loop period is start-to-start time and includes deliberate waiting and task scheduling. Execution time measures only work performed by the loop. One-second worst values reset each reporting window; missed deadlines count executions longer than the configured target period.</span>
      </div>`;
  const backupRestoreFields = `
      <div class="cfg-field" style="grid-column:1/-1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
          <span class="cfg-label">Engine configuration file</span>
          <span class="tool-state off" id="cfg-backup-state" style="font-size:.65rem;padding:.15rem .5rem;border-radius:999px;border:1px solid var(--border);color:var(--dim)">Ready</span>
        </div>
        <span class="cfg-desc">
          Download one complete engine file containing hardware, settings, sequences,
          and calibration, or restore a previously saved file. The engine must be in
          STANDBY (or FAULT) to restore.
          <br><span style="color:var(--yellow)">Note: the backup is complete by design —
          it includes the Wi-Fi AP password. Review before sharing the file.</span>
        </span>
        <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
          <button type="button" id="cfg-backup-btn" onclick="backupConfig()">Download backup</button>
          <label style="cursor:pointer">
            <input type="file" id="cfg-restore-file" accept=".json" style="display:none" onchange="restoreConfig(this)">
            <button type="button" id="cfg-restore-btn" onclick="document.getElementById('cfg-restore-file').click()">Upload &amp; restore…</button>
          </label>
        </div>
        <div id="cfg-backup-msg" style="font-size:.72rem;margin-top:.45rem;display:none"></div>
      </div>`;
  const factoryResetFields = `
      <div class="cfg-field" style="grid-column:1/-1">
        <span class="cfg-label" style="color:var(--red)">Factory Reset</span>
        <span class="cfg-desc">
          Erases all engine settings, sequences, hardware assignments, calibration,
          Wi-Fi password, event logs, and session logs, then reboots with the compiled
          factory-default engine profile used for a clean installation. The PCB profile is preserved. Download a complete engine file first if anything may be
          needed later. <b style="color:var(--red)">Cannot be undone.</b>
        </span>
        <div style="margin-top:.6rem">
          <button type="button" onclick="factoryReset()" class="danger" id="btn-factory-reset">Factory Reset</button>
        </div>
        <div id="factory-reset-msg" style="font-size:.72rem;margin-top:.45rem;display:none"></div>
      </div>`;
  const manualUpdateFields = `
      <div class="cfg-field" style="grid-column:1/-1">
        <div class="maintenance-upload"><div class="maintenance-upload-copy"><span class="cfg-label">Firmware image</span><span class="cfg-desc">Upload a matching compiled <code>firmware.bin</code>. Firmware and web pages are separate; use the complete asset update below when the dashboard changed.</span></div><span id="ota-state" class="maintenance-state">Ready</span><label><input type="file" id="ota-file" accept=".bin" hidden onchange="startSystemOTA(this)"><button type="button" id="ota-btn" onclick="document.getElementById('ota-file').click()">Choose .bin</button></label></div>
        <div id="ota-prog-track" class="maintenance-progress" style="display:none"><div id="ota-prog-fill" class="maintenance-progress-fill"></div></div><div id="ota-msg" class="cfg-desc" style="display:none;margin-top:.45rem"></div>
      </div>
      <div class="cfg-field" style="grid-column:1/-1">
        <div class="maintenance-upload"><div class="maintenance-upload-copy"><span class="cfg-label">Web UI assets</span><span class="cfg-desc">Upload all twelve generated <code>data/*.gz</code> files together. Configuration and logs are retained.</span></div><span id="assets-state" class="maintenance-state">Ready</span><label><input type="file" id="assets-files" accept=".gz" multiple hidden onchange="startSystemWebAssetsUpdate(this)"><button type="button" id="assets-btn" onclick="document.getElementById('assets-files').click()">Choose .gz files</button></label></div>
        <div id="assets-prog-track" class="maintenance-progress" style="display:none"><div id="assets-prog-fill" class="maintenance-progress-fill"></div></div><div id="assets-msg" class="cfg-desc" style="display:none;margin-top:.45rem"></div>
      </div>`;
  root.innerHTML =
    category('Identity & access','Engine name, Wi-Fi connection, and dashboard appearance',
      group('Engine identity','Name used by the dashboard, Wi-Fi AP, and saved engine file',identity,true) +
      group('Wi-Fi access','Password and radio settings for the local ECU network',wifi,false,'system-wifi-access') +
      group('Appearance','Interface theme and dashboard decoration',appearanceFields,false),true,'system-identity-access') +
    category('Connections & runtime','External telemetry links and ECU execution diagnostics',
      group('MAVLink connection','Engine data and optional remote controls',mavFields,false) +
      group('ECU runtime','Control-loop scheduling and device-wide execution',runtimeFields,false) +
      group('ECU loop timing','Main ECU loop speed and execution timing diagnostics',loopTimingFields,false,'loop-diag-card'),true,'system-connections-runtime') +
    category('Maintenance','Backups, advanced updates, and recovery actions',
      group('Backup & restore','Download or restore the complete configuration file',backupRestoreFields,false,'system-backup-restore') +
      group('Manual firmware & web update','Advanced update controls for matching compiled files',manualUpdateFields,false,'manual-update-tools') +
      group('Factory reset','Permanently erase all configuration and logs to restore factory defaults',factoryResetFields,false,'card-factory-reset'),true,'system-maintenance');
  root.querySelectorAll('details.config-group').forEach(card => {
    const title = card.querySelector('.group-title')?.textContent.trim();
    if (openGroups.size) card.open = openGroups.has(title);
  });
  root.querySelectorAll('details.system-category').forEach(card=>{if(categoryState.has(card.id))card.open=categoryState.get(card.id);});
  if (window.OTTheme?.renderPicker) {
    window.OTTheme.setDashboardAccents(cfg.dashboard_accents === true, true);
    window.OTTheme.renderPicker(document.getElementById('appearance-picker'));
  }
  if (window._lastSystemData && typeof window.updateLoopDiagnostics === 'function') {
    window.updateLoopDiagnostics(window._lastSystemData);
  }
  const frBtn = document.getElementById('btn-factory-reset');
  if (frBtn) frBtn.disabled = !['STANDBY', 'FAULT'].includes(runtimeMode);
  const cfgRestoreBtn = document.getElementById('cfg-restore-btn');
  if (cfgRestoreBtn) cfgRestoreBtn.disabled = !['STANDBY', 'FAULT'].includes(runtimeMode);
  ['cl_n1','cl_n2','cl_tw','cl_ow','cl_fw','cl_bw'].forEach(key => setCfgFieldHardHidden(key, !mav.enabled));
}

// OT_SYSTEM_ONLY_END
// OT_CONTROLLERS_ONLY_BEGIN
function renderSimpleControls() {
  const root = document.getElementById('simple-controls');
  if (!root || CONFIG_SURFACE !== 'controllers') return;
  const inputs = simpleControlInputs();
  const outputs = simpleControlOutputs();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const optionRows = (rows, selected, disabled = new Set()) =>
    (!String(selected || '') ? '<option value="" selected>Choose device</option>' : !rows.some(row=>String(row.id)===String(selected))?`<option value="${esc(selected)}" selected disabled>${esc(controllerChannelName([...(hwCfg?.channel_registry?.inputs||[]),...(hwCfg?.channel_registry?.outputs||[])].find(row=>String(row.id)===String(selected)))||selected)} — unavailable</option>`:'') + rows.map(row =>
      `<option value="${esc(row.id)}"${String(row.id)===String(selected)?' selected':''}${disabled.has(String(row.id))&&String(row.id)!==String(selected)?' disabled':''}>${esc(controllerChannelName(row))}</option>`).join('');
  const numberField = (index, key, label, value, attrs='step="any"') => {
    const rule = cfg.rules?.[index];
    const sourceKeys = ['input_min','input_max','threshold','hysteresis','target_fixed','target_low','target_high','deadband'];
    const display = sourceKeys.includes(key) ? controllerInputDisplay(rule?.source)
      : ['target_input_min','target_input_max'].includes(key) ? controllerInputDisplay(rule?.target_source) : {scale:1,unit:''};
    const displayed = Number((Number(value) * display.scale).toPrecision(15));
    const idle = configuredIdleSource();
    const target = simpleControlOutputs().find(row => String(row.id) === String(rule?.target));
    const fuel = ['main_fuel','fuel_pump'].includes(String(target?.purpose || ''));
    const note = key === 'input_min' && fuel && idle.active && (Number(rule?.mode_mask ?? 4) & 4)
      ? `<span class="cfg-desc" data-idle-floor-note>In Running, the lower fuel command is limited by the idle source: ${esc(idle.title)}. See Idle under Fuel-metering support.</span>` : '';
    const accessibleLabel = `${label}${display.unit ? ` (${display.unit})` : ''}`;
    return `<label class="cfg-field"><span class="cfg-label">${accessibleLabel}</span><input type="number" aria-label="${esc(accessibleLabel)}" ${attrs} value="${displayed}" onchange="updateSimpleControl(${index},'${key}',+this.value${display.scale === 1 ? '' : '/'+display.scale})">${note}</label>`;
  };
  const flowBlock = (step, title, desc, body) => `<div class="controller-function-block"><div class="controller-function-heading"><b><span>${step}</span>${title}</b><span>${desc}</span></div><div class="cfg-grid">${body}</div></div>`;
  const rules = cfg.rules || [];
  rules.forEach(rule => {
    rule.source = _resolveControllerChannelId(rule.source, inputs, 'input', rule.sensor);
    rule.target = _resolveControllerChannelId(rule.target, outputs, 'output', rule.actuator);
    if (Number(rule.target_source_type || 0) !== 0)
      rule.target_source = _resolveControllerChannelId(rule.target_source, inputs, 'input', rule.target_sensor);
  });
  window.OTControllerTiming?.ensureIds(rules);
  const cards = rules.map((rule, index) => {
    const usedByOthers = new Set(rules.filter((_, i) => i !== index).map(row => String(row.target || '')));
    const target = outputs.find(row => row.id === rule.target);
    const actionTarget = target?.virtual === true;
    if (actionTarget) {
      rule.kind = 0;
      rule.on_value = 1;
      rule.off_value = 0;
      rule.mode_mask = (Number(rule.mode_mask ?? 4) & 0x06) || 4;
    }
    const kind = Number(rule.kind || 0);
    const switchInput=controllerSwitchInput(rule.source);
    const relay = target && [4,11].includes(Number(target.driver));
    const dangerous = ['main_fuel','fuel_shutoff','fuel_pump','pilot_fuel','igniter',
      'ab_igniter','ab_valve','ab_pump','glow_plug',
      'starter','starter_enable','air_starter','request_shutdown','request_fault'].includes(String(target?.purpose || ''));
    const targetSourceType = Number(rule.target_source_type || 0);
    const modeMask = Number(rule.mode_mask ?? 4) & 0x0f;
    const operatingStates = actionTarget
      ? `<label class="automation-state"><input type="checkbox" ${modeMask&2?'checked':''} onchange="toggleSimpleControlMode(${index},2,this.checked)"> Startup</label><label class="automation-state"><input type="checkbox" ${modeMask&4?'checked':''} onchange="toggleSimpleControlMode(${index},4,this.checked)"> Running</label>`
      : `<label class="automation-state"><input type="checkbox" ${modeMask&1?'checked':''} onchange="toggleSimpleControlMode(${index},1,this.checked)"> Standby</label><label class="automation-state"><input type="checkbox" ${modeMask&2?'checked':''} onchange="toggleSimpleControlMode(${index},2,this.checked)"> Startup</label><label class="automation-state"><input type="checkbox" ${modeMask&4?'checked':''} onchange="toggleSimpleControlMode(${index},4,this.checked)"> Running</label><label class="automation-state"><input type="checkbox" ${modeMask&8?'checked':''} onchange="toggleSimpleControlMode(${index},8,this.checked)"> Shutdown</label>`;
    const inputChoice = `<label class="cfg-field"><span class="cfg-label">${kind===2?'Feedback signal':'Controlled by'}</span><select onchange="updateSimpleControl(${index},'source',this.value)">${optionRows(inputs,rule.source)}</select></label>`;
    const methodChoice = `<label class="cfg-field"><span class="cfg-label">Control method</span><select onchange="updateSimpleControl(${index},'kind',+this.value)"><option value="0"${kind===0?' selected':''}>${switchInput?'Switch state':'On / Off with hysteresis'}</option>${relay?'':`<option value="1"${kind===1?' selected':''}>Map input to output</option><option value="2"${kind===2?' selected':''}>Hold a feedback target</option>`}${actionTarget?'':'<option value="3"'+(kind===3?' selected':'')+'>Fixed output</option>'}</select></label>`;
    let topology = '';
    if (kind === 0) {
      topology = flowBlock('02',switchInput?'Switch condition':'Control input',switchInput?(actionTarget?'Choose the switch and the ON/OFF state that requests the action.':'Choose the switch and the ON/OFF state that commands the output.'):'The measured value that decides when the output changes.',`${inputChoice}<label class="cfg-field"><span class="cfg-label">${actionTarget?(rule.target==='request_fault'?'Request fault shutdown when':'Request normal shutdown when'):switchInput?'Command output when':'Direction'}</span><select onchange="${switchInput?'setControllerSwitchState':'updateSimpleControl'}(${index},${switchInput?'':"'op',"}+this.value)"><option value="0"${Number(rule.op||0)===0?' selected':''}>${switchInput?'Switch is ON':actionTarget?'Input is above threshold':'Turn on above'}</option><option value="1"${Number(rule.op||0)===1?' selected':''}>${switchInput?'Switch is OFF':actionTarget?'Input is below threshold':'Turn on below'}</option></select>${switchInput?'<span class="cfg-desc">ON/OFF is the logical state after Hardware polarity and the built-in 20 ms debounce.</span>':''}</label>${switchInput?(!controllerSwitchSettingsReady(rule)?`<div class="cfg-field"><span class="cfg-desc">This older controller has numeric switch settings. Apply the ON/OFF condition before saving.</span><button type="button" onclick="setControllerSwitchState(${index},${Number(rule.op||0)})">Use switch state</button></div>`:''):numberField(index,'threshold','Switch point',rule.threshold??0)+numberField(index,'hysteresis','Hysteresis',rule.hysteresis??0,'min="0" step="any"')}${numberField(index,'confirm_ms','Condition confirmation time (ms)',rule.confirm_ms??0,'min="0" max="60000" step="1"').replace('</label>','<span class="cfg-desc">The condition must stay true continuously. Returning to normal, losing the input or stopping monitoring resets this timer. 0 adds no delay. Switch contacts also have built-in 20 ms debounce.</span></label>')}`) + (actionTarget?'':relay?flowBlock('03','Output state','States used when the condition matches and when it does not.',['on_value','off_value'].map((key,i)=>`<label class="cfg-field"><span class="cfg-label">${i?'Otherwise':'When condition matches'}</span><select onchange="updateSimpleControl(${index},'${key}',+this.value)"><option value="1"${Number(rule[key]||0)>=.5?' selected':''}>ON</option><option value="0"${Number(rule[key]||0)<.5?' selected':''}>OFF</option></select></label>`).join('')):flowBlock('03','Output command','Output levels used on each side of the switch point.',`${numberField(index,'on_value','On output (%)',Number(rule.on_value??1)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)")}${numberField(index,'off_value','Off output (%)',Number(rule.off_value??0)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)")}`));
    } else if (kind === 1) {
      topology = flowBlock('02','Control input','Choose the input and the range that will be mapped.',`${inputChoice}${numberField(index,'input_min','Input low',rule.input_min??0)}${numberField(index,'input_max','Input high',rule.input_max??1)}`) + flowBlock('03','Output range','Output command at the low and high ends of the input range.',`${numberField(index,'output_min','Output low (%)',Number(rule.output_min??0)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)")}${numberField(index,'output_max','Output high (%)',Number(rule.output_max??1)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)")}`);
      topology += flowBlock('04','Input loss','If this input becomes unhealthy or stale, command this output. No fallback input is selected.',window.OTControllerTiming?.scheduled(rule)
        ? `<div class="cfg-field"><span class="cfg-label">Output if input is unavailable</span><b>${Math.round(Number(target?.safe_demand ?? (rule.target==='prop_pitch_main'?1:0))*100)}%</b><span class="cfg-desc">Uses the output's safe demand. Set it on Hardware in this output's settings.</span></div>`
        : numberField(index,'off_value','Output if input is unavailable (%)',Number(rule.off_value??0)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)"));
    } else if (kind === 2) {
      const targetSource = targetSourceType === 0 ? '' : `<label class="cfg-field"><span class="cfg-label">${targetSourceType===1?'Selector input':'Target input'}</span><select onchange="updateSimpleControl(${index},'target_source',this.value)">${optionRows(inputs,rule.target_source)}</select></label>`;
      const targetValues = targetSourceType === 0
        ? numberField(index,'target_fixed','Target',rule.target_fixed??0)
        : targetSourceType === 1
          ? `<div class="controller-switch-target"><span class="controller-switch-target-head"><b>Low target</b><span>OFF</span></span>${numberField(index,'target_low','When selector input is OFF',rule.target_low??0)}</div><div class="controller-switch-target"><span class="controller-switch-target-head"><b>High target</b><span class="on">ON</span></span>${numberField(index,'target_high','When selector input is ON',rule.target_high??1)}</div>`
          : `${numberField(index,'target_input_min','Target input low',rule.target_input_min??0)}${numberField(index,'target_input_max','Target input high',rule.target_input_max??1)}${numberField(index,'target_low','Target at input low',rule.target_low??0)}${numberField(index,'target_high','Target at input high',rule.target_high??1)}`;
      topology = flowBlock('02','Feedback','The control method and measured value held at the target.',methodChoice+inputChoice) + flowBlock('03','Target','Choose where the requested feedback value comes from.',`<label class="cfg-field"><span class="cfg-label">How is the target selected?</span><select onchange="updateSimpleControl(${index},'target_source_type',+this.value)"><option value="0"${targetSourceType===0?' selected':''}>Fixed value</option><option value="1" title="Two-state switch"${targetSourceType===1?' selected':''}>Input switch</option><option value="2" title="Variable input mapping"${targetSourceType===2?' selected':''}>Variable input</option></select></label>${targetSource}${targetValues}`) + flowBlock('04','Output authority','Restrict how much authority this controller has over the selected output.',`${numberField(index,'output_min','Minimum output (%)',Number(rule.output_min??0)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)")}${numberField(index,'output_max','Maximum output (%)',Number(rule.output_max??1)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)")}`) + `<details class="protection-card" style="grid-column:1/-1"><summary><span><span class="protection-card-title">Response tuning</span><span class="protection-card-desc">Start gently, then tune during safe bench tests</span></span><span class="protection-card-chevron">›</span></summary><div class="cfg-grid">${numberField(index,'response_gain','Immediate response (% / unit)',Number(rule.response_gain??.02)*100,'min="0" step="any"').replace("+this.value)","+this.value/100)")}${numberField(index,'integral_gain','Correction rate (% / unit / s)',Number(rule.integral_gain??.005)*100,'min="0" step="any"').replace("+this.value)","+this.value/100)")}${numberField(index,'deadband','Target deadband',rule.deadband??0,'min="0" step="any"')}${numberField(index,'off_value','Feedback-loss output (%)',Number(rule.off_value??0)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)")}</div></details>`;
    } else {
      topology = flowBlock('02','Output command','The fixed command applied whenever this controller is active.',`${numberField(index,'on_value',relay?'Fixed state (0 = Off, above 0 = On)':'Fixed output (%)',Number(rule.on_value??0)*100,'min="0" max="100" step="any"').replace("+this.value)","+this.value/100)")}<div class="cfg-field"><span class="cfg-label">No feedback input required</span><span class="cfg-desc">Applied while this controller is active. Deactivation sends the Hardware safe command before releasing ownership; a following sequence block or controller can then take over.</span></div>`);
    }
    const sourceName = controllerChannelName(inputs.find(row => String(row.id) === String(rule.source))) || 'Choose input';
    const outputName = controllerChannelName(target) || 'Choose output';
    const targetName = targetSourceType === 0 ? `${Number(rule.target_fixed??0)}` : (controllerChannelName(inputs.find(row => String(row.id) === String(rule.target_source))) || 'Choose target source');
    const methodName = kind === 3 ? 'Fixed output' : (kind === 2 ? 'Feedback target' : (kind === 1 ? 'Mapped input' : switchInput?'Switch state':'On / off with hysteresis'));
    const summaryLine = kind === 3 ? `Commands ${outputName} ${window.OTControllerTiming?.scheduled(rule)?'while active':'in selected operating states'}` : (kind === 2 ? `Holds ${sourceName} by controlling ${outputName}` : `${methodName} controlling ${outputName} from ${sourceName}`);
    const targetSummary = kind === 2 && targetSourceType === 1
      ? `${targetName} selects ${Number(rule.target_low??0)} when OFF or ${Number(rule.target_high??1)} when ON`
      : methodName;
    return `<details class="control-definition-card config-group" data-group="controller-${index}" data-purpose="${esc(target?.purpose || '')}" data-always-visible="1" data-controller-card data-controller-rule="${index}" data-controller-id="${rule.controller_id||index}" data-controller-output="${esc(rule.target || '')}">
      <summary><span class="group-heading"><span class="group-title">${esc(rule.name || outputName)}</span><span class="control-path">${esc(summaryLine)}</span><span class="group-desc">${esc(targetSummary)}</span></span><span class="controller-summary-status ${rule.enabled!==false?'enabled':'disabled'}">${rule.enabled!==false?'Enabled':'Disabled'}</span></summary>
      <div class="controller-card-body"><div class="controller-card-actions"><label class="controller-enabled"><input aria-label="Controller enabled" type="checkbox" ${rule.enabled!==false?'checked':''} onchange="updateSimpleControl(${index},'enabled',this.checked)"> Enabled</label><button type="button" class="danger" onclick="removeSimpleControl(${index})">Delete controller</button></div>
      <section class="controller-form-section"><div class="cfg-grid controller-function-list">${flowBlock('01','Definition',kind===2?'Name the controller and choose the output.':'Name the controller, choose its output, and select how it works.',`<label class="cfg-field"><span class="cfg-label">Controller name</span><input aria-label="Controller name" value="${esc(rule.name || '')}" maxlength="23" onchange="updateSimpleControl(${index},'name',this.value)"></label><label class="cfg-field"><span class="cfg-label">Controlled output</span><select onchange="updateSimpleControl(${index},'target',this.value)">${optionRows(outputs,rule.target,window.OTControllerTiming?.scheduled(rule)?new Set():new Set([...usedByOthers].filter(id=>!outputs.find(o=>o.id===id)?.virtual)))}</select></label>${kind===2||actionTarget?'':methodChoice}`)}</div></section><section class="controller-form-section controller-behavior-section"><div class="cfg-grid controller-function-list">${topology}</div></section>${actionTarget?`<p>${rule.target==='request_fault'?'Fault shutdown cuts fuel, ignition and starter immediately and records the controller name as the fault. Protective cooling and oil handling remain active.':'The normal shutdown sequence is requested once the condition becomes true. This does not create a latched FAULT.'}</p>`:''}${controllerTimingHtml(rule,index)}${window.OTControllerTiming?.scheduled(rule)?'':`<section class="controller-form-section" style="margin-top:.65rem"><b>When this controller is active</b><div class="cfg-grid"><label class="cfg-field"><span class="cfg-label">Operating states</span><span class="automation-states">${operatingStates}</span><span class="cfg-desc">${actionTarget?(rule.target==='request_fault'?'Fault shutdown is requested when the input condition is met while monitoring.':'Normal shutdown is requested when the input condition is met while monitoring.'):'The controller owns this output only in checked states. It is always released in FAULT, and STOP/shutdown safety remains authoritative.'}</span></label></div></section>`}${dangerous?'<div class="controller-warning"><b>Warning</b><span>This output can affect starting, combustion, or shutdown. Check its operating states carefully; STOP, FAULT, and hardware safety remain authoritative.</span></div>':''}<div class="controller-local-settings" data-controller-settings="${esc(rule.target || '')}"></div></div>
    </details>`;
  }).join('');
  const used = new Set(rules.map(rule => String(rule.target || '')));
  const canAdd = outputs.length > 0 && rules.length < 16;
  const timingPending=(cfg.rules||[]).some(r=>r.enabled!==false&&window.OTControllerTiming?.status(r,hwCfg,cfg.rules)==='Sequence needs setup');
  const timingNotice=timingPending?'<div class="controller-warning" role="status"><b>Sequence needs attention</b><span>Save these controller changes, then place the required Activate/Deactivate blocks in Sequence. Affected controllers stay inactive until placement is saved. Alternatively, disable the controller.</span><a href="/sequence.html">Open Sequence</a></div>':'';
  root.innerHTML = `${timingNotice}${cards}<span data-controller-create-capable="${canAdd?'1':'0'}" hidden></span>`;
}
// OT_CONTROLLERS_ONLY_END

// ── Render form ───────────────────────────────────────────────
const ALL_WORKSPACE_GROUPS = [
  { id:'fuel', title:'Main Fuel & Idle', desc:'Normal fuel demand, idle authority, and reduced-power behavior', sections:['Throttle Response','Idle','Reduced-Power Mode'] },
  { id:'power', title:'Power Turbine & Afterburner', desc:'N2 control and afterburner ignition/running behavior', sections:['Afterburner — Ignition Method','Afterburner — Flame Confirmation','Afterburner — Running'] },
  { id:'oil', title:'Oil & Lubrication Controllers', desc:'Normal pressure response and windmilling oil behavior', sections:['Oil Pressure Control','Windmilling Oil Protection'] },
  { id:'recovery', title:'Start & Recovery Controllers', desc:'Automatic and manual relight behavior', sections:['Automatic Relight','Manual Relight'] },
  { id:'safety', title:'Shutdown & Protection', desc:'Gradual fuel pullbacks, reactive or predictive limiting, hard shutdowns, and input-loss actions', sections:['Engine Protection Limits','Gradual Fuel Limit Protection','Oil Pressure Safety','Combustion & Startup Protection','Auxiliary Protection','RPM Sensor Fault Detection','RC / Servo Signal Loss Detection'] },
  { id:'runtime', title:'ECU Runtime', desc:'Control-loop scheduling and device-wide execution', sections:['ECU Runtime'] },
  { id:'display', title:'External Display Thresholds', desc:'Display-only warning zones for the optional instrument cluster', sections:['External display references'] },
];
const WORKSPACE_GROUPS = ALL_WORKSPACE_GROUPS
  .filter(group => CONFIG_SURFACE === 'system'
    ? ['display'].includes(group.id)
    : !['runtime','display'].includes(group.id))
  .map(group => ({...group, sections:group.sections.filter(title =>
    SCHEMA.some(section => section.title === title))}))
  .filter(group => group.sections.length);
const SECTION_GROUP = new Map(WORKSPACE_GROUPS.flatMap(group => group.sections.map(title => [title, group.id])));
let _workspaceFilter = 'configured';
let _searchQuery = '';
let _workspaceRefreshFrame = 0;

function _scheduleWorkspaceRefresh() {
  cancelAnimationFrame(_workspaceRefreshFrame);
  _workspaceRefreshFrame = requestAnimationFrame(applyView);
}

function setWorkspaceFilter(filter) {
  _workspaceFilter = ['configured','explore','changed'].includes(filter) ? filter : 'configured';
  applyView();
}

function _fieldIsHardwareInactive(field) {
  if (!field) return false;
  const section = field.closest('.cfg-section');
  return field.dataset.hardwareUnavailable === '1' ||
    field.dataset.forceHidden === '1' ||
    section?.dataset.hardwareUnavailable === '1' ||
    section?.dataset.forceHidden === '1';
}

function _fieldInactiveReason(field) {
  if (!field) return '';
  const section = field.closest('.cfg-section');
  return field.dataset.inactiveReason ||
    section?.dataset.inactiveReason ||
    'This setting has no effect until its required hardware or controller is configured.';
}

function _refreshDependencyEditability() {
  const explore = _workspaceFilter === 'explore';
  const futureEditMode = explore || _workspaceFilter === 'changed';
  document.querySelector('.cfg-workspace')?.classList.toggle('explore-active', explore);
  document.getElementById('cfg-form')?.classList.toggle('config-explore', futureEditMode);

  document.querySelectorAll('.cfg-field').forEach(field => {
    const inactive = _fieldIsHardwareInactive(field);
    const logicallyDisabled = field.dataset.logicalDisabled === '1' || field.dataset.hardHidden === '1';
    const control = field.querySelector('input,select');
    const activeLocked = control?.dataset.activeLocked === '1';
    // Future tuning values may be prepared before their hardware is installed,
    // but an enable checkbox must never be armed while its prerequisites are
    // absent. A stale enabled flag can still be switched off. Otherwise adding hardware later could unexpectedly activate a
    // controller or protection with uncommissioned settings.
    const activationLocked = inactive && control?.type === 'checkbox' && !control.checked;
    const inactiveEditable = inactive && futureEditMode && !activationLocked;
    field.classList.toggle('cfg-field-inactive', inactive);
    field.classList.toggle('inactive-editable', inactiveEditable && !isLocked && !logicallyDisabled && !activeLocked);

    let badge = field.querySelector('.cfg-inactive-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cfg-inactive-badge';
      badge.textContent = 'Inactive';
      field.querySelector('.cfg-field-head')?.appendChild(badge);
    }
    let note = field.querySelector('.cfg-inactive-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'cfg-inactive-note';
      field.appendChild(note);
    }
    note.textContent = inactive
      ? (activationLocked
          ? 'Cannot be enabled until its prerequisites are configured. ' + _fieldInactiveReason(field)
          : futureEditMode
          ? 'Saved for future use; inactive now. ' + _fieldInactiveReason(field)
          : _fieldInactiveReason(field))
      : '';
    if (control) control.disabled = isLocked || activeLocked || logicallyDisabled || (inactive && (!futureEditMode || activationLocked));
  });

  document.querySelectorAll('select option[data-hardware-unavailable]').forEach(option => {
    const inactive = option.dataset.hardwareUnavailable === '1';
    // Missing sensor/output choices stay unavailable in every view. Selecting
    // one is an activation decision, not harmless future-value tuning.
    option.disabled = inactive;
    option.textContent = (option.dataset.baseLabel || option.textContent) +
      (inactive ? ' (not configured)' : '');
  });
}

function setConfigSearch(value) {
  _searchQuery = String(value || '').trim().toLowerCase();
  applyView();
}

function _updateWorkspaceState() {
  const changes = _buildChanges();
  const count = changes.length;
  _cfgDirty = count > 0;
  document.querySelector('.save-bar')?.classList.toggle('is-dirty',_cfgDirty);
  const state = document.getElementById('cfg-state-badge');
  const saveCount = document.getElementById('save-change-count');
  const discard = document.getElementById('btn-discard');
  const save = document.getElementById('btn-save');
  if (state) state.textContent = count ? `${count} unsaved` : 'Saved';
  if (saveCount) saveCount.textContent = count ? `${count} unsaved change${count === 1 ? '' : 's'}` : 'No unsaved changes';
  if (discard) discard.disabled = _cfgSavePending || !count;
  if (save) save.disabled = _cfgSavePending || isLocked || !count;
}

function applyView() {
  const search = _searchQuery;
  _refreshDependencyEditability();
  let visibleFields = 0;
  document.querySelectorAll('.cfg-field').forEach(field => {
    const hardHidden = field.dataset.hardHidden === '1';
    const unavailable = _fieldIsHardwareInactive(field);
    const bench = field.closest('.config-group')?.dataset.group === 'bench';
    const changed = !!field.querySelector('.field-changed');
    const customAlways = !!field.closest('[data-always-visible="1"]');
    const haystack = field.dataset.search || '';
    const searchMatch = !search || search.split(/\s+/).every(token => haystack.includes(token));
    let show = false;
    if (customAlways && !hardHidden && searchMatch) {
      show = _workspaceFilter !== 'changed' || _controllerRulesDirty || _controllerHardwareDirty;
    } else if (!hardHidden && searchMatch) {
      if (search) show = true;
      else if (_workspaceFilter === 'configured') show = !unavailable;
      else if (_workspaceFilter === 'explore') show = true;
      else if (_workspaceFilter === 'changed') show = changed;
    }
    field.classList.toggle('filter-hidden', !show);
    field.classList.toggle('search-hit', !!search && show);
    if (show) visibleFields++;
  });

  document.querySelectorAll('.cfg-section').forEach(section => {
    const fields = Array.from(section.querySelectorAll('.cfg-field'));
    const count = fields.filter(field => !field.classList.contains('filter-hidden')).length;
    const featureHidden = section.dataset.forceHidden === '1' ||
      section.dataset.hardwareUnavailable === '1';
    const hiddenBench = ['tools-primary-section','tools-accessory-section','tools-ab-section'].includes(section.id) && _workspaceFilter !== 'configured' && _workspaceFilter !== 'explore' && !search;
    const availableSafety=!!section.querySelector('[data-safety-available="true"]')&&!search&&_workspaceFilter!=='changed';
    const hideUnavailableFeature = featureHidden && _workspaceFilter !== 'explore' && !search;
    const alwaysVisible = section.dataset.alwaysVisible === '1' &&
      (_workspaceFilter !== 'changed' || _controllerRulesDirty || _controllerHardwareDirty);
    section.classList.toggle('filter-hidden', !alwaysVisible && (hideUnavailableFeature || (count === 0&&!availableSafety) || hiddenBench));
    section.classList.toggle('feature-unavailable', featureHidden);
    section.classList.toggle('search-reveal', featureHidden && !!search);
    if (featureHidden && !section.dataset.unavailableBound) {
      section.dataset.unavailableBound = '1';
      section.querySelector('.cfg-title')?.addEventListener('click', () => {
        section.classList.toggle('unavailable-open');
      });
    }
    const badge = section.querySelector('.cfg-title-count');
    if (badge) badge.textContent = count ? `${count} setting${count === 1 ? '' : 's'}` : '';
  });

  document.querySelectorAll('.protection-card').forEach(card => {
    const count = card.querySelectorAll('.cfg-field:not(.filter-hidden)').length;
    const availableToggle=card.querySelector('[data-safety-available="true"]');
    const switchOnly=!!availableToggle&&!_searchQuery&&_workspaceFilter!=='changed';
    card.classList.toggle('filter-hidden', count === 0&&!switchOnly);
    if ((_searchQuery || _workspaceFilter === 'changed') && count) card.open = true;
  });

  // Shortcuts and nested layouts follow the same filtered fields as their cards.
  for(const button of document.querySelectorAll('[data-protection-target]')){
    const card=document.querySelector(`[data-protection="${button.dataset.protectionTarget}"]`);
    button.hidden=!card||card.classList.contains('filter-hidden')||!!card.closest('.cfg-section.filter-hidden');
  }
  for(const nav of document.querySelectorAll('.protection-nav'))nav.hidden=!nav.querySelector('button:not([hidden])');
  for(const part of document.querySelectorAll('[data-group="safety"] .protection-part,[data-group="safety"] .startup-trip-card')){
    part.classList.toggle('filter-hidden',!part.querySelector('.cfg-field:not(.filter-hidden)')&&!part.querySelector('[data-safety-available="true"]'));
  }
  for(const grid of document.querySelectorAll('[data-group="safety"] .cfg-grid,[data-group="safety"] .startup-trip-grid'))
    grid.classList.toggle('filter-hidden',!grid.querySelector('.cfg-field:not(.filter-hidden)'));

  document.querySelectorAll('.config-group').forEach(group => {
    const sections = Array.from(group.querySelectorAll('.cfg-section'));
    const shownSections = sections.filter(section => !section.classList.contains('filter-hidden'));
    const count = Array.from(group.querySelectorAll('.cfg-field:not(.filter-hidden)')).filter(field => {
      const section = field.closest('.cfg-section');
      return !section || !section.classList.contains('filter-hidden');
    }).length;
    const alwaysVisible = group.dataset.alwaysVisible === '1' &&
      (_workspaceFilter !== 'changed' || _controllerRulesDirty || _controllerHardwareDirty);
    group.classList.toggle('filter-hidden', !alwaysVisible && count === 0);
    const meta = group.querySelector('.group-meta');
    if (meta && !alwaysVisible) meta.textContent = count ? `${count} setting${count === 1 ? '' : 's'}` : '';
    if ((search || _workspaceFilter === 'changed') && count) group.open = true;
  });

  refreshProtectionCount();

  // Field filtering runs before feature-gated sections are resolved. Recount
  // after the section/group pass so hidden governor/afterburner children never
  // inflate the result total or create an apparently empty expandable group.
  visibleFields = Array.from(document.querySelectorAll('.cfg-field:not(.filter-hidden)'))
    .filter(field => !field.closest('.cfg-section')?.classList.contains('filter-hidden') &&
                     !field.closest('.config-group')?.classList.contains('filter-hidden')).length;

  const empty = document.getElementById('cfg-empty');
  if (empty) empty.hidden = visibleFields !== 0;
  const result = document.getElementById('cfg-result-count');
  if (result) result.textContent = `${visibleFields} setting${visibleFields === 1 ? '' : 's'}`;
  const buttonMap = { configured:'btn-view-expert', explore:'btn-view-explore', changed:'btn-filter-changed' };
  Object.entries(buttonMap).forEach(([name,id]) => {
    const button = document.getElementById(id);
    if (!button) return;
    const active = _workspaceFilter === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  _updateWorkspaceState();
}

function initWorkspaceControls() {
  const search = document.getElementById('cfg-search');
  if (search && !search.dataset.bound) {
    search.dataset.bound = '1';
    search.addEventListener('input', () => setConfigSearch(search.value));
    search.addEventListener('keydown', event => {
      if (event.key === 'Escape') { search.value = ''; setConfigSearch(''); search.blur(); }
    });
  }
  document.querySelectorAll('.config-group').forEach(group => {
    // A fresh Controllers/System view starts as a compact overview. Search
    // and explicit deep links reopen only the card the user asked for.
    group.open = false;
  });
  if (!document.documentElement.dataset.cfgKeysBound) {
    document.documentElement.dataset.cfgKeysBound = '1';
    document.addEventListener('keydown', event => {
      const tag = event.target?.tagName;
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        event.preventDefault(); document.getElementById('cfg-search')?.focus();
      }
    });
  }
}

function setCfgFieldVisibleByElement(wrap, show) {
  if (!wrap) return;
  wrap.dataset.forceHidden = show ? '0' : '1';
  wrap.title = show ? '' : 'Unavailable with the current fitted hardware or controller selection.';
  if (!show && !wrap.dataset.inactiveReason) {
    wrap.dataset.inactiveReason = 'Unavailable with the current fitted hardware or controller selection.';
  }
  _refreshDependencyEditability();
  _scheduleWorkspaceRefresh();
}

function setCfgFieldVisible(key, show) {
  const el = document.getElementById('cf-' + key);
  setCfgFieldVisibleByElement(el?.closest('.cfg-field'), show);
}
function setCfgFieldHardHidden(key, hidden) {
  const wrap=document.getElementById('cf-'+key)?.closest('.cfg-field');
  if(!wrap)return;
  wrap.dataset.hardHidden=hidden?'1':'0';
  _scheduleWorkspaceRefresh();
}
// Mode-specific tuning fields appear only when their controller selects the
// advanced algorithm; the workspace then exposes them under Configured system.
// The field's own description also rewrites to explain the CURRENTLY selected
// mode, so picking Simple or Advanced shows exactly what that choice does.
const _RL_MODE_DESC = {
  0: 'Simple (reactive) — throttle eases back based on the shaft\'s current RPM as it approaches the soft limit.',
  1: 'Advanced (predictive) — anticipates RPM from its rate of rise (spool rate) and eases fuel off BEFORE an overshoot during a fast spool, then slows the throttle-open ramp as RPM nears the limit. EGT pullback stays reactive. Tune with the fields below in Configured system.'
};
const _DI_MODE_DESC = {
  0: 'Standard control adjusts the fuel floor from the current feedback error. Response tuning controls fuel movement and long-term correction.',
  1: 'Predictive control estimates future feedback and learns steady-idle fuel. Optional fast-deceleration catch requires a nonzero entry band and fuel reduction. Configure it below and verify the response on a safe stand.'
};
function _setFieldDesc(key, text) {
  const el = document.getElementById('cf-' + key);
  const wrap = el ? el.closest('.cfg-field') : null;
  const d = wrap ? wrap.querySelector('.cfg-desc') : null;
  if (d) d.textContent = text;
  if (wrap) {
    const label = wrap.querySelector('.cfg-label')?.textContent?.trim() || '';
    wrap.dataset.baseTitle = label ? `${label}: ${text}` : text;
    if (wrap.dataset.hardwareUnavailable !== '1') wrap.title = wrap.dataset.baseTitle;
  }
}
function updateRpmLimiterFields() {
  const adv = parseInt((document.getElementById('cf-rl_mode') || {}).value || 0) === 1;
  _setFieldDesc('rl_mode', _RL_MODE_DESC[adv ? 1 : 0]);
  ['rl_look', 'rl_ramp', 'rl_zone', 'rl_acc'].forEach(k => setCfgFieldVisible(k, adv));
}
function updateIdleModeFields() {
  const adv = parseInt((document.getElementById('cf-di_mode') || {}).value || 0) === 1;
  const pressure = parseInt((document.getElementById('cf-di_src') || {}).value || 0, 10) >= 2;
  _setFieldDesc('di_mode', _DI_MODE_DESC[adv ? 1 : 0]);
  ['di_dd', 'di_lk', 'di_tu', 'di_td', 'di_lr'].forEach(k => setCfgFieldHardHidden(k, !adv));
  ['di_de', 'di_sb', 'di_fr', 'di_la'].forEach(k => setCfgFieldHardHidden(k, !adv || pressure));
  ['di_pde', 'di_psb', 'di_pfr', 'di_plr'].forEach(k => setCfgFieldHardHidden(k, !adv || !pressure));
}
function updateIdleSourceFields() {
  const source = parseInt((document.getElementById('cf-di_src') || {}).value || 0, 10);
  const pressure = source >= 2;
  ['di_tr','di_db','di_rl'].forEach(k => setCfgFieldHardHidden(k, pressure));
  ['di_tp','di_pd','di_pl'].forEach(k => setCfgFieldHardHidden(k, !pressure));
  updateIdleModeFields();
  _setFieldDesc('di_src', pressure
    ? 'Pressure feedback is experimental. Establish a suitable pressure target and validate stability on a restrained test stand.'
    : 'Uses the selected shaft-speed input to regulate the Running fuel floor around its RPM target.');
}

function _fieldToDisplay(f, value) {
  if (['fi_low','fi_high'].includes(f.key)) return value * controllerInputDisplay(cfg?.dynamic_idle?.input_id).scale;
  let out = value;
  if (f.zeroOff && Number(out) === 0) return 0;
  if (f.unitType === 'temp') out = toDispTemp(out);
  else if (f.unitType === 'temp_delta' || f.unitType === 'temp_rate') out = toDispTempDelta(out);
  else if (f.unitType === 'press') out = toDispPress(out);
  return f.scale ? out * f.scale : out;
}

function _fieldFromDisplay(f, value) {
  if (['fi_low','fi_high'].includes(f.key)) return value / controllerInputDisplay(cfg?.dynamic_idle?.input_id).scale;
  if (f.zeroOff && Number(value) === 0) return 0;
  let out = f.scale ? value / f.scale : value;
  if (f.unitType === 'temp') return fromDispTemp(out);
  if (f.unitType === 'temp_delta' || f.unitType === 'temp_rate') return fromDispTempDelta(out);
  if (f.unitType === 'press') return fromDispPress(out);
  return out;
}

function _fieldStepToDisplay(f, value) {
  if (['fi_low','fi_high'].includes(f.key)) return value * controllerInputDisplay(cfg?.dynamic_idle?.input_id).scale;
  let out = value;
  if (f.unitType === 'temp' || f.unitType === 'temp_delta' || f.unitType === 'temp_rate') {
    out = tempUnit() === 'F' ? out * 9 / 5 : out;
  } else if (f.unitType === 'press') {
    out = toDispPress(out);
  }
  return f.scale ? out * f.scale : out;
}

function _roundedDisplay(value) {
  return String(Math.round(value * 1000) / 1000);
}

function _fieldDef(key) {
  for (const sec of SCHEMA) {
    const found = sec.fields.find(f => f.key === key);
    if (found) return found;
  }
  return null;
}

function _switchConfigUnit(unitTypes, setter, nextUnit) {
  const fields = [];
  SCHEMA.forEach(sec => sec.fields.forEach(f => {
    if (!unitTypes.includes(f.unitType)) return;
    const el = document.getElementById('cf-' + f.key);
    if (!el || el.type === 'checkbox') return;
    const current = parseFloat(el.value);
    const snap = parseFloat(_fieldSnap[el.id]);
    fields.push({
      f, el,
      current: isNaN(current) ? null : _fieldFromDisplay(f, current),
      snap: isNaN(snap) ? null : _fieldFromDisplay(f, snap)
    });
  }));
  setter(nextUnit);
  fields.forEach(({ f, el, current, snap }) => {
    if (current !== null) el.value = _roundedDisplay(_fieldToDisplay(f, current));
    if (snap !== null) _fieldSnap[el.id] = _roundedDisplay(_fieldToDisplay(f, snap));
    if (f.min !== undefined) el.min = _roundedDisplay(_fieldToDisplay(f, f.min));
    if (f.max !== undefined) el.max = _roundedDisplay(_fieldToDisplay(f, f.max));
    if (f.step !== undefined) el.step = _roundedDisplay(_fieldStepToDisplay(f, f.step));
  });
  _refreshChangedBorders();
  runValidation();
}

function setConfigTempUnit(value) {
  _switchConfigUnit(['temp', 'temp_delta', 'temp_rate'], setTempUnit, value);
}

function setConfigPressUnit(value) {
  _switchConfigUnit(['press'], setPressUnit, value);
}

function _detailsStateKey(card) {
  const owner=card.closest('[data-controller-output],[data-behavior-output],[data-built-in]');
  const identity=owner?.hasAttribute('data-controller-id')?'controller:'+owner.dataset.controllerId:owner?['data-controller-output','data-behavior-output','data-built-in'].map(a=>owner.getAttribute(a)||'').join(':'):card.closest('.config-group')?.querySelector('.group-title')?.textContent||'settings';
  if(card===owner)return identity;
  return identity+'|'+(card.dataset.protection||card.dataset.subcard||card.id||card.dataset.group||card.querySelector(':scope > summary')?.textContent.trim()||'');
}
function _captureControllerOpenState() {
  return new Map([...document.querySelectorAll('#controller-overview details,#cfg-form details')].map(card=>[_detailsStateKey(card),card.open]));
}
function _restoreControllerOpenState(state) {
  if(!(state instanceof Map))return;
  document.querySelectorAll('#controller-overview details,#cfg-form details').forEach(card=>{
    const key=_detailsStateKey(card);if(state.has(key))card.open=state.get(key);
  });
}

function renderForm(preserveControllerOpenState = true) {
  const controllerOpenState = preserveControllerOpenState ? _captureControllerOpenState() : [];
  document.body.classList.toggle('system-surface', CONFIG_SURFACE === 'system');
  const workspaceTitle = document.querySelector('.cfg-workspace-title');
  if (workspaceTitle) workspaceTitle.textContent = CONFIG_SURFACE === 'system' ? 'System' : 'Controllers';
  const configuredOilPumps = (hwCfg?.channel_registry?.outputs || []).filter(channel =>
    channel?.installed !== false && !String(channel?.mirror_of || '') &&
    String(channel.purpose || channel.role || '') === 'oil_pump');
  const oilPumpIsBinary = channel => [4, 11].includes(Number(channel?.driver));
  const allOilPumpsBinary = configuredOilPumps.length > 0 && configuredOilPumps.every(oilPumpIsBinary);
  const mixedOilPumpDrivers = configuredOilPumps.some(oilPumpIsBinary) && configuredOilPumps.some(channel => !oilPumpIsBinary(channel));
  const protectionGroups = [
    {id:'n1', title:`${controllerPurposeNames(['n1_speed']) || 'N1'} · core speed`, desc:'Dashboard reference, optional gradual fuel limiting, and separately enabled overspeed shutdown.',
      keys:['sf_us_en','pb_n1e','pb_n1s','pb_n1h','rpm_limit','min_rpm'], advanced:['pb_n1l','pb_n1str','rl_ramp','rl_zone','rl_acc']},
    {id:'n2', title:`${controllerPurposeNames(['n2_speed']) || 'N2'} · output-shaft speed`, desc:'Dashboard reference, optional gradual fuel limiting, and separately enabled overspeed shutdown.',
      keys:['pb_n2e','pb_n2s','pb_n2h','n2_rpm_limit'], advanced:['pb_n2l','pb_n2str']},
    {id:'egt', title:`${controllerPurposeNames(controllerTemperaturePurposes()) || 'Turbine temperature'} · temperature protection`, desc:'Separate startup limits, normal fault shutdown, and gradual fuel limiting. Uses the selected, user-named TOT/TIT sensor.',
      keys:['eg_src','pb_egte','pb_egts','pb_egth','tot_limit','sf_tit','sf_sg_en','sf_st_en','sf_sd_en','sf_st','sf_sd','sf_sm','sf_hs','tot_safe_margin'], advanced:['pb_egtl','pb_egtstr']},
    {id:'p1', title:`${controllerChannelName(controllerInputs('p1_pressure')[0]) || 'Pressure 1'} protection`, desc:'User-named pressure input: gradual fuel reduction followed by an optional high-pressure shutdown.',
      keys:['pb_p1e','pb_p1s','pb_p1h','sf_p1en','sf_p1t','sf_p1d'], advanced:['pb_p1l','pb_p1str']},
    {id:'p2', title:`${controllerChannelName(controllerInputs('p2_pressure')[0]) || 'Pressure 2'} protection`, desc:'User-named pressure input: gradual fuel reduction followed by an optional high-pressure shutdown.',
      keys:['pb_p2e','pb_p2s','pb_p2h','sf_p2en','sf_p2t','sf_p2d'], advanced:['pb_p2l','pb_p2str']},
    {id:'torque', title:`${controllerPurposeNames(['torque']) || 'Shaft torque'} · torque protection`, desc:'Gradual fuel reduction followed by an optional over-torque shutdown.',
      keys:['pb_tqe','pb_tqs','pb_tqh','sf_tqen','sf_tqt','sf_tqd'], advanced:['pb_tql','pb_tqstr']},
  ];
  for(const card of protectionGroups){const mode=card.keys.find(key=>/^pb_.*e$/.test(key));if(mode)card.keys.push(mode+'_on');}
  const gradualSection = SCHEMA.find(section => section.title === 'Gradual Fuel Limit Protection');

  const renderField = (f, sec, group) => {
    let val = getPath(cfg, f.path);
    if (val===undefined && ["sf_oil_modes","sf_fp_modes"].includes(f.key)) val=4;
    if(val===undefined&&f.legacyThreshold)val=Number(getPath(cfg,f.legacyThreshold))>0;
    if (f.key === 'fi_mode') val = displayedIdleMode();
    if (f.key === 'fi_input' && !Number(cfg?.dynamic_idle?.fuel_mode || 0)) val = '';
    const isCb  = f.type === 'checkbox';
    const binaryOilFallback = f.key === 'oil_fp' && allOilPumpsBinary;
    const isSel = f.type === 'select' || binaryOilFallback;
    let runtimeOptions = binaryOilFallback
      ? [{v:0,l:'Off'},{v:100,l:'On'}]
      : (typeof f.options === 'function' ? f.options() : (f.options || []));
    if (f.key === 'fi_mode' && val === 0) runtimeOptions = [{v:0,l:'Choose idle mode',hidden:true},...runtimeOptions];
    if (binaryOilFallback) val = Number(val) > 0 ? 100 : 0;
    const idleRange = ['fi_low','fi_high'].includes(f.key);
    const idleUnit = idleRange ? controllerInputDisplay(cfg?.dynamic_idle?.input_id).unit : '';
    const fieldLabel = binaryOilFallback ? 'Pump State After Pressure-Sensor Failure' : configuredFieldLabel(f) + (idleUnit ? ` (${idleUnit})` : '');
    const fieldDesc = f.key === 'oil_fp' && mixedOilPumpDrivers
      ? `${f.desc} Binary pumps use 0% as Off and any positive value as On.`
      : f.desc;
    if (!isCb && !isSel && (f.unitType || f.scale || idleRange) && val !== undefined) {
      val = _fieldToDisplay(f, val);
      val = Math.round(val * 1000) / 1000;
    }
    const isTempUnit = f.unitType === 'temp' || f.unitType === 'temp_delta';
    const unitSuffix = (!isSel && f.unitType)
      ? f.unitType === 'temp_rate'
        ? ` (<span data-unit="temp">${dispTempUnit()}</span>/s)`
        : ` (<span data-unit="${isTempUnit ? 'temp' : 'press'}">${isTempUnit ? dispTempUnit() : dispPressUnit()}</span>)`
      : (!isSel && f.unit ? ` (${f.unit})` : '');
    const min = (!isCb && !isSel && f.min !== undefined) ? ` min="${_roundedDisplay(_fieldToDisplay(f, f.min))}"` : '';
    const max = (!isCb && !isSel && f.max !== undefined) ? ` max="${_roundedDisplay(_fieldToDisplay(f, f.max))}"` : '';
    const step = (!isCb && !isSel) ? _roundedDisplay(_fieldStepToDisplay(f, f.step || 1)) : null;
    const aria = ` aria-label="${_escHtml(fieldLabel)}"`;
    const renderOptions = options => {
      let html = '';
      let group = '';
      options.forEach(o => {
        const nextGroup = String(o.group || '');
        if (nextGroup !== group) {
          if (group) html += '</optgroup>';
          group = nextGroup;
          if (group) html += `<optgroup label="${_escHtml(group)}">`;
        }
        html += `<option value="${_escHtml(o.v)}"${val == o.v ? ' selected' : ''}${o.hidden ? ' hidden disabled' : ''}>${_escHtml(configuredSourceOptionLabel(f.key, o))}</option>`;
      });
      if (group) html += '</optgroup>';
      return html;
    };
    const inp = isCb
      ? `<input type="checkbox" id="cf-${f.key}"${aria}${val ? ' checked' : ''}${isLocked ? ' disabled' : ''}>`
      : isSel
      ? `<select id="cf-${f.key}"${aria}${isLocked ? ' disabled' : ''}>${renderOptions(runtimeOptions)}</select>`
      : `<input type="number" id="cf-${f.key}"${aria} value="${val !== undefined ? val : ''}"
        step="${step}"${min}${max}${isLocked ? ' disabled' : ''}>`;
    const wid = f.wrapId ? ` id="${f.wrapId}"` : '';
    const level = f.basic ? 'essential' : 'advanced';
    const searchText = `${f.key} ${fieldLabel} ${fieldDesc} ${sec.title} ${sec.sectionNote || ''} ${group.title}`.toLowerCase();
    if(f.protectionToggle)return `<div class="cfg-field protection-enable" title="${_escHtml(fieldDesc)}" data-key="${f.key}" data-level="essential" data-search="${_escHtml(searchText)}"><label><span class="cfg-label">${_escHtml(fieldLabel)}</span>${inp}<b data-toggle-state>${val?'ON':'OFF'}</b></label></div>`;
    const dashboardNote={
      rpm_limit:'Dashboard: sets the N1 bar scale and warning colours. Enabling overspeed shutdown also shows the red marker.',
      n2_rpm_limit:'Dashboard: sets the N2 bar scale and warning colours. Enabling overspeed shutdown also shows the red marker.',
      tot_limit:'Dashboard: sets the normal TOT bar scale, warning colours and shutdown marker. Startup protection can use a separate limit.',
      sf_tit:'Dashboard: sets the normal TIT bar scale, warning colours and shutdown marker. Startup protection can use a separate limit.',
      sf_ot:'Dashboard: sets the oil-temperature bar scale, warning colours and shutdown marker.',
      sf_p1t:'Dashboard: sets the pressure bar scale, warning colours and limit marker. Zero uses auto range; shutdown off keeps the advisory.',
      sf_p2t:'Dashboard: sets the pressure bar scale, warning colours and limit marker. Zero uses auto range; shutdown off keeps the advisory.',
      sf_tqt:'Dashboard: sets the torque bar scale, warning colours and limit marker. Zero uses auto range; shutdown off keeps the advisory.',
      sf_st:'Dashboard: sets the TOT/TIT startup reference while this trip and the separate startup guard are enabled.',
      sf_sd:'Dashboard startup reference when this trip and the startup guard are enabled and the immediate trip is off.',
      oil_rm:'Dashboard low-oil-pressure warning reference; the maximum display range is separate.',
      sf_fp:'Dashboard low-fuel-pressure warning reference; the maximum display range is separate.',
      sf_bv:'Dashboard low-voltage warning reference; the maximum display range is separate.'
    }[f.key];
    return `<div class="cfg-field"${wid} data-key="${f.key}" data-level="${level}" data-search="${_escHtml(searchText)}">
      <div class="cfg-field-head"><div class="cfg-label">${_escHtml(fieldLabel)}${unitSuffix}</div>
        ${level === 'advanced' ? '<span class="field-level">Advanced</span>' : ''}</div>
      ${inp}
      ${dashboardNote?`<p class="cfg-desc dashboard-field-note">${dashboardNote}</p>`:''}
      <details class="cfg-help"><summary>About this setting</summary><div class="cfg-desc">${fieldDesc}</div></details>
    </div>`;
  };

  const renderSection = (sec, group) => {
    if (sec.title === 'Gradual Fuel Limit Protection') return '';
    const noteHtml = sec.id === 'idle-control-cfg-section'
      ? `<p class="idle-context">Startup fuel commands remain in Sequence. These settings apply in Running.</p>`
      : sec.sectionNote
      ? `<div style="font-size:.72rem;color:var(--dim);background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:5px;padding:.35rem .65rem;margin:.25rem 0 .5rem;line-height:1.5">${sec.sectionNote}</div>`
      : '';
    const isProtection = sec.id === 'engine-limits';
    const displayTitle = isProtection ? 'Fuel Limiting & Hard Shutdowns' : sec.title;
    const allProtectionFields = isProtection ? [...sec.fields, ...(gradualSection?.fields || []), ...SCHEMA.find(s=>s.title==='Combustion & Startup Protection').fields.filter(f=>f.key==='sf_hs')] : sec.fields;
    const localSafety = {
      'Oil Pressure Safety': [
        {key:'low_oil',label:'Oil pressure protection',available:controllerInputs('oil_pressure').length||controllerInputs('low_oil_switch').length||controllerInputs('oil_zero_switch').length,requirement:'Fit oil pressure or a low-oil switch',keys:['sf_oil_modes','oil_rm','sf_lo_d'],desc:'Fault shutdown after low pressure or the oil switch ON condition persists for its confirmation time; choose the monitoring phases below'},
        {label:'Low oil flow',configToggle:'oil_ufs',available:hasMonitoredOilFlowInputs(),requirement:'Fit a matching flow input and enable monitoring on an oil or scavenge pump in Hardware',keys:['oil_ufd','oil_ufs'],desc:'Flow-fault confirmation and optional shutdown'}
      ],
      'Combustion & Startup Protection': [
        {key:'flameout',label:'Combustion loss',available:controllerInputs('flame').length||controllerInputs('n1_speed').length||controllerInputs('tot').length||controllerInputs('tit').length,requirement:'Fit flame, N1, TOT, or TIT feedback',keys:['sf_fo','sf_fs','sf_fn','sf_eb','sf_ef'],desc:'Independent confirmed-loss timer; expiry cuts fuel and fault-shuts down'},
        {label:'Safety evaluation timing',available:true,keys:['sf_ci'],desc:'General protection check interval'}
      ],
      'Auxiliary Protection': [
        {key:'oil_temp_high',label:'High oil temperature',available:controllerInputs('oil_temperature').length,requirement:'Fit an oil-temperature input',keys:['sf_ot','sf_ot_d'],desc:'Temperature shutdown threshold and confirmation'},
        {key:'fuel_press_low',label:'Low fuel pressure',available:controllerInputs('fuel_pressure').length,requirement:'Fit a fuel-pressure input',keys:['sf_fp_modes','sf_fp','sf_fp_d'],desc:'Low-pressure threshold, confirmation time and selectable monitoring phases'},
        {key:'batt_low',label:'Low supply voltage',available:controllerInputs('battery_voltage').length,requirement:'Fit a voltage input',keys:['sf_bv','sf_bv_d'],desc:'Bus-voltage threshold and confirmation'},
        {key:'surge',label:'Surge detection',available:controllerInputs('n1_speed').length,requirement:'Fit an N1 speed input',keys:['sf_sg'],desc:'Experimental N1 instability threshold'}
      ],
      'RPM Sensor Fault Detection': [
        {label:'Shaft-speed signal fault detection',available:controllerInputs('n1_speed').length||controllerInputs('n2_speed').length,requirement:'Fit an N1 or N2 shaft-speed input',keys:['rh_jt','rh_zs'],desc:'Reject implausible speed jumps and detect a running sensor stuck at zero'}
      ],
      'RC / Servo Signal Loss Detection': [
        {label:'Pulse and servo-signal fault detection',available:true,keys:['rc_fs'],desc:'Timeout for RC pulse, servo pulse, and registry PWM-duty inputs'}
      ]
    }[sec.title] || [];
    const localSafetyHtml = localSafety.length ? `<div class="protection-stack">${localSafety.map(item => {
      const sourcePurposes = {low_oil:['oil_pressure','low_oil_switch','oil_zero_switch'],oil_zero:['oil_pressure','oil_zero_switch'],
        flameout:['flame','n1_speed',...controllerTemperaturePurposes()],hot_start:controllerTemperaturePurposes(),
        oil_temp_high:['oil_temperature'],fuel_press_low:['fuel_pressure'],batt_low:['battery_voltage'],surge:['n1_speed']};
      const fittedNames = controllerPurposeNames(sourcePurposes[item.key] || []);
      const fields = item.keys.map(key => sec.fields.find(field => field.key === key)).filter(Boolean);
      const toggle = item.key ? controllerSafetyToggle(item.key,item.label,item.available,item.requirement,isLocked) : item.configToggle?renderField(fields.find(f=>f.key===item.configToggle),sec,group):'';
      const configured=item.key?!!hwCfg?.safety?.[item.key]:item.configToggle?!!getPath(cfg,fields.find(f=>f.key===item.configToggle).path):false;
      const active = configured && item.available;
      const attention = configured && !item.available;
      const phaseKey = {low_oil:'oil_pressure_modes',fuel_press_low:'fuel_pressure_modes'}[item.key];
      const phaseSummary = phaseKey ? ' · '+({2:'Startup',4:'Running',6:'Startup and Running'}[Number(cfg?.safety?.[phaseKey] ?? 4)] || 'Check monitoring phases') : '';
      const summaryState = item.key||item.configToggle?`<span class="protection-modes"><span data-enabled="${!!active}" data-state="${attention?'check':''}" ${item.configToggle?`data-config-safety="${item.configToggle}"`:''}>${item.key==='hot_start'?'Start interlock':'Fault shutdown'}: ${active?'ON':attention?'unavailable':'OFF'}${_escHtml(phaseSummary)}</span></span>`:'';
      return `<details id="protection-${item.key || item.configToggle || item.id || item.keys[0]}" class="protection-card" data-protection="${item.key || item.id || item.label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}">
        <summary><span><span class="protection-card-title">${item.label}</span><span class="protection-card-desc">${_escHtml(item.available ? item.desc : item.requirement)}${fittedNames ? ' · Fitted inputs: ' + _escHtml(fittedNames) : ''}</span>${summaryState}</span><span class="protection-card-chevron">›</span></summary>
        <div class="protection-local-body"><div class="protection-local-toolbar">${toggle}</div>${item.key==='low_oil'?'<p class="protection-dashboard-note">For another oil circuit, <a href="#simple-controls">create a custom controller</a> with its named input and Request Fault Shutdown. Each controller has its own condition and activation settings.</p>':''}${['low_oil','oil_zero'].includes(item.key)&&!controllerInputs('oil_pressure').length?'<p class="protection-dashboard-note">Switch contacts have a built-in 20 ms debounce. Set any additional fault confirmation time below; 0 adds no delay. Switch polarity is set in Hardware. Analogue pressure limits do not apply to this switch.</p>':''}${({low_oil:'oil_rm',oil_zero:'oil_rm',oil_temp_high:'sf_ot',fuel_press_low:'sf_fp',batt_low:'sf_bv'})[item.key]&&(!['low_oil','oil_zero'].includes(item.key)||controllerInputs('oil_pressure').length)?`<p class="protection-dashboard-note">Dashboard colours use the retained <a href="#cf-${({low_oil:'oil_rm',oil_zero:'oil_rm',oil_temp_high:'sf_ot',fuel_press_low:'sf_fp',batt_low:'sf_bv'})[item.key]}">advisory limit</a> even when automatic shutdown is off. Also available from Dashboard → Edit cards → Edit limit &amp; safety.</p>`:''}<div class="cfg-grid">${fields.filter(field=>field.key!==item.configToggle).map(field => renderField(field, sec, group)).join('')}</div></div>
      </details>`;
    }).join('')}</div>` : '';
    let fieldHtml = isProtection
      ? `<div class="protection-nav" role="navigation" aria-label="Protection shortcuts">${protectionGroups.map(card=>`<button type="button" data-protection-target="${card.id}" onclick="openProtection('${card.id}')">${_escHtml(card.title.split(' · ')[0].replace(/ protection$/,''))}</button>`).join('')}</div><div class="protection-stack">${protectionGroups.map((card, index) => {
          const fields = card.keys.map(key => allProtectionFields.find(field => field.key === key)).filter(Boolean);
          const advancedFields = (card.advanced || []).map(key => allProtectionFields.find(field => field.key === key)).filter(Boolean);
          const safety = card.id === 'n1' ? controllerSafetyToggle('overspeed','N1 overspeed',controllerInputs('n1_speed').length,'Fit an N1 speed input',isLocked)
            : card.id === 'n2' ? controllerSafetyToggle('n2_overspeed','N2 overspeed',controllerInputs('n2_speed').length,'Fit an N2 speed input',isLocked)
            : card.id === 'egt' ? controllerSafetyToggle('overtemp','Engine overtemperature',controllerInputs('tot').length||controllerInputs('tit').length,'Fit a TOT or TIT input',isLocked) : '';
          const safetyKey = card.id === 'n1' ? 'overspeed' : card.id === 'n2' ? 'n2_overspeed' : card.id === 'egt' ? 'overtemp' : '';
          const safetyAvailable = card.id === 'n1' ? controllerInputs('n1_speed').length : card.id === 'n2' ? controllerInputs('n2_speed').length : card.id === 'egt' ? (controllerInputs('tot').length||controllerInputs('tit').length) : controllerInputs({p1:'p1_pressure',p2:'p2_pressure',torque:'torque'}[card.id]).length;
          const summaryState = safetyKey && hwCfg?.safety?.[safetyKey]
            ? `<b class="controller-state ${safetyAvailable?'controller-state-ok':'controller-state-warn'}">● ${safetyAvailable?'ENABLED':'CHECK'}</b>` : '';
          const renderKeys=keys=>fields.filter(f=>keys.includes(f.key)).map(field=>renderField(field,sec,group)).join('');
          const part=(title,description,body,kind,toggle='')=>`<section class="protection-part protection-part-${kind}"><div class="protection-part-head"><h4>${title}</h4>${toggle}</div><p>${description}</p>${body}</section>`;
          const grid=body=>`<div class="cfg-grid">${body}</div>`;
          const limitingKeys=card.keys.filter(key=>key.startsWith('pb_')&&!key.endsWith('_on'));
          const modeKey=limitingKeys.find(key=>key.endsWith('e'));
          const limiterToggle=renderKeys([modeKey+'_on']);
          const hasLimiting=!!getPath(cfg,allProtectionFields.find(f=>f.key===modeKey+'_on')?.path||[]);
          const modeStatus=`<span class="protection-modes">${card.id==='egt'?`<span data-enabled="${!!hwCfg?.safety?.hot_start&&!!safetyAvailable}">Start interlock: ${hwCfg?.safety?.hot_start?(safetyAvailable?'ON':'unavailable'):'OFF'}</span><span data-startup-guard-state>Startup guard: ${cfg.sequence?.startup?.startup_egt_guard_enabled?'on':'off'}</span>`:''}<span ${safetyKey?`data-enabled="${!!hwCfg?.safety?.[safetyKey]&&!!safetyAvailable}" data-state="${hwCfg?.safety?.[safetyKey]&&!safetyAvailable?'check':''}"`:'data-trip-state aria-live="polite"'}>${safetyKey?`Shutdown: ${!hwCfg?.safety?.[safetyKey]?'OFF':safetyAvailable?'ON':'unavailable'}`:''}</span>${card.id==='n1'?'<span data-underspeed-state></span>':''}<span>Fuel limiting: ${hasLimiting?'on':'off'}</span></span>`;
          let body;
          if(card.id==='egt'){
            const enabled=!!cfg.sequence?.startup?.startup_egt_guard_enabled;
            body=grid(renderKeys(['eg_src']))+
              part('Hot-engine start interlock','Before START only: blocks starting until the selected temperature is below this limit. Separate from temperature monitoring during Startup.',grid(renderKeys(['sf_hs'])),'startup',controllerSafetyToggle('hot_start','Hot-engine start interlock',safetyAvailable,'Fit a TOT or TIT input',isLocked))+
              part('Startup protection',enabled?'Separate startup guard is on. Normal temperature shutdown and temperature fuel limiting resume in Running.':'Separate startup guard is off. Normal temperature shutdown and temperature fuel limiting also apply during Startup.',`<div class="startup-trip-grid"><section class="startup-trip-card">${renderKeys(['sf_st_en'])}${grid(renderKeys(['sf_st']))}</section><section class="startup-trip-card">${renderKeys(['sf_sd_en'])}${grid(renderKeys(['sf_sd','sf_sm']))}</section></div>`+'<p class="protection-note">Use the engine’s approved starting limits. Sustained heat protection does not measure acceleration; use an N1 confirmation block with a timeout in Sequence to detect a hung start.</p>','startup',renderKeys(['sf_sg_en']))+
              part('Running protection','Fault shutdown cuts fuel when the selected temperature exceeds its limit. With the separate startup guard off, this also protects Startup.',grid(renderKeys(['tot_limit','sf_tit','tot_safe_margin'])),'trip',safety)+
              part('Fuel limiting','Gradually reduces fuel demand before a trip. Independent of the shutdown switch above. During Startup it is paused only when the separate startup guard is on.',grid(renderKeys(limitingKeys))+`<div class="cfg-grid protection-predictive-fields" data-predictive-for="${card.id}">${advancedFields.map(field=>renderField(field,sec,group)).join('')}</div>`,'limiting',limiterToggle);
          }else if(card.id==='n1'){
            body=part('Overspeed shutdown','Cuts fuel above Maximum N1 Speed. Independent of underspeed shutdown and gradual fuel limiting.',grid(renderKeys(['rpm_limit'])),'trip',safety)+
              part('Underspeed shutdown','Cuts fuel if N1 falls below its minimum while Running, or after confirmed spool-up during Startup. Independent of the overspeed switch.',grid(renderKeys(['min_rpm'])),'trip',renderKeys(['sf_us_en']))+
              part('Fuel limiting','Reduces fuel progressively before the limit. The enable switch preserves the selected method and all tuning.',grid(renderKeys(limitingKeys))+`<div class="cfg-grid protection-predictive-fields" data-predictive-for="${card.id}">${advancedFields.map(field=>renderField(field,sec,group)).join('')}</div>`,'limiting',limiterToggle);
          }else{
            body=part('Fault shutdown',safetyKey?'Cuts fuel after the trip condition is met. This switch does not enable gradual fuel limiting.':'The enable switch controls automatic shutdown. Switching off preserves the limit and confirmation time. Fuel limiting is independent.',grid(fields.filter(f=>!f.protectionToggle&&!limitingKeys.includes(f.key)).map(field=>renderField(field,sec,group)).join(''))+renderKeys(card.id==='n1'?['sf_us_en']:[]),'trip',safety||renderKeys([{p1:'sf_p1en',p2:'sf_p2en',torque:'sf_tqen'}[card.id]]))+
              part('Fuel limiting','Reduces fuel demand progressively. Enable it separately, then choose Simple or Predictive. Switching off preserves the method and limits.',grid(renderKeys(limitingKeys))+`<div class="cfg-grid protection-predictive-fields" data-predictive-for="${card.id}">${advancedFields.map(field=>renderField(field,sec,group)).join('')}</div>`,'limiting',limiterToggle);
          }
          return `<details id="protection-${card.id}" class="protection-card" data-protection="${card.id}" data-state="${safetyAvailable?'ready':'unavailable'}">
            <summary><span><span class="protection-card-title">${_escHtml(card.title)}</span><span class="protection-card-desc">${card.desc}</span>${modeStatus}</span><span class="protection-card-chevron">›</span></summary><p class="protection-dashboard-note">${({n1:'rpm_limit',n2:'n2_rpm_limit',egt:'tot_limit'})[card.id]?`Dashboard yellow/red approach colours use the retained <a href="#cf-${({n1:'rpm_limit',n2:'n2_rpm_limit',egt:'tot_limit'})[card.id]}">reference limit</a>${card.id==='egt'?' (or <a href="#cf-sf_tit">TIT limit</a> for TIT)':''}. With automatic shutdown on, the red marker shows that limit. With shutdown off, the colours remain advisory and the shutdown marker is hidden. You can also find this via <a href="/">Dashboard</a> → Edit cards → Edit limit &amp; safety.`:'A positive saved limit sets the Dashboard bar scale, yellow/red approach colours and limit marker, even when automatic shutdown is off. With no positive limit, the bar uses automatic range. The enable switch independently controls automatic shutdown.'}</p>${body}
          </details>`;
        }).join('')}</div>`
      : localSafety.length ? localSafetyHtml : `<div class="cfg-grid">${sec.fields.map(field => renderField(field, sec, group)).join('')}</div>`;
    if (!isProtection && sec.id === 'idle-control-cfg-section') {
      const byKey = key => sec.fields.find(field => field.key === key);
      const renderKeys = keys => keys.map(byKey).filter(Boolean).map(field => renderField(field, sec, group)).join('');
      const primary = ['di_src','di_tr','di_tp','di_db','di_pd','di_rl','di_pl','di_mode'];
      const response = ['di_ru','di_rd','di_mx','di_ig','di_im'];
      const predictive = ['di_de','di_dd','di_lk','di_sb','di_fr','di_tu','di_td','di_lr','di_la','di_pde','di_psb','di_pfr','di_plr'];
      const idleMode = displayedIdleMode();
      const automaticIdleFields = idleMode === 4 ? `<div class="automatic-idle-settings" data-always-visible="1"><h3 class="idle-settings-heading">Feedback control</h3><div class="cfg-grid idle-feedback-grid">${renderKeys(primary)}</div>
        <div class="protection-stack idle-tuning-stack">
          <details class="protection-card"><summary><span><span class="protection-card-title">Response tuning</span><span class="protection-card-desc">Fuel movement and long-term idle correction</span></span><span class="protection-card-chevron">›</span></summary><div class="cfg-grid">${renderKeys(response)}</div></details>
          <details class="protection-card"><summary><span><span class="protection-card-title">Predictive tuning</span><span class="protection-card-desc">Shown only for the predictive method; a zero fuel drop keeps deceleration catch off</span></span><span class="protection-card-chevron">›</span></summary><div class="cfg-grid">${renderKeys(predictive)}</div></details>
        </div></div>` : '';
      const idle = configuredIdleSource();
      const idleLinks = [0,3].includes(idleMode) ? '<a href="/hardware.html">Configure inputs</a> · <a href="/sequence.html">Startup sequence</a>' : idleMode === 4 && automaticIdleRequirements() ? '<a href="/hardware.html">Configure hardware</a>' : '';
      fieldHtml = `<div class="idle-setup"><div class="cfg-grid idle-mode-grid">${renderKeys(['fi_mode'])}${idleMode === 2 ? renderKeys(['fi_fixed']) : ''}${[0,3,4].includes(idleMode) ? renderKeys(['th_mx']) : ''}</div>${idleMode === 3 ? `<div class="cfg-grid">${renderKeys(['fi_input'])}${Number(cfg?.dynamic_idle?.fuel_mode || 0) === 3 && cfg?.dynamic_idle?.input_id ? renderKeys(['fi_low','fi_high']) : ''}</div>` : ''}<div class="idle-summary" data-configured-idle-source><span class="cfg-label">Effective Running idle</span><strong>${_escHtml(idle.title)}</strong><span class="cfg-desc">${_escHtml(idle.description)}</span>${idleLinks ? `<span class="cfg-desc">${idleLinks}</span>` : ''}</div>${automaticIdleFields}</div>`;
    }
    return `
    <section class="cfg-section"${sec.id ? ` id="${sec.id}"` : ''} data-section="${_escHtml(sec.title)}">
      <div class="cfg-title">${displayTitle}<span class="cfg-title-count"></span></div>
      ${noteHtml}${fieldHtml}
    </section>`;
  };

  const sectionByTitle = new Map(SCHEMA.map(section => [section.title, section]));
  const renderGroups = groups => groups.map((group, index) => {
    const sections = group.sections.map(title => sectionByTitle.get(title)).filter(Boolean);
    return `<details class="config-group" data-group="${group.id}">
      <summary>
        <span class="group-heading"><span class="group-title">${group.title}</span><span class="group-desc">${group.desc}</span></span>
        ${group.id==='safety'?'<span class="protection-active-count" data-protection-active-count></span>':''}<span class="group-meta"></span><span class="group-chevron" aria-hidden="true">›</span>
      </summary>
      <div class="group-content">${sections.map(section => renderSection(section, group)).join('')}</div>
    </details>`;
  }).join('');
  const normalGroupsHtml = renderGroups(WORKSPACE_GROUPS.filter(group => group.id !== 'safety'));
  const safetyGroupsHtml = renderGroups(WORKSPACE_GROUPS.filter(group => group.id === 'safety'));
  document.getElementById('cfg-form').innerHTML =
    (CONFIG_SURFACE === 'system' ? '<section id="system-device-setup" class="cfg-section" data-always-visible="1" data-section="Device and communications"></section>' : '') +
    normalGroupsHtml +
    (CONFIG_SURFACE === 'controllers' ? '<section id="simple-controls" class="cfg-section" data-always-visible="1" data-section="Custom controllers"></section>' : '') +
    safetyGroupsHtml +
    '<div id="cfg-empty" class="cfg-empty" hidden>No settings match this search and filter.</div>';
  if (typeof renderSystemSetup === 'function') renderSystemSetup();
  if (typeof renderSimpleControls === 'function') renderSimpleControls();
  // Controller cards are the workspace itself. Build them only after the
  // generated field sections and editable definitions exist so their local
  // settings can be mounted inside the correct output card.
  renderControllerOverview();
  initWorkspaceControls();
  _restoreControllerOpenState(controllerOpenState);

  document.getElementById('btn-save').disabled = _cfgSavePending || isLocked || !_cfgDirty;
  document.getElementById('lock-warn').style.display = isLocked ? '' : 'none';

  // Inject live sensor badges next to relevant fields
  injectLiveBadges();

  // Show/hide oil map max field based on throttle-map toggle
  applyOilMapVisibility();

  // Wire AB ignition method conditional fields
  applyAbIgnitionParamVisibility();
  const _abUtEl = document.getElementById('cf-ab_ut');
  const _abFmEl = document.getElementById('cf-ab_fm');
  if (_abUtEl) _abUtEl.addEventListener('change', applyAbIgnitionParamVisibility);
  if (_abFmEl) _abFmEl.addEventListener('change', applyAbIgnitionParamVisibility);
  refreshStartupGuardUi();
  document.getElementById('cf-sf_sg_en')?.addEventListener('change',refreshStartupGuardUi);
  const _egSrcEl = document.getElementById('cf-eg_src');
  if (_egSrcEl) _egSrcEl.addEventListener('change', () => {
    applyHwConditions();
    applyFlameoutRelightVisibility();
    runValidation();
  });
  const _flSrcEl = document.getElementById('cf-sf_fs');
  const _rlTriggerEl = document.getElementById('cf-rl_ts');
  const _rlSrcEl = document.getElementById('cf-rl_cs');
  if (_flSrcEl) _flSrcEl.addEventListener('change', applyFlameoutRelightVisibility);
  if (_rlTriggerEl) _rlTriggerEl.addEventListener('change', applyFlameoutRelightVisibility);
  if (_rlSrcEl) _rlSrcEl.addEventListener('change', applyFlameoutRelightVisibility);
  applyFlameoutRelightVisibility();

  // Wire RPM-limiter & dynamic-idle advanced-mode conditional fields
  updateRpmLimiterFields();
  updateIdleModeFields();
  updateIdleSourceFields();
  const _rlModeEl = document.getElementById('cf-rl_mode');
  const _diModeEl = document.getElementById('cf-di_mode');
  const _diSourceEl = document.getElementById('cf-di_src');
  if (_rlModeEl) _rlModeEl.addEventListener('change', () => { updateRpmLimiterFields(); applyView(); });
  if (_diModeEl) _diModeEl.addEventListener('change', () => { updateIdleModeFields(); applyView(); });
  if (_diSourceEl) _diSourceEl.addEventListener('change', () => { refreshIdleInputSummary(); updateIdleSourceFields(); applyHwConditions(); applyView(); });
  document.getElementById('cf-fi_mode')?.addEventListener('change', setRunningIdleSource);
  document.getElementById('cf-fi_fixed')?.addEventListener('change', setRunningIdleSource);
  document.getElementById('cf-fi_input')?.addEventListener('change', setIdleInputChannel);
  ['fi_low','fi_high','th_mx','di_mx'].forEach(key=>document.getElementById('cf-'+key)?.addEventListener('change',refreshIdleInputSummary));
  ['pb_n1e','pb_n2e','pb_egte','pb_p1e','pb_p2e','pb_tqe'].forEach(key => {
    const el = document.getElementById('cf-' + key);
    if (el) el.addEventListener('change', () => { applyHwConditions(); applyView(); refreshProtectionSummaries(); runValidation(); });
  });
  ['sf_oil_modes','sf_fp_modes','sf_p1en','sf_p1t','sf_p1d','sf_p2en','sf_p2t','sf_p2d','sf_tqen','sf_tqt','sf_tqd'].forEach(key=>
    document.getElementById('cf-'+key)?.addEventListener('input',refreshProtectionSummaries));
  refreshProtectionSummaries();

  // Controller cards and their local settings are mounted beside cfg-form,
  // so both workspace surfaces own dirty tracking. Property handlers avoid
  // stacking duplicate listeners when a controller topology rerenders.
  [document.getElementById('cfg-form'), document.getElementById('controller-overview')]
    .filter(Boolean).forEach(surface => {
      surface.oninput = () => { _markDirty();refreshStartupGuardUi(); };
      surface.onchange = () => {
        _markDirty();
        // Dependency-controlled subcards must react immediately. In
        // particular, enabling windmilling oil protection reveals its output
        // selector without requiring a reload or view-filter change.
        _applyAllVisibility();
        runValidation();
      };
    });

  // Apply current view filter
  applyView();
  if (_cfgDirty) _refreshChangedBorders();
}
