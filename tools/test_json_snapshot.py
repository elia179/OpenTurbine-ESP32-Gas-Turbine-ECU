"""Execute the production snapshot ownership helper with pinned ArduinoJson."""
from pathlib import Path
import subprocess
from run_native_behavior_tests import compiler_command, compile_command, run_fresh_executable


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    headers = root / ".pio/libdeps/esp32s3dev/ArduinoJson/src"
    if not headers.is_dir():
        raise SystemExit("Build esp32s3dev first to install the pinned ArduinoJson headers")
    output = root / "artifacts/json_snapshot_behavior.exe"
    output.parent.mkdir(exist_ok=True)
    flags = ["-std=c++17", "-pthread", "-I"+str(root), "-I"+str(root / "dev/host/fakes/network"), "-I"+str(headers),
             str(root / "dev/host/json_snapshot_behavior.cpp"), "-o", str(output)]
    subprocess.run(compile_command(compiler_command(), flags), cwd=root, check=True)
    run_fresh_executable([str(output)], cwd=root, label="JSON snapshot ownership")
    print("PASS: delayed/moved snapshots own nested text, including empty strings, and serialize completely")


if __name__ == "__main__":
    main()
