'use strict';
// Actual production adapter against a synthetic visible DOM, including review regressions.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const repo=__dirname;
const core=require(repo+'/pixai-web-queue.user.js');
const modulePath=repo+'/modules/web-unlimited.js';
const source=fs.readFileSync(modulePath,'utf8');
function fixture(options={}) {
  let clock=0,ids=options.existingTask?['999']:['100'],negative='user negative',negativeReads=0,dialogOpen=false,menuOpen=false,submits=0,empty=false,resetClock=0,submitClock=0,detailClock=0,preflightFailure='';const frozen=[],mediaSeen=new Set();
  let receiptId=options.receiptId||'999';const config={model:{id:'1',versionId:'11',name:'T3'},loras:[]},events=[];
  const elem=(attrs={},text='')=>({attrs,textContent:text,children:[],parentElement:null,disabled:false,
    getAttribute(k){return this.attrs[k]??null;},getClientRects(){return [{}];},closest(){return null;},
    querySelectorAll(){return [];},querySelector(){return null;},hasAttribute(k){return Object.hasOwn(this.attrs,k);},focus(){},blur(){},dispatchEvent(){}});
  const input=elem();input.childNodes=[{nodeType:1,tagName:'P',childNodes:[{nodeType:3,textContent:'desired'}]}];
  const ratio=elem({},'1:1');ratio.classList={contains:()=>true};ratio.click=()=>{};
  const group=elem({'aria-label':'Aspect ratio'});group.querySelectorAll=()=>[ratio];
  const label=elem(),toggle=elem({'aria-label':'Tsubaki.3 Unlimited Mode'});toggle.checked=true;toggle.closest=s=>s==='label'?label:null;
  const free=elem({},'Free'),banner=elem({},'Unlimited mode active'),scope=elem(),generateArea=elem(),button=elem();
  generateArea.parentElement=scope;button.parentElement=generateArea;button.closest=s=>s==='[data-share-guide="generate"]'?generateArea:null;
  if(options.contentsWrapper)generateArea.getClientRects=()=>[];
  if(options.hiddenPriceScope)scope.hidden=true;
  if(options.paidPrice)free.textContent='1,100';
  scope.querySelectorAll=()=>options.duplicatePrice?[free,elem({},'Free')]:[free];button.click=()=>{submits++;submitClock=clock;empty=false;if(options.sequence){receiptId=String(998+submits);card.attrs['data-task-id']=receiptId;labelId.nextElementSibling.textContent=receiptId;media.attrs['data-media-id']=String(776+submits);prompt.textContent=core.readPromptEditorText(input);}if(!options.idDelay&&!options.noId)ids.push(receiptId);events.push('submit:'+receiptId);if(options.multiple)ids.push('1000');if(options.clickThrows)throw Object.assign(Error('click threw after dispatch'),{notSubmitted:true});};
  const blank=elem(),newLink=elem({href:'/ko/generator/image'},'새 이미지 만들기');newLink.click=()=>{resetClock=clock;if(options.resetFails)return;ids=[];empty=true;if(!options.promptResetFails)input.childNodes=[];input.textContent=options.promptResetFails?'desired':'';};
  const img={complete:true,naturalWidth:1280,naturalHeight:768,getAttribute:k=>k==='src'?'https://images-ng.pixai.art/images/orig/1234-abcd':null};
  const media=elem({'data-media-id':'777'});media.querySelector=()=>img;
  const meta=elem({},options.recentText??'몇 초 전');
  if(options.metaDelay)Object.defineProperty(meta,'textContent',{get:()=>clock-submitClock<options.metaDelay?options.pendingText??'':options.recentText??'몇 초 전'});
  const detail=elem({},'작업 상세 보기');detail.click=()=>{assert(clock-submitClock>=(options.mediaDelay||0),'detail opened before original');dialogOpen=true;detailClock=clock;menuOpen=false;events.push('detail:'+receiptId);};
  const more=elem({'data-testid':'mobile-task-card-more'});more.click=()=>{menuOpen=true;};
  const card=elem({'data-task-id':receiptId});card.innerText='Synthetic task card';
  if(options.failureAfter!=null)Object.defineProperty(card,'innerText',{get:()=>clock-submitClock>=options.failureAfter?'Generation failed':'Generating'});
  card.querySelector=s=>s==='[data-testid="task-card-meta"]'?meta:null;
  card.querySelectorAll=s=>{if(s==='[data-media-id]'){if(clock-submitClock<(options.mediaDelay||0))return [];if(!mediaSeen.has(receiptId)){events.push('media:'+receiptId);mediaSeen.add(receiptId);}return [media];}return s==='button'?(options.menu?[more]:[detail]):s==='button[data-testid="mobile-task-card-more"]'?[more]:[];};
  const labelId=elem({},'작업 ID'),labelCredits=elem({},'소모 크레딧'),prompt=elem({'translate':'no'},options.prompt??'desired');
  labelId.nextElementSibling=elem({},options.detailId??receiptId);labelCredits.nextElementSibling=elem({},options.credits??'0');
  if(options.fieldsDelay)Object.defineProperty(labelCredits.nextElementSibling,'textContent',{get:()=>clock-detailClock<options.fieldsDelay?'':options.credits??'0'});
  const content=elem({'data-ui':'dialog-content'});content.querySelectorAll=s=>s==='span'?[labelId,labelCredits]:s==='[translate="no"]'?[prompt]:[];
  const cancel=elem({},'취소');cancel.click=()=>{dialogOpen=false;};
  const heading=elem({},'작업 상세'),dialog=elem({'role':'dialog','aria-label':'작업 상세'});
  dialog.querySelectorAll=s=>s==='h2'?[heading]:s==='[data-ui="dialog-content"]'?(options.noContent||clock-detailClock<(options.contentDelay||0)?[]:options.duplicateContent?[content,content]:[content]):s==='button'?[cancel]:[];
  const departingMenu=elem({role:'dialog'});
  const canvas=elem();canvas.getAttribute=k=>k==='aria-hidden'&&dialogOpen?'true':null;canvas.querySelectorAll=s=>s==='[data-task-id]'?ids.map(id=>elem({'data-task-id':id})):s==='[data-testid="empty-composition"]'?(empty?[blank]:[]):s==='section[data-testid="mobile-task-card"]'?(ids.includes(receiptId)?[card]:[]):[];
  const doc={querySelectorAll(s){return ({
    'main [data-feed-scroller="true"] [data-testid="feed-column"]':[canvas],
    'a[href]':[newLink],
    'main [contenteditable="true"]':[input],
    'main [data-share-guide="generate"] button':[button],
    'main [data-share-guide="generate"]':[generateArea],
    'main input[role="switch"]':[toggle],
    'main [role="group"]':[group],
    'main span':[banner],
    'main [data-task-id]':ids.map(id=>elem({'data-task-id':id})),
    'main section[data-testid="mobile-task-card"]':ids.includes(receiptId)?[card]:[],
    '[role="dialog"]':dialogOpen?(clock-detailClock<(options.menuTransitionDelay||0)?[departingMenu]:[dialog]):[],
    'button':menuOpen?[detail]:[]
  })[s]??[];},createRange:()=>({selectNodeContents(){}}),execCommand:(name,unused,value)=>{input.childNodes=[{nodeType:1,tagName:'P',childNodes:[{nodeType:3,textContent:value}]}];return true;}};
  const settings={capture:async()=>config,apply:async()=>{},read:()=>preflightFailure==='config'?{...config,model:{...config.model,versionId:'22'}}:config,readImageCount:()=>1,setImageCount:async()=>{},
    setNegative:async value=>{negative=value;},verifyNegative(){if(preflightFailure==='negative')throw Error('negative changed');},captureNegative:async()=>{negativeReads++;return negative;}};
  class FakeDate extends Date {static now(){return 1000000+clock;}}
  const context={URL,Date:FakeDate,normalize:core.normalize,readPromptEditorText:core.readPromptEditorText,assertConfiguration:core.assertConfiguration};
  vm.runInNewContext(source+'\nthis.reviewExports={createWebUnlimitedAdapter,runWebUnlimited};',context);
  const adapter=context.reviewExports.createWebUnlimitedAdapter(doc,{settings,freeze:job=>{if(options.freezeFailure)throw Error('baseline quota');frozen.push({job:structuredClone(job),ids:[...ids],negative});},win:{getComputedStyle:()=>({}),getSelection:()=>({removeAllRanges(){},addRange(){}}),InputEvent:class{}},check(){if(options.cancelAt!=null&&clock>=options.cancelAt)throw Error('중단됨');},mutate:fn=>fn(),sleep:async ms=>{clock+=ms;if(options.lateDuringReset&&clock-resetClock>=1000)ids.push('100');if(submits&&options.idDelay&&!options.noId&&clock-submitClock>=options.idDelay&&!ids.includes(receiptId))ids.push(receiptId);if(submits&&options.otherAfter!=null&&clock-submitClock>=options.otherAfter&&!ids.includes('1000'))ids.push('1000');}});
  const job=()=>({backend:'web-unlimited',id:'local',state:'queued',saved:[],prompt:'desired',negativePrompt:'',configuration:config,webApplied:{aspectRatio:'1:1'},webBeforeIds:[]});
  const breakPreflight=kind=>{preflightFailure=kind;if(kind==='prompt')input.childNodes=[];if(kind==='price')free.textContent='1100';if(kind==='other')ids.push('2000');if(kind==='missing')button.attrs['data-prompt-input-missing']='';};
  return {adapter,run:context.reviewExports.runWebUnlimited,job,frozen,events,breakPreflight,clock:()=>clock,ids:()=>[...ids],addId:id=>ids.push(id),negative:()=>negative,negativeReads:()=>negativeReads,submits:()=>submits,dialogOpen:()=>dialogOpen};
}

