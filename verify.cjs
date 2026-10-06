const assert = require('node:assert/strict');
const test = require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'pixai-web-queue.user.js'),'utf8'),sandbox);
const {processJob,recover,verifyTask,outputIds,safeName,checkCost,bindPanelDrag,acceptFolder,folderError,bindFolderActivation,pickDirectory,storageSupport}=sandbox.module.exports;
const job=()=>({id:'fixture',prompt:'1girl, smile',title:'미소',state:'queued',saved:[]});
const task=(j,count=4)=>({id:j.taskId,status:'completed',createdAt:new Date(j.submittedAt || Date.now()).toISOString(),parameters:{prompts:j.prompt},outputs:{batch:Array.from({length:count},(_,i)=>({mediaId:String(100+i)}))}});
function fixture(j, overrides={}) {
  const calls=[];
  const io={
    persist(){calls.push(`persist:${j.state}`)},
    async prepare(){calls.push('prepare');return {expected:4}},
    async submit(){calls.push('submit');return '900'},
    async waitTask(current){calls.push('poll');return task(current)},
    async saveImage(current,id){calls.push(`save:${id}`);return `${id}.png`},
    async saveMetadata(){calls.push('metadata')},...overrides
  };
  return {io,calls};
}
test('one paid submit, persistence before click, four files before done',async()=>{
  const j=job(),{io,calls}=fixture(j);await processJob(j,io);
  assert.equal(j.state,'done');assert.equal(j.saved.length,4);
  assert.equal(calls.filter(x=>x==='submit').length,1);
  assert.ok(calls.indexOf('persist:submitting')<calls.indexOf('submit'));
  assert.ok(calls.indexOf('metadata')>calls.indexOf('save:103'));
});
test('lost submission response becomes unknown and cannot automatically replay',async()=>{
  const j=job(),{io,calls}=fixture(j,{submit:async()=>{calls.push('submit');throw new Error('lost response')}});
  await assert.rejects(processJob(j,io));assert.equal(j.state,'unknown');
  await assert.rejects(processJob(j,io));assert.equal(calls.filter(x=>x==='submit').length,1);
});
test('persist failure before click prevents all paid submissions',async()=>{
  const j=job(),{io,calls}=fixture(j,{persist(){throw new Error('quota')}});
  await assert.rejects(processJob(j,io));assert.ok(!calls.includes('submit'));
});
test('saving second image fails; retry saves remaining three without generating',async()=>{
  const j=job();let fail=true;const {io,calls}=fixture(j,{saveImage:async(current,id)=>{
    calls.push(`save:${id}`);if(id==='101'&&fail){fail=false;throw new Error('disk full')}return `${id}.png`;
  }});
  await assert.rejects(processJob(j,io));assert.equal(j.state,'save_failed');assert.equal(j.saved.length,1);
  await processJob(j,io);assert.equal(j.state,'done');assert.equal(j.saved.length,4);
  assert.equal(calls.filter(x=>x==='submit').length,1);assert.equal(calls.filter(x=>x==='save:100').length,1);
});
test('known task on reload resumes only by querying task ID',async()=>{
  const j={...job(),state:'submitting',taskId:'900',expected:4};recover([j]);
  const {io,calls}=fixture(j);await processJob(j,io);assert.ok(!calls.includes('submit'));assert.equal(j.state,'done');
});
test('reload without receipt locks the job for manual reconciliation',()=>{
  const j={...job(),state:'submitting'};recover([j]);assert.equal(j.state,'unknown');
});
test('prompt mismatch never saves another task and never submits again',async()=>{
  const j={...job(),state:'waiting',taskId:'900',expected:4};
  const {io,calls}=fixture(j,{waitTask:async()=>({...task(j),parameters:{prompts:'other'}})});
  await assert.rejects(processJob(j,io));assert.ok(!calls.includes('submit'));assert.ok(!calls.some(x=>x.startsWith('save:')));
});
test('Prompt Helper original text is checked instead of rewritten prompt',()=>{
  const j={...job(),taskId:'900'};verifyTask(j,{id:'900',parameters:JSON.stringify({prompts:'rewritten',extra:{naturalPrompts:j.prompt}})});
});
test('old task with identical prompt cannot be mistaken for new generation',()=>{
  const j={...job(),taskId:'900',submittedAt:Date.now()};const t=task(j);t.createdAt=new Date(j.submittedAt-60000).toISOString();
  assert.throws(()=>verifyTask(j,t));
});
test('missing or duplicate batch member prevents partial success',()=>{
  const j={...job(),taskId:'900'};assert.throws(()=>outputIds(task(j,3),4));
  const t=task(j);t.outputs.batch[3].mediaId='100';assert.throws(()=>outputIds(t,4));
});
test('single output uses its actual media ID, not an assumed batch grid',()=>{
  assert.equal(JSON.stringify(outputIds({outputs:{},mediaId:'100'},1)),JSON.stringify(['100']));
  assert.throws(()=>outputIds({outputs:{},mediaId:'100'},4));
});
test('poll failure retains known ID and retries query only',async()=>{
  const j=job();let fail=true;const {io,calls}=fixture(j,{waitTask:async current=>{
    calls.push('poll');if(fail){fail=false;throw new Error('offline')}return task(current);
  }});
  await assert.rejects(processJob(j,io));assert.equal(j.state,'waiting');assert.equal(j.taskId,'900');
  await processJob(j,io);assert.equal(calls.filter(x=>x==='submit').length,1);
});
test('serial loop cannot prepare next job until previous four files are saved',async()=>{
  const events=[];for(const j of [job(),{...job(),id:'second'}]){
    const {io}=fixture(j,{prepare:async()=>{events.push(`prepare:${j.id}`);return {expected:4}},saveImage:async(current,id)=>{events.push(`save:${j.id}:${id}`);return `${id}.png`}});
    await processJob(j,io);
  }
  assert.ok(events.indexOf('prepare:second')>events.indexOf('save:fixture:103'));
});
test('path separators and traversal text cannot leave the selected folder',()=>{
  assert.equal(safeName('../../A:B?'),'.._.._A_B_');assert.ok(!/[\\/]/.test(safeName('C:\\test/image')));
});
test('approved cost is accepted; larger, unreadable or zero prices stop before click',()=>{
  assert.equal(checkCost('제출 중생성!7,800Ctrl+⏎작업 제출',7800),7800);
  assert.throws(()=>checkCost('생성!8,000Ctrl+',7800));
  assert.throws(()=>checkCost('생성!Ctrl+',7800));
  assert.throws(()=>checkCost('생성!0Ctrl+',7800));
});

