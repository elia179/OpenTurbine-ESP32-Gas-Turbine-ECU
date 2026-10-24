// One cumulative teaching installation. Never connect this module to a real ECU.
const example = require('../site/_data/guided_example.json');
const clone = value => JSON.parse(JSON.stringify(value));
function guidedFixture(original, level, {board='esp32s3', workshops=false}={}) {
  const state=clone(original), h=state.hardware, s=state.settings, e=example;
  const ids=new Set(['n1_main','tot_main','operator_throttle','oil_pressure_main']);
  const outs=new Set(['starter','main_fuel','igniter','oil_pump','fuel_shutoff']);
  if(level>=2)ids.add('p1_main');
  if(level>=3)ids.add('n2_main');
  if(workshops){['oil_temperature','battery_voltage','torque_main','thrust_main'].forEach(id=>ids.add(id));outs.add('cooling_fan');}
  const s3={n1_main:6,n2_main:40,operator_throttle:1,oil_pressure_main:2,p1_main:3,starter:15,main_fuel:16,igniter:17,oil_pump:21,fuel_shutoff:18,oil_temperature:7,battery_voltage:4,torque_main:41,cooling_fan:39};
  const classic={n1_main:27,n2_main:22,operator_throttle:34,oil_pressure_main:35,p1_main:36,starter:32,main_fuel:25,igniter:33,oil_pump:26,fuel_shutoff:21};
  const pins=board==='esp32'?classic:s3;
  h.platform=board;h.profile_id=`guide-build-${level}`;h.profile_desc=`${e.name}, Build ${level}`;
  h.labels={...h.labels,n1:'N1 Speed',n2:'N2 Power Shaft',tot:'Main TOT',p1:'Combustor Pressure'};
  h.channel_registry.inputs=h.channel_registry.inputs.filter(c=>ids.has(c.id));
  h.channel_registry.outputs=h.channel_registry.outputs.filter(c=>outs.has(c.id));
  h.channel_registry.bindings=h.channel_registry.bindings.filter(b=>ids.has(b.channel)||outs.has(b.channel));
  for(const c of [...h.channel_registry.inputs,...h.channel_registry.outputs])if(c.id in pins)c.pin=pins[c.id];
  for(const c of h.channel_registry.outputs)Object.assign(c,{has_current:false,current_pin:-1,has_flow_monitor:false,safe_demand:0,boot_safe_demand:0});
  const input=id=>h.channel_registry.inputs.find(c=>c.id===id), output=id=>h.channel_registry.outputs.find(c=>c.id===id);
  Object.assign(input('operator_throttle'),{driver:1,min:0,max:4095,analog_zero_mv:0,analog_mv_per_unit:3300});
  for(const id of ['oil_pressure_main','p1_main'])if(input(id))Object.assign(input(id),{analog_zero_mv:e.pressure_zero_mv,analog_mv_per_unit:e.pressure_mv_per_bar});
  if(input('p1_main'))input('p1_main').name='Combustor Pressure';
  if(input('n2_main'))input('n2_main').name='N2 Power Shaft';
  const spi=board==='esp32'?{sck_pin:18,miso_pin:19,cs:23}:{sck_pin:12,miso_pin:13,cs:14};
  Object.assign(input('tot_main'),{spi_clk:spi.sck_pin,spi_miso:spi.miso_pin,spi_cs:spi.cs,spi_mosi:-1,temp_interface:2});
  h.spi={enabled:true,sck_pin:spi.sck_pin,miso_pin:spi.miso_pin,mosi_pin:-1};
  h.controls={start_pin:board==='esp32'?13:9,stop_pin:board==='esp32'?14:10,start_active_h:false,stop_active_h:false,start_pullup:true,stop_pullup:true};
  h.di_channels=[];h.i2c={enabled:workshops,sda_pin:workshops?11:-1,scl_pin:workshops?47:-1,interrupt_pin:-1,frequency_hz:100000};
  Object.assign(output('main_fuel'),{name:'Main Fuel Metering',driver:5,min:0,max:1,pwm_freq_hz:e.pwm_hz,pwm_res_bits:e.pwm_bits});
  Object.assign(output('oil_pump'),{driver:5,min:0,max:1,pwm_freq_hz:e.pwm_hz,pwm_res_bits:e.pwm_bits});
  const sensorIDs={n1_rpm:'n1_main',n2_rpm:'n2_main',tot:'tot_main',oil_press:'oil_pressure_main',p1:'p1_main',oil_temp:'oil_temperature',batt_voltage:'battery_voltage',throttle_input:'operator_throttle'};
  for(const [key,c] of Object.entries(h.sensors)){c.enabled=ids.has(sensorIDs[key]);if(c.enabled&&sensorIDs[key] in pins)c.pin=pins[sensorIDs[key]];}
  Object.assign(h.sensors.tot,{chip:'max31855',clk:spi.sck_pin,miso:spi.miso_pin,cs:spi.cs,mosi:-1});
  h.sensors.throttle_input.rc_pwm=false;
  const actuatorIDs={throttle:'main_fuel',starter:'starter',igniter:'igniter',oil_pump:'oil_pump',fuel_sol:'fuel_shutoff',cool_fan:'cooling_fan'};
  for(const [key,c] of Object.entries(h.actuators)){c.enabled=outs.has(actuatorIDs[key]);c.has_current=false;c.current_pin=-1;c.has_flow_monitor=false;if(c.enabled)c.pin=pins[actuatorIDs[key]];}
  h.actuators.throttle.type=1;
  h.controllers={oil_loop:true,dynamic_idle:level===2,governor:false};
  h.safety={overspeed:true,n2_overspeed:level>=3,overtemp:true,low_oil:true,oil_zero:false,flameout:false,hot_start:level>=2,oil_temp_high:false,fuel_press_low:false,batt_low:false,surge:false};
  h.oil_loops=[{enabled:true,id:'oil1',pressure_input:'oil_pressure_main',pump_output:'oil_pump',target_source:0,target_bar:e.oil_target_bar,target_high_bar:e.oil_target_bar,deadband_bar:e.oil_deadband_bar,response_gain:1.8,min_demand:.18,max_demand:1,failsafe_delay_ms:1500,failsafe_demand:.6,feedback_loss_response:2,low_pressure_bar:e.oil_min_bar,low_pressure_confirm_ms:e.oil_confirm_ms,low_pressure_response:2}];
  h.startup_seq=['OilPrime','StarterSpin','SetOutput','SetOutput','SetOutput','TempConfirm','SafetyHold','SetOutput','SetOutput','SafetyHold'];
  h.startup_delay_ms=h.startup_seq.map(()=>0);
  h.startup_enter_actions=[[],[],[{act:9,target:'igniter',value:1}],[{act:8,target:'fuel_shutoff',value:1}],[{act:4,target:'main_fuel',value:e.fuel_idle_pct/100}],[],[],[{act:5,target:'starter',value:0}],[{act:9,target:'igniter',value:0}],[]];
  h.startup_exit_actions=h.startup_seq.map(()=>[]);
  h.shutdown_seq=['ImmediateCut','RPMDrop','CooldownSpin','FinalStop'];h.shutdown_delay_ms=[0,0,0,0];h.shutdown_enter_actions=h.shutdown_seq.map(()=>[]);h.shutdown_exit_actions=h.shutdown_seq.map(()=>[]);
  h.ab_seq=[];h.ab_shut_seq=[];h.cluster_serial.enabled=false;h.mavlink.enabled=false;h.buzzer.enabled=false;
  s.controller_schema=1;s.profile_id=h.profile_id;
  s.tools={...s.tools,start_test_pct:30,start_test_ms:2000};
  s.rules=[{controller_id:1,enabled:true,name:level>=3?'Main Fuel N2 Governor':'Main Fuel',kind:level>=3?2:1,source:level>=3?'n2_main':'operator_throttle',target:'main_fuel',input_min:0,input_max:1,output_min:(level===2?e.fuel_min_pct:e.fuel_idle_pct)/100,output_max:e.fuel_max_pct/100,target_source_type:0,target_fixed:e.n2_target_rpm,response_gain:.00001,integral_gain:.000001,deadband:250,off_value:0,activate_events:4,deactivate_events:24,mode_mask:4}];
  Object.assign(s.engine,{rpm_limit:e.n1_trip_rpm,n2_rpm_limit:e.n2_trip_rpm,tot_limit:e.tot_trip_c,tot_safe_margin:50,tot_cooldown_target:e.tot_cooldown_c,min_rpm:18000});
  Object.assign(s.safety,{egt_source:1,p1_trip_bar:e.p1_trip_bar,p1_trip_enabled:level>=2,p1_trip_confirm_ms:500,oil_pressure_modes:4,low_oil_confirm_ms:e.oil_confirm_ms});
  Object.assign(s.oil,{startup_pressure:e.oil_target_bar,startup_min_bar:e.oil_min_bar,running_min:e.oil_min_bar,map_min:e.oil_target_bar,map_max:e.oil_target_bar});
  Object.assign(s.throttle,{fuel_pump_min_pct:e.fuel_min_pct,idle_max_pct:e.fuel_idle_ceiling_pct,pullback_p1:level>=2,pullback_p1_mode:0,pullback_p1_soft_bar:e.p1_soft_bar,pullback_p1_hard_bar:e.p1_full_reduction_bar,pullback_egt:level>=2,pullback_egt_mode:0,pullback_egt_soft_c:e.tot_soft_c,pullback_egt_hard_c:e.tot_full_reduction_c});
  Object.assign(s.dynamic_idle,{fuel_mode:level===2?4:1,source:0,target_rpm:e.n1_idle_rpm,rpm_limit:e.n1_idle_cutoff_rpm,deadband_rpm:e.n1_idle_deadband_rpm,max_multiplier:1,idle_mode:0});
  Object.assign(s.sequence.startup,{startup_oil_demand:e.oil_target_bar,oil_arm_min_bar:e.oil_min_bar,oil_startup_min_bar:e.oil_min_bar,oil_arm_timeout_ms:e.prime_timeout_ms,pre_ign_rpm:e.n1_crank_rpm,starter_demand:e.starter_pct/100,ramp_pct_per_s:e.starter_ramp_pct_s,starter_timeout_ms:e.crank_timeout_ms,temp_confirm_target:e.tot_lightoff_c,temp_confirm_timeout:e.lightoff_timeout_ms,safety_hold_ms:e.stable_ms,safety_hold_timeout_ms:e.stable_timeout_ms,final_check_n1_enabled:true,final_check_rpm:e.n1_final_min_rpm,final_check_oil_enabled:true,final_check_egt_enabled:true,final_check_egt_c:e.tot_lightoff_c,safety_turn_off_starter:false,safety_turn_off_igniter:false,startup_egt_guard_enabled:level>=2,startup_egt_immediate_enabled:true,startup_egt_dwell_enabled:true,startup_egt_limit_c:e.tot_start_trip_c,startup_egt_dwell_c:e.tot_start_dwell_c,startup_egt_dwell_ms:e.tot_start_dwell_ms,pre_start_egt_limit_c:e.tot_prestart_c});
  Object.assign(s.sequence.shutdown,{cooldown_use_starter:false,cooldown_use_oil:true,cooldown_oil_pressure_bar:e.oil_target_bar,cooldown_target_tot:e.tot_cooldown_c});
  s.starter_control||={};Object.assign(s.starter_control,{pulsed_assist_enabled:false,startup_ramp_pct_per_s:e.starter_ramp_pct_s});
  Object.assign(s.calibration,{throttle_min_raw:0,throttle_max_raw:4095});s.relight.enabled=false;
  if(workshops){
    Object.assign(input('oil_temperature'),{temp_interface:5,pin:7,temp_resolution:12});Object.assign(h.sensors.oil_temp,{enabled:true,chip:'ds18b20',pin:7,resolution:12});
    Object.assign(input('battery_voltage'),{name:'Battery Voltage',analog_divider:80/12,max:Math.round(2400/3300*4095)});
    Object.assign(input('torque_main'),{driver:2,pin:41,torque_interface:2,phase_pin:42,pulses_per_unit:1,phase_pulses_per_unit:1,phase_speed_source:0,phase_zero_deg:0,phase_deg_per_nm:.01,filter_alpha:.25});
    Object.assign(output('oil_pump'),{has_current:true,current_pin:5,current_mv_a:2000,current_zero_v:0,current_max_a:0});
    Object.assign(h.actuators.oil_pump,{has_current:true,current_pin:5,current_mv_a:2000,current_zero_v:0,current_max_a:0});
    h.channel_registry.inputs.push({id:'cover_switch',name:'Cover closed',purpose:'digital_switch',role:'digital_switch',driver:0,pin:35,active_high:false,pullup:true,min:0,max:1},{id:'light_knob',name:'Brightness knob',purpose:'generic',role:'generic',driver:1,pin:8,min:0,max:4095,analog_zero_mv:0,analog_mv_per_unit:3300});
    h.channel_registry.outputs.push({id:'bench_light',name:'Bench light',purpose:'generic',role:'generic',driver:5,pin:38,min:0,max:1,pwm_freq_hz:1000,pwm_res_bits:10,safe_demand:0,boot_safe_demand:0});
    s.rules.push({controller_id:2,enabled:true,name:'Brightness control',kind:1,source:'light_knob',target:'bench_light',input_min:0,input_max:1,output_min:0,output_max:1,activate_events:16,deactivate_events:14,mode_mask:1},{controller_id:3,enabled:true,name:'Bench cooling fan',kind:0,source:'oil_temperature',target:'cooling_fan',op:0,threshold:30,hysteresis:2,on_value:1,off_value:0,activate_events:16,deactivate_events:14,mode_mask:1});
  }
  return state;
}
module.exports={guidedFixture,example};
