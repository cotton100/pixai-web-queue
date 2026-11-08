'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const core=require('./pixai-web-queue.user.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const token='synthetic-token-'.repeat(4),key='local.pixai-web-queue.library-sync.v1';
function library(){return core.normalizePresetLibrary({version:1,common:{prompt:'before',negativePrompt:''},presets:[{id:'p',name:'Preset',model:{id:'101',versionId:'201',name:'Model'},loras:[]}],characters:[{id:'c',name:'Character',prompt:'character',negativePrompt:''}],scenes:[{id:'s',name:'Chunk',prompt:'chunk',negativePrompt:''}],reservations:[{id:'r',presetId:'p',characterId:'c',sceneIds:['s'],count:2}],combinations:[{id:'history',presetId:'p',characterId:'c',sceneIds:['s'],count:1,favorite:true,name:'History',at:1}]});}
const projection=value=>core.projectSyncLibrary(value||library());
function fixture(initial=library(),records=new Map()){
    let saved=copy(initial),reply=async()=>({state:'idle'}),failSave=false,dirty=false,beforeSave=null,writeReadback=true;
    const calls=[],saves=[],timers=new Map(),states=[];let timerId=0;
    const storage={get:(k,fallback)=>records.has(k)?copy(records.get(k)):fallback,set:(k,value)=>records.set(k,copy(value)),remove:k=>records.delete(k)};
    const client=core.createLibrarySyncClient({storage,read:()=>copy(saved),request:async(path,body,bearer)=>{calls.push({path,body:copy(body),bearer});return path==='pair'?{token}:reply(path,body,bearer);},
        assertReady:()=>{if(dirty)throw Error('unsaved editor or generation busy');},save:async(expected,next)=>{await beforeSave?.();if(dirty)throw Error('dirty while waiting for lock');if(failSave)throw Error('disk full');assert.deepEqual(saved,expected,'CAS must compare the whole saved library, including queue reservations');if(writeReadback)saved=copy(next);saves.push(copy(next));},
        changed:value=>states.push(copy(value)),setTimeout:(run,ms)=>{const id=++timerId;timers.set(id,{run,ms});return id;},clearTimeout:id=>timers.delete(id)});
    client.start();return {client,records,calls,saves,timers,states,setReply:fn=>{reply=fn;},saved:()=>copy(saved),change:fn=>{fn(saved);},setDirty:value=>{dirty=value;},failSave:value=>{failSave=value;},beforeSave:fn=>{beforeSave=fn;},writeReadback:value=>{writeReadback=value;}};
}
async function transfer(f,next){return {state:'apply',transactionId:'tx',library:projection(next),expectedScriptHash:await core.syncLibraryHash(projection(f.saved()))};}
async function linked(){const f=fixture();await f.client.pair('one-time-code');return f;}

