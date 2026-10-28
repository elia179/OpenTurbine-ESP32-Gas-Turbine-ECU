// ------ App state ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
let hwCfg = {};    // hardware section of ecu_config.json
let cfg   = {};    // settings section of ecu_config.json
let loadedHwCfg = {};
let loadedCfg = {};
let _seqDirty = false;
let paramVals = {}; // shared block settings plus per-slot TimedDelay edits
let activeTab = 'startup';
let engineMode = 'STANDBY';
let lastIdleRaw = null;

const SEQUENCE_INPUT_PURPOSE = {
  n1_rpm:'n1_speed', n2_rpm:'n2_speed', tot:'tot', tit:'tit', oil_press:'oil_pressure',
  oil_temp:'oil_temperature', fuel_press:'fuel_pressure', fuel_flow:'fuel_flow',
  p1:'p1_pressure', p2:'p2_pressure', torque:'torque', batt_voltage:'battery_voltage',
  flame:'flame', ab_flame:'ab_flame', throttle_input:'throttle', idle_input:'idle'
};
const SEQUENCE_OUTPUT_PURPOSE = {
  throttle:'main_fuel', starter:'starter', starter_en:'starter_enable', oil_pump:'oil_pump',
  fuel_sol:'fuel_shutoff', igniter:'igniter', igniter2:'ab_igniter', glow_plug:'glow_plug',
  prop_pitch:'prop_pitch', cool_fan:'cooling_fan', oil_scavenge_pump:'scavenge_pump',
  bleed_valve:'valve', fuel_pump2:'fuel_pump', airstarter_sol:'air_starter',
  ab_sol:'ab_valve', ab_pump:'ab_pump', drain_valve:'drain_valve'
};
function sensorEnabled(key) {
  return !!registryInputPurpose(SEQUENCE_INPUT_PURPOSE[key]);
}
function actuatorEnabled(key) {
  const channel = registryOutputPurpose(SEQUENCE_OUTPUT_PURPOSE[key]);
  return key === 'bleed_valve' ? channel?.id === 'bleed_valve' : !!channel;
}
function actuatorIsRelay(key) {
  const registry = registryOutputPurpose(SEQUENCE_OUTPUT_PURPOSE[key]);
  return !!registry && [4,11].includes(Number(registry.driver));
}
function actuatorHasProportionalOutput(key) {
  const registry = registryOutputPurpose(SEQUENCE_OUTPUT_PURPOSE[key]);
  return !!registry && [5,6].includes(Number(registry.driver));
}
function registryLabel(c, fallback) {
  return String(c?.name || '').trim() || plainRegistryName(c?.id, fallback);
}
function hasIgnitionOutput(hw = hwCfg) {
  return !!(registryOutputPurpose('igniter') || registryOutputPurpose('ab_igniter') || registryOutputPurpose('glow_plug'));
}
function demandText(key, pct, label = 'on') {
  return actuatorIsRelay(key) ? label : `${pct}%`;
}

// ── Display-unit helpers (this page does not load app.js) ────
// Read-only mirror of app.js's unit preference: same localStorage key
// ('ot_units'), same conversions, so seq temp params follow the site-wide
// °C/°F preference. This page never CHANGES the preference.
// These were referenced but never defined — the resulting ReferenceError
// was swallowed by the boot try/catch and silently blanked the AB criteria
// and afterburner criteria rendering.
function tempUnit() {
  try { return (JSON.parse(localStorage.getItem('ot_units') || '{}').temp) || 'C'; }
  catch (e) { return 'C'; }
}
function toDispTemp(c)   { return tempUnit() === 'F' ? c * 9 / 5 + 32 : c; }
function fromDispTemp(v) { return tempUnit() === 'F' ? (v - 32) * 5 / 9 : v; }
function dispTempUnit()  { return tempUnit() === 'F' ? '°F' : '°C'; }

function seqRound(value) {
  return String(Math.round(Number(value) * 1000) / 1000);
}

function seqDisplayValue(p, value) {
  if (p.zeroOff && Number(value) === 0) return '0';
  if (p.unitType === 'temp') return seqRound(toDispTemp(Number(value ?? 0)));
  if (p.unitType === 'duration_ms_as_s') return seqRound(Number(value ?? 0) / 1000);
  return value;
}

function seqStoredValue(p, rawVal) {
  const parsed = p.type === 'float' ? parseFloat(rawVal) : parseInt(rawVal);
  if (!Number.isFinite(parsed)) return undefined;
  if (p.zeroOff && parsed === 0) return 0;
  if (p.unitType === 'duration_ms_as_s') return Math.round(parsed * 1000);
  return p.unitType === 'temp' ? fromDispTemp(parsed) : parsed;
}

function seqDisplayAttr(p, value) {
  if (value === undefined) return '';
  if (p.zeroOff && Number(value) === 0) return '0';
  if (p.unitType === 'duration_ms_as_s') return seqRound(Number(value) / 1000);
  return p.unitType === 'temp' ? seqRound(toDispTemp(Number(value))) : String(value);
}

function seqDisplayStep(p) {
  if (p.unitType === 'duration_ms_as_s') return seqRound(Number(p.step || 100) / 1000);
  if (p.unitType === 'temp') {
    return seqRound(tempUnit() === 'F' ? Number(p.step || 1) * 9 / 5 : Number(p.step || 1));
  }
  return String(p.step || 1);
}

function seqUnitLabel(p) {
  if (p.unitType === 'temp') return dispTempUnit();
  return p.unit || '';
}

function fmtSeqTemp(value, digits = 0) {
  return toDispTemp(Number(value ?? 0)).toFixed(digits) + ' ' + dispTempUnit();
}

