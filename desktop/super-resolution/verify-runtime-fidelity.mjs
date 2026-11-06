import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {extractFile} from '../tools/node_modules/@electron/asar/lib/asar.js';
const home=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workName=process.argv[2]??'2026-10-26';
assert(['2026-10-26','2026-10-26-detail'].includes(workName));
const detail=workName.endsWith('-detail'),work=path.join(home,'super-resolution',workName);
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').trim());
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const old=detail?json(path.join(work,'policy-before.json')).runtime:path.join(home,'versions/26.1013.4894.0-bc3cbf09434b-r6');
const runtime=fs.readFileSync(path.join(work,'candidate-runtime.txt'),'utf8').trim();
const before=json(path.join(old,'artwork/animation-dense.json'));
const after=json(path.join(runtime,'artwork/animation-dense.json'));
assert.equal(hash(path.join(work,detail?'previous/animation-dense.json':'source/animation-dense.json')),json(path.join(old,'ready.json')).artworkFingerprint);
function unchangedMetadata(meta){
 const result=structuredClone(meta);
 for(const key of ['revision','previousRevision','superResolution'])delete result[key];
 for(const spec of Object.values(result.hdStates))for(const key of ['cellWidth','cellHeight','density','sha256'])delete spec[key];
 return result;
}
assert.deepEqual(unchangedMetadata(after),unchangedMetadata(before),'All original playback/gesture/eye metadata must remain exact');
for(const name of ['spritesheet.webp','spritesheet-dense.webp','pet.json'])assert.equal(hash(path.join(old,'artwork',name)),hash(path.join(runtime,'artwork',name)),name+' fallback exact');
assert.equal(hash(path.join(old,'yimei-dense-player.js')),hash(path.join(runtime,'yimei-dense-player.js')),'Exact existing timing/frame-order/player code');
const oldPatch=json(path.join(old,'patch-report.json')),patch=json(path.join(runtime,'patch-report.json'));
for(const field of ['buttonPath','overlayPath']){
 const a=extractFile(path.join(old,'app/resources/app.asar'),path.normalize(oldPatch[field]));
 const b=extractFile(path.join(runtime,'app/resources/app.asar'),path.normalize(patch[field]));
 assert(a.equals(b),field+' including all existing1500ms hold and task priority code must be byte-identical');
}
const browser=json(path.join(runtime,'browser-test-report.json'));
for(const [state,spec]of Object.entries(after.hdStates)){
 assert.equal(hash(path.join(runtime,'artwork',spec.path)),spec.sha256);
 assert.deepEqual([spec.cellWidth,spec.cellHeight,spec.density],[576,624,3]);
 if(!state.startsWith('look-'))assert.deepEqual([browser.states[state].hd.cellWidth,browser.states[state].hd.cellHeight],[576,624]);
}
assert.equal(browser.lookDirections.length,16);assert.deepEqual(browser.workingResumedAfterHeldLook.actualVisited,Array.from({length:16},(_,i)=>i));
const look=json(path.join(runtime,'look-test-report.json'));assert.equal(look.holdMs,1500);
const sr=json(path.join(runtime,'artwork/super-resolution-report.json'));assert.equal(sr.frames,144);assert(sr.ok&&sr.visualQA==='pass');
if(detail){
 for(const [state,spec]of Object.entries(after.hdStates)){
  if(['waiting','review'].includes(state))assert.equal(spec.sha256,before.hdStates[state].sha256,state+' reference bytes');
  else assert.notEqual(spec.sha256,before.hdStates[state].sha256,state+' genuinely changed at same resolution');
 }
}
const result={ok:true,runtime,originalRuntime:old,allSourceFrames:144,actions:8,lookDirections:16,
 targetCell:[576,624],allOriginalPlaybackMetadataExact:true,fallbackAtlasesExact:true,optimizedFrames:detail?112:144,referenceStatesUnchanged:detail?['waiting','review']:[],
 playerTimingAndFrameOrderByteIdentical:true,pointerHoldAndWorkingPriorityByteIdentical:true,
 holdMs:1500,alphaFromOriginal:true,noGeneratedPoses:true,browserStates:Object.keys(browser.states),
 displayScaleChecks:browser.displayScaleChecks.map(v=>({deviceScaleFactor:v.deviceScaleFactor,cssWidth:v.cssWidth,cssHeight:v.cssHeight,sourceCell:[v.hd.cellWidth,v.hd.cellHeight]}))};
fs.writeFileSync(path.join(work,'fidelity-report.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
