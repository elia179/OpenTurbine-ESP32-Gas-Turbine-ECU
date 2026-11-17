// Sequence persistence only. Custom running controllers belong to Controllers.
function validateSequenceHardwareForSave() {
  const errors = [];
  if (hwCfg.startup_seq?.includes('SafetyHold')) {
    for (const [sensor, ...fields] of finalCheckParameterGroups()) {
      if (!paramVals['SafetyHold.' + sensor.key]) continue;
      const [lower, upper] = fields.filter(p => p.optional);
      if (!lower) continue;
      const sharedOil = sensor === finalCheckSensors.oil && paramVals['SafetyHold.final_check_oil_use_shared_min'];
      const min = sharedOil ? Number(cfg.oil?.running_min ?? 2.8) : paramVals['SafetyHold.' + lower.key];
      const max = paramVals['SafetyHold.' + upper.key];
      if (min != null && max != null && min > max) {
        errors.push(`Final Startup Checks · ${sequenceParamLabel(sensor)}: the maximum must be at least the minimum.`);
      }
    }
  }
  const tabs = [['Startup','startup'],['Shutdown','shutdown'],['Afterburner','afterburner'],['Afterburner shutdown','ab-shut']];
  tabs.forEach(([label, tab]) => (hwCfg[seqKey(tab)] || []).forEach((name, index) => {
    const def = BLOCKS[name] || customBlocks[name];
    if (!def) errors.push(`${label} block ${index + 1} (${name}) is unknown to this firmware.`);
    else if (!BLOCK_OUTPUT_PURPOSES[name] && def.visibleIf && !def.visibleIf(hwCfg))
      errors.push(`${label} block ${index + 1} (${def.label || name}) cannot run with the fitted hardware.`);
    if (BLOCK_OUTPUT_PURPOSES[name]) {
      ensureDeviceTargetSlots(tab);
      const target = String(hwCfg[deviceTargetSeqKey(tab)]?.[index] || '');
      const choices = compatibleBlockOutputs(name);
      if (!target)
        errors.push(`${label} block ${index + 1} (${def?.label || name}) needs an output device.`);
      else if (!choices.some(output => String(output.id || '') === target))
        errors.push(`${label} block ${index + 1} (${def?.label || name}) references missing output "${target}".`);
    }
    if (name === 'SetOutput') {
      const action = setOutputAction(tab, index);
      const target = String(action?.target || ACT_KEY_BY_ENUM[Number(action?.act)] || '');
      if (!action)
        errors.push(`${label} block ${index + 1} (Set Output) needs an output device.`);
      else if (!sideActionMeta(action))
        errors.push(`${label} block ${index + 1} (Set Output) references missing output "${target || 'unknown'}".`);
    }
    if (name === 'WaitForInput' || name === 'WaitForInputOff') {
      ensureWaitInputSlots(tab);
      const wait = hwCfg[waitInputSeqKey(tab)][index];
      if (Number(wait.channel) < 0 || Number(wait.channel) > 3 ||
          Number(hwCfg.di_channels?.[Number(wait.channel)]?.pin ?? -1) < 0)
        errors.push(`${label} block ${index + 1} needs a fitted digital input channel.`);
      if (!Number.isFinite(Number(wait.timeout_ms)) || Number(wait.timeout_ms) < 500 || Number(wait.timeout_ms) > 60000)
        errors.push(`${label} block ${index + 1} needs a 500–60000 ms maximum wait.`);
    }
  }));
  if(window.OTControllerTiming){
    const placedControllers=new Set();
    for(const [,tab] of tabs)for(const name of hwCfg[seqKey(tab)]||[])if(OTControllerTiming.parse(name)){
      if(placedControllers.has(name))errors.push(`${BLOCKS[name]?.label||name}: controller block is placed more than once. Remove the extra block.`);
      placedControllers.add(name);
    }
    for(const block of OTControllerTiming.required(cfg.rules))
      if(block.rule.enabled!==false&&!OTControllerTiming.placed(hwCfg,block.key))errors.push(`${block.rule.name}: place required ${block.on?'Activate':'Deactivate'} block, or disable the controller.`);
    for(const [,tab] of tabs)for(const issue of OTControllerTiming.plan(cfg.rules,hwCfg,tab))errors.push(`${tab}: ${issue.message}`);
  }
  return errors;
}

