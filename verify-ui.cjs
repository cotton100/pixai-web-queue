'use strict';
// Exercise the exported production editor with a DOM model. No site or browser IO.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const core=require(path.join(__dirname,'pixai-web-queue.user.js'));
const copy=value=>JSON.parse(JSON.stringify(value));
class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.listeners={};this.parentElement=null;this.style={};this.disabled=false;this.readOnly=false;this.checked=false;this._value='';this._text='';}
  set textContent(value){this._text=String(value??'');this.replaceChildren();}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set value(value){const text=String(value??'');this._value=this.tagName==='SELECT'&&this.children.length&&!this.children.some(option=>option.value===text)?'':text;}
  get value(){return this._value;}
  set className(value){this.attrs.class=String(value);}get className(){return this.attrs.class||'';}
  set id(value){this.attrs.id=String(value);}get id(){return this.attrs.id||'';}
  setAttribute(name,value){this.attrs[name]=String(value);if(name==='value')this.value=value;if(name==='type')this.type=String(value);if(name==='checked')this.checked=true;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,char)=>char.toUpperCase())]=String(value);}
  getAttribute(name){return this.attrs[name]??null;}
  append(...children){for(let child of children){if(typeof child==='string'){const text=new Element('#text');text.textContent=child;child=text;}child.remove();child.parentElement=this;this.children.push(child);}}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
  contains(target){return this===target||this.children.some(child=>child.contains(target));}
  focus(){globalThis.document.activeElement=this;}
  getBoundingClientRect(){return {top:100,height:64};}
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
  async emit(type,extra={}){for(const listener of this.listeners[type]||[])await listener({type,target:this,isTrusted:true,preventDefault(){},stopPropagation(){},...extra});}
  matches(selector){
    if(selector.endsWith(':checked')&&!this.checked)return false;
    selector=selector.replace(/:checked$/,'');
    const tag=selector.match(/^[a-z][\w-]*/i);if(tag&&this.tagName!==tag[0].toUpperCase())return false;
    const id=selector.match(/#([\w-]+)/);if(id&&this.id!==id[1])return false;
    for(const match of selector.matchAll(/\.([\w-]+)/g))if(!this.className.split(/\s+/).includes(match[1]))return false;
    for(const match of selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)){
      const name=match[1];const actual=name.startsWith('data-')?this.dataset[name.slice(5).replace(/-([a-z])/g,(_,char)=>char.toUpperCase())]:this.getAttribute(name);
      if(actual==null||(match[2]!==undefined&&String(actual)!==match[2]))return false;
    }
    return true;
  }
  querySelectorAll(selector){const choices=selector.split(',').map(item=>item.trim());const descend=element=>element.children.flatMap(child=>[...(choices.some(choice=>child.matches(choice))?[child]:[]),...descend(child)]);return descend(this);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function seed() {
  return {version:1,common:{prompt:'quality',negativePrompt:'common bad'},
    presets:[{id:'p1',name:'Asset',model:{id:'101',versionId:'201',name:'Model',family:'SDXL'},loras:[{id:'301',versionId:'401',name:'LoRA',weight:0.7,triggerWords:'trigger one, trigger two'}]}],
    characters:[{id:'c1',name:'Alice',prompt:'character tags',negativePrompt:'character bad'}],
    scenes:[{id:'s1',name:'표정',prompt:'smiling',negativePrompt:'sad'},{id:'s2',name:'행동',prompt:'waving',negativePrompt:'standing still'}],reservations:[]};
}
function fixture(t,initial=seed()) {
  let library=core.normalizePresetLibrary(copy(initial)),captured=copy({model:library.presets[0].model,loras:library.presets[0].loras});
  let loadResult,saveFailure,busy=false;
  const messages=[],jobs=[],saves=[];let sequence=0;
  const parent=new Element('aside');const previousDocument=globalThis.document;
  globalThis.document={createElement:tag=>new Element(tag),createElementNS:(_namespace,tag)=>new Element(tag)};
  t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
  const ui=core.mountPresetEditor(parent,{
    load:()=>copy(loadResult===undefined?library:loadResult),save:value=>{if(saveFailure)throw new Error(saveFailure);library=core.normalizePresetLibrary(copy(value));saves.push(copy(library));},
    isBusy:()=>busy,
    captureSettings:async()=>copy(captured),applySettings:async()=>{},notify:message=>messages.push(message),
    enqueue:async value=>{jobs.push(...core.expandPresetReservations(value,{idFactory:()=>`job-${++sequence}`,maxCredits:7800}));},
    button:(text,action)=>{const element=new Element('button');element.textContent=text;element.press=async()=>{if(element.disabled)return;try{await action();}catch(error){messages.push(error.message);}};return element;}
  });
  const all=(root=parent)=>[root,...root.children.flatMap(child=>all(child))];
  const fields=name=>all().filter(element=>element.getAttribute('aria-label')===name);
  const field=(name,index=0)=>{const element=fields(name)[index];assert(element,`Missing field: ${name} #${index}`);return element;};
  const button=name=>{const element=all().find(item=>item.tagName==='BUTTON'&&(item._text===name||item.getAttribute('aria-label')===name));assert(element,`Missing button: ${name}`);return element;};
  const press=async name=>{const element=button(name);assert(Object.hasOwn(element.dataset,'edit'),`${name} must participate in running-state disable`);await element.press();};
  const select=async(name,value)=>{field(name).value=value;await field(name).emit('change');};
  const choose=async(name,checked=true)=>{const element=field(`청크 선택: ${name}`);assert.equal(element.type,'checkbox');element.checked=checked;await element.emit('change');};
  return {ui,parent,all,field,fields,button,press,select,choose,messages,jobs,saves,
    preview:()=>field('저장한 프롬프트 조합 미리보기').textContent,
    library:()=>copy(library),setLibrary:value=>{library=core.normalizePresetLibrary(copy(value));},
    setLoadResult:value=>{loadResult=value===undefined?undefined:copy(value);},
    setCapture:value=>{captured=copy(value);},setSaveFailure:value=>{saveFailure=value;},
    setBusy:value=>{busy=value;for(const element of all().filter(item=>Object.hasOwn(item.dataset,'edit')))element.disabled=busy||element.dataset.unavailable==='true';}};
}

function transfer() {
  const values=new Map();return {setData:(type,value)=>values.set(type,value),getData:type=>values.get(type)||'',setDragImage(){},effectAllowed:'',dropEffect:''};
}
function managedRow(f,id){const row=f.ui.root.querySelectorAll('[data-chunk-id]').find(item=>item.dataset.chunkId===id);assert(row,`Missing managed row ${id}`);return row;}
async function dragChunk(f,name,target,after=false) {
  const dataTransfer=transfer(),handle=f.field(`청크 이동: ${name}`);
  await handle.emit('dragstart',{dataTransfer});await target.emit('dragover',{dataTransfer,clientY:after?160:104});
  await target.emit('drop',{dataTransfer,clientY:after?160:104});await handle.emit('dragend');
}
async function manage(f,name,checked=true){const control=f.field(`청크 관리 선택: ${name}`);control.checked=checked;await control.emit('change');}

test('visible picker buttons update real composition and folder drafts while keeping generation choices separate',async t=>{
  const initial=seed();initial.characters.push({id:'c2',name:'Bob',prompt:'different character',negativePrompt:''});initial.chunkFolders=[{id:'f1',name:'표정 폴더'}];const f=fixture(t,initial);
  await f.field('예약 캐릭터: Bob').emit('click');assert.match(f.preview(),/different character/);assert.equal(f.field('예약 캐릭터').value,'c2');assert.equal(f.field('예약 캐릭터: Bob').getAttribute('aria-pressed'),'true');
  await f.choose('표정');await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='unsaved';await f.field('청크 폴더: 표정 폴더').emit('click');
  assert.equal(f.field('청크 폴더').value,'f1');assert.equal(f.field('청크 프롬프트').value,'unsaved');assert.equal(f.library().scenes[0].folderId,undefined);assert.equal(f.field('청크 선택: 표정').checked,true);
  f.setBusy(true);await f.field('예약 캐릭터: Alice').emit('click');assert.equal(f.field('예약 캐릭터').value,'c2');assert.equal(f.field('예약 캐릭터: Bob').disabled,true);
});
test('quick folder creation and bulk move commit together and retain checked chunks, drafts and saved reservation order',async t=>{
  const f=fixture(t);await f.choose('표정');await f.choose('행동');await f.press('이 조합 예약 추가');await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='unsaved';await manage(f,'행동');await manage(f,'표정');
  await f.press('이동 대상 새 폴더');f.field('이동 대상 새 폴더 이름').value='새 작업';const writes=f.saves.length;await f.press('만들고 선택 청크 이동');
  const saved=f.library(),folder=saved.chunkFolders[0];assert.equal(f.saves.length,writes+1);assert.equal(folder.name,'새 작업');assert(saved.scenes.every(item=>item.folderId===folder.id));
  assert.equal(f.field('청크 프롬프트').value,'unsaved');assert.equal(f.field('청크 폴더').value,folder.id);assert.equal(f.field('이동할 청크 폴더').value,folder.id);
  assert.deepEqual(saved.reservations[0].sceneIds,['s1','s2']);assert.equal(f.field('청크 관리 선택: 표정').checked,true);assert.equal(f.field('청크 선택: 표정').checked,true);
});
test('quick folder failure and cancellation keep existing data, selections and entered names; import resets pending creation',async t=>{
  const f=fixture(t);await manage(f,'표정');await f.press('이동 대상 새 폴더');f.field('이동 대상 새 폴더 이름').value='Keep';const before=f.library();
  f.setSaveFailure('Quota exceeded');await f.press('만들고 선택 청크 이동');assert.deepEqual(f.library(),before);assert.equal(f.field('이동 대상 새 폴더 이름').value,'Keep');assert.equal(f.field('청크 관리 선택: 표정').checked,true);
  await f.press('이동 대상 폴더 만들기 취소');assert.equal(f.field('이동 대상 새 폴더 이름').value,'');assert.deepEqual(f.library(),before);
  f.setSaveFailure(null);await f.press('이동 대상 새 폴더');f.field('이동 대상 새 폴더 이름').value='Pending';f.ui.reload();assert.equal(f.field('이동 대상 새 폴더 이름').value,'');assert.deepEqual(f.library(),before);
});
test('creating a folder in the editor selects it without overwriting unsaved prompts or moving the saved chunk before save',async t=>{
  const f=fixture(t);await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='new prompt';await f.press('청크 소속 새 폴더');f.field('청크 소속 새 폴더 이름').value='Custom';await f.press('만들고 폴더 선택');
  const id=f.library().chunkFolders[0].id;assert.equal(f.field('청크 폴더').value,id);assert.equal(f.library().scenes[0].folderId,undefined);assert.equal(f.field('청크 프롬프트').value,'new prompt');
  await f.press('청크 저장');assert.equal(f.library().scenes.find(item=>item.id==='s1').folderId,id);assert.equal(f.library().scenes.find(item=>item.id==='s1').prompt,'new prompt');
});

test('Enter creates a folder and moves selected chunks once, while busy or untrusted keyboard input cannot create it',async t=>{
  const f=fixture(t);await manage(f,'표정');await f.press('이동 대상 새 폴더');f.field('이동 대상 새 폴더 이름').value='Keyboard';
  f.setBusy(true);await f.field('이동 대상 새 폴더 이름').emit('keydown',{key:'Enter'});assert.equal(f.library().chunkFolders.length,0);
  f.setBusy(false);await f.field('이동 대상 새 폴더 이름').emit('keydown',{key:'Enter',isTrusted:false});assert.equal(f.library().chunkFolders.length,0);
  await f.field('이동 대상 새 폴더 이름').emit('keydown',{key:'Enter'});assert.equal(f.saves.length,1);assert.equal(f.library().chunkFolders[0].name,'Keyboard');assert.equal(f.library().scenes.find(item=>item.id==='s1').folderId,f.library().chunkFolders[0].id);
});

test('native chunk drag reorders rows and updates future composition without erasing edited drafts or old reservations',async t=>{
  const f=fixture(t);await f.choose('표정');await f.choose('행동');await f.press('이 조합 예약 추가');
  await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='unsaved smiling';
  await dragChunk(f,'행동',managedRow(f,'s1'));
  assert.deepEqual(f.library().scenes.map(item=>item.id),['s2','s1']);assert.match(f.preview(),/waving, smiling/);
  assert.deepEqual(f.library().reservations[0].sceneIds,['s1','s2']);assert.equal(f.field('청크 프롬프트').value,'unsaved smiling');
  assert.equal(f.field('청크 선택: 행동').checked,true);assert.equal(document.activeElement,f.field('청크 이동: 행동'));
});

test('checked chunks drag together into another folder in display order, including hidden selections, and keep editor drafts',async t=>{
  const initial=seed();initial.chunkFolders=[{id:'empty',name:'빈 폴더'}];const f=fixture(t,initial);
  await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='draft kept';await manage(f,'행동');await manage(f,'표정');
  f.field('청크 검색').value='smiling';await f.field('청크 검색').emit('input');assert.match(f.field('관리 선택 청크 요약').textContent,/2개 체크 · 목록 밖 1개 포함/);
  await dragChunk(f,'표정',f.field('폴더 보기: 빈 폴더'));
  assert.deepEqual(f.library().scenes.map(item=>item.id),['s1','s2']);assert(f.library().scenes.every(item=>item.folderId==='empty'));
  assert.equal(f.field('청크 폴더').value,'empty');assert.equal(f.field('청크 프롬프트').value,'draft kept');
  assert.equal(f.field('청크 관리 선택: 표정').checked,true);assert.match(f.field('관리 선택 청크 요약').textContent,/2개 체크/);
});

test('dragging an unchecked chunk leaves the checked group in place; cancel, foreign drop and selected-target drop do not write',async t=>{
  const f=fixture(t);await manage(f,'표정');const original=f.library(),before=f.saves.length;
  const dataTransfer=transfer(),handle=f.field('청크 이동: 행동');await handle.emit('dragstart',{dataTransfer});await managedRow(f,'s1').emit('dragover',{dataTransfer,clientY:104});
  assert.equal(managedRow(f,'s1').dataset.dropPosition,'before');await handle.emit('dragend');
  assert.equal(managedRow(f,'s1').dataset.dropPosition,'');assert.equal(f.saves.length,before);
  await managedRow(f,'s1').emit('drop',{dataTransfer:transfer(),clientY:104});assert.equal(f.saves.length,before);
  await dragChunk(f,'표정',managedRow(f,'s1'));assert.equal(f.saves.length,before);
  assert.deepEqual(f.library(),original);await dragChunk(f,'행동',managedRow(f,'s1'));
  assert.deepEqual(f.library().scenes.map(item=>item.id),['s2','s1']);assert.equal(f.field('청크 관리 선택: 표정').checked,true);assert.equal(f.field('청크 관리 선택: 행동').checked,false);
});

test('drag save failure leaves folder, order, selections and drafts intact; becoming busy or untrusted during drag cannot save',async t=>{
  const initial=seed();initial.chunkFolders=[{id:'empty',name:'빈 폴더'}];const f=fixture(t,initial);
  await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='keep on failure';await manage(f,'표정');const original=f.library();
  f.setSaveFailure('Storage full');await dragChunk(f,'표정',f.field('폴더 보기: 빈 폴더'));
  assert.deepEqual(f.library(),original);assert.equal(f.field('청크 폴더').value,'');assert.equal(f.field('청크 프롬프트').value,'keep on failure');assert.match(f.messages.at(-1),/이동 실패.*Storage full/);
  f.setSaveFailure(null);const dataTransfer=transfer(),handle=f.field('청크 이동: 표정');await handle.emit('dragstart',{dataTransfer});f.setBusy(true);
  await f.field('폴더 보기: 빈 폴더').emit('drop',{dataTransfer});await handle.emit('dragend');assert.deepEqual(f.library(),original);assert.equal(f.saves.length,0);
  f.setBusy(false);await handle.emit('dragstart',{dataTransfer,isTrusted:false});await f.field('폴더 보기: 빈 폴더').emit('drop',{dataTransfer});assert.equal(f.saves.length,0);
});

test('bulk move preserves a separately edited folder draft and keyboard handle movement remains available',async t=>{
  const initial=seed();initial.chunkFolders=[{id:'one',name:'첫 폴더'},{id:'two',name:'둘째 폴더'}];const f=fixture(t,initial);
  await f.select('저장한 청크','s1');f.field('청크 폴더').value='two';await manage(f,'표정');await f.select('이동할 청크 폴더','one');await f.press('선택 이동');
  assert.equal(f.library().scenes.find(item=>item.id==='s1').folderId,'one');assert.equal(f.field('청크 폴더').value,'two');
  await manage(f,'행동');await f.select('이동할 청크 폴더','');await f.press('선택 이동');
  await f.field('청크 이동: 표정').emit('keydown',{key:'ArrowDown'});assert.deepEqual(f.library().scenes.map(item=>item.id),['s2','s1']);
});

test('bulk copies select new identities and retain generation selection; deletion prunes management and flags saved reservations',async t=>{
  const f=fixture(t);await f.choose('표정');await f.press('이 조합 예약 추가');await manage(f,'행동');await manage(f,'표정');
  await f.press('선택 복제');assert.equal(f.library().scenes.length,4);assert.equal(f.field('청크 선택: 표정').checked,true);assert.equal(f.field('청크 선택: 표정 (복사본)').checked,false);
  assert.equal(f.field('청크 관리 선택: 표정').checked,false);assert.equal(f.field('청크 관리 선택: 표정 (복사본)').checked,true);assert.equal(f.field('청크 관리 선택: 행동 (복사본)').checked,true);
  await f.press('선택 삭제');assert.equal(f.library().scenes.length,2);assert.deepEqual(f.library().reservations[0].sceneIds,['s1']);
  await f.select('저장한 청크','s1');await manage(f,'표정');await f.press('선택 삭제');assert.equal(f.field('청크 이름').value,'');assert.equal(f.fields('청크 선택: 표정').length,0);
  assert(f.all().some(element=>element.className==='pq-reservation'&&element.textContent.includes('(삭제된 청크)')));
  await f.press('예약 전부를 대기열에 등록');assert.equal(f.jobs.length,0);
});

test('bulk storage failure and import refresh never discard originals or retain old management checks',async t=>{
  const initial=seed();initial.chunkFolders=[{id:'dest',name:'대상 폴더'}];const f=fixture(t,initial);await manage(f,'표정');await f.select('이동할 청크 폴더','dest');const before=f.library();f.setSaveFailure('Write failed');
  for(const action of ['선택 삭제','선택 복제','선택 이동']) {await f.press(action);assert.deepEqual(f.library(),before);assert.equal(f.field('청크 관리 선택: 표정').checked,true);}
  f.setBusy(true);assert.equal(f.button('선택 삭제').disabled,true);assert.equal(f.field('청크 이동: 표정').disabled,true);
  f.setBusy(false);f.setSaveFailure(null);f.ui.reload();assert.equal(f.field('청크 관리 선택: 표정').checked,false);assert.equal(f.field('관리 선택 청크 요약').textContent.startsWith('0개'),true);
});

test('workbench tabs keep one visible screen and retain every unsaved draft and checked chunk',async t=>{
  const f=fixture(t),tabs=f.all().filter(item=>item.getAttribute('role')==='tab');
  assert.deepEqual(tabs.map(item=>item.textContent),['조합 예약','청크','캐릭터','모델·LoRA','공통문']);
  assert.equal(tabs[0].getAttribute('aria-selected'),'true');
  await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='unsaved chunk';
  await f.select('저장한 캐릭터','c1');f.field('캐릭터 프롬프트').value='unsaved character';
  await f.select('저장한 설정 프리셋','p1');f.field('LoRA 트리거 키워드').value='unsaved trigger';
  f.field('공통 프롬프트').value='unsaved common';await f.choose('행동');
  for (const tab of tabs) {
    await tab.emit('click');
    assert.equal(f.all().filter(item=>item.getAttribute('role')==='tabpanel'&&!item.hidden).length,1);
    assert.equal(tab.getAttribute('aria-selected'),'true');assert.equal(tab.getAttribute('tabindex'),'0');
    const page=f.all().find(item=>item.id===tab.getAttribute('aria-controls'));
    assert(page);assert.equal(page.getAttribute('aria-labelledby'),tab.id);assert.equal(page.hidden,false);
  }
  assert.equal(f.field('청크 프롬프트').value,'unsaved chunk');assert.equal(f.field('캐릭터 프롬프트').value,'unsaved character');
  assert.equal(f.field('LoRA 트리거 키워드').value,'unsaved trigger');assert.equal(f.field('공통 프롬프트').value,'unsaved common');
  assert.equal(f.field('청크 선택: 행동').checked,true);assert.equal(f.saves.length,0);assert.equal(f.jobs.length,0);
});

test('tab arrows wrap, Home and End move focus, and view navigation remains available during generation',async t=>{
  const f=fixture(t);f.ui.addPage('queue','대기열');f.ui.addPage('settings','설정');f.setBusy(true);
  const tabs=f.all().filter(item=>item.getAttribute('role')==='tab');
  await tabs[0].emit('keydown',{key:'ArrowLeft'});assert.equal(document.activeElement,tabs.at(-1));
  assert.equal(tabs.at(-1).getAttribute('aria-selected'),'true');assert.equal(tabs.at(-1).disabled,false);
  await tabs.at(-1).emit('keydown',{key:'ArrowRight'});assert.equal(document.activeElement,tabs[0]);
  await tabs[0].emit('keydown',{key:'End'});assert.equal(document.activeElement,tabs.at(-1));
  await tabs.at(-1).emit('keydown',{key:'Home'});assert.equal(document.activeElement,tabs[0]);
  assert.equal(f.button('프리셋 저장').disabled,true);assert.equal(f.saves.length,0);assert.equal(f.jobs.length,0);
});

test('folder rail changes the browsed list without resetting the edited chunk or unsaved text',async t=>{
  const initial=seed();initial.chunkFolders=[{id:'face',name:'표정 폴더'}];initial.scenes[0].folderId='face';
  const f=fixture(t,initial);await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='draft retained';
  await f.field('폴더 보기: 미분류').emit('click');
  assert.equal(f.field('청크 폴더 필터').value,'unfiled');
  const list=f.field('저장한 청크 목록');assert(!list.textContent.includes('smiling'),list.textContent);assert(list.textContent.includes('waving'));
  assert.equal(f.field('저장한 청크').value,'s1');assert.equal(f.field('청크 프롬프트').value,'draft retained');
  assert.equal(f.field('폴더 보기: 미분류').getAttribute('aria-pressed'),'true');
  await f.field('폴더 보기: 표정 폴더').emit('click');assert(list.textContent.includes('smiling'));assert(!list.textContent.includes('waving'));
  assert.equal(f.saves.length,0);
});

test('saved character cards load the selected content and search preserves the draft outside the results',async t=>{
  const initial=seed();initial.characters.push({id:'c2',name:'Bob',prompt:'black hair',negativePrompt:''});const f=fixture(t,initial);
  await f.field('캐릭터 편집: Bob').press();assert.equal(f.field('저장한 캐릭터').value,'c2');assert.equal(f.field('캐릭터 프롬프트').value,'black hair');
  assert.equal(document.activeElement,f.field('캐릭터 이름'));f.field('캐릭터 프롬프트').value='unsaved black hair';
  f.field('캐릭터 검색').value='character tags';await f.field('캐릭터 검색').emit('input');
  assert.equal(f.fields('캐릭터 편집: Bob').length,0);assert.equal(f.fields('캐릭터 편집: Alice').length,1);
  assert.equal(f.field('캐릭터 이름').value,'Bob');assert.equal(f.field('캐릭터 프롬프트').value,'unsaved black hair');assert.equal(f.saves.length,0);
});

test('saved preset cards expose model summaries, load triggers, and highlight a newly saved preset',async t=>{
  const f=fixture(t);assert.match(f.field('프리셋 편집: Asset').textContent,/Model · LoRA 1개/);
  await f.field('프리셋 편집: Asset').press();assert.equal(f.field('LoRA 트리거 키워드').value,'trigger one, trigger two');
  await f.press('새 프리셋');f.field('프리셋 이름').value='New';f.field('모델 ID').value='101';f.field('모델 버전 ID').value='201';
  await f.press('프리셋 저장');assert.equal(f.field('프리셋 편집: New').getAttribute('aria-pressed'),'true');
  f.field('프리셋 검색').value='Asset';await f.field('프리셋 검색').emit('input');
  assert.equal(f.fields('프리셋 편집: New').length,0);assert.equal(f.field('프리셋 이름').value,'New');
});

test('the production editor names reusable scenes as prompt chunks and saves edits in the existing scenes array',async t=>{
  const f=fixture(t);
  assert(f.all().some(element=>element.getAttribute('role')==='tab'&&element.textContent==='청크'));
  assert.equal(f.fields('예약 씬').length,0);
  assert.equal(f.field('청크 선택: 표정').checked,false);assert.equal(f.field('청크 선택: 행동').checked,false);
  await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='laughing';await f.press('청크 저장');
  assert.equal(f.library().scenes[0].prompt,'laughing');assert.equal(f.library().scenes[0].id,'s1');
  assert.equal(f.library().scenes.length,2);assert.equal(f.field('저장한 청크').value,'s1');
});

test('LoRA trigger keywords round-trip through preset save/load and are retained only for the same captured identity',async t=>{
  const f=fixture(t);await f.select('저장한 설정 프리셋','p1');
  assert.equal(f.field('LoRA 트리거 키워드').tagName,'TEXTAREA');assert.equal(f.field('LoRA 트리거 키워드').value,'trigger one, trigger two');
  f.field('LoRA 트리거 키워드').value='updated trigger';await f.press('프리셋 저장');
  assert.equal(f.library().presets[0].loras[0].triggerWords,'updated trigger');
  await f.press('새 프리셋');await f.select('저장한 설정 프리셋','p1');assert.equal(f.field('LoRA 트리거 키워드').value,'updated trigger');
  const capture=copy({model:f.library().presets[0].model,loras:[{id:'301',versionId:'401',name:'Renamed LoRA',weight:0.9}]});
  f.setCapture(capture);await f.press('사이트의 현재 설정 읽기');assert.equal(f.field('LoRA 트리거 키워드').value,'updated trigger');
  f.field('LoRA 버전 ID (선택)').value='';await f.press('사이트의 현재 설정 읽기');assert.equal(f.field('LoRA 트리거 키워드').value,'updated trigger');
  capture.loras[0].versionId='402';f.setCapture(capture);await f.press('사이트의 현재 설정 읽기');assert.equal(f.field('LoRA 트리거 키워드').value,'');
  f.field('LoRA 트리거 키워드').value='new version trigger';capture.loras[0].id='302';f.setCapture(capture);await f.press('사이트의 현재 설정 읽기');assert.equal(f.field('LoRA 트리거 키워드').value,'');
  await f.press('프리셋 저장');assert.equal(f.library().presets[0].loras[0].triggerWords,undefined);
});

test('capture fills blank triggers automatically, preserves manual text, and reports per-LoRA failures without discarding settings',async t=>{
  const f=fixture(t);await f.select('저장한 설정 프리셋','p1');
  const capture={model:f.library().presets[0].model,loras:[{id:'301',versionId:'401',name:'LoRA',weight:0.8,triggerWords:'site trigger'}]};
  f.setCapture(capture);await f.press('사이트의 현재 설정 읽기');
  assert.equal(f.field('LoRA 트리거 키워드').value,'trigger one, trigger two');
  f.field('LoRA 트리거 키워드').value='  ';await f.press('사이트의 현재 설정 읽기');
  assert.equal(f.field('LoRA 트리거 키워드').value,'site trigger');assert.match(f.messages.at(-1),/트리거 1개 자동 입력/);
  await f.press('프리셋 저장');assert.equal(f.library().presets[0].loras[0].triggerWords,'site trigger');
  capture.loras[0].versionId='402';capture.loras[0].triggerWords='new version trigger';f.setCapture(capture);
  await f.press('사이트의 현재 설정 읽기');assert.equal(f.field('LoRA 트리거 키워드').value,'new version trigger');
  delete capture.loras[0].triggerWords;capture.triggerWarnings=['LoRA'];f.setCapture(capture);
  await f.press('사이트의 현재 설정 읽기');assert.equal(f.field('LoRA 트리거 키워드').value,'new version trigger');
  assert.equal(f.field('LoRA 가중치').value,'0.8');assert.match(f.messages.at(-1),/트리거 자동 읽기 실패: LoRA/);
});

test('checkbox reservations compose common, LoRA triggers, character and chunks in saved-list order regardless of click order',async t=>{
  const f=fixture(t);await f.choose('행동');await f.choose('표정');
  assert.match(f.preview(),/quality, trigger one, trigger two, character tags, smiling, waving/);
  assert.match(f.preview(),/common bad, character bad, sad, standing still/);
  f.field('이 조합의 생성 횟수').value='2';await f.press('이 조합 예약 추가');
  assert.deepEqual(f.library().reservations[0].sceneIds,['s1','s2']);assert.equal(f.library().reservations[0].sceneId,undefined);
  await f.press('예약 전부를 대기열에 등록');assert.equal(f.jobs.length,2);
  assert.equal(f.jobs[0].prompt,'quality, trigger one, trigger two, character tags, smiling, waving');
  assert.equal(f.jobs[0].negativePrompt,'common bad, character bad, sad, standing still');
});

test('zero chunks is a valid reservation and checkbox changes immediately update both positive and negative previews',async t=>{
  const f=fixture(t);assert.match(f.preview(),/quality, trigger one, trigger two, character tags/);assert(!f.preview().includes('smiling'));
  await f.choose('표정');assert(f.preview().includes('smiling'));assert(f.preview().includes('sad'));
  await f.choose('표정',false);assert(!f.preview().includes('smiling'));assert(!f.preview().includes('sad'));
  await f.press('이 조합 예약 추가');assert.deepEqual(f.library().reservations[0].sceneIds,[]);
  await f.press('예약 전부를 대기열에 등록');assert.equal(f.jobs.length,1);
  assert.equal(f.jobs[0].prompt,'quality, trigger one, trigger two, character tags');assert.equal(f.jobs[0].negativePrompt,'common bad, character bad');
});

test('common save and library refresh preserve selected chunks; deleting a selected chunk unchecks it and flags its saved reservation',async t=>{
  const f=fixture(t);await f.choose('행동');await f.press('이 조합 예약 추가');
  f.field('공통 프롬프트').value='new common';await f.press('공통문 저장');
  assert.equal(f.field('청크 선택: 행동').checked,true);assert.equal(f.field('청크 선택: 표정').checked,false);
  const next=f.library();next.scenes.push({id:'s3',name:'배경',prompt:'beach',negativePrompt:''});f.setLibrary(next);f.ui.refresh();
  assert.equal(f.field('청크 선택: 행동').checked,true);assert.equal(f.field('청크 선택: 배경').checked,false);
  await f.select('저장한 청크','s2');await f.press('선택 청크 삭제');
  assert.equal(f.fields('청크 선택: 행동').length,0);assert.equal(f.field('청크 선택: 표정').checked,false);
  assert(!f.preview().includes('waving'));assert.deepEqual(f.library().reservations[0].sceneIds,['s2']);
  const reservationRow=f.all().find(element=>element.className.split(/\s+/).includes('pq-reservation'));
  assert(reservationRow,'The saved reservation must remain visible');assert.match(reservationRow.textContent,/삭제된 청크|삭제된.*청크|청크.*없/);
  await f.press('예약 전부를 대기열에 등록');assert.equal(f.jobs.length,0);assert.match(f.messages.at(-1),/청크|씬/);
});

test('legacy sceneId reservations normalize to a one-element sceneIds array and remain usable through the real editor',async t=>{
  const initial=seed();initial.reservations=[{id:'legacy-reservation',presetId:'p1',characterId:'c1',sceneId:'s2',count:1}];
  const f=fixture(t,initial);assert.deepEqual(f.library().reservations[0].sceneIds,['s2']);assert.equal(f.library().reservations[0].sceneId,undefined);
  assert(!f.parent.textContent.includes('(삭제된 청크)'));await f.press('예약 전부를 대기열에 등록');
  assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].prompt,'quality, trigger one, trigger two, character tags, waving');
});

