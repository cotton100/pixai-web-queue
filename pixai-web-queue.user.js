// ==UserScript==
// @name         PixAI 웹 대기열 (로컬 후보)
// @namespace    local.pixai-web-queue
// @version      0.1.3
// @homepageURL  https://github.com/cotton100/pixai-web-queue
// @updateURL    https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js
// @downloadURL  https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js
// @description  로그인된 새 이미지 에디터에서 프롬프트를 순차 생성하고 선택한 폴더에 원본을 저장합니다.
// @match        https://pixai.art/*
// @grant        none
// @run-at       document-idle
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
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || drag) return;
      const rect = target.getBoundingClientRect();
      drag = {id:event.pointerId, x:event.clientX - rect.left, y:event.clientY - rect.top};
      place({x:rect.left,y:rect.top});
      handle.setPointerCapture(event.pointerId);
      handle.dataset.dragging = '';
      event.preventDefault(); event.stopPropagation();
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      place({x:event.clientX - drag.x, y:event.clientY - drag.y});
      event.preventDefault(); event.stopPropagation();
    });
    const finish = event => {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
      delete handle.dataset.dragging;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      remember();
    };
    for (const type of ['pointerup','pointercancel','lostpointercapture']) handle.addEventListener(type, finish);
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
        job.state = job.taskId ? 'waiting' : 'unknown';
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

  const core = {normalize, safeName, recover, verifyTask, outputIds, processJob, checkCost, clampPosition, bindPanelDrag, acceptFolder, folderError};
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }
  if (window.top !== window.self || location.hostname !== 'pixai.art') return;
  const KEY = 'local.pixai-web-queue.v1';
  const LOCK = 'local.pixai-web-queue.runner.v1';
  const LABELS = {queued:'대기', submitting:'제출 중', waiting:'완료 확인', saving:'저장 중', save_failed:'저장 재시도 필요', done:'저장 완료', unknown:'제출 결과 확인 필요', skipped:'건너뜀'};
  let jobs = [];
  let folder = null;
  let folderToken = null;
  let running = false;
  let stopRequested = false;
  let internalAction = false;
  let initialModel = null;
  let panel;
  let message = 'Chrome/Edge · 새 이미지 에디터 · 공통 설정 사용';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const visible = element => element && element.getClientRects().length > 0;
  const onGenerator = () => /^\/(?:[a-z]{2}\/)?generator\/image\/?$/.test(location.pathname);
  const taskIds = () => new Set(all('main [data-task-id]').map(element => element.dataset.taskId));
  const taskCard = id => all('main [data-testid="mobile-task-card"]').find(element => element.dataset.taskId === id);
  const modelId = () => all('main a[href*="/model/"]').find(element => visible(element) && element.textContent.trim())?.getAttribute('href');
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
  async function prepare(job) {
    if (stopRequested) throw new Error('다음 작업 제출이 중지됐습니다.');
    if (!onGenerator()) throw new Error('이미지 생성 화면에서 실행해 주세요.');
    if (modelId() !== initialModel) throw new Error('실행 중 모델이 변경됐습니다.');
    if (await folder.queryPermission({mode:'readwrite'}) !== 'granted') throw new Error('저장 폴더 권한이 필요합니다.');
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
    return {expected:expectedCount(), estimatedCost:checkCost(generateButton().textContent, job.maxCredits)};
  }
  async function submit(job) {
    if (stopRequested) throw new Error('제출 직전 중지됐습니다. 제출되지 않았는지 직접 확인해 주세요.');
    const before = taskIds();
    internalAction = true;
    try {
      const button = generateButton();
      checkCost(button.textContent, job.maxCredits);
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
      if (await folder.queryPermission({mode:'readwrite'}) !== 'granted') throw new Error('폴더 쓰기 권한이 없습니다.');
      job.folderToken = folderToken;
      persist(); // Bind saved progress to this folder even if remembering the handle failed.
      const blob = await imageBlob(mediaId);
      const extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[blob.type];
      return writeNew(`${safeName(job.title)}_${job.taskId}_${index+1}_${mediaId}.${extension}`, blob);
    },
    async saveMetadata(job) {
      if (job.metadataFile) return;
      job.metadataFile = await writeNew(`${safeName(job.title)}_${job.taskId}.json`, JSON.stringify({
        taskId:job.taskId, title:job.title, prompt:job.prompt, images:job.saved, savedAt:new Date().toISOString()
      }, null, 2));
    }
  };
  async function start() {
    if (running) return;
    if (!folder) throw new Error('먼저 저장 폴더를 선택해 주세요.');
    if (!onGenerator()) throw new Error('이미지 생성 화면에서 실행해 주세요.');
    await locked(async () => {
      if (await folder.queryPermission({mode:'readwrite'}) !== 'granted') throw new Error('저장 폴더를 다시 선택해 주세요.');
      if (jobs.some(job => job.saved?.length && !['done','skipped'].includes(job.state) && job.folderToken !== folderToken)) {
        throw new Error('부분 저장 작업의 폴더를 다시 선택해 확인해 주세요.');
      }
      initialModel = modelId();
      if (!initialModel) throw new Error('선택된 모델을 확인하지 못했습니다.');
      running = true;
      stopRequested = false;
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
  }
  function node(tag, text, attrs = {}) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    for (const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
    return element;
  }
  function button(text, action) {
    const element = node('button', text, {type:'button'});
    element.addEventListener('click', async () => {
      try { await action(); } catch (error) { message = error.message; render(); }
    });
    return element;
  }
  function render() {
    if (!panel) return;
    panel.querySelector('[data-message]').textContent = message;
    panel.querySelector('[data-folder]').textContent = folder ? `저장 폴더: ${folder.name}` : '저장 폴더 미선택';
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
    for (const element of panel.querySelectorAll('[data-edit], [data-start]')) element.disabled = running;
    panel.querySelector('[data-start]').textContent = running ? '실행 중' : '시작 / 같은 작업 재개';
  }
  function mount() {
    if (panel || document.getElementById('local-pixai-queue') || !document.body) return;
    panel = node('aside', null, {id:'local-pixai-queue'});
    const style = node('style', `#local-pixai-queue{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:340px;max-height:80vh;overflow:auto;padding:16px;border:1px solid #5b536c;border-radius:14px;background:#211d2b;color:#f4effa;font:14px/1.5 system-ui;box-shadow:0 12px 40px #0006}#local-pixai-queue *{box-sizing:border-box}#local-pixai-queue h2{margin:0 0 8px;font-size:17px}#local-pixai-queue input,#local-pixai-queue textarea{width:100%;margin:5px 0;padding:8px;border:1px solid #595063;border-radius:7px;background:#15121b;color:inherit;font:inherit}#local-pixai-queue textarea{min-height:85px;resize:vertical}#local-pixai-queue button{margin:4px 4px 4px 0;padding:7px 10px;border:1px solid #706080;border-radius:7px;background:#413250;color:inherit;cursor:pointer}#local-pixai-queue button:disabled{opacity:.45;cursor:default}#local-pixai-queue small{display:block;color:#cfc1dc}#local-pixai-queue .pq-job{border-top:1px solid #4c4355;padding:8px 0}#local-pixai-queue .pq-job span{display:block;color:#c7b3df}#local-pixai-queue [data-jobs]{max-height:230px;overflow:auto}#local-pixai-queue [data-message]{white-space:pre-wrap;color:#ddd0ec;margin:8px 0}`);
    const dragHandle = node('h2','PixAI 대기열 · 0.1.3 후보', {'data-drag-handle':'',title:'이 제목줄을 드래그해서 이동'});
    style.textContent += '#local-pixai-queue{box-sizing:border-box;width:min(340px,calc(100vw - 16px))}#local-pixai-queue [data-drag-handle]{position:sticky;top:0;background:#211d2b;cursor:grab;user-select:none;touch-action:none}#local-pixai-queue [data-drag-handle][data-dragging]{cursor:grabbing}';
    panel.append(style, dragHandle, node('small','제목줄을 드래그해서 이동 · 모델·LoRA·해상도는 실행할 때의 화면 설정을 공통 사용합니다. 실행 중에는 사이트를 조작하지 마세요.'));
    panel.append(node('div','저장 폴더 미선택',{'data-folder':''}));
    const choose = button('저장 폴더 선택', async () => {
      try {
        if (typeof window.showDirectoryPicker !== 'function') throw new Error('이 브라우저 또는 스크립트 실행 환경에서 폴더 선택 API를 사용할 수 없습니다. 데스크톱 Chrome/Edge의 일반 PixAI 탭에서 확인해 주세요.');
        // Invoke directly in the click handler, BEFORE storage or lock awaits.
        const chosen = await window.showDirectoryPicker({id:'pixai-queue', mode:'readwrite'});
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
      } catch (error) { message = folderError(error); render(); }
    });
    choose.dataset.edit = '';
    panel.append(choose);
    const title = node('input',null,{placeholder:'파일 이름 / 작업 이름', 'data-edit':'', 'aria-label':'대기열 작업 이름'});
    const prompts = node('textarea',null,{placeholder:'프롬프트 입력\n여러 작업은 한 줄 --- 로 구분', 'data-edit':'', 'aria-label':'대기열 프롬프트'});
    const repeat = node('input',null,{type:'number',min:'1',max:'100',value:'1','data-edit':'', 'aria-label':'각 프롬프트 반복 횟수'});
    panel.append(title,prompts,node('small','반복 횟수 (생성 버튼을 누르는 횟수)'),repeat);
    const budget = node('input',null,{type:'number',min:'1',value:'7800','data-edit':'','aria-label':'생성 1회 크레딧 상한'});
    panel.append(node('small','생성 1회 크레딧 상한 (빈칸은 제한 없음)'),budget);
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
    panel.append(add,run,button('중지',()=>{stopRequested=true;message='다음 제출 중지 요청. 진행 중인 서버 작업은 취소하지 않습니다.';render();}));
    panel.append(node('div',message,{'data-message':''}), node('div',null,{'data-jobs':''}));
    const exportQueue = button('대기열 백업', async () => {
      const blob = new Blob([JSON.stringify({version:1,jobs},null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob); const anchor=node('a',null,{href:url,download:'pixai-queue-backup.json'});
      anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
    });
    panel.append(exportQueue);
    document.body.append(panel);
    load(); render();
    bindPanelDrag(panel, dragHandle, {
      viewport:() => ({width:window.innerWidth,height:window.innerHeight}),
      load:() => JSON.parse(localStorage.getItem('local.pixai-web-queue.position.v1') || 'null'),
      save:position => localStorage.setItem('local.pixai-web-queue.position.v1', JSON.stringify(position)),
      onResize:action => {
        window.addEventListener('resize', action);
        new ResizeObserver(action).observe(panel);
      }
    });
  }
  // Pausing precedes any manual edit. No synthetic event is treated as permission.
  for (const type of ['click','keydown','beforeinput']) document.addEventListener(type,event=>{
    if (!running || internalAction || panel?.contains(event.target) || !event.isTrusted) return;
    if (onGenerator()) {
      stopRequested=true; event.preventDefault(); event.stopImmediatePropagation();
      message='실행 중 사이트 조작으로 중지했습니다. 같은 작업은 재개할 수 있습니다.'; render();
    }
  },true);
  window.addEventListener('storage', event=>{
    if (event.key===KEY && !running) { try {load();render();} catch {message='대기열 읽기 실패';render();} }
  });
  window.addEventListener('beforeunload',event=>{if(running){event.preventDefault();event.returnValue='';}});
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
