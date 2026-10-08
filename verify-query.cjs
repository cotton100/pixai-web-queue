'use strict';
// HTTP400 회귀 검사: getMedia 변수 타입과 조회 실패 구분. PQ_SOURCE 환경변수로 검사 대상 파일을 바꿀 수 있다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
// PQ_SOURCE: 검사할 스크립트 경로(상대 경로는 이 파일 기준). 미지정 시 같은 폴더의 본체.
const SOURCE=process.env.PQ_SOURCE ? path.resolve(__dirname,process.env.PQ_SOURCE) : path.join(__dirname,'pixai-web-queue.user.js');
const source=fs.readFileSync(SOURCE,'utf8');
const core=require(SOURCE);
const {graphqlQuery,describeQueryFailure,processJob,MEDIA_QUERY,pickOriginalMedia,mediaUrlAllowed,assertOriginalDimensions}=core;

const validation={errors:[{message:'Variable "$id" of type "ID!" used in position expecting type "String!".',extensions:{code:'GRAPHQL_VALIDATION_FAILED'}}]};
const unauthorized={errors:[{message:'must be logged in to access this resource',extensions:{code:'Unauthorized'}}]};
const response=(status,body,{json=true}={})=>({ok:status>=200&&status<300,status,json:async()=>{if(!json)throw new SyntaxError('not json');return body;}});
const fetchWith=(result,calls=[])=>async(url,init)=>{calls.push({url,init});if(result instanceof Error)throw result;return typeof result==='function'?result():result;};

test('production task and media lookup use official REST rather than internal GraphQL',()=>{
  assert.match(source,/return api.task\(id\)/);assert.match(source,/await api.media\(mediaId\)/);
  const runtime=source.slice(source.indexOf("  const KEY = 'local.pixai-web-queue.v1';"));assert(!runtime.includes('graphqlQuery('));
});