test('actual adapter persists each ID before 70-second generation and saves before the next submit regardless of age labels',async()=>{
  const f=fixture({sequence:true,menu:true,mediaDelay:70000,metaDelay:70000,pendingText:'생성 중 32%',recentText:'1분 전'}),jobs=[{...f.job(),id:'one',prompt:'green vase'},{...f.job(),id:'two',prompt:'yellow bowl'}],snapshots=[];
  await f.run(jobs,{prepare:f.adapter.prepare,submit:f.adapter.submit,wait:f.adapter.wait,guard:f.adapter.guard,persist(){snapshots.push(structuredClone(jobs));},async save(job,media){f.events.push('save:'+job.taskId);assert.equal(job.webReceipt.prompt,job.prompt);return media.id+'.webp';}});
  assert.deepEqual(f.events,['submit:999','media:999','detail:999','save:999','submit:1000','media:1000','detail:1000','save:1000']);
  assert(f.clock()>=140000);assert.equal(f.submits(),2);assert(jobs.every(j=>j.state==='done'&&j.saved.length===1));
  assert.deepEqual(jobs.map(j=>j.taskId),['999','1000']);assert.deepEqual(jobs.map(j=>j.saved[0].mediaId),['777','778']);
  assert(snapshots.filter(s=>s[1].state==='submitting').every(s=>s[0].state==='done'));
  assert(snapshots.some(s=>s[0].state==='waiting'&&s[0].taskId==='999'&&!s[0].webReceipt));
});

