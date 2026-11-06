/* Yimei 16-source-frame extension. The standard v2 atlas stays unchanged. */
function yimeiCanDense(state, reduced, petId) {
  return !reduced && (petId === 'yimei' || petId === 'custom:yimei') &&
    ['idle','running-right','running-left','waving','failed','waiting','running','review'].includes(state);
}

const yimeiIdleDenseOrder = [0,1,2,3,6,7,8,12,13,14,15];
const yimeiIdleBlinkMotionMs = 150;
function yimeiIdleCycleMs() {
  return 4000 + Math.random() * 2000;
}
function yimeiIdleProfile(original, dense, blinkIntervalMs, firstCycle = false) {
  // Skip redundant fully closed poses 4-5 and the second closure at 9-11.
  // The eye stays fully closed for one 15 ms step, then reopens smoothly.
  const order = dense ? yimeiIdleDenseOrder : [0,1,2,3,5,6,7];
  const motionDurations = dense ? Array(10).fill(15) : [25,20,15,25,30,35];
  const rowIndex = original.frames[0].rowIndex;
  return {frames:order.map((columnIndex,index)=>({
    columnIndex,rowIndex,
    frameDurationMs:index===0?blinkIntervalMs-(firstCycle?0:yimeiIdleBlinkMotionMs):motionDurations[index-1],
  })),loopStartIndex:0};
}

function yimeiDenseProfile(state, original, idleCycleMs = 5000) {
  const row = original.frames[0].rowIndex;
  const total = original.frames.reduce((sum, frame) => sum + frame.frameDurationMs, 0);
  let order, durations;
  if (state === 'idle') {
    return yimeiIdleProfile(original, true, idleCycleMs);
  } else if (state === 'waving') {
    // Keep the approved face artwork. At the top of the wave, alternate the two
    // adjacent closed-eye smile poses with a slightly shorter hold, then reopen
    // the eyes before lowering the arm.
    order = [0,1,2,3,4,5,6,5,6,5,6,7,8,9,10,11,12,13,14,15];
    durations = [305,70,70,70,80,70,70,70,70,70,70,150,65,65,65,75,75,75,75,300];
  } else if (state === 'failed') {
    // Base frames 3 and 4 are the abrupt hands-down collapse. Skip the matching
    // dense segment, add the two approved face-touch transitions, and bridge through the return poses.
    order = [0,1,2,3,12,11,10,9,8,7,8,9,10,11,12,13,14,15,14,13,12,11,10,9,8,7,8,9,10,11,12,3,2,1];
    durations = [160,50,50,50,50,50,50,50,50,100,50,50,50,50,50,50,50,180,50,50,50,50,50,50,50,100,50,50,50,50,50,50,50,70];
  } else if (state === 'review') {
    // The chin-rest artwork is a half-sweep: return along the same path so the
    // head and hand never jump from the last pose straight back to the first.
    // Play transitions at 100 ms and hold the thoughtful apex for the rest of
    // the 5400 ms cycle, so the 16 distinct poses read as fluid motion.
    order = [...Array.from({length:16}, (_, index) => index),
      ...Array.from({length:14}, (_, index) => 14-index)];
    durations = order.map((index) => 100 + (index === 15 ? 2400 : 0));
  } else if (state === 'running-right') {
    // Restored B artwork from 2026-09-26 is a complete 16-frame cycle.
    // Play its saved forward order at the original 120 ms per frame.
    order = [...Array.from({length:16}, (_, index) => index)];
    durations = order.map(() => 120);
  } else {
    // The pre-13:40 directional art uses the same 16-source/30-step return
    // cadence as the other continuous actions, preserving its original poses.
    order = [...Array.from({length:16}, (_, index) => index),
      ...Array.from({length:14}, (_, index) => 14-index)];
    const hold = Math.max(0, original.frames[7].frameDurationMs-original.frames[0].frameDurationMs);
    durations = order.map(index => (total-hold)/order.length+(index===15?hold:0));
  }
  return {frames:order.map((columnIndex,index)=>({columnIndex,rowIndex:row,
    frameDurationMs:durations[index]})),loopStartIndex:0};
}

