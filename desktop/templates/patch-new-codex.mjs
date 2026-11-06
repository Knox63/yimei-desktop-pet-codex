import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=path.dirname(fileURLToPath(import.meta.url));
const app=path.join(root,'app');
const officialApp="C:/Program Files/WindowsApps/OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0/app";
const original=path.join(officialApp,'resources/app.asar');
const target=path.join(app,'resources/app.asar');
const exe=path.join(app,'ChatGPT.exe');
const sourceAssets=path.join(root,'artwork');
const lib='C:/Yimei/template-dependencies/node_modules/@electron/asar/lib/asar.js';
const { getRawHeader, extractFile, createPackageFromStreams }=await import(pathToFileURL(lib).href);
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const raw=getRawHeader(original);
const paths=[];
function walk(node,prefix='') { for(const [name,entry] of Object.entries(node.files??{})) {const relative=prefix?`${prefix}/${name}`:name;paths.push({relative,entry});if(entry.files)walk(entry,relative);} }
walk(raw.header);
function findChunk(markers) {
 const found=paths.filter(({relative})=>relative.startsWith('webview/assets/')&&relative.endsWith('.js')).filter(({relative})=>{
  // Avoid reading unrelated modules when a distinct chunk name is available.
  if(markers.includes('data-codex-pet-id')&&!path.basename(relative).startsWith('app-initial-'))return false;
  if(markers.includes('transientState')&&!path.basename(relative).startsWith('avatar-mascot-button-'))return false;
  if(markers.includes('avatar-overlay-drag-move')&&!path.basename(relative).startsWith('avatar-overlay-native-page-'))return false;
  const s=extractFile(original,path.normalize(relative)).toString();return markers.every(m=>s.includes(m));
 });
 if(found.length!==1)throw Error('Expected unique chunk: '+markers);
 return found[0].relative;
}
const rendererPath=findChunk(['data-codex-pet-id','Codex pet animation frame is out of range']);
const buttonPath=findChunk(['data-avatar-mascot','transientState']);
const overlayPath=findChunk(['avatar-overlay-drag-move']);
const replacements=new Map();
const edits=[];
function once(source,anchor,next,label) {
 if(source.split(anchor).length!==2)throw Error('Version anchor must be unique: '+label);
 edits.push(label);return source.replace(anchor,next);
}
const metadata=JSON.parse(fs.readFileSync(path.join(sourceAssets,'animation-dense.json')));
if(metadata.petId!=='yimei'||metadata.visualQA!=='pass')throw Error('Unapproved Yimei manifest');
const assets=new Map();
function addAsset(file,expected) {
 const content=fs.readFileSync(path.join(sourceAssets,file));
 if(sha(content)!==expected)throw Error('Artwork hash mismatch: '+file);
 const name='yimei16-'+sha(content).slice(0,16)+'-'+file;
 assets.set('webview/assets/'+name,content);return name;
}
const denseName=addAsset('spritesheet-dense.webp',metadata.sha256);
const hd=[];
for(const [state,spec]of Object.entries(metadata.hdStates??{})) {
 if(spec.visualQA!=='pass'||spec.rows!==1||![8,16].includes(spec.columns))throw Error('Invalid HD metadata: '+state);
 const name=addAsset(spec.path,spec.sha256);
 hd.push(JSON.stringify(state)+':{...'+JSON.stringify(spec)+',src:new URL('+JSON.stringify(name)+',import.meta.url).href}');
}
const accepted=['yimei','custom:yimei','pet_6abc5c83910c81919a032ac9c237320d'];
const identity=`function yimeiIsPet(id){return ${JSON.stringify(accepted)}.includes(id)}`;
const animation=`function yimeiAnimation(state,reduced,petId,loop){
 if(!yimeiIsPet(petId)||reduced)return e5a(state,reduced,loop);
 if(state==='jumping')state='waving';
 if(state==='idle'){const timings=[4200,25,20,20,20,25,50,700];return {frames:timings.map((frameDurationMs,columnIndex)=>({columnIndex,rowIndex:0,frameDurationMs})),loopStartIndex:0};}
 if(state==='failed'){const order=[0,1,2,5,6,7,6,5,2,1],timings=[260,170,180,210,160,300,160,210,180,230];return {frames:order.map((columnIndex,index)=>({columnIndex,rowIndex:5,frameDurationMs:timings[index]})),loopStartIndex:0};}
 const spec={'running-right':[1,180,320],'running-left':[2,180,320],waving:[3,70,70],waiting:[6,110,180],running:[7,170,310],review:[8,110,200]}[state];
 if(!spec)return e5a(state,reduced,loop);
 const forward=IZ(spec[0],8,spec[1],spec[2]);return {frames:[...forward,...forward.slice(1,-1).reverse()],loopStartIndex:0};
}`;
let helper=fs.readFileSync(path.join(root,'yimei-dense-player.js'),'utf8').replace(/\r\n/g,'\n');
// Serve immutable artwork through the same asset protocol as built-in pets;
// keep large base64 strings out of the shared renderer bundle.
const start=helper.indexOf('function yimeiLoadDense()');
const end=helper.indexOf('const yimeiHdLoading',start);
if(start<0||end<0)throw Error('Dense loader boundaries missing');
helper=helper.slice(0,start)+`function yimeiLoadDense(){if(!yimeiDenseLoading){yimeiDenseUrl=yimeiDenseSheet;yimeiDenseLoading=new Promise(resolve=>{const bitmap=new Image();bitmap.onload=()=>resolve(bitmap.naturalWidth===3072&&bitmap.naturalHeight===1872);bitmap.onerror=()=>resolve(false);bitmap.src=yimeiDenseUrl;});}return yimeiDenseLoading;}\n`+helper.slice(end);
helper=once(helper,`const binary=atob(spec.src.split(',')[1]);\n      const url=URL.createObjectURL(new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:'image/webp'}));`,`const url=spec.src;`,'HD protocol loader');
const block=`/*YIMEI16_26_1002_BEGIN*/\n${identity}\nconst yimeiDenseSheet=new URL(${JSON.stringify(denseName)},import.meta.url).href;\nconst yimeiHdSheets={${hd.join(',')}};\n${animation}\n${helper}\n/*YIMEI16_26_1002_END*/\n`;
let renderer=extractFile(original,path.normalize(rendererPath)).toString();
renderer=once(renderer,'function e5a(e,t,n=!1){',block+'function e5a(e,t,n=!1){','renderer helper insertion');
renderer=once(renderer,'p=o.assetRef==null?o.spriteRowCount:FZ.rows;return','p=o.assetRef==null?o.spriteRowCount:FZ.rows,yimeiId=yimeiIsPet(o.petId??o.assetRef)?`custom:yimei`:o.petId??o.assetRef,yimeiBase=o.spritesheetUrl??e[o.assetRef];yimeiIsPet(yimeiId)&&f===`jumping`&&(f=`waving`);return','source identity and jumping alias');
renderer=once(renderer,'let e=u.current;if(e==null)return;if(n!=null){e.style.backgroundPosition=n5a(n,p);return}let t=e5a(f,d,r),i=t.frames,a=0,o=null;',
 'let e=u.current;if(e==null)return;e.style.backgroundImage=`url(${yimeiBase})`;e.style.backgroundSize=p==null?``:`800% ${p*100}%`;if(n!=null){e.style.backgroundPosition=n5a(n,p);if(yimeiIsPet(yimeiId)&&p===11&&(n.rowIndex===9||n.rowIndex===10))return yimeiShowHdLook(e,n,p,yimeiBase);return}let t=yimeiAnimation(f,d,yimeiId,r);if(yimeiCanDense(f,d,yimeiId)&&p===11)return yimeiPlayDense(e,f,t,p,yimeiBase);let i=t.frames,a=0,o=null;','animation effect');
