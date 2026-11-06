import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {extractFile} from './tools/node_modules/@electron/asar/lib/asar.js';
const home=path.dirname(fileURLToPath(import.meta.url));
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').trim());
const runtime=process.argv[2]??json(path.join(home,'current.json')).runtime;
const report=json(path.join(runtime,'patch-report.json')),roles=json(path.join(runtime,'roles.json'));
const asar=path.join(runtime,'app/resources/app.asar');
const button=extractFile(asar,path.normalize(report.buttonPath)).toString();
const overlay=extractFile(asar,path.normalize(report.overlayPath)).toString();
export function harness(buttonSource=button){
 let hooks=[],cursor=0,effects=[],cache=Array(20).fill(Symbol.for('react.memo_cache_sentinel')),props,result;
 let now=0,id=0;const timers=new Map(),listeners=new Map(),commits=[];
 const window={setTimeout(fn,delay){const key=++id;timers.set(key,{fn,at:now+delay});return key},clearTimeout(key){timers.delete(key)},addEventListener(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f)},removeEventListener(n,f){listeners.get(n)?.delete(f)},dispatchEvent(e){for(const f of listeners.get(e.type)??[])f(e)}};
 const M={useState(initial){const index=cursor++;hooks[index]??={value:initial};return[hooks[index].value,value=>{if(Object.is(hooks[index].value,value))return;hooks[index].value=value;commits.push(render)}]},useRef(value){const index=cursor++;hooks[index]??={current:value};return hooks[index]},useEffect(fn,deps){const index=cursor++;const previous=hooks[index];if(!previous||deps.some((v,i)=>!Object.is(v,previous.deps[i])))effects.push(()=>{previous?.cleanup?.();hooks[index]={deps,cleanup:fn()}})}};
 const map=roles.buttonTestMap, globals={window,Math:Object.assign(Object.create(Math),{random:()=>0}),CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}}};
 const jsx=(tag,p)=>{if(p.ref)p.ref.current={getBoundingClientRect:()=>({left:0,top:0,width:192,height:208})};return typeof tag==='function'?tag(p):{tag,props:p}};
 Object.assign(globals,{[map.O]:M,[map.ce]:{c:()=>cache},[map.te]:(...v)=>v.filter(Boolean).join(' '),[map.f]:{},[map.h]:props=>({tag:'pet',props}),[map.k]:{jsx,jsxs:jsx}});
 const context=vm.createContext(globals);
 vm.runInContext(buttonSource.slice(buttonSource.indexOf('function yimeiIsPet'),buttonSource.indexOf('function '+map.D+'(e)')),context);
 vm.runInContext(overlay.slice(overlay.indexOf('function yimeiClearDragLook()'),overlay.indexOf('function '+roles.overlayMap.Df+'(e){')),context);
 function flush(){let count=0;while(commits.length){assert(++count<30);commits.shift()()}}
 function render(next){if(next)props=next;cursor=0;effects=[];result=context[map.E](props);for(const commit of effects)commit();return result}
 return {context,update(next){render(next);flush()},enter(){result.props.onPointerEnter();flush()},leave(){result.props.onPointerLeave();flush()},advance(ms){const until=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();flush()}now=until;flush()},pet:()=>result.props.children[0].props,flush,dispose(){context.yimeiClearDragLook();flush();for(const h of hooks)h?.cleanup?.();assert.equal(timers.size,0);assert.equal([...listeners.values()].reduce((n,s)=>n+s.size,0),0)}};
}
if (path.resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)) {
const source={petId:'custom:yimei',spriteRowCount:11};
const outcomes=[];
for(const state of ['idle','running'])for(const transientState of [undefined,'running-right','running-left']){
 const h=harness();h.update({source,state,transientState});h.enter();
 h.context.yimeiScheduleDragLook(150,30);h.advance(1500);
 const frame=h.pet().lookFrame;
 outcomes.push({inputState:state,hover:true,transientState:transientState??null,state:h.pet().state,lookFrame:frame??null,ok:frame?.rowIndex>=9});h.dispose();
}
if(outcomes.some(r=>!r.ok))console.log(JSON.stringify({runtime,outcomes},null,2));
assert(outcomes.every(r=>r.ok),'Drag hold must show directional look even while hovered and with native drag motion transient');
const directions=[];
for(const state of ['idle','running']){
const h=harness();h.update({source,state});h.enter();
for(let index=0;index<16;index++){
 const a=index*Math.PI/8;
 h.context.yimeiScheduleDragLook(96+60*Math.sin(a),104-60*Math.cos(a));h.flush();
 assert(h.pet().lookFrame==null);
 h.advance(1499);assert(h.pet().lookFrame==null);h.advance(1);
 const frame=h.pet().lookFrame;assert.equal(frame.rowIndex,9+Math.floor(index/8));assert.equal(frame.columnIndex,index%8);assert.equal(h.pet().state,'idle');if(state==='running')directions.push(index);
}
h.leave();
for(const state of ['review','failed','waiting']){
 h.update({source,state});assert.equal(h.pet().state,state);assert(h.pet().lookFrame==null,'Do not override active tasks');
}
h.update({source,state:'idle',transientState:'failed'});assert.equal(h.pet().state,'failed');assert(h.pet().lookFrame==null);
h.context.yimeiClearDragLook();h.flush();h.update({source,state:'idle'});h.enter();assert.equal(h.pet().state,'waving');assert(h.pet().lookFrame==null);h.leave();assert.equal(h.pet().state,'idle');
h.update({source:{petId:'codex',spriteRowCount:11},state:'idle'});h.enter();h.context.yimeiScheduleDragLook(150,30);h.advance(1500);assert.equal(h.pet().state,'jumping');assert(h.pet().lookFrame==null);h.dispose();
}

// Execute the actual packed overlay's pointer-down and pointer-move callbacks,
// including pointer-enter and native transient-state updates (the old test skipped both).
function arrowAt(marker){const at=overlay.indexOf(marker);assert(at>=0,marker);const begin=overlay.lastIndexOf('=e=>{',at)+1,tail=overlay.slice(at).match(/\},[\w$]+\[/),end=tail?at+tail.index:-1;assert(begin>0&&end>begin);return overlay.slice(begin,end+1)}
function callbackEnd(source,start){let depth=0,quote=null;for(let i=source.indexOf('{',start);i<source.length;i++){const c=source[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return i+1;}throw Error('Unterminated actual pointer callback');}
const down=arrowAt('usesOrbPhysics:t,yimeiDragLook:'),move=arrowAt('t.yimeiDragLook&&yimeiScheduleDragLook');
const flags=down.match(/let t=([\w$]+)&&!([\w$]+)/),quick=down.match(/beganOnQuickChatBar:([\w$]+)&&/),samples=move.match(/t\.samples=([\w$]+)\(/);
assert(flags&&quick&&samples,'Pointer callback dependencies');
for(const state of ['idle','running']){
const p=harness(),messages=[];let transientState;
class Element {closest(selector){return selector==='[data-avatar-mascot]'?this:null}setPointerCapture(){}}
Object.assign(p.context,{Element,[flags[1]]:false,[flags[2]]:false,[quick[1]]:false,[roles.overlayMap.Ti]:{current:null},[roles.overlayMap.br]:value=>{transientState=value;p.update({source,state,transientState})},[roles.overlayMap.Or]:{dispatchMessage:(name,data)=>messages.push({name,data})},[roles.overlayMap.Df]:e=>({screenX:e.screenX,screenY:e.screenY,timeMs:e.timeStamp}),[samples[1]]:values=>values});
const nativeDown=vm.runInContext('('+down+')',p.context),nativeMove=vm.runInContext('('+move+')',p.context);
const target=new Element();
const event=(screenX,screenY,clientX=150,clientY=30)=>({target,currentTarget:target,button:0,ctrlKey:false,pointerId:1,screenX,screenY,clientX,clientY,timeStamp:0,preventDefault(){}});
p.update({source,state});p.enter();nativeDown(event(500,500));p.advance(1499);assert(p.pet().lookFrame==null);p.advance(1);assert(p.pet().lookFrame!=null);
nativeMove(event(500,500));assert.equal(messages.filter(m=>m.name==='avatar-overlay-drag-move').length,0,'Keep native hasMoved guard');
p.advance(1000);nativeMove(event(510,500));p.advance(1499);assert.equal(p.pet().state,'running-right');assert(p.pet().lookFrame==null);p.advance(1);assert.equal(p.pet().state,'idle');assert(p.pet().lookFrame!=null);
nativeMove(event(490,500,40,160));p.advance(1500);assert.equal(transientState,'running-left');assert.equal(p.pet().state,'idle');assert(p.pet().lookFrame?.rowIndex===10);
const clearAt=overlay.indexOf('yimeiClearDragLook(),'+roles.overlayMap.Ti+'.current=null');
const endBegin=overlay.lastIndexOf('(e,t)=>{',clearAt),endEnd=callbackEnd(overlay,endBegin);
assert(endBegin>0&&endEnd>endBegin);
const end=overlay.slice(endBegin,endEnd),release=end.match(/velocity:[\w$]+\}=([\w$]+)\(/);
Object.assign(p.context,{HTMLElement:Element});
if(release)Object.assign(p.context,{[release[1]]:n=>({hasMoved:n.hasMoved,releaseSample:n.samples.at(-1),velocity:null})});
else {
 assert.equal(roles.format,'rspack','Native pointer release helper');
 const movement=overlay.match(/function ([\w$]+)\(e,t\)\{if\(e\.hasMoved\)return!0;let [\w$]+=e\.samples\[0\];return[^}]+\}/);
 assert(movement,'Actual inlined release movement calculation');vm.runInContext(movement[0],p.context);
}
vm.runInContext('('+end+')',p.context)(event(490,500,40,160),true);p.flush();
assert.equal(p.context[roles.overlayMap.Ti].current,null);assert.equal(p.pet().state,state==='running'?'running':'waving');assert(p.pet().lookFrame==null);p.dispose();
}
for(const buttonPath of report.buttonPaths??[report.buttonPath]){
 const actual=extractFile(asar,path.normalize(buttonPath)).toString(),h=harness(actual);
 h.update({source,state:'running'});h.enter();assert.equal(h.pet().state,'running');
 h.context.yimeiScheduleDragLook(150,30);h.advance(1499);assert(h.pet().lookFrame==null);h.advance(1);assert(h.pet().lookFrame!=null);h.context.yimeiClearDragLook();h.flush();assert.equal(h.pet().state,'running');h.dispose();
}
console.log(JSON.stringify({ok:true,version:report.version,runtime,buttonVariantsVerified:report.buttonPaths??[report.buttonPath],hoverAndDragTransient:outcomes,allDirections:directions,workingHeldLookAllDirections:directions,holdMs:1500,actualPointerDownAndMove:true,actualPointerTestStates:['idle','running'],movementRestartsHold:true,nativeHasMovedGuardPreserved:true,urgentTaskPriorityPreserved:true,builtinUnaffected:true,releaseClearsLook:true,workingRestoredAfterRelease:true,listenersAndTimersCleaned:true},null,2));
}
