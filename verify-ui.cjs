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
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
  async emit(type){for(const listener of this.listeners[type]||[])await listener({type,target:this,isTrusted:true,preventDefault(){},stopPropagation(){}});}
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
  const messages=[],jobs=[];let sequence=0;
  const parent=new Element('aside');const previousDocument=globalThis.document;
  globalThis.document={createElement:tag=>new Element(tag)};
  t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
  const ui=core.mountPresetEditor(parent,{
    load:()=>copy(library),save:value=>{library=core.normalizePresetLibrary(copy(value));},
    captureSettings:async()=>copy(captured),applySettings:async()=>{},notify:message=>messages.push(message),
    enqueue:async value=>{jobs.push(...core.expandPresetReservations(value,{idFactory:()=>`job-${++sequence}`,maxCredits:7800}));},
    button:(text,action)=>{const element=new Element('button');element.textContent=text;element.press=async()=>{if(element.disabled)return;try{await action();}catch(error){messages.push(error.message);}};return element;}
  });
  const all=(root=parent)=>[root,...root.children.flatMap(child=>all(child))];
  const fields=name=>all().filter(element=>element.getAttribute('aria-label')===name);
  const field=(name,index=0)=>{const element=fields(name)[index];assert(element,`Missing field: ${name} #${index}`);return element;};
  const press=async name=>{const element=all().find(item=>item.tagName==='BUTTON'&&item._text===name);assert(element,`Missing button: ${name}`);assert(Object.hasOwn(element.dataset,'edit'),`${name} must participate in running-state disable`);await element.press();};
  const select=async(name,value)=>{field(name).value=value;await field(name).emit('change');};
  const choose=async(name,checked=true)=>{const element=field(`청크 선택: ${name}`);assert.equal(element.type,'checkbox');element.checked=checked;await element.emit('change');};
  return {ui,parent,all,field,fields,press,select,choose,messages,jobs,
    preview:()=>field('저장한 프롬프트 조합 미리보기').textContent,
    library:()=>copy(library),setLibrary:value=>{library=core.normalizePresetLibrary(copy(value));},
    setCapture:value=>{captured=copy(value);}};
}

test('the production editor names reusable scenes as prompt chunks and saves edits in the existing scenes array',async t=>{
  const f=fixture(t);
  assert(f.all().some(element=>element.tagName==='SUMMARY'&&element.textContent==='④ 프롬프트 청크'));
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
