const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {generateDevelopmentUserscript,buildDevelopmentUserscript}=require('./tools/build-development-userscript.cjs');
const STABLE_URL='https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js';
const DEVELOPMENT_URL='https://raw.githubusercontent.com/cotton100/pixai-web-queue/develop/pixai-web-queue.dev.user.js';
const manifest={version:'0.10.2',developmentVersion:'0.10.2-dev.1'};
const fixture=`// ==UserScript==
// @name         PixAI 웹 대기열 (로컬 후보)
// @namespace    local.pixai-web-queue
// @version      0.10.2
// @updateURL    ${STABLE_URL}
// @downloadURL  ${STABLE_URL}
// @description  공식 API로 생성합니다.
// @match        https://pixai.art/*
// @grant        GM_info
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.pixai.art
// ==/UserScript==
(() => {
  const UPDATE_CHANNEL = 'stable';
  const UPDATE_URLS = {stable:'${STABLE_URL}',development:'${DEVELOPMENT_URL}'};
  const OPTIONS_KEY = 'local.pixai-web-queue.options.v1';
  const LIBRARY_KEY = 'local.pixai-web-queue.presets.v1';
  const title = 'PixAI 대기열 · 0.10.2';
  const backup = {appVersion:'0.10.2'};
  const unrelated = '0.10.20 and 0.10.2-dev.9';
})();
`;
const header=text=>text.split('// ==/UserScript==')[0];
const metadata=(text,name)=>[...header(text).matchAll(new RegExp(`^//[ \\t]+@${name}(?:[ \\t]+(.+))?$`,'gm'))].map(match=>match[1]?.trim()||'');
test('development build keeps installed identity, permission scope and storage keys while changing only channel metadata and release versions',()=>{
  const generated=generateDevelopmentUserscript(fixture,manifest);
  for(const name of ['name','namespace','match','grant','connect'])assert.deepEqual(metadata(generated,name),metadata(fixture,name));
  assert.deepEqual(metadata(generated,'updateURL'),[DEVELOPMENT_URL]);assert.deepEqual(metadata(generated,'downloadURL'),[DEVELOPMENT_URL]);
  assert.deepEqual(metadata(generated,'version'),['0.10.2-dev.1']);assert.match(generated,/\[개발판\] 공식 API/);
  assert.match(generated,/const UPDATE_CHANNEL = 'development';/);assert.match(generated,/PixAI 대기열 · 0\.10\.2-dev\.1/);assert.match(generated,/appVersion:'0\.10\.2-dev\.1'/);
  assert.match(generated,/0\.10\.20 and 0\.10\.2-dev\.9/);
  assert(generated.includes(`stable:'${STABLE_URL}',development:'${DEVELOPMENT_URL}'`));
  assert.deepEqual([...generated.matchAll(/const (?:OPTIONS|LIBRARY)_KEY = '[^']+';/g)].map(match=>match[0]),[...fixture.matchAll(/const (?:OPTIONS|LIBRARY)_KEY = '[^']+';/g)].map(match=>match[0]));
  const permittedBody=fixture.slice(fixture.indexOf('// ==/UserScript==')).replace("const UPDATE_CHANNEL = 'stable';","const UPDATE_CHANNEL = 'development';").replace(/'0\.10\.2'/g,"'0.10.2-dev.1'").replace('· 0.10.2','· 0.10.2-dev.1');
  assert.equal(generated.slice(generated.indexOf('// ==/UserScript==')),permittedBody);
  assert.equal(generateDevelopmentUserscript(fixture,manifest),generated);assert.equal(generateDevelopmentUserscript(fixture.replace(/\n/g,'\r\n'),manifest),generated);
});
test('development generation rejects wrong package versions, metadata and missing or duplicate channel markers',()=>{
  for(const developmentVersion of [undefined,'0.10.1-dev.1','0.10.2','0.10.2-dev.0','0.10.2-dev.01','0.10.2-dev.1-extra'])assert.throws(()=>generateDevelopmentUserscript(fixture,{...manifest,developmentVersion}),/developmentVersion/);
  for(const version of [undefined,'0.10.2-dev.1','00.10.2','0.10.2\n'])assert.throws(()=>generateDevelopmentUserscript(fixture,{...manifest,version}),/stable package version/);
  assert.throws(()=>generateDevelopmentUserscript(fixture.replace('@version      0.10.2','@version      0.10.1'),manifest),/metadata version/);
  assert.throws(()=>generateDevelopmentUserscript(fixture.replace(`// @updateURL    ${STABLE_URL}`,`// @updateURL    ${DEVELOPMENT_URL}`),manifest),/stable update URLs/);
  assert.throws(()=>generateDevelopmentUserscript(fixture.replace('// @namespace    local.pixai-web-queue\n',''),manifest),/@namespace/);
  assert.throws(()=>generateDevelopmentUserscript(fixture.replace('// @namespace    local.pixai-web-queue','// @namespace    '),manifest),/@namespace/);
  assert.throws(()=>generateDevelopmentUserscript(fixture.replace('// @version      0.10.2','// @version      0.10.2\n// @version      0.10.2'),manifest),/@version/);
  assert.throws(()=>generateDevelopmentUserscript(fixture.replace("const UPDATE_CHANNEL = 'stable';",''),manifest),/UPDATE_CHANNEL/);
  assert.throws(()=>generateDevelopmentUserscript(fixture.replace("const UPDATE_CHANNEL = 'stable';","const UPDATE_CHANNEL = 'stable';\nconst UPDATE_CHANNEL = 'stable';"),manifest),/UPDATE_CHANNEL/);
  assert.throws(()=>generateDevelopmentUserscript(fixture.replace('// ==UserScript==',''),manifest),/metadata header/);
});
test('check mode rejects missing and stale development artifacts without changing either source',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pixai-channel-check-'));t.after(()=>{for(const name of ['pixai-web-queue.user.js','pixai-web-queue.dev.user.js','package.json']){const file=path.join(directory,name);if(fs.existsSync(file))fs.unlinkSync(file);}fs.rmdirSync(directory);});
  const source=path.join(directory,'pixai-web-queue.user.js'),output=path.join(directory,'pixai-web-queue.dev.user.js');fs.writeFileSync(source,fixture);fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify(manifest));
  assert.throws(()=>buildDevelopmentUserscript({directory,check:true}),/missing or stale/);assert.equal(fs.existsSync(output),false);
  fs.writeFileSync(output,'stale');assert.throws(()=>buildDevelopmentUserscript({directory,check:true}),/missing or stale/);assert.equal(fs.readFileSync(output,'utf8'),'stale');
  fs.writeFileSync(output,generateDevelopmentUserscript(fixture,manifest));assert.doesNotThrow(()=>buildDevelopmentUserscript({directory,check:true}));assert.equal(fs.readFileSync(source,'utf8'),fixture);
  const windowsOutput=generateDevelopmentUserscript(fixture,manifest).replace(/\n/g,'\r\n');fs.writeFileSync(output,windowsOutput);assert.doesNotThrow(()=>buildDevelopmentUserscript({directory,check:true}));assert.equal(fs.readFileSync(output,'utf8'),windowsOutput);
});
test('repository development artifact uses the canonical identity and permissions with no storage migration or URL rewrite in the body',()=>{
  const source=fs.readFileSync(path.join(__dirname,'pixai-web-queue.user.js'),'utf8'),pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'package.json'),'utf8'));
  const generated=generateDevelopmentUserscript(source,pkg),artifact=fs.readFileSync(path.join(__dirname,'pixai-web-queue.dev.user.js'),'utf8').replace(/\r\n/g,'\n');assert.equal(artifact,generated);
  for(const name of ['name','namespace','match','grant','connect','license','sandbox','run-at','noframes'])assert.deepEqual(metadata(artifact,name),metadata(source,name));
  assert.deepEqual(metadata(artifact,'version'),[pkg.developmentVersion]);assert.deepEqual(metadata(artifact,'downloadURL'),[DEVELOPMENT_URL]);
  const body=artifact.slice(artifact.indexOf('// ==/UserScript=='));assert(body.includes(STABLE_URL));assert(body.includes(DEVELOPMENT_URL));
  const keys=text=>[...text.matchAll(/\bconst\s+[A-Z_]*KEY\s*=\s*['"][^'"]+['"]/g)].map(match=>match[0]);assert.deepEqual(keys(artifact),keys(source));
  assert(artifact.includes(`PixAI 대기열 · ${pkg.developmentVersion}`));assert(!artifact.includes(`appVersion:'${pkg.version}'`));
});