function dragFixture(saved=null) {
  const listeners={}, captured=new Set(), writes=[];
  let viewport={width:1000,height:800}, width=340, height=450, resized;
  const target={style:{},getBoundingClientRect:()=>({
    left:parseFloat(target.style.left)||642,top:parseFloat(target.style.top)||332,width,height
  })};
  const handle={dataset:{},addEventListener:(type,fn)=>{listeners[type]=fn},
    setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
  bindPanelDrag(target,handle,{viewport:()=>viewport,load:()=>saved,save:p=>writes.push(p),onResize:fn=>{resized=fn}});
  return {target,handle,writes,captured,
    fire(type,values={}){listeners[type]({button:0,isPrimary:true,pointerId:1,clientX:650,clientY:342,preventDefault(){},stopPropagation(){},...values})},
    resize(w,h,newHeight=height){viewport={width:w,height:h};height=newHeight;resized()}
  };
}
test('dragging title keeps pointer offset and remembers position only on release',()=>{
  const f=dragFixture();f.fire('pointerdown');f.fire('pointermove',{clientX:200,clientY:120});
  assert.equal(f.target.style.left,'192px');assert.equal(f.target.style.top,'110px');
  assert.equal(f.writes.length,0);assert.ok(f.captured.has(1));
  f.fire('pointerup');assert.equal(f.writes.length,1);assert.equal(f.writes[0].x,192);assert.ok(!f.captured.has(1));
});
test('drag remains reachable at every viewport edge and after window or panel resize',()=>{
  const f=dragFixture();f.fire('pointerdown');f.fire('pointermove',{clientX:2000,clientY:2000});
  assert.equal(f.target.style.left,'652px');assert.equal(f.target.style.top,'342px');
  f.fire('pointermove',{clientX:-100,clientY:-100});assert.equal(f.target.style.left,'8px');assert.equal(f.target.style.top,'8px');
  f.fire('pointerup');f.resize(360,400,320);assert.equal(f.target.style.left,'8px');assert.equal(f.target.style.top,'8px');
});
test('saved position is restored then clamped on smaller screens and growing queues',()=>{
  const f=dragFixture({x:500,y:200});assert.equal(f.target.style.left,'500px');
  f.resize(400,600,500);assert.equal(f.target.style.left,'52px');assert.equal(f.target.style.top,'92px');
});
test('right mouse and unrelated pointers cannot start or hijack a drag',()=>{
  const f=dragFixture();f.fire('pointerdown',{button:2});f.fire('pointermove');assert.equal(f.target.style.left,undefined);
  f.fire('pointerdown');f.fire('pointermove',{pointerId:2,clientX:100});assert.equal(f.target.style.left,'642px');
  f.fire('pointerup',{pointerId:2});assert.ok(f.captured.has(1));f.fire('pointercancel');assert.ok(!f.captured.has(1));
});
test('corrupted remembered position is ignored so the panel can still be dragged',()=>{
  const f=dragFixture({x:'bad',y:NaN});assert.equal(f.target.style.left,undefined);
  f.fire('pointerdown');f.fire('pointermove',{clientX:100,clientY:100});f.fire('pointerup');assert.equal(f.writes.length,1);
});
test('folder record failure does not cancel an authorized selection',async()=>{
  const warning=await acceptFolder({queryPermission:async()=> 'granted'}, {
    partial:false,remember:async()=>{throw Object.assign(new Error('clone'),{name:'DataCloneError'})}
  });
  assert.match(warning,/이 탭에서만/);assert.match(warning,/DataCloneError/);
});
test('denied write permission cannot be accepted or remembered',async()=>{
  let remembered=false;
  await assert.rejects(acceptFolder({queryPermission:async()=> 'denied'}, {
    partial:false,remember:async()=>{remembered=true}
  }));assert.equal(remembered,false);
});
test('partial saves require the same directory identity, not just the same name',async()=>{
  let remembered=false;
  const chosen={queryPermission:async()=> 'granted',isSameEntry:async previous=>previous.id==='original'};
  await assert.rejects(acceptFolder(chosen,{partial:true,previous:{id:'other'},remember:async()=>{remembered=true}}));
  await assert.rejects(acceptFolder(chosen,{partial:true,previous:null,remember:async()=>{remembered=true}}));
  assert.equal(remembered,false);
  assert.equal(await acceptFolder(chosen,{partial:true,previous:{id:'original'},remember:async()=>{remembered=true}}),'');
  assert.equal(remembered,true);
});
test('picker failure reports its exception name and an actionable message',()=>{
  assert.match(folderError({name:'SecurityError',message:'user gesture'}),/SecurityError/);
  assert.match(folderError({name:'SecurityError',message:'user gesture'}),/직접 눌러/);
  assert.match(folderError({name:'AbortError',message:'cancelled'}),/취소/);
});

test('release metadata preserves install identity and pins both update URLs to the same main script',()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'pixai-web-queue.user.js'),'utf8');
  const header=source.split('// ==/UserScript==')[0];
  const field=name=>header.match(new RegExp(`^// @${name}\\s+(.+)$`,'m'))?.[1].trim();
  const published='https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js';
  assert.equal(field('namespace'),'local.pixai-web-queue');
  assert.equal(field('name'),'PixAI 웹 대기열 (로컬 후보)');
  assert.equal(field('updateURL'),published);assert.equal(field('downloadURL'),published);
  const version=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'package.json'),'utf8')).version;
  assert.equal(field('version'),version);assert.ok(source.includes(`PixAI 대기열 · ${version} 후보`));
});

