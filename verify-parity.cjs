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
module.exports={seed};
