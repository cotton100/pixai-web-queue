const assert = require('node:assert/strict');
const test = require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'pixai-web-queue.user.js'),'utf8'),sandbox);
const {processJob,recover,verifyTask,outputIds,safeName,checkCost,bindPanelDrag,acceptFolder,folderError,bindFolderActivation,pickDirectory,storageSupport,managedDownload,resetDownloadProgress}=sandbox.module.exports;
const job=()=>({id:'fixture',prompt:'1girl, smile',title:'미소',state:'queued',saved:[]});
const promptText=text=>({nodeType:3,textContent:text});
const promptNode=(tag,...childNodes)=>({nodeType:1,tagName:tag,childNodes,classList:{contains:()=>false}});
test('Tiptap prompt reading preserves logical blank lines instead of visual paragraph spacing',()=>{
  const input={childNodes:[promptNode('P',promptText('quality, trigger')),promptNode('P'),promptNode('P',promptText('character, smile'))],innerText:'quality, trigger\n\n\n\ncharacter, smile'};
  assert.equal(sandbox.module.exports.readPromptEditorText(input),'quality, trigger\n\ncharacter, smile');
  assert.notEqual(sandbox.module.exports.readPromptEditorText(input),input.innerText);
});
test('Tiptap prompt reading preserves explicit breaks and marked inline text, ignoring only trailing placeholders',()=>{
  const trailing=promptNode('BR');trailing.classList.contains=name=>name==='ProseMirror-trailingBreak';
  const input={childNodes:[promptNode('P',promptText('1girl, '),promptNode('STRONG',promptText('(smile:1.2)')),promptNode('BR'),promptText('night')),promptNode('P',trailing)]};
  assert.equal(sandbox.module.exports.readPromptEditorText(input),'1girl, (smile:1.2)\nnight\n');
});
test('Tiptap prompt reading does not accept changed text, weights, spaces or removed blank lines as an identical prompt',()=>{
  const expected='quality\n\n(smile:1.2), night';
  for(const changed of ['quality\n(smile:1.2), night','quality\n\n(smile:1.3), night','quality\n\n(smile:1.2),night','quality\n\n(smile:1.2), day']) {
    const input={childNodes:changed.split('\n').map(line=>promptNode('P',promptText(line)))};
    assert.notEqual(sandbox.module.exports.normalize(sandbox.module.exports.readPromptEditorText(input)),expected);
  }
});
test('unexpected rich prompt blocks and embedded media are rejected instead of silently losing content',()=>{
  for(const input of [{childNodes:[promptNode('DIV',promptText('tags'))]},{childNodes:[promptNode('P',promptNode('IMG'))]}])assert.throws(()=>sandbox.module.exports.readPromptEditorText(input),/문단 구조/);
});
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

test('English Generate price is parsed only with a complete amount and still enforces the credit ceiling',()=>{
  assert.equal(checkCost('SubmittingGenerate3,200Ctrl+⏎Task submitted',7800),3200);
  assert.throws(()=>checkCost('Generate8,000Ctrl+⏎Task submitted',7800),/상한/);
  for(const text of ['GenerateCtrl+','Generate0Ctrl+','Generate3.2Ctrl+','Generate3,200 credits 4,000Ctrl+'])assert.throws(()=>checkCost(text,7800),/비용/);
});

test('production generation controls recognize both site languages and reject ambiguous or disabled submit buttons',()=>{
  const source=fs.readFileSync(require('node:path').join(__dirname,'pixai-web-queue.user.js'),'utf8');
  const begin=source.indexOf('  function generateButton() {'),end=source.indexOf('  async function ensureDestination()',begin);
  for(const english of [false,true]) {
    let buttons=[{textContent:english?'SubmittingGenerate3,200Ctrl+⏎Task submitted':'생성!3,200Ctrl+⏎작업 제출',getAttribute:()=>null}];
    let choice=english?'Single':'단일';
    const radio={getAttribute:()=>null,get textContent(){return choice;}},group={querySelector:()=>radio};
    const context={visible:()=>true,groupName:()=>english?'Number of images':'이미지 수',all:selector=>selector.includes('button')?buttons:[group]};
    vm.runInNewContext(`${source.slice(begin,end)};this.button=generateButton;this.count=expectedCount;`,context);
    assert.equal(context.button(),buttons[0]);assert.equal(context.count(),1);choice='Batch (x4)';assert.equal(context.count(),4);
    buttons[0].disabled=true;assert.throws(()=>context.button(),/생성 버튼/);buttons[0].disabled=false;
    buttons=[...buttons,{...buttons[0]}];assert.throws(()=>context.button(),/생성 버튼/);
    choice='unknown';assert.throws(()=>context.count(),/이미지 수/);
  }
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
  assert.match(header,/^\/\/ @grant\s+GM_download$/m);assert.match(header,/^\/\/ @grant\s+GM_info$/m);
  assert.equal(field('sandbox'),'DOM');
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

test('storage mode follows available browser APIs and requires managed browser downloads for fallback',()=>{
  const firefox=storageSupport({});assert.equal(firefox.supported,false);assert.match(firefox.message,/Firefox/);
  assert.equal(firefox.mode,'download');
  assert.equal(storageSupport({showDirectoryPicker(){}}).supported,true);
  assert.equal(storageSupport({showDirectoryPicker(){}}).mode,'folder');
  assert.equal(storageSupport({showDirectoryPicker:true}).supported,false);
  assert.equal(storageSupport({},()=>{}, {downloadMode:'browser'}).supported,true);
  assert.equal(storageSupport({},()=>{}, {downloadMode:'native'}).supported,false);
  assert.equal(storageSupport({},()=>{}, {downloadMode:'disabled'}).supported,false);
  assert.equal(storageSupport({},null,{downloadMode:'browser'}).supported,false);
});

// Mount the complete script, rather than testing only its exported helper functions.
function panelFixture(nativePicker, gm={}) {
  let networkCalls=0,generateCalls=0,pickerCalls=0;const siteQueries=[],storageMutations=[];
  function matchesPart(element,part) {
    if(part.startsWith('#'))return element.getAttribute('id')===part.slice(1);
    const tag=part.match(/^[a-z][\w-]*/i)?.[0];
    if(tag&&element.tagName.toLowerCase()!==tag.toLowerCase())return false;
    return [...part.matchAll(/\[([\w-]+)(\*=|=)?(?:"([^"]*)"|'([^']*)'|([^\]]*))?\]/g)].every(([,name,operator,double,single,bare])=>{
      const actual=element.getAttribute(name),wanted=double??single??bare??'';
      return actual!=null&&(!operator||(operator==='*='?String(actual).includes(wanted):String(actual)===wanted));
    });
  }
  function matchesSelector(element,selector) {
    const parts=selector.match(/(?:\[[^\]]*\]|[^\s[\]])+/g)||[];
    if(!parts.length||!matchesPart(element,parts.at(-1)))return false;
    let ancestor=element.parentElement;
    for(let i=parts.length-2;i>=0;i--){while(ancestor&&!matchesPart(ancestor,parts[i]))ancestor=ancestor.parentElement;if(!ancestor)return false;ancestor=ancestor.parentElement;}
    return true;
  }
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.attrs={};this.events={};this.disabled=false;this.value='';this.textContent='';this.scrollTop=0;}
    setAttribute(key,value){this.attrs[key]=value;if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;if(key==='value')this.value=value;}
    getAttribute(key){if(key.startsWith('data-')){const data=key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(data in this.dataset)return this.dataset[data];}return this.attrs[key]??null;}
    append(...children){for(const child of children){child.remove();child.parentElement=this;this.children.push(child);}}
    get id(){return this.getAttribute('id')||'';}
    prepend(...children){for(const child of children)child.parentElement=this;this.children.unshift(...children);}
    replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
    after(child){if(!this.parentElement)return;const siblings=this.parentElement.children;child.parentElement=this.parentElement;siblings.splice(siblings.indexOf(this)+1,0,child);}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
    contains(target){return this===target||this.children.some(child=>child.contains(target));}
    querySelectorAll(selector){
      const selectors=selector.split(',').map(s=>s.trim());
      return this.children.flatMap(child=>[...(selectors.some(s=>matchesSelector(child,s))?[child]:[]),...child.querySelectorAll(selector)]);
    }
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    closest(selector){for(let node=this;node;node=node.parentElement)if(matchesSelector(node,selector))return node;return null;}
    addEventListener(type,fn,capture){(this.events[type]??=[]).push({fn,capture});}
    fire(type,values={}){
      const event={type,target:this,button:0,pointerId:1,isPrimary:true,isTrusted:true,clientX:610,clientY:210,timeStamp:100,detail:1,preventDefault(){},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.stopped=true},...values};
      for(const {fn} of [...(this.events[type]||[])].sort((a,b)=>Number(!!b.capture)-Number(!!a.capture))){fn(event);if(event.stopped)break;}
    }
    getBoundingClientRect(){return {left:600,top:200,width:340,height:450};}
    getClientRects(){for(let node=this;node;node=node.parentElement)if(node.hidden)return [];return [this.getBoundingClientRect()];}
    focus(){document.activeElement=this;}
    click(){this.clicks=(this.clicks||0)+1;}
    setPointerCapture(){} hasPointerCapture(){return false} releasePointerCapture(){}
  }
  const body=new Element('body'), records=new Map();
  if(gm.records)for(const [key,value] of gm.records)records.set(key,value);
  if(gm.minimized!=null)records.set('local.pixai-web-queue.minimized.v1',JSON.stringify(gm.minimized));
  if(gm.queue)records.set('local.pixai-web-queue.v1',JSON.stringify({version:1,jobs:gm.queue}));
  if(gm.rawQueue)records.set('local.pixai-web-queue.v1',gm.rawQueue);
  const main=new Element('main'),modelSection=new Element('section'),stylesSection=new Element('section'),modelCard=new Element('div');
  modelSection.setAttribute('data-section','model');stylesSection.setAttribute('data-section','styles');modelCard.setAttribute('data-testid','selected-entity-card');
  const model=new Element('a');model.textContent='Fixture model';model.setAttribute('href','/en/model/101/201');
  const imageLink=new Element('a');imageLink.setAttribute('href','/en/model/101/201');modelCard.append(imageLink,model);modelSection.append(modelCard);
  const recommended=new Element('a');recommended.textContent='Recommended model';recommended.setAttribute('href','/en/model/999/9991');modelSection.append(recommended);
  const modelTab=new Element('button');modelTab.textContent='Model';modelTab.setAttribute('role','tab');modelTab.setAttribute('aria-selected','true');
  const generate=new Element('button');generate.textContent='생성!7,800Ctrl+⏎작업 제출';generate.click=()=>{generateCalls++;};
  main.append(modelTab,modelSection,stylesSection,generate);body.append(main);
  const document={body,readyState:'complete',createElement:tag=>new Element(tag),createElementNS:(_namespace,tag)=>new Element(tag),
    getElementById:id=>body.querySelector(`#${id}`),querySelector:s=>body.querySelector(s),querySelectorAll:s=>{
      if(s.startsWith('main '))siteQueries.push(s);
      if(s==='main button[data-react-aria-pressable]')return [generate];
      return body.querySelectorAll(s);
    },addEventListener(){}};
  const window={innerWidth:1200,innerHeight:900,addEventListener(){}};window.top=window.self=window;
  if(nativePicker)window.showDirectoryPicker=(...args)=>{pickerCalls++;return nativePicker(...args)};
  const context={window,document,location:{hostname:'pixai.art',pathname:'/ko/generator/image'},
    localStorage:{getItem:key=>records.get(key)||null,setItem:(key,value)=>{if(gm.viewStorageFailure&&key==='local.pixai-web-queue.minimized.v1')throw new Error('View storage unavailable');records.set(key,value);storageMutations.push({method:'set',key,value});},removeItem:key=>{records.delete(key);storageMutations.push({method:'remove',key});}},
    navigator:{locks:{request:async(name,options,callback)=>callback(gm.lockUnavailable?null:{})}},
    ResizeObserver:class{observe(){}},setTimeout,clearTimeout,
    fetch:()=>{networkCalls++;throw new Error('No network in UI fixture')},crypto:{randomUUID:()=> 'fixture-id'},
    Blob,TextEncoder,URL, GM_download:gm.download, GM_info:gm.info};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'pixai-web-queue.user.js'),'utf8'),context);
  const panel=body.querySelector('#local-pixai-queue');
  return {panel,document,siteQueries,records,storageMutations,get networkCalls(){return networkCalls},get generateCalls(){return generateCalls},get pickerCalls(){return pickerCalls},
    press(button){button.fire('pointerdown');button.fire('pointerup');},
    message:()=>panel.querySelector('[data-message]').textContent};
}

