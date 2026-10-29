# Third-party notices

The recommended Windows setup package bundles Espressif's official standalone
`esptool.exe`, version 5.3.0 (commit `c94e362`). Its complete GPL license is
included in the package as `tools/esptool-LICENSE`.

- Project: Espressif esptool
- Source: https://github.com/espressif/esptool/tree/v5.3.0
- License: GPL-2.0-or-later
- Binary archive: `esptool-v5.3.0-windows-amd64.zip`, pinned by SHA-256 in
  `.github/workflows/release.yml`.

The corresponding source and license terms are available at the source link.
OpenTurbine itself is licensed under the MIT License in `LICENSE`.

## Generated MAVLink bindings

`libraries/OpenTurbineMavlink/src/protocol/` and `protocol/openturbine.py` are
produced by pymavlink 2.4.50. Generated output is distributed under the MAVLink
MIT generated-code exception; see `libraries/OpenTurbineMavlink/GENERATED-LICENSE.txt`.
The generator is a development dependency and is not linked into the firmware.
`protocol/generation.json` records the input hashes.

The generated-code license is reproduced here so binary distributions retain it:

Copyright (C) the ArduPilot project
http://ardupilot.org/

Permission is hereby granted, free of charge, to any person obtaining a copy
of the generated software (the "Generated Software"), to deal
in the Generated Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Generated Software, and to permit persons to whom the Generated
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Generated Software.

THE GENERATED SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE GENERATED SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE GENERATED SOFTWARE.
