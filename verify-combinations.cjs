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