const runtimeSettingsKeys={library:'local.pixai-web-queue.presets.v1',options:'local.pixai-web-queue.options.v1',queue:'local.pixai-web-queue.v1',previous:'local.pixai-web-queue.before-import.v1'};
function runtimeSettingsLibrary(prompt='saved common') {
  const library=sandbox.module.exports.makePresetLibrary();library.common={prompt,negativePrompt:'saved negative'};
  library.presets=[{id:'preset',name:'Asset',model:{id:'101',versionId:'201',name:'Model'},loras:[{id:'301',versionId:'401',name:'LoRA',weight:0.7,triggerWords:'saved trigger'}]}];
  library.characters=[{id:'character',name:'Character',prompt:'character tags',negativePrompt:''}];
  library.scenes=[{id:'chunk',name:'Chunk',prompt:'chunk tags',negativePrompt:''}];
  library.reservations=[{id:'reservation',presetId:'preset',characterId:'character',sceneIds:['chunk'],count:1}];return library;
}
function runtimeSettingsRecords() {
  return new Map([[runtimeSettingsKeys.library,JSON.stringify(runtimeSettingsLibrary())],[runtimeSettingsKeys.options,JSON.stringify({maxCredits:7800,filePrefix:'before',repeat:1})],
    [runtimeSettingsKeys.queue,JSON.stringify({version:1,jobs:[job()]})]]);
}

test('runtime workbench puts storage and backup in Settings, jobs in Queue, and run controls outside tab pages',()=>{
  const f=panelFixture(null,{records:runtimeSettingsRecords()}),panel=f.panel;
  const settings=panel.querySelector('[data-page="settings"]'),queue=panel.querySelector('[data-page="queue"]'),compose=panel.querySelector('[data-page="compose"]');
  assert(settings&&queue&&compose);assert.equal(compose.hidden,false);assert.equal(settings.hidden,true);assert.equal(queue.hidden,true);
  assert(settings.contains(panel.querySelector('[data-choose-folder]')));assert(settings.contains(runtimeField(f,'설정 백업 JSON 파일')));
  assert(queue.contains(panel.querySelector('[data-jobs]')));assert(queue.contains(runtimeField(f,'대기열 프롬프트')));
  const footer=panel.querySelector('[class="pq-footer"]');assert(footer.contains(panel.querySelector('[data-start]')));
  assert.equal(panel.querySelector('[data-start]').closest('[role="tabpanel"]'),null);
  const openSettings=panel.querySelector('[aria-label="저장 설정 열기"]');openSettings.fire('click',{detail:0});
  assert.equal(settings.hidden,false);assert.equal(compose.hidden,true);assert.equal(f.document.activeElement.getAttribute('id'),'pq-tab-settings');
  assert.equal(f.storageMutations.length,0);assert.equal(f.generateCalls,0);assert.equal(f.networkCalls,0);
});
function runtimeSettingsBackup() {
  const library=runtimeSettingsLibrary('imported common');library.presets[0].loras[0].triggerWords='imported trigger';
  return JSON.stringify(sandbox.module.exports.makeSettingsBackup(library,{maxCredits:6400,filePrefix:'imported',repeat:2},{appVersion:'fixture',exportedAt:'2026-10-07T00:00:00.000Z'}));
}
function runtimeField(f,label) {
  const element=f.panel.querySelectorAll('input, textarea, select').find(item=>item.getAttribute('aria-label')===label);assert.ok(element,`Missing runtime field ${label}`);return element;
}
function runtimePress(f,label) {
  const element=f.panel.querySelectorAll('button').find(item=>item.textContent===label);assert.ok(element,`Missing runtime button ${label}`);f.press(element);
}
const runtimeFlush=()=>new Promise(resolve=>setImmediate(resolve));
async function runtimeChooseFile(f,text) {
  const input=runtimeField(f,'설정 백업 JSON 파일');input.files=[{name:'fixture-settings.json',size:new TextEncoder().encode(text).length,text:async()=>text}];input.fire('change');await runtimeFlush();
}

test('runtime settings export downloads saved library and current option fields without queue or settings writes',async()=>{
  let details;const records=runtimeSettingsRecords();const f=panelFixture(null,{records,info:{downloadMode:'browser'},download:options=>{details=options;options.onload();}});
  runtimeField(f,'공통 프롬프트').value='unsaved draft';runtimeField(f,'생성 1회 크레딧 상한').value='6500';runtimeField(f,'대기열 작업 이름').value='current name';runtimeField(f,'각 프롬프트 반복 횟수').value='3';
  runtimePress(f,'설정 내보내기');await runtimeFlush();
  assert.ok(details.url instanceof Blob);assert.match(details.name,/^PixAI_설정_.*\.json$/);assert.equal(details.saveAs,false);
  const exported=JSON.parse(await details.url.text());assert.equal(exported.format,'pixai-web-queue-settings');
  assert.deepEqual(exported.library,JSON.parse(records.get(runtimeSettingsKeys.library)));assert.deepEqual(exported.options,{maxCredits:6500,filePrefix:'current name',repeat:3});assert.equal(exported.jobs,undefined);
  assert.equal(f.storageMutations.length,0);assert.deepEqual([...f.records],[...records]);assert.match(f.message(),/설정 JSON 다운로드 완료/);assert.equal(f.networkCalls,0);assert.equal(f.generateCalls,0);
});

test('runtime file preview writes nothing until Apply; Apply and Undo update UI/library/options while preserving the exact queue',async()=>{
  const records=runtimeSettingsRecords(),f=panelFixture(null,{records}),queue=records.get(runtimeSettingsKeys.queue);
  runtimeField(f,'공통 프롬프트').value='stale unsaved draft';
  await runtimeChooseFile(f,runtimeSettingsBackup());
  assert.equal(f.panel.querySelector('[data-import-preview]').hidden,false);assert.match(f.message(),/파일 확인 완료/);assert.equal(f.storageMutations.length,0);assert.deepEqual([...f.records],[...records]);
  runtimePress(f,'이 설정으로 교체');await runtimeFlush();
  assert.equal(JSON.parse(f.records.get(runtimeSettingsKeys.library)).common.prompt,'imported common');assert.deepEqual(JSON.parse(f.records.get(runtimeSettingsKeys.options)),{maxCredits:6400,filePrefix:'imported',repeat:2});
  assert.equal(runtimeField(f,'공통 프롬프트').value,'imported common');assert.equal(runtimeField(f,'생성 1회 크레딧 상한').value,'6400');assert.equal(runtimeField(f,'대기열 작업 이름').value,'imported');
  assert.equal(f.panel.querySelector('[data-import-preview]').hidden,true);assert.equal(f.records.get(runtimeSettingsKeys.queue),queue);assert.ok(f.records.has(runtimeSettingsKeys.previous));
  runtimePress(f,'가져오기 전 설정 복구');await runtimeFlush();
  assert.equal(f.records.get(runtimeSettingsKeys.library),records.get(runtimeSettingsKeys.library));assert.equal(f.records.get(runtimeSettingsKeys.options),records.get(runtimeSettingsKeys.options));
  assert.equal(runtimeField(f,'공통 프롬프트').value,'saved common');assert.equal(runtimeField(f,'생성 1회 크레딧 상한').value,'7800');assert.equal(runtimeField(f,'대기열 작업 이름').value,'before');
  assert.equal(f.records.get(runtimeSettingsKeys.queue),queue);assert(!f.storageMutations.some(item=>item.key===runtimeSettingsKeys.queue));assert.equal(f.networkCalls,0);assert.equal(f.generateCalls,0);
});

test('runtime malformed file, preview cancellation, and empty file selection leave original library/options/queue untouched',async()=>{
  const records=runtimeSettingsRecords(),f=panelFixture(null,{records});
  await runtimeChooseFile(f,'{malformed JSON');assert.match(f.message(),/설정 파일 읽기 실패/);assert.equal(f.panel.querySelector('[data-import-preview]').hidden,true);assert.deepEqual([...f.records],[...records]);
  await runtimeChooseFile(f,runtimeSettingsBackup());runtimePress(f,'불러오기 취소');await runtimeFlush();
  assert.equal(f.panel.querySelector('[data-import-preview]').hidden,true);assert.match(f.message(),/취소/);
  const input=runtimeField(f,'설정 백업 JSON 파일');input.files=[];input.fire('change');await runtimeFlush();
  runtimePress(f,'설정 불러오기');assert.equal(input.clicks,1);assert.equal(f.storageMutations.length,0);assert.deepEqual([...f.records],[...records]);assert.equal(f.networkCalls,0);assert.equal(f.generateCalls,0);
});

test('runtime settings preview remains readable but a cross-tab lock refusal blocks Apply without storage changes',async()=>{
  const records=runtimeSettingsRecords(),f=panelFixture(null,{records,lockUnavailable:true});await runtimeChooseFile(f,runtimeSettingsBackup());
  assert.equal(f.panel.querySelector('[data-import-preview]').hidden,false);runtimePress(f,'이 설정으로 교체');await runtimeFlush();
  assert.match(f.message(),/다른 PixAI 탭/);assert.equal(f.storageMutations.length,0);assert.deepEqual([...f.records],[...records]);
  assert.equal(f.panel.querySelector('[data-import-preview]').hidden,false);assert.equal(f.panel.querySelector('[data-start]').disabled,false);assert.equal(f.networkCalls,0);assert.equal(f.generateCalls,0);
});

test('collapse keeps unsaved inputs, scroll position and status; SVG launcher restores keyboard focus without site IO',()=>{
  const f=panelFixture();
  const collapse=f.panel.querySelector('[data-collapse]'),launcher=f.panel.querySelector('[data-launcher]');
  const prompt=f.panel.querySelectorAll('textarea').find(element=>element.getAttribute('aria-label')==='대기열 프롬프트');
  prompt.value='not yet queued';f.panel.scrollTop=170;
  const before=f.message();assert.equal(collapse.getAttribute('aria-label'),'대기열 접기');
  assert.equal(launcher.getAttribute('aria-label'),'PixAI 대기열 열기');assert.equal(launcher.querySelector('svg').getAttribute('viewBox'),'0 0 24 24');
  assert.equal('edit' in collapse.dataset,false);assert.equal('edit' in launcher.dataset,false);
  f.press(collapse);assert.equal(f.panel.dataset.minimized,'true');assert.equal(f.document.activeElement,launcher);
  assert.equal(f.message(),before);assert.equal(f.records.get('local.pixai-web-queue.minimized.v1'),'true');
  f.panel.scrollTop=0; // A collapsed browser scroll container no longer has its old range.
  launcher.fire('click',{detail:0});
  assert.equal(f.panel.dataset.minimized,'false');assert.equal(prompt.value,'not yet queued');assert.equal(f.panel.scrollTop,170);
  assert.equal(f.document.activeElement,collapse);assert.equal(f.message(),before);
  assert.equal(f.records.has('local.pixai-web-queue.v1'),false);assert.equal(f.networkCalls,0);assert.equal(f.generateCalls,0);assert.equal(f.siteQueries.length,0);
});

test('collapsed launcher drag saves position without opening or changing inputs; a later pointer tap opens exactly once',()=>{
  const f=panelFixture(),collapse=f.panel.querySelector('[data-collapse]'),launcher=f.panel.querySelector('[data-launcher]');
  const prompt=runtimeField(f,'대기열 프롬프트');prompt.value='unsaved prompt';const message=f.message();
  f.press(collapse);const before=f.records.get(runtimeSettingsKeys.queue);
  launcher.fire('pointerdown',{clientX:610,clientY:210});launcher.fire('pointermove',{clientX:710,clientY:310});
  launcher.fire('pointerup',{clientX:710,clientY:310});launcher.fire('click',{detail:1,pointerType:'mouse'});
  assert.equal(f.panel.dataset.minimized,'true');assert.equal(prompt.value,'unsaved prompt');assert.equal(f.message(),message);
  assert.deepEqual(JSON.parse(f.records.get('local.pixai-web-queue.position.v1')),{x:700,y:300});
  assert.equal(f.records.get(runtimeSettingsKeys.queue),before);
  const opensBefore=f.storageMutations.filter(item=>item.key==='local.pixai-web-queue.minimized.v1'&&item.value==='false').length;
  launcher.fire('pointerdown',{clientX:710,clientY:310});launcher.fire('pointerup',{clientX:710,clientY:310});launcher.fire('click',{detail:1,pointerType:'mouse'});
  assert.equal(f.panel.dataset.minimized,'false');
  assert.equal(f.storageMutations.filter(item=>item.key==='local.pixai-web-queue.minimized.v1'&&item.value==='false').length,opensBefore+1);
  assert.equal(prompt.value,'unsaved prompt');assert.equal(f.message(),message);assert.equal(f.records.get(runtimeSettingsKeys.queue),before);
  assert.equal(f.networkCalls,0);assert.equal(f.generateCalls,0);assert.equal(f.siteQueries.length,0);
});