test('원본은 urls의 PUBLIC 변형을 고른다 — fileUrl이 null이어도, 썸네일이 먼저 와도',()=>{
  const media={id:'774095702306134297',width:1104,height:1824,imageType:'webp',fileUrl:null,urls:[{variant:'THUMBNAIL',url:'https://images-ng.pixai.art/images/thumb/a'},{variant:'PUBLIC',url:'https://images-ng.pixai.art/images/orig/a'},{variant:'STILL_THUMBNAIL',url:'https://images-ng.pixai.art/images/stillThumb/a'}]};
  assert.deepEqual(pickOriginalMedia(media,'774095702306134297'),{url:'https://images-ng.pixai.art/images/orig/a',variant:'PUBLIC',width:1104,height:1824});
  assert.deepEqual(pickOriginalMedia({id:'5',fileUrl:'https://cdn.pixai.art/f.png',urls:[]},5),{url:'https://cdn.pixai.art/f.png',variant:'fileUrl',width:null,height:null});
  assert.throws(()=>pickOriginalMedia({id:'5',fileUrl:null,urls:[{variant:'THUMBNAIL',url:'https://images-ng.pixai.art/images/thumb/a'}]},'5'),/variant: THUMBNAIL.*썸네일로 대체하지 않고/);
  assert.throws(()=>pickOriginalMedia({id:'5',fileUrl:null,urls:null},'5'),/variant: 없음/);
  assert.throws(()=>pickOriginalMedia({id:'6',urls:[{variant:'PUBLIC',url:'https://images-ng.pixai.art/x'}]},'5'),/ID 불일치/);
  assert.throws(()=>pickOriginalMedia(null,'5'),/ID 불일치/);
});
test('원본 호스트는 pixai.art와 그 하위 도메인의 https만 허용한다',()=>{
  assert.equal(mediaUrlAllowed('https://images-ng.pixai.art/images/orig/a').hostname,'images-ng.pixai.art');
  assert.equal(mediaUrlAllowed('https://pixai.art/a').hostname,'pixai.art');
  for (const bad of ['http://images-ng.pixai.art/a','https://pixai.art.evil.example/a','https://notpixai.art/a','https://evil.example/images-ng.pixai.art/a']) assert.throws(()=>mediaUrlAllowed(bad),/예상하지 못한 원본 이미지 호스트/);
  assert.throws(()=>mediaUrlAllowed('not a url'));
});
test('내려받은 이미지 크기가 서버 원본 크기와 다르면(미리보기) 저장하지 않는다',async()=>{
  const decodeAs=(w,h)=>async()=>({width:w,height:h,closed:0,close(){this.closed++;}});
  await assertOriginalDimensions({},{width:1104,height:1824},decodeAs(1104,1824));
  await assert.rejects(assertOriginalDimensions({},{width:1104,height:1824},decodeAs(552,912)),/크기\(552×912\)가 원본\(1104×1824\)과 다릅니다/);
  await assert.rejects(assertOriginalDimensions({},{width:1104,height:1824},async()=>{throw new Error('decode');}),/해석하지 못해/);
  await assertOriginalDimensions({},{width:null,height:null},async()=>{throw new Error('must not be called');});
  const bitmap={width:10,height:10,closed:0,close(){this.closed++;}};
  await assertOriginalDimensions({},{width:10,height:10},async()=>bitmap);assert.equal(bitmap.closed,1);
});
test('official API client is exported and used by the production runtime',()=>{
  assert.equal(typeof core.createOfficialApiClient,'function');assert.match(source,/const api=createOfficialApiClient\(/);
});

test('요청 형식: 같은 엔드포인트·POST·쿠키 포함·JSON 본문',async()=>{
  const calls=[];const data=await graphqlQuery(fetchWith(response(200,{data:{media:{id:'7',fileUrl:'https://images-ng.pixai.art/x.png'}}}),calls),'getMedia','query getMedia($id: String!) { media(id: $id) { id fileUrl } }',{id:'7'});
  assert.deepEqual(data,{media:{id:'7',fileUrl:'https://images-ng.pixai.art/x.png'}});
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.pixai.art/graphql?operation=getMedia');
  assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.credentials,'include');assert.equal(calls[0].init.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body),{operationName:'getMedia',query:'query getMedia($id: String!) { media(id: $id) { id fileUrl } }',variables:{id:'7'}});
});
test('HTTP400 GraphQL 검증 실패는 형식 오류로 구분하고 로그인 안내로 바꾸지 않는다',async()=>{
  await assert.rejects(graphqlQuery(fetchWith(response(400,validation)),'getMedia','q',{id:'1'}),error=>{
    assert.match(error.message,/^조회 형식 오류 \(400, GRAPHQL_VALIDATION_FAILED\)/);assert.match(error.message,/expecting type "String!"/);
    assert.match(error.message,/로그인 문제로 단정할 수 없습니다/);assert.match(error.message,/작업 ID와 저장 내역은 유지/);
    assert.doesNotMatch(error.message,/로그인을 확인해 주세요/);assert.equal(error.stage,'validation');assert.equal(error.status,400);return true;
  });
});
test('HTTP200이라도 GraphQL Unauthorized는 인증 실패로 구분한다',async()=>{
  await assert.rejects(graphqlQuery(fetchWith(response(200,unauthorized)),'getTaskById','q',{id:'1'}),error=>{
    assert.match(error.message,/^조회 인증 실패 \(200, Unauthorized\)/);assert.match(error.message,/로그인 상태를 확인/);assert.equal(error.stage,'auth');return true;
  });
  await assert.rejects(graphqlQuery(fetchWith(response(401,null,{json:false})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'auth');assert.match(error.message,/\(401\)/);return true;});
});
test('403·5xx·JSON 아님·시간 초과·네트워크 오류를 각각 구분한다',async()=>{
  await assert.rejects(graphqlQuery(fetchWith(response(403,{errors:[{message:'forbidden',extensions:{code:'FORBIDDEN'}}]})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'forbidden');assert.match(error.message,/\(403, FORBIDDEN\)/);return true;});
  await assert.rejects(graphqlQuery(fetchWith(response(503,null,{json:false})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'server');assert.match(error.message,/\(503\)/);assert.match(error.message,/같은 작업 ID/);return true;});
  await assert.rejects(graphqlQuery(fetchWith(response(200,null,{json:false})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'non-json');assert.match(error.message,/JSON이 아닙니다 \(200\)/);return true;});
  const abort=new Error('aborted');abort.name='AbortError';
  await assert.rejects(graphqlQuery(fetchWith(abort),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'timeout');assert.match(error.message,/시간 초과/);return true;});
  await assert.rejects(graphqlQuery(fetchWith(new TypeError('Failed to fetch')),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'network');return true;});
  await assert.rejects(graphqlQuery(fetchWith(response(200,{data:null})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'other');assert.match(error.message,/^조회 실패 \(200\)/);return true;});
  await assert.rejects(graphqlQuery(fetchWith(response(400,null,{json:false})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'non-json');assert.match(error.message,/JSON이 아닙니다 \(400\)/);return true;});
  await assert.rejects(graphqlQuery(fetchWith(response(422,{errors:[{message:'bad',extensions:{}}]})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'validation');assert.match(error.message,/\(422\)/);return true;});
  await assert.rejects(graphqlQuery(fetchWith(response(200,{errors:[{message:'x',extensions:{code:'UNAUTHENTICATED'}}]})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'auth');return true;});
  await assert.rejects(graphqlQuery(fetchWith(response(200,{errors:[{message:'first',extensions:{code:'SOMETHING'}},{message:'second',extensions:{code:'Unauthorized'}}]})),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'auth');return true;});
});
test('오류 코드는 짧은 영숫자만 받아들이고 비문자열 필드는 무시한다',()=>{
  assert.equal(describeQueryFailure(400,{errors:[{message:{a:1},extensions:{code:'x'.repeat(65)}}]}).message,'조회 형식 오류 (400): 스크립트의 조회 형식이 사이트와 맞지 않습니다. 로그인 문제로 단정할 수 없습니다. 작업 ID와 저장 내역은 유지됩니다.');
  assert.equal(describeQueryFailure(400,{errors:[{message:['a'],extensions:{code:'BAD CODE'}}]}).code,'');
  assert.equal(describeQueryFailure(403,{errors:[{extensions:{code:' FORBIDDEN '}}]}).code,'FORBIDDEN');
});
test('오류 문구에 응답 본문 전체·인증값이 들어가지 않는다 (메시지 120자 제한·공백 정리)',()=>{
  const long='x'.repeat(500);
  const error=describeQueryFailure(400,{errors:[{message:long,extensions:{code:'BAD_USER_INPUT'}}]});
  assert.ok(error.message.length<400);assert.ok(!error.message.includes('x'.repeat(121)));
  assert.match(describeQueryFailure(400,{errors:[{message:'status\n\tis   bad',extensions:{code:'BAD_USER_INPUT'}}]}).message,/\[status is bad\]/);
  assert.match(describeQueryFailure(400,{errors:[{message:'must be logged in to access this resource',extensions:{code:'BAD_USER_INPUT'}}]}).message,/\[must be logged in to access this resource\]/);
  assert.match(describeQueryFailure(400,{errors:['not-an-object',null]}).message,/^조회 형식 오류 \(400\)/);
});
test('응답 본문을 읽는 중 25초 제한에 걸려도 시간 초과로 분류한다',async()=>{
  const abort=new Error('aborted');abort.name='AbortError';
  await assert.rejects(graphqlQuery(fetchWith({ok:true,status:200,json:async()=>{throw abort;}}),'getTaskById','q',{id:'1'}),error=>{assert.equal(error.stage,'timeout');assert.match(error.message,/시간 초과/);return true;});
});
test('원본 조회 단계 400이면 작업은 save_failed로 남고 ID를 유지하며 재제출하지 않는다; 고친 뒤 같은 ID로 저장을 이어간다',async()=>{
  const task={id:'2064395107592204379',status:'completed',createdAt:'2026-10-07T05:00:00.000Z',parameters:{prompts:'p'},outputs:{mediaId:'555'}};
  const job={id:'j',title:'t',prompt:'p',state:'waiting',taskId:'2064395107592204379',submittedAt:Date.parse('2026-10-07T04:59:00.000Z'),expected:1,saved:[]};
  const calls=[];let fail=true;
  const io={persist(){calls.push('persist');},async prepare(){calls.push('prepare');return{expected:1};},async submit(){calls.push('submit');return '1';},async waitTask(){calls.push('waitTask');return task;},
    async saveImage(current,id){calls.push(`save:${id}`);if(fail)throw describeQueryFailure(400,validation);return `${id}.png`;},async saveMetadata(){calls.push('meta');}};
  await assert.rejects(processJob(job,io),/조회 형식 오류 \(400, GRAPHQL_VALIDATION_FAILED\)/);
  assert.equal(job.state,'save_failed');assert.equal(job.taskId,'2064395107592204379');assert.deepEqual(job.mediaIds,['555']);assert.deepEqual(job.saved,[]);
  assert.ok(!calls.includes('submit'));assert.ok(!calls.includes('prepare'));
  fail=false;await processJob(job,io);
  assert.equal(job.state,'done');assert.deepEqual(job.saved,[{mediaId:'555',file:'555.png'}]);assert.ok(!calls.includes('submit'));assert.equal(calls.filter(x=>x==='waitTask').length,2);
});
