'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('./pixai-web-queue.user.js');
const PREFIX='local.pixai-web-queue.';
const LIBRARY=PREFIX+'presets.v1',QUEUE=PREFIX+'v1',OPTIONS=PREFIX+'options.v1',PREVIOUS=PREFIX+'before-import.v1';
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const quota=()=>Object.assign(new Error('fixture quota'),{name:'QuotaExceededError'});
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const slot=(key,id)=>PREFIX+'storage.v1:'+key+':'+id;
function fixture(initial={}) {
  const nativeData=new Map(Object.entries(initial)),records=new Map(),nativeCalls=[],managerCalls=[];
  let capacity=Infinity,serial=0,nativeFailure=null,managerFailure=null,managerRead=null;
  const usage=data=>[...data].reduce((sum,[key,value])=>sum+2*(key.length+value.length),0);
  const native={
    getItem(key){nativeCalls.push({op:'get',key});return nativeData.get(key)??null;},
    setItem(key,value){value=String(value);nativeCalls.push({op:'set',key,value});nativeFailure?.('set',key,value);const next=new Map(nativeData);next.set(key,value);if(usage(next)>capacity)throw quota();nativeData.set(key,value);},
    removeItem(key){nativeCalls.push({op:'remove',key});nativeFailure?.('remove',key);nativeData.delete(key);}
  };
  const manager={
    get(key,fallback=null){managerCalls.push({op:'get',key});managerFailure?.('get',key);return managerRead?managerRead(key,fallback):records.has(key)?clone(records.get(key)):fallback;},
    set(key,value){managerCalls.push({op:'set',key,value:clone(value)});managerFailure?.('set',key,value);records.set(key,clone(value));},
    remove(key){managerCalls.push({op:'remove',key});managerFailure?.('remove',key);records.delete(key);}
  };
  return {native,nativeData,records,manager,nativeCalls,managerCalls,
    store:()=>core.createUserscriptStorage(native,manager,()=>uuid(++serial)),
    setCapacity:value=>{capacity=value;},usage:()=>usage(nativeData),
    failNative:fn=>{nativeFailure=fn;},failManager:fn=>{managerFailure=fn;},readManager:fn=>{managerRead=fn;}
  };
}
function library(prompt='original common') {return {...core.makePresetLibrary(),common:{prompt,negativePrompt:''}};}
function queue(count=327) {return JSON.stringify({version:1,jobs:Array.from({length:count},(_,i)=>({id:'job-'+i,state:'done',taskId:String(1000+i),prompt:'synthetic prompt '.repeat(5),saved:[]}))});}

test('constructing and reading legacy records never migrates or normalizes their raw strings',()=>{
  const original='  {"version":1,"text":"line\\nline"}  ',f=fixture({[LIBRARY]:original,'pixai.site':'untouched'}),store=f.store();
  assert.equal(store.getItem(LIBRARY),original);assert.equal(store.getItem(OPTIONS),null);
  assert.equal(f.nativeCalls.filter(v=>v.op!=='get').length,0);assert.equal(f.managerCalls.filter(v=>v.op!=='get').length,0);
  assert.equal(f.nativeData.get('pixai.site'),'untouched');
});

test('preparing large legacy records frees native quota while preserving all 327 queued records and exact library data',()=>{
  const originals={[LIBRARY]:core.encodeLocalPresetLibrary(library('original '.repeat(1000))),[QUEUE]:queue(),[OPTIONS]:JSON.stringify({maxCredits:null,filePrefix:'assets',repeat:1})};
  const f=fixture(originals),store=f.store();f.setCapacity(f.usage());assert.throws(()=>f.native.setItem(LIBRARY,originals[LIBRARY]+'more'),/quota/);
  store.prepareWrite([LIBRARY,QUEUE]);
  for(const key of [LIBRARY,QUEUE])assert.equal(store.getItem(key),originals[key]);
  assert.equal(JSON.parse(store.getItem(QUEUE)).jobs.length,327);assert(f.usage()<2000);
  const next=core.encodeLocalPresetLibrary(library('new common '.repeat(2000)));store.setItem(LIBRARY,next);assert.equal(store.getItem(LIBRARY),next);
  assert.equal(store.getItem(QUEUE),originals[QUEUE]);assert.equal(store.getItem(OPTIONS),originals[OPTIONS]);
});