function validateCustomBlockLimits() {
  const bytes=value=>new TextEncoder().encode(String(value||'')).length;
  const entries = Object.entries(hwCfg.custom_blocks || {});
  const errors = [];
  const sensors = getEnabledSensors();
  const acts = getEnabledActuators();
  if (entries.length > MAX_CUSTOM_BLOCKS)
    errors.push(`Custom blocks: ${entries.length}/${MAX_CUSTOM_BLOCKS}. Remove ${entries.length - MAX_CUSTOM_BLOCKS} block(s).`);
  entries.forEach(([key, def]) => {
    const label = def?.label || key;
    const steps = Array.isArray(def?.steps) ? def.steps : [];
    if (bytes(key) > MAX_CUSTOM_KEY_LEN) errors.push(`${key}: key exceeds ${MAX_CUSTOM_KEY_LEN} UTF-8 bytes.`);
    if (bytes(def?.label) > MAX_CUSTOM_LABEL_LEN) errors.push(`${label}: shorten the name to ${MAX_CUSTOM_LABEL_LEN} UTF-8 bytes. Accented characters and symbols can use more than one byte.`);
    if (bytes(def?.desc) > MAX_CUSTOM_DESC_LEN) errors.push(`${label}: shorten the description to ${MAX_CUSTOM_DESC_LEN} UTF-8 bytes. Accented characters and symbols can use more than one byte.`);
    if (steps.length > MAX_CUSTOM_STEPS) errors.push(`${label}: ${steps.length}/${MAX_CUSTOM_STEPS} steps.`);
    if (def?.type === 'action' && !steps.length) errors.push(`${label}: action block has no steps.`);
    if (def?.type === 'while' && !sensors.some(sensor =>
      def?.condition?.source ? sensor.source === def.condition.source : sensor.key === def?.condition?.sensor))
      errors.push(`${label}: condition sensor is not configured.`);
    steps.forEach((step, index) => {
      if (step?.type === 'set_act' && !acts.some(act =>
        act.key === step.act && (!step.target || act.target === step.target)))
        errors.push(`${label}: step ${index + 1} actuator is not configured.`);
    });
    if (!['action','wait','while'].includes(def?.type)) errors.push(`${label}: unknown custom block type.`);
  });
  return errors;
}