test('collapsed preference survives a fresh mount and malformed or failed view storage does not break folding',()=>{
  const first=panelFixture();first.press(first.panel.querySelector('[data-collapse]'));
  const again=panelFixture(null,{records:first.records});assert.equal(again.panel.dataset.minimized,'true');
  again.panel.querySelector('[data-launcher]').fire('click',{detail:0});assert.equal(again.panel.dataset.minimized,'false');
  const malformed=panelFixture(null,{records:new Map([['local.pixai-web-queue.minimized.v1','{bad view JSON']]),viewStorageFailure:true});
  assert.equal(malformed.panel.dataset.minimized,'false');
  malformed.press(malformed.panel.querySelector('[data-collapse]'));assert.equal(malformed.panel.dataset.minimized,'true');
  malformed.panel.querySelector('[data-launcher]').fire('click',{detail:0});assert.equal(malformed.panel.dataset.minimized,'false');
  assert.equal(malformed.networkCalls,0);assert.equal(malformed.generateCalls,0);
});

test('folding during a running job remains enabled and preserves its message and persisted queue without cancellation or site IO',async()=>{
  let checks=0,finish;const folder={name:'fixture',queryPermission:()=>{checks++;return checks===4?new Promise(resolve=>{finish=resolve}):Promise.resolve('granted');}};
  const f=panelFixture(()=>Promise.resolve(folder),{queue:[job()]});
  f.press(f.panel.querySelector('[data-choose-folder]'));await new Promise(resolve=>setImmediate(resolve));
  f.press(f.panel.querySelector('[data-start]'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(checks,4);assert.equal(f.panel.querySelector('[data-start]').textContent,'실행 중');
  const collapse=f.panel.querySelector('[data-collapse]'),launcher=f.panel.querySelector('[data-launcher]');
  const before=f.message(),queue=f.records.get('local.pixai-web-queue.v1'),queries=f.siteQueries.length;
  assert.equal(collapse.disabled,false);assert.equal(launcher.disabled,false);
  f.press(collapse);assert.equal(f.panel.dataset.minimized,'true');assert.equal(f.message(),before);assert.match(launcher.title,/실행 중/);
  assert.equal(f.records.get('local.pixai-web-queue.v1'),queue);assert.equal(f.siteQueries.length,queries);
  launcher.fire('click',{detail:0});assert.equal(f.panel.dataset.minimized,'false');assert.equal(f.message(),before);
  assert.equal(f.panel.querySelector('[data-start]').disabled,true);assert.equal(f.generateCalls,0);assert.equal(f.networkCalls,0);
  finish('denied');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.panel.querySelector('[data-start]').disabled,false);assert.match(f.message(),/쓰기 권한/);assert.equal(f.generateCalls,0);assert.equal(f.networkCalls,0);
});

test('Start stays clickable with missing Firefox settings and explains setup before touching site',async()=>{
  const f=panelFixture();assert.match(f.message(),/Firefox/);
  assert.equal(f.panel.querySelector('[data-start]').disabled,false);
  f.press(f.panel.querySelector('[data-start]'));await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/Browser API/);assert.equal(f.siteQueries.length,0);assert.equal(f.generateCalls,0);
  f.press(f.panel.querySelector('[data-choose-folder]'));assert.match(f.message(),/Browser API/);
  assert.equal(f.pickerCalls,0);assert.equal(f.networkCalls,0);
});

test('generic runtime renders keep unavailable edit controls disabled and restore available controls when idle',async()=>{
  const f=panelFixture(),available=runtimeField(f,'공통 프롬프트');
  const unavailable=f.panel.querySelectorAll('button').find(button=>button.getAttribute('aria-label')==='선택 프리셋 위로');
  assert.ok(unavailable);assert.equal(unavailable.getAttribute('data-unavailable'),'true');
  unavailable.disabled=false;available.disabled=true;
  f.press(f.panel.querySelector('[data-start]'));await runtimeFlush();
  assert.match(f.message(),/Browser API/);
  assert.equal(unavailable.disabled,true);assert.equal(available.disabled,false);
  f.press(f.panel.querySelector('[data-choose-folder]'));
  assert.equal(unavailable.disabled,true);assert.equal(available.disabled,false);
  assert.equal(f.networkCalls,0);assert.equal(f.generateCalls,0);
});

test('queue button handles direct pointer release even when no click is delivered; empty prompt shows validation',async()=>{
  const f=panelFixture();const add=f.panel.querySelectorAll('button').find(b=>b.textContent==='대기열 추가');
  f.press(add);assert.match(f.message(),/입력 확인/);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/프롬프트/);assert.equal(f.networkCalls,0);
  const feedback=f.panel.querySelector('[data-action-message]');
  assert.equal(feedback.textContent,f.message());
  assert.equal(add.parentElement.children[add.parentElement.children.indexOf(add)+1],feedback);
});

test('damaged queue data is preserved while the complete panel still mounts and accepts preset read input',async()=>{
  const f=panelFixture(null,{rawQueue:'{broken queue'});
  assert.match(f.message(),/대기열 읽기 실패/);
  assert.equal(f.records.get('local.pixai-web-queue.v1'),'{broken queue');
  const read=f.panel.querySelectorAll('button').find(b=>b.textContent==='사이트의 현재 설정 읽기');
  assert.equal(read.disabled,false);f.press(read);
  assert.match(f.message(),/읽는 중/);
  f.press(f.panel.querySelectorAll('button').find(b=>b.textContent==='중지'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/중지/);
  assert.equal(f.records.get('local.pixai-web-queue.v1'),'{broken queue');
  assert.equal(f.networkCalls,0);assert.equal(f.generateCalls,0);
});

test('supported full UI calls picker once on release and renders cancellation without network',async()=>{
  const f=panelFixture(()=>Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'})));
  const choose=f.panel.querySelector('[data-choose-folder]');f.press(choose);choose.fire('click',{timeStamp:110});
  assert.equal(f.pickerCalls,1);assert.match(f.message(),/선택창 여는 중/);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/취소/);assert.equal(choose.disabled,false);assert.equal(f.networkCalls,0);
});

function downloadTimers() {
  let callback;const cleared=[];
  return {cleared,set(fn,ms){assert.equal(ms,120000);callback=fn;return 1},clear:id=>cleared.push(id),tick:()=>callback()};
}

test('managed save waits for completion, passes validated blob, preserves collisions and uses automatic download',async()=>{
  const timers=downloadTimers(),blob=new Blob(['asset'],{type:'image/png'});let details,finished=false;
  const pending=managedDownload(options=>{details=options;return {}},blob,'asset.png',timers).then(name=>{finished=true;return name});
  assert.equal(details.url,blob);assert.equal(details.saveAs,false);assert.equal(details.conflictAction,'uniquify');
  assert.equal(finished,false);details.onload();assert.equal(await pending,'asset.png');assert.deepEqual(timers.cleared,[1]);
});

test('cancelled or rejected downloads never count as completion, including late callbacks',async()=>{
  const timers=downloadTimers();let details;
  const pending=managedDownload(options=>{details=options},new Blob(['asset']),'asset.png',timers);
  details.onerror({error:'not_whitelisted'});details.onload();
  await assert.rejects(pending,/png, jpg, webp, json/);
  await assert.rejects(managedDownload(()=>{throw new TypeError('unsupported Blob')},new Blob(['asset']),'asset.png',downloadTimers()),/다운로드 실패/);
});

test('download timeout aborts once and rejects even if completion arrives later',async()=>{
  const timers=downloadTimers();let details,aborts=0;
  const pending=managedDownload(options=>{details=options;return {abort(){aborts++}}},new Blob(['asset']),'asset.png',timers);
  timers.tick();details.onload();await assert.rejects(pending,/timeout/);assert.equal(aborts,1);
});

test('Start explains pending Firefox preparation; completed probe permits the next preflight',async()=>{
  let details;const f=panelFixture(null,{download:options=>{details=options},info:{downloadMode:'browser'}});
  const start=f.panel.querySelector('[data-start]'),choose=f.panel.querySelector('[data-choose-folder]');
  assert.equal(choose.textContent,'자동 다운로드 준비 확인');assert.equal(start.disabled,false);
  f.press(start);await new Promise(resolve=>setImmediate(resolve));assert.match(f.message(),/준비 확인/);
  assert.equal(f.siteQueries.length,0);assert.equal(f.generateCalls,0);
  f.press(choose);await new Promise(resolve=>setImmediate(resolve));
  assert.ok(details.url instanceof Blob);assert.match(details.name,/^PixAI_다운로드확인_\d+\.json$/);
  assert.equal(start.disabled,false);f.press(start);await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/다운로드가 끝난/);assert.equal(f.siteQueries.length,0);assert.equal(f.generateCalls,0);
  assert.equal(f.networkCalls,0);details.onload();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(start.disabled,false);assert.match(f.message(),/준비 확인 완료/);assert.equal(f.pickerCalls,0);assert.equal(f.networkCalls,0);
  f.press(start);await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/대기열이 비어/);assert.equal(f.siteQueries.length,0);assert.equal(f.generateCalls,0);
});

test('failed Firefox probe keeps Start clickable and explains why generation cannot proceed',async()=>{
  const f=panelFixture(null,{download:options=>options.onerror({error:'not_permitted'}),info:{downloadMode:'browser'}});
  f.press(f.panel.querySelector('[data-choose-folder]'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.panel.querySelector('[data-start]').disabled,false);assert.match(f.message(),/권한/);assert.equal(f.networkCalls,0);
  f.press(f.panel.querySelector('[data-start]'));await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/준비 확인/);assert.equal(f.siteQueries.length,0);assert.equal(f.generateCalls,0);
});

test('Start explains missing Chrome directory before touching generation controls',async()=>{
  const f=panelFixture(()=>Promise.reject(new Error('Not invoked')));
  f.press(f.panel.querySelector('[data-start]'));await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/저장 폴더/);assert.equal(f.siteQueries.length,0);assert.equal(f.generateCalls,0);assert.equal(f.networkCalls,0);
  assert.equal(f.panel.querySelector('[data-page="settings"]').hidden,false);
  assert.equal(f.document.activeElement,f.panel.querySelector('[data-choose-folder]'));
});

test('Start explains revoked folder permission and never queries or clicks site controls',async()=>{
  let permission='granted';const folder={name:'fixture',queryPermission:async()=>permission};
  const f=panelFixture(()=>Promise.resolve(folder));
  f.press(f.panel.querySelector('[data-choose-folder]'));await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.panel.querySelector('[data-folder]').textContent,/fixture/);
  permission='denied';f.press(f.panel.querySelector('[data-start]'));await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.message(),/쓰기 권한/);assert.equal(f.siteQueries.length,0);assert.equal(f.generateCalls,0);assert.equal(f.networkCalls,0);
});

test('Start stays disabled during a running job and becomes clickable after preparation failure',async()=>{
  let checks=0,finish;const folder={name:'fixture',queryPermission:()=>{
    checks++;return checks===4 ? new Promise(resolve=>{finish=resolve}) : Promise.resolve('granted');
  }};
  const f=panelFixture(()=>Promise.resolve(folder),{queue:[job()]});
  f.press(f.panel.querySelector('[data-choose-folder]'));await new Promise(resolve=>setImmediate(resolve));
  const start=f.panel.querySelector('[data-start]');f.press(start);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(checks,4);assert.equal(start.disabled,true);assert.equal(start.textContent,'실행 중');
  f.press(start);assert.equal(f.generateCalls,0);
  finish('denied');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(start.disabled,false);assert.match(f.message(),/쓰기 권한/);assert.equal(f.generateCalls,0);assert.equal(f.networkCalls,0);
});

test('browser-download resume preserves prior records and saves complete known outputs without paying again',async()=>{
  const j={...job(),taskId:'900',expected:4,state:'save_failed',saved:[{mediaId:'100',file:'100.png'}]};
  const done={...job(),state:'done',saved:[{mediaId:'200',file:'done.png'}]};
  resetDownloadProgress([j,done]);assert.equal(j.saved.length,0);assert.equal(j.previousDownloads[0].files[0].file,'100.png');assert.equal(done.saved.length,1);
  const {io,calls}=fixture(j);await processJob(j,io);assert.equal(j.saved.length,4);
  assert.equal(calls.filter(x=>x==='submit').length,0);assert.equal(calls.filter(x=>x.startsWith('save:')).length,4);
});

