'use strict';
// Isolated scene-editor interactions. No browser, storage or network is accessed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const copy=value=>JSON.parse(JSON.stringify(value));
const source=fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8');
const parity=fs.readFileSync(path.join(__dirname,'modules/parity-ui.js'),'utf8');
// Inject the source module so this focused test can run before the generated installers are rebuilt.
const compiled=source.replace(/  \/\/ BEGIN PARITY UI[\s\S]*?  \/\/ END PARITY UI/,()=> '  // BEGIN PARITY UI\n'+parity+'\n  // END PARITY UI').replace('const core = {','const core = {mountSceneStudio,');
const sandbox={module:{exports:{}},setTimeout,clearTimeout,URL,AbortController,TextDecoder,TextEncoder,crypto:require('node:crypto').webcrypto};
vm.runInNewContext(compiled,sandbox,{filename:'studio-ui-production.js'});const core=sandbox.module.exports;

class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.listeners={};this.style={};this.hidden=false;this._text='';}
  set textContent(value){this._text=String(value??'');this.children=[];}get textContent(){return this._text+this.children.map(e=>e.textContent).join('');}
  setAttribute(name,value){this.attrs[name]=String(value);if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  getAttribute(name){return this.attrs[name]??null;}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  async emit(name,extra={}){for(const fn of this.listeners[name]||[])await fn({type:name,target:this,isTrusted:true,preventDefault(){},stopPropagation(){},...extra});}
  getBoundingClientRect(){return {top:100,height:64};}
}
function fixture(initial,preferences={}){
  let library=core.normalizePresetLibrary(copy(initial)),api;const pages=[],messages=[],confirmations=[];
  const el=(tag,text,attrs={})=>{const e=new Element(tag);if(text!=null)e.textContent=text;for(const [key,value] of Object.entries(attrs))e.setAttribute(key,value);return e;};
  const field=(label,tag='input',attrs={})=>{const input=el(tag,null,{'aria-label':label,...attrs}),wrap=el('label',label);input.value='';wrap.append(input);return {input,wrap};};
  const action=(label,run)=>{const e=el('button',label,{type:'button','data-edit':''});e.press=run;return e;};
  const ctx={el,field,action,io:{notify:text=>messages.push(text),loadStudioDraft:()=>preferences.studio&&copy(preferences.studio),saveStudioDraft:value=>{preferences.studio=copy(value);}},
    addPage:(id,label)=>{const page=el('div',null,{'data-page':id,'aria-label':label});pages.push(page);return page;},
    getImages:()=>({aspectRatio:'5:3',size:'1k',mode:'pro',batchSize:1}),getLibrary:()=>library,getRecipe:()=>({presetId:'p',characterId:'c',sceneIds:['chunk'],count:1}),getThumbnail:()=>null,
    resizable:(container,children)=>container.append(...children),commit:async value=>{library=core.normalizePresetLibrary(copy(value));api?.refresh();},
    confirm:(_text,run)=>confirmations.push(run),confirmDraft:(dirty,save,discard,next)=>dirty?confirmations.push({save,discard,next}):next(),enqueue:()=>{throw Error('No generation in UI test');}};
  api=core.mountSceneStudio(ctx);
  const all=(root={children:pages})=>[root,...root.children.flatMap(child=>all(child))];
  const find=name=>{const e=all().find(e=>e.getAttribute?.('aria-label')===name);assert(e,'Missing labelled element: '+name);return e;};
  const button=name=>{const e=all().find(e=>e.tagName==='BUTTON'&&(e.textContent===name||e.getAttribute('aria-label')===name));assert(e,'Missing button: '+name);return e;};
  const panel=id=>all().find(e=>e.dataset?.studioMaterial===id);
  const check=async(name,value=true)=>{const e=find(name);e.checked=value;await e.emit('change');};
  return {api,all,find,button,panel,check,pages,preferences,messages,confirmations,library:()=>copy(library)};
}
function seed(){const lib={...core.makePresetLibrary(),presets:[{id:'p',name:'Preset',model:{id:'101',versionId:'201',name:'T'},loras:[]}],characters:[{id:'c',name:'Character',prompt:'character',negativePrompt:'',defaultPresetId:'p'}],scenes:[{id:'chunk',name:'Chunk',prompt:'smile',negativePrompt:''}],casts:[{id:'cast',name:'Cast',characterId:'c',presetId:'p',extra:{prompt:'coat',negativePrompt:''}}]};lib.sceneCards=[core.makeSceneCard(lib,{id:'scene',name:'Scene',sceneIds:['chunk']})];return lib;}