test('explicit import reload replaces same-ID editor fields, clears checkbox drafts, and displays only imported reservations',async t=>{
  const f=fixture(t);await f.select('저장한 설정 프리셋','p1');await f.select('저장한 캐릭터','c1');await f.select('저장한 청크','s1');
  await f.choose('행동');await f.press('이 조합 예약 추가');
  f.field('공통 프롬프트').value='unsaved old common';f.field('캐릭터 프롬프트').value='unsaved old character';f.field('청크 프롬프트').value='unsaved old chunk';f.field('LoRA 트리거 키워드').value='unsaved old trigger';
  f.field('이 조합의 생성 횟수').value='7';
  const imported=seed();imported.common={prompt:'import common',negativePrompt:'import common bad'};
  imported.presets[0]={id:'p1',name:'Imported preset',model:{id:'102',versionId:'202',name:'Imported model'},loras:[{id:'302',versionId:'402',name:'Imported LoRA',weight:0.3,triggerWords:'import trigger'}]};
  imported.characters[0]={id:'c1',name:'Imported character',prompt:'import character',negativePrompt:'import character bad'};
  imported.scenes[0]={id:'s1',name:'Imported chunk',prompt:'import chunk',negativePrompt:'import chunk bad'};
  imported.reservations=[{id:'imported-reservation',presetId:'p1',characterId:'c1',sceneIds:['s1'],count:3}];
  f.setLibrary(imported);f.ui.reload();
  assert.equal(f.field('공통 프롬프트').value,'import common');assert.equal(f.field('공통 네거티브').value,'import common bad');
  assert.equal(f.field('저장한 설정 프리셋').value,'p1');assert.equal(f.field('프리셋 이름').value,'Imported preset');
  assert.equal(f.field('모델 ID').value,'102');assert.equal(f.field('모델 버전 ID').value,'202');assert.equal(f.field('모델 이름').value,'Imported model');
  assert.equal(f.field('LoRA ID').value,'302');assert.equal(f.field('LoRA 가중치').value,'0.3');assert.equal(f.field('LoRA 트리거 키워드').value,'import trigger');
  assert.equal(f.field('캐릭터 이름').value,'Imported character');assert.equal(f.field('캐릭터 프롬프트').value,'import character');assert.equal(f.field('캐릭터 네거티브').value,'import character bad');
  assert.equal(f.field('청크 이름').value,'Imported chunk');assert.equal(f.field('청크 프롬프트').value,'import chunk');assert.equal(f.field('청크 네거티브').value,'import chunk bad');
  assert.equal(f.field('청크 선택: Imported chunk').checked,false);assert.equal(f.field('청크 선택: 행동').checked,false);assert.equal(f.field('이 조합의 생성 횟수').value,'1');
  assert.match(f.preview(),/import common, import trigger, import character/);assert(!f.preview().includes('import chunk'));
  const rows=f.all().filter(element=>element.className.split(/\s+/).includes('pq-reservation'));assert.equal(rows.length,1);assert.match(rows[0].textContent,/Imported character.*Imported chunk/);
  await f.press('캐릭터 저장');assert.equal(f.library().characters[0].prompt,'import character');
  await f.press('예약 전부를 대기열에 등록');assert.equal(f.jobs.length,3);assert.equal(f.jobs[0].prompt,'import common, import trigger, import character, import chunk');
});