let yimeiDenseLoading, yimeiDenseUrl;
function yimeiLoadDense() {
  if (!yimeiDenseLoading) {
    yimeiDenseLoading = new Promise(resolve => {
      if (!yimeiDenseUrl) {
        if (typeof URL!=='undefined' && typeof Blob!=='undefined') {
          const binary=atob(yimeiDenseSheet.slice(yimeiDenseSheet.indexOf(',')+1));
          const bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
          // One document-lifetime Blob URL: avoid multi-megabyte CSS declarations
          // being reparsed/copied whenever background-position changes.
          yimeiDenseUrl=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
        } else yimeiDenseUrl=yimeiDenseSheet;
      }
      const bitmap = new Image();
      bitmap.onload = () => resolve(bitmap.naturalWidth===3072 && bitmap.naturalHeight===1872);
      bitmap.onerror = () => resolve(false);
      bitmap.src = yimeiDenseUrl;
    });
  }
  return yimeiDenseLoading;
}

const yimeiHdLoading = {}, yimeiHdReady = {};
let yimeiHdPreloadStarted = false;
function yimeiLoadHd(state) {
  if (typeof yimeiHdSheets==='undefined' || !yimeiHdSheets[state]) return Promise.resolve(null);
  if (!yimeiHdLoading[state]) yimeiHdLoading[state]=new Promise(resolve=>{
    const spec=yimeiHdSheets[state];
    try {
      const binary=atob(spec.src.split(',')[1]);
      const url=URL.createObjectURL(new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:'image/webp'}));
      const bitmap=new Image();
      bitmap.onload=()=>{
        if(bitmap.naturalWidth!==spec.cellWidth*spec.columns||bitmap.naturalHeight!==spec.cellHeight){URL.revokeObjectURL?.(url);resolve(null);return;}
        // Keep the decoded image alive so switching states does not stall on a
        // first-frame decode or flash the lower-density fallback atlas.
        Promise.resolve(bitmap.decode?.()).catch(()=>{}).then(()=>{
          yimeiHdReady[state]={...spec,url,image:bitmap};resolve(yimeiHdReady[state]);
        });
      };
      bitmap.onerror=()=>{URL.revokeObjectURL?.(url);resolve(null);};
      bitmap.src=url;
    } catch { resolve(null); }
  });
  return yimeiHdLoading[state];
}
function yimeiPreloadHd() {
  if(yimeiHdPreloadStarted || typeof window.requestIdleCallback!=='function') return;
  yimeiHdPreloadStarted=true;
  const states=['waving','running','review','waiting','failed',
    'running-right','running-left','look-9','look-10'];
  const next=()=>{
    const state=states.shift();
    if(!state)return;
    yimeiLoadHd(state).then(()=>window.requestIdleCallback(next,{timeout:1500}));
  };
  window.requestIdleCallback(next,{timeout:1500});
}
function yimeiLoadForState(state) {
  return yimeiLoadDense().then(async dense => {
    if(dense) {
      await yimeiLoadHd(state);
      // Decode the greeting while idle, so its first use does not briefly
      // show the low-resolution base row before switching to the HD row.
      if(state==='idle') {
        void yimeiLoadHd('waving');
        yimeiPreloadHd();
      }
    }
    return dense; // Failed HD decoding falls back to the approved 16-frame atlas.
  });
}

function yimeiShowHdLook(element,frame,rowCount,baseUrl) {
  let stopped=false,observer=null,expected;
  yimeiLoadHd('look-'+frame.rowIndex).then(hd=>{
    if(stopped||!hd)return;
    const draw=()=>{
      element.style.backgroundImage=`url(${hd.url})`;
      element.style.backgroundSize='800% 100%';
      element.style.backgroundPosition=`${frame.columnIndex/7*100}% 0%`;
      element.dataset.yimeiPixelDensity=String(hd.density);
      expected=element.getAttribute?.('style');
    };
    draw();
    if(typeof MutationObserver!=='undefined'){
      observer=new MutationObserver(()=>{if(stopped||element.getAttribute('style')===expected)return;observer.disconnect();draw();observer.observe(element,{attributes:true,attributeFilter:['style']});});
      observer.observe(element,{attributes:true,attributeFilter:['style']});
    }
  });
  return ()=>{stopped=true;observer?.disconnect();element.style.backgroundImage=`url(${baseUrl})`;element.style.backgroundSize=`800% ${rowCount*100}%`;delete element.dataset.yimeiPixelDensity;};
}