const SEQ_ACTION_KEYS = {
  startup:     { enter:'startup_enter_actions',  exit:'startup_exit_actions' },
  shutdown:    { enter:'shutdown_enter_actions', exit:'shutdown_exit_actions' },
  afterburner: { enter:'ab_enter_actions',       exit:'ab_exit_actions' },
  'ab-shut':   { enter:'ab_shut_enter_actions',  exit:'ab_shut_exit_actions' },
};
const ACT_ENUM = {
  cool_fan:0, bleed_valve:1, fuel_pump2:2, oil_scavenge_pump:3,
  throttle:4, starter:5, starter_en:6, oil_pump:7,
  fuel_sol:8, igniter:9, igniter2:10, ab_sol:11, ab_pump:12,
  airstarter_sol:15, glow_plug:16, prop_pitch:17,
};
const ACT_KEY_BY_ENUM = Object.fromEntries(Object.entries(ACT_ENUM).map(([k,v]) => [v,k]));
function actionKey(tab, phase) {
  return SEQ_ACTION_KEYS[tab]?.[phase];
}
function ensureActionSlots(tab) {
  const seq = hwCfg[seqKey(tab)] || [];
  for (const phase of ['enter','exit']) {
    const key = actionKey(tab, phase);
    if (!key) continue;
    if (!Array.isArray(hwCfg[key])) hwCfg[key] = [];
    while (hwCfg[key].length < seq.length) hwCfg[key].push([]);
    if (hwCfg[key].length > seq.length) hwCfg[key].length = seq.length;
    for (let i = 0; i < seq.length; i++) {
      if (!Array.isArray(hwCfg[key][i])) hwCfg[key][i] = [];
      hwCfg[key][i] = hwCfg[key][i].filter(a => actionAllowed(a)).slice(0, 4);
    }
  }
}
function sideActionMeta(action) {
  const acts = getEnabledActuators();
  const target = String(action?.target || '');
  if (target) return acts.find(a => String(a.target || '') === target);
  const key = ACT_KEY_BY_ENUM[Number(action?.act)];
  return key ? acts.find(a => a.key === key) : undefined;
}
function actionAllowed(action) {
  if (!action || typeof action !== 'object') return false;
  const target = String(action.target || '').trim();
  if (target) return target.length <= 64;
  return Object.prototype.hasOwnProperty.call(ACT_KEY_BY_ENUM, Number(action.act));
}
function actionDisplayValue(action, value) {
  const meta = sideActionMeta(action);
  return meta?.mode === 'pct' ? Math.round((Number(value) || 0) * 100) : ((Number(value) || 0) >= 0.5 ? 1 : 0);
}
function actionStoredValue(action, raw) {
  const meta = sideActionMeta(action);
  return meta?.mode === 'pct' ? Math.max(0, Math.min(1, (Number(raw) || 0) / 100)) : (Number(raw) ? 1 : 0);
}

