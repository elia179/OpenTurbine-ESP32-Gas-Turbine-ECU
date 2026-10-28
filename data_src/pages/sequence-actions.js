// One command model feeds both expanded blocks and the final-state recap.
// Commands describe requested logical states, not measured electrical feedback.
function resolveSequenceActions(tab, sequence) {
  const acts=getEnabledActuators(), ignition=new Set();
  const byKey=key=>acts.find(a=>a.key===key), byId=id=>acts.find(a=>a.target===id);
  const param=(name,key,fallback)=>paramVals[name+'.'+key]??fallback;
  return sequence.map((name,index)=>{
    const rows=[];
    const write=(meta,value,phase='entry',note='')=>{
      if(!meta)return;
      rows.push({meta,value,phase,note});
      if(meta.ignition){if(Number(value)>0)ignition.add(meta.target);else if(Number(value)===0)ignition.delete(meta.target);}
    };
    const set=(key,value,phase,note)=>write(byKey(key),value,phase,note);
    const selected=()=>{
      const id=hwCfg[deviceTargetSeqKey(tab)]?.[index];
      if(id)return byId(id);
      if(isIgnitionBlock(name))return byKey(['igniter','igniter2','glow_plug'][Number(hwCfg[ignitionTargetSeqKey(tab)]?.[index]??0)]);
      return byId(registryOutputPurpose(BLOCK_OUTPUT_PURPOSES[name]?.[0])?.id);
    };
    const clearIgnition=()=>{for(const id of [...ignition])write(byId(id),0,'exit','Release ignition energized by this sequence');};
    if(BLOCK_OUTPUT_PURPOSES[name]){
      let value=/(?:Off|Close)$/.test(name)?0:1;
      if(name==='OilPumpOn')value=Number(param(name,'oil_pump_on_pct',100))/100;
      if(name==='ThrottleSet')value=Number(param(name,'throttle_set_pct',10))/100;
      if(name==='FuelPump2Set')value=Number(param(name,'fp2_demand_pct',0))/100;
      if(name==='FuelPumpRamp')value=Number(param(name,'fp2_start_pct',0))/100;
      write(selected(),value);
    }
    if(name==='OilPrime'){
      set('oil_pump',sensorEnabled('oil_press')&&hwCfg.controllers?.oil_loop?'Pressure control':Number(param(name,'startup_oil_pct',80))/100,'during','Build oil pressure before ignition');
      if(param(name,'oil_prime_use_scavenge',false))set('oil_scavenge_pump',1);
    }
    if(name==='StarterSpin'){set('starter',Number(param(name,'starter_demand',60))/100,'during','Ramps to configured demand');set('starter_en',1);}
    if(name==='FuelPumpIdle'||name==='ModifiedIdle'){
      const minimum=cfg?.throttle?.fuel_pump_min_pct??0;
      const maximum=name==='FuelPumpIdle'?param(name,'fp_idle_max_pct',50):cfg?.throttle?.idle_max_pct??50;
      const input=registryInputPurpose('idle')||hwCfg.sensors?.idle_input?.enabled;
      set('throttle',(input?`${minimum}–${maximum}% (idle input)`:`${maximum}% (fixed)`)+(name==='ModifiedIdle'?' × '+param(name,'modified_idle_multiplier',1):''),'during','Temporary startup command');
    }
    if(name==='Spool')set('throttle',Number(cfg?.throttle?.fuel_pump_min_pct??0)/100);
    if(name==='ImmediateCut')for(const key of ['throttle','fuel_sol','igniter','igniter2','glow_plug','starter','starter_en','fuel_pump2','ab_sol','ab_pump'])set(key,0);
    if(name==='ABIgnite'){
      if(cfg.afterburner?.use_torch??true)set('throttle',`+${Number(cfg.afterburner?.torch_spike_pct??30)}% ignition offset`,'during','Temporary offset; normal demand remains separately controlled');
      if(cfg.afterburner?.use_igniter)set('igniter2',1,'during');
    }
    const ref=window.OTControllerTiming?.parse(name),rule=ref&&(cfg.rules||[]).find(r=>Number(r.controller_id)===ref.id);
    if(rule&&rule.enabled!==false&&OTControllerTiming.selected(rule,ref)){
      write(byId(rule.target),ref.on?`Controlled by “${rule.name}”`:Number((hwCfg.channel_registry?.outputs||[]).find(c=>c.id===rule.target)?.safe_demand??0));
      if(rows.length)rows[rows.length-1].controller=ref.on?rule.controller_id:null;
    }
    const side=phase=>{for(const action of hwCfg[actionKey(tab,phase)]?.[index]||[])
      if(action.enabled!==false)write(sideActionMeta(action),Number(action.value)||0,phase==='enter'?'entry':'exit','Added side action');};
    side('enter');
    // Firmware reasserts the protective cut after entry side actions.
    if(name==='ImmediateCut')for(const key of ['throttle','fuel_sol','igniter','igniter2','glow_plug','starter','starter_en','fuel_pump2','ab_sol','ab_pump']){
      const meta=byKey(key);
      if(meta){for(let i=rows.length-1;i>=0;i--)if(rows[i].meta.target===meta.target && rows[i].phase==='entry')rows.splice(i,1);set(key,0);}
    }
    const custom=hwCfg.custom_blocks?.[name];
    if(custom&&custom.type!=='wait')for(const step of custom.steps||[]){
      if(step.type==='set_act'){
        const meta=step.target?byId(step.target):byKey(step.act);
        write(meta,meta?.mode==='pct'?Number(step.val)/100:Number(step.val),'during','Custom step');
      }
    }
    if(name==='FuelPulse')write(selected(),0,'exit');
    if(name==='FuelPumpRamp')write(selected(),Number(param(name,'fp2_end_pct',80))/100,'exit','Ramp end');
    if(name==='ABIgnite'){
      if(cfg.afterburner?.use_igniter)set('igniter2',0,'exit');
      // Removing an additive offset is not a command to turn the fuel pump off.
      if(cfg.afterburner?.use_torch??true)set('throttle','Ignition offset removed','exit');
    }
    if(name==='Spool'){
      if(param(name,'spool_cut_starter_on_exit',true))set('starter',0,'exit');
      if(param(name,'spool_cut_starter_en_on_exit',true))set('starter_en',0,'exit');
    }
    if(name==='FlameConfirm'&&param(name,'flame_turn_off_igniter',true))clearIgnition();
    if(name==='SafetyHold'){
      if(param(name,'safety_turn_off_starter',false))set('starter',0,'exit');
      if(param(name,'safety_turn_off_starter_en',false))set('starter_en',0,'exit');
      if(param(name,'safety_turn_off_igniter',false))clearIgnition();
    }
    if(name==='CooldownSpin'){
      if(param(name,'cooldown_use_starter',true)){
        set('starter',Number(param(name,'cooldown_starter_pct',40))/100,'during','After combustion; skipped in Bench Mode');set('starter_en',1,'during');
      }
      if(param(name,'cooldown_use_oil_pump',true))set('oil_pump',sensorEnabled('oil_press')?'Pressure control':Number(param(name,'cooldown_oil_pct',30))/100,'during','After combustion; skipped in Bench Mode');
      if(param(name,'cooldown_use_scavenge',false))set('oil_scavenge_pump',1,'during');
      for(const key of ['starter','starter_en','oil_pump','oil_scavenge_pump'])set(key,0,'exit');
    }
    if(name==='FinalStop'){
      set('oil_pump',0,'during','After shaft-stop condition or timeout');
      if(Number(param(name,'oil_scavenge_ms',0))>0)set('oil_scavenge_pump',1,'during','Configured extra scavenge period');
      set('oil_scavenge_pump',0,'exit');
    }
    side('exit');
    if(name==='ImmediateCut'){
      const hazardous=new Set(['main_fuel','fuel_shutoff','fuel_pump','pilot_fuel','igniter','ab_igniter','ab_valve','ab_pump','glow_plug','starter','starter_enable','air_starter']);
      for(const output of hwCfg.channel_registry?.outputs||[]){
        if(output.installed===false || !hazardous.has(output.purpose))continue;
        const meta=byId(output.id)||{target:output.id,key:output.id,label:output.name||output.id,mode:[4,11].includes(Number(output.driver))?'relay':'pct'};
        for(let i=rows.length-1;i>=0;i--)if(rows[i].meta.target===meta.target)rows.splice(i,1);
        write(meta,0,'entry','Protective shutdown cut');
      }
    }
    return rows;
  });
}

