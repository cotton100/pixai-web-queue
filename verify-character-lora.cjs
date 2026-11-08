'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('./pixai-web-queue.user.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const lora=(id='302',versionId='402',weight=.7,triggerWords='character-trigger')=>({id,versionId,name:'Character LoRA',weight,triggerWords});
const meta={appVersion:'character-lora-fixture',exportedAt:'2026-11-07T00:00:00.000Z'};
const options={maxCredits:null,filePrefix:'',repeat:1};
function seed(){
 return {...core.makePresetLibrary(),
  common:{prompt:'quality',negativePrompt:'bad-quality'},
  presets:[{id:'p',name:'Style',model:{id:'101',versionId:'201',name:'Model'},loras:[lora('301','401',.5,'style-trigger')]}],
  characters:[{id:'c',name:'Character',prompt:'character',negativePrompt:'bad-character',defaultPresetId:'p',loras:[lora()]}],
  scenes:[{id:'s',name:'Smile',prompt:'smile',negativePrompt:'bad-smile'}]
 };
}
const recipe=()=>({id:'r',presetId:'p',characterId:'c',sceneIds:['s'],count:1,triggerPosition:'end'});
const select=(...keys)=>({...core.backupSelection(false),...Object.fromEntries(keys.map(key=>[key,true]))});
const nextIds=()=>{let n=0;return()=>`synthetic-import-${++n}`;};

test('character LoRA normalization keeps optional legacy records unchanged and copies new data',()=>{
 const legacy=seed();delete legacy.characters[0].loras;
 const normalized=core.normalizePresetLibrary(legacy);
 assert.equal(Object.hasOwn(normalized.characters[0],'loras'),false);
 const current=seed(),before=copy(current),result=core.normalizePresetLibrary(current);
 assert.deepEqual(result.characters[0].loras,before.characters[0].loras);
 result.characters[0].loras[0].weight=.2;
 assert.deepEqual(current,before);
});

test('character LoRA validation rejects malformed entries and hidden extra data',()=>{
 assert.equal(typeof core.normalizeCharacterLoras,'function');
 for(const bad of [null,{},'302',[{...lora(),weight:NaN}],[{...lora(),weight:Infinity}],[{...lora(),weight:''}],[{...lora(),weight:3}],[{...lora(),id:'not-numeric'}],[{...lora(),triggerWords:[]}],[{...lora(),apiKey:'must-not-survive'}],[lora(),lora()]]){
  assert.throws(()=>core.normalizeCharacterLoras(bad));
 }
 const data=seed();data.characters[0].loras=[{...lora(),apiKey:'must-not-survive'}];
 assert.throws(()=>core.makeSettingsBackup(data,options,meta));
});

test('character and preset LoRAs merge in deterministic order without modifying either input',()=>{
 const preset=[lora('301','401',.5,'style-trigger')],character=[lora()],before=copy({preset,character});
 const result=core.mergeCharacterLoras(preset,character);
 assert.deepEqual(result.loras,[...preset,...character]);assert.deepEqual(result.sources,['preset','character']);assert.deepEqual({preset,character},before);
 result.loras[0].weight=.1;assert.deepEqual({preset,character},before);
 const lib=seed(),effective=core.effectiveCharacterPreset(lib.presets[0],lib.characters[0]);
 assert.equal(effective.model.versionId,'201');assert.deepEqual(effective.loras,[...lib.presets[0].loras,...lib.characters[0].loras]);
});

test('identical character and preset LoRA versions apply once without adding their weights',()=>{
 const item=lora(),other={...item,name:'Same model displayed under another name'};
 const merged=core.mergeCharacterLoras([item],[other]);
 assert.equal(merged.loras.length,1);assert.equal(merged.loras[0].weight,.7);assert.equal(merged.loras[0].name,item.name);assert.deepEqual(merged.sources,['both']);
 assert.equal(core.mergeCharacterLoras([{...item,triggerWords:''}],[{id:item.id,versionId:item.versionId,name:item.name,weight:item.weight}]).loras.length,1);
});

test('character LoRA conflicts never silently sum, overwrite or mix versions',()=>{
 const item=lora();
 for(const incoming of [{...item,weight:.8},{...item,triggerWords:'another-trigger'},{...item,versionId:'499'},{...item,id:'399'}]){
  assert.throws(()=>core.mergeCharacterLoras([item],[incoming]),/LoRA|로라|중복|충돌|버전/);
 }
 const noVersion={id:'303',name:'Old LoRA',weight:.5};
 assert.equal(core.mergeCharacterLoras([noVersion],[{...noVersion}]).loras.length,1);
 assert.throws(()=>core.mergeCharacterLoras([noVersion],[{...noVersion,versionId:'403'}]));
});

