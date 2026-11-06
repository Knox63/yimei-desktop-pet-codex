import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {extractFile,getRawHeader} from './tools/node_modules/@electron/asar/lib/asar.js';

const id='[A-Za-z_$][\\w$]*';
function single(source,regex,label){const hits=[...source.matchAll(regex)];assert.equal(hits.length,1,'Unsupported Codex structure: '+label);return hits[0];}
function replaceOnce(source,anchor,next,label){assert.equal(source.split(anchor).length,2,'Template anchor: '+label);return source.replace(anchor,next);}
export function inspectRspack(app){
 const archive=path.join(app,'resources/app.asar'),files=[];
 function walk(node,prefix=''){for(const[name,entry]of Object.entries(node.files??{})){const relative=prefix?prefix+'/'+name:name;if(entry.files)walk(entry,relative);else if(relative.startsWith('webview/assets/')&&relative.endsWith('.js'))files.push(relative);}}
 walk(getRawHeader(archive).header);
 const hits={renderer:[],button:[],overlay:[]};
 for(const file of files){const code=extractFile(archive,path.normalize(file)).toString();if(code.includes('Codex pet animation frame is out of range')&&code.includes('data-codex-pet-id'))hits.renderer.push({file,code});if(code.includes('data-testid":"avatar-mascot-button"')&&code.includes('transientState'))hits.button.push({file,code});if(code.includes('avatar-overlay-drag-start')&&code.includes('avatar-overlay-drag-release'))hits.overlay.push({file,code});}
 for(const role of ['renderer','overlay'])assert.equal(hits[role].length,1,'Unsupported Codex structure: unique Rspack '+role+' module');
 assert(hits.button.length>0&&hits.button.length<=4,'Unsupported Rspack button duplication');
 const [renderer,button,overlay]=[hits.renderer[0],hits.button[0],hits.overlay[0]];
 assert(renderer.code.includes('export const __webpack_modules__='),'Unsupported renderer bundler');
 const animation=single(renderer.code,new RegExp(`let c=l\\.columns,p=\\[.*?let v=\\(\\{assetMap:e,.*?\\};function E\\(e,t,n=o\\.version\\)`, 'gs'),'Rspack sprite component');
 const componentStart=animation[0].indexOf('let v=');
 const native=animation[0].slice(0,componentStart);
 const component=animation[0].slice(componentStart,animation[0].lastIndexOf(';function E')+1);
 const css=single(component,/className:\(0,i\.A\)\("([^"]+)","container"===d&&"([^"]+)",t\)/g,'Rspack sprite CSS');
 const buttonVariants=hits.button.map(({file,code})=>{
  const module=single(code,/xJjI\(([^)]*)\)\{[^;]*r:\(\)=>([\w$]+),h:\(\)=>([\w$]+)[^;]*;var ([^;]+);/g,'Rspack mascot module');
  const imports=module[4],getImport=name=>single(imports,new RegExp(`(${id})=${id}\\("${name}"\\)`,'g'),'button '+name+' import')[1];
  const start=code.indexOf('function '+module[2]+'('),end=code.indexOf('function '+module[3]+'(',start);
  assert(start>0&&end>start,'Rspack button boundaries');
  const component=code.slice(start,end),parameter=component.match(/^function [\w$]+\(([\w$]+)\)/)[1];
  return{file,component,functionName:module[2],parameter,badgeName:module[3],react:getImport('zd8w'),classes:getImport('on57')+'.A',jsx:getImport('ABep'),assets:getImport('PPl1')+'.A',pet:getImport('DRpS')+'.bH'};
 });
 const drag=single(overlay.code,new RegExp(`samples:\\[(${id})\\(e\\)\\],screenX:e\\.screenX,screenY:e\\.screenY,usesOrbPhysics:t\\},(${id})\\(null\\),(${id})\\.(${id})\\.dispatchMessage\\("avatar-overlay-drag-start"`,'g'),'Rspack drag start');
 const end=single(overlay.code,new RegExp(`(${id})\\.current=null,${drag[2]}\\(null\\);let c=null;`,'g'),'Rspack drag release');
 const bridge=drag[3]+'.'+drag[4];
 const move=single(overlay.code,new RegExp(`i<=-4&&${drag[2]}\\("running-left"\\)\\)\\),t\\.hasMoved&&${bridge.replaceAll('.','\\.')}\\.dispatchMessage\\("avatar-overlay-drag-move"`,'g'),'Rspack drag movement');
 const nativeAnimation=native.replace(/[A-Za-z_$][\w$]*/g,name=>({c:'yimeiNativeColumns',p:'yimeiNativeIdle',h:'yimeiNativeIdleTail',f:'yimeiNativeStates',m:'e5a',g:'yimeiNativeFrame',_:'IZ',y:'n5a',l:'FZ'}[name]??name));
 const nativeSheet=Object.keys(getRawHeader(archive).header.files.webview.files.assets.files).filter(n=>/^codex-spritesheet-v6[.-].*\.webp$/.test(n));assert.equal(nativeSheet.length,1,'Unique native spritesheet');
 return {format:'rspack',moduleLoader:'e',rendererMap:{},rendererPath:renderer.file,buttonPath:button.file,buttonVariants,overlayPath:overlay.file,nativeSpritesheetPath:'webview/assets/'+nativeSheet[0],nativeAnimation,rendererComponent:component,rootClass:css[1],containerClass:css[2],dragMoveAnchor:move[0],overlayMap:{Df:drag[1],Ti:end[1],br:drag[2],Or:'yimeiBridge'},nativeBridge:bridge,buttonTestMap:{E:'yimeiButton',D:'yimeiBadge',O:'yimeiReact',ce:'yimeiMemo',te:'yimeiClasses',h:'yimeiPet',f:'yimeiAssets',k:'yimeiJSX'},internalVersion:JSON.parse(extractFile(archive,'package.json')).version};
}