test('import reload clears editors for removed IDs and selects valid replacement reservation entries without stale fields',async t=>{
  const f=fixture(t);await f.select('저장한 설정 프리셋','p1');await f.select('저장한 캐릭터','c1');await f.select('저장한 청크','s1');await f.choose('표정');
  const imported=seed();imported.presets[0].id='p2';imported.characters[0].id='c2';imported.scenes=[{id:'s3',name:'New chunk',prompt:'new chunk',negativePrompt:''}];
  f.setLibrary(imported);f.ui.reload();
  for(const name of ['저장한 설정 프리셋','프리셋 이름','모델 ID','모델 버전 ID','모델 이름','모델 계열 (선택)','저장한 캐릭터','캐릭터 이름','캐릭터 프롬프트','캐릭터 네거티브','저장한 청크','청크 이름','청크 프롬프트','청크 네거티브'])assert.equal(f.field(name).value,'',name);
  assert.equal(f.fields('LoRA 트리거 키워드').length,0);assert.equal(f.fields('청크 선택: 표정').length,0);
  assert.equal(f.field('예약 프리셋').value,'p2');assert.equal(f.field('예약 캐릭터').value,'c2');assert.equal(f.field('청크 선택: New chunk').checked,false);
  assert(!f.preview().includes('smiling'));assert(!f.preview().includes('new chunk'));assert.equal(f.library().presets.length,1);assert.equal(f.jobs.length,0);
});