function yimeiPlayDense(element, state, original, rowCount, baseUrl) {
  let stopped = false, timer = null, raf = null, lastFrame = null, lastDense = false;
  const originalImage = `url(${baseUrl})`;
  const originalSize = `800% ${rowCount*100}%`;
  const draw = (frame, dense) => {
    lastFrame=frame;lastDense=dense;
    const hd=dense&&yimeiHdReady[state];
    const image=dense ? `url(${hd?hd.url:yimeiDenseUrl})` : originalImage;
    const size=hd ? '1600% 100%' : dense ? '1600% 900%' : originalSize;
    if(element.style.backgroundImage!==image)element.style.backgroundImage=image;
    if(element.style.backgroundSize!==size)element.style.backgroundSize=size;
    element.style.backgroundPosition = `${frame.columnIndex/(dense?15:7)*100}% ${hd?0:frame.rowIndex/((dense?9:rowCount)-1)*100}%`;
    element.dataset.yimeiFrameCount = dense ? '16' : '8';
    element.dataset.yimeiFrame = String(frame.columnIndex);
    element.dataset.yimeiPixelDensity=hd?String(hd.density):'1';
  };
  // A cached HD row can start on its actual first pose immediately.
  const primed = Boolean(yimeiDenseUrl && yimeiHdReady[state]);
  draw(primed ? yimeiDenseProfile(state, original).frames[0] : original.frames[0], primed);
  let expectedStyle=element.getAttribute?.('style');
  const observer=typeof MutationObserver==='undefined'?null:new MutationObserver(()=>{
    if(stopped || element.getAttribute('style')===expectedStyle) return;
    observer.disconnect();
    draw(lastFrame,lastDense);
    expectedStyle=element.getAttribute('style');
    observer.observe(element,{attributes:true,attributeFilter:['style']});
  });
  observer?.observe(element,{attributes:true,attributeFilter:['style']});
  const start = dense => {
    if (stopped) return;
    let frames, ends, total;
    const makeCycle = firstCycle => {
      const profile = state==='idle'
        ? yimeiIdleProfile(original,dense,yimeiIdleCycleMs(),firstCycle)
        : dense ? yimeiDenseProfile(state,original) : original;
      frames=profile.frames;ends=[];total=0;
      for(const frame of frames)ends.push(total+=frame.frameDurationMs);
    };
    makeCycle(true);
    let epoch = performance.now();
    let last = -1;
    const tick = () => {
      if (stopped) return;
      // A new random wait is chosen after every blink. When a hidden window
      // resumes, restart the wait instead of replaying stale blinks in a burst.
      if(state==='idle' && performance.now()-epoch>=total){
        epoch=performance.now();makeCycle(false);last=-1;
      }
      const phase = (performance.now()-epoch)%total;
      let index = ends.findIndex(end => end>phase);
      if (index<0) index=0;
      if (index!==last) { draw(frames[index],dense); expectedStyle=element.getAttribute?.('style'); last=index; }
      // Sleep through long holds, then align actual frame changes to paints.
      // Absolute time still skips stale frames after a hidden window resumes.
      const remaining=ends[index]-phase;
      if(typeof window.requestAnimationFrame==='function' && remaining<=32)
        raf=window.requestAnimationFrame(tick);
      else timer=window.setTimeout(tick,Math.max(1,remaining-(typeof window.requestAnimationFrame==='function'?32:0)));
    };
    tick();
  };
  yimeiLoadForState(state).then(start);
  return () => {
    stopped=true;
    observer?.disconnect();
    if(timer!==null) window.clearTimeout(timer);
    if(raf!==null) window.cancelAnimationFrame?.(raf);
    element.style.backgroundImage=originalImage;
    element.style.backgroundSize=originalSize;
    delete element.dataset.yimeiFrameCount;
    delete element.dataset.yimeiFrame;
    delete element.dataset.yimeiPixelDensity;
  };
}
