'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),core=require('./pixai-web-queue.user.js');
const copy=v=>JSON.parse(JSON.stringify(v));
function seed(){return {...core.makePresetLibrary(),common:{prompt:'global-quality',negativePrompt:'global-neg'},commonPresets:[{id:'set',name:'공통 세트',prompt:'set-quality',negativePrompt:'set-neg'}],presets:[{id:'p',name:'프리셋',model:{id:'101',versionId:'201',name:'T'},loras:[{id:'301',versionId:'401',name:'L',weight:.5,triggerWords:'trigger'}],prompt:'preset-style',negativePrompt:'preset-neg',commonPresetId:'set'}],characters:[{id:'c',name:'캐릭터',prompt:'character',negativePrompt:'character-neg',defaultPresetId:'p'}],scenes:[{id:'s',name:'표정',prompt:'smile',negativePrompt:'chunk-neg'}],sceneFolders:[],sceneCards:[],casts:[],batchPlans:[]};}
test('public page lookup omits credentials, rejects redirects and unlisted domains, and preserves exact IDs when names fail',async()=>{
 let calls=0,request;const info=core.parsePublicModelLink('https://pixai.art/ko/model/101/201'),bytes=new TextEncoder().encode('<title>모델 이름 - PixAI</title>');const read=await core.readPublicModelName(info,{fetch:async(url,options)=>{calls++;request={url,options};return {ok:true,url,headers:{get:()=> 'text/html'},body:new ReadableStream({start(controller){controller.enqueue(bytes.subarray(0,10));controller.enqueue(bytes.subarray(10));controller.close();}})};}});
 assert.equal(read.name,'모델 이름');assert.equal(request.options.credentials,'omit');assert.equal(request.options.redirect,'error');assert.equal(request.options.headers,undefined);await assert.rejects(core.readPublicModelName({...info,url:'https://evil.example/101'},{fetch:()=>{calls++;}}));assert.equal(calls,1);
 const failed=await core.readPublicModelName(info,{fetch:async()=>({ok:true,url:'https://other.example',headers:{get:()=> 'text/html'}})});assert.equal(failed.id,'101');assert.equal(failed.versionId,'201');assert.match(failed.notice,/이름 조회 실패/);
});
test('common sets replace global text, retain intentionally empty sets and keep frozen reservations unchanged',()=>{
 const lib=seed(),recipe={id:'r',presetId:'p',characterId:'c',sceneIds:['s'],count:1};const frozen=core.snapshotCombination(lib,recipe);lib.reservations=[{...recipe,snapshot:frozen}];
 assert.equal(core.expandPresetReservations(lib)[0].prompt,'set-quality, preset-style, trigger, character, smile');
 lib.commonPresets[0].prompt='';assert.equal(core.composePresetPrompts(core.resolvePresetCommon(lib,lib.presets[0]),lib.characters[0],lib.scenes,lib.presets[0]).prompt,'preset-style, trigger, character, smile');
 const removed=core.deleteCommonPreset(lib,'set');assert.equal(removed.presets[0].commonPresetId,undefined);assert.equal(core.expandPresetReservations(removed)[0].prompt,'set-quality, preset-style, trigger, character, smile');
 assert.equal(core.composePresetPrompts(core.resolvePresetCommon(removed,removed.presets[0]),removed.characters[0],removed.scenes,removed.presets[0]).prompt,'global-quality, preset-style, trigger, character, smile');
 assert.deepEqual(frozen,lib.reservations[0].snapshot);assert.throws(()=>core.resolvePresetCommon({...lib,commonPresets:[]},lib.presets[0]),/공통문/);
});
test('scene and cast extra text use true final trigger position and do not enter negative triggers',()=>{
 const lib=seed();const value=core.composePresetPrompts(core.resolvePresetCommon(lib,lib.presets[0]),lib.characters[0],lib.scenes,lib.presets[0],'end',{cast:{prompt:'outfit',negativePrompt:'cast-neg'},scene:{prompt:'scene-extra',negativePrompt:'scene-neg'}});
 assert.equal(value.prompt,'set-quality, preset-style, character, outfit, smile, scene-extra, trigger');assert.equal(value.negativePrompt,'set-neg, preset-neg, character-neg, cast-neg, chunk-neg, scene-neg');
});
test('three characters by three scenes with two repeats expands to 18 jobs and 72 images with preserved IDs',()=>{
 const lib=seed();lib.characters.push({...lib.characters[0],id:'c2',name:'둘째'},{...lib.characters[0],id:'c3',name:'셋째'});lib.sceneCards=[1,2,3].map(n=>core.makeSceneCard(lib,{id:'card'+n,name:'씬'+n,sceneIds:['s']}));
 const plan={id:'plan',rows:lib.characters.map(v=>({kind:'character',id:v.id})),columns:lib.sceneCards.map(v=>v.id),count:2,order:'byColumn'};let n=0;
 const expanded=core.expandBatchPlan(lib,plan,{idFactory:()=>String(++n),defaultImageOptions:{aspectRatio:'5:3',size:'1k',mode:'pro',batchSize:4}});
 assert.deepEqual(expanded.totals,{pairs:9,jobs:18,images:72,batchSize:4});assert.deepEqual(expanded.order.slice(0,3).map(v=>v.rowKey),['character:c','character:c2','character:c3']);
 const next=core.appendBatchReservations(lib,expanded),jobs=core.expandPresetReservations(next);assert.equal(jobs.length,18);assert.equal(jobs[0].composition.reservation.sourceSceneId,'card1');assert.equal(jobs[0].composition.reservation.batch.columnName,'씬1');assert.equal(jobs[0].apiBatchSize,4);assert.equal(jobs[0].apiOptions.mode,'pro');
});
test('scene options merge per field, exceptions exclude zero, missing rows fail atomically and snapshots retain deleted chunks',()=>{
 const lib=seed();lib.sceneCards=[core.makeSceneCard(lib,{id:'a',name:'씬',sceneIds:['s'],imageOptions:{aspectRatio:'3:5',size:'1.5k'}})];const before=copy(lib),plan={id:'plan',rows:[{kind:'character',id:'c'}],columns:['a'],count:2,imageOptions:{aspectRatio:'5:3',size:'1k',mode:'ultra',batchSize:1}};
 const expanded=core.expandBatchPlan(lib,plan);assert.equal(expanded.reservations[0].imageOptions.mode,'ultra');assert.equal(expanded.reservations[0].imageOptions.batchSize,1);assert.equal(expanded.totals.images,2);
 const zero=core.expandBatchPlan(lib,{...plan,exceptions:{'character:c|a':0}});assert.equal(zero.reservations.length,0);assert.throws(()=>core.appendBatchReservations(lib,zero),/예약할/);
 const failed=core.expandBatchPlan(lib,{...plan,rows:[{kind:'character',id:'missing'}]});assert.equal(failed.reservations.length,0);assert.throws(()=>core.appendBatchReservations(lib,failed),/해결할/);assert.deepEqual(lib,before);
 lib.scenes=[];const retained=core.expandBatchPlan(lib,plan);assert.equal(retained.reservations[0].snapshot.chunks[0].prompt,'smile');assert(retained.problems.some(v=>v.level==='warning'));
});
test('a conflicting character LoRA rejects the complete scene batch without overwriting an existing snapshot',()=>{
 const lib=seed(),recipe={id:'old',presetId:'p',characterId:'c',sceneIds:['s'],count:1};lib.reservations=[{...recipe,snapshot:core.snapshotCombination(lib,recipe)}];
 lib.characters.push({...copy(lib.characters[0]),id:'conflict',name:'Conflict',loras:[{...lib.presets[0].loras[0],weight:.2}]});
 lib.sceneCards=[core.makeSceneCard(lib,{id:'card',name:'Scene',sceneIds:['s']})];const before=copy(lib);
 const expanded=core.expandBatchPlan(lib,{id:'plan',rows:[{kind:'character',id:'c'},{kind:'character',id:'conflict'}],columns:['card'],count:1});
 assert(expanded.problems.some(problem=>problem.level==='error'&&/LoRA/.test(problem.message)));assert.equal(expanded.reservations.length,0);
 assert.throws(()=>core.appendBatchReservations(lib,expanded),/LoRA/);assert.deepEqual(lib,before);assert.equal(core.expandPresetReservations(lib).length,1);
});