renderer=once(renderer,'},[f,n,r,d,p]),','},[f,n,r,d,p,yimeiId,yimeiBase]),','image/source effect dependencies');
renderer=once(renderer,'style:{backgroundImage:`url(${o.spritesheetUrl??e[o.assetRef]})`,backgroundSize:p==null?void 0:',
 'style:{imageRendering:yimeiIsPet(yimeiId)?`auto`:void 0,backgroundImage:`url(${yimeiBase})`,backgroundSize:p==null?void 0:','high-quality rendering');
replacements.set(rendererPath,Buffer.from(renderer));
fs.writeFileSync(path.join(root,'renderer-helper.generated.mjs'),block);
// Adapt the previously accepted idle/drag behavior without altering React's
// compiler-generated memo slots or the new Quick Chat implementation.
let button=extractFile(original,path.normalize(buttonPath)).toString();
button=once(button,'function E(e){',identity+';function E(e){','button identity helper');
const prelude='ie=ne===void 0?`idle`:ne,[ae,c]=(0,O.useState)(!1),l=re??(ae?`jumping`:ie),u=l===`idle`||l===`running`||l===`waving`,d=i!=null,p;';
const enhanced=`ie=ne===void 0?\`idle\`:ne,[ae,c]=(0,O.useState)(!1),[yimeiLook,yimeiSetLook]=(0,O.useState)(null),[yimeiAmbient,yimeiSetAmbient]=(0,O.useState)(null),yimeiMascotRef=(0,O.useRef)(null),yimeiEnabled=yimeiIsPet(o?.petId??o?.assetRef)&&o?.spriteRowCount===11;
(0,O.useEffect)(()=>{if(!yimeiEnabled){yimeiSetLook(null);return}const listener=event=>{const detail=event.detail;if(detail?.active!==true){yimeiSetLook(null);return}const bounds=yimeiMascotRef.current?.getBoundingClientRect();if(!bounds)return;const dx=detail.x-(bounds.left+bounds.width/2),dy=detail.y-(bounds.top+bounds.height/2);if(Math.hypot(dx,dy)<=1){yimeiSetLook(null);return}const angle=(Math.atan2(dx,-dy)*180/Math.PI+360)%360,index=Math.round(angle/22.5)%16;yimeiSetLook({columnIndex:index%8,frameDurationMs:0,rowIndex:9+Math.floor(index/8)})};window.addEventListener('yimei-drag-look',listener);return ()=>window.removeEventListener('yimei-drag-look',listener)},[yimeiEnabled]);
(0,O.useEffect)(()=>{if(!(yimeiEnabled&&ie==='idle'&&re==null&&!ae&&yimeiLook==null)){yimeiSetAmbient(null);return}let stopped=false,timer=null;const next=()=>{timer=window.setTimeout(()=>{if(stopped)return;const states=['waiting','review'],index=window.__yimeiAmbientIndex??0,state=states[index%states.length];window.__yimeiAmbientIndex=index+1;yimeiSetAmbient(state);timer=window.setTimeout(()=>{if(!stopped){yimeiSetAmbient(null);next()}},state==='review'?5400:1610)},12000+Math.random()*10000)};next();return()=>{stopped=true;if(timer!=null)window.clearTimeout(timer)}},[yimeiEnabled,ie,re,ae,yimeiLook]);
let yimeiDragLooking=yimeiEnabled&&(ie==='idle'||ie==='running')&&(re==null||re==='running-right'||re==='running-left')&&yimeiLook!=null;
let l=yimeiDragLooking?'idle':re??(yimeiEnabled&&ie!=='idle'?ie:ae?'jumping':(yimeiEnabled&&ie==='idle'?yimeiAmbient:null)??ie);yimeiEnabled&&l==='jumping'&&(l='waving');let u=l==='idle'||l==='running'||l==='waving',d=i!=null,p;`;
button=once(button,prelude,enhanced,'button idle scheduler and look hook');
button=once(button,'let y=u?ee:null,b;','let y=yimeiDragLooking?yimeiLook:yimeiEnabled&&ie!==`idle`?null:yimeiEnabled&&yimeiAmbient!=null&&ie===`idle`?null:u?ee:null,b;','button effective look');
button=once(button,'(0,k.jsxs)(`div`,{className:m,"data-avatar-mascot":`true`','(0,k.jsxs)(`div`,{ref:yimeiMascotRef,className:m,"data-avatar-mascot":`true`','button root ref');
replacements.set(buttonPath,Buffer.from(button));
let overlay=extractFile(original,path.normalize(overlayPath)).toString();
const dragHelpers=`function yimeiClearDragLook(){const timer=window.__yimeiDragLookTimer;if(timer!=null)window.clearTimeout(timer);window.__yimeiDragLookTimer=null;window.dispatchEvent(new CustomEvent('yimei-drag-look',{detail:{active:false}}))}
function yimeiScheduleDragLook(x,y){yimeiClearDragLook();window.__yimeiDragLookTimer=window.setTimeout(()=>{window.__yimeiDragLookTimer=null;window.dispatchEvent(new CustomEvent('yimei-drag-look',{detail:{active:true,x,y}}))},1500)}\n`;
overlay=once(overlay,'function Df(e){',dragHelpers+'function Df(e){','drag look helpers');
overlay=once(overlay,'Ti.current=null,br(null);','yimeiClearDragLook(),Ti.current=null,br(null);','drag end cleanup');
overlay=once(overlay,'usesOrbPhysics:t},br(null),Or.dispatchMessage(`avatar-overlay-drag-start`','usesOrbPhysics:t,yimeiDragLook:e.target.closest(`[data-avatar-mascot]`)!=null},br(null),Ti.current.yimeiDragLook?yimeiScheduleDragLook(e.clientX,e.clientY):yimeiClearDragLook(),Or.dispatchMessage(`avatar-overlay-drag-start`','drag start');
overlay=once(overlay,'r<=-4&&br(`running-left`)),Or.dispatchMessage(`avatar-overlay-drag-move`','r<=-4&&br(`running-left`)),t.yimeiDragLook&&yimeiScheduleDragLook(e.clientX,e.clientY),Or.dispatchMessage(`avatar-overlay-drag-move`','drag move');
replacements.set(overlayPath,Buffer.from(overlay));
for(const [name,content]of replacements){const out=path.join(root,'patched-chunks',path.basename(name));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,content);const check=spawnSync(process.execPath,['--check',out],{encoding:'utf8',windowsHide:true});if(check.status!==0)throw Error(check.stderr);}
const fd=fs.openSync(original,'r');const prefix=Buffer.alloc(16);fs.readSync(fd,prefix,0,16,0);fs.closeSync(fd);const dataStart=8+prefix.readUInt32LE(4);
function headerHash(file){const fd=fs.openSync(file,'r'),prefix=Buffer.alloc(16);fs.readSync(fd,prefix,0,16,0);const header=Buffer.alloc(prefix.readUInt32LE(12));fs.readSync(fd,header,0,header.length,16);fs.closeSync(fd);return sha(header);}
const streams=paths.map(({relative,entry})=>{
 if(entry.files)return {type:'directory',path:relative,unpacked:entry.unpacked===true};
 if(entry.link)throw Error('Unexpected ASAR symlink: '+relative);
 const patch=replacements.get(relative);const external=path.join(target+'.unpacked',...relative.split('/'));
 const size=patch?.length??entry.size;const stat=entry.unpacked?fs.statSync(external):{size,mode:entry.executable?0o100755:0o100644,isFile:()=>true,isDirectory:()=>false};
 return {type:'file',path:relative,unpacked:entry.unpacked===true,stat:{...stat,size},streamGenerator:()=>patch?Readable.from([patch]):entry.unpacked?fs.createReadStream(external):entry.size===0?Readable.from([]):fs.createReadStream(original,{start:dataStart+Number(entry.offset),end:dataStart+Number(entry.offset)+entry.size-1})};
});
for(const [name,bytes]of assets)streams.push({type:'file',path:name,unpacked:false,stat:{size:bytes.length,mode:0o100644},streamGenerator:()=>Readable.from([bytes])});
const next=path.join(root,'app-patched.asar');
await createPackageFromStreams(next,streams);
for(const [name,bytes]of [...replacements,...assets])if(sha(extractFile(next,path.normalize(name)))!==sha(bytes))throw Error('Packed file verification failed: '+name);
const oldLayout=paths.filter(p=>p.entry.unpacked).map(p=>p.relative).sort();const newLayout=[];function unpacked(n,p=''){for(const[k,v]of Object.entries(n.files??{})){const r=p?p+'/'+k:k;if(v.unpacked)newLayout.push(r);if(v.files)unpacked(v,r);}}unpacked(getRawHeader(next).header);
if(JSON.stringify(oldLayout)!==JSON.stringify(newLayout.sort()))throw Error('Unpacked layout changed');
const oldHash=headerHash(original),newHash=headerHash(next),binary=fs.readFileSync(exe),text=binary.toString('latin1');
const marker='"file":"resources\\\\app.asar","alg":"SHA256","value":"';
// Electron's PE integrity resource contains the literal JSON escaped backslash.
let index=text.indexOf(marker);let actualMarker=marker;
if(index<0){actualMarker='"file":"resources\\app.asar","alg":"SHA256","value":"';index=text.indexOf(actualMarker);}
if(index<0||text.indexOf(actualMarker,index+actualMarker.length)>=0)throw Error('Unique executable ASAR integrity resource not found');
const hashAt=index+actualMarker.length,embedded=text.slice(hashAt,hashAt+64);
if(embedded!==oldHash&&embedded!==newHash)throw Error('Unexpected executable integrity hash');
if(embedded!==newHash){const backup=path.join(root,'ChatGPT.original.exe');if(!fs.existsSync(backup))fs.copyFileSync(exe,backup);Buffer.from(newHash).copy(binary,hashAt);fs.writeFileSync(exe,binary);}
fs.renameSync(next,target);
const report={ok:true,version:'26.1002.7124.0',internalVersion:JSON.parse(extractFile(original,'package.json')).version,officialApp,app,rendererPath,buttonPath,overlayPath,acceptedPetIds:accepted,artworkRevision:metadata.revision,assetCount:assets.size,patchedFiles:replacements.size,originalHeaderHash:oldHash,patchedHeaderHash:newHash,unpackedFiles:oldLayout.length,edits,activation:'not-started; user approval required before restarting Codex'};
fs.writeFileSync(path.join(root,'patch-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