test('scene material switching retains both selections and counts, then restores the active list and compact mode',async()=>{
  const f=fixture(seed());assert.equal(f.panel('rows').hidden,false);assert.equal(f.panel('scenes').hidden,true);assert.equal(f.panel('manage').hidden,true);
  await f.check('일괄 행 선택: Character');await f.check('일괄 행 선택: Cast');
  assert.equal(f.button('캐릭터·출연 목록 보기').textContent,'캐릭터·출연 2');
  await f.button('씬 목록 보기').press();assert.equal(f.panel('rows').hidden,true);assert.equal(f.panel('scenes').hidden,false);
  await f.check('일괄 씬 선택: Scene');assert.equal(f.button('씬 목록 보기').textContent,'씬 1');
  await f.button('구성·예약').press();assert.equal(f.button('구성·예약').getAttribute('aria-pressed'),'true');assert.equal(f.button('재료 선택').getAttribute('aria-pressed'),'false');
  const fresh=fixture(f.library(),f.preferences);assert.equal(fresh.panel('scenes').hidden,false);assert.equal(fresh.button('씬 목록 보기').getAttribute('aria-pressed'),'true');assert.equal(fresh.button('구성·예약').getAttribute('aria-pressed'),'true');
  assert.deepEqual(f.preferences.studio.plan.rows,[{kind:'character',id:'c'},{kind:'cast',id:'cast'}]);assert.deepEqual(f.preferences.studio.plan.columns,['scene']);
  assert.match(fresh.find('일괄 예약 수량').textContent,/2조합 · 2작업 · 2장/);
  await fresh.button('선택 조합 전부 예약').press();assert.equal(fresh.library().reservations.length,2);
});
test('hidden scene and cast editors retain dirty drafts and selecting a scene updates compact mode accessibly',async()=>{
  const f=fixture(seed());await f.button('씬 목록 보기').press();await f.button('Scene').press();
  assert.equal(f.button('씬 편집').getAttribute('aria-pressed'),'true');f.find('씬 이름').value='Unsaved scene';await f.find('씬 이름').emit('input');
  await f.button('재료 선택').press();await f.button('관리 목록 보기').press();assert.equal(f.api.dirty(),true);assert.equal(f.find('씬 이름').value,'Unsaved scene');
  await f.button('출연 편집: Cast').press();f.find('출연 이름').value='Unsaved cast';await f.find('출연 이름').emit('input');
  await f.button('캐릭터·출연 목록 보기').press();assert.equal(f.api.castEditor.dirty(),true);assert.equal(f.find('출연 이름').value,'Unsaved cast');
  await f.button('씬 목록 보기').press();await f.button('새 씬 만들기').press();assert.equal(f.confirmations.length,1);assert.equal(f.find('씬 이름').value,'Unsaved scene');
  assert.equal(f.library().sceneCards[0].name,'Scene');assert.equal(f.library().casts[0].name,'Cast');
});

for(const [key,moved,target,expectedFolder] of [['ArrowUp','two','one','folder-one'],['ArrowDown','one','two','folder-two'],['ArrowUp','three','two','folder-two'],['ArrowDown','two','three',undefined]]) {
  test('scene keyboard '+key+' '+moved+' across folders matches native drag and preserves existing reservations',async()=>{
    const initial=seed();initial.sceneFolders=[{id:'folder-one',name:'Folder one'},{id:'folder-two',name:'Folder two'}];
    initial.sceneCards=['one','two','three'].map((id,index)=>({...core.makeSceneCard(initial,{id,name:id,sceneIds:['chunk']}),...(index<2?{folderId:'folder-'+id}:{})}));
    const f=fixture(initial);await f.check('일괄 행 선택: Character');await f.check('일괄 씬 선택: one');await f.button('선택 조합 전부 예약').press();
    const before=f.library(),plan=copy(f.preferences.studio.plan),native=fixture(before,copy(f.preferences));
    await f.find('씬 목록 이동: '+moved).emit('keydown',{key});await new Promise(resolve=>setImmediate(resolve));
    const after=f.library();assert.equal(after.sceneCards.find(v=>v.id===moved).folderId,expectedFolder);assert.deepEqual(after.reservations,before.reservations);assert.deepEqual(f.preferences.studio.plan,plan);assert.deepEqual(f.messages,[]);
    const data=new Map(),dataTransfer={setData:(type,value)=>data.set(type,value),getData:type=>data.get(type)||''};
    await native.find('씬 목록 이동: '+moved).emit('dragstart',{dataTransfer});
    const targetRow=native.all().find(v=>v.dataset?.studioScene===target);assert(targetRow);
    await targetRow.emit('drop',{dataTransfer,clientY:key==='ArrowUp'?101:160});await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(after,native.library());assert.deepEqual(native.messages,[]);assert.deepEqual(native.preferences.studio.plan,plan);
    const ids=before.sceneCards.map(v=>v.id),from=ids.indexOf(moved),to=ids.indexOf(target);[ids[from],ids[to]]=[ids[to],ids[from]];assert.deepEqual(after.sceneCards.map(v=>v.id),ids);
  });
}
