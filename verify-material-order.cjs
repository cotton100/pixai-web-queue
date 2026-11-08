'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('./pixai-web-queue.user.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const order=['chunk:s1','common','chunk:s2','character'];
const images={aspectRatio:'5:3',size:'1k',mode:'',batchSize:4};
const options={maxCredits:null,filePrefix:'',repeat:1};
const meta={appVersion:'0.10.22',exportedAt:'2026-11-08T00:00:00.000Z'};
const recipe=()=>({presetId:'p',characterId:'c',sceneIds:['s1','s2'],count:1,triggerPosition:1,imageOptions:{...images},materialOrder:[...order]});
function library(){
  return core.normalizePresetLibrary({version:1,common:{prompt:'global',negativePrompt:'bad-global'},
    presets:[{id:'p',name:'Preset',model:{id:'101',versionId:'201',name:'Model'},loras:[{id:'301',versionId:'401',name:'Lora',weight:.5,triggerWords:'trigger'}],prompt:'preset',negativePrompt:'bad-preset'}],
    characters:[{id:'c',name:'Character',prompt:'character',negativePrompt:'bad-character'}],
    scenes:[{id:'s1',name:'First',prompt:'first',negativePrompt:'bad-first'},{id:'s2',name:'Second',prompt:'second',negativePrompt:'bad-second'}],reservations:[]});
}
function reserved(){const result=library(),value=recipe();result.reservations=[{id:'r',...value,snapshot:core.snapshotCombination(result,value)}];return result;}
function compose(value,position=1,extra={}){return core.composePresetPrompts(value.common,value.characters[0],value.scenes,value.presets[0],position,extra,{materialOrder:order,sceneIds:['s1','s2']});}

test('material order requires all materials once and agrees with chunk IDs',()=>{
  assert.deepEqual(core.normalizeMaterialOrder(undefined,['s1','s2']),['common','character','chunk:s1','chunk:s2']);
  assert.deepEqual(core.normalizeMaterialOrder(order,['s1','s2']),order);
  for(const value of [null,[],['common','character'],['common','common','chunk:s1','chunk:s2'],['character','common','chunk:s2','chunk:s1'],['common','character','chunk:missing','chunk:s2'],[...order,'triggers']])assert.throws(()=>core.normalizeMaterialOrder(value,['s1','s2']),/재료 순서/);
});

test('free material order keeps semantic trigger anchors and orders both prompt types',()=>{
  const value=library(),extras={cast:{prompt:'cast',negativePrompt:'bad-cast'},scene:{prompt:'suffix',negativePrompt:'bad-suffix'}};
  const expected=[
    [0,'trigger, first, global, preset, second, character, cast, suffix'],
    [1,'first, global, preset, trigger, second, character, cast, suffix'],
    [2,'first, global, preset, second, character, cast, trigger, suffix'],
    [3,'first, trigger, global, preset, second, character, cast, suffix'],
    [4,'first, global, preset, second, trigger, character, cast, suffix'],
    ['end','first, global, preset, second, character, cast, suffix, trigger']
  ];
  for(const [position,prompt] of expected){const result=compose(value,position,extras);assert.equal(result.prompt,prompt);assert.equal(result.negativePrompt,'bad-first, bad-global, bad-preset, bad-second, bad-character, bad-cast, bad-suffix');}
});

test('explicit default order is byte identical to legacy output and conflicts never silently fall back',()=>{
  const value=library(),args=[value.common,value.characters[0],value.scenes,value.presets[0]];
  for(const anchor of [0,1,2,3,4,'end'])assert.deepEqual(core.composePresetPrompts(...args,anchor,{}, {materialOrder:core.normalizeMaterialOrder(undefined,['s1','s2']),sceneIds:['s1','s2']}),core.composePresetPrompts(...args,anchor));
  assert.throws(()=>core.composePresetPrompts(...args,1,{}, {materialOrder:order}),/청크 ID/);
  assert.throws(()=>core.composePresetPrompts(...args,1,{}, {materialOrder:order,sceneIds:['s1','s2'],promptOrder:['character','scene','extraChunks']}),/동시에/);
  const frozen=reserved();frozen.reservations[0].snapshot.promptOrder=['character','scene','extraChunks'];assert.throws(()=>core.normalizePresetLibrary(frozen),/동시에/);
});

test('draft normalizer preserves legacy absence and explicit custom order including cleared chunks',()=>{
  const legacy=recipe();delete legacy.materialOrder;assert.deepEqual(core.normalizeComposeDraft(legacy),legacy);
  assert.deepEqual(core.normalizeComposeDraft(recipe()),recipe());
  const empty={...recipe(),presetId:'',characterId:'',sceneIds:[],triggerPosition:'end',materialOrder:['character','common']};assert.deepEqual(core.normalizeComposeDraft(empty),empty);
  for(const invalid of [{...recipe(),sceneIds:[]},{...recipe(),materialOrder:['common','character','chunk:s2','chunk:s1']},{...recipe(),count:''}])assert.throws(()=>core.normalizeComposeDraft(invalid));
});

