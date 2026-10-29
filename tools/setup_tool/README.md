# OpenTurbine Setup Tool

The 2.6.1 implementation shows final reconnect/identity/file-verification progress, retries transient reads and offers verification-only retry after uploads finish. The real Classic keep-setup Wi-Fi update has passed with preserved configuration and byte-matched web assets. The assembled PCB and S3 GUI update path remain separate qualification items; see the [iteration record](../../docs/internal/MAVLINK_REPLACEMENT_PLAN.md).

Windows setup/update helper for OpenTurbine boards.

Version 0.7.5 scales its custom layout, fonts and mouse hit testing with the
monitor DPI and follows Windows' suggested bounds on monitor changes. Final
reconnect and verification retry have distinct action labels; completion lists
the version, board target and number of verified web files. The drawing model
follows [Microsoft's GDI mapping guidance](https://learn.microsoft.com/en-us/windows/win32/gdi/application-defined-mapping-modes).

The home screen separates **Clean install / reinstall** (USB, erases the entire
selected board) from **Update and keep my setup** (Wi-Fi, backs up and retains
the existing engine setup). Do not weaken this distinction in release builds.

The tool does not redistribute or silently install serial drivers. If Windows
cannot see a board, the GUI identifies the likely USB bridge and opens the
official Silicon Labs or WCH download page for the user.

Build from this directory:

```powershell
python -X utf8 generate_icon.py
go test ./...
go run github.com/akavel/rsrc@v0.10.2 -ico OpenTurbineSetupTool.ico -manifest OpenTurbineSetupTool.manifest -o rsrc_windows_amd64.syso
go build -ldflags="-H windowsgui -s -w" -o OpenTurbineSetupTool.exe .
```

`rsrc_windows_amd64.syso` embeds the tracked `.ico` and manifest. Regenerate it
after changing either source file; CI also regenerates it before release builds.

For public releases, sign `OpenTurbineSetupTool.exe` before hashing or
publishing it. See `docs/SETUP_TOOL.md` for the Authenticode signing workflow
and GitHub Actions secrets.

The app downloads `OpenTurbine_Recommended.zip` from the latest GitHub release,
or uses a checksum-verified cached copy. A local
`OpenTurbine_Recommended.zip` placed next to the EXE remains the explicit
offline override. If a Classic ESP32 is not detected, unplug it, hold BOOT
while plugging it back in, and keep BOOT held through the retry until writing
starts.

Build the recommended ZIP from the repository root:

```powershell
python tools/build_setup_package.py `
  --esptool "$env:USERPROFILE\.platformio\penv\Scripts\esptool.exe"
```

The generated manifest includes `package_schema: 4`; the EXE and ZIP must come
from the same release family. The ZIP also includes OpenTurbine's license and
the bundled esptool third-party notice.

Release assets:

```text
OpenTurbineSetupTool.exe
OpenTurbineSetupTool.exe.sha256
OpenTurbine_Recommended.zip
OpenTurbine_Recommended.zip.sha256
```
