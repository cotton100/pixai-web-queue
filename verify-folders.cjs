const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={module:{exports:{}},TextEncoder};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8'),sandbox);
const {makePresetLibrary,normalizePresetLibrary,orderedChunks,moveLibraryItem,removeChunkFolder,
  expandPresetReservations,makeSettingsBackup,parseSettingsBackup}=sandbox.module.exports;
const plain=value=>JSON.parse(JSON.stringify(value));
const ids=items=>plain(items.map(item=>item.id));
const copy=value=>structuredClone(value);
function frozen(value) {
  if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}
  return value;
}
function fixture() {
  return {version:1,common:{prompt:'common, common',negativePrompt:'bad'},
    presets:[{id:'p1',name:'Preset',model:{id:'101',versionId:'201',name:'Model'},loras:[{id:'301',name:'LoRA',weight:0,triggerWords:'(trigger:1.2)'}]},
      {id:'p2',name:'Other',model:{id:'102',versionId:'202',name:'Other model'},loras:[]}],
    characters:[{id:'c1',name:'Character',prompt:'(character:1.1)',negativePrompt:'other'},
      {id:'c2',name:'Second',prompt:'1boy',negativePrompt:''}],
    chunkFolders:[{id:'fB',name:'행동'},{id:'fA',name:'표정'}],
    scenes:[{id:'a1',name:'Smile',prompt:'smile, common',negativePrompt:'sad',folderId:'fA'},
      {id:'u1',name:'Outside',prompt:'outdoor\n(wind:1.2)',negativePrompt:''},
      {id:'b1',name:'Running',prompt:'running',negativePrompt:'still',folderId:'fB'},
      {id:'a2',name:'Wave',prompt:'waving',negativePrompt:'',folderId:'fA'},
      {id:'u2',name:'Inside',prompt:'indoor',negativePrompt:''},
      {id:'b2',name:'Jumping',prompt:'jumping',negativePrompt:'',folderId:'fB'}],
    reservations:[{id:'r1',presetId:'p1',characterId:'c1',sceneIds:['b1','u1','a1'],count:2},
      {id:'r2',presetId:'p2',characterId:'c2',sceneIds:[],count:1}]};
}
function expand(library) {let n=0;return expandPresetReservations(library,{idFactory:()=>`job-${++n}`});}
function parse(library) {return parseSettingsBackup(JSON.stringify(library));}
const options={maxCredits:7800,filePrefix:'assets',repeat:1};
const meta={appVersion:'0.4.0',exportedAt:'2026-10-07T02:03:04.000Z'};

test('old libraries migrate missing folders to a fresh empty list without changing legacy chunk selection',()=>{
  const old=fixture();delete old.chunkFolders;for(const chunk of old.scenes)delete chunk.folderId;
  old.reservations[0]={id:'r1',presetId:'p1',characterId:'c1',sceneId:'a1',count:2};
  const before=copy(old),result=normalizePresetLibrary(frozen(old));
  assert.equal(result.version,1);assert.deepEqual(plain(result.chunkFolders),[]);
  assert.deepEqual(ids(result.scenes),ids(old.scenes));assert.deepEqual(plain(result.reservations[0].sceneIds),['a1']);
  assert.ok(result.scenes.every(chunk=>!Object.hasOwn(chunk,'folderId')));assert.deepEqual(old,before);
});

test('empty folder defaults are independent and a missing optional list differs from an invalid present list',()=>{
  const first=makePresetLibrary(),second=makePresetLibrary();first.chunkFolders.push({id:'f',name:'Folder'});
  assert.deepEqual(plain(second.chunkFolders),[]);
  for(const chunkFolders of [undefined,null,{},'folders',1,true]) {
    const library=fixture();library.chunkFolders=chunkFolders;
    assert.throws(()=>normalizePresetLibrary(library),/목록 형식/);
  }
});

test('folders reject duplicate IDs, invalid records, missing IDs, and blank or nonstring names',()=>{
  for(const folder of [null,[],{}, {id:'',name:'Folder'},{id:1,name:'Folder'},
    {id:'f',name:''},{id:'f',name:' \r\n '},{id:'f',name:1},{id:'f',name:null},{id:'f'}]) {
    const library=fixture();library.chunkFolders.push(folder);assert.throws(()=>normalizePresetLibrary(library),/형식|ID|이름|문자열/);
  }
  const duplicate=fixture();duplicate.chunkFolders.push({id:' fA ',name:'Duplicate'});
  assert.throws(()=>normalizePresetLibrary(duplicate),/ID가 중복/);
  const library=fixture();library.chunkFolders[0].name='  행동\r\n모음  ';
  assert.equal(normalizePresetLibrary(library).chunkFolders[0].name,'행동\n모음');
});