test('invalid imported library fails before changing editor drafts, selected chunks, reservations or preview',async t=>{
  const f=fixture(t);await f.select('저장한 설정 프리셋','p1');await f.select('저장한 캐릭터','c1');await f.select('저장한 청크','s1');await f.choose('행동');await f.press('이 조합 예약 추가');
  f.field('공통 프롬프트').value='keep draft common';f.field('LoRA 트리거 키워드').value='keep draft trigger';f.field('캐릭터 프롬프트').value='keep draft character';f.field('청크 프롬프트').value='keep draft chunk';
  const beforeLibrary=f.library(),beforePreview=f.preview(),beforeRows=f.all().filter(element=>element.className.split(/\s+/).includes('pq-reservation')).map(element=>element.textContent);
  const invalid=seed();invalid.presets[0].model.versionId='invalid';f.setLoadResult(invalid);
  assert.throws(()=>f.ui.reload(),/모델 버전/);
  assert.equal(f.field('공통 프롬프트').value,'keep draft common');assert.equal(f.field('LoRA 트리거 키워드').value,'keep draft trigger');assert.equal(f.field('캐릭터 프롬프트').value,'keep draft character');assert.equal(f.field('청크 프롬프트').value,'keep draft chunk');
  assert.equal(f.field('청크 선택: 행동').checked,true);assert.equal(f.field('저장한 설정 프리셋').value,'p1');assert.equal(f.preview(),beforePreview);assert.deepEqual(f.library(),beforeLibrary);
  assert.deepEqual(f.all().filter(element=>element.className.split(/\s+/).includes('pq-reservation')).map(element=>element.textContent),beforeRows);
  f.setLoadResult(undefined);await f.press('예약 전부를 대기열에 등록');assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].prompt,'quality, trigger one, trigger two, character tags, waving');
});

