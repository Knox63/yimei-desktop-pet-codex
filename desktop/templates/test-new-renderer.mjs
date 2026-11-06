import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'file:///C:/Yimei/template-dependencies/node_modules/playwright/index.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const lib='C:/Yimei/template-dependencies/node_modules/@electron/asar/lib/asar.js';
const {extractFile,getRawHeader}=await import(pathToFileURL(lib).href);
const asar=path.join(dir,'app/resources/app.asar');
const report=JSON.parse(fs.readFileSync(path.join(dir,'patch-report.json')));
const artwork=JSON.parse(fs.readFileSync(path.join(dir,'artwork/animation-dense.json')));
const roles=JSON.parse(fs.readFileSync(path.join(dir,'roles.json'))),bm=roles.buttonTestMap;
const packedButton=extractFile(asar,path.normalize(report.buttonPath)).toString();
const buttonCode=packedButton.slice(packedButton.indexOf('function yimeiIsPet'),packedButton.indexOf('function '+bm.D+'(e)'));
const renderer=extractFile(asar,path.normalize(report.rendererPath)).toString();
const module=renderer.slice(renderer.indexOf('/*YIMEI16_26_1002_BEGIN*/'),renderer.indexOf('function _5a(e,t,n='));
assert(module.includes('function g5a()'));
const hookRuntime=`
let hooks=[],cursor=0,pendingEffects=[],props,cleanupCount=0,rerenderCount=0;
const M={useState(initial){const index=cursor++;if(!hooks[index])hooks[index]={value:initial};return [hooks[index].value,value=>{if(Object.is(hooks[index].value,value))return;hooks[index].value=value;queueMicrotask(render)}]},useRef(initial){const index=cursor++;if(!hooks[index])hooks[index]={current:initial};return hooks[index]},useEffect(effect,deps){const index=cursor++;const previous=hooks[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i]))){pendingEffects.push(()=>{if(previous?.cleanup){previous.cleanup();cleanupCount++}hooks[index]={deps,cleanup:effect()}})}}};
const GReact=M;function rf(){return GReact}function Ri(){}function OBe(){}function uFe(){return Boolean(window.reduced)}function gl(...parts){return parts.filter(Boolean).join(' ')}
function e(factory){let initialized=false;return ()=>{if(!initialized){initialized=true;factory()}}}
let FZ={columns:8,rows:11};function $8a(){}
const nodes=new Map();
function jsx(tag,properties){if(typeof tag==='function')return tag(properties);const key=properties['data-testid']??properties['data-codex-pet-id']??tag;let node=nodes.get(key);if(!node){node=document.createElement(tag);nodes.set(key,node)}for(const[k,v]of Object.entries(properties)){if(k==='style'){for(const[prop,value]of Object.entries(v??{}))node.style[prop]=value??''}else if(k==='ref'){v.current=node}else if(k==='className')node.className=v;else if(k==='children'){node.replaceChildren(...v.filter(Boolean))}else if(k.startsWith('on'))node[k.toLowerCase()]=v;else if(k.startsWith('data-')||k==='aria-hidden')node.setAttribute(k,v??'')}return node}
function Z(){return {jsx,jsxs:jsx}};
`;
const script=hookRuntime+module+`
g5a();
let buttonMode=false,buttonTree=null;
const buttonMemo=Array(20).fill(Symbol.for('react.memo_cache_sentinel'));
const buttonJSX=(tag,p)=>{if(p.ref)p.ref.current={getBoundingClientRect:()=>({left:0,top:0,width:192,height:208})};return typeof tag==='function'?tag(p):{tag,props:p}};
const buttonGlobals={${JSON.stringify(bm.O)}:M,${JSON.stringify(bm.ce)}:{c:()=>buttonMemo},${JSON.stringify(bm.te)}:(...v)=>v.filter(Boolean).join(' '),${JSON.stringify(bm.f)}:{},${JSON.stringify(bm.h)}:p=>({tag:'pet',props:p}),${JSON.stringify(bm.k)}:{jsx:buttonJSX,jsxs:buttonJSX}};
const actualButton=Function(...Object.keys(buttonGlobals),${JSON.stringify(buttonCode+';return '+bm.E)})(...Object.values(buttonGlobals));
function render(){cursor=0;pendingEffects=[];const petProps=buttonMode?(buttonTree=actualButton(props),buttonTree.props.children[0].props):props;const element=h5a(petProps);element.id='pet';element.style.width='192px';element.style.height='208px';document.body.replaceChildren(element);for(const commit of pendingEffects)commit();rerenderCount++;return element}
window.harness={render(next){props=next;return render()},renderButton(next){if(!buttonMode){window.harness.unmount();buttonMode=true;buttonMemo.fill(Symbol.for('react.memo_cache_sentinel'))}props=next;return render()},hoverButton(){buttonTree.props.onPointerEnter()},unmount(){for(const hook of hooks)hook?.cleanup?.();hooks=[];buttonMode=false;document.body.replaceChildren()},snapshot(){const element=document.querySelector('#pet');return {state:element?.dataset.codexPetState,frame:element?.dataset.yimeiFrame,frames:element?.dataset.yimeiFrameCount,density:element?.dataset.yimeiPixelDensity,size:element?.style.backgroundSize,image:element?.style.backgroundImage,position:element?.style.backgroundPosition,cleanupCount,rerenderCount}},profile(state){const original=yimeiAnimation(state,false,'custom:yimei',false);return yimeiDenseProfile(state,original)},ready(state){return yimeiLoadForState(state)}};
window.harness.hdInfo=state=>{const hd=yimeiHdReady[state];return hd?{width:hd.image.naturalWidth,height:hd.image.naturalHeight,cellWidth:hd.cellWidth,cellHeight:hd.cellHeight,density:hd.density}:null};
window.ready=true;
`;
const cache=new Map();const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f5f6fa"><script type="module" src="/assets/harness.mjs"></script>');return;}
 if(req.url==='/assets/harness.mjs'){res.setHeader('Content-Type','text/javascript');res.end(script);return;}
 const relative='webview'+decodeURIComponent(req.url??'');
 try{if(!cache.has(relative))cache.set(relative,extractFile(asar,path.normalize(relative)));res.setHeader('Content-Type',relative.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(cache.get(relative))}catch{res.statusCode=404;res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:800,height:500}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const failures=[];page.on('response',response=>{if(response.status()>=400)failures.push({url:response.url(),status:response.status()})});
const originalAsset=path.join('webview/assets/',Object.keys(getRawHeader(asar).header.files.webview.files.assets.files).find(n=>n.startsWith('codex-spritesheet-v6-')));
const base='/assets/'+path.basename(originalAsset);
const makeProps=(state='idle',id='pet_6abc5c83910c81919a032ac9c237320d',lookFrame=null)=>({assetMap:{},source:{petId:id,spriteRowCount:11,spritesheetUrl:base},state,lookFrame});
const result={ok:false,version:report.version,source:'actual repacked renderer component; React hooks shim; real Chromium image decode/timers',states:{},errors,failures};
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.ready);
 for(const state of ['idle','running-right','running-left','waving','failed','waiting','running','review']){
  await page.evaluate(props=>window.harness.render(props),makeProps(state));
  await page.waitForFunction(()=>window.harness.snapshot().frames==='16');
  await page.waitForFunction(density=>window.harness.snapshot().density===density,String(artwork.hdStates[state].density));
  const hd=await page.evaluate(state=>window.harness.hdInfo(state),state);
  assert.equal(hd.width,artwork.hdStates[state].cellWidth*16);assert.equal(hd.height,artwork.hdStates[state].cellHeight);
  const profile=await page.evaluate(state=>{const p=window.harness.profile(state);return {order:p.frames.map(f=>f.columnIndex),durations:p.frames.map(f=>f.frameDurationMs),rows:[...new Set(p.frames.map(f=>f.rowIndex))]}},state);
  const expected=state==='idle'?11:state==='failed'?13:16;assert.equal(new Set(profile.order).size,expected,state);
  const visited=new Set();const cycle=profile.durations.reduce((s,n)=>s+n,0);
  if(['running-right','running'].includes(state)){
   const start=Date.now();while(Date.now()-start<cycle+250){const snap=await page.evaluate(()=>window.harness.snapshot());visited.add(Number(snap.frame));assert.equal(snap.size,'1600% 100%');await page.waitForTimeout(35)}
   assert.equal(visited.size,16,state+' actual playback must draw all 16 poses');
  }
  result.states[state]={sourceFrames:new Set(profile.order).size,logicalSteps:profile.order.length,cycleMs:cycle,actualVisited:['running-right','running'].includes(state)?[...visited].sort((a,b)=>a-b):undefined,hd,snapshot:await page.evaluate(()=>window.harness.snapshot())};
 }
 await page.evaluate(props=>window.harness.render(props),makeProps('jumping'));
 await page.waitForFunction(()=>window.harness.snapshot().frames==='16');
 assert.equal((await page.evaluate(()=>window.harness.snapshot())).state,'waving');
 result.hoverAlias='jumping -> waving';
 // Same-state source changes must recreate the effect and restore the new URL.
 await page.evaluate(props=>window.harness.render(props),makeProps('running','codex'));
 const builtin=await page.evaluate(()=>window.harness.snapshot());assert.equal(builtin.frames,undefined);assert.equal(builtin.size,'800% 1100%');result.builtinUnaffected=true;
 await page.evaluate(props=>{window.reduced=true;window.harness.render(props)},makeProps('running'));
 const reduced=await page.evaluate(()=>window.harness.snapshot());assert.equal(reduced.frames,undefined);const position=reduced.position;await page.waitForTimeout(220);assert.equal((await page.evaluate(()=>window.harness.snapshot())).position,position);result.reducedMotionRespected=true;
 result.lookDirections=[];
 for(let index=0;index<16;index++){
  const rowIndex=9+Math.floor(index/8),columnIndex=index%8;
  await page.evaluate(props=>{window.reduced=false;window.harness.render(props)},makeProps('idle','custom:yimei',{rowIndex,columnIndex,frameDurationMs:0}));
  await page.waitForFunction(density=>window.harness.snapshot().density===density,String(artwork.hdStates['look-'+rowIndex].density));
  const hd=await page.evaluate(state=>window.harness.hdInfo(state),'look-'+rowIndex);
  assert.equal(hd.width,artwork.hdStates['look-'+rowIndex].cellWidth*8);assert.equal(hd.height,artwork.hdStates['look-'+rowIndex].cellHeight);
  const look=await page.evaluate(()=>window.harness.snapshot());
  assert.equal(look.size,'800% 100%');assert(look.image.includes('look-'+rowIndex+'-hd-clarity.webp'));assert(Math.abs(parseFloat(look.position)-columnIndex/7*100)<0.001);
  result.lookDirections.push({index,rowIndex,columnIndex,image:look.image,position:look.position});
 }
 result.hdLook=true;
 await page.evaluate(props=>window.harness.render(props),makeProps('running-right'));
 await page.waitForFunction(()=>window.harness.snapshot().frames==='16');
 const snap1=await page.evaluate(()=>window.harness.snapshot());
 await page.evaluate(()=>{const element=document.querySelector('#pet');element.style.backgroundSize='800% 1100%';element.style.backgroundImage='none'});
 await page.waitForFunction(()=>window.harness.snapshot().size==='1600% 100%');result.reactStyleResetRecovered=true;
 // Integrate the actual packed button with the actual renderer. Native look
 // changes and hover must not restart or replace an active working cycle.
 await page.evaluate(props=>window.harness.renderButton(props),makeProps('running','custom:yimei',{rowIndex:9,columnIndex:3,frameDurationMs:0}));
 await page.waitForFunction(()=>window.harness.snapshot().frames==='16');
 await page.evaluate(()=>window.harness.hoverButton());
 const workingVisited=new Set(),workingStarted=Date.now();let lookIndex=0;
 while(Date.now()-workingStarted<2850){
  await page.evaluate(props=>window.harness.renderButton(props),makeProps('running','custom:yimei',{rowIndex:9+Math.floor((lookIndex%16)/8),columnIndex:lookIndex++%8,frameDurationMs:0}));
  const actual=await page.evaluate(()=>window.harness.snapshot());
  assert.equal(actual.state,'running');assert.equal(actual.size,'1600% 100%');assert(actual.image.includes('running-hd-clarity.webp'));
  workingVisited.add(Number(actual.frame));await page.waitForTimeout(35);
 }
 assert.equal(workingVisited.size,16,'Working with hover + native look must actually display all 16 poses');
 result.workingWithHoverAndNativeLook={ok:true,actualVisited:[...workingVisited].sort((a,b)=>a-b),nativeLookUpdates:lookIndex,source:'actual packed button + actual packed renderer; shared hooks shim; real Chromium'};
 // The native overlay's 1.5-second timer is covered by actual callback VM
 // tests. Feed its real event to the actual button/player in Chromium here.
 result.workingHeldLookDirections=[];
 for(let index=0;index<16;index++){
  await page.evaluate(index=>{const angle=index*Math.PI/8;window.dispatchEvent(new CustomEvent('yimei-drag-look',{detail:{active:true,x:96+60*Math.sin(angle),y:104-60*Math.cos(angle)}}))},index);
  const rowIndex=9+Math.floor(index/8),columnIndex=index%8;
  await page.waitForFunction(row=>window.harness.snapshot().image?.includes('look-'+row+'-hd-clarity.webp'),rowIndex);
  const actual=await page.evaluate(()=>window.harness.snapshot());
  assert.equal(actual.state,'idle');assert.equal(actual.size,'800% 100%');assert.equal(actual.density,String(artwork.hdStates['look-'+rowIndex].density));assert(Math.abs(parseFloat(actual.position)-columnIndex/7*100)<0.001);
  result.workingHeldLookDirections.push(index);
 }
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('yimei-drag-look',{detail:{active:false}})));
 await page.waitForFunction(()=>window.harness.snapshot().state==='running'&&window.harness.snapshot().frames==='16');
 const resumedVisited=new Set(),resumedStarted=Date.now();
 while(Date.now()-resumedStarted<2850){const actual=await page.evaluate(()=>window.harness.snapshot());assert.equal(actual.state,'running');assert(actual.image.includes('running-hd-clarity.webp'));resumedVisited.add(Number(actual.frame));await page.waitForTimeout(35)}
 assert.equal(resumedVisited.size,16,'Release after held look must resume all 16 working poses');
 result.workingResumedAfterHeldLook={ok:true,actualVisited:[...resumedVisited].sort((a,b)=>a-b)};
 result.displayScaleChecks=[];
 const cdp=await page.context().newCDPSession(page);
 for(const deviceScaleFactor of [1,1.5,2]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor,mobile:false});
  const display=await page.evaluate(()=>{const e=document.querySelector('#pet');e.style.width='238.08px';e.style.height='257.92px';return {deviceScaleFactor:window.devicePixelRatio,cssWidth:e.getBoundingClientRect().width,cssHeight:e.getBoundingClientRect().height,hd:window.harness.hdInfo('running'),snapshot:window.harness.snapshot()}});
  assert.equal(display.deviceScaleFactor,deviceScaleFactor);assert.equal(display.snapshot.state,'running');
  if(artwork.superResolution){assert(display.hd.cellWidth>=display.cssWidth*deviceScaleFactor);assert(display.hd.cellHeight>=display.cssHeight*deviceScaleFactor)}
  result.displayScaleChecks.push(display);
 }
 await page.screenshot({path:path.join(dir,'playback-verification.png')});
 await page.evaluate(()=>window.harness.unmount());result.effectCleanup=true;
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 result.ok=true;fs.writeFileSync(path.join(dir,'browser-test-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();server.close();}
