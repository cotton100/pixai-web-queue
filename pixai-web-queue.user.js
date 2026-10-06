// ==UserScript==
// @name         PixAI 웹 대기열 (로컬 후보)
// @namespace    local.pixai-web-queue
// @version      0.3.3
// @homepageURL  https://github.com/cotton100/pixai-web-queue
// @updateURL    https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js
// @downloadURL  https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js
// @description  모델·LoRA 트리거와 캐릭터·여러 청크 프롬프트를 조합해 순차 생성하고 브라우저에 맞는 방식으로 원본을 저장합니다.
// @match        https://pixai.art/*
// @grant        GM_download
// @grant        GM_info
// @sandbox      DOM
// @run-at       document-start
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const normalize = text => String(text ?? '').replace(/\r\n/g, '\n').trim();
  const jsonObject = value => typeof value === 'string' ? JSON.parse(value) : (value ?? {});
  const safeName = name => String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 65) || 'PixAI';
  const resumable = new Set(['queued', 'waiting', 'saving', 'save_failed']);
  function checkCost(text, limit) {
    if (limit == null) return null;
    const match = String(text).match(/생성!\s*([\d,]+)/);
    const cost = match ? Number(match[1].replace(/,/g, '')) : NaN;
    if (!Number.isFinite(cost) || cost < 1) throw new Error('생성 비용을 확정할 수 없습니다.');
    if (cost > limit) throw new Error(`표시 비용 ${cost.toLocaleString()}크레딧이 설정 상한 ${limit.toLocaleString()}을 넘습니다.`);
    return cost;
  }

  function clampPosition(position, size, viewport) {
    const margin = 8;
    const maxX = Math.max(margin, viewport.width - size.width - margin);
    const maxY = Math.max(margin, viewport.height - size.height - margin);
    return {
      x:Math.min(maxX, Math.max(margin, Number.isFinite(position?.x) ? position.x : margin)),
      y:Math.min(maxY, Math.max(margin, Number.isFinite(position?.y) ? position.y : margin))
    };
  }
  function bindPanelDrag(target, handle, io) {
    let drag = null;
    let positioned = false;
    function place(position) {
      const rect = target.getBoundingClientRect();
      const next = clampPosition(position, rect, io.viewport());
      Object.assign(target.style, {left:`${next.x}px`, top:`${next.y}px`, right:'auto', bottom:'auto'});
      positioned = true;
      return next;
    }
    function remember() {
      try { io.save({x:parseFloat(target.style.left), y:parseFloat(target.style.top)}); }
      catch { /* Moving still works when position storage is unavailable. */ }
    }
    try {
      const saved = io.load();
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) place(saved);
    } catch { /* Ignore a malformed position record, never the generation queue. */ }
    function bindHandle(control, open) {
      const tappable = typeof open === 'function';
      function move(event) {
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
        drag.moved = true;
        control.dataset.dragging = '';
        place({x:event.clientX - drag.x, y:event.clientY - drag.y});
      }
      control.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.isPrimary === false || drag || control.disabled || (tappable && event.isTrusted === false)) return;
        const rect = target.getBoundingClientRect();
        drag = {id:event.pointerId, control, x:event.clientX - rect.left, y:event.clientY - rect.top,
          startX:event.clientX, startY:event.clientY, moved:!tappable};
        if (!tappable) {place({x:rect.left,y:rect.top}); control.dataset.dragging = '';}
        control.setPointerCapture(event.pointerId);
        event.preventDefault(); event.stopPropagation();
      });
      control.addEventListener('pointermove', event => {
        if (!drag || drag.control !== control || event.pointerId !== drag.id) return;
        move(event);
        event.preventDefault(); event.stopPropagation();
      });
      const finish = event => {
        if (!drag || drag.control !== control || event.pointerId !== drag.id) return;
        if (tappable && !drag.moved && event.type === 'pointerup') move(event);
        const moved = drag.moved;
        drag = null;
        delete control.dataset.dragging;
        if (control.hasPointerCapture(event.pointerId)) control.releasePointerCapture(event.pointerId);
        if (moved) remember();
        if (tappable) {
          event.preventDefault(); event.stopPropagation();
          if (!moved && event.type === 'pointerup' && event.isTrusted !== false && !control.disabled) open();
        }
      };
      for (const type of ['pointerup','pointercancel','lostpointercapture']) control.addEventListener(type, finish);
      if (tappable) control.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        // Pointer taps are handled on release; keyboard/assistive clicks have no pointer detail.
        if (event.detail === 0 && !event.pointerType && event.isTrusted !== false && !control.disabled && !drag) open();
      });
    }
    bindHandle(handle);
    if (io.launcher) bindHandle(io.launcher, io.open);
    io.onResize(() => {
      if (!positioned) return;
      const rect = target.getBoundingClientRect();
      place({x:rect.left,y:rect.top}); remember();
    });
  }
  async function acceptFolder(chosen, io) {
    if (await chosen.queryPermission({mode:'readwrite'}) !== 'granted') throw new Error('선택한 폴더의 쓰기 권한이 없습니다. 폴더를 다시 선택하고 허용해 주세요.');
    if (io.partial && (!io.previous || !await chosen.isSameEntry(io.previous))) {
      throw new Error('부분 저장 작업은 기존 저장 폴더를 확인해야 재개할 수 있습니다.');
    }
    try { await io.remember(); return ''; }
    catch (error) {
      return `폴더 선택 완료. 다음 접속용 기록에 실패해 이 탭에서만 사용합니다 (${error.name || 'Error'}). 부분 저장 중 새로고침하지 마세요.`;
    }
  }
  function folderError(error) {
    if (error.name === 'AbortError') return '폴더 선택이 취소됐거나 브라우저에서 선택을 허용하지 않았습니다. 에셋 전용 하위 폴더를 선택해 주세요.';
    if (error.name === 'SecurityError') return `폴더 선택이 브라우저에서 차단됐습니다. PixAI 탭에서 버튼을 직접 눌러 주세요. [SecurityError] ${error.message}`;
    return `[${error.name || 'Error'}] ${error.message}`;
  }
  function storageSupport(win, download, info) {
    if (typeof win.showDirectoryPicker === 'function') return {mode:'folder', supported:true, message:'폴더 직접 저장 · 저장 폴더를 선택해 주세요.'};
    const supported = typeof download === 'function' && info?.downloadMode === 'browser';
    return {mode:'download', supported, message:supported
      ? '자동 다운로드 · 저장 위치는 브라우저의 다운로드 설정을 따릅니다. 준비 확인으로 작은 JSON 파일을 먼저 저장해 주세요.'
      : '자동 다운로드 준비 필요 · Tampermonkey 최신판에서 다운로드 모드를 Browser API로 설정하고 다운로드 권한을 허용한 뒤 새로고침해 주세요. 저장 폴더는 Firefox 다운로드 설정에서 정합니다.'};
  }
  function downloadError(error) {
    const code = error?.error || error?.name || 'download_failed';
    const advice = {
      not_enabled:'Tampermonkey 다운로드 기능을 켜 주세요.',
      not_whitelisted:'Tampermonkey의 허용 다운로드 확장자에 png, jpg, webp, json을 추가해 주세요.',
      not_permitted:'Tampermonkey 다운로드 권한을 허용해 주세요.',
      not_supported:'Tampermonkey를 최신판으로 업데이트하고 다운로드 모드를 Browser API로 설정해 주세요.',
      timeout:'다운로드 완료 확인 시간이 지났습니다. 이미 저장된 파일이 있을 수 있습니다. 재개하면 같은 작업의 파일을 추가 사본으로 저장합니다.'
    };
    return new Error(`다운로드 실패 [${code}]. ${advice[code] || '최신 Tampermonkey인지 확인하고 다운로드 목록과 설정을 확인해 주세요. 취소되거나 완료를 확인하지 못한 파일은 성공으로 처리하지 않습니다.'}`);
  }
  function managedDownload(download, blob, name, timers = {set:setTimeout, clear:clearTimeout}) {
    return new Promise((resolve,reject) => {
      let settled = false, control;
      const timer = timers.set(() => {
        fail({error:'timeout'});
        try { control?.abort(); } catch {}
      }, 120000);
      function finish(action, value) {
        if (settled) return;
        settled = true; timers.clear(timer); action(value);
      }
      function fail(error) { finish(reject, downloadError(error)); }
      try {
        control = download({url:blob, name, saveAs:false, conflictAction:'uniquify',
          onload:() => finish(resolve,name), onerror:fail, ontimeout:() => fail({error:'timeout'})});
      } catch (error) { fail(error); }
    });
  }
  function resetDownloadProgress(jobs) {
    // A browser download destination cannot be identified after reload/settings changes.
    // Save a complete new set for a known task; preserve all prior progress and files.
    for (const job of jobs) {
      if (!resumable.has(job.state) || !job.saved?.length) continue;
      if (!job.taskId) throw new Error('부분 다운로드 작업 ID가 없어 자동 재개할 수 없습니다.');
      job.previousDownloads ??= [];
      job.previousDownloads.push({files:job.saved, metadataFile:job.metadataFile || null, at:new Date().toISOString()});
      job.saved = []; delete job.metadataFile;
    }
  }
  // Direct pointer handlers also support browsers where only click delivery fails.
  function bindFolderActivation(root, getButton, action, onError) {
    let lastPointerAt = -Infinity;
    let pressedPointer = null;
    root.addEventListener('pointerdown', event => {
      const element = getButton();
      pressedPointer = element && !element.disabled && element.contains(event.target) && event.button === 0 && event.isPrimary !== false
        ? event.pointerId : null;
    }, true);
    root.addEventListener('pointercancel', () => { pressedPointer = null; }, true);
    const activate = event => {
      const element = getButton();
      if (!element || !element.contains(event.target)) return;
      if (event.type === 'pointerup') {
        const pressed = pressedPointer;
        pressedPointer = null;
        if (event.button !== 0 || event.isPrimary === false || event.pointerId !== pressed) return;
      }
      event.preventDefault(); event.stopImmediatePropagation();
      if (element.disabled) return;
      if (event.isTrusted === false) { onError(new Error('폴더 버튼을 마우스 또는 키보드로 직접 눌러 주세요.')); return; }
      if (event.type === 'pointerup') {
        lastPointerAt = event.timeStamp;
      } else if (event.detail > 0 && event.timeStamp - lastPointerAt < 1000) return;
      try { Promise.resolve(action()).catch(onError); }
      catch (error) { onError(error); }
    };
    root.addEventListener('pointerup', activate, true);
    root.addEventListener('click', activate, true); // Keyboard/assistive activation also works.
  }
  async function pickDirectory(win, notify, timers = {set:setTimeout, clear:clearTimeout}) {
    notify('입력 전달됨 · 폴더 선택창 여는 중…');
    if (typeof win.showDirectoryPicker !== 'function') throw new Error('이 실행 환경에서 폴더 선택 API를 사용할 수 없습니다. 데스크톱 Chrome/Edge의 일반 PixAI 탭에서 확인해 주세요.');
    // Call synchronously in the trusted gesture, before locks/storage/awaits.
    const pending = win.showDirectoryPicker({id:'pixai-queue', mode:'readwrite'});
    const timer = timers.set(() => notify('폴더 선택창 응답 대기 중 · Alt+Tab으로 다른 창 뒤에 열린 선택창이 있는지 확인해 주세요. 자동 재호출하지 않습니다.'), 8000);
    try {
      const chosen = await pending;
      notify('폴더 선택됨 · 쓰기 권한과 기록 확인 중…');
      return chosen;
    } finally { timers.clear(timer); }
  }

  function recover(jobs) {
    for (const job of jobs) {
      if (job.state === 'submitting') {
        job.state = job.taskId ? 'waiting' : 'unknown';
        job.error = '페이지가 닫혀 제출 결과를 확정할 수 없습니다. 자동 재생성하지 않습니다.';
      }
    }
    return jobs;
  }
  function verifyTask(job, task) {
    if (String(task?.id) !== job.taskId) throw new Error('작업 ID 불일치');
    if (job.submittedAt && (!Number.isFinite(Date.parse(task.createdAt)) || Date.parse(task.createdAt) < job.submittedAt - 5000)) {
      throw new Error('이전에 생성한 작업이거나 제출 시간을 확인할 수 없습니다.');
    }
    const parameters = jsonObject(task.parameters);
    const original = parameters.extra?.naturalPrompts ?? parameters.prompts;
    if (normalize(original) !== normalize(job.prompt)) throw new Error('해당 작업의 프롬프트가 대기열과 다릅니다.');
    return parameters;
  }
  function outputIds(task, expected) {
    const outputs = jsonObject(task.outputs);
    const ids = Array.isArray(outputs.batch)
      ? outputs.batch.map(item => String(item.mediaId ?? ''))
      : [String(task.mediaId ?? outputs.mediaId ?? '')];
    if (ids.length !== expected || ids.some(id => !/^\d+$/.test(id)) || new Set(ids).size !== ids.length) {
      throw new Error('원본 이미지 개수를 확정할 수 없습니다. 저장과 다음 생성을 중단합니다.');
    }
    return ids;
  }

  // Dependency-injected runner: the browser adapter is the only code that clicks Generate.
  async function processJob(job, io) {
    if (!resumable.has(job.state)) throw new Error(job.error || '이 작업은 자동으로 재개할 수 없습니다.');
    if (job.state === 'queued') {
      const prepared = await io.prepare(job);
      Object.assign(job, prepared, {state: 'submitting', error: '', submittedAt:Date.now()});
      io.persist(); // Must succeed BEFORE the single paid click.
      try {
        job.taskId = await io.submit(job);
        if (!/^\d+$/.test(job.taskId)) throw new Error('제출된 작업 ID를 확인하지 못했습니다.');
        job.state = 'waiting';
        io.persist();
      } catch (error) {
        job.state = job.taskId ? 'waiting' : error.notSubmitted ? 'queued' : 'unknown';
        job.error = error.message;
        io.persist();
        throw error;
      }
    }
    try {
      const task = await io.waitTask(job);
      verifyTask(job, task);
      const status = String(task.status).toLowerCase();
      if (!['completed', 'succeeded', 'success', 'done'].includes(status)) throw new Error('생성 완료 상태가 아닙니다.');
      const ids = outputIds(task, job.expected);
      job.state = 'saving';
      job.mediaIds = ids;
      job.saved ??= [];
      io.persist();
      for (let index = 0; index < ids.length; index++) {
        const mediaId = ids[index];
        if (job.saved.some(item => item.mediaId === mediaId)) continue;
        const file = await io.saveImage(job, mediaId, index);
        job.saved.push({mediaId, file});
        io.persist();
      }
      await io.saveMetadata(job);
      job.state = 'done';
      job.error = '';
      io.persist();
    } catch (error) {
      job.state = job.state === 'saving' ? 'save_failed' : 'waiting';
      job.error = error.message;
      io.persist();
      throw error;
    }
  }

  function makePresetLibrary() {
    return {version:1, common:{prompt:'', negativePrompt:''}, presets:[], characters:[], scenes:[], reservations:[]};
  }
  function presetText(value) {
    if (value != null && typeof value !== 'string') throw new Error('프롬프트와 이름은 문자열이어야 합니다.');
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
  }
  function presetIdentifier(value, label, numeric = false) {
    const result = presetText(value);
    if (!result || (numeric && !/^\d+$/.test(result))) throw new Error(`${label} ID를 확인해 주세요.`);
    return result;
  }
  function presetInteger(value, label, min, max) {
    if (!['number','string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) {
      throw new Error(`${label}은 ${min}~${max} 사이의 정수여야 합니다.`);
    }
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < min || result > max) throw new Error(`${label}은 ${min}~${max} 사이의 정수여야 합니다.`);
    return result;
  }
  function presetObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 형식을 확인해 주세요.`);
    return value;
  }
  function validatePresetConfiguration(value, options = {}) {
    const source = presetObject(value, '모델·LoRA 설정');
    const model = presetObject(source.model, '모델');
    const minWeight = options.minLoraWeight ?? -2;
    const maxWeight = options.maxLoraWeight ?? 2;
    if (!Number.isFinite(minWeight) || !Number.isFinite(maxWeight) || minWeight > maxWeight) throw new Error('LoRA 수치 허용 범위가 잘못됐습니다.');
    if (!Array.isArray(source.loras)) throw new Error('LoRA 목록 형식을 확인해 주세요.');
    const seen = new Set();
    const loras = source.loras.map(item => {
      presetObject(item, 'LoRA');
      const id = presetIdentifier(item.id, 'LoRA', true);
      if (seen.has(id)) throw new Error(`같은 LoRA가 중복됐습니다: ${id}`);
      seen.add(id);
      if (!['number','string'].includes(typeof item.weight) || (typeof item.weight === 'string' && !item.weight.trim())) {
        throw new Error(`LoRA ${id} 수치를 입력해 주세요.`);
      }
      const weight = Number(item.weight);
      if (!Number.isFinite(weight) || weight < minWeight || weight > maxWeight) throw new Error(`LoRA ${id} 수치는 ${minWeight}~${maxWeight} 사이여야 합니다.`);
      const lora = {id, name:presetText(item.name), weight};
      if (item.versionId != null && presetText(item.versionId)) lora.versionId = presetIdentifier(item.versionId, 'LoRA 버전', true);
      if (Object.prototype.hasOwnProperty.call(item, 'triggerWords')) {
        if (typeof item.triggerWords !== 'string') throw new Error(`LoRA ${id} 트리거는 문자열이어야 합니다.`);
        const triggerWords = presetText(item.triggerWords);
        if (triggerWords) lora.triggerWords = triggerWords;
      }
      return lora;
    });
    const normalizedModel = {id:presetIdentifier(model.id, '모델', true), name:presetText(model.name),
      versionId:presetIdentifier(model.versionId, '모델 버전', true)};
    if (model.family != null) normalizedModel.family = presetText(model.family);
    return {model:normalizedModel, loras};
  }
  function normalizePresetLibrary(value, options = {}) {
    const source = presetObject(value, '프리셋 라이브러리');
    if (source.version !== 1) throw new Error('지원하지 않는 프리셋 라이브러리 버전입니다.');
    const common = presetObject(source.common, '공통 프롬프트');
    function entries(key, build) {
      if (!Array.isArray(source[key])) throw new Error(`${key} 목록 형식을 확인해 주세요.`);
      const seen = new Set();
      return source[key].map(item => {
        presetObject(item, key);
        const id = presetIdentifier(item.id, key);
        if (seen.has(id)) throw new Error(`${key} ID가 중복됐습니다: ${id}`);
        seen.add(id);
        return build(item, id);
      });
    }
    const library = {
      version:1,
      common:{prompt:presetText(common.prompt), negativePrompt:presetText(common.negativePrompt)},
      presets:entries('presets', (item, id) => ({id, name:presetText(item.name), ...validatePresetConfiguration(item, options)})),
      characters:entries('characters', (item, id) => ({id, name:presetText(item.name), prompt:presetText(item.prompt), negativePrompt:presetText(item.negativePrompt)})),
      scenes:entries('scenes', (item, id) => ({id, name:presetText(item.name), prompt:presetText(item.prompt), negativePrompt:presetText(item.negativePrompt)})),
      reservations:entries('reservations', (item, id) => {
        const sourceIds = Object.prototype.hasOwnProperty.call(item, 'sceneIds') ? item.sceneIds : [item.sceneId];
        if (!Array.isArray(sourceIds)) throw new Error('선택한 프롬프트 청크 목록 형식을 확인해 주세요.');
        const sceneIds = sourceIds.map(sceneId => presetIdentifier(sceneId, '프롬프트 청크'));
        if (new Set(sceneIds).size !== sceneIds.length) throw new Error('같은 프롬프트 청크를 중복 선택할 수 없습니다.');
        return {id,
          presetId:presetIdentifier(item.presetId, '설정 프리셋'),
          characterId:presetIdentifier(item.characterId, '캐릭터'), sceneIds,
          count:presetInteger(item.count, '예약 반복 횟수', 1, 100)};
      })
    };
    if (library.reservations.reduce((sum, item) => sum + item.count, 0) > 1000) throw new Error('예약 작업은 한 번에 1,000개까지 만들 수 있습니다.');
    return library;
  }
  function settingsBackupKeys(value, label, required, allowed = required) {
    const source = presetObject(value, label);
    if (required.some(key => !Object.prototype.hasOwnProperty.call(source, key)) || Object.keys(source).some(key => !allowed.includes(key))) {
      throw new Error(`${label}의 필수 항목이나 형식을 확인해 주세요.`);
    }
    return source;
  }
  function normalizeSettingsOptions(value) {
    const source = settingsBackupKeys(value, '대기열 옵션', ['maxCredits','filePrefix','repeat']);
    if (source.maxCredits !== null && (typeof source.maxCredits !== 'number' || !Number.isSafeInteger(source.maxCredits) || source.maxCredits < 1)) {
      throw new Error('크레딧 상한은 양의 정수 또는 제한 없음이어야 합니다.');
    }
    if (typeof source.filePrefix !== 'string') throw new Error('파일 이름은 문자열이어야 합니다.');
    if (typeof source.repeat !== 'number') throw new Error('반복 횟수는 1~100의 정수여야 합니다.');
    return {maxCredits:source.maxCredits, filePrefix:presetText(source.filePrefix), repeat:presetInteger(source.repeat, '반복 횟수', 1, 100)};
  }
  function settingsBackupStrings(value, keys, label) {
    if (keys.some(key => Object.prototype.hasOwnProperty.call(value, key) && typeof value[key] !== 'string')) {
      throw new Error(`${label}은 문자열이어야 합니다.`);
    }
  }
  function settingsBackupLibrary(value) {
    const source = settingsBackupKeys(value, '프리셋 라이브러리', ['version','common','presets','characters','scenes','reservations']);
    settingsBackupKeys(source.common, '공통 프롬프트', ['prompt','negativePrompt']);
    settingsBackupStrings(source.common, ['prompt','negativePrompt'], '공통 프롬프트');
    const library = normalizePresetLibrary(source);
    for (const item of source.presets) {
      settingsBackupKeys(item, '설정 프리셋', ['id','name','model','loras']);
      settingsBackupStrings(item, ['name'], '프리셋 이름');
      settingsBackupKeys(item.model, '모델', ['id','name','versionId'], ['id','name','versionId','family']);
      settingsBackupStrings(item.model, ['name','family'], '모델 이름');
      for (const lora of item.loras) {
        settingsBackupKeys(lora, 'LoRA', ['id','name','weight'], ['id','name','weight','versionId','triggerWords']);
        settingsBackupStrings(lora, ['name','triggerWords'], 'LoRA 이름·트리거');
      }
    }
    for (const key of ['characters','scenes']) for (const item of source[key]) {
      settingsBackupKeys(item, '캐릭터·청크 프롬프트', ['id','name','prompt','negativePrompt']);
      settingsBackupStrings(item, ['name','prompt','negativePrompt'], '캐릭터·청크 프롬프트');
    }
    for (const item of source.reservations) settingsBackupKeys(item, '조합 예약', ['id','presetId','characterId','count'], ['id','presetId','characterId','count','sceneId','sceneIds']);
    return library;
  }
  function settingsBackupMeta(value) {
    const source = settingsBackupKeys(value, '백업 정보', ['appVersion','exportedAt']);
    if (typeof source.appVersion !== 'string' || !source.appVersion.trim()) throw new Error('백업의 스크립트 버전을 확인해 주세요.');
    if (typeof source.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(source.exportedAt)) {
      throw new Error('백업의 저장 시각을 확인해 주세요.');
    }
    const timestamp = Date.parse(source.exportedAt);
    if (!Number.isFinite(timestamp)) throw new Error('백업의 저장 시각을 확인해 주세요.');
    const exportedAt = new Date(timestamp).toISOString();
    const padded = source.exportedAt.replace(/(\.\d{1,3})?Z$/, (_match, fraction) => `${fraction ? fraction.padEnd(4,'0') : '.000'}Z`);
    if (padded !== exportedAt) throw new Error('백업의 저장 시각을 확인해 주세요.');
    return {appVersion:source.appVersion.trim(), exportedAt};
  }
  function makeSettingsBackup(library, options, meta) {
    return {format:'pixai-web-queue-settings', version:1, ...settingsBackupMeta(meta),
      library:settingsBackupLibrary(library), options:normalizeSettingsOptions(options)};
  }
  function parseSettingsBackup(text) {
    if (typeof text !== 'string') throw new Error('설정 파일 내용을 읽을 수 없습니다.');
    const maxBytes = 5 * 1024 * 1024;
    if (text.length > maxBytes || new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('설정 파일은 5MiB 이하만 불러올 수 있습니다.');
    let value, forbiddenKey = false;
    try {
      value = JSON.parse(text.replace(/^\uFEFF/, ''), (key, item) => {
        if (['__proto__','prototype','constructor'].includes(key)) { forbiddenKey = true; throw new Error('허용하지 않는 객체 속성'); }
        return item;
      });
    } catch {
      throw new Error(forbiddenKey ? '설정 파일에 허용하지 않는 객체 속성이 있습니다.' : '설정 파일의 JSON 형식을 확인해 주세요.');
    }
    presetObject(value, '설정 백업');
    if (Object.prototype.hasOwnProperty.call(value, 'format')) {
      if (value.format !== 'pixai-web-queue-settings' || value.version !== 1) throw new Error('지원하지 않는 설정 백업 형식 또는 버전입니다.');
      settingsBackupKeys(value, '설정 백업', ['format','version','appVersion','exportedAt','library','options']);
      return {source:'settings', ...settingsBackupMeta({appVersion:value.appVersion, exportedAt:value.exportedAt}),
        library:settingsBackupLibrary(value.library), options:normalizeSettingsOptions(value.options)};
    }
    if (Object.prototype.hasOwnProperty.call(value, 'library') || Object.prototype.hasOwnProperty.call(value, 'jobs')) {
      settingsBackupKeys(value, '예전 대기열 백업', ['version','jobs','library']);
      if (value.version !== 1 || !Array.isArray(value.jobs)) throw new Error('예전 대기열 백업 형식 또는 버전을 확인해 주세요.');
      return {source:'queue', appVersion:null, exportedAt:null, library:settingsBackupLibrary(value.library), options:null};
    }
    return {source:'library', appVersion:null, exportedAt:null, library:settingsBackupLibrary(value), options:null};
  }
  function composePresetPrompts(common, character, chunksOrLegacyScene, preset = {loras:[]}) {
    const commonPart = presetObject(common, '공통');
    const characterPart = presetObject(character, '캐릭터');
    const chunks = (Array.isArray(chunksOrLegacyScene) ? chunksOrLegacyScene : [chunksOrLegacyScene])
      .map(item => presetObject(item, '프롬프트 청크'));
    const configuration = presetObject(preset, '설정 프리셋');
    if (!Array.isArray(configuration.loras)) throw new Error('LoRA 목록 형식을 확인해 주세요.');
    const triggers = configuration.loras.map(item => {
      presetObject(item, 'LoRA');
      if (!Object.prototype.hasOwnProperty.call(item, 'triggerWords')) return '';
      if (typeof item.triggerWords !== 'string') throw new Error('LoRA 트리거는 문자열이어야 합니다.');
      return presetText(item.triggerWords);
    });
    const promptParts = [commonPart.prompt, ...triggers, characterPart.prompt, ...chunks.map(item => item.prompt)];
    const negativeParts = [commonPart.negativePrompt, characterPart.negativePrompt, ...chunks.map(item => item.negativePrompt)];
    return {
      prompt:promptParts.map(presetText).filter(Boolean).join(', '),
      negativePrompt:negativeParts.map(presetText).filter(Boolean).join(', ')
    };
  }
  function expandPresetReservations(value, options = {}) {
    const library = normalizePresetLibrary(value, options);
    const maxCredits = options.maxCredits == null || options.maxCredits === '' || (typeof options.maxCredits === 'string' && !options.maxCredits.trim())
      ? null : presetInteger(options.maxCredits, '생성 비용 상한', 1, Number.MAX_SAFE_INTEGER);
    const idFactory = options.idFactory ?? (() => globalThis.crypto.randomUUID());
    const prefix = presetText(options.titlePrefix);
    const jobs = [], ids = new Set();
    const copy = item => JSON.parse(JSON.stringify(item));
    for (const reservation of library.reservations) {
      const preset = library.presets.find(item => item.id === reservation.presetId);
      const character = library.characters.find(item => item.id === reservation.characterId);
      if (!preset) throw new Error(`예약 ${reservation.id}의 설정 프리셋이 없습니다.`);
      if (!character) throw new Error(`예약 ${reservation.id}의 캐릭터가 없습니다.`);
      const chunks = reservation.sceneIds.map(sceneId => {
        const chunk = library.scenes.find(item => item.id === sceneId);
        if (!chunk) throw new Error(`예약 ${reservation.id}의 프롬프트 청크가 없습니다: ${sceneId}`);
        return chunk;
      });
      const prompts = composePresetPrompts(library.common, character, chunks, preset);
      if (!prompts.prompt) throw new Error(`예약 ${reservation.id}의 조합 프롬프트가 비어 있습니다.`);
      for (let repeat = 1; repeat <= reservation.count; repeat++) {
        const id = presetIdentifier(idFactory(), '작업');
        if (ids.has(id)) throw new Error('새 작업 ID가 중복됐습니다.');
        ids.add(id);
        jobs.push({id,
          title:[prefix, character.name || '캐릭터', chunks.map(item => item.name || '청크').join('+'), preset.name || '프리셋', repeat].filter(Boolean).join('_'),
          ...prompts, maxCredits, state:'queued', saved:[],
          configuration:copy({model:preset.model, loras:preset.loras}),
          composition:{version:2, reservation:copy({...reservation, repeat}), common:copy(library.common),
            preset:copy(preset), character:copy(character), chunks:copy(chunks)}
        });
      }
    }
    return jobs;
  }

  function parseModelLink(href) {
    const match = String(href || '').match(/^\/(?:[a-z]{2}\/)?model\/(\d+)\/(\d+)\/?(?:\?.*)?$/);
    return match ? {id:match[1],versionId:match[2]} : null;
  }
  function assertConfiguration(expected, actual) {
    const target = validatePresetConfiguration(expected);
    const current = validatePresetConfiguration(actual);
    if (target.model.id !== current.model.id || target.model.versionId !== current.model.versionId) throw new Error('선택된 모델 또는 모델 버전이 프리셋과 다릅니다. 생성하지 않습니다.');
    if (target.loras.length !== current.loras.length || target.loras.some(item => {
      const found = current.loras.find(value => value.id === item.id);
      return !found || (item.versionId && item.versionId !== found.versionId) || Math.abs(item.weight - found.weight) > 0.000001;
    })) throw new Error('선택된 LoRA·버전·수치가 프리셋과 다릅니다. 생성하지 않습니다.');
    return current;
  }
  function assertNumberField(field, value) {
    const number = Number(value), min = field.getAttribute('min'), max = field.getAttribute('max'), step = field.getAttribute('step');
    if (!Number.isFinite(number) || (min != null && number < Number(min)) || (max != null && number > Number(max))) throw new Error(`LoRA 수치는 사이트의 ${min ?? '?'}~${max ?? '?'} 범위 안이어야 합니다.`);
    const increment = Number(step);
    if (step && step !== 'any' && increment > 0 && Math.abs((number - Number(min || 0)) / increment - Math.round((number - Number(min || 0)) / increment)) > 0.000001) throw new Error(`LoRA 수치는 사이트의 ${step} 간격으로 입력해 주세요.`);
  }
  function createSettingsStore(storage, keys) {
    if (!keys || ['library','options','previous'].some(name => typeof keys[name] !== 'string' || !keys[name].trim()) || new Set(Object.values(keys)).size !== 3) {
      throw new Error('설정 저장 키를 확인해 주세요.');
    }
    const validRaw = value => value === null || typeof value === 'string';
    function snapshot() {
      const value = {library:storage.getItem(keys.library), options:storage.getItem(keys.options)};
      if (!validRaw(value.library) || !validRaw(value.options)) throw new Error('현재 설정 저장 형식을 확인해 주세요.');
      return value;
    }
    function previous() {
      const raw = storage.getItem(keys.previous);
      if (raw === null) throw new Error('복원할 이전 설정이 없습니다.');
      let value;
      try { value = JSON.parse(raw); } catch { throw new Error('이전 설정 복구 사본의 형식을 확인해 주세요.'); }
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value,'library') || !Object.hasOwn(value,'options') || !validRaw(value.library) || !validRaw(value.options)) {
        throw new Error('이전 설정 복구 사본의 형식을 확인해 주세요.');
      }
      return value;
    }
    function write(name, raw) {
      if (raw === null) storage.removeItem(keys[name]); else storage.setItem(keys[name], raw);
    }
    function rollback(original) {
      const errors = [];
      for (const name of ['library','options']) {
        try { write(name, original[name]); } catch (error) { errors.push(error); }
      }
      return errors;
    }
    function failure(label, error, rollbackErrors) {
      const restored = !rollbackErrors.length;
      const result = new Error(`${label}에 실패했습니다 [${error.name || 'Error'}]. ${restored ? '원래 설정으로 되돌렸습니다.' : '원본 복원도 실패해 일부 설정이 바뀌었을 수 있습니다. 저장 공간·권한을 확인하고 이전 설정 복원을 다시 시도해 주세요.'} 이전 설정 복구 사본은 보존했습니다.`);
      result.cause = error;
      result.rollbackFailed = !restored;
      return result;
    }
    return {
      apply(parsed) {
        const library = normalizePresetLibrary(parsed?.library);
        const options = parsed?.options === null ? null : normalizeSettingsOptions(parsed?.options);
        const nextLibrary = JSON.stringify(library), nextOptions = options === null ? null : JSON.stringify(options);
        const original = snapshot();
        try { storage.setItem(keys.previous, JSON.stringify(original)); }
        catch (error) { throw new Error(`이전 설정 복구 사본을 저장하지 못했습니다 [${error.name || 'Error'}]. 현재 설정은 바꾸지 않았습니다.`); }
        try {
          if (options !== null) write('options', nextOptions);
          write('library', nextLibrary);
        } catch (error) { throw failure('설정 가져오기', error, rollback(original)); }
        return {library, options};
      },
      undo() {
        const target = previous(), original = snapshot();
        try { write('options', target.options); write('library', target.library); }
        catch (error) { throw failure('이전 설정 복원', error, rollback(original)); }
        return true;
      },
      hasPrevious() {
        try { previous(); return true; } catch { return false; }
      }
    };
  }
  async function readLoraTriggerWords(lora, io = {}) {
    const id=presetIdentifier(lora.id,'LoRA',true), versionId=presetIdentifier(lora.versionId,'LoRA 버전',true);
    const url=`https://pixai.art/en/model/${id}/${versionId}`;
    const controller=new (io.AbortController || AbortController)();
    const timer=(io.setTimeout || setTimeout)(()=>controller.abort(),8000);
    try {
      // Public model-page HTML only. No account cookies, API tokens or generation requests.
      const response=await (io.fetch || fetch)(url,{credentials:'omit',redirect:'error',signal:controller.signal});
      if (!response.ok || response.url !== url || !response.headers.get('content-type')?.includes('text/html')) throw new Error('LoRA 공개 상세 페이지를 읽지 못했습니다.');
      const html=await response.text();
      const doc=io.parseHtml ? io.parseHtml(html) : new DOMParser().parseFromString(html,'text/html');
      const canonicalHref=doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim();
      if (!canonicalHref) throw new Error('LoRA 상세 페이지의 모델 정보를 확인하지 못했습니다.');
      const canonical=new URL(canonicalHref,url);
      if (canonical.origin !== 'https://pixai.art' || !new RegExp(`^/en/model/${id}(?:/${versionId})?/?$`).test(canonical.pathname)) throw new Error('LoRA 상세 페이지의 모델이 다릅니다.');
      const terms=[...doc.querySelectorAll('dt')].filter(e=>e.textContent.trim()==='Trigger Words');
      const value=terms.length === 1 ? terms[0].nextElementSibling : null;
      if (value?.tagName !== 'DD' || value.querySelector('script,style')) throw new Error('LoRA 트리거 항목을 확인하지 못했습니다.');
      const paragraphs=[...value.querySelectorAll('p')];
      return presetText(paragraphs.length ? paragraphs.map(e=>e.textContent.trim()).filter(Boolean).join(', ') : value.textContent);
    } finally { (io.clearTimeout || clearTimeout)(timer); }
  }
  async function capturePresetSettings(adapter, readTriggers) {
    const config=await adapter.capture(), triggerWarnings=[];
    const loras=await Promise.all(config.loras.map(async lora=>{
      try { const triggerWords=await readTriggers(lora); return {...lora,...(triggerWords ? {triggerWords} : {})}; }
      catch { triggerWarnings.push(lora.name || lora.id); return lora; }
    }));
    // Do not mix settings from before and after a user edit while the pages load.
    assertConfiguration(config,await adapter.capture());
    return {...config,loras,triggerWarnings};
  }
  // This adapter only uses visible site controls. It never submits or accesses React state.
  function createPixaiSettingsAdapter(doc, io) {
    const shown = e => {
      if (!e || !e.getClientRects().length) return false;
      for (let current=e; current; current=current.parentElement) {
        if (current.hidden || current.inert || current.getAttribute('aria-hidden') === 'true') return false;
        const style=io.win.getComputedStyle?.(current);
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse')) return false;
      }
      return true;
    };
    const list = (scope, selector) => [...scope.querySelectorAll(selector)];
    const buttons = (scope, text) => list(scope,'button').filter(e => shown(e) && e.textContent.trim() === text);
    const mainButtons = text => list(doc,'main button').filter(e => shown(e) && e.textContent.trim() === text);
    function only(items, label) {
      if (items.length !== 1) throw new Error(`${label}을 하나로 확인할 수 없습니다. PixAI 한국어 새 에디터를 확인해 주세요.`);
      return items[0];
    }
    function click(e) { io.check(); if (!e || e.disabled) throw new Error('설정 버튼을 사용할 수 없습니다.'); io.mutate(() => e.click()); }
    async function waitFor(get, label) {
      for (let count=0; count<100; count++) { io.check(); const result=get(); if (result) return result; await io.sleep(200); }
      throw new Error(`${label} 확인 시간 초과. 생성하지 않았습니다.`);
    }
    function dialog() {
      const found = list(doc,'[role="dialog"]').filter(shown);
      return found.length === 1 ? found[0] : null;
    }
    async function revealModelPanel() {
      const tabs=list(doc,'main [role="tab"]').filter(e=>shown(e)&&['모델','Model'].includes(e.textContent.trim()));
      if (tabs.length === 1 && tabs[0].getAttribute('aria-selected') !== 'true') click(tabs[0]);
      await waitFor(()=>modelLinks().length > 0,'선택 모델 카드');
    }
    function namedVersionLinks(scope) {
      const links=list(scope,'a[href*="/model/"]').filter(e=>shown(e)&&e.textContent.trim()&&parseModelLink(e.getAttribute('href')));
      return [...new Map(links.map(link=>{
        const model=parseModelLink(link.getAttribute('href'));
        return [`${model.id}/${model.versionId}`,link];
      })).values()];
    }
    const selectedCards = section => list(doc,`main [data-section="${section}"] [data-testid="selected-entity-card"]`).filter(shown);
    function loraRows() {
      const rows=selectedCards('styles');
      // LoRA cards do not always expose the shared card test ID. Resolve their
      // number field inside the styles section, never in model/settings/history.
      for (const section of list(doc,'main [data-section="styles"]').filter(shown)) {
        for (const input of list(section,'input[type="number"]').filter(shown)) {
          if (rows.some(row=>row.contains(input))) continue;
          let row=input.parentElement;
          while (row && row!==section && !namedVersionLinks(row).length) row=row.parentElement;
          if (!row || row===section) throw new Error('선택 LoRA 행을 확인할 수 없습니다.');
          rows.push(row);
        }
      }
      return rows.map(row=>{
        const input=only(list(row,'input[type="number"]').filter(shown),'선택 LoRA 가중치 입력창');
        const link=only(namedVersionLinks(row),'선택 LoRA 버전');
        const model=parseModelLink(link?.getAttribute('href'));
        if (!model) throw new Error('선택 LoRA 버전을 확인할 수 없습니다.');
        return {row,input,...model,name:link.textContent.trim(),weight:Number(input.value)};
      });
    }
    function modelLinks() {
      const links=selectedCards('model').flatMap(namedVersionLinks);
      return [...new Map(links.map(link=>{
        const model=parseModelLink(link.getAttribute('href'));
        return [`${model.id}/${model.versionId}`,link];
      })).values()];
    }
    function modelKey() {
      const model=parseModelLink(only(modelLinks(),'현재 모델 버전').getAttribute('href'));
      return `${model.id}/${model.versionId}`;
    }
    function read(allowIncompatible = false) {
      const loras=loraRows(), links=modelLinks();
      const link=only(links,'현재 모델 버전');
      const config=validatePresetConfiguration({model:{...parseModelLink(link.getAttribute('href')),name:link.textContent.trim()},loras:loras.map(({id,versionId,name,weight})=>({id,versionId,name,weight}))});
      if (!allowIncompatible && loras.some(item=>item.row.querySelector('[class*="text-danger"]'))) throw new Error('호환되지 않거나 사용할 수 없는 LoRA가 표시돼 있습니다.');
      return config;
    }
    function fill(input, value) {
      io.check();
      if (input.disabled || input.readOnly) throw new Error('설정 입력창을 사용할 수 없습니다.');
      io.mutate(()=>{
        const proto = input.tagName === 'TEXTAREA' ? io.win.HTMLTextAreaElement.prototype : input.tagName === 'SELECT' ? io.win.HTMLSelectElement.prototype : io.win.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
        if (!setter) throw new Error('사이트 입력값을 적용할 수 없습니다.');
        setter.call(input,String(value));
        input.dispatchEvent(new io.win.Event('input',{bubbles:true}));
        input.dispatchEvent(new io.win.Event('change',{bubbles:true}));
        input.blur();
      });
    }
    function labelById(scope, id, type) {
      return list(scope,'label').filter(label=>shown(label)&&label.querySelector(`input[type="${type}"]`)&&list(label,'a[href*="/model/"]').some(a=>new RegExp(`/model/${id}(?:/|$)`).test(a.getAttribute('href'))));
    }
    async function selectCard(d, item, type) {
      let found=labelById(d,item.id,type);
      if (!found.length) {
        const search=only(list(d,'input[type="search"]'),'모델 검색창');
        fill(search,item.name || item.id);
        found=await waitFor(()=>{const matches=labelById(d,item.id,type);return matches.length?matches:null},`모델 ${item.name || item.id}`);
      }
      const label=only(found,'선택할 모델 카드');
      click(label.querySelector(`input[type="${type}"]`));
      return label.getAttribute('title') || item.name;
    }
    async function applyModel(model) {
      const current=read(true).model;
      if (current.id === model.id && current.versionId === model.versionId) return;
      click(only(mainButtons('전체 모델 보기'),'전체 모델 보기 버튼'));
      const d=await waitFor(dialog,'모델 선택창');
      const selectedName=await selectCard(d,model,'radio');
      await waitFor(()=>buttons(d,'이 모델 사용').length === 1 && (!selectedName || buttons(d,selectedName).length > 0),'모델 상세');
      // Multi-version dialogs expose version IDs as select options; otherwise the
      // site's default version is used and must match the exact saved ID below.
      const versionSelect=list(d,'select').find(select=>list(select,'option').some(o=>o.value === model.versionId));
      if (versionSelect) fill(versionSelect,model.versionId);
      click(only(buttons(d,'이 모델 사용'),'모델 적용 버튼'));
      await waitFor(()=>!dialog(),'모델 선택창 닫힘');
      await waitFor(()=>{try{return read(true).model.id === model.id}catch{return false}},'모델 적용');
      const selected=read(true).model;
      if (selected.versionId !== model.versionId) throw new Error('이 모델의 저장한 버전을 자동 선택하지 못했습니다. 사이트에서 해당 버전을 선택한 뒤 다시 시도해 주세요.');
    }
    async function applyLoras(config) {
      // Removing extras first makes account LoRA slot limits predictable.
      for (const selected of loraRows()) {
        const target=config.loras.find(item=>item.id === selected.id);
        if (!target || (target.versionId && target.versionId !== selected.versionId)) {
          const remove=list(selected.row,'button').filter(e=>shown(e)&&['제거','Remove'].includes(e.getAttribute('aria-label')));
          click(only(remove,'LoRA 제거 버튼'));
          await waitFor(()=>!loraRows().some(item=>item.id === selected.id),'LoRA 제외');
        }
      }
      for (const target of config.loras) {
        if (!loraRows().some(item=>item.id === target.id)) {
          click(only(mainButtons('전체 LoRA 보기'),'전체 LoRA 보기 버튼'));
          const d=await waitFor(dialog,'LoRA 선택창');
          await selectCard(d,target,'checkbox');
          await waitFor(()=>!!d.querySelector(`[id="weight-slider-${target.id}"]`),'LoRA 선택');
          click(only(buttons(d,'확인'),'LoRA 확인 버튼'));
          await waitFor(()=>!dialog(),'LoRA 선택창 닫힘');
          await waitFor(()=>loraRows().some(item=>item.id===target.id),'LoRA 반영');
        }
        const selected=loraRows().find(item=>item.id === target.id);
        if (target.versionId && selected.versionId !== target.versionId) throw new Error(`LoRA ${target.name || target.id}의 저장한 버전을 선택하지 못했습니다. 사이트에서 버전을 선택해 주세요.`);
        assertNumberField(selected.input,target.weight);
        fill(selected.input,target.weight);
        await waitFor(()=>Math.abs(loraRows().find(item=>item.id===target.id)?.weight-target.weight)<0.000001,'LoRA 수치 반영');
      }
    }
    async function capture() {
      io.check();
      if (dialog()) throw new Error('열린 사이트 선택창을 먼저 닫아 주세요.');
      await revealModelPanel();
      return read();
    }
    async function apply(value) {
      const config=validatePresetConfiguration(value);
      if (dialog()) throw new Error('열린 사이트 선택창을 먼저 닫아 주세요.');
      await revealModelPanel();
      try { await applyModel(config.model); await applyLoras(config); return assertConfiguration(config,read()); }
      catch(error) {
        const d=dialog(), close=d?.querySelector('button[aria-label="닫기"]');
        if (close) { try { io.mutate(()=>close.click()); } catch {} }
        throw error;
      }
    }
    function negativeField() { return list(doc,'main textarea[placeholder="여기에 네거티브 프롬프트를 입력하세요"]').filter(shown)[0]; }
    async function captureNegative() {
      let input=negativeField();
      if (!input) {
        const advanced=mainButtons('고급');
        if (advanced.length === 1 && advanced[0].getAttribute('aria-expanded') !== 'true') { click(advanced[0]); await io.sleep(200); }
        input=negativeField();
      }
      return input ? input.value : '';
    }
    async function setNegative(value) {
      await captureNegative();
      const input=negativeField();
      if (!input) { if (normalize(value)) throw new Error('현재 모델에는 네거티브 입력창이 없습니다. 네거티브를 비우거나 지원 모델을 사용해 주세요.'); return; }
      fill(input,value);
      await waitFor(()=>normalize(negativeField()?.value) === normalize(value),'네거티브 반영');
    }
    function verifyNegative(value) {
      const input=negativeField();
      if ((input && normalize(input.value) !== normalize(value)) || (!input && normalize(value))) throw new Error('네거티브 프롬프트가 조합과 다릅니다. 생성하지 않습니다.');
    }
    return {capture,apply,read,modelKey,setNegative,verifyNegative,captureNegative};
  }

