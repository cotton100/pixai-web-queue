'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {paneRatios,resizePanePair,bindPaneResize,bindWindowResize}=require('./pixai-web-queue.user.js');
function control() {
  const listeners={},captured=new Set();return {style:{},dataset:{},attrs:{},captured,
    setAttribute(name,value){this.attrs[name]=value;},addEventListener(type,fn){(listeners[type]??=[]).push(fn);},
    setPointerCapture(id){captured.add(id);},hasPointerCapture(id){return captured.has(id);},releasePointerCapture(id){captured.delete(id);this.fire('lostpointercapture',{pointerId:id});},
    fire(type,extra={}){for(const fn of listeners[type]??[])fn({type,isTrusted:true,button:0,isPrimary:true,pointerId:1,clientX:300,clientY:200,preventDefault(){},stopPropagation(){},...extra});}};
}
function panesFixture(saved=null) {
  const host=control(),panes=[control(),control(),control()],handles=[],writes=[];let enabled=true;
  host.getBoundingClientRect=()=>({width:800});host.replaceChildren=(...children)=>{host.children=children;};
  const binding=bindPaneResize(host,panes,{initial:[.2,.3,.5],minimums:[120,180,200],load:()=>saved,save:value=>writes.push(value),enabled:()=>enabled,
    createHandle:()=>{const handle=control();handles.push(handle);return handle;}});
  return {host,panes,handles,writes,binding,setCompact:()=>{enabled=false;}};
}
test('pane ratios reject malformed layout preferences and safely normalize large numbers',()=>{
  for(const value of [null,{},[1,2],[-1,2,3],[0,1,2],[NaN,1,2],[Infinity,1,2]])assert.deepEqual(paneRatios(value,[2,3,5]),[.2,.3,.5]);
  const large=paneRatios([1e308,1e308,1e308],[2,3,5]);assert(large.every(value=>Number.isFinite(value)&&value>0));assert(Math.abs(large.reduce((a,b)=>a+b)-1)<1e-10);
});
test('pane pointer resize changes only the neighboring pair, clamps minimums and persists once on release',()=>{
  const f=panesFixture(),handle=f.handles[0];handle.fire('pointerdown');handle.fire('pointermove',{clientX:1500});
  const ratios=f.binding.ratios();assert.equal(ratios[2],.5);assert(Math.abs(ratios[0]+ratios[1]-.5)<1e-10);assert(ratios[1]>=180/784-1e-10);
  assert.equal(f.writes.length,0);assert.equal(handle.captured.size,1);handle.fire('pointerup');assert.equal(f.writes.length,1);assert.equal(handle.captured.size,0);
  assert.equal(f.host.children.length,5);assert.equal(f.panes[2].style.flex,'0.5 1 0px');
});
test('pane cancel and capture loss restore ratios; foreign pointers, untrusted input and compact mode cannot write',()=>{
  const f=panesFixture();for(const type of ['pointercancel','lostpointercapture']) {f.handles[1].fire('pointerdown');f.handles[1].fire('pointermove',{clientX:450});f.handles[1].fire(type);assert.deepEqual(f.binding.ratios(),[.2,.3,.5]);}
  f.handles[0].fire('pointerdown',{button:2});f.handles[0].fire('pointerdown',{isPrimary:false});f.handles[0].fire('pointerdown',{isTrusted:false});
  f.handles[0].fire('pointerdown');f.handles[0].fire('pointermove',{pointerId:9,clientX:700});f.handles[0].fire('pointercancel');
  f.setCompact();f.handles[0].fire('pointerdown');f.handles[0].fire('keydown',{key:'ArrowRight'});assert.equal(f.writes.length,0);assert.deepEqual(f.binding.ratios(),[.2,.3,.5]);
});
test('saved pane proportions restore; keyboard and double click work without invalidating tiny pairs',()=>{
  const f=panesFixture([3,4,3]);assert(Math.abs(f.binding.ratios()[0]-.3)<1e-10);f.handles[0].fire('keydown',{key:'ArrowRight'});assert(f.binding.ratios()[0]>.3);
  f.handles[0].fire('dblclick');assert.deepEqual(f.binding.ratios(),[.2,.3,.5]);assert.equal(f.writes.length,2);
  const tiny=resizePanePair([.001,.001,.998],0,1,[.15,.2,.25]);assert(tiny.every(value=>value>0));assert(Math.abs(tiny[0]+tiny[1]-.002)<1e-10);
});
function windowFixture(saved=null,fail=false) {
  const panel=control(),handle=control(),writes=[];let viewport={width:1200,height:900},resize;
  panel.getBoundingClientRect=()=>({left:parseFloat(panel.style.left)||200,top:parseFloat(panel.style.top)||120,width:parseFloat(panel.style.width)||700,height:parseFloat(panel.style.height)||500});
  bindWindowResize(panel,handle,{viewport:()=>viewport,load:()=>saved,save:value=>{if(fail)throw Error('Storage blocked');writes.push(value);},onResize:fn=>{resize=fn;}});
  return {panel,handle,writes,resize:next=>{viewport=next;resize();}};
}
test('window size drag clamps to viewport, commits once, and restores saved size in another mount',()=>{
  const f=windowFixture();f.handle.fire('pointerdown');f.handle.fire('pointermove',{clientX:2000,clientY:2000});assert.equal(f.writes.length,0);
  f.handle.fire('pointerup');assert.deepEqual(f.writes,[{width:1184,height:884}]);assert.equal(f.panel.style.left,'8px');assert.equal(f.panel.style.top,'8px');
  const restored=windowFixture(f.writes[0]);assert.equal(restored.panel.style.width,'1184px');restored.resize({width:390,height:740});assert.equal(restored.panel.style.width,'374px');assert.equal(restored.panel.style.height,'724px');
  restored.resize({width:1200,height:900});assert.equal(restored.panel.style.width,'1184px');assert.equal(restored.panel.style.height,'884px');assert.equal(restored.writes.length,0);
});
test('window cancel restores original position and dimensions; minimized, secondary and foreign pointers cannot resize',()=>{
  const f=windowFixture();f.handle.fire('pointerdown');f.handle.fire('pointermove',{clientX:2000,clientY:2000});f.handle.fire('pointercancel');
  assert.equal(f.panel.style.width,'700px');assert.equal(f.panel.style.height,'500px');assert.equal(f.panel.style.left,'200px');assert.equal(f.panel.style.top,'120px');assert.equal(f.writes.length,0);
  f.handle.fire('pointerdown',{isPrimary:false});f.handle.fire('pointerdown',{button:2});f.handle.fire('pointerdown',{isTrusted:false});
  f.panel.dataset.minimized='true';f.handle.fire('pointerdown');f.handle.fire('pointermove',{clientX:1200});f.handle.fire('pointerup');assert.equal(f.writes.length,0);
});
test('window keyboard resize remains usable when storage fails and does not shrink below its usable minimum',()=>{
  const f=windowFixture(null,true);for(let index=0;index<15;index++)f.handle.fire('keydown',{key:'ArrowLeft'});
  assert.equal(f.panel.style.width,'560px');f.handle.fire('keydown',{key:'ArrowDown'});assert.equal(f.panel.style.height,'524px');assert.equal(f.writes.length,0);
});