test('library projection excludes local history, reservations, credentials, options, and output data',()=>{
    const source={...library(),apiKey:'must never leave',options:{token:'private'},jobs:[{taskId:'local'}],path:'C:/private',images:['local']},result=projection(source);
    assert.deepEqual(Object.keys(result).sort(),['version','common',...core.SYNC_COLLECTIONS].sort());
    const text=JSON.stringify(result);for(const forbidden of ['reservations','combinations','must never leave','private','taskId','images'])assert(!text.includes(forbidden));
    assert.equal(result.scenes[0].prompt,'chunk');
});
test('incoming unknown fields and malformed nested objects are rejected without mutating current library',()=>{
    const old=library(),before=copy(old);
    for(const mutate of [v=>v.apiKey='secret',v=>v.presets[0].model.cookie='secret',v=>v.characters[0].token='secret',v=>v.sceneCards=[{id:'bad',name:'bad',sceneIds:['s'],chunks:[]}],v=>v.characters[0].folderId='missing']){
        const next=projection();mutate(next);assert.throws(()=>core.applySyncLibrary(old,next));assert.deepEqual(old,before);
    }
    assert.throws(()=>core.parseSyncLibrary(JSON.parse('{"__proto__":{"polluted":true}}')));assert.equal({}.polluted,undefined);
});
test('canonical wire digest is object-order independent, array-order sensitive, and rejects non-JSON values',async()=>{
    assert.equal(core.canonicalSync({b:2,a:1}),core.canonicalSync({a:1,b:2}));
    assert.notEqual(await core.syncLibraryHash([1,2]),await core.syncLibraryHash([2,1]));
    const cyclic={};cyclic.a=cyclic;for(const value of [cyclic,{a:undefined},NaN,new Date(),{constructor:'bad'}])assert.throws(()=>core.canonicalSync(value));
});
test('replacing or deleting materials freezes old pending reservation settings and preserves local history',()=>{
    const old=library(),before=copy(old),next=projection();next.common.prompt='new';next.presets=[];next.characters=[];next.scenes=[];
    const result=core.applySyncLibrary(old,next);assert.deepEqual(old,before);assert.deepEqual(result.combinations,before.combinations);
    assert.equal(result.reservations[0].snapshot.common.prompt,'before');assert.equal(result.reservations[0].snapshot.character.prompt,'character');assert.equal(result.reservations[0].count,2);
    assert.equal(core.expandPresetReservations(result).length,2);assert.match(core.expandPresetReservations(result)[0].prompt,/before.*character.*chunk/);
    const again=core.applySyncLibrary(result,next);assert.deepEqual(again.reservations,result.reservations);
});
test('unresolvable unsnapshotted reservation refuses replacement instead of losing pending work',()=>{
    const old=library();old.reservations[0].presetId='missing';assert.throws(()=>core.applySyncLibrary(old,projection()));assert.equal(old.reservations[0].presetId,'missing');
});
test('connection is off by default, polls only linked every ten seconds, and stores token only in GM state',async()=>{
    const f=fixture();assert.equal(f.client.state().linked,false);assert.equal(f.client.state().automatic,false);assert.equal(f.timers.size,0);assert.equal(f.calls.length,0);
    await f.client.pair('one-time-code');assert.equal(f.records.get(key).token,token);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].ms,10000);
    assert(!JSON.stringify(f.states).includes(token));assert(!JSON.stringify(f.client.state()).includes('one-time-code'));
    await f.client.sync();assert.equal(f.calls.at(-1).body.automatic,false);assert.equal(f.calls.at(-1).body.requestSync,true);
    f.client.disconnect();assert.equal(f.records.has(key),false);assert.equal(f.timers.size,0);assert.deepEqual(f.saved(),library());
});
test('automatic preference persists independently of library backups and resets on new pairing',async()=>{
    const f=await linked();f.client.setAutomatic(true);const restored=fixture(library(),f.records);assert.equal(restored.client.state().automatic,true);assert.equal(restored.timers.size,1);
    await restored.client.sync(false);assert.equal(restored.calls.at(-1).body.automatic,true);assert.equal(restored.calls.at(-1).body.requestSync,false);
    await restored.client.pair('new-code');assert.equal(restored.client.state().automatic,false);
    assert(!JSON.stringify(core.makeSettingsBackup(restored.saved(),{maxCredits:null,filePrefix:'test',repeat:1},{appVersion:'0.10.19',exportedAt:'2026-11-08T00:00:00.000Z'})).includes(token));
});
test('first preview does not save or acknowledge and explicit approval follows the wire contract',async()=>{
    const f=await linked(),next=library();next.common.prompt='merged';const apply=await transfer(f,next),p={id:'proposal',initial:true,library:projection(next),conflicts:[],appCount:3,scriptCount:3,mergedCount:3};
    f.setReply(async path=>path==='exchange'?{state:'preview',proposal:p}:path==='approve'?apply:{state:'idle'});
    await f.client.sync();assert.equal(f.saves.length,0);assert.equal(f.client.state().exchange.state,'preview');
    await f.client.approve('proposal',{});assert.equal(f.saves.length,1);assert.equal(f.saved().common.prompt,'merged');assert.equal(f.calls.at(-1).path,'ack');assert.equal(f.calls.at(-1).body.id,'tx');
});
test('stale projection refuses an inbound write and sends no acknowledgement',async()=>{
    const f=await linked(),next=library();next.common.prompt='merged';const apply=await transfer(f,next);f.change(v=>v.common.prompt='local edit');f.setReply(async()=>apply);
    await f.client.sync();assert.equal(f.saves.length,0);assert.equal(f.client.state().exchange.state,'blocked');assert.equal(f.saved().common.prompt,'local edit');assert(!f.calls.some(v=>v.path==='ack'));
});
test('local edits after preview refuse approval before the app can write',async()=>{
    const f=await linked(),p={id:'proposal',initial:true,library:projection(),conflicts:[],appCount:3,scriptCount:3,mergedCount:3};f.setReply(async()=>({state:'preview',proposal:p}));await f.client.sync();f.change(v=>v.common.prompt='saved after preview');
    await assert.rejects(f.client.approve('proposal',{}),/자료가 변경/);assert(!f.calls.some(v=>v.path==='approve'));assert.equal(f.saved().common.prompt,'saved after preview');
});
test('failed local save never acknowledges, and subsequent retry preserves the pending reservation',async()=>{
    const f=await linked(),next=library();next.common.prompt='merged';const apply=await transfer(f,next);f.setReply(async path=>path==='ack'?{state:'idle'}:apply);f.failSave(true);
    await assert.rejects(f.client.sync(),/disk full/);assert.equal(f.saved().common.prompt,'before');assert(!f.calls.some(v=>v.path==='ack'));
    f.failSave(false);await f.client.sync();assert.equal(f.saved().common.prompt,'merged');assert.equal(f.saved().reservations[0].snapshot.common.prompt,'before');
});
test('lost acknowledgement is retried without rewriting the library, including after client restart',async()=>{
    const f=await linked(),next=library();next.common.prompt='merged';const apply=await transfer(f,next);let lost=true;f.setReply(async path=>{if(path==='ack'){if(lost)throw Error('offline ack');return {state:'idle'};}return apply;});
    await assert.rejects(f.client.sync(),/offline ack/);assert.equal(f.saves.length,1);lost=false;await f.client.sync();assert.equal(f.saves.length,1);
    const restored=fixture(f.saved(),f.records);restored.setReply(async path=>path==='ack'?{state:'idle'}:apply);await restored.client.sync();assert.equal(restored.saves.length,0);assert.equal(restored.calls.at(-1).path,'ack');
});
test('persisted readback mismatch blocks acknowledgement even if save callback claims success',async()=>{
    const f=await linked(),next=library();next.common.prompt='merged';const apply=await transfer(f,next);f.setReply(async()=>apply);f.writeReadback(false);
    await assert.rejects(f.client.sync(),/저장 내용을 확인/);assert(!f.calls.some(v=>v.path==='ack'));
});
test('full-library CAS prevents concurrent reservation edits from being overwritten',async()=>{
    const f=await linked(),next=library();next.common.prompt='merged';const apply=await transfer(f,next);f.setReply(async()=>apply);f.beforeSave(()=>f.change(v=>v.reservations[0].count=3));
    await assert.rejects(f.client.sync(),/CAS/);assert.equal(f.saved().reservations[0].count,3);assert.equal(f.saved().common.prompt,'before');assert(!f.calls.some(v=>v.path==='ack'));
});
test('dirty or generation-busy state blocks polling and rechecks immediately before persistence',async()=>{
    const f=await linked();f.setDirty(true);const count=f.calls.length;await assert.rejects(f.client.sync(),/unsaved/);await f.client.sync(false);assert.equal(f.calls.length,count);
    f.setDirty(false);const next=library();next.common.prompt='merged';const apply=await transfer(f,next);f.setReply(async()=>apply);f.beforeSave(()=>f.setDirty(true));
    await assert.rejects(f.client.sync(),/dirty while/);assert.equal(f.saves.length,0);assert(!f.calls.some(v=>v.path==='ack'));
});
test('offline keeps pairing and schedules one later poll; auth failure keeps data but stops automatic retry',async()=>{
    const f=await linked(),before=f.saved();f.setReply(async()=>{throw Object.assign(Error('offline'),{offline:true});});await f.client.sync(false);assert.equal(f.records.get(key).token,token);assert.equal(f.timers.size,1);assert.deepEqual(f.saved(),before);
    f.setReply(async()=>{throw Object.assign(Error('unauthorized'),{status:401});});await f.client.sync(false);assert.equal(f.records.get(key).token,token);assert.equal(f.timers.size,0);assert.deepEqual(f.saved(),before);
    f.setReply(async()=>({state:'idle'}));await f.client.sync();assert.equal(f.timers.size,1);
});
test('concurrent manual requests cannot double-apply, and a busy disconnect cannot clear a live token',async()=>{
    const f=await linked();let done;f.setReply(()=>new Promise(resolve=>{done=resolve;}));const pending=f.client.sync();await assert.rejects(f.client.sync(),/요청이 끝난/);assert.throws(()=>f.client.disconnect(),/요청이 끝난/);assert.equal(f.calls.filter(v=>v.path==='exchange').length,1);done({state:'idle'});await pending;
});
test('GM request uses only fixed loopback POST, anonymous transport, bounded timeout and bearer auth',async()=>{
    let request;const send=core.createLibrarySyncTransport(options=>{request=options;options.onload({status:200,responseHeaders:'Content-Type: application/json; charset=utf-8',responseText:'{"state":"idle"}',finalUrl:options.url});});
    await send('exchange',{library:projection(),automatic:false},token);assert.equal(request.url,'http://127.0.0.1:50321/v1/library-sync/exchange');assert.equal(request.method,'POST');assert.equal(request.anonymous,true);assert.equal(request.redirect,'error');assert.equal(request.timeout,5000);assert.equal(request.headers.Authorization,'Bearer '+token);
    await assert.rejects(send('../outside',{}));await assert.rejects(send('exchange',{large:'x'.repeat(21*1024*1024)},token));
});
test('GM transport rejects redirects, non-json, oversized responses and uses safe non-reflecting auth errors',async()=>{
    for(const response of [{status:200,finalUrl:'https://example.invalid',responseText:'{}'},{status:200,responseHeaders:'Content-Type: text/html',responseText:'{}'},{status:200,responseHeaders:'Content-Type: application/json',responseText:'bad json'},{status:200,responseHeaders:'Content-Type: application/json',responseText:'x'.repeat(61*1024*1024)},{status:401,responseText:token}]){
        const send=core.createLibrarySyncTransport(options=>options.onload(response));await assert.rejects(send('exchange',{},token),error=>!error.message.includes(token));
    }
});
test('owned deadline aborts an unresponsive GM fetch and late callbacks cannot settle it twice',async()=>{
    let timeout,options,aborted=0,cleared=0;
    const send=core.createLibrarySyncTransport(value=>{options=value;return {abort(){aborted++;options.onabort();}};},{setTimeout:(run,ms)=>{timeout=run;assert.equal(ms,5000);return 1;},clearTimeout:id=>{assert.equal(id,1);cleared++;}});
    const pending=send('exchange',{},token);timeout();await assert.rejects(pending,/오프라인/);assert.equal(aborted,1);assert.equal(cleared,1);
    options.onload({status:200,responseHeaders:'Content-Type: application/json',responseText:'{"state":"idle"}'});assert.equal(cleared,1);
});
test('both built install files grant only fixed loopback and include module and real guarded persistence',()=>{
    for(const file of ['pixai-web-queue.user.js','pixai-web-queue.dev.user.js']){const source=fs.readFileSync(file,'utf8');assert(source.includes('// @connect      127.0.0.1'));assert(source.includes('// BEGIN LIBRARY SYNC'));assert(source.includes('locked(()=>saveLibrary(next,expected,'));assert(source.includes('presetEditor.hasDirty()'));}
});