test('generation failure, imported result, other ID or cancellation retains found ID without saving or advancing',async()=>{
  for(const extra of [{failureAfter:15000},{metaDelay:0,recentText:'24분 전 · 가져오기'},{otherAfter:15000},{cancelAt:17000}]){
    const f=fixture({mediaDelay:45000,metaDelay:45000,...extra}),jobs=[f.job(),{...f.job(),id:'two'}];
    await assert.rejects(f.run(jobs,{prepare:f.adapter.prepare,submit:f.adapter.submit,wait:f.adapter.wait,guard:f.adapter.guard,persist(){},save:async()=>assert.fail('unverified save')}));
    assert.equal(f.submits(),1);assert.equal(jobs[0].state,'waiting');assert.equal(jobs[0].taskId,'999');assert.equal(jobs[1].state,'queued');assert(f.clock()<20000);
  }
});

test('missing original ultimately times out retaining known ID even when metadata never appears',async()=>{
  const f=fixture({mediaDelay:61*60*1000,recentText:''}),jobs=[f.job(),{...f.job(),id:'two'}];
  await assert.rejects(f.run(jobs,{prepare:f.adapter.prepare,submit:f.adapter.submit,wait:f.adapter.wait,persist(){},save:async()=>assert.fail('save')}),/시간 초과/);
  assert.equal(f.submits(),1);assert.equal(jobs[0].state,'waiting');assert.equal(jobs[0].taskId,'999');assert.equal(jobs[1].state,'queued');assert(f.clock()>=60*60*1000);
});

