// SPDX-License-Identifier: GPL-3.0-only
// Browser-only envelope: older userscripts reject version 2/3 instead of dropping
// character LoRAs, material folders or composition order. Transfers still use version 1.
function encodeLocalPresetLibrary(library) {
    const folders = (library.presetFolders?.length || library.commonPresetFolders?.length ||
        library.presets.some(preset => preset.folderId) || library.commonPresets?.some(preset => preset.folderId));
    const ordered = [...library.reservations,...(library.combinations||[])].some(item=>Object.hasOwn(item,'materialOrder'));
    if (folders || ordered) return JSON.stringify({ version: 3, library });
    return JSON.stringify(library.characters.some(character => character.loras?.length)
        ? { version: 2, library }
        : library);
}
function decodeLocalPresetLibrary(raw) {
    const value = raw === null ? makePresetLibrary() : JSON.parse(raw);
    if (value?.version === 2 || value?.version === 3) {
        settingsBackupKeys(value, '브라우저 라이브러리', ['version', 'library']);
        return normalizePresetLibrary(value.library);
    }
    return normalizePresetLibrary(value);
}
// Character LoRA data shares the preset validator and preserves its stored ranges.
// The API's final combined count and weight limits are checked before submission.
function normalizeCharacterLoras(value, options = {}) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new Error('캐릭터 LoRA 목록 형식을 확인해 주세요.');
    for (const lora of value)
        settingsBackupKeys(lora, '캐릭터 LoRA', ['id', 'weight'], ['id', 'name', 'versionId', 'weight', 'triggerWords']);
    return validatePresetConfiguration({
        model: { id: '1', name: '', versionId: '1' },
        loras: value
    }, options).loras;
}
function mergeCharacterLoras(presetLoras, characterLoras = [], options = {}) {
    const loras = [], sources = [], byParent = new Map(), byVersion = new Map();
    const lists = [normalizeCharacterLoras(presetLoras, options), normalizeCharacterLoras(characterLoras, options)];
    if (!lists[1].length) return { loras: lists[0], sources: lists[0].map(() => 'preset') };
    for (const [sourceIndex, list] of lists.entries()) for (const lora of list) {
        const otherParent = lora.versionId && byVersion.get(lora.versionId);
        if (otherParent && otherParent !== lora.id)
            throw new Error(`LoRA 버전 ${lora.versionId}에 서로 다른 모델 ID가 연결돼 있습니다. LoRA 설정을 확인해 주세요.`);
        const previousIndex = byParent.get(lora.id);
        if (previousIndex !== undefined) {
            const previous = loras[previousIndex];
            if (previous.versionId !== lora.versionId ||
                previous.weight !== lora.weight ||
                (previous.triggerWords || '') !== (lora.triggerWords || ''))
                throw new Error(`LoRA ${lora.name || lora.id}의 버전·수치·트리거가 프리셋과 캐릭터에서 다릅니다. 한쪽 설정을 맞추거나 제거해 주세요.`);
            sources[previousIndex] = 'both';
            continue;
        }
        const copy = { ...lora };
        byParent.set(lora.id, loras.length);
        loras.push(copy);
        sources.push(sourceIndex ? 'character' : 'preset');
        if (lora.versionId) byVersion.set(lora.versionId, lora.id);
    }
    return { loras, sources };
}
function effectiveCharacterPreset(preset, character = {}, options = {}) {
    presetObject(preset, '설정 프리셋');
    presetObject(character, '캐릭터');
    if (!Array.isArray(preset.loras)) throw new Error('LoRA 목록 형식을 확인해 주세요.');
    const loras = character.loras === undefined
        ? preset.loras.map(lora => ({ ...lora }))
        : mergeCharacterLoras(preset.loras, character.loras, options).loras;
    return { ...preset, loras };
}
