function h5a({assetMap:e,className:t,lookFrame:n,loop:r=false,respondToHover:i=false,size:a='default',source:o,state:s='idle'}) {
 const React=rf(),[c,l]=React.useState(false),u=React.useRef(null),d=uFe();
 let f=i&&c?'jumping':s,p=o.assetRef==null?o.spriteRowCount:FZ.rows;
 const yimeiId=yimeiIsPet(o.petId??o.assetRef)?'custom:yimei':o.petId??o.assetRef;
 const yimeiBase=o.spritesheetUrl??e[o.assetRef];
 if(yimeiIsPet(yimeiId)&&f==='jumping')f='waving';
 React.useEffect(()=>{
  const element=u.current;if(element==null)return;
  element.style.backgroundImage=`url(${yimeiBase})`;
  element.style.backgroundSize=p==null?'':`800% ${p*100}%`;
  if(n!=null){element.style.backgroundPosition=n5a(n,p);if(yimeiIsPet(yimeiId)&&p===11&&(n.rowIndex===9||n.rowIndex===10))return yimeiShowHdLook(element,n,p,yimeiBase);return;}
  const animation=yimeiAnimation(f,d,yimeiId,r);
  if(yimeiCanDense(f,d,yimeiId)&&p===11)return yimeiPlayDense(element,f,animation,p,yimeiBase);
  const frames=animation.frames;let index=0,timer=null;
  element.style.backgroundPosition=n5a(yimeiNativeFrame(frames,index),p);
  if(frames.length===1)return;
  const schedule=()=>{timer=window.setTimeout(()=>{const next=index+1;if(next>=frames.length){if(animation.loopStartIndex!=null){index=animation.loopStartIndex;element.style.backgroundPosition=n5a(yimeiNativeFrame(frames,index),p);schedule();}else timer=null;return;}index=next;element.style.backgroundPosition=n5a(yimeiNativeFrame(frames,index),p);schedule();},yimeiNativeFrame(frames,index).frameDurationMs);};
  schedule();return()=>{if(timer!=null)window.clearTimeout(timer);};
 },[f,n,r,d,p,yimeiId,yimeiBase]);
 return Z().jsx('div',{ref:u,className:gl(YIMEI_ROOT_CLASS,a==='container'&&YIMEI_CONTAINER_CLASS,t),'data-codex-pet-asset-ref':o.assetRef,'data-codex-pet-id':o.assetRef??o.petId,'data-codex-pet-state':f,onPointerEnter:()=>{if(i)l(true);},onPointerLeave:()=>{if(i)l(false);},style:{imageRendering:yimeiIsPet(yimeiId)?'auto':undefined,backgroundImage:`url(${yimeiBase})`,backgroundSize:p==null?undefined:`${100*FZ.columns}% ${100*p}%`},'aria-hidden':'true'});
}
