"""Explicit engine console / optional ArduPilot throttle companion.

Install pyserial. --autopilot additionally needs pymavlink. No command or
throttle is sent automatically. This is a development integration example.
"""
from pathlib import Path
import argparse
import math
import queue
import secrets
import sys
import threading
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'protocol'))
import openturbine as dialect


def main():
    import serial
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('port', help='ECU serial port, e.g. COM7 or /dev/ttyUSB0')
    parser.add_argument('--baud', type=int, default=115200)
    parser.add_argument('--system', type=int, default=255)
    parser.add_argument('--component', type=int, default=190)
    parser.add_argument('--ecu-system', type=int, default=1)
    parser.add_argument('--ecu-component', type=int, default=200)
    parser.add_argument('--autopilot', help='Optional ArduPilot serial/UDP endpoint')
    parser.add_argument('--autopilot-baud', type=int, default=115200)
    parser.add_argument('--autopilot-system', type=int, default=1)
    parser.add_argument('--servo', type=int, default=3, choices=range(1, 17))
    parser.add_argument('--pwm-min', type=int, default=1000)
    parser.add_argument('--pwm-max', type=int, default=2000)
    args = parser.parse_args()
    if args.pwm_min >= args.pwm_max:
        parser.error('--pwm-min must be lower than --pwm-max')
    if any(not 1 <= value <= 255 for value in [args.system, args.component, args.ecu_system, args.ecu_component]):
        parser.error('MAVLink IDs must be 1..255')
    ap = None
    if args.autopilot:
        from pymavlink import mavutil
        ap = mavutil.mavlink_connection(args.autopilot, baud=args.autopilot_baud, source_system=254, source_component=191)
    commands = queue.Queue(maxsize=16)

    def console():
        for line in sys.stdin:
            try:
                commands.put(line.strip().lower(), timeout=1)
            except queue.Full:
                print('Console busy; command was not queued.')
        commands.put('quit')

    threading.Thread(target=console, daemon=True).start()
    session = secrets.randbits(32) or 1
    request = sequence = 0
    link = state = None
    state_received = last_hb = last_throttle = last_print = 0
    ap_hb = ap_servo = 0
    requested_servo_stream = False
    ap_armed = False
    ap_value = None
    throttle = None
    pending = None
    operations = {'start': 1, 'stop': 2, 'ack': 3, 'ab on': 4, 'ab off': 5}
    with serial.Serial(args.port, args.baud, timeout=0, write_timeout=.2) as port:
        wire = dialect.MAVLink(port, srcSystem=args.system, srcComponent=args.component)
        wire.robust_parsing = True
        print('Commands: start, stop, ack, ab on, ab off, throttle 0..100, throttle ap, throttle off, quit')
        print('Remote commands default OFF on the ECU. Select MAVLink throttle explicitly in Controllers to use it.')
        while True:
            now = time.monotonic()
            for message in wire.parse_buffer(port.read(min(port.in_waiting, 4096))) or []:
                if (message.get_srcSystem(), message.get_srcComponent()) != (args.ecu_system, args.ecu_component):
                    continue
                kind = message.get_type()
                if ap and kind in ['EFI_STATUS','HEARTBEAT']:
                    ap.write(message.get_msgbuf())  # preserve ECU source IDs and standard CRC
                if kind == 'OT_LINK_INFO':
                    if link and link.boot_id != message.boot_id:
                        throttle = pending = state = None
                        print('ECU restarted: pending operation unconfirmed; throttle requires a new explicit selection.')
                    link = message
                elif kind == 'OT_ENGINE_STATE' and link and message.boot_id == link.boot_id:
                    if not state or 0 < ((message.time_boot_ms - state.time_boot_ms) & 0xffffffff) < 0x80000000:
                        state, state_received = message, now
                elif kind == 'OT_COMMAND_RESULT' and pending:
                    if (message.sender_session, message.request_id, message.operation, message.target_system, message.target_component) == (
                            session, pending[0].request_id, pending[0].operation, args.system, args.component):
                        print('ECU result:', message.result, message.reason)
                        if message.result != dialect.MAV_RESULT_IN_PROGRESS:
                            pending = None
            if now - last_hb >= 1:
                wire.heartbeat_send(dialect.MAV_TYPE_GCS, dialect.MAV_AUTOPILOT_INVALID, 0, 0, dialect.MAV_STATE_ACTIVE)
                last_hb = now
            fresh = bool(state and now - state_received < 3)
            if throttle is not None and not fresh:
                throttle = None
                print('ECU state stale: throttle stream stopped; reselect explicitly after reconnect.')
            ecu_time = (state.time_boot_ms + int((now - state_received) * 1000)) & 0xffffffff if fresh else 0
            if ap:
                # Bound per-loop work, even if the autopilot stream is busy.
                for _ in range(32):
                    message = ap.recv_match(blocking=False)
                    if message is None:
                        break
                    if message.get_srcSystem() != args.autopilot_system or message.get_srcComponent() != 1:
                        continue
                    if message.get_type() == 'HEARTBEAT':
                        ap_hb = now
                        if not requested_servo_stream:
                            ap.mav.command_long_send(args.autopilot_system,1,mavutil.mavlink.MAV_CMD_SET_MESSAGE_INTERVAL,0,36,100000,0,0,0,0,0)
                            requested_servo_stream = True
                        ap_armed = bool(message.base_mode & 128) and message.system_status == 4
                    elif message.get_type() == 'SERVO_OUTPUT_RAW' and message.port == 0:
                        pwm = getattr(message, f'servo{args.servo}_raw', 0)
                        if args.pwm_min <= pwm <= args.pwm_max:
                            ap_value = (pwm - args.pwm_min) / (args.pwm_max - args.pwm_min)
                            ap_servo = now
                        else:
                            ap_value = None
            ap_fresh = ap_value is not None and ap_armed and now - ap_hb < 2 and now - ap_servo < .3
            if throttle == 'ap' and not ap_fresh:
                throttle = None
                print('ArduPilot demand unavailable/disarmed/stale: stream stopped. Reselect throttle ap to resume.')
            if throttle is not None and fresh and now - last_throttle >= .1:
                sequence = (sequence + 1) & 0xffffffff
                wire.ot_remote_input_send(link.boot_id, ecu_time, session, sequence,
                    ap_value if throttle == 'ap' else throttle, 0, args.ecu_system, args.ecu_component)
                last_throttle = now
            if pending and now - pending[1] >= 1:
                if pending[2] >= 3:
                    print('Operation unconfirmed; inspect engine state. No automatic new Start.')
                    pending = None
                else:
                    wire.send(pending[0]); pending = (pending[0], now, pending[2] + 1)
            try:
                command = commands.get_nowait()
            except queue.Empty:
                command = ''
            if command == 'quit':
                return
            if command in operations:
                operation = operations[command]
                if pending and operation != 2:
                    print('Another request is pending; Stop remains available.')
                elif operation != 2 and not fresh:
                    print('Fresh ECU state is required.')
                else:
                    request += 1
                    message = dialect.MAVLink_ot_command_request_message(link.boot_id if link else 0,
                        ecu_time, session, request, operation, args.ecu_system, args.ecu_component)
                    wire.send(message); pending = (message, now, 1)
            elif command == 'throttle off':
                throttle = None
            elif command == 'throttle ap':
                if fresh and ap_fresh:
                    throttle = 'ap'
                else:
                    print('Requires fresh ECU state and a fresh armed ArduPilot output.')
            elif command.startswith('throttle '):
                try:
                    value = float(command[9:])
                    if not fresh or not math.isfinite(value) or not 0 <= value <= 100:
                        raise ValueError()
                    throttle = value / 100
                except ValueError:
                    print('Use throttle 0..100 with a fresh ECU connection, or throttle off.')
            if fresh and now - last_print >= 1:
                print(f'Engine mode {state.mode}; fault: {state.fault}; reason: {state.reason}; fuel command {state.fuel_demand:.1f}%')
                last_print = now
            time.sleep(.005)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        pass  # ending the stream causes normal ECU remote-input expiry
