// Simulated UI metadata derived from the shipped profile; no electrical qualification.
const source=require('../pcb_profiles/official/openturbine-s3-20261028.otpcb.json');
function latestPcbFixture(original){
 const state=structuredClone(original),h=state.hardware;
 const devices=new Map(source.devices.map(d=>[d.id,d]));
 const gpios=new Set();
 const collect=o=>{if(!o||typeof o!=='object')return;for(const[k,v]of Object.entries(o)){if((k==='gpio'||['sda','scl','sck','miso','mosi','tx','rx'].includes(k))&&Number.isInteger(v)&&v>=0)gpios.add(v);else if(v&&typeof v==='object')collect(v);}};collect(source);
 h.platform='esp32s3';h.profile_id='simulated-pcb-preview';state.settings.profile_id=h.profile_id;h.profile_desc='SIMULATED PCB preview - not commissioned';
 h.channel_registry={version:2,input_capacity:24,output_capacity:16,inputs:[{id:'battery_voltage',name:'ECU Supply',purpose:'battery_voltage',role:'voltage',driver:1,pin:source.fixed_functions.supply_voltage.gpio,min:0,max:4095,analog_divider:source.fixed_functions.supply_voltage.divider}],outputs:[],bindings:[]};
 h.controls={start_pin:-1,stop_pin:-1};h.di_channels=[];h.buzzer={enabled:false,pin:-1};h.sensors={};h.actuators={status_led:{enabled:true},fault_led:{enabled:true}};
 h.i2c={enabled:true,sda_pin:4,scl_pin:5,speed_hz:400000};h.spi={enabled:true,sck_pin:12,miso_pin:13,mosi_pin:11};
 h.mavlink={enabled:false,tx_pin:43,rx_pin:44,baud:115200,interval_ms:100,allow_commands:false};
 h._pcb_profile={state:'valid',...source.board,target_chip:source.target.chip,origin:'official',format_major:1,format_minor:1,port_count:source.ports.length,bus_ownership:{i2c:true,spi:true},reserved_gpio:[...gpios].sort((a,b)=>a-b),fixed_functions:{},ports:source.ports.map(p=>({...p,modes:p.modes.map(m=>({...m,gpio:m.endpoint?.gpio,device_driver:devices.get(m.device)?.driver,available:true}))}))};
 for(const[key,value]of Object.entries(source.fixed_functions))h._pcb_profile.fixed_functions[key]={available:true,...(key==='mavlink'?{connection:value.bus}:{}),...(key==='status_led'?{type:'gpio'}:{}),...(value.label?{label:value.label}:{})};
 for(const key of Object.keys(h))if(Array.isArray(h[key])&&/_(seq|enter_actions|exit_actions|delay_ms)$/.test(key))h[key]=[];
 state.settings.rules=[];return state;
}
module.exports={latestPcbFixture,source};
