'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('./pixai-web-queue.user.js');
const config=()=>({model:{id:'10',versionId:'101',name:'Tsubaki.3'},loras:[{id:'20',versionId:'201',name:'Character',weight:0.7,triggerWords:'hero'}]});
const job=()=>({id:'job',title:'asset',prompt:'1girl, smile, hero',negativePrompt:'lowres',configuration:config(),composition:{triggerPosition:4},state:'queued',saved:[]});
const copy=x=>JSON.parse(JSON.stringify(x));
function transport(answer) {
  const calls=[];
  const request=details=>{calls.push(details);queueMicrotask(()=>{
    const response=answer(details,calls.length);
    if (response==='network') details.onerror({error:'SENSITIVE'});
    else details.onload({finalUrl:details.url,status:200,responseText:'{}',...response});
  });return {abort(){}};};
  const vault=core.createSessionApiKey();vault.set('fixture-secret');
  return {calls,vault,api:core.createOfficialApiClient(request,()=>vault.get())};
}
test('public v2 payload uses version IDs, frozen seed, four images and exact composed trigger placement',()=>{
  const j=job(),before=copy(j),payload=core.buildApiPayload(j,{aspectRatio:'2:3',mode:'pro',style:'chibi'},4,42);
  assert.equal(payload.modelVersionId,'101');assert.equal(payload.prompt,j.prompt);assert.equal(payload.negativePrompt,'lowres');
  assert.deepEqual(payload.loras,[{modelId:'201',weight:0.7,triggerWords:''}]);assert.deepEqual(payload.style,{type:'preset',key:'chibi'});
  assert.equal(payload.seed,42);assert.equal(payload.batchSize,4);assert.equal(payload.promptHelper,'disable');assert.deepEqual(j,before);
});
test('invalid LoRA API weights, missing version IDs and excess adapters stop without silent alteration',()=>{
  for (const weight of [-0.1,1.1,' ',null]) {const j=job();j.configuration.loras[0].weight=weight;assert.throws(()=>core.buildApiPayload(j,{},4,42),/0~1/);assert.equal(j.configuration.loras[0].weight,weight);}
  const j=job();delete j.configuration.loras[0].versionId;assert.throws(()=>core.buildApiPayload(j,{},1,42),/LoRA 버전/);
  j.configuration.loras=Array.from({length:6},(_,i)=>({versionId:String(i+1),weight:1}));assert.throws(()=>core.buildApiPayload(j,{},1,42),/최대 5개/);
});
test('explicit zero seed is preserved; non-Tsubaki mode can be omitted; unknown trigger uses documented defaults',()=>{
  const j=job();delete j.composition;delete j.configuration.loras[0].triggerWords;
  const p=core.buildApiPayload(j,{mode:'',seed:0},1,99);assert.equal(p.seed,0);assert.equal('mode' in p,false);assert.equal('triggerWords' in p.loras[0],false);
  delete j.configuration;assert.equal(core.buildApiPayload(j,{modelVersionId:'999'},4,7).modelVersionId,'999');
});

test('model defaults omit inference mode; explicit mode stays user-controlled',()=>{
  assert.equal(core.normalizeApiOptions().mode,'');assert.equal('mode' in core.buildApiPayload(job(),{},4,42),false);
  assert.equal(core.buildApiPayload(job(),{mode:'standard'},4,42).mode,'standard');
});

test('confirmed rejected queued request can explicitly apply new options while preserving recipe, seed and previous request',()=>{
  const j=job();j.apiPayload=core.buildApiPayload(j,{mode:'standard'},4,42);j.submittedAt=123;j.error='공식 API 오류 (422). API 입력값을 확인해 주세요.';
  const before=copy(j),next=core.reconfigureQueuedApiJob(j,{mode:''},4,99);
  assert.deepEqual(j,before);assert.equal('mode' in next.apiPayload,false);assert.equal(next.apiPayload.seed,42);assert.equal(next.apiPayload.batchSize,4);
  assert.equal(next.prompt,j.prompt);assert.deepEqual(next.configuration,j.configuration);assert.deepEqual(next.composition,j.composition);
  assert.deepEqual(next.apiRequestHistory,[{payload:j.apiPayload,submittedAt:123,error:j.error}]);assert.equal(next.submittedAt,undefined);assert.equal(next.error,'');
  const second=core.reconfigureQueuedApiJob(next,{mode:'pro'},4,999);assert.equal(second.apiRequestHistory.length,2);assert.equal(second.apiPayload.seed,42);
});

