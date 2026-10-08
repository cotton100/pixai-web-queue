const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {probeTask,readHiddenKey}=require('./tools/api-probe.cjs');
test('public probe only sends GET to fixed PixAI host without cookies or redirects; result excludes key and private task content',async()=>{
  let calls=0;const result=await probeTask('fake-secret',{taskId:'123',fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.pixai.art/v1/task/123');assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer fake-secret');
    return {ok:true,status:200,json:async()=>({id:'123',status:'completed',parameters:{prompt:'private'},outputs:{mediaIds:['1'],mediaUrls:['https://example.com/private-signed-url']}})};
  }});assert.equal(calls,1);assert.equal(result.authenticated,true);assert.equal(result.imageUrlCount,1);assert(!/fake-secret|private/.test(JSON.stringify(result)));
});
test('404 and other failures do not claim authentication and do not expose server errors',async()=>{
  for(const status of [401,403,404,429,500]){
    const result=await probeTask('secret',{fetchImpl:async()=>({status,ok:false,json:async()=>{throw new Error('secret');}})});
    assert.equal(result.authenticated,false);assert.equal(result.httpStatus,status);assert(!JSON.stringify(result).includes('secret'));
  }
});
test('network failures are sanitized, not retried, and malformed successful task is not an authentication result',async()=>{
  let calls=0;assert.equal((await probeTask('secret',{fetchImpl:async()=>{calls++;throw new Error('Authorization secret');}})).result,'network_error');assert.equal(calls,1);
  for(const task of [{id:'wrong',status:'completed'},{id:'2064707131934430374',status:'unexpected'}])assert.equal((await probeTask('secret',{fetchImpl:async()=>({ok:true,status:200,json:async()=>task})})).authenticated,false);
});
test('bad inputs never call the API',async()=>{
  const fetchImpl=()=>{throw new Error('Unexpected request');};for(const key of ['','\r\nsecret'])await assert.rejects(probeTask(key,{fetchImpl}),/Invalid API key/);
  await assert.rejects(probeTask('secret',{taskId:'../create',fetchImpl}),/Invalid task/);
});
test('local terminal masks key and restores raw mode on completion and cancellation',async()=>{
  for(const cancel of [false,true]){
    const input=new EventEmitter();input.isTTY=true;input.isRaw=false;input.setRawMode=value=>input.isRaw=value;input.resume=()=>{};input.pause=()=>{};
    let shown='';const promise=readHiddenKey(input,{write:text=>shown+=text});
    input.emit('data',Buffer.from(cancel ? 'secret\u0003' : 'secreX\u007ft\r'));
    if(cancel)await assert.rejects(promise,/cancelled/);else assert.equal(await promise,'secret');
    assert(!shown.includes('secret'));assert.equal(input.isRaw,false);
  }
});