test('preparing an empty queue before a large library at full quota frees the large record first',()=>{
  const originals={[QUEUE]:queue(0),[LIBRARY]:core.encodeLocalPresetLibrary(library('large original '.repeat(1000)))},f=fixture(originals),store=f.store();f.setCapacity(f.usage());
  store.prepareWrite([QUEUE,LIBRARY]);assert.equal(store.getItem(QUEUE),originals[QUEUE]);assert.equal(store.getItem(LIBRARY),originals[LIBRARY]);
  assert.equal(f.nativeData.get(QUEUE),originals[QUEUE]);assert.equal(JSON.parse(f.nativeData.get(LIBRARY)).pixaiQueueStorage,1);
  core.atomicRecordWrite(store,{[QUEUE]:queue(1),[LIBRARY]:core.encodeLocalPresetLibrary(library('next common'))},LIBRARY+'.before-registration');
  assert.equal(JSON.parse(store.getItem(QUEUE)).jobs.length,1);assert.equal(core.decodeLocalPresetLibrary(store.getItem(LIBRARY)).common.prompt,'next common');
  assert.equal(JSON.parse(store.getItem(LIBRARY+'.before-registration'))[QUEUE],originals[QUEUE]);
});

test('committed pointers identify immutable revision records and retain only current and previous revisions',()=>{
  const f=fixture(),store=f.store();
  store.setItem(LIBRARY,'first');const first=JSON.parse(f.nativeData.get(LIBRARY));
  assert.deepEqual(first,{pixaiQueueStorage:1,version:-1,record:uuid(1),previous:null});
  assert.deepEqual(f.records.get(slot(LIBRARY,first.record)),{version:1,record:first.record,value:'first'});
  store.setItem(LIBRARY,'second');const second=JSON.parse(f.nativeData.get(LIBRARY));assert.equal(second.previous,first.record);
  store.setItem(LIBRARY,'third');const third=JSON.parse(f.nativeData.get(LIBRARY));assert.equal(third.previous,second.record);
  assert.equal(f.records.has(slot(LIBRARY,first.record)),false);assert.equal(f.records.get(slot(LIBRARY,second.record)).value,'second');
  assert.equal(store.getItem(LIBRARY),'third');assert.equal(f.records.size,2);
});

test('failed GM writes and readback verification leave the exact legacy native value intact',()=>{
  for(const mode of ['write','missing-readback','wrong-readback']) {
    const f=fixture({[LIBRARY]:'legacy original'}),store=f.store();
    if(mode==='write')f.failManager(op=>{if(op==='set')throw quota();});
    else f.readManager((key,fallback)=>f.records.has(key)?mode==='missing-readback'?fallback:{...clone(f.records.get(key)),value:'corrupt readback'}:fallback);
    assert.throws(()=>store.setItem(LIBRARY,'new value'));assert.equal(f.nativeData.get(LIBRARY),'legacy original');
    assert.equal(f.nativeCalls.filter(v=>v.op==='set').length,0);
  }
});

test('native pointer commit failure preserves the active previous value and no fallback value is reported',()=>{
  const f=fixture({[LIBRARY]:'legacy'}),store=f.store();store.setItem(LIBRARY,'current');const originalPointer=f.nativeData.get(LIBRARY);
  f.failNative(op=>{if(op==='set')throw quota();});assert.throws(()=>store.setItem(LIBRARY,'uncommitted'));
  assert.equal(f.nativeData.get(LIBRARY),originalPointer);assert.equal(store.getItem(LIBRARY),'current');
});

test('an intervening native write is detected before committing a newly prepared revision',()=>{
  const f=fixture({[LIBRARY]:'legacy'}),store=f.store();
  f.failManager((op,key)=>{if(op==='set'&&key.startsWith(slot(LIBRARY,'')))f.nativeData.set(LIBRARY,'concurrent library');});
  assert.throws(()=>store.setItem(LIBRARY,'stale editor'));assert.equal(f.nativeData.get(LIBRARY),'concurrent library');
  assert.equal(f.nativeCalls.filter(v=>v.op==='set').length,0);
});

test('a second tab with stale GM cache fails closed when the native pointer has advanced',()=>{
  const f=fixture({[QUEUE]:queue(1)}),writer=f.store();writer.setItem(QUEUE,queue(2));const cached=new Map([...f.records].map(([key,value])=>[key,clone(value)]));
  const reader=core.createUserscriptStorage(f.native,{get:(key,fallback)=>cached.has(key)?clone(cached.get(key)):fallback,set(){throw Error('read-only stale cache');},remove(){}},()=>uuid(100));
  assert.equal(JSON.parse(reader.getItem(QUEUE)).jobs.length,2);writer.setItem(QUEUE,queue(3));
  assert.throws(()=>reader.getItem(QUEUE));assert.equal(JSON.parse(writer.getItem(QUEUE)).jobs.length,3);
});

