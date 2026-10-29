"""Generate checked-in engine/receiver bindings using pymavlink==2.4.50.

Install the development dependency into artifacts/mavlink-generator, or provide
it on PYTHONPATH. Normal firmware builds do not run this generator.
Standard messages/enums are copied from the pinned package without wire changes.
"""
from pathlib import Path
import copy
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
import importlib.metadata

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'artifacts/mavlink-generator'))
import pymavlink
from pymavlink.generator import mavgen

def main():
    assert importlib.metadata.version('pymavlink')=='2.4.50'
    upstream=Path(pymavlink.__file__).parent/'message_definitions/v1.0'
    names=['minimal.xml','standard.xml','common.xml']
    wanted={'HEARTBEAT','COMMAND_LONG','COMMAND_ACK','EFI_STATUS','STATUSTEXT','NAMED_VALUE_FLOAT'}
    root=ET.Element('mavlink');ET.SubElement(root,'version').text='3'
    enums=ET.SubElement(root,'enums');messages=ET.SubElement(root,'messages')
    seen={};found=set();hashes={}
    for name in names:
        source=(upstream/name).read_bytes();hashes[name]=hashlib.sha256(source).hexdigest()
        parsed=ET.fromstring(source)
        for enum in parsed.findall('./enums/enum'):
            if enum.attrib['name'] not in seen:
                seen[enum.attrib['name']]=copy.deepcopy(enum);enums.append(seen[enum.attrib['name']])
            else:
                dest=seen[enum.attrib['name']];existing={e.attrib.get('value') for e in dest.findall('entry')}
                for entry in enum.findall('entry'):
                    if entry.attrib['value'] not in existing:dest.append(copy.deepcopy(entry))
        for message in parsed.findall('./messages/message'):
            if message.attrib['name'] in wanted:
                messages.append(copy.deepcopy(message));found.add(message.attrib['name'])
    assert found==wanted
    private=ET.parse(ROOT/'protocol/openturbine.xml').findall('./messages/message')
    private_ids=[int(message.attrib['id']) for message in private]
    assert len(private_ids)==len(set(private_ids)), 'Duplicate private message IDs'
    for definition in upstream.glob('*.xml'):
        used={int(message.attrib['id']) for message in ET.parse(definition).findall('./messages/message')}
        assert not used.intersection(private_ids), f'Message ID collision in {definition.name}'

    path=ROOT/'protocol/openturbine_standard.xml'
    ET.indent(root);ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)
    hashes['openturbine.xml']=hashlib.sha256((ROOT/'protocol/openturbine.xml').read_bytes()).hexdigest()
    (ROOT/'protocol/generation.json').write_text(json.dumps({'generator':'pymavlink 2.4.50','input_sha256':hashes,'standard_messages':sorted(wanted)},indent=2)+'\n')
    output=ROOT/'libraries/OpenTurbineMavlink/src/protocol'
    opts=mavgen.Opts(str(output),wire_protocol='2.0',language='C',validate=True)
    assert mavgen.mavgen(opts,[str(ROOT/'protocol/openturbine.xml')])
    # Generator dates must not change checked-in output on an identical rebuild.
    for version in output.rglob('version.h'):
        text=version.read_text(encoding='utf-8')
        version.write_text(re.sub(r'#define MAVLINK_BUILD_DATE "[^"]*"', '#define MAVLINK_BUILD_DATE "pymavlink 2.4.50"', text),encoding='utf-8')
    # Independent Python receiver bindings for cross-decoder tests/integration.
    opts=mavgen.Opts(str(ROOT/'protocol/openturbine'),wire_protocol='2.0',language='Python3',validate=True)
    assert mavgen.mavgen(opts,[str(ROOT/'protocol/openturbine.xml')])

if __name__=='__main__':main()
