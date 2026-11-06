"""User-authorized local SR: no generated poses, fixed registration and source alpha.

The original artwork is snapshotted. Inference runs independently per frame so
neighbouring atlas cells cannot contaminate one another. Final atlases are lossless.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFilter
import argparse
import hashlib
import json
import shutil
import subprocess
import time
import numpy as np

HOME = Path(__file__).resolve().parents[1]
METHOD = 'realesr-animevideov3-2x-preserve-poses'
STRENGTH = 0.65
SAMPLES = {'idle': 0, 'running-right': 8, 'running-left': 8, 'waving': 5,
           'failed': 8, 'waiting': 8, 'running': 7, 'review': 15,
           'look-9': 3, 'look-10': 4}
TOOL = HOME / 'tools/super-resolution/realesrgan-20220424'


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def read(p):
    return json.loads(Path(p).read_text(encoding='utf-8-sig'))


def write(p, data):
    Path(p).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def snapshot(work):
    source = work / 'source'
    if not source.exists():
        shutil.copytree(HOME / 'artwork', source)
    meta = read(source / 'animation-dense.json')
    assert len(meta['hdStates']) == 10
    for spec in meta['hdStates'].values():
        assert sha(source / spec['path']) == spec['sha256']
        assert (spec['cellWidth'], spec['cellHeight']) == (288, 312)
    return source, meta


def cell(source, spec, index):
    with Image.open(source / spec['path']) as image:
        w, h = spec['cellWidth'], spec['cellHeight']
        return image.convert('RGBA').crop((index * w, 0, (index + 1) * w, h))


def extend_hidden_rgb(frame):
    """Only fill invisible pixels, to avoid a black/white matte in the SR model."""
    pixels = np.asarray(frame)
    rgb = pixels[:, :, :3].astype(np.float32).copy()
    valid = pixels[:, :, 3] > 0
    for _ in range(8):
        colors = np.pad(rgb * valid[:, :, None], ((1, 1), (1, 1), (0, 0)))
        weights = np.pad(valid.astype(np.float32), 1)
        total = np.zeros_like(rgb)
        count = np.zeros_like(weights[1:-1, 1:-1])
        h, w = valid.shape
        for dy, dx in ((0, 1), (1, 0), (1, 2), (2, 1)):
            total += colors[dy:dy + h, dx:dx + w]
            count += weights[dy:dy + h, dx:dx + w]
        take = ~valid & (count > 0)
        rgb[take] = total[take] / count[take, None]
        valid |= take
    return Image.fromarray(np.rint(rgb).clip(0, 255).astype(np.uint8))


def infer(work, source, meta, pilot):
    job = work / ('pilot' if pilot else 'full')
    inputs, outputs = job / 'input', job / 'inferred'
    inputs.mkdir(parents=True, exist_ok=True)
    outputs.mkdir(exist_ok=True)
    expected = []
    for state, spec in meta['hdStates'].items():
        for index in ([SAMPLES[state]] if pilot else range(spec['columns'])):
            name = f'{state}-{index:02d}.png'
            frame = cell(source, spec, index)
            extend_hidden_rgb(frame).save(inputs / name)
            expected.append(name)
    command = [str(TOOL / 'realesrgan-ncnn-vulkan.exe'), '-i', str(inputs), '-o', str(outputs),
               '-m', str(TOOL / 'models'), '-n', 'realesr-animevideov3', '-s', '2',
               '-t', '512', '-j', '1:1:2', '-f', 'png']
    start = time.perf_counter()
    with (job / 'inference.log').open('w', encoding='utf-8') as log:
        run = subprocess.run(command, cwd=TOOL, stdout=log, stderr=subprocess.STDOUT,
                             creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    assert run.returncode == 0, (job / 'inference.log').read_text()[-2500:]
    for name in expected:
        with Image.open(outputs / name) as image:
            assert image.size == (576, 624), (name, image.size)
    write(job / 'inference.json', {'ok': True, 'count': len(expected), 'seconds': time.perf_counter() - start,
          'command': command, 'exeSha256': sha(TOOL / 'realesrgan-ncnn-vulkan.exe'),
          'modelSha256': sha(TOOL / 'models/realesr-animevideov3-x2.bin'),
          'paramSha256': sha(TOOL / 'models/realesr-animevideov3-x2.param'),
          'sourceURL': 'https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0'})
    return job


def finish_frame(original, inferred):
    # Independent fixed-rule alpha; never use a model-invented silhouette.
    base = original.resize((576, 624), Image.Resampling.LANCZOS)
    base_rgb, model_rgb = base.convert('RGB'), inferred.convert('RGB')
    b, s = np.asarray(base_rgb, dtype=np.float32), np.asarray(model_rgb, dtype=np.float32)
    # Keep original low-frequency colour/lighting; transfer conservative detail.
    low = np.asarray(model_rgb.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    low -= np.asarray(base_rgb.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    a = np.asarray(base.getchannel('A'), dtype=np.float32)
    weight = STRENGTH * np.clip((a - 160) / 80, 0, 1)
    rgb = np.rint(b + (s - b - 0.85 * low) * weight[:, :, None]).clip(0, 255).astype(np.uint8)
    result = Image.fromarray(rgb).convert('RGBA')
    result.putalpha(base.getchannel('A'))
    assert result.getchannel('A').tobytes() == base.getchannel('A').tobytes()
    return result


def preview(work, source, meta, job, full=False):
    states = list(SAMPLES)
    rows = (len(states) + 1) // 2
    sheet = Image.new('RGB', (1168, rows * 342 + 12), '#242424')
    draw = ImageDraw.Draw(sheet)
    for k, state in enumerate(states):
        index = SAMPLES[state]
        before = cell(source, meta['hdStates'][state], index)
        if full:
            spec = read(work / 'artwork/animation-dense.json')['hdStates'][state]
            after = cell(work / 'artwork', spec, index)
        else:
            with Image.open(job / 'inferred' / f'{state}-{index:02d}.png') as im:
                after = finish_frame(before, im)
        x, y = 8 + (k % 2) * 584, 8 + (k // 2) * 342
        for col, frame in enumerate((before, after)):
            shown = frame.resize((288, 312), Image.Resampling.LANCZOS)
            sheet.paste(shown, (x + col * 288, y + 22), shown)
        draw.text((x + 6, y + 3), f'{state} #{index}: BEFORE / LOCAL SR', fill='white')
    sheet.save(work / ('comparison-all.png' if full else 'comparison-pilot.png'))


def assemble(work, source, meta, job):
    output = work / 'artwork'
    if not output.exists():
        shutil.copytree(source, output)

    def build_state(item):
        state, spec = item
        atlas = Image.new('RGBA', (576 * spec['columns'], 624))
        originals, results, errors, downscaled = set(), set(), [], []
        for index in range(spec['columns']):
            old = cell(source, spec, index)
            with Image.open(job / 'inferred' / f'{state}-{index:02d}.png') as model:
                new = finish_frame(old, model)
            atlas.paste(new, (576 * index, 0))
            originals.add(hashlib.sha256(old.tobytes()).hexdigest())
            results.add(hashlib.sha256(new.tobytes()).hexdigest())
            down = new.resize(old.size, Image.Resampling.LANCZOS)
            mask = np.asarray(old.getchannel('A')) > 230
            diff = np.asarray(down.convert('RGB'), dtype=np.float32) - np.asarray(old.convert('RGB'), dtype=np.float32)
            errors.append(float(np.abs(diff[mask]).mean()))
            downscaled.append(diff * mask[:, :, None])
        temporal = [float(np.abs(b - a).mean()) for a, b in zip(downscaled, downscaled[1:] + downscaled[:1])]
        assert len(results) >= len(originals), (state, 'Lost distinct original poses')
        assert max(errors) < 8, (state, 'Excessive source drift', errors)
        assert max(temporal) < 5, (state, 'Excessive enhancement temporal residual', temporal)
        file = output / spec['path']
        atlas.save(file, lossless=True, quality=100, method=6, exact=True)
        with Image.open(file) as roundtrip:
            assert roundtrip.convert('RGBA').tobytes() == atlas.tobytes()
        return state, {'ok': True, 'sourceSha256': spec['sha256'], 'sha256': sha(file),
             'sourceCell': [288, 312], 'targetCell': [576, 624], 'columns': spec['columns'],
             'sourceUniqueFrames': len(originals), 'outputUniqueFrames': len(results),
             'alphaResampleExact': True, 'maxOpaqueDownsampleMAE': max(errors),
             'maxTemporalResidualMAE': max(temporal), 'losslessRoundtrip': True}

    with ThreadPoolExecutor(max_workers=4) as pool:
        states = dict(pool.map(build_state, meta['hdStates'].items()))
    old_specs = json.loads(json.dumps(meta['hdStates']))
    for state, result in states.items():
        spec = meta['hdStates'][state]
        spec.update(cellWidth=576, cellHeight=624, density=3, sha256=result['sha256'], visualQA='pending')
    meta['previousRevision'] = meta['revision']
    meta['revision'] = '2026-10-26-local-sr2x-original-poses'
    meta['visualQA'] = 'pending'
    meta['superResolution'] = {'method': METHOD, 'factor': 2, 'strength': STRENGTH,
       'sourceRevision': meta['previousRevision'], 'sourceStates': old_specs,
       'report': 'super-resolution-report.json', 'poseOrderUnchanged': True,
       'alphaPolicy': 'Original alpha resized2x with Lanczos; model alpha never used',
       'referenceState': 'review', 'fallbackAtlasesUnchanged': True}
    write(output / 'animation-dense.json', meta)
    report = {'ok': True, 'visualQA': 'pending', 'method': METHOD, 'strength': STRENGTH,
        'states': states, 'frames': sum(v['columns'] for v in states.values()),
        'sourceManifestSha256': sha(source / 'animation-dense.json'),
        'inference': read(job / 'inference.json'), 'baseAndDenseFallbackUnchanged': True,
        'allOriginalPlaybackMetadataPreserved': True, 'noGeneratedPoses': True,
        'userAuthorization': '2026-10-26: local per-frame super-resolution, not redrawing'}
    for name in ['spritesheet.webp', 'spritesheet-dense.webp', 'pet.json']:
        assert sha(output / name) == sha(source / name)
    write(output / 'super-resolution-report.json', report)
    preview(work, source, meta, job, full=True)
    print(json.dumps({'ok': True, 'frames': report['frames'], 'states': len(states),
                      'targetCell': [576, 624], 'visualQA': 'pending'}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['pilot', 'all', 'accept'])
    parser.add_argument('--work', type=Path, required=True)
    args = parser.parse_args()
    work = args.work.resolve()
    assert work.is_relative_to(HOME.resolve()), 'Workspace-local output only'
    work.mkdir(parents=True, exist_ok=True)
    source, meta = snapshot(work)
    if args.mode == 'accept':
        target = work / 'artwork'
        manifest, report = read(target / 'animation-dense.json'), read(target / 'super-resolution-report.json')
        assert report['ok'] and report['frames'] == 144
        for state, spec in manifest['hdStates'].items():
            assert sha(target / spec['path']) == report['states'][state]['sha256'] == spec['sha256']
            spec['visualQA'] = 'pass'
        manifest['visualQA'] = 'pass'
        report['visualQA'] = 'pass'
        report['visualEvidence'] = str(work / 'comparison-all.png')
        write(target / 'super-resolution-report.json', report)
        write(target / 'animation-dense.json', manifest)
        print('Accepted inspected144-frame candidate; originals retained')
        return
    job = infer(work, source, meta, args.mode == 'pilot')
    if args.mode == 'pilot':
        preview(work, source, meta, job)
        print(json.dumps({'ok': True, 'preview': str(work / 'comparison-pilot.png')}))
    else:
        assemble(work, source, meta, job)


if __name__ == '__main__':
    main()
