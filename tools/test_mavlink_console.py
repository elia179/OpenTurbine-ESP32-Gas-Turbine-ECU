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
    def test_ardupilot_selection_loss_and_reboot_require_explicit_reselection(self):
        clock = types.SimpleNamespace(step=0)
        encoder = dialect.MAVLink(None, srcSystem=1, srcComponent=200)
        samples, forwarded, requests = [], [], []
        decoder = dialect.MAVLink(None)

        class Port:
            @property
            def in_waiting(self):
                boot = 124 if clock.step >= 24 else 123
                self.incoming = bytearray(dialect.MAVLink_ot_link_info_message(boot, 1, 31, 0, 500, 100, b'Test ECU').pack(encoder))
                self.incoming.extend(dialect.MAVLink_ot_engine_state_message(boot, 1000 + clock.step * 100, 3, 4, 0, 0, 0, 0, 0, 0, b'', b'', b'').pack(encoder))
                self.incoming.extend(dialect.MAVLink_heartbeat_message(0, 8, 0, 0, 4, 3).pack(encoder))
                return len(self.incoming)
            def read(self, count): return bytes(self.incoming[:count])
            def write(self, data):
                for message in decoder.parse_buffer(data) or []:
                    if message.get_type() == 'OT_REMOTE_INPUT': samples.append((clock.step, message.value, message.boot_id))
                return len(data)
            def __enter__(self): return self
            def __exit__(self, *_): pass

        class Message(types.SimpleNamespace):
            def get_srcSystem(self): return getattr(self, 'system', 1)
            def get_srcComponent(self): return getattr(self, 'component', 1)
            def get_type(self): return self.kind

        class Autopilot:
            tick = -1
            messages = []
            mav = types.SimpleNamespace(command_long_send=lambda *args: requests.append(args))
            def recv_match(self, **_):
                if self.tick != clock.step:
                    self.tick = clock.step
                    self.messages = [] if 16 <= clock.step <= 20 else [
                        Message(kind='HEARTBEAT', base_mode=0 if clock.step == 6 else 128, system_status=4),
                        Message(kind='SERVO_OUTPUT_RAW', port=0, servo3_raw=2500 if clock.step == 11 else 1750)]
                    if clock.step == 5:
                        self.messages += [Message(kind='SERVO_OUTPUT_RAW', system=2, port=0, servo3_raw=1200),
                            Message(kind='SERVO_OUTPUT_RAW', component=190, port=0, servo3_raw=1300)]
                return self.messages.pop(0) if self.messages else None
            def write(self, data): forwarded.append(data)

        class Commands:
            def get_nowait(self):
                if clock.step in [3, 9, 14, 22]: return 'throttle ap'
                if clock.step == 26: return 'quit'
                raise console.queue.Empty

        def advance(_): clock.step += 1
        fake_mavutil = types.SimpleNamespace(mavlink_connection=lambda *_, **__: Autopilot(),
            mavlink=types.SimpleNamespace(MAV_CMD_SET_MESSAGE_INTERVAL=511))
        with patch.dict(sys.modules, {'serial':types.SimpleNamespace(Serial=lambda *_, **__: Port()),
                'pymavlink':types.SimpleNamespace(mavutil=fake_mavutil)}), \
             patch.object(sys, 'argv', ['console', 'FAKE', '--autopilot', 'AP']), \
             patch.object(sys, 'stdout', io.StringIO()), \
             patch.object(console.queue, 'Queue', lambda **_: Commands()), \
             patch.object(console.threading, 'Thread', lambda **_: types.SimpleNamespace(start=lambda:None)), \
             patch.object(console, 'time', types.SimpleNamespace(monotonic=lambda:100 + clock.step / 10, sleep=advance)):
            console.main()
        self.assertTrue(samples)
        self.assertTrue(all(abs(value - .75) < .0001 and boot == 123 for _, value, boot in samples))
        self.assertTrue(any(step in [4, 5] for step, _, _ in samples))
        self.assertTrue(any(step == 10 for step, _, _ in samples))
        self.assertTrue(any(step == 23 for step, _, _ in samples))
        self.assertFalse(any(step < 4 or 6 <= step <= 9 or 11 <= step <= 14 or 20 <= step <= 22 or step >= 24 for step, _, _ in samples))
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0][3:6], (0, 36, 100000))
        self.assertTrue(forwarded)
        self.assertTrue(all(message.get_type() == 'HEARTBEAT' for data in forwarded for message in dialect.MAVLink(None).parse_buffer(data)))

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
