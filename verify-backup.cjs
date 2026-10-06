const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={module:{exports:{}},TextEncoder};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8'),sandbox);
const {makePresetLibrary,normalizePresetLibrary,normalizeSettingsOptions,makeSettingsBackup,parseSettingsBackup}=sandbox.module.exports;
const plain=value=>JSON.parse(JSON.stringify(value));
const options={maxCredits:7800,filePrefix:'asset',repeat:2};
const meta={appVersion:'0.3.2',exportedAt:'2026-10-07T02:03:04.000Z'};
function library() {
  return {version:1,common:{prompt:'masterpiece, masterpiece',negativePrompt:'lowres'},
    presets:[{id:'p1',name:'설정',model:{id:'12345678901234567890',name:'모델',versionId:'23456789012345678901',family:'SDXL'},
      loras:[{id:'10',versionId:'101',name:'LoRA',weight:0,triggerWords:'(character_name:1.2)\nmasterpiece'}]}],
    characters:[{id:'c1',name:'캐릭터',prompt:'1girl, (blue hair:1.2)',negativePrompt:'red hair'}],
    scenes:[{id:'s1',name:'표정',prompt:'smile',negativePrompt:'sad'},{id:'s2',name:'행동',prompt:'running',negativePrompt:''}],
    reservations:[{id:'r1',presetId:'p1',characterId:'c1',sceneIds:['s2','s1'],count:2}]};
}
function backup() {return plain(makeSettingsBackup(library(),options,meta));}
function parse(value) {return parseSettingsBackup(JSON.stringify(value));}

