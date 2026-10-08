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