test('live composition includes both trigger lists at the existing user-selected position',()=>{
 const lib=seed(),preset=lib.presets[0],character=lib.characters[0];
 const end=core.composePresetPrompts(lib.common,character,lib.scenes,preset,'end',{scene:{prompt:'scene-extra',negativePrompt:'scene-negative'}});
 assert.equal(end.prompt,'quality, character, smile, scene-extra, style-trigger, character-trigger');
 assert.equal(end.negativePrompt,'bad-quality, bad-character, bad-smile, scene-negative');
 const early=core.composePresetPrompts(lib.common,character,lib.scenes,preset,1);
 assert.equal(early.prompt,'quality, style-trigger, character-trigger, character, smile');
});

test('unfrozen reservations carry character LoRA versions and weights into final API configuration',()=>{
 const lib=seed();lib.reservations=[recipe()];
 const job=core.expandPresetReservations(lib)[0];
 assert.deepEqual(job.configuration.loras,[...lib.presets[0].loras,...lib.characters[0].loras]);
 assert.equal(job.prompt,'quality, character, smile, style-trigger, character-trigger');
 const payload=core.buildApiPayload(job,{},4,77);
 assert.deepEqual(payload.loras.map(item=>[item.modelId,item.weight]),[['401',.5],['402',.7]]);
});

test('new snapshots freeze the merged LoRAs once and remain unchanged after live character edits',()=>{
 const lib=seed(),entry=recipe(),snapshot=core.snapshotCombination(lib,entry);
 assert.deepEqual(snapshot.preset.loras,[...lib.presets[0].loras,...lib.characters[0].loras]);
 assert.equal(Object.hasOwn(snapshot.character,'loras'),false);
 lib.reservations=[{...entry,snapshot}];
 const before=core.expandPresetReservations(lib);
 lib.characters[0].loras=[lora('399','499',.2,'changed-character-trigger')];
 lib.presets[0].loras[0].weight=.9;lib.presets[0].loras[0].triggerWords='changed-style-trigger';
 const after=core.expandPresetReservations(lib);
 assert.deepEqual(after.map(job=>[job.prompt,job.negativePrompt,job.configuration]),before.map(job=>[job.prompt,job.negativePrompt,job.configuration]));
 assert.equal(after[0].configuration.loras.length,2);
});

test('old snapshots do not acquire newly attached live character LoRAs',()=>{
 const lib=seed();delete lib.characters[0].loras;
 const entry=recipe();lib.reservations=[{...entry,snapshot:core.snapshotCombination(lib,entry)}];
 lib.characters[0].loras=[lora()];
 const job=core.expandPresetReservations(lib)[0];
 assert.deepEqual(job.configuration.loras,lib.presets[0].loras);
 assert.equal(job.prompt,'quality, character, smile, style-trigger');
});

test('batch character rows freeze their own LoRAs while reusing the same style preset',()=>{
 const lib=seed();lib.characters.push({...copy(lib.characters[0]),id:'c2',name:'Second',loras:[lora('303','403',.6,'second-trigger')]});
 lib.sceneCards=[core.makeSceneCard(lib,{id:'card',name:'Scene',sceneIds:['s']})];
 const result=core.expandBatchPlan(lib,{id:'batch',rows:[{kind:'character',id:'c'},{kind:'character',id:'c2'}],columns:['card'],count:1},{idFactory:nextIds()});
 assert.equal(result.reservations.length,2);assert(!result.problems.some(problem=>problem.level==='error'));
 const jobs=core.expandPresetReservations(core.appendBatchReservations(lib,result));
 assert.deepEqual(jobs.map(job=>job.configuration.loras.map(item=>item.versionId)),[['401','402'],['401','403']]);
 assert(jobs[0].prompt.includes('character-trigger'));assert(!jobs[0].prompt.includes('second-trigger'));
 assert(jobs[1].prompt.includes('second-trigger'));assert(!jobs[1].prompt.includes('character-trigger'));
 assert(result.reservations.every(item=>!Object.hasOwn(item.snapshot.character,'loras')));
});