test('paid, uncertain, saved and ambiguous submissions cannot replace API requests',()=>{
  for(const extra of [{state:'unknown'},{state:'submitting'},{state:'waiting'},{state:'done'},{taskId:'900'},{saved:[{mediaId:'1'}]},{mediaIds:['1']},{metadataFile:'asset.json'},{submittedAt:123,error:'공식 API 네트워크 오류'}]) {
    const j={...job(),...extra},before=copy(j);assert.throws(()=>core.reconfigureQueuedApiJob(j,{mode:''},4,42));assert.deepEqual(j,before);
  }
  const j=job(),before=copy(j);assert.throws(()=>core.reconfigureQueuedApiJob(j,{mode:''},2,42));assert.deepEqual(j,before);
});
test('key vault clears without storage; API backup round trip preserves settings and rejects secrets',()=>{
  const vault=core.createSessionApiKey();assert.equal(vault.has(),false);assert.throws(()=>vault.set('bad\nkey'));vault.set('private-key');assert.equal(vault.has(),true);vault.clear();assert.throws(()=>vault.get(),/키/);
  const opts={maxCredits:7800,filePrefix:'asset',repeat:1,imageCount:4,maxInFlight:3,api:core.normalizeApiOptions({seed:0,mode:'pro'})};
  const backup=core.makeSettingsBackup(core.makePresetLibrary(),opts,{appVersion:'0.9.0',exportedAt:'2026-10-08T00:00:00.000Z'});
  assert.deepEqual(core.parseSettingsBackup(JSON.stringify(backup)).options,opts);assert(!JSON.stringify(backup).includes('private-key'));
  assert.throws(()=>core.normalizeSettingsOptions({...opts,api:{apiKey:'secret'}}),/키/);
});
test('official transport uses fixed REST routes, anonymous fetch and blocked redirects, with no cookie or key in payload',async()=>{
  const f=transport(d=>({status:d.method==='POST' ? 201:200,responseText:JSON.stringify({id:'900',status:'completed'})}));
  assert.equal(await f.api.create(core.buildApiPayload(job(),{},4,42)),'900');await f.api.task('900');
  assert.equal(f.calls.length,2);assert.equal(f.calls[0].url,'https://api.pixai.art/v2/image/create');assert.equal(f.calls[1].url,'https://api.pixai.art/v1/task/900');
  for(const d of f.calls){assert.equal(d.anonymous,true);assert.equal(d.fetch,true);assert.equal(d.redirect,'error');assert.equal(d.headers.Authorization,'Bearer fixture-secret');assert.equal(d.cookie,undefined);assert(!String(d.data).includes('fixture-secret'));}
  assert.throws(()=>f.api.task('900/../secret'));assert.equal(f.calls.length,2);
});
test('unauthenticated key access prevents network and 404 never proves valid authentication',async()=>{
  const f=transport(()=>({status:404,responseText:'{"token":"fixture-secret"}'}));f.vault.clear();await assert.rejects(f.api.task('900'),/키/);assert.equal(f.calls.length,0);
  f.vault.set('fixture-secret');await assert.rejects(f.api.task('900'),error=>error.status===404&&!error.message.includes('fixture-secret'));
});
test('lost or malformed POST response freezes unknown job; no automatic second paid request',async()=>{
  for (const answer of ['network',{status:201,responseText:'invalid'},{status:201,responseText:'{"id":900}'},{status:500,responseText:'fixture-secret'}]) {
    const f=transport(()=>answer),j=job();
    const io={persist(){},prepare:async()=>({queryBackend:'official-v1',apiPayload:core.buildApiPayload(j,{},4,42),expected:4}),submit:x=>f.api.create(x.apiPayload)};
    await assert.rejects(core.submitJob(j,io));assert.equal(j.state,'unknown');assert(!j.error.includes('fixture-secret'));assert(!j.error.includes('SENSITIVE'));
    await assert.rejects(core.submitJob(j,io));assert.equal(f.calls.length,1);
  }
});
test('confirmed input rejection preserves queued job without automatic retry',async()=>{
  const f=transport(()=>({status:400,responseText:'raw secret error'})),j=job();
  await assert.rejects(core.submitJob(j,{persist(){},prepare:async()=>({apiPayload:core.buildApiPayload(j,{},4,42)}),submit:x=>f.api.create(x.apiPayload)}));
  assert.equal(j.state,'queued');assert.equal(f.calls.length,1);assert(!j.error.includes('raw secret'));
});

