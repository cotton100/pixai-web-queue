'use strict';
// Read-only public REST probe. Never creates a task or saves the API key.
const path=require('node:path');
const fs=require('node:fs/promises');
const DEFAULT_TASK='2064707131934430374';

async function probeTask(key,{taskId=DEFAULT_TASK,fetchImpl=fetch}={}) {
  if (typeof key!=='string' || !key.trim() || /[\r\n]/.test(key)) throw new Error('Invalid API key input');
  if (!/^\d+$/.test(taskId)) throw new Error('Invalid task ID');
  let response;
  try {
    response=await fetchImpl('https://api.pixai.art/v1/task/'+taskId,{
      method:'GET',headers:{Authorization:'Bearer '+key.trim()},
      credentials:'omit',redirect:'error',signal:AbortSignal.timeout(25000)
    });
  } catch {return {result:'network_error',authenticated:false,taskId};}
  const base={httpStatus:response.status,authenticated:false,taskId};
  if (response.status===401) return {...base,result:'unauthorized'};
  if (response.status===403) return {...base,result:'forbidden'};
  if (response.status===404) return {...base,result:'not_found'};
  if (response.status===429) return {...base,result:'rate_limited'};
  if (!response.ok) return {...base,result:'http_error'};
  let task;
  try {task=await response.json();} catch {return {...base,result:'invalid_response'};}
  if (task?.id!==taskId || !['waiting','running','completed','failed','cancelled'].includes(task.status)) return {...base,result:'invalid_response'};
  return {...base,result:'task_read',authenticated:true,taskStatus:task.status,
    mediaCount:Array.isArray(task.outputs?.mediaIds) ? task.outputs.mediaIds.length : 0,
    imageUrlCount:Array.isArray(task.outputs?.mediaUrls) ? task.outputs.mediaUrls.length : 0};
}

function readHiddenKey(input=process.stdin,output=process.stdout) {
  if (!input.isTTY || typeof input.setRawMode!=='function') throw new Error('Run from an interactive terminal');
  output.write('API key (hidden): ');
  return new Promise((resolve,reject)=>{
    let key='',wasRaw=!!input.isRaw;
    input.setRawMode(true);input.resume();
    const finish=(error)=>{input.removeListener('data',read);input.setRawMode(wasRaw);input.pause();output.write('\n');error ? reject(error) : resolve(key.trim());};
    const read=data=>{
      for (const c of data.toString('utf8')) {
        if (c==='\u0003') {key='';finish(new Error('Input cancelled'));return;}
        if (c==='\r'||c==='\n') {finish();return;}
        if (c==='\u007f'||c==='\b') {if(key){key=key.slice(0,-1);output.write('\b \b');}continue;}
        if (c>=' '&&c<='~') {if (key.length>=8192){key='';finish(new Error('Input too long'));return;}key+=c;output.write('*');}
      }
    };
    input.on('data',read);
  });
}

async function main() {
  console.log('PixAI official API: one existing task lookup; NO generation, NO charge request.');
  console.log('The API key stays in this process only. It is not written to disk.');
  let key=await readHiddenKey();
  let result;
  try {result=await probeTask(key);} finally {key='';}
  const destination=path.resolve(__dirname,'../test-output/official-api-probe.json');
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.writeFile(destination,JSON.stringify({...result,checkedAt:new Date().toISOString()},null,2)+'\n');
  console.log('Result: '+result.result+(result.httpStatus ? ' (HTTP '+result.httpStatus+')' : ''));
  if (result.result==='task_read') console.log('Authenticated. Task '+result.taskStatus+'. Image URLs: '+result.imageUrlCount+'.');
  if (result.result==='not_found') console.log('404 does NOT confirm the key. Web-generated tasks may be unavailable through this API.');
  console.log('Saved status only: '+destination);
}

module.exports={probeTask,readHiddenKey};
if (require.main===module) main().catch(()=>{console.error('Probe stopped. No API key or server response has been logged.');process.exitCode=1;});
