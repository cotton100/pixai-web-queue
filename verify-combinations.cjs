'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('./pixai-web-queue.user.js');
const seed=()=>({version:1,common:{prompt:'quality',negativePrompt:'lowres'},presets:[{id:'p',name:'P',model:{id:'1',versionId:'2',name:'M'},loras:[]}],characters:[{id:'c',name:'C',prompt:'character',negativePrompt:''}],scenes:[{id:'s',name:'S',prompt:'smile',negativePrompt:''}],reservations:[]});
const combo=(i=0)=>({presetId:'p',characterId:'c',sceneIds:[`s${i}`],count:1});

test('reservation image settings require supported dimensions and reject missing, unknown and secret fields',()=>{
  const valid={aspectRatio:'5:3',size:'1.5k'};
  assert.deepEqual(core.normalizeReservationImageOptions(valid),valid);
  for(const value of [null,[],{}, {aspectRatio:'5:3'}, {aspectRatio:'7:2',size:'1k'}, {aspectRatio:'5:3',size:'4k'}, {aspectRatio:null,size:'1k'}, {...valid,apiKey:'fixture-key'}, {...valid,mode:'pro'}]) assert.throws(()=>core.normalizeReservationImageOptions(value));
});

test('image settings distinguish recent recipes and favorites while preserving deduplication identity',()=>{
  const recipe={presetId:'p',characterId:'c',sceneIds:['s'],count:1};let id=0;
  let library=core.rememberCombination(seed(),{...recipe,imageOptions:{aspectRatio:'5:3',size:'1.5k'}},{favorite:true,idFactory:()=>`r${++id}`,now:1});
  library.combinations[0].name='Landscape';const favoriteId=library.combinations[0].id;
  library=core.rememberCombination(library,{...recipe,imageOptions:{aspectRatio:'3:5',size:'1k'}},{idFactory:()=>`r${++id}`,now:2});
  library=core.rememberCombination(library,recipe,{idFactory:()=>`r${++id}`,now:3});assert.equal(library.combinations.length,3);
  library=core.rememberCombination(library,{...recipe,count:3,imageOptions:{size:'1.5k',aspectRatio:'5:3'}},{now:4});
  assert.equal(library.combinations.length,3);assert.equal(library.combinations[0].id,favoriteId);assert.equal(library.combinations[0].name,'Landscape');assert.equal(library.combinations[0].favorite,true);assert.equal(library.combinations[0].count,3);
});

test('per-reservation images survive settings and queue backups and repeat expansion without affecting legacy recipes',()=>{
  const library=seed(),recipe={presetId:'p',characterId:'c',sceneIds:['s'],count:2};
  library.reservations=[{id:'r1',...recipe,imageOptions:{aspectRatio:'5:3',size:'1.5k'},snapshot:core.snapshotCombination(library,recipe)},{id:'r2',...recipe,count:1}];
  let recorded=core.rememberCombination(library,library.reservations[0],{favorite:true,idFactory:()=> 'favorite',now:1});
  const options={maxCredits:7800,filePrefix:'test',repeat:1,api:core.normalizeApiOptions({aspectRatio:'3:5'})};
  const restored=core.parseSettingsBackup(JSON.stringify(core.makeSettingsBackup(recorded,options,{appVersion:'0.9.10',exportedAt:'2026-10-09T00:00:00.000Z'})));
  assert.deepEqual(restored.library,core.normalizePresetLibrary(recorded));let jobId=0;
  const jobs=core.expandPresetReservations(restored.library,{idFactory:()=>`j${++jobId}`});assert.equal(jobs.length,3);
  for(const job of jobs.slice(0,2)){assert.deepEqual(job.apiOptions,{aspectRatio:'5:3',size:'1.5k'});assert.deepEqual(job.composition.reservation.imageOptions,job.apiOptions);}
  assert.equal(Object.hasOwn(jobs[2],'apiOptions'),false);assert.deepEqual(core.parseSettingsBackup(JSON.stringify({version:1,jobs,library:recorded})).library,restored.library);
  const resolved=core.resolveCombination(restored.library,restored.library.combinations[0]);resolved.imageOptions.aspectRatio='1:1';assert.equal(restored.library.combinations[0].imageOptions.aspectRatio,'5:3');
  const bad=structuredClone(recorded);bad.reservations[0].imageOptions.apiKey='forbidden';assert.throws(()=>core.parseSettingsBackup(JSON.stringify(bad)));
});

test('production queue registration merges each reservation image choice with global API options without submitting',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),source=fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8');
  const begin=source.indexOf('      enqueue:value=>queueEdit(()=>{'),end=source.indexOf('\n      })',begin);
  assert(begin>=0&&end>begin);const events=[];
  const context={...core,apiOptions:core.normalizeApiOptions({aspectRatio:'1:1',size:'1k',mode:'pro',style:'chibi',seed:7}),imageCount:{value:'4'},expectedCount:()=>1,budget:{value:''},title:{value:'test'},jobs:[],running:false,stopRequested:false,oneJobRun:false,
    currentApiOptions:()=>context.apiOptions,queueEdit:async fn=>fn(),persist:()=>events.push('persist'),saveLibrary:value=>{context.savedLibrary=value;},presetEditor:{refresh(){}},render(){},message:''};
  vm.runInNewContext(`const callback={${source.slice(begin,end+9).trim()}};this.enqueue=callback.enqueue;`,context);
  const library=seed(),recipe={presetId:'p',characterId:'c',sceneIds:['s'],count:1};
  library.reservations=[{id:'wide',...recipe,imageOptions:{aspectRatio:'5:3',size:'1.5k'}},{id:'tall',...recipe,imageOptions:{aspectRatio:'3:5',size:'1k'}},{id:'legacy',...recipe}];
  await context.enqueue(library);assert.equal(context.jobs.length,3);assert.equal(events.length,1);assert.equal(context.savedLibrary.reservations.length,0);
  const payloads=context.jobs.map(job=>core.buildApiPayload(job,job.apiOptions,job.apiBatchSize,999));
  assert.deepEqual(payloads.map(payload=>[payload.aspectRatio,payload.size]),[['5:3','1.5k'],['3:5','1k'],['1:1','1k']]);
  assert(payloads.every(payload=>payload.mode==='pro'&&payload.style.key==='chibi'&&payload.seed===7&&payload.batchSize===4));
  context.apiOptions=core.normalizeApiOptions({aspectRatio:'9:16',size:'1k'});assert.equal(context.jobs[0].apiOptions.aspectRatio,'5:3');
});
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