test('receipt waits for departing menu and detail fields after original, independently of timestamp',async()=>{
  const f=fixture({menu:true,metaDelay:1000,menuTransitionDelay:500,contentDelay:1000,fieldsDelay:1500}),job=f.job();
  await f.adapter.prepare(job);job.taskId=await f.adapter.submit(job);assert.equal(job.webReceipt,undefined);await f.adapter.wait(job);assert.equal(job.taskId,'999');assert.equal(job.webReceipt.credits,'0');assert.equal(f.submits(),1);assert.equal(f.dialogOpen(),false);
});

test('existing receipt saves and becomes done without prepare/submit or touching the next queued job',async()=>{
  const f=fixture({existingTask:true,menu:true,menuTransitionDelay:500,contentDelay:1000,fieldsDelay:1500}),job={...f.job(),taskId:'999',state:'waiting',expected:1,error:'previous detail error'},next={...f.job(),id:'next'},snapshots=[];
  await f.run([job,next],{prepare:async()=>assert.fail('must not prepare existing work'),submit:async()=>assert.fail('must not submit existing work'),persist:()=>snapshots.push(structuredClone(job)),wait:f.adapter.wait,guard:f.adapter.guard,save:async()=> 'existing.webp'},{oneJob:true});
  assert.equal(job.state,'done');assert.equal(job.error,'');assert.deepEqual(job.saved.map(x=>x.file),['existing.webp']);assert.equal(job.taskId,'999');assert.equal(next.state,'queued');assert.equal(f.submits(),0);assert.equal(snapshots.at(-1).state,'done');
  assert.deepEqual(core.filterQueueJobs([job,next],{view:'active'}).map(x=>x.id),['next']);
  assert.deepEqual(core.filterQueueJobs([job,next],{view:'history'}).map(x=>x.id),['local']);
});

test('missing detail content retains existing ID and can later resume to done without any resubmission',async()=>{
  const f=fixture({existingTask:true,noContent:true}),job={...f.job(),taskId:'999',state:'waiting',expected:1};
  const io={prepare:async()=>assert.fail('prepare'),submit:async()=>assert.fail('submit'),persist(){},wait:f.adapter.wait,guard:f.adapter.guard,save:async()=>assert.fail('unverified save')};
  await assert.rejects(f.run([job],io),/詳細|상세/);assert.equal(job.state,'waiting');assert.equal(job.taskId,'999');assert.equal(f.submits(),0);assert.equal(f.dialogOpen(),false);
  const good=fixture({existingTask:true});await good.run([job],{...io,wait:good.adapter.wait,guard:good.adapter.guard,save:async()=> 'recovered.webp'});assert.equal(job.state,'done');assert.equal(good.submits(),0);
});

test('delayed receipt still rejects wrong prompt, charged task and ambiguous content, and permits cancellation',async()=>{
  for(const options of [{prompt:'wrong'},{credits:'9'},{duplicateContent:true},{cancelAt:1000,fieldsDelay:5000}]){
    const f=fixture({existingTask:true,contentDelay:500,...options}),job={...f.job(),taskId:'999',state:'waiting'};
    await assert.rejects(f.adapter.wait(job));assert.equal(f.submits(),0);assert.equal(f.dialogOpen(),false);
  }
});

