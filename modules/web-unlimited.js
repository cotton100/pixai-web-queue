// Visible website controls only. No session tokens, internal API, or React state.
function assertWebUnlimited(snapshot) {
  if (!snapshot.enabled || !snapshot.banner || snapshot.price !== 'free' || snapshot.count !== 1)
    throw Error('웹 무제한: Tsubaki.3 무제한 토글·무료 표시·단일 생성을 모두 확인해야 합니다. 유료 생성은 실행하지 않았습니다.');
  if (snapshot.busy) throw Error('사이트에서 이미 제출 중입니다. 완료 후 다시 시작해 주세요.');
}
function webOriginal(value) {
  const url=new URL(value.url);
  if (url.origin!=='https://images-ng.pixai.art' || !/^\/images\/orig\/[a-f0-9-]+$/i.test(url.pathname) || url.search || url.hash || url.username || url.password)
    throw Error('웹 결과의 원본 이미지 주소를 확인할 수 없습니다.');
  if (!/^\d+$/.test(value.id) || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width<1 || value.height<1)
    throw Error('웹 결과 이미지 ID·크기를 확인할 수 없습니다.');
  return {...value,url:url.href};
}
function assertWebReceipt(job,receipt) {
  if(receipt.id!==job.taskId || receipt.credits!=='0' || normalize(receipt.prompt)!==normalize(job.prompt))
    throw Error('웹 작업 상세의 ID·무료 차감·프롬프트를 대조하지 못했습니다. 자동 연결/재제출하지 않습니다.');
}
async function runWebUnlimited(jobs,io,{oneJob=false,stopped=()=>false}={}) {
  for (const job of jobs) {
    if (job.backend!=='web-unlimited' || ['done','skipped'].includes(job.state)) continue;
    if (stopped()) break;
    if (!['queued','waiting','saving','save_failed'].includes(job.state)) throw Error('웹 제출 결과가 불명확합니다. 사이트 기록을 확인해 주세요. 자동 재제출하지 않습니다.');
    if (job.state==='queued') {
      if (job.taskId || job.submittedAt || job.apiPayload) throw Error('이미 제출됐거나 API 요청이 있는 작업을 웹에서 다시 생성할 수 없습니다.');
      await io.prepare(job);
      if(stopped()) break;
      Object.assign(job,{expected:1,state:'submitting',submittedAt:Date.now(),error:''});
      // Commit the uncertainty marker BEFORE any website click, including on quota failure.
      try {io.persist();} catch(error){job.state='unknown';job.error=error.message;throw error;}
      try {
        const id=await io.submit(job);
        if (!/^\d+$/.test(id)) throw Error('웹 작업 ID를 확인하지 못했습니다.');
        job.taskId=id;job.state='waiting';io.persist();
      } catch(error) {
        job.state=job.taskId?'waiting':error.notSubmitted?'queued':'unknown';
        if(job.state==='queued')delete job.submittedAt;
        job.error=error.message;io.persist();throw error;
      }
    }
    if(stopped()) break;
    try {
      if(!job.webMedia) {job.webMedia=webOriginal(await io.wait(job));job.mediaIds=[job.webMedia.id];job.state='saving';io.persist();}
      const original=webOriginal(job.webMedia);
      if(!job.taskId || !/^\d+$/.test(job.taskId)) throw Error('저장할 웹 작업 ID가 없습니다.');
      job.saved=job.saved||[];
      if(job.saved.length>1) throw Error('웹 단일 작업의 저장 기록이 맞지 않습니다.');
      if(!job.saved.length) {await io.guard?.(job);const file=await io.save(job,original);job.saved.push({mediaId:original.id,file});io.persist();}
      await io.guard?.(job);
      job.state='done';job.error='';io.persist();
    } catch(error) {job.state=job.webMedia?'save_failed':'waiting';job.error=error.message;io.persist();throw error;}
    if(oneJob) break;
  }
}
function createWebUnlimitedAdapter(doc,io) {
  const list=(scope,selector)=>Array.from(scope.querySelectorAll(selector));
  const shown=e=>{
    if(!e?.getClientRects().length || e.closest('#local-pixai-queue'))return false;
    for(let a=e;a;a=a.parentElement){const s=io.win.getComputedStyle(a);if(a.hidden||a.inert||a.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse')return false;}
    return true;
  };
  const only=(items,label)=>{if(items.length!==1)throw Error(`웹 무제한: ${label}을 하나로 확인하지 못했습니다. 생성하지 않았습니다.`);return items[0];};
  const click=e=>{io.check();if(!e||e.disabled||e.getAttribute('aria-disabled')==='true')throw Error('웹 설정 버튼이 비활성화돼 있습니다.');io.mutate(()=>e.click());};
  const editor=()=>only(list(doc,'main [contenteditable="true"]').filter(shown),'새 에디터 프롬프트');
  const generate=()=>only(list(doc,'main [data-share-guide="generate"] button').filter(shown),'생성 버튼');
  const toggle=()=>only(list(doc,'main input[role="switch"]').filter(e=>['Tsubaki.3 무제한 모드','Tsubaki.3 Unlimited Mode'].includes(e.getAttribute('aria-label'))&&shown(e.closest('label'))),'무제한 토글');
  const groupName=e=>e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>doc.getElementById(id)?.textContent||'').join(' ').trim();
  const ratioGroup=()=>only(list(doc,'main [role="group"]').filter(e=>shown(e)&&['비율','Aspect ratio','Aspect Ratio'].includes(groupName(e))),'비율 그룹');
  function selectedRatio(allowPending=false) {
    const selected=list(ratioGroup(),'button').filter(e=>shown(e)&&/^\d+:\d+$/.test(e.textContent.trim())&&e.classList.contains('ring-neutral-700'));
    // A custom ratio has no selected standard button until the click rerenders.
    // Only this empty transition may wait; ambiguous selections still stop.
    if(allowPending&&!selected.length)return null;
    return only(selected,'선택 비율').textContent.trim();
  }
  function safety() {
    // The site's marker is a display:contents span (no own client rects).
    // Anchor the price to the uniquely visible button, not that layout wrapper.
    const button=generate(),scope=button.closest('[data-share-guide="generate"]')?.parentElement;
    if(!shown(scope))throw Error('웹 무제한: 생성 가격 영역을 확인하지 못했습니다. 생성하지 않았습니다.');
    const leaves=list(scope,'span').filter(e=>shown(e)&&e.children.length===0).map(e=>e.textContent.trim());
    const banner=list(doc,'main span').some(e=>shown(e)&&['무제한 모드 사용 중','Unlimited mode active','Unlimited Mode Active'].includes(e.textContent.trim()));
    const price=leaves.filter(t=>/^(?:무료|Free|[\d,]+)$/.test(t));
    const snapshot={enabled:toggle().checked===true,banner,price:price.length===1&&/^(무료|Free)$/.test(price[0])?'free':'unknown',count:io.settings.readImageCount(),busy:button.disabled||button.getAttribute('aria-busy')==='true'};
    assertWebUnlimited(snapshot);return button;
  }
  async function waitFor(read,label,timeout=20000) {
    const deadline=Date.now()+timeout;
    while(Date.now()<deadline){io.check();const value=read();if(value)return value;await io.sleep(500);}
    throw Error(`웹 무제한: ${label} 확인 시간 초과. 자동 재제출하지 않습니다.`);
  }
  async function setRatio(value) {
    let group=ratioGroup();
    let button=list(group,'button').find(e=>shown(e)&&e.textContent.trim()===value);
    if(!button){const reverse=value.split(':').reverse().join(':');if(list(group,'button').some(e=>e.textContent.trim()===reverse)){click(only(list(group,'button').filter(e=>['가로/세로 전환','Swap orientation'].includes(e.getAttribute('aria-label'))),'가로/세로 전환'));await io.sleep(250);group=ratioGroup();button=list(group,'button').find(e=>shown(e)&&e.textContent.trim()===value);}}
    if(!button)throw Error(`웹 무제한: ${value} 비율 버튼을 찾지 못했습니다. 사이트에서 해당 비율을 먼저 선택해 주세요.`);
    click(button);await waitFor(()=>selectedRatio(true)===value,'비율 적용');
  }
  const canvas=()=>only(list(doc,'main [data-feed-scroller="true"] [data-testid="feed-column"]').filter(shown),'중앙 작업 화면');
  function ids(){return [...new Set(list(canvas(),'[data-task-id]').map(e=>e.getAttribute('data-task-id')).filter(id=>/^\d+$/.test(id)))];}
  async function newCanvas() {
    const links=list(doc,'a[href]').filter(e=>shown(e)&&['새 이미지 만들기','New image','New Image'].includes(e.textContent.trim()));
    if(!links.length||new Set(links.map(e=>e.getAttribute('href'))).size!==1)throw Error('새 이미지 만들기 링크를 확인할 수 없습니다.');
    click(links[0]);
    const empty=()=>!ids().length&&list(canvas(),'[data-testid="empty-composition"]').some(shown)&&!normalize(readPromptEditorText(editor()));
    await waitFor(empty,'빈 생성 화면');await io.sleep(1000);io.check();
    if(!empty())throw Error('빈 생성 화면을 확인하는 동안 다른 작업이 나타났습니다. 생성하지 않았습니다.');
  }
  async function prepareWeb(job) {
    io.check();
    if(!job.configuration)job.configuration=await io.settings.capture();
    if(!Object.hasOwn(job,'negativePrompt'))job.negativePrompt=await io.settings.captureNegative();
    if(job.apiOptions?.modelVersionId&&job.configuration.model.versionId!==job.apiOptions.modelVersionId)throw Error('웹 모델이 기본 모델 버전 ID와 다릅니다. 원하는 모델을 프리셋으로 저장해 선택해 주세요.');
    await io.freeze?.(job); // Preserve baseline before clearing/changing site settings, even if preparation fails.
    await newCanvas();
    await io.settings.apply(job.configuration);
    const control=toggle();if(!control.checked)click(control.closest('label'));
    await waitFor(()=>toggle().checked,'무제한 모드');
    await io.settings.setImageCount(1);
    const requestedRatio=job.apiOptions?.aspectRatio||'1:1';
    await setRatio(requestedRatio);
    const helpers=list(doc,'main input[role="switch"]').filter(e=>['프롬프트 도우미','Prompt helper','Prompt Helper'].includes(e.getAttribute('aria-label'))&&shown(e.closest('label')));
    if(helpers.length>1)throw Error('프롬프트 도우미를 하나로 확인하지 못했습니다.');
    if(helpers[0]?.checked){click(helpers[0].closest('label'));await waitFor(()=>!helpers[0].checked,'프롬프트 도우미 끄기');}
    await io.settings.setNegative(job.negativePrompt||'');
    const input=editor();io.mutate(()=>{
      input.focus();const selection=io.win.getSelection(),range=doc.createRange();range.selectNodeContents(input);selection.removeAllRanges();selection.addRange(range);
      if(!doc.execCommand('insertText',false,job.prompt))throw Error('웹 프롬프트 입력에 실패했습니다.');
      input.dispatchEvent(new io.win.InputEvent('input',{bubbles:true,inputType:'insertText',data:job.prompt}));input.blur();
    });
    await waitFor(()=>normalize(readPromptEditorText(editor()))===normalize(job.prompt),'프롬프트 적용');
    await io.sleep(500);safety();
    if(ids().length)throw Error('설정 적용 중 중앙 화면에 다른 작업이 나타났습니다. 생성하지 않았습니다.');
    if(selectedRatio()!==requestedRatio)throw Error('웹 무제한: 설정 적용 중 비율이 예약과 달라졌습니다. 생성하지 않았습니다.');
    job.webBeforeIds=[];job.webApplied={aspectRatio:requestedRatio,batchSize:1,mode:'site-unlimited',resolution:'site-fixed'};
  }
  async function submitWeb(job) {
    let button,before;
    try {
      io.check();
      if(normalize(readPromptEditorText(editor()))!==normalize(job.prompt)||selectedRatio()!==job.webApplied.aspectRatio)throw Error('제출 직전 웹 입력이 바뀌었습니다. 자동 제출하지 않습니다.');
      io.settings.verifyNegative(job.negativePrompt||'');
      assertConfiguration(job.configuration,io.settings.read());
      button=safety();if(button.hasAttribute('data-prompt-input-missing'))throw Error('사이트가 프롬프트를 인식하지 못했습니다.');
      before=new Set(job.webBeforeIds);if(ids().some(id=>!before.has(id)))throw Error('다른 웹 작업이 추가됐습니다. 작업 식별을 위해 중지합니다.');
    } catch(error) {error.notSubmitted=true;throw error;}
    // From the first possible click onward, exceptions must never mean "not submitted".
    try {
      click(button);
      const id=await waitFor(()=>{const fresh=ids().filter(id=>!before.has(id));if(fresh.length>1)throw Error('여러 웹 작업이 나타나 결과를 확정하지 못했습니다.');return fresh[0];},'새 작업 ID',180000);
      // Persist identity before waiting for generation. This is not a verified receipt.
      job.webIdentity='pending-new';return id;
    } catch(error) {delete error.notSubmitted;throw error;}
  }
  function checkOtherTasks(job) {
    const allowed=new Set([...(job.webBeforeIds||[]),job.taskId]);
    if(ids().some(id=>!allowed.has(id)))throw Error('다른 웹 작업이 함께 나타났습니다. 잘못 연결하지 않도록 중지합니다. 사이트에서 같은 작업을 확인해 주세요.');
  }
  function taskCard(id) {return only(list(canvas(),'section[data-testid="mobile-task-card"]').filter(e=>shown(e)&&e.getAttribute('data-task-id')===id),'같은 작업 카드');}
  function checkImport(job,card) {
    // History-opened cards are valid for explicitly confirmed existing-ID recovery.
    // A new submission's rejected evidence must survive a restart or disappearing label.
    const meta=card?.querySelector('[data-testid="task-card-meta"]')?.textContent||'';
    if(job.webIdentity==='pending-new' && /가져오기|\bImported\b/i.test(meta))job.webIdentity='rejected-import';
    if(job.webIdentity==='rejected-import')throw Error('새 제출 결과에 가져오기 표시가 있어 자동 연결을 중단했습니다. 작업 ID는 보존했습니다. 사이트에서 확인 후 작업 ID를 연결해 주세요.');
  }
  async function verifyReceipt(job) {
    checkOtherTasks(job);
    const card=taskCard(job.taskId);
    checkImport(job,card);
    const detail=list(card,'button').filter(e=>shown(e)&&['작업 상세 보기','View task details'].includes(e.textContent.trim()));
    if(detail.length===1)click(detail[0]);
    else {
      click(only(list(card,'button[data-testid="mobile-task-card-more"]').filter(shown),'작업 메뉴'));
      click(await waitFor(()=>{const found=list(doc,'button').filter(e=>shown(e)&&['작업 상세 보기','View task details'].includes(e.textContent.trim()));return found.length===1?found[0]:null;},'작업 상세 메뉴'));
    }
    // A departing task menu can also have role=dialog. Wait for the actual
    // details heading, then for its asynchronously mounted fields.
    const dialog=await waitFor(()=>{
      const found=list(doc,'[role="dialog"]').filter(shown).filter(d=>list(d,'h2').some(e=>shown(e)&&['작업 상세','Task details','Task Details'].includes(e.textContent.trim())));
      return found.length?only(found,'작업 상세 창'):null;
    },'작업 상세 창');
    let receipt;
    try {
      receipt=await waitFor(()=>{
        const contents=list(dialog,'[data-ui="dialog-content"]').filter(shown);
        if(!contents.length)return null;
        const content=only(contents,'작업 상세 내용');
        const value=labels=>{
          const matches=list(content,'span').filter(e=>shown(e)&&labels.includes(e.textContent.trim()));
          if(!matches.length)return null;
          const field=only(matches,'상세 항목').nextElementSibling;
          return shown(field)?field.textContent.trim():null;
        };
        const id=value(['작업 ID','Task ID']),credits=value(['소모 크레딧','Credits used','Credits consumed']);
        const prompts=list(content,'[translate="no"]').filter(shown);
        const prompt=prompts.length?only(prompts,'작업 프롬프트').textContent:null;
        if(!id||!credits||!prompt?.trim())return null;
        return {id,credits,prompt};
      },'작업 상세 ID·차감·프롬프트');
      assertWebReceipt(job,receipt);
    }finally{
      const cancel=list(dialog,'button').filter(e=>['취소','Cancel'].includes(e.textContent.trim()));
      if(cancel.length===1){io.mutate(()=>cancel[0].click());await waitFor(()=>!list(doc,'[role="dialog"]').filter(shown).includes(dialog),'작업 상세 창 닫힘',5000);}
    }
    checkOtherTasks(job);checkImport(job,taskCard(job.taskId));return receipt;
  }
  async function waitWeb(job) {
    checkImport(job,null);
    const original=await waitFor(()=>{
      checkOtherTasks(job);
      const cards=list(canvas(),'section[data-testid="mobile-task-card"]').filter(e=>shown(e)&&e.getAttribute('data-task-id')===job.taskId);
      if(!cards.length)return null;
      const card=only(cards,'제출한 작업 카드');
      checkImport(job,card);
      if(/생성 실패|생성 오류|Generation failed|Generation error/i.test(card.innerText))throw Error('사이트에서 생성 실패를 표시했습니다. 같은 작업을 확인해 주세요.');
      const media=list(card,'[data-media-id]');if(!media.length)return null;
      const target=only(media,'단일 결과 이미지'),img=target.querySelector('img');
      if(!img?.complete||!img.naturalWidth)return null;
      return webOriginal({id:target.getAttribute('data-media-id'),url:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight});
    },'같은 작업의 원본 이미지',60*60*1000);
    if(job.webReceipt?.id!==job.taskId || job.webIdentity==='pending-new')job.webReceipt=await verifyReceipt(job);
    assertWebReceipt(job,job.webReceipt);
    delete job.webIdentity;
    return original;
  }
  return {prepare:prepareWeb,submit:submitWeb,wait:waitWeb,safety,guard:checkOtherTasks,hasTask:id=>ids().includes(id)};
}
