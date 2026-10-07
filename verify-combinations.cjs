'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('./pixai-web-queue.user.js');
const seed=()=>({version:1,common:{prompt:'quality',negativePrompt:'lowres'},presets:[{id:'p',name:'P',model:{id:'1',versionId:'2',name:'M'},loras:[]}],characters:[{id:'c',name:'C',prompt:'character',negativePrompt:''}],scenes:[{id:'s',name:'S',prompt:'smile',negativePrompt:''}],reservations:[]});
const combo=(i=0)=>({presetId:'p',characterId:'c',sceneIds:[`s${i}`],count:1});
test('recent limit preserves every favorite and deduplication keeps its identity, name and new count',()=>{
  let library=seed(),seq=0;const options={idFactory:()=>`entry-${++seq}`,now:0};
  library=core.rememberCombination(library,combo(0),{...options,favorite:true});const id=library.combinations[0].id;library.combinations[0].name='Favorite';
  for (let i=1;i<=65;i++) library=core.rememberCombination(library,combo(i),options);
  assert.equal(library.combinations.length,51);assert.equal(library.combinations.filter(item=>!item.favorite).length,50);assert.equal(library.combinations.find(item=>item.id===id).name,'Favorite');
  library=core.rememberCombination(library,{...combo(0),count:4},{...options,now:10});assert.equal(library.combinations[0].id,id);assert.equal(library.combinations[0].favorite,true);assert.equal(library.combinations[0].count,4);assert.equal(library.combinations[0].name,'Favorite');
});
test('invalid history flags, duplicate identities, counts and timestamps are rejected without coercion',()=>{
  const original=core.rememberCombination(seed(),combo(),{idFactory:()=> 'record',now:1});
  for (const patch of [{favorite:'true'},{sceneIds:['s','s']},{count:0},{at:-1},{presetId:''}]) {const lib=structuredClone(original);Object.assign(lib.combinations[0],patch);assert.throws(()=>core.normalizePresetLibrary(lib));}
  const duplicate=structuredClone(original);duplicate.combinations.push(duplicate.combinations[0]);assert.throws(()=>core.normalizePresetLibrary(duplicate),/중복/);
});
test('frozen reservation identity and unknown backup properties are rejected; legacy backups remain compatible',()=>{
  const lib=seed(),recipe={presetId:'p',characterId:'c',sceneIds:['s'],count:1};lib.reservations=[{id:'r',...recipe,snapshot:core.snapshotCombination(lib,recipe)}];
  const normalized=core.parseSettingsBackup(JSON.stringify(lib)).library;assert.equal(normalized.reservations[0].snapshot.chunks[0].prompt,'smile');
  const mismatch=structuredClone(lib);mismatch.reservations[0].sceneIds=[];assert.throws(()=>core.normalizePresetLibrary(mismatch),/사본/);
  const unknown=structuredClone(lib);unknown.reservations[0].snapshot.preset.model.cookie='forbidden';assert.throws(()=>core.parseSettingsBackup(JSON.stringify(unknown)),/필수 항목|속성|필드|허용/);
  assert.deepEqual(core.parseSettingsBackup(JSON.stringify(seed())).library,core.normalizePresetLibrary(seed()));
});
test('library management retains saved records and immutable reservation ingredients',()=>{
  let lib=core.rememberCombination(seed(),{presetId:'p',characterId:'c',sceneIds:['s'],count:1},{idFactory:()=> 'record',now:1});
  lib.reservations=[{id:'r',presetId:'p',characterId:'c',sceneIds:['s'],count:1,snapshot:core.snapshotCombination(lib,{presetId:'p',characterId:'c',sceneIds:['s'],count:1})}];
  const frozen=structuredClone(lib.reservations);lib=core.createChunkFolder(lib,'Folder',['s'],()=> 'folder');lib=core.duplicateChunks(lib,['s'],()=> 'copy');lib=core.removeChunks(lib,['s']);
  assert.deepEqual(lib.reservations,frozen);assert.equal(lib.combinations[0].id,'record');assert.deepEqual(core.resolveCombination(lib,lib.combinations[0]).missing,['청크 s']);
});

test('trigger placement changes only the positive prompt and retains the legacy default',()=>{
  const lib=seed();lib.presets[0].loras=[{id:'3',weight:0.5,triggerWords:'style, (detail:1.2)'},{id:'4',weight:1,triggerWords:'outfit'}];lib.scenes.push({id:'s2',name:'S2',prompt:'wave',negativePrompt:'still'});
  const args=[lib.common,lib.characters[0],lib.scenes,lib.presets[0]],cases=[[0,'style, (detail:1.2), outfit, quality, character, smile, wave'],[1,'quality, style, (detail:1.2), outfit, character, smile, wave'],[2,'quality, character, style, (detail:1.2), outfit, smile, wave'],[3,'quality, character, smile, style, (detail:1.2), outfit, wave'],['end','quality, character, smile, wave, style, (detail:1.2), outfit']];
  for(const [position,prompt] of cases){const result=core.composePresetPrompts(...args,position);assert.equal(result.prompt,prompt);assert.equal(result.negativePrompt,'lowres, still');}
  assert.equal(core.composePresetPrompts(...args).prompt,cases[1][1]);
  for(const bad of [-1,5,'3',null,1.5])assert.throws(()=>core.composePresetPrompts(...args,bad),/트리거 위치/);
});

test('position survives frozen reservations, history identities and backups; legacy recipes keep their old placement',()=>{
  const lib=seed();lib.presets[0].loras=[{id:'3',weight:1,triggerWords:'trigger'}];const recipe={presetId:'p',characterId:'c',sceneIds:['s'],count:1,triggerPosition:'end'};
  let remembered=core.rememberCombination(lib,recipe,{idFactory:()=> 'end',now:1,favorite:true});remembered=core.rememberCombination(remembered,{...recipe,triggerPosition:0},{idFactory:()=> 'start',now:2});assert.equal(remembered.combinations.length,2);
  remembered.reservations=[{id:'r',...recipe,snapshot:core.snapshotCombination(lib,recipe)},{id:'legacy',presetId:'p',characterId:'c',sceneIds:['s'],count:1}];
  remembered.common.prompt='new quality';remembered.presets[0].loras[0].triggerWords='new trigger';
  const restored=core.parseSettingsBackup(JSON.stringify(core.makeSettingsBackup(remembered,{maxCredits:null,filePrefix:'',repeat:1},{appVersion:'0.8.4',exportedAt:'2026-10-08T00:00:00.000Z'}))).library;
  const jobs=core.expandPresetReservations(restored,{idFactory:(()=>{let n=0;return()=>String(++n);})()});assert.equal(jobs[0].prompt,'quality, character, smile, trigger');assert.equal(jobs[1].prompt,'new quality, new trigger, character, smile');
  assert.equal(core.resolveCombination(restored,restored.combinations.find(c=>c.id==='end')).triggerPosition,'end');
  for(const bad of [-1,4,'last',null]){const broken=structuredClone(restored);broken.reservations[0].triggerPosition=bad;assert.throws(()=>core.parseSettingsBackup(JSON.stringify(broken)),/트리거 위치/);}
  const deleted=structuredClone(restored);deleted.scenes=[];const resolved=core.resolveCombination(deleted,{...recipe,triggerPosition:3});assert.equal(resolved.triggerPosition,2);assert.deepEqual(resolved.missing,['청크 s']);
});
