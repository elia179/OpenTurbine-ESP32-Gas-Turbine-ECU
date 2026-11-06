"""Reconcile the final native PCB pin nets with the DRV8350 firmware contract.

Read-only file audit; it does not measure copper, timing, current or temperature.
The resolved inventory must match each audited component's native device binding
and pad nets before its inherited part/value attributes are used.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

from import_openturbine_pcb import EXPECTED_SOURCE_SHA256, components, make_profile

ROOT = Path(__file__).resolve().parents[1]


def audit(source, inventory):
    parts = components(source)
    resolved = {c['attrs']['Designator']: c for c in
                json.loads(inventory.read_text(encoding='utf-8')).values()}
    checks = []

    def check(name, ok):
        checks.append({'check': name, 'passed': bool(ok)})
        if not ok:
            raise ValueError(name)

    check('Exact final source SHA256', hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED_SOURCE_SHA256)

    def attrs(ref):
        current, saved = parts[ref], resolved[ref]
        check(ref + ' resolved inventory device identity', current['attributes'].get('Device') == saved['attrs'].get('Device'))
        check(ref + ' resolved inventory connected pad nets',
              {k: v for k, v in current['pads'].items() if v} == saved['nets'])
        for key in ('Value', 'Manufacturer Part', 'Supplier Part'):
            if key in current['attributes']:
                check(ref + ' native ' + key, current['attributes'][key] == saved['attrs'].get(key))
        return saved['attrs']

    def nets(ref, expected):
        check(ref + ' pin/net contract', parts[ref]['pads'] == expected)

    def passive(ref, expected, value):
        nets(ref, expected)
        check(ref + ' fitted value', attrs(ref).get('Value') == value)

    passive('R82', {'1':'GPIO46_EXT','2':'GND'}, '10k 1%')
    passive('R79', {'1':'+3V3','2':'GPIO47_EXT'}, '10k 1%')

    for group in (1, 2):
        ref = 'U' + str(group + 4)
        check(ref + ' SPI driver variant', attrs(ref)['Manufacturer Part'] == 'DRV8350SRTVR')
        expected = {'1': f'DRV{group}_CPH', '2': '+15V_GATE', '3': 'VIN_BAT',
                    '4': f'DRV{group}_VCP', '8': 'GND', '9': 'GND', '16': 'GND',
                    '17': f'DRV{group}_FAULT_N', '18': 'SPI_MISO', '19': 'SPI_MOSI',
                    '20': 'SPI_SCK', '21': f'DRV{group}_CS_N', '22': 'DRV_ENABLE',
                    '29': f'DRV{group}_DVDD', '30': 'GND', '31': f'DRV{group}_VGLS',
                    '32': f'DRV{group}_CPL', '33': 'GND'}
        for phase, (gh, sh, gl, inh, inl) in enumerate(((5, 6, 7, 23, 24), (12, 11, 10, 25, 26), (13, 14, 15, 27, 28))):
            ch = (group - 1) * 3 + phase + 1
            expected.update({str(gh): f'GH{ch}', str(sh): f'CH{ch}_OUT_POS',
                             str(gl): f'GL{ch}', str(inh): f'PWM_CMD{ch}', str(inl): f'INL{ch}'})
        nets(ref, expected)
        for refc, endpoints, value in (
            (f'C210{group}', {f'DRV{group}_CPH', f'DRV{group}_CPL'}, '47nF'),
            (f'C211{group}', {f'DRV{group}_VCP', 'VIN_BAT'}, '1u 50V X5R'),
            (f'C212{group}', {f'DRV{group}_VGLS', 'GND'}, '1u 50V X5R'),
            (f'C213{group}', {f'DRV{group}_DVDD', 'GND'}, '1u 50V X5R')):
            check(refc + ' capacitor endpoints', set(parts[refc]['pads'].values()) == endpoints)
            check(refc + ' capacitor value', attrs(refc)['Value'] == value)

    for ch in range(1, 7):
        high, low = f'Q{ch+4}', f'Q{ch+100}'
        nets(high, {'1': f'CH{ch}_HG', '2': f'CH{ch}_OUT_POS', '3': 'VIN_BAT'})
        nets(low, {'1': f'CH{ch}_LG', '2': 'GND', '3': f'CH{ch}_OUT_POS'})
        for ref in (high, low):
            check(ref + ' TOLL MOSFET part', attrs(ref)['Manufacturer Part'] == 'MX10T01AHTL')
        passive(f'R{42+(ch-1)*5}', {'1': f'GH{ch}', '2': f'CH{ch}_HG'}, '10 1%')
        passive(f'R{2000+ch}', {'1': f'GL{ch}', '2': f'CH{ch}_LG'}, '10 1%')
        passive(f'R{46+(ch-1)*5}', {'1': f'PWM_RAW{ch}', '2': f'PWM_CMD{ch}'}, '2.2k 1%')
        nets(f'J{2*ch+1}', {'+': f'CH{ch}_OUT_POS', '-': 'GND'})
        nets(f'J{2*ch+2}', {'1': f'CH{ch}_DISABLE_N', '2': 'GND'})
        nets(f'Q{2100+ch}', {'1': f'CH{ch}_DISABLE_N', '2': '+3V3', '3': f'CH{ch}_DIS_BASE_FEED'})
        nets(f'Q{2110+ch}', {'1': f'CH{ch}_DIS_B', '2': 'GND', '3': f'PWM_CMD{ch}'})

    nets('U2001', {'1': '+3V3', '2': 'GND', '3': 'GND', '4': 'DRV1_CS_N',
                   '5': 'DRV2_CS_N', '6': 'INL1', '7': 'INL2', '8': 'GND',
                   '9': 'INL3', '10': 'INL4', '11': 'INL5', '12': 'INL6',
                   '13': '', '14': 'I2C_SCL', '15': 'I2C_SDA', '16': '+3V3'})
    passive('R2130', {'1': '+3V3', '2': 'SPI_MISO'}, '4.7k 1%')
    for ref, net in (('R2211', 'SPI_SCK'), ('R2212', 'SPI_MOSI')):
        passive(ref, {'1': net+'_MCU', '2': net}, '47 1%')
    for ref, net in (('R72', 'I2C_SDA'), ('R73', 'I2C_SCL')):
        passive(ref, {'1': '+3V3', '2': net}, '1.8k 1%')
    profile = make_profile(parts)
    check('Whole generated software profile', profile == json.loads(
        (ROOT/'pcb_profiles/official/openturbine-s3-20261102.otpcb.json').read_text(encoding='utf-8')))
    text = (ROOT/'src/hal/actuators/Drv8350Protocol.h').read_text(encoding='utf-8')
    regs = {name: int(re.search(r'\b'+name+r'\s*=\s*(0x[0-9a-fA-F]+)', text)[1], 16)
            for name in ('control', 'gateHS', 'gateHSLocked', 'gateLS', 'ocp')}
    check('3x PWM, per-half-bridge OCP, thermal report, GDUV/GDF enabled', regs['control'] == 0x0A0)
    check('HS 50/100 mA, unlock then configuration lock', regs['gateHS'] == 0x300 and regs['gateHSLocked'] == 0x600)
    check('LS 50/100 mA, 4 us TDRIVE, no CBC retry', regs['gateLS'] == 0x300)
    check('400 ns dead time, latched OCP, 4 us deglitch, second-lowest 70 mV', regs['ocp'] == 0x321)
    return {'source_sha256': EXPECTED_SOURCE_SHA256, 'checks': checks,
            'passed': True, 'registers': {k: f'0x{v:03X}' for k, v in regs.items()},
            'physical_disable_behavior': 'External disable clamps INH low, not INL. If INL=1, low-side ON/braking; software OFF uses INL=0/Hi-Z.',
            'scope': 'File/datasheet reconciliation only; no physical electrical or thermal qualification.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('inventory', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit(args.source, args.inventory)
    args.output.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(f"PASS {len(result['checks'])} PCB wiring/driver contract checks")