test('422 diagnostics identify invalid fields without echoing credentials, prompts or request inputs',async()=>{
  const responseText=JSON.stringify({detail:[
    {loc:['body','seed'],type:'less_than_equal',msg:'fixture-secret private prompt',input:'fixture-secret'},
    {loc:['body','loras',0,'weight'],type:'float_type',input:{prompt:'private prompt',Authorization:'fixture-secret'}},
    {loc:['body','fixture-secret'],type:'fixture-secret',msg:'private prompt'}]});
  const f=transport(()=>({status:422,responseText})),j=job();
  await assert.rejects(core.submitJob(j,{persist(){},prepare:async()=>({apiPayload:core.buildApiPayload(j,{},4,42)}),submit:x=>f.api.create(x.apiPayload)}),error=>{
    assert.match(error.message,/body.seed · less_than_equal/);assert.match(error.message,/body.loras.0.weight · float_type/);
    assert(!error.message.includes('fixture-secret'));assert(!error.message.includes('private prompt'));return error.notSubmitted;
  });
  assert.equal(j.state,'queued');assert.equal(f.calls.length,1);assert(!j.error.includes('fixture-secret'));
});

test('validation diagnostics handle JSON-pointer and nested issues, ignore arbitrary free text and non-input failures',()=>{
  assert.equal(core.apiValidationDetails(JSON.stringify({type:'validation',property:'/loras/weight',message:'secret',found:'secret'})),'loras.weight · validation');
  assert.equal(core.apiValidationDetails(JSON.stringify({error:{code:'VALIDATION_ERROR',issues:[{path:['modelVersionId'],code:'invalid_type',message:'secret'}]}})),'VALIDATION_ERROR; modelVersionId · invalid_type');
  for(const raw of ['secret','null','[]','{"message":"secret","input":"secret"}']) assert.equal(core.apiValidationDetails(raw),'');
  assert(!core.apiHttpError(500,'POST','{"type":"validation","property":"seed"}').message.includes('서버 검증'));
});

test('live public API validation envelope exposes data.issues without copying raw issue messages or values',()=>{
  const raw=JSON.stringify({defined:false,code:'BAD_REQUEST',status:400,message:'Input validation failed',data:{issues:[{expected:'string',code:'invalid_type',path:['prompt'],message:'private prompt fixture-secret',input:'fixture-secret'}]}});
  assert.equal(core.apiValidationDetails(raw),'BAD_REQUEST; prompt · invalid_type');
});

test('business error reason survives while actual key, request strings, escaped content and URLs are masked',async()=>{
  const j=job(),payload=core.buildApiPayload(j,{},4,42);
  const raw=JSON.stringify({code:'UNPROCESSABLE_CONTENT',message:'Model not available: fixture-secret '+payload.prompt+' '+payload.negativePrompt+' https://example.com/key?token=fixture-secret',data:{input:'PRIVATE'}});
  const f=transport(()=>({status:422,responseText:raw}));
  await assert.rejects(f.api.create(payload),error=>{
    assert.match(error.message,/서버 사유: Model not available/);assert.match(error.message,/UNPROCESSABLE_CONTENT/);
    for(const hidden of ['fixture-secret',payload.prompt,payload.negativePrompt,'example.com','PRIVATE']) assert(!error.message.includes(hidden));return error.notSubmitted;
  });
  assert(!core.apiServerReason(JSON.stringify({message:'line\\nsecret'}),{payload:{prompt:'line\nsecret'}}).includes('secret'));
});