test('full and app-compatible backups preserve character LoRA data and frozen final requests',()=>{
 const lib=seed(),entry=recipe();lib.reservations=[{...entry,snapshot:core.snapshotCombination(lib,entry)}];
 const before=core.expandPresetReservations(lib).map(job=>[job.prompt,job.negativePrompt,job.configuration]);
 for(const file of [core.makeSettingsBackup(lib,options,meta),core.compatibleSettings(lib,options,meta,'app').backup]){
  const parsed=core.parseSettingsBackup(JSON.stringify(file)).library;
  assert.deepEqual(parsed.characters[0].loras,lib.characters[0].loras);
  assert.deepEqual(core.expandPresetReservations(parsed).map(job=>[job.prompt,job.negativePrompt,job.configuration]),before);
 }
});

test('selective character export and append keep LoRAs, default preset links and original materials',()=>{
 const incoming=seed(),selection=select('characters'),file=core.makeTransferBackup(incoming,options,selection,meta);
 assert.deepEqual(file.backup.library.characters[0].loras,incoming.characters[0].loras);
 const original=seed(),before=copy(original),transfer=core.parseTransferBackup(JSON.stringify(file));
 const result=core.prepareBackupImport(original,transfer,selection,'append',nextIds());
 assert.deepEqual(original,before);assert.deepEqual(result.library.characters[0],before.characters[0]);
 const added=result.library.characters.find(item=>item.id!=='c');
 assert(added);assert.deepEqual(added.loras,incoming.characters[0].loras);
 assert.notEqual(added.defaultPresetId,'p');assert(result.library.presets.some(item=>item.id===added.defaultPresetId));
 assert.equal(result.options,undefined);assert.equal(file.selection.presets,false);
});

test('legacy export explicitly refuses attached character LoRAs instead of discarding them',()=>{
 const lib=seed(),entry=recipe();lib.reservations=[{...entry,snapshot:core.snapshotCombination(lib,entry)}];
 assert.throws(()=>core.compatibleSettings(lib,options,meta,'legacy'),/캐릭터|LoRA|로라|구형|호환/i);
});

for(const count of [10,15])test(`API payload preserves all ${count} combined LoRAs without local count filtering`,()=>{
 const lib=seed();lib.presets[0].loras=Array.from({length:9},(_,index)=>lora(String(1000+index),String(2000+index),.5,'style-'+index));
 lib.characters[0].loras=Array.from({length:count-9},(_,index)=>lora(String(1100+index),String(2100+index),.7,'character-'+index));
 const entry=recipe();lib.reservations=[{...entry,snapshot:core.snapshotCombination(lib,entry)}];
 const job=core.expandPresetReservations(lib)[0],before=copy(job),payload=core.buildApiPayload(job,{},4,77);
 assert.equal(payload.loras.length,count);assert.deepEqual(payload.loras.map(item=>item.modelId),[...lib.presets[0].loras,...lib.characters[0].loras].map(item=>item.versionId));
 assert.deepEqual(payload.loras.map(item=>item.weight),[...Array(9).fill(.5),...Array(count-9).fill(.7)]);assert.deepEqual(job,before);
});

test('sixteen combined LoRAs survive storage, editing, reservation snapshots and API payload creation without truncation',()=>{
 const lib=seed();lib.presets[0].loras=Array.from({length:9},(_,index)=>lora(String(1000+index),String(2000+index),.5,'style-'+index));
 lib.characters[0].loras=Array.from({length:7},(_,index)=>lora(String(1100+index),String(2100+index),.7,'character-'+index));
 const restored=core.decodeLocalPresetLibrary(core.encodeLocalPresetLibrary(core.normalizePresetLibrary(lib)));
 restored.characters[0].name='Edited character';restored.characters[0].loras[6].weight=.6;
 const edited=core.decodeLocalPresetLibrary(core.encodeLocalPresetLibrary(restored)),entry=recipe();edited.reservations=[{...entry,snapshot:core.snapshotCombination(edited,entry)}];
 const job=core.expandPresetReservations(edited)[0],before=copy(job);
 assert.equal(edited.characters[0].name,'Edited character');assert.equal(job.configuration.loras.length,16);assert.equal(job.configuration.loras[15].weight,.6);
 const payload=core.buildApiPayload(job,{},4,77);
 assert.equal(payload.loras.length,16);assert.deepEqual(payload.loras.map(item=>item.modelId),job.configuration.loras.map(item=>item.versionId));
 assert.deepEqual(payload.loras.map(item=>item.weight),job.configuration.loras.map(item=>item.weight));assert.equal(payload.loras[15].weight,.6);assert.deepEqual(job,before);
});

