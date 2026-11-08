'use strict';
// Exercise the production composition editor with synthetic data only.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const copy=value=>JSON.parse(JSON.stringify(value));
let source=fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8');
// Keep focused tests usable before the root builds both installation files.
for(const [marker,name] of [['PARITY CORE','parity-core'],['BACKUP TRANSFER','backup-transfer'],['CHARACTER LORA','character-lora'],['IMAGE INFO','image-info'],['PARITY UI','parity-ui'],['WEB UNLIMITED','web-unlimited'],['LIBRARY SYNC','library-sync']])source=source.replace(new RegExp('  // BEGIN '+marker+'[\\s\\S]*?  // END '+marker),()=>`  // BEGIN ${marker}\n${fs.readFileSync(path.join(__dirname,'modules',name+'.js'),'utf8')}\n  // END ${marker}`);
const sandbox={module:{exports:{}},setTimeout,clearTimeout,URL,Blob,AbortController,TextDecoder,TextEncoder,crypto:require('node:crypto').webcrypto};
Object.defineProperty(sandbox,'document',{get:()=>globalThis.document});
vm.runInNewContext(source,sandbox,{filename:'material-order-production.js'});
const core=sandbox.module.exports;
// Reuse the existing fake DOM/IO fixture without registering its test suite.
const existing=fs.readFileSync(path.join(__dirname,'verify-ui.cjs'),'utf8'),start=existing.indexOf('class Element {'),end=existing.indexOf('\ntest(',start);
assert(start>=0&&end>start);
const {fixture,seed}=new Function('core','copy','assert',existing.slice(start,end)+'\nreturn {fixture,seed};')(core,copy,assert);
const row=(f,id)=>f.ui.root.querySelectorAll('[data-recipe-material]').find(item=>item.dataset.recipeMaterial===id);
function transfer(){const values=new Map();return {setData:(key,value)=>values.set(key,value),getData:key=>values.get(key)||'',effectAllowed:'',dropEffect:''};}
async function drop(f,label,target,after=false){const dataTransfer=transfer();await f.field(label).emit('dragstart',{dataTransfer});await row(f,target).emit('drop',{dataTransfer,clientY:after?160:104});}

test('free material order works with arrows, native and pointer drag and is frozen in reservations',async t=>{
  const f=fixture(t);await f.choose('표정');await f.choose('행동');await f.press('이 조합 예약 추가');const frozen=copy(f.library().reservations[0]);
  await drop(f,'조합 청크 이동: 행동','common');
  assert.deepEqual(f.preferences.draft.materialOrder,['chunk:s2','common','character','chunk:s1']);
  assert.equal(f.preferences.draft.triggerPosition,1);assert.match(f.preview(),/waving, quality, trigger one, trigger two, character tags, smiling/);
  await f.press('조합 표정 위로');assert.deepEqual(f.preferences.draft.materialOrder,['chunk:s2','common','chunk:s1','character']);
  document.elementFromPoint=()=>({closest:()=>row(f,'common')});const handle=f.field('조합 캐릭터 이동'),pointer={button:0,isPrimary:true,pointerId:8,clientX:10,clientY:180};
  await handle.emit('pointerdown',pointer);await handle.emit('pointermove',{...pointer,clientY:104});await handle.emit('pointerup',{...pointer,clientY:104});
  assert.deepEqual(f.preferences.draft.materialOrder,['chunk:s2','character','common','chunk:s1']);assert.equal(f.preferences.draft.triggerPosition,1);
  await f.press('이 조합 예약 추가');assert.deepEqual(f.library().reservations[0],frozen);assert.deepEqual(f.library().reservations[1].materialOrder,f.preferences.draft.materialOrder);
  await f.press('예약 전부를 대기열에 등록');assert.equal(f.jobs[1].prompt,'waving, character tags, quality, trigger one, trigger two, smiling');
  assert.deepEqual(f.library().scenes.map(item=>item.id),['s1','s2']);
});