test('full backup and local v3 retain frozen reservations favorites and payload order',()=>{
  const value=reserved();value.combinations=[{id:'fav',...recipe(),favorite:true,name:'Ordered',at:1}];
  const normalized=core.normalizePresetLibrary(value),backup=core.makeSettingsBackup(value,options,meta);
  assert.deepEqual(core.parseSettingsBackup(JSON.stringify(backup)).library,normalized);
  const encoded=core.encodeLocalPresetLibrary(value);assert.equal(JSON.parse(encoded).version,3);assert.deepEqual(core.decodeLocalPresetLibrary(encoded),normalized);
  assert.throws(()=>core.normalizePresetLibrary(JSON.parse(encoded)),/버전/);
  const before=core.expandPresetReservations(value)[0];value.common.prompt='edited';value.presets[0].prompt='edited preset';value.scenes[0].prompt='edited first';
  const after=core.expandPresetReservations(core.decodeLocalPresetLibrary(core.encodeLocalPresetLibrary(value)))[0];assert.equal(after.prompt,before.prompt);assert.equal(after.negativePrompt,before.negativePrompt);assert.deepEqual(after.composition.reservation.materialOrder,order);
  const restored=copy(after);core.recover([restored]);const payload=core.buildApiPayload(restored,{},4,42);assert.equal(payload.prompt,'first, global, preset, trigger, second, character');assert.equal(payload.negativePrompt,before.negativePrompt);assert.equal(payload.batchSize,4);assert.equal(payload.loras[0].triggerWords,'');
});

test('full backup rejects malformed order in reservations or history',()=>{
  for(const collection of ['reservations','combinations']){
    const value=reserved();value.combinations=[{id:'fav',...recipe(),favorite:true,name:'Ordered',at:1}];
    const backup=core.makeSettingsBackup(value,options,meta);backup.library[collection][0].materialOrder=['common','character','chunk:s2','chunk:s1'];assert.throws(()=>core.parseSettingsBackup(JSON.stringify(backup)),/재료 순서/);
  }
});

test('recent and favorite identity distinguishes custom order and treats absent default equally',()=>{
  let serial=0;const save=(value,input,favorite=false)=>core.rememberCombination(value,input,{favorite,idFactory:()=>`history-${++serial}`,now:serial});
  const normal=recipe();delete normal.materialOrder;let value=save(library(),normal,true);const first=value.combinations[0].id;
  value=save(value,{...normal,materialOrder:core.normalizeMaterialOrder(undefined,normal.sceneIds)});assert.equal(value.combinations.length,1);assert.equal(value.combinations[0].id,first);assert.equal(value.combinations[0].favorite,true);
  value=save(value,recipe());assert.equal(value.combinations.length,2);assert.deepEqual(value.combinations[0].materialOrder,order);assert.notEqual(value.combinations[0].id,first);
});

test('loading a history item removes only deleted chunk tokens and preserves end trigger',()=>{
  const value=library();value.scenes=value.scenes.filter(item=>item.id!=='s1');const resolved=core.resolveCombination(value,{...recipe(),triggerPosition:'end'});
  assert.deepEqual(resolved.sceneIds,['s2']);assert.deepEqual(resolved.materialOrder,['common','chunk:s2','character']);assert.equal(resolved.triggerPosition,'end');assert.deepEqual(resolved.missing,['청크 s1']);
  assert.throws(()=>core.snapshotCombination(value,recipe()),/재료가 없습니다/);
});

for(const [label,removed,anchor,expectedAnchor,prompt] of [
  ['chunk before a surviving trigger anchor','s1',4,3,'global, preset, second, trigger, character, third'],
  ['anchored chunk itself','s2',4,1,'first, global, preset, trigger, character, third'],
  ['first anchored material','s1',3,0,'trigger, global, preset, second, character, third'],
  ['chunk before an explicit end trigger','s1','end','end','global, preset, second, character, third, trigger']
])test(`restoring a draft or favorite keeps visible trigger position when removing ${label}`,()=>{
  const value=library();value.scenes.push({id:'s3',name:'Third',prompt:'third',negativePrompt:''});
  const saved={...recipe(),sceneIds:['s1','s2','s3'],materialOrder:['chunk:s1','common','chunk:s2','character','chunk:s3'],triggerPosition:anchor};
  const draft=core.normalizeComposeDraft(saved);value.scenes=value.scenes.filter(item=>item.id!==removed);
  const resolved=core.resolveCombination(value,draft);assert.equal(resolved.triggerPosition,expectedAnchor);
  const chunks=resolved.sceneIds.map(id=>value.scenes.find(item=>item.id===id));
  assert.equal(core.composePresetPrompts(value.common,value.characters[0],chunks,value.presets[0],resolved.triggerPosition,{}, {materialOrder:resolved.materialOrder,sceneIds:resolved.sceneIds}).prompt,prompt);
  assert.deepEqual(saved.materialOrder,['chunk:s1','common','chunk:s2','character','chunk:s3']);
});