export function prepareRspack(home,app,version,root,roles){
 const read=name=>fs.readFileSync(path.join(home,'templates',name),'utf8').replace(/\r\n/g,'\n');
 let patch=read('patch-new-codex.mjs');
 patch=replaceOnce(patch,'const officialApp="C:/Program Files/WindowsApps/OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0/app";','const officialApp='+JSON.stringify(app)+';','official source');
 const oldLib="const lib='C:/Yimei/template-dependencies/node_modules/@electron/asar/lib/asar.js';";
 patch=replaceOnce(patch,oldLib,'const lib='+JSON.stringify(path.join(home,'tools/node_modules/@electron/asar/lib/asar.js'))+';','ASAR dependency');
 const findStart=patch.indexOf('function findChunk('),findEnd=patch.indexOf('const replacements=',findStart);
 assert(findStart>0&&findEnd>findStart);
 patch=patch.slice(0,findStart)+['rendererPath','buttonPath','overlayPath'].map(key=>'const '+key+'='+JSON.stringify(roles[key])+';').join('\n')+'\nconst roles=JSON.parse(fs.readFileSync(path.join(root,"roles.json")));\n'+patch.slice(findEnd);
 patch=replaceOnce(patch,"assets.set('webview/assets/'+name,content);return name;","assets.set('webview/assets/'+name,content);return path.posix.relative(path.posix.dirname(rendererPath),'webview/assets/'+name);",'nested asset URLs');
 const enhancedLiteral=single(patch,/const enhanced=(`(?:\\.|[^`])*`);/gs,'approved button hooks')[1];
 const enhanced=Function('return '+enhancedLiteral)();
 const buttonCode=`${'function yimeiIsPet(id){return '+JSON.stringify(['yimei','custom:yimei','pet_6abc5c83910c81919a032ac9c237320d'])+'.includes(id)}'}
function yimeiButton(e){const {ariaLabel:n,className:r,lookFrame:ee,notificationBadge:i,onContextMenu:a,source:o,state:ne,style:s,transientState:re}=e;
const O=yimeiReact;let ${enhanced}
const y=yimeiDragLooking?yimeiLook:yimeiEnabled&&ie!=='idle'?null:yimeiEnabled&&yimeiAmbient!=null&&ie==='idle'?null:u?ee:null;
return yimeiJSX.jsxs('div',{ref:yimeiMascotRef,className:yimeiClasses('codex-avatar-button relative flex cursor-interaction items-center justify-center active:cursor-grabbing',r),'data-avatar-mascot':'true','data-testid':'avatar-mascot-button','aria-hidden':n==null&&!d||undefined,'aria-label':n,role:n!=null?(d?'group':'img'):undefined,onContextMenu:a,onPointerEnter:()=>c(true),onPointerLeave:()=>c(false),style:s,children:[yimeiJSX.jsx(yimeiPet,{assetMap:yimeiAssets,className:'codex-avatar-root relative z-10',lookFrame:y,source:o,state:l}),d?yimeiJSX.jsx(yimeiBadge,{notificationBadge:i}):null]});}
function yimeiBadge(e){return C(e)}
function y(t){return yimeiButton(t)}`;
 let rendererCode=read('rspack-renderer.js').replaceAll('YIMEI_ROOT_CLASS',JSON.stringify(roles.rootClass)).replaceAll('YIMEI_CONTAINER_CLASS',JSON.stringify(roles.containerClass));
 fs.writeFileSync(path.join(root,'rspack-renderer.generated.js'),rendererCode);
 const rendererStart=patch.indexOf('let renderer=extractFile('),patchEnd=patch.indexOf('for(const [name,content]of replacements){',rendererStart);
 assert(rendererStart>0&&patchEnd>rendererStart);
 const modern=`let renderer=extractFile(original,path.normalize(rendererPath)).toString();
const bindings='const FZ=l;function rf(){return s}function uFe(){return (0,a.I)()}function gl(...parts){return (0,i.A)(...parts)}function Z(){return r}';
const moduleCode='/*YIMEI16_AUTO_BEGIN*/\\n'+roles.nativeAnimation+block.replace('/*YIMEI16_26_1002_BEGIN*/','').replace('/*YIMEI16_26_1002_END*/','')+fs.readFileSync(path.join(root,'rspack-renderer.generated.js'),'utf8')+'\\n/*YIMEI16_AUTO_END*/\\n';
renderer=once(renderer,roles.rendererComponent,bindings+moduleCode+'let v=h5a;','Rspack sprite renderer');
replacements.set(rendererPath,Buffer.from(renderer));
for(const variant of roles.buttonVariants){
let button=extractFile(original,path.normalize(variant.file)).toString();
let code=${JSON.stringify(buttonCode)}.replace('return C(e)','return '+variant.badgeName+'(e)').replace('function y(t){return yimeiButton(t)}','function '+variant.functionName+'('+variant.parameter+'){return yimeiButton('+variant.parameter+')}');
const bindings='const yimeiReact='+variant.react+',yimeiClasses='+variant.classes+',yimeiJSX='+variant.jsx+',yimeiAssets='+variant.assets+',yimeiPet='+variant.pet+';';
button=once(button,variant.component,bindings+code,'Rspack mascot interactions '+variant.file);
replacements.set(variant.file,Buffer.from(button));
}
let overlay=extractFile(original,path.normalize(overlayPath)).toString();
const dragHelpers="function yimeiClearDragLook(){const timer=window.__yimeiDragLookTimer;if(timer!=null)window.clearTimeout(timer);window.__yimeiDragLookTimer=null;window.dispatchEvent(new CustomEvent('yimei-drag-look',{detail:{active:false}}))}\\nfunction yimeiScheduleDragLook(x,y){yimeiClearDragLook();window.__yimeiDragLookTimer=window.setTimeout(()=>{window.__yimeiDragLookTimer=null;window.dispatchEvent(new CustomEvent('yimei-drag-look',{detail:{active:true,x,y}}))},1500)}\\n";
overlay=once(overlay,'function '+roles.overlayMap.Df+'(e){','const yimeiBridge='+roles.nativeBridge+';'+dragHelpers+'function '+roles.overlayMap.Df+'(e){','Rspack drag helpers');
overlay=once(overlay,roles.overlayMap.Ti+'.current=null,'+roles.overlayMap.br+'(null);','yimeiClearDragLook(),'+roles.overlayMap.Ti+'.current=null,'+roles.overlayMap.br+'(null);','Rspack release cleanup');
overlay=once(overlay,'usesOrbPhysics:t},'+roles.overlayMap.br+'(null),'+roles.nativeBridge+'.dispatchMessage("avatar-overlay-drag-start"','usesOrbPhysics:t,yimeiDragLook:e.target.closest(\x60[data-avatar-mascot]\x60)!=null},'+roles.overlayMap.br+'(null),'+roles.overlayMap.Ti+'.current.yimeiDragLook?yimeiScheduleDragLook(e.clientX,e.clientY):yimeiClearDragLook(),'+roles.nativeBridge+'.dispatchMessage("avatar-overlay-drag-start"','Rspack pointer down');
overlay=once(overlay,roles.dragMoveAnchor,roles.dragMoveAnchor.replace('t.hasMoved&&','t.yimeiDragLook&&yimeiScheduleDragLook(e.clientX,e.clientY),t.hasMoved&&'),'Rspack pointer movement');
overlay=overlay.replaceAll(roles.nativeBridge+'.dispatchMessage','yimeiBridge.dispatchMessage');
replacements.set(overlayPath,Buffer.from(overlay));
if(process.argv.includes('--preflight')){console.log('All structural patch anchors passed');process.exit(0);}
`;
 patch=patch.slice(0,rendererStart)+modern+patch.slice(patchEnd);
 patch=replaceOnce(patch,"version:'26.1002.7124.0'",'version:'+JSON.stringify(version),'version report');
 patch=replaceOnce(patch,'rendererPath,buttonPath,overlayPath,acceptedPetIds','rendererPath,buttonPath,buttonPaths:roles.buttonVariants.map(v=>v.file),overlayPath,acceptedPetIds','all duplicate button records');
 fs.writeFileSync(path.join(root,'patch-new-codex.mjs'),patch);
 fs.writeFileSync(path.join(root,'roles.json'),JSON.stringify(roles,null,2));
 let renderer=read('test-new-renderer.mjs');
 renderer=renderer.replaceAll('YIMEI16_26_1002','YIMEI16_AUTO');
 renderer=replaceOnce(renderer,"renderer.indexOf('function _5a(e,t,n=')","renderer.indexOf('/*YIMEI16_AUTO_END*/')",'renderer test boundary');
 renderer=replaceOnce(renderer,"assert(module.includes('function g5a()'));","assert(module.includes('function h5a('));",'renderer test component');
 renderer=replaceOnce(renderer,'g5a();','', 'no obsolete lazy module initialization');
 renderer=replaceOnce(renderer,"'file:///C:/Yimei/template-dependencies/node_modules/playwright/index.mjs'",JSON.stringify(new URL('./tools/node_modules/playwright/index.mjs',new URL('file:///'+home.replaceAll('\\','/')+'/')).href),'browser dependency');
 renderer=replaceOnce(renderer,oldLib,'const lib='+JSON.stringify(path.join(home,'tools/node_modules/@electron/asar/lib/asar.js'))+';','test ASAR dependency');
 renderer=renderer.replaceAll('/assets/harness.mjs','/assets/async/harness.mjs');
 renderer=replaceOnce(renderer,".find(n=>n.startsWith('codex-spritesheet-v6-'))",".find(n=>/^codex-spritesheet-v6[.-]/.test(n))",'native atlas filename');
 fs.writeFileSync(path.join(root,'test-new-renderer.mjs'),renderer);
 let behavior=read('test-new-behavior.mjs');
 behavior=replaceOnce(behavior,"const button=extractFile(asar,path.normalize(report.buttonPath)).toString();","const roles=JSON.parse(fs.readFileSync(path.join(dir,'roles.json')));const button=extractFile(asar,path.normalize(report.buttonPath)).toString();",'button role metadata');
 behavior=behavior.replaceAll("button.indexOf('function D(e)')","button.indexOf('function yimeiBadge(e)')").replaceAll("overlay.indexOf('function Df(e){')","overlay.indexOf('function '+roles.overlayMap.Df+'(e){')").replaceAll('result=context.E(props)','result=context.yimeiButton(props)');
 behavior=behavior.replace('window,O:M,ce:', 'window,yimeiReact:M,yimeiMemo:').replace('te:(...values)', 'yimeiClasses:(...values)').replace('f:{},h:props', 'yimeiAssets:{},yimeiPet:props').replace('k:{jsx:', 'yimeiJSX:{jsx:');
 behavior=behavior.replace("pathToFileURL('C:/Yimei/template-dependencies/node_modules/@electron/asar/lib/asar.js')",'pathToFileURL('+JSON.stringify(path.join(home,'tools/node_modules/@electron/asar/lib/asar.js'))+')');
 behavior=behavior.replaceAll('C:/Program Files/WindowsApps/OpenAI.Codex_26.1002.7124.0_x64__2p2nqsd0c76g0/app',app.replaceAll('\\','/'));
 behavior=behavior.replace('new Set([report.rendererPath,report.buttonPath,report.overlayPath])','new Set([report.rendererPath,...report.buttonPaths,report.overlayPath])');
 fs.writeFileSync(path.join(root,'test-new-behavior.mjs'),behavior);
 fs.copyFileSync(path.join(home,'templates/Launch-Codex-Yimei16.ps1'),path.join(root,'Launch-Codex-Yimei16.ps1'));
 return roles;
}