test('ordinary refresh retains unfinished editor drafts and checkbox selections instead of performing import reload',async t=>{
  const f=fixture(t);await f.select('저장한 설정 프리셋','p1');await f.select('저장한 캐릭터','c1');await f.select('저장한 청크','s1');await f.choose('행동');
  f.field('공통 프롬프트').value='draft common';f.field('LoRA 트리거 키워드').value='draft trigger';f.field('캐릭터 프롬프트').value='draft character';f.field('청크 프롬프트').value='draft chunk';f.field('이 조합의 생성 횟수').value='8';
  const next=f.library();next.common.prompt='stored common changed';next.characters[0].prompt='stored character changed';f.setLibrary(next);f.ui.refresh();
  assert.equal(f.field('공통 프롬프트').value,'draft common');assert.equal(f.field('LoRA 트리거 키워드').value,'draft trigger');assert.equal(f.field('캐릭터 프롬프트').value,'draft character');assert.equal(f.field('청크 프롬프트').value,'draft chunk');
  assert.equal(f.field('청크 선택: 행동').checked,true);assert.equal(f.field('이 조합의 생성 횟수').value,'8');assert.match(f.preview(),/stored common changed, trigger one, trigger two, stored character changed, waving/);
});

function folderSeed() {
  const library=seed();library.chunkFolders=[{id:'f1',name:'표정 폴더'},{id:'f2',name:'행동 폴더'}];
  library.scenes[0].folderId='f1';library.scenes[1].folderId='f2';
  library.scenes.push({id:'s3',name:'웃음',prompt:'laughing',negativePrompt:'crying',folderId:'f1'},
    {id:'u1',name:'장소',prompt:'in a room',negativePrompt:''});return library;
}
async function type(f,label,value) {const input=f.field(label);input.value=value;await input.emit('input');}
function pickerGroup(f,id) {const group=f.ui.root.querySelectorAll('[data-picker-folder]').find(item=>item.dataset.pickerFolder===id);assert(group,`Missing picker folder ${id}`);return group;}

