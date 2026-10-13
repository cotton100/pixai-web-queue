// SPDX-License-Identifier: GPL-3.0-only
// Browser adaptation of PixaiClackHelper/NAIS3 image metadata, 2026-10-13.
// Uses bounded Uint8Array/DataView processing; no Buffer, sharp, filesystem or network.
const IMAGE_PIXEL_LIMIT=40000000;
const IMAGE_PNG_SIGNATURE=new Uint8Array([137,80,78,71,13,10,26,10]);
const IMAGE_CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0);table[n]=c>>>0;}return table;})();
function imageCrc(data){let crc=0xffffffff;for(const byte of data)crc=(crc>>>8)^IMAGE_CRC_TABLE[(crc^byte)&255];return (crc^0xffffffff)>>>0;}
function imageDataView(data){return new DataView(data.buffer,data.byteOffset,data.byteLength);}
function imageU32(data,p,le=false){if(p<0||p+4>data.length)throw Error('이미지 정보 범위 오류');return imageDataView(data).getUint32(p,le);}
function imageU16(data,p,le=false){if(p<0||p+2>data.length)throw Error('이미지 정보 범위 오류');return imageDataView(data).getUint16(p,le);}
function imageLatin(data){let out='';for(let p=0;p<data.length;p+=8192)out+=String.fromCharCode(...data.subarray(p,p+8192));return out;}
function imageUtf8(data){return new TextDecoder().decode(data);}
function imageConcat(parts){const out=new Uint8Array(parts.reduce((sum,v)=>sum+v.length,0));let p=0;for(const part of parts){out.set(part,p);p+=part.length;}return out;}
function imageAbort(signal){if(signal?.aborted)throw Error('이미지 정보 읽기를 취소했습니다.');}
async function imageYield(signal){imageAbort(signal);await new Promise(resolve=>setTimeout(resolve,0));imageAbort(signal);}
async function inflateImageBytes(data,format,limit,signal){
    imageAbort(signal);if(typeof DecompressionStream!=='function')throw Error('이 브라우저는 압축 정보 읽기를 지원하지 않습니다. 최신 Chrome/Firefox에서 다시 시도해 주세요.');
    const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream(format)).getReader(),parts=[];let size=0;
    const cancel=()=>void reader.cancel().catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
    try{for(;;){imageAbort(signal);const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit)throw Error('압축 해제 정보 용량 초과');parts.push(next.value);}imageAbort(signal);return imageConcat(parts);}
    finally{signal?.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});}
}
function inspectPng(data,strict=false){
    if(data.length<8||!IMAGE_PNG_SIGNATURE.every((v,i)=>data[i]===v))throw Error('PNG 형식이 아닙니다.');
    const chunks=[],warnings=[];let p=8;
    while(p+12<=data.length){const length=imageU32(data,p),end=p+length+12;if(end>data.length||chunks.length>=10000)throw Error('손상되거나 지나치게 복잡한 PNG입니다.');
        const type=imageLatin(data.subarray(p+4,p+8));if(!/^[A-Za-z]{4}$/.test(type))throw Error('PNG 청크 이름 오류');
        if(imageCrc(data.subarray(p+4,end-4))!==imageU32(data,end-4)){if(strict)throw Error('PNG 무결성 확인에 실패했습니다.');warnings.push(`${type} CRC 오류 · 원본은 수정하지 않았습니다.`);}
        chunks.push({type,start:p,end,body:data.subarray(p+8,end-4)});if(type==='IEND'){if(length)throw Error('PNG 끝 정보 오류');return {chunks,warnings};}p=end;
    }throw Error('PNG 끝 정보를 찾지 못했습니다.');
}
function imageObject(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function parseImageText(text){
    try{const p=imageObject(JSON.parse(text)),comment=typeof p.Comment==='string'?imageObject(JSON.parse(p.Comment)):imageObject(p.Comment),q=Object.keys(comment).length?comment:p;
        return imageInfoFields({...q,prompt:q.prompt??p.Description,negativePrompt:q.negativePrompt??q.negative_prompt??q.uc});
    }catch{const match=/(?:^|\n)Steps:\s*\d+[^\n]*$/m.exec(text);if(!match)return {};
        const prefix=text.slice(0,match.index).trim(),negative=/(?:^|\n)Negative prompt:\s*/.exec(prefix),seed=/(?:^|,\s*)Seed:\s*(\d+)/.exec(match[0].trim()),size=/(?:^|,\s*)Size:\s*(\d+)x(\d+)/.exec(match[0].trim());
        return imageInfoFields({prompt:negative?prefix.slice(0,negative.index).trim():prefix,...(negative?{negativePrompt:prefix.slice(negative.index+negative[0].length).trim()}:{}),seed:seed?Number(seed[1]):undefined,width:size?Number(size[1]):undefined,height:size?Number(size[2]):undefined});
    }
}
function readExifText(input){
    const data=imageLatin(input.subarray(0,6))==='Exif\0\0'?input.subarray(6):input,out=[];
    if(data.length<8)return out;const order=imageLatin(data.subarray(0,2)),le=order==='II';if(!le&&order!=='MM')return out;if(imageU16(data,2,le)!==42)return out;
    const seen=new Set();function visit(p){if(seen.has(p)||seen.size>=8||p<8||p+2>data.length)return;seen.add(p);const count=imageU16(data,p,le);if(count>512||p+2+count*12+4>data.length)return;
        for(let n=0;n<count;n++){const at=p+2+n*12,tag=imageU16(data,at,le),type=imageU16(data,at+2,le),size=imageU32(data,at+4,le);
            if(tag===0x8769&&type===4&&size===1){visit(imageU32(data,at+8,le));continue;}
            if(![0x10e,0x131,0x9286,0x9c9c].includes(tag)||![1,2,7].includes(type)||size>IMAGE_INFO_TEXT_LIMIT)continue;
            const pos=size<=4?at+8:imageU32(data,at+8,le);if(pos<0||pos+size>data.length)continue;let value=data.subarray(pos,pos+size),text;
            if(imageLatin(value.subarray(0,8))==='UNICODE\0'||tag===0x9c9c){if(tag!==0x9c9c)value=value.subarray(8);if(value.length%2)continue;text=new TextDecoder(tag===0x9c9c||le?'utf-16le':'utf-16be').decode(value);}
            else {if(imageLatin(value.subarray(0,8))==='ASCII\0\0\0')value=value.subarray(8);text=imageUtf8(value);}
            out.push({label:`EXIF ${tag.toString(16)}`,text:text.replace(/\0+$/g,'')});
        }
    }visit(imageU32(data,4,le));return out;
}
function inspectImageContainer(data){
    if(IMAGE_PNG_SIGNATURE.every((v,i)=>data[i]===v)){const png=inspectPng(data),header=png.chunks[0];if(header?.type!=='IHDR'||header.body.length!==13)throw Error('PNG 크기 정보 오류');if(png.chunks.some(v=>v.type==='acTL'))throw Error('정지 PNG·JPEG·WebP만 지원합니다.');return {format:'png',width:imageU32(header.body,0),height:imageU32(header.body,4),png,exif:png.chunks.filter(v=>v.type==='eXIf').map(v=>v.body),xmp:[]};}
    if(data[0]===255&&data[1]===216){let p=2,width=0,height=0;const exif=[],xmp=[];
        while(p+4<=data.length){if(data[p]!==255)throw Error('JPEG 구간 정보 오류');while(data[p]===255)p++;const marker=data[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;
            const size=imageU16(data,p),end=p+size;if(size<2||end>data.length)throw Error('JPEG 정보 범위 오류');const body=data.subarray(p+2,end);
            if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&body.length>=5){height=imageU16(body,1);width=imageU16(body,3);}
            if(marker===225){if(imageLatin(body.subarray(0,6))==='Exif\0\0')exif.push(body);else if(imageLatin(body.subarray(0,29))==='http://ns.adobe.com/xap/1.0/\0')xmp.push(body.subarray(29));}p=end;
        }return {format:'jpeg',width,height,exif,xmp};
    }
    if(imageLatin(data.subarray(0,4))==='RIFF'&&imageLatin(data.subarray(8,12))==='WEBP'){
        const end=imageU32(data,4,true)+8;if(end>data.length||end<12)throw Error('WebP 크기 정보 오류');let p=12,width=0,height=0;const exif=[],xmp=[];
        while(p+8<=end){const type=imageLatin(data.subarray(p,p+4)),length=imageU32(data,p+4,true),body=data.subarray(p+8,p+8+length);if(p+8+length>end)throw Error('WebP 정보 범위 오류');
            if(type==='VP8X'&&length>=10){if(body[0]&2)throw Error('움직이는 WebP는 지원하지 않습니다.');width=1+(body[4]|body[5]<<8|body[6]<<16);height=1+(body[7]|body[8]<<8|body[9]<<16);}
            if(type==='VP8L'&&length>=5&&body[0]===47){const bits=imageU32(body,1,true);width=1+(bits&16383);height=1+((bits>>>14)&16383);}
            if(type==='VP8 '&&length>=10&&body[3]===157&&body[4]===1&&body[5]===42){width=imageU16(body,6,true)&16383;height=imageU16(body,8,true)&16383;}
            if(type==='EXIF')exif.push(body);if(type==='XMP ')xmp.push(body);p+=8+length+(length%2);
        }return {format:'webp',width,height,exif,xmp};
    }throw Error('PNG·JPEG·WebP 이미지 한 장을 선택해 주세요.');
}
async function pngAlphaBytes(container,signal){
    const {width,height,png}=container,h=png.chunks[0].body,depth=h[8],color=h[9],interlace=h[12],channels=({0:1,2:3,3:1,4:2,6:4})[color];
    if(!channels||![1,2,4,8,16].includes(depth)||![0,1].includes(interlace)||h[10]||h[11])throw Error('이 PNG의 픽셀 형식은 stealth 읽기를 지원하지 않습니다.');
    const palette=png.chunks.find(v=>v.type==='tRNS')?.body;if(![4,6].includes(color)&&!palette)return null;
    if(([2,4,6].includes(color)&&![8,16].includes(depth))||(color===3&&depth===16))throw Error('잘못된 PNG 비트 깊이');
    const passes=interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
    const dimensions=passes.map(([x,y,dx,dy])=>({x,y,dx,dy,w:Math.max(0,Math.ceil((width-x)/dx)),h:Math.max(0,Math.ceil((height-y)/dy))}));
    const expected=dimensions.reduce((sum,p)=>sum+(p.w&&p.h?(1+Math.ceil(p.w*channels*depth/8))*p.h:0),0),compressed=imageConcat(png.chunks.filter(v=>v.type==='IDAT').map(v=>v.body));
    const raw=await inflateImageBytes(compressed,'deflate',expected,signal);if(raw.length!==expected)throw Error('PNG 픽셀 데이터 크기가 다릅니다.');const alpha=new Uint8Array(width*height),bpp=Math.max(1,Math.ceil(channels*depth/8));let offset=0;
    const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
    for(const pass of dimensions){if(!pass.w||!pass.h)continue;const bytes=Math.ceil(pass.w*channels*depth/8);let previous=new Uint8Array(bytes);
        for(let y=0;y<pass.h;y++){const filter=raw[offset++],line=raw.slice(offset,offset+bytes);offset+=bytes;if(filter>4)throw Error('PNG 필터 오류');
            for(let n=0;n<line.length;n++){const a=n>=bpp?line[n-bpp]:0,b=previous[n],c=n>=bpp?previous[n-bpp]:0;line[n]=(line[n]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;}
            const sample=(x,c=0)=>depth===16?imageU16(line,(x*channels+c)*2):depth===8?line[x*channels+c]:(line[Math.floor(x*depth/8)]>>>(8-depth-(x*depth)%8))&((1<<depth)-1);
            for(let x=0;x<pass.w;x++){let value=255;if(color===3)value=palette[sample(x)]??255;else if(color===0)value=palette.length>=2&&sample(x)===imageU16(palette,0)?0:255;else if(color===2)value=palette.length>=6&&[0,1,2].every(c=>sample(x,c)===imageU16(palette,c*2))?0:255;else value=depth===16?sample(x,channels-1)>>>8:sample(x,channels-1);alpha[(pass.y+y*pass.dy)*width+pass.x+x*pass.dx]=value;}
            previous=line;if(y%64===0)await imageYield(signal);
        }
    }return alpha;
}
async function readStealthInfo(container,signal){
    const alpha=await pngAlphaBytes(container,signal);if(!alpha)return null;const packed=new Uint8Array(Math.ceil(alpha.length/8));let bit=0;
    for(let x=0;x<container.width;x++){for(let y=0;y<container.height;y++){if(alpha[y*container.width+x]&1)packed[bit>>>3]|=1<<(7-(bit&7));bit++;}if(x%256===0)await imageYield(signal);}
    const magic='stealth_pngcomp';if(imageLatin(packed.subarray(0,magic.length))!==magic)return null;const at=magic.length,bits=imageU32(packed,at),length=Math.ceil(bits/8);
    if(!bits||length>IMAGE_INFO_TEXT_LIMIT||at+4+length>packed.length)throw Error('stealth 정보 용량 또는 길이 오류');
    return imageUtf8(await inflateImageBytes(packed.subarray(at+4,at+4+length),'gzip',IMAGE_INFO_TEXT_LIMIT,signal));
}
async function readImageInfo(input,{signal}={}){
    if(!(input instanceof Uint8Array)||!input.length||input.length>IMAGE_INFO_MAX_BYTES)throw Error('PNG·JPEG·WebP 한 장(32MiB 이하)을 선택해 주세요.');imageAbort(signal);
    const container=inspectImageContainer(input);if(!container.width||!container.height||container.width*container.height>IMAGE_PIXEL_LIMIT)throw Error('이미지는 최대 4천만 픽셀까지 읽을 수 있습니다.');
    const result={format:container.format,width:container.width,height:container.height,sources:[],raw:[],warnings:[...(container.png?.warnings||[])]};let bytes=0,textCount=0;
    function add(label,text){bytes+=new TextEncoder().encode(text).length;if(bytes>IMAGE_INFO_TEXT_LIMIT||++textCount>128)throw Error('메타데이터 합산 용량 또는 항목 수 초과');result.raw.push({label,text});let fields;
        try{const p=imageObject(JSON.parse(text));fields=p.format===IMAGE_INFO_KEY&&p.version===1&&p.source==='local-request'?imageInfoFields({...imageObject(p.fields),seedKind:'request'}):parseImageText(text);if(p.format===IMAGE_INFO_KEY)label+=' · 요청 사본 (서버 확정값 아님)';}catch{fields=parseImageText(text);}if(Object.keys(fields).length)result.sources.push({label,fields});
    }
    if(container.png){const texts={};for(const chunk of container.png.chunks){imageAbort(signal);const b=chunk.body;if(!['tEXt','zTXt','iTXt'].includes(chunk.type))continue;if(b.length>IMAGE_INFO_TEXT_LIMIT)throw Error('PNG 텍스트 청크 용량 초과');const nul=b.indexOf(0);if(nul<1||nul>79){result.warnings.push('잘못된 PNG 텍스트 키를 제외했습니다.');continue;}const key=imageLatin(b.subarray(0,nul));let text;
            if(chunk.type==='tEXt')text=imageLatin(b.subarray(nul+1));else if(chunk.type==='zTXt'){if(b[nul+1]!==0)throw Error('지원하지 않는 PNG 압축 방식');text=imageLatin(await inflateImageBytes(b.subarray(nul+2),'deflate',IMAGE_INFO_TEXT_LIMIT-bytes,signal));}
            else {if(![0,1].includes(b[nul+1])||b[nul+2]!==0)throw Error('iTXt 압축 정보 오류');let p=nul+3;for(let n=0;n<2;n++){const end=b.indexOf(0,p);if(end<0)throw Error('iTXt 언어·번역 정보 오류');p=end+1;}text=imageUtf8(b[nul+1]===1?await inflateImageBytes(b.subarray(p),'deflate',IMAGE_INFO_TEXT_LIMIT-bytes,signal):b.subarray(p));}
            texts[key]=text;add(`PNG ${key}`,text);if(['nais3-params','nais2-params'].includes(key)){try{const decoded=Uint8Array.from(atob(text),v=>v.charCodeAt(0));add(`PNG ${key} · decoded`,imageUtf8(decoded));}catch{result.warnings.push(`${key} 로컬 기록의 압축·인코딩은 원문을 확인해 주세요.`);}}
            if(key==='XML:com.adobe.xmp')xmpDescriptions(text);
            if(key==='Description'&&text&&!result.sources.some(v=>v.fields.prompt!==undefined)){const fields=imageInfoFields({prompt:text});if(Object.keys(fields).length)result.sources.push({label:'Description 텍스트 (프롬프트로 추정)',fields});}await imageYield(signal);
        }
        if(texts.Comment&&texts.Description){try{const comment=imageObject(JSON.parse(texts.Comment));if(comment.prompt===undefined)result.sources.push({label:'PNG Comment + Description',fields:parseImageText(JSON.stringify({...comment,prompt:texts.Description}))});}catch{}}
        try{const stealth=await readStealthInfo(container,signal);if(stealth)add('PNG alpha stealth · 파일 기록',stealth);}catch(error){imageAbort(signal);if(/용량|길이|합산/.test(error.message))throw error;result.warnings.push('alpha stealth 읽기 실패: '+error.message);}
    }
    for(const exif of container.exif)for(const text of readExifText(exif))add(text.label,text.text);
    function xmpDescriptions(raw){for(const match of raw.matchAll(/<rdf:li\b[^>]*>([^<]*)<\/rdf:li>/g)){const text=match[1].replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');if(text)add('XMP 설명',text);}}
    for(const xmp of container.xmp){const raw=imageUtf8(xmp);add('XMP 원문',raw);xmpDescriptions(raw);}
    if(!result.sources.length)result.warnings.push('적용 가능한 생성 정보가 없습니다.');if(result.sources.length>1)result.warnings.push('출처별 값은 자동으로 합치지 않습니다. 적용할 출처를 선택하세요.');if(result.sources.some(v=>v.fields.seedKind==='request'))result.warnings.push('요청 시드는 개별 결과의 확정 시드가 아닙니다.');
    result.warnings.push('파일 기록은 검증된 서버 응답이 아닙니다. NAI 전용 설정은 PixAI로 억지 변환하지 않습니다.');imageAbort(signal);return result;
}
function embedGenerationInfo(input,job,mediaId){
    const data=new Uint8Array(input),{chunks}=inspectPng(data,true),p=job.apiPayload;if(!p)throw Error('확정된 API 요청이 없습니다.');
    const fields=imageInfoFields({prompt:p.prompt,negativePrompt:p.negativePrompt,modelId:job.configuration?.model.id,modelVersionId:p.modelVersionId,loras:(p.loras||[]).map((v,index)=>({id:job.configuration?.loras[index]?.id,versionId:v.modelId,weight:v.weight})),seed:p.seed,seedKind:'request',batchSize:p.batchSize,aspectRatio:p.aspectRatio,size:p.size,mode:p.mode,style:p.style?.key});
    const json=new TextEncoder().encode(JSON.stringify({format:IMAGE_INFO_KEY,version:1,source:'local-request',fields,taskId:job.taskId,mediaId}));if(json.length>IMAGE_INFO_TEXT_LIMIT)throw Error('생성 정보 용량 초과');
    const body=imageConcat([new TextEncoder().encode(IMAGE_INFO_KEY+'\0\0\0\0\0'),json]),chunk=new Uint8Array(body.length+12);imageDataView(chunk).setUint32(0,body.length);chunk.set(new TextEncoder().encode('iTXt'),4);chunk.set(body,8);imageDataView(chunk).setUint32(chunk.length-4,imageCrc(chunk.subarray(4,-4)));const end=chunks.find(v=>v.type==='IEND').start;
    return imageConcat([data.subarray(0,end),chunk,data.subarray(end)]);
}
function importedImagePreset(fields,name,id){if(fields.modelIncomplete||!fields.modelId||!fields.modelVersionId||fields.loras?.some(v=>!v.id))throw Error('모델·LoRA 부모 ID와 버전 ID가 모두 필요합니다.');return {id,name,model:{id:fields.modelId,versionId:fields.modelVersionId,name:''},loras:(fields.loras||[]).map(v=>({id:v.id,versionId:v.versionId,name:'',weight:v.weight,triggerWords:''}))};}
async function prepareImageForSave(blob,job,mediaId,persist=()=>{}) {if(job.embedMetadata!==true||blob.type!=='image/png')return blob;try{return new Blob([embedGenerationInfo(new Uint8Array(await blob.arrayBuffer()),job,mediaId)],{type:'image/png'});}catch{job.metadataWarnings={...(job.metadataWarnings||{}),[mediaId]:'생성 요청 정보를 추가하지 못해 검증된 다운로드 원본 그대로 저장했습니다.'};persist();return blob;}}
function importImageComposition(library,recipe,value,selected,options={}){
    const next=JSON.parse(JSON.stringify(normalizePresetLibrary(library))),fields=imageInfoFields(value),id=options.idFactory||(()=>crypto.randomUUID()),name=options.name||'이미지에서 가져온 조합';if(!Object.values(selected).some(Boolean))throw Error('적용할 정보를 선택해 주세요.');
    const oldPreset=next.presets.find(v=>v.id===recipe.presetId),oldCharacter=next.characters.find(v=>v.id===recipe.characterId),chunks=recipe.sceneIds.map(key=>next.scenes.find(v=>v.id===key));if(chunks.some(v=>!v))throw Error('현재 조합의 청크 연결을 먼저 확인해 주세요.');
    const current=composePresetPrompts(resolvePresetCommon(next,oldPreset),oldCharacter||{},chunks,oldPreset||{loras:[]},recipe.triggerPosition);
    if(selected.prompt&&fields.prompt===undefined||selected.negativePrompt&&fields.negativePrompt===undefined)throw Error('선택한 문구가 파일에 없습니다.');
    const preset=selected.model?importedImagePreset(fields,name,id()):oldPreset?{id:id(),name,model:{...oldPreset.model},loras:oldPreset.loras.map(v=>({...v,triggerWords:''}))}:null;if(!preset)throw Error('조합 예약에서 사용할 PixAI 프리셋을 먼저 골라 주세요.');
    const common={id:id(),name:name+' · 추가 공통문 없음',prompt:'',negativePrompt:''},character={id:id(),name:name+' · 추가 캐릭터 문구 없음',prompt:'',negativePrompt:''},chunk={id:id(),name,prompt:selected.prompt?fields.prompt:current.prompt,negativePrompt:selected.negativePrompt?fields.negativePrompt:current.negativePrompt};preset.commonPresetId=common.id;
    next.commonPresets=[...(next.commonPresets||[]),common];next.presets.push(preset);next.characters.push(character);next.scenes.push(chunk);const images={...recipe.imageOptions};if(selected.image)for(const key of ['aspectRatio','size','mode','batchSize'])if(fields[key]!==undefined)images[key]=fields[key];
    return {library:normalizePresetLibrary(next),recipe:{presetId:preset.id,characterId:character.id,sceneIds:[chunk.id],count:1,triggerPosition:'end',imageOptions:images},api:{...(selected.seed&&fields.seed!==undefined?{seed:String(fields.seed)}:{}),...(selected.style&&fields.style?{style:fields.style}:{})}};
}