test('runner reload rejects a stale GM cache before allowing an action that could submit paid work',async()=>{
  const f=fixture({[QUEUE]:queue(1)}),writer=f.store();writer.setItem(QUEUE,queue(2));
  const cached=new Map([...f.records].map(([key,value])=>[key,clone(value)])),reader=core.createUserscriptStorage(f.native,{get:(key,fallback)=>cached.has(key)?clone(cached.get(key)):fallback,set(){throw Error('stale');},remove(){}},()=>uuid(100));
  writer.setItem(QUEUE,queue(3));
  const source=fs.readFileSync(require('node:path').join(__dirname,'pixai-web-queue.user.js'),'utf8'),start=source.indexOf('  function load() {'),end=source.indexOf('  async function getTask(',start);
  assert(start>=0&&end>start);let actions=0;
  const context={KEY:QUEUE,LOCK:PREFIX+'runner.v1',localStorage:reader,dataStorage:reader,jobs:[],recover:core.recover,navigator:{locks:{request:async(_name,_options,run)=>run({})}},render(){}};
  vm.runInNewContext(source.slice(start,end)+'\nthis.runLocked=locked;',context);
  await assert.rejects(context.runLocked(()=>{actions++;}));assert.equal(actions,0);
});

test('malformed pointers, missing records and revision or value mismatches cannot fall back to legacy data',()=>{
  for(const mutate of [f=>f.records.clear(),
    f=>{const key=[...f.records.keys()][0];f.records.set(key,{version:1,record:uuid(99),value:'stale value'});},
    f=>{const key=[...f.records.keys()][0];f.records.set(key,{version:1,record:uuid(1),value:{unexpected:'object'}});},
    f=>f.nativeData.set(LIBRARY,JSON.stringify({pixaiQueueStorage:1,version:-1,record:'../other',previous:null})),
    f=>f.nativeData.set(LIBRARY,JSON.stringify({pixaiQueueStorage:1,version:0,record:uuid(1),previous:null}))]) {
    const f=fixture({[LIBRARY]:'legacy'}),store=f.store();store.setItem(LIBRARY,'current');mutate(f);assert.throws(()=>store.getItem(LIBRARY));
  }
});

test('remove creates an explicit null tombstone instead of resurrecting the pre-migration native value',()=>{
  const f=fixture({[LIBRARY]:'legacy original'}),store=f.store();store.setItem(LIBRARY,'current');store.removeItem(LIBRARY);
  assert.equal(store.getItem(LIBRARY),null);assert.equal(f.nativeData.has(LIBRARY),true);
  const pointer=JSON.parse(f.nativeData.get(LIBRARY));assert.equal(pointer.version,-1);assert.equal(f.records.get(slot(LIBRARY,pointer.record)).value,null);
  assert.equal(f.nativeCalls.filter(v=>v.op==='remove').length,0);assert.equal(f.store().getItem(LIBRARY),null);
});

test('cleanup failure leaves an orphan but never turns a committed write into a reported failure',()=>{
  const f=fixture(),store=f.store();store.setItem(LIBRARY,'one');store.setItem(LIBRARY,'two');
  f.failManager(op=>{if(op==='remove')throw Error('cleanup unavailable');});
  assert.doesNotThrow(()=>store.setItem(LIBRARY,'three'));assert.equal(store.getItem(LIBRARY),'three');assert.equal(f.records.size,3);
});

test('a revision collision never overwrites an immutable record that an existing pointer uses',()=>{
  const f=fixture(),store=core.createUserscriptStorage(f.native,f.manager,()=>uuid(1));store.setItem(LIBRARY,'one');const before=f.nativeData.get(LIBRARY);
  assert.throws(()=>store.setItem(LIBRARY,'two'));assert.equal(f.nativeData.get(LIBRARY),before);assert.equal(store.getItem(LIBRARY),'one');
});

test('manager-unavailable mode retains ordinary native behavior but refuses migrated pointers',()=>{
  const f=fixture({[LIBRARY]:'legacy'}),fallback=core.createUserscriptStorage(f.native,null,()=>uuid(100));
  assert.equal(fallback.getItem(LIBRARY),'legacy');fallback.prepareWrite([LIBRARY]);fallback.setItem(LIBRARY,'edited legacy');assert.equal(f.nativeData.get(LIBRARY),'edited legacy');
  fallback.removeItem(LIBRARY);assert.equal(f.nativeData.has(LIBRARY),false);
  f.store().setItem(LIBRARY,'migrated');for(const run of [()=>fallback.getItem(LIBRARY),()=>fallback.setItem(LIBRARY,'replacement'),()=>fallback.removeItem(LIBRARY),()=>fallback.prepareWrite([LIBRARY])])assert.throws(run);
});

