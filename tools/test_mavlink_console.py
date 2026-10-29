"""Run the companion console against an in-memory ECU transport, no hardware."""
import importlib.util
import io
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'protocol'))
import openturbine as dialect
spec=importlib.util.spec_from_file_location('engine_console',ROOT/'examples/mavlink/engine_console.py')
console=importlib.util.module_from_spec(spec)
spec.loader.exec_module(console)


class ConsoleTest(unittest.TestCase):
    def test_explicit_start_then_stop_and_no_automatic_throttle(self):
        encoder=dialect.MAVLink(None,srcSystem=1,srcComponent=200)
        incoming=bytearray(dialect.MAVLink_ot_link_info_message(123,1,31,0,500,100,b'Test ECU').pack(encoder))
        incoming.extend(dialect.MAVLink_ot_engine_state_message(123,1000,3,4,0,0,0,0,0,0,b'',b'',b'').pack(encoder))

        class Port:
            outgoing=bytearray()
            @property
            def in_waiting(self):return len(incoming)
            def read(self,count):result=bytes(incoming[:count]);del incoming[:count];return result
            def write(self,data):self.outgoing.extend(data);return len(data)
            def __enter__(self):return self
            def __exit__(self,*_):pass

        port=Port()
        with patch.dict(sys.modules,{'serial':types.SimpleNamespace(Serial=lambda *_,**__:port)}), \
             patch.object(sys,'argv',['console','FAKE']), \
             patch.object(sys,'stdin',io.StringIO('start\nstop\nquit\n')), \
             patch.object(sys,'stdout',io.StringIO()):
            console.main()
        messages=dialect.MAVLink(None).parse_buffer(port.outgoing)
        operations=[message for message in messages if message.get_type()=='OT_COMMAND_REQUEST']
        self.assertEqual([message.operation for message in operations],[1,2])
        self.assertTrue(all(message.boot_id==123 and message.target_system==1 and message.target_component==200 for message in operations))
        self.assertEqual(operations[1].request_id,operations[0].request_id+1)
        self.assertFalse(any(message.get_type()=='OT_REMOTE_INPUT' for message in messages))


if __name__=='__main__':unittest.main()
