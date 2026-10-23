// OT_CONTROLLERS_ONLY_BEGIN
// Controller timing is shared by Controllers and Sequence. IDs, never labels
// or array positions, link the two editors.
window.OTControllerTiming = (() => {
  const events = ['Sequencer block','Entering Startup','Entering Running','Entering Shutdown','Entering Standby'];
  const seqKeys = ['startup_seq','shutdown_seq','ab_seq','ab_shut_seq'];
  const key = (id,on) => `Controller${on?'On':'Off'}_${Number(id)}`;
  const parse = name => {
    const m=/^Controller(On|Off)_([1-9][0-9]{0,4})$/.exec(String(name||''));
    return m && Number(m[2])<=65535 ? {id:Number(m[2]),on:m[1]==='On'} : null;
  };
  const starts = r => Number.isInteger(r?.activate_events) ? r.activate_events & 31 : Number.isInteger(r?.activate_event) && r.activate_event>=0 && r.activate_event<=4 ? 1<<r.activate_event : 0;
  const scheduled = r => Number.isInteger(r?.activate_events) || starts(r)!==0;
  function ensureIds(rules) {
    const used=new Set(rules.map(r=>Number(r.controller_id)).filter(n=>n>0&&n<=65535));
    let next=1;
    for(const r of rules) if(!Number.isInteger(r.controller_id)||r.controller_id<1||r.controller_id>65535){
      while(used.has(next))next++;
      if(next>65535)throw Error('No controller identities available');
      r.controller_id=next;used.add(next++);
    }
  }
  const placed=(hw,name)=>seqKeys.some(k=>(hw?.has_afterburner!==false||!k.startsWith('ab_'))&&(hw?.[k]||[]).includes(name));
  function required(rules) {
    const out=[];
    for(const r of rules||[]) if(scheduled(r)) {
      if((starts(r)&1))out.push({key:key(r.controller_id,true),on:true,rule:r});
      if(Number(r.deactivate_events)&1)out.push({key:key(r.controller_id,false),on:false,rule:r});
    }
    return out;
  }
  function plan(rules,hw,selected='startup',endOwners=false) {
    const active=new Map(),notes=new Map(),list=(rules||[]).filter(r=>r.enabled!==false&&scheduled(r));
    const byId=new Map(list.map(r=>[Number(r.controller_id),r]));
    const outputs=(hw.channel_registry?.outputs||[]).filter(o=>o.installed!==false&&!o.mirror_of);
    const primary=purpose=>{
      const candidates=outputs.filter(o=>o.purpose===purpose);
      const bindings={main_fuel:'main_fuel_output',starter:'main_starter',starter_enable:'starter_enable_output',oil_pump:'primary_oil_pump',scavenge_pump:'primary_scavenge_pump',ab_pump:'primary_ab_pump',ab_valve:'primary_ab_valve',ab_igniter:'primary_secondary_igniter',glow_plug:'primary_glow_plug'};
      const bound=hw.channel_registry?.bindings?.find(b=>b.key===bindings[purpose]);
      return candidates.find(o=>o.id===bound?.channel)?.id||(candidates.length===1?candidates[0].id:'');
    };
    const issue=(tab,index,message,owner,controller)=>{const k=tab+':'+index;if(!notes.has(k))notes.set(k,{tab,index,message,owner,controller});};
    const footprint=target=>['request_shutdown','request_fault'].includes(target)?[]:[target,...(target&&target===primary('starter')?[primary('starter_enable')]:[])].filter(Boolean);
    const ownerFor=target=>footprint(target).map(id=>active.get(String(id))).find(Boolean);
    const acquire=(rule,tab,index)=>{
      const previous=ownerFor(rule.target);
      if(previous&&previous.controller_id!==rule.controller_id){issue(tab,index,`“${previous.name}” controls this output. Deactivate it first.`,previous.controller_id,rule.controller_id);return;}
      for(const target of footprint(rule.target))active.set(String(target),rule);
    };
    const release=rule=>{for(const [target,owner] of active)if(owner.controller_id===rule.controller_id)active.delete(target);};
    const enter=(event,tab)=>{
      for(const rule of list)if(Number(rule.deactivate_events)&(1<<event))release(rule);
      for(const rule of list)if((starts(rule)&(1<<event)))acquire(rule,tab,-1);
    };
    const builtins={FuelPumpIdle:['main_fuel'],ModifiedIdle:['main_fuel'],Spool:['main_fuel','starter','starter_enable'],StarterSpin:['starter','starter_enable'],SafetyHold:['starter','starter_enable'],OilPrime:['oil_pump','scavenge_pump'],ABIgnite:['ab_pump','ab_valve','ab_igniter','main_fuel','glow_plug']};
    const protectedBlocks=new Set(['ImmediateCut','FinalStop','CooldownSpin','RPMDrop']);
    const prefix={startup:'startup',shutdown:'shutdown',afterburner:'ab','ab-shut':'ab_shut'};
    function walk(tab,until=Infinity){
      const stem=prefix[tab],sequence=hw[stem+'_seq']||[];
      for(let i=0;i<sequence.length&&i<until;i++){
        const name=sequence[i],ref=parse(name),rule=ref&&byId.get(ref.id);
        if(ref){
          if(rule&&ref.on&&(starts(rule)&1))acquire(rule,tab,i);
          else if(rule&&!ref.on&&(Number(rule.deactivate_events)&1))release(rule);
        }
        if(protectedBlocks.has(name))continue;
        const targets=[];
        const explicit=hw[stem+'_device_target']?.[i];
        if(explicit)targets.push(explicit);
        else for(const purpose of builtins[name]||[])targets.push(primary(purpose));
        for(const phase of ['enter','exit'])for(const action of hw[stem+'_'+phase+'_actions']?.[i]||[])
          if(action.enabled!==false&&action.target)targets.push(action.target);
        for(const step of hw.custom_blocks?.[name]?.steps||[])
          if(step.type!=='delay'&&step.type!==1&&step.target)targets.push(step.target);
        for(const target of targets){const owner=ownerFor(target);if(owner)issue(tab,i,`“${owner.name}” controls this output. Deactivate it before this block.`,owner.controller_id);}
      }
    }
    enter(4,'startup');enter(1,'startup');walk('startup');
    if(endOwners&&selected==='startup')enter(2,'startup');
    if(selected!=='startup'){
      enter(2,selected);
      if(selected==='afterburner'||selected==='ab-shut'){walk('afterburner');if(selected==='ab-shut')walk('ab-shut');}
      else if(selected==='shutdown'){
        const running=new Map(active);
        enter(3,'shutdown');walk('shutdown');
        if(hw.has_afterburner&&!endOwners){
          active.clear();for(const [k,v] of running)active.set(k,v);
          walk('afterburner');const abActive=new Map(active);
          enter(3,'shutdown');walk('shutdown');
          active.clear();for(const [k,v] of abActive)active.set(k,v);
          walk('ab-shut');enter(3,'shutdown');walk('shutdown');
        }
      }
    }
    if(endOwners&&selected==='shutdown')enter(4,'shutdown');
    return endOwners ? new Map(active) : [...notes.values()].filter(n=>n.tab===selected);
  }
  function selected(rule,ref){return !!rule&&(ref.on?(starts(rule)&1):!!(Number(rule.deactivate_events)&1));}
  function cleanup(rules,hw){
    const byId=new Map((rules||[]).map(r=>[Number(r.controller_id),r]));
    const patch={},removed=[];
    for(const seq of seqKeys){
      const old=hw?.[seq]||[],keep=[];
      old.forEach((name,i)=>{const ref=parse(name);if(ref&&!selected(byId.get(ref.id),ref))removed.push(seq+':'+name);else keep.push(i);});
      if(keep.length===old.length)continue;
      const stem=seq.slice(0,-4);patch[seq]=keep.map(i=>old[i]);
      for(const suffix of ['delay_ms','ignition_target','device_target','wait_inputs','enter_actions','exit_actions']){
        const k=stem+'_'+suffix;if(Array.isArray(hw[k]))patch[k]=keep.map(i=>hw[k][i]??(suffix.endsWith('actions')?[]:suffix==='device_target'?'':suffix==='wait_inputs'?{}:0));
      }
    }
    return {patch,removed};
  }
  function status(r,hw,rules=[r]) {
    if(r.enabled===false)return 'OK';
    if(!scheduled(r))return 'OK'; // unchanged, older state-based definition
    if(!starts(r))return 'Choose activation';
    if(!(Number(r.deactivate_events)&31))return 'Choose deactivation';
    if(required([r]).some(b=>!placed(hw,b.key)))return 'Sequence needs setup';
    if(['startup','shutdown','afterburner','ab-shut'].some(tab=>plan(rules,hw,tab).some(n=>(n.owner===r.controller_id||n.controller===r.controller_id))))return 'Sequence conflict';
    return 'OK';
  }
  function summary(r){
    if(!scheduled(r))return 'Existing operating-state selection';
    const stops=events.filter((_,i)=>Number(r.deactivate_events)&(1<<i));
    return `Starts: ${events.filter((_,i)=>starts(r)&(1<<i)).join(' or ')}. Stops: ${stops.join(' or ')||'choose deactivation'}.`;
  }
  return {starts,events,seqKeys,key,parse,scheduled,ensureIds,placed,required,status,summary,plan,selected,cleanup,ownersAtEnd:(rules,hw,tab)=>plan(rules,hw,tab,true)};
})();

// OT_CONTROLLERS_ONLY_END
