// SPDX-License-Identifier: GPL-3.0-only
// Same-PC library transport. No PixAI credentials, job submission, or page fetch.
const SYNC_COLLECTIONS=Object.freeze(['commonPresets','presets','characters','characterFolders','chunkFolders','scenes','sceneFolders','sceneCards','casts','batchPlans']);
const LIBRARY_SYNC_URL='http://127.0.0.1:50321/v1/library-sync/';
const LIBRARY_SYNC_KEY='local.pixai-web-queue.library-sync.v1';
const LIBRARY_SYNC_MAX_BYTES=20*1024*1024;
function canonicalSync(value) {
    const seen=new Set();
    function sorted(item,depth){
        if(depth>64)throw Error('동기화 자료가 너무 깊게 중첩되어 있습니다.');
        if(item===null||typeof item==='boolean'||typeof item==='string'||typeof item==='number'&&Number.isFinite(item))return item;
        if(!item||typeof item!=='object'||seen.has(item))throw Error('동기화 자료는 순환하지 않는 JSON 값만 허용합니다.');
        seen.add(item);let result;
        if(Array.isArray(item))result=item.map(value=>sorted(value,depth+1));
        else {if(Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)throw Error('동기화 객체 형식을 확인해 주세요.');result=Object.fromEntries(Object.keys(item).sort().map(key=>{if(['__proto__','constructor','prototype'].includes(key))throw Error('허용되지 않은 동기화 필드입니다.');return [key,sorted(item[key],depth+1)];}));}
        seen.delete(item);return result;
    }
    const text=JSON.stringify(sorted(value,0));if(new TextEncoder().encode(text).byteLength>LIBRARY_SYNC_MAX_BYTES)throw Error('동기화 자료는 20MiB까지 처리할 수 있습니다.');return text;
}
function syncProjection(library) {return {version:1,common:library.common,...Object.fromEntries(SYNC_COLLECTIONS.map(key=>[key,library[key]||[]]))};}
function parseSyncLibrary(value) {
    canonicalSync(value);
    settingsBackupKeys(value,'동기화 라이브러리',['version','common',...SYNC_COLLECTIONS]);
    for(const key of SYNC_COLLECTIONS)if(!Array.isArray(value[key]))throw Error('동기화 목록 형식이 맞지 않습니다.');
    // Keep the existing schema's frozen-copy and saved-plan semantics. The app
    // merger rejects newly broken references; an already missing live source is preserved.
    return syncProjection(settingsBackupLibrary({...value,reservations:[]}));
}
function projectSyncLibrary(library) {return parseSyncLibrary(syncProjection(normalizePresetLibrary(library)));}
function applySyncLibrary(current,incoming) {
    const next=parseSyncLibrary(incoming),old=normalizePresetLibrary(current);
    return normalizePresetLibrary({...old,...next,reservations:old.reservations.map(item=>freezeBackupReservation(old,item))});
}
async function syncLibraryHash(value) {
    const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalSync(value)));
    return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}
