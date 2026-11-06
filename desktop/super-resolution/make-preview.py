from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

work = Path(__file__).resolve().parent / '2026-10-26'
meta = json.loads((work / 'artwork/animation-dense.json').read_text(encoding='utf8'))
name = meta['hdStates']['running']['path']
before = Image.open(work / 'source' / name).convert('RGBA')
after = Image.open(work / 'artwork' / name).convert('RGBA')
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
order = list(range(16)) + list(range(14, 0, -1))
lengths = [(2520 - 140) / 30 + (140 if i == 15 else 0) for i in order]
ends, total = [], 0
for length in lengths:
    total += length
    ends.append(round(total))
durations = [end - start for start, end in zip([0] + ends, ends)]
frames = []
for i in order:
    canvas = Image.new('RGB', (768, 452), '#242424')
    draw = ImageDraw.Draw(canvas)
    for col, (atlas, cw, ch, label) in enumerate([
            (before, 288, 312, '\u539f\u7248'), (after, 576, 624, '\u672c\u5730\u8d85\u5206\u9ad8\u6e05')]):
        cell = atlas.crop((i * cw, 0, (i + 1) * cw, ch)).resize((384, 416), Image.Resampling.LANCZOS)
        canvas.paste(cell, (col * 384, 30), cell)
        draw.text((col * 384 + 14, 5), label, fill='white', font=font)
    frames.append(canvas)
path = work / 'working-before-after.webp'
frames[0].save(path, save_all=True, append_images=frames[1:], duration=durations,
               loop=0, lossless=True, quality=100, method=4, minimize_size=True)
with Image.open(path) as check:
    assert check.n_frames == 30
assert sum(durations) == 2520
print(json.dumps({'preview': str(path), 'frames': 30, 'cycleMs': 2520, 'bytes': path.stat().st_size}))