function sequenceActionValue(meta,value) {
  if(typeof value==='string')return value;
  if(meta.mode==='pct')return `${Math.round(value*100)}%`;
  return ['fuel_sol','airstarter_sol','ab_sol','bleed_valve','drain_valve'].includes(meta.key)?value>=.5?'OPEN':'CLOSED':value>=.5?'ON':'OFF';
}

function buildResolvedActionsHtml(name,index,tab) {
  if((BLOCK_OUTPUT_PURPOSES[name] && !['FuelPulse','FuelPumpRamp'].includes(name)) || name==='SetOutput' || OTControllerTiming.parse(name))return '';
  const sequence=hwCfg[seqKey(tab)]||[];
  const rows=resolveSequenceActions(tab,sequence)[index]||[];
  if(!rows.length)return '';
  const phases={entry:'On entry',during:'While this block runs',exit:'On exit'};
  return `<div class="sequence-actions" aria-label="Commands in this block"><div class="cfg-title">Commands in this block</div>${Object.entries(phases).map(([phase,label])=>{
    const actions=rows.filter(row=>row.phase===phase);
    return actions.length?`<div class="sequence-action-phase">${label}</div><div class="sequence-action-grid">${actions.map(row=>`<div class="sequence-action-card"><span class="block-badge badge-action">ACTION</span><strong>${esc(row.meta.label)}</strong><span class="sequence-action-value">${esc(sequenceActionValue(row.meta,row.value))}</span>${row.note?`<small>${esc(row.note)}</small>`:''}</div>`).join('')}</div>`:'';
  }).join('')}<p class="block-desc">Commands shown here are built into this block; they are not measured output feedback.${name==='ImmediateCut'?' Oil pumping is retained during rotor slowdown; this block does not command it OFF.':''}</p></div>`;
}