test('failed browser image completion stops the serial queue before a second paid job',async()=>{
  let submits=0,saves=0;const timers=downloadTimers();
  const first=job(),second={...job(),id:'second'};
  await assert.rejects((async()=>{
    for(const j of [first,second]) {
      const {io}=fixture(j,{submit:async()=>{submits++;return '900'},saveImage:async()=>{
        saves++;return managedDownload(options=>options.onerror({error:'not_succeeded'}),new Blob(['image']),'image.png',timers);
      }});await processJob(j,io);
    }
  })());assert.equal(submits,1);assert.equal(saves,1);assert.equal(first.state,'save_failed');assert.equal(second.state,'queued');
});

// Preset composition tests run against the distributed single userscript.
(() => {
const core=sandbox.module.exports;
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  return {version:1, common:{prompt:'masterpiece', negativePrompt:'lowres'},
    presets:[{id:'p1', name:'설정1', model:{id:'12345678901234567890', name:'모델', versionId:'23456789012345678901', family:'SDXL'}, loras:[{id:'10', name:'LoRA', weight:0, versionId:'11'}]}],
    characters:[{id:'c1', name:'캐릭터1', prompt:'1girl, (blue hair:1.2)', negativePrompt:'red hair'},
      {id:'c2', name:'캐릭터2', prompt:'1boy', negativePrompt:''}],
    scenes:[{id:'s1', name:'표정', prompt:'smile, masterpiece', negativePrompt:'sad'},
      {id:'s2', name:'행동', prompt:'running\n(arms up:1.2)', negativePrompt:''}],
    reservations:[{id:'r1', presetId:'p1', characterId:'c1', sceneId:'s1', count:2},
      {id:'r2', presetId:'p1', characterId:'c2', sceneId:'s2', count:1}]};
}
function expand(value, options = {}) {
  let index = 0;
  return core.expandPresetReservations(value, {idFactory:() => `job-${++index}`, ...options});
}
test('empty library has no shared mutable defaults', () => {
  const first = core.makePresetLibrary(), second = core.makePresetLibrary();
  first.common.prompt = 'changed'; first.presets.push('changed');
  assert.equal(second.common.prompt, ''); assert.equal(second.presets.length, 0);
  assert.equal(expand(second).length, 0);
});
test('common, character, scene order preserves prompt weighting, duplicates, and line breaks', () => {
  const result = expand(fixture());
  assert.equal(result[0].prompt, 'masterpiece, 1girl, (blue hair:1.2), smile, masterpiece');
  assert.equal(result[0].negativePrompt, 'lowres, red hair, sad');
  assert.equal(result[2].prompt, 'masterpiece, 1boy, running\n(arms up:1.2)');
  assert.equal(result[2].negativePrompt, 'lowres');
});
test('reservations expand in their listed order and count is generation button count', () => {
  const result = expand(fixture());
  assert.deepEqual(plain(result.map(item => [item.id, item.composition.reservation.id, item.composition.reservation.repeat])),
    [['job-1','r1',1],['job-2','r1',2],['job-3','r2',1]]);
  assert.equal(result[0].title, '캐릭터1_표정_설정1_1');
  assert.equal(result[0].state, 'queued'); assert.equal(result[0].saved.length, 0);
  assert.equal(result[0].configuration.model.id, '12345678901234567890');
  assert.equal(result[0].configuration.model.versionId, '23456789012345678901');
  assert.equal(result[0].configuration.model.family, 'SDXL');
  assert.equal(result[0].configuration.loras[0].versionId, '11');
  assert.equal(result[0].configuration.loras[0].weight, 0);
});
test('editing library and one job never changes existing job snapshots or configuration', () => {
  const library = fixture(), jobs = expand(library);
  const original = plain(jobs[1]);
  library.common.prompt = 'new common'; library.presets[0].loras[0].weight = 1;
  library.characters[0].prompt = 'new character'; library.scenes[0].prompt = 'new scene';
  jobs[0].configuration.model.id = '999'; jobs[0].configuration.loras[0].weight = 2;
  jobs[0].composition.common.prompt = 'new snapshot'; jobs[0].composition.preset.loras[0].weight = -1;
  assert.deepEqual(plain(jobs[1]), original);
  assert.equal(jobs[0].composition.preset.model.id, '12345678901234567890');
});
test('orphan references remain editable, but missing or empty references fail expansion', () => {
  for (const key of ['presetId','characterId','sceneId']) {
    for (const value of ['', 'missing']) {
      const library = fixture(); library.reservations[0][key] = value;
      if (value) {
        const normalized = core.normalizePresetLibrary(library).reservations[0];
        assert.equal(key === 'sceneId' ? normalized.sceneIds[0] : normalized[key], value);
      }
      assert.throws(() => expand(library), /ID|없습니다/);
    }
  }
});
test('all lists reject duplicate entry IDs, and duplicate LoRA IDs fail', () => {
  for (const key of ['presets','characters','scenes','reservations']) {
    const library = fixture(); library[key].push(structuredClone(library[key][0]));
    assert.throws(() => expand(library), /중복/);
  }
  const library = fixture(); library.presets[0].loras.push({...library.presets[0].loras[0], weight:1});
  assert.throws(() => expand(library), /중복/);
});
test('model and version IDs stay strings and reject invalid types; LoRA versions are optional', () => {
  for (const id of ['abc', '', 123, null]) {
    const library = fixture(); library.presets[0].model.id = id;
    assert.throws(() => expand(library), /ID|문자열/);
    library.presets[0].model.id = '123'; library.presets[0].loras[0].id = id;
    assert.throws(() => expand(library), /ID|문자열/);
    const versionLibrary = fixture(); versionLibrary.presets[0].model.versionId = id;
    assert.throws(() => expand(versionLibrary), /ID|문자열/);
    if (id !== '' && id !== null) {
      versionLibrary.presets[0].model.versionId = '456'; versionLibrary.presets[0].loras[0].versionId = id;
      assert.throws(() => expand(versionLibrary), /ID|문자열/);
    }
  }
  const library = fixture(); delete library.presets[0].loras[0].versionId; delete library.presets[0].model.family;
  const config = expand(library)[0].configuration;
  assert.equal('versionId' in config.loras[0], false); assert.equal('family' in config.model, false);
});
test('zero LoRA weight is preserved, finite numeric strings normalize, invalid weights fail', () => {
  const library = fixture(); library.presets[0].loras[0].weight = '0';
  assert.equal(expand(library)[0].configuration.loras[0].weight, 0);
  for (const weight of [NaN, Infinity, -Infinity, '', ' ', 'bad', null, true, {}, 2.01, -2.01]) {
    library.presets[0].loras[0].weight = weight;
    assert.throws(() => expand(library), /수치/);
  }
});
test('LoRA range is an option without rounding or silently clamping values', () => {
  const library = fixture(); library.presets[0].loras[0].weight = 3.125;
  assert.throws(() => expand(library), /수치/);
  assert.equal(expand(library, {minLoraWeight:0, maxLoraWeight:4})[0].configuration.loras[0].weight, 3.125);
  assert.throws(() => expand(library, {minLoraWeight:2, maxLoraWeight:1}), /범위/);
});
test('repeat count is an integer 1 through 100', () => {
  for (const count of [0, -1, 101, 1.5, Infinity, '', null, true]) {
    const library = fixture(); library.reservations[0].count = count;
    assert.throws(() => expand(library), /반복 횟수/);
  }
  const library = fixture(); library.reservations[0].count = '100';
  assert.equal(expand(library).length, 101);
});
test('total jobs cap is 1000 inclusive and includes every reservation', () => {
  const library = fixture();
  library.reservations = Array.from({length:10}, (_, i) => ({id:`r${i}`, presetId:'p1', characterId:'c1', sceneId:'s1', count:100}));
  assert.equal(expand(library).length, 1000);
  library.reservations.push({id:'overflow', presetId:'p1', characterId:'c1', sceneId:'s1', count:1});
  assert.throws(() => expand(library), /1,000/);
});
test('max credit cost is null when blank, otherwise a positive safe integer', () => {
  for (const maxCredits of [undefined, null, '', ' ']) assert.equal(expand(fixture(), {maxCredits})[0].maxCredits, null);
  assert.equal(expand(fixture(), {maxCredits:'7800'})[0].maxCredits, 7800);
  for (const maxCredits of [0, -1, 1.5, Infinity, NaN, true, {}, 'bad']) assert.throws(() => expand(fixture(), {maxCredits}), /상한/);
});
test('explicit empty character and scene entries allow common-only prompting, but empty combined prompt fails', () => {
  const library = fixture(); library.characters[0].prompt = ''; library.scenes[0].prompt = '';
  assert.equal(expand(library)[0].prompt, 'masterpiece');
  library.common.prompt = '';
  assert.throws(() => expand(library), /비어 있습니다/);
});
test('unsupported versions, malformed lists, nonstring prompts, and duplicate generated job IDs fail', () => {
  const library = fixture(); library.version = 2;
  assert.throws(() => expand(library), /버전/);
  library.version = 1; library.presets = null;
  assert.throws(() => expand(library), /목록/);
  const second = fixture(); second.common.prompt = {toString:() => 'surprise'};
  assert.throws(() => expand(second), /문자열/);
  assert.throws(() => expand(fixture(), {idFactory:() => 'same'}), /중복/);
});

test('legacy single-scene reservations normalize into sceneIds without changing version-one stored sources', () => {
  const library = fixture(), original = plain(library);
  const normalized = core.normalizePresetLibrary(library);
  assert.equal(normalized.version, 1);
  assert.deepEqual(plain(normalized.scenes), library.scenes);
  assert.deepEqual(plain(normalized.reservations.map(item => item.sceneIds)), [['s1'], ['s2']]);
  assert.equal('sceneId' in normalized.reservations[0], false);
  assert.deepEqual(library, original);
  const result = expand(library);
  assert.equal(result[0].composition.version, 2);
  assert.deepEqual(plain(result[0].composition.chunks), [library.scenes[0]]);
  assert.equal('scene' in result[0].composition, false);
  assert.equal(result[0].title, '캐릭터1_표정_설정1_1');
});
test('multiple chunks form one prompt in selection order, with count generation jobs rather than chunk multiplication', () => {
  const library = fixture(); library.reservations = [{...library.reservations[0], sceneIds:['s2','s1']}];
  const result = expand(library);
  assert.equal(result.length, 2);
  assert.equal(result[0].prompt, 'masterpiece, 1girl, (blue hair:1.2), running\n(arms up:1.2), smile, masterpiece');
  assert.equal(result[0].negativePrompt, 'lowres, red hair, sad');
  assert.equal(result[0].title, '캐릭터1_행동+표정_설정1_1');
  assert.deepEqual(plain(result[0].composition.reservation.sceneIds), ['s2','s1']);
  assert.deepEqual(plain(result[0].composition.chunks.map(item => item.id)), ['s2','s1']);
});
test('zero chunks explicitly overrides legacy scene selection and keeps common plus character prompting', () => {
  const library = fixture(); library.reservations = [{...library.reservations[0], sceneId:'missing legacy value', sceneIds:[]}];
  const result = expand(library);
  assert.equal(result.length, 2);
  assert.equal(result[0].prompt, 'masterpiece, 1girl, (blue hair:1.2)');
  assert.equal(result[0].negativePrompt, 'lowres, red hair');
  assert.equal(result[0].title, '캐릭터1_설정1_1');
  assert.deepEqual(plain(result[0].composition.chunks), []);
});
test('sceneIds must be an array when present; invalid canonical values never fall back to legacy sceneId', () => {
  for (const sceneIds of [undefined, null, 's1', 1, {}, true]) {
    const library = fixture(); library.reservations[0].sceneIds = sceneIds;
    assert.throws(() => core.normalizePresetLibrary(library), /목록 형식/);
  }
});
test('duplicate and empty chunk IDs are rejected, while orphan chunk references remain editable until enqueue', () => {
  for (const sceneIds of [['s1','s1'], ['s1',' s1 '], [''], [null], [1]]) {
    const library = fixture(); library.reservations[0].sceneIds = sceneIds;
    assert.throws(() => expand(library), /중복|ID|문자열/);
  }
  const orphan = fixture(); orphan.reservations[0].sceneIds = ['s1','missing'];
  assert.deepEqual(plain(core.normalizePresetLibrary(orphan).reservations[0].sceneIds), ['s1','missing']);
  assert.throws(() => expand(orphan), /청크가 없습니다: missing/);
});
test('LoRA triggers survive JSON round trips, normalize CRLF, and omit blank triggers', () => {
  const library = fixture();
  library.presets[0].loras[0].triggerWords = '  (style:0.7), line one\r\nline two  ';
  library.presets[0].loras.push({id:'20', name:'blank trigger', weight:0.7, triggerWords:' \r\n '});
  const normalized = core.normalizePresetLibrary(library);
  const restored = core.normalizePresetLibrary(JSON.parse(JSON.stringify(normalized)));
  assert.equal(restored.presets[0].loras[0].triggerWords, '(style:0.7), line one\nline two');
  assert.equal('triggerWords' in restored.presets[0].loras[1], false);
  assert.deepEqual(plain(restored), plain(normalized));
  const config = expand(restored)[0].configuration;
  assert.equal(config.loras[0].triggerWords, '(style:0.7), line one\nline two');
  assert.equal(config.loras[0].weight, 0);
});
test('common, LoRA triggers, character, and chunk positives preserve order and duplicate weighted tags', () => {
  const library = fixture();
  library.presets[0].loras[0].triggerWords = 'masterpiece, (trigger:1.2)';
  library.presets[0].loras.push({id:'20', name:'second', weight:0.7, triggerWords:'second trigger\n(masterpiece:0.8)'});
  library.reservations = [{...library.reservations[0], sceneIds:['s2','s1']}];
  const result = expand(library);
  assert.equal(result[0].prompt, 'masterpiece, masterpiece, (trigger:1.2), second trigger\n(masterpiece:0.8), 1girl, (blue hair:1.2), running\n(arms up:1.2), smile, masterpiece');
  assert.equal(result[0].negativePrompt, 'lowres, red hair, sad');
});
test('nonstring LoRA trigger values fail validation and direct prompt composition', () => {
  for (const triggerWords of [null, undefined, 1, false, [], {}]) {
    const library = fixture(); library.presets[0].loras[0].triggerWords = triggerWords;
    assert.throws(() => core.normalizePresetLibrary(library), /트리거.*문자열/);
    assert.throws(() => core.composePresetPrompts(library.common, library.characters[0], [], library.presets[0]), /트리거.*문자열/);
  }
});
test('legacy three-argument composition remains compatible and empty chunk arrays are accepted', () => {
  const library = fixture();
  assert.deepEqual(plain(core.composePresetPrompts(library.common, library.characters[0], library.scenes[0])), {
    prompt:'masterpiece, 1girl, (blue hair:1.2), smile, masterpiece', negativePrompt:'lowres, red hair, sad'
  });
  assert.deepEqual(plain(core.composePresetPrompts(library.common, library.characters[0], [])), {
    prompt:'masterpiece, 1girl, (blue hair:1.2)', negativePrompt:'lowres, red hair'
  });
});
test('chunk and trigger snapshots are isolated from library edits, other jobs, and configuration edits', () => {
  const library = fixture(); library.presets[0].loras[0].triggerWords = 'original trigger';
  library.reservations = [{...library.reservations[0], sceneIds:['s1','s2']}];
  const jobs = expand(library), second = plain(jobs[1]);
  library.presets[0].loras[0].triggerWords = 'new trigger'; library.scenes[0].prompt = 'new expression';
  library.reservations[0].sceneIds.reverse();
  jobs[0].configuration.loras[0].triggerWords = 'changed job config';
  jobs[0].composition.chunks[0].prompt = 'changed job chunk';
  jobs[0].composition.reservation.sceneIds.reverse();
  assert.deepEqual(plain(jobs[1]), second);
  assert.equal(jobs[0].composition.preset.loras[0].triggerWords, 'original trigger');
  assert.equal(jobs[0].prompt, 'masterpiece, original trigger, 1girl, (blue hair:1.2), smile, masterpiece, running\n(arms up:1.2)');
});
test('displayed configuration verification continues to compare model/version/LoRA numbers independent of triggers', () => {
  const preset = fixture().presets[0], expected = {...preset, loras:[{...preset.loras[0], triggerWords:'prompt-only trigger'}]};
  const actual = {...preset, loras:[{...preset.loras[0]}]};
  assert.equal(core.assertConfiguration(expected, actual).loras[0].weight, 0);
  actual.loras[0].weight = 0.1;
  assert.throws(() => core.assertConfiguration(expected, actual), /LoRA/);
});

})();

