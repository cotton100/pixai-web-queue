const test=require('node:test');
const assert=require('node:assert/strict');
const {runQueue,normalizeSettingsOptions,makePresetLibrary,placeLibraryItem}=require('./pixai-web-queue.user.js');
function fixture(n=5) {
  const jobs=Array.from({length:n},(_,i)=>({id:String(i),title:'job'+i,prompt:'prompt'+i,state:'queued',saved:[]}));
  const events=[],snapshots=[];let stop=false;
  const io={
    persist(){snapshots.push(structuredClone(jobs));},
    async prepare(j){events.push('prepare'+j.id);return {expected:4};},
    async submit(j){events.push('submit'+j.id);return String(900+Number(j.id));},
    async waitTask(j){events.push('wait'+j.id);return {id:j.taskId,status:'completed',createdAt:new Date(j.submittedAt).toISOString(),parameters:{prompts:j.prompt},outputs:{batch:Array.from({length:4},(_,i)=>({mediaId:String(1000+Number(j.id)*4+i)}))}};},
    async saveImage(j,id){events.push('save'+j.id);return id+'.webp';},
    async saveMetadata(j){events.push('metadata'+j.id);}
  };
  return {jobs,io,events,snapshots,stop:()=>{stop=true;},stopped:()=>stop};
}
test('three tasks are registered before waiting; free slots refill and all four images precede next slot',async()=>{
  const f=fixture();await runQueue(f.jobs,f.io,{limit:3});
  assert.deepEqual(f.events.slice(0,7),['prepare0','submit0','prepare1','submit1','prepare2','submit2','wait0']);
  assert(f.events.indexOf('submit3')>f.events.indexOf('metadata0'));
  assert(f.events.indexOf('submit4')>f.events.indexOf('metadata1'));
  assert(f.snapshots.every(s=>s.filter(j=>['waiting','saving'].includes(j.state)).length<=3));
  for(const j of f.jobs){assert.equal(j.state,'done');assert.equal(j.saved.length,4);assert.equal(f.events.filter(e=>e==='submit'+j.id).length,1);}
});
test('limit one retains sequential behavior and one-job mode never submits later work',async()=>{
  const f=fixture(3);await runQueue(f.jobs,f.io,{limit:1});assert(f.events.indexOf('submit1')>f.events.indexOf('metadata0'));
  const g=fixture(3);await runQueue(g.jobs,g.io,{limit:10,oneJob:true});assert.equal(g.jobs[0].state,'done');assert(g.jobs.slice(1).every(j=>j.state==='queued'));assert(!g.events.includes('submit1'));
});
test('Stop between registrations preserves paid ID and prevents every further submission',async()=>{
  const f=fixture();const submit=f.io.submit;f.io.submit=async j=>{const id=await submit(j);f.stop();return id;};
  await runQueue(f.jobs,f.io,{limit:3,stopped:f.stopped});assert.equal(f.jobs[0].state,'waiting');assert.equal(f.jobs[0].taskId,'900');assert(f.jobs.slice(1).every(j=>j.state==='queued'));assert(!f.events.includes('wait0'));
});
test('uncertain second submission stops refill and retains both known and unknown outcomes for recovery',async()=>{
  const f=fixture();f.io.submit=async j=>{f.events.push('submit'+j.id);if(j.id==='1')throw new Error('response lost');return '900';};
  await assert.rejects(runQueue(f.jobs,f.io),/response lost/);assert.equal(f.jobs[0].state,'waiting');assert.equal(f.jobs[0].taskId,'900');assert.equal(f.jobs[1].state,'unknown');assert.equal(f.jobs[2].state,'queued');
  await assert.rejects(runQueue(f.jobs,f.io),/response lost/);assert.equal(f.jobs[0].state,'done');assert(!f.events.includes('submit2'));assert.equal(f.events.filter(e=>e==='submit0').length,1);
});
test('already submitted IDs resume before new credits and failed downloads stop refill',async()=>{
  const f=fixture();Object.assign(f.jobs[0],{state:'waiting',expected:4,taskId:'900',submittedAt:Date.now()});
  await runQueue(f.jobs,f.io);assert(f.events.indexOf('metadata0')<f.events.indexOf('submit1'));assert(!f.events.includes('submit0'));
  const g=fixture();g.io.saveImage=async()=>{throw new Error('disk full');};await assert.rejects(runQueue(g.jobs,g.io),/disk full/);assert.equal(g.jobs[0].state,'save_failed');assert(g.jobs.slice(1,3).every(j=>j.state==='waiting'&&j.taskId));assert(g.jobs.slice(3).every(j=>j.state==='queued'));
});
test('new queue entries during saving are picked up without reordering snapshots',async()=>{
  const f=fixture(2),save=f.io.saveMetadata;f.io.saveMetadata=async j=>{await save(j);if(j.id==='0')f.jobs.push({id:'2',title:'late',prompt:'prompt2',state:'queued',saved:[]});};
  await runQueue(f.jobs,f.io,{limit:3});assert.deepEqual(f.events.filter(e=>e.startsWith('submit')),['submit0','submit1','submit2']);assert(f.jobs.every(j=>j.state==='done'));
});
test('invalid registration limits and option values are rejected before paid work; legacy backups stay valid',async()=>{
  for(const limit of [0,11,1.5,NaN]){const f=fixture();await assert.rejects(runQueue(f.jobs,f.io,{limit}));assert.equal(f.events.length,0);}
  const old={maxCredits:null,filePrefix:'',repeat:1};assert.deepEqual(normalizeSettingsOptions(old),old);
  assert.deepEqual(normalizeSettingsOptions({...old,maxInFlight:3,imageCount:4}),{...old,maxInFlight:3,imageCount:4});
  for(const imageCount of [-1,2,3,5,null])assert.throws(()=>normalizeSettingsOptions({...old,imageCount}));
  for(const maxInFlight of [0,11,null])assert.throws(()=>normalizeSettingsOptions({...old,maxInFlight}));
});
test('library placement moves before/after a target and rejects stale IDs without mutating input',()=>{
  const l=makePresetLibrary();l.chunkFolders=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];
  assert.deepEqual(placeLibraryItem(l,'chunkFolders','c','a').chunkFolders.map(i=>i.id),['c','a','b']);
  assert.deepEqual(placeLibraryItem(l,'chunkFolders','a','c',true).chunkFolders.map(i=>i.id),['b','c','a']);
  assert.deepEqual(l.chunkFolders.map(i=>i.id),['a','b','c']);assert.throws(()=>placeLibraryItem(l,'chunkFolders','gone','a'));assert.throws(()=>placeLibraryItem(l,'scenes','a','b'));
});