// ------ Tab switching ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function switchTab(tab) {
  activeTab = tab;
  hideBlockInfo();
  const tabs = ['startup','shutdown','afterburner','rules'];
  document.querySelectorAll('.seq-tab').forEach((btn) => {
    const t = btn.getAttribute('onclick')?.match(/switchTab\('(\w+)'\)/)?.[1];
    if (t) btn.classList.toggle('active', t === tab);
  });
  tabs.forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
}
function revealSequenceDeepLink() {
  const id = decodeURIComponent(String(location.hash || '').replace(/^#/, ''));
  if (!id) return;
  const fieldKey = {'oil-arm-min':['oil_arm_min_bar','oil_startup_min_bar'],
                    'starter-assist':['pulsed_assist_enabled','pulsed_assist_until_rpm'],
                    'starter-target':['pre_ign_rpm']}[id];
  if (fieldKey) {
    switchTab('startup');
    const field = fieldKey.map(key => document.querySelector(`#tab-startup .param-field[data-pkey="${key}"]`)).find(Boolean);
    if (field) {
      field.closest('.block-params')?.classList.add('open');
      field.classList.add('deep-link-target');
      requestAnimationFrame(() => field.scrollIntoView({behavior:'smooth', block:'center'}));
      return;
    }
    document.getElementById('tab-startup')?.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  const tab = id.startsWith('tab-') ? id.slice(4) : '';
  if (['startup','shutdown','afterburner'].includes(tab)) switchTab(tab);
  const target = document.getElementById(id);
  if (!target || target.style.display === 'none') return;
  document.querySelectorAll('.deep-link-target').forEach(el => el.classList.remove('deep-link-target'));
  target.classList.add('deep-link-target');
  requestAnimationFrame(() => target.scrollIntoView({behavior:'smooth', block:'start'}));
}
window.addEventListener('hashchange', revealSequenceDeepLink);

// ------ Load data from device ------------------------------------------------------------------------------------------------------------------------------------------------------
function syncControllerSequenceBlocks() {
  const api=window.OTControllerTiming;if(!api)return;
  api.ensureIds(cfg.rules||[]);
  for(const name of Object.keys(BLOCKS))if(api.parse(name))delete BLOCKS[name];
  for(const list of [STARTUP_BLOCKS,SHUTDOWN_BLOCKS,AFTERBURNER_BLOCKS,AB_SHUT_BLOCKS])
    for(let i=list.length-1;i>=0;i--)if(api.parse(list[i]))list.splice(i,1);
  const keys=new Set(api.required(cfg.rules).map(b=>b.key));
  for(const k of api.seqKeys)for(const name of hwCfg[k]||[])if(api.parse(name))keys.add(name);
  for(const name of keys){
    const ref=api.parse(name),rule=(cfg.rules||[]).find(r=>Number(r.controller_id)===ref.id);
    BLOCKS[name]={label:`${ref.on?'Activate':'Deactivate'} “${rule?.name||'Missing controller'}”`,type:'action',badgeClass:'action',params:[],
      desc:rule?`${ref.on?'Begin continuous control.':'Apply the output safe state and release control.'} ${api.summary(rule)}${rule.enabled===false?' Controller disabled: this block is inactive.':''}`:'Controller no longer exists. Remove this block.',
      visibleIf:()=>!!rule};

  }
}
let pendingControllerKey = '';
const pendingControllerSlots = new Map();
function pendingControllerBlocks() {
  const api=window.OTControllerTiming;
  return api ? api.required(cfg.rules).filter(b=>b.rule.enabled!==false&&!api.placed(hwCfg,b.key)) : [];
}
function renderPendingControllers() {
  let panel=document.getElementById('controller-pending-blocks');
  if(!panel){
    panel=document.createElement('section');panel.id='controller-pending-blocks';panel.className='card';
    document.querySelector('main .page-heading')?.after(panel);
  }
  const pending=pendingControllerBlocks();
  if(!pending.some(b=>b.key===pendingControllerKey))pendingControllerKey='';
  panel.hidden=!pending.length;
  panel.innerHTML=pending.length?`<h3>Controller blocks — drag into place</h3><p id="controller-placement-hint" aria-live="polite">Drag these blocks into the sequence below. Or select a block, then select “Place here” at the desired position. Choose another sequence tab to place it there.</p><p>START leaves controllers with missing blocks inactive for that run. All required blocks must be placed before saving. Remove a block to move it elsewhere, or disable its controller in <a href="/controllers.html">Controllers</a>.</p><div class="controller-pending-list">`+pending.map(b=>`<button type="button" class="block-card controller-pending-card" data-controller-key="${b.key}" aria-pressed="${pendingControllerKey===b.key}" aria-label="Place ${esc(BLOCKS[b.key]?.label||b.key)}"><span class="drag-grip" aria-hidden="true"></span><span><strong>${esc(BLOCKS[b.key]?.label||b.key)}</strong><small>Drag, or select to choose a position</small></span></button>`).join('')+'</div>':'';
  panel.querySelectorAll('[data-controller-key]').forEach(wirePendingControllerCard);
  renderControllerDropSlots();
}
function selectPendingController(name) {
  pendingControllerKey=pendingControllerKey===name?'':name;
  renderPendingControllers();
  document.querySelector(`[data-controller-key="${name}"]`)?.focus({preventScroll:true});
}
function renderControllerDropSlots() {
  document.querySelectorAll('[data-controller-drop]').forEach(el=>el.remove());
  if(!pendingControllerKey)return;
  const label=BLOCKS[pendingControllerKey]?.label||pendingControllerKey;
  for(const tab of ['startup','shutdown','afterburner','ab-shut']){
    const list=document.getElementById('list-'+tab);if(!list)continue;
    const cards=Array.from(list.children).filter(el=>el.classList.contains('block-card'));
    for(let index=0;index<=cards.length;index++){
      const gap=document.createElement('button');gap.type='button';gap.className='controller-drop-slot';
      gap.dataset.controllerDrop=String(index);gap.dataset.tab=tab;gap.textContent='Place here';
      gap.setAttribute('aria-label',`Place ${label} at position ${index+1}`);
      gap.addEventListener('click',()=>placeControllerBlock(pendingControllerKey,tab,index));
      list.insertBefore(gap,cards[index]||null);
    }
  }
}
function controllerDropAt(x,y) {
  const hit=document.elementFromPoint(x,y);
  const gap=hit?.closest('[data-controller-drop]');
  if(gap)return gap;
  const card=hit?.closest('.block-list > .block-card');
  if(!card)return null;
  const index=Number(card.dataset.idx)+(y>=card.getBoundingClientRect().top+card.offsetHeight/2?1:0);
  return card.parentElement.querySelector(`[data-controller-drop="${index}"]`);
}
function wirePendingControllerCard(card) {
  const name=card.dataset.controllerKey;
  let suppressClick=false;
  card.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}selectPendingController(name);});
  card.addEventListener('pointerdown',event=>{
    if(event.button!==undefined&&event.button!==0)return;
    event.preventDefault();card.focus({preventScroll:true});
    let moved=false,target=null,frame=0,x=event.clientX,y=event.clientY;
    const point=()=>{
      document.querySelectorAll('.controller-drop-target').forEach(el=>el.classList.remove('controller-drop-target'));
      const hit=document.elementFromPoint(x,y)?.closest('.seq-tab');
      const tab=hit?.getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/)?.[1];
      if(tab&&tab!==activeTab)switchTab(tab);
      target=controllerDropAt(x,y);target?.classList.add('controller-drop-target');
    };
    const scroll=()=>{
      if(y<65)window.scrollBy(0,-12);else if(y>innerHeight-65)window.scrollBy(0,12);
      point();frame=requestAnimationFrame(scroll);
    };
    const move=e=>{
      if(e.pointerId!==event.pointerId)return;
      x=e.clientX;y=e.clientY;
      if(!moved&&Math.hypot(x-event.clientX,y-event.clientY)<6)return;
      e.preventDefault();
      if(!moved){
        moved=true;pendingControllerKey=name;card.setAttribute('aria-pressed','true');
        card.classList.add('block-dragging');renderControllerDropSlots();frame=requestAnimationFrame(scroll);
      }
      point();
    };
    const finish=e=>{
      if(e.pointerId!==event.pointerId)return;
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);document.removeEventListener('keydown',cancel);
      cancelAnimationFrame(frame);card.classList.remove('block-dragging');
      if(moved){
        suppressClick=true;setTimeout(()=>{suppressClick=false;},300);
        if(e.type!=='pointercancel'){x=e.clientX;y=e.clientY;point();}
        const drop=e.type!=='pointercancel'?target:null;
        if(drop)placeControllerBlock(name,drop.dataset.tab,Number(drop.dataset.controllerDrop));
        else {pendingControllerKey='';renderPendingControllers();}
      }
    };
    const cancel=e=>{if(e.key==='Escape')finish({pointerId:event.pointerId,type:'pointercancel'});};
    document.addEventListener('keydown',cancel);
    document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
  });
}
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&pendingControllerKey){pendingControllerKey='';renderPendingControllers();}
});
function placeControllerBlock(name,tab,index=(hwCfg[seqKey(tab)]||[]).length){
  if(!['startup','shutdown','afterburner','ab-shut'].includes(tab)||!pendingControllerBlocks().some(b=>b.key===name))return;
  if((hwCfg[seqKey(tab)]||[]).length>=16){OTDialog.alert('This sequence is full. Remove an unneeded block first.');return;}
  const length=(hwCfg[seqKey(tab)]||[]).length;
  if(!Number.isInteger(index)||index<0||index>length)return;
  // Links in disabled AB paths cannot run. Bring them back to the pool and
  // preserve their complete slot when the user places them in a live sequence.
  if(hwCfg.has_afterburner===false)for(const key of ['ab_seq','ab_shut_seq']){
    const at=(hwCfg[key]||[]).indexOf(name);if(at<0)continue;
    const stem=key.slice(0,-4),saved={};hwCfg[key].splice(at,1);
    for(const suffix of ['delay_ms','ignition_target','device_target','wait_inputs','enter_actions','exit_actions']){
      const rows=hwCfg[stem+'_'+suffix];if(!Array.isArray(rows))continue;
      saved[suffix]=cloneSequenceJson(rows[at]);rows.splice(at,1);
    }
    pendingControllerSlots.set(name,saved);
  }
  pendingControllerKey='';addBlock(tab,name);
  const saved=pendingControllerSlots.get(name);
  if(saved){
    for(const [suffix,row] of Object.entries(saved))hwCfg[seqKey(tab).slice(0,-4)+'_'+suffix][length]=cloneSequenceJson(row);
    pendingControllerSlots.delete(name);renderFast(tab);
  }
  if(index<length)moveBlockTo(tab,length,index);
  renderPendingControllers();
  document.querySelector(`#list-${tab} [data-idx="${index}"] .drag-handle`)?.focus({preventScroll:true});
}
async function loadAll() {
  setSaveStatus('Loading...');
  try {
    hwCfg = await fetchJsonWithRetry('/api/hardware');
    cfg   = await fetchJsonWithRetry('/api/config');
    pendingControllerSlots.clear();
    loadedHwCfg = cloneSequenceJson(hwCfg);
    loadedCfg = cloneSequenceJson(cfg);
    // Rebuild runtime custom block defs from raw stored defs
    customBlocks = {};
    if (hwCfg.custom_blocks) {
      for (const [k, def] of Object.entries(hwCfg.custom_blocks)) {
        customBlocks[k] = buildRuntimeBlockDef(k, def);
      }
    }
    syncControllerSequenceBlocks();
    migrateLegacyDeviceTargets();
    buildParamVals();
    await refreshSequenceLiveData();
    render('startup', lastIdleRaw);
    render('shutdown', lastIdleRaw);
    render('afterburner', lastIdleRaw);
    render('ab-shut', lastIdleRaw);
    populateAddSelects();
    renderPendingControllers();
    buildAbCriteriaHtml();
    // Show/hide afterburner tab based on hardware feature flag
    const abTabBtn = document.getElementById('tab-btn-afterburner');
    if (abTabBtn) abTabBtn.style.display = sequenceHasAfterburner() ? '' : 'none';
    revealSequenceDeepLink();
    // Keep the post-normalization baseline. Saving can then preserve unrelated
    // settings changed by another browser while this page was open.
    clearSequenceDirty('No unsaved changes');
  } catch(e) {
    setSaveStatus('Warning: Load failed: ' + e.message);
  }
}

