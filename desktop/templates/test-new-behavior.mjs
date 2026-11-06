import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL}from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const {extractFile,getRawHeader}=await import(pathToFileURL('C:/Yimei/template-dependencies/node_modules/@electron/asar/lib/asar.js').href);
const asar=path.join(dir,'app/resources/app.asar');const report=JSON.parse(fs.readFileSync(path.join(dir,'patch-report.json')));
const button=extractFile(asar,path.normalize(report.buttonPath)).toString();
const overlay=extractFile(asar,path.normalize(report.overlayPath)).toString();
const code=button.slice(button.indexOf('function yimeiIsPet'),button.indexOf('function D(e)'));
let hooks=[],cursor=0,effects=[],cache=Array(20).fill(Symbol.for('react.memo_cache_sentinel')),props,result,rendering=false;
let now=0,id=0;const timers=new Map(),listeners=new Map();
const window={setTimeout(fn,delay){const key=++id;timers.set(key,{fn,at:now+delay});return key},clearTimeout(key){timers.delete(key)},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn)},removeEventListener(name,fn){listeners.get(name)?.delete(fn)},dispatchEvent(event){for(const fn of listeners.get(event.type)??[])fn(event)}};
const commits=[];
const M={useState(initial){const index=cursor++;hooks[index]??={value:initial};return[hooks[index].value,value=>{if(Object.is(hooks[index].value,value))return;hooks[index].value=value;commits.push(render)}]},useRef(value){const index=cursor++;hooks[index]??={current:value};return hooks[index]},useEffect(fn,deps){const index=cursor++;const previous=hooks[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i])))effects.push(()=>{previous?.cleanup?.();hooks[index]={deps,cleanup:fn()}})}};
const context=vm.createContext({window,O:M,ce:{c:()=>cache},te:(...values)=>values.filter(Boolean).join(' '),f:{},h:props=>({tag:'pet',props}),k:{jsx:(tag,props)=>typeof tag==='function'?tag(props):({tag,props}),jsxs:(tag,properties)=>{if(properties.ref)properties.ref.current={getBoundingClientRect:()=>({left:0,top:0,width:192,height:208})};return{tag,props:properties}}},Math:Object.assign(Object.create(Math),{random:()=>0}),CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}}});
vm.runInContext(code,context);
vm.runInContext(overlay.slice(overlay.indexOf('function yimeiClearDragLook()'),overlay.indexOf('function Df(e){')),context);
function flush(){let count=0;while(commits.length){if(++count>30)throw Error('Render loop');commits.shift()()}}
function render(next){if(next)props=next;cursor=0;effects=[];result=context.E(props);for(const commit of effects)commit();return result}
function update(next){render(next);flush();return result}
function advance(ms){const limit=now+ms;let loops=0;while(true){const next=[...timers].filter(([,t])=>t.at<=limit).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++loops>100)throw Error('Timer loop');now=next[1].at;timers.delete(next[0]);next[1].fn();flush()}now=limit;flush()}
const petId='pet_6abc5c83910c81919a032ac9c237320d';const source={petId,spriteRowCount:11};
const state=()=>result.props.children[0].props.state;
update({source,state:'idle'});assert.equal(state(),'idle');assert.equal(timers.size,1);
advance(12000);assert.equal(state(),'waiting');advance(1610);assert.equal(state(),'idle');advance(12000);assert.equal(state(),'review');
update({source,state:'running'});assert.equal(state(),'running');assert.equal(timers.size,0);advance(10000);assert.equal(state(),'running');
update({source,state:'idle',transientState:'failed'});assert.equal(state(),'failed');assert.equal(timers.size,0);
update({source,state:'idle'});result.props.onPointerEnter();flush();assert.equal(state(),'waving');assert.equal(timers.size,0);result.props.onPointerLeave();flush();assert.equal(state(),'idle');
context.yimeiScheduleDragLook(50,90);advance(1499);assert(result.props.children[0].props.lookFrame==null);advance(1);assert(result.props.children[0].props.lookFrame.rowIndex>=9);assert.equal(state(),'idle');
context.yimeiScheduleDragLook(80,95);flush();assert(result.props.children[0].props.lookFrame==null);flush();advance(1000);context.yimeiScheduleDragLook(100,110);advance(1001);assert(result.props.children[0].props.lookFrame==null);advance(499);assert(result.props.children[0].props.lookFrame.rowIndex>=9);
update({source,state:'review'});assert.equal(state(),'review');assert(result.props.children[0].props.lookFrame==null);context.yimeiClearDragLook();flush();assert.equal(state(),'review');
update({source:{petId:'codex',spriteRowCount:11},state:'idle'});assert.equal(state(),'idle');assert.equal(timers.size,0);result.props.onPointerEnter();flush();assert.equal(state(),'jumping');
for(const hook of hooks)hook?.cleanup?.();assert.equal(timers.size,0);assert.equal([...listeners.values()].reduce((sum,set)=>sum+set.size,0),0);
function list(header){const map=new Map();function walk(node,p=''){for(const[k,v]of Object.entries(node.files??{})){const name=p?p+'/'+k:k;if(v.files)walk(v,name);else map.set(name,v)}}walk(header);return map}
const original=list(getRawHeader("C:/Program Files/WindowsApps/OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0/app/resources/app.asar").header);
const packed=list(getRawHeader(asar).header);const modified=new Set([report.rendererPath,report.buttonPath,report.overlayPath]);let unchanged=0,native=0;
for(const[name,entry]of original){const next=packed.get(name);assert(next,name+' missing');if(modified.has(name))continue;assert.equal(next.size,entry.size,name+' size');if(entry.unpacked){const physical=path.join(asar+'.unpacked',...name.split('/'));const installed=path.join('C:/Program Files/WindowsApps/OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0/app/resources/app.asar.unpacked',...name.split('/'));const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(hash(physical),hash(installed),name+' native bytes differ from official installed package');assert.equal(next.integrity?.hash,hash(physical),name+' native repack integrity');}else assert.equal(next.integrity?.hash,entry.integrity?.hash,name+' integrity');assert.equal(Boolean(next.unpacked),Boolean(entry.unpacked),name+' unpacked');unchanged++;if(entry.unpacked)native++}
const summary={ok:true,version:report.version,ambientSequence:['waiting','review'],taskPriority:true,hoverWaves:true,dragHoldMs:1500,movementRestartsHold:true,builtinHoverUnchanged:true,listenerAndTimerCleanup:true,untouchedFilesVerified:unchanged,nativeFileRecordsPreserved:native,newAssets:packed.size-original.size};
fs.writeFileSync(path.join(dir,'behavior-test-report.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
