'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {assertWebReceipt,assertWebUnlimited,webOriginal,runWebUnlimited,recover,reconfigureQueuedApiJob,createOfficialApiClient}=require('./pixai-web-queue.user.js');
const original={id:'712345',url:'https://images-ng.pixai.art/images/orig/e0961426-4cdf-4fc7-b125-dc722381c849',width:1280,height:768};
function fixture(n=2){
  const jobs=Array.from({length:n},(_,i)=>({id:String(i),backend:'web-unlimited',state:'queued',saved:[],prompt:'cup '+i})),events=[],snapshots=[];
  const io={persist(){snapshots.push(structuredClone(jobs));},async prepare(j){events.push('prepare'+j.id);},async submit(j){events.push('submit'+j.id);return String(100+Number(j.id));},async wait(j){events.push('wait'+j.id);return {...original,id:String(700+Number(j.id))};},async save(j){events.push('save'+j.id);return j.id+'.png';}};
  return {jobs,events,snapshots,io};
}
test('unlimited requires explicit enabled switch, active banner, free total and exactly one image',()=>{
  const good={enabled:true,banner:true,price:'free',count:1,busy:false};assert.doesNotThrow(()=>assertWebUnlimited(good));
  for(const bad of [{enabled:false},{banner:false},{price:'0 additional credits'},{price:'unknown'},{price:'1100'},{count:4},{count:0},{busy:true}])assert.throws(()=>assertWebUnlimited({...good,...bad}));
});
test('receipt verifies identity, free credits and prompt without relying on relative time',()=>{
  const job={taskId:'123',prompt:'a cup'},receipt={id:'123',prompt:'a cup',credits:'0',recent:true};
  assert.doesNotThrow(()=>assertWebReceipt(job,receipt,{fresh:true}));
  for(const extra of [{id:'999'},{prompt:'other task'},{credits:'100'},{credits:'+0'}])assert.throws(()=>assertWebReceipt(job,{...receipt,...extra}));
  assert.doesNotThrow(()=>assertWebReceipt(job,{...receipt,recent:false}));
});
test('web work submits only after durable uncertainty marker and saves before the next submit',async()=>{
  const f=fixture();await runWebUnlimited(f.jobs,f.io);
  assert.deepEqual(f.events,['prepare0','submit0','wait0','save0','prepare1','submit1','wait1','save1']);
  assert.equal(f.snapshots[0][0].state,'submitting');assert(f.snapshots[0][0].submittedAt);assert.equal(f.snapshots[0][1].state,'queued');
  assert(f.jobs.every(j=>j.state==='done'&&j.expected===1&&j.saved.length===1));assert.equal(f.jobs[0].saved[0].file,'0.png');
});
test('first-job mode leaves later work untouched and never invokes API jobs',async()=>{
  const f=fixture();f.jobs.unshift({id:'api',state:'queued',saved:[]});await runWebUnlimited(f.jobs,f.io,{oneJob:true});
  assert.deepEqual(f.events,['prepare0','submit0','wait0','save0']);assert.equal(f.jobs[0].state,'queued');assert.equal(f.jobs[2].state,'queued');
});
test('failed preflight leaves the job unsubmitted',async()=>{
  const f=fixture();f.io.prepare=async()=>{throw Error('paid');};await assert.rejects(runWebUnlimited(f.jobs,f.io),/paid/);assert.deepEqual(f.events,[]);assert.equal(f.jobs[0].state,'queued');assert.equal(f.jobs[0].submittedAt,undefined);
});
test('quota failure before submit performs no website click',async()=>{
  const f=fixture();f.io.persist=()=>{throw Error('quota');};await assert.rejects(runWebUnlimited(f.jobs,f.io),/quota/);assert.deepEqual(f.events,['prepare0']);assert.equal(f.jobs[0].state,'unknown');
});
test('unknown receipt blocks replay after reload and a later start',async()=>{
  const f=fixture();f.io.submit=async()=>{throw Error('receipt timeout');};await assert.rejects(runWebUnlimited(f.jobs,f.io),/receipt/);assert.equal(f.jobs[0].state,'unknown');await assert.rejects(runWebUnlimited(recover(f.jobs),f.io),/불명확/);assert.equal(f.jobs[1].state,'queued');
});
test('receipt persistence failure preserves the ID, never resubmits, and can resume',async()=>{
  const f=fixture(1),persist=f.io.persist;let failed=false;f.io.persist=()=>{if(f.jobs[0].taskId&&!failed){failed=true;throw Error('write failure');}persist();};
  await assert.rejects(runWebUnlimited(f.jobs,f.io),/write failure/);assert.equal(f.jobs[0].taskId,'100');assert.equal(f.jobs[0].state,'waiting');await runWebUnlimited(f.jobs,f.io);assert.equal(f.events.filter(x=>x==='submit0').length,1);assert.equal(f.jobs[0].state,'done');
});
test('interrupted submission marker reloads as unknown without duplicate submission',async()=>{
  const f=fixture();f.jobs[0].state='submitting';recover(f.jobs);await assert.rejects(runWebUnlimited(f.jobs,f.io),/불명확/);assert.deepEqual(f.events,[]);
});
test('save failure resumes the stored original only and does not create another image',async()=>{
  const f=fixture(1),save=f.io.save;f.io.save=async()=>{throw Error('disk');};await assert.rejects(runWebUnlimited(f.jobs,f.io),/disk/);assert.equal(f.jobs[0].state,'save_failed');assert.deepEqual(f.jobs[0].webMedia,{...original,id:'700'});
  f.io.save=save;await runWebUnlimited(f.jobs,f.io);assert.equal(f.events.filter(x=>x==='submit0').length,1);assert.equal(f.events.filter(x=>x==='wait0').length,1);assert.equal(f.jobs[0].state,'done');
});
test('stop after receipt preserves waiting ID and prevents the next website operation',async()=>{
  const f=fixture(),submit=f.io.submit;let stop=false;f.io.submit=async j=>{const id=await submit(j);stop=true;return id;};await runWebUnlimited(f.jobs,f.io,{stopped:()=>stop});assert.deepEqual(f.events,['prepare0','submit0']);assert.equal(f.jobs[0].taskId,'100');assert.equal(f.jobs[0].state,'waiting');
});
test('saved jobs and skipped jobs never rerun',async()=>{
  const f=fixture();f.jobs[0].state='done';f.jobs[1].state='skipped';await runWebUnlimited(f.jobs,f.io);assert.deepEqual(f.events,[]);
});
test('queued records with previous submission or API payload cannot be reinterpreted as web',async()=>{
  for(const extra of [{taskId:'123'},{submittedAt:123},{apiPayload:{prompt:'x'}}]){const f=fixture(1);Object.assign(f.jobs[0],extra);await assert.rejects(runWebUnlimited(f.jobs,f.io),/다시 생성/);assert.deepEqual(f.events,[]);}
});
test('original URL and media identity guard rejects preview, redirects, foreign URLs and missing dimensions',()=>{
  assert.deepEqual(webOriginal(original),original);
  for(const bad of [{url:original.url.replace('/orig/','/thumb/')},{url:original.url+'?target=x'},{url:original.url.replace('images-ng.pixai.art','evil.example')},{url:original.url.replace('https://','https://user:pass@')},{id:'x'},{width:0},{height:1.2}])assert.throws(()=>webOriginal({...original,...bad}));
});
test('web jobs cannot receive paid API payload through job reconfigure',()=>{assert.throws(()=>reconfigureQueuedApiJob({backend:'web-unlimited',state:'queued',saved:[]},{},1,1),/API 옵션/);});
test('web image download is anonymous, does not touch API key, and uses only observed original URL',async()=>{
  let request;const blob=new Blob(['png'],{type:'image/png'});const api=createOfficialApiClient(details=>{request=details;queueMicrotask(()=>details.onload({status:200,response:blob,finalUrl:original.url}));return {abort(){}};},()=>{throw Error('key must not be read');});
  assert.equal(await api.image(original.url),blob);assert.equal(request.method,'GET');assert.equal(request.url,original.url);assert.equal(request.anonymous,true);assert.equal(request.headers?.Authorization,undefined);
});
test('visible web module has no hidden state or internal endpoint execution',()=>{
  const source=fs.readFileSync('modules/web-unlimited.js','utf8');assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|GM_xmlhttpRequest|graphql|__react|__NEXT_DATA__|localStorage|sessionStorage/);
  assert.match(source,/data-share-guide/);assert.match(source,/data-task-id/);assert.match(source,/data-media-id/);
});
