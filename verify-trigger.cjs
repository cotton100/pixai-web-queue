const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={module:{exports:{}},URL};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8'),sandbox);
const {readLoraTriggerWords,readOfficialLoraTriggerWords,capturePresetSettings}=sandbox.module.exports;
const plain=value=>JSON.parse(JSON.stringify(value));
const selected={id:'10',versionId:'101',name:'LoRA',weight:0};
const requested='https://pixai.art/model/10/101';

function timerFixture() {
  let callback=null,token=null,cleared=0,delay=null;
  return {
    setTimeout(fn,ms){callback=fn;delay=ms;token={timer:true};return token;},
    clearTimeout(value){assert.equal(value,token);cleared++;callback=null;},
    fire(){assert.ok(callback,'timeout is registered');callback();},
    get delay(){return delay;},get cleared(){return cleared;}
  };
}
function htmlFixture(options={}) {
  const canonical=options.missingCanonical?null:{getAttribute:()=>options.canonical??'https://pixai.art/model/10'};
  const paragraphs=(options.paragraphs??['harukav2 style']).map(textContent=>({textContent}));
  const dd={tagName:options.valueTag??'DD',textContent:options.valueText??paragraphs.map(item=>item.textContent).join(''),
    querySelector:selector=>selector==='script,style'&&options.activeContent?{}:null,
    querySelectorAll:selector=>selector==='p'?paragraphs:[]};
  const terms=Array.from({length:options.termCount??1},()=>({textContent:options.termName??'Trigger Words',nextElementSibling:options.missingValue?null:dd}));
  return {
    querySelector:selector=>selector==='link[rel="canonical"]'?canonical:null,
    querySelectorAll:selector=>selector==='dt'?terms:[]
  };
}
function responseFixture(options={}) {
  return {ok:options.ok??true,status:options.status??200,url:options.url??requested,
    headers:{get:()=>options.contentType===null?null:options.contentType??'text/html; charset=utf-8'},
    text:options.text??(async()=>'<public model-page fixture>')};
}
function readerFixture(options={}) {
  const timers=timerFixture(),calls=[],parsed=[];
  const io={AbortController,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,
    fetch:async(url,request)=>{calls.push({url,request});return options.response??responseFixture();},
    parseHtml:html=>{parsed.push(html);return options.doc??htmlFixture();}};
  return {io,timers,calls,parsed};
}