test('new settings backup round trip preserves stored library, selected options, and metadata',()=>{
  const payload=makeSettingsBackup(library(),options,meta),result=parse(payload);
  assert.equal(payload.format,'pixai-web-queue-settings');assert.equal(payload.version,1);
  assert.equal(result.source,'settings');assert.equal(result.appVersion,meta.appVersion);assert.equal(result.exportedAt,meta.exportedAt);
  assert.deepEqual(plain(result.library),plain(normalizePresetLibrary(library())));assert.deepEqual(plain(result.options),options);
  assert.equal('jobs' in payload,false);assert.equal('jobs' in result,false);
  assert.equal(result.library.presets[0].model.id,'12345678901234567890');
  assert.equal(result.library.presets[0].loras[0].weight,0);
  assert.equal(result.library.presets[0].loras[0].triggerWords,'(character_name:1.2)\nmasterpiece');
});
test('export results do not alias the live library or option inputs',()=>{
  const source=library(),current={...options},original=plain(source),result=makeSettingsBackup(source,current,meta);
  result.library.common.prompt='changed';result.library.presets[0].loras[0].weight=2;result.library.reservations[0].sceneIds.reverse();result.options.repeat=100;
  assert.deepEqual(source,original);assert.deepEqual(current,options);
});
test('older queue backups import only saved library and preserve current options through null',()=>{
  const source=library(),jobs=[{id:'paid-task',taskId:'900',state:'submitting',prompt:'do not replay',saved:[],configuration:{anything:'ignored'}}];
  const original=plain(jobs),result=parse({version:1,jobs,library:source});
  assert.equal(result.source,'queue');assert.equal(result.options,null);assert.equal(result.appVersion,null);assert.equal(result.exportedAt,null);
  assert.equal('jobs' in result,false);assert.equal('taskId' in result,false);assert.deepEqual(jobs,original);
  assert.deepEqual(plain(result.library),plain(normalizePresetLibrary(source)));
});
test('raw version-one libraries import without options and legacy single sceneId is converted compatibly',()=>{
  const source=library();source.reservations=[{id:'legacy',presetId:'p1',characterId:'c1',sceneId:'s1',count:3}];
  const result=parse(source);assert.equal(result.source,'library');assert.equal(result.options,null);
  assert.deepEqual(plain(result.library.reservations[0].sceneIds),['s1']);assert.equal('sceneId' in result.library.reservations[0],false);
  assert.equal(source.reservations[0].sceneId,'s1');
});
test('empty libraries and zero-chunk reservations remain valid, while orphan references are retained for editing',()=>{
  assert.deepEqual(plain(parse(makePresetLibrary()).library),plain(makePresetLibrary()));
  const source=library();source.reservations[0].sceneIds=[];
  assert.deepEqual(plain(parse(source).library.reservations[0].sceneIds),[]);
  source.reservations[0].sceneIds=['orphan'];assert.deepEqual(plain(parse(source).library.reservations[0].sceneIds),['orphan']);
});
test('options accept only exact number/null contracts and preserve the no-credit-limit choice',()=>{
  assert.deepEqual(plain(normalizeSettingsOptions({maxCredits:null,filePrefix:' 이름 ',repeat:100})),{maxCredits:null,filePrefix:'이름',repeat:100});
  for(const maxCredits of ['7800',undefined,0,-1,1.5,NaN,Infinity,true])assert.throws(()=>normalizeSettingsOptions({...options,maxCredits}),/상한/);
  for(const repeat of ['2',undefined,0,-1,101,1.5,NaN,Infinity,true])assert.throws(()=>normalizeSettingsOptions({...options,repeat}),/반복 횟수/);
  for(const filePrefix of [null,undefined,1,{},[]])assert.throws(()=>normalizeSettingsOptions({...options,filePrefix}),/문자열/);
});
test('missing or unexpected option fields cannot silently reset live settings',()=>{
  for(const key of ['maxCredits','filePrefix','repeat']){const source={...options};delete source[key];assert.throws(()=>normalizeSettingsOptions(source),/필수 항목|형식/);}
  assert.throws(()=>normalizeSettingsOptions({...options,directory:'C:/outside'}),/필수 항목|형식/);
  const payload=backup();delete payload.options;assert.throws(()=>parse(payload),/필수 항목|형식/);
});
test('unsupported format/version, wrong roots, and unrelated JSON are refused',()=>{
  for(const value of [null,[],42,'not a backup',{answer:1},{version:1,jobs:[]},{version:1,library:library()},
    {version:1,jobs:{},library:library()},{version:2,jobs:[],library:library()}])assert.throws(()=>parse(value));
  for(const format of ['other-app',null,1]){const payload=backup();payload.format=format;assert.throws(()=>parse(payload),/형식 또는 버전/);}
  for(const version of [0,2,'1',null]){const payload=backup();payload.version=version;assert.throws(()=>parse(payload),/형식 또는 버전/);}
  const payload=backup();payload.jobs=[];assert.throws(()=>parse(payload),/필수 항목|형식/);
  assert.throws(()=>parse({...library(),unrelated:'ignored field'}),/필수 항목|형식/);
  assert.throws(()=>parse({version:1,jobs:[],library:library(),unrelated:'ignored field'}),/필수 항목|형식/);
});
test('missing or malformed library arrays fail rather than becoming empty imported lists',()=>{
  for(const key of ['presets','characters','scenes','reservations']) {
    const missing=library();delete missing[key];assert.throws(()=>parse(missing),/필수 항목|형식/);
    const broken=library();broken[key]=null;assert.throws(()=>parse(broken),/목록 형식|형식/);
  }
  const source=library();source.version=2;assert.throws(()=>parse(source),/버전/);
});
test('missing prompt fields and null text cannot silently erase existing stored prompt data',()=>{
  for(const field of ['prompt','negativePrompt']) {
    const common=library();delete common.common[field];assert.throws(()=>parse(common),/필수 항목|형식/);
    const nullCommon=library();nullCommon.common[field]=null;assert.throws(()=>parse(nullCommon),/문자열/);
    for(const key of ['characters','scenes']) {
      const source=library();delete source[key][0][field];assert.throws(()=>parse(source),/필수 항목|형식/);
      const nullSource=library();nullSource[key][0][field]=null;assert.throws(()=>parse(nullSource),/문자열/);
    }
  }
});
test('invalid identities, duplicate chunks, and invalid numeric LoRA settings remain rejected on import',()=>{
  for(const mutate of [source=>source.presets[0].model.id=123,source=>source.presets[0].model.versionId='bad',
    source=>source.presets[0].loras[0].weight=3,source=>source.reservations[0].sceneIds=['s1','s1'],source=>source.reservations[0].count=0]) {
    const source=library();mutate(source);assert.throws(()=>parse(source));
  }
});
test('dangerous prototype-related keys are rejected at every parsed object depth without prototype changes',()=>{
  for(const key of ['__proto__','prototype','constructor']) {
    const payload=backup();payload.library.common[key]={pollutedBackup:true};
    // __proto__ assignment does not create a key, so define a JSON-visible own property.
    Object.defineProperty(payload.library.common,key,{value:{pollutedBackup:true},enumerable:true,configurable:true});
    assert.throws(()=>parse(payload),/허용하지 않는 객체 속성/);
  }
  assert.equal({}.pollutedBackup,undefined);
  const allowed=library();allowed.common.prompt='constructor, prototype, __proto__';
  assert.equal(parse(allowed).library.common.prompt,'constructor, prototype, __proto__');
});
test('UTF-8 import size is capped at 5MiB including multi-byte Korean text',()=>{
  const max=5*1024*1024,empty=plain(makePresetLibrary()),base=JSON.stringify(empty).length;
  empty.common.prompt='a'.repeat(max-base);const exact=JSON.stringify(empty);
  assert.equal(Buffer.byteLength(exact,'utf8'),max);assert.equal(parseSettingsBackup(exact).library.common.prompt.length,max-base);
  assert.throws(()=>parseSettingsBackup(exact+' '),/5MiB/);
  empty.common.prompt='가'.repeat(Math.floor((max-base)/3)+1);const multibyte=JSON.stringify(empty);
  assert.ok(multibyte.length<max);assert.ok(Buffer.byteLength(multibyte,'utf8')>max);assert.throws(()=>parseSettingsBackup(multibyte),/5MiB/);
});
test('malformed JSON and non-text inputs have safe actionable errors, while a UTF-8 BOM is tolerated',()=>{
  assert.throws(()=>parseSettingsBackup('{private invalid content'),/JSON 형식/);
  assert.throws(()=>parseSettingsBackup(''),/JSON 형식/);
  assert.throws(()=>parseSettingsBackup({}),/파일 내용/);
  assert.equal(parseSettingsBackup('\uFEFF'+JSON.stringify(backup())).source,'settings');
});
test('metadata must be meaningful UTC timestamps and app-version text',()=>{
  for(const badMeta of [{...meta,appVersion:''},{...meta,appVersion:3},{...meta,exportedAt:'bad'},
    {...meta,exportedAt:'2026-02-31T00:00:00.000Z'},{...meta,exportedAt:'2026-10-07'}, {...meta,exportedAt:null}]) {
    assert.throws(()=>makeSettingsBackup(library(),options,badMeta),/버전|시각/);
  }
  assert.equal(makeSettingsBackup(library(),options,{...meta,exportedAt:'2026-10-07T02:03:04Z'}).exportedAt,meta.exportedAt);
  const payload=backup();delete payload.exportedAt;assert.throws(()=>parse(payload),/필수 항목|형식/);
});