test('out-of-API-range character LoRA weights can be kept in storage but are rejected before submission',()=>{
 const overweight=seed();overweight.characters[0].loras[0].weight=1.5;overweight.reservations=[recipe()];
 const stored=core.normalizePresetLibrary(overweight);assert.equal(stored.characters[0].loras[0].weight,1.5);
 const overweightJob=core.expandPresetReservations(stored)[0];
 assert.throws(()=>core.buildApiPayload(overweightJob,{},4,77),/수치|weight|0.*1/);
});

test('backups reject ambiguous character LoRAs inside already-resolved reservation snapshots',()=>{
 const lib=seed(),entry=recipe();lib.reservations=[{...entry,snapshot:core.snapshotCombination(lib,entry)}];
 const backup=core.makeSettingsBackup(lib,options,meta);
 backup.library.reservations[0].snapshot.character.loras=[lora()];
 assert.throws(()=>core.parseSettingsBackup(JSON.stringify(backup)),/사본|예약|LoRA|로라|캐릭터/);
});

test('preset-only saved settings retain prior behavior when no character LoRA is attached',()=>{
 const lib=seed();delete lib.characters[0].loras;
 lib.presets[0].loras=[lora('301','401',.5,'one'),lora('303','401',.6,'two')];
 assert.deepEqual(core.mergeCharacterLoras(lib.presets[0].loras).sources,['preset','preset']);
 lib.reservations=[recipe()];const job=core.expandPresetReservations(lib)[0];
 assert.equal(job.configuration.loras.length,2);
 assert.throws(()=>core.buildApiPayload(job,{},4,77),/버전.*중복/);
});

test('image import keeps the effective character LoRA when model settings are not replaced',()=>{
 const lib=seed(),source=recipe(),result=core.importImageComposition(lib,source,{negativePrompt:'new negative'},{negativePrompt:true},{idFactory:nextIds()});
 const p=result.library.presets.find(item=>item.id===result.recipe.presetId);
 const c=result.library.characters.find(item=>item.id===result.recipe.characterId);
 const chunks=result.library.scenes.filter(item=>result.recipe.sceneIds.includes(item.id));
 assert.deepEqual(p.loras.map(item=>item.versionId),['401','402']);
 assert(!Object.hasOwn(c,'loras'));
 const prompts=core.composePresetPrompts(core.resolvePresetCommon(result.library,p),c,chunks,p,'end');
 assert.equal(prompts.prompt,'quality, character, smile, style-trigger, character-trigger');
 assert.equal(prompts.negativePrompt,'new negative');
});

test('full image replacement can repair a composition whose old character LoRA conflicts',()=>{
 const lib=seed();lib.characters[0].loras=[{...lib.presets[0].loras[0],weight:.2}];
 const result=core.importImageComposition(lib,recipe(),{modelId:'101',modelVersionId:'201',loras:[],prompt:'imported',negativePrompt:'imported negative'},{model:true,prompt:true,negativePrompt:true},{idFactory:nextIds()});
 assert.equal(result.library.scenes.at(-1).prompt,'imported');
 assert.deepEqual(result.library.presets.at(-1).loras,[]);
});

test('local storage prevents older library readers from stripping character LoRAs while transferable backups stay v1',()=>{
 const lib=seed(),protectedRaw=core.encodeLocalPresetLibrary(lib),stored=JSON.parse(protectedRaw);
 assert.equal(stored.version,2);assert.equal(stored.library.version,1);
 assert.throws(()=>core.normalizePresetLibrary(stored),/버전/);
 assert.deepEqual(core.decodeLocalPresetLibrary(protectedRaw).characters[0].loras,[lora()]);
 assert.equal(core.makeSettingsBackup(lib,options,meta).library.version,1);
 delete lib.characters[0].loras;
 assert.equal(JSON.parse(core.encodeLocalPresetLibrary(lib)).version,1);
 assert(!Object.hasOwn(core.decodeLocalPresetLibrary(JSON.stringify(lib)).characters[0],'loras'));
 assert.throws(()=>core.decodeLocalPresetLibrary(JSON.stringify({...stored,other:true})));
});

test('legacy export omits an empty optional character LoRA field',()=>{
 const lib=seed();lib.characters[0].loras=[];
 const backup=core.compatibleSettings(lib,options,meta,'legacy').backup;
 assert(!Object.hasOwn(backup.library.characters[0],'loras'));
});