test('adapter preserves a missing negative prompt by capturing the site baseline',async()=>{
  const f=fixture(),job={prompt:'desired',apiOptions:{aspectRatio:'1:1'}};
  await f.adapter.prepare(job);assert.equal(job.negativePrompt,'user negative');assert.equal(f.negative(),'user negative');assert.equal(f.negativeReads(),1);
  await f.adapter.prepare(job);assert.equal(f.negativeReads(),1,'frozen baseline must not be recaptured');
});
test('adapter preserves explicit empty negative as a deliberate clear',async()=>{
  const f=fixture();await f.adapter.prepare({prompt:'desired',negativePrompt:'',apiOptions:{aspectRatio:'1:1'}});
  assert.equal(f.negative(),'');assert.equal(f.negativeReads(),0);
});

test('display contents generation marker uses the visible button and its adjacent free price',async()=>{
  const f=fixture({contentsWrapper:true}),job=f.job();await f.adapter.prepare(job);job.taskId=await f.adapter.submit(job);assert.equal(job.taskId,'999');assert.equal(f.submits(),1);
});

test('contents marker does not bypass hidden, paid or ambiguous price refusal',async()=>{
  for(const option of ['hiddenPriceScope','paidPrice','duplicatePrice']){
    const f=fixture({contentsWrapper:true,[option]:true});await assert.rejects(f.adapter.prepare(f.job()));assert.equal(f.submits(),0);
  }
});
test('baseline is durably handed off before canvas reset and survives preparation failure',async()=>{
  const f=fixture({resetFails:true}),job={prompt:'desired',apiOptions:{aspectRatio:'1:1'}};await assert.rejects(f.adapter.prepare(job));assert.equal(f.frozen.length,1);assert.equal(f.frozen[0].job.negativePrompt,'user negative');assert.equal(f.frozen[0].job.configuration.model.versionId,'11');assert.deepEqual(f.frozen[0].ids,['100']);assert.equal(f.submits(),0);
});
test('baseline storage failure prevents canvas reset and any submission',async()=>{
  const f=fixture({freezeFailure:true});await assert.rejects(f.adapter.prepare(f.job()),/baseline quota/);assert.deepEqual(f.ids(),['100']);assert.equal(f.submits(),0);
});
test('new DOM ID with another prompt cannot become a receipt',async()=>{
  const f=fixture({prompt:'unrelated history prompt'}),job=f.job();await f.adapter.prepare(job);job.taskId=await f.adapter.submit(job);await assert.rejects(f.adapter.wait(job));assert.equal(f.submits(),1);
});
test('newly rendered imported history card cannot become a verified receipt',async()=>{
  const f=fixture({recentText:'24분 전 · 가져오기'}),job=f.job();await f.adapter.prepare(job);job.taskId=await f.adapter.submit(job);await assert.rejects(f.adapter.wait(job),/가져오기/);assert.equal(job.webIdentity,'rejected-import');
});
test('detail ID mismatch, nonzero credits and missing credits reject',async()=>{
  for(const options of [{detailId:'888'},{credits:'10'},{credits:''}]){const f=fixture(options),job=f.job();await f.adapter.prepare(job);job.taskId=await f.adapter.submit(job);await assert.rejects(f.adapter.wait(job));}
});
test('control: exact recent free detail works through the observed menu path',async()=>{
  const f=fixture({menu:true}),job=f.job();await f.adapter.prepare(job);job.taskId=await f.adapter.submit(job);assert.equal(job.taskId,'999');
  const media=await f.adapter.wait(job);assert.equal(media.id,'777');
});
test('a second new ID after receipt stops the image wait',async()=>{
  const f=fixture(),job=f.job();await f.adapter.prepare(job);job.taskId=await f.adapter.submit(job);f.addId('1000');await assert.rejects(f.adapter.wait(job));
});
test('identical prior work arriving during fresh-canvas reset stops before submission',async()=>{
  const f=fixture({lateDuringReset:true}),job=f.job();await assert.rejects(f.adapter.prepare(job),/다른 작업/);assert.equal(f.submits(),0);
});
test('a new ID arriving during save prevents a false done result and next submission',async()=>{
  const f=fixture(),job=f.job();let saved=0;
  await assert.rejects(f.run([job],{prepare:f.adapter.prepare,persist(){},submit:f.adapter.submit,wait:f.adapter.wait,guard:f.adapter.guard,save:async()=>{f.addId('1000');saved++;return 'synthetic.png';}}),/다른 웹 작업/);
  assert.equal(job.state,'save_failed');assert.equal(saved,1);assert.equal(job.saved.length,1);
});
test('failed canvas reset or nonempty editor cannot submit',async()=>{
  for(const options of [{resetFails:true},{promptResetFails:true}]){const f=fixture(options);await assert.rejects(f.adapter.prepare(f.job()),/빈 생성 화면/);assert.equal(f.submits(),0);}
});
test('two fresh receipt candidates fail closed',async()=>{
  const f=fixture({multiple:true}),job=f.job();await f.adapter.prepare(job);await assert.rejects(f.adapter.submit(job),/여러 웹 작업/);
});