test('folder create, rename, chunk assignment and removal preserve child prompts and saved reservations',async t=>{
  const f=fixture(t);f.field('청크 폴더 이름').value='표정';await f.press('폴더 저장');
  const folderId=f.library().chunkFolders[0].id;assert.equal(f.field('관리할 청크 폴더').value,folderId);
  await f.select('저장한 청크','s1');await f.select('청크 폴더',folderId);await f.press('청크 저장');
  assert.equal(f.library().scenes[0].folderId,folderId);await f.choose('표정');await f.press('이 조합 예약 추가');
  f.field('청크 폴더 이름').value='표정·감정';await f.press('폴더 저장');assert.equal(f.library().chunkFolders[0].name,'표정·감정');
  const before=f.library();await f.press('선택 폴더 삭제');
  assert.deepEqual(f.library().chunkFolders,[]);assert.equal(Object.hasOwn(f.library().scenes[0],'folderId'),false);
  assert.equal(f.library().scenes[0].prompt,before.scenes[0].prompt);assert.deepEqual(f.library().reservations,before.reservations);
  assert.equal(f.field('청크 폴더').value,'');assert.equal(f.field('청크 선택: 표정').checked,true);
  await f.press('예약 전부를 대기열에 등록');assert.equal(f.jobs.length,1);assert.match(f.jobs[0].prompt,/smiling/);
});

