"""Second pass from the original cells, never SR-of-SR. Waiting/review frozen."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import subprocess
import argparse
import shutil
import time
import numpy as np

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('base_sr', HERE / 'upscale-yimei.py')
sr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sr)
WORK = HERE / '2026-10-26-detail'
RAW = HERE / '2026-10-26/source'
META = sr.read(RAW / 'animation-dense.json')
STATES = ['idle', 'running-right', 'running-left', 'waving', 'failed', 'running', 'look-9', 'look-10']
LOCKED = ['waiting', 'review']
SAMPLES = {'idle': 0, 'running-right': 8, 'running-left': 8, 'waving': 5,
           'failed': 8, 'running': 7, 'look-9': 3, 'look-10': 4}
PROFILES = ['strong-video', 'illustration', 'hybrid']


def init():
    WORK.mkdir(exist_ok=True)
    if not (WORK / 'previous').exists():
        shutil.copytree(sr.HOME / 'artwork', WORK / 'previous')
        shutil.copyfile(sr.HOME / 'update-policy.json', WORK / 'policy-before.json')
    return sr.read(WORK / 'previous/animation-dense.json')


def infer(pilot):
    job = WORK / ('pilot' if pilot else 'full')
    inputs = job / 'input'
    inputs.mkdir(parents=True, exist_ok=True)
    for state in STATES:
        old = META['hdStates'][state]
        for index in ([SAMPLES[state]] if pilot else range(old['columns'])):
            sr.extend_hidden_rgb(sr.cell(RAW, old, index)).save(inputs / f'{state}-{index:02d}.png')
    provenance = {}
    models=[('realesr-animevideov3', 2, 'video'), ('realesrgan-x4plus-anime', 4, 'illustration')]
    for model, scale, label in (models if pilot else models[1:]):
        out = job / label
        out.mkdir(exist_ok=True)
        command = [str(sr.TOOL / 'realesrgan-ncnn-vulkan.exe'), '-i', str(inputs), '-o', str(out),
                   '-m', str(sr.TOOL / 'models'), '-n', model, '-s', str(scale), '-t', '512', '-j', '1:1:2', '-f', 'png']
        started = time.perf_counter()
        with (job / f'{label}.log').open('w', encoding='utf8') as log:
            run = subprocess.run(command, cwd=sr.TOOL, stdout=log, stderr=subprocess.STDOUT,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        assert run.returncode == 0, f'Inference failed: {label}'
        provenance[label] = {'command': command, 'seconds': time.perf_counter()-started,
             'modelSha256': sr.sha(sr.TOOL / 'models' / ('realesr-animevideov3-x2.bin' if label == 'video' else model+'.bin'))}
    sr.write(job / 'inference.json', provenance)
    return job


def enhanced(original, video, illustration, profile, override_strength=None, detail_base=None):
    base = detail_base if detail_base is not None else original.resize((576, 624), Image.Resampling.LANCZOS)
    b = np.asarray(base.convert('RGB'), dtype=np.float32)
    v = video.convert('RGB').resize(base.size, Image.Resampling.LANCZOS)
    i = illustration.convert('RGB').resize(base.size, Image.Resampling.LANCZOS)
    if profile == 'strong-video':
        pred, strength = v, .95
    elif profile == 'illustration':
        pred, strength = i, .85
    else:
        pred, strength = Image.blend(v, i, .6), .9
    if override_strength is not None:
        strength=override_strength
    detail = np.asarray(pred, dtype=np.float32) - b
    low = np.asarray(pred.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    low -= np.asarray(base.convert('RGB').filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    alpha = np.asarray(base.getchannel('A'), dtype=np.float32)
    weight = strength * np.clip((alpha-160)/80, 0, 1)
    # Detail only: preserve overall hues and broad facial shading of the source.
    pixels = np.rint(b+(detail-.85*low)*weight[:, :, None]).clip(0, 255).astype(np.uint8)
    output = Image.fromarray(pixels).convert('RGBA')
    output.putalpha(base.getchannel('A'))
    return output


def preview(job, previous):
    states = ['running', 'idle', 'running-right', 'waving', 'failed', 'look-9']
    canvas = Image.new('RGB', (1056, 6*310), '#242424')
    draw = ImageDraw.Draw(canvas)
    for row, state in enumerate(states):
        index = SAMPLES[state]
        raw = sr.cell(RAW, META['hdStates'][state], index)
        current = sr.cell(WORK / 'previous', previous['hdStates'][state], index)
        with Image.open(job / 'video' / f'{state}-{index:02d}.png') as v, Image.open(job / 'illustration' / f'{state}-{index:02d}.png') as i:
            images = [current]+[enhanced(raw, v, i, p) for p in PROFILES]
        for col, (label, frame) in enumerate(zip(['current-r7']+PROFILES, images)):
            frame = frame.resize((264, 286), Image.Resampling.LANCZOS)
            x,y=col*264,row*310+22
            canvas.paste(frame,(x,y),frame)
            draw.text((x+5,y-18),f'{state}: {label}',fill='white')
    canvas.save(WORK / 'model-comparison.png')
    # One same-size 2x face/hair crop per difficult source, not an atlas-size claim.
    canvas=Image.new('RGB',(4*248,3*260),'#242424');draw=ImageDraw.Draw(canvas)
    for row,state in enumerate(['running','running-right','look-9']):
        index=SAMPLES[state];raw=sr.cell(RAW,META['hdStates'][state],index)
        current=sr.cell(WORK/'previous',previous['hdStates'][state],index)
        with Image.open(job/'video'/f'{state}-{index:02d}.png')as v,Image.open(job/'illustration'/f'{state}-{index:02d}.png')as i:
            images=[current]+[enhanced(raw,v,i,p)for p in PROFILES]
        for col,(label,im)in enumerate(zip(['current-r7']+PROFILES,images)):
            # Fixed original coordinates (not re-detected or warped across variants).
            box=(140,26,388,260) if state=='running' else (170,20,418,254)
            crop=im.crop(box);x,y=col*248,row*260+23
            canvas.paste(crop,(x,y),crop);draw.text((x+4,y-18),f'{state}: {label}',fill='white')
    canvas.save(WORK/'face-comparison.png')


def assemble(job, previous):
    target=WORK/'artwork'
    if not target.exists():
        shutil.copytree(WORK/'previous',target)
    report=sr.read(WORK/'previous/super-resolution-report.json')
    new_meta=json.loads(json.dumps(previous))
    profiles={}

    def state_job(state):
        spec=META['hdStates'][state]
        originals=[sr.cell(RAW,spec,i)for i in range(spec['columns'])]
        models=[]
        for i in range(spec['columns']):
            with Image.open(job/'illustration'/f'{state}-{i:02d}.png')as im:
                models.append(im.convert('RGB').resize((576,624),Image.Resampling.LANCZOS))
        current=[sr.cell(WORK/'previous',previous['hdStates'][state],i)for i in range(spec['columns'])]
        strength=.85
        # Calibrate once for the complete state, NOT independently per frame.
        # Retain the original preservation limits rather than weakening tests.
        for attempt in range(12):
            cells=[enhanced(a,b,b,'illustration',strength,c)for a,b,c in zip(originals,models,current)]
            residuals=[];errors=[]
            for a,b in zip(originals,cells):
                assert b.getchannel('A').tobytes()==a.resize(b.size,Image.Resampling.LANCZOS).getchannel('A').tobytes()
                down=b.resize(a.size,Image.Resampling.LANCZOS)
                diff=np.asarray(down.convert('RGB'),dtype=np.float32)-np.asarray(a.convert('RGB'),dtype=np.float32)
                mask=np.asarray(a.getchannel('A'))>230
                errors.append(float(np.abs(diff[mask]).mean()));residuals.append(diff*mask[:,:,None])
            temporal=[float(np.abs(b-a).mean())for a,b in zip(residuals,residuals[1:]+residuals[:1])]
            # Look cells are independent still directions, NOT animation times.
            # Do not mistake angle changes between them for temporal flicker.
            temporal_factor=1 if state.startswith('look-') else 4.97/max(temporal)
            factor=min(1,7.8/max(errors),temporal_factor)
            if factor>=1:
                break
            strength*=min(factor*.9,.88)
        temporal_ok=state.startswith('look-') or max(temporal)<5
        assert factor>=1 and strength>=.1 and max(errors)<8 and temporal_ok,(state,strength,errors,temporal)
        old_hashes={sr.hashlib.sha256(im.tobytes()).hexdigest()for im in originals}
        new_hashes={sr.hashlib.sha256(im.tobytes()).hexdigest()for im in cells}
        assert len(new_hashes)>=len(old_hashes)
        atlas=Image.new('RGBA',(576*spec['columns'],624))
        for index,im in enumerate(cells):
            atlas.paste(im,(index*576,0))
        file=target/spec['path'];atlas.save(file,lossless=True,quality=100,method=6,exact=True)
        with Image.open(file)as decoded:
            assert decoded.convert('RGBA').tobytes()==atlas.tobytes()
        result={'ok':True,'sourceSha256':spec['sha256'],'sha256':sr.sha(file),
          'sourceCell':[288,312],'targetCell':[576,624],'columns':spec['columns'],
          'sourceUniqueFrames':len(old_hashes),'outputUniqueFrames':len(new_hashes),
          'alphaResampleExact':True,'maxOpaqueDownsampleMAE':max(errors),
          'maxTemporalResidualMAE':max(temporal),'losslessRoundtrip':True,
          'temporalCheck':'not-applicable-static-look-directions' if state.startswith('look-') else 'animated-sequence-original-residual'}
        return state,result,{'model':'realesrgan-x4plus-anime','modelNativeScale':4,
              'strength':strength,'targetScale':2,'calibrationAttempts':attempt+1,
              'fixedAcrossAllFrames':True}

    with ThreadPoolExecutor(max_workers=3)as pool:
        for state,result,profile in pool.map(state_job,STATES):
            report['states'][state]=result;profiles[state]=profile
            new_meta['hdStates'][state]['sha256']=result['sha256']
    for state in LOCKED:
        spec=new_meta['hdStates'][state]
        assert sr.sha(target/spec['path'])==previous['hdStates'][state]['sha256']
    refinement={'method':'realesrgan-anime6b-detail-refinement-v2',
      'referenceStatesUnchanged':{s:previous['hdStates'][s]['sha256']for s in LOCKED},
      'previousManifestSha256':sr.sha(WORK/'previous/animation-dense.json'),
      'profiles':profiles,'optimizedFrames':112,'inference':sr.read(job/'inference.json'),
      'notRepeatedUpscaling':True,'sourceWasOriginal288px':True}
    new_meta['previousRevision']=previous['revision']
    new_meta['revision']='2026-10-26-anime6b-detail-original-poses'
    new_meta['visualQA']='pending'
    new_meta['superResolution']['method']=refinement['method']
    new_meta['superResolution']['detailRefinement']=refinement
    new_meta['superResolution']['strength']={s:p['strength']for s,p in profiles.items()}
    report['method']=refinement['method'];report['detailRefinement']=refinement
    report['visualQA']='pending';report['strength']=new_meta['superResolution']['strength']
    for s in STATES:
        new_meta['hdStates'][s]['visualQA']='pending'
    sr.write(target/'animation-dense.json',new_meta)
    sr.write(target/'super-resolution-report.json',report)
    # The final comparison has the same576px cell size on both sides.
    canvas=Image.new('RGB',(1152,4*338),'#242424');draw=ImageDraw.Draw(canvas)
    for k,state in enumerate(STATES):
        index=SAMPLES[state];x,y=(k%2)*576,(k//2)*338+20
        for col,base in enumerate([WORK/'previous',target]):
            im=sr.cell(base,new_meta['hdStates'][state],index).resize((288,312),Image.Resampling.LANCZOS)
            canvas.paste(im,(x+col*288,y),im)
        draw.text((x+5,y-17),f'{state}: r7 / DETAIL (same pixel dimensions)',fill='white')
    canvas.save(WORK/'detail-before-after.png')
    print(json.dumps({'ok':True,'optimizedFrames':112,'lockedStates':LOCKED,'profiles':profiles},indent=2))


def main():
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['pilot','all','assemble','accept']);args=parser.parse_args()
    previous=init()
    if args.mode=='accept':
        meta=sr.read(WORK/'artwork/animation-dense.json');report=sr.read(WORK/'artwork/super-resolution-report.json')
        for state,spec in meta['hdStates'].items():
            assert sr.sha(WORK/'artwork'/spec['path'])==report['states'][state]['sha256']==spec['sha256']
            spec['visualQA']='pass'
        meta['visualQA']=report['visualQA']='pass'
        report['visualEvidence']=str(WORK/'detail-before-after.png')
        sr.write(WORK/'artwork/animation-dense.json',meta);sr.write(WORK/'artwork/super-resolution-report.json',report)
        print('Accepted detail candidate; waiting/review copied exactly')
    elif args.mode=='pilot':
        job=infer(True);preview(job,previous)
        print(json.dumps({'ok':True,'preview':str(WORK/'model-comparison.png'),'faces':str(WORK/'face-comparison.png')}))
    else:
        assemble(WORK/'full' if args.mode=='assemble' else infer(False),previous)


if __name__=='__main__':
    main()