test('draft, favorites, adding and removing chunks retain material order and older combinations reset it',async t=>{
  const f=fixture(t);await f.choose('표정');await drop(f,'조합 청크 이동: 표정','common');await f.press('현재 조합 즐겨찾기');const favorite=f.library().combinations[0];
  const fresh=fixture(t,f.library(),copy(f.preferences));assert.deepEqual(fresh.preferences.draft.materialOrder,['chunk:s1','common','character']);assert.match(fresh.preview(),/smiling, quality, trigger one/);
  await fresh.choose('행동');assert.deepEqual(fresh.preferences.draft.materialOrder,['chunk:s1','common','character','chunk:s2']);
  await fresh.press('조합에서 제외: 표정');assert.equal(fresh.preferences.draft.materialOrder,undefined);assert.deepEqual(fresh.preferences.draft.sceneIds,['s2']);
  await fresh.press('조합 불러오기: '+favorite.id);assert.deepEqual(fresh.preferences.draft.materialOrder,['chunk:s1','common','character']);
  const withLegacy=fresh.library();withLegacy.combinations.push({...favorite,id:'legacy-order',favorite:false,materialOrder:undefined});fresh.setLibrary(withLegacy);fresh.ui.refresh();await fresh.press('조합 불러오기: legacy-order');assert.equal(fresh.preferences.draft.materialOrder,undefined);await fresh.press('조합 불러오기: '+favorite.id);
  const library=fresh.library();library.scenes=library.scenes.filter(item=>item.id!=='s1');fresh.setLibrary(library);fresh.ui.refresh();
  assert.deepEqual(fresh.preferences.draft.sceneIds,[]);assert.equal(fresh.preferences.draft.materialOrder,undefined);assert.match(fresh.field('합쳐지는 순서').textContent,/공통문/);
  await fresh.press('조합 불러오기: '+favorite.id);assert.deepEqual(fresh.preferences.draft.sceneIds,[]);assert.equal(fresh.button('이 조합 예약 추가').disabled,true);
  await fresh.press('누락 재료 제외하고 계속');assert.equal(fresh.button('이 조합 예약 추가').disabled,false);
});

test('numeric last-chunk anchor differs from end and both survive new chunk selection and suffix composition',async t=>{
  const f=fixture(t);await f.choose('표정');await f.select('LoRA 트리거 위치','3');
  const parts=()=>{const draft=f.preferences.draft,lib=f.library();return [lib.common,lib.characters[0],draft.sceneIds.map(id=>lib.scenes.find(item=>item.id===id)),lib.presets[0],draft.triggerPosition,{scene:{prompt:'scene suffix',negativePrompt:''}},{materialOrder:draft.materialOrder,sceneIds:draft.sceneIds}];};
  assert.match(core.composePresetPrompts(...parts()).prompt,/smiling, trigger one, trigger two, scene suffix$/);
  await f.choose('행동');assert.equal(f.preferences.draft.triggerPosition,3);assert.match(f.preview(),/smiling, trigger one, trigger two, waving/);
  await f.select('LoRA 트리거 위치','end');assert.match(core.composePresetPrompts(...parts()).prompt,/smiling, waving, scene suffix, trigger one, trigger two$/);
  await f.choose('행동',false);await f.choose('행동');assert.equal(f.preferences.draft.triggerPosition,'end');
  assert.match(f.field('LoRA 트리거 위치').textContent,/씬 추가 문구 앞/);assert.match(f.field('LoRA 트리거 위치').textContent,/씬 추가 문구까지 포함/);
});

test('scene creation warns before dropping full material order and preserves the original draft on cancel and confirm',async t=>{
  const f=fixture(t);await f.choose('표정');await drop(f,'조합 청크 이동: 표정','common');const draft=copy(f.preferences.draft);
  await f.press('현재 조합으로 씬 만들기');assert.equal(f.library().sceneCards?.length||0,0);assert.match(f.field('편집 내용 확인').textContent,/전체 재료 순서는 씬에 저장되지 않습니다/);
  await f.press('취소');assert.equal(f.library().sceneCards?.length||0,0);assert.deepEqual(f.preferences.draft,draft);
  await f.press('현재 조합으로 씬 만들기');await f.press('확인');assert.equal(f.library().sceneCards.length,1);assert.deepEqual(f.library().sceneCards[0].sceneIds,['s1']);assert.equal(f.library().sceneCards[0].materialOrder,undefined);assert.deepEqual(f.preferences.draft,draft);
});

test('opening a partial image import clears the previous order while retaining the unselected text in its original order',async t=>{
  const f=fixture(t),images=require('./test-fixtures/generated-images.cjs');await f.choose('표정');await drop(f,'조합 청크 이동: 표정','common');
  const data=images.png(core,[images.text(core,'source',JSON.stringify({prompt:'imported-positive'}))]);
  const input=f.field('이미지 한 장 선택');input.files=[new Blob([data],{type:'image/png'})];await input.emit('change');
  const positive=f.field('포지 적용');positive.checked=true;await positive.emit('change');await f.press('선택한 정보로 조합 열기');await f.press('확인');
  assert.equal(f.preferences.draft.materialOrder,undefined);assert.equal(f.preferences.draft.sceneIds.length,1);assert.match(f.preview(),/imported-positive/);assert.match(f.preview(),/sad, common bad, character bad/);assert.equal(f.jobs.length,0);
});