test('chunk memberships require a real folder and never silently become unfiled',()=>{
  for(const folderId of [undefined,null,'',1,[],{},'missing']) {
    const library=fixture();library.scenes[0].folderId=folderId;
    assert.throws(()=>normalizePresetLibrary(library),/ID|문자열|폴더가 없습니다/);
    if(folderId!==undefined)assert.throws(()=>parse(library));
  }
  const old=fixture();delete old.chunkFolders;assert.throws(()=>normalizePresetLibrary(old),/폴더가 없습니다/);
  const library=fixture();library.scenes[0].folderId=' fA ';
  assert.equal(normalizePresetLibrary(library).scenes[0].folderId,'fA');
});

test('ordered chunks put unfiled first then each folder in stored order while retaining order within groups',()=>{
  const library=fixture(),original=copy(library);
  assert.deepEqual(ids(orderedChunks(library)),['u1','u2','b1','b2','a1','a2']);
  assert.deepEqual(library,original);
  delete library.chunkFolders;for(const chunk of library.scenes)delete chunk.folderId;
  assert.deepEqual(ids(orderedChunks(library)),ids(library.scenes));
});

test('ordered chunk results are copied records and preserve weighted syntax, duplicate tags, and line breaks',()=>{
  const library=frozen(fixture()),original=plain(library),result=orderedChunks(library);
  assert.equal(result[0].prompt,'outdoor\n(wind:1.2)');assert.equal(result[4].prompt,'smile, common');
  result[0].prompt='changed';result[4].folderId='fB';result.reverse();assert.deepEqual(plain(library),original);
});

test('all ordinary library lists move one neighbor and valid boundaries return a copied no-op',()=>{
  for(const key of ['presets','characters','chunkFolders','reservations']) {
    const library=frozen(fixture()),original=plain(library),before=ids(library[key]);
    const moved=moveLibraryItem(library,key,before[0],1);assert.deepEqual(ids(moved[key]),[before[1],before[0]]);
    assert.deepEqual(ids(moveLibraryItem(moved,key,before[0],-1)[key]),before);
    const unchanged=moveLibraryItem(library,key,before[0],-1);assert.deepEqual(plain(unchanged),original);assert.notEqual(unchanged,library);
    unchanged.common.prompt='changed';assert.deepEqual(plain(library),original);
    assert.deepEqual(ids(moveLibraryItem(library,key,before.at(-1),1)[key]),before);
  }
});

test('invalid move list, missing item, and noncanonical directions are refused without mutating inputs',()=>{
  const library=frozen(fixture()),original=plain(library);
  for(const key of ['common','version','__proto__','missing',null])assert.throws(()=>moveLibraryItem(library,key,'a1',1),/목록/);
  for(const direction of [0,2,-2,'1',null,undefined])assert.throws(()=>moveLibraryItem(library,'scenes','a1',direction),/방향/);
  for(const id of ['missing','',null,1])assert.throws(()=>moveLibraryItem(library,'scenes',id,1),/항목|ID|문자열/);
  assert.deepEqual(plain(library),original);
});

test('chunk movement swaps neighbors only inside the same folder even when their storage positions are interleaved',()=>{
  const library=frozen(fixture()),original=plain(library),moved=moveLibraryItem(library,'scenes','a1',1);
  assert.deepEqual(ids(moved.scenes),['a2','u1','b1','a1','u2','b2']);
  assert.deepEqual(ids(orderedChunks(moved)),['u1','u2','b1','b2','a2','a1']);
  assert.deepEqual(plain(moveLibraryItem(library,'scenes','a1',-1)),original);
  assert.deepEqual(plain(moveLibraryItem(library,'scenes','b2',1)),original);
  const unfiled=moveLibraryItem(library,'scenes','u1',1);
  assert.deepEqual(ids(unfiled.scenes),['a1','u2','b1','a2','u1','b2']);
  assert.deepEqual(plain(unfiled.reservations),plain(library.reservations));assert.deepEqual(plain(library),original);
});

test('folder movement changes group display order without rewriting chunk storage or captured reservation order',()=>{
  const library=fixture(),moved=moveLibraryItem(library,'chunkFolders','fB',1);
  assert.deepEqual(ids(orderedChunks(moved)),['u1','u2','a1','a2','b1','b2']);
  assert.deepEqual(plain(moved.scenes),library.scenes);assert.deepEqual(plain(moved.reservations),library.reservations);
});

