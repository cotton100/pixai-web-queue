// SPDX-License-Identifier: GPL-3.0-only
function jobBatch(job){return job.composition?.reservation?.batch||null;}
function filterQueueJobs(jobs,{view='active',state='',batch=''}={}){return jobs.filter(job=>queueHistory(job)===(view==='history')&&(!state||job.state===state)&&(!batch||(jobBatch(job)?.id||'ungrouped')===batch));}
function readGroupView(storage,key){try{const value=JSON.parse(storage.getItem(key)||'{}');if(!value||typeof value!=='object'||Array.isArray(value))return {};return {view:['active','history'].includes(value.view)?value.view:'active',state:typeof value.state==='string'?value.state.slice(0,30):'',batch:typeof value.batch==='string'?value.batch.slice(0,200):'',opened:Array.isArray(value.opened)?value.opened.filter(v=>typeof v==='string'&&v.length<=200).slice(0,1000):[]};}catch{return {};}}
// Adapted 2026-10-13 from cotton100/PixaiClackHelper a23b9da, original project author sunanakgo.
// Browser port retains legacy validators; batch image options merge per field.
const hasOwn=(value,key)=>Object.hasOwn(value,key);
const MAX_RESERVED_JOBS=1000;
function allowedKeys(...args){return settingsBackupKeys(...args);}
function normalizeLibrary(value){return normalizePresetLibrary(value);}
function normalizeImageOptions(value){return normalizeReservationImageOptions(value);}
function normalizeSnapshot(value){return normalizeCombinationSnapshot(value);}
function createSceneThumbnailCache(io){
    let images=[];try{const raw=io.load();if(typeof raw==='string'&&raw.length<=2*1024*1024){const values=JSON.parse(raw);if(Array.isArray(values))images=values.filter(v=>typeof v.sceneId==='string'&&v.sceneId.length<=200&&typeof v.dataUrl==='string'&&v.dataUrl.length<=65536&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(v.dataUrl)&&Number.isFinite(v.savedAt)).slice(0,100);}}catch{}
    return {get:id=>images.find(v=>v.sceneId===id)?.dataUrl,clear(){try{io.save('[]');images=[];}catch{}},async remember(id,blob){if(!id||id.length>200)return false;try{const bitmap=await createImageBitmap(blob);if(bitmap.width*bitmap.height>40000000){bitmap.close();return false;}const scale=Math.min(1,256/bitmap.width,192/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const dataUrl=canvas.toDataURL('image/webp',.65);if(dataUrl.length>65536)return false;const next=[{sceneId:id,dataUrl,savedAt:Date.now()},...images.filter(v=>v.sceneId!==id)].slice(0,100);while(JSON.stringify(next).length>2*1024*1024)next.pop();io.save(JSON.stringify(next));images=next;return true;}catch{return false;}}};
}
function atomicRecordWrite(storage,writes,previousKey){
    const original=Object.fromEntries(Object.keys(writes).map(key=>[key,storage.getItem(key)]));
    if(previousKey)storage.setItem(previousKey,JSON.stringify(original));
    try{for(const [key,value] of Object.entries(writes))storage.setItem(key,value);}catch(error){let failed=false;for(const [key,value] of Object.entries(original))try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{failed=true;}throw Error(failed?'저장·원복 모두 실패했습니다. 이전 복구 사본을 보존했습니다.':'저장 실패 · 원래 자료로 되돌렸습니다.');}
}
function subsetRegisteredLibrary(current,value,{fresh=false}={}){const ids=new Set(value.reservations.map(v=>v.id));if(fresh){if(JSON.stringify({...current,reservations:[]})!==JSON.stringify({...value,reservations:[]}))throw Error('예약 재료가 다른 탭에서 변경됐습니다. 다시 확인해 주세요.');if(current.reservations.some(v=>ids.has(v.id)))throw Error('새 예약 ID가 중복됐습니다.');return current;}for(const reservation of value.reservations){const saved=current.reservations.find(v=>v.id===reservation.id);if(!saved||JSON.stringify(saved)!==JSON.stringify(reservation))throw Error('등록할 예약이 다른 탭에서 변경됐습니다. 다시 확인해 주세요.');}return {...current,reservations:current.reservations.filter(v=>!ids.has(v.id))};}
function changeSceneCards(value,ids,{operation='move',folderId='',idFactory=()=>crypto.randomUUID()}={}) {
    const library=normalizePresetLibrary(value),selected=new Set(ids);if(!ids.length||selected.size!==ids.length||ids.some(id=>!library.sceneCards?.some(v=>v.id===id)))throw Error('씬을 하나 이상 선택해 주세요.');
    if(operation==='move'&&folderId&&!library.sceneFolders?.some(v=>v.id===folderId))throw Error('이동할 씬 그룹이 없습니다.');
    const next=JSON.parse(JSON.stringify(library));
    if(operation==='delete')next.sceneCards=next.sceneCards.filter(v=>!selected.has(v.id));
    else if(operation==='duplicate'){const existing=new Set(next.sceneCards.map(v=>v.id));next.sceneCards=next.sceneCards.flatMap(v=>{if(!selected.has(v.id))return [v];const id=presetIdentifier(idFactory(),'복제 씬');if(existing.has(id))throw Error('복제 씬 ID가 중복됐습니다.');existing.add(id);return [v,{...v,id,name:v.name+' (복사본)'}];});}
    else if(operation==='move'){for(const scene of next.sceneCards)if(selected.has(scene.id)){if(folderId)scene.folderId=folderId;else delete scene.folderId;}}
    else throw Error('씬 관리 동작을 확인해 주세요.');
    return normalizePresetLibrary(next);
}
function convertImportedOptions(value) {
    const input={...presetObject(value,'대기열 옵션')},conversionWarnings=[];
    if(Object.hasOwn(input,'ui')) {normalizeWorkspaceUI(input.ui);delete input.ui;conversionWarnings.push('앱 전용 칸 비율·접힘·씬 보기 설정은 제외합니다. 이 브라우저의 화면 설정은 유지합니다.');}
    return {options:normalizeSettingsOptions(input),...(conversionWarnings.length?{conversionWarnings}:{})};
}
function compatibleSettings(library,options,meta,target='app') {
    const out=JSON.parse(JSON.stringify(settingsBackupLibrary(library))),preferences={...normalizeSettingsOptions(options)},warnings=[];
    if(Object.hasOwn(preferences,'embedMetadata')){delete preferences.embedMetadata;warnings.push('브라우저 PNG 기록 선택은 대상 앱/구형 스크립트 옵션에서 제외합니다.');}
    if(target==='legacy') {
        for(const key of ['commonPresets','sceneCards','sceneFolders','casts','batchPlans'])if(Object.hasOwn(out,key)){delete out[key];warnings.push(`${key}는 0.9.14에서 편집할 수 없어 제외합니다.`);}
        const cleanPreset=preset=>{const next={...preset};delete next.prompt;delete next.negativePrompt;delete next.commonPresetId;return next;};
        if(out.presets.some(item=>item.prompt||item.negativePrompt||item.commonPresetId))warnings.push('프리셋 문구·공통문 연결은 새 조합에서 제외합니다. 이미 예약한 문구는 사본에 합쳐 보존합니다.');
        out.reservations=out.reservations.map(res=>{
            const next={...res},frozen=res.snapshot || snapshotCombination(library,res),p=frozen.preset,join=(...parts)=>parts.map(presetText).filter(Boolean).join(', ');
            const chunks=frozen.chunks.map(item=>({...item})),extras=frozen.extras||{};
            if(extras.scene&&(extras.scene.prompt||extras.scene.negativePrompt))chunks.push({id:`${res.id}:scene-extra`,name:'씬 추가 문구',...extras.scene});
            next.sceneIds=chunks.map(item=>item.id);next.snapshot={common:{prompt:join(frozen.common.prompt,p.prompt),negativePrompt:join(frozen.common.negativePrompt,p.negativePrompt)},preset:cleanPreset(p),character:{...frozen.character,prompt:join(frozen.character.prompt,extras.cast?.prompt),negativePrompt:join(frozen.character.negativePrompt,extras.cast?.negativePrompt)},chunks};
            delete next.snapshot.character.defaultPresetId;delete next.snapshot.character.folderId;delete next.batch;delete next.sourceSceneId;return next;
        });
        out.presets=out.presets.map(cleanPreset);out.characters=out.characters.map(item=>{delete item.defaultPresetId;return item;});
    }
    return {backup:{format:'pixai-web-queue-settings',version:1,...settingsBackupMeta(meta),library:out,options:preferences},warnings};
}
/** Resolve only live compositions. Frozen reservations already contain the selected text. */
function resolvePresetCommon(library, preset) {
    if (!preset?.commonPresetId)
        return library.common;
    const selected = library.commonPresets?.find((item) => item.id === preset.commonPresetId);
    if (!selected)
        throw new Error('연결된 공통문 세트가 없습니다. 프리셋의 연결을 확인해 주세요.');
    return { prompt: selected.prompt, negativePrompt: selected.negativePrompt };
}
function deleteCommonPreset(library, id) {
    return {
        ...library,
        commonPresets: (library.commonPresets ?? []).filter((item) => item.id !== id),
        presets: library.presets.map((item) => item.commonPresetId === id ? omitKey(item, 'commonPresetId') : item)
    };
}
function normalizeExtraText(value, label) {
    const source = allowedKeys(value, label, [], ['prompt', 'negativePrompt']);
    return {
        prompt: presetText(source.prompt ?? ''),
        negativePrompt: presetText(source.negativePrompt ?? '')
    };
}
/** 청크에서 폴더 연결을 뺀 사본 (씬 카드·예약 사본용). */
function stripFolder(chunk) {
    return {
        id: chunk.id,
        name: chunk.name,
        prompt: chunk.prompt,
        negativePrompt: chunk.negativePrompt
    };
}
function omitKey(value, key) {
    const copy = { ...value };
    delete copy[key];
    return copy;
}
function normalizeSceneCard(item, id, folderIds) {
    if (!Array.isArray(item.sceneIds))
        throw new Error('씬의 청크 목록 형식을 확인해 주세요.');
    const sceneIds = item.sceneIds.map((value) => presetIdentifier(value, '씬 청크'));
    if (new Set(sceneIds).size !== sceneIds.length)
        throw new Error('씬에 같은 청크를 중복 넣을 수 없습니다.');
    if (!Array.isArray(item.chunks))
        throw new Error('씬의 청크 사본 형식을 확인해 주세요.');
    const chunks = normalizeChunkList(item.chunks, new Set(), '씬 청크 사본').map(stripFolder);
    if (JSON.stringify(chunks.map((chunk) => chunk.id)) !== JSON.stringify(sceneIds))
        throw new Error('씬 사본과 청크 순서가 다릅니다.');
    const card = { id, name: presetText(item.name), sceneIds, chunks };
    if (hasOwn(item, 'extra'))
        card.extra = normalizeExtraText(item.extra, '씬 추가 문구');
    if (hasOwn(item, 'imageOptions'))
        card.imageOptions = normalizeImageOptions(item.imageOptions);
    if (hasOwn(item, 'triggerPosition'))
        card.triggerPosition = normalizeTriggerPosition(item.triggerPosition, sceneIds.length);
    if (hasOwn(item, 'folderId')) {
        const folderId = presetIdentifier(item.folderId, '씬 모음');
        if (!folderIds.has(folderId))
            throw new Error(`씬 ${id}의 모음이 없습니다: ${folderId}`);
        card.folderId = folderId;
    }
    return card;
}
function normalizeCast(item, id) {
    const cast = {
        id,
        name: presetText(item.name),
        characterId: presetIdentifier(item.characterId, '출연 캐릭터'),
        presetId: presetIdentifier(item.presetId, '출연 프리셋')
    };
    if (hasOwn(item, 'extra'))
        cast.extra = normalizeExtraText(item.extra, '출연 추가 문구');
    if (hasOwn(item, 'triggerPosition'))
        cast.triggerPosition = normalizeTriggerPosition(item.triggerPosition, 1000);
    return cast;
}
const batchRowKey = (row) => `${row.kind}:${row.id}`;
const batchCellKey = (rowKey, columnId) => `${rowKey}|${columnId}`;
function normalizeBatchPlan(item, id = 'plan') {
    const source = allowedKeys(item, '일괄 예약 구성', ['rows', 'columns', 'count'], ['id', 'name', 'rows', 'columns', 'count', 'exceptions', 'order', 'imageOptions']);
    if (!Array.isArray(source.rows) || !Array.isArray(source.columns))
        throw new Error('일괄 예약의 행·열 목록 형식을 확인해 주세요.');
    const rows = source.rows.map((row) => {
        const entry = allowedKeys(row, '일괄 예약 행', ['kind', 'id'], ['kind', 'id', 'presetId']);
        if (entry.kind !== 'character' && entry.kind !== 'cast')
            throw new Error('일괄 예약 행 종류는 캐릭터 또는 출연이어야 합니다.');
        const result = { kind: entry.kind, id: presetIdentifier(entry.id, '일괄 예약 행') };
        if (hasOwn(entry, 'presetId') && presetText(entry.presetId))
            result.presetId = presetIdentifier(entry.presetId, '행 프리셋');
        return result;
    });
    if (new Set(rows.map(batchRowKey)).size !== rows.length)
        throw new Error('일괄 예약 행이 중복됐습니다.');
    const columns = source.columns.map((value) => presetIdentifier(value, '일괄 예약 씬'));
    if (new Set(columns).size !== columns.length)
        throw new Error('일괄 예약 씬이 중복됐습니다.');
    const plan = {
        id: presetIdentifier(id, '일괄 예약 구성'),
        name: presetText(source.name ?? ''),
        rows,
        columns,
        count: presetInteger(source.count, '일괄 반복 수', 1, 100),
        exceptions: {},
        order: 'byRow'
    };
    if (hasOwn(source, 'order') && source.order != null) {
        if (source.order !== 'byRow' && source.order !== 'byColumn')
            throw new Error('순회 순서는 캐릭터별 또는 씬별이어야 합니다.');
        plan.order = source.order;
    }
    if (hasOwn(source, 'exceptions') && source.exceptions != null) {
        const exceptions = presetObject(source.exceptions, '조합별 예외');
        const rowKeys = new Set(rows.map(batchRowKey));
        for (const [key, value] of Object.entries(exceptions)) {
            const split = key.indexOf('|');
            if (split < 0)
                throw new Error(`조합별 예외의 대상을 확인해 주세요: ${key}`);
            // 선택에서 빠진 행/열의 예외는 오류가 아니라 버린다 — 저장한 구성이 체크 해제에도 살아남게.
            if (!rowKeys.has(key.slice(0, split)) || !columns.includes(key.slice(split + 1)))
                continue;
            plan.exceptions[key] = presetInteger(value, '조합별 반복 수', 0, 100);
        }
    }
    if (hasOwn(source, 'imageOptions') && source.imageOptions != null)
        plan.imageOptions = normalizeImageOptions(source.imageOptions);
    return plan;
}
function normalizeBatchTag(value) {
    const source = allowedKeys(value, '예약 묶음', ['id', 'name'], ['id', 'name', 'rowName', 'columnName']);
    return {
        id: presetIdentifier(source.id, '예약 묶음'),
        name: presetText(source.name),
        rowName: presetText(source.rowName ?? ''),
        columnName: presetText(source.columnName ?? '')
    };
}
function normalizeChunkList(items, folderIds, label) {
    const seen = new Set();
    return items.map((raw) => {
        const item = presetObject(raw, label);
        const id = presetIdentifier(item.id, label);
        if (seen.has(id))
            throw new Error(`${label} ID가 중복됐습니다: ${id}`);
        seen.add(id);
        const chunk = {
            id,
            name: presetText(item.name),
            prompt: presetText(item.prompt),
            negativePrompt: presetText(item.negativePrompt)
        };
        if (hasOwn(item, 'folderId')) {
            const folderId = presetIdentifier(item.folderId, '청크 폴더');
            if (!folderIds.has(folderId))
                throw new Error(`청크 ${id}의 폴더가 없습니다: ${folderId}`);
            chunk.folderId = folderId;
        }
        return chunk;
    });
}
function normalizeWorkspaceUI(value) {
    const raw = allowedKeys(value, '화면 설정', [], ['paneRatios', 'collapsedPane', 'sceneView']);
    const result = {};
    if (raw.sceneView !== undefined) {
        if (!['grid', 'list'].includes(raw.sceneView))
            throw new Error('씬 보기 방식을 확인해 주세요.');
        result.sceneView = raw.sceneView;
    }
    if (raw.paneRatios !== undefined) {
        const ratios = allowedKeys(raw.paneRatios, '칸 비율', [], ['compose', 'scenes', 'library']);
        result.paneRatios = {};
        for (const name of ['compose', 'scenes', 'library'])
            if (ratios[name] !== undefined) {
                const values = ratios[name];
                if (!Array.isArray(values) ||
                    values.length !== 3 ||
                    values.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 5 || n > 90) ||
                    Math.abs(values.reduce((a, b) => a + b, 0) - 100) > 0.1)
                    throw new Error('칸 비율을 확인해 주세요.');
                result.paneRatios[name] = [...values];
            }
    }
    if (raw.collapsedPane !== undefined) {
        const collapsed = allowedKeys(raw.collapsedPane, '접힌 칸', [], ['compose', 'scenes', 'library']);
        result.collapsedPane = {};
        for (const name of ['compose', 'scenes', 'library'])
            if (collapsed[name] !== undefined)
                result.collapsedPane[name] = presetInteger(collapsed[name], '접힌 칸', 0, 2);
    }
    return result;
}
/**
 * 여러 캐릭터(출연) × 여러 씬 일괄 예약.
 *
 * 행 = 캐릭터 또는 출연(A1, A2, A3, B1, B2 …), 열 = 씬(표정1, 표정2 …). 쌍마다 **별도 작업**으로 펼친다 —
 * 한 장에 여러 명을 넣는 단체 구성이 아니다. 결과는 보통의 예약(Reservation) 여러 개라 등록·확정·복구는 기존 흐름 그대로다.
 * 설계: docs/plans/2026-10-10_pixai-batch-reservation-design.md §2–§3.
 */
