'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib'),core=require('./pixai-web-queue.user.js');
const sig=Buffer.from([137,80,78,71,13,10,26,10]);
function chunk(type,body=Buffer.alloc(0)){const out=Buffer.alloc(body.length+12);out.writeUInt32BE(body.length);out.write(type,4);body.copy(out,8);out.writeUInt32BE(core.imageCrc(out.subarray(4,-4)),out.length-4);return out;}
function png({width=8,height=8,texts=[],alphaBits}={}){const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;const raw=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=y*(width*4+1)+1+x*4;raw[p]=80;raw[p+1]=120;raw[p+2]=170;raw[p+3]=alphaBits?(254|(alphaBits[x*height+y]||0)):255;}return Buffer.concat([sig,chunk('IHDR',h),...texts,chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND')]);}
function itxt(key,text,compressed=false){return chunk('iTXt',Buffer.concat([Buffer.from(key+'\0'),Buffer.from([compressed?1:0,0,0,0]),compressed?zlib.deflateSync(Buffer.from(text)):Buffer.from(text)]));}
const payload={prompt:'final-positive',negativePrompt:'',modelVersionId:'201',loras:[{modelId:'401',weight:.5}],seed:7,batchSize:4,aspectRatio:'5:3',size:'1k',mode:'pro',style:{key:'chibi'}};
const fixtures=require('./test-fixtures/generated-images.cjs');
function job(){return {id:'job',taskId:'task',title:'PRIVATE-TITLE',path:'C:/private',apiKey:'PRIVATE-KEY',apiPayload:{...payload,apiKey:'PRIVATE-KEY'},configuration:{model:{id:'101'},loras:[{id:'301'}]}};}

test('synthetic valid JPEG/WebP containers support endian EXIF Unicode, XMP descriptions and remain byte-identical on save',async()=>{
 const description=JSON.stringify({prompt:'한국어 표정',negativePrompt:'',seed:17}),xml='<x:xmpmeta><rdf:RDF><rdf:Description><dc:description><rdf:Alt><rdf:li xml:lang="x-default">'+description.replace(/"/g,'&quot;')+'</rdf:li></rdf:Alt></dc:description></rdf:Description></rdf:RDF></x:xmpmeta>';
 for(const [format,data] of [['jpeg',fixtures.jpegWith(fixtures.exif(description,{unicode:true}),xml)],['webp',fixtures.webpWith(fixtures.exif(description,{little:false}),xml)]]){const info=await core.readImageInfo(data);assert.equal(info.format,format);assert.equal(info.width,8);assert.equal(info.height,8);assert(info.sources.some(v=>v.label.includes('EXIF')&&v.fields.prompt==='한국어 표정'));assert(info.sources.some(v=>v.label.includes('XMP')&&v.fields.negativePrompt===''));const blob=new Blob([data],{type:'image/'+format});assert.equal(await core.prepareImageForSave(blob,{...job(),embedMetadata:true},'m'),blob);}
 const pngXmp=await core.readImageInfo(fixtures.png(core,[fixtures.text(core,'XML:com.adobe.xmp',xml)]));assert(pngXmp.sources.some(v=>v.label==='XMP 설명'&&v.fields.seed===17));
});

test('NAIS local base64 records stay raw-readable and malformed EXIF offsets cannot escape input',async()=>{
 const json=JSON.stringify({prompt:'local-positive',uc:'local-negative',naiOnly:'kept in raw'}),data=fixtures.png(core,[fixtures.text(core,'nais3-params',Buffer.from(json).toString('base64'))]);const info=await core.readImageInfo(data);assert(info.sources.some(v=>v.fields.prompt==='local-positive'));assert(info.raw.some(v=>v.text.includes('naiOnly')));
 const exif=fixtures.exif(json);exif.writeUInt32LE(0xfffffff0,18);const broken=await core.readImageInfo(fixtures.jpegWith(exif));assert.equal(broken.sources.length,0);assert(broken.warnings.some(v=>v.includes('정보가 없습니다')));
});

test('compressed metadata reports unsupported decompression, cancels active processing and enforces record count',async()=>{
 const previous=globalThis.DecompressionStream;try{globalThis.DecompressionStream=undefined;await assert.rejects(core.readImageInfo(png({texts:[itxt('Comment','{}',true)]})),/압축 정보 읽기를 지원하지/);}finally{globalThis.DecompressionStream=previous;}
 await assert.rejects(core.readImageInfo(fixtures.png(core,Array.from({length:129},(_,i)=>fixtures.text(core,'key'+i,'{}')))),/항목 수/);
 const controller=new AbortController(),promise=core.readImageInfo(png({width:500,height:500}),{signal:controller.signal});setTimeout(()=>controller.abort(),0);await assert.rejects(promise,/취소/);
});

test('missing LoRA identity blocks model import instead of silently discarding a required LoRA',()=>{
 for(const lora of [{id:'301',weight:.5},{versionId:'401',weight:.5}]){const fields=core.imageInfoFields({modelId:'101',modelVersionId:'201',loras:[lora]});assert.equal(fields.modelIncomplete,true);assert.throws(()=>core.importedImagePreset(fields,'name','id'),/부모 ID/);}
});

test('stealth survives all PNG row filters, Adam7 interlace and 16-bit alpha conversion',async()=>{
 const record=JSON.stringify({Description:'stealth-filtered',Comment:JSON.stringify({uc:'negative'})});for(const options of [{filter:1},{filter:2},{filter:3},{filter:4},{filter:4,interlace:true},{depth:16,filter:4,interlace:true}]){const info=await core.readImageInfo(fixtures.stealthPng(core,record,options));assert(info.sources.some(v=>v.label.includes('stealth')&&v.fields.prompt==='stealth-filtered'),JSON.stringify(options));}
});
test('PNG UTF8 iTXt, compressed iTXt and zTXt preserve source text and distinguish SD empty positive/negative',async()=>{
 const data=png({texts:[itxt('Comment',JSON.stringify({prompt:'표정',uc:'bad',seed:3}),true),chunk('zTXt',Buffer.concat([Buffer.from('parameters\0\0'),zlib.deflateSync(Buffer.from('Negative prompt: ugly\nSteps: 20, Seed: 42, Size: 768x1280'))]))]});
 const info=await core.readImageInfo(data);assert.equal(info.format,'png');assert.equal(info.width,8);assert(info.sources.some(v=>v.fields.prompt==='표정'&&v.fields.negativePrompt==='bad'));
 const sd=info.sources.find(v=>v.fields.seed===42);assert.equal(sd.fields.prompt,'');assert.equal(sd.fields.negativePrompt,'ugly');assert.equal(sd.fields.width,768);
});
test('PNG own request record is deterministic and preserves every original chunk including compressed pixels',async()=>{
 const original=png({texts:[itxt('Description','original description')]}),encoded=core.embedGenerationInfo(original,job(),'media');assert.deepEqual(encoded,core.embedGenerationInfo(original,job(),'media'));
 const before=core.inspectImageContainer(original).png.chunks,after=core.inspectImageContainer(encoded).png.chunks;for(const part of before){const same=after.find(v=>v.type===part.type);assert.deepEqual(Buffer.from(encoded.subarray(same.start,same.end)),original.subarray(part.start,part.end));}
 const info=await core.readImageInfo(encoded),fields=info.sources.find(v=>v.fields.modelId==='101').fields;assert.equal(fields.modelVersionId,'201');assert.equal(fields.loras[0].id,'301');assert.equal(fields.negativePrompt,'');assert.equal(fields.seedKind,'request');assert.equal(fields.batchSize,4);
 const raw=info.raw.find(v=>v.label.includes('pixai-clack-helper')).text;for(const key of ['PRIVATE-KEY','PRIVATE-TITLE','C:/private','apiKey'])assert(!raw.includes(key));
});
test('alpha stealth is decoded from actual PNG alpha bytes using column-major MSB bits without Canvas',async()=>{
 const json=JSON.stringify({Description:'stealth-positive',Comment:JSON.stringify({uc:'stealth-negative',seed:123})}),compressed=zlib.gzipSync(Buffer.from(json)),length=Buffer.alloc(4);length.writeUInt32BE(compressed.length*8);const bytes=Buffer.concat([Buffer.from('stealth_pngcomp'),length,compressed]),bits=[...bytes].flatMap(byte=>Array.from({length:8},(_,n)=>(byte>>(7-n))&1));
 const data=png({width:64,height:64,alphaBits:bits}),info=await core.readImageInfo(data);assert(info.sources.some(v=>v.label.includes('stealth')&&v.fields.prompt==='stealth-positive'&&v.fields.negativePrompt==='stealth-negative'));
});
test('corrupt ancillary CRC warns on read and mandatory metadata insertion falls back to the exact verified original',async()=>{
 const data=png({texts:[itxt('Comment',JSON.stringify({prompt:'a'}))]});const part=core.inspectImageContainer(data).png.chunks.find(v=>v.type==='iTXt');data[part.end-1]^=1;
 const info=await core.readImageInfo(data);assert(info.warnings.some(v=>v.includes('CRC')));assert.throws(()=>core.embedGenerationInfo(data,job(),'media'),/무결성/);
 const original=new Blob([data],{type:'image/png'}),item={...job(),embedMetadata:true};let checkpoints=0;const saved=await core.prepareImageForSave(original,item,'media',()=>checkpoints++);assert.equal(saved,original);assert.equal(checkpoints,1);assert.match(item.metadataWarnings.media,/원본 그대로/);
 const restored=JSON.parse(JSON.stringify(item));assert.match(restored.metadataWarnings.media,/원본 그대로/);assert.equal((await core.prepareImageForSave(new Blob(['jpeg'],{type:'image/jpeg'}),restored,'other')).type,'image/jpeg');assert.match(restored.metadataWarnings.media,/원본 그대로/);
});
test('metadata is default off, JPEG/WebP remain exact originals and old queued flags do not inherit current settings',async()=>{
 const original=new Blob([png()],{type:'image/png'});assert.equal(await core.prepareImageForSave(original,job(),'media'),original);assert.notEqual(await core.prepareImageForSave(original,{...job(),embedMetadata:true},'media'),original);for(const type of ['image/jpeg','image/webp']){const blob=new Blob(['original'],{type});assert.equal(await core.prepareImageForSave(blob,{...job(),embedMetadata:true},'media'),blob);}
});
test('input/pixel/text limits, compressed bombs, truncated offsets and cancellation reject without executing text',async()=>{
 await assert.rejects(core.readImageInfo(new Uint8Array(32*1024*1024+1)),/32MiB/);const big=png();big.writeUInt32BE(40000001,16);await assert.rejects(core.readImageInfo(big),/4천만/);
 const bomb=png({texts:[itxt('Comment','x'.repeat(1024*1024+1),true)]});await assert.rejects(core.readImageInfo(bomb),/용량/);await assert.rejects(core.readImageInfo(png().subarray(0,30)),/손상|끝/);
 const abort=new AbortController();abort.abort();await assert.rejects(core.readImageInfo(png(),{signal:abort.signal}),/취소/);
 const unsafe=png({texts:[itxt('Comment',JSON.stringify({prompt:'<script>globalThis.imageExecuted=true</script> https://example.com',apiKey:'SECRET'}))]});const read=await core.readImageInfo(unsafe);assert.equal(globalThis.imageExecuted,undefined);assert.equal(read.sources[0].fields.apiKey,undefined);
});
test('image application uses isolated empty common/character/trigger materials and treats selected empty negative as clearing',()=>{
 const lib={...core.makePresetLibrary(),common:{prompt:'global',negativePrompt:'global-neg'},presets:[{id:'p',name:'p',model:{id:'101',versionId:'201',name:'m'},loras:[{id:'301',versionId:'401',name:'l',weight:.5,triggerWords:'trigger'}],prompt:'preset-text'}],characters:[{id:'c',name:'c',prompt:'character',negativePrompt:'character-neg'}],scenes:[{id:'s',name:'s',prompt:'chunk',negativePrompt:'chunk-neg'}]};
 const recipe={presetId:'p',characterId:'c',sceneIds:['s'],count:1,triggerPosition:1,imageOptions:{aspectRatio:'5:3',size:'1k',mode:'pro',batchSize:4}};let n=0;const before=structuredClone(lib),applied=core.importImageComposition(lib,recipe,{prompt:'final',negativePrompt:'',seed:5},{prompt:true,negativePrompt:true,seed:true},{idFactory:()=>String(++n)});applied.library.reservations=[{id:'r',...applied.recipe,snapshot:core.snapshotCombination(applied.library,applied.recipe)}];const result=core.expandPresetReservations(applied.library)[0];assert.equal(result.prompt,'final');assert.equal(result.negativePrompt,'');assert.equal(applied.api.seed,'5');assert.deepEqual(lib,before);assert.throws(()=>core.importedImagePreset({modelVersionId:'201'},'m','p'),/부모 ID/);
});
test('atomic record updates roll back queue and library on quota failure and retain the recovery record',()=>{
 const records=new Map([['queue','old queue'],['library','old library']]),storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>{if(key==='library'&&value==='new library')throw Error('quota');records.set(key,value);},removeItem:key=>records.delete(key)};
 assert.throws(()=>core.atomicRecordWrite(storage,{queue:'new queue',library:'new library'},'previous'),/원래 자료/);assert.equal(records.get('queue'),'old queue');assert.equal(records.get('library'),'old library');assert(records.has('previous'));
});
test('thumbnail corruption or quota failure is isolated from original saving and never accepts remote URLs',async()=>{
 const cache=core.createSceneThumbnailCache({load:()=>JSON.stringify([{sceneId:'s',dataUrl:'https://evil.test/a.png',savedAt:1}]),save:()=>{throw Error('quota');}});assert.equal(cache.get('s'),undefined);assert.equal(await cache.remember('s',new Blob(['bad'])),false);
});