async function fetchJsonWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!r.ok) throw new Error(url + ' returned HTTP ' + r.status);
    const text = await r.text();
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithRetry(url, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJsonWithTimeout(url);
    } catch (e) {
      lastError = e;
      await new Promise(resolve => setTimeout(resolve, 200 + i * 300));
    }
  }
  throw lastError;
}

// Build paramVals from the settings section using each block's configKey mapping.
function buildParamVals() {
  // Walk each block and each param, read from cfg using section path
  const allBlocks = {...BLOCKS, ...customBlocks};
  for (const [bname, bdef] of Object.entries(allBlocks)) {
    for (const p of bdef.params) {
      const vk = bname + '.' + p.key;
      if (p.configKey) {
        // Read from cfg using configKey (which matches the JSON key in config sections)
        const v = findConfigVal(p.configKey);
        paramVals[vk] = (v !== undefined) ? v : p.def;
      } else {
        // No configKey - use default (preserve existing bool values across renders)
        if (paramVals[vk] === undefined) paramVals[vk] = p.def;
      }
    }
  }
}

function findConfigVal(key) {
  const map = CONFIG_SECTIONS[key];
  if (!map) return undefined;
  const parts = map.sec.split('.');
  let obj = cfg;
  for (const p of parts) obj = obj?.[p];
  return obj?.[map.key];
}

