#!/usr/bin/env python3
"""Extract this board's actual pad nets and create its reviewable PCB profile.

The EasyEDA project is input data, never executable instructions. No source
project is modified. Re-running on changed routing fails rather than guessing.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

EXPECTED_SOURCE_SHA256='29f260f731b2d72e9c8ff08bcb7c71bdce4a03e769cc2c65b509bc37a70b4eda'


def components(project):
    with zipfile.ZipFile(project) as archive:
        sources = [n for n in archive.namelist() if n.endswith('.epru')]
        if len(sources) != 1:
            raise ValueError('Expected one EasyEDA Pro document bundle')
        boards, current = [], None
        for line in archive.read(sources[0]).decode('utf-8').splitlines():
            if '||' not in line:
                continue
            header, value = line.removesuffix('|').split('||', 1)
            if not value.strip():
                continue
            header, value = json.loads(header), json.loads(value)
            if header['type'] == 'DOCHEAD':
                current = [] if value.get('docType') == 'PCB' else None
                if current is not None:
                    boards.append(current)
            if current is not None and header['type'] in {'COMPONENT', 'ATTR', 'PAD_NET'}:
                current.append((header, value))
    records = max(boards, key=len)
    found = {h['id']: {'attributes': {}, 'pads': {}} for h, v in records if h['type'] == 'COMPONENT'}
    for h, v in records:
        if h['type'] == 'ATTR' and v.get('parentId') in found:
            found[v['parentId']]['attributes'][v['key']] = v['value']
        if h['type'] == 'PAD_NET':
            _, component, number, *_ = json.loads(h['id'])
            if component in found and number:
                found[component]['pads'][number] = v['padNet']
    return {c['attributes'].get('Designator', key): c for key, c in found.items()}


def make_profile(parts):
    module_pins = {4:4,5:5,6:6,7:7,8:15,9:16,10:17,11:18,12:8,13:19,14:20,15:3,16:46,17:9,18:10,19:11,20:12,21:13,22:14,23:21,24:47,25:48,26:45,27:0,28:35,29:36,30:37,31:38,32:39,33:40,34:41,35:42,36:44,37:43,38:2,39:1}
    nets = {net: module_pins[int(pad)] for pad, net in parts['U13']['pads'].items() if int(pad) in module_pins}
    def gpio(net):
        return nets[net]
    def check(ref, pad, net):
        if parts[ref]['pads'].get(str(pad)) != net:
            raise ValueError(f'{ref} pad {pad}: expected {net}, got {parts[ref]["pads"].get(str(pad))}')
    check('U18',1,'+5V_MAIN');check('U18',2,'GND');check('U18',22,'PULSE_OE_N');check('U18',23,'+3V3');check('U18',24,'+3V3')
    check('U8', 11, '')  # Floating ADDR is 0x10 per TI address-selection table.
    for pad in (1,2,3): check('U17', pad, 'GND')
    for ref,channel in [('U20',1),('U21',2)]: check(ref,9,'TC_CS' if channel==1 else 'TC2_CS')
    profile = {
        'format':'openturbine-pcb-profile', 'format_version':{'major':1,'minor':1},
        'board':{'id':'openturbine-s3-20261028','name':'OpenTurbine PCB','revision':'1.0-20261028','manufacturer':'OpenTurbine','description':'28 Oct 2026; ESP32-S3-WROOM-1-N8; all parts fitted; OpenTurbine 2.6.1 required'},
        'target':{'chip':'esp32-s3','minimum_flash_mb':8,'reviewed_strapping_gpio':[3,45,46]},
        'buses':[
            {'id':'sensor_i2c','kind':'i2c','pins':{'sda':gpio('I2C_SDA'),'scl':gpio('I2C_SCL')},'frequency_hz':400000},
            {'id':'thermocouple_spi','kind':'spi','pins':{'sck':gpio('SPI_SCK'),'miso':gpio('SPI_MISO'),'mosi':gpio('SPI_MOSI')}},
            {'id':'serial_0','kind':'uart','pins':{'tx':gpio('UART_TX'),'rx':gpio('UART_RX')}}],
        'devices':[
            {'id':'tc1','driver':'max31856','bus':'thermocouple_spi','select':{'gpio':gpio('TC_CS')},'expected':True},
            {'id':'tc2','driver':'max31856','bus':'thermocouple_spi','select':{'gpio':gpio('TC2_CS')},'expected':True},
            {'id':'adc','driver':'tla2528','bus':'sensor_i2c','address':16,'expected':True},
            {'id':'io','driver':'tca9534','bus':'sensor_i2c','address':32,'expected':True}],
        'fixed_functions':{
            'status_led':{'device':'io','channel':6,'active_high':False,'safe_demand':0},
            'fault_led':{'device':'io','channel':7,'active_high':False,'safe_demand':0},
            'output_enable':{'gpio':gpio('OUTPUT_ENABLE'),'active_high':True,'safe_demand':0},
            'supply_voltage':{'gpio':gpio('BAT_ADC_MCU'),'divider':37,'reference_mv':3300,'label':'ECU supply voltage'},
            'mavlink':{'bus':'serial_0'}}, 'ports':[]}
    ports = profile['ports']
    for i in (1,2):
        ports.append({'id':f'thermocouple_{i}','label':f'Thermocouple {i}','connector':f'J{42+i}','modes':[{'id':'temperature','adapter':'spi_thermocouple','device':f'tc{i}'}]})
    for i in range(1,9):
        check(f'J{19+i}',1,f'ANALOG_EXT{i}')
        ports.append({'id':f'analog_{i}','label':f'ADC {i}','connector':f'J{19+i}','description':'0–5 V input via 1 kΩ; ADC reference is the 5 V analog rail','modes':[
            {'id':'analog','adapter':'i2c_adc_input','device':'adc','channel':i-1,'reference_mv':5000,'limits':{'minimum_mv':0,'maximum_mv':5000}},
            {'id':'switch','adapter':'i2c_adc_digital_input','device':'adc','channel':i-1,'reference_mv':5000}]})
    for i in range(1,7):
        check(f'J{27+i}',1,f'PULSE_EXT{i}')
        check('U17', [4,5,6,7,9,10][i-1],f'PULSE_PU_CTL{i}')
        ports.append({'id':f'pulse_in_{i}','label':f'Input {i}','connector':f'J{27+i}','description':'Conditioned input; switchable external 3.3 V pull-up','modes':[
            {'id':kind,'adapter':adapter,'endpoint':{'gpio':gpio(f'PULSE_IN{i}')},'pull':'none','pull_control':{'device':'io','channel':i-1,'active_high':False}}
            for kind,adapter in [('frequency','pcnt_input'),('rc','rc_pwm_input'),('duty','pwm_duty_input'),('switch','digital_input')]]})
    for i in range(1,7):
        check(f'J{33+i}',1,f'PULSE_OUT{i}')
        ports.append({'id':f'pulse_out_{i}','label':f'OUT {i}','connector':f'J{33+i}','description':'5 V signal: servo/ESC, PWM duty or on/off. Not a load-power output.','modes':[{'id':kind,'adapter':adapter,'endpoint':{'gpio':gpio(f'PULSE_CMD{i}')},'safe_demand':0} for kind,adapter in [('servo','servo_output'),('pwm','pwm_output'),('on_off','relay_output')]]})
        ports.append({'id':f'power_out_{i}','label':f'PWM {i}','connector':f'J{2*i+1}','description':'Low-side VIN load: PWM duty or on/off; shared hardware output enable','modes':[
            {'id':kind,'adapter':adapter,'endpoint':{'gpio':gpio(f'PWM_RAW{i}')},'safe_demand':0}
            for kind,adapter in [('on_off','relay_output'),('pwm','pwm_output')]]})
    for name,pin in [('start',17),('stop',48)]:
        ports.append({'id':f'{name}_switch','label':name.title(),'connector':'J_'+name.upper(),'modes':[{'id':'switch','adapter':'digital_input','endpoint':{'gpio':pin},'active_high':False,'pull':'up','default':{'id':f'{name}_switch','name':name.title()+' Switch','role':'digital_switch','purpose':f'{name}_switch'}}]})
    for pin in (46,47):
        ports.append({'id':f'extension_{pin}','label':f'Extension GPIO{pin}','connector':'J18','modes':[{'id':'input','adapter':'digital_input','endpoint':{'gpio':pin}}]})
    return profile


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    digest=hashlib.sha256(args.project.read_bytes()).hexdigest()
    if digest!=EXPECTED_SOURCE_SHA256:
        raise ValueError('Different PCB export: review routing, fitted components and the profile revision before changing this importer')
    parts=components(args.project)
    profile=make_profile(parts)
    args.output.write_text(json.dumps(profile,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Wrote {args.output}; source SHA256 {digest}')


if __name__=='__main__': main()