function createLibrarySyncTransport(request,timers={setTimeout,clearTimeout}) {
    return (path,body,token)=>new Promise((resolve,reject)=>{
        if(typeof request!=='function'||!['pair','exchange','approve','ack','cancel'].includes(path))return reject(Error('Tampermonkey 로컬 연결을 사용할 수 없습니다.'));
        const data=JSON.stringify(body),url=LIBRARY_SYNC_URL+path,limit=3*LIBRARY_SYNC_MAX_BYTES;
        if(new TextEncoder().encode(data).byteLength>LIBRARY_SYNC_MAX_BYTES)return reject(Error('동기화 요청은 20MiB까지 전송할 수 있습니다.'));
        let handle,settled=false;
        const finish=(error,value)=>{if(settled)return;settled=true;timers.clearTimeout(deadline);if(error)reject(error);else resolve(value);};
        const offline=()=>finish(Object.assign(Error('앱 오프라인 · 앱의 같은 PC 연결을 켠 뒤 다시 시도하세요.'),{offline:true}));
        // Tampermonkey fetch-mode timeouts vary by browser. Always own a deadline.
        const deadline=timers.setTimeout(()=>{offline();handle?.abort?.();},5000);
        try {handle=request({method:'POST',url,data,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},anonymous:true,redirect:'error',timeout:5000,
            onerror:offline,ontimeout:offline,onabort:offline,
            onprogress:progress=>{if(progress.loaded>limit){finish(Error('앱의 동기화 응답이 너무 큽니다.'));handle?.abort?.();}},
            onload:response=>{
                if(settled)return;
                if(response.finalUrl&&response.finalUrl!==url)return finish(Error('로컬 연결 주소가 바뀌어 요청을 중지했습니다.'));
                if(response.status!==200)return finish(Object.assign(Error(response.status===401?'연결 인증이 만료되었습니다. 앱에서 새 코드를 만든 뒤 다시 연결하세요.':'로컬 동기화 요청을 완료하지 못했습니다. 앱 상태를 확인하세요.'),{status:response.status}));
                try {if(typeof response.responseText!=='string'||new TextEncoder().encode(response.responseText).byteLength>limit||!/^content-type:\s*application\/json(?:;|\s|$)/im.test(response.responseHeaders||''))throw Error();finish(null,JSON.parse(response.responseText));}
                catch {finish(Error('앱의 동기화 응답 형식을 확인하지 못했습니다.'));}
            }});}catch {offline();}
    });
}
function createLibrarySyncClient(io) {
    let token='',automatic=false,busy=false,timer=null,started=false,exchange={state:'idle'},message='연결 안 됨',authFailed=false,previewSnapshot=null;
    const supported=!!io.storage;
    function state(){return {supported,linked:!!token,automatic,busy,exchange,message};}
    function emit(){io.changed?.(state());}
    function persist(next){io.storage.set(LIBRARY_SYNC_KEY,next);if(canonicalSync(io.storage.get(LIBRARY_SYNC_KEY,null))!==canonicalSync(next))throw Error('로컬 연결 정보를 저장하지 못했습니다.');}
    function idle(){if(busy)throw Error('동기화 요청이 끝난 뒤 다시 시도해 주세요.');}
    function guard(){io.assertReady?.();}
    function schedule(){if(timer!==null)io.clearTimeout(timer);timer=null;if(started&&token&&!authFailed)timer=io.setTimeout(()=>{timer=null;void sync(false);},10000);}
    async function run(action){idle();busy=true;emit();try{return await action();}catch(error){message=error.message;if(error.status===401)authFailed=true;throw error;}finally{busy=false;emit();schedule();}}
    async function accept(value){
        if(!value||!['idle','preview','apply','blocked'].includes(value.state))throw Error('동기화 상태를 확인하지 못했습니다.');
        if(value.state==='preview'){
            const p=value.proposal;
            if(!p||typeof p.id!=='string'||!Array.isArray(p.conflicts)||typeof p.initial!=='boolean'||![p.appCount,p.scriptCount,p.mergedCount].every(Number.isSafeInteger))throw Error('동기화 미리보기를 확인하지 못했습니다.');
            parseSyncLibrary(p.library);
            for(const item of p.conflicts)if(!item||typeof item.key!=='string'||typeof item.label!=='string')throw Error('동기화 충돌 형식을 확인하지 못했습니다.');
        }
        exchange=value;
        if(value.state!=='apply'){message=value.state==='preview'?'미리보기를 확인하고 적용해 주세요.':value.state==='blocked'?'자료가 변경되었거나 앱 편집 중입니다. 확인한 뒤 지금 동기화를 누르세요.':'연결됨 · 라이브러리 확인 완료';return value;}
        if(typeof value.transactionId!=='string'||!value.transactionId||!/^[a-f0-9]{64}$/.test(value.expectedScriptHash||''))throw Error('동기화 전송 정보를 확인하지 못했습니다.');
        const incoming=parseSyncLibrary(value.library),current=io.read(),projection=projectSyncLibrary(current);
        if(canonicalSync(projection)!==canonicalSync(incoming)){
            guard();
            if(await syncLibraryHash(projection)!==value.expectedScriptHash){exchange={state:'blocked'};message='미리보기 뒤 스크립트 자료가 바뀌었습니다. 지금 동기화로 다시 비교해 주세요.';return exchange;}
            guard();
            await io.save(current,applySyncLibrary(current,incoming));
        }
        // Read back persisted data. Save failures and intervening edits must never advance the baseline.
        const saved=projectSyncLibrary(io.read());
        if(canonicalSync(saved)!==canonicalSync(incoming))throw Error('동기화 저장 내용을 확인하지 못했습니다. 다음 확인 때 다시 비교합니다.');
        const acknowledged=await io.request('ack',{id:value.transactionId,library:saved},token);
        if(!acknowledged||acknowledged.state!=='idle')throw Error('앱의 저장 확인을 받지 못했습니다. 다음 확인 때 다시 시도합니다.');
        exchange=acknowledged;message='동기화 완료 · 기존 예약·대기열·옵션 유지';return acknowledged;
    }
    async function sync(requestSync=true){
        if(!token){if(requestSync)throw Error('앱 연결 코드를 먼저 입력해 주세요.');return;}
        if(busy){if(!requestSync){schedule();return;}idle();}
        try{return await run(async()=>{guard();authFailed=false;const snapshot=projectSyncLibrary(io.read()),result=await io.request('exchange',{library:snapshot,automatic,requestSync},token);if(result?.state==='preview')previewSnapshot=snapshot;return accept(result);});}
        catch(error){if(requestSync)throw error;}
    }
    return {
        state,
        start(){if(started)return;started=true;try{if(supported){const saved=io.storage.get(LIBRARY_SYNC_KEY,null);if(saved){if(typeof saved.token!=='string'||!/^[A-Za-z0-9_-]{32,256}$/.test(saved.token)||typeof saved.automatic!=='boolean')throw Error('저장한 연결 정보가 올바르지 않습니다. 다시 연결해 주세요.');token=saved.token;automatic=saved.automatic;message='연결됨 · 앱 응답 대기';}}}catch(error){message=error.message;}emit();schedule();},
        stop(){started=false;if(timer!==null)io.clearTimeout(timer);timer=null;},
        async pair(code){if(!supported)throw Error('연결에는 Tampermonkey 전용 저장소가 필요합니다.');return run(async()=>{guard();const result=await io.request('pair',{code:String(code).trim()});if(!result||typeof result.token!=='string'||!/^[A-Za-z0-9_-]{32,256}$/.test(result.token))throw Error('앱 연결 응답을 확인하지 못했습니다.');persist({token:result.token,automatic:false});token=result.token;automatic=false;authFailed=false;exchange={state:'idle'};message='연결됨 · 지금 동기화를 눌러 첫 미리보기를 확인하세요.';});},
        disconnect(){idle();if(supported){io.storage.remove(LIBRARY_SYNC_KEY);if(io.storage.get(LIBRARY_SYNC_KEY,null)!==null)throw Error('연결 정보 삭제를 확인하지 못했습니다.');}token='';automatic=false;authFailed=false;exchange={state:'idle'};message='이 스크립트 연결 해제됨 · 앱에서도 연결 해제할 수 있습니다.';schedule();emit();},
        setAutomatic(value){idle();if(!token)throw Error('앱에 먼저 연결해 주세요.');persist({token,automatic:value===true});automatic=value===true;emit();},
        sync,
        approve(id,choices){return run(async()=>{guard();if(exchange.state!=='preview'||exchange.proposal.id!==id||!previewSnapshot||canonicalSync(projectSyncLibrary(io.read()))!==canonicalSync(previewSnapshot))throw Error('미리보기 뒤 자료가 변경됐습니다. 다시 동기화해 주세요.');await accept(await io.request('approve',{id,choices},token));});},
        cancel(id){return run(async()=>{await accept(await io.request('cancel',{id},token));});}
    };
}
function mountLibrarySyncPanel(parent,{node,button,client,isBusy=()=>false}) {
    const box=node('section',null,{'data-library-sync':''}),status=node('p',null,{role:'status'}),code=node('input',null,{type:'password',autocomplete:'off','data-edit':'','aria-label':'앱 일회용 연결 코드',placeholder:'앱의 새 연결 코드'}),preview=node('div'),automatic=node('input',null,{type:'checkbox','data-edit':'','aria-label':'라이브러리 자동 동기화'});
    const connect=button('앱 연결',async()=>{const value=code.value;code.value='';await client.pair(value);}),sync=button('지금 동기화',()=>client.sync()),disconnect=button('스크립트 연결 해제',()=>client.disconnect());
    for(const control of [connect,sync,disconnect])control.setAttribute('data-edit','');
    const label=node('label',null,{class:'pq-check-label'});label.append(automatic,node('span','자동 동기화 · 첫 연결과 충돌은 직접 확인'));
    automatic.addEventListener('change',()=>{try{client.setAutomatic(automatic.checked);}catch{automatic.checked=client.state().automatic;}});
    box.append(node('h3','같은 PC 앱과 라이브러리 연결'),node('small','공통문·프리셋·캐릭터·청크·씬·출연·일괄 구성만 공유합니다. 예약·기록·생성 옵션·API 키는 각 도구에 유지합니다.'),status,code,connect,sync,disconnect,label,preview);parent.append(box);
    let displayed='';
    function render(state){
        status.textContent=state.supported?state.message:'같은 PC 연결에는 최신 Tampermonkey가 필요합니다.';automatic.checked=state.automatic;
        for(const control of [code,connect,sync,disconnect,automatic]){const disabled=state.busy||isBusy()||!state.supported||(!state.linked&&![code,connect].includes(control));control.disabled=disabled;control.dataset.unavailable=String(state.busy||!state.supported||(!state.linked&&![code,connect].includes(control)));}
        code.hidden=state.linked;connect.hidden=state.linked;
        const proposal=state.exchange.state==='preview'?state.exchange.proposal:null;
        for(const control of preview.querySelectorAll('button,select')){control.disabled=state.busy||isBusy();control.dataset.unavailable=String(state.busy);}
        if((proposal?.id||'')===displayed)return;displayed=proposal?.id||'';preview.replaceChildren();if(!proposal)return;
        const choices=Object.create(null);preview.append(node('strong',proposal.initial?'첫 동기화 미리보기':'동기화 미리보기'),node('p',`앱 ${proposal.appCount}개 · 스크립트 ${proposal.scriptCount}개 · 합친 결과 ${proposal.conflicts.length?'충돌 선택 후 확정':proposal.mergedCount+'개'}`));
        for(const conflict of proposal.conflicts){
            const row=node('div'),select=node('select',null,{'data-edit':'','aria-label':'충돌 선택: '+conflict.label});select.append(node('option','어느 값을 쓸지 선택',{value:''}),node('option','앱 값 사용',{value:'app'}),node('option','스크립트 값 사용',{value:'script'}));
            select.addEventListener('change',()=>{if(select.value)choices[conflict.key]=select.value;else delete choices[conflict.key];});
            const details=node('details');details.append(node('summary','양쪽 값 보기'),node('pre','앱\n'+JSON.stringify(conflict.app,null,2)+'\n스크립트\n'+JSON.stringify(conflict.script,null,2)));row.append(node('strong',conflict.label),select,details);preview.append(row);
        }
        preview.append(button('미리보기 적용',()=>{if(proposal.conflicts.some(item=>!choices[item.key]))throw Error('충돌 항목마다 사용할 값을 선택해 주세요.');return client.approve(proposal.id,choices);}),button('미리보기 취소',()=>client.cancel(proposal.id)));
        for(const control of preview.querySelectorAll('button,select')){control.setAttribute('data-edit','');control.disabled=state.busy||isBusy();control.dataset.unavailable=String(state.busy);}
    }
    render(client.state());return {render};
}