let _seqSavePending=false;
async function saveAll() {
  if(!_seqDirty||_seqSavePending||_seqLoading)return;
  const editingSurface=document.querySelector('main'),wasInert=editingSurface?.inert;
  _seqSavePending=true;updateSequenceSaveControls();
  try{await _saveSequenceChanges();}
  catch(error){setSaveStatus('Warning: '+error.message);}
  finally{if(editingSurface)editingSurface.inert=wasInert;_seqSavePending=false;updateSequenceSaveControls();}
}
async function _saveSequenceChanges() {
  if (!_seqDirty) return;
  await refreshEngineStatus();
  if (engineMode !== 'STANDBY' && engineMode !== 'FAULT') {
    setSaveStatus('Warning: Engine must be in STANDBY or FAULT to save');
    return;
  }
  ['startup','shutdown','afterburner','ab-shut'].forEach(ensureActionSlots);
  const customErrors = validateCustomBlockLimits();
  if (customErrors.length) {
    setSaveStatus('Warning: Custom block setup needs attention');
    await OTDialog.alert('Custom block setup needs attention:\n\n' + customErrors.map(e => '- ' + e).join('\n'), {title:'Custom blocks need attention'});
    return;
  }
  const hardwareErrors = validateSequenceHardwareForSave();
  if (hardwareErrors.length) {
    setSaveStatus('Warning: Sequence setup needs attention');
    await OTDialog.alert('Sequence setup needs attention:\n\n' + hardwareErrors.map(e => '- ' + e).join('\n') + '\n\nPlace required controller blocks, restore missing hardware, or remove unavailable blocks before saving.', {title:'Sequence needs attention'});
    return;
  }
  const startup = hwCfg.startup_seq || [];
  if (!startup.length) {
    setSaveStatus('Warning: Startup sequence is empty');
    await OTDialog.alert('Add the startup actions and waits your turbine needs before saving.', {title:'Startup sequence is empty'});
    return;
  }
  const warnings = _validateSequence(startup);
  if (warnings.length && !await OTDialog.confirm('Sequence warnings:\n\n' + warnings.map(w => '- ' + w).join('\n') + '\n\nSave anyway?', {title:'Sequence safety warnings', confirmText:'Save anyway', danger:true})) return;
  setSaveStatus('Saving engine file...');
  const editingSurface=document.querySelector('main');if(editingSurface)editingSurface.inert=true;
  try {
    if (typeof stopSequenceTelemetry === 'function') stopSequenceTelemetry();
    if (typeof window.OTWaitForPageTelemetryIdle === 'function') {
      const idle = await window.OTWaitForPageTelemetryIdle(2500);
      if (!idle) throw new Error('Live sequence status did not become idle; save was not started');
    }
    await new Promise(resolve => setTimeout(resolve, 150));
    const settingsPatch = sequenceSettingsPatch(loadedCfg, cfg);
    const hardwareKeys = [
      'startup_seq','shutdown_seq','ab_seq','ab_shut_seq',
      'startup_delay_ms','shutdown_delay_ms','ab_delay_ms','ab_shut_delay_ms',
      'startup_ignition_target','shutdown_ignition_target','ab_ignition_target','ab_shut_ignition_target',
      'startup_device_target','shutdown_device_target','ab_device_target','ab_shut_device_target',
      'startup_wait_inputs','shutdown_wait_inputs','ab_wait_inputs','ab_shut_wait_inputs',
      'startup_enter_actions','startup_exit_actions','shutdown_enter_actions','shutdown_exit_actions',
      'ab_enter_actions','ab_exit_actions','ab_shut_enter_actions','ab_shut_exit_actions',
      'custom_blocks','ab_trigger'
    ];
    const hardwarePatch = {};
    hardwareKeys.forEach(key => {
      if (JSON.stringify(loadedHwCfg[key]) !== JSON.stringify(hwCfg[key]) && hwCfg[key] !== undefined)
        hardwarePatch[key] = cloneSequenceJson(hwCfg[key]);
    });
    let result;
    if (Object.keys(hardwarePatch).length) {
      result = await window.OTSaveHardwarePatch(hardwarePatch, 'sequence', settingsPatch, window.OTConfigEditor.requireEcu());
    } else if (Object.keys(settingsPatch).length) {
      result = await window.OTSavePatch('/api/config', settingsPatch, false, window.OTConfigEditor.requireEcu());
    }
    const rebooting = result?.data.reboot === true;
    if (result?.data.applying === true && !rebooting) {
      setSaveStatus('Saved — applying…');
      await confirmSequenceSettingsApplied(settingsPatch);
    }
    if (result) window.OTSetup?.mark('sequence', result.response);
    clearSequenceDirty(rebooting ? 'Saved — rebooting…' : 'Saved');
    if (rebooting) startRebootCountdown();
    else {
      loadedCfg = cloneSequenceJson(cfg);
      startSequenceTelemetryForPlatform();
    }
  } catch (error) {
    setSaveStatus('Warning: ' + error.message);
    if(typeof startSequenceTelemetryForPlatform==='function')startSequenceTelemetryForPlatform();
  }
}