test('manager search matches prompt text, keeps hidden edited IDs and drafts, and retains folder folding after a refresh',async t=>{
  const f=fixture(t,folderSeed());await f.select('저장한 청크','s1');
  f.field('청크 프롬프트').value='unfinished draft';await type(f,'청크 검색','waving');
  assert.equal(f.fields('청크 편집: 표정').length,0);assert.equal(f.fields('청크 편집: 행동').length,1);
  assert.equal(f.field('저장한 청크').value,'s1');assert.equal(f.field('청크 프롬프트').value,'unfinished draft');assert.equal(f.saves.length,0);
  await type(f,'청크 검색','');await f.select('청크 폴더 필터','folder:f1');
  assert.equal(f.fields('청크 편집: 장소').length,0);assert.equal(f.fields('청크 편집: 웃음').length,1);
  const group=f.ui.root.querySelectorAll('[data-chunk-folder]').find(item=>item.dataset.chunkFolder==='f1');group.open=false;await group.emit('toggle');
  f.ui.refresh();assert.equal(f.ui.root.querySelectorAll('[data-chunk-folder]').find(item=>item.dataset.chunkFolder==='f1').open,false);
  assert.equal(f.field('청크 프롬프트').value,'unfinished draft');assert.match(f.field('청크 목록 개수').textContent,/검색 결과 2 \/ 전체 4/);
  await type(f,'청크 검색','nothing matched');assert.match(f.field('저장한 청크 목록').textContent,/검색에 맞는 청크가 없습니다/);
});

test('picker filtering and folding retain hidden selections; select-all adds only visible unfolded matches and clear removes every selection',async t=>{
  const f=fixture(t,folderSeed());await f.choose('표정');
  await type(f,'예약 청크 검색','waving');assert.equal(f.fields('청크 선택: 표정').length,0);
  assert.match(f.field('선택한 청크 요약').textContent,/표정/);assert.match(f.field('선택한 청크 요약').textContent,/목록 밖에 선택 1개/);
  await f.press('보이는 청크 모두 선택');assert.equal(f.field('청크 선택: 행동').checked,true);assert.match(f.preview(),/smiling, waving/);
  await type(f,'예약 청크 검색','');const group=pickerGroup(f,'f1');group.open=false;await group.emit('toggle');
  await f.press('보이는 청크 모두 선택');assert.equal(f.field('청크 선택: 장소').checked,true);assert.equal(f.field('청크 선택: 웃음').checked,false);
  assert.equal(f.field('청크 선택: 표정').checked,true);assert.match(f.field('선택한 청크 요약').textContent,/목록 밖에 선택 1개/);
  await f.select('예약 청크 폴더 필터','folder:f2');await f.press('이 조합 예약 추가');
  assert.deepEqual(f.library().reservations[0].sceneIds,['u1','s1','s2']);
  assert.equal(f.field('예약 청크 폴더 필터').value,'folder:f2');
  await f.press('청크 선택 전부 해제');assert.match(f.field('선택한 청크 요약').textContent,/선택한 청크 없음/);assert(!f.preview().includes('smiling'));
  await f.select('예약 청크 폴더 필터','');assert.equal(f.field('청크 선택: 표정').checked,false);assert.equal(pickerGroup(f,'f1').open,false);
});