test('public trigger reader uses a fixed numeric version URL, omits credentials, and blocks redirects',async()=>{
  const f=readerFixture();assert.equal(await readLoraTriggerWords(selected,f.io),'harukav2 style');
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,requested);
  const options=f.calls[0].request;
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.method,undefined);assert.equal(options.body,undefined);assert.equal(options.headers,undefined);
  assert.equal(f.parsed.length,1);assert.equal(f.timers.delay,8000);assert.equal(f.timers.cleared,1);
});
test('invalid model identifiers and version strings cannot reach fetch or construct arbitrary URLs',async()=>{
  for(const lora of [{...selected,id:'../10'},{...selected,id:'10?token=x'},{...selected,id:10},
    {...selected,versionId:'101/../../other'},{...selected,versionId:'https://example.test'},{...selected,versionId:''}]) {
    const f=readerFixture();await assert.rejects(readLoraTriggerWords(lora,f.io),/ID|문자열/);
    assert.equal(f.calls.length,0);assert.equal(f.parsed.length,0);
  }
});
test('HTTP failure, different origin/path, and non-HTML content reject before parsing',async()=>{
  for(const response of [responseFixture({ok:false,status:404}),responseFixture({url:'https://example.test/en/model/10/101'}),
    responseFixture({url:'https://pixai.art/en/model/20/101'}),responseFixture({url:'https://pixai.art/en/model/10/102'}),
    responseFixture({contentType:'application/json'}),responseFixture({contentType:null})]) {
    const f=readerFixture({response});await assert.rejects(readLoraTriggerWords(selected,f.io),/公開|공개 상세/);
    assert.equal(f.parsed.length,0);assert.equal(f.timers.cleared,1);assert.equal(f.calls.length,1);
  }
});
test('a fetch redirect rejection is not retried and always clears its timeout',async()=>{
  const f=readerFixture();f.io.fetch=async(url,request)=>{f.calls.push({url,request});throw new TypeError('redirect blocked');};
  await assert.rejects(readLoraTriggerWords(selected,f.io),/redirect blocked/);
  assert.equal(f.calls.length,1);assert.equal(f.parsed.length,0);assert.equal(f.timers.cleared,1);
});
test('missing or empty canonical links cannot fall back to the requested URL and pass validation',async()=>{
  for(const doc of [htmlFixture({missingCanonical:true}),htmlFixture({canonical:''}),htmlFixture({canonical:' \t '})]) {
    const f=readerFixture({doc});await assert.rejects(readLoraTriggerWords(selected,f.io),/모델|canonical|캐논/);
    assert.equal(f.timers.cleared,1);
  }
});
test('canonical model identity rejects other IDs, origins, and mismatched version paths',async()=>{
  for(const canonical of ['https://pixai.art/en/model/20','https://example.test/en/model/10',
    'https://pixai.art.evil.test/en/model/10','https://pixai.art/en/model/10/102','https://pixai.art/en/model/10/unrelated']) {
    const f=readerFixture({doc:htmlFixture({canonical})});await assert.rejects(readLoraTriggerWords(selected,f.io),/모델/);
    assert.equal(f.timers.cleared,1);
  }
});
test('current and legacy English canonical paths identify the selected model without hydrated version links',async()=>{
  for(const canonical of ['/model/10','https://pixai.art/model/10/101','/en/model/10','/en/model/10/101']) {
    const f=readerFixture({doc:htmlFixture({canonical})});
    assert.equal(await readLoraTriggerWords(selected,f.io),'harukav2 style');
    assert.equal(f.calls[0].url,requested);
  }
});
test('the obsolete English URL is never requested even when that route would redirect',async()=>{
  const f=readerFixture();f.io.fetch=async(url,request)=>{
    f.calls.push({url,request});
    if(new URL(url).pathname.startsWith('/en/'))throw new TypeError('redirect blocked');
    return responseFixture();
  };
  assert.equal(await readLoraTriggerWords(selected,f.io),'harukav2 style');
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,requested);
  assert.equal(f.calls[0].request.redirect,'error');
});
test('current English canonical paths still reject another model, version, origin, or locale',async()=>{
  for(const canonical of ['/model/20','/model/10/102','/model/10/unrelated','/ko/model/10',
    'https://example.test/model/10','https://pixai.art.evil.test/model/10']) {
    const f=readerFixture({doc:htmlFixture({canonical})});
    await assert.rejects(readLoraTriggerWords(selected,f.io),/모델/);
    assert.equal(f.timers.cleared,1);
  }
});
test('ambiguous, absent, malformed, or active-content trigger sections are refused',async()=>{
  for(const doc of [htmlFixture({termCount:2}),htmlFixture({termCount:0}),htmlFixture({termName:'Other Words'}),
    htmlFixture({missingValue:true}),htmlFixture({valueTag:'DIV'}),htmlFixture({activeContent:true})]) {
    const f=readerFixture({doc});await assert.rejects(readLoraTriggerWords(selected,f.io),/트리거 항목/);
    assert.equal(f.timers.cleared,1);
  }
});
test('an explicitly empty trigger section is legitimate and weighted duplicate text is preserved',async()=>{
  const empty=readerFixture({doc:htmlFixture({paragraphs:[],valueText:''})});assert.equal(await readLoraTriggerWords(selected,empty.io),'');
  const f=readerFixture({doc:htmlFixture({paragraphs:['  (style:0.8), masterpiece  ','line one\r\nline two, masterpiece']})});
  assert.equal(await readLoraTriggerWords(selected,f.io),'(style:0.8), masterpiece, line one\nline two, masterpiece');
});
test('timeout aborts the single pending request without retry or falsely reporting trigger success',async()=>{
  const f=readerFixture();let aborts=0;
  f.io.fetch=(url,request)=>{f.calls.push({url,request});return new Promise((_resolve,reject)=>request.signal.addEventListener('abort',()=>{aborts++;reject(Object.assign(new Error('aborted'),{name:'AbortError'}));},{once:true}));};
  const pending=readLoraTriggerWords(selected,f.io);f.timers.fire();
  await assert.rejects(pending,error=>error.name==='AbortError');
  assert.equal(aborts,1);assert.equal(f.calls.length,1);assert.equal(f.parsed.length,0);assert.equal(f.timers.cleared,1);
});
test('body-read and parser failures still clear the timeout and never return partial metadata',async()=>{
  const body=readerFixture({response:responseFixture({text:async()=>{throw new Error('body failed');}})});
  await assert.rejects(readLoraTriggerWords(selected,body.io),/body failed/);assert.equal(body.timers.cleared,1);assert.equal(body.parsed.length,0);
  const parsing=readerFixture();parsing.io.parseHtml=()=>{throw new Error('parser failed');};
  await assert.rejects(readLoraTriggerWords(selected,parsing.io),/parser failed/);assert.equal(parsing.timers.cleared,1);
});

