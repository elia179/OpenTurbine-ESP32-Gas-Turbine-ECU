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

EXPECTED_SOURCE_SHA256='e3b5d7a43a73c9dabf93fa2271849bcefa8bc327156b16c4f1a752bba0f073c4'


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
    for ref,net in [('R2211','SPI_SCK'),('R2212','SPI_MOSI')]:
        check(ref,1,net+'_MCU');check(ref,2,net)
    check('U18',1,'+5V_MAIN');check('U18',2,'GND');check('U18',22,'PULSE_OE_N');check('U18',23,'+3V3');check('U18',24,'+3V3')
    check('U8', 11, '')  # Floating ADDR is 0x10 per TI address-selection table.
    for pad in (1,2,3): check('U17', pad, 'GND')
    for ref,channel in [('U20',1),('U21',2)]: check(ref,9,'TC_CS' if channel==1 else 'TC2_CS')
    for ref,offset in [('U5',0),('U6',3)]:
        for pin,net in [(18,'SPI_MISO'),(19,'SPI_MOSI'),(20,'SPI_SCK'),(21,'DRV1_CS_N' if not offset else 'DRV2_CS_N'),(22,'DRV_ENABLE')]: check(ref,pin,net)
        for i in range(3):
            check(ref,23+2*i,f'PWM_CMD{offset+i+1}');check(ref,24+2*i,f'INL{offset+i+1}')
    for pin,net in zip([4,5,6,7,9,10,11,12],['DRV1_CS_N','DRV2_CS_N']+[f'INL{i}' for i in range(1,7)]):check('U2001',pin,net)
    for pin,net in [(1,'+3V3'),(2,'GND'),(3,'GND')]:check('U2001',pin,net)
    profile = {
        'format':'openturbine-pcb-profile', 'format_version':{'major':2,'minor':0},
        'board':{'id':'openturbine-s3-20261102','name':'OpenTurbine PCB v1.0','revision':'1.0-20261108','manufacturer':'OpenTurbine','description':'4 Nov 2026 PCB; ESP32-S3-WROOM-1-N8R2; OpenTurbine 2.7.1 required'},
        'target':{'chip':'esp32-s3','minimum_flash_mb':8,'reviewed_strapping_gpio':[3,45,46]},
        'buses':[
            {'id':'sensor_i2c','kind':'i2c','pins':{'sda':gpio('I2C_SDA'),'scl':gpio('I2C_SCL')},'frequency_hz':100000},
            {'id':'thermocouple_spi','kind':'spi','pins':{'sck':gpio('SPI_SCK_MCU'),'miso':gpio('SPI_MISO'),'mosi':gpio('SPI_MOSI_MCU')}},
            {'id':'serial_0','kind':'uart','pins':{'tx':gpio('UART_TX'),'rx':gpio('UART_RX')}}],
        'devices':[
            {'id':'tc1','driver':'max31856','bus':'thermocouple_spi','select':{'gpio':gpio('TC_CS')},'expected':True},
            {'id':'tc2','driver':'max31856','bus':'thermocouple_spi','select':{'gpio':gpio('TC2_CS')},'expected':True},
            {'id':'adc','driver':'tla2528','bus':'sensor_i2c','address':16,'expected':True},
            {'id':'io','driver':'tca9534','bus':'sensor_i2c','address':32,'expected':True},
            {'id':'gate_io','driver':'tca9534','bus':'sensor_i2c','address':33,'expected':True}],
        'fixed_functions':{
            'output_enable':{'gpio':gpio('OUTPUT_ENABLE'),'active_high':True,'safe_demand':0,'mode':'health_heartbeat','frequency_hz':100},
            'power_stage':{'driver':'drv8350s','control_device':'gate_io','spi_bus':'thermocouple_spi','inh_gpio':[gpio(f'PWM_RAW{i}') for i in range(1,7)],'spi_hz':100000,'maximum_pwm_hz':20000},
            'supply_voltage':{'gpio':gpio('BAT_ADC_MCU'),'divider':37,'reference_mv':3300,'label':'ECU supply voltage'},
            'mavlink':{'bus':'serial_0'}}, 'ports':[]}
    ports = profile['ports']
    for i in (1,2):
        ports.append({'id':f'thermocouple_{i}','label':f'Thermocouple {i}','connector':f'J{42+i}','description':'MAX31856 thermocouple input; use an ungrounded probe of the selected alloy','modes':[{'id':'temperature','adapter':'spi_thermocouple','device':f'tc{i}'}]})
    for i in range(1,9):
        check(f'J{19+i}',1,f'ANALOG_EXT{i}')
        ports.append({'id':f'analog_{i}','label':f'ADC {i}','connector':f'J{19+i}','description':'0–5 V input via 1 kΩ; ADC reference is the 5 V analog rail','modes':[
            {'id':'analog','adapter':'i2c_adc_input','device':'adc','channel':i-1,'reference_mv':5000,'limits':{'minimum_mv':0,'maximum_mv':5000}},
            {'id':'switch','adapter':'i2c_adc_digital_input','device':'adc','channel':i-1,'reference_mv':5000}]})
    for i in range(1,7):
        check(f'J{27+i}',1,f'PULSE_EXT{i}')
        check('U17', [4,5,6,7,9,10][i-1],f'PULSE_PU_CTL{i}')
        ports.append({'id':f'pulse_in_{i}','label':f'IN {i} Connector','connector':f'J{27+i}','description':'Conditioned input; switchable external 3.3 V pull-up','modes':[
            {'id':kind,'adapter':adapter,'endpoint':{'gpio':gpio(f'PULSE_IN{i}')},'pull':'none','pull_control':{'device':'io','channel':i-1,'active_high':False}}
            for kind,adapter in [('frequency','pcnt_input'),('rc','rc_pwm_input'),('duty','pwm_duty_input'),('switch','digital_input')]]})
    for i in range(1,7):
        check(f'J{33+i}',1,f'PULSE_OUT{i}')
        check(f'J{2*i+1}','+',f'CH{i}_OUT_POS');check(f'J{2*i+1}','-','GND')
        ports.append({'id':f'pulse_out_{i}','label':f'OUT {i} Connector','connector':f'J{33+i}','description':'5 V signal: servo/ESC, PWM duty or on/off. Not a load-power output.','modes':[{'id':kind,'adapter':adapter,'endpoint':{'gpio':gpio(f'PULSE_CMD{i}')},'safe_demand':0} for kind,adapter in [('servo','servo_output'),('pwm','pwm_output'),('on_off','relay_output')]]})
        ports.append({'id':f'power_out_{i}','label':f'PWM {i} Connector','connector':f'J{2*i+1}','description':'Switched VIN positive; synchronous PWM/on-off, 20 kHz maximum','modes':[
            {'id':kind,'adapter':adapter,'endpoint':{'gpio':gpio(f'PWM_RAW{i}')},'safe_demand':0}
            for kind,adapter in [('on_off','relay_output'),('pwm','pwm_output')]]})
    for name,pin in [('start',17),('stop',48)]:
        ports.append({'id':f'{name}_switch','label':name.title()+' Connector','connector':'J_'+name.upper(),'description':'3.3 V GPIO switch input; contact to GND, default active-low with pull-up','modes':[{'id':'switch','adapter':'digital_input','endpoint':{'gpio':pin},'active_high':False,'pull':'up','default':{'id':name+'_switch','name':name.title()+' switch','role':'digital_switch','purpose':name+'_switch'}}]})
    for channel,purpose,label in [(6,'status_led','Status LED'),(7,'fault_led','Fault LED')]:
        ports.append({'id':purpose,'label':label+' Connector','description':'Onboard low-current LED; on/off control only','modes':[
            {'id':'on_off','adapter':'i2c_digital_output','device':'io','channel':channel,'active_high':False,'safe_demand':0,
             'default':{'id':purpose,'name':label,'role':'indicator','purpose':purpose}}]})
    for pin in (46,47):
        ports.append({'id':f'extension_{pin}','label':f'GPIO {pin}','connector':'J18','modes':[{'id':'input','adapter':'digital_input','endpoint':{'gpio':pin}}]})
    for pad,net in [(3,'GPIO47_EXT'),(4,'GPIO46_EXT'),(5,'GPIO17_START'),(6,'GPIO48_STOP')]:check('J18',pad,net)
    profile['gpio_headers']=[17,48,46,47]
    check('R82',1,'GPIO46_EXT');check('R82',2,'GND')
    check('R79',1,'+3V3');check('R79',2,'GPIO47_EXT')
    profile['gpio_header_notes']={'46':'Fixed 10 kΩ pull-down to GND; software cannot remove it.','47':'Fixed 10 kΩ pull-up to 3.3 V; software cannot remove it.'}
    for port in ports:
        if port['id'].startswith(('thermocouple_','analog_')):port['label']+=' Connector'
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