function setConfigVal(key, val) {
  const map = CONFIG_SECTIONS[key];
  if (!map) return;
  const parts = map.sec.split('.');
  let obj = cfg;
  for (let i=0; i<parts.length; i++) {
    if (obj[parts[i]] === undefined) obj[parts[i]] = {};
    if (i < parts.length-1) obj = obj[parts[i]];
    else obj[parts[i]][map.key] = val;
  }
  // Several cards intentionally expose the same engine setting. Keep their
  // visible controls in agreement without rebuilding cards or losing focus.
  for (const [bname, block] of Object.entries({...BLOCKS, ...customBlocks})) {
    for (const param of block.params || []) {
      if (param.configKey !== key) continue;
      paramVals[bname + '.' + param.key] = val;
      document.querySelectorAll(`.param-field[data-bname="${bname}"][data-pkey="${param.key}"]`).forEach(field => {
        const control = field.querySelector('input, select');
        if (!control || control === document.activeElement) return;
        if (param.type === 'bool') {
          control.checked = !!val;
          const label = field.querySelector('label');
          if (label) label.textContent = val ? 'Yes' : 'No';
        } else {
          control.value = String(param.type === 'select' ? val : seqDisplayValue(param, val));
        }
      });
    }
  }
  for (const card of document.querySelectorAll('.block-card')) {
    if (card.dataset.block === 'TimedDelay') continue; // duration is per card
    const def = BLOCKS[card.dataset.block] || customBlocks[card.dataset.block];
    const condition = card.querySelector('.block-cond');
    if (condition && def?.condition) condition.textContent = def.condition(flattenHw());
  }
}

// ------ Render a sequence tab ------------------------------------------------------------------------------------------------------------------------------------------------------
function seqKey(tab) {
  if (tab === 'startup')   return 'startup_seq';
  if (tab === 'shutdown')  return 'shutdown_seq';
  if (tab === 'ab-shut')   return 'ab_shut_seq';
  return 'ab_seq';  // 'afterburner'
}
function delaySeqKey(tab) {
  if (tab === 'startup') return 'startup_delay_ms';
  if (tab === 'shutdown') return 'shutdown_delay_ms';
  if (tab === 'ab-shut') return 'ab_shut_delay_ms';
  return 'ab_delay_ms';
}
function ignitionTargetSeqKey(tab) {
  if (tab === 'startup') return 'startup_ignition_target';
  if (tab === 'shutdown') return 'shutdown_ignition_target';
  if (tab === 'ab-shut') return 'ab_shut_ignition_target';
  return 'ab_ignition_target';
}
function deviceTargetSeqKey(tab) {
  if (tab === 'startup') return 'startup_device_target';
  if (tab === 'shutdown') return 'shutdown_device_target';
  if (tab === 'ab-shut') return 'ab_shut_device_target';
  return 'ab_device_target';
}
function waitInputSeqKey(tab) {
  if (tab === 'startup') return 'startup_wait_inputs';
  if (tab === 'shutdown') return 'shutdown_wait_inputs';
  if (tab === 'ab-shut') return 'ab_shut_wait_inputs';
  return 'ab_wait_inputs';
}
function ensureWaitInputSlots(tab) {
  const seq = hwCfg[seqKey(tab)] || [];
  const key = waitInputSeqKey(tab);
  if (!Array.isArray(hwCfg[key])) hwCfg[key] = [];
  for (let i = 0; i < seq.length; i++) {
    if (hwCfg[key][i] && typeof hwCfg[key][i] === 'object') continue;
    hwCfg[key][i] = {
      channel: Number(cfg?.sequence?.startup?.wait_for_input_ch ?? 0),
      active: seq[i] === 'WaitForInputOff' ? false : cfg?.sequence?.startup?.wait_for_input_state !== false,
      timeout_ms: Math.max(500, Number(cfg?.sequence?.startup?.wait_for_input_timeout ?? 30000)),
    };
  }
  hwCfg[key].length = seq.length;
}
function ensureDelaySlots(tab) {
  const seq = hwCfg[seqKey(tab)] || [];
  const key = delaySeqKey(tab);
  if (!Array.isArray(hwCfg[key])) hwCfg[key] = [];
  while (hwCfg[key].length < seq.length) hwCfg[key].push(0);
  if (hwCfg[key].length > seq.length) hwCfg[key].length = seq.length;
}
function ensureIgnitionTargetSlots(tab) {
  const seq = hwCfg[seqKey(tab)] || [];
  const key = ignitionTargetSeqKey(tab);
  if (!Array.isArray(hwCfg[key])) hwCfg[key] = [];
  while (hwCfg[key].length < seq.length) hwCfg[key].push(0);
  if (hwCfg[key].length > seq.length) hwCfg[key].length = seq.length;
}
function ensureDeviceTargetSlots(tab) {
  const seq = hwCfg[seqKey(tab)] || [];
  const key = deviceTargetSeqKey(tab);
  if (!Array.isArray(hwCfg[key])) hwCfg[key] = [];
  while (hwCfg[key].length < seq.length) hwCfg[key].push('');
  if (hwCfg[key].length > seq.length) hwCfg[key].length = seq.length;
}
function timedDelayValue(tab, idx) {
  ensureDelaySlots(tab);
  return hwCfg[delaySeqKey(tab)][idx] || cfg?.sequence?.startup?.timed_delay_ms || 1000;
}

function _openBlockKeys(tab) {
  const list = document.getElementById('list-' + tab);
  if (!list) return new Set();
  return new Set(Array.from(list.querySelectorAll('.block-card'))
    .filter(card => card.querySelector('.block-params.open'))
    .map(card => `${card.dataset.block}:${card.dataset.idx}`));
}

