// SPDX-License-Identifier: GPL-3.0-only
// Adapted 2026-10-16 from cotton100/PixaiClackHelper be258ad
// src/shared/pixai/backup-transfer.ts and expansion-budget.ts.
// Browser port uses existing strict validators, batch keys, and app-compatible v1 exports.
const BACKUP_CATEGORIES = [
    'sceneCards',
    'scenes',
    'characters',
    'presets',
    'commonPresets',
    'casts',
    'batchPlans',
    'reservations',
    'combinations'
];
const BACKUP_FOLDER_CATEGORIES = ['sceneCards', 'scenes'];
const BACKUP_LABELS = {
    sceneCards: '씬',
    scenes: '청크',
    characters: '캐릭터',
    presets: '모델·LoRA 프리셋',
    commonPresets: '공통문 세트',
    casts: '저장 출연',
    batchPlans: '일괄 예약 구성',
    reservations: '조합 예약',
    combinations: '최근 조합·즐겨찾기',
    common: '기본 공통문',
    options: '생성·화면 설정'
};
const TRANSFER_FOLDERS = {
    characters: 'characterFolders',
    scenes: 'chunkFolders',
    sceneCards: 'sceneFolders'
};
const TRANSFER_COLLECTIONS = [...BACKUP_CATEGORIES, ...Object.values(TRANSFER_FOLDERS)];
// The script accepts legacy library-only files too; a selective envelope always
// contains exactly one full settings backup, never another selective envelope.
function validateBackupSelection(value) {
    const keys = [...BACKUP_CATEGORIES, 'common', 'options'];
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== keys.length ||
        Object.keys(value).some((key) => !keys.includes(key)) ||
        Object.values(value).some((enabled) => typeof enabled !== 'boolean'))
        throw new Error('백업 선택 범위를 확인해 주세요.');
    return value;
}
/** Conservative allocation bound shared with the app's expansion budget. */
function backupJsonBytes(value, limit = 20 * 1024 * 1024) {
    let bytes = 0;
    const add = (count) => {
        bytes += count;
        if (bytes > limit)
            throw new Error('자료 용량이 너무 큽니다. 문구나 예약 수를 줄여 주세요.');
    };
    const visit = (item) => {
        if (typeof item === 'string') {
            if (item.length > limit) add(item.length);
            add(new TextEncoder().encode(JSON.stringify(item)).byteLength);
        } else if (Array.isArray(item)) {
            add(2 + item.length);
            for (const child of item) visit(child);
        } else if (item && typeof item === 'object') {
            add(2);
            for (const [key, child] of Object.entries(item)) {
                if (child === undefined) continue;
                visit(key);
                add(2);
                visit(child);
            }
        } else add(24);
    };
    visit(value);
    return bytes;
}
function backupFolderChoices(library, category) {
    return [...(library[TRANSFER_FOLDERS[category]] ?? []), { id: '', name: '미분류' }].map((folder) => ({
        ...folder,
        count: (library[category] ?? []).filter((item) => (item.folderId ?? '') === folder.id).length
    }));
}
function validateBackupFolderSelection(value, library) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('백업 폴더 선택 범위를 확인해 주세요.');
    const result = {};
    for (const key of Object.keys(value)) {
        if (!BACKUP_FOLDER_CATEGORIES.includes(key))
            throw new Error('백업 폴더 선택 범위를 확인해 주세요.');
        const category = key;
        const ids = value[category];
        const allowed = new Set(backupFolderChoices(library, category).map((x) => x.id));
        if (!Array.isArray(ids) ||
            ids.some((id) => typeof id !== 'string' || !allowed.has(id)) ||
            new Set(ids).size !== ids.length)
            throw new Error('백업에 없는 폴더가 선택되어 있습니다. 폴더 선택을 다시 확인해 주세요.');
        result[category] = [...ids];
    }
    return result;
}
function isBackupSelectedItem(category, item, selection, folders) {
    const scope = folders[category];
    return selection[category] && (!scope || scope.includes(item.folderId ?? ''));
}
function backupSelectionLabels(library, selection, folders = {}) {
    return Object.keys(selection)
        .filter((key) => selection[key])
        .map((key) => {
        const scope = folders[key];
        if (!scope)
            return BACKUP_LABELS[key];
        const names = backupFolderChoices(library, key)
            .filter((folder) => scope.includes(folder.id))
            .map((folder) => `${folder.name} (${folder.count}개)`);
        return `${BACKUP_LABELS[key]}: ${names.join(', ') || '선택한 폴더 없음'}`;
    });
}
function backupSelection(enabled = true) {
    return Object.fromEntries([...BACKUP_CATEGORIES, 'common', 'options'].map((k) => [k, enabled]));
}
/** Dependencies are copied, not made replacement targets. Folder order survives. */
function selectBackupLibrary(value, selection, folderSelection = {}) {
    validateBackupSelection(selection);
    const source = settingsBackupLibrary(value);
    const folders = validateBackupFolderSelection(folderSelection, source);
    const ids = Object.fromEntries(TRANSFER_COLLECTIONS.map((k) => [k, new Set()]));
    const index = Object.fromEntries(TRANSFER_COLLECTIONS.map((k) => [k, new Map((source[k] ?? []).map((x) => [x.id, x]))]));
    const pending = [];
    const add = (key, id) => {
        if (!id || ids[key].has(id) || !index[key].has(id))
            return;
        ids[key].add(id);
        pending.push([key, id]);
    };
    for (const key of BACKUP_CATEGORIES) {
        if (!selection[key])
            continue;
        for (const item of source[key] ?? [])
            if (isBackupSelectedItem(key, item, selection, folders))
                add(key, item.id);
        const folderKey = TRANSFER_FOLDERS[key];
        const scope = folders[key];
        if (folderKey)
            for (const folder of source[folderKey] ?? [])
                if (!scope || scope.includes(folder.id))
                    add(folderKey, folder.id);
    }
    for (let cursor = 0; cursor < pending.length; cursor++) {
        const [key, id] = pending[cursor];
        if (key === 'presets')
            add('commonPresets', index.presets.get(id).commonPresetId);
        if (key === 'characters') {
            const item = index.characters.get(id);
            add('presets', item.defaultPresetId);
            add('characterFolders', item.folderId);
        }
        if (key === 'scenes')
            add('chunkFolders', index.scenes.get(id).folderId);
        if (key === 'sceneCards') {
            const item = index.sceneCards.get(id);
            add('sceneFolders', item.folderId);
            item.sceneIds.forEach((x) => add('scenes', x));
        }
        if (key === 'casts') {
            const item = index.casts.get(id);
            add('characters', item.characterId);
            add('presets', item.presetId);
        }
        if (key === 'batchPlans') {
            const item = index.batchPlans.get(id);
            item.rows.forEach((row) => {
                add(row.kind === 'cast' ? 'casts' : 'characters', row.id);
                add('presets', row.presetId);
            });
            item.columns.forEach((x) => add('sceneCards', x));
        }
        if (key === 'reservations' || key === 'combinations') {
            const item = index[key].get(id);
            add('characters', item.characterId);
            add('presets', item.presetId);
            item.sceneIds.forEach((x) => add('scenes', x));
            if ('sourceSceneId' in item)
                add('sceneCards', item.sourceSceneId);
        }
    }
    const library = makePresetLibrary();
    for (const key of TRANSFER_COLLECTIONS)
        Object.assign(library, { [key]: (source[key] ?? []).filter((x) => ids[key].has(x.id)) });
    // A preset without a linked set needs the source default, even when it is not
    // a replacement target. No key or path setting travels with these materials.
    if (selection.common || library.presets.some((x) => !x.commonPresetId) || selection.reservations)
        library.common = source.common;
    const dependencies = Object.fromEntries(BACKUP_CATEGORIES.map((key) => [
        key,
        (source[key] ?? []).filter((item) => ids[key].has(item.id) &&
            !isBackupSelectedItem(key, item, selection, folders)).length
    ]).filter(([, count]) => count));
    return { library: settingsBackupLibrary(library), dependencies };
}
function makeTransferBackup(library, options, selection, meta, folderSelection = {}) {
    validateBackupSelection(selection);
    if (!Object.values(selection).some(Boolean))
        throw new Error('백업할 항목을 하나 이상 선택해 주세요.');
    const folders = validateBackupFolderSelection(folderSelection, library);
    for (const category of BACKUP_FOLDER_CATEGORIES) {
        if (!selection[category])
            delete folders[category];
        else if (folders[category]?.length === 0)
            throw new Error(`${BACKUP_LABELS[category]}에서 폴더를 하나 이상 선택해 주세요.`);
    }
    const selected = selectBackupLibrary(library, selection, folders).library;
    const result = {
        format: 'pixai-clack-helper-selection',
        version: Object.keys(folders).length ? 2 : 1,
        selection: { ...selection },
        ...(Object.keys(folders).length ? { folderSelection: folders } : {}),
        backup: compatibleSettings(selected, selection.options ? options : { maxCredits: null, filePrefix: '', repeat: 1 }, meta, 'app').backup
    };
    backupJsonBytes(result, 5 * 1024 * 1024);
    return result;
}
function parseTransferBackup(text) {
    if (typeof text !== 'string')
        throw new Error('설정 파일 내용을 읽을 수 없습니다.');
    if (text.length > 5 * 1024 * 1024 || new TextEncoder().encode(text).byteLength > 5 * 1024 * 1024)
        throw new Error('설정 파일은 5MiB 이하만 불러올 수 있습니다.');
    let parsed;
    try {
        parsed = JSON.parse(text.replace(/^\uFEFF/, ''), (key, value) => {
            if (['__proto__', 'constructor', 'prototype'].includes(key))
                throw new Error('객체 속성');
            return value;
        });
    }
    catch {
        throw new Error('설정 파일의 JSON 형식 또는 허용하지 않는 객체 속성을 확인해 주세요.');
    }
    const value = parsed;
    if (value?.format !== 'pixai-clack-helper-selection')
        return {
            format: 'pixai-clack-helper-selection',
            version: 1,
            selection: backupSelection(),
            backup: parseSettingsBackup(text)
        };
    if ((value.version !== 1 && value.version !== 2) ||
        Object.keys(value).some((k) => ![
            'format',
            'version',
            'selection',
            'backup',
            ...(value.version === 2 ? ['folderSelection'] : [])
        ].includes(k)) ||
        (value.version === 2 && !value.folderSelection))
        throw new Error('지원하지 않는 선택 백업 형식입니다.');
    validateBackupSelection(value.selection);
    if (!value.backup || typeof value.backup !== 'object' || Array.isArray(value.backup) ||
        value.backup.format !== 'pixai-web-queue-settings' ||
        ![1, 2].includes(value.backup.version))
        throw new Error('선택 백업 안의 설정 백업 형식을 확인해 주세요.');
    const backup = parseSettingsBackup(JSON.stringify(value.backup));
    const folders = value.version === 2
        ? validateBackupFolderSelection(value.folderSelection, backup.library)
        : undefined;
    if (folders &&
        (Object.keys(folders).length === 0 ||
            BACKUP_FOLDER_CATEGORIES.some((key) => folders[key] && (!value.selection[key] || folders[key].length === 0))))
        throw new Error('백업 폴더 선택 범위를 확인해 주세요.');
    return {
        format: value.format,
        version: value.version,
        selection: { ...value.selection },
        ...(folders ? { folderSelection: folders } : {}),
        backup
    };
}
/** Keep retained, not-yet-registered reservations unchanged when materials change. */
function freezeBackupReservation(library, reservation) {
    if (reservation.snapshot)
        return reservation;
    return {
        ...reservation,
        // The browser snapshot validator has no live folder collections.
        snapshot: snapshotCombination(library, reservation)
    };
}
function prepareBackupImport(current, transfer, selection, mode, idFactory = () => crypto.randomUUID(), folderSelection = transfer.folderSelection ?? {}) {
    validateBackupSelection(selection);
    if (mode !== 'append' && mode !== 'replace')
        throw new Error('추가 또는 선택 항목 교체 방식을 골라 주세요.');
    if (!Object.values(selection).some(Boolean))
        throw new Error('가져올 항목을 하나 이상 선택해 주세요.');
    const folders = validateBackupFolderSelection({ ...transfer.folderSelection, ...folderSelection }, transfer.backup.library);
    for (const key of BACKUP_FOLDER_CATEGORIES) {
        if (!selection[key])
            continue;
        const limit = transfer.folderSelection?.[key];
        if (folders[key]?.length === 0 ||
            (limit && folders[key]?.some((id) => !limit.includes(id))) ||
            (transfer.version === 2 && !transfer.selection[key]))
            throw new Error(`${BACKUP_LABELS[key]}의 백업에 포함된 폴더를 하나 이상 선택해 주세요.`);
    }
    const selected = selectBackupLibrary(transfer.backup.library, selection, folders);
    // Both values have passed JSON-only library validators. JSON copying also
    // supports userscript sandboxes without the structuredClone global.
    const incoming = JSON.parse(JSON.stringify(selected.library));
    const result = JSON.parse(JSON.stringify(settingsBackupLibrary(current)));
    const warnings = [];
    // Folder collections follow their material category, including empty folders.
    const replace = (key, item) => {
        if (mode !== 'replace')
            return false;
        const category = Object.entries(TRANSFER_FOLDERS).find(([, folder]) => folder === key)?.[0];
        if (category) {
            const scope = folders[category];
            return selection[category] && (!scope || scope.includes(item.id));
        }
        return isBackupSelectedItem(key, item, selection, folders);
    };
    if (mode === 'replace' &&
        !selection.reservations &&
        ['common', 'presets', 'characters', 'scenes', 'commonPresets'].some((k) => selection[k]))
        result.reservations = result.reservations.map((x) => freezeBackupReservation(result, x));
    const retained = Object.fromEntries(TRANSFER_COLLECTIONS.map((key) => [key, (result[key] ?? []).filter((item) => !replace(key, item))]));
    const maps = Object.fromEntries([...TRANSFER_COLLECTIONS, 'batch'].map((k) => [k, new Map()]));
    const used = new Set([
        ...TRANSFER_COLLECTIONS.flatMap((k) => [...(result[k] ?? []), ...(incoming[k] ?? [])].map((x) => x.id)),
        ...result.reservations.flatMap((x) => (x.batch ? [x.batch.id] : []))
    ]);
    const fresh = () => {
        for (let attempt = 0; attempt < 100; attempt++) {
            const id = idFactory();
            if (id && !used.has(id)) {
                used.add(id);
                return id;
            }
        }
        throw new Error('가져올 자료의 새 ID를 만들지 못했습니다.');
    };
    const remap = (key, id) => {
        if (!maps[key].has(id)) {
            const item = key === 'batch' ? undefined : (selected.library[key] ?? []).find((x) => x.id === id);
            const keep = key !== 'batch' && item && replace(key, item) && !retained[key].some((x) => x.id === id);
            maps[key].set(id, keep ? id : fresh());
        }
        return maps[key].get(id);
    };
    for (const key of TRANSFER_COLLECTIONS)
        for (const item of incoming[key] ?? [])
            item.id = remap(key, item.id);
    // Append never changes the user's default common text. Preserve imported
    // unlinked presets by assigning their old default to a new named set.
    const replacingDefault = mode === 'replace' && selection.common;
    const defaultDiffers = JSON.stringify(incoming.common) !== JSON.stringify(result.common);
    let importedDefault = [];
    if (!replacingDefault &&
        ((selection.common && mode === 'append') ||
            (defaultDiffers && incoming.presets.some((x) => !x.commonPresetId)))) {
        const id = fresh();
        importedDefault = [{ id, name: '가져온 기본 공통문', ...incoming.common }];
        for (const preset of incoming.presets)
            if (!preset.commonPresetId)
                preset.commonPresetId = id;
        // Mark this local ID as already remapped.
        maps.commonPresets.set(id, id);
        warnings.push('가져온 기본 공통문은 새 공통문 세트로 보관하고, 필요한 프리셋에 연결합니다.');
    }
    if (replacingDefault)
        result.common = incoming.common;
    const presetRef = (p) => {
        if (p.commonPresetId)
            p.commonPresetId = remap('commonPresets', p.commonPresetId);
    };
    for (const preset of incoming.presets)
        presetRef(preset);
    for (const character of incoming.characters) {
        if (character.defaultPresetId)
            character.defaultPresetId = remap('presets', character.defaultPresetId);
        if (character.folderId)
            character.folderId = remap('characterFolders', character.folderId);
    }
    for (const chunk of incoming.scenes)
        if (chunk.folderId)
            chunk.folderId = remap('chunkFolders', chunk.folderId);
    for (const card of incoming.sceneCards ?? []) {
        if (card.folderId)
            card.folderId = remap('sceneFolders', card.folderId);
        card.sceneIds = card.sceneIds.map((id) => remap('scenes', id));
        for (const chunk of card.chunks)
            chunk.id = remap('scenes', chunk.id);
    }
    for (const cast of incoming.casts ?? []) {
        cast.characterId = remap('characters', cast.characterId);
        cast.presetId = remap('presets', cast.presetId);
    }
    for (const plan of incoming.batchPlans ?? []) {
        const rows = new Map(plan.rows.map((row) => {
            const before = batchRowKey(row);
            row.id = remap(row.kind === 'cast' ? 'casts' : 'characters', row.id);
            if (row.presetId)
                row.presetId = remap('presets', row.presetId);
            return [before, batchRowKey(row)];
        }));
        const exceptions = {};
        for (const [cell, count] of Object.entries(plan.exceptions)) {
            const separator = cell.indexOf('|');
            const row = rows.get(cell.slice(0, separator));
            if (row)
                exceptions[batchCellKey(row, remap('sceneCards', cell.slice(separator + 1)))] = count;
        }
        plan.exceptions = exceptions;
        plan.columns = plan.columns.map((id) => remap('sceneCards', id));
    }
    for (const item of [...incoming.reservations, ...(incoming.combinations ?? [])]) {
        item.presetId = remap('presets', item.presetId);
        item.characterId = remap('characters', item.characterId);
        item.sceneIds = item.sceneIds.map((id) => remap('scenes', id));
        if ('snapshot' in item && item.snapshot) {
            item.snapshot.preset.id = item.presetId;
            // Frozen common is authoritative; a deleted live set must not bind elsewhere.
            delete item.snapshot.preset.commonPresetId;
            item.snapshot.character.id = item.characterId;
            if (item.snapshot.character.defaultPresetId)
                item.snapshot.character.defaultPresetId = remap('presets', item.snapshot.character.defaultPresetId);
            for (const chunk of item.snapshot.chunks)
                chunk.id = remap('scenes', chunk.id);
        }
        if ('sourceSceneId' in item && item.sourceSceneId)
            item.sourceSceneId = remap('sceneCards', item.sourceSceneId);
        if ('batch' in item && item.batch)
            item.batch.id = remap('batch', item.batch.id);
    }
    for (const key of TRANSFER_COLLECTIONS) {
        const merged = [...retained[key], ...(incoming[key] ?? [])];
        const category = Object.entries(TRANSFER_FOLDERS).find(([, folder]) => folder === key)?.[0];
        if (mode === 'replace' && category && folders[category]) {
            // Replacing a folder's contents must not move that folder to the end.
            const byId = new Map(merged.map((item) => [item.id, item]));
            result[key] = [...(result[key] ?? []), ...merged].flatMap((item) => {
                const kept = byId.get(item.id);
                byId.delete(item.id);
                return kept ? [kept] : [];
            });
        } else result[key] = merged;
    }
    result.commonPresets = [...(result.commonPresets ?? []), ...importedDefault];
    // A removed linked set cannot silently switch existing presets to the default.
    if (result.presets.some((p) => p.commonPresetId && !result.commonPresets?.some((x) => x.id === p.commonPresetId)))
        throw new Error('남겨 둔 프리셋이 사용하는 공통문 세트가 교체로 없어집니다. 추가 방식으로 가져오거나 프리셋도 함께 선택해 주세요.');
    const broken = result.characters.filter((x) => x.defaultPresetId && !result.presets.some((p) => p.id === x.defaultPresetId)).length +
        (result.casts ?? []).filter((x) => !result.characters.some((c) => c.id === x.characterId) ||
            !result.presets.some((p) => p.id === x.presetId)).length;
    if (broken)
        warnings.push(`교체 후 캐릭터·출연 ${broken}개의 연결 재료가 없습니다. 사용 전에 프리셋·캐릭터를 다시 지정해 주세요.`);
    if (mode === 'replace' && selection.scenes && (result.sceneCards?.length ?? 0))
        warnings.push('기존 씬은 저장된 청크 사본을 유지합니다. 바뀐 청크를 씬에 반영하려면 씬에서 갱신해 주세요.');
    // normalizeLibrary trims recent history; do not silently discard imports.
    const history = result.combinations ?? [];
    if (history.filter((x) => !x.favorite).length > 50 ||
        history.filter((x) => x.favorite).length > 1000)
        throw new Error('최근 조합은 50개, 즐겨찾기는 1,000개까지입니다. 기존 기록을 정리하거나 이 항목을 빼 주세요.');
    backupJsonBytes(result);
    return {
        library: settingsBackupLibrary(result),
        ...(selection.options && transfer.backup.options ? { options: transfer.backup.options } : {}),
        dependencies: selected.dependencies,
        warnings
    };
}
