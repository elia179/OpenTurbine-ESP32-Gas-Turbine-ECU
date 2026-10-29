"""Focused host protocol/service checks, without flashing a connected board."""
from pathlib import Path
import subprocess
import sys
from run_native_behavior_tests import compiler_command,compile_command,arduino_json_include,run_fresh_executable
ROOT=Path(__file__).resolve().parents[1]
compiler=compiler_command();include=arduino_json_include()
for name in ['mavlink_migration_behavior','mavlink_client_behavior','telemetry_catalog_behavior','mavlink_service_behavior']:
 for platform in (['ESP32'] if name in ['mavlink_migration_behavior','mavlink_client_behavior'] else ['ESP32','ESP32S3']):
  sources=[str(ROOT/'dev/host'/f'{name}.cpp')]
  if name not in ['mavlink_migration_behavior','mavlink_client_behavior']:sources.append(str(ROOT/'src/engine/EngineData.cpp'))
  if name=='mavlink_service_behavior':sources.append(str(ROOT/'src/system/CommandQueue.cpp'))
  exe=ROOT/'artifacts'/f'{name}_{platform}{".exe" if sys.platform=="win32" else ""}'
  subprocess.run(compile_command(compiler,['-std=c++17','-I',str(ROOT),'-I',str(ROOT/'dev/host/fakes'),'-I',str(include),'-DOT_PLATFORM_'+platform,*sources,'-o',str(exe)]),check=True)
  run_fresh_executable([str(exe)],cwd=ROOT,label=name+' '+platform)
subprocess.run([sys.executable,str(ROOT/'tools/test_mavlink_interop.py')],cwd=ROOT,check=True)