// Visible settings controls: fake DOM, never a paid browser test.
(() => {
const core=sandbox.module.exports;
const plain = value => JSON.parse(JSON.stringify(value));

// Small visible DOM fixture, with native value-setter branding and event delivery.
// It simulates settings controls only; it is not real Firefox/PixAI proof.
function selectorParts(selector) {
  const parts = []; let start=0, depth=0, quote='';
  for (let i=0;i<selector.length;i++) {
    const char=selector[i];
    if (quote) { if (char===quote) quote=''; continue; }
    if (char==='"' || char==="'") { quote=char; continue; }
    if (char==='[') depth++;
    if (char===']') depth--;
    if (/\s/.test(char) && !depth) { if (i>start) parts.push(selector.slice(start,i)); start=i+1; }
  }
  if (start<selector.length) parts.push(selector.slice(start));
  return parts;
}
function matchesPart(element, part) {
  const tag=part.match(/^[a-z][\w-]*/i)?.[0];
  if (tag && element.tagName!==tag.toUpperCase()) return false;
  const attrs=[...part.matchAll(/\[([\w-]+)(\*=|=)?(?:"([^"]*)"|'([^']*)'|([^\]]*))?\]/g)];
  return attrs.every(([,name,operator,double,single,bare])=>{
    const actual=element.getAttribute(name), wanted=double??single??bare??'';
    return actual!=null && (!operator || (operator==='*=' ? actual.includes(wanted) : actual===wanted));
  });
}
function matches(element, selector) {
  const parts=selectorParts(selector);
  if (!matchesPart(element,parts.at(-1))) return false;
  let ancestor=element.parentElement;
  for (let i=parts.length-2;i>=0;i--) {
    while (ancestor && !matchesPart(ancestor,parts[i])) ancestor=ancestor.parentElement;
    if (!ancestor) return false;
    ancestor=ancestor.parentElement;
  }
  return true;
}
class Element {
  constructor(tag,attrs={},text='') { this.tagName=tag.toUpperCase();this.attrs={...attrs};this.text=text;this.children=[];this.parentElement=null;this.disabled=false;this.readOnly=false;this.hidden=false;this.events=[];this.onClick=null; }
  append(...children) { for (const child of children) { child.parentElement=this;this.children.push(child); } return this; }
  remove() { if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null; }
  get textContent() { return this.text+this.children.map(child=>child.textContent).join(''); }
  set textContent(value) { this.text=value;this.children=[]; }
  getAttribute(name) { return Object.hasOwn(this.attrs,name) ? this.attrs[name] : null; }
  setAttribute(name,value) { this.attrs[name]=String(value); }
  getClientRects() { let current=this;while(current){if(current.hidden)return [];current=current.parentElement;}return [{}]; }
  contains(target) { return target===this || this.children.some(child=>child.contains(target)); }
  querySelectorAll(selector) { return this.children.flatMap(child=>[...(matches(child,selector)?[child]:[]),...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  click() { this.onClick?.(); }
  dispatchEvent(event) { this.events.push(event.type);this.onEvent?.(event);return true; }
  blur() { this.blurred=true; }
}
class Input extends Element {
  constructor(attrs={},value='') { super('input',attrs);this._value=String(value); }
  get value(){return this._value;}
  set value(value){if(!(this instanceof Input))throw new TypeError('Illegal invocation');this._value=String(value);}
}
class Textarea extends Element {
  constructor(attrs={},value='') { super('textarea',attrs);this._value=String(value); }
  get value(){return this._value;}
  set value(value){if(!(this instanceof Textarea))throw new TypeError('Illegal invocation');this._value=String(value);}
}
class Select extends Element {
  constructor(value='') { super('select');this._value=String(value); }
  get value(){return this._value;}
  set value(value){if(!(this instanceof Select))throw new TypeError('Illegal invocation');this._value=String(value);}
}
const win={HTMLInputElement:Input,HTMLTextAreaElement:Textarea,HTMLSelectElement:Select,Event:class {constructor(type,options){this.type=type;Object.assign(this,options);}}};
function configuration(model={id:'1',versionId:'11',name:'현재 모델'},loras=[]) { return {model:{...model},loras:loras.map(item=>({...item}))}; }
function fixture(options={}) {
  const doc=new Element('document'),main=new Element('main');doc.append(main);
  const state={model:{id:'1',versionId:'11',name:'현재 모델'},loras:[],paidClicks:0,checks:0,mutations:0,clicks:[],...options.state};
  const catalogs={models:options.models||[{id:'2',versionId:'22',defaultVersion:'21',name:'대상 모델',versions:['21','22']}],
    loras:options.loras||[{id:'20',versionId:'201',name:'대상 LoRA',weight:1}]};
  const button=(text,attrs={},action=()=>{})=>{const node=new Element('button',attrs,text);node.onClick=()=>{state.clicks.push(text||attrs['aria-label']);action();};return node;};
  const modelSection=new Element('section',{'data-section':'model'}),stylesSection=new Element('section',{'data-section':'styles'}),settingsSection=new Element('section',{'data-section':'settings'});
  const modelCard=new Element('div',{'data-testid':'selected-entity-card'}),modelLink=new Element('a'),modelImageLink=new Element('a'),rows=new Element('div');
  modelCard.append(modelImageLink,modelLink);modelSection.append(modelCard);stylesSection.append(rows);
  function refreshModel() {modelLink.attrs.href=modelImageLink.attrs.href=`/en/model/${state.model.id}/${state.model.versionId}`;modelLink.textContent=state.model.name;}
  function renderRows() {
    rows.children=[];
    for(const lora of state.loras) {
      const row=new Element('div',{'data-testid':'selected-entity-card'}),link=new Element('a',{href:`/en/model/${lora.id}/${lora.versionId}`},lora.name);
      const imageLink=new Element('a',{href:`/en/model/${lora.id}/${lora.versionId}`});
      const input=new Input({type:'number','aria-label':options.english?'Weight':'비중',min:options.min??'-2',max:options.max??'2',step:options.step??'0.1'},lora.weight);
      input.disabled=!!options.disabledLora;input.onEvent=event=>{if(event.type==='input')lora.weight=Number(input.value);};
      const remove=button('',{'aria-label':options.english?'Remove':'제거'},()=>{state.loras=state.loras.filter(item=>item.id!==lora.id);renderRows();});
      // The input is nested one level deeper than the link/remove controls.
      row.append(imageLink,link,new Element('div').append(input),remove);
      if(lora.incompatible)row.append(new Element('span',{class:'text-danger'},'호환 불가'));
      rows.append(row);
    }
  }
  let opened=null;
  function close(){opened?.remove();opened=null;}
  function openModel() {
    opened=new Element('div',{role:'dialog'});doc.append(opened);opened.append(button('',{'aria-label':options.english?'Close':'닫기'},close));
    if(options.noCards)return;
    opened.append(new Input({type:'search'}));
    for(const model of catalogs.models) {
      const label=new Element('label',{title:model.name}),radio=new Input({type:'radio'});
      label.append(radio,new Element('a',{href:`/ko/model/${model.id}/${model.versionId}`},model.name));
      radio.onClick=()=>{
        state.clicks.push(`radio:${model.id}`);
        const selected=new Select(model.defaultVersion||model.versionId);
        for(const version of model.versions||[]) {const option=new Element('option');option.value=version;selected.append(option);}
        if(model.versions?.length)opened.append(selected);
        opened.append(button(model.name),button(options.english?'Use this model':'이 모델 사용',{},()=>{
          state.model={id:model.id,versionId:model.versions?.length?selected.value:model.defaultVersion||model.versionId,name:model.name};
          refreshModel();close();
        }));
      };
      opened.append(label);
    }
  }
  function openLora() {
    opened=new Element('div',{role:'dialog'});doc.append(opened);opened.append(button('',{'aria-label':options.english?'Close':'닫기'},close),new Input({type:'search'}));
    let pending=null;
    for(const lora of catalogs.loras) {
      const label=new Element('label',{title:lora.name}),checkbox=new Input({type:'checkbox'});
      label.append(checkbox,new Element('a',{href:`/ko/model/${lora.id}/${lora.versionId}`},lora.name));
      checkbox.onClick=()=>{state.clicks.push(`checkbox:${lora.id}`);pending=lora;opened.append(new Element('span',{id:`weight-slider-${lora.id}`}));};
      opened.append(label);
    }
    opened.append(button(options.loraConfirmLabel || (options.english?'Confirm selection':'확인'),{},()=>{if(pending)state.loras.push({...pending});renderRows();close();}));
    if(options.duplicateLoraConfirm)opened.append(button('Confirm',{},()=>{state.paidClicks++;}));
  }
  const tab=button(options.english?'Model':'모델',{role:'tab','aria-selected':options.modelTabHidden?'false':'true'},()=>{tab.setAttribute('aria-selected','true');allModel.hidden=false;allLora.hidden=false;modelCard.hidden=false;rows.hidden=false;});
  const allModel=button(options.english?'See All Models':'전체 모델 보기',{},openModel),allLora=button(options.english?'See All LoRAs':'전체 LoRA 보기',{},openLora);
  allModel.hidden=!!options.modelTabHidden||!!options.noModelButton;allLora.hidden=!!options.modelTabHidden;
  modelCard.hidden=rows.hidden=!!options.modelTabHidden;
  modelSection.append(allModel);stylesSection.append(allLora);
  main.append(tab,modelSection,stylesSection,settingsSection,button('생성! 7,800',{},()=>{state.paidClicks++;}));
  refreshModel();renderRows();
  let negative=null;
  const attachNegative=()=>{if(!negative){negative=new Textarea({placeholder:options.english?'Enter negative prompt here':'여기에 네거티브 프롬프트를 입력하세요'},options.negativeValue||'');settingsSection.append(negative);}};
  if(options.negativeVisible)attachNegative();
  if(options.negativeAdvanced) {
    const advanced=button(options.english?'Advanced':'고급',{'aria-expanded':'false'},()=>{advanced.setAttribute('aria-expanded','true');attachNegative();});settingsSection.append(advanced);
  }
  if(options.openDialog){opened=new Element('div',{role:'dialog'});doc.append(opened);}
  const io={win,check(){state.checks++;if(options.cancelled)throw new Error('중단됨');},mutate(action){state.mutations++;return action();},sleep:async()=>{}};
  return {doc,main,state,modelSection,stylesSection,settingsSection,modelCard,modelLink,rows,negative:()=>negative,adapter:core.createPixaiSettingsAdapter(doc,io)};
}

test('model links retain exact numeric ID/version and reject broad or malformed URLs',()=>{
  assert.deepEqual(plain(core.parseModelLink('/ko/model/12345678901234567890/23456789012345678901?x=1')),{id:'12345678901234567890',versionId:'23456789012345678901'});
  assert.deepEqual(plain(core.parseModelLink('/model/1/11/')),{id:'1',versionId:'11'});
  for(const url of ['/ko/model/1','/ko/model/1/abc','/ko/model/1/11/extra','https://evil.test/ko/model/1/11','/ko/model/1x/11'])assert.equal(core.parseModelLink(url),null);
});
test('model version mismatch rejects the same model ID',()=>{
  assert.throws(()=>core.assertConfiguration(configuration(),configuration({id:'1',versionId:'12',name:'same'})),/모델 버전/);
  assert.throws(()=>core.assertConfiguration(configuration(),configuration({id:'2',versionId:'11',name:'same'})),/모델 버전/);
});
test('LoRA comparison ignores order and names, but preserves zero weights and exact version',()=>{
  const target=configuration(undefined,[{id:'10',versionId:'101',name:'A',weight:0},{id:'20',versionId:'201',name:'B',weight:0.7}]);
  const actual=configuration(undefined,[{id:'20',versionId:'201',name:'renamed',weight:0.7},{id:'10',versionId:'101',name:'renamed',weight:0}]);
  assert.equal(core.assertConfiguration(target,actual).loras.length,2);
  for(const mutate of [config=>config.loras.pop(),config=>config.loras.push({id:'30',versionId:'301',name:'extra',weight:1}),config=>config.loras[1].weight=0.1,config=>config.loras[1].versionId='102']) {
    const changed=plain(actual);mutate(changed);assert.throws(()=>core.assertConfiguration(target,changed),/LoRA/);
  }
});
test('numeric LoRA fields enforce range and anchored step without rounding',()=>{
  const field=new Input({min:'-1',max:'2',step:'0.2'});
  for(const value of [-1,-0.8,0,1,2])core.assertNumberField(field,value);
  for(const value of [-1.1,2.1,NaN,Infinity])assert.throws(()=>core.assertNumberField(field,value),/범위/);
  assert.throws(()=>core.assertNumberField(field,0.1),/간격/);
  const arbitrary=new Input({min:'0',max:'1',step:'any'});core.assertNumberField(arbitrary,0.123456789);
  const noMin=new Input({step:'0.25'});core.assertNumberField(noMin,0.75);assert.throws(()=>core.assertNumberField(noMin,0.1),/간격/);
});
test('capture reads the visible model and LoRA rows, including zero, without paid clicks',async()=>{
  const f=fixture({state:{loras:[{id:'10',versionId:'101',name:'캐릭터 LoRA',weight:0}]},modelTabHidden:true});
  const hidden=new Element('a',{href:'/ko/model/999/9991'},'숨겨진 모델');hidden.hidden=true;f.modelCard.append(hidden);
  const result=await f.adapter.capture();
  assert.deepEqual(plain(result),configuration(undefined,[{id:'10',versionId:'101',name:'캐릭터 LoRA',weight:0}]));
  assert.deepEqual(f.state.clicks,['모델']);assert.equal(f.state.paidClicks,0);
});
test('capture rejects ambiguous visible model links and open settings dialogs without submission',async()=>{
  const f=fixture();f.modelCard.append(new Element('a',{href:'/ko/model/2/22'},'추가 모델'));
  await assert.rejects(f.adapter.capture(),/현재 모델 버전/);assert.equal(f.state.paidClicks,0);
  const opened=fixture({openDialog:true});await assert.rejects(opened.adapter.capture(),/먼저 닫아/);
  await assert.rejects(opened.adapter.apply(configuration()),/먼저 닫아/);assert.equal(opened.state.mutations,0);
});
test('selected model card ignores recommendation/history links and the legacy model key follows only the selected version',async()=>{
  const f=fixture();
  const recommendation=new Element('a',{href:'/en/model/9/99'},'추천 모델');recommendation.parentElement=f.modelSection;f.modelSection.children.unshift(recommendation);
  f.main.append(new Element('div').append(new Element('a',{href:'/en/model/8/88'},'이전 작업 모델')));
  f.stylesSection.append(new Element('a',{href:'/en/model/7/77'},'추천 LoRA'));
  f.settingsSection.append(new Input({type:'number','aria-label':'비중'},0.8),new Element('a',{href:'/en/model/6/66'},'다른 설정 링크'));
  assert.deepEqual(plain(await f.adapter.capture()),configuration());assert.equal(f.adapter.modelKey(),'1/11');
  f.modelLink.setAttribute('href','/en/model/2/22');assert.equal(f.adapter.modelKey(),'2/22');
  assert.equal(f.state.paidClicks,0);assert.equal(f.state.mutations,0);
});
test('capture opens the English model tab even when visible recommended/history model links already exist',async()=>{
  const f=fixture({english:true,modelTabHidden:true});
  f.main.append(new Element('a',{href:'/en/model/9/99'},'visible recommendation'));
  assert.deepEqual(plain(await f.adapter.capture()),configuration());assert.deepEqual(f.state.clicks,['Model']);assert.equal(f.state.paidClicks,0);
});
test('missing or malformed selected model card cannot fall back to a valid recommended model link',async()=>{
  for(const mode of ['missing','invalid']) {
    const f=fixture();f.modelSection.append(new Element('a',{href:'/en/model/9/99'},'valid recommendation'));
    if(mode==='missing')f.modelCard.remove();else f.modelLink.setAttribute('href','/en/model/1/not-a-version');
    assert.throws(()=>f.adapter.modelKey(),/현재 모델 버전/);
    await assert.rejects(f.adapter.capture(),/선택 모델 카드.*시간 초과/);assert.equal(f.state.paidClicks,0);
  }
});
test('English selected LoRA weight is captured without Korean labels and removed only inside its own card',async()=>{
  const lora={id:'10',versionId:'101',name:'LoRA',weight:0};
  const f=fixture({english:true,state:{loras:[{...lora}]}});
  assert.deepEqual(plain(await f.adapter.capture()),configuration(undefined,[lora]));
  assert.equal((await f.adapter.apply(configuration())).loras.length,0);assert.deepEqual(f.state.clicks,['Remove']);assert.equal(f.state.paidClicks,0);
});
test('a styles LoRA number row is read without a shared card test ID or weight aria-label',async()=>{
  const lora={id:'10',versionId:'101',name:'LoRA',weight:0.7},f=fixture({state:{loras:[{...lora}]}});
  delete f.rows.children[0].attrs['data-testid'];delete f.rows.querySelector('input').attrs['aria-label'];
  assert.deepEqual(plain(await f.adapter.capture()),configuration(undefined,[lora]));assert.equal(f.state.paidClicks,0);
});
test('unsupported or ambiguous selected LoRA weight controls fail closed instead of silently omitting the LoRA',async()=>{
  for(const mode of ['range','multiple','no-version']) {
    const f=fixture({state:{loras:[{id:'10',versionId:'101',name:'LoRA',weight:0.5}]}}),row=f.rows.children[0];
    if(mode==='range')row.querySelector('input').setAttribute('type','range');
    if(mode==='multiple')row.append(new Input({type:'number'},0.5));
    if(mode==='no-version')row.querySelectorAll('a').forEach(link=>link.setAttribute('href','/en/model/10'));
    await assert.rejects(f.adapter.capture(),/선택 LoRA/);assert.equal(f.state.paidClicks,0);
  }
});
test('an unrecognized styles number input cannot borrow a recommended model identity across the section boundary',async()=>{
  const f=fixture();f.stylesSection.append(new Input({type:'number'},0.5),new Element('a',{href:'/en/model/9/99'},'style recommendation'));
  await assert.rejects(f.adapter.capture(),/선택 LoRA 행/);assert.equal(f.state.paidClicks,0);
});
test('incompatible LoRA blocks capture and final apply, but extras can be removed while changing settings',async()=>{
  const row={id:'10',versionId:'101',name:'호환 불가',weight:0.5,incompatible:true};
  const f=fixture({state:{loras:[{...row}]}});
  await assert.rejects(f.adapter.capture(),/호환/);
  await assert.rejects(f.adapter.apply(configuration(undefined,[{id:'10',versionId:'101',name:'호환 불가',weight:0.5}])),/호환/);
  assert.equal(f.state.paidClicks,0);
  const removable=fixture({state:{loras:[{...row}]}});
  const result=await removable.adapter.apply(configuration());
  assert.equal(result.loras.length,0);assert.deepEqual(removable.state.clicks,['제거']);assert.equal(removable.state.paidClicks,0);
});
test('apply changes model version, removes extra LoRA, adds target, and sets zero with no paid click',async()=>{
  const f=fixture({state:{loras:[{id:'10',versionId:'101',name:'기존 LoRA',weight:0.7}]}});
  const expected=configuration({id:'2',versionId:'22',name:'대상 모델'},[{id:'20',versionId:'201',name:'대상 LoRA',weight:0}]);
  const result=await f.adapter.apply(expected);
  assert.deepEqual(plain(result),expected);assert.equal(f.state.paidClicks,0);
  assert.deepEqual(f.state.clicks,['전체 모델 보기','radio:2','이 모델 사용','제거','전체 LoRA 보기','checkbox:20','확인']);
  assert.equal(f.doc.querySelector('[role="dialog"]'),null);
  assert.deepEqual(f.rows.querySelector('input').events,['input','change']);
});

test('English site controls apply exact model/LoRA settings and negatives without submitting',async()=>{
  const f=fixture({english:true,modelTabHidden:true,negativeAdvanced:true,state:{loras:[{id:'10',versionId:'101',name:'Old LoRA',weight:0.7}]}});
  const expected=configuration({id:'2',versionId:'22',name:'대상 모델'},[{id:'20',versionId:'201',name:'대상 LoRA',weight:0}]);
  assert.deepEqual(plain(await f.adapter.apply(expected)),expected);
  await f.adapter.setNegative('lowres');f.adapter.verifyNegative('lowres');
  assert.deepEqual(f.state.clicks,['Model','See All Models','radio:2','Use this model','Remove','See All LoRAs','checkbox:20','Confirm selection','Advanced']);
  assert.equal(f.negative().value,'lowres');assert.equal(f.state.paidClicks,0);
});

test('English popup failure closes only its settings dialog and never generates',async()=>{
  const f=fixture({english:true,noCards:true});await assert.rejects(f.adapter.apply(configuration({id:'2',versionId:'22',name:'missing'})),/검색창/);
  assert.deepEqual(f.state.clicks,['See All Models','Close']);assert.equal(f.doc.querySelector('[role="dialog"]'),null);assert.equal(f.state.paidClicks,0);
});

test('legacy English Confirm label still applies the exact LoRA without generating',async()=>{
  const f=fixture({english:true,loraConfirmLabel:'Confirm'});
  const expected=configuration(undefined,[{id:'20',versionId:'201',name:'대상 LoRA',weight:0.5}]);
  assert.deepEqual(plain(await f.adapter.apply(expected)),expected);
  assert.deepEqual(f.state.clicks,['See All LoRAs','checkbox:20','Confirm']);
  assert.equal(f.state.paidClicks,0);
});

test('ambiguous English LoRA confirmation controls stop and close the dialog without generating',async()=>{
  const f=fixture({english:true,duplicateLoraConfirm:true});
  await assert.rejects(f.adapter.apply(configuration(undefined,[{id:'20',versionId:'201',name:'대상 LoRA',weight:0.5}])),/LoRA 확인 버튼/);
  assert.equal(f.state.paidClicks,0);assert.equal(f.state.loras.length,0);
  assert.equal(f.doc.querySelector('[role="dialog"]'),null);
});
test('exact-version selection failure stops after settings changes without submission',async()=>{
  const f=fixture({models:[{id:'2',versionId:'22',defaultVersion:'21',name:'대상 모델'}]});
  await assert.rejects(f.adapter.apply(configuration({id:'2',versionId:'22',name:'대상 모델'})),/저장한 버전/);
  assert.equal(f.state.model.versionId,'21');assert.equal(f.state.paidClicks,0);
  assert.equal(f.doc.querySelector('[role="dialog"]'),null);
});
test('LoRA target version mismatch after selection blocks without applying the weight or paying',async()=>{
  const f=fixture();
  await assert.rejects(f.adapter.apply(configuration(undefined,[{id:'20',versionId:'202',name:'대상 LoRA',weight:0}])),/저장한 버전/);
  assert.equal(f.state.loras[0].weight,1);assert.equal(f.state.paidClicks,0);
});
test('unsupported negative prompt accepts empty but rejects nonempty, without settings mutations or paid click',async()=>{
  const f=fixture();assert.equal(await f.adapter.captureNegative(),'');
  await f.adapter.setNegative('');f.adapter.verifyNegative('');
  await assert.rejects(f.adapter.setNegative('lowres'),/네거티브 입력창/);
  assert.throws(()=>f.adapter.verifyNegative('lowres'),/조합과 다릅니다/);
  assert.equal(f.state.mutations,0);assert.equal(f.state.paidClicks,0);
});
test('negative prompt opens visible advanced controls and uses textarea value setter/events',async()=>{
  const f=fixture({negativeAdvanced:true,negativeValue:'old'});
  assert.equal(await f.adapter.captureNegative(),'old');await f.adapter.setNegative('lowres, (bad hands:1.2)');
  f.adapter.verifyNegative('lowres, (bad hands:1.2)');
  assert.equal(f.negative().value,'lowres, (bad hands:1.2)');assert.deepEqual(f.negative().events,['input','change']);
  assert.deepEqual(f.state.clicks,['고급']);assert.equal(f.state.paidClicks,0);
  assert.throws(()=>f.adapter.verifyNegative('different'),/조합과 다릅니다/);
});
test('missing model controls times out before changing settings or submitting',async()=>{
  const f=fixture({noModelButton:true});
  f.modelLink.hidden=true;
  await assert.rejects(f.adapter.apply(configuration()),/선택 모델 카드.*시간 초과/);
  assert.equal(f.state.mutations,0);assert.equal(f.state.paidClicks,0);assert.equal(f.state.model.id,'1');
});
test('readable current settings do not depend on a model picker button or change the site',async()=>{
  const f=fixture({noModelButton:true});
  assert.deepEqual(plain(await f.adapter.capture()),configuration());
  assert.equal(f.state.mutations,0);assert.equal(f.state.paidClicks,0);
});
test('failed card search closes its popup and does not submit or falsely accept a model',async()=>{
  const f=fixture({noCards:true});
  await assert.rejects(f.adapter.apply(configuration({id:'2',versionId:'22',name:'대상 모델'})),/검색창/);
  assert.deepEqual(f.state.clicks,['전체 모델 보기','닫기']);assert.equal(f.doc.querySelector('[role="dialog"]'),null);
  assert.equal(f.state.model.id,'1');assert.equal(f.state.paidClicks,0);
});
test('disabled weight field or out-of-range/step target fails without submitting',async()=>{
  const lora={id:'10',versionId:'101',name:'LoRA',weight:0.5};
  const disabled=fixture({disabledLora:true,state:{loras:[{...lora}]}});
  await assert.rejects(disabled.adapter.apply(configuration(undefined,[lora])),/입력창/);assert.equal(disabled.state.paidClicks,0);
  for(const [options,weight,pattern] of [[{min:'0',max:'1'},1.5,/범위/],[{min:'0',max:'1',step:'0.1'},0.15,/간격/]]) {
    const f=fixture({...options,state:{loras:[{...lora}]}});
    await assert.rejects(f.adapter.apply(configuration(undefined,[{...lora,weight}])),pattern);
    assert.equal(f.state.loras[0].weight,0.5);assert.equal(f.state.paidClicks,0);
  }
});
test('cancelled capture/apply cannot click any settings or paid control',async()=>{
  const f=fixture({cancelled:true,modelTabHidden:true});
  await assert.rejects(f.adapter.capture(),/중단/);await assert.rejects(f.adapter.apply(configuration()),/중단/);
  assert.equal(f.state.mutations,0);assert.deepEqual(f.state.clicks,[]);assert.equal(f.state.paidClicks,0);
});

})();

// Pending-start cancellation and mixed queue recovery use the production start function.
(() => {
const path=require('node:path');
const copy = value => JSON.parse(JSON.stringify(value));
const baseline = {model:{id:'11',versionId:'111',name:'Original model'},loras:[{id:'22',versionId:'222',name:'Original LoRA',weight:0.5}]};
const selectedPreset = {model:{id:'33',versionId:'333',name:'Preset model'},loras:[{id:'44',versionId:'444',name:'Preset LoRA',weight:0.75}]};
const mixedJobs = () => [{id:'preset',state:'queued',configuration:copy(selectedPreset),negativePrompt:'preset negative'},
  {id:'legacy',state:'queued',prompt:'legacy prompt',saved:[]}];
const deferred = () => {let resolve,reject;const promise = new Promise((yes,no) => {resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick = () => new Promise(resolve => setImmediate(resolve));
function startFixture(options = {}) {
  const source = fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8');
  const begin = source.indexOf('  async function start(');
  const end = source.indexOf('  function node(',begin);
  assert(begin >= 0 && end > begin,'Production start() boundaries must remain identifiable');
  const facts = {process:[],capture:0,captureNegative:0,destination:0,reveal:0,modelReads:0,persists:[],locks:0,renders:0,siteCalls:0,paidCalls:0};
  let stored = copy(options.jobs || mixedJobs());
  const context = {facts,options,copy,
    loadStored:() => copy(stored),saveStored:value => {stored=copy(value);},
    baseline:copy(baseline)};
  vm.runInNewContext(`
    let running=false,starting=false,settingsBusy=false,choosingFolder=false,stopRequested=false;
    let initialModel=null,baselineSettings=null,baselineNegative=null,message='';
    let jobs=loadStored(),currentModel='/ko/model/11/111';
    const storage={mode:'folder'},folderToken='fixture-folder';
    const io={};
    const onGenerator=()=>true,modelId=()=>{facts.modelReads++;if(options.hiddenModel&&!facts.reveal)throw new Error('현재 모델 버전 확인 실패');return currentModel;};
    const render=()=>{facts.renders++;};
    const persist=()=>{if(options.persistFailure)throw new Error('mock storage failure');facts.persists.push(copy(jobs));saveStored(jobs);};
    const resetDownloadProgress=()=>{throw new Error('Unexpected download mode');};
    const ensureDestination=async()=>{facts.destination++;if(options.destination)await options.destination(facts.destination);};
    const locked=async action=>{facts.locks++;jobs=loadStored();return action();};
    const settings={
      revealModelPanel:async()=>{facts.reveal++;if(options.reveal)await options.reveal();},
      capture:async()=>{facts.capture++;return options.capture ? options.capture() : copy(baseline);},
      captureNegative:async()=>{facts.captureNegative++;return options.captureNegative ? options.captureNegative() : 'original negative';}
    };
    const processJob=async job=>{
      facts.process.push(copy(job));
      if(job.configuration)currentModel='/ko/model/'+job.configuration.model.id+'/'+job.configuration.model.versionId;
      job.state='done';persist();
      if(options.stopAfterPreset&&job.id==='preset')stopRequested=true;
      if(options.process)await options.process(job);
    };
    ${source.slice(begin,end)}
    globalThis.run=start;
    globalThis.stop=()=>{stopRequested=true;};
    globalThis.state=()=>({running,starting,stopRequested,message,jobs:copy(jobs)});
    globalThis.reload=()=>{jobs=loadStored();};
  `,context);
  return {facts,run:context.run,stop:context.stop,state:context.state,reload:context.reload,stored:() => copy(stored)};
}

test('first mixed start persists an independent configuration/negative snapshot on every queued legacy job before processing',async () => {
  const f=startFixture({jobs:[...mixedJobs(),{id:'legacy2',state:'queued',prompt:'second',saved:[]}]});
  await f.run();
  assert.equal(f.facts.capture,1);assert.equal(f.facts.captureNegative,1);
  const firstPersist=f.facts.persists[0];
  assert.deepEqual(firstPersist.find(job=>job.id==='legacy').configuration,baseline);
  assert.equal(firstPersist.find(job=>job.id==='legacy').negativePrompt,'original negative');
  assert.equal(firstPersist.find(job=>job.id==='legacy').settingsOrigin,'legacy-at-first-mixed-start');
  assert.deepEqual(firstPersist.find(job=>job.id==='legacy2').configuration,baseline);
  assert.deepEqual(f.facts.process.find(job=>job.id==='legacy').configuration,baseline);
  assert.equal(f.state().running,false);assert.equal(f.state().starting,false);
  assert.equal(f.facts.siteCalls,0);assert.equal(f.facts.paidCalls,0);
});

test('resume after the first preset finishes retains the persisted original settings for legacy jobs',async () => {
  const f=startFixture({stopAfterPreset:true});
  await f.run();
  assert.deepEqual(f.facts.process.map(job=>job.id),['preset']);
  assert.equal(f.stored().find(job=>job.id==='legacy').state,'queued');
  f.reload();await f.run();
  assert.equal(f.facts.capture,1);assert.equal(f.facts.captureNegative,1);
  const resumed=f.facts.process.find(job=>job.id==='legacy');
  assert.deepEqual(resumed.configuration,baseline);assert.equal(resumed.negativePrompt,'original negative');
  assert.equal(resumed.settingsOrigin,'legacy-at-first-mixed-start');
});

for (const pause of ['destination','capture','captureNegative']) test(`Stop during pending ${pause} prevents every processJob and clears pending-start flags`,async () => {
  const waiting=deferred();
  const options={};
  if(pause==='destination')options.destination=count=>count===1 ? waiting.promise : undefined;
  if(pause==='capture')options.capture=()=>waiting.promise;
  if(pause==='captureNegative')options.captureNegative=()=>waiting.promise;
  const f=startFixture(options);
  const run=f.run();await tick();
  assert.equal(f.state().starting,true);f.stop();
  waiting.resolve(pause==='capture' ? copy(baseline) : pause==='captureNegative' ? 'original negative' : undefined);
  // Stopping is permitted to return normally or reject with a cancellation error.
  await run.catch(error=>assert.match(error.message,/중지|취소/));
  assert.equal(f.facts.process.length,0);assert.equal(f.state().starting,false);assert.equal(f.state().running,false);
  assert.equal(f.facts.siteCalls,0);assert.equal(f.facts.paidCalls,0);
});

test('a second Start while destination permission is pending cannot enter the runner',async () => {
  const waiting=deferred();const f=startFixture({destination:count=>count===1 ? waiting.promise : undefined});
  const first=f.run();await tick();assert.equal(f.state().starting,true);
  await f.run();assert.equal(f.facts.destination,1);assert.equal(f.facts.locks,0);
  waiting.resolve();await first;
  assert.deepEqual(f.facts.process.map(job=>job.id),['preset','legacy']);assert.equal(f.facts.locks,1);
});

test('a legacy-only queue reveals its model card before reading the current version, without capturing preset settings',async () => {
  const f=startFixture({hiddenModel:true,jobs:[{id:'legacy',state:'queued',prompt:'legacy prompt',saved:[]}]});await f.run();
  assert.equal(f.facts.capture,0);assert.equal(f.facts.captureNegative,0);assert.equal(f.facts.process.length,1);
  assert.equal(f.facts.process[0].configuration,undefined);assert.equal(f.state().starting,false);assert.equal(f.facts.reveal,1);assert.equal(f.facts.modelReads,1);
});

test('a preset-only queue starts without reading a hidden current model; its saved configuration reaches the runner',async()=>{
  const f=startFixture({hiddenModel:true,jobs:[mixedJobs()[0]]});await f.run();
  assert.equal(f.facts.modelReads,0);assert.equal(f.facts.reveal,0);assert.equal(f.facts.capture,0);
  assert.deepEqual(f.facts.process[0].configuration,selectedPreset);assert.equal(f.state().running,false);assert.equal(f.state().starting,false);
});

test('one-job run completes and saves only the first unfinished task, preserving every later task for normal resume',async()=>{
  const tasks=[{id:'done',state:'done'},mixedJobs()[0],{...mixedJobs()[0],id:'later'}];
  const f=startFixture({jobs:tasks});await f.run({oneJob:true});
  assert.deepEqual(f.facts.process.map(item=>item.id),['preset']);assert.equal(f.stored()[1].state,'done');assert.equal(f.stored()[2].state,'queued');
  assert.equal(f.state().running,false);assert.equal(f.state().starting,false);assert.match(f.state().message,/첫 작업.*나머지/);
  await f.run();assert.deepEqual(f.facts.process.map(item=>item.id),['preset','later']);
});

test('one-job preparation failure does not advance or retry the next task',async()=>{
  const f=startFixture({jobs:[mixedJobs()[0],{...mixedJobs()[0],id:'later'}],process:async()=>{throw new Error('first task failed');}});
  await assert.rejects(f.run({oneJob:true}),/first task failed/);
  assert.deepEqual(f.facts.process.map(item=>item.id),['preset']);assert.equal(f.stored()[1].state,'queued');assert.equal(f.state().running,false);assert.equal(f.state().starting,false);
});

test('Stop while revealing a legacy model prevents processing and releases start flags',async()=>{
  const waiting=deferred(),f=startFixture({reveal:()=>waiting.promise});
  const pending=f.run();await tick();f.stop();waiting.resolve();await pending.catch(error=>assert.match(error.message,/중지|취소/));
  assert.equal(f.facts.process.length,0);assert.equal(f.state().running,false);assert.equal(f.state().starting,false);
});

test('mixed baseline persistence failure stops before processing and releases both start flags',async () => {
  const f=startFixture({persistFailure:true});await assert.rejects(f.run(),/mock storage failure/);
  assert.equal(f.facts.process.length,0);assert.equal(f.state().running,false);assert.equal(f.state().starting,false);
});

})();

test('known refusal before the paid click stays queued; an uncertain click still becomes unknown',async()=>{
  const j=job();const {io,calls}=fixture(j,{submit:async()=>{throw Object.assign(new Error('configuration changed'),{notSubmitted:true})}});
  await assert.rejects(processJob(j,io));assert.equal(j.state,'queued');assert.ok(!j.taskId);assert.ok(!calls.includes('poll'));
  const k=job();const other=fixture(k,{submit:async()=>{throw new Error('click response lost')}});await assert.rejects(processJob(k,other.io));assert.equal(k.state,'unknown');
});

// Preset capture layout and queue-independence regressions.
(() => {
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const mainSource=fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8');
const verifySource=fs.readFileSync(path.join(__dirname,'verify.cjs'),'utf8');
const moduleContext={module:{exports:{}}};vm.runInNewContext(mainSource,moduleContext);
const core=moduleContext.module.exports;

// Reuse the committed fake-DOM fixture without registering its tests.
// These cases demonstrate code behavior under possible layouts, not the user's live DOM.
const helperStart=verifySource.indexOf('function selectorParts(selector)');
const helperEnd=verifySource.indexOf("test('model links retain exact numeric ID/version",helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart,'settings fake-DOM fixture not found');
const helperContext={core};
vm.runInNewContext(`${verifySource.slice(helperStart,helperEnd)}\nthis.helpers={fixture,Element,Input,configuration,win};`,helperContext);
const {fixture,Element,configuration,win}=helperContext.helpers;
const plain=value=>JSON.parse(JSON.stringify(value));
function visibility(element) {
  for(let current=element;current;current=current.parentElement)if(current.visibility==='hidden'||current.visibility==='collapse')return current.visibility;
  return 'visible';
}
win.getComputedStyle=element=>({visibility:visibility(element),display:element.hidden?'none':'block',opacity:'1'});
Element.prototype.checkVisibility=function(){return this.getClientRects().length>0&&visibility(this)==='visible';};
const append=Element.prototype.append;
Element.prototype.append=function(...children){const result=append.call(this,...children);const doc=this.ownerDocument||(this.tagName==='DOCUMENT'?this:null);for(const child of children){child.ownerDocument=doc;}return result;};
Element.prototype.addEventListener=function(type,handler){this.listeners??={};(this.listeners[type]??=[]).push(handler);};
Element.prototype.after=function(...siblings){
  if(!this.parentElement)return;
  const parent=this.parentElement,index=parent.children.indexOf(this);
  for(const sibling of siblings){sibling.remove();sibling.parentElement=parent;sibling.ownerDocument=this.ownerDocument;}
  parent.children.splice(index+1,0,...siblings);
};
Object.defineProperty(Element.prototype,'isConnected',{get(){let root=this;while(root.parentElement)root=root.parentElement;return root.tagName==='DOCUMENT';}});
function docSetup(f){f.doc.defaultView=win;f.doc.ownerDocument=f.doc;for(const node of f.doc.querySelectorAll('*'))node.ownerDocument=f.doc;return f;}
function compareCapture(f,expected=configuration()) {
  return f.adapter.capture().then(result=>{assert.deepEqual(plain(result),plain(expected));assert.equal(f.state.paidClicks,0);});
}

test('baseline: a single visible model panel is captured without paid generation',async()=>{
  const f=docSetup(fixture());await compareCapture(f);
});
test('regression: hidden first main must not block a later visible main model panel',async()=>{
  const f=docSetup(fixture()),hiddenMain=new Element('main');hiddenMain.hidden=true;hiddenMain.ownerDocument=f.doc;
  const hiddenSection=new Element('section',{'data-section':'model'}),hiddenCard=new Element('div',{'data-testid':'selected-entity-card'});
  hiddenCard.append(new Element('a',{href:'/en/model/9/99'},'숨겨진 responsive 모델'));hiddenSection.append(hiddenCard,new Element('button',{},'전체 모델 보기'));
  hiddenMain.append(hiddenSection);hiddenMain.parentElement=f.doc;f.doc.children.unshift(hiddenMain);
  await compareCapture(f);
});
test('regression: visibility-hidden model menu button must not cause an ambiguous panel timeout',async()=>{
  const f=docSetup(fixture()),ghost=new Element('button',{},'전체 모델 보기');ghost.visibility='hidden';f.main.append(ghost);
  assert.ok(ghost.getClientRects().length>0,'visibility:hidden deliberately retains a layout box');
  await compareCapture(f);
});
test('regression: duplicated responsive links with the same exact model/version still identify one model',async()=>{
  const f=docSetup(fixture());f.modelCard.append(new Element('a',{href:'/ko/model/1/11'},'현재 모델'));
  await compareCapture(f);
});
test('distinct visible model identities remain ambiguous and must never be guessed',async()=>{
  const f=docSetup(fixture());f.modelCard.append(new Element('a',{href:'/ko/model/2/22'},'다른 모델'));
  await assert.rejects(f.adapter.capture(),/현재 모델 버전|모델.*확인/);assert.equal(f.state.paidClicks,0);
});
test('regression: a visibility-hidden retained LoRA row must not become a duplicate selected LoRA',async()=>{
  const selected={id:'10',versionId:'101',name:'LoRA',weight:0};
  const f=docSetup(fixture({state:{loras:[{...selected},{...selected}]}}));f.rows.children[1].visibility='hidden';
  assert.ok(f.rows.children[1].querySelector('input').getClientRects().length>0);
  await compareCapture(f,configuration(undefined,[selected]));
});

function settingsWrapper(storageValue) {
  const begin=mainSource.indexOf('  async function settingsAction(');
  const end=mainSource.indexOf('  async function request(',begin);
  assert.ok(begin>=0&&end>begin,'settingsAction wrapper not found');
  const ctx={navigator:{locks:{request:async(_name,_options,run)=>run({})}},localStorage:{getItem:()=>storageValue,setItem(){}},recover:core.recover};
  vm.runInNewContext(`let running=false,starting=false,settingsBusy=false,stopRequested=false,jobs=[];const KEY='test-queue',LOCK='test-lock';function render(){}\n${mainSource.slice(begin,end)}\nthis.run=settingsAction;`,ctx);
  return ctx.run;
}
test('regression: reading current settings must not parse unrelated damaged queue JSON',async()=>{
  let called=0;const run=settingsWrapper('{damaged queue JSON');
  const result=await run(async()=>{called++;return 'visible settings';},{readOnly:true});
  assert.equal(result,'visible settings');assert.equal(called,1);
});
test('diagnosis baseline: normal queue JSON does not prevent settings wrapper execution',async()=>{
  let called=0;const run=settingsWrapper('{"version":1,"jobs":[]}');
  assert.equal(await run(async()=>{called++;return 'visible settings';},{readOnly:true}),'visible settings');assert.equal(called,1);
});
test('applying/default settings wrapper still rejects damaged queue JSON before the action',async()=>{
  let called=0;const run=settingsWrapper('{damaged queue JSON');
  await assert.rejects(run(async()=>{called++;return 'settings mutation';}),/JSON|property|format|대기열/);
  assert.equal(called,0);
});

function uiButton(action) {
  const begin=mainSource.indexOf('  function button(text, action)');
  const end=mainSource.indexOf('  function render()',begin);
  assert.ok(begin>=0&&end>begin,'runtime button factory not found');
  const doc=new Element('document'),panel=new Element('aside'),status=new Element('div',{'data-message':''});doc.append(panel);panel.append(status);
  status.getBoundingClientRect=()=>({top:-260,bottom:-210,left:0,right:300});
  const ctx={bindFolderActivation:core.bindFolderActivation,panel,node:(tag,text,attrs)=>new Element(tag,attrs,text)};
  vm.runInNewContext(`let message='';function render(){panel.querySelector('[data-message]').textContent=message;const feedback=panel.querySelector('[data-action-message]');if(feedback)feedback.textContent=message;}\n${mainSource.slice(begin,end)}\nthis.make=button;`,ctx);
  const button=ctx.make('사이트의 현재 설정 읽기',action);
  panel.append(button);
  function click(){for(const handler of button.listeners?.click||[])handler({type:'click',target:button,detail:0,timeStamp:100,isTrusted:true,preventDefault(){},stopImmediatePropagation(){}});}
  return {button,status,click,panel,feedback:()=>panel.querySelector('[data-action-message]')};
}
test('diagnosis: an activated read button records confirmation even if the shared status is scrolled outside view',async()=>{
  let called=0;const ui=uiButton(()=>{called++;});ui.click();await Promise.resolve();
  assert.equal(called,1);assert.equal(ui.status.textContent,'입력 확인: 사이트의 현재 설정 읽기');
  assert.ok(ui.status.getBoundingClientRect().bottom<0);
  assert.equal(ui.feedback().textContent,ui.status.textContent);
  assert.equal(ui.panel.children[ui.panel.children.indexOf(ui.button)+1],ui.feedback());
});
test('diagnosis: disabled preset read button skips both action and input confirmation',async()=>{
  let called=0;const ui=uiButton(()=>{called++;});ui.button.disabled=true;ui.click();await Promise.resolve();
  assert.equal(called,0);assert.equal(ui.status.textContent,'');
  assert.equal(ui.feedback(),null);
});
test('diagnosis: synchronous capture error is recorded in the same shared status',async()=>{
  const ui=uiButton(()=>{throw new Error('현재 모델 버전 확인 실패');});ui.click();await Promise.resolve();
  assert.equal(ui.status.textContent,'현재 모델 버전 확인 실패');
  assert.equal(ui.feedback().textContent,ui.status.textContent);
  assert.equal(ui.panel.children[ui.panel.children.indexOf(ui.button)+1],ui.feedback());
});

})();