function activationFixture() {
  const listeners={},target={};let calls=0;const errors=[];
  const button={disabled:false,contains:element=>element===target};
  bindFolderActivation({addEventListener(type,fn,capture){assert.equal(capture,true);listeners[type]=fn}},
    ()=>button,()=>{calls++},error=>errors.push(error));
  return {button,errors,get calls(){return calls},fire(type,values={}){
    const event={type,target,button:0,pointerId:1,isPrimary:true,isTrusted:true,timeStamp:100,detail:1,
      preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...values};
    listeners[type](event);return event;
  }};
}
test('folder activation occurs at capture before site bubble handlers; pointerup plus click invokes once',()=>{
  const f=activationFixture();f.fire('pointerdown');const up=f.fire('pointerup');
  assert.equal(f.calls,1);assert.equal(up.stopped,true);
  f.fire('click',{timeStamp:110});assert.equal(f.calls,1);
  f.fire('pointerdown',{timeStamp:200});f.fire('pointerup',{timeStamp:210});assert.equal(f.calls,2);
});
test('keyboard activation and an unrelated page click are handled separately',()=>{
  const f=activationFixture();const other=f.fire('click',{target:{}});
  assert.equal(f.calls,0);assert.equal(other.stopped,undefined);
  f.fire('click',{detail:0});assert.equal(f.calls,1);
});
test('disabled, synthetic or cancelled folder gestures never open a picker',()=>{
  const f=activationFixture();f.button.disabled=true;f.fire('click',{detail:0});assert.equal(f.calls,0);
  f.button.disabled=false;f.fire('click',{detail:0,isTrusted:false});assert.equal(f.calls,0);assert.equal(f.errors.length,1);
  f.fire('pointerdown');f.fire('pointercancel');f.fire('pointerup');assert.equal(f.calls,0);
  f.fire('pointerup',{button:2});assert.equal(f.calls,0);
});
test('dragging from another area onto folder button cannot activate on pointerup',()=>{
  const f=activationFixture();f.fire('pointerdown',{target:{}});f.fire('pointerup');assert.equal(f.calls,0);
});
function pickerTimers() {
  let callback;const cleared=[];
  return {cleared,set(fn,ms){assert.equal(ms,8000);callback=fn;return 1},clear:id=>cleared.push(id),tick:()=>callback()};
}
test('native folder picker is invoked immediately in the gesture before any awaits',async()=>{
  const events=[],timers=pickerTimers(),chosen={name:'assets'};
  const win={showDirectoryPicker(options){assert.equal(this,win);assert.equal(options.mode,'readwrite');events.push('native');return Promise.resolve(chosen)}};
  const pending=pickDirectory(win,text=>events.push(text),timers);
  assert.equal(events[1],'native');assert.match(events[0],/입력 전달됨/);
  assert.equal(await pending,chosen);assert.match(events[2],/권한/);assert.deepEqual(timers.cleared,[1]);
});
test('unresolved picker displays waiting status but never retries or reports selection success',async()=>{
  let finish,calls=0;const messages=[],timers=pickerTimers(),chosen={name:'assets'};
  const pending=pickDirectory({showDirectoryPicker(){calls++;return new Promise(resolve=>{finish=resolve})}},text=>messages.push(text),timers);
  timers.tick();assert.equal(calls,1);assert.match(messages.at(-1),/응답 대기/);
  assert.ok(!messages.some(text=>text.startsWith('폴더 선택됨')));
  finish(chosen);assert.equal(await pending,chosen);assert.equal(calls,1);
});
test('missing, synchronously failing and cancelled pickers reject instead of silently succeeding',async()=>{
  const timers=pickerTimers(),messages=[];
  await assert.rejects(pickDirectory({},text=>messages.push(text),timers),/API/);
  await assert.rejects(pickDirectory({showDirectoryPicker(){throw new Error('Illegal invocation')}},()=>{},timers),/Illegal invocation/);
  await assert.rejects(pickDirectory({showDirectoryPicker:()=>Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'}))},()=>{},timers));
  assert.deepEqual(timers.cleared,[1]);
});

test('unsupported folder APIs are detected without attempting a picker or generation',()=>{
  const firefox=storageSupport({});assert.equal(firefox.supported,false);assert.match(firefox.message,/Firefox/);
  assert.equal(storageSupport({showDirectoryPicker(){}}).supported,true);
  assert.equal(storageSupport({showDirectoryPicker:true}).supported,false);
});

// Mount the complete script, rather than testing only its exported helper functions.
function panelFixture(nativePicker) {
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.attrs={};this.events={};this.disabled=false;this.value='';this.textContent='';}
    setAttribute(key,value){this.attrs[key]=value;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;if(key==='value')this.value=value;}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    contains(target){return this===target||this.children.some(child=>child.contains(target));}
    querySelectorAll(selector){
      const selectors=selector.split(',').map(s=>s.trim());
      const matches=element=>selectors.some(s=>{
        const data=s.match(/^\[data-([\w-]+)\]$/);
        if(data)return data[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase()) in element.dataset;
        if(s.startsWith('#'))return element.attrs.id===s.slice(1);
        return element.tagName===s;
      });
      return this.children.flatMap(child=>[...(matches(child)?[child]:[]),...child.querySelectorAll(selector)]);
    }
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(type,fn,capture){(this.events[type]??=[]).push({fn,capture});}
    fire(type,values={}){
      const event={type,target:this,button:0,pointerId:1,isPrimary:true,isTrusted:true,timeStamp:100,detail:1,preventDefault(){},stopImmediatePropagation(){this.stopped=true},...values};
      for(const {fn} of [...(this.events[type]||[])].sort((a,b)=>Number(!!b.capture)-Number(!!a.capture))){fn(event);if(event.stopped)break;}
    }
    getBoundingClientRect(){return {left:600,top:200,width:340,height:450};}
    setPointerCapture(){} hasPointerCapture(){return false} releasePointerCapture(){}
  }
  const body=new Element('body'), records=new Map();let paid=0,pickerCalls=0;
  const document={body,readyState:'complete',createElement:tag=>new Element(tag),
    getElementById:id=>body.querySelector(`#${id}`),querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(){}};
  const window={innerWidth:1200,innerHeight:900,addEventListener(){}};window.top=window.self=window;
  if(nativePicker)window.showDirectoryPicker=(...args)=>{pickerCalls++;return nativePicker(...args)};
  const context={window,document,location:{hostname:'pixai.art',pathname:'/ko/generator/image'},
    localStorage:{getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value)},
    navigator:{locks:{request:async(name,options,callback)=>callback({})}},
    ResizeObserver:class{observe(){}},setTimeout,clearTimeout,
    fetch:()=>{paid++;throw new Error('No network in UI fixture')},crypto:{randomUUID:()=> 'fixture-id'}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'pixai-web-queue.user.js'),'utf8'),context);
  const panel=body.querySelector('#local-pixai-queue');
  return {panel,get paid(){return paid},get pickerCalls(){return pickerCalls},
    press(button){button.fire('pointerdown');button.fire('pointerup');},
    message:()=>panel.querySelector('[data-message]').textContent};
}

test('Firefox-like full UI explains unsupported storage on mount and keeps paid start disabled',()=>{
  const f=panelFixture();assert.match(f.message(),/Firefox/);
  assert.equal(f.panel.querySelector('[data-start]').disabled,true);
  f.press(f.panel.querySelector('[data-choose-folder]'));assert.match(f.message(),/지원하지/);
  assert.equal(f.pickerCalls,0);assert.equal(f.paid,0);
});

test('queue button handles direct pointer release even when no click is delivered; empty prompt shows validation',async()=>{
  const f=panelFixture();const add=f.panel.querySelectorAll('button').find(b=>b.textContent==='대기열 추가');
  f.press(add);assert.match(f.message(),/입력 확인/);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/프롬프트/);assert.equal(f.paid,0);
});

test('supported full UI calls picker once on release and renders cancellation without network',async()=>{
  const f=panelFixture(()=>Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'})));
  const choose=f.panel.querySelector('[data-choose-folder]');f.press(choose);choose.fire('click',{timeStamp:110});
  assert.equal(f.pickerCalls,1);assert.match(f.message(),/선택창 여는 중/);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/취소/);assert.equal(choose.disabled,false);assert.equal(f.paid,0);
});
