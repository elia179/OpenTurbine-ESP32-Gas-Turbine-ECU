const assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const fs=require('node:fs'),{gunzipSync}=require('node:zlib');
(async()=>{
  globalThis.OT_UI_SIM_PORT=16300+Math.floor(Math.random()*100);
  await import('./ui_mock_server.mjs');
  const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
  for(const engine of [chromium,firefox,webkit]) for(const gzip of [false,true]) {
  const browser=await engine.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    if(gzip)await page.route(/\/(controllers\.html|sequence\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,async r=>{
      const file=new URL(r.request().url()).pathname.split('/').pop();
      await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
    });
    page.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message);});
    await page.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
    await page.request.post(base+'/__sim/reset');
    await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',dev_mode:false,extra_cooldown_active:false,stop_switch_active:false}});
    const hw=await(await page.request.get(base+'/api/hardware')).json();
    const output=hw.channel_registry.outputs.find(o=>o.purpose==='main_fuel');
    const input=hw.channel_registry.inputs.find(o=>o.purpose==='idle');
    assert.ok(output&&input);
    const rule={controller_id:42,name:'Startup fuel <pot>',enabled:true,kind:1,source:input.id,target:output.id,
      input_min:0,input_max:1,output_min:.1,output_max:.4,mode_mask:4,activate_event:0,deactivate_events:20};
    await page.request.patch(base+'/api/hardware',{data:{controllers:{governor:false,dynamic_idle:false}}});
    await page.request.patch(base+'/api/config',{data:{controller_schema:1,rules:[rule]}});
    await page.goto(base+'/controllers.html');
    await page.waitForFunction(()=>document.querySelector('[aria-label="Activate: Sequencer block"]'));
    assert.equal(await page.getByLabel('Activate: Sequencer block',{exact:true}).isChecked(),true);
    assert.equal(await page.locator('select[aria-label="Activate when"]').count(),0);
    await page.locator('[data-controller-id="42"] > summary').click();
    await page.getByLabel('Activate: Entering Startup',{exact:true}).check();
    assert.equal(await page.evaluate(()=>cfg.rules[0].activate_events),3);
    assert.equal(await page.getByLabel('Activate: Sequencer block',{exact:true}).isChecked(),true);
    assert.equal(await page.getByLabel('Deactivate: Entering Startup',{exact:true}).isDisabled(),true);
    assert.match(await page.evaluate(()=>OTControllerTiming.summary(cfg.rules[0])),/Sequencer block or Entering Startup/);
    assert.equal(await page.evaluate(()=>OTControllerTiming.required(cfg.rules).filter(b=>b.on).length),1);
    await page.evaluate(()=>{delete cfg.rules[0].activate_events;cfg.rules[0].activate_event=0;renderForm(true);});
    assert.match(await page.locator('#controller-overview').textContent(),/Sequence needs setup/);
    assert.equal(await page.evaluate(()=>OTControllerTiming.required(cfg.rules)[0].key),'ControllerOn_42');
    const recap=await page.evaluate(()=>{
      cfg.rules[0].activate_event=2;
      const changes=_controllerRuleChanges();cfg.rules[0].activate_event=0;
      return changes.filter(change=>change.key.endsWith('_activate_events'));
    });
    assert.equal(recap.length,1);assert.match(recap[0].label,/Activate when/);assert.equal(recap[0].now,'Entering Running');
    const staleSave=await page.evaluate(async()=>{
      window._otControllerCleanupReview=['startup_seq:ControllerOn_42'];
      const oldFetch=window.fetch;let writes=0;
      window.fetch=async(url,options={})=>{
        if(options.method&&options.method!=='GET'){writes++;throw Error('Unexpected write');}
        return oldFetch(url,options);
      };
      try {await _saveControllerChanges({},document.createElement('span'),null);return {writes,error:''};}
      catch(error){return {writes,error:error.message};}
      finally {window.fetch=oldFetch;window._otControllerCleanupReview=[];}
    });
    assert.equal(staleSave.writes,0);assert.match(staleSave.error,/Sequence changed since the review/);
    await page.goto(base+'/sequence.html');
    await page.waitForFunction(()=>document.querySelector('[data-controller-key="ControllerOn_42"]'),null,{timeout:10000}).catch(async e=>{console.error(await page.evaluate(()=>({status:document.querySelector('#save-status')?.textContent,timing:typeof OTControllerTiming,rules:typeof cfg!=='undefined'?cfg.rules:null,pending:document.querySelector('#controller-pending-blocks')?.outerHTML})));throw e;});
    assert.match(await page.locator('#controller-pending-blocks').innerText(),/Startup fuel <pot>/);
    await page.locator('[data-controller-key="ControllerOn_42"]').click();
    await page.locator('#list-startup [data-controller-drop]').last().click();
    const controllerCard=page.locator('#list-startup .block-card').filter({hasText:'Activate “Startup fuel <pot>”'});
    await controllerCard.waitFor();
    assert.equal(await page.locator('#controller-pending-blocks').isVisible(),false);
    await controllerCard.getByRole('button',{name:'Remove this sequence block',exact:true}).click();
    assert.equal(await controllerCard.count(),0);
    assert.equal(await page.locator('[data-controller-key="ControllerOn_42"]').count(),1);
    assert.ok(await page.evaluate(()=>validateSequenceHardwareForSave().some(e=>e.includes('place required Activate block'))));
    await page.locator('[data-controller-key="ControllerOn_42"]').click();
    await page.locator('#list-startup [data-controller-drop]').last().click();
    await page.evaluate(()=>{cfg.rules[0].name='Renamed controller';syncControllerSequenceBlocks();render('startup',0);});
    assert.match(await page.locator('#list-startup').innerText(),/Activate “Renamed controller”/);
    assert.equal(await page.evaluate(()=>hwCfg.startup_seq.at(-1)),'ControllerOn_42');
    await page.evaluate(()=>{cfg.rules[0].enabled=false;syncControllerSequenceBlocks();render('startup',0);});
    assert.match(await page.locator('#list-startup').innerText(),/Controller disabled/);
    await page.evaluate(()=>{
      cfg.rules[0].enabled=true;cfg.rules[0].activate_event=0;cfg.rules[0].deactivate_events=24;
      hwCfg.startup_seq=['ControllerOn_42','FuelPumpIdle'];
      hwCfg.startup_delay_ms=[0,0];hwCfg.startup_device_target=['',''];
      hwCfg.startup_enter_actions=[[],[]];hwCfg.startup_exit_actions=[[],[]];
      syncControllerSequenceBlocks();render('startup',0);
    });
    assert.match(await page.locator('#list-startup .controller-ownership-note').innerText(),/Renamed controller.*controls this output/);
    await page.evaluate(()=>{
      cfg.rules[0].deactivate_events|=1;hwCfg.startup_seq=['ControllerOn_42','ControllerOff_42','FuelPumpIdle'];
      hwCfg.startup_delay_ms=[0,0,0];hwCfg.startup_enter_actions=[[],[],[]];hwCfg.startup_exit_actions=[[],[],[]];
      syncControllerSequenceBlocks();render('startup',0);
    });
    assert.equal(await page.locator('#list-startup .controller-ownership-note').count(),0);
    const cleanup=await page.evaluate(()=>{
      cfg.rules[0].activate_event=2;cfg.rules[0].deactivate_events=24;
      hwCfg.startup_device_target=['first','second','kept'];
      return OTControllerTiming.cleanup(cfg.rules,hwCfg);
    });
    assert.deepEqual(cleanup.patch.startup_seq,['FuelPumpIdle']);
    assert.deepEqual(cleanup.patch.startup_device_target,['kept']);
    assert.equal(cleanup.removed.length,2);
    const transition=await page.evaluate(()=>{
      cfg.rules[0].activate_event=0;cfg.rules[0].deactivate_events=24;
      hwCfg.startup_seq=['ControllerOn_42'];hwCfg.startup_enter_actions=[[]];hwCfg.startup_exit_actions=[[]];
      hwCfg.startup_device_target=[''];hwCfg.shutdown_seq=['SetOutput'];
      hwCfg.shutdown_device_target=[''];hwCfg.shutdown_enter_actions=[[{target:cfg.rules[0].target,value:.2}]];hwCfg.shutdown_exit_actions=[[]];
      const released=OTControllerTiming.plan(cfg.rules,hwCfg,'shutdown');
      cfg.rules[0].deactivate_events=16;
      return {released,held:OTControllerTiming.plan(cfg.rules,hwCfg,'shutdown')};
    });
    assert.deepEqual(transition.released,[]);
    assert.ok(transition.held.some(issue=>issue.index===0));
    const coupled=await page.evaluate(()=>{
      const starter=hwCfg.channel_registry.outputs.find(o=>o.purpose==='starter');
      const enable=hwCfg.channel_registry.outputs.find(o=>o.purpose==='starter_enable');
      if(!starter||!enable)throw Error('Missing starter fixture');
      const rules=[{controller_id:501,name:'Starter driver',target:starter.id,activate_event:1,deactivate_events:24},
        {controller_id:502,name:'Starter enable',target:enable.id,activate_event:1,deactivate_events:24}];
      return rules.map(r=>OTControllerTiming.status(r,hwCfg,rules));
    });
    assert.deepEqual(coupled,['Sequence conflict','Sequence conflict']);
    assert.equal(await page.locator('pot').count(),0);
    await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',seq_has_structural_errors:false,seq_has_errors:false,stop_switch_active:false,extra_cooldown_active:false,profile_match:true,controller_inhibit_mask:1,seq_issues:[{block:'ControllerOn_42',msg:'Startup fuel <pot> inactive this run: place Activate block',error:false}]}});
    await page.goto(base+'/');
    await page.waitForFunction(()=>document.querySelector('#start-block-reason')?.textContent.includes('inactive this run'));
    assert.equal(await page.locator('#btn-start').isDisabled(),false);
    assert.match(await page.locator('#start-block-reason').innerText(),/Startup fuel <pot> inactive this run/);
    assert.equal(await page.locator('#start-block-reason pot').count(),0);
    assert.match(await page.locator('#start-block-reason a').getAttribute('href'),/sequence/);
    const hardBlock=await page.evaluate(()=>{
      applyData({..._lastData,mode:'STANDBY',seq_has_structural_errors:true,seq_has_errors:true});
      return document.querySelector('#btn-start').disabled;
    });
    assert.equal(hardBlock,true);
    const hardwareBlock=await page.evaluate(()=>{
      applyData({..._lastData,mode:'STANDBY',seq_has_structural_errors:false,seq_has_errors:true,bench_mode:false});
      return document.querySelector('#btn-start').disabled;
    });
    assert.equal(hardwareBlock,true);

    assert.deepEqual(errors,[]);
    console.log(engine.name(),gzip?'gzip':'source','Controller activation UI: five choices, stable named block, required placement, unplace/reinsert, rename and explicit disable passed.');
  } finally {await browser.close();}
  }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
