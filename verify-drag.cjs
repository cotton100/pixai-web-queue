'use strict';
// Exercise the production pointer handlers; this fixture makes no browser or site requests.
const test=require('node:test');
const assert=require('node:assert/strict');
const {bindPanelDrag}=require('./pixai-web-queue.user.js');

function control() {
  const listeners={},captured=new Set();
  return {
    dataset:{},disabled:false,
    addEventListener(type,listener){(listeners[type]??=[]).push(listener);},
    setPointerCapture(id){captured.add(id);},
    hasPointerCapture(id){return captured.has(id);},
    releasePointerCapture(id){captured.delete(id);this.fire('lostpointercapture',{pointerId:id});},
    fire(type,values={}){
      const event={type,button:0,isPrimary:true,isTrusted:true,pointerId:1,pointerType:'mouse',
        clientX:710,clientY:410,detail:1,preventDefault(){},stopPropagation(){},...values};
      for(const listener of listeners[type]??[])listener(event);
    },captured
  };
}
function fixture(saved=null) {
  const header=control(),launcher=control(),writes=[];
  let viewport={width:1000,height:800},resize;
  const panel={style:{},minimized:true,opens:0,getBoundingClientRect(){
    return {left:Number.parseFloat(this.style.left)||700,top:Number.parseFloat(this.style.top)||400,
      width:this.minimized?52:340,height:this.minimized?52:450};
  }};
  bindPanelDrag(panel,header,{
    launcher,open(){panel.opens++;panel.minimized=false;resize();},
    viewport:()=>viewport,load:()=>saved,save:position=>writes.push(position),onResize:listener=>{resize=listener;}
  });
  return {panel,header,launcher,writes,resize(width=1000,height=800){viewport={width,height};resize();}};
}

test('collapsed mouse drag keeps its pointer offset, saves on release and does not reopen on the following click',()=>{
  const f=fixture();
  f.launcher.fire('pointerdown');f.launcher.fire('pointermove',{clientX:310,clientY:210});
  assert.equal(f.panel.style.left,'300px');assert.equal(f.panel.style.top,'200px');
  assert.equal(f.panel.minimized,true);assert.equal(f.writes.length,0);assert.equal(f.launcher.dataset.dragging,'');
  f.launcher.fire('pointerup',{clientX:310,clientY:210});f.launcher.fire('click',{clientX:310,clientY:210});
  assert.equal(f.panel.opens,0);assert.deepEqual(f.writes,[{x:300,y:200}]);
  assert.equal(f.launcher.captured.size,0);assert.equal('dragging' in f.launcher.dataset,false);
});

test('a tap with small pointer movement opens once without saving a position; keyboard remains usable',()=>{
  const f=fixture();f.launcher.fire('pointerdown');f.launcher.fire('pointermove',{clientX:713,clientY:412});
  assert.equal(f.panel.style.left,undefined);assert.equal('dragging' in f.launcher.dataset,false);
  f.launcher.fire('pointerup',{clientX:713,clientY:412});f.launcher.fire('click');
  assert.equal(f.panel.opens,1);assert.equal(f.writes.length,0);assert.equal(f.panel.style.left,undefined);
  f.panel.minimized=true;f.launcher.fire('click',{detail:0,pointerType:''});assert.equal(f.panel.opens,2);
});

test('touch drag persists at the viewport edge, consumes touch clicks, then a fresh touch tap can reopen',()=>{
  const f=fixture();f.launcher.fire('pointerdown',{pointerType:'touch',pointerId:7});
  f.launcher.fire('pointermove',{pointerType:'touch',pointerId:7,clientX:2000,clientY:2000});
  f.launcher.fire('pointerup',{pointerType:'touch',pointerId:7,clientX:2000,clientY:2000});
  f.launcher.fire('click',{pointerType:'touch',pointerId:7,detail:0});
  assert.equal(f.panel.opens,0);assert.equal(f.panel.style.left,'940px');assert.equal(f.panel.style.top,'740px');
  assert.deepEqual(f.writes,[{x:940,y:740}]);
  f.launcher.fire('pointerdown',{pointerType:'touch',pointerId:8,clientX:950,clientY:750});
  f.launcher.fire('pointerup',{pointerType:'touch',pointerId:8,clientX:950,clientY:750});
  f.launcher.fire('click',{pointerType:'touch',pointerId:8});
  assert.equal(f.panel.opens,1);assert.equal(f.panel.style.left,'652px');assert.equal(f.panel.style.top,'342px');
});

test('cancellation and unrelated or secondary pointers never open or hijack the launcher',()=>{
  const f=fixture();f.launcher.fire('pointerdown',{button:2});f.launcher.fire('pointerup',{button:2});
  f.launcher.fire('pointerdown',{isPrimary:false});f.launcher.fire('pointerup',{isPrimary:false});
  assert.equal(f.panel.style.left,undefined);assert.equal(f.panel.opens,0);
  f.launcher.fire('pointerdown');f.launcher.fire('pointermove',{pointerId:2,clientX:100,clientY:100});
  f.launcher.fire('pointerup',{pointerId:2});assert.ok(f.launcher.captured.has(1));
  f.launcher.fire('pointercancel');f.launcher.fire('click');
  assert.equal(f.panel.opens,0);assert.equal(f.writes.length,0);assert.equal(f.launcher.captured.size,0);
});

test('crossing the drag threshold and moving back still cancels the tap; release coordinates catch a skipped move',()=>{
  const f=fixture();f.launcher.fire('pointerdown');f.launcher.fire('pointermove',{clientX:720,clientY:410});
  f.launcher.fire('pointermove');f.launcher.fire('pointerup');f.launcher.fire('click');
  assert.equal(f.panel.opens,0);assert.deepEqual(f.writes,[{x:700,y:400}]);
  const missed=fixture();missed.launcher.fire('pointerdown');missed.launcher.fire('pointerup',{clientX:210,clientY:110});
  missed.launcher.fire('click');assert.equal(missed.panel.opens,0);assert.deepEqual(missed.writes,[{x:200,y:100}]);
});

test('launcher and expanded title share one position and resize handler; saved launcher location restores',()=>{
  const f=fixture();f.launcher.fire('pointerdown');f.launcher.fire('pointermove',{clientX:210,clientY:110});
  f.launcher.fire('pointerup',{clientX:210,clientY:110});
  f.launcher.fire('click',{detail:0,pointerType:''});assert.equal(f.panel.minimized,false);
  assert.equal(f.panel.style.left,'200px');assert.equal(f.panel.style.top,'100px');
  f.header.fire('pointerdown',{clientX:220,clientY:120});f.header.fire('pointermove',{clientX:320,clientY:170});
  f.header.fire('pointerup',{clientX:320,clientY:170});assert.equal(f.panel.style.left,'300px');assert.equal(f.panel.style.top,'150px');
  const again=fixture(f.writes.at(-1));assert.equal(again.panel.style.left,'300px');assert.equal(again.panel.style.top,'150px');
  again.resize(200,200);assert.equal(again.panel.style.left,'140px');assert.equal(again.panel.style.top,'140px');
  f.resize(360,500);assert.equal(f.panel.style.left,'12px');assert.equal(f.panel.style.top,'42px');
});