const defaultIdFactory = () => globalThis.crypto.randomUUID();
/** 라이브러리 청크로 씬 카드를 만든다. 이름이 비면 청크 이름을 ' · '로 잇는다. 캐릭터·프리셋은 절대 넣지 않는다. */
function makeSceneCard(value, input, options = {}) {
    const library = normalizeLibrary(value);
    const source = presetObject(input, '씬');
    if (!Array.isArray(source.sceneIds) || !source.sceneIds.length)
        throw new Error('씬에 넣을 청크를 하나 이상 골라 주세요.');
    const chunks = source.sceneIds.map((id) => {
        const found = library.scenes.find((item) => item.id === id);
        if (!found)
            throw new Error(`씬에 넣을 청크가 없습니다: ${id}`);
        return stripFolder(found);
    });
    const card = {
        id: source.id ?? (options.idFactory ?? defaultIdFactory)(),
        name: presetText(source.name ?? '') || chunks.map((item) => item.name || '청크').join(' · '),
        sceneIds: [...source.sceneIds],
        chunks
    };
    for (const key of ['extra', 'imageOptions', 'triggerPosition', 'folderId'])
        if (source[key] != null)
            card[key] = source[key];
    const sceneFolders = library.sceneFolders ?? [];
    const normalized = normalizeLibrary({ ...library, sceneFolders, sceneCards: [card] });
    return normalized.sceneCards[0];
}
/** 카드의 청크 사본과 현재 라이브러리를 비교만 한다. 카드는 바꾸지 않는다 — 사용자가 차이를 확인하면 돌려준 card로 교체. */
function refreshSceneCard(value, cardId) {
    const library = normalizeLibrary(value);
    const card = (library.sceneCards ?? []).find((item) => item.id === cardId);
    if (!card)
        throw new Error('갱신할 씬이 없습니다.');
    const changes = [];
    const missing = [];
    const chunks = card.chunks.map((copy) => {
        const live = library.scenes.find((item) => item.id === copy.id);
        if (!live) {
            missing.push(copy.id);
            return copy;
        }
        for (const field of ['name', 'prompt', 'negativePrompt'])
            if (live[field] !== copy[field])
                changes.push({ id: copy.id, field, before: copy[field], after: live[field] });
        return stripFolder(live);
    });
    return { card: { ...card, chunks }, changes, missing };
}
function defaultBatchName(rowCount, columnCount, now) {
    const at = new Date(now ?? Date.now());
    const pad = (value) => String(value).padStart(2, '0');
    return `캐릭터 ${rowCount} × 씬 ${columnCount} · ${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
/** 행 하나를 캐릭터+프리셋으로 해석한다. 프리셋 미지정·삭제된 재료는 problems로 알린다(임의 대체 없음). */
function resolveBatchRow(value, row) {
    const library = normalizeLibrary(value);
    const key = batchRowKey(row);
    const problems = [];
    let characterId = '';
    let presetId = '';
    let name = row.id;
    let extra;
    let triggerPosition;
    if (row.kind === 'cast') {
        const cast = (library.casts ?? []).find((item) => item.id === row.id);
        if (!cast)
            return {
                key,
                kind: 'cast',
                id: row.id,
                name,
                characterId,
                presetId,
                problems: [`출연 ${row.id}이(가) 없습니다.`]
            };
        ({ characterId, presetId, extra, triggerPosition } = cast);
        name = cast.name || cast.id;
    }
    else {
        const character = library.characters.find((item) => item.id === row.id);
        if (!character)
            return {
                key,
                kind: 'character',
                id: row.id,
                name,
                characterId,
                presetId,
                problems: [`캐릭터 ${row.id}이(가) 없습니다.`]
            };
        characterId = character.id;
        name = character.name || character.id;
        presetId = row.presetId || character.defaultPresetId || '';
        if (!presetId)
            problems.push(`캐릭터 「${name}」의 모델·LoRA 프리셋이 지정되지 않았습니다.`);
    }
    if (presetId && !library.presets.some((item) => item.id === presetId))
        problems.push(`「${name}」의 프리셋 ${presetId}이(가) 없습니다.`);
    if (characterId && !library.characters.some((item) => item.id === characterId))
        problems.push(`출연 「${name}」의 캐릭터 ${characterId}이(가) 없습니다.`);
    return {
        key,
        kind: row.kind,
        id: row.id,
        name,
        characterId,
        presetId,
        ...(extra ? { extra } : {}),
        ...(triggerPosition !== undefined ? { triggerPosition } : {}),
        problems
    };
}
/**
 * 행 × 열 × 반복 수를 예약으로 펼친다.
 * - 반복 수: 조합별 예외 > 공통값. 0 = 제외.
 * - 순회: byRow = 캐릭터별로 씬 순회, byColumn = 씬별로 캐릭터 순회. 순서는 수량을 바꾸지 않는다.
 * - 비율/크기: 씬 > 구성 > 없음(전역 설정). 트리거 위치: 씬 > 출연 > 기본.
 * - 오류(problems.level 'error')가 하나라도 있으면 reservations는 비어 있다. 경고(청크 연결 끊김)는 저장된 사본으로 진행한다.
 */
function expandBatchPlan(value, planInput, options = {}) {
    const library = normalizeLibrary(value);
    const plan = normalizeBatchPlan(planInput, planInput?.id ?? 'plan');
    const idFactory = options.idFactory ?? defaultIdFactory;
    const batchSize = options.batchSize == null || options.batchSize === 0
        ? 4
        : presetInteger(options.batchSize, '배치 장수', 1, 4);
    const problems = [];
    const rows = plan.rows.map((row) => resolveBatchRow(library, row));
    for (const row of rows)
        for (const message of row.problems)
            problems.push({ level: 'error', rowKey: row.key, rowName: row.name, message });
    const columns = plan.columns.map((id) => {
        const card = (library.sceneCards ?? []).find((item) => item.id === id);
        if (!card) {
            problems.push({
                level: 'error',
                columnId: id,
                columnName: id,
                message: `씬 ${id}이(가) 없습니다.`
            });
            return null;
        }
        const missing = card.sceneIds.filter((sceneId) => !library.scenes.some((item) => item.id === sceneId));
        if (missing.length)
            problems.push({
                level: 'warning',
                columnId: id,
                columnName: card.name,
                message: `씬 「${card.name}」의 청크 ${missing.join(', ')} 연결이 끊겨 저장된 사본을 사용합니다.`
            });
        return card;
    });
    const sequence = plan.order === 'byColumn'
        ? columns.flatMap((column) => rows.map((row) => [row, column]))
        : rows.flatMap((row) => columns.map((column) => [row, column]));
    const pairs = [];
    for (const [row, column] of sequence) {
        if (!column)
            continue;
        const key = batchCellKey(row.key, column.id);
        const count = Object.prototype.hasOwnProperty.call(plan.exceptions, key)
            ? plan.exceptions[key]
            : plan.count;
        if (count > 0)
            pairs.push({ row, column, count });
    }
    const batch = {
        id: options.batchId ?? idFactory(),
        name: plan.name || defaultBatchName(rows.length, columns.filter(Boolean).length, options.now)
    };
    const reservations = [];
    if (!problems.some((item) => item.level === 'error')) {
        for (const { row, column, count } of pairs) {
            const preset = library.presets.find((item) => item.id === row.presetId);
            const character = library.characters.find((item) => item.id === row.characterId);
            const extras = {};
            if (row.extra)
                extras.cast = row.extra;
            if (column.extra)
                extras.scene = column.extra;
            const triggerPosition = column.triggerPosition ?? row.triggerPosition;
            const imageOptions = { ...(options.defaultImageOptions ?? {}), ...(plan.imageOptions ?? {}), ...(column.imageOptions ?? {}) };
            const reservation = {
                id: presetIdentifier(idFactory(), '예약'),
                presetId: row.presetId,
                characterId: row.characterId,
                sceneIds: [...column.sceneIds],
                sourceSceneId: column.id,
                count,
                snapshot: normalizeSnapshot({
                    common: resolvePresetCommon(library, preset),
                    preset,
                    character,
                    chunks: column.chunks,
                    ...(Object.keys(extras).length ? { extras } : {})
                }),
                batch: { id: batch.id, name: batch.name, rowName: row.name, columnName: column.name }
            };
            if (triggerPosition !== undefined)
                reservation.triggerPosition =
                    triggerPosition === 'end'
                        ? 'end'
                        : Math.min(normalizeTriggerPosition(triggerPosition, 1000), column.sceneIds.length + 2);
            if (Object.keys(imageOptions).length)
                reservation.imageOptions = normalizeImageOptions(imageOptions);
            reservations.push(reservation);
        }
    }
    const jobs = pairs.reduce((sum, item) => sum + item.count, 0);
    return {
        batch,
        plan,
        reservations,
        problems,
        totals: { pairs: pairs.length, jobs, images: pairs.reduce((sum, item) => sum + item.count * (item.column.imageOptions?.batchSize ?? plan.imageOptions?.batchSize ?? options.defaultImageOptions?.batchSize ?? batchSize), 0), batchSize },
        order: pairs.map((item) => ({
            rowKey: item.row.key,
            rowName: item.row.name,
            columnId: item.column.id,
            columnName: item.column.name,
            count: item.count
        }))
    };
}
/** 전부 추가하거나(새 라이브러리 반환) 아무것도 바꾸지 않고 throw. 입력 라이브러리는 건드리지 않는다. */
function appendBatchReservations(value, expansion) {
    if (!expansion || !Array.isArray(expansion.reservations))
        throw new Error('일괄 예약 결과 형식을 확인해 주세요.');
    const errors = (expansion.problems ?? []).filter((item) => item.level === 'error');
    if (errors.length)
        throw new Error(`해결할 조합이 있습니다: ${errors.map((item) => item.message).join(' / ')}`);
    if (!expansion.reservations.length)
        throw new Error('예약할 조합이 없습니다. 반복 수와 제외 항목을 확인해 주세요.');
    const library = normalizeLibrary(value);
    const reserved = library.reservations.reduce((sum, item) => sum + item.count, 0);
    if (reserved + expansion.totals.jobs > MAX_RESERVED_JOBS)
        throw new Error(`예약 작업은 한 번에 ${MAX_RESERVED_JOBS.toLocaleString()}개까지 만들 수 있습니다.`);
    return normalizeLibrary({
        ...library,
        reservations: [...library.reservations, ...expansion.reservations]
    });
}
const IMAGE_INFO_MAX_BYTES = 32 * 1024 * 1024;
const IMAGE_INFO_TEXT_LIMIT = 1024 * 1024;
const IMAGE_INFO_KEY = 'pixai-clack-helper';
// Metadata is untrusted. Only explicit supported values become applicable settings.
function imageInfoFields(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    const p = value;
    const out = {};
    if(p.modelIncomplete===true||(Array.isArray(p.loras)&&p.loras.some(v=>!v||typeof v.versionId!=='string'||!/^\d{1,40}$/.test(v.versionId)||typeof v.id!=='string'||!/^\d{1,40}$/.test(v.id)))||(p.loras!==undefined&&(!Array.isArray(p.loras)||p.loras.length>5||p.loras.some(v=>!v||typeof v.weight!=='number'||!Number.isFinite(v.weight)||v.weight<0||v.weight>1))))out.modelIncomplete=true;
    for (const key of ['prompt', 'negativePrompt'])
        if (typeof p[key] === 'string' && p[key].length <= 100000)
            out[key] = p[key];
    if (typeof p.modelVersionId === 'string' && /^\d{1,40}$/.test(p.modelVersionId))
        out.modelVersionId = p.modelVersionId;
    if (typeof p.modelId === 'string' && /^\d{1,40}$/.test(p.modelId))
        out.modelId = p.modelId;
    if (Array.isArray(p.loras) &&
        p.loras.length <= 5 &&
        p.loras.every((v) => v &&
            typeof v.versionId === 'string' &&
            /^\d{1,40}$/.test(v.versionId) &&
            typeof v.weight === 'number' &&
            Number.isFinite(v.weight) &&
            v.weight >= 0 &&
            v.weight <= 1))
        out.loras = p.loras.map((v) => ({
            versionId: v.versionId,
            weight: v.weight,
            ...(typeof v.id === 'string' && /^\d{1,40}$/.test(v.id) ? { id: v.id } : {})
        }));
    if (Number.isInteger(p.seed) && Number(p.seed) >= 0 && Number(p.seed) <= 4294967295) {
        out.seed = Number(p.seed);
        out.seedKind = p.seedKind === 'request' ? 'request' : 'file';
    }
    if (p.batchSize === 1 || p.batchSize === 4)
        out.batchSize = p.batchSize;
    for (const key of ['width', 'height'])
        if (Number.isInteger(p[key]) && Number(p[key]) > 0 && Number(p[key]) <= 40000)
            out[key] = Number(p[key]);
    if (typeof p.aspectRatio === 'string' && API_RATIOS.includes(p.aspectRatio))
        out.aspectRatio = p.aspectRatio;
    if (p.size === '1k' || p.size === '1.5k')
        out.size = p.size;
    if (typeof p.mode === 'string' && ['', 'lite', 'standard', 'pro', 'ultra'].includes(p.mode))
        out.mode = p.mode;
    if (typeof p.style === 'string' && /^[a-z][a-z0-9-]{0,80}$/.test(p.style))
        out.style = p.style;
    return out;
}
/** Only the public model-page URL format documented by PixAI is accepted. */
function parsePublicModelLink(value) {
    let url;
    try {
        url = new URL(value.trim());
    }
    catch {
        throw new Error('PixAI 모델·LoRA 링크를 입력해 주세요.');
    }
    if (url.protocol !== 'https:' ||
        url.hostname !== 'pixai.art' ||
        url.port ||
        url.username ||
        url.password)
        throw new Error('https://pixai.art 모델 링크만 사용할 수 있습니다.');
    const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?model\/(\d{1,40})(?:-([^/]+))?(?:\/(\d{1,40}))?\/?$/);
    if (!match)
        throw new Error('PixAI 모델 페이지에서 사용할 버전을 선택한 뒤 링크를 복사해 주세요.');
    let name = '';
    try {
        name = decodeURIComponent(match[2] ?? '')
            .replace(/[-_]+/g, ' ')
            .slice(0, 200);
    }
    catch {
        /* optional name */
    }
    return {
        id: match[1],
        versionId: match[3] ?? '',
        name,
        url: `https://pixai.art/model/${match[1]}${match[3] ? `/${match[3]}` : ''}`,
        notice: match[3]
            ? '링크의 모델 ID와 버전 ID를 읽었습니다.'
            : '모델 ID만 있는 링크입니다. 사이트에서 버전을 선택한 링크를 넣거나 버전 ID를 직접 입력해 주세요.'
    };
}