test('folder and chunk sorting change new combination order while preserving existing reservation snapshots and editor drafts',async t=>{
  const f=fixture(t,folderSeed());await f.choose('행동');await f.choose('표정');await f.choose('장소');await f.press('이 조합 예약 추가');
  const first=f.library().reservations[0];assert.deepEqual(first.sceneIds,['u1','s1','s2']);
  await f.select('저장한 청크','s1');f.field('청크 프롬프트').value='keep draft';
  await f.select('관리할 청크 폴더','f2');await f.field('선택 폴더 위로').press();
  assert.deepEqual(f.library().chunkFolders.map(item=>item.id),['f2','f1']);assert.match(f.preview(),/in a room, waving, smiling/);
  assert.deepEqual(f.library().reservations[0],first);assert.equal(f.field('청크 프롬프트').value,'keep draft');
  await f.field('청크 표정 아래로').press();assert.deepEqual(core.orderedChunks(f.library()).map(item=>item.id),['u1','s2','s3','s1']);
  assert.equal(f.field('청크 표정 아래로').disabled,true);assert.equal(globalThis.document.activeElement,f.field('청크 표정 위로'));
  assert.equal(f.field('청크 선택: 표정').checked,true);assert.equal(f.field('청크 프롬프트').value,'keep draft');
  await f.press('이 조합 예약 추가');const second=f.library().reservations[1];assert.deepEqual(second.sceneIds,['u1','s2','s1']);
  const rows=f.all().filter(item=>item.className.split(/\s+/).includes('pq-reservation'));
  await rows[1].querySelectorAll('[data-order-key]').find(item=>item.dataset.direction==='-1').press();
  assert.deepEqual(f.library().reservations.map(item=>item.id),[second.id,first.id]);assert.deepEqual(f.library().reservations[1],first);
  assert.equal(f.jobs.length,0);
});

test('preset and character ordering keep editor drafts and expose unavailable boundaries with keyboard focus',async t=>{
  const initial=folderSeed();initial.presets.push({...copy(initial.presets[0]),id:'p2',name:'Second preset'});initial.characters.push({id:'c2',name:'Bob',prompt:'bob tags',negativePrompt:''});
  const f=fixture(t,initial);assert.equal(f.field('선택 프리셋 위로').disabled,true);assert.equal(f.field('선택 프리셋 위로').dataset.unavailable,'true');
  await f.select('저장한 설정 프리셋','p1');f.field('프리셋 이름').value='draft preset';f.field('LoRA 트리거 키워드').value='draft trigger';
  await f.field('선택 프리셋 아래로').press();assert.deepEqual(f.library().presets.map(item=>item.id),['p2','p1']);assert.equal(f.field('프리셋 이름').value,'draft preset');assert.equal(f.field('LoRA 트리거 키워드').value,'draft trigger');
  assert.equal(f.field('선택 프리셋 아래로').disabled,true);assert.equal(globalThis.document.activeElement,f.field('선택 프리셋 위로'));
  await f.select('저장한 캐릭터','c1');f.field('캐릭터 프롬프트').value='draft character';await f.field('선택 캐릭터 아래로').press();
  assert.deepEqual(f.library().characters.map(item=>item.id),['c2','c1']);assert.equal(f.field('저장한 캐릭터').value,'c1');assert.equal(f.field('캐릭터 프롬프트').value,'draft character');
});

test('failed saves leave ordering, selected chunks, assigned folders and every draft unchanged',async t=>{
  const f=fixture(t,folderSeed());await f.select('저장한 청크','s1');await f.select('관리할 청크 폴더','f1');await f.choose('표정');await f.press('이 조합 예약 추가');
  f.field('청크 프롬프트').value='unsaved chunk';f.field('청크 폴더 이름').value='unsaved folder rename';
  const before=f.library(),preview=f.preview();f.setSaveFailure('fixture storage full');
  await f.field('청크 표정 아래로').press();assert.match(f.messages.at(-1),/storage full/);assert.deepEqual(f.library(),before);
  assert.equal(f.field('청크 프롬프트').value,'unsaved chunk');assert.equal(f.field('저장한 청크').value,'s1');assert.equal(f.preview(),preview);
  await f.press('선택 폴더 삭제');assert.deepEqual(f.library(),before);assert.equal(f.field('관리할 청크 폴더').value,'f1');assert.equal(f.field('청크 폴더').value,'f1');
  assert.equal(f.field('청크 폴더 이름').value,'unsaved folder rename');assert.equal(f.field('청크 선택: 표정').checked,true);
  assert.equal(f.field('청크 표정 아래로').disabled,false);assert.equal(f.jobs.length,0);
});

test('folding picker groups during execution cannot re-enable selection actions or newly refreshed controls',async t=>{
  const f=fixture(t,folderSeed());await f.choose('표정');assert.equal(f.button('청크 선택 전부 해제').disabled,false);
  f.setBusy(true);const group=pickerGroup(f,'f1');group.open=false;await group.emit('toggle');
  assert.equal(f.button('청크 선택 전부 해제').disabled,true);assert.equal(f.button('보이는 청크 모두 선택').disabled,true);
  f.ui.refresh();assert.equal(f.field('청크 편집: 행동').disabled,true);assert.equal(f.field('청크 선택: 행동').disabled,true);
  assert.equal(f.button('청크 선택 전부 해제').disabled,true);assert.equal(f.saves.length,0);
  f.setBusy(false);assert.equal(f.button('청크 선택 전부 해제').disabled,false);assert.equal(f.button('보이는 청크 모두 선택').disabled,false);
});

test('import reload resets folder views and selection drafts while filling imported folder assignments and names',async t=>{
  const f=fixture(t,folderSeed());await f.select('저장한 청크','s1');await f.select('관리할 청크 폴더','f1');await f.choose('행동');
  await f.select('청크 폴더 필터','folder:f1');await type(f,'청크 검색','smiling');await f.select('예약 청크 폴더 필터','folder:f2');await type(f,'예약 청크 검색','waving');
  pickerGroup(f,'f2').open=false;await pickerGroup(f,'f2').emit('toggle');
  const imported=folderSeed();imported.chunkFolders[0].name='Imported folder';imported.scenes[0].folderId='f2';imported.scenes[0].prompt='imported smile';
  f.setLibrary(imported);f.ui.reload();
  assert.equal(f.field('청크 검색').value,'');assert.equal(f.field('예약 청크 검색').value,'');assert.equal(f.field('청크 폴더 필터').value,'');assert.equal(f.field('예약 청크 폴더 필터').value,'');
  assert.equal(f.field('청크 폴더 이름').value,'Imported folder');assert.equal(f.field('청크 폴더').value,'f2');assert.equal(f.field('청크 프롬프트').value,'imported smile');
  assert.equal(f.field('청크 선택: 행동').checked,false);assert.equal(pickerGroup(f,'f2').open,true);
  assert.match(f.field('선택한 청크 요약').textContent,/선택한 청크 없음/);
});