function mountPresetEditor(parent, io) {
  const copy = value => JSON.parse(JSON.stringify(value));
  let library = normalizePresetLibrary(io.load() || makePresetLibrary());
  const root = document.createElement('div'); root.className = 'pq-presets';
  function el(tag, text, attrs = {}) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    for (const [name,value] of Object.entries(attrs)) element.setAttribute(name,value);
    return element;
  }
  function action(text, run) {
    const element = io.button(text, run); element.dataset.edit = ''; return element;
  }
  function field(label, tag = 'input', attrs = {}) {
    const input = el(tag,null,{'data-edit':'','aria-label':label,...attrs});
    const wrap = el('label',label); wrap.append(input); return {input,wrap};
  }
  function section(title, open = false) {
    const details = el('details'); details.open = open;
    const body = el('div',null,{class:'pq-preset-body'});
    details.append(el('summary',title),body); root.append(details); return body;
  }
  function selectOptions(select, items, caption, selected, first = false) {
    select.replaceChildren(el('option',caption,{value:''}));
    for (const item of items) select.append(el('option',item.name,{value:item.id}));
    select.value = items.some(item => item.id === selected) ? selected : (first ? items[0]?.id || '' : '');
  }
  async function commit(next, message) {
    const normalized = normalizePresetLibrary(next);
    await io.save(copy(normalized)); library = normalized;
    refreshLists(); renderReservations(); preview();
    if (message) io.notify(message);
  }
  function nameValue(input) {
    const value = input.value.trim();
    if (!value) throw new Error('저장할 이름을 입력해 주세요.');
    return value;
  }
  function repeatValue(input) {
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('생성 횟수는 1~100의 정수로 입력해 주세요.');
    return value;
  }
  root.append(el('style', '.pq-presets details{border-top:1px solid #4c4355;margin-top:8px}.pq-presets summary{padding:8px 0;cursor:pointer;font-weight:600}.pq-presets .pq-preset-body{padding-bottom:7px}.pq-presets label{display:block;margin:6px 0;font-size:13px}.pq-presets select{display:block;width:100%;padding:8px;border:1px solid #595063;border-radius:7px;background:#15121b;color:inherit;font:inherit}.pq-presets textarea{min-height:68px}.pq-presets .pq-lora,.pq-presets .pq-reservation{border:1px solid #4c4355;border-radius:8px;padding:8px;margin:6px 0}.pq-presets .pq-inline{display:flex;gap:7px}.pq-presets .pq-inline>*{flex:1;min-width:0}.pq-presets .pq-reservation label{max-width:130px}.pq-presets .pq-preview{white-space:pre-wrap;overflow-wrap:anywhere;max-height:125px;overflow:auto;border-left:2px solid #756488;padding-left:8px;margin:8px 0;color:#d9cbe5}.pq-presets button{font-size:13px}'));
  root.append(el('style','#local-pixai-queue .pq-chunk-list{max-height:210px;overflow:auto;border:1px solid #4c4355;border-radius:8px;margin:6px 0}#local-pixai-queue .pq-chunk-option{display:flex;align-items:flex-start;gap:8px;margin:0;padding:8px;cursor:pointer;border-bottom:1px solid #4c4355}#local-pixai-queue .pq-chunk-option:last-child{border-bottom:0}#local-pixai-queue .pq-chunk-option input[type="checkbox"]{width:auto;flex:0 0 auto;margin:3px 0;padding:0;accent-color:#b799d4}#local-pixai-queue .pq-chunk-option>span{min-width:0;flex:1}#local-pixai-queue .pq-chunk-option small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}'));
  root.append(el('small','공통문·캐릭터·청크를 따로 저장하고 조합을 예약합니다. 대기열에 등록한 작업은 이후 편집의 영향을 받지 않습니다.'));

  const commonBody = section('① 공통 프롬프트');
  const commonPrompt = field('공통 프롬프트','textarea');
  const commonNegative = field('공통 네거티브','textarea');
  commonPrompt.input.value = library.common.prompt || '';
  commonNegative.input.value = library.common.negativePrompt || '';
  commonBody.append(commonPrompt.wrap,commonNegative.wrap,action('공통문 저장',async () => {
    const next = copy(library);
    next.common = {prompt:commonPrompt.input.value.trim(),negativePrompt:commonNegative.input.value.trim()};
    await commit(next,'공통 프롬프트를 저장했습니다.');
  }));

  const presetBody = section('② 모델 · LoRA 프리셋');
  const presetSelect = field('저장한 설정 프리셋','select');
  const presetName = field('프리셋 이름');
  const modelId = field('모델 ID');
  const modelVersionId = field('모델 버전 ID','input',{inputmode:'numeric'});
  const modelName = field('모델 이름');
  const modelFamily = field('모델 계열 (선택)');
  const loraList = el('div');
  let loraRows = [];
  function addLora(value = {}) {
    const row = el('div',null,{class:'pq-lora'});
    const id = field('LoRA ID'); id.input.value = value.id || '';
    const versionId = field('LoRA 버전 ID (선택)','input',{inputmode:'numeric'}); versionId.input.value = value.versionId || '';
    const name = field('LoRA 이름'); name.input.value = value.name || '';
    const weight = field('LoRA 가중치','input',{type:'number',step:'0.1'});
    weight.input.value = value.weight ?? 1;
    const triggerWords = field('LoRA 트리거 키워드','textarea',{placeholder:'예: character_name, special_outfit'});
    triggerWords.input.value = value.triggerWords || '';
    const controls = {row,id:id.input,versionId:versionId.input,name:name.input,weight:weight.input,triggerWords:triggerWords.input};
    loraRows.push(controls);
    const identity=el('details');identity.append(el('summary','LoRA ID 직접 편집'),id.wrap,versionId.wrap);
    row.append(name.wrap,weight.wrap,triggerWords.wrap,el('small','설정 읽기에서 공개 트리거를 자동으로 채웁니다. 직접 수정하거나 비워도 됩니다. 저장한 문구가 조합에 붙습니다.'),identity,action('이 LoRA 제외',() => {
      row.remove(); loraRows = loraRows.filter(item => item !== controls);
    }));
    loraList.append(row);
  }
  function fillPreset(value) {
    presetName.input.value = value?.name || '';
    modelId.input.value = value?.model?.id || '';
    modelVersionId.input.value = value?.model?.versionId || '';
    modelName.input.value = value?.model?.name || '';
    modelFamily.input.value = value?.model?.family || '';
    loraList.replaceChildren(); loraRows = [];
    for (const lora of value?.loras || []) addLora(lora);
  }
  function readPreset() {
    const id = modelId.input.value.trim();
    if (!id) throw new Error('사이트에서 모델을 선택해 읽어오거나 모델 ID를 입력해 주세요.');
    const versionId = modelVersionId.input.value.trim();
    if (!/^\d+$/.test(versionId)) throw new Error('모델 버전 ID를 숫자로 입력해 주세요. 사이트에서 선택한 설정을 읽어오면 함께 채웁니다.');
    const loras = loraRows.map(item => {
      const loraId = item.id.value.trim();
      const loraVersionId = item.versionId.value.trim();
      const weight = Number(item.weight.value);
      if (!loraId || !item.weight.value.trim() || !Number.isFinite(weight)) throw new Error('각 LoRA의 ID와 숫자 가중치를 입력해 주세요.');
      if (loraVersionId && !/^\d+$/.test(loraVersionId)) throw new Error('LoRA 버전 ID는 숫자로 입력하거나 비워 주세요.');
      const triggerWords = item.triggerWords.value.trim();
      return {id:loraId,...(loraVersionId ? {versionId:loraVersionId} : {}),name:item.name.value.trim(),weight,...(triggerWords ? {triggerWords} : {})};
    });
    if (new Set(loras.map(lora => lora.id)).size !== loras.length) throw new Error('같은 LoRA를 두 번 넣을 수 없습니다.');
    const family = modelFamily.input.value.trim();
    return {model:{id,versionId,name:modelName.input.value.trim(),...(family ? {family} : {})},loras};
  }
  presetSelect.input.addEventListener('change',() => fillPreset(library.presets.find(item => item.id === presetSelect.input.value)));
  const modelIdentity=el('details');modelIdentity.append(el('summary','모델 ID 직접 편집'),modelId.wrap,modelVersionId.wrap,modelFamily.wrap);
  presetBody.append(presetSelect.wrap,presetName.wrap,
    el('small','PixAI 화면에서 모델·LoRA를 선택한 뒤 읽어오세요. 읽어오기와 설정 확인은 이미지를 생성하지 않습니다.'),
    action('사이트의 현재 설정 읽기',async () => {
      io.notify('현재 모델·LoRA와 공개 트리거를 읽는 중…');
      const triggers = loraRows.map(item=>({id:item.id.value.trim(),versionId:item.versionId.value.trim(),triggerWords:item.triggerWords.value}));
      const settings = await io.captureSettings();
      let autoFilled=0;
      fillPreset({...settings,name:presetName.input.value,loras:settings.loras.map(lora=>{
        const previous=triggers.find(item=>item.id===lora.id&&(!item.versionId||item.versionId===lora.versionId));
        if (previous?.triggerWords.trim()) return {...lora,triggerWords:previous.triggerWords};
        if (lora.triggerWords) autoFilled++;
        return {...lora,triggerWords:lora.triggerWords || ''};
      })});
      const warning=settings.triggerWarnings?.length ? `\n트리거 자동 읽기 실패: ${settings.triggerWarnings.join(', ')}. 기존 입력은 유지했습니다. 필요하면 직접 입력해 주세요.` : '';
      io.notify(`${settings.model.name || settings.model.id} · LoRA ${settings.loras.length}개를 읽었습니다. 트리거 ${autoFilled}개 자동 입력. 이름을 붙이고 저장해 주세요.${warning}`);
    }),modelName.wrap,modelIdentity,loraList,action('LoRA 추가',() => addLora()));
  if (io.applySettings) presetBody.append(action('화면에 설정 적용 · 생성 안 함',async () => {
    await io.applySettings(readPreset()); io.notify('프리셋을 화면에 적용했습니다. 이미지는 생성하지 않았습니다.');
  }));
  presetBody.append(action('프리셋 저장',async () => {
    const value = {...readPreset(),id:presetSelect.input.value || crypto.randomUUID(),name:nameValue(presetName.input)};
    const next = copy(library); const index = next.presets.findIndex(item => item.id === value.id);
    if (index < 0) next.presets.push(value); else next.presets[index] = value;
    await commit(next,'모델·LoRA 프리셋을 저장했습니다.');
    presetSelect.input.value = value.id;
  }),action('새 프리셋',() => {presetSelect.input.value = '';fillPreset(null);}),action('선택 프리셋 삭제',async () => {
    const id = presetSelect.input.value;
    if (!id) throw new Error('삭제할 저장 프리셋을 선택해 주세요.');
    const next = copy(library); next.presets = next.presets.filter(item => item.id !== id);
    await commit(next,'프리셋을 삭제했습니다. 이미 등록한 대기열은 유지됩니다. 예약은 다른 프리셋으로 다시 추가해 주세요.');
    fillPreset(null);
  }));

  function promptEditor(key, title, label, placeholder) {
    const body = section(title);
    const select = field(`저장한 ${label}`,'select');
    const name = field(`${label} 이름`);
    const prompt = field(`${label} 프롬프트`,'textarea',{placeholder});
    const negative = field(`${label} 네거티브`,'textarea');
    function fill(value) {
      name.input.value = value?.name || '';
      prompt.input.value = value?.prompt || '';
      negative.input.value = value?.negativePrompt || '';
    }
    select.input.addEventListener('change',() => fill(library[key].find(item => item.id === select.input.value)));
    body.append(select.wrap,name.wrap,prompt.wrap,negative.wrap,action(`${label} 저장`,async () => {
      const value = {id:select.input.value || crypto.randomUUID(),name:nameValue(name.input),prompt:prompt.input.value.trim(),negativePrompt:negative.input.value.trim()};
      if (!value.prompt && !value.negativePrompt) throw new Error(`${label} 프롬프트나 네거티브를 입력해 주세요.`);
      const next = copy(library); const index = next[key].findIndex(item => item.id === value.id);
      if (index < 0) next[key].push(value); else next[key][index] = value;
      await commit(next,`${label} 프롬프트를 저장했습니다.`); select.input.value = value.id;
    }),action(`새 ${label}`,() => {select.input.value = '';fill(null);}),action(`선택 ${label} 삭제`,async () => {
      const id = select.input.value;
      if (!id) throw new Error(`삭제할 ${label}을 선택해 주세요.`);
      const next = copy(library); next[key] = next[key].filter(item => item.id !== id);
      await commit(next,`${label}을 삭제했습니다. 이미 등록한 대기열은 유지됩니다.`); fill(null);
    }));
    return {key,select:select.input,label,fill};
  }
  const characterEditor = promptEditor('characters','③ 캐릭터 프롬프트','캐릭터','외모, 의상, 캐릭터 고유 특징');
  const chunkEditor = promptEditor('scenes','④ 프롬프트 청크','청크','표정, 행동, 구도, 배경 등 함께 쓸 프롬프트 조각');
  const reserveBody = section('⑤ 조합 예약',true);
  const reservePreset = field('예약 프리셋','select');
  const reserveCharacter = field('예약 캐릭터','select');
  const chunkList = el('div',null,{class:'pq-chunk-list','aria-label':'예약 청크 목록'});
  const chunkCount = el('small');
  let selectedChunkIds = new Set();
  const reserveCount = field('이 조합의 생성 횟수','input',{type:'number',min:'1',max:'100',value:'1'});
  const combined = el('div',null,{class:'pq-preview','aria-label':'저장한 프롬프트 조합 미리보기'});
  const reservations = el('div');
  function preview() {
    const preset = library.presets.find(item => item.id === reservePreset.input.value);
    const character = library.characters.find(item => item.id === reserveCharacter.input.value);
    const chunks = library.scenes.filter(item => selectedChunkIds.has(item.id));
    const {prompt,negativePrompt} = composePresetPrompts(library.common,character || {},chunks,preset || {loras:[]});
    chunkCount.textContent = `청크 ${chunks.length}개 선택 · 목록 순서로 한 프롬프트에 합칩니다.`;
    combined.textContent = `전송 프롬프트\n${prompt || '(비어 있음)'}${negativePrompt ? `\n\n네거티브\n${negativePrompt}` : ''}`;
  }
  for (const select of [reservePreset.input,reserveCharacter.input]) select.addEventListener('change',preview);
  function renderChunkChoices() {
    selectedChunkIds = new Set(library.scenes.filter(item=>selectedChunkIds.has(item.id)).map(item=>item.id));
    chunkList.replaceChildren();
    if (!library.scenes.length) chunkList.append(el('small','④에서 청크를 저장해 주세요. 청크 없이 예약할 수도 있습니다.'));
    for (const chunk of library.scenes) {
      const checkbox = el('input',null,{type:'checkbox','data-edit':'','aria-label':`청크 선택: ${chunk.name}`});
      checkbox.checked = selectedChunkIds.has(chunk.id);
      checkbox.addEventListener('change',()=>{
        if (checkbox.checked) selectedChunkIds.add(chunk.id); else selectedChunkIds.delete(chunk.id);
        preview();
      });
      const name = el('span',chunk.name);
      name.append(el('small',chunk.prompt || `네거티브: ${chunk.negativePrompt}`));
      const label = el('label',null,{class:'pq-chunk-option'}); label.append(checkbox,name);
      chunkList.append(label);
    }
  }
  function refreshLists() {
    selectOptions(presetSelect.input,library.presets,'새 프리셋',presetSelect.input.value);
    for (const editor of [characterEditor,chunkEditor]) selectOptions(editor.select,library[editor.key],`새 ${editor.label}`,editor.select.value);
    selectOptions(reservePreset.input,library.presets,'프리셋을 저장해 주세요',reservePreset.input.value,true);
    selectOptions(reserveCharacter.input,library.characters,'캐릭터를 저장해 주세요',reserveCharacter.input.value,true);
    renderChunkChoices();
  }
  function renderReservations() {
    reservations.replaceChildren();
    if (!library.reservations.length) reservations.append(el('small','저장한 프리셋·캐릭터를 고르고 사용할 청크를 체크해 조합을 추가하세요.'));
    for (const reservation of library.reservations) {
      const row = el('div',null,{class:'pq-reservation'});
      const preset = library.presets.find(item => item.id === reservation.presetId);
      const character = library.characters.find(item => item.id === reservation.characterId);
      const chunkNames = reservation.sceneIds.map(id=>library.scenes.find(item=>item.id===id)?.name || '(삭제된 청크)');
      row.append(el('strong',`${character?.name || '(삭제된 캐릭터)'} · ${chunkNames.join(' + ') || '청크 없음'}`),
        el('small',`${preset?.name || '(삭제된 프리셋)'} · ${reservation.count}회`),action('이 예약 제외',async () => {
          const next = copy(library); next.reservations = next.reservations.filter(item => item.id !== reservation.id);
          await commit(next,'선택한 예약을 제외했습니다. 이미 등록한 대기열은 유지됩니다.');
        }));
      reservations.append(row);
    }
  }
  reserveBody.append(reservePreset.wrap,reserveCharacter.wrap,el('strong','함께 쓸 청크'),chunkList,chunkCount,reserveCount.wrap,combined,
    action('이 조합 예약 추가',async () => {
      const presetId = reservePreset.input.value, characterId = reserveCharacter.input.value;
      const sceneIds = library.scenes.filter(item=>selectedChunkIds.has(item.id)).map(item=>item.id);
      if (!library.presets.some(item => item.id === presetId) || !library.characters.some(item => item.id === characterId)) throw new Error('저장한 프리셋·캐릭터를 모두 선택해 주세요.');
      const next = copy(library);
      next.reservations.push({id:crypto.randomUUID(),presetId,characterId,sceneIds,count:repeatValue(reserveCount.input)});
      await commit(next,'선택한 조합을 예약했습니다. 아래 등록 버튼으로 대기열에 넣어 주세요.');
    }),reservations,action('예약 전부를 대기열에 등록',async () => {
      if (!library.reservations.length) throw new Error('조합 예약을 먼저 추가해 주세요.');
      await io.enqueue(copy(library));
    }));
  refreshLists(); renderReservations(); preview(); parent.append(root);
  return {
    root,
    refresh:() => {library = normalizePresetLibrary(io.load() || makePresetLibrary());refreshLists();renderReservations();preview();},
    reload:() => {
      const next=normalizePresetLibrary(io.load() || makePresetLibrary());
      library=next;selectedChunkIds=new Set();
      refreshLists();
      commonPrompt.input.value=library.common.prompt;commonNegative.input.value=library.common.negativePrompt;
      fillPreset(library.presets.find(item=>item.id===presetSelect.input.value));
      for (const editor of [characterEditor,chunkEditor]) editor.fill(library[editor.key].find(item=>item.id===editor.select.value));
      reserveCount.input.value='1';renderReservations();preview();
    }
  };
}

  const core = {makePresetLibrary, validatePresetConfiguration, normalizePresetLibrary, normalizeSettingsOptions, makeSettingsBackup, parseSettingsBackup, createSettingsStore, composePresetPrompts, expandPresetReservations, parseModelLink, assertConfiguration, assertNumberField, readLoraTriggerWords, capturePresetSettings, createPixaiSettingsAdapter, mountPresetEditor, normalize, safeName, recover, verifyTask, outputIds, processJob, checkCost, clampPosition, bindPanelDrag, acceptFolder, folderError, bindFolderActivation, pickDirectory, storageSupport, downloadError, managedDownload, resetDownloadProgress};
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }
  if (window.top !== window.self || location.hostname !== 'pixai.art') return;
  const KEY = 'local.pixai-web-queue.v1';
  const LIBRARY_KEY = 'local.pixai-web-queue.presets.v1';
  const OPTIONS_KEY = 'local.pixai-web-queue.options.v1';
  const PREVIOUS_SETTINGS_KEY = 'local.pixai-web-queue.before-import.v1';
  const LOCK = 'local.pixai-web-queue.runner.v1';
  const LABELS = {queued:'대기', submitting:'제출 중', waiting:'완료 확인', saving:'저장 중', save_failed:'저장 재시도 필요', done:'저장 완료', unknown:'제출 결과 확인 필요', skipped:'건너뜀'};
  let jobs = [];
  let folder = null;
  let folderToken = null;
  let running = false;
  let starting = false;
  let stopRequested = false;
  let internalAction = false;
  let initialModel = null;
  let settingsBusy = false;
  let presetEditor;
  let panel;
  let choosingFolder = false;
  const download = typeof GM_download === 'function' ? GM_download : null;
  const storage = storageSupport(window, download, typeof GM_info === 'object' ? GM_info : null);
  let downloadsReady = false;
  let message = storage.message;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const visible = element => element && element.getClientRects().length > 0;
  const onGenerator = () => /^\/(?:[a-z]{2}\/)?generator\/image\/?$/.test(location.pathname);
  const taskIds = () => new Set(all('main [data-task-id]').map(element => element.dataset.taskId));
  const taskCard = id => all('main [data-testid="mobile-task-card"]').find(element => element.dataset.taskId === id);
  const modelId = () => settings.modelKey();
  const settings = createPixaiSettingsAdapter(document, {
    win:window, sleep,
    check:() => { if (!onGenerator()) throw new Error('PixAI 한국어 새 이미지 생성 화면에서 실행해 주세요.'); if ((running || starting || settingsBusy) && stopRequested) throw new Error('설정 적용이 중지됐습니다.'); },
    mutate:action => { internalAction=true; try {return action();} finally {internalAction=false;} }
  });
  function readLibrary() { return normalizePresetLibrary(JSON.parse(localStorage.getItem(LIBRARY_KEY) || JSON.stringify(makePresetLibrary()))); }
  function saveLibrary(value) { localStorage.setItem(LIBRARY_KEY,JSON.stringify(normalizePresetLibrary(value))); }
  async function settingsAction(action, {readOnly = false} = {}) {
    if (running || starting || settingsBusy) throw new Error('실행 중인 작업이 끝난 뒤 설정을 편집해 주세요.');
    settingsBusy=true; stopRequested=false; render();
    try { return await (readOnly ? action() : locked(action)); } finally {settingsBusy=false;render();}
  }
  function load() {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{"version":1,"jobs":[]}');
    if (stored.version !== 1 || !Array.isArray(stored.jobs)) throw new Error('대기열 형식이 맞지 않습니다.');
    jobs = recover(stored.jobs);
  }
  function persist() {
    localStorage.setItem(KEY, JSON.stringify({version:1, jobs}));
    render();
  }
  async function locked(action) {
    if (!navigator.locks) throw new Error('이 브라우저는 중복 실행 방지 기능을 지원하지 않습니다.');
    return navigator.locks.request(LOCK, {ifAvailable:true}, async lock => {
      if (!lock) throw new Error('다른 PixAI 탭에서 대기열이 실행 중입니다.');
      load();
      return action();
    });
  }
  async function request(operation, query, variables) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`https://api.pixai.art/graphql?operation=${operation}`, {
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operationName:operation, query, variables}), signal:controller.signal
      });
      if (!response.ok) throw new Error(`조회 실패 (${response.status}). 로그인을 확인해 주세요.`);
      const value = await response.json();
      if (value.errors?.length || !value.data) throw new Error('PixAI 조회 형식이 달라졌거나 접근할 수 없습니다.');
      return value.data;
    } finally { clearTimeout(timeout); }
  }
  async function getTask(id) {
    const data = await request('getTaskById', 'query getTaskById($id: ID!) { task(id: $id) { id status createdAt parameters outputs mediaId } }', {id});
    if (!data.task) throw new Error('작업을 찾을 수 없습니다.');
    return data.task;
  }
  function groupName(element) {
    return element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id=>document.getElementById(id)?.textContent || '').join(' ');
  }
  function editor() {
    const found = all('main .tiptap[contenteditable="true"]').filter(visible);
    if (found.length !== 1) throw new Error('새 에디터의 프롬프트 입력창을 찾을 수 없습니다.');
    return found[0];
  }
  function generateButton() {
    const found = all('main button[data-react-aria-pressable]').filter(element => visible(element) && element.textContent.includes('Ctrl+') && element.textContent.includes('작업 제출'));
    if (found.length !== 1 || found[0].disabled || found[0].getAttribute('aria-disabled') === 'true') {
      throw new Error('생성 버튼을 확정할 수 없습니다.');
    }
    return found[0];
  }
  function expectedCount() {
    const group = all('main [role="group"]').find(element => groupName(element).trim() === '이미지 수');
    const radio = group?.querySelector('[role="radio"][aria-checked="true"], input[type="radio"]:checked');
    const text = radio?.getAttribute('aria-label') || radio?.textContent;
    if (/x4|×4/.test(text || '')) return 4;
    if (/단일|single/i.test(text || '')) return 1;
    throw new Error('이미지 수 선택을 확인할 수 없습니다. 한국어 새 에디터에서 실행해 주세요.');
  }
  async function ensureDestination() {
    if (!storage.supported) throw new Error(storage.message);
    if (storage.mode === 'download') {
      if (!downloadsReady) throw new Error('먼저 자동 다운로드 준비 확인을 완료해 주세요.');
    } else if (!folder || await folder.queryPermission({mode:'readwrite'}) !== 'granted') {
      throw new Error('저장 폴더를 다시 선택하고 쓰기 권한을 허용해 주세요.');
    }
  }
  async function prepare(job) {
    if (stopRequested) throw new Error('다음 작업 제출이 중지됐습니다.');
    if (!onGenerator()) throw new Error('이미지 생성 화면에서 실행해 주세요.');
    const configuration = job.configuration;
    if (!configuration && modelId() !== initialModel) throw new Error('실행 중 모델이 변경됐습니다.');
    await ensureDestination();
    if (configuration) {
      message=`설정 적용 중: ${job.title}`;render();
      await settings.apply(configuration);
      await settings.setNegative(job.negativePrompt);
    }
    if (stopRequested) throw new Error('프롬프트 입력 전 중지됐습니다.');
    const input = editor();
    internalAction = true;
    try {
      input.focus();
      const range = document.createRange();
      range.selectNodeContents(input);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand('insertText', false, job.prompt)) throw new Error('프롬프트 입력에 실패했습니다.');
      input.dispatchEvent(new Event('input', {bubbles:true}));
    } finally { internalAction = false; }
    await sleep(700);
    if (normalize(input.innerText) !== normalize(job.prompt)) throw new Error('프롬프트 입력값이 일치하지 않습니다.');
    if (generateButton().dataset.promptInputMissing === 'true') throw new Error('사이트가 프롬프트를 인식하지 못했습니다.');
    if (configuration) { assertConfiguration(configuration,settings.read()); settings.verifyNegative(job.negativePrompt); }
    return {expected:expectedCount(), estimatedCost:checkCost(generateButton().textContent, job.maxCredits), ...(configuration ? {appliedConfiguration:configuration,appliedNegativePrompt:job.negativePrompt} : {})};
  }
  async function submit(job) {
    const before = taskIds();
    internalAction = true;
    try {
      let button;
      try {
        if (stopRequested) throw new Error('제출 직전 중지됐습니다. 이미지를 생성하지 않았습니다.');
        button = generateButton();
        if (!onGenerator()) throw new Error('생성 화면을 벗어났습니다.');
        if (normalize(editor().innerText) !== normalize(job.prompt)) throw new Error('제출 직전 프롬프트가 변경됐습니다.');
        if (job.appliedConfiguration) { assertConfiguration(job.appliedConfiguration,settings.read()); settings.verifyNegative(job.appliedNegativePrompt); }
        else if (modelId() !== initialModel) throw new Error('제출 직전 모델이 변경됐습니다.');
        if (expectedCount() !== job.expected) throw new Error('제출 직전 이미지 수가 변경됐습니다.');
        checkCost(button.textContent, job.maxCredits);
      } catch(error) {error.notSubmitted=true;throw error;}
      button.click();
    } finally { internalAction = false; }
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const added = [...taskIds()].filter(id => !before.has(id));
      if (added.length === 1) return added[0];
      if (added.length > 1) throw new Error('여러 새 작업이 나타나 제출 결과를 확정할 수 없습니다.');
      if (!onGenerator()) throw new Error('생성 화면을 벗어났습니다. 제출 결과를 직접 확인해 주세요.');
      await sleep(500);
    }
    throw new Error('90초 안에 작업 ID를 확인하지 못했습니다. 자동 재제출하지 않습니다.');
  }
  async function waitTask(job) {
    const deadline = Date.now() + 60 * 60 * 1000;
    while (Date.now() < deadline) {
      const task = await getTask(job.taskId);
      verifyTask(job, task);
      const status = String(task.status).toLowerCase();
      if (['completed','succeeded','success','done'].includes(status)) return task;
      if (!['waiting','running','pending','processing','queued'].includes(status)) {
        throw new Error(`생성 상태: ${status}. 해당 작업을 사이트에서 확인해 주세요.`);
      }
      if (stopRequested) throw new Error('대기열 중지됨. 서버 작업은 유지되며 같은 ID로 다시 확인합니다.');
      await sleep(5000);
    }
    throw new Error('완료 확인 시간 초과. 같은 작업 ID로 재개할 수 있습니다.');
  }
  async function imageBlob(mediaId) {
    const data = await request('getMedia', 'query getMedia($id: ID!) { media(id: $id) { id fileUrl } }', {id:mediaId});
    if (String(data.media?.id) !== mediaId || !data.media.fileUrl) throw new Error('원본 이미지 URL을 확인하지 못했습니다.');
    const url = new URL(data.media.fileUrl);
    if (url.protocol !== 'https:' || !(url.hostname === 'pixai.art' || url.hostname.endsWith('.pixai.art'))) {
      throw new Error('예상하지 못한 원본 이미지 호스트입니다.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(url.href, {credentials:'omit', signal:controller.signal});
      if (!response.ok) throw new Error(`이미지 다운로드 실패 (${response.status})`);
      const blob = await response.blob();
      if (!['image/png','image/jpeg','image/webp'].includes(blob.type) || blob.size === 0) throw new Error('다운로드한 파일이 지원 이미지가 아닙니다.');
      return blob;
    } finally { clearTimeout(timeout); }
  }
  async function writeNew(name, data) {
    if (storage.mode === 'download') {
      if (!storage.supported) throw new Error(storage.message);
      const blob = data instanceof Blob ? data : new Blob([data],{type:'application/json'});
      return managedDownload(download, blob, name);
    }
    // Never replace an existing filename, including a file left by an interrupted save.
    for (let suffix = 0; suffix < 10000; suffix++) {
      const candidate = suffix ? name.replace(/(\.[^.]+)$/, `_${suffix}$1`) : name;
      try { await folder.getFileHandle(candidate); continue; }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
      const handle = await folder.getFileHandle(candidate, {create:true});
      const writable = await handle.createWritable();
      try { await writable.write(data); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch {} throw error; }
      const actual = await handle.getFile();
      const bytes = data instanceof Blob ? data.size : new TextEncoder().encode(data).length;
      if (actual.size !== bytes) throw new Error('저장된 파일 크기가 일치하지 않습니다.');
      return candidate;
    }
    throw new Error('저장 파일명 충돌이 너무 많습니다.');
  }
  const io = {
    persist, prepare, submit, waitTask,
    async saveImage(job, mediaId, index) {
      await ensureDestination();
      job.folderToken = folderToken;
      persist(); // Bind saved progress to this folder even if remembering the handle failed.
      const blob = await imageBlob(mediaId);
      const extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[blob.type];
      return writeNew(`${safeName(job.title)}_${job.taskId}_${index+1}_${mediaId}.${extension}`, blob);
    },
    async saveMetadata(job) {
      if (job.metadataFile) return;
      job.metadataFile = await writeNew(`${safeName(job.title)}_${job.taskId}.json`, JSON.stringify({
        taskId:job.taskId, title:job.title, prompt:job.prompt, negativePrompt:job.appliedNegativePrompt ?? null, configuration:job.appliedConfiguration ?? null, composition:job.composition ?? null, images:job.saved, savedAt:new Date().toISOString(),
        storage:{mode:storage.mode, fileNames:storage.mode === 'download' ? 'requested; browser may rename on collisions' : 'actual'},
        previousDownloads:job.previousDownloads || []
      }, null, 2));
    }
  };
  async function start() {
    if (running || starting) return;
    if (settingsBusy) throw new Error('모델·LoRA 설정 확인이 끝난 뒤 시작해 주세요.');
    if (choosingFolder) throw new Error(storage.mode === 'download' ? '확인 파일 다운로드가 끝난 뒤 시작해 주세요.' : '폴더 선택창을 먼저 닫거나 선택을 완료해 주세요.');
    starting=true; stopRequested=false; render();
    try {
    await ensureDestination();
    if (stopRequested) throw new Error('시작 준비가 중지됐습니다. 이미지를 생성하지 않았습니다.');
    if (!onGenerator()) throw new Error('이미지 생성 화면에서 실행해 주세요.');
    await locked(async () => {
      await ensureDestination();
      if (!jobs.some(job => !['done','skipped'].includes(job.state))) throw new Error('대기열이 비어 있습니다. 프롬프트를 입력하고 대기열 추가를 눌러 주세요.');
      if (storage.mode === 'folder' && jobs.some(job => job.saved?.length && !['done','skipped'].includes(job.state) && job.folderToken !== folderToken)) {
        throw new Error('부분 저장 작업의 폴더를 다시 선택해 확인해 주세요.');
      }
      initialModel = modelId();
      if (!initialModel) throw new Error('선택된 모델을 확인하지 못했습니다.');
      if (jobs.some(job=>job.configuration && job.state==='queued') && jobs.some(job=>!job.configuration && job.state==='queued')) {
        const baseline=await settings.capture(), negative=await settings.captureNegative();
        for (const job of jobs.filter(item=>!item.configuration && item.state==='queued')) Object.assign(job, {
          configuration:JSON.parse(JSON.stringify(baseline)),negativePrompt:negative,settingsOrigin:'legacy-at-first-mixed-start'
        });
        persist(); // Legacy settings must survive stop/reload after a preset has run.
      }
      if (storage.mode === 'download') resetDownloadProgress(jobs);
      if (stopRequested) throw new Error('시작 준비가 중지됐습니다. 이미지를 생성하지 않았습니다.');
      running = true;
      starting = false;
      try {
        persist();
        for (const job of jobs) {
          if (job.state === 'done' || job.state === 'skipped') continue;
          if (stopRequested) break;
          await processJob(job, io);
        }
        message = stopRequested ? '중지됨. 완료된 파일은 보존했습니다.' : '대기열 작업과 저장이 끝났습니다.';
      } finally { running = false; render(); }
    });
    } finally {starting=false;render();}
  }
  function node(tag, text, attrs = {}) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    for (const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
    return element;
  }
  function button(text, action) {
    const element = node('button', text, {type:'button'});
    bindFolderActivation(element, () => element, () => {
      message = `입력 확인: ${text}`;
      if (panel) {
        panel.querySelector('[data-action-message]')?.remove();
        element.after(node('div',message,{'data-action-message':''}));
        panel.querySelector('[data-message]').textContent = message;
      }
      return action();
    }, error => { message = error.message; render(); });
    return element;
  }
  function render() {
    if (!panel) return;
    const launcher=panel.querySelector('[data-launcher]');
    if (launcher) launcher.title=`클릭해 PixAI 대기열 열기 · 드래그해 이동 · ${running ? '실행 중' : starting ? '시작 준비 중' : settingsBusy ? '설정 확인 중' : '대기'}\n${message}`;
    panel.querySelector('[data-message]').textContent = message;
    const feedback=panel.querySelector('[data-action-message]');
    if (feedback) feedback.textContent=message;
    panel.querySelector('[data-folder]').textContent = storage.mode === 'download'
      ? `자동 다운로드 · ${downloadsReady ? '준비 확인 완료' : '준비 확인 필요'} · 브라우저 설정 폴더`
      : (folder ? `저장 폴더: ${folder.name}` : '저장 폴더 미선택');
    const list = panel.querySelector('[data-jobs]');
    list.replaceChildren();
    for (const job of jobs) {
      const row = node('div', null, {class:'pq-job'});
      row.append(node('strong', job.title), node('span', `${LABELS[job.state]}${job.expected ? ` · ${job.saved?.length || 0}/${job.expected}` : ''}`));
      if (job.error) row.append(node('small', job.error));
      if (job.taskId) row.append(node('small', `작업 ${job.taskId}`));
      if (job.state === 'unknown') row.append(button('사이트 확인 후 작업 ID 연결', async () => {
        const id = window.prompt('사이트에서 해당 작업 ID를 확인하고 입력해 주세요. 새 생성은 하지 않습니다.');
        if (!id || !/^\d+$/.test(id)) return;
        await locked(async () => {
          const target = jobs.find(item => item.id === job.id);
          const task = await getTask(id);
          verifyTask({...target, taskId:id}, task);
          target.taskId = id; target.state = 'waiting'; target.error = ''; persist();
        });
      }));
      if (!['done','skipped'].includes(job.state)) row.append(button('건너뛰기', async () => {
        await locked(() => { const target = jobs.find(item => item.id === job.id); target.state = 'skipped'; persist(); });
      }));
      list.append(row);
    }
    for (const element of panel.querySelectorAll('[data-edit], [data-start]')) element.disabled = running || starting || settingsBusy;
    const choose = panel.querySelector('[data-choose-folder]');
    choose.disabled = running || starting || settingsBusy || choosingFolder;
    choose.textContent = storage.mode === 'download'
      ? (choosingFolder ? '확인 파일 다운로드 중…' : '자동 다운로드 준비 확인')
      : (choosingFolder ? '폴더 선택 중…' : '저장 폴더 선택');
    panel.querySelector('[data-start]').textContent = running ? '실행 중' : starting ? '시작 준비 중…' : '시작 / 같은 작업 재개';
    // Keep idle Start clickable so its preflight can explain missing setup.
    panel.querySelector('[data-start]').title = !storage.supported ? storage.message
      : (storage.mode === 'download' && !downloadsReady ? '자동 다운로드 준비 확인을 먼저 완료해 주세요.' : '저장 준비와 대기열을 확인한 뒤 실행합니다.');
  }
  function mount() {
    if (panel || document.getElementById('local-pixai-queue') || !document.body) return;
    panel = node('aside', null, {id:'local-pixai-queue'});
    const style = node('style', `#local-pixai-queue{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:340px;max-height:80vh;overflow:auto;padding:16px;border:1px solid #5b536c;border-radius:14px;background:#211d2b;color:#f4effa;font:14px/1.5 system-ui;box-shadow:0 12px 40px #0006}#local-pixai-queue *{box-sizing:border-box}#local-pixai-queue h2{margin:0 0 8px;font-size:17px}#local-pixai-queue input,#local-pixai-queue textarea{width:100%;margin:5px 0;padding:8px;border:1px solid #595063;border-radius:7px;background:#15121b;color:inherit;font:inherit}#local-pixai-queue textarea{min-height:85px;resize:vertical}#local-pixai-queue button{margin:4px 4px 4px 0;padding:7px 10px;border:1px solid #706080;border-radius:7px;background:#413250;color:inherit;cursor:pointer}#local-pixai-queue button:disabled{opacity:.45;cursor:default}#local-pixai-queue small{display:block;color:#cfc1dc}#local-pixai-queue .pq-job{border-top:1px solid #4c4355;padding:8px 0}#local-pixai-queue .pq-job span{display:block;color:#c7b3df}#local-pixai-queue [data-jobs]{max-height:230px;overflow:auto}#local-pixai-queue [data-message]{white-space:pre-wrap;color:#ddd0ec;margin:8px 0}`);
    const dragHandle = node('h2','PixAI 대기열 · 0.3.3 후보', {'data-drag-handle':'',title:'이 제목줄을 드래그해서 이동'});
    style.textContent += '#local-pixai-queue{box-sizing:border-box;width:min(340px,calc(100vw - 16px));pointer-events:auto}#local-pixai-queue button{pointer-events:auto}#local-pixai-queue [data-drag-handle]{margin:0;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:grab;user-select:none;touch-action:none}#local-pixai-queue [data-drag-handle][data-dragging]{cursor:grabbing}';
    style.textContent += '#local-pixai-queue [data-header]{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;height:32px;margin-bottom:8px;background:#211d2b}#local-pixai-queue [data-collapse]{width:32px;height:32px;flex:none;margin:0;padding:6px;line-height:0}#local-pixai-queue [data-message]{position:sticky;top:40px;z-index:1;max-height:100px;overflow:auto;padding:7px 9px;border:1px solid #5b536c;border-radius:7px;background:#211d2b}#local-pixai-queue [data-action-message]{white-space:pre-wrap;margin:4px 0 10px;padding:7px 9px;border-left:3px solid #b799d4;background:#30263d;color:#f4effa}';
    style.textContent += '#local-pixai-queue [data-launcher]{display:none;width:52px;height:52px;margin:0;padding:12px;border:1px solid #8c72a7;border-radius:50%;line-height:0;background:#413250;touch-action:none;user-select:none}#local-pixai-queue [data-launcher][data-dragging]{cursor:grabbing}#local-pixai-queue [data-launcher]:focus-visible,#local-pixai-queue [data-collapse]:focus-visible{outline:2px solid #e2c7ff;outline-offset:3px}#local-pixai-queue[data-minimized="true"]{width:52px;height:52px;max-height:none;padding:0;border:0;border-radius:50%;overflow:visible}#local-pixai-queue[data-minimized="true"]>:not([data-launcher]){display:none!important}#local-pixai-queue[data-minimized="true"]>[data-launcher]{display:block}';
    function iconControl(label, attribute, path) {
      const control=node('button',null,{type:'button','aria-label':label,title:label,[attribute]:'','aria-controls':'local-pixai-queue'});
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'100%',height:'100%',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(key,value);
      const drawing=document.createElementNS('http://www.w3.org/2000/svg','path');drawing.setAttribute('d',path);svg.append(drawing);control.append(svg);return control;
    }
    const collapse=iconControl('대기열 접기','data-collapse','M5 12h14');
    const launcher=iconControl('PixAI 대기열 열기','data-launcher','M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M7 16l4-5 3 3 2-2 2 4 M8 8h.01');
    const header=node('div',null,{'data-header':''});header.append(dragHandle,collapse);
    let expandedScrollTop=0;
    function minimize(value, remember=true, focus=true) {
      if (value) expandedScrollTop=panel.scrollTop;
      panel.dataset.minimized=String(value);
      collapse.setAttribute('aria-expanded',String(!value));launcher.setAttribute('aria-expanded',String(!value));
      if (remember) {try {localStorage.setItem('local.pixai-web-queue.minimized.v1',JSON.stringify(value));} catch { /* Folding does not depend on storage access. */ }}
      if (focus) (value ? launcher : collapse).focus({preventScroll:true});
      if (!value) panel.scrollTop=expandedScrollTop;
    }
    // View-only controls stay enabled during generation and never replace its status.
    bindFolderActivation(collapse,()=>collapse,()=>minimize(true),()=>{});
    let minimized=false;
    try {minimized=JSON.parse(localStorage.getItem('local.pixai-web-queue.minimized.v1')||'false')===true;} catch { /* Ignore malformed or unavailable view preferences. */ }
    minimize(minimized,false,false);
    panel.append(style,launcher,header, node('div',message,{'data-message':'','role':'status','aria-live':'polite'}), node('small','제목줄을 드래그해서 이동 · 조합별 모델·LoRA를 적용합니다. 해상도·이미지 수 등은 사이트 설정을 확인하세요.'));
    panel.append(node('div','저장 폴더 미선택',{'data-folder':''}));
    const choose = button('저장 폴더 선택', chooseFolder);
    choose.dataset.chooseFolder = '';
    choose.dataset.edit = '';
    panel.append(choose);
    const title = node('input',null,{placeholder:'파일 이름 / 작업 이름', 'data-edit':'', 'aria-label':'대기열 작업 이름'});
    const prompts = node('textarea',null,{placeholder:'프롬프트 입력\n여러 작업은 한 줄 --- 로 구분', 'data-edit':'', 'aria-label':'대기열 프롬프트'});
    const repeat = node('input',null,{type:'number',min:'1',max:'100',value:'1','data-edit':'', 'aria-label':'각 프롬프트 반복 횟수'});
    const simple=node('details');simple.append(node('summary','통짜 프롬프트 · 간단 대기열'),title,prompts,node('small','반복 횟수 (생성 버튼을 누르는 횟수)'),repeat);
    const budget = node('input',null,{type:'number',min:'1',value:'7800','data-edit':'','aria-label':'생성 1회 크레딧 상한'});
    panel.append(node('small','생성 1회 크레딧 상한 (빈칸은 제한 없음)'),budget);
    function readOptions() {
      return normalizeSettingsOptions({maxCredits:budget.value.trim() ? Number(budget.value) : null,filePrefix:title.value,repeat:Number(repeat.value)});
    }
    function fillOptions(value) {
      budget.value=value.maxCredits == null ? '' : String(value.maxCredits);
      title.value=value.filePrefix;repeat.value=String(value.repeat);
    }
    function loadOptions() {
      fillOptions(normalizeSettingsOptions(JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{"maxCredits":7800,"filePrefix":"","repeat":1}')));
    }
    try {loadOptions();} catch {message='기본 옵션을 읽지 못했습니다. 설정 불러오기로 복구하거나 입력값을 확인해 주세요.';}
    for (const input of [budget,title,repeat]) input.addEventListener('change',()=>{
      try {localStorage.setItem(OPTIONS_KEY,JSON.stringify(readOptions()));}
      catch(error) {message=`기본 옵션 저장 실패: ${error.message}`;render();}
    });
    const add = button('대기열 추가', async () => locked(() => {
      const parts = prompts.value.split(/\n\s*---+\s*\n/).map(normalize).filter(Boolean);
      const count = Number(repeat.value);
      const maxCredits = budget.value.trim() ? Number(budget.value) : null;
      if (!parts.length || !Number.isInteger(count) || count < 1 || count > 100) throw new Error('프롬프트와 1~100회 반복 횟수를 입력해 주세요.');
      if (maxCredits != null && (!Number.isSafeInteger(maxCredits) || maxCredits < 1)) throw new Error('크레딧 상한은 양의 정수로 입력해 주세요.');
      if (jobs.length + parts.length * count > 1000) throw new Error('대기열은 최대 1,000개까지 추가할 수 있습니다.');
      const added = [];
      for (let index=0; index<parts.length; index++) for (let n=0; n<count; n++) added.push({
        id:crypto.randomUUID(), title:`${title.value.trim() || 'PixAI'}_${index+1}_${n+1}`, prompt:parts[index], maxCredits, state:'queued', saved:[]
      });
      jobs.push(...added); persist(); prompts.value=''; message=`${added.length}개 작업을 추가했습니다.`; render();
    }));
    add.dataset.edit='';
    const run = button('시작 / 같은 작업 재개', start); run.dataset.start='';
    simple.append(add);
    const editorSlot=node('div');panel.append(editorSlot);
    function mountEditor() { try { presetEditor=mountPresetEditor(editorSlot, {
      load:readLibrary,save:saveLibrary,button,
      notify:text=>{message=text;render();},
      captureSettings:()=>settingsAction(()=>capturePresetSettings(settings,readLoraTriggerWords),{readOnly:true}),
      applySettings:value=>settingsAction(()=>settings.apply(value)),
      enqueue:value=>locked(()=>{
        const added=expandPresetReservations(value,{maxCredits:budget.value.trim()||null,titlePrefix:title.value.trim()});
        if (jobs.length+added.length>1000) throw new Error('대기열은 최대 1,000개까지 추가할 수 있습니다.');
        if (value.reservations.some(res=>jobs.some(job=>job.composition?.reservation?.id===res.id))) throw new Error('이미 등록된 예약이 있습니다. 해당 예약을 제외하고 새로 예약해 주세요.');
        jobs.push(...added);persist();
        saveLibrary({...value,reservations:[]});presetEditor.refresh();
        message=`조합 ${added.length}개를 대기열에 등록했습니다. 예약은 비웠고 작업별 설정은 보존했습니다.`;render();
      })
    }); } catch(error) { message=`프리셋 라이브러리 읽기 실패: ${error.message}`; } }
    mountEditor();
    panel.append(simple,run,button('중지',()=>{stopRequested=true;message='다음 제출 중지 요청. 진행 중인 서버 작업은 취소하지 않습니다.';render();}));
    panel.append(node('div',null,{'data-jobs':''}));
    const exportQueue = button('대기열 백업', async () => {
      const blob = new Blob([JSON.stringify({version:1,jobs,library:readLibrary()},null,2)],{type:'application/json'});
      if (storage.mode === 'download') { await writeNew('pixai-queue-backup.json',blob);message='대기열 백업 다운로드 완료';render();return; }
      const url = URL.createObjectURL(blob); const anchor=node('a',null,{href:url,download:'pixai-queue-backup.json'});
      anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
    });
    panel.append(exportQueue);
    const backups=node('details');backups.append(node('summary','설정 내보내기 · 불러오기'));
    backups.append(node('small','저장한 공통문·프리셋·캐릭터·청크·예약과 크레딧 상한·파일 이름·반복 횟수를 JSON으로 보관합니다. 편집한 항목은 먼저 저장해 주세요.'));
    const settingsStore=createSettingsStore(localStorage,{library:LIBRARY_KEY,options:OPTIONS_KEY,previous:PREVIOUS_SETTINGS_KEY});
    function idleSettings() {
      if (running || starting || settingsBusy || choosingFolder) throw new Error('진행 중인 작업이 끝난 뒤 설정을 불러오거나 내보내 주세요.');
    }
    function backupButton(label,run) {const control=button(label,()=>{idleSettings();return run();});control.dataset.edit='';return control;}
    const saveSettings=backupButton('설정 내보내기',async()=>{
      const data=makeSettingsBackup(readLibrary(),readOptions(),{appVersion:'0.3.3',exportedAt:new Date().toISOString()});
      const text=JSON.stringify(data,null,2);parseSettingsBackup(text);
      const name=`PixAI_설정_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
      const blob=new Blob([text],{type:'application/json'});
      if (download) {await managedDownload(download,blob,name);message='설정 JSON 다운로드 완료';}
      else {
        const url=URL.createObjectURL(blob),anchor=node('a',null,{href:url,download:name});
        document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
        message='설정 JSON 다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해 주세요.';
      }
      render();
    });
    const input=node('input',null,{type:'file',accept:'.json,application/json','aria-label':'설정 백업 JSON 파일','data-edit':''});input.hidden=true;
    const preview=node('div',null,{'data-import-preview':'','aria-live':'polite'});preview.hidden=true;
    let pendingSettings=null;
    function clearImport() {pendingSettings=null;preview.replaceChildren();preview.hidden=true;}
    const openSettings=backupButton('설정 불러오기',()=>{clearImport();input.value='';input.click();});
    async function editSettings(action) {
      await settingsAction(async()=>{
        if (!navigator.locks) throw new Error('이 브라우저는 중복 실행 방지 기능을 지원하지 않습니다.');
        await navigator.locks.request(LOCK,{ifAvailable:true},async lock=>{
          if (!lock) throw new Error('다른 PixAI 탭에서 대기열이 실행 중입니다.');
          if (stopRequested) throw new Error('설정 불러오기가 중지됐습니다.');
          action();
          loadOptions();
          if (presetEditor) presetEditor.reload();else mountEditor();
        });
      },{readOnly:true});
      clearImport();
    }
    const applyImport=backupButton('이 설정으로 교체',async()=>{
      if (!pendingSettings) throw new Error('설정 파일을 먼저 선택해 주세요.');
      await editSettings(()=>{
        if (localStorage.getItem(LIBRARY_KEY)!==pendingSettings.libraryBefore || localStorage.getItem(OPTIONS_KEY)!==pendingSettings.optionsBefore) throw new Error('파일을 선택한 뒤 설정이 바뀌었습니다. 파일을 다시 선택해 주세요.');
        settingsStore.apply(pendingSettings.data);
      });
      message='설정을 불러왔습니다. 가져오기 전 설정 복구로 되돌릴 수 있습니다. 이미 등록한 대기열은 유지됩니다.';render();
    });
    input.addEventListener('change',async()=>{
      clearImport();
      const file=input.files?.[0];if (!file) return;
      try {
        idleSettings();
        await settingsAction(async()=>{
          if (file.size>5*1024*1024) throw new Error('설정 파일은 5MiB까지 불러올 수 있습니다.');
          const data=parseSettingsBackup(await file.text());
          if (stopRequested) throw new Error('설정 파일 읽기가 중지됐습니다.');
          pendingSettings={data,libraryBefore:localStorage.getItem(LIBRARY_KEY),optionsBefore:localStorage.getItem(OPTIONS_KEY)};
          const library=data.library;
          preview.append(node('strong',file.name),node('p',`프리셋 ${library.presets.length}개 · 캐릭터 ${library.characters.length}개 · 청크 ${library.scenes.length}개 · 예약 ${library.reservations.length}개`),
            node('small','적용하면 현재 저장한 항목과 편집 중인 내용이 교체됩니다. 적용 전 설정은 이 브라우저에 보관합니다. 생성 작업·저장 폴더 권한은 가져오지 않습니다.'),
            node('small',data.options ? `크레딧 상한 ${data.options.maxCredits ?? '제한 없음'} · 반복 ${data.options.repeat}회` : '이전 백업 형식: 현재 크레딧 상한·파일 이름·반복 횟수를 유지합니다.'),applyImport,
            backupButton('불러오기 취소',()=>{clearImport();message='설정 불러오기를 취소했습니다.';render();}));
          preview.hidden=false;message='파일 확인 완료. 내용을 확인한 뒤 이 설정으로 교체를 누르세요.';
        },{readOnly:true});
      } catch(error) {clearImport();message=`설정 파일 읽기 실패: ${error.message}`;render();}
    });
    const undoSettings=backupButton('가져오기 전 설정 복구',async()=>{
      await editSettings(()=>{
        const previous=JSON.parse(localStorage.getItem(PREVIOUS_SETTINGS_KEY) || 'null');
        try {
          if (previous?.library != null) normalizePresetLibrary(JSON.parse(previous.library));
          if (previous?.options != null) normalizeSettingsOptions(JSON.parse(previous.options));
        } catch {throw new Error('이전 설정 원본에 읽기 오류가 있어 복구하지 않았습니다. 원본 사본과 현재 설정은 유지했습니다.');}
        settingsStore.undo();
      });message='가져오기 전 설정으로 복구했습니다.';render();
    });
    backups.append(saveSettings,openSettings,input,preview,undoSettings);panel.append(backups);
    document.body.append(panel);
    try { load(); } catch(error) { message=`대기열 읽기 실패: ${error.message}\n프리셋 읽기·편집은 사용할 수 있습니다. 대기열 원본은 유지했습니다.`; }
    render();
    bindPanelDrag(panel, dragHandle, {
      launcher, open:() => minimize(false),
      viewport:() => ({width:window.innerWidth,height:window.innerHeight}),
      load:() => JSON.parse(localStorage.getItem('local.pixai-web-queue.position.v1') || 'null'),
      save:position => localStorage.setItem('local.pixai-web-queue.position.v1', JSON.stringify(position)),
      onResize:action => {
        window.addEventListener('resize', action);
        new ResizeObserver(action).observe(panel);
      }
    });
  }
  async function chooseFolder() {
    if (choosingFolder || running || starting || settingsBusy) return;
    if (!storage.supported) { message = storage.message; render(); return; }
    choosingFolder = true;
    const choose = panel.querySelector('[data-choose-folder]');
    choose.disabled = true; choose.textContent = storage.mode === 'download' ? '확인 파일 다운로드 중…' : '폴더 선택 중…';
    const notify = text => { message = text; render(); };
    try {
      if (storage.mode === 'download') {
        downloadsReady = false;
        notify('확인 파일 다운로드 중 · 파일이 저장되기 전에는 생성하지 않습니다.');
        await locked(async () => {
          const name = `PixAI_다운로드확인_${Date.now()}.json`;
          await writeNew(name, JSON.stringify({app:'PixAI 웹 대기열', version:'0.3.3', probe:true}));
          downloadsReady = true; folderToken = `download:${crypto.randomUUID()}`;
          message = `자동 다운로드 준비 확인 완료: ${name}\n이 파일이 저장된 위치를 확인해 주세요. 이후 다운로드는 브라우저 설정 폴더를 따릅니다. 실행 중 저장 위치를 변경하지 마세요. 부분 저장 재개 시 같은 작업의 원본 전부를 추가 사본으로 저장합니다.`;
          render();
        });
        return;
      }
      const chosen = await pickDirectory(window, notify);
      await locked(async () => {
        const partial = jobs.filter(job => job.saved?.length && !['done','skipped'].includes(job.state));
        let previous = folder ? {handle:folder,token:folderToken} : await folderRecord().catch(() => null);
        if (previous?.kind === 'directory') previous = {handle:previous,token:null}; // 0.1.1 record
        if (partial.some(job => job.folderToken && job.folderToken !== previous?.token)) previous = null;
        const token = partial.length && previous?.token ? previous.token : crypto.randomUUID();
        const warning = await acceptFolder(chosen, {
          partial:partial.length > 0, previous:previous?.handle,
          remember:() => folderRecord({handle:chosen,token})
        });
        folder = chosen; folderToken = token;
        for (const job of partial) job.folderToken = token;
        message = warning || `저장 폴더 선택 완료: ${chosen.name}`;
        persist();
      });
    } catch (error) { message = folderError(error); }
    finally { choosingFolder = false; render(); }
  }
  // Pausing precedes any manual edit. No synthetic event is treated as permission.
  for (const type of ['click','keydown','beforeinput']) document.addEventListener(type,event=>{
    if (!(running || starting) || internalAction || panel?.contains(event.target) || !event.isTrusted) return;
    if (onGenerator()) {
      stopRequested=true; event.preventDefault(); event.stopImmediatePropagation();
      message='실행 중 사이트 조작으로 중지했습니다. 같은 작업은 재개할 수 있습니다.'; render();
    }
  },true);
  window.addEventListener('storage', event=>{
    if (event.key===LIBRARY_KEY && !running && !starting && !settingsBusy) { try {presetEditor?.refresh();} catch {message='프리셋 라이브러리 읽기 실패';render();} }
    if (event.key===KEY && !running && !starting && !settingsBusy) { try {load();render();} catch {message='대기열 읽기 실패';render();} }
  });
  window.addEventListener('beforeunload',event=>{if(running || starting){event.preventDefault();event.returnValue='';}});
  async function folderRecord(value) {
    const db = await new Promise((resolve,reject)=>{
      const open=indexedDB.open('local.pixai-web-queue.folder',1);
      let abandoned=false;
      const timeout=setTimeout(()=>{abandoned=true;reject(new Error('저장 폴더 기록 응답 시간 초과'))},5000);
      open.onupgradeneeded=()=>open.result.createObjectStore('folder');
      open.onsuccess=()=>{clearTimeout(timeout);if(abandoned){open.result.close();return}resolve(open.result)};
      open.onerror=()=>{clearTimeout(timeout);reject(open.error || new Error('저장 폴더 기록을 열 수 없습니다.'))};
      open.onblocked=()=>{clearTimeout(timeout);abandoned=true;reject(new Error('다른 탭이 저장 폴더 기록을 잠그고 있습니다.'))};
    });
    try {
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction('folder',value?'readwrite':'readonly');
        const request=value?tx.objectStore('folder').put(value,'selected'):tx.objectStore('folder').get('selected');
        const timeout=setTimeout(()=>{tx.abort();},5000);
        let result;request.onsuccess=()=>{result=request.result};
        tx.oncomplete=()=>{clearTimeout(timeout);resolve(result)};
        tx.onerror=tx.onabort=()=>{clearTimeout(timeout);reject(tx.error || new Error('저장 폴더 기록에 실패했습니다.'))};
      });
    } finally {db.close();}
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