test('Fable label cases and observed relative labels do not determine completion',async()=>{
  for(const recentText of ['', '1분 전','4분 전','20분 전','생성 중 32%','대기열 3번째','몇 초 전 ·','방금 전']) {
    const f=fixture({recentText,mediaDelay:70000}),job=f.job();
    await f.run([job],{prepare:f.adapter.prepare,submit:f.adapter.submit,wait:f.adapter.wait,guard:f.adapter.guard,persist(){},save:async()=> 'result.webp'});
    assert.equal(job.state,'done',recentText);assert.equal(f.submits(),1);assert(f.clock()>=70000);
    assert(f.events.indexOf('media:999')<f.events.indexOf('detail:999'));
  }
});

test('a found ID survives receipt failure and a reload; retry verifies and saves without another click',async()=>{
  const f=fixture({noContent:true}),job=f.job(),snapshots=[];
  await assert.rejects(f.run([job],{prepare:f.adapter.prepare,submit:f.adapter.submit,wait:f.adapter.wait,persist(){snapshots.push(structuredClone(job));},save:async()=>assert.fail('save')}),/상세/);
  assert.equal(job.state,'waiting');assert.equal(job.taskId,'999');assert.equal(job.webIdentity,'pending-new');
  const recovered=core.recover([structuredClone(job)])[0],good=fixture({existingTask:true,recentText:'4분 전'});
  await good.run([recovered],{prepare:async()=>assert.fail('prepare'),submit:async()=>assert.fail('submit'),wait:good.adapter.wait,guard:good.adapter.guard,persist(){},save:async()=> 'recovered.webp'});
  assert.equal(recovered.state,'done');assert.equal(good.submits(),0);assert.equal(recovered.webIdentity,undefined);
  assert(snapshots.some(s=>s.state==='waiting'&&s.taskId==='999'&&!s.webReceipt));
});

test('new imported identity remains rejected after reload even if its label disappears',async()=>{
  const f=fixture({metaDelay:2000,mediaDelay:4000,recentText:'1분 전 · 가져오기'}),job=f.job();
  await assert.rejects(f.run([job],{prepare:f.adapter.prepare,submit:f.adapter.submit,wait:f.adapter.wait,persist(){},save:async()=>assert.fail('save')}),/가져오기/);
  assert.equal(job.taskId,'999');assert.equal(job.state,'waiting');assert.equal(job.webIdentity,'rejected-import');
  const restored=core.recover([structuredClone(job)])[0],good=fixture({existingTask:true});
  await assert.rejects(good.run([restored],{prepare:async()=>assert.fail('prepare'),submit:async()=>assert.fail('submit'),wait:good.adapter.wait,persist(){},save:async()=>assert.fail('save')}),/가져오기/);
  assert.equal(good.submits(),0);assert.equal(restored.webIdentity,'rejected-import');
});