function configuration() {
  return {model:{id:'1',versionId:'11',name:'모델'},loras:[{...selected},{id:'20',versionId:'201',name:'다른 LoRA',weight:0.7}]};
}
function adapterFixture(first,second=first) {
  let captures=0;
  return {adapter:{capture:async()=>{captures++;return captures===1?first:second;}},get captures(){return captures;}};
}
test('one LoRA lookup failure keeps model/settings and another successful trigger with a warning',async()=>{
  const config=configuration(),original=plain(config),f=adapterFixture(config),calls=[];
  const result=await capturePresetSettings(f.adapter,async lora=>{calls.push(lora.id);if(lora.id==='10')throw new Error('public page unavailable');return 'second trigger';});
  assert.deepEqual(plain(result.model),original.model);assert.deepEqual(plain(result.loras[0]),original.loras[0]);
  assert.deepEqual(plain(result.loras[1]),{...original.loras[1],triggerWords:'second trigger'});
  assert.deepEqual(plain(result.triggerWarnings),['LoRA']);assert.deepEqual(calls,['10','20']);assert.equal(f.captures,2);
  assert.deepEqual(config,original);
});
test('empty trigger results leave configuration intact without a failure warning',async()=>{
  const config=configuration(),f=adapterFixture(config);
  const result=await capturePresetSettings(f.adapter,async()=> '');
  assert.deepEqual(plain(result.loras),config.loras);assert.deepEqual(plain(result.triggerWarnings),[]);assert.equal(f.captures,2);
});
test('five LoRAs keep order and weights when one public page fails and another has no trigger',async()=>{
  const config={model:configuration().model,loras:Array.from({length:5},(_,i)=>({id:String(10+i),versionId:String(101+i),name:`LoRA ${i+1}`,weight:i/4}))};
  const original=plain(config),f=adapterFixture(config),readers=[];
  const result=await capturePresetSettings(f.adapter,lora=>{
    const reader=readerFixture({response:responseFixture({url:`https://pixai.art/model/${lora.id}/${lora.versionId}`,ok:lora.id!=='12',status:lora.id==='12'?404:200}),
      doc:htmlFixture({canonical:`/model/${lora.id}`,paragraphs:lora.id==='14'?[]:[`trigger ${lora.id}`]})});
    readers.push(reader);return readLoraTriggerWords(lora,reader.io);
  });
  assert.deepEqual(plain(result.loras),original.loras.map(lora=>({...lora,...(['12','14'].includes(lora.id)?{}:{triggerWords:`trigger ${lora.id}`} )})));
  assert.deepEqual(plain(result.triggerWarnings),['LoRA 3']);assert.deepEqual(config,original);assert.equal(f.captures,2);
  assert.equal(new Set(readers.map(reader=>reader.calls[0].request.signal)).size,5);
  assert.ok(readers.every(reader=>reader.calls.length===1&&reader.timers.cleared===1));
});
test('model/version, LoRA weight, or selected LoRA changes during lookup reject mixed settings',async()=>{
  for(const mutate of [config=>config.model.versionId='12',config=>config.model.id='2',
    config=>config.loras[0].weight=0.1,config=>config.loras.pop(),config=>config.loras[0].versionId='102']) {
    const first=configuration(),second=plain(first);mutate(second);const f=adapterFixture(first,second);
    await assert.rejects(capturePresetSettings(f.adapter,async()=> 'trigger'),/프리셋과 다릅니다/);
    assert.equal(f.captures,2);
  }
});
test('site capture failure happens before any metadata request, and final capture failure cannot succeed',async()=>{
  let requests=0;
  await assert.rejects(capturePresetSettings({capture:async()=>{throw new Error('site capture failed');}},async()=>{requests++;return 'trigger';}),/site capture failed/);
  assert.equal(requests,0);
  let captures=0;
  await assert.rejects(capturePresetSettings({capture:async()=>{if(++captures===1)return configuration();throw new Error('site changed');}},async()=>{requests++;return 'trigger';}),/site changed/);
  assert.equal(requests,2);assert.equal(captures,2);
});

test('official trigger metadata reads the selected version and normalizes only its trigger text',async()=>{
  const calls=[],response={id:'101',modelId:'10',extra:{triggerWords:'  (hero:0.8), hero\r\nstyle  '},latestAvailableVersion:{id:'999',extra:{triggerWords:'wrong latest trigger'}}};
  const before=plain(response),loraBefore=plain(selected);
  const api={modelVersion:async id=>{calls.push(id);return response;}};
  assert.equal(await readOfficialLoraTriggerWords(selected,api),'(hero:0.8), hero\nstyle');
  assert.deepEqual(calls,['101']);assert.deepEqual(response,before);assert.deepEqual(selected,loraBefore);
});

