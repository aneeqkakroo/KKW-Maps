const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM}=require('jsdom');
const landing=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://example.test/',runScripts:'dangerously'});
const doc=landing.window.document;
for(const el of doc.querySelectorAll('[href],[src]')){
 const href=el.getAttribute('href')||el.getAttribute('src');
 if(href.startsWith('#'))assert(doc.getElementById(href.slice(1)),href);
 else if(!href.startsWith('https:'))assert(fs.existsSync(path.join('dist',href.split('?')[0])),href);
}
assert.equal(doc.querySelectorAll('.template-card').length,6);
doc.querySelector('a[href="#coverage"]').click();assert(doc.getElementById('coverage').open);
assert(!fs.existsSync('dist/output'));assert(!fs.existsSync('dist/.venv'));
landing.window.close();
const html=fs.readFileSync('dist/districts.html','utf8');
for(const [view,count] of [['regions',6],['districts',49],['provinces',3]]){
 const errors=[];const dom=new JSDOM(html,{url:'https://example.test/districts.html?view='+view,runScripts:'dangerously',beforeParse(w){w.addEventListener('error',e=>errors.push(e.error));}});
 assert.equal(dom.window.document.getElementById('view').value,view);
 assert.equal(dom.window.document.querySelectorAll('.map-area').length,count);
 assert.equal(dom.window.document.querySelector('.brand').getAttribute('href'),'index.html');
 if(view==='districts')assert.equal(dom.window.document.querySelectorAll('.region-backdrop').length,6);
 assert.equal(errors.length,0);dom.window.close();
}
for(const [area,count,regions] of [['ajk',10,1],['gb',13,1],['jk',20,2]]){
 const scoped=new JSDOM(html,{url:'https://example.test/districts.html?view=districts&area='+area,runScripts:'dangerously'});
 const d=scoped.window.document;
 assert.equal(d.getElementById('area').value,area);
 assert.equal(d.querySelectorAll('.map-area').length,count);
 assert.equal(d.querySelectorAll('.region-backdrop').length,regions);
 d.getElementById('show-gaps').click();
 assert.equal(d.querySelectorAll('.region-backdrop').length,regions);
 assert(!d.getElementById('map-svg').innerHTML.includes('NaN'));
 scoped.window.close();
}
const dom=new JSDOM(html,{url:'https://example.test/districts.html?panel=data&import=1',runScripts:'dangerously'});
assert(dom.window.document.getElementById('csv-text').closest('details').open);dom.window.close();
console.log('PASS: landing assets and anchors, all six template routes and persistent regional outlines, import route, editor home link and public-only build');
