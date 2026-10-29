// Local-only interactive simulation. Never point this tool at an ECU.
const {latestPcbFixture}=require('./latest_pcb_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=Number(process.argv[2]||8792);
 await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:'+globalThis.OT_UI_SIM_PORT;
 const original=await(await fetch(base+'/__sim/state')).json();
 const response=await fetch(base+'/api/ecu_config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(latestPcbFixture(original))});
 if(!response.ok)throw Error(await response.text());
 await fetch(base+'/__sim/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'STANDBY',config_locked:false,dev_mode:false,n1:0,n2:0,tot:25,oil:0,oil_pct:0,throttle_demand:0})});
 console.log('SIMULATED latest PCB, all devices assumed fitted. No engine is connected. '+base+'/hardware.html');
})().catch(e=>{console.error(e);process.exit(1)});
