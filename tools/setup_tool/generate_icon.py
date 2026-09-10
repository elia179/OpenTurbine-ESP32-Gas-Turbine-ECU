"""Generate the OpenTurbine Setup Tool's eight-blade wheel icon.

The icon is deliberately geometric so the blade count remains legible at the
small Windows title-bar sizes as well as in Explorer.  The output is written
as an opaque PNG preview and a multi-size PNG-backed ICO.
"""

from __future__ import annotations

import math
import pathlib
import struct
import zlib


ROOT = pathlib.Path(__file__).resolve().parent
PNG_PATH = ROOT / "assets" / "OpenTurbineSetupTool.png"
ICO_PATH = ROOT / "OpenTurbineSetupTool.ico"

BG = (10, 17, 24, 255)
RING = (255, 132, 29, 255)
RING_HIGHLIGHT = (255, 174, 62, 255)
BLADE = (255, 121, 20, 255)
BLADE_HIGHLIGHT = (255, 151, 34, 255)
HUB_DARK = (9, 16, 22, 255)
HUB = (42, 194, 190, 255)


def png_bytes(width: int, height: int, rgba: bytes) -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(
            ">I", zlib.crc32(kind + payload) & 0xFFFFFFFF
        )

    rows = b"".join(b"\x00" + rgba[y * width * 4 : (y + 1) * width * 4] for y in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def blade_outer_radius(local_angle: float) -> float:
    """Outer edge of one swept blade, in the source wheel's 1024-unit space."""
    if local_angle < -0.31 or local_angle > 0.33:
        return 0.0
    stops = [(-0.31, 286.0), (-0.18, 425.0), (0.03, 413.0), (0.33, 305.0)]
    for (a1, r1), (a2, r2) in zip(stops, stops[1:]):
        if local_angle <= a2:
            fraction = (local_angle - a1) / (a2 - a1)
            return r1 + fraction * (r2 - r1)
    return stops[-1][1]


def render(size: int, supersample: int = 4) -> bytes:
    high = size * supersample
    center = high / 2.0
    scale = high / 1024.0
    pixels = bytearray(high * high * 4)
    for y in range(high):
        for x in range(high):
            dx, dy = x + 0.5 - center, y + 0.5 - center
            radius = math.hypot(dx, dy) / scale
            # A subtle radial lift keeps the wheel readable against dark title bars.
            lift = max(0.0, 1.0 - radius / 560.0) * 7.0
            pixel = (min(255, round(BG[0] + lift)), min(255, round(BG[1] + lift)), min(255, round(BG[2] + lift)), 255)
            if 438 <= radius <= 470:
                pixel = RING_HIGHLIGHT if radius < 447 else RING
            if 100 <= radius <= 430:
                angle = math.atan2(dy, dx)
                sector = math.tau / 8.0
                local_angle = (angle + sector / 2.0) % sector - sector / 2.0
                outer = blade_outer_radius(local_angle)
                inner = 104.0 + max(0.0, local_angle + 0.15) * 18.0
                if outer > 0.0 and inner <= radius <= outer:
                    pixel = BLADE_HIGHLIGHT if radius < 275 else BLADE
            if radius <= 126:
                pixel = HUB_DARK
            if radius <= 106:
                pixel = HUB
            if radius <= 62:
                pixel = HUB_DARK
            offset = (y * high + x) * 4
            pixels[offset : offset + 4] = bytes(pixel)

    if supersample == 1:
        return bytes(pixels)
    output = bytearray(size * size * 4)
    area = supersample * supersample
    for y in range(size):
        for x in range(size):
            totals = [0, 0, 0, 0]
            for oy in range(supersample):
                for ox in range(supersample):
                    offset = ((y * supersample + oy) * high + (x * supersample + ox)) * 4
                    for channel in range(4):
                        totals[channel] += pixels[offset + channel]
            offset = (y * size + x) * 4
            output[offset : offset + 4] = bytes(value // area for value in totals)
    return bytes(output)


def write_ico(images: list[tuple[int, bytes]]) -> None:
    entries = []
    offset = 6 + 16 * len(images)
    for size, image in images:
        entries.append(struct.pack("<BBBBHHII", 0 if size == 256 else size, 0 if size == 256 else size, 0, 0, 1, 32, len(image), offset))
        offset += len(image)
    ICO_PATH.write_bytes(struct.pack("<HHH", 0, 1, len(images)) + b"".join(entries) + b"".join(image for _, image in images))


def main() -> None:
    preview = render(1024, supersample=2)
    PNG_PATH.write_bytes(png_bytes(1024, 1024, preview))
    sizes = [16, 24, 32, 48, 64, 128, 256]
    write_ico([(size, png_bytes(size, size, render(size))) for size in sizes])
    print(f"wrote {PNG_PATH}")
    print(f"wrote {ICO_PATH} ({ICO_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