test('folder removal keeps all chunks, moves only its children to unfiled, and leaves reservations unchanged',()=>{
  const library=frozen(fixture()),original=plain(library),result=removeChunkFolder(library,'fA');
  assert.deepEqual(ids(result.chunkFolders),['fB']);assert.deepEqual(ids(result.scenes),ids(library.scenes));
  assert.ok(result.scenes.filter(chunk=>chunk.id.startsWith('a')).every(chunk=>!Object.hasOwn(chunk,'folderId')));
  assert.equal(result.scenes.find(chunk=>chunk.id==='b1').folderId,'fB');
  assert.deepEqual(ids(orderedChunks(result)),['a1','u1','a2','u2','b1','b2']);
  assert.deepEqual(plain(result.reservations),plain(library.reservations));assert.deepEqual(plain(library),original);
  assert.throws(()=>removeChunkFolder(library,'missing'),/폴더가 없습니다/);
  assert.throws(()=>removeChunkFolder(library,''),/ID/);
});

test('folder reorder, rename, removal, and chunk membership edits preserve reserved prompt order and old job snapshots',()=>{
  const library=fixture(),jobs=expand(library),originalJobs=plain(jobs);
  let changed=moveLibraryItem(library,'chunkFolders','fB',1);changed=moveLibraryItem(changed,'scenes','a1',1);
  changed.chunkFolders[0].name='새 폴더명';changed.scenes.find(chunk=>chunk.id==='u1').folderId='fB';
  changed=removeChunkFolder(changed,'fA');const nextJobs=expand(changed);
  assert.deepEqual(plain(changed.reservations),library.reservations);
  assert.equal(nextJobs[0].prompt,'common, common, (trigger:1.2), (character:1.1), running, outdoor\n(wind:1.2), smile, common');
  assert.equal(nextJobs[0].negativePrompt,'bad, other, still, sad');
  assert.deepEqual(ids(nextJobs[0].composition.chunks),['b1','u1','a1']);assert.equal(nextJobs.length,3);
  assert.equal(nextJobs[0].title,jobs[0].title);assert.deepEqual(plain(jobs),originalJobs);
  assert.equal(jobs[0].composition.chunks[2].folderId,'fA');assert.equal('folderId' in nextJobs[0].composition.chunks[2],false);
});

test('settings, raw-library, and legacy-queue backups retain folder order and membership without restoring jobs',()=>{
  const library=fixture(),payload=makeSettingsBackup(frozen(library),options,meta);
  for(const input of [payload,library,{version:1,jobs:[{id:'never-replay',state:'submitting'}],library}]) {
    const result=parse(input);assert.deepEqual(plain(result.library),library);
    assert.deepEqual(ids(orderedChunks(result.library)),['u1','u2','b1','b2','a1','a2']);assert.equal('jobs' in result,false);
  }
  payload.library.chunkFolders.reverse();payload.library.scenes[0].folderId='fB';assert.deepEqual(library.chunkFolders,[{id:'fB',name:'행동'},{id:'fA',name:'표정'}]);
  assert.equal(library.scenes[0].folderId,'fA');
});

test('backups without folder fields stay compatible and legacy sceneId selection survives migration',()=>{
  const library=fixture();delete library.chunkFolders;for(const chunk of library.scenes)delete chunk.folderId;
  library.reservations[0]={id:'r1',presetId:'p1',characterId:'c1',sceneId:'a1',count:2};
  for(const input of [library,{version:1,jobs:[],library}]) {
    const result=parse(input);assert.deepEqual(plain(result.library.chunkFolders),[]);
    assert.deepEqual(plain(result.library.reservations[0].sceneIds),['a1']);assert.equal(result.options,null);
  }
});

test('strict backup validation rejects folder metadata extras, misplaced membership, malformed folders, and dangling folder IDs',()=>{
  for(const mutate of [library=>library.chunkFolders[0].color='red',library=>library.chunkFolders[0].name=null,
    library=>delete library.chunkFolders[0].name,library=>library.scenes[0].extra='hidden',library=>library.characters[0].folderId='fA',
    library=>library.scenes[0].folderId='missing',library=>library.chunkFolders=null]) {
    const library=fixture();mutate(library);assert.throws(()=>parse(library));assert.throws(()=>makeSettingsBackup(library,options,meta));
  }
  const library=fixture();library.reservations[0].sceneIds=['missing chunk'];
  assert.deepEqual(plain(parse(library).library.reservations[0].sceneIds),['missing chunk']);
  assert.throws(()=>expand(library),/청크가 없습니다/);
});