test('explicitly confirmed existing ID recovery accepts history import label but still validates receipt',async()=>{
  for(const wrong of [false,true]) {
    const f=fixture({existingTask:true,recentText:'20분 전 · 가져오기',prompt:wrong?'wrong':'desired'}),job={...f.job(),state:'waiting',taskId:'999'};
    const run=f.run([job],{prepare:async()=>assert.fail('prepare'),submit:async()=>assert.fail('submit'),wait:f.adapter.wait,guard:f.adapter.guard,persist(){},save:async()=>{assert(!wrong);return 'existing.webp';}});
    if(wrong)await assert.rejects(run,/프롬프트/);else {await run;assert.equal(job.state,'done');}
    assert.equal(f.submits(),0);
  }
});

test('pre-click refusals leave queued with no submission timestamp and allow a later legitimate retry',async()=>{
  for(const kind of ['prompt','negative','config','price','other','missing']) {
    const f=fixture(),job=f.job();
    await assert.rejects(f.run([job],{prepare:async j=>{await f.adapter.prepare(j);f.breakPreflight(kind);},submit:f.adapter.submit,wait:f.adapter.wait,persist(){},save:async()=>assert.fail('save')}));
    assert.equal(f.submits(),0,kind);assert.equal(job.state,'queued',kind);assert.equal(job.submittedAt,undefined,kind);
    const good=fixture();await good.run([job],{prepare:good.adapter.prepare,submit:good.adapter.submit,wait:good.adapter.wait,guard:good.adapter.guard,persist(){},save:async()=> 'retry.webp'});
    assert.equal(good.submits(),1);assert.equal(job.state,'done');
  }
});

test('click-dispatch exceptions and missing ID remain unknown and cannot be replayed',async()=>{
  for(const options of [{clickThrows:true},{noId:true}]) {
    const f=fixture(options),jobs=[f.job(),{...f.job(),id:'next'}],io={prepare:f.adapter.prepare,submit:f.adapter.submit,wait:f.adapter.wait,persist(){},save:async()=>assert.fail('save')};
    await assert.rejects(f.run(jobs,io));assert.equal(f.submits(),1);assert.equal(jobs[0].state,'unknown');assert(jobs[0].submittedAt);assert.equal(jobs[1].state,'queued');
    await assert.rejects(f.run(core.recover(jobs),io));assert.equal(f.submits(),1);
    if(options.noId)assert(f.clock()>=180000);
  }
});

test('ID discovery after 90 seconds is saved before generation verification',async()=>{
  const f=fixture({idDelay:90000,mediaDelay:100000}),job=f.job();let persistedAt=0;
  await f.run([job],{prepare:f.adapter.prepare,submit:f.adapter.submit,wait:f.adapter.wait,guard:f.adapter.guard,persist(){if(job.state==='waiting')persistedAt=f.clock();},save:async()=> 'slow.webp'});
  assert(persistedAt>=90000&&persistedAt<100000);assert.equal(job.state,'done');assert.equal(f.submits(),1);
});

test('stop immediately after identity discovery persists ID for same-result resume',async()=>{
  const f=fixture(),job=f.job();let stop=false;
  await f.run([job],{prepare:f.adapter.prepare,submit:async j=>{const id=await f.adapter.submit(j);stop=true;return id;},wait:async()=>assert.fail('stopped wait'),persist(){},save:async()=>assert.fail('save')},{stopped:()=>stop});
  assert.equal(job.state,'waiting');assert.equal(job.taskId,'999');assert.equal(job.webIdentity,'pending-new');assert.equal(f.submits(),1);
  const good=fixture({existingTask:true});await good.run([job],{prepare:async()=>assert.fail('prepare'),submit:async()=>assert.fail('submit'),wait:good.adapter.wait,guard:good.adapter.guard,persist(){},save:async()=> 'resume.webp'});
  assert.equal(job.state,'done');assert.equal(good.submits(),0);
});
