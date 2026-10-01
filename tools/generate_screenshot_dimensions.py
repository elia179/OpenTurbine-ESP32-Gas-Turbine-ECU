"""Reserve each configured-card screenshot's actual size before lazy loading."""
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sizes = {}
for path in sorted((root / 'site/assets/images/guided-builds').glob('*.png')):
    with path.open('rb') as image:
        header = image.read(24)
    if header[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'Not a PNG: {path}')
    width, height = struct.unpack('>II', header[16:24])
    sizes[path.stem] = {'width': width, 'height': height}
target = root / 'site/_data/screenshot_dimensions.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(sizes, indent=2) + '\n', encoding='utf-8')
print(f'Indexed exact dimensions for {len(sizes)} guided-build screenshots.')
