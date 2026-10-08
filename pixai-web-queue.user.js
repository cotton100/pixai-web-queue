// ==UserScript==
// @name         PixAI 웹 대기열 (로컬 후보)
// @namespace    local.pixai-web-queue
// @version      0.9.8
// @homepageURL  https://github.com/cotton100/pixai-web-queue
// @updateURL    https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js
// @downloadURL  https://raw.githubusercontent.com/cotton100/pixai-web-queue/main/pixai-web-queue.user.js
// @description  모델·LoRA 트리거와 캐릭터·여러 청크 프롬프트를 조합해 순차 생성하고 브라우저에 맞는 방식으로 원본을 저장합니다.
// @match        https://pixai.art/*
// @grant        GM_download
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      api.pixai.art
// @connect      *.pixai.art
// @connect      d2doj8oszwtcqy.cloudfront.net
// @sandbox      DOM
// @run-at       document-start
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const normalize = text => String(text ?? '').replace(/\r\n/g, '\n').trim();
  function readPromptEditorText(input) {
    const nodes=Array.from(input.childNodes || []);
    if (!nodes.length) return String(input.innerText ?? input.textContent ?? '');
    function inline(node) {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) throw new Error('프롬프트 입력창의 문단 구조를 확인하지 못했습니다.');
      if (node.tagName === 'BR') return node.classList.contains('ProseMirror-trailingBreak') ? '' : '\n';
      if (!['SPAN','STRONG','EM','B','I','U','S','CODE','A'].includes(node.tagName)) throw new Error('프롬프트 입력창의 문단 구조를 확인하지 못했습니다.');
      return Array.from(node.childNodes).map(inline).join('');
    }
    if (nodes.every(node=>node.nodeType === 3)) return nodes.map(inline).join('');
    if (!nodes.every(node=>node.nodeType === 1 && node.tagName === 'P')) throw new Error('프롬프트 입력창의 문단 구조를 확인하지 못했습니다.');
    // innerText adds visual blank lines between paragraphs. Tiptap stores one
    // logical newline per paragraph boundary; preserve explicit empty paragraphs.
    return nodes.map(p=>Array.from(p.childNodes).map(inline).join('')).join('\n');
  }
  const jsonObject = value => typeof value === 'string' ? JSON.parse(value) : (value ?? {});
  const safeName = name => String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 65) || 'PixAI';
  const resumable = new Set(['queued', 'waiting', 'saving', 'save_failed']);
  function checkCost(text, limit) {
    if (limit == null) return null;
    const match = String(text).match(/(?:생성!|Generate)\s*([\d,]+)(?=\s*(?:Ctrl\+|$))/i);
    const cost = match ? Number(match[1].replace(/,/g, '')) : NaN;
    if (!Number.isFinite(cost) || cost < 1) throw new Error('생성 비용을 확정할 수 없습니다.');
    if (cost > limit) throw new Error(`표시 비용 ${cost.toLocaleString()}크레딧이 설정 상한 ${limit.toLocaleString()}을 넘습니다.`);
    return cost;
  }

  // Google Material Icons, Apache-2.0. See MATERIAL-ICONS-LICENSE.txt and THIRD_PARTY_NOTICES.md.
  const materialPaths = {"folder":["M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"],"folder_open":["M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"],"create_new_folder":["M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"],"content_copy":["M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"],"delete":["M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"],"add":["M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"],"close":["M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"],"drag_indicator":["M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"],"play_arrow":["M8 5v14l11-7z"],"stop":["M6 6h12v12H6z"],"settings":["M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"],"person":["M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"],"layers":["M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"],"view_module":["M14.67,5v6.5H9.33V5H14.67z M15.67,11.5H21V5h-5.33V11.5z M14.67,19v-6.5H9.33V19H14.67z M15.67,12.5V19H21v-6.5H15.67z M8.33,12.5H3V19h5.33V12.5z M8.33,11.5V5H3v6.5H8.33z"],"playlist_add":["M14,10H3v2h11V10z M14,6H3v2h11V6z M18,14v-4h-2v4h-4v2h4v4h2v-4h4v-2H18z M3,16h7v-2H3V16z"],"tune":["M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"],"save":["M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"],"search":["M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"],"chevron_left":["M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"],"chevron_right":["M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"],"open_in_full":["M21,11 L21,3 L13,3 L16.29,6.29 L6.29,16.29 L3,13 L3,21 L11,21 L7.71,17.71 L17.71,7.71 Z"],"download":["M5,20h14v-2H5V20z M19,9h-4V3H9v6H5l7,7L19,9z"],"upload":["M5,20h14v-2H5V20z M5,10h4v6h6v-6h4l-7-7L5,10z"]};
  function materialIcon(name) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'currentColor','aria-hidden':'true',focusable:'false',class:'pq-icon'})) svg.setAttribute(key,value);
    for (const d of materialPaths[name] || materialPaths.layers) {const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path);}
    return svg;
  }
  function decorateIcon(control,name) {if (!control.querySelector('svg.pq-icon')) {control.dataset.icon=name;control.append(materialIcon(name));}return control;}
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
    // After the panel changed size (fold/unfold), keep its top-right corner where it was: the launcher
    // appears under the collapse button and the panel grows back to the left instead of jumping.
    function keepRight(before) {
      if (!before || !(before.width > 0)) return;
      const after = target.getBoundingClientRect();
      if (!(after.width > 0) || after.width === before.width) return;
      place({x:before.left + before.width - after.width, y:before.top}); remember();
    }
    return {keepRight};
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
  function managedDownload(download, blob, name, timers = {set:(fn,ms)=>setTimeout(fn,ms), clear:id=>clearTimeout(id)}) {
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
  async function pickDirectory(win, notify, timers = {set:(fn,ms)=>setTimeout(fn,ms), clear:id=>clearTimeout(id)}) {
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
    // Public REST omits prompt parameters. Receipt ID + creation time are the
    // available evidence; do not fabricate server confirmation of the prompt.
    if (job.queryBackend === 'official-v1' && original == null) return parameters;
    if (normalize(original) !== normalize(job.prompt)) throw new Error('해당 작업의 프롬프트가 대기열과 다릅니다.');
    return parameters;
  }
  function outputIds(task, expected) {
    const outputs = jsonObject(task.outputs);
    const ids = Array.isArray(outputs.mediaIds) ? outputs.mediaIds.map(String) : Array.isArray(outputs.batch)
      ? outputs.batch.map(item => String(item.mediaId ?? ''))
      : [String(task.mediaId ?? outputs.mediaId ?? '')];
    if (ids.length !== expected || ids.some(id => !/^\d+$/.test(id)) || new Set(ids).size !== ids.length) {
      throw new Error('원본 이미지 개수를 확정할 수 없습니다. 저장과 다음 생성을 중단합니다.');
    }
    return ids;
  }

  // Dependency-injected runner: the browser adapter is the only code that clicks Generate.
  async function submitJob(job, io) {
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
  }
  async function processJob(job, io) {
    await submitJob(job, io);
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
      if (io.saveMetadata) await io.saveMetadata(job);
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

  async function runQueue(jobs, io, {limit=3, oneJob=false, stopped=()=>false}={}) {
    presetInteger(limit,'미리 등록할 작업 수',1,10);
    const pending = () => jobs.filter(job=>!['done','skipped'].includes(job.state));
    // Resolve existing paid IDs before spending credits on any new work after a restart.
    for (const job of pending()) {
      if (stopped()) return;
      if (!resumable.has(job.state)) throw new Error(job.error || '확인 필요한 작업을 먼저 해결해 주세요.');
      if (oneJob) {await processJob(job,io);return;}
      if (job.state !== 'queued') await processJob(job,io);
    }
    while (!stopped() && pending().length) {
      const current=pending();
      if (current.some(job=>!resumable.has(job.state))) throw new Error('확인 필요한 작업을 먼저 해결해 주세요.');
      let active=current.filter(job=>job.state!=='queued').length;
      for (const job of current) {
        if (stopped() || active>=limit) break;
        if (job.state==='queued') {await submitJob(job,io);active++;}
      }
      if (stopped()) return;
      const first=pending().find(job=>job.state!=='queued');
      if (!first) return;
      await processJob(first,io);
    }
  }

  function makePresetLibrary() {
    return {version:1, common:{prompt:'', negativePrompt:''}, presets:[], characters:[], chunkFolders:[], scenes:[], reservations:[]};
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
    function entries(key, build, optional = false) {
      if (optional && !Object.prototype.hasOwnProperty.call(source, key)) return [];
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
    const chunkFolders = entries('chunkFolders', (item, id) => {
      if (typeof item.name !== 'string' || !presetText(item.name)) throw new Error('청크 폴더 이름을 입력해 주세요.');
      return {id, name:presetText(item.name)};
    }, true);
    const folderIds = new Set(chunkFolders.map(item => item.id));
    const library = {
      version:1,
      common:{prompt:presetText(common.prompt), negativePrompt:presetText(common.negativePrompt)},
      presets:entries('presets', (item, id) => ({id, name:presetText(item.name), ...validatePresetConfiguration(item, options)})),
      characters:entries('characters', (item, id) => ({id, name:presetText(item.name), prompt:presetText(item.prompt), negativePrompt:presetText(item.negativePrompt)})),
      chunkFolders,
      scenes:entries('scenes', (item, id) => {
        const chunk = {id, name:presetText(item.name), prompt:presetText(item.prompt), negativePrompt:presetText(item.negativePrompt)};
        if (Object.prototype.hasOwnProperty.call(item, 'folderId')) {
          const folderId = presetIdentifier(item.folderId, '청크 폴더');
          if (!folderIds.has(folderId)) throw new Error(`청크 ${id}의 폴더가 없습니다: ${folderId}`);
          chunk.folderId = folderId;
        }
        return chunk;
      }),
      reservations:entries('reservations', (item, id) => {
        const sourceIds = Object.prototype.hasOwnProperty.call(item, 'sceneIds') ? item.sceneIds : [item.sceneId];
        if (!Array.isArray(sourceIds)) throw new Error('선택한 프롬프트 청크 목록 형식을 확인해 주세요.');
        const sceneIds = sourceIds.map(sceneId => presetIdentifier(sceneId, '프롬프트 청크'));
        if (new Set(sceneIds).size !== sceneIds.length) throw new Error('같은 프롬프트 청크를 중복 선택할 수 없습니다.');
        const reservation = {id,
          presetId:presetIdentifier(item.presetId, '설정 프리셋'),
          characterId:presetIdentifier(item.characterId, '캐릭터'), sceneIds,
          count:presetInteger(item.count, '예약 반복 횟수', 1, 100)};
        if (Object.hasOwn(item,'triggerPosition')) reservation.triggerPosition=normalizeTriggerPosition(item.triggerPosition,sceneIds.length);
        if (Object.hasOwn(item,'snapshot')) {
          reservation.snapshot = normalizeCombinationSnapshot(item.snapshot);
          const frozen=reservation.snapshot;
          if (frozen.preset.id!==reservation.presetId || frozen.character.id!==reservation.characterId || JSON.stringify(frozen.chunks.map(chunk=>chunk.id))!==JSON.stringify(sceneIds)) throw new Error('예약 사본과 재료 ID가 다릅니다.');
        }
        return reservation;
      })
    };
    if (Object.hasOwn(source,'combinations')) {
      library.combinations=entries('combinations',(item,id)=>{
        const sceneIds=item.sceneIds;
        if (!Array.isArray(sceneIds) || new Set(sceneIds).size!==sceneIds.length) throw new Error('조합 기록의 청크 순서를 확인해 주세요.');
        if (typeof item.favorite!=='boolean') throw new Error('조합 즐겨찾기 형식을 확인해 주세요.');
        return {id,presetId:presetIdentifier(item.presetId,'기록 프리셋'),characterId:presetIdentifier(item.characterId,'기록 캐릭터'),
          sceneIds:sceneIds.map(id=>presetIdentifier(id,'기록 청크')),count:presetInteger(item.count,'기록 횟수',1,100),
          ...(Object.hasOwn(item,'triggerPosition') ? {triggerPosition:normalizeTriggerPosition(item.triggerPosition,sceneIds.length)} : {}),
          favorite:item.favorite,name:presetText(item.name),at:presetInteger(item.at,'기록 시각',0,Number.MAX_SAFE_INTEGER)};
      });
      if (library.combinations.filter(item=>!item.favorite).length>50 || library.combinations.filter(item=>item.favorite).length>1000) throw new Error('최근 조합은 50개, 즐겨찾기는 1,000개까지 저장할 수 있습니다.');
    }
    if (library.reservations.reduce((sum, item) => sum + item.count, 0) > 1000) throw new Error('예약 작업은 한 번에 1,000개까지 만들 수 있습니다.');
    return library;
  }
  function normalizeCombinationSnapshot(value) {
    const source=settingsBackupKeys(value,'예약 사본',['common','preset','character','chunks']);
    const frozen=settingsBackupLibrary({version:1,common:source.common,presets:[source.preset],characters:[source.character],scenes:source.chunks,reservations:[]});
    return {common:frozen.common,preset:frozen.presets[0],character:frozen.characters[0],chunks:frozen.scenes};
  }
  function resolveCombination(value, combination) {
    const library=normalizePresetLibrary(value),missing=[];
    const preset=library.presets.find(item=>item.id===combination.presetId),character=library.characters.find(item=>item.id===combination.characterId);
    if (!preset) missing.push('프리셋');if (!character) missing.push('캐릭터');
    const sceneIds=[];
    for (const id of combination.sceneIds) {if (library.scenes.some(item=>item.id===id)) sceneIds.push(id);else missing.push(`청크 ${id}`);}
    return {presetId:preset?.id || '',characterId:character?.id || '',sceneIds,count:combination.count,missing,
      ...(Object.hasOwn(combination,'triggerPosition') ? {triggerPosition:combination.triggerPosition==='end' ? 'end' : Math.min(normalizeTriggerPosition(combination.triggerPosition,combination.sceneIds.length),sceneIds.length+2)} : {})};
  }
  function snapshotCombination(value, combination) {
    const library=normalizePresetLibrary(value),resolved=resolveCombination(library,combination);
    if (resolved.missing.length) throw new Error(`조합 재료가 없습니다: ${resolved.missing.join(', ')}`);
    return normalizeCombinationSnapshot({common:library.common,preset:library.presets.find(item=>item.id===resolved.presetId),character:library.characters.find(item=>item.id===resolved.characterId),
      chunks:resolved.sceneIds.map(id=>{const {folderId,...chunk}=library.scenes.find(item=>item.id===id);return chunk;})});
  }
  function rememberCombination(value, combination, options={}) {
    const library=normalizePresetLibrary(value),entries=library.combinations || [];
    const previous=entries.find(item=>item.presetId===combination.presetId && item.characterId===combination.characterId && JSON.stringify(item.sceneIds)===JSON.stringify(combination.sceneIds) && normalizeTriggerPosition(item.triggerPosition,item.sceneIds.length)===normalizeTriggerPosition(combination.triggerPosition,combination.sceneIds.length));
    const entry={id:previous?.id || (options.idFactory || (()=>globalThis.crypto.randomUUID()))(),presetId:combination.presetId,characterId:combination.characterId,sceneIds:[...combination.sceneIds],count:combination.count,
      ...(Object.hasOwn(combination,'triggerPosition') ? {triggerPosition:combination.triggerPosition} : {}),
      favorite:!!options.favorite || !!previous?.favorite,name:previous?.name || '',at:options.now ?? Date.now()};
    let recent=0;
    library.combinations=[entry,...entries.filter(item=>item.id!==entry.id)].filter(item=>item.favorite || ++recent<=50);
    return normalizePresetLibrary(library);
  }
  function orderedChunks(value) {
    const library = normalizePresetLibrary(value);
    return [...library.scenes.filter(item => !item.folderId),
      ...library.chunkFolders.flatMap(folder => library.scenes.filter(item => item.folderId === folder.id))];
  }
  function moveLibraryItem(value, key, id, direction) {
    if (!['presets','characters','scenes','chunkFolders','reservations'].includes(key)) throw new Error('순서를 변경할 목록을 확인해 주세요.');
    if (direction !== -1 && direction !== 1) throw new Error('이동 방향은 위 또는 아래여야 합니다.');
    const library = normalizePresetLibrary(value);
    const items = library[key], itemId = presetIdentifier(id, '이동할 항목');
    const index = items.findIndex(item => item.id === itemId);
    if (index < 0) throw new Error('순서를 변경할 항목이 없습니다.');
    const indexes = items.map((_item, itemIndex) => itemIndex)
      .filter(itemIndex => key !== 'scenes' || items[itemIndex].folderId === items[index].folderId);
    const target = indexes[indexes.indexOf(index) + direction];
    if (target !== undefined) [items[index], items[target]] = [items[target], items[index]];
    return library;
  }

  function placeLibraryItem(value,key,id,targetId,after=false) {
    if (!['presets','characters','chunkFolders','reservations'].includes(key)) throw new Error('순서를 바꿀 목록을 확인해 주세요.');
    const next=normalizePresetLibrary(value),items=next[key];
    if (!items.some(item=>item.id===id) || !items.some(item=>item.id===targetId)) throw new Error('이동할 항목을 확인해 주세요.');
    if (id===targetId) return next;
    const [item]=items.splice(items.findIndex(item=>item.id===id),1);
    items.splice(items.findIndex(item=>item.id===targetId)+(after ? 1 : 0),0,item);
    return next;
  }
  function removeChunkFolder(value, id) {
    const library = normalizePresetLibrary(value), folderId = presetIdentifier(id, '청크 폴더');
    if (!library.chunkFolders.some(item => item.id === folderId)) throw new Error('삭제할 청크 폴더가 없습니다.');
    library.chunkFolders = library.chunkFolders.filter(item => item.id !== folderId);
    for (const chunk of library.scenes) if (chunk.folderId === folderId) delete chunk.folderId;
    return library;
  }
  function paneRatios(value, fallback) {
    const source=Array.isArray(value)&&value.length===fallback.length&&value.every(item=>Number.isFinite(item)&&item>0) ? value : fallback;
    const largest=Math.max(...source),scaled=source.map(item=>item/largest),sum=scaled.reduce((total,item)=>total+item,0);return scaled.map(item=>item/sum);
  }
  function resizePanePair(value,index,delta,minimums) {
    const next=[...value],total=next[index]+next[index+1];
    const scale=Math.min(1,total/(minimums[index]+minimums[index+1]));
    const left=Math.min(total-minimums[index+1]*scale,Math.max(minimums[index]*scale,next[index]+delta));
    next[index]=left;next[index+1]=total-left;return next;
  }
  function bindPaneResize(host,panes,io) {
    let ratios=paneRatios(null,io.initial),drag=null;
    try {ratios=paneRatios(io.load?.(),io.initial);}catch { /* Layout storage does not block the editor. */ }
    const handles=panes.slice(1).map((_pane,index)=>io.createHandle(index));
    host.replaceChildren(...panes.flatMap((pane,index)=>index ? [handles[index-1],pane] : [pane]));
    function draw() {
      panes.forEach((pane,index)=>{pane.style.flex=`${ratios[index]} 1 0px`;});
      handles.forEach((handle,index)=>handle.setAttribute('aria-valuenow',String(Math.round(ratios[index]/(ratios[index]+ratios[index+1])*100))));
    }
    function measure() {
      const width=Math.max(1,host.getBoundingClientRect().width-handles.length*8);
      const scale=Math.min(1,width/io.minimums.reduce((sum,item)=>sum+item,0));
      return {width,minimums:io.minimums.map(item=>item*scale/width)};
    }
    function remember() {try {io.save?.([...ratios]);}catch { /* Keep the usable layout in this tab. */ }}
    for (const [index,handle] of handles.entries()) {
      handle.addEventListener('pointerdown',event=>{
        if (event.isTrusted===false || event.button!==0 || event.isPrimary===false || drag || io.enabled?.()===false) return;
        drag={id:event.pointerId,index,startX:event.clientX,start:[...ratios],...measure()};
        handle.setPointerCapture(event.pointerId);host.dataset.resizing='true';event.preventDefault();event.stopPropagation();
      });
      handle.addEventListener('pointermove',event=>{
        if (!drag || drag.id!==event.pointerId || drag.index!==index) return;
        ratios=resizePanePair(drag.start,index,(event.clientX-drag.startX)/drag.width,drag.minimums);draw();event.preventDefault();
      });
      function finish(event) {
        if (!drag || drag.id!==event.pointerId || drag.index!==index) return;
        const previous=drag.start,commit=event.type==='pointerup';drag=null;delete host.dataset.resizing;
        if (!commit) ratios=previous;draw();
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        if (commit) remember();
      }
      for (const type of ['pointerup','pointercancel','lostpointercapture']) handle.addEventListener(type,finish);
      handle.addEventListener('keydown',event=>{
        if (event.isTrusted===false || io.enabled?.()===false || !['ArrowLeft','ArrowRight','Home'].includes(event.key)) return;
        event.preventDefault();
        ratios=event.key==='Home' ? paneRatios(null,io.initial) : resizePanePair(ratios,index,event.key==='ArrowRight' ? .025 : -.025,measure().minimums);
        draw();remember();
      });
      handle.addEventListener('dblclick',event=>{if (event.isTrusted===false || io.enabled?.()===false) return;ratios=paneRatios(null,io.initial);draw();remember();});
    }
    draw();return {ratios:()=>[...ratios]};
  }
  function bindWindowResize(target,handle,io) {
    let drag=null,size=null,preferred=null;
    function apply(value) {
      const viewport=io.viewport(),rect=target.getBoundingClientRect();
      const width=Math.min(viewport.width-16,Math.max(Math.min(560,viewport.width-16),value.width));
      const height=Math.min(viewport.height-16,Math.max(Math.min(420,viewport.height-16),value.height));
      size={width,height};Object.assign(target.style,{width:`${width}px`,height:`${height}px`});
      if (target.dataset.minimized!=='true') {
        const position=clampPosition({x:value.x ?? rect.left,y:value.y ?? rect.top},size,viewport);
        Object.assign(target.style,{left:`${position.x}px`,top:`${position.y}px`,right:'auto',bottom:'auto'});
      }
    }
    try {const saved=io.load?.();if (Number.isFinite(saved?.width)&&Number.isFinite(saved?.height)&&saved.width>0&&saved.height>0) {preferred={width:saved.width,height:saved.height};apply(preferred);}}catch { /* Ignore invalid size storage. */ }
    handle.addEventListener('pointerdown',event=>{
      if (event.isTrusted===false || event.button!==0 || event.isPrimary===false || drag || target.dataset.minimized==='true') return;
      const rect=target.getBoundingClientRect();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,start:{width:rect.width,height:rect.height,x:rect.left,y:rect.top}};
      handle.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation();
    });
    handle.addEventListener('pointermove',event=>{if (!drag || drag.id!==event.pointerId) return;apply({width:drag.start.width+event.clientX-drag.startX,height:drag.start.height+event.clientY-drag.startY});event.preventDefault();});
    function finish(event) {
      if (!drag || drag.id!==event.pointerId) return;
      const previous=drag.start,commit=event.type==='pointerup';drag=null;if (!commit) apply(previous);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (commit) {const current=size || previous;preferred={width:current.width,height:current.height};try {io.save?.(preferred);}catch { /* Size still works in this tab. */ }}
    }
    for (const type of ['pointerup','pointercancel','lostpointercapture']) handle.addEventListener(type,finish);
    handle.addEventListener('keydown',event=>{
      if (event.isTrusted===false || target.dataset.minimized==='true' || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();const rect=target.getBoundingClientRect();apply({width:rect.width+(event.key==='ArrowRight' ? 24 : event.key==='ArrowLeft' ? -24 : 0),height:rect.height+(event.key==='ArrowDown' ? 24 : event.key==='ArrowUp' ? -24 : 0)});
      preferred={...size};try {io.save?.(preferred);}catch { /* Keyboard resize does not need storage. */ }
    });
    io.onResize?.(()=>{if ((preferred || size) && !drag) apply(preferred || size);});
  }
  function selectedChunks(library, ids) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('청크를 하나 이상 선택해 주세요.');
    const selected=new Set(ids.map(id=>presetIdentifier(id,'선택한 청크')));
    if (selected.size!==ids.length || ids.some(id=>!library.scenes.some(item=>item.id===id))) throw new Error('선택한 청크가 없거나 중복됐습니다.');
    return orderedChunks(library).filter(item=>selected.has(item.id));
  }
  function moveChunksTo(value, ids, folderId, targetId = null, after = false) {
    const library=normalizePresetLibrary(value),chunks=selectedChunks(library,ids),selected=new Set(ids);
    if (typeof folderId!=='string' || (folderId && !library.chunkFolders.some(item=>item.id===folderId))) throw new Error('이동할 청크 폴더가 없습니다.');
    if (typeof after!=='boolean') throw new Error('청크를 놓을 위치를 확인해 주세요.');
    const target=targetId===null ? null : library.scenes.find(item=>item.id===presetIdentifier(targetId,'대상 청크'));
    if (targetId!==null && (!target || (target.folderId || '')!==folderId)) throw new Error('청크를 놓을 대상과 폴더를 확인해 주세요.');
    if (target && selected.has(target.id)) return library;
    library.scenes=library.scenes.filter(item=>!selected.has(item.id));
    for (const chunk of chunks) {if (folderId) chunk.folderId=folderId;else delete chunk.folderId;}
    let position=library.scenes.length;
    if (target) position=library.scenes.findIndex(item=>item.id===target.id)+(after ? 1 : 0);
    else {
      const last=library.scenes.map((item,itemIndex)=>(item.folderId || '')===folderId ? itemIndex : -1).filter(itemIndex=>itemIndex>=0).at(-1);
      if (last!==undefined) position=last+1;
    }
    library.scenes.splice(position,0,...chunks);return library;
  }
  function removeChunks(value,ids) {
    const library=normalizePresetLibrary(value);selectedChunks(library,ids);
    const selected=new Set(ids);library.scenes=library.scenes.filter(item=>!selected.has(item.id));return library;
  }
  function duplicateChunks(value,ids,idFactory=()=>crypto.randomUUID()) {
    const library=normalizePresetLibrary(value),chunks=selectedChunks(library,ids),copies=new Map();
    const names=new Set(library.scenes.map(item=>item.name)),identities=new Set(library.scenes.map(item=>item.id));
    for (const chunk of chunks) {
      const id=presetIdentifier(idFactory(),'복제 청크');
      if (identities.has(id)) throw new Error('복제 청크 ID가 중복됐습니다.');identities.add(id);
      let name=`${chunk.name} (복사본)`,number=2;
      while (names.has(name)) name=`${chunk.name} (복사본 ${number++})`;
      names.add(name);copies.set(chunk.id,{...chunk,id,name});
    }
    library.scenes=library.scenes.flatMap(chunk=>copies.has(chunk.id) ? [chunk,copies.get(chunk.id)] : [chunk]);
    return library;
  }
  function createChunkFolder(value,name,ids=[],idFactory=()=>crypto.randomUUID()) {
    const library=normalizePresetLibrary(value),title=presetText(name).trim();
    if (!title) throw new Error('새 폴더 이름을 입력해 주세요.');
    if (library.chunkFolders.some(item=>item.name.toLocaleLowerCase()===title.toLocaleLowerCase())) throw new Error('같은 이름의 폴더가 있습니다. 목록에서 그 폴더를 선택해 주세요.');
    const id=presetIdentifier(idFactory(),'새 청크 폴더');
    if (library.chunkFolders.some(item=>item.id===id)) throw new Error('새 폴더 ID가 중복됐습니다.');
    library.chunkFolders.push({id,name:title});
    return ids.length ? moveChunksTo(library,ids,id) : library;
  }
  function settingsBackupKeys(value, label, required, allowed = required) {
    const source = presetObject(value, label);
    if (required.some(key => !Object.prototype.hasOwnProperty.call(source, key)) || Object.keys(source).some(key => !allowed.includes(key))) {
      throw new Error(`${label}의 필수 항목이나 형식을 확인해 주세요.`);
    }
    return source;
  }
  function normalizeSettingsOptions(value) {
    const source = settingsBackupKeys(value, '대기열 옵션', ['maxCredits','filePrefix','repeat'], ['maxCredits','filePrefix','repeat','maxInFlight','imageCount','api']);
    if (source.maxCredits !== null && (typeof source.maxCredits !== 'number' || !Number.isSafeInteger(source.maxCredits) || source.maxCredits < 1)) {
      throw new Error('크레딧 상한은 양의 정수 또는 제한 없음이어야 합니다.');
    }
    if (typeof source.filePrefix !== 'string') throw new Error('파일 이름은 문자열이어야 합니다.');
    if (typeof source.repeat !== 'number') throw new Error('반복 횟수는 1~100의 정수여야 합니다.');
    const extra={};
    if (Object.hasOwn(source,'api')) extra.api=normalizeApiOptions(source.api);
    if (Object.hasOwn(source,'maxInFlight')) extra.maxInFlight=presetInteger(source.maxInFlight,'미리 등록할 작업 수',1,10);
    if (Object.hasOwn(source,'imageCount')) {
      extra.imageCount=presetInteger(source.imageCount,'생성당 이미지 수',0,4);
      if (![0,1,4].includes(extra.imageCount)) throw new Error('생성당 이미지 수는 사이트 선택·1장·4장 중 골라 주세요.');
    }
    return {maxCredits:source.maxCredits, filePrefix:presetText(source.filePrefix), repeat:presetInteger(source.repeat, '반복 횟수', 1, 100),...extra};
  }
  function settingsBackupStrings(value, keys, label) {
    if (keys.some(key => Object.prototype.hasOwnProperty.call(value, key) && typeof value[key] !== 'string')) {
      throw new Error(`${label}은 문자열이어야 합니다.`);
    }
  }
  function settingsBackupLibrary(value) {
    const source = settingsBackupKeys(value, '프리셋 라이브러리', ['version','common','presets','characters','scenes','reservations'],
      ['version','common','presets','characters','chunkFolders','scenes','reservations','combinations']);
    settingsBackupKeys(source.common, '공통 프롬프트', ['prompt','negativePrompt']);
    settingsBackupStrings(source.common, ['prompt','negativePrompt'], '공통 프롬프트');
    const library = normalizePresetLibrary(source);
    for (const folder of source.chunkFolders || []) {
      settingsBackupKeys(folder, '청크 폴더', ['id','name']);
      settingsBackupStrings(folder, ['name'], '청크 폴더 이름');
    }
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
      const fields = ['id','name','prompt','negativePrompt'];
      settingsBackupKeys(item, '캐릭터·청크 프롬프트', fields, key === 'scenes' ? [...fields,'folderId'] : fields);
      settingsBackupStrings(item, ['name','prompt','negativePrompt'], '캐릭터·청크 프롬프트');
    }
    for (const item of source.reservations) settingsBackupKeys(item, '조합 예약', ['id','presetId','characterId','count'], ['id','presetId','characterId','count','sceneId','sceneIds','snapshot','triggerPosition']);
    for (const item of source.combinations || []) settingsBackupKeys(item,'조합 기록',['id','presetId','characterId','sceneIds','count','favorite','name','at'],['id','presetId','characterId','sceneIds','count','favorite','name','at','triggerPosition']);
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
  function normalizeTriggerPosition(value,chunkCount) {
    if (value===undefined) return 1; // Older recipes put triggers between common and character.
    if (value==='end') return value;
    if (!Number.isInteger(value) || value<0 || value>chunkCount+2) throw new Error('LoRA 트리거 위치를 확인해 주세요.');
    return value;
  }
  function composePresetPrompts(common, character, chunksOrLegacyScene, preset = {loras:[]}, triggerPosition=1) {
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
    const promptParts = [commonPart.prompt, characterPart.prompt, ...chunks.map(item => item.prompt)];
    const position=normalizeTriggerPosition(triggerPosition,chunks.length);
    promptParts.splice(position==='end' ? promptParts.length : position,0,...triggers);
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
      const frozen=reservation.snapshot;
      const common=frozen?.common || library.common;
      const preset = frozen?.preset || library.presets.find(item => item.id === reservation.presetId);
      const character = frozen?.character || library.characters.find(item => item.id === reservation.characterId);
      if (!preset) throw new Error(`예약 ${reservation.id}의 설정 프리셋이 없습니다.`);
      if (!character) throw new Error(`예약 ${reservation.id}의 캐릭터가 없습니다.`);
      const chunks = frozen?.chunks || reservation.sceneIds.map(sceneId => {
        const chunk = library.scenes.find(item => item.id === sceneId);
        if (!chunk) throw new Error(`예약 ${reservation.id}의 프롬프트 청크가 없습니다: ${sceneId}`);
        return chunk;
      });
      const prompts = composePresetPrompts(common, character, chunks, preset, reservation.triggerPosition);
      if (!prompts.prompt) throw new Error(`예약 ${reservation.id}의 조합 프롬프트가 비어 있습니다.`);
      for (let repeat = 1; repeat <= reservation.count; repeat++) {
        const id = presetIdentifier(idFactory(), '작업');
        if (ids.has(id)) throw new Error('새 작업 ID가 중복됐습니다.');
        ids.add(id);
        jobs.push({id,
          title:[prefix, character.name || '캐릭터', chunks.map(item => item.name || '청크').join('+'), preset.name || '프리셋', repeat].filter(Boolean).join('_'),
          ...prompts, maxCredits, state:'queued', saved:[],
          configuration:copy({model:preset.model, loras:preset.loras}),
          composition:{version:2, reservation:copy({...reservation, repeat}), common:copy(common),
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
    const labels={ '전체 모델 보기':['전체 모델 보기','See All Models'], '전체 LoRA 보기':['전체 LoRA 보기','See All LoRAs'], '이 모델 사용':['이 모델 사용','Use this model','Use This Model'], '확인':['확인','Confirm','Confirm selection'], '고급':['고급','Advanced'] };
    const matchesText=(element,text)=>(labels[text] || [text]).includes(element.textContent.trim());
    const buttons = (scope, text) => list(scope,'button').filter(e => shown(e) && matchesText(e,text));
    const mainButtons = text => list(doc,'main button').filter(e => shown(e) && matchesText(e,text));
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
      const imageCount=readImageCount(true);
      try { await applyModel(config.model); await applyLoras(config); if (imageCount!=null) await setImageCount(imageCount); return assertConfiguration(config,read()); }
      catch(error) {
        const d=dialog(), close=d?.querySelector('button[aria-label="닫기"]') || d?.querySelector('button[aria-label="Close"]');
        if (close) { try { io.mutate(()=>close.click()); } catch {} }
        throw error;
      }
    }
    function negativeField() { return list(doc,'main textarea').filter(e=>shown(e)&&['여기에 네거티브 프롬프트를 입력하세요','Enter negative prompt here'].includes(e.getAttribute('placeholder')))[0]; }
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
    function imageControls(optional=false) {
      const groups=list(doc,'main [role="group"]').filter(e=>shown(e)&&['이미지 수','Number of images'].includes((e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(/\s+/).map(id=>doc.getElementById(id)?.textContent || '').join(' ')).trim()));
      if (optional && !groups.length) return [];
      const group=only(groups,'이미지 수 선택');
      return [...new Set([...list(group,'[role="radio"]'),...list(group,'input[type="radio"]')])].filter(shown).map(element=>{
        const text=element.getAttribute('aria-label') || element.textContent || element.closest?.('label')?.textContent || '';
        return {element,count:/x4|×4/i.test(text) ? 4 : /단일|single/i.test(text) ? 1 : null};
      }).filter(item=>item.count);
    }
    function readImageCount(optional=false) {
      const controls=imageControls(optional);
      if (optional && !controls.length) return null;
      const selected=only(controls.filter(({element})=>element.checked || element.getAttribute('aria-checked')==='true'),'선택한 이미지 수');
      return selected.count;
    }
    async function setImageCount(count) {
      if (![1,4].includes(count)) throw new Error('생성당 이미지 수는 1장 또는 4장이어야 합니다.');
      if (readImageCount()===count) return;
      click(only(imageControls().filter(item=>item.count===count),'이미지 수 버튼').element);
      await waitFor(()=>readImageCount()===count,'이미지 수 반영');
    }
    return {capture,apply,read,modelKey,revealModelPanel,setNegative,verifyNegative,captureNegative,readImageCount,setImageCount};
  }

function mountPresetEditor(parent, io) {
  const copy = value => JSON.parse(JSON.stringify(value));
  let library = normalizePresetLibrary(io.load() || makePresetLibrary());
  const root = document.createElement('div'); root.className = 'pq-presets';
  const runtimePages = []; // 대기열·설정 페이지: 실행 중 잠금 대상
  const pickerRenderers=new Map();
  function el(tag, text, attrs = {}) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    for (const [name,value] of Object.entries(attrs)) element.setAttribute(name,value);
    return element;
  }
  function action(text, run) {
    const element = io.button(text, run); element.dataset.edit = '';
    const icon=text.includes('삭제') || text.includes('제외') ? 'delete' : text.includes('복제') ? 'content_copy' : text.includes('폴더') ? 'create_new_folder' : text.includes('저장') ? 'save' : text.includes('해제') || text.includes('취소') ? 'close' : text.includes('예약') || text.includes('등록') ? 'playlist_add' : text.includes('이동') ? 'folder_open' : text.includes('읽기') ? 'download' : text.includes('새 ') || text.includes('추가') ? 'add' : null;
    if (icon) decorateIcon(element,icon);
    if (text.endsWith(' 저장') || text === '이 조합 예약 추가' || text === '예약 전부를 대기열에 등록') element.dataset.primary = '';
    if (io.isBusy?.()) element.disabled=true;
    return element;
  }
  // Buttons that read or change the PixAI page stay locked while this tab's runner drives the page.
  function siteAction(text, run) { const element = action(text, run); element.setAttribute('data-site-io', ''); return element; }
  function field(label, tag = 'input', attrs = {}) {
    const input = el(tag,null,{'data-edit':'','aria-label':label,...attrs});
    const wrap = el('label',label); wrap.append(input); return {input,wrap};
  }
  const navigation = el('div',null,{class:'pq-tabs',role:'tablist','aria-label':'PixAI 작업 화면'});
  const pages = el('div',null,{class:'pq-pages'}), views = [];
  const libraryIds=['chunks','characters','presets','common'];
  let libraryPage=null,libraryTab='chunks';
  root.append(navigation,pages);
  function showPage(id, focus = false) {
    const view=views.find(item=>item.id===id);if (!view) return;
    if (libraryIds.includes(id)) libraryTab=id;
    const mainId=libraryPage && libraryIds.includes(id) ? 'library' : id;
    for (const item of views) {
      const selected=libraryPage && libraryIds.includes(item.id) ? mainId==='library' && item.id===libraryTab : item.id===mainId;
      item.body.hidden=!selected;
      item.tab.setAttribute('aria-selected',String(selected));item.tab.setAttribute('tabindex',selected ? '0' : '-1');
    }
    if (focus) {view.tab.focus({preventScroll:true});view.tab.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'auto'});}
    const registration=root.querySelector('.pq-registration-bar');if (registration) registration.hidden=mainId!=='compose';
  }
  function buttonPicker(control,{icon='folder',caption=null,empty=true,onChange=()=>{},editable=true}={}) {
    control.wrap.hidden=true;
    const wrap=el('div',null,{class:'pq-button-picker'}),label=control.input.getAttribute('aria-label');
    const list=el('div',null,{class:'pq-choice-list','aria-label':`${label} 버튼 목록`});wrap.append(el('strong',caption || label),list);
    function render() {
      const focused=document.activeElement?.dataset.choiceValue;list.replaceChildren();
      const options=[...control.input.children].filter(option=>empty || option.value || control.input.children.length===1);
      for (const option of options) {
        const button=el('button',option.textContent,{type:'button','aria-label':`${label}: ${option.textContent}`,'aria-pressed':String(control.input.value===option.value),'data-choice-value':option.value});
        decorateIcon(button,icon);if (editable) {button.dataset.edit='';button.disabled=!!io.isBusy?.();}if (!empty && !option.value) {button.dataset.unavailable='true';button.disabled=true;}
        button.addEventListener('click',()=>{if (editable && io.isBusy?.()) return;control.input.value=option.value;onChange(option.value);render();[...list.children].find(item=>item.dataset.choiceValue===option.value)?.focus({preventScroll:true});});list.append(button);
      }
      if (focused!==undefined && document.activeElement?.parentElement===list) [...list.children].find(item=>item.dataset.choiceValue===focused)?.focus({preventScroll:true});
    }
    pickerRenderers.set(control.input,render);control.input.addEventListener('change',render);wrap.append(control.wrap);
    return {wrap,list,render};
  }
  function quickFolder(picker,label,onCreate,moving=false) {
    const create=el('div',null,{class:'pq-quick-folder'}),name=field(`${label} 새 폴더 이름`,'input',{placeholder:'새 폴더 이름'}),form=el('div',null,{class:'pq-quick-folder-form'});form.hidden=true;
    const open=action('새 폴더',()=>{form.hidden=false;name.input.focus();});open.setAttribute('aria-label',`${label} 새 폴더`);open.dataset.headerFeedback='';
    async function saveFolder() {await onCreate(nameValue(name.input));form.hidden=true;name.input.value='';picker.render();[...picker.list.children].find(item=>item.getAttribute('aria-pressed')==='true')?.focus({preventScroll:true});}
    const save=action(moving ? '만들고 선택 청크 이동' : '만들고 폴더 선택',saveFolder);save.dataset.headerFeedback='';
    const cancel=action('취소',()=>{form.hidden=true;name.input.value='';open.focus();});cancel.setAttribute('aria-label',`${label} 폴더 만들기 취소`);cancel.dataset.headerFeedback='';
    name.input.addEventListener('keydown',async event=>{if (event.key!=='Enter' || event.isTrusted===false || io.isBusy?.()) return;event.preventDefault();try {await saveFolder();}catch(error){io.notify(error.message);}});
    const actions=el('div',null,{class:'pq-actions'});actions.append(save,cancel);form.append(name.wrap,actions);create.append(open,form);picker.wrap.append(create);
    return ()=>{form.hidden=true;name.input.value='';};
  }
  function resizable(layout,panes,key,initial,minimums) {
    layout.className+=' pq-resizable-layout';layout.dataset.layoutKey=key;
    bindPaneResize(layout,panes,{initial,minimums,load:()=>io.loadLayout?.(key),save:value=>io.saveLayout?.(key,value),enabled:()=>!io.isCompact?.(),
      createHandle:index=>el('div',null,{class:'pq-pane-handle',role:'separator',tabindex:'0','aria-orientation':'vertical','aria-label':`${key} 영역 ${index+1} 너비 조절`,'aria-valuemin':'0','aria-valuemax':'100',title:'드래그해 비율 조절 · ←→ 키 · 두 번 클릭하면 기본 비율'})});
  }
  function section(title, open = false, id = ['common','presets','characters','chunks','compose'][views.length] || title) {
    const label={common:'공통문',presets:'모델·LoRA',characters:'캐릭터',chunks:'청크',compose:'조합 예약'}[id] || title;
    const body=el('div',null,{class:'pq-preset-body',role:'tabpanel',id:`pq-page-${id}`,'aria-labelledby':`pq-tab-${id}`,'data-page':id});
    const tab=el('button',label,{type:'button',role:'tab',id:`pq-tab-${id}`,'aria-controls':body.id});decorateIcon(tab,({compose:'playlist_add',chunks:'layers',characters:'person',presets:'tune',common:'view_module',queue:'play_arrow',settings:'settings'})[id]);
    tab.addEventListener('click',()=>showPage(id));
    tab.addEventListener('keydown',event=>{
      const peers=views.filter(item=>libraryIds.includes(item.id)===libraryIds.includes(id));
      const order=libraryIds.includes(id) ? libraryIds : ['compose','library','queue','settings'];peers.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
      const index=peers.findIndex(item=>item.id===id);
      const next=event.key==='ArrowRight' ? (index+1)%peers.length : event.key==='ArrowLeft' ? (index+peers.length-1)%peers.length : event.key==='Home' ? 0 : event.key==='End' ? peers.length-1 : -1;
      if (next<0) return;event.preventDefault();showPage(peers[next].id,true);
    });
    views.push({id,body,tab});navigation.append(tab);pages.append(body);
    showPage(open ? id : views.find(item=>!item.body.hidden)?.id || id);return body;
  }
  function selectOptions(select, items, caption, selected, first = false) {
    select.replaceChildren(el('option',caption,{value:''}));
    for (const item of items) select.append(el('option',item.name,{value:item.id}));
    select.value = items.some(item => item.id === selected) ? selected : (first ? items[0]?.id || '' : '');
    pickerRenderers.get(select)?.();
  }
  async function commit(next, message) {
    const normalized = normalizePresetLibrary(next);
    await io.save(copy(normalized)); library = normalized;
    refreshLists(); renderReservations(); preview();
    if (message) io.notify(message);
  }
  const orderRefreshers = [];
  let libraryDrag=null,libraryDropBusy=false;
  function libraryOrderHandle(row,key,item,label) {
    row.dataset.libraryReorder=key;
    row.dataset.libraryItem=item.id;
    const handle=el('button',null,{type:'button',draggable:'true',class:'pq-drag-handle','data-edit':'','aria-label':`${label} 이동: ${item.name}`,title:'드래그해서 목록 순서 변경'});
    decorateIcon(handle,'drag_indicator');
    const type='application/x-pixai-library-item';
    const clear=()=>{libraryDrag=null;for (const target of root.querySelectorAll('[data-library-reorder]')) target.dataset.dropPosition='';};
    handle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
    handle.addEventListener('dragstart',event=>{
      if (event.isTrusted===false || libraryDropBusy || io.isBusy?.() || !event.dataTransfer) {event.preventDefault();return;}
      event.stopPropagation();libraryDrag={key,id:item.id};event.dataTransfer.setData(type,JSON.stringify(libraryDrag));event.dataTransfer.effectAllowed='move';event.dataTransfer.setDragImage?.(row,12,12);
    });
    handle.addEventListener('dragend',clear);
    const accepts=event=>event.isTrusted!==false && !libraryDropBusy && !io.isBusy?.() && libraryDrag?.key===key && libraryDrag.id!==item.id;
    row.addEventListener('dragover',event=>{
      if (!accepts(event)) return;
      event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';
      row.dataset.dropPosition=event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2 ? 'after' : 'before';
    });
    row.addEventListener('dragleave',event=>{if (!row.contains(event.relatedTarget)) row.dataset.dropPosition='';});
    row.addEventListener('drop',async event=>{
      if (!accepts(event) || event.dataTransfer?.getData(type)!==JSON.stringify(libraryDrag)) return;
      event.preventDefault();event.stopPropagation();const dragged=libraryDrag;
      const after=event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;
      clear();libraryDropBusy=true;
      try {await commit(placeLibraryItem(library,key,dragged.id,item.id,after),'목록 순서를 변경했습니다.');}
      catch(error) {io.notify(error.message);}
      finally {libraryDropBusy=false;}
    });
    handle.disabled=!!io.isBusy?.();return handle;
  }
  function available(control, value) {
    control.dataset.unavailable = String(!value); control.disabled = !value || !!io.isBusy?.();
  }
  function orderControls(key, currentId, label, persistent = true, compact = false) {
    const wrap = el('div',null,{class:'pq-actions'});
    const buttons = [-1,1].map(direction => {
      const word = direction < 0 ? '위로' : '아래로';
      const button = action(compact ? (direction < 0 ? '↑' : '↓') : word,async () => {
        const id = currentId();
        if (!library[key].some(item=>item.id===id)) throw new Error('순서를 바꿀 저장 항목을 선택해 주세요.');
        await commit(moveLibraryItem(library,key,id,direction),'목록 순서를 변경했습니다. 기존 예약의 청크 순서는 유지됩니다.');
        const controls=[...root.querySelectorAll('[data-order-key]')].filter(control=>control.dataset.orderKey===key&&control.dataset.orderId===id&&control.dataset.orderContext===(persistent ? 'editor' : 'row')&&!control.disabled);
        (controls.find(control=>control.dataset.direction===String(direction)) || controls[0])?.focus({preventScroll:true});
      });
      button.setAttribute('aria-label',`${label} ${word}`); button.title=`${label} ${word}`;
      button.dataset.orderContext=persistent ? 'editor' : 'row';
      wrap.append(button); return button;
    });
    function refresh() {
      const id=currentId(),current=library[key].find(item=>item.id===id);
      const items=key==='scenes' ? library.scenes.filter(item=>item.folderId===current?.folderId) : library[key];
      const index=items.findIndex(item=>item.id===id);
      for (let i=0;i<buttons.length;i++) Object.assign(buttons[i].dataset,{orderKey:key,orderId:id || '',direction:String(i===0 ? -1 : 1)});
      available(buttons[0],index>0);available(buttons[1],index>=0&&index<items.length-1);
    }
    if (persistent) orderRefreshers.push(refresh);
    refresh(); return wrap;
  }
  const chunkGroups = () => [{id:'',name:'미분류'},...library.chunkFolders];
  root.append(el('style','#local-pixai-queue .pq-library-order-row{display:flex;align-items:center;gap:7px}#local-pixai-queue .pq-library-order-row>.pq-saved-card{flex:1;min-width:0}#local-pixai-queue [data-library-reorder]>.pq-drag-handle{flex:none;width:24px;min-height:28px;padding:0;border:0;background:transparent;cursor:grab}#local-pixai-queue .pq-folder-group>summary>.pq-drag-handle{float:none;vertical-align:middle;margin:0 6px 0 0}#local-pixai-queue .pq-folder-group>summary[data-library-reorder]>.pq-folder-title{max-width:calc(100% - 80px)}#local-pixai-queue [data-library-reorder][data-drop-position="before"]{box-shadow:inset 0 3px var(--pq-accent,#acd1ed)}#local-pixai-queue [data-library-reorder][data-drop-position="after"]{box-shadow:inset 0 -3px var(--pq-accent,#acd1ed)}'));
  const matchesChunk = (chunk,text) => `${chunk.name}\n${chunk.prompt}\n${chunk.negativePrompt}`.toLocaleLowerCase().includes(text.trim().toLocaleLowerCase());
  function filterChunks(search,filter) {
    return orderedChunks(library).filter(chunk=>matchesChunk(chunk,search)&&(!filter || (filter==='unfiled' ? !chunk.folderId : `folder:${chunk.folderId}`===filter)));
  }
  function folderFilterOptions(select) {
    const selected=select.value;
    selectOptions(select,[{id:'unfiled',name:'미분류'},...library.chunkFolders.map(folder=>({id:`folder:${folder.id}`,name:folder.name}))],'모든 폴더',selected);
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
  root.append(el('style', '.pq-presets details{border-top:1px solid #41474f;margin-top:8px}.pq-presets summary{padding:8px 0;cursor:pointer;font-weight:600}.pq-presets .pq-preset-body{padding-bottom:7px}.pq-presets label{display:block;margin:6px 0;font-size:13px}.pq-presets select{display:block;width:100%;padding:8px;border:1px solid #4a515a;border-radius:7px;background:#151719;color:inherit;font:inherit}.pq-presets textarea{min-height:68px}.pq-presets .pq-lora,.pq-presets .pq-reservation{border:1px solid #41474f;border-radius:8px;padding:8px;margin:6px 0}.pq-presets .pq-inline{display:flex;gap:7px}.pq-presets .pq-inline>*{flex:1;min-width:0}.pq-presets .pq-reservation label{max-width:130px}.pq-presets .pq-preview{white-space:pre-wrap;overflow-wrap:anywhere;max-height:125px;overflow:auto;border-left:2px solid #627d91;padding-left:8px;margin:8px 0;color:#d0d7df}.pq-presets button{font-size:13px}'));
  root.append(el('style','#local-pixai-queue .pq-chunk-list{max-height:210px;overflow:auto;border:1px solid #41474f;border-radius:8px;margin:6px 0}#local-pixai-queue .pq-chunk-option{display:flex;align-items:flex-start;gap:8px;margin:0;padding:8px;cursor:pointer;border-bottom:1px solid #41474f}#local-pixai-queue .pq-chunk-option:last-child{border-bottom:0}#local-pixai-queue .pq-chunk-option input[type="checkbox"]{width:auto;flex:0 0 auto;margin:3px 0;padding:0;accent-color:#94bedf}#local-pixai-queue .pq-chunk-option>span{min-width:0;flex:1}#local-pixai-queue .pq-chunk-option small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}'));
  root.append(el('style','#local-pixai-queue .pq-presets .pq-actions{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0}#local-pixai-queue .pq-presets .pq-actions button{margin:0;padding:6px 9px;min-height:32px}#local-pixai-queue .pq-presets .pq-manager-row{padding:8px;border-top:1px solid #41474f}#local-pixai-queue .pq-presets .pq-manager-row[data-selected="true"]{background:#30363c;border-left:3px solid #94bedf}#local-pixai-queue .pq-presets .pq-manager-row strong{display:block;overflow-wrap:anywhere}#local-pixai-queue .pq-presets .pq-manager-row small{max-height:42px;overflow:hidden;overflow-wrap:anywhere}#local-pixai-queue .pq-presets .pq-folder-group{margin:0;border:0}#local-pixai-queue .pq-presets .pq-folder-group summary{padding:8px;background:#29343d;font-size:13px;overflow-wrap:anywhere}#local-pixai-queue .pq-presets .pq-selected-chunks{padding:8px 10px;border:1px solid #627d91;border-radius:8px;background:#29343d;overflow-wrap:anywhere;font-size:13px}#local-pixai-queue .pq-presets .pq-selected-chunks small{margin-top:3px}#local-pixai-queue .pq-presets .pq-empty{padding:10px;color:#bbc3cc}#local-pixai-queue .pq-presets button[data-unavailable="true"]{opacity:.45;cursor:default}#local-pixai-queue .pq-presets .pq-chunk-list:empty{display:none}'));
  root.append(el('style','#local-pixai-queue .pq-presets .pq-chunk-row-head{display:flex;align-items:center;gap:6px}#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-name-button{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;padding:3px 0;border:0;background:transparent;font-weight:600;font-size:13px}#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-actions{flex:none;margin:0}#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-actions button{width:30px;padding:4px;min-height:30px}#local-pixai-queue .pq-presets .pq-manager-row small{white-space:nowrap;text-overflow:ellipsis;max-height:21px}'));
  // Each screen keeps its DOM and draft when another tab is selected.

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
  let presetOpen=false;
  let renderPresetList = () => {};
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
    presetOpen=true;
    presetName.input.value = value?.name || '';
    modelId.input.value = value?.model?.id || '';
    modelVersionId.input.value = value?.model?.versionId || '';
    modelName.input.value = value?.model?.name || '';
    modelFamily.input.value = value?.model?.family || '';
    loraList.replaceChildren(); loraRows = [];
    for (const lora of value?.loras || []) addLora(lora);
    renderPresetList();
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
  presetSelect.input.addEventListener('change',() => {fillPreset(library.presets.find(item => item.id === presetSelect.input.value));for (const refresh of orderRefreshers) refresh();});
  const modelIdentity=el('details');modelIdentity.append(el('summary','모델 ID 직접 편집'),modelId.wrap,modelVersionId.wrap,modelFamily.wrap);
  presetBody.append(presetSelect.wrap,presetName.wrap,
    el('small','PixAI 화면에서 모델·LoRA를 선택한 뒤 읽어오세요. 읽어오기와 설정 확인은 이미지를 생성하지 않습니다.'),
    siteAction('사이트의 현재 설정 읽기',async () => {
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
  if (io.applySettings) presetBody.append(siteAction('화면에 설정 적용 · 생성 안 함',async () => {
    await io.applySettings(readPreset()); io.notify('프리셋을 화면에 적용했습니다. 이미지는 생성하지 않았습니다.');
  }));
  presetBody.append(action('프리셋 저장',async () => {
    const value = {...readPreset(),id:presetSelect.input.value || crypto.randomUUID(),name:nameValue(presetName.input)};
    const next = copy(library); const index = next.presets.findIndex(item => item.id === value.id);
    if (index < 0) next.presets.push(value); else next.presets[index] = value;
    await commit(next,'모델·LoRA 프리셋을 저장했습니다.');
    presetSelect.input.value = value.id;renderPresetList();for (const refresh of orderRefreshers) refresh();
  }),action('새 프리셋',() => {presetSelect.input.value = '';fillPreset(null);for (const refresh of orderRefreshers) refresh();}),action('선택 프리셋 삭제',async () => {
    const id = presetSelect.input.value;
    if (!id) throw new Error('삭제할 저장 프리셋을 선택해 주세요.');
    const next = copy(library); next.presets = next.presets.filter(item => item.id !== id);
    await commit(next,'프리셋을 삭제했습니다. 이미 등록한 대기열은 유지됩니다. 예약은 다른 프리셋으로 다시 추가해 주세요.');
    fillPreset(null);
  }),orderControls('presets',()=>presetSelect.input.value,'선택 프리셋'));

  const presetBrowse=el('div',null,{class:'pq-library-browse'}),presetForm=el('div',null,{class:'pq-library-editor'});
  const presetMode=el('div',null,{class:'pq-library-mode'});presetBody.dataset.libraryMode='browse';
  function showPresetEditor(value) {presetBody.dataset.libraryMode=value;if (value==='edit') {presetOpen=true;renderPresetList();}for (const control of presetMode.children) control.setAttribute('aria-pressed',String(control.dataset.mode===value));}
  for (const [caption,value] of [['목록 보기','browse'],['편집 보기','edit']]) {
    const control=el('button',caption,{type:'button','data-mode':value});control.addEventListener('click',()=>showPresetEditor(value));presetMode.append(control);
  }
  const presetSearch=field('프리셋 검색','input',{type:'search',placeholder:'이름·모델·LoRA 검색'}),presetList=el('div',null,{class:'pq-saved-list','aria-label':'저장한 설정 목록'});
  presetForm.append(...presetBody.children);presetSelect.wrap.hidden=true;
  renderPresetList=()=>{
    presetForm.remove();presetList.replaceChildren();const query=presetSearch.input.value.trim().toLocaleLowerCase();
    const items=library.presets.filter(item=>`${item.name}\n${item.model.name}\n${item.loras.map(lora=>lora.name).join(' ')}`.toLocaleLowerCase().includes(query));
    if (!items.length) presetList.append(el('small','표시할 프리셋이 없습니다. 사이트 설정을 읽어 저장해 주세요.',{class:'pq-empty'}));
    for (const item of items) {
      const selected=presetSelect.input.value===item.id;
      const control=action(item.name,()=>{if (presetSelect.input.value===item.id) {presetOpen=!presetOpen;renderPresetList();} else {presetSelect.input.value=item.id;fillPreset(item);}if (presetOpen) {presetForm.parentElement?.scrollIntoView?.({block:'start'});presetName.input.focus({preventScroll:true});}for (const refresh of orderRefreshers) refresh();});control.dataset.viewOnly='';
      control.className='pq-saved-card';control.setAttribute('aria-label',`프리셋 편집: ${item.name}`);control.setAttribute('aria-expanded',String(selected && presetOpen));control.setAttribute('aria-pressed',String(selected && presetOpen));control.dataset.presetHeading=item.id;
      const heading=el('span',selected && presetOpen ? presetName.input.value || item.name : item.name,{'data-preset-title':item.id});
      control.textContent='';control.append(heading,el('small',`${item.model.name || item.model.id} · 버전 ${item.model.versionId} · ${item.loras.map(lora=>`${lora.name || lora.id} ${lora.weight}`).join(' / ') || 'LoRA 없음'}`));
      const row=el('div',null,{class:'pq-preset-card'}),header=el('div',null,{class:'pq-library-order-row'});
      header.append(libraryOrderHandle(header,'presets',item,'프리셋'),control);row.append(header);if (selected && presetOpen) row.append(presetForm);presetList.append(row);
    }
    presetForm.hidden=!presetOpen;
    if (!presetForm.parentElement) presetList.append(presetForm);
  };
  presetForm.append(action('프리셋 편집 닫기',()=>{presetOpen=false;renderPresetList();}));
  presetName.input.addEventListener('input',()=>{const title=[...presetList.querySelectorAll('[data-preset-title]')].find(element=>element.dataset.presetTitle===presetSelect.input.value);if (title) title.textContent=presetName.input.value || '이름 없음';});
  presetSearch.input.addEventListener('input',renderPresetList);
  presetBrowse.append(presetSearch.wrap,presetList,action('새 프리셋 만들기',()=>{presetSelect.input.value='';fillPreset(null);showPresetEditor('edit');presetName.input.focus({preventScroll:true});for (const refresh of orderRefreshers) refresh();}));
  const presetLayout=el('div',null,{class:'pq-inline-library'});presetLayout.append(presetBrowse);
  showPresetEditor('browse');presetBody.append(presetMode,presetLayout);

  function promptEditor(key, title, label, placeholder) {
    const body = section(title);
    const layout=el('div',null,{class:`pq-library-layout${key==='scenes' ? ' pq-with-folders' : ''}`});
    const browse=el('div',null,{class:'pq-library-browse'}),editor=el('div',null,{class:'pq-library-editor'});
    let editorOpen=false;
    const mode=el('div',null,{class:'pq-library-mode'});
    function setMode(value) {body.dataset.libraryMode=value;if (key==='scenes' && value==='edit') {editorOpen=true;renderManager();editor.scrollIntoView?.({block:'nearest'});}for (const control of mode.children) control.setAttribute('aria-pressed',String(control.dataset.mode===value));}
    for (const [caption,value] of [['목록 보기','browse'],['편집 보기','edit']]) {
      const control=el('button',caption,{type:'button','data-mode':value});control.addEventListener('click',()=>setMode(value));mode.append(control);
    }
    setMode('browse');body.append(mode,layout);layout.append(browse,editor);
    const select = field(`저장한 ${label}`,'select');
    const name = field(`${label} 이름`);
    const prompt = field(`${label} 프롬프트`,'textarea',{placeholder});
    const negative = field(`${label} 네거티브`,'textarea');
    const folder = key==='scenes' ? field('청크 폴더','select') : null;
    const folderPicker=folder ? buttonPicker(folder,{caption:'소속 폴더'}) : null;
    let resetFolderCreate=()=>{};
    let renderManager = () => {};
    let refreshFolders = () => {};
    let resetView = () => {};
    function fill(value) {
      editorOpen=true;
      name.input.value = value?.name || '';
      prompt.input.value = value?.prompt || '';
      negative.input.value = value?.negativePrompt || '';
      if (folder) {folder.input.value=value?.folderId || '';folderPicker.render();}
      renderManager();
    }
    select.input.addEventListener('change',() => {fill(library[key].find(item => item.id === select.input.value));for (const refresh of orderRefreshers) refresh();});
    if (folder) {
      const rail=el('div',null,{class:'pq-folder-rail','aria-label':'청크 폴더 탐색'});
      const folderButtons=el('div',null,{class:'pq-folder-buttons'});rail.append(el('strong','폴더'),folderButtons);layout.replaceChildren(rail,browse,editor);
      const folderTools=el('details');folderTools.append(el('summary','폴더 관리'));
      const managedFolder=field('관리할 청크 폴더','select');
      const folderName=field('청크 폴더 이름','input',{placeholder:'예: 표정, 행동, 배경'});
      function chooseManagedFolder() {
        folderName.input.value=library.chunkFolders.find(item=>item.id===managedFolder.input.value)?.name || '';
        for (const refresh of orderRefreshers) refresh();
      }
      managedFolder.input.addEventListener('change',chooseManagedFolder);
      const managedFolderPicker=buttonPicker(managedFolder,{onChange:chooseManagedFolder});
      const folderActions=el('div',null,{class:'pq-actions'});
      folderActions.append(action('폴더 저장',async()=>{
        const value={id:managedFolder.input.value || crypto.randomUUID(),name:nameValue(folderName.input)};
        const next=copy(library),index=next.chunkFolders.findIndex(item=>item.id===value.id);
        if (index<0) next.chunkFolders.push(value);else next.chunkFolders[index]=value;
        await commit(next,'청크 폴더를 저장했습니다.');managedFolder.input.value=value.id;
        for (const refresh of orderRefreshers) refresh();
      }),action('새 폴더',()=>{managedFolder.input.value='';folderName.input.value='';for (const refresh of orderRefreshers) refresh();}));
      const removeFolder=action('선택 폴더 삭제',async()=>{
        if (!managedFolder.input.value) throw new Error('삭제할 폴더를 선택해 주세요.');
        await commit(removeChunkFolder(library,managedFolder.input.value),'폴더를 삭제했습니다. 안의 청크는 미분류로 옮겼고 예약은 유지했습니다.');
        folderName.input.value='';
      });
      folderActions.append(removeFolder);
      orderRefreshers.push(()=>available(removeFolder,library.chunkFolders.some(item=>item.id===managedFolder.input.value)));
      folderTools.append(managedFolderPicker.wrap,folderName.wrap,folderActions,orderControls('chunkFolders',()=>managedFolder.input.value,'선택 폴더'),el('small','폴더 삭제 시 안의 청크는 미분류로 이동합니다. 청크와 예약은 지우지 않습니다.'));
      const search=field('청크 검색','input',{type:'search',placeholder:'청크 이름·프롬프트 검색'});
      const filter=field('청크 폴더 필터','select');
      const count=el('small',null,{'aria-label':'청크 목록 개수','role':'status'});
      const list=el('div',null,{class:'pq-chunk-list','aria-label':'저장한 청크 목록'});
      const closed=new Set();
      let draggingChunkId=null,draggingChunkIds=[],managedChunkIds=new Set(),dropBusy=false;
      const management=el('div',null,{class:'pq-chunk-management','aria-label':'선택 청크 관리',title:'체크한 청크에 이동·복제·삭제를 함께 적용합니다.'});
      const selectionSummary=el('small',null,{role:'status','aria-label':'관리 선택 청크 요약'});
      const moveFolder=field('이동할 청크 폴더','select');
      const movePicker=buttonPicker(moveFolder,{caption:'이동할 폴더'});movePicker.wrap.className+=' pq-move-destination';
      const resetMoveCreate=quickFolder(movePicker,'이동 대상',async name=>{
        const editedId=select.input.value,oldFolder=library.scenes.find(item=>item.id===editedId)?.folderId || '',updateDraft=managedChunkIds.has(editedId)&&folder.input.value===oldFolder;
        const next=createChunkFolder(library,name,[...managedChunkIds]),id=next.chunkFolders.at(-1).id;
        await commit(next,`${name} 폴더를 만들고 청크 ${managedChunkIds.size}개를 이동했습니다.`);
        if (updateDraft && select.input.value===editedId && folder.input.value===oldFolder) {folder.input.value=id;folderPicker.render();}
        moveFolder.input.value=id;filter.input.value=`folder:${id}`;renderManager();
      },true);
      resetFolderCreate=quickFolder(folderPicker,'청크 소속',async name=>{
        const next=createChunkFolder(library,name),id=next.chunkFolders.at(-1).id;
        await commit(next,`${name} 폴더를 만들었습니다. 청크 저장을 누르면 새 폴더에 저장됩니다.`);
        folder.input.value=id;folderPicker.render();
      });
      const bulkActions=el('div',null,{class:'pq-actions'});
      const duplicate=action('선택 복제',async()=>{
        const before=new Set(library.scenes.map(item=>item.id)),next=duplicateChunks(library,[...managedChunkIds]);
        await commit(next,`청크 ${managedChunkIds.size}개를 복제했습니다. 복사본을 선택했습니다.`);
        managedChunkIds=new Set(library.scenes.filter(item=>!before.has(item.id)).map(item=>item.id));renderManager();
      });
      const removeSelected=action('선택 삭제',async()=>{
        const count=managedChunkIds.size,editedRemoved=managedChunkIds.has(select.input.value);
        await commit(removeChunks(library,[...managedChunkIds]),`선택한 청크 ${count}개를 삭제했습니다. 삭제된 청크를 참조하는 예약은 다시 구성해 주세요.`);
        if (editedRemoved) fill(null);
      });
      const clearSelection=action('체크 해제',()=>{managedChunkIds.clear();renderManager();});
      bulkActions.append(duplicate,removeSelected,clearSelection);
      const moveRow=el('div',null,{class:'pq-bulk-move'});
      const moveSelected=action('선택 이동',()=>moveChunks([...managedChunkIds],{folderId:moveFolder.input.value}));
      for (const control of [duplicate,removeSelected,clearSelection,moveSelected]) control.dataset.headerFeedback='';
      moveRow.append(movePicker.wrap,moveSelected);management.append(selectionSummary,bulkActions,moveRow);management.hidden=true;
      const dragType='application/x-pixai-queue-chunk';
      function clearDropFeedback() {
        for (const element of root.querySelectorAll('[data-drop-position]')) element.dataset.dropPosition='';
        for (const element of root.querySelectorAll('[data-drop-active]')) element.dataset.dropActive='false';
      }
      function endDrag() {draggingChunkId=null;draggingChunkIds=[];clearDropFeedback();for (const element of root.querySelectorAll('[data-chunk-dragging]')) element.dataset.chunkDragging='false';}
      function updateSelectionSummary() {
        const visible=new Set(filterChunks(search.input.value,filter.input.value).filter(item=>!closed.has(item.folderId || '')).map(item=>item.id));
        const hidden=[...managedChunkIds].filter(id=>!visible.has(id)).length;
        selectionSummary.textContent=`${managedChunkIds.size}개 체크${hidden ? ` · 목록 밖 ${hidden}개 포함` : ''}`;
      }
      function focusChunk(id,folderId) {
        const handle=[...list.querySelectorAll('[data-drag-chunk]')].find(element=>element.dataset.dragChunk===id);
        const destination=[...folderButtons.querySelectorAll('[data-drop-folder]')].find(element=>element.dataset.dropFolder===folderId);
        (handle || destination)?.focus({preventScroll:true});handle?.closest?.('.pq-manager-row')?.scrollIntoView?.({block:'nearest',inline:'nearest'});
      }
      async function moveChunks(ids,destination,focusId=ids[0]) {
        if (dropBusy || io.isBusy?.()) return;
        dropBusy=true;
        try {
          const edited=library.scenes.find(item=>item.id===select.input.value),oldFolder=edited?.folderId || '';
          const originals=selectedChunks(library,ids),next=moveChunksTo(library,ids,destination.folderId,destination.targetId ?? null,!!destination.after);
          if (library.scenes.every((item,index)=>item.id===next.scenes[index]?.id && item.folderId===next.scenes[index]?.folderId)) return;
          const editedId=select.input.value,updateFolder=ids.includes(editedId) && folder.input.value===oldFolder;
          const folderName=library.chunkFolders.find(item=>item.id===destination.folderId)?.name || '미분류';
          await commit(next,`${originals.length===1 ? originals[0].name : `청크 ${originals.length}개`} → ${folderName} · 위치를 저장했습니다. 기존 예약 순서는 유지됩니다.`);
          if (updateFolder && select.input.value===editedId && folder.input.value===oldFolder) {folder.input.value=destination.folderId;folderPicker.render();}
          focusChunk(focusId,destination.folderId);
        } catch(error) {io.notify(`청크 이동 실패: ${error.message}`);}
        finally {dropBusy=false;clearDropFeedback();}
      }
      function acceptsDrag(event) {return event.isTrusted!==false && !dropBusy && !io.isBusy?.() && draggingChunkId && draggingChunkIds.every(id=>library.scenes.some(item=>item.id===id));}
      function dropTarget(element,destination) {
        element.addEventListener('dragover',event=>{
          if (!acceptsDrag(event)) return;
          const target=destination(event);if (!target || draggingChunkIds.includes(target.targetId)) return;
          event.preventDefault();event.stopPropagation();
          if (event.dataTransfer) event.dataTransfer.dropEffect='move';
          clearDropFeedback();
          if (target.targetId) element.dataset.dropPosition=target.after ? 'after' : 'before';else element.dataset.dropActive='true';
        });
        element.addEventListener('dragleave',event=>{
          if (event.relatedTarget && element.contains(event.relatedTarget)) return;
          element.dataset.dropPosition='';element.dataset.dropActive='false';
        });
        element.addEventListener('drop',async event=>{
          if (!acceptsDrag(event)) return;
          const id=draggingChunkId,ids=[...draggingChunkIds],target=destination(event);
          if (!target) return;
          event.preventDefault();event.stopPropagation();
          try {
            if (event.dataTransfer?.getData(dragType)!==JSON.stringify(ids)) return;
            endDrag();await moveChunks(ids,target,id);
          } catch(error) {io.notify(`청크 이동 실패: ${error.message}`);}
          finally {endDrag();}
        });
      }
      renderManager=()=>{
        managedChunkIds=new Set(library.scenes.filter(item=>managedChunkIds.has(item.id)).map(item=>item.id));
        folderButtons.replaceChildren();
        const folders=[{id:'',name:'전체',count:library.scenes.length},{id:'unfiled',name:'미분류',count:library.scenes.filter(item=>!item.folderId).length},...library.chunkFolders.map(item=>({id:`folder:${item.id}`,name:item.name,count:library.scenes.filter(chunk=>chunk.folderId===item.id).length}))];
        for (const item of folders) {
          const control=el('button',null,{type:'button','aria-label':`폴더 보기: ${item.name}`,'aria-pressed':String(filter.input.value===item.id),title:`${item.name} · ${item.count}개`});control.append(el('span',item.name,{class:'pq-folder-label'}),el('small',` · ${item.count}`,{class:'pq-folder-count'}));
          decorateIcon(control,item.id ? 'folder' : 'view_module');
          if (item.id) {control.dataset.dropFolder=item.id==='unfiled' ? '' : item.id.slice(7);dropTarget(control,()=>({folderId:control.dataset.dropFolder}));}
          control.addEventListener('click',()=>{filter.input.value=item.id;renderManager();});folderButtons.append(control);
        }
        const visible=filterChunks(search.input.value,filter.input.value);editor.remove();list.replaceChildren();
        updateSelectionSummary();
        management.hidden=!managedChunkIds.size;
        selectOptions(moveFolder.input,library.chunkFolders,'미분류',moveFolder.input.value);
        for (const control of [duplicate,removeSelected,clearSelection,moveSelected]) available(control,managedChunkIds.size>0);
        count.textContent=`검색 결과 ${visible.length} / 전체 ${library.scenes.length}개 · ⠿ 이동`;count.title='청크 옆 ⠿ 손잡이를 드래그해 순서를 바꾸거나 폴더로 옮깁니다.';
        if (!visible.length) list.append(el('small',library.scenes.length ? '검색에 맞는 청크가 없습니다. 검색어나 폴더 필터를 바꿔 주세요.' : '아래 이름과 프롬프트를 입력해 첫 청크를 저장하세요.',{class:'pq-empty'}));
        for (const group of chunkGroups()) {
          const chunks=visible.filter(item=>(item.folderId || '')===group.id);
          if (!chunks.length && (search.input.value.trim() || (filter.input.value && filter.input.value!==`folder:${group.id}` && !(filter.input.value==='unfiled' && !group.id)))) continue;
          const details=el('details',null,{class:'pq-folder-group','data-chunk-folder':group.id});details.open=!closed.has(group.id);
          const summary=el('summary');summary.append(el('span',`${group.name} · ${chunks.length} / ${library.scenes.filter(item=>(item.folderId || '')===group.id).length}개`,{class:'pq-folder-title'}));
          if (group.id) {const title=summary.children[0];title.remove();summary.append(libraryOrderHandle(summary,'chunkFolders',group,'폴더'),title);}
          if (group.id) {const menu=el('button','⋮',{type:'button','aria-label':`폴더 관리: ${group.name}`});menu.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();managedFolder.input.value=group.id;chooseManagedFolder();managedFolderPicker.render();folderTools.open=true;folderTools.scrollIntoView?.({block:'nearest'});});summary.append(menu);}
          summary.dataset.dropFolder=group.id;dropTarget(summary,()=>({folderId:group.id}));details.append(summary);
          details.addEventListener('toggle',()=>{if (details.open) closed.delete(group.id);else closed.add(group.id);updateSelectionSummary();});
          for (const chunk of chunks) {
            const row=el('div',null,{class:'pq-manager-row','data-selected':String(select.input.value===chunk.id),'data-managed':String(managedChunkIds.has(chunk.id)),'data-chunk-id':chunk.id});
            const checkbox=el('input',null,{type:'checkbox','data-edit':'','aria-label':`청크 관리 선택: ${chunk.name}`});checkbox.checked=managedChunkIds.has(chunk.id);checkbox.disabled=!!io.isBusy?.();
            checkbox.addEventListener('change',()=>{if (io.isBusy?.() || dropBusy) {checkbox.checked=managedChunkIds.has(chunk.id);return;}if (checkbox.checked) managedChunkIds.add(chunk.id);else managedChunkIds.delete(chunk.id);renderManager();const current=[...list.querySelectorAll('input')].find(element=>element.getAttribute('aria-label')===`청크 관리 선택: ${chunk.name}`);current?.focus({preventScroll:true});current?.closest?.('.pq-manager-row')?.scrollIntoView?.({block:'nearest',inline:'nearest'});});
            const handle=el('button','⠿',{type:'button',class:'pq-drag-handle',draggable:'true','data-edit':'','data-drag-chunk':chunk.id,'aria-label':`청크 이동: ${chunk.name}`,title:'드래그해서 순서·폴더 이동 · 키보드 ↑↓로 순서 변경'});
            handle.textContent='';decorateIcon(handle,'drag_indicator');
            handle.disabled=!!io.isBusy?.();
            handle.addEventListener('dragstart',event=>{
              if (event.isTrusted===false || dropBusy || io.isBusy?.() || !event.dataTransfer) {event.preventDefault();return;}
              try {
                const ids=managedChunkIds.has(chunk.id) ? selectedChunks(library,[...managedChunkIds]).map(item=>item.id) : [chunk.id];
                event.dataTransfer.setData(dragType,JSON.stringify(ids));event.dataTransfer.effectAllowed='move';
                event.dataTransfer.setDragImage?.(row,12,12);draggingChunkId=chunk.id;draggingChunkIds=ids;row.dataset.chunkDragging='true';
              } catch {event.preventDefault();endDrag();}
            });
            handle.addEventListener('dragend',endDrag);
            handle.addEventListener('keydown',async event=>{
              if (event.isTrusted===false || !['ArrowUp','ArrowDown'].includes(event.key) || dropBusy || io.isBusy?.()) return;
              event.preventDefault();
              const items=library.scenes.filter(item=>item.folderId===chunk.folderId),index=items.findIndex(item=>item.id===chunk.id),after=event.key==='ArrowDown',target=items[index+(after ? 1 : -1)];
              if (target) await moveChunks([chunk.id],{folderId:chunk.folderId || '',targetId:target.id,after});
            });
            dropTarget(row,event=>({folderId:chunk.folderId || '',targetId:chunk.id,after:event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2}));
            const edit=action(chunk.name,()=>{if (select.input.value===chunk.id) {editorOpen=!editorOpen;renderManager();} else {select.input.value=chunk.id;fill(chunk);}if (editorOpen) {editor.parentElement?.scrollIntoView?.({block:'start'});name.input.focus({preventScroll:true});}for (const refresh of orderRefreshers) refresh();});edit.className='pq-name-button';edit.dataset.viewOnly='';edit.setAttribute('aria-expanded',String(select.input.value===chunk.id && editorOpen));
            edit.setAttribute('aria-label',`청크 편집: ${chunk.name}`);
            const header=el('div',null,{class:'pq-chunk-row-head'});header.append(checkbox,handle,edit,orderControls('scenes',()=>chunk.id,`청크 ${chunk.name}`,false,true));
            row.append(header,el('small',chunk.prompt || `네거티브: ${chunk.negativePrompt}`));if (select.input.value===chunk.id && editorOpen) row.append(editor);details.append(row);
          }
          list.append(details);
        }
        editor.hidden=!editorOpen;if (!editor.parentElement) list.append(editor);
      };
      search.input.addEventListener('input',renderManager);filter.input.addEventListener('change',renderManager);
      refreshFolders=()=>{
        selectOptions(folder.input,library.chunkFolders,'미분류',folder.input.value);
        selectOptions(managedFolder.input,library.chunkFolders,'새 폴더',managedFolder.input.value);
        folderFilterOptions(filter.input);renderManager();
      };
      resetView=()=>{endDrag();managedChunkIds.clear();resetFolderCreate();resetMoveCreate();search.input.value='';filter.input.value='';closed.clear();folderName.input.value=library.chunkFolders.find(item=>item.id===managedFolder.input.value)?.name || '';};
      filter.wrap.hidden=true;rail.append(filter.wrap);rail.hidden=true;
      browse.append(search.wrap,folderTools,count,list);body.append(management);layout.className='pq-inline-library';layout.replaceChildren(browse,rail);
    } else {
      const search=field('캐릭터 검색','input',{type:'search',placeholder:'이름·프롬프트 검색'}),list=el('div',null,{class:'pq-saved-list','aria-label':'저장한 캐릭터 목록'});
      renderManager=()=>{
        list.replaceChildren();const query=search.input.value.trim().toLocaleLowerCase();
        const items=library[key].filter(item=>`${item.name}\n${item.prompt}\n${item.negativePrompt}`.toLocaleLowerCase().includes(query));
        if (!items.length) list.append(el('small','표시할 캐릭터가 없습니다. 새 캐릭터를 만들어 주세요.',{class:'pq-empty'}));
        for (const item of items) {
          const control=action(item.name,()=>{select.input.value=item.id;fill(item);setMode('edit');name.input.focus({preventScroll:true});for (const refresh of orderRefreshers) refresh();});control.dataset.viewOnly='';
          control.className='pq-saved-card';control.setAttribute('aria-label',`캐릭터 편집: ${item.name}`);control.setAttribute('aria-pressed',String(select.input.value===item.id));control.append(el('small',item.prompt || item.negativePrompt));
          const row=el('div',null,{class:'pq-library-order-row'});row.append(libraryOrderHandle(row,key,item,'캐릭터'),control);list.append(row);
        }
      };
      search.input.addEventListener('input',renderManager);refreshFolders=renderManager;resetView=()=>{search.input.value='';};browse.append(search.wrap,list);
      resizable(layout,[browse,editor],'캐릭터',[.32,.68],[190,220]);
    }
    const controls=el('div',null,{class:'pq-actions'});
    controls.append(action(`${label} 저장`,async () => {
      const value = {id:select.input.value || crypto.randomUUID(),name:nameValue(name.input),prompt:prompt.input.value.trim(),negativePrompt:negative.input.value.trim(),...(folder?.input.value ? {folderId:folder.input.value} : {})};
      if (!value.prompt && !value.negativePrompt) throw new Error(`${label} 프롬프트나 네거티브를 입력해 주세요.`);
      const next = copy(library); const index = next[key].findIndex(item => item.id === value.id);
      if (index < 0) next[key].push(value); else next[key][index] = value;
      await commit(next,`${label} 프롬프트를 저장했습니다.`); select.input.value = value.id;renderManager();for (const refresh of orderRefreshers) refresh();
    }),action(`새 ${label}`,() => {select.input.value = '';fill(null);setMode('edit');name.input.focus({preventScroll:true});for (const refresh of orderRefreshers) refresh();}));
    const remove=action(`선택 ${label} 삭제`,async () => {
      const id = select.input.value;
      if (!id) throw new Error(`삭제할 ${label}을 선택해 주세요.`);
      const next = copy(library); next[key] = next[key].filter(item => item.id !== id);
      await commit(next,`${label}을 삭제했습니다. 이미 등록한 대기열은 유지됩니다.`); fill(null);
    });
    controls.append(remove);orderRefreshers.push(()=>available(remove,library[key].some(item=>item.id===select.input.value)));
    controls.append(...orderControls(key,()=>select.input.value,`선택 ${label}`).children);
    if (key==='scenes') controls.append(action('청크 편집 닫기',()=>{editorOpen=false;renderManager();}));
    select.wrap.hidden=true;editor.append(el('strong',`${label} 편집`),select.wrap,name.wrap,...(folder ? [folderPicker.wrap] : []),prompt.wrap,negative.wrap,controls);
    const create=action(`새 ${label} 만들기`,()=>{select.input.value='';fill(null);setMode('edit');name.input.focus({preventScroll:true});for (const refresh of orderRefreshers) refresh();});browse.append(create);
    return {key,select:select.input,label,fill,resetView,refresh:()=>{selectOptions(select.input,key==='scenes' ? orderedChunks(library) : library[key],`새 ${label}`,select.input.value);refreshFolders();}};
  }
  const characterEditor = promptEditor('characters','③ 캐릭터 프롬프트','캐릭터','외모, 의상, 캐릭터 고유 특징');
  const chunkEditor = promptEditor('scenes','④ 프롬프트 청크','청크','표정, 행동, 구도, 배경 등 함께 쓸 프롬프트 조각');
  const reserveBody = section('⑤ 조합 예약',true);
  const reservePreset = field('예약 프리셋','select');
  const reserveCharacter = field('예약 캐릭터','select');
  const reservePresetPicker=buttonPicker(reservePreset,{icon:'tune',caption:'프리셋',empty:false,onChange:preview});
  const reserveCharacterPicker=buttonPicker(reserveCharacter,{icon:'person',caption:'캐릭터',empty:false,onChange:preview});
  const chunkList = el('div',null,{class:'pq-chunk-list','aria-label':'예약 청크 목록'});
  const chunkSearch = field('예약 청크 검색','input',{type:'search',placeholder:'함께 쓸 청크 이름·프롬프트 검색'});
  const chunkFilter = field('예약 청크 폴더 필터','select');
  const chunkFilterPicker=buttonPicker(chunkFilter,{caption:'청크 폴더',editable:false,onChange:()=>{renderChunkChoices();preview();}});
  const chunkCount = el('div',null,{class:'pq-selected-chunks','aria-label':'선택한 청크 요약','role':'status'});
  const pickerClosed = new Set();
  let groupSummaries = new Map();
  let selectedChunkIds = new Set();
  let missingMaterials=[],loadedCombination=false,recipeDrag=null,triggerPosition=1;
  const reserveCount = field('이 조합의 생성 횟수','input',{type:'number',min:'1',max:'100',value:'1'});
  const combined = el('div',null,{class:'pq-preview','aria-label':'저장한 프롬프트 조합 미리보기'});
  const sequenceList=el('div',null,{class:'pq-sequence-list','aria-label':'합쳐지는 순서'});
  const missingNotice=el('div',null,{class:'pq-missing-notice',role:'status'});
  const acknowledgeMissing=action('누락 재료 제외하고 계속',()=>{missingMaterials=[];preview();});
  const selectedChunksInOrder=()=>[...selectedChunkIds].map(id=>library.scenes.find(chunk=>chunk.id===id)).filter(Boolean);
  const recipe=()=>({presetId:reservePreset.input.value,characterId:reserveCharacter.input.value,sceneIds:[...selectedChunkIds],triggerPosition,count:repeatValue(reserveCount.input)});
  function sequenceKeys() {
    const keys=['common','character',...[...selectedChunkIds].map(id=>'chunk:'+id)];
    keys.splice(triggerPosition==='end' ? keys.length : Math.min(triggerPosition,keys.length),0,'trigger');return keys;
  }
  function movedSequence(id,target,after=false) {
    const keys=sequenceKeys();if (id===target || !keys.includes(id) || !keys.includes(target) || !['trigger',...keys.filter(key=>key.startsWith('chunk:'))].includes(id)) return null;
    keys.splice(keys.indexOf(id),1);keys.splice(keys.indexOf(target)+(after ? 1 : 0),0,id);
    const fixed=keys.filter(key=>key!=='trigger');if (fixed[0]!=='common' || fixed[1]!=='character') return null;return keys;
  }
  function moveRecipe(id,target,after=false) {
    if (io.isBusy?.()) return;
    const keys=movedSequence(id,target,after);if (!keys) return;
    selectedChunkIds=new Set(keys.filter(key=>key.startsWith('chunk:')).map(key=>key.slice(6)));
    const position=keys.indexOf('trigger');triggerPosition=position===keys.length-1 ? 'end' : position;preview();
  }
  function renderSequence(preset,character,chunks) {
    sequenceList.replaceChildren();
    const materials=[{id:'common',name:'공통문',text:library.common.prompt},{id:'character',name:'캐릭터',text:character?.prompt},
      {id:'trigger',name:'LoRA 트리거',text:preset?.loras.map(item=>item.triggerWords || '').filter(Boolean).join(', ')},
      ...chunks.map((chunk,index)=>({id:'chunk:'+chunk.id,name:chunk.name,text:chunk.prompt || chunk.negativePrompt,chunk,index}))];
    const keys=sequenceKeys();
    for (const [order,key] of keys.entries()) {
      const item=materials.find(material=>material.id===key),movable=item.id==='trigger' || !!item.chunk;
      const row=el('div',null,{class:movable ? 'pq-recipe-row' : 'pq-fixed-material','data-recipe-material':item.id});
      if (item.chunk) row.dataset.recipeChunk=item.chunk.id;
      const handle=movable ? el('button',null,{type:'button','data-edit':'',draggable:'true','aria-label':item.chunk ? '조합 청크 이동: '+item.name : 'LoRA 트리거 이동',title:'끌어서 조합 순서 변경'}) : null;
      if (handle) {decorateIcon(handle,'drag_indicator');handle.disabled=!!io.isBusy?.();
        handle.style.touchAction='none';
        let pointerDrag=null;
        if (document.elementFromPoint) handle.setAttribute('draggable','false');
        function pointerTarget(event) {
          const target=document.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-recipe-material]');
          if (!target || !sequenceList.contains(target) || target.dataset.recipeMaterial===item.id) return null;
          return {id:target.dataset.recipeMaterial,element:target,after:event.clientY>=target.getBoundingClientRect().top+target.getBoundingClientRect().height/2};
        }
        function clearPointer() {pointerDrag=null;for (const row of sequenceList.querySelectorAll('[data-drop-position]')) row.dataset.dropPosition='';}
        handle.addEventListener('pointerdown',event=>{
          if (!document.elementFromPoint || event.isTrusted===false || io.isBusy?.() || event.button!==0 || event.isPrimary===false) return;
          event.preventDefault();pointerDrag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};handle.setPointerCapture?.(event.pointerId);
        });
        handle.addEventListener('pointermove',event=>{
          if (!pointerDrag || event.pointerId!==pointerDrag.id || event.isTrusted===false || io.isBusy?.()) return;
          if (Math.hypot(event.clientX-pointerDrag.x,event.clientY-pointerDrag.y)<5 && !pointerDrag.moved) return;
          pointerDrag.moved=true;const target=pointerTarget(event);for (const row of sequenceList.querySelectorAll('[data-drop-position]')) row.dataset.dropPosition='';if (target) target.element.dataset.dropPosition=target.after ? 'after' : 'before';
        });
        handle.addEventListener('pointerup',event=>{
          if (!pointerDrag || event.pointerId!==pointerDrag.id) return;
          const target=pointerDrag.moved && event.isTrusted!==false && !io.isBusy?.() ? pointerTarget(event) : null;clearPointer();if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);if (target) moveRecipe(item.id,target.id,target.after);
        });
        handle.addEventListener('pointercancel',clearPointer);handle.addEventListener('lostpointercapture',clearPointer);
        const type='application/x-pixai-combination-order';
        handle.addEventListener('dragstart',event=>{if (event.isTrusted===false || io.isBusy?.() || !event.dataTransfer) {event.preventDefault();return;}recipeDrag=item.id;event.dataTransfer.setData(type,item.id);event.dataTransfer.effectAllowed='move';});
        handle.addEventListener('dragend',()=>{recipeDrag=null;for (const row of sequenceList.querySelectorAll('[data-drop-position]')) row.dataset.dropPosition='';});
      }
      const type='application/x-pixai-combination-order';
      row.addEventListener('dragover',event=>{if (event.isTrusted===false || io.isBusy?.() || !recipeDrag || recipeDrag===item.id) return;event.preventDefault();row.dataset.dropPosition=event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2 ? 'after' : 'before';});
      row.addEventListener('dragleave',()=>{row.dataset.dropPosition='';});
      row.addEventListener('drop',event=>{if (event.isTrusted===false || io.isBusy?.() || !recipeDrag || event.dataTransfer?.getData(type)!==recipeDrag) return;event.preventDefault();const id=recipeDrag;recipeDrag=null;moveRecipe(id,item.id,event.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2);});
      const title=el('div',null,{class:'pq-recipe-title'});title.append(el('strong',item.chunk ? (item.index+1)+'. '+item.name : item.name),el('small',item.text || '없음'));
      if (!movable) {row.append(title);sequenceList.append(row);continue;}
      const controls=el('div',null,{class:'pq-actions'});
      for (const direction of [-1,1]) {const target=keys[order+direction],control=action(direction<0 ? '↑' : '↓',()=>{if (target) moveRecipe(item.id,target,direction>0);});control.setAttribute('aria-label',item.chunk ? '조합 '+item.name+' '+(direction<0 ? '위로' : '아래로') : 'LoRA 트리거 '+(direction<0 ? '위로' : '아래로'));available(control,!!target && !!movedSequence(item.id,target,direction>0));controls.append(control);}
      if (item.chunk) {const remove=action('×',()=>{selectedChunkIds.delete(item.chunk.id);renderChunkChoices();preview();});remove.setAttribute('aria-label','조합에서 제외: '+item.name);controls.append(remove);}
      row.append(handle,title,controls);sequenceList.append(row);
    }
    if (!chunks.length) sequenceList.append(el('small','왼쪽에서 청크를 체크하면 선택한 순서대로 쌓입니다.',{class:'pq-empty'}));
    for (const label of chunkList.querySelectorAll('[data-selection-id]')) {const index=[...selectedChunkIds].indexOf(label.dataset.selectionId);label.textContent=index<0 ? '' : String(index+1);}
  }
  const reservations = el('div',null,{class:'pq-reservation-list'});
  const visibleChunks = () => filterChunks(chunkSearch.input.value,chunkFilter.input.value).filter(chunk=>!pickerClosed.has(chunk.folderId || ''));
  const selectVisible = action('보이는 청크 모두 선택',()=>{for (const chunk of visibleChunks()) selectedChunkIds.add(chunk.id);renderChunkChoices();preview();});
  const clearSelected = action('청크 선택 전부 해제',()=>{selectedChunkIds.clear();renderChunkChoices();preview();});
  selectVisible.setAttribute('aria-label','보이는 청크 모두 선택');selectVisible.textContent='모두 선택';decorateIcon(selectVisible,'playlist_add');
  clearSelected.setAttribute('aria-label','청크 선택 전부 해제');clearSelected.textContent='선택 해제';decorateIcon(clearSelected,'close');
  const choiceActions=el('div',null,{class:'pq-actions'});choiceActions.append(selectVisible,clearSelected);
  function preview() {
    const preset = library.presets.find(item => item.id === reservePreset.input.value);
    const character = library.characters.find(item => item.id === reserveCharacter.input.value);
    const chunks = selectedChunksInOrder();
    if (triggerPosition!=='end') triggerPosition=Math.min(triggerPosition,chunks.length+2);
    const {prompt,negativePrompt} = composePresetPrompts(library.common,character || {},chunks,preset || {loras:[]},triggerPosition);
    const visible=visibleChunks(),visibleIds=new Set(visible.map(chunk=>chunk.id)),hidden=chunks.filter(chunk=>!visibleIds.has(chunk.id)).length;
    chunkCount.textContent = chunks.length ? `${chunks.length}개 선택 · ${chunks.map(chunk=>chunk.name).join(' · ')}` : '선택한 청크 없음 · 청크 없이 예약할 수 있습니다.';
    chunkCount.append(el('small',hidden ? `현재 목록 밖에 선택 ${hidden}개가 있습니다. 선택한 청크는 모두 함께 예약됩니다.` : '선택 순서대로 합칩니다. 가운데 목록에서 끌어 순서를 바꿀 수 있습니다.'));
    selectVisible.title=`검색·필터에 맞고 펼쳐진 목록의 청크 ${visible.length}개를 추가 선택합니다. 기존 선택도 유지합니다.`;
    available(selectVisible,visible.some(chunk=>!selectedChunkIds.has(chunk.id)));available(clearSelected,chunks.length>0);
    for (const group of chunkGroups()) {
      const all=library.scenes.filter(chunk=>(chunk.folderId || '')===group.id),selected=all.filter(chunk=>selectedChunkIds.has(chunk.id)).length;
      const summary=groupSummaries.get(group.id);
      if (summary) summary.textContent=`${group.name} · 선택 ${selected} / 전체 ${all.length}개`;
    }
    combined.textContent = `전송 프롬프트\n${prompt || '(비어 있음)'}${negativePrompt ? `\n\n네거티브\n${negativePrompt}` : ''}`;
    missingMaterials=missingMaterials.filter(item=>item==='프리셋' ? !preset : item==='캐릭터' ? !character : true);
    missingNotice.hidden=!missingMaterials.length;missingNotice.textContent=missingMaterials.length ? `불러온 조합에서 없는 재료: ${missingMaterials.join(', ')}. 다시 선택하거나 누락 재료 제외를 확인해 주세요.` : '';
    if (missingMaterials.length) missingNotice.append(acknowledgeMissing);
    available(addReservation,!!preset && !!character && !missingMaterials.length && !!prompt);available(favoriteCurrent,!!preset && !!character && !missingMaterials.length && !!prompt);
    renderSequence(preset,character,chunks);
  }
  for (const select of [reservePreset.input,reserveCharacter.input]) select.addEventListener('change',preview);
  function renderChunkChoices() {
    for (const id of selectedChunkIds) if (!library.scenes.some(item=>item.id===id)) {missingMaterials.push(`청크 ${id}`);selectedChunkIds.delete(id);}
    missingMaterials=[...new Set(missingMaterials)];
    chunkList.replaceChildren();groupSummaries=new Map();
    const visible=filterChunks(chunkSearch.input.value,chunkFilter.input.value);
    if (!visible.length) chunkList.append(el('small',library.scenes.length ? '검색에 맞는 청크가 없습니다. 기존 선택은 위 요약에 유지됩니다.' : '청크 탭에서 청크를 저장해 주세요. 청크 없이 예약할 수도 있습니다.',{class:'pq-empty'}));
    for (const group of chunkGroups()) {
      const chunks=visible.filter(chunk=>(chunk.folderId || '')===group.id);
      if (!chunks.length) continue;
      const details=el('details',null,{class:'pq-folder-group','data-picker-folder':group.id});details.open=!pickerClosed.has(group.id);
      const summary=el('summary');groupSummaries.set(group.id,summary);details.append(summary);
      details.addEventListener('toggle',()=>{if (details.open) pickerClosed.delete(group.id);else pickerClosed.add(group.id);preview();});
      for (const chunk of chunks) {
        const checkbox = el('input',null,{type:'checkbox','data-edit':'','aria-label':`청크 선택: ${chunk.name}`});
        checkbox.disabled=!!io.isBusy?.();
        checkbox.checked = selectedChunkIds.has(chunk.id);
        checkbox.addEventListener('change',()=>{
          if (io.isBusy?.()) {checkbox.checked=selectedChunkIds.has(chunk.id);return;}
          if (checkbox.checked) selectedChunkIds.add(chunk.id); else selectedChunkIds.delete(chunk.id);
          preview();
        });
        const name = el('span',chunk.name);name.append(el('small',chunk.prompt || `네거티브: ${chunk.negativePrompt}`));
        const label = el('label',null,{class:'pq-chunk-option'});label.append(checkbox,name,el('span',null,{class:'pq-selection-number','data-selection-id':chunk.id}));details.append(label);
      }
      chunkList.append(details);
    }
  }
  chunkSearch.input.addEventListener('input',()=>{renderChunkChoices();preview();});
  chunkFilter.input.addEventListener('change',()=>{renderChunkChoices();preview();});
  function refreshLists() {
    selectOptions(presetSelect.input,library.presets,'새 프리셋',presetSelect.input.value);
    renderPresetList();
    for (const editor of [characterEditor,chunkEditor]) editor.refresh();
    selectOptions(reservePreset.input,library.presets,'프리셋 선택',reservePreset.input.value,!loadedCombination);
    selectOptions(reserveCharacter.input,library.characters,'캐릭터 선택',reserveCharacter.input.value,!loadedCombination);
    folderFilterOptions(chunkFilter.input);renderChunkChoices();for (const refresh of orderRefreshers) refresh();
  }
  function renderReservations() {
    reservations.replaceChildren();
    if (!library.reservations.length) reservations.append(el('small','저장한 프리셋·캐릭터를 고르고 사용할 청크를 체크해 조합을 추가하세요.'));
    for (const reservation of library.reservations) {
      const row = el('div',null,{class:'pq-reservation'});
      const preset = reservation.snapshot?.preset || library.presets.find(item => item.id === reservation.presetId);
      const character = reservation.snapshot?.character || library.characters.find(item => item.id === reservation.characterId);
      const chunkNames = reservation.snapshot ? reservation.snapshot.chunks.map(chunk=>chunk.name) : reservation.sceneIds.map(id=>library.scenes.find(item=>item.id===id)?.name || '(삭제된 청크)');
      row.append(el('strong',`${character?.name || '(삭제된 캐릭터)'} · ${chunkNames.join(' + ') || '청크 없음'}`),
        el('small',`${preset?.name || '(삭제된 프리셋)'} · ${reservation.count}회${reservation.snapshot ? ' · 추가 시점의 설정 보관' : ''}`),action('이 예약 제외',async () => {
          const next = copy(library); next.reservations = next.reservations.filter(item => item.id !== reservation.id);
          await commit(next,'선택한 예약을 제외했습니다. 이미 등록한 대기열은 유지됩니다.');
        }),orderControls('reservations',()=>reservation.id,`예약 ${character?.name || '삭제된 캐릭터'} ${chunkNames.join(' + ') || '청크 없음'}`,false,true));
      reservations.append(row);
    }
    renderHistory();
  }
  let scheduleTab='reservations';
  const scheduleTabs=el('div',null,{class:'pq-schedule-tabs','aria-label':'조합 보관함'});
  const recentList=el('div',null,{class:'pq-history-list','aria-label':'최근 조합'}),favoritesList=el('div',null,{class:'pq-history-list','aria-label':'즐겨찾기 조합'});
  const scheduleLists={reservations,recent:recentList,favorites:favoritesList};
  function showSchedule(id) {scheduleTab=id;for (const [key,list] of Object.entries(scheduleLists)) list.hidden=key!==id;for (const button of scheduleTabs.children) button.setAttribute('aria-pressed',String(button.dataset.schedule===id));}
  for (const [id,name] of [['reservations','예약'],['recent','최근'],['favorites','즐겨찾기']]) {const button=el('button',name,{type:'button','data-schedule':id});button.addEventListener('click',()=>showSchedule(id));scheduleTabs.append(button);}
  function loadCombination(entry) {
    if (io.isBusy?.()) return;
    const resolved=resolveCombination(library,entry);
    loadedCombination=true;missingMaterials=resolved.missing;
    reservePreset.input.value=resolved.presetId;reserveCharacter.input.value=resolved.characterId;reserveCount.input.value=String(resolved.count);selectedChunkIds=new Set(resolved.sceneIds);triggerPosition=resolved.triggerPosition ?? 1;
    reservePresetPicker.render();reserveCharacterPicker.render();renderChunkChoices();preview();
    io.notify(resolved.missing.length ? `조합을 불러왔지만 없는 재료가 있습니다: ${resolved.missing.join(', ')}. 확인 전에는 예약하지 않습니다.` : '조합을 불러왔습니다. 현재 라이브러리 내용으로 미리보기를 확인해 주세요.');
  }
  async function toggleFavorite(entry) {
    const next=copy(library),target=next.combinations.find(item=>item.id===entry.id);target.favorite=!target.favorite;
    let plain=0;next.combinations=next.combinations.filter(item=>item.favorite || ++plain<=50);
    await commit(next,target.favorite ? '즐겨찾기에 저장했습니다. 카드에서 이름을 붙일 수 있습니다.' : '즐겨찾기를 해제했습니다.');
  }
  function renderHistory() {
    recentList.replaceChildren();favoritesList.replaceChildren();
    const all=library.combinations || [];
    for (const [list,entries] of [[recentList,all.slice(0,50)],[favoritesList,all.filter(item=>item.favorite)]]) {
      if (!entries.length) list.append(el('small',list===recentList ? '예약을 추가하면 조합이 여기에 기록됩니다.' : '☆로 자주 쓰는 조합을 저장하세요.',{class:'pq-empty'}));
      for (const entry of entries) {
        const row=el('div',null,{class:'pq-history-card','data-combination-id':entry.id});
        const preset=library.presets.find(item=>item.id===entry.presetId),character=library.characters.find(item=>item.id===entry.characterId),chunks=entry.sceneIds.map(id=>library.scenes.find(item=>item.id===id)?.name || '(삭제된 청크)');
        row.append(el('strong',entry.name || `${character?.name || '(삭제된 캐릭터)'} · ${chunks.join(' + ') || '청크 없음'}`),el('small',`${preset?.name || '(삭제된 프리셋)'} · ${entry.count}회`));
        const controls=el('div',null,{class:'pq-actions'});
        const load=action('불러오기',()=>loadCombination(entry));load.setAttribute('aria-label',`조합 불러오기: ${entry.id}`);
        const star=action(entry.favorite ? '★' : '☆',()=>toggleFavorite(entry));star.setAttribute('aria-label',`조합 즐겨찾기: ${entry.id}`);star.setAttribute('aria-pressed',String(entry.favorite));
        const remove=action('기록 삭제',async()=>{const next=copy(library);next.combinations=next.combinations.filter(item=>item.id!==entry.id);await commit(next,'조합 기록을 삭제했습니다. 예약과 대기열은 유지됩니다.');});remove.setAttribute('aria-label',`조합 기록 삭제: ${entry.id}`);
        controls.append(load,star,remove);row.append(controls);
        if (entry.favorite) {
          const name=field(`즐겨찾기 이름: ${entry.id}`,'input',{placeholder:'즐겨찾기 이름',maxlength:'200'});name.wrap.textContent='즐겨찾기 이름';name.wrap.append(name.input);name.input.value=entry.name;
          const save=action('이름 저장',async()=>{const next=copy(library);next.combinations.find(item=>item.id===entry.id).name=name.input.value.trim();await commit(next,'즐겨찾기 이름을 저장했습니다.');});save.setAttribute('aria-label',`즐겨찾기 이름 저장: ${entry.id}`);row.append(name.wrap,save);
        }
        list.append(row);
      }
    }
    showSchedule(scheduleTab);
  }
  const choiceFilters=el('div',null,{class:'pq-choice-filters'});choiceFilters.append(chunkSearch.wrap,chunkFilter.wrap);
  const choices=el('div',null,{class:'pq-compose-choices'}),review=el('div',null,{class:'pq-compose-review'}),schedule=el('div',null,{class:'pq-compose-schedule'}),composeLayout=el('div',null,{class:'pq-compose-layout'});
  const selectors=el('div',null,{class:'pq-inline pq-reserve-selectors'});selectors.append(reservePresetPicker.wrap,reserveCharacterPicker.wrap);
  choices.append(el('strong','조합 만들기'),selectors,el('strong','함께 쓸 청크'),choiceFilters,choiceActions,chunkCount,chunkList);
  const addReservation=action('이 조합 예약 추가',async () => {
      if (missingMaterials.length) throw new Error('누락 재료를 확인한 뒤 예약해 주세요.');
      const combination=recipe(),{presetId,characterId,sceneIds}=combination;
      if (!library.presets.some(item => item.id === presetId) || !library.characters.some(item => item.id === characterId)) throw new Error('저장한 프리셋·캐릭터를 모두 선택해 주세요.');
      const next = rememberCombination(library,combination);
      next.reservations.push({id:crypto.randomUUID(),...combination,snapshot:snapshotCombination(library,combination)});
      await commit(next,'조합을 예약하고 최근 목록에 기록했습니다. 대기열에 등록한 뒤 시작해 주세요.');showSchedule('reservations');
    });
  const favoriteCurrent=action('☆',async()=>{if (missingMaterials.length) throw new Error('누락 재료를 확인해 주세요.');const combination=recipe();snapshotCombination(library,combination);await commit(rememberCombination(library,combination,{favorite:true}),'현재 조합을 즐겨찾기에 저장했습니다.');showSchedule('favorites');});favoriteCurrent.setAttribute('aria-label','현재 조합 즐겨찾기');
  const reservationActions=el('div',null,{class:'pq-reserve-actions'});reservationActions.append(addReservation,favoriteCurrent);
  const register=action('예약 전부를 대기열에 등록',async () => {
      if (!library.reservations.length) throw new Error('조합 예약을 먼저 추가해 주세요.');
      await io.enqueue(copy(library));
    });register.dataset.headerFeedback='';
  review.append(el('strong','합쳐지는 순서'),sequenceList,el('strong','전송 미리보기'),combined,missingNotice);
  schedule.append(reserveCount.wrap,reservationActions,scheduleTabs,reservations,recentList,favoritesList);
  const composeMode=el('div',null,{class:'pq-compose-mode'});
  for (const [id,name] of [['choices','재료'],['review','순서·미리보기'],['schedule','예약·기록']]) {const button=el('button',name,{type:'button','data-compose-mode':id});button.addEventListener('click',()=>{reserveBody.dataset.composeMode=id;for (const control of composeMode.children) control.setAttribute('aria-pressed',String(control===button));});composeMode.append(button);}
  reserveBody.dataset.composeMode='choices';composeMode.children[0].setAttribute('aria-pressed','true');
  resizable(composeLayout,[choices,review,schedule],'조합 예약',[.35,.35,.30],[250,260,220]);reserveBody.append(composeMode,composeLayout);
  const registrationBar=el('div',null,{class:'pq-registration-bar'}),reservationTotals=el('span',null,{role:'status'});registrationBar.append(reservationTotals,register);root.append(registrationBar);
  const originalRenderReservations=renderReservations;
  renderReservations=function() {originalRenderReservations();reservationTotals.textContent=`예약 ${library.reservations.length}조합 · ${library.reservations.reduce((sum,item)=>sum+item.count,0)}회`;available(register,library.reservations.length>0);};
  libraryPage=section('라이브러리',false,'library');
  const libraryNavigation=el('div',null,{class:'pq-library-tabs',role:'tablist','aria-label':'라이브러리 종류'});
  for (const id of libraryIds) {const view=views.find(item=>item.id===id);libraryNavigation.append(view.tab);libraryPage.append(view.body);}
  libraryPage.replaceChildren(libraryNavigation,...libraryIds.map(id=>views.find(item=>item.id===id).body));
  navigation.replaceChildren(...['compose','library'].map(id=>views.find(item=>item.id===id).tab));
  libraryTab='chunks';
  showPage('compose');
  refreshLists(); renderReservations(); preview(); parent.append(root);
  return {
    root,
    showPage,
    addPage:(id,title,...content)=>{const body=section(title,false,id);body.append(...content);runtimePages.push(body);return body;},
    // Library/compose controls may be used while this tab's runner is busy; runtime pages and site-touching buttons may not.
    allowsWhileRunning:element=>root.contains(element) && !runtimePages.some(page=>page.contains(element)) && element.dataset?.siteIo == null,
    refresh:() => {library = normalizePresetLibrary(io.load() || makePresetLibrary());refreshLists();renderReservations();preview();},
    reload:() => {
      const next=normalizePresetLibrary(io.load() || makePresetLibrary());
      library=next;selectedChunkIds=new Set();missingMaterials=[];loadedCombination=false;triggerPosition=1;
      presetSearch.input.value='';
      chunkSearch.input.value='';chunkFilter.input.value='';pickerClosed.clear();
      for (const editor of [characterEditor,chunkEditor]) editor.resetView();
      refreshLists();
      commonPrompt.input.value=library.common.prompt;commonNegative.input.value=library.common.negativePrompt;
      fillPreset(library.presets.find(item=>item.id===presetSelect.input.value));
      for (const editor of [characterEditor,chunkEditor]) editor.fill(library[editor.key].find(item=>item.id===editor.select.value));
      reserveCount.input.value='1';renderReservations();preview();
    }
  };
}

  // GraphQL 조회 실패를 HTTP 상태·오류 코드별로 구분한다. 응답 본문 전체·헤더·인증값은 보관하지 않는다.
  function describeQueryFailure(status, payload) {
    const isAuthCode = value => /^(unauthorized|unauthenticated)$/i.test(value);
    const list = Array.isArray(payload?.errors) ? payload.errors.filter(item => item && typeof item === "object") : [];
    const codeOf = item => { const raw = item?.extensions?.code; return typeof raw === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw.trim()) ? raw.trim() : ""; };
    const first = list.find(item => isAuthCode(codeOf(item))) || list[0] || null;
    const code = codeOf(first);
    const detail = (typeof first?.message === "string" ? first.message : "").slice(0, 400).replace(/\s+/g, " ").trim().slice(0, 120);
    const tail = " 로그인 문제로 단정할 수 없습니다. 작업 ID와 저장 내역은 유지됩니다.";
    if (status === 401 || isAuthCode(code)) return Object.assign(new Error("조회 인증 실패 (" + (status || 200) + (code ? ", " + code : "") + "). PixAI 로그인 상태를 확인해 주세요. 작업 ID와 저장 내역은 유지됩니다."), {status, code, stage: "auth"});
    if (status === 403) return Object.assign(new Error("조회 접근 거부 (403" + (code ? ", " + code : "") + ")." + tail), {status, code, stage: "forbidden"});
    if (status >= 500) return Object.assign(new Error("PixAI 서버 오류 (" + status + "). 잠시 후 같은 작업 ID로 다시 확인해 주세요."), {status, code, stage: "server"});
    if (payload === null) return Object.assign(new Error("조회 응답이 JSON이 아닙니다 (" + status + "). 네트워크 차단·점검 페이지일 수 있습니다." + tail), {status, code: "", stage: "non-json"});
    if (code === "GRAPHQL_VALIDATION_FAILED" || code === "BAD_USER_INPUT" || status === 400 || status === 422) {
      return Object.assign(new Error("조회 형식 오류 (" + (status || 200) + (code ? ", " + code : "") + "): 스크립트의 조회 형식이 사이트와 맞지 않습니다." + (detail ? " [" + detail + "]" : "") + tail), {status, code, stage: "validation"});
    }
    return Object.assign(new Error("조회 실패 (" + status + (code ? ", " + code : "") + ")." + (detail ? " [" + detail + "]" : "") + tail), {status, code, stage: "other"});
  }
  // fetchImpl는 호출자가 넘긴다(브라우저: 사이트 쿠키 포함 fetch). 결과는 data만 돌려주고 실패는 describeQueryFailure로 구분한다.
  async function graphqlQuery(fetchImpl, operation, query, variables, {signal} = {}) {
    let response;
    try {
      response = await fetchImpl("https://api.pixai.art/graphql?operation=" + encodeURIComponent(operation), {
        method: "POST", credentials: "include", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({operationName: operation, query, variables}), signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw Object.assign(new Error("조회 시간 초과. 같은 작업 ID로 다시 확인할 수 있습니다."), {status: 0, code: "", stage: "timeout"});
      throw Object.assign(new Error("조회 요청을 보내지 못했습니다 (네트워크 오류). 작업 ID와 저장 내역은 유지됩니다."), {status: 0, code: "", stage: "network"});
    }
    let payload = null;
    try { payload = await response.json(); } catch (error) {
      if (error?.name === "AbortError") throw Object.assign(new Error("조회 시간 초과. 같은 작업 ID로 다시 확인할 수 있습니다."), {status: 0, code: "", stage: "timeout"});
      payload = null;
    }
    if (!response.ok || !payload || payload.errors?.length || !payload.data) throw describeQueryFailure(response.status, payload);
    return payload.data;
  }

  // 원본 조회: 사이트 스키마는 media(id: String!). fileUrl은 null일 수 있고 실제 원본은 urls의 PUBLIC(/images/orig/) 변형이다.
  const MEDIA_QUERY = "query getMedia($id: String!) { media(id: $id) { id width height imageType fileUrl urls { variant url } } }";
  function pickOriginalMedia(media, mediaId) {
    if (!media || String(media.id) !== String(mediaId)) throw new Error("원본 이미지 정보를 확인하지 못했습니다 (ID 불일치). 저장하지 않습니다.");
    const urls = Array.isArray(media.urls) ? media.urls.filter(item => item && typeof item.url === "string" && item.url) : [];
    const found = urls.find(item => item.variant === "PUBLIC");
    const url = found ? found.url : (typeof media.fileUrl === "string" ? media.fileUrl : "");
    if (!url) throw new Error("원본 이미지 URL을 확인하지 못했습니다 (제공된 variant: " + (urls.map(item => item.variant).join(", ") || "없음") + "). 썸네일로 대체하지 않고 저장하지 않습니다.");
    return {url, variant: found ? "PUBLIC" : "fileUrl", width: Number.isInteger(media.width) ? media.width : null, height: Number.isInteger(media.height) ? media.height : null};
  }
  function mediaUrlAllowed(href) {
    const url = new URL(href);
    // Confirmed by the official /v1/media/{id}/image redirect for all four
    // outputs on 2026-10-08. Do not allow arbitrary CloudFront distributions.
    if (url.protocol !== "https:" || !(url.hostname === "pixai.art" || url.hostname.endsWith(".pixai.art") || url.hostname === "d2doj8oszwtcqy.cloudfront.net")) throw new Error("예상하지 못한 원본 이미지 호스트입니다. 저장하지 않습니다.");
    return url;
  }
  const API_RATIOS=['1:1','2:3','3:2','3:4','4:3','3:5','5:3','9:16','16:9','1:3','3:1'];
  const API_STYLES=['anime-watercolor-impasto','art-crayon','bold-line-soft-color','chibi','classic-japanese','clean-flat-illustration','colored-pencil-grain','cool-warm-oil-contrast','desaturated-cool','flat-anime-pastel','glossy-glass-anime','grey-blocks-lineless','hard-line-monochrome-accent','high-contrast-retro-vivid','holographic','korean-style','lineart-watercolor-airy','low-saturation-expressive-eyes','lucid-dreamy','luminous-retro-impasto','minimal-flat-color','modern-oil-glamour','moe-pastel','oil-watercolor-blend','painterly-doodle','paper-watercolor','pencil-sketch','poster-graffiti','retro-comic-fusion','retro-oil-glamour','retro-tv-anime','semi-realistic','stable-vaporwave','tinted-sketch','vintage-collage'];
  function normalizeApiOptions(value={}) {
    const s=presetObject(value,'공식 API 옵션');
    if (Object.keys(s).some(key=>!['modelVersionId','aspectRatio','size','mode','style','seed'].includes(key))) throw new Error('공식 API 옵션 형식을 확인해 주세요. 키는 백업에 넣을 수 없습니다.');
    const out={modelVersionId:presetText(s.modelVersionId),aspectRatio:s.aspectRatio ?? '9:16',size:s.size ?? '1k',mode:s.mode ?? '',style:s.style ?? '',seed:s.seed ?? ''};
    if (out.modelVersionId && !/^\d+$/.test(out.modelVersionId)) throw new Error('기본 모델 버전 ID를 숫자로 입력해 주세요.');
    if (!API_RATIOS.includes(out.aspectRatio) || !['1k','1.5k'].includes(out.size)) throw new Error('공식 API 비율·크기를 확인해 주세요.');
    if (!['','lite','standard','pro','ultra'].includes(out.mode)) throw new Error('공식 API 생성 모드를 확인해 주세요.');
    if (out.style!=='' && !API_STYLES.includes(out.style)) throw new Error('공식 API 스타일을 확인해 주세요.');
    if (out.seed!=='') out.seed=presetInteger(out.seed,'시드',0,4294967295);
    return out;
  }
  function buildApiPayload(job, options, batchSize, randomSeed) {
    const opts=normalizeApiOptions(options),config=job.configuration;
    if (![1,4].includes(batchSize)) throw new Error('공식 API는 1장 또는 4장 배치를 지원합니다.');
    const modelVersionId=presetIdentifier(config?.model?.versionId || opts.modelVersionId,'모델 버전',true);
    const prompt=presetText(job.prompt);
    if (!prompt) throw new Error('프롬프트를 입력해 주세요.');
    const loras=config?.loras ?? [];
    if (!Array.isArray(loras) || loras.length>5) throw new Error('공식 API는 LoRA 최대 5개를 지원합니다.');
    const seen=new Set();
    const payload={modelVersionId,prompt,negativePrompt:presetText(job.negativePrompt),aspectRatio:opts.aspectRatio,size:opts.size,
      batchSize,seed:presetInteger(opts.seed==='' ? randomSeed : opts.seed,'시드',0,4294967295),promptHelper:'disable',
      loras:loras.map(item=>{
        const modelId=presetIdentifier(item.versionId,'LoRA 버전',true);
        if (seen.has(modelId)) throw new Error('같은 LoRA 버전이 중복됐습니다.');seen.add(modelId);
        const weight=Number(item.weight);
        if (!['number','string'].includes(typeof item.weight) || (typeof item.weight==='string' && !item.weight.trim()) || !Number.isFinite(weight) || weight<0 || weight>1) throw new Error(`공식 API의 LoRA 수치는 0~1입니다: ${item.name || modelId}. 기존 값을 자동으로 바꾸지 않습니다.`);
        const lora={modelId,weight};
        // Composition already contains the trigger at the user-selected position.
        // Override server defaults to avoid injecting it a second time.
        if (job.composition || Object.hasOwn(item,'triggerWords')) lora.triggerWords='';
        return lora;
      })};
    if (opts.mode) payload.mode=opts.mode;
    if (opts.style) payload.style={type:'preset',key:opts.style};
    return payload;
  }
  function createSessionApiKey() {
    let key='';
    return {set(value){const next=String(value ?? '').trim();if (!next || /[^\x21-\x7e]/.test(next)) throw new Error('API 키 형식을 확인해 주세요.');key=next;},
      clear(){key='';},has(){return !!key;},get(){if (!key) throw new Error('설정 탭에서 공식 API 키를 이 탭에 연결해 주세요.');return key;}};
  }
  function createRememberedApiKey(vault, storage) {
    const slot='pixai.official-api-key.v1';
    const supported=!!storage && ['get','set','remove'].every(name=>typeof storage[name]==='function');
    let state='none';
    const validated=value=>{const candidate=createSessionApiKey();if(typeof value!=='string') throw new Error('API 키 형식을 확인해 주세요.');candidate.set(value);return candidate.get();};
    const checked=action=>{try {return action();} catch {state='unknown';vault.clear();throw new Error('키 저장 상태를 확인하지 못해 이 탭의 연결을 해제했습니다. 저장된 키 삭제 후 다시 연결해 주세요.');}};
    const remove=()=>{storage.remove(slot);if(storage.get(slot,null)!==null) throw new Error('delete verification');};
    return {
      supported,status:()=>state,
      restore(){if(!supported)return;checked(()=>{const saved=storage.get(slot,null);if(saved===null){state='none';return;}vault.set(validated(saved));state='saved';});},
      connect(value,remember=false){
        vault.clear();
        const key=validated(value);
        if(remember && !supported) throw new Error('이 환경에서는 키 기억하기를 지원하지 않습니다. 저장 안 함으로 연결해 주세요.');
        checked(()=>{
          if(supported){if(remember){storage.set(slot,key);if(storage.get(slot,null)!==key)throw new Error('write verification');}else remove();}
          state=remember?'saved':'none';vault.set(key);
        });
      },
      forget(){checked(()=>{if(supported)remove();state='none';});},
      clear(){vault.clear();this.forget();}
    };
  }
  function reconfigureQueuedApiJob(job,options,batchSize,randomSeed) {
    if (job.state!=='queued' || job.taskId || job.saved?.length || job.mediaIds?.length || job.metadataFile) throw new Error('미제출 대기 작업의 API 옵션만 바꿀 수 있습니다. 제출된 작업은 같은 ID로 재개해 주세요.');
    if (job.submittedAt && !/^공식 API 오류 \((400|401|403|404|422)\)\./.test(job.error || '')) throw new Error('이전 제출 결과를 확인할 수 없어 요청을 바꾸지 않습니다.');
    const apiOptions=normalizeApiOptions(options),apiPayload=buildApiPayload(job,apiOptions,batchSize,job.apiPayload?.seed ?? randomSeed);
    const next={...job,apiOptions,apiBatchSize:batchSize,apiPayload,expected:batchSize,error:''};
    if (job.apiPayload) next.apiRequestHistory=[...(job.apiRequestHistory || []),{payload:JSON.parse(JSON.stringify(job.apiPayload)),submittedAt:job.submittedAt ?? null,error:job.error || ''}];
    delete next.submittedAt;
    return next;
  }
  function applyQueuedImageOptions(jobs,options) {
    const current=normalizeApiOptions(options);
    return jobs.map(job=>{
      if (job.state!=='queued' || job.taskId || job.saved?.length || job.mediaIds?.length || job.metadataFile) return job;
      if (job.submittedAt && !/^공식 API 오류 \((400|401|403|404|422)\)\./.test(job.error || '')) return job;
      const previous=job.apiPayload || job.apiOptions;
      if (previous?.aspectRatio===current.aspectRatio && previous?.size===current.size) return job;
      const next={...job,apiOptions:{...(job.apiOptions || current),aspectRatio:current.aspectRatio,size:current.size},error:''};
      if (job.apiPayload) {
        next.apiRequestHistory=[...(job.apiRequestHistory || []),{payload:JSON.parse(JSON.stringify(job.apiPayload)),submittedAt:job.submittedAt ?? null,error:job.error || ''}];
        next.apiPayload={...job.apiPayload,aspectRatio:current.aspectRatio,size:current.size};
      }
      delete next.submittedAt;
      return next;
    });
  }
  function gmResponse(request, details, timeoutMs, timers={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)}) {
    return new Promise((resolve,reject)=>{
      let settled=false,control;
      const finish=(action,value)=>{if (settled) return;settled=true;timers.clear(timer);action(value);};
      const fail=()=>finish(reject,new Error('공식 API 네트워크·시간 초과 오류. 제출 결과가 불명확하면 자동 재제출하지 않습니다.'));
      const timer=timers.set(()=>{fail();try {control?.abort();} catch {}},timeoutMs);
      try {control=request({...details,anonymous:true,fetch:true,redirect:'error',onload:value=>finish(resolve,value),onerror:fail,onabort:fail,ontimeout:fail});}
      catch {fail();}
    });
  }
  function apiValidationDetails(responseText) {
    let body;try {body=JSON.parse(responseText);} catch {return '';}
    if (!body || typeof body!=='object' || Array.isArray(body)) return '';
    // Return structured validation metadata only. Never echo message/input/value,
    // which may contain the complete request, prompt, or credential.
    const roots=[body,body.error,body.message,body.data].filter(value=>value && typeof value==='object' && !Array.isArray(value));
    const records=roots.flatMap(value=>[value,...['detail','details','issues','errors'].flatMap(name=>Array.isArray(value[name]) ? value[name].slice(0,10) : [])]);
    const fields=new Set(['body','query','modelVersionId','modelId','prompt','negativePrompt','aspectRatio','size','batchSize','seed','mode','style','type','key','custom','loras','weight','triggerWords','sampling','method','steps','cfgScale','scheduler','promptHelper','callbackUrl']);
    const codes=new Set(['VALIDATION','VALIDATION_ERROR','INVALID_ARGUMENT','INVALID_REQUEST','UNPROCESSABLE_ENTITY','UNPROCESSABLE_CONTENT','BAD_REQUEST','missing','invalid_type','invalid_union','invalid_value','invalid_enum_value','too_small','too_big','extra_forbidden','string_type','string_too_short','string_too_long','int_type','int_parsing','int_from_float','float_type','float_parsing','list_type','dict_type','literal_error','enum','greater_than','greater_than_equal','less_than','less_than_equal','json_invalid','value_error','validation']);
    const found=new Set();
    for (const item of records.slice(0,30)) {
      if (!item || typeof item!=='object' || Array.isArray(item)) continue;
      const code=[item.code,item.type,item.error].find(value=>codes.has(value));
      const location=item.loc ?? item.path ?? item.property;
      const segments=Array.isArray(location) ? location : typeof location==='string' ? location.split(/[/.]/).filter(Boolean) : [];
      const path=segments.length && segments.length<=8 ? segments.map(value=>fields.has(value) ? value : (typeof value==='number' && Number.isInteger(value) && value>=0 && value<=10) ? String(value) : '[기타 필드]').join('.') : '';
      if (path || code) found.add([path,code].filter(Boolean).join(' · '));
    }
    return [...found].slice(0,6).join('; ');
  }
  function apiServerReason(responseText,context={}) {
    let body;try {body=JSON.parse(responseText);} catch {return '';}
    const raw=body?.message;
    if (typeof raw!=='string' || raw.length>2000) return '';
    // Only the top-level message is considered, never request/input/data dumps.
    // Redact known credentials and all string leaves of the request before display.
    const hidden=[context.secret].filter(Boolean);
    const collect=value=>{if (typeof value==='string' && value) hidden.push(value);else if (value && typeof value==='object') Object.values(value).forEach(collect);};
    collect(context.payload);
    let result=raw;
    for (const value of hidden.sort((a,b)=>b.length-a.length)) {
      for (const variant of new Set([value,JSON.stringify(value).slice(1,-1),encodeURIComponent(value)])) result=result.split(variant).join('[가림]');
    }
    if (/authorization|api.?key|access.?token|\bbearer\b|\bprompt\b|negativePrompt/i.test(result)) return '서버 사유에 인증·프롬프트 정보가 포함될 수 있어 내용을 생략했습니다.';
    result=result.replace(/https?:\/\/\S+/gi,'[주소 가림]').replace(/[A-Za-z0-9_\-]{24,}/g,'[값 가림]').replace(/[\x00-\x1f]/g,' ');
    return result.slice(0,300);
  }
  function apiHttpError(status,method,responseText,context) {
    const advice={400:'입력값·모델/LoRA 버전과 모드 호환성을 확인해 주세요.',401:'API 키 인증 실패입니다. 키를 다시 연결해 주세요.',403:'이 키의 접근 권한을 확인해 주세요.',404:'작업·모델·미디어를 찾지 못했습니다. 키 유효성은 이 응답으로 판정하지 않습니다.',422:'API 입력값을 확인해 주세요.',429:'API 대기열·요청 제한입니다. 추가 제출을 멈췄습니다.'};
    const details=[400,422].includes(status) ? apiValidationDetails(responseText) : '';
    const reason=[400,422].includes(status) && context ? apiServerReason(responseText,context) : '';
    return Object.assign(new Error(`공식 API 오류 (${status}). ${advice[status] || '같은 작업 ID를 보존합니다. 제출 결과가 불명확하면 재제출하지 않습니다.'}${details ? '\n서버 검증: '+details : ''}${reason ? '\n서버 사유: '+reason : ''}`),
      {status,notSubmitted:method==='POST' && [400,401,403,404,422].includes(status)});
  }
  function createOfficialApiClient(request,getKey,timers) {
    async function json(method,path,payload) {
      if (!((method==='POST' && path==='/v2/image/create') || (method==='GET' && /^\/v1\/(?:task|media)\/\d+$/.test(path)))) throw new Error('허용되지 않은 공식 API 경로입니다.');
      if (typeof request!=='function') throw Object.assign(new Error('최신 Tampermonkey로 업데이트하고 스크립트의 API 접근 권한을 허용해 주세요.'),{notSubmitted:true});
      let key;try {key=getKey();} catch(error) {error.notSubmitted=true;throw error;}
      const response=await gmResponse(request,{method,url:'https://api.pixai.art'+path,responseType:'text',
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(payload ? {data:JSON.stringify(payload)} : {})},30000,timers);
      if (response.finalUrl && response.finalUrl!=='https://api.pixai.art'+path) throw new Error('공식 API의 예상하지 못한 이동 응답입니다.');
      if ((method==='POST' && response.status!==201) || (method==='GET' && response.status!==200)) throw apiHttpError(response.status,method,response.responseText,{secret:key,payload});
      try {const value=JSON.parse(response.responseText);if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error();return value;}
      catch {throw new Error('공식 API 응답 형식을 확인하지 못했습니다. 자동 재제출하지 않습니다.');}
    }
    return {async create(payload){const task=await json('POST','/v2/image/create',payload);if (typeof task.id!=='string' || !/^\d+$/.test(task.id)) throw new Error('공식 API 작업 ID를 확인하지 못했습니다. 자동 재제출하지 않습니다.');return task.id;},
      task:id=>json('GET','/v1/task/'+presetIdentifier(id,'작업',true)),media:id=>json('GET','/v1/media/'+presetIdentifier(id,'미디어',true)),
      async image(url){const allowed=mediaUrlAllowed(url);if (allowed.username || allowed.password || allowed.port) throw new Error('이미지 주소 형식을 확인해 주세요.');
        const response=await gmResponse(request,{method:'GET',url:allowed.href,responseType:'blob'},90000,timers);
        if (response.finalUrl && mediaUrlAllowed(response.finalUrl).origin!==allowed.origin) throw new Error('이미지 서버 이동으로 저장을 중단했습니다.');
        if (response.status!==200) throw apiHttpError(response.status,'GET');return response.response;}
    };
  }
  // 서버가 알려준 원본 크기와 실제 내려받은 이미지 크기가 다르면(미리보기 등) 저장하지 않는다.
  async function assertOriginalDimensions(blob, expected, decode) {
    if (!expected.width || !expected.height) return;
    let bitmap;
    try { bitmap = await decode(blob); } catch { throw new Error("다운로드한 이미지를 해석하지 못해 원본 여부를 확인할 수 없습니다. 저장하지 않습니다."); }
    try {
      if (bitmap.width !== expected.width || bitmap.height !== expected.height) throw new Error("다운로드한 이미지 크기(" + bitmap.width + "×" + bitmap.height + ")가 원본(" + expected.width + "×" + expected.height + ")과 다릅니다. 미리보기일 수 있어 저장하지 않습니다.");
    } finally { if (typeof bitmap?.close === "function") bitmap.close(); }
  }

  function queueHistory(job) {return ['done','skipped'].includes(job.state);}
  function queueJobRemovable(job) {
    return job.state==='done' || (['queued','skipped'].includes(job.state) && !job.taskId && !job.submittedAt && !job.saved?.length && !job.mediaIds?.length && !job.metadataFile && !['unknown','submitting','waiting','saving','save_failed'].includes(job.skippedFrom));
  }
  function changeQueueRecords(jobs,ids,action) {
    if(!['delete','archive'].includes(action))throw new Error('지원하지 않는 대기열 변경입니다.');
    const selected=new Set(ids),targets=jobs.filter(job=>selected.has(job.id));
    if(!selected.size || targets.length!==selected.size)throw new Error('목록이 변경됐습니다. 다시 선택해 주세요.');
    if(targets.some(job=>!queueJobRemovable(job) || (action==='archive' && queueHistory(job))))throw new Error('제출된 미완료 작업·결과 확인이 필요한 작업은 지울 수 없습니다. 먼저 같은 작업을 재개해 저장해 주세요.');
    return action==='delete' ? jobs.filter(job=>!selected.has(job.id)) : jobs.map(job=>selected.has(job.id) ? {...job,state:'skipped',skippedFrom:job.state} : job);
  }

  const core = {submitJob,runQueue,placeLibraryItem,MEDIA_QUERY,pickOriginalMedia,mediaUrlAllowed,assertOriginalDimensions,describeQueryFailure,graphqlQuery,snapshotCombination,rememberCombination,resolveCombination,paneRatios,resizePanePair,bindPaneResize,bindWindowResize,createChunkFolder,materialIcon,makePresetLibrary, validatePresetConfiguration, normalizePresetLibrary, orderedChunks, moveLibraryItem, moveChunksTo, removeChunks, duplicateChunks, removeChunkFolder, normalizeSettingsOptions, makeSettingsBackup, parseSettingsBackup, createSettingsStore, composePresetPrompts, expandPresetReservations, parseModelLink, assertConfiguration, assertNumberField, readLoraTriggerWords, capturePresetSettings, createPixaiSettingsAdapter, mountPresetEditor, readPromptEditorText, normalize, safeName, recover, verifyTask, outputIds, processJob, checkCost, clampPosition, bindPanelDrag, acceptFolder, folderError, bindFolderActivation, pickDirectory, storageSupport, downloadError, managedDownload, resetDownloadProgress};
  Object.assign(core,{queueHistory,queueJobRemovable,changeQueueRecords,API_RATIOS,API_STYLES,normalizeApiOptions,buildApiPayload,reconfigureQueuedApiJob,applyQueuedImageOptions,createSessionApiKey,createRememberedApiKey,gmResponse,apiValidationDetails,apiServerReason,apiHttpError,createOfficialApiClient});
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
  let rememberedFolder = null;
  let folderEpoch = 0;
  let folderRestoration = Promise.resolve();
  let restoringFolder = false;
  let running = false;
  let oneJobRun = false; // true while a 「첫 작업만 실행」 run holds the queue
  let starting = false;
  let stopRequested = false;
  let internalAction = false;
  let runImageCount = null;
  let settingsBusy = false;
  let presetEditor;
  let panel;
  const apiKey=createSessionApiKey();
  const rememberedKey=createRememberedApiKey(apiKey,typeof GM_getValue==='function' && typeof GM_setValue==='function' && typeof GM_deleteValue==='function' ? {get:GM_getValue,set:GM_setValue,remove:GM_deleteValue} : null);
  let apiOptions=normalizeApiOptions();
  const api=createOfficialApiClient(typeof GM_xmlhttpRequest==='function' ? GM_xmlhttpRequest : null,()=>apiKey.get());
  window.addEventListener('pagehide',()=>apiKey.clear());
  let choosingFolder = false;
  const download = typeof GM_download === 'function' ? GM_download : null;
  const storage = storageSupport(window, download, typeof GM_info === 'object' ? GM_info : null);
  let downloadsReady = false;
  let message = storage.message;
  try {rememberedKey.restore();} catch(error) {message=error.message;}
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const visible = element => element && element.getClientRects().length > 0;
  const onGenerator = () => /^\/(?:[a-z]{2}\/)?generator\/image\/?$/.test(location.pathname);
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
  // Queue additions from this tab: while its runner holds the queue lock, `jobs` is the live array the
  // runner iterates, so append in place; otherwise take the lock and reload before changing anything.
  async function queueEdit(action) {
    if (starting || settingsBusy) throw new Error('시작 준비·설정 확인이 끝난 뒤 대기열에 등록해 주세요.');
    if (running) return action();
    return locked(action);
  }
  async function locked(action) {
    if (!navigator.locks) throw new Error('이 브라우저는 중복 실행 방지 기능을 지원하지 않습니다.');
    return navigator.locks.request(LOCK, {ifAvailable:true}, async lock => {
      if (!lock) throw new Error('다른 PixAI 탭에서 대기열이 실행 중입니다.');
      load();
      return action();
    });
  }
  async function getTask(id) { return api.task(id); }
  function groupName(element) {
    return element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id=>document.getElementById(id)?.textContent || '').join(' ');
  }
  function expectedCount() {
    return settings.readImageCount();
  }
  async function ensureDestination() {
    let reason='';
    if (!storage.supported) reason=storage.message;
    else if (storage.mode === 'download') {
      if (!downloadsReady) reason='먼저 설정 탭의 자동 다운로드 준비 확인을 완료해 주세요.';
    } else if (!folder || await folder.queryPermission({mode:'readwrite'}) !== 'granted') {
      if (folder) { rememberedFolder={handle:folder,token:folderToken};folder=null;folderToken=null; }
      reason='설정 탭의 저장 폴더 선택을 눌러 쓰기 권한을 허용해 주세요. 새로고침한 뒤에는 다시 선택해야 합니다.';
    }
    if (reason) throw Object.assign(new Error(reason),{requiresStorageSetup:true});
  }
  async function prepare(job) {
    if (stopRequested) throw new Error('다음 작업 제출이 중지됐습니다.');
    apiKey.get();
    await ensureDestination();
    if (job.maxCredits!=null && !panel.querySelector('[data-api-cost-ack]').checked) throw new Error('공식 API는 이 스크립트의 크레딧 상한을 적용할 수 없습니다. 설정 탭에서 이를 확인한 뒤 실행해 주세요.');
    if (!job.apiPayload && !job.configuration && !(job.apiOptions || apiOptions).modelVersionId) {
      job.configuration=await settings.capture();job.negativePrompt=await settings.captureNegative();
    }
    const payload=job.apiPayload || buildApiPayload(job,job.apiOptions || apiOptions,job.apiBatchSize || runImageCount,crypto.getRandomValues(new Uint32Array(1))[0]);
    return {backend:'official-api',queryBackend:'official-v1',apiPayload:payload,expected:payload.batchSize,
      budgetEnforcement:'unavailable; acknowledged at start',appliedConfiguration:job.configuration || {model:{versionId:payload.modelVersionId},loras:payload.loras},appliedNegativePrompt:payload.negativePrompt};
  }
  async function submit(job) {
    if (stopRequested) throw Object.assign(new Error('제출 직전 중지됐습니다. 이미지를 생성하지 않았습니다.'),{notSubmitted:true});
    return api.create(job.apiPayload);
  }
  async function waitTask(job) {
    const deadline = Date.now() + 60 * 60 * 1000;
    while (Date.now() < deadline) {
      const task = await getTask(job.taskId);
      job.queryBackend="official-v1";
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
    const media=await api.media(mediaId);
    const original=pickOriginalMedia(media,mediaId);
    const blob=await api.image(original.url);
    if (!['image/png','image/jpeg','image/webp'].includes(blob?.type) || blob.size===0) throw new Error('다운로드한 파일이 지원 이미지가 아닙니다.');
    await assertOriginalDimensions(blob,original,image=>createImageBitmap(image));
    return blob;
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
    }
  };
  async function start({oneJob=false}={}) {
    if (running || starting) return;
    if (settingsBusy) throw new Error('모델·LoRA 설정 확인이 끝난 뒤 시작해 주세요.');
    if (choosingFolder) throw new Error(storage.mode === 'download' ? '확인 파일 다운로드가 끝난 뒤 시작해 주세요.' : '폴더 선택창을 먼저 닫거나 선택을 완료해 주세요.');
    starting=true; stopRequested=false; message='시작 준비: 저장 위치 확인 중…';render();
    let showStorage=false;
    try {
    await folderRestoration;
    await ensureDestination();
    if (stopRequested) throw new Error('시작 준비가 중지됐습니다. 이미지를 생성하지 않았습니다.');
    if (!onGenerator()) throw new Error('이미지 생성 화면에서 실행해 주세요.');
    await locked(async () => {
      await ensureDestination();
      if (!jobs.some(job => !['done','skipped'].includes(job.state))) throw new Error('대기열이 비어 있습니다. 프롬프트를 입력하고 대기열 추가를 눌러 주세요.');
      if (storage.mode === 'folder' && jobs.some(job => job.saved?.length && !['done','skipped'].includes(job.state) && job.folderToken !== folderToken)) {
        throw new Error('부분 저장 작업의 폴더를 다시 선택해 확인해 주세요.');
      }
      apiKey.get();
      const pendingJobs=jobs.filter(job=>!['done','skipped'].includes(job.state));
      const newJobs=(oneJob ? pendingJobs.slice(0,1) : pendingJobs.some(job=>job.state!=='queued') ? [] : pendingJobs).filter(job=>job.state==='queued');
      if (newJobs.length && !panel.querySelector('[data-api-cost-ack]').checked) {
        throw new Error('설정 탭에서 공식 API 과금·비용 상한 미지원 안내를 확인해 주세요. 기존 작업 조회만 재개할 때는 필요하지 않습니다.');
      }
      const needsSite=newJobs.some(job=>!job.apiPayload && !job.configuration && !(job.apiOptions || apiOptions).modelVersionId);
      if (needsSite) {
        message='기본 모델 미지정: 사이트 설정을 읽는 중…';render();
        const baseline=await settings.capture(),negative=await settings.captureNegative();
        for (const job of newJobs.filter(item=>!item.apiPayload && !item.configuration && !(item.apiOptions || apiOptions).modelVersionId)) {
          Object.assign(job,{configuration:JSON.parse(JSON.stringify(baseline)),negativePrompt:negative,settingsOrigin:'site-at-first-api-start'});
        }
      }
      if (storage.mode === 'download') resetDownloadProgress(jobs);
      const selectedCount=Number(panel.querySelector('[data-image-count]').value);
      runImageCount=selectedCount || (newJobs.length ? expectedCount() : 1);
      const payloads=newJobs.filter(item=>!item.apiPayload).map(job=>[job,buildApiPayload(job,job.apiOptions || apiOptions,job.apiBatchSize || runImageCount,crypto.getRandomValues(new Uint32Array(1))[0])]);
      for (const [job,payload] of payloads) job.apiPayload=payload;
      persist(); // Freeze all new payloads before the first paid request.
      if (stopRequested) throw new Error('시작 준비가 중지됐습니다. 이미지를 생성하지 않았습니다.');
      running = true;
      starting = false;
      oneJobRun = oneJob;
      try {
        persist();
        await runQueue(jobs,io,{limit:Number(panel.querySelector('[data-max-in-flight]').value),oneJob,stopped:()=>stopRequested});
        message = stopRequested ? '중지됨. 완료된 파일은 보존했습니다.' : oneJob ? '첫 작업 실행과 저장이 끝났습니다. 나머지 대기열은 실행하지 않았습니다.' : '대기열 작업과 저장이 끝났습니다.';
      } finally { running = false; render(); }
    });
    } catch(error) {
      if (error.requiresStorageSetup) {
        showStorage=true;
        presetEditor?.showPage('settings',true);
      }
      throw error;
    } finally {starting=false;render();if (showStorage) panel?.querySelector('[data-choose-folder]')?.focus({preventScroll:true});}
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
      if (element.getAttribute('data-view-only') == null) {
        notifyAction(`입력 확인: ${text}`);
      }
      return action();
    }, error => { message = error.message; render(); });
    return element;
  }
  let notificationTimer;
  const expandedJobs=new Set(),selectedJobs=new Set();
  let queueView='active',queueConfirmation=null;
  async function confirmQueueChange() {
    if(running || starting || settingsBusy)throw new Error('실행을 중지한 뒤 목록을 정리해 주세요.');
    const request=queueConfirmation;if(!request)return;
    await locked(()=>{
      const before=jobs;const next=changeQueueRecords(jobs,request.ids,request.action);
      jobs=next;
      try {persist();} catch(error) {jobs=before;throw error;}
    });
    queueConfirmation=null;selectedJobs.clear();
    if(request.action==='archive')queueView='active';
    message=request.action==='archive' ? `${request.ids.length}개를 보관했습니다. 새 작업을 등록해 주세요. 기록에서 건너뛰기 취소로 복원할 수 있습니다.` : `${request.ids.length}개 목록을 삭제했습니다. 저장된 이미지·프리셋·청크는 유지됩니다.`;
    render();
  }
  function notifyAction(text) {
    if (!panel) return;
    const toast=panel.querySelector('[data-toast]');if (!toast) return;
    toast.textContent=text;toast.hidden=false;clearTimeout(notificationTimer);
    notificationTimer=setTimeout(()=>{toast.hidden=true;},7000);
  }
  function render() {
    if (!panel) return;
    const rememberControl=panel.querySelector('[data-remember-api-key]');
    if(rememberControl)rememberControl.disabled=!rememberedKey.supported || running || starting || settingsBusy;
    const keyStatus=panel.querySelector('[data-api-key-state]');
    if (keyStatus) keyStatus.textContent=rememberedKey.status()==='unknown' ? '키 저장 상태 확인 필요 · 저장된 키를 삭제하고 다시 연결해 주세요' : apiKey.has() ? `키 입력됨 · ${rememberedKey.status()==='saved' ? '스크립트 관리자에 저장됨' : '이 탭에서만 보관'} · 인증 확인은 별도 조회로 진행` : rememberedKey.status()==='saved' ? '저장된 키 있음 · 이 탭 연결 해제됨 · 키를 다시 입력하거나 저장된 키를 삭제해 주세요' : 'API 키 미입력 · 설정에서 연결해 주세요';
    const launcher=panel.querySelector('[data-launcher]');
    if (launcher) launcher.title=`클릭해 PixAI 대기열 열기 · 드래그해 이동 · ${running ? '실행 중' : starting ? '시작 준비 중' : settingsBusy ? '설정 확인 중' : '대기'}\n${message}`;
    panel.querySelector('[data-message]').textContent = message;
    const feedback=panel.querySelector('[data-action-message]');
    if (feedback) feedback.textContent=message;
    panel.querySelector('[data-folder]').textContent = storage.mode === 'download'
      ? `자동 다운로드 · ${downloadsReady ? '준비 확인 완료' : '준비 확인 필요'} · 브라우저 설정 폴더`
      : (folder ? `저장 폴더: ${folder.name}` : rememberedFolder ? `기억한 폴더: ${rememberedFolder.handle.name} · 권한 허용 필요` : restoringFolder ? '이전 저장 폴더 확인 중…' : '저장 폴더 미선택');
    const list = panel.querySelector('[data-jobs]');
    list.replaceChildren();
    const visible=jobs.filter(job=>queueHistory(job)===(queueView==='history'));
    for(const id of selectedJobs)if(!visible.some(job=>job.id===id))selectedJobs.delete(id);
    const toolbar=node('div',null,{class:'pq-queue-toolbar'});
    for(const [view,title] of [['active','진행 대기열'],['history','완료·보관 기록']]) {
      const tab=button(`${title} (${jobs.filter(job=>queueHistory(job)===(view==='history')).length})`,()=>{queueView=view;selectedJobs.clear();queueConfirmation=null;render();});
      tab.setAttribute('aria-pressed',String(queueView===view));tab.setAttribute('data-queue-view',view);toolbar.append(tab);
    }
    const selectable=visible.filter(queueJobRemovable);
    const selectAll=button('전체 선택',()=>{for(const job of selectable)selectedJobs.add(job.id);queueConfirmation=null;render();});
    const deselect=button('선택 해제',()=>{selectedJobs.clear();queueConfirmation=null;render();});
    const requestChange=(ids,action)=>{if(running || starting || settingsBusy)throw new Error('실행을 중지한 뒤 목록을 정리해 주세요.');changeQueueRecords(jobs,ids,action);queueConfirmation={ids,action};render();};
    const removeSelected=button(`선택 삭제 (${selectedJobs.size})`,()=>requestChange([...selectedJobs],'delete'));
    const removeAll=button('현재 목록 전체 삭제',()=>requestChange(visible.map(job=>job.id),'delete'));
    const fresh=button('새 대기열',()=>requestChange(jobs.filter(job=>!queueHistory(job)).map(job=>job.id),'archive'));
    for(const control of [selectAll,deselect,removeSelected,removeAll,fresh])control.dataset.edit='';
    removeSelected.setAttribute('data-unavailable',String(!selectedJobs.size));removeAll.setAttribute('data-unavailable',String(!visible.length));
    fresh.setAttribute('data-unavailable',String(!jobs.some(job=>!queueHistory(job))));
    toolbar.append(selectAll,deselect,removeSelected,removeAll,fresh,node('small','완료 항목은 기록으로 이동합니다. 새 대기열은 미제출 항목을 보관합니다. 제출된 미완료 작업은 삭제하지 않습니다.'));
    if(queueConfirmation) {
      const box=node('div',null,{class:'pq-queue-confirm','role':'alert'});
      box.append(node('strong',queueConfirmation.action==='archive' ? `미제출 ${queueConfirmation.ids.length}개를 기록으로 옮길까요?` : `${queueConfirmation.ids.length}개 목록을 영구 삭제할까요? 저장된 이미지 파일은 유지됩니다.`));
      const yes=button('확인하고 적용',confirmQueueChange);yes.dataset.edit='';
      box.append(yes,button('취소',()=>{queueConfirmation=null;render();}));toolbar.append(box);
    }
    list.append(toolbar);
    if(!visible.length)list.append(node('small',queueView==='history' ? '완료·보관 기록이 없습니다.' : '대기열이 비었습니다. 새 조합을 등록해 주세요.'));
    for (const job of visible) {
      const row = node('div', null, {class:'pq-job','data-queue-job':job.id});
      const selection=node('label',null,{class:'pq-check-label'}),check=node('input',null,{type:'checkbox','aria-label':`작업 선택: ${job.title}`,'data-select-job':job.id});
      check.checked=selectedJobs.has(job.id);check.disabled=running || starting || settingsBusy || !queueJobRemovable(job);
      check.addEventListener('change',()=>{if(check.disabled)return;if(check.checked)selectedJobs.add(job.id);else selectedJobs.delete(job.id);queueConfirmation=null;render();});
      selection.append(check,node('strong',job.title));row.append(selection);
      if(!queueJobRemovable(job))row.append(node('small','복구 필요 · 삭제 보호'));
      row.append(node('span', `${LABELS[job.state]}${job.expected ? ` · ${job.saved?.length || 0}/${job.expected}` : ''}`));
      const imageOptions=job.apiPayload || job.apiOptions;
      if (imageOptions?.aspectRatio) {
        row.append(node('small',`적용 비율 ${imageOptions.aspectRatio} (가로:세로) · 크기 ${imageOptions.size || '1k'}`));
        if (job.state==='queued' && !job.taskId && (imageOptions.aspectRatio!==apiOptions.aspectRatio || imageOptions.size!==apiOptions.size)) row.append(node('small',`현재 설정 ${apiOptions.aspectRatio} · ${apiOptions.size}과 다릅니다. 설정에서 대기 작업에 비율·크기를 적용할 수 있습니다.`));
      } else if (job.state==='queued' && !job.taskId) row.append(node('small',`시작 시 현재 설정 ${apiOptions.aspectRatio} (가로:세로) · ${apiOptions.size} 적용 예정`));
      if (job.error) row.append(node('small', job.error));
      if (job.taskId) row.append(node('small', `작업 ${job.taskId}`));
      const timeline=node('div',null,{class:'pq-job-timeline','aria-label':`진행 단계: ${job.title}`});
      const submitted=!!job.taskId,confirmed=submitted && (['saving','save_failed','done'].includes(job.state) || !!job.saved?.length || !!job.metadataFile),stored=job.state==='done';
      for (const [name,done] of [['준비',true],['제출',submitted],['생성 확인',confirmed],['저장',stored]]) timeline.append(node('span',`${done ? '✓ ' : '○ '}${name}`,{'data-complete':String(done)}));
      row.append(timeline);
      const detail=node('details',null,{class:'pq-job-detail'});detail.open=expandedJobs.has(job.id);
      detail.append(node('summary','작업 내용 보기'),node('strong','전송 프롬프트'),node('div',job.prompt,{class:'pq-job-prompt'}),node('strong','네거티브'),node('div',job.negativePrompt || '(없음)',{class:'pq-job-prompt'}));
      if (job.configuration?.model && Array.isArray(job.configuration.loras)) detail.append(node('small',`모델 ${job.configuration.model.name || job.configuration.model.id} · 버전 ${job.configuration.model.versionId}`),...job.configuration.loras.filter(lora=>lora && typeof lora==='object').map(lora=>node('small',`LoRA ${lora.name || lora.id} · ${lora.weight}`)));
      detail.addEventListener('toggle',()=>{if (detail.open) expandedJobs.add(job.id);else expandedJobs.delete(job.id);});row.append(detail);
      if (job.state==='queued' && !job.taskId && !job.saved?.length) {
        const configure=button('현재 API 옵션 적용',async()=>{
          if (running || starting || settingsBusy) throw new Error('실행 중에는 대기열 요청을 바꿀 수 없습니다.');
          await locked(()=>{
            const index=jobs.findIndex(item=>item.id===job.id);
            if (index<0) throw new Error('대기 작업을 찾지 못했습니다.');
            const next=reconfigureQueuedApiJob(jobs[index],apiOptions,Number(panel.querySelector('[data-image-count]').value) || expectedCount(),crypto.getRandomValues(new Uint32Array(1))[0]);
            const before=jobs[index];jobs[index]=next;
            try {persist();} catch(error) {jobs[index]=before;throw error;}
          });
          message='이 대기 작업에 현재 API 옵션을 적용했습니다. 이전 요청 사본은 보존했고 새 생성은 하지 않았습니다.';render();
        });
        configure.setAttribute('aria-label',`현재 API 옵션 적용: ${job.title}`);configure.dataset.edit='';row.append(configure);
      }
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
      if (job.state === 'skipped') {
        const restore=button('건너뛰기 취소', async () => {
          if (running || starting || settingsBusy) throw new Error('실행 중에는 대기열 상태를 바꿀 수 없습니다.');
          await locked(() => {
            const target=jobs.find(item=>item.id===job.id);
            if (!target || target.state !== 'skipped') throw new Error('작업 상태가 변경됐습니다.');
            // Keep paid/uncertain submissions on their recovery path, including
            // old skipped records that predate the undo button.
            target.state=target.taskId ? 'waiting' : target.submittedAt || target.skippedFrom === 'unknown' ? 'unknown' : 'queued';
            delete target.skippedFrom;persist();
          });
          message='건너뛰기를 취소했습니다. 작업은 실행하지 않았습니다.';render();
        });
        restore.setAttribute('data-edit','');row.append(restore);
      } else if (job.state !== 'done') {
        const skip=button('건너뛰기', async () => {
          if (running || starting || settingsBusy) throw new Error('실행 중에는 대기열 상태를 바꿀 수 없습니다.');
          await locked(() => {
            const target=jobs.find(item=>item.id===job.id);
            if (!target || ['done','skipped'].includes(target.state)) throw new Error('작업 상태가 변경됐습니다.');
            target.skippedFrom=target.state;target.state='skipped';persist();
          });
        });
        skip.setAttribute('data-edit','');const menu=node('details',null,{class:'pq-job-menu'});menu.append(node('summary','⋮',{'aria-label':`작업 메뉴: ${job.title}`}),skip);row.append(menu);
      }
      list.append(row);
    }
    // While this tab runs the queue, library/compose editing and registration stay open so the next batch
    // can be prepared; queue rows, legacy add, backups, folder and site-settings controls stay locked.
    const composing = running && !starting && !settingsBusy;
    for (const element of panel.querySelectorAll('[data-edit], [data-start]')) {
      const open = composing && !!presetEditor?.allowsWhileRunning(element);
      element.disabled = (!open && (running || starting || settingsBusy)) || element.getAttribute('data-unavailable') === 'true';
    }
    const choose = panel.querySelector('[data-choose-folder]');
    choose.disabled = running || starting || settingsBusy || choosingFolder;
    choose.textContent = storage.mode === 'download'
      ? (choosingFolder ? '확인 파일 다운로드 중…' : '자동 다운로드 준비 확인')
      : (choosingFolder ? (rememberedFolder && !folder ? '권한 확인 중…' : '폴더 선택 중…') : rememberedFolder && !folder ? '저장 폴더 권한 허용' : '저장 폴더 선택');
    const chooseOther=panel.querySelector('[data-choose-other-folder]');
    const queueCounts=panel.querySelector('[data-queue-counts]');if (queueCounts) queueCounts.textContent=`진행 ${jobs.filter(job=>!queueHistory(job)).length} · 기록 ${jobs.filter(queueHistory).length} · 저장 완료 ${jobs.filter(job=>job.state==='done').length} · 확인 필요 ${jobs.filter(job=>job.error || job.state==='unknown').length}`;
    if (chooseOther) { chooseOther.hidden=storage.mode !== 'folder' || !rememberedFolder || !!folder;chooseOther.disabled=choose.disabled; }
    panel.querySelector('[data-start]').textContent = running ? '실행 중' : starting ? '시작 준비 중…' : '시작 / 같은 작업 재개';
    decorateIcon(panel.querySelector('[data-start]'),'play_arrow');
    // Keep idle Start clickable so its preflight can explain missing setup.
    panel.querySelector('[data-start]').title = !storage.supported ? storage.message
      : (storage.mode === 'download' && !downloadsReady ? '자동 다운로드 준비 확인을 먼저 완료해 주세요.' : '저장 준비와 대기열을 확인한 뒤 실행합니다.');
  }
  function mount() {
    if (panel || document.getElementById('local-pixai-queue') || !document.body) return;
    panel = node('aside', null, {id:'local-pixai-queue'});
    const style = node('style', `#local-pixai-queue{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:340px;max-height:80vh;overflow:auto;padding:16px;border:1px solid #505862;border-radius:14px;background:#222529;color:#edf1f5;font:14px/1.5 system-ui;box-shadow:0 12px 40px #0006}#local-pixai-queue *{box-sizing:border-box}#local-pixai-queue h2{margin:0 0 8px;font-size:17px}#local-pixai-queue input,#local-pixai-queue textarea{width:100%;margin:5px 0;padding:8px;border:1px solid #4a515a;border-radius:7px;background:#151719;color:inherit;font:inherit}#local-pixai-queue textarea{min-height:85px;resize:vertical}#local-pixai-queue button{margin:4px 4px 4px 0;padding:7px 10px;border:1px solid #616b77;border-radius:7px;background:#30363c;color:inherit;cursor:pointer}#local-pixai-queue button:disabled{opacity:.45;cursor:default}#local-pixai-queue small{display:block;color:#bbc3cc}#local-pixai-queue .pq-job{border-top:1px solid #41474f;padding:8px 0}#local-pixai-queue .pq-job span{display:block;color:#b6c1cc}#local-pixai-queue [data-jobs]{max-height:230px;overflow:auto}#local-pixai-queue [data-message]{white-space:pre-wrap;color:#d9e0e8;margin:8px 0}`);
    const dragHandle = node('h2','PixAI 대기열 · 0.9.8', {'data-drag-handle':'',title:'이 제목줄을 드래그해서 이동'});
    style.textContent += '#local-pixai-queue{box-sizing:border-box;width:min(340px,calc(100vw - 16px));pointer-events:auto}#local-pixai-queue button{pointer-events:auto}#local-pixai-queue [data-drag-handle]{margin:0;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:grab;user-select:none;touch-action:none}#local-pixai-queue [data-drag-handle][data-dragging]{cursor:grabbing}';
    style.textContent += '#local-pixai-queue :is(button,input,textarea,select,summary):focus-visible{outline:2px solid #acd1ed;outline-offset:2px}#local-pixai-queue button:not(:disabled):hover{border-color:#a9cce7;background:#39434d}#local-pixai-queue [data-primary]{background:#94bedf;color:#16232d;border-color:#94bedf;font-weight:650}#local-pixai-queue [data-primary]:not(:disabled):hover{background:#b3d2eb;color:#16232d}';
    style.textContent += '#local-pixai-queue [data-header]{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;height:32px;margin-bottom:8px;background:#222529}#local-pixai-queue [data-collapse]{width:32px;height:32px;flex:none;margin:0;padding:6px;line-height:0}#local-pixai-queue [data-message]{position:sticky;top:40px;z-index:1;max-height:100px;overflow:auto;padding:7px 9px;border:1px solid #505862;border-radius:7px;background:#222529}#local-pixai-queue [data-action-message]{white-space:pre-wrap;margin:4px 0 10px;padding:7px 9px;border-left:3px solid #94bedf;background:#29343d;color:#edf1f5}';
    style.textContent += '#local-pixai-queue [data-launcher]{display:none;width:52px;height:52px;margin:0;padding:12px;border:1px solid #759bb8;border-radius:50%;line-height:0;background:#30363c;touch-action:none;user-select:none}#local-pixai-queue [data-launcher][data-dragging]{cursor:grabbing}#local-pixai-queue [data-launcher]:focus-visible,#local-pixai-queue [data-collapse]:focus-visible{outline:2px solid #bbdef6;outline-offset:3px}#local-pixai-queue[data-minimized="true"]{width:52px;height:52px;max-height:none;padding:0;border:0;border-radius:50%;overflow:visible}#local-pixai-queue[data-minimized="true"]>:not([data-launcher]){display:none!important}#local-pixai-queue[data-minimized="true"]>[data-launcher]{display:block}';
    function iconControl(label, attribute, path) {
      const control=node('button',null,{type:'button','aria-label':label,title:label,[attribute]:'','aria-controls':'local-pixai-queue'});
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      for (const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'100%',height:'100%',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(key,value);
      const drawing=document.createElementNS('http://www.w3.org/2000/svg','path');drawing.setAttribute('d',path);svg.append(drawing);control.append(svg);return control;
    }
    const collapse=iconControl('대기열 접기','data-collapse','M5 12h14');
    const launcher=iconControl('PixAI 대기열 열기','data-launcher','M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M7 16l4-5 3 3 2-2 2 4 M8 8h.01');
    const header=node('div',null,{'data-header':''});header.append(dragHandle,collapse);
    let expandedScrollTop=0,panelDrag=null;
    function minimize(value, remember=true, focus=true) {
      const before=panel.getBoundingClientRect();
      if (value) expandedScrollTop=panel.scrollTop;
      panel.dataset.minimized=String(value);
      panelDrag?.keepRight(before); // not yet bound at startup: the saved position is restored as is
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
    const toast=node('div',null,{'data-toast':'',role:'status','aria-live':'polite'});toast.hidden=true;
    panel.append(style,launcher,header, node('div',message,{'data-message':'','role':'status','aria-live':'polite'}),toast, node('small','공식 API로 생성·저장 · 사이트 생성 버튼은 누르지 않습니다. API 비율·크기·스타일은 설정 탭에서 정합니다.'));
    panel.append(node('div','저장 폴더 미선택',{'data-folder':''}));
    const choose = button('저장 폴더 선택', chooseFolder);
    choose.dataset.chooseFolder = '';
    choose.dataset.edit = '';
    const chooseOther=button('다른 저장 폴더 선택',()=>chooseFolder({pickNew:true}));
    chooseOther.dataset.chooseOtherFolder='';chooseOther.dataset.edit='';chooseOther.hidden=true;
    panel.append(choose,chooseOther);
    const title = node('input',null,{placeholder:'파일 이름 / 작업 이름', 'data-edit':'', 'aria-label':'대기열 작업 이름'});
    const prompts = node('textarea',null,{placeholder:'프롬프트 입력\n여러 작업은 한 줄 --- 로 구분', 'data-edit':'', 'aria-label':'대기열 프롬프트'});
    const repeat = node('input',null,{type:'number',min:'1',max:'100',value:'1','data-edit':'', 'aria-label':'각 프롬프트 반복 횟수'});
    const simple=node('details');simple.append(node('summary','통짜 프롬프트 · 간단 대기열'),title,prompts,node('small','반복 횟수 (생성 버튼을 누르는 횟수)'),repeat);
    const budget = node('input',null,{type:'number',min:'1',value:'7800','data-edit':'','aria-label':'생성 1회 크레딧 상한'});
    const budgetLabel=node('small','생성 1회 크레딧 상한 (빈칸은 제한 없음)');panel.append(budgetLabel,budget);
    const imageCountLabel=node('label','생성당 이미지 수');
    const imageCount=node('select',null,{'data-edit':'','data-image-count':'','aria-label':'생성당 이미지 수'});
    for (const [value,name] of [[4,'4장 배치'],[1,'1장'],[0,'사이트 선택 유지']]) imageCount.append(node('option',name,{value:String(value)}));
    imageCount.value='4';imageCountLabel.append(imageCount);
    const inFlightLabel=node('label','미리 등록할 작업 수 (1~10)');
    const maxInFlight=node('input',null,{type:'number',min:'1',max:'10',value:'3','data-edit':'','data-max-in-flight':'','aria-label':'미리 등록할 작업 수'});
    inFlightLabel.append(maxInFlight);
    budget.hidden=true;budgetLabel.hidden=true; // Retain old backup values, without promising API budget enforcement.
    const apiContent=node('div',null,{class:'pq-api-settings'});
    const keyInput=node('input',null,{type:'password',autocomplete:'off',placeholder:'공식 API 키 · 기본값은 저장 안 함','aria-label':'공식 API 키','data-edit':''});
    const keyState=node('small',null,{'data-api-key-state':'',role:'status'});
    const rememberInput=node('input',null,{type:'checkbox','data-remember-api-key':'','aria-label':'이 브라우저에 API 키 기억하기 (선택)'});rememberInput.checked=rememberedKey.status()==='saved';rememberInput.disabled=!rememberedKey.supported;
    const rememberLabel=node('label',null,{class:'pq-check-label'});rememberLabel.append(rememberInput,node('span','이 브라우저에 API 키 기억하기 (선택)'));
    rememberInput.addEventListener('change',event=>{
      if(event.isTrusted===false){rememberInput.checked=rememberedKey.status()==='saved';return;}
      try {
        if(running || starting || settingsBusy)throw new Error('실행이 끝난 뒤 키 저장 설정을 바꿔 주세요.');
        if(!rememberInput.checked){rememberedKey.forget();message='저장된 키를 삭제했습니다. 현재 탭의 연결은 유지하며 다른 탭의 연결은 각 탭에서 지워 주세요.';}
        else message='키 연결 버튼을 누르면 스크립트 관리자에 저장합니다. 체크만으로 저장하지 않습니다.';
      } catch(error) {rememberInput.checked=rememberedKey.status()==='saved';message=error.message;}render();
    });
    const connectKey=button('이 탭에 키 연결',()=>{try {rememberedKey.connect(keyInput.value || (apiKey.has()?apiKey.get():''),rememberInput.checked);message=`키 입력 완료. ${rememberedKey.status()==='saved' ? '다음 방문에 저장된 키를 불러옵니다.' : '이 탭에서만 보관합니다.'} 연결 확인은 기존 작업 조회로 할 수 있습니다. 새 생성은 아직 실행하지 않았습니다.`;} finally {keyInput.value='';render();}});connectKey.dataset.edit='';
    const clearKey=button('키 지우기',()=>{try {rememberedKey.clear();rememberInput.checked=false;message='이 탭과 스크립트 관리자에 저장된 API 키를 지웠습니다. 다른 탭의 연결은 각 탭에서 지워 주세요.';} finally {keyInput.value='';render();}});clearKey.dataset.edit='';
    const verifyId=node('input',null,{'aria-label':'연결 확인용 기존 작업 ID',placeholder:'기존 작업 ID (조회만 함)','data-edit':''});
    const verifyKey=button('기존 작업으로 연결 확인',()=>settingsAction(async()=>{
      const id=verifyId.value.trim() || jobs.find(job=>job.taskId)?.taskId;
      const task=await api.task(presetIdentifier(id,'기존 작업',true));
      if (String(task.id)!==String(id) || !['waiting','running','completed','failed','cancelled'].includes(task.status)) throw new Error('조회 응답의 작업 ID·상태를 확인하지 못했습니다.');
      message=`공식 API 인증·조회 성공 · 작업 ${id} · ${task.status}. 새 생성·다운로드는 실행하지 않았습니다.`;render();
    },{readOnly:true}));verifyKey.dataset.edit='';
    const apiFields={};
    function apiField(key,label,values) {
      const wrapper=node('label',label),control=values ? node('select',null,{'data-edit':'','aria-label':label}) : node('input',null,{'data-edit':'','aria-label':label});
      if (values) for (const [value,name] of values) control.append(node('option',name,{value}));
      apiFields[key]=control;wrapper.append(control);apiContent.append(wrapper);return control;
    }
    apiContent.append(keyInput,rememberLabel,connectKey,clearKey,keyState,node('small','기본값은 저장 안 함입니다. 기억하기는 Tampermonkey의 이 스크립트 저장소를 사용합니다. 키는 이 도구의 설정·대기열 백업에서 제외됩니다.'),node('small','암호화 금고는 아닙니다. 공용 PC에서는 저장하지 마세요. 입력칸은 PixAI 페이지 안에 있으며, 확장 관리자 백업·동기화에는 키가 포함될 수 있습니다.'),verifyId,verifyKey);
    apiField('modelVersionId','통짜 대기열 기본 모델 버전 ID (프리셋 지정 시 해당 프리셋 우선)');
    apiField('aspectRatio','API 이미지 비율',API_RATIOS.map(value=>[value,`${value} · ${Number(value.split(':')[0])>Number(value.split(':')[1]) ? '가로' : Number(value.split(':')[0])<Number(value.split(':')[1]) ? '세로' : '정사각'}`]));
    apiField('size','API 이미지 크기',[['1k','1k'],['1.5k','1.5k']]);
    apiContent.append(node('small','비율은 가로:세로입니다. 5:3은 가로, 3:5는 세로입니다. 설정 변경은 새로 등록하는 작업부터 적용됩니다. 기존 대기 작업은 아래 버튼으로 바꿉니다.'));
    const applyImageOptions=button('미제출 대기 작업에 비율·크기 적용',async()=>{
      if (running || starting || settingsBusy) throw new Error('실행 중에는 대기열 요청을 바꿀 수 없습니다.');
      const options={...apiOptions};let count=0;
      await locked(()=>{
        const before=jobs,next=applyQueuedImageOptions(jobs,options);count=next.filter((job,index)=>job!==before[index]).length;
        jobs=next;try {persist();} catch(error) {jobs=before;throw error;}
      });
      message=`미제출 대기 작업 ${count}건에 ${options.aspectRatio} (가로:세로) · ${options.size} 적용 완료. 새 생성은 하지 않았습니다.`;render();
    });applyImageOptions.dataset.edit='';apiContent.append(applyImageOptions);
    apiField('mode','츠바키 API 생성 모드',[['','모델 기본값 (모드 보내지 않음)'],['lite','Lite'],['standard','Standard'],['pro','Pro'],['ultra','Ultra']]);
    apiField('style','츠바키 API 스타일',[['','스타일 보내지 않음'],...API_STYLES.map(value=>[value,value])]);
    apiField('seed','API 시드 (빈칸은 작업별 랜덤)').setAttribute('placeholder','0~4294967295');
    const costAck=node('input',null,{type:'checkbox','data-api-cost-ack':'','data-edit':''});
    const costAckLabel=node('label',null,{class:'pq-check-label'});costAckLabel.append(costAck,node('span','시작은 크레딧을 사용하는 공식 API 생성 요청이며, 기존 사이트 비용 상한을 이 API 실행에 적용할 수 없음을 확인했습니다.'));
    apiContent.append(node('small','모델·LoRA는 프리셋에서 가져옵니다. 나머지 API 옵션은 여기서 정하며 사이트의 해상도·스타일·참조 설정을 자동 복사하지 않습니다. LoRA 수치는 0~1, 최대 5개입니다.'),costAckLabel);
    function readApiFields() {return normalizeApiOptions(Object.fromEntries(Object.entries(apiFields).map(([key,input])=>[key,input.value])));}
    function readOptions() {
      return normalizeSettingsOptions({maxCredits:budget.value.trim() ? Number(budget.value) : null,filePrefix:title.value,repeat:Number(repeat.value),imageCount:Number(imageCount.value),maxInFlight:Number(maxInFlight.value),api:readApiFields()});
    }
    let savedOptions=normalizeSettingsOptions({maxCredits:7800,filePrefix:'',repeat:1});
    function fillOptions(value) {
      savedOptions=normalizeSettingsOptions(value);
      budget.value=value.maxCredits == null ? '' : String(value.maxCredits);
      title.value=value.filePrefix;repeat.value=String(value.repeat);
      imageCount.value=String(value.imageCount ?? 4);maxInFlight.value=String(value.maxInFlight ?? 3);
      apiOptions=normalizeApiOptions(value.api);for (const [key,input] of Object.entries(apiFields)) input.value=String(apiOptions[key]);
    }
    function loadOptions() {
      fillOptions(normalizeSettingsOptions(JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{"maxCredits":7800,"filePrefix":"","repeat":1}')));
    }
    try {loadOptions();} catch {fillOptions(savedOptions);message='기본 옵션을 읽지 못했습니다. 화면과 실행 모두 기본값(9:16·1k)으로 맞췄습니다. 설정 불러오기로 복구하거나 입력값을 확인해 주세요.';}
    for (const input of [budget,title,repeat,imageCount,maxInFlight,...Object.values(apiFields)]) input.addEventListener('change',()=>{
      try {const options=readOptions();localStorage.setItem(OPTIONS_KEY,JSON.stringify(options));fillOptions(options);render();}
      catch(error) {fillOptions(savedOptions);message=`기본 옵션 저장 실패: ${error.message}\n화면과 실행 옵션을 이전 설정으로 되돌렸습니다.`;render();}
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
        id:crypto.randomUUID(), title:`${title.value.trim() || 'PixAI'}_${index+1}_${n+1}`, prompt:parts[index], maxCredits, state:'queued', saved:[],apiOptions:{...apiOptions},apiBatchSize:Number(imageCount.value) || expectedCount()
      });
      jobs.push(...added); persist(); prompts.value=''; message=`${added.length}개 작업을 추가했습니다.`; render();
    }));
    add.dataset.edit='';
    const run = button('시작 / 같은 작업 재개', start); run.dataset.start=''; run.dataset.primary='';run.dataset.headerFeedback='';
    const testRun=button('첫 작업만 실행',()=>start({oneJob:true}));testRun.dataset.edit='';testRun.dataset.headerFeedback='';testRun.title='첫 미완료 작업 1회만 생성·저장합니다. 나머지 작업은 유지합니다.';decorateIcon(testRun,'play_arrow');
    simple.append(add);
    const editorSlot=node('div',null,{class:'pq-workspace'});panel.append(editorSlot);
    let attachRuntimePages=()=>{};
    function mountEditor() { try { presetEditor=mountPresetEditor(editorSlot, {
      isBusy:() => starting || settingsBusy, // library/compose editing stays open while this tab runs the queue; render() locks runtime pages
      load:readLibrary,save:saveLibrary,button,
      isCompact:()=>(panel.getBoundingClientRect().width || document.documentElement?.clientWidth || window.innerWidth)<=760,
      loadLayout:key=>JSON.parse(localStorage.getItem(`local.pixai-web-queue.layout.v1.${key}`) || 'null'),
      saveLayout:(key,value)=>localStorage.setItem(`local.pixai-web-queue.layout.v1.${key}`,JSON.stringify(value)),
      notify:notifyAction,
      captureSettings:()=>settingsAction(()=>capturePresetSettings(settings,readLoraTriggerWords),{readOnly:true}),
      applySettings:value=>settingsAction(()=>settings.apply(value)),
      enqueue:value=>queueEdit(()=>{
        const added=expandPresetReservations(value,{maxCredits:budget.value.trim()||null,titlePrefix:title.value.trim()});
        for (const job of added) {job.apiOptions={...apiOptions};job.apiBatchSize=Number(imageCount.value) || expectedCount();}
        if (jobs.length+added.length>1000) throw new Error('대기열은 최대 1,000개까지 추가할 수 있습니다.');
        if (value.reservations.some(res=>jobs.some(job=>job.composition?.reservation?.id===res.id))) throw new Error('이미 등록된 예약이 있습니다. 해당 예약을 제외하고 새로 예약해 주세요.');
        jobs.push(...added);persist();
        saveLibrary({...value,reservations:[]});presetEditor.refresh();
        message=`조합 ${added.length}개를 대기열에 등록했습니다. 예약은 비웠고 작업별 설정은 보존했습니다.${running ? (stopRequested ? ' 중지 요청 중이므로 다음 시작 때 실행합니다.' : oneJobRun ? ' 첫 작업만 실행 중이므로 이번에는 실행하지 않고 다음 시작 때 실행합니다.' : ' 실행 중인 작업이 끝나면 순서대로 이어서 실행합니다.') : ''}`;render();
      })
    }); attachRuntimePages(); } catch(error) { message=`프리셋 라이브러리 읽기 실패: ${error.message}`; } }
    mountEditor();
    const stopButton=button('중지',()=>{stopRequested=true;message='다음 제출 중지 요청. 진행 중인 서버 작업은 취소하지 않습니다.';render();});
    stopButton.dataset.headerFeedback='';
    panel.append(simple,run,stopButton);
    panel.append(node('div',null,{'data-jobs':''}));
    const exportQueue = button('대기열 백업', async () => {
      const blob = new Blob([JSON.stringify({version:1,jobs,library:readLibrary()},null,2)],{type:'application/json'});
      if (storage.mode === 'download') { await writeNew('pixai-queue-backup.json',blob);message='대기열 백업 다운로드 완료';render();return; }
      const url = URL.createObjectURL(blob); const anchor=node('a',null,{href:url,download:'pixai-queue-backup.json'});
      anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
    });
    panel.append(exportQueue);
    const backups=node('details');backups.append(node('summary','설정 내보내기 · 불러오기'));
    backups.append(node('small','공통문·프리셋·캐릭터·청크·폴더·목록 순서·예약 사본·최근 조합·즐겨찾기와 실행 옵션을 JSON으로 보관합니다. 편집한 항목은 먼저 저장해 주세요.'));
    const settingsStore=createSettingsStore(localStorage,{library:LIBRARY_KEY,options:OPTIONS_KEY,previous:PREVIOUS_SETTINGS_KEY});
    function idleSettings() {
      if (running || starting || settingsBusy || choosingFolder) throw new Error('진행 중인 작업이 끝난 뒤 설정을 불러오거나 내보내 주세요.');
    }
    function backupButton(label,run) {const control=button(label,()=>{idleSettings();return run();});control.dataset.edit='';return control;}
    const saveSettings=backupButton('설정 내보내기',async()=>{
      const data=makeSettingsBackup(readLibrary(),readOptions(),{appVersion:'0.9.8',exportedAt:new Date().toISOString()});
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
          preview.append(node('strong',file.name),node('p',`프리셋 ${library.presets.length}개 · 캐릭터 ${library.characters.length}개 · 청크 ${library.scenes.length}개 · 폴더 ${library.chunkFolders.length}개 · 예약 ${library.reservations.length}개 · 조합 기록 ${(library.combinations || []).length}개 · 즐겨찾기 ${(library.combinations || []).filter(item=>item.favorite).length}개`),
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
    const footer=node('div',null,{class:'pq-footer'});
    const storageLink=node('button','저장 설정',{type:'button','aria-label':'저장 설정 열기'});
    decorateIcon(storageLink,'settings');decorateIcon(run,'play_arrow');decorateIcon(stopButton,'stop');
    storageLink.addEventListener('click',()=>presetEditor?.showPage('settings',true));
    footer.append(storageLink,node('span',null,{'data-queue-counts':'',role:'status'}),run,stopButton);
    const folderStatus=panel.querySelector('[data-folder]'),jobsView=panel.querySelector('[data-jobs]');
    const intro=[...panel.children].find(child=>child.tagName.toLowerCase()==='small');
    const settingsContent=node('div',null,{class:'pq-settings-content'});
    settingsContent.append(node('h3','공식 API 연결·생성 옵션'),apiContent,node('h3','저장 위치'),folderStatus,choose,chooseOther,node('h3','실행 옵션'),budgetLabel,budget,imageCountLabel,inFlightLabel,node('small','작업별 프롬프트를 순서대로 미리 등록합니다. 한 작업을 저장하면 다음 작업을 채웁니다. 첫 작업만 실행은 1건만 처리합니다.'),node('h3','설정 백업'),backups);
    backups.open=true;
    const queueContent=node('div',null,{class:'pq-queue-content'});queueContent.append(node('h3','등록된 대기열'),testRun,jobsView,simple,exportQueue);simple.open=true;
    attachRuntimePages=()=>{
      presetEditor.addPage('queue','대기열',queueContent);presetEditor.addPage('settings','설정',settingsContent);
      editorSlot.replaceChildren(presetEditor.root);
    };
    if (presetEditor) attachRuntimePages();else editorSlot.append(settingsContent,queueContent);
    const resizeHandle=node('div',null,{class:'pq-window-resize',role:'button',tabindex:'0','aria-label':'작업창 크기 조절',title:'드래그해 작업창 크기 조절 · 방향키로 조절'});resizeHandle.append(materialIcon('open_in_full'));
    intro?.remove();panel.append(footer,resizeHandle);
    style.textContent += `
#local-pixai-queue:not([data-minimized="true"]){width:min(920px,calc(100vw - 24px));height:min(700px,calc(100vh - 24px));max-height:none;display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:16px;background:#222529}
#local-pixai-queue [hidden]{display:none!important}
#local-pixai-queue [data-header]{position:static;height:54px;margin:0;padding:12px 16px;flex:none;border-bottom:1px solid #41474f}
#local-pixai-queue [data-message]{position:static;flex:none;max-height:56px;overflow:auto;margin:8px 12px;padding:6px 10px;font-size:13px}
#local-pixai-queue .pq-workspace{flex:1;min-height:0;overflow:hidden}
#local-pixai-queue .pq-presets{height:100%;display:flex;flex-direction:column}
#local-pixai-queue .pq-tabs{display:flex;gap:2px;overflow:auto;padding:0 12px;border-bottom:1px solid #41474f;flex:none}
#local-pixai-queue .pq-tabs button{background:transparent;border:0;border-radius:0;margin:0;padding:10px 12px;white-space:nowrap;font-size:14px;color:#bbc3cc;border-bottom:2px solid transparent}
#local-pixai-queue .pq-tabs button[aria-selected="true"]{color:#e6f2fc;background:#29343d;border-bottom-color:#94bedf}
#local-pixai-queue .pq-pages{flex:1;min-height:0;overflow:hidden}
#local-pixai-queue .pq-preset-body{height:100%;padding:14px;overflow:auto}
#local-pixai-queue .pq-preset-body[data-page="chunks"],#local-pixai-queue .pq-preset-body[data-page="characters"]{display:flex;flex-direction:column;overflow:hidden;padding:0}
#local-pixai-queue .pq-library-layout{display:grid;grid-template-columns:260px minmax(0,1fr);height:100%;flex:1;min-height:0}
#local-pixai-queue .pq-with-folders{grid-template-columns:150px 270px minmax(0,1fr)}
#local-pixai-queue .pq-library-browse{display:flex;flex-direction:column;padding:12px;min-width:0;min-height:0;overflow:hidden;background:#1d2024;border-right:1px solid #41474f}
#local-pixai-queue .pq-library-editor{padding:14px;min-width:0;min-height:0;overflow:auto}
#local-pixai-queue .pq-library-editor>strong{display:block;margin-bottom:10px;font-size:15px}
#local-pixai-queue .pq-folder-rail{padding:14px 8px;min-width:0;overflow:auto;background:#181a1d;border-right:1px solid #41474f}
#local-pixai-queue .pq-folder-rail>strong{display:block;margin:0 8px 10px;color:#bbc3cc;font-size:13px}
#local-pixai-queue .pq-folder-buttons button{display:block;width:100%;text-align:left;margin:2px 0;border:0;background:transparent;overflow-wrap:anywhere;font-size:13px;padding:8px}
#local-pixai-queue .pq-folder-buttons button[aria-pressed="true"]{background:#30363c;color:#e6f2fc}
#local-pixai-queue .pq-folder-rail details{margin-top:20px}
#local-pixai-queue .pq-folder-rail .pq-actions button{font-size:12px}
#local-pixai-queue .pq-presets .pq-library-browse .pq-chunk-list,#local-pixai-queue .pq-saved-list{flex:1;min-height:0;max-height:none;overflow:auto;border:0;border-radius:0;margin:8px -4px}
#local-pixai-queue .pq-presets .pq-manager-row{border-top:0;border-bottom:1px solid #41474f;padding:10px 8px}
#local-pixai-queue .pq-presets .pq-manager-row small{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-height:42px;font-size:13px}
#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-name-button{font-size:14px}
#local-pixai-queue .pq-presets .pq-chunk-row-head input[type="checkbox"]{width:15px;height:15px;flex:none;margin:0;padding:0;accent-color:#94bedf}
#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-drag-handle{flex:none;width:20px;min-height:28px;margin:0;padding:0;border:0;background:transparent;font-size:19px;cursor:grab;color:#b6c1cc}
#local-pixai-queue .pq-presets .pq-drag-handle:active{cursor:grabbing;transform:none}
#local-pixai-queue .pq-presets .pq-manager-row[data-managed="true"]{background:#29343d}
#local-pixai-queue .pq-presets .pq-manager-row[data-chunk-dragging="true"]{opacity:.5}
#local-pixai-queue .pq-presets .pq-manager-row[data-drop-position="before"]{box-shadow:inset 0 3px 0 #acd1ed}
#local-pixai-queue .pq-presets .pq-manager-row[data-drop-position="after"]{box-shadow:inset 0 -3px 0 #acd1ed}
#local-pixai-queue .pq-presets [data-drop-active="true"]{outline:2px dashed #acd1ed;outline-offset:-3px;background:#39434d}
#local-pixai-queue .pq-chunk-management{flex:none;padding:8px;border:1px solid #627d91;border-radius:8px;background:#29343d;margin:4px 0}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:5px 0}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-actions button{padding:6px 3px;white-space:nowrap}
#local-pixai-queue .pq-bulk-move{display:flex;gap:6px;align-items:flex-end}
#local-pixai-queue .pq-bulk-move label{flex:1;min-width:0;margin:0}
#local-pixai-queue .pq-bulk-move button{flex:none;margin:0}
#local-pixai-queue .pq-saved-card{width:100%;display:block;text-align:left;padding:12px;margin:0 0 6px;background:transparent;border:1px solid transparent;font-weight:600;overflow-wrap:anywhere}
#local-pixai-queue .pq-saved-card small{font-weight:400;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px}
#local-pixai-queue .pq-saved-card[aria-pressed="true"]{background:#30363c;border-color:#759bb8}
#local-pixai-queue .pq-presets label{font-size:13px;margin:4px 0}
#local-pixai-queue .pq-actions [data-action-message]{order:1;flex-basis:100%;font-size:12px;margin:3px 0;padding:4px 8px}
#local-pixai-queue .pq-library-editor input,#local-pixai-queue .pq-library-editor textarea{margin:3px 0}
#local-pixai-queue .pq-library-editor textarea{min-height:76px;height:76px}
#local-pixai-queue .pq-library-editor textarea[aria-label$="프롬프트"]{min-height:120px;height:120px}
#local-pixai-queue .pq-preset-body[data-page="presets"]{display:grid;grid-template-columns:270px minmax(0,1fr);padding:0;overflow:hidden}
#local-pixai-queue .pq-lora{display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:0 12px}
#local-pixai-queue .pq-lora>:nth-child(n+3){grid-column:1 / -1}
#local-pixai-queue .pq-compose-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);height:100%;gap:20px}
#local-pixai-queue .pq-compose-choices{display:flex;flex-direction:column;min-height:0;min-width:0}
#local-pixai-queue .pq-compose-choices>.pq-chunk-list{flex:1;min-height:120px;max-height:none}
#local-pixai-queue .pq-compose-choices>.pq-selected-chunks{max-height:96px;overflow:auto;flex:none}
#local-pixai-queue .pq-compose-review{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;padding-right:4px}
#local-pixai-queue .pq-compose-summary{flex:1;min-height:0;overflow:auto;margin-bottom:8px;padding-right:4px}
#local-pixai-queue .pq-compose-review>button{flex:none;align-self:flex-start}
#local-pixai-queue .pq-compose-review>button:last-child{align-self:stretch}
#local-pixai-queue .pq-compose-review .pq-preview{flex:none;max-height:140px;min-height:100px;background:#181a1d;padding:12px;border:1px solid #41474f;border-radius:8px;font-size:13px}
#local-pixai-queue .pq-reservation-list{max-height:210px;overflow:auto;margin:6px 0}
#local-pixai-queue .pq-compose-review .pq-reservation{margin:8px 0}
#local-pixai-queue .pq-presets .pq-chunk-option{padding:10px}
#local-pixai-queue .pq-footer{display:flex;align-items:center;gap:6px;padding:9px 14px;border-top:1px solid #41474f;flex:none;background:#181a1d}
#local-pixai-queue .pq-footer>[data-start]{margin-left:auto}
#local-pixai-queue .pq-footer button{margin:0;white-space:nowrap}
#local-pixai-queue [data-jobs]{max-height:none;overflow:visible}
#local-pixai-queue h3{font-size:15px;margin:0 0 12px}
#local-pixai-queue .pq-settings-content,#local-pixai-queue .pq-queue-content{max-width:700px;margin:auto}
#local-pixai-queue .pq-settings-content h3:not(:first-child){margin-top:24px}
#local-pixai-queue .pq-library-mode{display:none}
#local-pixai-queue .pq-library-mode button[aria-pressed="true"]{border-color:#94bedf;background:#39434d}
#local-pixai-queue button:not(:disabled):active{transform:scale(.98)}
@media (max-width:760px){#local-pixai-queue .pq-with-folders{grid-template-columns:125px 220px minmax(0,1fr)}#local-pixai-queue .pq-tabs button{padding:9px 10px;font-size:13px}}
@media (max-width:620px){
#local-pixai-queue [data-header]{padding:10px 12px;height:48px}#local-pixai-queue [data-drag-handle]{font-size:15px}
#local-pixai-queue .pq-library-mode{display:flex;gap:6px;padding:5px 10px;border-bottom:1px solid #41474f;flex:none}
#local-pixai-queue .pq-library-layout{grid-template-columns:minmax(0,1fr)}#local-pixai-queue .pq-with-folders{grid-template-columns:110px minmax(0,1fr)}
#local-pixai-queue [data-library-mode="browse"] .pq-library-editor{display:none}#local-pixai-queue [data-library-mode="edit"] .pq-library-browse,#local-pixai-queue [data-library-mode="edit"] .pq-folder-rail{display:none}
#local-pixai-queue [data-library-mode="edit"] .pq-library-layout{grid-template-columns:minmax(0,1fr)}
#local-pixai-queue .pq-compose-layout{display:block;height:auto}#local-pixai-queue .pq-compose-choices>.pq-chunk-list{max-height:210px;flex:none}#local-pixai-queue .pq-compose-review{display:block;margin-top:16px;overflow:visible}#local-pixai-queue .pq-reservation-list{max-height:240px}
#local-pixai-queue .pq-preset-body[data-page="presets"]{display:flex;flex-direction:column;overflow:hidden}#local-pixai-queue [data-page="presets"] .pq-library-browse,#local-pixai-queue [data-page="presets"] .pq-library-editor{flex:1;min-height:0;overflow:auto}
#local-pixai-queue .pq-footer{padding:8px;gap:4px}#local-pixai-queue .pq-footer button{padding:7px;font-size:12px}
}
@media (prefers-reduced-motion:reduce){#local-pixai-queue button:not(:disabled):active{transform:none}}
`;
    style.textContent += `
#local-pixai-queue .pq-icon{width:20px;height:20px;flex:none;order:-1;pointer-events:none;color:inherit}
#local-pixai-queue button[data-icon]{display:inline-flex;align-items:center;justify-content:center;gap:6px}
#local-pixai-queue .pq-tabs button[data-icon]{gap:7px}
#local-pixai-queue .pq-button-picker{min-width:0;margin:5px 0}
#local-pixai-queue .pq-button-picker>strong{display:block;font-size:13px;color:#bbc3cc;margin-bottom:5px;font-weight:500}
#local-pixai-queue .pq-choice-list{height:88px;min-height:54px;max-height:220px;overflow:auto;resize:vertical;border:1px solid #41474f;border-radius:6px;background:#181a1d;padding:3px}
#local-pixai-queue .pq-choice-list button[data-icon]{display:flex;justify-content:flex-start;text-align:left;width:100%;min-height:32px;padding:6px 8px;margin:1px 0;border:1px solid transparent;background:transparent;white-space:normal;overflow-wrap:anywhere;line-height:1.35}
#local-pixai-queue .pq-choice-list button[aria-pressed="true"]{background:#29343d;border-color:#627d91;color:#edf1f5}
#local-pixai-queue .pq-folder-buttons button[data-icon]{display:flex;justify-content:flex-start}
#local-pixai-queue .pq-folder-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#local-pixai-queue .pq-folder-count{flex:none;white-space:nowrap;font-size:12px}
#local-pixai-queue .pq-quick-folder>button{width:100%;justify-content:flex-start;font-size:13px;padding:5px 8px;background:transparent;border-style:dashed}
#local-pixai-queue .pq-quick-folder-form{padding:6px 0}
#local-pixai-queue .pq-quick-folder-form .pq-actions{display:flex;flex-wrap:wrap}
#local-pixai-queue .pq-quick-folder-form .pq-actions button{white-space:normal}
#local-pixai-queue .pq-resizable-layout{display:flex;gap:0;min-width:0;min-height:0;height:100%;flex:1;overflow:hidden}
#local-pixai-queue .pq-resizable-layout>.pq-library-browse,#local-pixai-queue .pq-resizable-layout>.pq-library-editor,#local-pixai-queue .pq-resizable-layout>.pq-folder-rail{height:100%;min-width:0;min-height:0;border-right:0}
#local-pixai-queue .pq-pane-handle{width:8px;flex:0 0 8px;position:relative;cursor:col-resize;touch-action:none;background:#181a1d;outline-offset:-2px}
#local-pixai-queue .pq-pane-handle:before{content:'';position:absolute;left:3px;top:0;bottom:0;width:1px;background:#41474f}
#local-pixai-queue .pq-pane-handle:after{content:'';position:absolute;left:2px;top:calc(50% - 14px);width:3px;height:28px;border-radius:2px;background:#627d91}
#local-pixai-queue .pq-pane-handle:focus-visible{outline:2px solid #acd1ed}
#local-pixai-queue .pq-resizable-layout[data-resizing="true"]{user-select:none;cursor:col-resize}
#local-pixai-queue .pq-preset-body[data-page="presets"]{display:flex;flex-direction:column;padding:0}
#local-pixai-queue .pq-compose-choices{padding-right:12px;overflow:auto}
#local-pixai-queue .pq-compose-review{padding-left:12px}
#local-pixai-queue .pq-reserve-selectors .pq-choice-list{height:78px}
#local-pixai-queue .pq-choice-filters{align-items:end}
#local-pixai-queue .pq-choice-filters .pq-choice-list{height:66px}
#local-pixai-queue .pq-chunk-management{display:grid;grid-template-columns:minmax(110px,.6fr) minmax(220px,1fr) minmax(260px,1.4fr);align-items:center;gap:12px;flex:none;max-height:230px;overflow:auto;margin:0;padding:8px 12px;border-width:1px 0 0;border-radius:0;background:#252a2f}
#local-pixai-queue .pq-chunk-management>[role="status"]{font-size:13px}
#local-pixai-queue .pq-chunk-management .pq-move-destination .pq-choice-list{height:66px}
#local-pixai-queue .pq-chunk-management .pq-actions button{min-width:0}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-quick-folder-form .pq-actions{display:flex}
#local-pixai-queue .pq-presets .pq-bulk-move{align-items:center;min-width:0}
#local-pixai-queue .pq-bulk-move>.pq-button-picker{flex:1}
#local-pixai-queue .pq-window-resize{position:absolute;right:3px;bottom:3px;width:23px;height:23px;display:flex;align-items:center;justify-content:center;color:#b6c1cc;cursor:nwse-resize;touch-action:none;border-radius:3px}
#local-pixai-queue .pq-window-resize .pq-icon{width:16px;height:16px}
#local-pixai-queue .pq-footer{padding-right:32px}
#local-pixai-queue[data-minimized="true"]{width:52px!important;height:52px!important}
@media (hover:hover) and (pointer:fine){#local-pixai-queue .pq-pane-handle:hover:after,#local-pixai-queue [data-resizing="true"]>.pq-pane-handle:after{background:#94bedf}#local-pixai-queue .pq-window-resize:hover{background:#29343d;color:#acd1ed}}
@media (max-width:760px){#local-pixai-queue .pq-chunk-management{grid-template-columns:120px minmax(0,1fr)}#local-pixai-queue .pq-chunk-management>.pq-bulk-move{grid-column:1/-1}}
@media (max-width:620px){#local-pixai-queue .pq-pane-handle{display:none}#local-pixai-queue .pq-resizable-layout{display:grid;grid-template-columns:minmax(0,1fr)}#local-pixai-queue .pq-resizable-layout.pq-with-folders{grid-template-columns:95px minmax(0,1fr)}#local-pixai-queue [data-library-mode="edit"] .pq-resizable-layout{grid-template-columns:minmax(0,1fr)}#local-pixai-queue .pq-resizable-layout.pq-compose-layout{display:block;overflow:auto}#local-pixai-queue .pq-compose-choices{overflow:visible;padding-right:0}#local-pixai-queue .pq-compose-review{padding-left:0}#local-pixai-queue .pq-footer{padding-right:28px}#local-pixai-queue .pq-chunk-management{max-height:220px;grid-template-columns:minmax(0,1fr);gap:4px}#local-pixai-queue .pq-chunk-management>.pq-bulk-move{grid-column:auto}#local-pixai-queue .pq-tabs button{gap:5px;padding:9px 10px}#local-pixai-queue .pq-choice-filters{display:block}}
@media (max-width:620px){#local-pixai-queue .pq-resizable-layout.pq-with-folders{grid-template-columns:110px minmax(0,1fr)}#local-pixai-queue [data-library-mode="edit"] .pq-resizable-layout.pq-with-folders{grid-template-columns:minmax(0,1fr)}#local-pixai-queue .pq-folder-buttons button[data-icon]{padding:8px 4px;gap:4px}#local-pixai-queue .pq-folder-buttons .pq-icon{width:16px;height:16px}#local-pixai-queue .pq-folder-count{display:none}#local-pixai-queue .pq-chunk-management{grid-template-columns:50px minmax(0,1fr);column-gap:6px}#local-pixai-queue .pq-chunk-management>.pq-bulk-move{grid-column:1/-1}#local-pixai-queue .pq-chunk-management .pq-move-destination .pq-choice-list{height:54px}#local-pixai-queue .pq-chunk-management .pq-actions button{padding:6px 3px}#local-pixai-queue .pq-chunk-management .pq-actions .pq-icon{width:16px;height:16px}}
`;
    panel.append(node('style',`
#local-pixai-queue{--pq-bg:#16181b;--pq-surface:#1d2024;--pq-raised:#25292e;--pq-hover:#2d3238;--pq-line:#363c44;--pq-text:#e7e9ec;--pq-muted:#a3abb5;--pq-accent:#4fb8a8;--pq-accent-soft:rgba(79,184,168,.16);--pq-manage:#e2b54f;container:pqwin/inline-size;color:var(--pq-text);font:14px/1.45 system-ui,"Malgun Gothic",sans-serif}
#local-pixai-queue:not([data-minimized="true"]){width:min(1180px,calc(100vw - 24px));height:min(786px,calc(100vh - 24px));background:var(--pq-bg);border-color:#4a525c;border-radius:12px}
#local-pixai-queue [data-header]{height:44px;background:var(--pq-bg);padding:8px 14px;border-color:var(--pq-line)}
#local-pixai-queue h2{font-size:15px}#local-pixai-queue small{color:var(--pq-muted);font-size:12px}
#local-pixai-queue :is(button,input,textarea,select){font-size:14px;border-color:#4a525c;background:var(--pq-raised);color:var(--pq-text);min-width:0}
#local-pixai-queue button{min-height:34px}#local-pixai-queue button:not(:disabled):hover{background:var(--pq-hover);border-color:#6a747f}
#local-pixai-queue :is(button,input,textarea,select,summary):focus-visible{outline:2px solid var(--pq-accent);outline-offset:1px}
#local-pixai-queue input[type="checkbox"]{accent-color:var(--pq-accent)}
#local-pixai-queue [data-primary]{background:var(--pq-accent);border-color:var(--pq-accent);color:#0d2723;font-weight:650}
#local-pixai-queue [data-primary]:not(:disabled):hover{background:#75ccbe;border-color:#75ccbe;color:#0d2723}
#local-pixai-queue [data-message]{background:var(--pq-surface);border-color:var(--pq-line);margin:6px 12px;max-height:48px;font-size:12px}
#local-pixai-queue [data-message]:empty{display:none}
#local-pixai-queue [data-toast]{position:absolute;bottom:112px;left:14px;right:14px;z-index:8;border:1px solid var(--pq-accent);border-radius:8px;background:#20312e;box-shadow:0 6px 24px #0006;padding:9px 12px;max-height:108px;overflow:auto;white-space:pre-wrap;font-size:13px}
#local-pixai-queue .pq-tabs{background:var(--pq-bg);border-color:var(--pq-line)}
#local-pixai-queue .pq-tabs button[aria-selected="true"]{background:transparent;color:var(--pq-text);border-bottom-color:var(--pq-accent)}
#local-pixai-queue .pq-presets .pq-preset-body[data-page="library"]{display:flex;flex-direction:column;overflow:hidden;padding:0}
#local-pixai-queue .pq-library-tabs{display:flex;gap:6px;flex:none;padding:8px 10px;border-bottom:1px solid var(--pq-line);overflow:auto}
#local-pixai-queue .pq-library-tabs button{white-space:nowrap;margin:0;background:transparent;min-height:32px}
#local-pixai-queue .pq-library-tabs button[aria-selected="true"]{background:var(--pq-raised);border-color:#79818b}
#local-pixai-queue [data-page="library"]>.pq-preset-body{flex:1;height:auto;min-height:0}
#local-pixai-queue .pq-inline-library{display:flex;flex:1;min-height:0;overflow:hidden}
#local-pixai-queue .pq-inline-library>.pq-library-browse{flex:1;width:100%;padding:12px 14px;border:0;background:var(--pq-bg)}
#local-pixai-queue .pq-inline-library .pq-library-editor{display:block;overflow:visible;padding:12px;border:1px solid #79818b;border-radius:8px;background:var(--pq-surface);margin:8px 0}
#local-pixai-queue .pq-presets [data-page="chunks"] .pq-library-editor{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px 12px}
#local-pixai-queue [data-page="chunks"] .pq-library-editor>strong,#local-pixai-queue [data-page="chunks"] .pq-library-editor>.pq-actions{grid-column:1/-1}
#local-pixai-queue [data-page="chunks"] .pq-library-editor>.pq-button-picker .pq-choice-list{height:48px;min-height:36px}
#local-pixai-queue [data-page="chunks"] .pq-library-editor>label{min-width:0;margin:0}
#local-pixai-queue .pq-presets .pq-inline-library .pq-library-editor textarea{height:90px;min-height:70px}
#local-pixai-queue .pq-library-mode{display:none}
#local-pixai-queue .pq-presets .pq-folder-group{border:1px solid var(--pq-line);border-radius:7px;overflow:hidden;margin:0 0 7px;background:var(--pq-bg)}
#local-pixai-queue .pq-presets .pq-folder-group summary{padding:7px 9px;background:var(--pq-surface);font-size:13px;line-height:1.5;cursor:pointer}
#local-pixai-queue .pq-folder-title{display:inline-block;max-width:calc(100% - 45px);overflow-wrap:anywhere;vertical-align:middle}
#local-pixai-queue .pq-folder-group summary button{float:right;width:30px;padding:0;min-height:28px;margin:-2px 0 0;background:transparent}
#local-pixai-queue .pq-presets .pq-manager-row{padding:7px 9px;background:transparent;border-left:0;border-color:var(--pq-line)}
#local-pixai-queue .pq-presets .pq-manager-row[data-selected="true"]{background:var(--pq-surface)}
#local-pixai-queue .pq-presets .pq-manager-row[data-managed="true"]{background:rgba(226,181,79,.14)}
#local-pixai-queue .pq-presets .pq-chunk-row-head input[type="checkbox"]{accent-color:var(--pq-manage)}
#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-name-button{font-size:14px;white-space:normal;text-align:left}
#local-pixai-queue .pq-presets .pq-chunk-row-head .pq-actions button{min-height:30px;width:30px}
#local-pixai-queue .pq-saved-card{background:var(--pq-surface);border-color:var(--pq-line);padding:10px;text-align:left}
#local-pixai-queue .pq-saved-card[aria-pressed="true"]{border-color:#79818b;background:var(--pq-raised)}
#local-pixai-queue .pq-preset-card{margin-bottom:7px}#local-pixai-queue .pq-preset-card>.pq-saved-card{margin:0}
#local-pixai-queue .pq-presets label,#local-pixai-queue .pq-presets button{font-size:14px}
#local-pixai-queue .pq-presets .pq-chunk-management{background:#2d291f;border-color:#6c5b35;padding:7px 12px;gap:8px;max-height:180px}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-choice-list{height:48px;min-height:36px}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-actions{display:flex;flex-wrap:wrap}
#local-pixai-queue .pq-presets .pq-chunk-management .pq-actions button{flex:1;min-height:34px;white-space:normal}
#local-pixai-queue .pq-presets [data-page="compose"]{display:flex;flex-direction:column;overflow:hidden;padding:0;min-height:0}
#local-pixai-queue .pq-compose-layout{display:flex;min-height:0;flex:1;gap:0;height:auto}
#local-pixai-queue .pq-compose-layout>div:not(.pq-pane-handle){padding:12px;display:flex;flex-direction:column;gap:6px;min-width:0;min-height:0;overflow:auto;height:100%}
#local-pixai-queue .pq-presets .pq-compose-choices>.pq-chunk-list{flex:1;min-height:130px;max-height:none;border:0;margin:0;overflow:auto}
#local-pixai-queue .pq-compose-choices>.pq-selected-chunks{font-size:12px;padding:5px 8px;border:0;background:var(--pq-accent-soft);max-height:70px}
#local-pixai-queue .pq-compose-choices>.pq-selected-chunks small{display:none}
#local-pixai-queue .pq-choice-filters label{margin:0}#local-pixai-queue .pq-choice-filters input{margin:0}
#local-pixai-queue .pq-choice-list{background:var(--pq-surface);border-color:var(--pq-line)}
#local-pixai-queue .pq-reserve-selectors .pq-choice-list{height:85px;min-height:40px}
#local-pixai-queue .pq-choice-list button[aria-pressed="true"]{background:var(--pq-accent-soft);border-color:var(--pq-accent);color:var(--pq-text)}
#local-pixai-queue .pq-presets .pq-chunk-option{padding:7px 9px;align-items:center;font-size:14px;border-color:var(--pq-line)}
#local-pixai-queue .pq-selection-number{flex:none!important;min-width:22px;text-align:center;font-size:12px;color:var(--pq-accent)}
#local-pixai-queue .pq-sequence-list{flex:1;min-height:120px;overflow:auto}
#local-pixai-queue .pq-fixed-material{padding:7px 9px;border-left:3px solid #76889e;background:#242a31;margin-bottom:5px}
#local-pixai-queue .pq-fixed-material:nth-child(2){border-color:var(--pq-manage);background:#302b20}
#local-pixai-queue .pq-fixed-material:nth-child(3){border-color:#6fc47c;background:#202d25}
#local-pixai-queue .pq-fixed-material strong{font-size:12px}#local-pixai-queue .pq-fixed-material small{max-height:50px;overflow:auto;overflow-wrap:anywhere}
#local-pixai-queue .pq-recipe-row{display:flex;align-items:center;gap:5px;border:1px solid var(--pq-line);border-left:3px solid var(--pq-accent);border-radius:6px;padding:6px;margin-bottom:5px;background:var(--pq-accent-soft)}
#local-pixai-queue .pq-recipe-row>button{padding:0;width:24px;margin:0;border:0;background:transparent;cursor:grab;flex:none}
#local-pixai-queue .pq-recipe-title{flex:1;min-width:0;overflow-wrap:anywhere}#local-pixai-queue .pq-recipe-title small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#local-pixai-queue .pq-recipe-row .pq-actions{flex:none;gap:2px;margin:0}#local-pixai-queue .pq-recipe-row .pq-actions button{width:25px;padding:0;font-size:15px}
#local-pixai-queue [data-recipe-material][data-drop-position="before"]{box-shadow:inset 0 3px var(--pq-accent)}#local-pixai-queue [data-recipe-material][data-drop-position="after"]{box-shadow:inset 0 -3px var(--pq-accent)}
#local-pixai-queue .pq-compose-review .pq-preview{max-height:160px;min-height:85px;overflow:auto;border-color:var(--pq-line);background:var(--pq-surface);font-size:13px;margin:0;padding:10px;resize:vertical}
#local-pixai-queue .pq-missing-notice{flex:none;max-height:120px;overflow:auto;border:1px solid var(--pq-manage);background:#2d291f;padding:8px;border-radius:7px;font-size:13px}
#local-pixai-queue .pq-reserve-actions{display:flex;gap:5px}#local-pixai-queue .pq-reserve-actions>button:first-child{flex:1}
#local-pixai-queue .pq-reserve-actions button{margin:0}
#local-pixai-queue .pq-schedule-tabs{display:flex;gap:4px;flex:none;overflow:auto;padding-top:7px;border-top:1px solid var(--pq-line)}
#local-pixai-queue .pq-schedule-tabs button{margin:0;flex:1;white-space:nowrap;padding:6px 8px;font-size:13px}
#local-pixai-queue .pq-schedule-tabs button[aria-pressed="true"]{border-color:var(--pq-accent);background:var(--pq-accent-soft)}
#local-pixai-queue .pq-reservation-list,#local-pixai-queue .pq-history-list{flex:1;min-height:0;max-height:none;overflow:auto;margin:0}
#local-pixai-queue .pq-presets .pq-reservation,#local-pixai-queue .pq-history-card{padding:9px;border:1px solid var(--pq-line);border-radius:7px;background:var(--pq-surface);margin:0 0 7px;overflow-wrap:anywhere}
#local-pixai-queue .pq-reservation strong,#local-pixai-queue .pq-history-card strong{display:block;font-size:14px}
#local-pixai-queue .pq-registration-bar{display:flex;align-items:center;gap:12px;justify-content:space-between;border-top:1px solid var(--pq-line);padding:8px 12px;flex:none;background:var(--pq-surface)}
#local-pixai-queue .pq-registration-bar button{margin:0;font-size:13px}#local-pixai-queue .pq-registration-bar span{font-size:12px;color:var(--pq-muted)}
#local-pixai-queue .pq-footer{background:var(--pq-bg);border-color:var(--pq-line)}
#local-pixai-queue .pq-job-menu{display:inline-block;margin:4px 0;border:0;position:relative}#local-pixai-queue .pq-job-menu summary{cursor:pointer;font-size:22px;padding:0 10px;list-style:none}
#local-pixai-queue *{scrollbar-width:thin;scrollbar-color:#4a525c #1d2024}#local-pixai-queue *::-webkit-scrollbar{width:7px;height:7px}#local-pixai-queue *::-webkit-scrollbar-thumb{background:#4a525c;border-radius:4px}#local-pixai-queue *::-webkit-scrollbar-track{background:#1d2024}
#local-pixai-queue .pq-job-timeline{display:flex;gap:6px;margin:7px 0;flex-wrap:wrap;font-size:12px}#local-pixai-queue .pq-job-timeline span{padding:3px 7px;border-radius:5px;background:var(--pq-raised)}#local-pixai-queue .pq-job-timeline [data-complete="true"]{color:var(--pq-accent)}
#local-pixai-queue .pq-job-detail{margin:7px 0}#local-pixai-queue .pq-job-detail summary{cursor:pointer;font-size:13px}#local-pixai-queue .pq-job-prompt{white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;background:var(--pq-surface);border-radius:5px;font-size:13px;max-height:180px;overflow:auto}
#local-pixai-queue [data-queue-counts]{font-size:12px;color:var(--pq-muted);margin-left:auto}
#local-pixai-queue .pq-pane-handle{background:var(--pq-bg)}#local-pixai-queue .pq-pane-handle:before{background:var(--pq-line)}#local-pixai-queue .pq-pane-handle:after{background:#4a525c}
#local-pixai-queue .pq-compose-mode{display:none}
@container pqwin (max-width:760px){
#local-pixai-queue .pq-compose-mode{display:flex;gap:5px;padding:6px 10px;flex:none;border-bottom:1px solid var(--pq-line)}
#local-pixai-queue .pq-compose-mode button{flex:1;white-space:nowrap;margin:0;padding:5px;font-size:13px}
#local-pixai-queue .pq-compose-mode button[aria-pressed="true"]{background:var(--pq-accent-soft);border-color:var(--pq-accent)}
#local-pixai-queue .pq-compose-layout{display:flex!important;overflow:hidden;min-height:0}
#local-pixai-queue .pq-compose-layout>.pq-pane-handle{display:none}
#local-pixai-queue .pq-compose-layout>div:not(.pq-pane-handle){flex:1!important;min-height:0;margin:0;padding:10px;width:100%;height:100%;overflow:auto}
#local-pixai-queue .pq-compose-layout>.pq-compose-choices{gap:4px;overflow:auto}
#local-pixai-queue .pq-compose-choices>strong{display:none}
#local-pixai-queue .pq-reserve-selectors .pq-choice-list{height:58px}
#local-pixai-queue .pq-presets .pq-compose-choices>.pq-chunk-list{min-height:160px}
#local-pixai-queue [data-compose-mode="choices"] .pq-compose-review,#local-pixai-queue [data-compose-mode="choices"] .pq-compose-schedule,#local-pixai-queue [data-compose-mode="review"] .pq-compose-choices,#local-pixai-queue [data-compose-mode="review"] .pq-compose-schedule,#local-pixai-queue [data-compose-mode="schedule"] .pq-compose-choices,#local-pixai-queue [data-compose-mode="schedule"] .pq-compose-review{display:none!important}
#local-pixai-queue .pq-resizable-layout:not(.pq-compose-layout){display:flex;flex-direction:column}
#local-pixai-queue .pq-resizable-layout:not(.pq-compose-layout)>.pq-pane-handle{display:none}
#local-pixai-queue [data-page="characters"] .pq-library-mode{display:flex;gap:5px;padding:5px 10px}
#local-pixai-queue [data-page="characters"][data-library-mode="browse"] .pq-library-editor,#local-pixai-queue [data-page="characters"][data-library-mode="edit"] .pq-library-browse{display:none}
#local-pixai-queue [data-page="characters"] .pq-resizable-layout>div:not(.pq-pane-handle){flex:1!important;width:100%}
#local-pixai-queue .pq-presets .pq-inline-library .pq-library-editor{display:block}#local-pixai-queue .pq-presets [data-page="chunks"] .pq-library-editor{display:grid}
#local-pixai-queue .pq-inline-library>.pq-library-browse{display:flex!important;padding:8px}
#local-pixai-queue .pq-presets .pq-chunk-management{display:flex;flex-wrap:wrap;max-height:155px;gap:4px}
#local-pixai-queue .pq-chunk-management>.pq-bulk-move{width:100%}
#local-pixai-queue .pq-tabs button{padding:8px;gap:5px;font-size:13px}
#local-pixai-queue [data-queue-counts]{display:none}
#local-pixai-queue .pq-library-tabs{padding:6px;gap:4px}#local-pixai-queue .pq-library-tabs button{padding:5px 8px;font-size:13px}
#local-pixai-queue .pq-registration-bar{gap:6px;padding:6px 8px}#local-pixai-queue .pq-registration-bar button{font-size:12px;padding:6px}
}
`));
    style.textContent+='#local-pixai-queue label.pq-check-label{display:flex;align-items:flex-start;justify-content:flex-start;gap:9px;text-align:left;cursor:pointer;max-width:none;margin:10px 0}#local-pixai-queue label.pq-check-label>input[type="checkbox"]{width:17px;height:17px;flex:0 0 17px;margin:3px 0 0;padding:0;align-self:flex-start}#local-pixai-queue .pq-queue-toolbar button[aria-pressed="true"]{border-color:#62bea8;background:#21483f}#local-pixai-queue .pq-queue-confirm{padding:10px;border:1px solid #c9a469;border-radius:8px;margin:8px 0}#local-pixai-queue label.pq-check-label>strong{flex:1;min-width:0;overflow-wrap:anywhere}#local-pixai-queue label.pq-check-label>span{flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere}';
    document.body.append(panel);
    try { load(); } catch(error) { message=`대기열 읽기 실패: ${error.message}\n프리셋 읽기·편집은 사용할 수 있습니다. 대기열 원본은 유지했습니다.`; }
    render();
    panelDrag=bindPanelDrag(panel, dragHandle, {
      launcher, open:() => minimize(false),
      viewport:() => ({width:document.documentElement?.clientWidth || window.innerWidth,height:document.documentElement?.clientHeight || window.innerHeight}),
      load:() => JSON.parse(localStorage.getItem('local.pixai-web-queue.position.v1') || 'null'),
      save:position => localStorage.setItem('local.pixai-web-queue.position.v1', JSON.stringify(position)),
      onResize:action => {
        window.addEventListener('resize', action);
        new ResizeObserver(action).observe(panel);
      }
    });
    bindWindowResize(panel,resizeHandle,{
      viewport:()=>({width:document.documentElement?.clientWidth || window.innerWidth,height:document.documentElement?.clientHeight || window.innerHeight}),
      load:()=>JSON.parse(localStorage.getItem('local.pixai-web-queue.size.v1') || 'null'),
      save:value=>localStorage.setItem('local.pixai-web-queue.size.v1',JSON.stringify(value)),
      onResize:listener=>window.addEventListener('resize',listener)
    });
    if (storage.mode === 'folder' && typeof indexedDB !== 'undefined') folderRestoration=restoreSelectedFolder();
  }
  async function restoreSelectedFolder() {
    const epoch=folderEpoch;restoringFolder=true;render();
    try {
      let record=await folderRecord();
      if (!record || epoch !== folderEpoch) return;
      if (record.kind === 'directory') record={handle:record,token:null};
      if (record.handle?.kind !== 'directory' || typeof record.handle.queryPermission !== 'function' || typeof record.handle.isSameEntry !== 'function' || (record.token != null && (typeof record.token !== 'string' || !record.token))) throw new Error('저장된 폴더 기록의 형식을 확인하지 못했습니다.');
      const permission=await record.handle.queryPermission({mode:'readwrite'});
      if (!['granted','prompt','denied'].includes(permission)) throw new Error('저장 폴더 권한을 확인하지 못했습니다.');
      if (epoch !== folderEpoch) return; // A newer user selection wins.
      rememberedFolder=record;
      if (permission === 'granted') {
        folder=record.handle;folderToken=record.token;
        if (!starting && !settingsBusy && message === storage.message) message=`저장 폴더 자동 연결: ${folder.name}`;
      } else if (!starting && !settingsBusy && message === storage.message) message=`이전 저장 폴더 ${record.handle.name}을 기억하고 있습니다. 설정에서 ‘저장 폴더 권한 허용’을 눌러 주세요.`;
    } catch(error) { if (epoch === folderEpoch && !starting && !settingsBusy && message === storage.message) message=`저장 폴더 기록을 복원하지 못했습니다. 폴더를 선택해 주세요. (${error.message})`; }
    finally { if (epoch === folderEpoch) restoringFolder=false;render(); }
  }
  async function chooseFolder({pickNew=false}={}) {
    if (choosingFolder || running || starting || settingsBusy) return;
    if (!storage.supported) { message = storage.message; render(); return; }
    choosingFolder = true;
    folderEpoch++;restoringFolder=false;
    const choose = panel.querySelector('[data-choose-folder]');
    choose.disabled = true; choose.textContent = storage.mode === 'download' ? '확인 파일 다운로드 중…' : '폴더 선택 중…';
    const notify = text => { message = text; render(); };
    try {
      if (storage.mode === 'download') {
        downloadsReady = false;
        notify('확인 파일 다운로드 중 · 파일이 저장되기 전에는 생성하지 않습니다.');
        await locked(async () => {
          const name = `PixAI_다운로드확인_${Date.now()}.json`;
          await writeNew(name, JSON.stringify({app:'PixAI 웹 대기열', version:'0.9.8', probe:true}));
          downloadsReady = true; folderToken = `download:${crypto.randomUUID()}`;
          message = `자동 다운로드 준비 확인 완료: ${name}\n이 파일이 저장된 위치를 확인해 주세요. 이후 다운로드는 브라우저 설정 폴더를 따릅니다. 실행 중 저장 위치를 변경하지 마세요. 부분 저장 재개 시 같은 작업의 원본 전부를 추가 사본으로 저장합니다.`;
          render();
        });
        return;
      }
      const renew=!pickNew && !folder ? rememberedFolder : null;
      let chosen;
      if (renew) {
        if (typeof renew.handle.requestPermission !== 'function') throw new Error('권한 재확인을 지원하지 않습니다. ‘다른 저장 폴더 선택’을 눌러 주세요.');
        notify('기억한 저장 폴더의 권한 확인 중…');
        // Called directly from the user's button gesture; startup only queries.
        if (await renew.handle.requestPermission({mode:'readwrite'}) !== 'granted') throw new Error('저장 폴더 쓰기 권한을 허용하지 않았습니다. 권한 허용 또는 다른 저장 폴더 선택을 눌러 주세요.');
        chosen=renew.handle;
      } else chosen = await pickDirectory(window, notify);
      await locked(async () => {
        const partial = jobs.filter(job => job.saved?.length && !['done','skipped'].includes(job.state));
        let previous = folder ? {handle:folder,token:folderToken} : await folderRecord().catch(() => null);
        if (previous?.kind === 'directory') previous = {handle:previous,token:null}; // 0.1.1 record
        if (partial.some(job => job.folderToken && job.folderToken !== previous?.token)) previous = null;
        const token = renew?.token || (partial.length && previous?.token ? previous.token : crypto.randomUUID());
        const warning = await acceptFolder(chosen, {
          partial:partial.length > 0, previous:previous?.handle,
          remember:() => folderRecord({handle:chosen,token})
        });
        folder = chosen; folderToken = token;
        rememberedFolder={handle:chosen,token};
        for (const job of partial) job.folderToken = token;
        message = warning || `저장 폴더 선택 완료: ${chosen.name}`;
        persist();
      });
    } catch (error) { message = folderError(error); }
    finally { choosingFolder = false; render(); }
  }
  // Official API execution does not take focus from or intercept site input.
  window.addEventListener('storage', event=>{
    // Library edits from another tab are picked up even while this tab runs, so a later commit here cannot overwrite them.
    if (event.key===LIBRARY_KEY && !starting && !settingsBusy) { try {presetEditor?.refresh();} catch {message='프리셋 라이브러리 읽기 실패';render();} }
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