test('legacy history also keeps surviving chunk trigger anchor after an earlier chunk is deleted',()=>{
  const value=library();value.scenes.push({id:'s3',name:'Third',prompt:'third',negativePrompt:''});value.scenes=value.scenes.filter(item=>item.id!=='s1');
  const saved={...recipe(),sceneIds:['s1','s2','s3'],triggerPosition:4};delete saved.materialOrder;
  const resolved=core.resolveCombination(value,saved);assert.equal(resolved.triggerPosition,3);assert.equal(Object.hasOwn(resolved,'materialOrder'),false);
});

test('selected append remaps material tokens together with scene and snapshot IDs',()=>{
  const value=reserved();value.combinations=[{id:'fav',...recipe(),favorite:true,name:'Ordered',at:1}];const selection={...core.backupSelection(false),reservations:true,combinations:true};
  const parsed=core.parseTransferBackup(JSON.stringify(core.makeTransferBackup(value,options,selection,meta)));let sequence=0;
  const next=core.prepareBackupImport(library(),parsed,selection,'append',()=>`mapped-${++sequence}`).library;
  for(const item of [...next.reservations,...next.combinations])assert.deepEqual(item.materialOrder,[`chunk:${item.sceneIds[0]}`,'common',`chunk:${item.sceneIds[1]}`,'character']);
  assert.notEqual(next.reservations[0].sceneIds[0],'s1');assert.equal(core.expandPresetReservations(next)[0].prompt,core.expandPresetReservations(value)[0].prompt);assert.deepEqual(next.reservations[0].snapshot.chunks.map(item=>item.id),next.reservations[0].sceneIds);
});

test('library sync leaves local reservation and history order with frozen text intact',()=>{
  const value=library();value.reservations=[{id:'r',...recipe()}];value.combinations=[{id:'fav',...recipe(),favorite:true,name:'Ordered',at:1}];const before=core.expandPresetReservations(value)[0];
  const incoming=library();incoming.common.prompt='remote';incoming.scenes[0].prompt='remote chunk';const result=core.applySyncLibrary(value,core.projectSyncLibrary(incoming));
  assert.deepEqual(result.reservations[0].materialOrder,order);assert.deepEqual(result.combinations[0].materialOrder,order);assert.equal(core.expandPresetReservations(result)[0].prompt,before.prompt);assert.equal(result.common.prompt,'remote');
  const projected=core.projectSyncLibrary(result);assert.equal(projected.reservations,undefined);assert.equal(projected.combinations,undefined);assert(!JSON.stringify(projected).includes('materialOrder'));
});

test('latest app export preserves order while legacy export explicitly excludes incompatible items',()=>{
  const value=reserved();value.reservations.push({...value.reservations[0],id:'default',materialOrder:core.normalizeMaterialOrder(undefined,['s1','s2'])});value.combinations=value.reservations.map(({snapshot,...item})=>({...item,id:`comb-${item.id}`,favorite:true,name:'Saved',at:1}));
  const latest=core.compatibleSettings(value,options,meta,'app');assert.deepEqual(latest.backup.library.reservations[0].materialOrder,order);assert(latest.warnings.some(line=>line.includes('0.1.25')));
  const legacy=core.compatibleSettings(value,options,meta,'legacy');assert.deepEqual(legacy.backup.library.reservations.map(item=>item.id),['default']);assert.deepEqual(legacy.backup.library.combinations.map(item=>item.id),['comb-default']);assert(!JSON.stringify(legacy.backup).includes('materialOrder'));assert(legacy.warnings.some(line=>line.includes('최근 조합·즐겨찾기 1개')));assert(legacy.warnings.some(line=>line.includes('예약 1개')));assert.doesNotThrow(()=>core.parseSettingsBackup(JSON.stringify(legacy.backup)));
});

test('partial image information import retains the current ordered prompt when replacing only negative text',()=>{
  const value=library(),input=recipe();let serial=0;const result=core.importImageComposition(value,input,{negativePrompt:'replacement-negative'},{negativePrompt:true},{idFactory:()=>`image-${++serial}`});
  result.library.reservations=[{id:'image-reservation',...result.recipe,snapshot:core.snapshotCombination(result.library,result.recipe)}];const job=core.expandPresetReservations(result.library)[0];assert.equal(job.prompt,compose(value).prompt);assert.equal(job.negativePrompt,'replacement-negative');assert.equal(result.recipe.triggerPosition,'end');
});
