'use strict';
// 씬 카드·출연·일괄 예약 구성(0.9.13 core). 설계: docs/plans/2026-10-10_pixai-batch-reservation-design.md
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('./pixai-web-queue.user.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const chunk=(id,prompt)=>({id,name:id.toUpperCase(),prompt,negativePrompt:`bad ${id}`});
const seed=()=>({version:1,common:{prompt:'quality',negativePrompt:'lowres'},
  presets:[{id:'p1',name:'Base',model:{id:'1',versionId:'101',name:'M'},loras:[{id:'22',versionId:'222',name:'L',weight:0.5,triggerWords:'trig'}]},{id:'p2',name:'Alt',model:{id:'1',versionId:'102',name:'M2'},loras:[]}],
  characters:[{id:'c1',name:'Alice',prompt:'alice',negativePrompt:'',defaultPresetId:'p1'},{id:'c2',name:'Bob',prompt:'bob',negativePrompt:''},{id:'c3',name:'Cara',prompt:'cara',negativePrompt:'',defaultPresetId:'p1'}],
  scenes:[chunk('s1','smile'),chunk('s2','wave'),chunk('s3','angry'),chunk('s4','cry')],reservations:[],
  sceneFolders:[{id:'f1',name:'표정'}],
  sceneCards:[
    {id:'sc1',name:'웃음·손',sceneIds:['s1','s2'],chunks:[chunk('s1','smile'),chunk('s2','wave')],folderId:'f1'},
    {id:'sc2',name:'분노',sceneIds:['s3'],chunks:[chunk('s3','angry')]},
    {id:'sc3',name:'울음',sceneIds:['s4'],chunks:[chunk('s4','cry')],imageOptions:{aspectRatio:'5:3',size:'1k'},extra:{prompt:'rain',negativePrompt:'sun'},triggerPosition:'end'}],
  casts:[{id:'cast1',name:'Alice · 겨울복',characterId:'c1',presetId:'p2',extra:{prompt:'winter coat',negativePrompt:''}}]});
const plan=()=>({id:'plan1',name:'',rows:[{kind:'character',id:'c1'},{kind:'character',id:'c2',presetId:'p2'},{kind:'cast',id:'cast1'}],columns:['sc1','sc2','sc3'],count:2,
  exceptions:{'character:c1|sc2':0,'cast:cast1|sc3':3},order:'byRow'});
let seq=0;const ids=()=>`id-${++seq}`;
const now=Date.UTC(2026,9,10,5,2); // 10-10 14:02 KST when TZ=+9; the test only checks the shape

test('rows × columns × counts expand in checklist order with per-cell exceptions, and both orders yield the same multiset',()=>{
  seq=0;const out=core.expandBatchPlan(seed(),plan(),{idFactory:ids,batchSize:4,batchId:'b1',now});
  assert.deepEqual(out.problems,[]);
  assert.deepEqual(out.totals,{pairs:8,jobs:17,images:68,batchSize:4});
  assert.deepEqual(out.order.map(item=>`${item.rowKey}|${item.columnId}:${item.count}`),
    ['character:c1|sc1:2','character:c1|sc3:2','character:c2|sc1:2','character:c2|sc2:2','character:c2|sc3:2','cast:cast1|sc1:2','cast:cast1|sc2:2','cast:cast1|sc3:3']);
  assert.equal(out.reservations.length,8);
  const first=out.reservations[0];
  assert.deepEqual({preset:first.presetId,character:first.characterId,scenes:first.sceneIds,count:first.count,batch:first.batch},{preset:'p1',character:'c1',scenes:['s1','s2'],count:2,batch:{id:'b1',name:out.batch.name,rowName:'Alice',columnName:'웃음·손'}});
  assert.equal(out.reservations[2].presetId,'p2');assert.equal(out.reservations[5].presetId,'p2');assert.equal(out.reservations[5].characterId,'c1');
  assert.match(out.batch.name,/^캐릭터 3 × 씬 3 · \d{2}-\d{2} \d{2}:\d{2}$/);
  seq=0;const byColumn=core.expandBatchPlan(seed(),{...plan(),order:'byColumn'},{idFactory:ids,batchSize:4,batchId:'b1',now});
  assert.deepEqual(byColumn.order.map(item=>item.columnId),['sc1','sc1','sc1','sc2','sc2','sc3','sc3','sc3']);
  assert.deepEqual([...out.order].sort((a,b)=>a.rowKey.localeCompare(b.rowKey)||a.columnId.localeCompare(b.columnId)),[...byColumn.order].sort((a,b)=>a.rowKey.localeCompare(b.rowKey)||a.columnId.localeCompare(b.columnId)));
  assert.equal(core.expandBatchPlan(seed(),plan(),{batchSize:1}).totals.images,17);
  assert.equal(core.expandBatchPlan(seed(),plan(),{batchSize:0}).totals.batchSize,4);
});

test('a character row without any preset is an error: nothing is expanded and the library stays untouched',()=>{
  const library=seed(),before=copy(library);
  const out=core.expandBatchPlan(library,{...plan(),rows:[{kind:'character',id:'c2'}]},{idFactory:ids});
  assert.equal(out.reservations.length,0);assert.equal(out.problems.length,1);assert.equal(out.problems[0].level,'error');assert.match(out.problems[0].message,/Bob.*프리셋/);
  assert.throws(()=>core.appendBatchReservations(library,out),/해결할 조합/);assert.deepEqual(library,before);
  const missingRow=core.expandBatchPlan(library,{...plan(),rows:[{kind:'cast',id:'nope'}]});assert.match(missingRow.problems[0].message,/출연 nope/);
  const deletedPreset=copy(library);deletedPreset.presets=deletedPreset.presets.filter(item=>item.id!=='p1');
  assert.match(core.expandBatchPlan(deletedPreset,{...plan(),rows:[{kind:'character',id:'c1'}]}).problems[0].message,/프리셋 p1/);
});

test('missing scene card is an error, a broken chunk link is only a warning and the stored copy is used',()=>{
  const out=core.expandBatchPlan(seed(),{...plan(),columns:['sc1','ghost']},{idFactory:ids});
  assert.equal(out.reservations.length,0);assert.match(out.problems.find(item=>item.level==='error').message,/씬 ghost/);
  const library=seed();library.scenes=library.scenes.filter(item=>item.id!=='s2');
  const warned=core.expandBatchPlan(library,{...plan(),rows:[{kind:'character',id:'c1'}],columns:['sc1']},{idFactory:ids});
  assert.equal(warned.problems.length,1);assert.equal(warned.problems[0].level,'warning');assert.match(warned.problems[0].message,/s2.*사본/);
  assert.equal(warned.reservations.length,1);assert.deepEqual(warned.reservations[0].snapshot.chunks.map(item=>item.prompt),['smile','wave']);
  const appended=core.appendBatchReservations(library,warned);assert.equal(appended.reservations.length,1);
  const [job]=core.expandPresetReservations(appended,{idFactory:ids});assert.equal(job.prompt,'quality, trig, alice, smile, wave');
});

test('image settings and trigger position follow scene > plan > nothing; reservations without a value carry no field at all',()=>{
  const out=core.expandBatchPlan(seed(),{...plan(),rows:[{kind:'character',id:'c1'}],exceptions:{}},{idFactory:ids});
  const [sc1,sc2,sc3]=out.reservations;
  assert.equal('imageOptions' in sc1,false);assert.equal('imageOptions' in sc2,false);assert.deepEqual(sc3.imageOptions,{aspectRatio:'5:3',size:'1k'});
  assert.equal('triggerPosition' in sc1,false);assert.equal(sc3.triggerPosition,'end');
  const planned=core.expandBatchPlan(seed(),{...plan(),rows:[{kind:'character',id:'c1'}],exceptions:{},imageOptions:{aspectRatio:'3:5',size:'1.5k'}},{idFactory:ids});
  assert.deepEqual(planned.reservations[0].imageOptions,{aspectRatio:'3:5',size:'1.5k'});assert.deepEqual(planned.reservations[2].imageOptions,{aspectRatio:'5:3',size:'1k'});
  const jobs=core.expandPresetReservations(core.appendBatchReservations(seed(),planned),{idFactory:ids});
  assert.deepEqual(jobs[0].apiOptions,{aspectRatio:'3:5',size:'1.5k'});assert.equal(jobs[0].composition.version,2);assert.equal(jobs[0].composition.reservation.batch.rowName,'Alice');
});

test('cast and scene extra text land after the character and after the chunks; without extras the prompt is byte-identical to the old rule',()=>{
  const library=core.normalizePresetLibrary(seed());
  const common=library.common,preset=library.presets[0],character=library.characters[0],chunks=[library.scenes[0]];
  const plain=core.composePresetPrompts(common,character,chunks,preset,1);
  assert.deepEqual(plain,{prompt:'quality, trig, alice, smile',negativePrompt:'lowres, bad s1'});
  assert.deepEqual(core.composePresetPrompts(common,character,chunks,preset,1,{}),plain);
  const extras={cast:{prompt:'winter coat',negativePrompt:'summer'},scene:{prompt:'rain',negativePrompt:'sun'}};
  assert.deepEqual(core.composePresetPrompts(common,character,chunks,preset,1,extras),{prompt:'quality, trig, alice, winter coat, smile, rain',negativePrompt:'lowres, summer, bad s1, sun'});
  assert.equal(core.composePresetPrompts(common,character,chunks,preset,'end',extras).prompt,'quality, alice, winter coat, smile, rain, trig');
  assert.equal(core.composePresetPrompts(common,character,chunks,preset,3,extras).prompt,'quality, alice, winter coat, smile, trig, rain');
  const out=core.expandBatchPlan(seed(),{...plan(),rows:[{kind:'cast',id:'cast1'}],columns:['sc3'],exceptions:{}},{idFactory:ids});
  assert.deepEqual(out.reservations[0].snapshot.extras,{cast:{prompt:'winter coat',negativePrompt:''},scene:{prompt:'rain',negativePrompt:'sun'}});
  const [job]=core.expandPresetReservations(core.appendBatchReservations(seed(),out),{idFactory:ids});
  assert.equal(job.prompt,'quality, alice, winter coat, cry, rain');assert.equal(job.negativePrompt,'lowres, bad s4, sun');
});

test('appending is all-or-nothing and respects the 1,000 job cap',()=>{
  const library=seed(),out=core.expandBatchPlan(library,plan(),{idFactory:ids,batchId:'b9'});
  const next=core.appendBatchReservations(library,out);
  assert.equal(next.reservations.length,8);assert(next.reservations.every(item=>item.batch.id==='b9'));assert.equal(library.reservations.length,0);
  assert.throws(()=>core.appendBatchReservations(library,{...out,reservations:[]}),/예약할 조합이 없습니다/);
  const huge=core.expandBatchPlan(library,{...plan(),count:100,exceptions:{}},{idFactory:ids});assert.equal(huge.totals.jobs,900);
  const full=copy(library);full.reservations=[{id:'r',presetId:'p1',characterId:'c1',sceneIds:['s1'],count:100},{id:'r2',presetId:'p1',characterId:'c1',sceneIds:['s1'],count:100}];
  assert.throws(()=>core.appendBatchReservations(full,core.expandBatchPlan(full,{...plan(),count:100,exceptions:{}},{idFactory:ids})),/1,000개/);
  assert.equal(core.normalizePresetLibrary(full).reservations.length,2);
});

test('new collections round-trip through normalization and settings backups; libraries without them gain no keys',()=>{
  const library=core.normalizePresetLibrary(seed());
  assert.deepEqual(Object.keys(library).sort(),['casts','characters','chunkFolders','common','presets','reservations','sceneCards','sceneFolders','scenes','version']);
  const old=core.normalizePresetLibrary({version:1,common:{prompt:'',negativePrompt:''},presets:[],characters:[{id:'c',name:'C',prompt:'',negativePrompt:''}],scenes:[],reservations:[]});
  assert.deepEqual(Object.keys(old).sort(),['characters','chunkFolders','common','presets','reservations','scenes','version']);assert.equal('defaultPresetId' in old.characters[0],false);
  const withPlan={...seed(),batchPlans:[{...plan(),name:'표정 세트'}],reservations:core.expandBatchPlan(seed(),plan(),{idFactory:ids,batchId:'b2'}).reservations};
  const backup=core.makeSettingsBackup(withPlan,{maxCredits:null,filePrefix:'',repeat:1},{appVersion:'0.9.13',exportedAt:'2026-10-10T00:00:00.000Z'});
  const parsed=core.parseSettingsBackup(JSON.stringify(backup));
  assert.deepEqual(parsed.library,core.normalizePresetLibrary(withPlan));assert.equal(parsed.library.batchPlans[0].name,'표정 세트');assert.equal(parsed.library.reservations[0].batch.id,'b2');
  for (const broken of [{...seed(),sceneCards:[{id:'x',name:'x',sceneIds:['s1'],chunks:[chunk('s2','wave')]}]},{...seed(),casts:[{id:'x',name:'x',characterId:'c1'}]},{...seed(),sceneCards:[{id:'x',name:'x',sceneIds:['s1'],chunks:[chunk('s1','smile')],folderId:'nope'}]},{...seed(),sceneCards:[{id:'x',name:'x',sceneIds:['s1'],chunks:[chunk('s1','smile')],apiKey:'k'}]}]) {
    assert.throws(()=>core.makeSettingsBackup(broken,{maxCredits:null,filePrefix:'',repeat:1},{appVersion:'0.9.13',exportedAt:'2026-10-10T00:00:00.000Z'}));
  }
});

test('batch plans reject unknown kinds, orders, exception targets and counts outside 0~100',()=>{
  assert.equal(core.normalizeBatchPlan(plan()).order,'byRow');assert.equal(core.normalizeBatchPlan({...plan(),order:undefined}).order,'byRow');
  for (const bad of [{...plan(),rows:[{kind:'preset',id:'p1'}]},{...plan(),order:'random'},{...plan(),exceptions:{'nopipe':1}},{...plan(),exceptions:{'character:c1|sc1':101}},{...plan(),count:0},{...plan(),rows:[{kind:'character',id:'c1'},{kind:'character',id:'c1'}]},{...plan(),columns:['sc1','sc1']},{...plan(),secret:'x'}]) {
    assert.throws(()=>core.normalizeBatchPlan(bad),`should reject ${JSON.stringify(bad).slice(0,60)}`);
  }
  assert.equal(core.batchCellKey(core.batchRowKey({kind:'cast',id:'cast1'}),'sc3'),'cast:cast1|sc3');
  // Exceptions pointing at rows/columns that are no longer selected are dropped, so a saved plan survives unchecking.
  assert.deepEqual(core.normalizeBatchPlan({...plan(),exceptions:{'character:zz|sc1':1,'character:c1|zz':5,'character:c1|sc2':0}}).exceptions,{'character:c1|sc2':0});
});

test('makeSceneCard snapshots live chunks with an automatic name and never stores a character or preset; refresh reports differences without changing the card',()=>{
  seq=0;const card=core.makeSceneCard(seed(),{sceneIds:['s2','s1'],imageOptions:{aspectRatio:'16:9',size:'1k'}},{idFactory:ids});
  assert.deepEqual(card,{id:'id-1',name:'S2 · S1',sceneIds:['s2','s1'],chunks:[chunk('s2','wave'),chunk('s1','smile')],imageOptions:{aspectRatio:'16:9',size:'1k'}});
  assert.equal(JSON.stringify(card).includes('alice'),false);
  assert.throws(()=>core.makeSceneCard(seed(),{sceneIds:['s1','zz']}),/zz/);assert.throws(()=>core.makeSceneCard(seed(),{sceneIds:[]}),/하나 이상/);
  assert.equal(core.makeSceneCard(seed(),{name:' 내 씬 ',sceneIds:['s1'],folderId:'f1'}).folderId,'f1');
  const library=seed();library.scenes[0].prompt='big smile';library.scenes=library.scenes.filter(item=>item.id!=='s2');
  const refreshed=core.refreshSceneCard(library,'sc1');
  assert.deepEqual(refreshed.changes,[{id:'s1',field:'prompt',before:'smile',after:'big smile'}]);assert.deepEqual(refreshed.missing,['s2']);
  assert.deepEqual(refreshed.card.chunks.map(item=>item.prompt),['big smile','wave']);
  assert.equal(core.normalizePresetLibrary(library).sceneCards[0].chunks[0].prompt,'smile');
  assert.throws(()=>core.refreshSceneCard(library,'nope'),/갱신할 씬/);
});

test('list moves accept the new collections',()=>{
  const library=seed();library.sceneCards.push({id:'sc4',name:'extra',sceneIds:['s1'],chunks:[chunk('s1','smile')]});
  assert.deepEqual(core.moveLibraryItem(library,'sceneCards','sc4',-1).sceneCards.map(item=>item.id),['sc1','sc2','sc4','sc3']);
  assert.deepEqual(core.placeLibraryItem(library,'sceneCards','sc3','sc1').sceneCards.map(item=>item.id),['sc3','sc1','sc2','sc4']);
  assert.equal(core.moveLibraryItem(library,'casts','cast1',1).casts.length,1);
});