async function confirmSequenceSettingsApplied(patch) {
  const deadline = Date.now() + 8000;
  const read = async path => {
    const response = await fetch(path, {cache:'no-store', signal:AbortSignal.timeout(1500)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  const matches = (settings, changes) => Object.entries(changes).every(([key, value]) => {
    const current = settings?.[key];
    if (value !== null && typeof value === 'object') return matches(current, value);
    if (typeof value === 'number' && typeof current === 'number')
      return Math.abs(current - value) <= Math.max(1e-6, Math.abs(value) * 1e-6);
    return current === value;
  });
  while (Date.now() < deadline) {
    try {
      const status = await read('/api/status');
      if (status.config_apply_busy === false && matches(await read('/api/config'), patch)) return;
    } catch (_) {} // The ECU can drop status polls while applying settings.
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('The ECU acknowledged the save, but applying the new settings could not be confirmed. Reload Sequence and verify the saved values before starting.');
}

function startRebootCountdown() {
  if (typeof window.OTShowRebootOverlay === 'function') {
    window.OTShowRebootOverlay({returnPath:'/sequence.html'});
    return;
  }
  const overlay = document.getElementById('reboot-overlay');
  const count = document.getElementById('reboot-count');
  overlay?.classList.add('show');
  let remaining = 10;
  if (count) count.textContent = remaining;
  const timer = setInterval(() => {
    remaining--;
    if (count) count.textContent = remaining;
    if (remaining <= 0) { clearInterval(timer); reconnect(); }
  }, 1000);
}

function reconnect(attempts = 0) {
  fetch('/api/data').then(response => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    document.getElementById('reboot-overlay')?.classList.remove('show');
    return loadAll();
  }).then(() => startSequenceTelemetryForPlatform()).catch(() => {
    if (attempts < 20) setTimeout(() => reconnect(attempts + 1), 1000);
    else if (document.getElementById('reboot-count')) document.getElementById('reboot-count').textContent = 'Reload page';
  });
}

function setSaveStatus(message) {
  const status = document.getElementById('save-status');
  if (status) status.textContent = message;
}

function updateSequenceSaveControls() {
  const save = document.getElementById('save-btn');
  const discard = document.getElementById('seq-discard-btn');
  if (save) save.disabled = _seqLoading || _seqSavePending || !_seqDirty || (engineMode !== 'STANDBY' && engineMode !== 'FAULT');
  if (discard) discard.disabled = _seqLoading || _seqSavePending || !_seqDirty;
}

let _sequenceEditSnap = null;
function sequenceEditState() { return {hardware:hwCfg,settings:cfg}; }
function markSequenceDirty(message) {
  _seqDirty = !OTConfigEqual(sequenceEditState(),_sequenceEditSnap);
  document.getElementById('sequence-save-bar')?.classList.toggle('is-dirty',_seqDirty);
  setSaveStatus(_seqDirty ? message || 'Unsaved changes — save to apply' : 'No unsaved changes');
  updateSequenceSaveControls();
}

function clearSequenceDirty(message) {
  _sequenceEditSnap = cloneSequenceJson(sequenceEditState());
  _seqDirty = false;
  document.getElementById('sequence-save-bar')?.classList.remove('is-dirty');
  setSaveStatus(message || 'No unsaved changes');
  updateSequenceSaveControls();
}

window.addEventListener('beforeunload', event => {
  if (!_seqDirty) return;
  event.preventDefault();
  event.returnValue = '';
});
document.addEventListener('click', async event => {
  const link = event.target.closest?.('a[href]');
  if (!link || !_seqDirty || event.defaultPrevented || event.button !== 0 ||
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank') return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search) || window.OTIsSamePageWarningLink?.(link, url)) return;
  event.preventDefault();
  if (await OTDialog.confirm('Sequence has unsaved changes. Leave and discard them?',
      {title:'Unsaved sequence changes', confirmText:'Discard and leave', danger:true})) {
    clearSequenceDirty();
    location.href = url.href;
  }
}, true);

async function discardSequenceChanges() {
  if(_seqSavePending||_seqLoading)return;
  if (!_seqDirty) return;
  if (!await OTDialog.confirm('Discard every unsaved sequence change?', {title:'Discard changes?', confirmText:'Discard', danger:true})) return;
  await loadAll();
}