test('foreign keys and API-key slots are refused without reading or writing either underlying store',()=>{
  for(const useManager of [true,false]) {
    const f=fixture({'pixai.site':'untouched','pixai.official-api-key.v1':'fake secret'}),store=core.createUserscriptStorage(f.native,useManager?f.manager:null,()=>uuid(1));
    for(const key of ['pixai.site','pixai.official-api-key.v1','local.pixai-web-queueevil','local.pixai-web-queue.api-key.v1','local.pixai-web-queue.api-key','']) {
      for(const run of [()=>store.getItem(key),()=>store.setItem(key,'x'),()=>store.removeItem(key),()=>store.prepareWrite([key])])assert.throws(run);
    }
    assert.equal(f.nativeCalls.length,0);assert.equal(f.managerCalls.length,0);
  }
});

test('native pointers are rejected by old queue and library readers instead of appearing empty',()=>{
  const libraryRaw=core.encodeLocalPresetLibrary(library()),f=fixture({[LIBRARY]:libraryRaw,[QUEUE]:queue()}),store=f.store();store.prepareWrite([LIBRARY,QUEUE]);store.setItem(LIBRARY,libraryRaw);
  const queuePointer=JSON.parse(f.nativeData.get(QUEUE));assert.notEqual(queuePointer.version,1);assert.equal(Array.isArray(queuePointer.jobs),false);
  assert.throws(()=>core.decodeLocalPresetLibrary(f.nativeData.get(LIBRARY)));assert.equal(core.decodeLocalPresetLibrary(store.getItem(LIBRARY)).common.prompt,'original common');
});

test('atomic queue registration rolls back both raw records after the second write fails',()=>{
  const originals={[LIBRARY]:core.encodeLocalPresetLibrary(library('old '.repeat(1000))),[QUEUE]:queue()},f=fixture(originals),store=f.store();f.setCapacity(f.usage());
  const newLibrary=core.encodeLocalPresetLibrary(library('new common'));let rejected=false;
  f.failManager((op,_key,value)=>{if(op==='set'&&value.value===newLibrary&&!rejected){rejected=true;throw quota();}});
  assert.throws(()=>core.atomicRecordWrite(store,{[QUEUE]:queue(328),[LIBRARY]:newLibrary},LIBRARY+'.before-registration'),/저장 실패.*되돌렸/);
  assert.equal(rejected,true);assert.equal(store.getItem(QUEUE),originals[QUEUE]);assert.equal(store.getItem(LIBRARY),originals[LIBRARY]);
  assert.deepEqual(JSON.parse(store.getItem(LIBRARY+'.before-registration')),originals);
});

test('settings import and repeated undo preserve raw originals across revision cleanup',()=>{
  const originals={[LIBRARY]:core.encodeLocalPresetLibrary(library('old '.repeat(1000))),[OPTIONS]:JSON.stringify({maxCredits:7800,filePrefix:'original',repeat:1}),[QUEUE]:queue()};
  const f=fixture(originals),store=f.store(),settings=core.createSettingsStore(store,{library:LIBRARY,options:OPTIONS,previous:PREVIOUS});f.setCapacity(f.usage());
  settings.apply({library:library('imported'),options:{maxCredits:null,filePrefix:'imported',repeat:2}});
  assert.equal(core.decodeLocalPresetLibrary(store.getItem(LIBRARY)).common.prompt,'imported');
  for(let i=0;i<4;i++)store.setItem(LIBRARY,core.encodeLocalPresetLibrary(library('later '+i)));
  assert.equal(settings.undo(),true);assert.equal(store.getItem(LIBRARY),originals[LIBRARY]);assert.equal(store.getItem(OPTIONS),originals[OPTIONS]);
  assert.equal(store.getItem(QUEUE),originals[QUEUE]);assert.equal(settings.undo(),true);assert.equal(settings.hasPrevious(),true);
});

test('image import atomic writes preserve raw library, options and draft when a later write fails',()=>{
  const draft=PREFIX+'compose.v1',oldLibrary=core.encodeLocalPresetLibrary(library()),originals={[LIBRARY]:oldLibrary,[OPTIONS]:'old options',[draft]:'old draft'},f=fixture(originals),store=f.store();
  let rejected=false;f.failManager((op,_key,value)=>{if(op==='set'&&value.value==='new draft'&&!rejected){rejected=true;throw quota();}});
  assert.throws(()=>core.atomicRecordWrite(store,{[LIBRARY]:core.encodeLocalPresetLibrary(library('new')),[OPTIONS]:'new options',[draft]:'new draft'},LIBRARY+'.before-image-import'));
  assert.equal(rejected,true);for(const [key,value] of Object.entries(originals))assert.equal(store.getItem(key),value);
  assert.deepEqual(JSON.parse(store.getItem(LIBRARY+'.before-image-import')),originals);
});