test('scene copies refresh only on explicit confirmation and preserve removed originals',()=>{
 const lib=seed();lib.sceneCards=[core.makeSceneCard(lib,{id:'a',sceneIds:['s']})];lib.scenes[0].prompt='new-smile';const diff=core.refreshSceneCard(lib,'a');assert.equal(diff.changes[0].before,'smile');assert.equal(lib.sceneCards[0].chunks[0].prompt,'smile');lib.scenes=[];assert.equal(core.refreshSceneCard(lib,'a').card.chunks[0].prompt,'smile');
});
test('app and legacy compatible exports explicitly convert fields and keep all reserved final prompts',()=>{
 const lib=seed();lib.sceneCards=[core.makeSceneCard(lib,{id:'a',name:'씬',sceneIds:['s'],extra:{prompt:'extra',negativePrompt:'extra-neg'},triggerPosition:'end'})];lib.casts=[{id:'cast',name:'복장',characterId:'c',presetId:'p',extra:{prompt:'outfit',negativePrompt:''}}];const expanded=core.expandBatchPlan(lib,{rows:[{kind:'cast',id:'cast'}],columns:['a'],count:1});lib.reservations=expanded.reservations;
 const meta={appVersion:'0.10.0',exportedAt:'2026-10-13T00:00:00.000Z'},options={maxCredits:null,filePrefix:'',repeat:1,embedMetadata:true};
 const backup=core.makeSettingsBackup(lib,options,meta);assert.equal(backup.version,2);assert.deepEqual(core.parseSettingsBackup(JSON.stringify(backup)).library,core.normalizePresetLibrary(lib));
 const old=core.compatibleSettings(lib,options,meta,'legacy');assert(old.warnings.length);const current=core.expandPresetReservations(lib)[0],converted=core.expandPresetReservations(core.parseSettingsBackup(JSON.stringify(old.backup)).library)[0];assert.equal(converted.prompt,current.prompt);assert.equal(converted.negativePrompt,current.negativePrompt);assert.equal(old.backup.library.sceneCards,undefined);
 const app=core.compatibleSettings(lib,options,meta,'app');assert.equal(app.backup.version,1);assert.equal(app.backup.options.embedMetadata,undefined);assert.deepEqual(app.backup.library.sceneCards,lib.sceneCards);
});
test('app-only UI options are validated and conversion is explicit, while secrets and bad IDs remain rejected',()=>{
 const lib=seed(),meta={appVersion:'0.1.11',exportedAt:'2026-10-13T00:00:00.000Z'},backup={format:'pixai-web-queue-settings',version:1,...meta,library:lib,options:{maxCredits:null,filePrefix:'',repeat:1,ui:{sceneView:'grid'}}};
 const parsed=core.parseSettingsBackup(JSON.stringify(backup));assert.equal(parsed.options.ui,undefined);assert.equal(parsed.conversionWarnings.length,1);backup.options.ui.apiKey='secret';assert.throws(()=>core.parseSettingsBackup(JSON.stringify(backup)),/화면 설정/);delete backup.options.ui.apiKey;backup.library.sceneCards=[{id:'a',name:'x',sceneIds:['s'],chunks:[{...lib.scenes[0],apiKey:'hidden'}]}];assert.throws(()=>core.parseSettingsBackup(JSON.stringify(backup)),/사본/);
});
test('public model links never infer a missing version and reject credentials or foreign URLs',()=>{
 assert.deepEqual(core.parsePublicModelLink('https://pixai.art/ko/model/123-name/456').id,'123');assert.equal(core.parsePublicModelLink('https://pixai.art/model/123').versionId,'');assert.throws(()=>core.parsePublicModelLink('https://user:pw@pixai.art/model/123/456'));assert.throws(()=>core.parsePublicModelLink('https://example.com/model/123/456'));
});
test('batch plan fields preserve explicit empty selections and validate all prompt blocks without changing old plans',()=>{
 const old={id:'plan',rows:[{kind:'character',id:'c'}],columns:['card'],count:1};
 const legacy=core.normalizeBatchPlan(old,'plan');assert.equal(Object.hasOwn(legacy,'extraChunkIds'),false);assert.equal(Object.hasOwn(legacy,'promptOrder'),false);
 const order=['extraChunks','scene','character'],value=core.normalizeBatchPlan({...old,extraChunkIds:['night','coat'],promptOrder:order},'plan');
 assert.deepEqual(value.extraChunkIds,['night','coat']);assert.deepEqual(value.promptOrder,order);assert.notEqual(value.promptOrder,order);
 assert.deepEqual(core.normalizeBatchPlan({...old,extraChunkIds:[]},'plan').extraChunkIds,[]);
 for(const extraChunkIds of [null,'night',['night','night'],['']])assert.throws(()=>core.normalizeBatchPlan({...old,extraChunkIds},'plan'),/추가 청크/);
 for(const promptOrder of [null,[],['character','scene'],['character','scene','scene'],['character','scene','unknown']])assert.throws(()=>core.normalizeBatchPlan({...old,promptOrder},'plan'),/문구 순서/);
});
test('all six character-scene-extra permutations compose positive and negative blocks with trigger anchors intact',()=>{
 const lib=seed(),common=core.resolvePresetCommon(lib,lib.presets[0]),chunks=[lib.scenes[0],{prompt:'pose',negativePrompt:'pose-neg'}],extras={cast:{prompt:'outfit',negativePrompt:'outfit-neg'},scene:{prompt:'scene-extra',negativePrompt:'scene-neg'}};
 const blocks={character:['character','outfit'],scene:['smile','pose','scene-extra'],extraChunks:['night','rain']};
 const negatives={character:['character-neg','outfit-neg'],scene:['chunk-neg','pose-neg','scene-neg'],extraChunks:['night-neg','rain-neg']};
 const extraChunks=[{prompt:'night',negativePrompt:'night-neg'},{prompt:'rain',negativePrompt:'rain-neg'}];
 const permutations=[['character','scene','extraChunks'],['character','extraChunks','scene'],['scene','character','extraChunks'],['scene','extraChunks','character'],['extraChunks','character','scene'],['extraChunks','scene','character']];
 for(const promptOrder of permutations)for(const position of [0,1,2,3,4,'end']){
   const result=core.composePresetPrompts(common,lib.characters[0],chunks,lib.presets[0],position,extras,{extraChunks,promptOrder});
   const parts=['set-quality','preset-style',...promptOrder.flatMap(block=>blocks[block])];
   const insertion=position===0?0:position===1?2:position===2?parts.indexOf('outfit')+1:position===3?parts.indexOf('smile')+1:position===4?parts.indexOf('pose')+1:parts.length;
   parts.splice(insertion,0,'trigger');assert.equal(result.prompt,parts.join(', '));
   assert.equal(result.negativePrompt,['set-neg','preset-neg',...promptOrder.flatMap(block=>negatives[block])].join(', '));
 }
 for(const position of [0,1,2,3,4,'end']){
   const oldParts=['set-quality, preset-style','character, outfit','smile','pose'];
   if(position==='end')oldParts.push('scene-extra','trigger');else{oldParts.splice(position,0,'trigger');oldParts.push('scene-extra');}
   assert.equal(core.composePresetPrompts(common,lib.characters[0],chunks,lib.presets[0],position,extras).prompt,oldParts.join(', '));
 }
});
test('batch additional chunks and prompt order freeze into jobs and survive live edits deletion and backup round trips',()=>{
 const lib=seed();lib.chunkFolders=[{id:'folder',name:'배경'}];lib.scenes.push({id:'night',name:'밤',prompt:'night',negativePrompt:'night-neg',folderId:'folder'});
 lib.characters[0].loras=[{id:'302',versionId:'402',name:'캐릭터 LoRA',weight:.4,triggerWords:'char-trigger'}];
 lib.sceneCards=[core.makeSceneCard(lib,{id:'card',name:'씬',sceneIds:['s'],extra:{prompt:'scene-extra',negativePrompt:'scene-neg'},triggerPosition:'end'})];
 lib.casts=[{id:'cast',name:'정장',characterId:'c',presetId:'p',extra:{prompt:'outfit',negativePrompt:'outfit-neg'}}];
 const plan={id:'plan',rows:[{kind:'cast',id:'cast'}],columns:['card'],count:1,extraChunkIds:['night'],promptOrder:['extraChunks','scene','character']};
 lib.batchPlans=[plan];const expanded=core.expandBatchPlan(lib,plan);assert.deepEqual(expanded.problems,[]);
 lib.reservations=expanded.reservations;const snapshot=lib.reservations[0].snapshot;
 assert.deepEqual(snapshot.extraChunks,[{id:'night',name:'밤',prompt:'night',negativePrompt:'night-neg'}]);assert.deepEqual(snapshot.promptOrder,plan.promptOrder);
 assert.equal(snapshot.preset.loras.length,2);assert.equal(snapshot.character.loras,undefined);
 lib.scenes[1].prompt='changed-night';lib.characters[0].prompt='changed-character';lib.scenes=[];lib.chunkFolders=[];
 const meta={appVersion:'test',exportedAt:'2026-11-08T00:00:00.000Z'},options={maxCredits:null,filePrefix:'',repeat:1};
 for(const backup of [core.makeSettingsBackup(lib,options,meta),core.compatibleSettings(lib,options,meta,'app').backup]){
   const restored=core.parseSettingsBackup(JSON.stringify(backup)).library;assert.deepEqual(restored.batchPlans[0].extraChunkIds,['night']);assert.deepEqual(restored.batchPlans[0].promptOrder,plan.promptOrder);
   const [job]=core.expandPresetReservations(restored);assert.equal(job.prompt,'set-quality, preset-style, night, smile, scene-extra, character, outfit, trigger, char-trigger');
   assert.equal(job.negativePrompt,'set-neg, preset-neg, night-neg, chunk-neg, scene-neg, character-neg, outfit-neg');assert.deepEqual(job.composition.reservation.snapshot,snapshot);
 }
});
test('missing additional chunks block a complete batch while duplicate scene selection is explicit and retained',()=>{
 const lib=seed();lib.sceneCards=[core.makeSceneCard(lib,{id:'card',sceneIds:['s']})];const plan={id:'plan',rows:[{kind:'character',id:'c'}],columns:['card'],count:1},before=copy(lib);
 const missing=core.expandBatchPlan(lib,{...plan,extraChunkIds:['gone']});assert.equal(missing.reservations.length,0);assert(missing.problems.some(p=>p.level==='error'&&/추가 청크/.test(p.message)));assert.throws(()=>core.appendBatchReservations(lib,missing),/추가 청크/);assert.deepEqual(lib,before);
 const duplicate=core.expandBatchPlan(lib,{...plan,extraChunkIds:['s']});assert(duplicate.problems.some(p=>p.level==='warning'&&/두 번/.test(p.message)));assert.equal(duplicate.reservations.length,1);
 const [job]=core.expandPresetReservations({...lib,reservations:duplicate.reservations});assert.equal(job.prompt,'set-quality, preset-style, trigger, character, smile, smile');
});
test('additional chunk snapshots reject malformed arrays duplicates unknown fields and broken block orders',()=>{
 const lib=seed(),recipe={id:'r',presetId:'p',characterId:'c',sceneIds:['s'],count:1},frozen=core.snapshotCombination(lib,recipe);
 const read=snapshot=>core.normalizePresetLibrary({...lib,reservations:[{...recipe,snapshot}]});
 for(const extraChunks of [null,{},[lib.scenes[0],lib.scenes[0]],[{...lib.scenes[0],apiKey:'untrusted'}]])assert.throws(()=>read({...frozen,extraChunks}),/사본/);
 assert.throws(()=>read({...frozen,promptOrder:['scene','character','character']}),/문구 순서/);
 const result=read({...frozen,extraChunks:[{...lib.scenes[0],folderId:'deleted-folder'}],promptOrder:['extraChunks','character','scene']});
 assert.equal(result.reservations[0].snapshot.extraChunks[0].folderId,undefined);
});
test('legacy export excludes unsupported extra chunks and ordering visibly while default and old reservations remain exact',()=>{
 const lib=seed(),recipe={id:'old',presetId:'p',characterId:'c',sceneIds:['s'],count:1},frozen=core.snapshotCombination(lib,recipe);
 lib.reservations=[{...recipe,snapshot:frozen},{...recipe,id:'default',snapshot:{...copy(frozen),extraChunks:[],promptOrder:['character','scene','extraChunks']}},{...recipe,id:'extra',snapshot:{...copy(frozen),extraChunks:[{id:'night',name:'밤',prompt:'night',negativePrompt:''}]}},{...recipe,id:'reordered',snapshot:{...copy(frozen),promptOrder:['scene','character','extraChunks']}}];
 const before=copy(lib),result=core.compatibleSettings(lib,{maxCredits:null,filePrefix:'',repeat:1},{appVersion:'test',exportedAt:'2026-11-08T00:00:00.000Z'},'legacy');
 assert.deepEqual(result.backup.library.reservations.map(v=>v.id),['old','default']);assert(result.warnings.some(text=>/예약 2개/.test(text)));
 const jobs=core.expandPresetReservations(core.parseSettingsBackup(JSON.stringify(result.backup)).library);assert.equal(jobs[0].prompt,jobs[1].prompt);assert.equal(jobs[0].prompt,core.expandPresetReservations(lib)[0].prompt);assert.deepEqual(lib,before);
});
module.exports={seed};