test('credential or prompt-related free text and unbounded messages are suppressed',()=>{
  for(const message of ['Authorization: hidden-secret','api_key=value','Invalid prompt: fragments','negativePrompt data','x'.repeat(2001)]) {
    const reason=core.apiServerReason(JSON.stringify({message}));assert(!reason.includes('hidden-secret'));assert(!reason.includes('fragments'));assert(!reason.includes('value'));assert(reason.length<310);
  }
  assert.equal(core.apiServerReason('not JSON'),'');assert.equal(core.apiServerReason('{"message":{"input":"secret"}}'),'');
});
test('official parameterless task receipt is verified by ID/time; wrong IDs, old timestamps and mismatched explicit prompts fail',()=>{
  const j={...job(),queryBackend:'official-v1',taskId:'900',submittedAt:Date.now()},t={id:'900',createdAt:new Date().toISOString(),outputs:{mediaIds:['1','2','3','4']}};
  core.verifyTask(j,t);assert.deepEqual(core.outputIds(t,4),['1','2','3','4']);assert.throws(()=>core.verifyTask(j,{...t,id:'901'}));
  assert.throws(()=>core.verifyTask(j,{...t,createdAt:'2000-01-01'}));assert.throws(()=>core.verifyTask(j,{...t,parameters:{prompts:'wrong'}}));
  assert.throws(()=>core.outputIds({...t,outputs:{mediaIds:['1','1','3','4']}},4));assert.throws(()=>core.outputIds(t,1));
});
test('three prefills, five jobs and twenty files use only REST once per job; existing paid job and partial save retry never create anew',async()=>{
  const records=new Map(),f=transport(d=>{
    if(d.method==='POST'){const id=String(900+records.size);records.set(id,JSON.parse(d.data));return {status:201,responseText:JSON.stringify({id})};}
    const id=d.url.split('/').at(-1);return {responseText:JSON.stringify({id,status:'completed',createdAt:new Date().toISOString(),outputs:{mediaIds:Array.from({length:4},(_,i)=>String(Number(id)*10+i))}})};
  });
  const jobs=Array.from({length:5},(_,i)=>({...job(),id:String(i)})),events=[];let fail=true;
  const io={persist(){},prepare:async j=>({expected:4,queryBackend:'official-v1',apiPayload:core.buildApiPayload(j,{},4,42)}),
    submit:j=>f.api.create(j.apiPayload),waitTask:async j=>{events.push('wait');return f.api.task(j.taskId);},
    saveImage:async(j,id)=>{events.push('save');if(fail&&id==='9001'){fail=false;throw Error('disk');}return id+'.png';},saveMetadata:async()=>events.push('metadata')};
  await assert.rejects(core.runQueue(jobs,io,{limit:3}));assert.equal(f.calls.filter(x=>x.method==='POST').length,3);assert.equal(jobs[0].saved.length,1);
  core.recover(jobs);await core.runQueue(jobs,io,{limit:3});assert.equal(f.calls.filter(x=>x.method==='POST').length,5);
  assert(jobs.every(j=>j.state==='done'&&j.saved.length===4));assert.equal(events.filter(e=>e==='metadata').length,5);
});
test('image download never sends API authentication and rejects unrelated hosts',async()=>{
  const blob=new Blob(['img'],{type:'image/webp'}),f=transport(()=>({response:blob}));
  assert.equal(await f.api.image('https://images.pixai.art/images/orig/test.webp'),blob);assert.equal(f.calls[0].headers,undefined);
  await assert.rejects(f.api.image('https://attacker.example/image'));assert.equal(f.calls.length,1);
});
test('deadline ignores late responses and never reports an unknown submission as successful',async()=>{
  let deadline,details,aborts=0;
  const p=core.gmResponse(d=>{details=d;return {abort(){aborts++;}};},{method:'POST'},10,{set(fn){deadline=fn;return 1;},clear(){}});
  deadline();await assert.rejects(p,/시간 초과/);details.onload({status:201,responseText:'{"id":"900"}'});assert.equal(aborts,1);
});
test('production execution uses public API and does not click generate or call GraphQL',()=>{
  const s=fs.readFileSync(require('node:path').join(__dirname,'pixai-web-queue.user.js'),'utf8'),runtime=s.slice(s.indexOf("  const KEY = 'local.pixai-web-queue.v1';"));
  assert(!runtime.includes('graphqlQuery('));assert(!runtime.includes('generateButton('));assert(!runtime.includes("execCommand('insertText'"));
  assert(runtime.includes('api.create(job.apiPayload)'));assert(runtime.includes('api.media(mediaId)'));
});
