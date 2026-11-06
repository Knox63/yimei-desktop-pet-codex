import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inspectRspack,prepareRspack} from './rspack-adapter.mjs';

const home=path.dirname(fileURLToPath(import.meta.url));
export const ENGINE_REVISION=9;
const {getRawHeader,extractFile}=await import(pathToFileURL(path.join(home,'tools/node_modules/@electron/asar/lib/asar.js')).href);
const read=p=>fs.readFileSync(p,'utf8').replace(/^\ufeff+/,'').replace(/\r\n/g,'\n');
const json=p=>JSON.parse(read(p));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const id='[A-Za-z_$][\\w$]*';
function match(s,re,label){const hits=[...s.matchAll(re)];assert.equal(hits.length,1,'Unsupported Codex structure: '+label);return hits[0];}
function once(s,a,b,label=a.slice(0,75)){assert.equal(s.split(a).length,2,'Template anchor: '+label);return s.replace(a,b);}
function rename(s,mapping){return s.replace(/[A-Za-z_$][\w$]*/g,name=>Object.hasOwn(mapping,name)?mapping[name]:name);}
function inside(p){const relative=path.relative(path.join(home,'versions'),p);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Build must stay in managed versions');}
export function inspect(app){
 const file=path.join(app,'resources/app.asar');const header=getRawHeader(file).header;
 if(!Object.keys(header.files.webview.files.assets.files).some(n=>n.startsWith('app-initial-')&&n.endsWith('.js')))return inspectRspack(app);
 const chunks={};
 for(const [key,prefix]of Object.entries({renderer:'app-initial-',button:'avatar-mascot-button-',overlay:'avatar-overlay-native-page-'})){
  const names=Object.keys(header.files.webview.files.assets.files).filter(n=>n.startsWith(prefix)&&n.endsWith('.js'));
  assert.equal(names.length,1,'Unique '+key+' chunk required');
  chunks[key]=extractFile(file,path.normalize('webview/assets/'+names[0])).toString();
 }
 const r=chunks.renderer,b=chunks.button,o=chunks.overlay;
 const animation=match(r,new RegExp(`function (${id})\\(e,t,n=!1\\)\\{let r=(${id})\\[e\\];if\\(t\\)return\\{frames:`, 'g'),'animation');
 const generator=match(r,new RegExp(`function (${id})\\(e,t,n,r\\)\\{return Array\\.from\\(\\{length:t\\},\\(i,a\\)=>\\(\\{columnIndex:a,frameDurationMs:a===t-1\\?r:n,rowIndex:e\\}\\)\\)\\}`, 'g'),'frame generator');
 const layout=match(r,new RegExp(`p=o\\.assetRef==null\\?o\\.spriteRowCount:(${id})\\.rows;return`, 'g'),'layout');
 const position=match(r,new RegExp(`if\\(n!=null\\)\\{e\\.style\\.backgroundPosition=(${id})\\(n,p\\);return\\}let t=(${id})\\(f,d,r\\)`, 'g'),'position');
 assert.equal(position[2],animation[1]);
 const initializer=match(r,new RegExp(`function (${id})\\(\\)\\{return\\(\\1=(?:${id})\\(\\(\\(\\)=>\\{(${id})\\(\\),(${id})\\(\\),(${id})=(${id})\\(\\),(${id})\\(\\),(${id})\\(\\),(${id})\\(\\),(${id})=(${id})\\(\\),(${id})=\\(\\{assetMap:e,className:t,lookFrame:n,loop:r=!1`, 'g'),'component initializer');
 const moduleLoader=initializer[0].match(new RegExp(`^function ${id}\\(\\)\\{return\\(${id}=(${id})\\(`))[1];
 const reduced=match(r,new RegExp(`u=\\(0,${initializer[4].replaceAll('$','\\$')}\\.useRef\\)\\(null\\),d=(${id})\\(\\),f=i&&c`, 'g'),'reduced motion');
 const classNames=match(r,new RegExp(`className:(${id})\\((${id})\\.Root,a===\x60container\x60&&\\2\\.Container,t\\)`, 'g'),'class names');
 const boundary=match(r,new RegExp(`function (${id})\\(e,t,n=(${id})\\.version\\)\\{if\\(n!==${layout[1].replaceAll('$','\\$')}\\.version`, 'g'),'renderer boundary');
 const rendererMap={e5a:animation[1],IZ:generator[1],FZ:layout[1],n5a:position[1],g5a:initializer[1],Ri:initializer[2],OBe:initializer[3],rf:initializer[5],$8a:initializer[7],Z:initializer[10],h5a:initializer[11],uFe:reduced[1],gl:classNames[1],_5a:boundary[1]};
 const buttonInit=match(b,new RegExp(`function (${id})\\(e\\)\\{let t=\\(0,(${id})\\.c\\)\\(20\\),\\{ariaLabel:n,className:r,lookFrame:ee,notificationBadge:i,onContextMenu:a,source:o,state:(${id}),style:(${id}),transientState:(${id})\\}=e,(${id})=\\3===void 0\\?\x60idle\x60:\\3,\\[(${id}),(${id})\\]=\\(0,(${id})\\.useState\\)\\(!1\\),(${id})=\\5\\?\\?\\(\\7\\?\x60jumping\x60:\\6\\),(${id})=\\10===\x60idle\x60\\|\\|\\10===\x60running\x60\\|\\|\\10===\x60waving\x60,(${id})=i!=null,(${id});`, 'g'),'button hooks');
 const jsx=match(b,new RegExp(`\\(0,(${id})\\.jsxs\\)\\(\x60div\x60,\\{className:(${id}),"data-avatar-mascot":\x60true\x60`, 'g'),'button root');
 const pet=match(b,new RegExp(`\\(0,${jsx[1]}\\.jsx\\)\\((${id}),\\{assetMap:(${id}),className:\x60codex-avatar-root`, 'g'),'button pet');
 const css=match(b,new RegExp(`=(${id})\\(\x60codex-avatar-button relative`, 'g'),'button classes');
 const badge=match(b,new RegExp(`\\(0,${jsx[1]}\\.jsx\\)\\((${id}),\\{notificationBadge:i\\}\\)`, 'g'),'button boundary');
 const effectiveLook=match(b,new RegExp(`let (${id})=${buttonInit[11].replaceAll('$','\\$')}\\?ee:null,(${id});`, 'g'),'button effective look');
 const buttonMap={E:buttonInit[1],ce:buttonInit[2],ne:buttonInit[3],re:buttonInit[5],ie:buttonInit[6],ae:buttonInit[7],c:buttonInit[8],O:buttonInit[9],l:buttonInit[10],u:buttonInit[11],d:buttonInit[12],p:buttonInit[13],k:jsx[1],m:jsx[2]};
 const buttonLook={variable:effectiveLook[1],memo:effectiveLook[2]};
 const buttonTestMap={E:buttonInit[1],D:badge[1],O:buttonInit[9],ce:buttonInit[2],k:jsx[1],te:css[1],h:pet[1],f:pet[2]};
 const dragEnd=match(o,new RegExp(`(${id})\\.current=null,(${id})\\(null\\);let r=null;e\\.currentTarget`, 'g'),'drag end');
 const dragStart=match(o,new RegExp(`samples:\\[(${id})\\(e\\)\\],screenX:e\\.screenX,screenY:e\\.screenY,usesOrbPhysics:t\\},(${id})\\(null\\),(${id})\\.dispatchMessage\\(\x60avatar-overlay-drag-start\x60`, 'g'),'drag start');
 assert.equal(dragStart[2],dragEnd[2]);
 const dragMove=match(o,new RegExp(`r<=-4&&${dragEnd[2]}\\(\x60running-left\x60\\)(\\)+,)(t\\.hasMoved&&)?${dragStart[3]}\\.dispatchMessage\\(\x60avatar-overlay-drag-move\x60`, 'g'),'drag move');
 const overlayMap={Df:dragStart[1],Ti:dragEnd[1],br:dragEnd[2],Or:dragStart[3]};
 const dispatchPrefix=(dragMove[2]??'')+dragStart[3]+'.dispatchMessage';
 return {moduleLoader,rendererMap,buttonMap,buttonLook,buttonTestMap,overlayMap,dragMoveAnchor:dragMove[0],dragMoveReplacement:dragMove[0].replace(dispatchPrefix,`t.yimeiDragLook&&yimeiScheduleDragLook(e.clientX,e.clientY),${dispatchPrefix}`),internalVersion:JSON.parse(extractFile(file,'package.json')).version};
}
export function prepare(app,version,root,artworkSource=path.join(home,'artwork')){
 assert.match(version,/^\d+\.\d+\.\d+\.\d+$/);inside(root);
 const roles=inspect(app);fs.mkdirSync(root,{recursive:true});
 const artworkReal=fs.realpathSync(artworkSource),artworkRelative=path.relative(home,artworkReal);
 assert(artworkRelative&&!artworkRelative.startsWith('..')&&!path.isAbsolute(artworkRelative),'Artwork source must stay in this manager workspace');
 fs.cpSync(artworkReal,path.join(root,'artwork'),{recursive:true});
 const meta=json(path.join(root,'artwork/animation-dense.json'));
 const approvedRunning='7c54ed4fa3d183a96e191e817685449afa928ebae314c4dd2ee57e27f15a7015';
 if(meta.hdStates.running.sha256!==approvedRunning){
  const sr=meta.superResolution,qa=json(path.join(root,'artwork/super-resolution-report.json'));
  assert(['realesr-animevideov3-2x-preserve-poses','realesrgan-anime6b-detail-refinement-v2'].includes(sr?.method));
  assert.equal(sr.method,qa.method);
  if(sr.method==='realesrgan-anime6b-detail-refinement-v2'){
   const detail=sr.detailRefinement;
   assert(detail?.optimizedFrames===112&&detail.notRepeatedUpscaling&&detail.sourceWasOriginal288px);
   assert.equal(detail.previousManifestSha256,'10b289747102a2bfd207badbc21215960f872c7cd8b42da9b0886a6db8b20997');
   for(const [state,expected]of Object.entries({waiting:'be4d47777ea38d5f3b114c9f674124868da6d10d71d43f90abf12f60a6f02e8f',review:'906d1b64c876bb5307c1adb6dee8bc4b1d875934eaf49636199ee758b0d3816c'})){
    assert.equal(meta.hdStates[state].sha256,expected,state+' approved reference must stay exact');
    assert.equal(detail.referenceStatesUnchanged[state],expected);
   }
   assert.equal(Object.keys(detail.profiles).length,8);
   for(const profile of Object.values(detail.profiles))assert(profile.fixedAcrossAllFrames&&profile.strength>0&&profile.strength<=.85&&profile.model==='realesrgan-x4plus-anime');
  }
  assert.equal(sr.sourceStates.running.sha256,approvedRunning,'SR must derive from the approved crown-only motion');
  assert(qa.ok&&qa.visualQA==='pass'&&qa.noGeneratedPoses&&qa.frames===144,'Inspected per-frame SR report required');
  assert.equal(qa.sourceManifestSha256,'bc3cbf09434b46b876f06f4a2889cc15de3c2fd3253d5560ceab8a6cfc737535');
  assert.equal(meta.baseSha256,'686f051269f080088cdac8f586855490bc5d3944bf982158202c7928ab0aa3c8');
  assert.equal(meta.sha256,'d8e7875cc72dbc430ec30698ad49a460d884820241a22ade9d187a53e1bf5ce5');
  assert.equal(Object.keys(meta.hdStates).length,10);
  for(const [state,spec]of Object.entries(meta.hdStates)){
   const before=sr.sourceStates[state],result=qa.states[state];
   const staticDirection=sr.method==='realesrgan-anime6b-detail-refinement-v2'&&state.startsWith('look-');
   const temporalOK=staticDirection?result.temporalCheck==='not-applicable-static-look-directions':result.maxTemporalResidualMAE<5;
   assert(result.ok&&result.alphaResampleExact&&result.losslessRoundtrip&&result.maxOpaqueDownsampleMAE<8&&temporalOK,state+' SR preservation');
   assert.equal(result.sourceSha256,before.sha256);assert.equal(result.sha256,spec.sha256);
   assert.equal(spec.columns,before.columns);assert.equal(result.columns,spec.columns);
   assert.deepEqual([spec.cellWidth,spec.cellHeight,spec.density],[576,624,3]);
   assert.equal(hash(fs.readFileSync(path.join(root,'artwork',spec.path))),spec.sha256,state+' SR bytes');
  }
 }
 assert.equal(hash(fs.readFileSync(path.join(root,'artwork/running-hd-clarity.webp'))),meta.hdStates.running.sha256);
 fs.copyFileSync(path.join(home,'templates/yimei-dense-player.js'),path.join(root,'yimei-dense-player.js'));
 if(roles.format==='rspack')return prepareRspack(home,app,version,root,roles);
 let patch=read(path.join(home,'templates/patch-new-codex.mjs'));
 patch=once(patch,"const officialApp=\"C:/Program Files/WindowsApps/OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0/app\";",'const officialApp='+JSON.stringify(app)+';');
 patch=once(patch,"const lib='C:/Yimei/template-dependencies/node_modules/@electron/asar/lib/asar.js';",'const lib='+JSON.stringify(path.join(home,'tools/node_modules/@electron/asar/lib/asar.js'))+';');
 let bs=patch.indexOf('let button=extractFile('),be=patch.indexOf('replacements.set(buttonPath,Buffer.from(button));',bs);
 let os=patch.indexOf('let overlay=extractFile('),oe=patch.indexOf('replacements.set(overlayPath,Buffer.from(overlay));',os);
 assert(bs>0&&be>bs&&os>be&&oe>os);
 let button=rename(patch.slice(bs,be),roles.buttonMap);
 // Only rename these two native declaration anchors. A global y -> b rewrite
 // would corrupt the independent CustomEvent detail.y coordinate property.
 let lookEdits=0;
 button=button.replace(/'let y=([^'\r\n]*),b;'/g,(_,expression)=>{lookEdits++;return "'let "+roles.buttonLook.variable+'='+expression+','+roles.buttonLook.memo+";'"});
 assert.equal(lookEdits,2,'Both button look declaration anchors required');
 assert(button.includes('detail.x')&&button.includes('detail.y'),'Event coordinate properties must stay unchanged');
 let overlay=rename(patch.slice(os,oe),roles.overlayMap);
 const moveStart=overlay.indexOf("overlay=once(overlay,'r<=-4"),moveEnd=overlay.indexOf('\n',moveStart);
 assert(moveStart>=0&&moveEnd>moveStart);
 overlay=overlay.slice(0,moveStart)+`overlay=once(overlay,${JSON.stringify(roles.dragMoveAnchor)},${JSON.stringify(roles.dragMoveReplacement)},'drag move');`+overlay.slice(moveEnd);
 patch=rename(patch.slice(0,bs),{e5a:roles.rendererMap.e5a,IZ:roles.rendererMap.IZ,FZ:roles.rendererMap.FZ,n5a:roles.rendererMap.n5a})+button+patch.slice(be,os)+overlay+patch.slice(oe);
 patch=patch.replaceAll('YIMEI16_26_1002','YIMEI16_AUTO');
 patch=once(patch,"version:'26.1002.7124.0'",'version:'+JSON.stringify(version));
 patch=once(patch,'for(const [name,content]of replacements){',"if(process.argv.includes('--preflight')){console.log('All structural patch anchors passed');process.exit(0);}\nfor(const [name,content]of replacements){");
 fs.writeFileSync(path.join(root,'patch-new-codex.mjs'),patch);
 let renderer=rename(read(path.join(home,'templates/test-new-renderer.mjs')),roles.rendererMap).replaceAll('YIMEI16_26_1002','YIMEI16_AUTO');
 renderer=once(renderer,'function e(factory){','function '+roles.moduleLoader+'(factory){','renderer test module loader');
 renderer=once(renderer,"'file:///C:/Yimei/template-dependencies/node_modules/playwright/index.mjs'",JSON.stringify(pathToFileURL(path.join(home,'tools/node_modules/playwright/index.mjs')).href));
 renderer=once(renderer,"const lib='C:/Yimei/template-dependencies/node_modules/@electron/asar/lib/asar.js';",'const lib='+JSON.stringify(path.join(home,'tools/node_modules/@electron/asar/lib/asar.js'))+';');
 fs.writeFileSync(path.join(root,'test-new-renderer.mjs'),renderer);
 let behavior=rename(read(path.join(home,'templates/test-new-behavior.mjs')),{...roles.buttonTestMap,Df:roles.overlayMap.Df});
 behavior=once(behavior,"pathToFileURL('C:/Yimei/template-dependencies/node_modules/@electron/asar/lib/asar.js')",'pathToFileURL('+JSON.stringify(path.join(home,'tools/node_modules/@electron/asar/lib/asar.js'))+')');
 behavior=once(behavior,'"C:/Program Files/WindowsApps/OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0/app/resources/app.asar"',JSON.stringify(path.join(app,'resources/app.asar')));
 behavior=once(behavior,"'C:/Program Files/WindowsApps/OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0/app/resources/app.asar.unpacked'",JSON.stringify(path.join(app,'resources/app.asar.unpacked')));
 fs.writeFileSync(path.join(root,'test-new-behavior.mjs'),behavior);
 fs.copyFileSync(path.join(home,'templates/Launch-Codex-Yimei16.ps1'),path.join(root,'Launch-Codex-Yimei16.ps1'));
 fs.writeFileSync(path.join(root,'roles.json'),JSON.stringify(roles,null,2));
 return roles;
}
function run(file,root,...args){const result=spawnSync(process.execPath,[path.join(root,file),...args],{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});fs.writeFileSync(path.join(root,file+'.log'),result.stdout+'\n'+result.stderr);if(result.status!==0)throw Error('Validation failed: '+file+'\n'+result.stderr.slice(-2000));}
export function build(app,version,root,artworkSource){
 const roles=prepare(app,version,root,artworkSource);run('patch-new-codex.mjs',root,'--preflight');console.log('Compatible animation structure found; preparing official runtime');
 const target=path.join(root,'app');fs.mkdirSync(target,{recursive:true});
 const copy=spawnSync('robocopy.exe',[app,target,'/E','/XF','app.asar','/COPY:DAT','/DCOPY:DAT','/R:1','/W:1','/NFL','/NDL','/NP','/NJH','/NJS'],{encoding:'utf8',windowsHide:true});
 if(copy.status==null||copy.status>=8)throw Error('Official runtime copy failed: '+copy.status+' '+copy.stdout);
 console.log('Copy complete; installing selected artwork');run('patch-new-codex.mjs',root);
 return verify(app,version,root);
}
export function verify(app,version,root){
 inside(root);const roles=json(path.join(root,'roles.json')),target=path.join(root,'app'),patchReport=json(path.join(root,'patch-report.json'));
 assert.equal(patchReport.version,version,'Validation version');
 assert.equal(hash(Buffer.from(getRawHeader(path.join(app,'resources/app.asar')).headerString)),patchReport.originalHeaderHash,'Official source header must stay unchanged');
 console.log('Verifying native components and animation behavior');run('test-new-behavior.mjs',root);
 console.log('Verifying actual 16-frame playback');run('test-new-renderer.mjs',root);
 const look=spawnSync(process.execPath,[path.join(home,'test-look-regression.mjs'),root],{encoding:'utf8',windowsHide:true});
 if(look.status!==0)throw Error('Directional look regression failed: '+look.stdout+'\n'+look.stderr);
 fs.writeFileSync(path.join(root,'look-test-report.json'),look.stdout);
 const working=spawnSync(process.execPath,[path.join(home,'test-working-regression.mjs'),root],{encoding:'utf8',windowsHide:true});
 if(working.status!==0)throw Error('Working priority regression failed: '+working.stdout+'\n'+working.stderr);
 fs.writeFileSync(path.join(root,'working-test-report.json'),working.stdout);
 if(roles.format==='rspack'){
  const modules=spawnSync(process.execPath,[path.join(home,'test-rspack-modules.mjs'),root],{encoding:'utf8',windowsHide:true});
  if(modules.status!==0)throw Error('Rspack module integration failed: '+modules.stdout+'\n'+modules.stderr);
  fs.writeFileSync(path.join(root,'rspack-module-test-report.json'),modules.stdout);
 }
 for(const name of ['resources/codex.exe','chrome.dll'])assert.equal(hash(fs.readFileSync(path.join(target,name))),hash(fs.readFileSync(path.join(app,name))),name+' official bytes');
 const report=json(path.join(root,'patch-report.json'));
 fs.writeFileSync(path.join(root,'ready.json'),JSON.stringify({ok:true,version,internalVersion:roles.internalVersion,artworkRevision:report.artworkRevision,artworkFingerprint:hash(fs.readFileSync(path.join(root,'artwork/animation-dense.json'))),sourceHeaderHash:report.originalHeaderHash,patchedHeaderHash:report.patchedHeaderHash,officialApp:app,createdAt:new Date().toISOString(),engineRevision:ENGINE_REVISION,validation:'real Chromium button + player working priority, all 16 look directions, drag interactions and unchanged official native resources',started:false},null,2));
 for(const name of ['app-patched.asar.unpacked','patched-chunks','renderer-helper.generated.mjs','rspack-renderer.generated.js','patch-new-codex.mjs.log','test-new-behavior.mjs.log','test-new-renderer.mjs.log']){const p=path.join(root,name);if(fs.existsSync(p)){inside(p);fs.rmSync(p,{recursive:true,force:true});}}
 console.log('Validated '+version+'; ready for next launch');
}
export function cleanStage(root){inside(root);assert(/^\.building-|^\.prepare-check$/.test(path.basename(root)),'Only disposable build stages can be removed');if(fs.existsSync(root))fs.rmSync(root,{recursive:true,force:true});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [mode,app,version,root,artworkSource]=process.argv.slice(2);if(mode==='info')console.log(JSON.stringify({engineRevision:ENGINE_REVISION,manualOnly:true}));else if(mode==='inspect')console.log(JSON.stringify(inspect(app),null,2));else if(mode==='prepare')prepare(app,version,root,artworkSource);else if(mode==='build')build(app,version,root,artworkSource);else if(mode==='verify')verify(app,version,root);else if(mode==='clean')cleanStage(app);else throw Error('Use info, inspect, prepare, build, verify or clean');}
 catch(e){console.error(e.stack);process.exitCode=1;}
}
