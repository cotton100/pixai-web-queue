'use strict';
const fs=require('node:fs'),path=require('node:path');
const STABLE_URL='https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js';
const DEVELOPMENT_URL='https://raw.githubusercontent.com/cotton100/pixai-web-queue/develop/pixai-web-queue.dev.user.js';
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function metadata(header,name) {
  const values=[...header.matchAll(new RegExp(`^//[ \\t]+@${escapeRegex(name)}[ \\t]+(.+)$`,'gm'))].map(match=>match[1].trim());
  if(values.length!==1||!values[0])throw Error(`Expected one userscript @${name}`);
  return values[0];
}
function generateDevelopmentUserscript(source,manifest) {
  if(typeof source!=='string')throw Error('Expected userscript source');
  const version=manifest?.version,developmentVersion=manifest?.developmentVersion;
  if(typeof version!=='string'||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))throw Error('Expected a stable package version');
  if(typeof developmentVersion!=='string'||!new RegExp(`^${escapeRegex(version)}-dev\\.[1-9]\\d*$`).test(developmentVersion))throw Error('developmentVersion must match version-dev.N');
  const normalized=source.replace(/\r\n/g,'\n'),match=normalized.match(/^\/\/ ==UserScript==\n[\s\S]*?\n\/\/ ==\/UserScript==(?=\n|$)/);
  if(!match)throw Error('Userscript metadata header is missing');
  let header=match[0];
  metadata(header,'name');metadata(header,'namespace');
  if(metadata(header,'version')!==version)throw Error('Userscript metadata version differs from package version');
  if(metadata(header,'updateURL')!==STABLE_URL||metadata(header,'downloadURL')!==STABLE_URL)throw Error('Canonical userscript must use the stable update URLs');
  const channelMarker=/^[ \t]*const UPDATE_CHANNEL = 'stable';[ \t]*$/gm;
  if([...normalized.matchAll(channelMarker)].length!==1)throw Error('Expected one stable UPDATE_CHANNEL marker');
  header=header.replace(/^\/\/[ \t]+@(updateURL|downloadURL)[ \t]+.+$/gm,(_,name)=>`// @${name.padEnd(13)}${DEVELOPMENT_URL}`);
  if(/^\/\/[ \t]+@description[ \t]+.+$/m.test(header))header=header.replace(/^(\/\/[ \t]+@description[ \t]+)(.+)$/m,(_,prefix,value)=>`${prefix}[개발판] ${value}`);
  let result=header+normalized.slice(match[0].length);
  result=result.replace(channelMarker,line=>line.replace("'stable'","'development'"));
  return result.replace(new RegExp(`(?<![0-9A-Za-z.+-])${escapeRegex(version)}(?![0-9A-Za-z.+-])`,'g'),developmentVersion);
}
function buildDevelopmentUserscript({directory=path.resolve(__dirname,'..'),check=false}={}) {
  const canonical=fs.readFileSync(path.join(directory,'pixai-web-queue.user.js'),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));
  const generated=generateDevelopmentUserscript(canonical,manifest),file=path.join(directory,'pixai-web-queue.dev.user.js');
  if(check) {
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==generated)throw Error('Development userscript is missing or stale: run node tools/build-userscript.cjs');
  } else fs.writeFileSync(file,generated);
  return generated;
}
module.exports={generateDevelopmentUserscript,buildDevelopmentUserscript};
if(require.main===module)buildDevelopmentUserscript({check:process.argv.includes('--check')});