function render(tab, idleRaw, openKeys = new Set()) {
  const key = seqKey(tab);
  const seq  = hwCfg[key] || [];
  ensureDelaySlots(tab);
  ensureIgnitionTargetSlots(tab);
  ensureDeviceTargetSlots(tab);
  ensureWaitInputSlots(tab);
  ensureActionSlots(tab);
  const list = document.getElementById('list-' + tab);
  list.innerHTML = '';
  seq.forEach((bname, idx) => {
    const card = buildCard(bname, idx, tab);
    if (openKeys.has(`${bname}:${idx}`)) card.querySelector('.block-params')?.classList.add('open');
    list.appendChild(card);
  });
  const ownership=window.OTControllerTiming?.plan(cfg.rules,hwCfg,tab)||[];
  for(const issue of ownership){
    if(issue.index<0)continue;
    const card=list.children[issue.index];if(!card)continue;
    card.classList.add('controller-blocked');card.style.opacity='.55';
    const note=document.createElement('p');note.className='controller-ownership-note';note.setAttribute('role','status');note.textContent=issue.message;card.append(note);
    for(const control of card.querySelectorAll('.block-params input,.block-params select,.block-params button'))control.disabled=true;
  }
  renderPendingControllers();
  // Append final state summary card - pass live idle raw if available
  const stateCard = buildFinalStateCard(tab, seq, idleRaw);
  if (stateCard) list.appendChild(stateCard);
}

function renderWithLiveIdle(tab) {
  refreshSequenceLiveData().finally(() => render(tab, lastIdleRaw));
}

function renderAllTabsWithLiveIdle() {
  refreshSequenceLiveData().finally(() => {
    render('startup', lastIdleRaw);
    render('shutdown', lastIdleRaw);
    render('afterburner', lastIdleRaw);
    render('ab-shut', lastIdleRaw);
  });
}

