"""Independent upstream decoder check; requires the pinned generator dependency."""
import importlib.util
from pathlib import Path
import sys
import math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'artifacts/mavlink-generator'))
from pymavlink.dialects.v20 import common
spec=importlib.util.spec_from_file_location('openturbine',ROOT/'protocol/openturbine.py')
ot=importlib.util.module_from_spec(spec);spec.loader.exec_module(ot)
frames=common.MAVLink(None).parse_buffer((ROOT/'artifacts/mavlink-standard-golden.bin').read_bytes())
assert [m.get_type() for m in frames]==['HEARTBEAT','EFI_STATUS']
assert frames[1].rpm==60000 and frames[1].exhaust_gas_temperature==650 and frames[1].fuel_flow==250
writer=ot.MAVLink(None,srcSystem=255,srcComponent=190)
for message in [
 ot.MAVLink_ot_remote_input_message(0x12345678,1234,55,3,.5,0,1,200),
 ot.MAVLink_ot_command_request_message(0x12345678,1234,55,3,1,1,200),
]:
 packet=message.pack(writer);decoded=ot.MAVLink(None).parse_buffer(packet)
 assert len(decoded)==1 and decoded[0].to_dict()==message.to_dict()
print('Upstream common decoder accepts standard heartbeat/EFI frames; generated Python dialect round-trips timestamped remote input and commands.')

frames=ot.MAVLink(None).parse_buffer((ROOT/'artifacts/mavlink-service-golden.bin').read_bytes())
assert not any(message.get_type()=='BAD_DATA' for message in frames)
heartbeats=[message for message in frames if message.get_type()=='HEARTBEAT']
assert heartbeats and all(message.mavlink_version==3 for message in heartbeats)
efi=[message for message in frames if message.get_type()=='EFI_STATUS'][-1]
assert efi.rpm==60000 and efi.exhaust_gas_temperature==650 and efi.fuel_flow==250
# The production ECU encoder must also match the unmodified common dialect.
standard=common.MAVLink(None).parse_buffer(efi.get_msgbuf())
assert len(standard)==1
for key,value in efi.to_dict().items():
    other=standard[0].to_dict()[key]
    assert (isinstance(value,float) and math.isnan(value) and math.isnan(other)) or value==other,(key,value,other)
print('Actual ECU compact encoder independently decodes: valid heartbeat version, EFI units, and custom command/state frames.')
