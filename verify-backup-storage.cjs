const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8'), context);
const {createSettingsStore} = context.module.exports;
const keys = {library:'fixture.library',options:'fixture.options',previous:'fixture.previous'};
const library = () => ({version:1,common:{prompt:'new prompt',negativePrompt:''},presets:[],characters:[],scenes:[],reservations:[]});
const options = () => ({maxCredits:7800,filePrefix:' new assets ',repeat:2});
const parsed = () => ({library:library(),options:options()});
const original = {library:'old library raw',options:'old options raw'};
const snapshot = value => JSON.stringify(value);
function fixture(initial = original, fail = () => null) {
  const data = new Map([
    ['fixture.queue','unchanged queue'],['fixture.site','unchanged site setting'],['unrelated','unchanged'],
    ...Object.entries(initial).filter(([,value]) => value !== null).map(([name,value]) => [keys[name],value])
  ]);
  const calls = [];
  function call(operation,key,value) {
    calls.push({operation,key,value});
    const error = fail(operation,key,value,calls);
    if (error) throw error;
  }
  const storage = {
    getItem(key) {call('get',key);return data.get(key) ?? null;},
    setItem(key,value) {call('set',key,value);data.set(key,String(value));},
    removeItem(key) {call('remove',key);data.delete(key);}
  };
  return {data,calls,storage,store:() => createSettingsStore(storage,keys),
    raw:() => ({library:data.get(keys.library) ?? null,options:data.get(keys.options) ?? null}),
    writes:() => calls.filter(item => item.operation !== 'get')};
}
function quota() {return Object.assign(new Error('fixture quota'),{name:'QuotaExceededError'});}
function untouchedOutsideSettings(f) {
  assert.equal(f.data.get('fixture.queue'),'unchanged queue');
  assert.equal(f.data.get('fixture.site'),'unchanged site setting');
  assert.equal(f.data.get('unrelated'),'unchanged');
  assert.ok(f.calls.every(item => Object.values(keys).includes(item.key)));
}

test('settings import backs up exact raw values before writing normalized options and library',() => {
  const f=fixture(), store=f.store();
  const value=parsed();value.library.common.prompt='  new\r\nprompt  ';
  const result=store.apply(value);
  assert.equal(f.writes()[0].key,keys.previous);
  assert.equal(f.data.get(keys.previous),snapshot(original));
  assert.equal(JSON.parse(f.raw().library).common.prompt,'new\nprompt');
  assert.deepEqual(JSON.parse(f.raw().options),{maxCredits:7800,filePrefix:'new assets',repeat:2});
  assert.equal(result.library.common.prompt,'new\nprompt');
  assert.equal(store.hasPrevious(),true);
  untouchedOutsideSettings(f);
});

test('legacy import with null options preserves even unparseable current options without rewriting that key',() => {
  const f=fixture(), store=f.store();
  const result=store.apply({library:library(),options:null});
  assert.equal(f.raw().options,original.options);
  assert.equal(result.options,null);
  assert.ok(!f.writes().some(item => item.key === keys.options));
  assert.equal(f.data.get(keys.previous),snapshot(original));
  untouchedOutsideSettings(f);
});

test('missing original keys are retained as null and undo removes imported values without deleting the snapshot',() => {
  const f=fixture({library:null,options:null}), store=f.store();
  store.apply(parsed());
  assert.equal(f.data.get(keys.previous),snapshot({library:null,options:null}));
  assert.equal(store.undo(),true);
  assert.deepEqual(f.raw(),{library:null,options:null});
  assert.equal(store.undo(),true);
  assert.equal(store.hasPrevious(),true);
  assert.equal(f.data.get(keys.previous),snapshot({library:null,options:null}));
  untouchedOutsideSettings(f);
});

test('invalid imported library or options never writes originals or replaces an existing recovery snapshot',() => {
  const previous=snapshot({library:'earlier',options:null});
  const f=fixture({...original,previous}), store=f.store();
  assert.throws(() => store.apply({library:[],options:null}));
  assert.throws(() => store.apply({library:library(),options:{...options(),repeat:0}}));
  assert.throws(() => store.apply({library:library()}));
  assert.deepEqual(f.raw(),original);assert.equal(f.data.get(keys.previous),previous);
  assert.equal(f.writes().length,0);
});

test('snapshot write failure leaves both original keys and the older recovery snapshot untouched',() => {
  const previous=snapshot({library:'earlier',options:null});
  const f=fixture({...original,previous},(op,key) => op === 'set' && key === keys.previous ? quota() : null);
  assert.throws(() => f.store().apply(parsed()),/복구 사본.*현재 설정은 바꾸지/);
  assert.deepEqual(f.raw(),original);assert.equal(f.data.get(keys.previous),previous);
  assert.deepEqual(f.writes().map(item=>item.key),[keys.previous]);
});