async function refreshSequenceLiveData() {
  try {
    const r = await fetch('/api/data', { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    lastIdleRaw = d.idle_input_raw ?? lastIdleRaw;
    if (d.mode !== undefined) updateEngineMode(d.mode);
    if (d.seq_issues !== undefined) _applySeqValidation(d);
  } catch (_) {}
}

function renderFast(tab) {
  const openKeys = _openBlockKeys(tab);
  render(tab, lastIdleRaw, openKeys);
  markSequenceDirty('Sequence edited — save to apply');
}

// ------ Final state summary card ---------------------------------------------------------------------------------------------------------------------------------------------
function buildFinalStateCard(tab, seq, idleRaw) {
  if(!Array.isArray(seq))return null;
  const acts=getEnabledActuators(),commands=new Map(),ignition=new Set();
  const byKey=key=>acts.find(a=>a.key===key);
  const output=target=>acts.find(a=>a.target===target);
  const primary=purpose=>output(registryOutputPurpose(purpose)?.id);
  const valueText=(meta,value)=>{
    if(typeof value==='string')return value;
    if(meta.mode==='pct')return `${Math.round(value*100)}%`;
    return (['fuel_sol','airstarter_sol','ab_sol','bleed_valve','drain_valve'].includes(meta.key)||['fuel_shutoff','air_starter','ab_valve','bleed_valve','drain_valve'].includes(meta.purpose))
      ? value>=.5?'open':'closed' : value>=.5?'on':'off';
  };
  const write=(meta,value)=>{
    if(!meta)return;
    commands.set(meta.target,{label:meta.label,val:valueText(meta,value),meta});
    if(meta.ignition){if(Number(value)>0)ignition.add(meta.target);else if(Number(value)===0)ignition.delete(meta.target);}
  };
  const set=(key,value)=>write(byKey(key),value);
  for(const action of resolveSequenceActions(tab,seq).flat()){
    write(action.meta,action.value);
    if(action.controller)commands.get(action.meta.target).controller=action.controller;
  }
  const endOwners=window.OTControllerTiming?.ownersAtEnd(cfg.rules,hwCfg,tab)||new Map();
  for(const row of commands.values())if(row.controller&&!endOwners.has(row.meta.target)){
    const channel=(hwCfg.channel_registry?.outputs||[]).find(c=>c.id===row.meta.target);
    row.val=valueText(row.meta,Number(channel?.safe_demand??0))+' (controller released)';
  }
  const fuel=byKey('throttle');
  if(tab==='shutdown'){
    // STANDBY forces all outputs safe, but list only the ones this sequence
    // actually commanded. Main fuel remains the one explicit exception.
    for(const row of commands.values()){
      const channel=(hwCfg.channel_registry?.outputs||[]).find(c=>c.id===row.meta.target);
      row.val=valueText(row.meta,row.meta.key==='prop_pitch'?Number(channel?.safe_demand??0):0);
    }
    if(fuel)write(fuel,0);
  }else if(fuel){
    const last=commands.get(fuel.target);
    const scheduled=endOwners.get(fuel.target);
    const legacy=(cfg.rules||[]).filter(r=>r.enabled!==false&&!window.OTControllerTiming?.scheduled(r)&&
      (Number(r.mode_mask??4)&4)&&((r.target&&[fuel.target,fuel.key,'main_fuel'].includes(String(r.target)))||(!r.target&&Number(r.actuator)===Number(fuel.actuator))));
    const owners=[...(scheduled?[scheduled]:[]),...legacy];
    let source=owners.length===1?`Controlled by “${owners[0].name}”`:owners.length>1?'Controller conflict — check Controllers':'';
    if(!source&&hwCfg.controllers?.dynamic_idle)source='Automatic Idle — Controllers';
    if(!source&&hwCfg.controllers?.governor&&!cfg.governor?.use_prop_pitch)source='N2 governor — Controllers';
    if(!source&&Number(cfg.controller_schema??0)===0&&(hwCfg.sensors?.throttle_input?.enabled||registryInputPurpose('throttle')))source='Operator throttle input — Controllers';
    if(source)commands.set(fuel.target,{label:fuel.label,val:last&&!last.controller?`Sequence command: ${last.val}; ${source}`:source,href:'/controllers.html',meta:fuel});
    else if(!last||last.controller)commands.set(fuel.target,{label:fuel.label,val:last?`${last.val}; no active controller — check Controllers`:'No active main-fuel controller — check Controllers',href:'/controllers.html',meta:fuel});
  }
  for(const row of commands.values()){
    if(tab!=='shutdown'&&row.meta.key==='throttle')continue;
    const owner=endOwners.get(row.meta.target);
    const mode=tab==='shutdown'?1:4;
    const legacy=(cfg.rules||[]).filter(r=>r.enabled!==false&&!window.OTControllerTiming?.scheduled(r)&&
      (Number(r.mode_mask??4)&mode)&&((r.target&&[row.meta.target,row.meta.key].includes(String(r.target)))||(!r.target&&Number(r.actuator)===Number(row.meta.actuator))));
    const owners=[...(owner?[owner]:[]),...legacy];
    if(owners.length){row.val=owners.length===1?`Controlled by “${owners[0].name}”`:'Controller conflict — check Controllers';row.href='/controllers.html';}
  }
  if(!commands.size)return null;
  const title={startup:'Startup complete (RUNNING)',shutdown:'Shutdown complete (STANDBY)',afterburner:'Light Up complete (AB Running)','ab-shut':'Light Off complete (AB Off)'}[tab];
  const rows=[...commands.values()].map(row=>`<div class="fs-row"><span class="fs-label">${esc(row.label)}</span><span class="fs-val">${row.href?`<a href="${row.href}">${esc(row.val)}</a>`:esc(row.val)}</span></div>`).join('');
  const card=document.createElement('div');card.className='final-state-card';card.id='final-state-'+tab;
  card.innerHTML=`<div class="fs-header">Final state after ${title}</div>${tab==='shutdown'?'<div class="hw-desc" style="padding:.55rem 1rem 0">Entering STANDBY applies the safe/off boundary; any configured Standby controllers then take over. Only sequence-commanded outputs and main fuel are listed.</div>':''}<div class="fs-grid">${rows}</div>`;
  return card;
}

// ------ AB entry/exit criteria info panels ------------------------------------------------------------------------------------------------------------
function buildAbCriteriaHtml() {
  const ab  = cfg?.afterburner ?? {};
  const src = hwCfg.ab_trigger?.source ?? hwCfg.abTriggerSource ?? 0; // 0=manual,1=throttle,2=switch,3=analog input
  const thresholdRaw = hwCfg.ab_trigger?.input_threshold ?? 0;
  const thresholdPct = Math.round(Math.max(0, Math.min(4095, thresholdRaw)) * 100 / 4095);
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = value;
  };
  setValue('ab-edit-throttle-pct', Math.round((ab.throttle_threshold ?? 0) * 100));
  setValue('ab-edit-input-pct', thresholdPct);
  setValue('ab-edit-min-n1', ab.min_n1 ?? 0);
  setValue('ab-edit-max-n1', ab.max_n1 ?? 0);
  const abMaxTot = Number(ab.max_tot_for_light ?? 0);
  setValue('ab-edit-max-tot', abMaxTot === 0 ? '0' : seqRound(toDispTemp(abMaxTot)));
  const maxTotInput = document.getElementById('ab-edit-max-tot');
  if (maxTotInput) {
    maxTotInput.min = '0';
    maxTotInput.max = seqRound(toDispTemp(1000));
    maxTotInput.step = seqRound(tempUnit() === 'F' ? 18 : 10);
  }
  // Keep the unit label in step with the value, which is shown in the user's
  // selected temperature unit (this page has no [data-unit] auto-updater).
  const totUnitEl = document.getElementById('ab-edit-tot-unit');
  if (totUnitEl) totUnitEl.textContent = dispTempUnit();
  const throttleWrap = document.getElementById('ab-edit-throttle-wrap');
  const inputWrap = document.getElementById('ab-edit-input-wrap');
  const totWrap = document.getElementById('ab-edit-tot-wrap');
  if (throttleWrap) throttleWrap.style.display = src === 1 ? '' : 'none';
  if (inputWrap) inputWrap.style.display = src === 3 ? '' : 'none';
  if (totWrap) totWrap.style.opacity = (sensorEnabled('tot') || sensorEnabled('tit')) ? '1' : '.45';
  const sourceNote = document.getElementById('ab-entry-source-note');
  if (sourceNote) {
    sourceNote.textContent = src === 0 ? 'Manual trigger selected in Hardware. Entry gate limits below still apply when AB Check Ready is present.'
      : src === 1 ? 'Throttle is the trigger source. Change the firing percentage here; source selection stays in Hardware.'
      : src === 2 ? 'Dedicated switch is the trigger source. The switch itself has no numeric threshold.'
      : 'Dedicated AB input is the trigger source. Change its firing point here; signal type and GPIO stay in Hardware.';
  }
  const gateActive = !(hwCfg.ab_seq || []).length || (hwCfg.ab_seq || []).includes('ABCheckReady');
  const gateNote = document.getElementById('ab-entry-gate-note');
  if (gateNote) gateNote.textContent = gateActive
    ? 'N1 and EGT limits are checked by AB Check Ready in the light-up sequence.'
    : 'AB Check Ready is not present in this custom light-up sequence, so the N1 and EGT gate values are not evaluated.';

  // Light-up entry conditions
  const upLines = [];
  if (src === 0)       upLines.push('<strong>Trigger:</strong> Manual only (from dashboard FIRE button)');
  else if (src === 1)  upLines.push(`<strong>Trigger:</strong> Throttle >= ${((ab.throttle_threshold??0)*100).toFixed(0)}%`);
  else if (src === 2)  upLines.push('<strong>Trigger:</strong> Dedicated AB switch');
  else if (src === 3)  upLines.push(`<strong>Trigger:</strong> Analog / RC input >= ${thresholdPct}%`);
  if (src !== 0 && hwCfg.ab_trigger?.requires_arm) upLines.push('<strong>Arm:</strong> Arm switch must be active');
  if ((ab.min_n1 ?? 0) > 0)              upLines.push(`<strong>Min N1:</strong> ${ab.min_n1} rpm`);
  if ((ab.max_n1 ?? 0) > 0)              upLines.push(`<strong>Max N1:</strong> ${ab.max_n1} rpm`);
  if ((ab.max_tot_for_light ?? 0) > 0)   upLines.push(`<strong>Max EGT to light:</strong> ${fmtSeqTemp(ab.max_tot_for_light)}`);

  const upBox = document.getElementById('ab-lightup-criteria');
  if (upBox) {
    if (upLines.length) {
      upBox.innerHTML = '<span style="font-size:.7rem;font-weight:600;color:var(--text);text-transform:uppercase;letter-spacing:.06em">Light-up entry conditions</span> &nbsp;-&nbsp; ' + upLines.join(' &nbsp;*&nbsp; ');
      upBox.style.display = '';
    } else {
      upBox.style.display = 'none';
    }
  }

  // Light-off exit conditions
  const offLines = [];
  if (src === 0)       offLines.push('<strong>Shutdown:</strong> Manual only (from dashboard AB STOP button)');
  else if (src === 1)  offLines.push(`<strong>Shutdown when:</strong> Throttle drops below ${((ab.throttle_threshold??0)*100).toFixed(0)}%`);
  else if (src === 2)  offLines.push('<strong>Shutdown when:</strong> AB switch released');
  else if (src === 3)  offLines.push(`<strong>Shutdown when:</strong> Analog / RC input drops below ${thresholdPct}%`);

  const offBox = document.getElementById('ab-shutoff-criteria');
  if (offBox) {
    if (offLines.length) {
      offBox.innerHTML = '<span style="font-size:.7rem;font-weight:600;color:var(--text);text-transform:uppercase;letter-spacing:.06em">Light-off trigger</span> &nbsp;-&nbsp; ' + offLines.join(' &nbsp;*&nbsp; ');
      offBox.style.display = '';
    } else {
      offBox.style.display = 'none';
    }
  }
}

function setAbEntryNumber(key, rawVal) {
  if (!cfg.afterburner) cfg.afterburner = {};
  const val = Number(rawVal);
  if (!Number.isFinite(val)) return;
  cfg.afterburner[key] = Math.max(0, val);
  buildParamVals();
  buildAbCriteriaHtml();
  renderWithLiveIdle('afterburner');
  markSequenceDirty('Afterburner entry conditions edited — save to apply');
}

function setAbEntryTemp(key, rawVal) {
  if (!cfg.afterburner) cfg.afterburner = {};
  const val = Number(rawVal);
  if (!Number.isFinite(val)) return;
  cfg.afterburner[key] = val === 0 ? 0 : Math.max(0, fromDispTemp(val));
  buildParamVals();
  buildAbCriteriaHtml();
  renderWithLiveIdle('afterburner');
  markSequenceDirty('Afterburner entry conditions edited — save to apply');
}

function setAbEntryPercent(key, rawVal) {
  if (!cfg.afterburner) cfg.afterburner = {};
  const pct = Math.max(0, Math.min(100, Number(rawVal) || 0));
  cfg.afterburner[key] = pct / 100;
  buildParamVals();
  buildAbCriteriaHtml();
  markSequenceDirty('Afterburner entry conditions edited — save to apply');
}

function cloneSequenceJson(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function sequencePlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Apply only differences made on this page to a freshly fetched document.
// Arrays are intentional units here (sequence order, actions and rules).
function mergeSequenceEdits(baseline, edited, fresh) {
  const base = sequencePlainObject(baseline) ? baseline : {};
  const edit = sequencePlainObject(edited) ? edited : {};
  const out = sequencePlainObject(fresh) ? cloneSequenceJson(fresh) : {};
  const keys = new Set([...Object.keys(base), ...Object.keys(edit)]);
  for (const key of keys) {
    const hasEdit = Object.prototype.hasOwnProperty.call(edit, key);
    const before = base[key];
    const after = edit[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    if (!hasEdit) {
      delete out[key];
    } else if (sequencePlainObject(before) && sequencePlainObject(after)) {
      out[key] = mergeSequenceEdits(before, after, out[key]);
    } else {
      out[key] = cloneSequenceJson(after);
    }
  }
  return out;
}
function setAbInputEntryPercent(rawVal) {
  if (!hwCfg.ab_trigger) hwCfg.ab_trigger = {};
  const pct = Math.max(0, Math.min(100, Number(rawVal) || 0));
  hwCfg.ab_trigger.input_threshold = Math.round(pct * 4095 / 100);
  buildAbCriteriaHtml();
  markSequenceDirty('Afterburner entry conditions edited — save to apply');
}
