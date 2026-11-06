import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {extractFile} from './tools/node_modules/@electron/asar/lib/asar.js';
import {harness} from './test-look-regression.mjs';
const home=path.dirname(fileURLToPath(import.meta.url));
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').trim());
const runtime=process.argv[2]??json(path.join(home,'current.json')).runtime;
const report=json(path.join(runtime,'patch-report.json'));
const overlay=extractFile(path.join(runtime,'app/resources/app.asar'),path.normalize(report.overlayPath)).toString();
// Verify the actual upstream task mapping, not an invented animation name.
const taskMapping=overlay.match(/if\(e\.isLoading\)return\{[^}]*mascotState:[`"]([^`"]+)[`"]/);
assert(taskMapping,'Official loading task mapping');assert.equal(taskMapping[1],'running');
const source={petId:'custom:yimei',spriteRowCount:11};
const outcomes=[];
for(const hover of [false,true])for(const look of [false,true]){
 const h=harness();const lookFrame=look?{rowIndex:9,columnIndex:3,frameDurationMs:0}:undefined;
 h.update({source,state:taskMapping[1],lookFrame});if(hover)h.enter();
 const result=h.pet();outcomes.push({inputState:'running',hover,nativeLook:look,outputState:result.state,lookFrame:result.lookFrame??null,ok:result.state==='running'&&result.lookFrame==null});h.dispose();
}
const summary={ok:outcomes.every(r=>r.ok),version:report.version,runtime,upstreamLoadingState:taskMapping[1],outcomes};
if(!summary.ok)console.log(JSON.stringify(summary,null,2));
assert(summary.ok,'Active task must animate working, not hover wave or a static native look frame');
const h=harness();h.update({source,state:'idle'});h.advance(12000);assert.equal(h.pet().state,'waiting');
h.enter();h.update({source,state:'running',lookFrame:{rowIndex:10,columnIndex:3,frameDurationMs:0}});assert.equal(h.pet().state,'running');assert(h.pet().lookFrame==null);h.advance(30000);assert.equal(h.pet().state,'running');
// Only an explicit native drag-hold may temporarily override working. Native
// passive look/hover still cannot. Moving cancels it and release restores working.
h.context.yimeiScheduleDragLook(150,30);h.advance(1499);assert.equal(h.pet().state,'running');assert(h.pet().lookFrame==null);h.advance(1);assert.equal(h.pet().state,'idle');assert(h.pet().lookFrame!=null);
h.context.yimeiScheduleDragLook(40,160);h.flush();assert.equal(h.pet().state,'running');assert(h.pet().lookFrame==null);h.advance(1500);assert.equal(h.pet().lookFrame.rowIndex,10);
h.context.yimeiClearDragLook();h.flush();assert.equal(h.pet().state,'running');assert(h.pet().lookFrame==null);h.advance(30000);assert.equal(h.pet().state,'running');
h.update({source,state:'waiting',lookFrame:{rowIndex:9,columnIndex:2,frameDurationMs:0}});assert.equal(h.pet().state,'waiting');assert(h.pet().lookFrame==null);
h.context.yimeiClearDragLook();h.flush();h.update({source,state:'idle'});assert.equal(h.pet().state,'waving');h.leave();assert.equal(h.pet().state,'idle');h.dispose();
const builtin=harness(),nativeLook={rowIndex:9,columnIndex:2,frameDurationMs:0};builtin.update({source:{petId:'codex',spriteRowCount:11},state:'running',lookFrame:nativeLook});assert.deepEqual(builtin.pet().lookFrame,nativeLook);builtin.enter();assert.equal(builtin.pet().state,'jumping');assert.equal(builtin.pet().lookFrame,null);builtin.dispose();
Object.assign(summary,{ambientAndPassiveLookYieldToTask:true,explicitHeldLookDuringWorking:true,movementCancelsHeldLook:true,releaseRestoresWorking:true,workingRemainsActiveAfter30Seconds:true,waitingTaskPreserved:true,idleInteractionRestoredAfterTask:true,builtinBehaviorUnchanged:true});
console.log(JSON.stringify(summary,null,2));
