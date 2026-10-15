(function(root){
const palettes={Ocean:['#e0f5f4','#35b9d0','#073b79'],Forest:['#edf4de','#66aa85','#17594a'],Rose:['#fff0ef','#ea91a0','#9c2852'],Sunset:['#fff2cb','#f8a064','#ac3f4e'],Violet:['#f0edfc','#a495d7','#503a87'],Slate:['#f0f3f5','#91a6b7','#23384d']};
function normalize(v){return String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(district|division|province)\b/g,'').replace(/[^a-z0-9]/g,'');}
function number(v){if(v===null||v===undefined||String(v).trim()==='')return null;const s=String(v).trim();if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))throw Error('Expected a number: '+s);const n=Number(s);if(!Number.isFinite(n))throw Error('Number is out of range');return n;}
function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
 if(c==='"'){if(cell||closed)throw Error('Unexpected quote in CSV');quoted=true;}
 else if(c===','){row.push(cell);cell='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';closed=false;}
 else{if(closed&&!/\s/.test(c))throw Error('Unexpected text after quoted CSV field');if(!closed)cell+=c;}}
 if(quoted)throw Error('Unclosed quoted CSV field');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
function importCSV(text,features){
 const rows=parseCSV(text);if(rows.length<2)throw Error('Include a header and at least one data row.');const headers=rows.shift().map(h=>h.trim().toLowerCase());const col=n=>headers.indexOf(n);if(col('value')<0||(col('id')<0&&col('name')<0))throw Error('CSV needs value and either id or name columns.');
 const aliases={bandipora:'bandipore',neelum:'neelamvalley',neelumvalley:'neelamvalley',neelam:'neelamvalley',punch:'poonch'};const norm=s=>{const n=normalize(s);return aliases[n]||n;};const updates={},issues=[],seen=new Set();
 rows.forEach((row,i)=>{try{if(row.length!==headers.length)throw Error('Column count differs from header');const id=col('id')>=0?row[col('id')].trim():'';const name=col('name')>=0?row[col('name')]:'';const region=col('region')>=0?row[col('region')].trim():'';let found=id?features.filter(f=>f.id===id):features.filter(f=>norm(f.properties.name)===norm(name));if(region)found=found.filter(f=>norm(f.properties.region_id)===norm(region)||norm(f.properties.region_name)===norm(region));if(found.length!==1)throw Error(found.length?'Ambiguous name; supply an ID or region':'Unknown area for this view');if(seen.has(found[0].id))throw Error('Duplicate area in import');const v=number(row[col('value')]);seen.add(found[0].id);updates[found[0].id]=v;}catch(e){issues.push('Row '+(i+2)+': '+e.message);}});return {updates,issues};
}
function csv(rows){return rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
function scale(values){const nums=Object.values(values).filter(v=>typeof v==='number'&&Number.isFinite(v));return nums.length?{min:Math.min(...nums),max:Math.max(...nums),count:nums.length,total:nums.reduce((a,b)=>a+b,0)}:{min:0,max:0,count:0,total:0};}
function color(v,s,palette,reverse=false,empty='#e8edf2'){if(v===null||v===undefined)return empty;let t=s.min===s.max?.5:Math.max(0,Math.min(1,(v-s.min)/(s.max-s.min)));if(reverse)t=1-t;const stops=palettes[palette]||palettes.Ocean;const index=t<.5?0:1,ratio=t<.5?t*2:(t-.5)*2;const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const a=rgb(stops[index]),b=rgb(stops[index+1]);return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*ratio).toString(16).padStart(2,'0')).join('');}
root.MapCore={palettes,normalize,number,parseCSV,importCSV,csv,scale,color};if(typeof module!=='undefined')module.exports=root.MapCore;
})(typeof window!=='undefined'?window:globalThis);
