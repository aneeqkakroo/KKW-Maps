const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
(async()=>{
 let blob;const errors=[];
 const dom=new JSDOM(fs.readFileSync('districts.html','utf8'),{url:'https://example.test/?view=regions',runScripts:'dangerously',beforeParse(w){
  w.addEventListener('error',e=>errors.push(e.error));
  w.URL.createObjectURL=b=>{blob=b;return 'blob:test';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=()=>{};
  w.SVGElement.prototype.setPointerCapture=function(id){this.capture=id;};
  w.SVGElement.prototype.hasPointerCapture=function(id){return this.capture===id;};
  w.SVGElement.prototype.releasePointerCapture=function(){this.capture=null;};
  w.SVGElement.prototype.getScreenCTM=()=>({inverse:()=>({})});
  // Simulate a canvas displayed at half size, with a screen offset.
  w.SVGElement.prototype.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return {x:(this.x-50)*2,y:(this.y-20)*2};}});
 }});
 const w=dom.window,d=w.document,$=id=>d.getElementById(id);
 const read=()=>new Promise(resolve=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.readAsText(blob);});
 const label=()=>d.querySelector('[data-label-id="ajk"]');
 const xy=()=>['x','y'].map(k=>Number(label().getAttribute(k)));
 const original=xy();
 const pointer=(node,type,x,y)=>{const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});node.dispatchEvent(e);};
 let node=label();pointer(node,'pointerdown',200,200);pointer(node,'pointermove',215,210);pointer(node,'pointerup',215,210);
 const moved=xy();assert.equal(moved[0],original[0]+30);assert.equal(moved[1],original[1]+20);
 $('export-svg').click();assert.match(await read(),new RegExp('x="'+moved[0]+'"'));
 $('add-slide').click();$('save-project').click();const saved=JSON.parse(await read());assert.deepEqual(saved.state.labelPositions['regions:'].ajk,moved);
 $('undo').click();$('undo').click();assert.deepEqual(xy(),original);
 const load=async data=>{Object.defineProperty($('project-file'),'files',{configurable:true,value:[{size:100,text:async()=>JSON.stringify(data)}]});await $('project-file').onchange({target:$('project-file')});};
 await load(saved);assert.deepEqual(xy(),moved);
 $('reset-labels').click();assert.deepEqual(xy(),original);
 d.querySelector('.snapshot button').click();assert.deepEqual(xy(),moved);
 node=label();pointer(node,'pointerdown',200,200);pointer(node,'pointermove',240,240);pointer(node,'pointercancel',240,240);assert.deepEqual(xy(),moved);
 label().dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));assert.equal(xy()[0],moved[0]+10);
 $('area').value='ajk';$('area').dispatchEvent(new w.Event('change'));$('save-project').click();assert.equal(JSON.parse(await read()).state.labelPositions['regions:ajk'],undefined);
 const bad=JSON.parse(JSON.stringify(saved));bad.state.labelPositions['regions:'].ajk=[null,3];await load(bad);assert.match($('notice').textContent,/Could not open project/);
 delete saved.state.labelPositions;await load(saved);assert.match($('notice').textContent,/Project opened/);assert.deepEqual(xy(),original);
 assert.deepEqual(errors,[]);dom.window.close();console.log('PASS: label drag at scaled coordinates, cancellation, keyboard, undo, reset, snapshots, export, project validation and older projects');
})().catch(e=>{console.error(e);process.exitCode=1;});
