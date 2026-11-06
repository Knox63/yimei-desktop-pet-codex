import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {extractFile} from './tools/node_modules/@electron/asar/lib/asar.js';

const runtime=process.argv[2],roles=JSON.parse(fs.readFileSync(path.join(runtime,'roles.json')));
assert.equal(roles.format,'rspack');
const archive=path.join(runtime,'app/resources/app.asar');
const source=file=>extractFile(archive,path.normalize(file)).toString();
function modules(file){
 const code=source(file),start=code.indexOf('export const __webpack_modules__=');assert(start>=0);
 const expression=code.slice(start+'export const __webpack_modules__='.length).replace(/;\s*\/\/# sourceMappingURL=[^\n]*\s*$/,'');
 return vm.runInNewContext('('+expression.replaceAll('import.meta.url',JSON.stringify('file:///'+file))+')',{URL,window:{},performance:{now:()=>0},Math,setTimeout,clearTimeout});
}
let cursor=0;const hooks=[];
const React={useState(initial){const i=cursor++;hooks[i]??={value:initial};return[hooks[i].value,value=>{hooks[i].value=value;}];},useRef(value){const i=cursor++;hooks[i]??={current:value};return hooks[i];},useEffect(){cursor++;}};
const jsx=(tag,props)=>typeof tag==='function'?tag(props):({tag,props});
let rendererExports;
const deps={ABep:{jsx,jsxs:jsx},on57:{A:(...parts)=>parts.filter(Boolean).join(' ')},IjbW:{I:()=>false},zd8w:React,QosV:{c:()=>Array(20).fill(Symbol.for('react.memo_cache_sentinel'))},Nwp9:{m3:()=>null},PPl1:{A:{}},LIss:{},y5DF:{},Dh3m:{},OWtl:{},PjJO:{},N0q0:{}};
function requireModule(name){if(name==='DRpS')return rendererExports;assert(Object.hasOwn(deps,name),'Unexpected module dependency '+name);return deps[name];}
requireModule.d=(exports,getters,values)=>{for(const[key,get]of Object.entries(getters))Object.defineProperty(exports,key,{get,enumerable:true});Object.assign(exports,values??{});};
rendererExports={};modules(roles.rendererPath).DRpS({},rendererExports,requireModule);
assert.equal(typeof rendererExports.bH,'function');assert.equal(rendererExports.IO.rows,11);
assert.equal(rendererExports._s('running',false,true).frames.length,6,'Original exported animation contract');
const variants=[];
for(const variant of roles.buttonVariants){
 const exports={};modules(variant.file).xJjI({},exports,requireModule);
 for(const petId of ['custom:yimei','codex'])for(const state of ['idle','running','waiting','review','failed']){
  cursor=0;hooks.length=0;const element=exports.r({source:{petId,spriteRowCount:11,spritesheetUrl:'base.webp'},state});
  assert.equal(element.props['data-testid'],'avatar-mascot-button');
  assert.equal(element.props.children[0].props['data-codex-pet-state'],state);
  assert.equal(typeof element.props.onPointerEnter,'function');
 }
 assert.equal(typeof exports.h,'function','Native notification badge export');
 variants.push(variant.file);
}
console.log(JSON.stringify({ok:true,version:JSON.parse(fs.readFileSync(path.join(runtime,'patch-report.json'))).version,actualRspackFactoriesExecuted:true,rendererExportAndNativeAnimationPreserved:true,buttonVariants:variants,builtinAndYimeiStates:['idle','running','waiting','review','failed']},null,2));