test('official trigger lookup refuses invalid model or version identities before requesting metadata',async()=>{
  const calls=[],api={modelVersion:async id=>{calls.push(id);return {};}};
  for(const lora of [{...selected,id:''},{...selected,id:10},{...selected,id:'../10'},{...selected,id:'10?token=private'},
    {...selected,versionId:''},{...selected,versionId:101},{...selected,versionId:'101/../../secret'},
    {...selected,versionId:'101?latest=true'},{...selected,versionId:'https://example.test/101'}]) {
    await assert.rejects(readOfficialLoraTriggerWords(lora,api));
  }
  assert.deepEqual(calls,[]);
});

test('official trigger lookup rejects a different parent or selected version without substituting latest metadata',async()=>{
  for(const response of [null,[],{},
    {id:'101',modelId:'11',extra:{triggerWords:'wrong parent'}},
    {id:'102',modelId:'10',extra:{triggerWords:'wrong version'}},
    {id:101,modelId:'10',extra:{triggerWords:'numeric response ID'}},
    {id:'101',modelId:10,extra:{triggerWords:'numeric parent ID'}},
    {id:'102',modelId:'10',latestAvailableVersion:{id:'101',extra:{triggerWords:'nested fallback forbidden'}},extra:{triggerWords:'wrong version'}}]) {
    const calls=[],api={modelVersion:async id=>{calls.push(id);return response;}};
    await assert.rejects(readOfficialLoraTriggerWords(selected,api));assert.deepEqual(calls,['101']);
  }
});

test('official empty trigger is valid but absent or malformed trigger metadata remains a lookup failure',async()=>{
  for(const triggerWords of ['', ' \r\n ']) {
    assert.equal(await readOfficialLoraTriggerWords(selected,{modelVersion:async()=>({id:'101',modelId:'10',extra:{triggerWords}})}),'');
  }
  for(const extra of [undefined,null,[],{},'hero',{triggerWords:null},{triggerWords:[]},{triggerWords:4}]) {
    const response={id:'101',modelId:'10',...(extra===undefined?{}:{extra})};
    await assert.rejects(readOfficialLoraTriggerWords(selected,{modelVersion:async()=>response}),/트리거/);
  }
});

test('five official LoRA lookups preserve order and weights across access failure, empty and missing triggers',{timeout:2000},async()=>{
  const config={model:configuration().model,loras:Array.from({length:5},(_,i)=>({id:String(10+i),versionId:String(101+i),name:`LoRA ${i+1}`,weight:i/4}))};
  const before=plain(config),f=adapterFixture(config),pending=[];
  let markStarted;const allStarted=new Promise(resolve=>{markStarted=resolve;});
  const api={modelVersion:id=>new Promise((resolve,reject)=>{pending.push({id,resolve,reject});if(pending.length===5)markStarted();})};
  const captured=capturePresetSettings(f.adapter,lora=>readOfficialLoraTriggerWords(lora,api));
  await allStarted;assert.deepEqual(pending.map(item=>item.id),['101','102','103','104','105']);
  for(const item of [...pending].reverse()) {
    const index=Number(item.id)-101;
    if(index===1)item.reject(Object.assign(new Error('access denied'),{status:403}));
    else item.resolve({id:item.id,modelId:String(10+index),extra:index===3?{}:{triggerWords:index===2?'':`trigger ${index+1}`}});
  }
  const result=await captured;
  assert.deepEqual(plain(result.loras),before.loras.map((lora,index)=>({...lora,...(index===0||index===4?{triggerWords:`trigger ${index+1}`}:{})})));
  assert.deepEqual(plain(result.triggerWarnings).sort(),['LoRA 2','LoRA 4']);
  assert.deepEqual(plain(result.model),before.model);assert.deepEqual(config,before);assert.equal(f.captures,2);
});

test('official metadata cannot complete a capture whose selected LoRA changed during the lookup',async()=>{
  for(const mutate of [value=>value.loras[0].versionId='102',value=>value.loras[0].weight=0.5]) {
    const first=configuration(),second=plain(first);mutate(second);const f=adapterFixture(first,second),calls=[];
    const api={modelVersion:async id=>{calls.push(id);const lora=first.loras.find(item=>item.versionId===id);return {id,modelId:lora.id,extra:{triggerWords:'captured trigger'}};}};
    await assert.rejects(capturePresetSettings(f.adapter,lora=>readOfficialLoraTriggerWords(lora,api)),/프리셋과 다릅니다/);
    assert.deepEqual(calls,['101','201']);assert.equal(f.captures,2);
  }
});