test('options write failure restores both original keys and retains the new recovery snapshot',() => {
  let failed=false;
  const f=fixture(original,(op,key) => {
    if (op === 'set' && key === keys.options && !failed) {failed=true;return quota();}
    return null;
  });
  assert.throws(() => f.store().apply(parsed()),/원래 설정으로 되돌렸/);
  assert.deepEqual(f.raw(),original);assert.equal(f.data.get(keys.previous),snapshot(original));
  assert.ok(f.writes().some(item => item.key === keys.library));
  untouchedOutsideSettings(f);
});

test('library write failure after options change rolls back both keys and keeps exact originals for undo',() => {
  let failed=false;
  const f=fixture(original,(op,key) => {
    if (op === 'set' && key === keys.library && !failed) {failed=true;return quota();}
    return null;
  });
  assert.throws(() => f.store().apply(parsed()),/원래 설정으로 되돌렸/);
  assert.deepEqual(f.raw(),original);assert.equal(f.data.get(keys.previous),snapshot(original));
  assert.equal(f.store().hasPrevious(),true);untouchedOutsideSettings(f);
});

test('import plus rollback failure reports partial state and still attempts the other rollback key',() => {
  let importing=true;
  const f=fixture(original,(op,key,value) => {
    if (op === 'set' && key === keys.library && importing) {importing=false;return quota();}
    if (op === 'set' && key === keys.options && value === original.options) return quota();
    return null;
  });
  assert.throws(() => f.store().apply(parsed()), error => {
    assert.equal(error.rollbackFailed,true);
    assert.match(error.message,/원본 복원도 실패/);assert.match(error.message,/복구 사본은 보존/);return true;
  });
  assert.equal(f.raw().library,original.library);
  assert.equal(JSON.parse(f.raw().options).repeat,2);
  assert.equal(f.data.get(keys.previous),snapshot(original));
  untouchedOutsideSettings(f);
});

test('undo restores raw strings without normalization and permits repeated undo against the same snapshot',() => {
  const target={library:'unparseable legacy library',options:'unparseable legacy options'};
  const f=fixture({...original,previous:snapshot(target)}), store=f.store();
  assert.equal(store.undo(),true);assert.deepEqual(f.raw(),target);
  assert.equal(store.undo(),true);assert.deepEqual(f.raw(),target);
  assert.equal(f.data.get(keys.previous),snapshot(target));untouchedOutsideSettings(f);
});

test('malformed recovery snapshots cannot write either original key',() => {
  for (const previous of [null,'broken','null','[]','{}','{"library":"x"}',
    '{"library":2,"options":null}','{"library":null,"options":false}',
    '{"library":"x","options":"y","extra":"z"}']) {
    const f=fixture({...original,previous}), store=f.store();
    assert.equal(store.hasPrevious(),false);assert.throws(() => store.undo());
    assert.deepEqual(f.raw(),original);assert.equal(f.writes().length,0);
  }
});

test('undo write failure rolls back to the current settings and leaves the earlier snapshot available',() => {
  const target={library:'target library',options:'target options'};
  let failed=false;
  const f=fixture({...original,previous:snapshot(target)},(op,key) => {
    if (op === 'set' && key === keys.library && !failed) {failed=true;return quota();}
    return null;
  });
  assert.throws(() => f.store().undo(),/원래 설정으로 되돌렸/);
  assert.deepEqual(f.raw(),original);assert.equal(f.data.get(keys.previous),snapshot(target));
  assert.equal(f.store().undo(),true);assert.deepEqual(f.raw(),target);untouchedOutsideSettings(f);
});

test('undo plus rollback failure keeps the original recovery snapshot and reports that state is incomplete',() => {
  const target={library:'target library',options:'target options'};
  const f=fixture({...original,previous:snapshot(target)},(op,key,value) => {
    if (op === 'set' && key === keys.library && value === target.library) return quota();
    if (op === 'set' && key === keys.options && value === original.options) return quota();
    return null;
  });
  assert.throws(() => f.store().undo(),error => {assert.equal(error.rollbackFailed,true);assert.match(error.message,/복구 사본은 보존/);return true;});
  assert.equal(f.raw().library,original.library);assert.equal(f.raw().options,target.options);
  assert.equal(f.data.get(keys.previous),snapshot(target));untouchedOutsideSettings(f);
});

test('storage read failures and colliding keys reject before any mutation',() => {
  const f=fixture(original,op => op === 'get' ? quota() : null), store=f.store();
  assert.throws(() => store.apply(parsed()));assert.throws(() => store.undo());assert.equal(store.hasPrevious(),false);
  assert.equal(f.writes().length,0);
  assert.throws(() => createSettingsStore(f.storage,{library:'same',options:'same',previous:'backup'}));
  assert.throws(() => createSettingsStore(f.storage,{library:'lib',options:'opts'}));
});
