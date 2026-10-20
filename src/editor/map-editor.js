(() => {
'use strict';
const D=window.MAP_DATA,C=window.MapCore,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const names={jk:'Jammu & Kashmir',ajk:'Azad Jammu & Kashmir',gb:'Gilgit-Baltistan',jammu:'Jammu',kashmir:'Kashmir',ladakh:'Ladakh',aksai_chin:'Aksai Chin',kashmir_province:'Kashmir Province',jammu_province:'Jammu Province',frontier_province:'Frontier Province'};
const modes={regions:'Region View',districts:'District View',provinces:'Pre Partition Regions'};
const defaults={labelPositions:{},view:'districts',area:'',values:{regions:{},districts:{},provinces:{}},title:'Your map, your story',subtitle:'',source:'',author:'',palette:'Ocean',reverse:false,prefix:'',suffix:'',decimals:0,labels:'both',fontSize:11,emptyColor:'#e8edf2',background:'#ffffff',borderWidth:.7,showLegend:true,showTotal:true,aggregation:'sum',loc:false,showGaps:true,watermark:true};
const clone=x=>JSON.parse(JSON.stringify(x));let state=clone(defaults),slides=[],history=[],selected='',zoom=1,saveTimer;
const fields={watermark:'watermark',aggregation:'aggregation',title:'title',subtitle:'subtitle',source:'source',author:'author',prefix:'prefix',suffix:'suffix',decimals:'decimals',labels:'labels','font-size':'fontSize','empty-color':'emptyColor',background:'background','border-width':'borderWidth',reverse:'reverse','show-legend':'showLegend','show-total':'showTotal',loc:'loc','show-gaps':'showGaps'};
function notify(s){$('notice').textContent=s;}
function checkpoint(){history.push(JSON.stringify({state,slides}));if(history.length>30)history.shift();$('undo').disabled=false;}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('kashmir-map-studio-v1',JSON.stringify({type:'kashmir-map-studio',version:1,state,slides}));}catch(e){notify('Browser storage unavailable. Use Save project to keep your work.');}},300);}
function validateState(input){
 if(!input||typeof input!=='object'||!Object.hasOwn(modes,input.view))throw Error('Invalid map view');const s=clone(defaults);s.view=input.view;
 const areaIDs=(s.view==='provinces'?D.provinces:D.regions).features.map(f=>f.id);if(input.area&&!areaIDs.includes(input.area)&&!(s.view!=='provinces'&&input.area==='jk'))throw Error('Unknown area filter');s.area=input.area||'';
 if(input.aggregation!==undefined&&!['sum','average'].includes(input.aggregation))throw Error('Invalid summary calculation');s.aggregation=input.aggregation||'sum';
 if(input.watermark!==undefined&&typeof input.watermark!=='boolean')throw Error('Invalid watermark option');s.watermark=input.watermark??true;
 for(const key of ['title','subtitle','source','author','prefix','suffix']){if(typeof input[key]!=='string'||input[key].length>200)throw Error('Invalid '+key);s[key]=input[key];}
 if(!Object.hasOwn(C.palettes,input.palette))throw Error('Unknown palette');s.palette=input.palette;
 if(!['both','names','values','none'].includes(input.labels))throw Error('Unknown label style');s.labels=input.labels;
 for(const k of ['emptyColor','background']){if(!/^#[0-9a-f]{6}$/i.test(input[k]))throw Error('Invalid colour');s[k]=input[k];}
 for(const [k,min,max] of [['fontSize',8,20],['borderWidth',0,2],['decimals',0,2]]){if(typeof input[k]!=='number'||!Number.isFinite(input[k])||input[k]<min||input[k]>max||(k==='decimals'&&!Number.isInteger(input[k])))throw Error('Invalid '+k);s[k]=input[k];}
 for(const k of ['reverse','showLegend','showTotal','loc','showGaps']){if(typeof input[k]!=='boolean')throw Error('Invalid '+k);s[k]=input[k];}
 for(const mode of Object.keys(modes)){const vals=input.values?.[mode];if(!vals||typeof vals!=='object'||Array.isArray(vals))throw Error('Invalid values');const ids=new Set(D[mode].features.map(f=>f.id));for(const [id,v] of Object.entries(vals)){if(!ids.has(id)||!(v===null||(typeof v==='number'&&Number.isFinite(v))))throw Error('Unknown area or invalid value');s.values[mode][id]=v;}}
 if(input.labelPositions!==undefined){
  if(!input.labelPositions||typeof input.labelPositions!=='object'||Array.isArray(input.labelPositions))throw Error('Invalid label positions');
  for(const [scope,positions] of Object.entries(input.labelPositions)){
   const [mode,area,...extra]=scope.split(':');
   if(!Object.hasOwn(modes,mode)||extra.length||area===undefined||!(area===''||(mode==='provinces'?D.provinces.features:D.regions.features).some(f=>f.id===area)||(mode!=='provinces'&&area==='jk')))throw Error('Invalid label scope');
   if(!positions||typeof positions!=='object'||Array.isArray(positions))throw Error('Invalid label positions');
   const ids=new Set([...D[mode].features,...(mode==='districts'?D.context.features:[])].map(f=>f.id));
   s.labelPositions[scope]={};
   for(const [id,p] of Object.entries(positions)){
    if(!ids.has(id)||!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<38||p[0]>962||p[1]<148||p[1]>742)throw Error('Invalid label position');
    s.labelPositions[scope][id]=[...p];
   }
  }
 }
 return s;
}
function project(raw){if(raw.type!=='kashmir-map-studio'||raw.version!==1)throw Error('Not a Map Studio project');const next=validateState(raw.state);if(!Array.isArray(raw.slides)||raw.slides.length>50)throw Error('Invalid snapshots');return {state:next,slides:raw.slides.map(slide=>({name:String(slide.name).slice(0,90),state:validateState(slide.state)}))};}
try{const raw=localStorage.getItem('kashmir-map-studio-v1');if(raw){const saved=project(JSON.parse(raw));state=saved.state;slides=saved.slides;notify('Restored your local project.');}}catch(e){notify('Start a new map, or open a saved project.');}
function inArea(id){return !state.area||id===state.area||(state.area==='jk'&&['jammu','kashmir'].includes(id));}
function features(){return D[state.view].features.filter(f=>inArea(state.view==='districts'?f.properties.region_id:f.id));}
function value(f){return state.values[state.view][f.id]??null;}
function format(v){return v===null?'—':state.prefix+v.toLocaleString('en-GB',{minimumFractionDigits:state.decimals,maximumFractionDigits:state.decimals})+state.suffix;}
function title(f){return names[f.id]||f.properties.name.replace(/ district$/i,'');}
function el(tag,attrs={},textValue){const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(textValue!==undefined)node.textContent=textValue;return node;}
function add(parent,tag,attrs,textValue){const n=el(tag,attrs,textValue);parent.append(n);return n;}
const projected=([lon,lat])=>[lon,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI];
function walk(coords,fn){if(typeof coords[0]==='number')fn(coords);else coords.forEach(c=>walk(c,fn));}
function geometryPath(geom,point){const line=c=>c.map((p,i)=>(i?'L':'M')+point(p).map(n=>n.toFixed(2)).join(',')).join('');if(geom.type==='Polygon')return geom.coordinates.map(r=>line(r)+'Z').join('');if(geom.type==='MultiPolygon')return geom.coordinates.map(p=>p.map(r=>line(r)+'Z').join('')).join('');if(geom.type==='LineString')return line(geom.coordinates);if(geom.type==='MultiLineString')return geom.coordinates.map(line).join('');return '';}
function labelScope(){return state.view+':'+state.area;}
function savedLabel(id){return state.labelPositions[labelScope()]?.[id];}
function clampLabel(x,y,width,height){return [Math.max(38+width/2,Math.min(962-width/2,x)),Math.max(150+state.fontSize,Math.min(740+state.fontSize-height,y))];}
function moveLabel(id,x,y){
 checkpoint();(state.labelPositions[labelScope()]??={})[id]=[x,y];renderMap();persist();notify('Label moved. Undo or Reset label positions to restore the layout.');
}
function enableLabelDrag(label,l,leader,dot){
 let drag;
 const svg=$('map-svg');
 const position=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());};
 const paint=(x,y)=>{
  label.setAttribute('x',x);label.setAttribute('y',y);label.querySelectorAll('tspan').forEach(t=>t.setAttribute('x',x));
  leader.setAttribute('d','M'+l.px+','+l.py+'L'+x+','+(y-state.fontSize/2));
  const visibility=Math.hypot(x-l.px,y-l.py)>12?'visible':'hidden';leader.setAttribute('visibility',visibility);dot.setAttribute('visibility',visibility);
 };
 label.addEventListener('pointerdown',e=>{
  if(e.button!==0||drag)return;e.preventDefault();e.stopPropagation();const p=position(e);
  drag={id:e.pointerId,start:p,x:l.x,y:l.y};label.setPointerCapture(e.pointerId);label.style.cursor='grabbing';
 });
 label.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;const p=position(e);
  [drag.x,drag.y]=clampLabel(l.x+p.x-drag.start.x,l.y+p.y-drag.start.y,l.width,l.height);paint(drag.x,drag.y);
 });
 const finish=(e,cancel=false)=>{
  if(!drag||drag.id!==e.pointerId)return;const end=drag;drag=null;label.style.cursor='grab';
  if(label.hasPointerCapture(e.pointerId))label.releasePointerCapture(e.pointerId);
  if(!cancel&&(Math.abs(end.x-l.x)>.1||Math.abs(end.y-l.y)>.1))moveLabel(l.f.id,end.x,end.y);else paint(l.x,l.y);
 };
 label.addEventListener('pointerup',e=>finish(e));label.addEventListener('pointercancel',e=>finish(e,true));label.addEventListener('lostpointercapture',e=>finish(e,true));
 label.addEventListener('keydown',e=>{
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;
  e.preventDefault();const step=e.shiftKey?10:2;const [x,y]=clampLabel(l.x+delta[0]*step,l.y+delta[1]*step,l.width,l.height);moveLabel(l.f.id,x,y);
  [...svg.querySelectorAll('.area-label')].find(n=>n.dataset.labelId===l.f.id)?.focus();
 });
}
let lastScale;
function renderMap(){
 const svg=$('map-svg');svg.replaceChildren();svg.setAttribute('style','font-family:Arial,sans-serif');
 add(svg,'rect',{width:1000,height:900,fill:state.background});
 add(svg,'text',{x:45,y:53,'font-size':28,'font-weight':650,fill:'#203548',textLength:state.title.length>55?900:undefined},state.title||'Untitled map').removeAttribute('textLength');
 // Long titles remain bounded without injecting markup.
 if(state.title.length>55){svg.lastChild.setAttribute('textLength','900');svg.lastChild.setAttribute('lengthAdjust','spacingAndGlyphs');}
 add(svg,'text',{x:45,y:82,'font-size':13,fill:'#758491'},state.subtitle);
 const shown=features();const boundsFeatures=state.area?(state.view==='provinces'?D.provinces:D.regions).features.filter(f=>inArea(f.id)):D.regions.features;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const f of boundsFeatures)walk(f.geometry.coordinates,p=>{const [x,y]=projected(p);minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);});
 const factor=Math.min(900/(maxX-minX),570/(maxY-minY));const dx=50+(900-factor*(maxX-minX))/2,dy=155+(570-factor*(maxY-minY))/2;
 const point=p=>{const [x,y]=projected(p);return [dx+(x-minX)*factor,dy+(maxY-y)*factor];};
 const defs=add(svg,'defs');const clip=add(defs,'clipPath',{id:'map-clip'});add(clip,'rect',{x:35,y:145,width:930,height:600});const mapGroup=add(svg,'g',{'clip-path':'url(#map-clip)'});
 const vals=Object.fromEntries(shown.map(f=>[f.id,value(f)]));const scale=C.scale(vals);lastScale=scale;
 if(state.view==='districts')for(const f of boundsFeatures)add(mapGroup,'path',{d:geometryPath(f.geometry,point),fill:state.emptyColor,stroke:'#8497a6','stroke-width':state.borderWidth,'fill-rule':'evenodd',class:'region-backdrop','data-region':f.id});
 const gaps=state.showGaps?(state.view==='districts'?D.gaps.features.filter(f=>inArea(f.properties.region_id)):state.view==='provinces'&&!state.area?D.unassigned.features:[]):[];
 for(const f of gaps)add(mapGroup,'path',{d:geometryPath(f.geometry,point),fill:'#eef0f2',stroke:'#bac4cd','stroke-width':.8,'stroke-dasharray':'3 3','fill-rule':'evenodd'});
 for(const f of shown){
  const path=add(mapGroup,'path',{d:geometryPath(f.geometry,point),fill:C.color(value(f),scale,state.palette,state.reverse,state.emptyColor),stroke:selected===f.id?'#147d83':'#8497a6','stroke-width':selected===f.id?2:state.borderWidth,'fill-rule':'evenodd',class:'map-area',tabindex:0,role:'button','aria-label':title(f)+': '+format(value(f)),'data-id':f.id});
  add(path,'title',{},title(f)+' · '+format(value(f))+(f.properties.region_id?' · '+names[f.properties.region_id]:''));
  path.addEventListener('click',()=>select(f.id));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(f.id);}});
 }
 if(state.loc){for(const f of D.loc.features){add(mapGroup,'path',{d:geometryPath(f.geometry,point),fill:'none',stroke:'white','stroke-width':5,'pointer-events':'none'});add(mapGroup,'path',{d:geometryPath(f.geometry,point),fill:'none',stroke:'#b12b4d','stroke-width':2.3,'stroke-dasharray':'7 5','pointer-events':'none'});}add(svg,'text',{x:650,y:128,'font-size':11,fill:'#b12b4d'},'— — LoC · India–Pakistan (approximate)');}
 const placed=[],labels=[];
 const contextLabels=state.view==='districts'?D.context.features.filter(f=>inArea(f.properties.region_id)):[];
 if(state.labels!=='none')for(const f of [...shown,...contextLabels].sort((a,b)=>Number(!!savedLabel(b.id))-Number(!!savedLabel(a.id))||Number(value(b)!==null)-Number(value(a)!==null))){
  const p=f.properties.label_point;if(!p)continue;const [px,py]=point(p),v=value(f);
  const isContext=f.properties.feature_kind==='geographic_area';
  const lines=[];if(isContext||state.labels!=='values')lines.push(title(f));if(!isContext&&state.labels!=='names')lines.push(format(v));
  const width=Math.max(...lines.map(t=>t.length))*state.fontSize*.62+10,height=lines.length*(state.fontSize+3)+4;
  const rect=(x,y)=>({left:x-width/2,right:x+width/2,top:y-state.fontSize-2,bottom:y-state.fontSize-2+height});
  const fits=r=>r.left>=38&&r.right<=962&&r.top>=148&&r.bottom<=742&&!placed.some(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top);
  let x=px,y=py,best=Infinity;
  const manual=savedLabel(f.id);
  if(manual)[x,y]=clampLabel(...manual,width,height);
  if(!manual&&!fits(rect(x,y))){
   for(let cy=160;cy<=730-height+state.fontSize;cy+=6)for(let cx=40+width/2;cx<=960-width/2;cx+=8){
    const cost=(cx-px)**2+(cy-py)**2;
    if(cost<best&&fits(rect(cx,cy))){best=cost;x=cx;y=cy;}
   }
  }
  placed.push(rect(x,y));labels.push({f,x,y,px,py,lines,width,height});
 }
 for(const l of labels){
  const visibility=Math.hypot(l.x-l.px,l.y-l.py)>12?'visible':'hidden';
  l.leader=add(mapGroup,'path',{d:'M'+l.px+','+l.py+'L'+l.x+','+(l.y-state.fontSize/2),fill:'none',stroke:'#758a99','stroke-width':.8,'pointer-events':'none',class:'label-leader',visibility});
  l.dot=add(mapGroup,'circle',{cx:l.px,cy:l.py,r:1.8,fill:'#758a99','pointer-events':'none',visibility});
 }
 for(const l of labels){
  const {f,x,y,lines}=l;
  const label=add(mapGroup,'text',{x,y,'text-anchor':'middle','font-size':state.fontSize,fill:'#263d50',stroke:'#ffffff','stroke-width':2.5,'stroke-opacity':.9,'paint-order':'stroke','stroke-linejoin':'round','pointer-events':'all',class:'area-label','data-label-id':f.id,tabindex:0,role:'button','aria-label':'Move '+title(f)+' label. Drag or use arrow keys.',style:'cursor:grab;touch-action:none;user-select:none'});
  lines.forEach((line,i)=>add(label,'tspan',{x,dy:i?state.fontSize+3:0,'font-weight':(state.labels==='values'||i>0)?700:400},line));
  enableLabelDrag(label,l,l.leader,l.dot);
 }
 // Branding sits over the map at low opacity and is embedded in image exports.
 if(state.watermark){const watermark=add(svg,'g',{'pointer-events':'none','aria-hidden':'true',class:'map-watermark'});
 for(let y=205;y<730;y+=150)for(let x=160;x<970;x+=310)add(watermark,'text',{x,y,'text-anchor':'middle','font-size':18,'font-weight':600,fill:'#294d65',opacity:.07,transform:'rotate(-18 '+x+' '+y+')'},'Kashmir Ke Waris');}
 if(state.showLegend){
  const stops=state.reverse?[...C.palettes[state.palette]].reverse():C.palettes[state.palette];const grad=add(defs,'linearGradient',{id:'data-gradient'});stops.forEach((c,i)=>add(grad,'stop',{offset:i*50+'%','stop-color':c}));
  if(scale.count){add(svg,'rect',{x:50,y:110,width:260,height:10,rx:5,fill:'url(#data-gradient)'});add(svg,'text',{x:50,y:139,'font-size':11,fill:'#566b7a'},format(scale.min));add(svg,'text',{x:310,y:139,'text-anchor':'end','font-size':11,fill:'#566b7a'},format(scale.max));}else add(svg,'text',{x:50,y:125,'font-size':12,fill:'#768694'},'Add values to colour the map');
  add(svg,'rect',{x:350,y:110,width:12,height:12,rx:2,fill:state.emptyColor});add(svg,'text',{x:370,y:120,'font-size':11,fill:'#768694'},'No data');
 }
 add(svg,'line',{x1:45,x2:955,y1:770,y2:770,stroke:'#e5ebef'});
 add(svg,'text',{x:45,y:798,'font-size':11,fill:'#7e8e99'},'SOURCE');add(svg,'text',{x:45,y:819,'font-size':12,fill:'#384e60'},state.source||'Add your dataset source');
 add(svg,'text',{x:45,y:845,'font-size':12,fill:'#384e60'},state.author?'Created by '+state.author:'Created with Kashmir Map Studio');
 if(state.showTotal){add(svg,'text',{x:950,y:798,'text-anchor':'end','font-size':11,fill:'#7e8e99'},(state.aggregation==='average'?'AVERAGE OF ':'SUM OF ')+scale.count+' VALUES');add(svg,'text',{x:950,y:839,'text-anchor':'end','font-size':30,'font-weight':700,fill:'#203548'},scale.count?format(state.aggregation==='average'?scale.total/scale.count:scale.total):'—');}
 add(svg,'text',{x:45,y:877,'font-size':12,'font-weight':600,fill:'#516c7d'},'©Chinaar Tech');
 add(svg,'text',{x:955,y:877,'text-anchor':'end','font-size':9,fill:'#85939d'},'Map data © OpenStreetMap contributors · ODbL · openstreetmap.org/copyright');
 $('summary').textContent=shown.length+' areas · '+scale.count+' with data';$('view-description').textContent=modes[state.view]+(state.area?' / '+names[state.area]:'');
}
function select(id){selected=id;switchTab('data');$('search').value='';renderRows();renderMap();const input=$('value-'+id);input?.focus();input?.scrollIntoView({block:'nearest'});const f=D[state.view].features.find(f=>f.id===id);$('selected-info').textContent=title(f)+' · '+id+' · '+format(value(f));}
function renderRows(){const q=C.normalize($('search').value);const rows=features().filter(f=>C.normalize(title(f)+' '+f.id).includes(q)).sort((a,b)=>title(a).localeCompare(title(b)));$('value-rows').replaceChildren();$('row-count').textContent=rows.length+' areas · blank means no data';for(const f of rows){const row=document.createElement('div');row.className='value-row'+(selected===f.id?' selected':'');const label=document.createElement('label');label.htmlFor='value-'+f.id;label.textContent=title(f);const sub=document.createElement('small');sub.textContent=(names[f.properties.region_id]||'')+' · '+f.id;label.append(sub);const input=document.createElement('input');input.id='value-'+f.id;input.type='number';input.step='any';input.placeholder='—';input.value=value(f)??'';input.addEventListener('change',()=>{try{if(input.validity?.badInput)throw Error('Enter a valid number');const v=C.number(input.value);checkpoint();state.values[state.view][f.id]=v;renderMap();persist();notify('Updated '+title(f));}catch(e){notify(e.message);input.value=value(f)??'';}});row.append(label,input);$('value-rows').append(row);}}
function switchTab(tab){document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);});for(const name of ['data','style','layers','slides'])$('panel-'+name).hidden=name!==tab;}
function sync(){
 $('view').value=state.view;$('area').replaceChildren(new Option(state.view==='provinces'?'All provinces':'All regions',''));for(const f of (state.view==='provinces'?D.provinces:D.regions).features)$('area').add(new Option(names[f.id]||f.properties.name,f.id));if(state.view!=='provinces')$('area').add(new Option(names.jk,'jk'));$('area').value=state.area;
 for(const [id,key] of Object.entries(fields)){const node=$(id);if(node.type==='checkbox')node.checked=state[key];else node.value=state[key];}
 document.querySelectorAll('[data-palette]').forEach(b=>b.classList.toggle('active',b.dataset.palette===state.palette));renderRows();renderMap();renderSlides();$('undo').disabled=!history.length;
}
function download(name,content,type){const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function applyCSV(text){try{const result=C.importCSV(text,D[state.view].features);if(result.issues.length){$('import-report').textContent='Nothing imported. Fix these rows and try again:\n'+result.issues.join('\n');return;}checkpoint();Object.assign(state.values[state.view],result.updates);renderRows();renderMap();persist();$('import-report').textContent='Imported '+Object.keys(result.updates).length+' values. Other values were kept.';notify('CSV imported.');}catch(e){$('import-report').textContent=e.message;}}
function csvRows(template=false){return [['id','name','region','value'],...features().map(f=>[f.id,title(f),f.properties.region_id||'',template?'':value(f)])];}
function svgString(){const copy=$('map-svg').cloneNode(true);copy.setAttribute('xmlns',NS);copy.setAttribute('width','1000');copy.setAttribute('height','900');copy.querySelectorAll('.area-label').forEach(p=>{p.removeAttribute('tabindex');p.removeAttribute('role');p.removeAttribute('aria-label');p.removeAttribute('style');p.setAttribute('pointer-events','none');});copy.querySelectorAll('.map-area').forEach(p=>{p.setAttribute('stroke','#8497a6');p.setAttribute('stroke-width',state.borderWidth);p.removeAttribute('tabindex');p.removeAttribute('role');});return new XMLSerializer().serializeToString(copy);}
function renderSlides(){const list=$('slides-list');list.replaceChildren();slides.forEach((slide,i)=>{const box=document.createElement('div');box.className='snapshot';const name=document.createElement('p');name.textContent=(i+1)+'. '+slide.name;const restore=document.createElement('button');restore.textContent='Restore';restore.onclick=()=>{checkpoint();state=clone(slide.state);selected='';sync();persist();notify('Snapshot restored.');};const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=()=>{checkpoint();slides.splice(i,1);renderSlides();persist();};box.append(name,restore,remove);list.append(box);});}
for(const [name,stops] of Object.entries(C.palettes)){const b=document.createElement('button');b.className='palette';b.dataset.palette=name;const swatch=document.createElement('span');swatch.style.background='linear-gradient(90deg,'+stops.join(',')+')';b.append(swatch,document.createTextNode(name));b.onclick=()=>{checkpoint();state.palette=name;sync();persist();};$('palettes').append(b);}
for(const [id,key] of Object.entries(fields))$(id).addEventListener('change',()=>{checkpoint();const node=$(id);state[key]=node.type==='checkbox'?node.checked:['fontSize','borderWidth','decimals'].includes(key)?Number(node.value):node.value;renderMap();persist();});
$('reset-labels').onclick=()=>{checkpoint();delete state.labelPositions[labelScope()];renderMap();persist();notify('Automatic label positions restored for this view.');};
$('view').onchange=()=>{checkpoint();state.view=$('view').value;state.area='';selected='';$('search').value='';sync();persist();notify('Values are stored separately for each map view.');};
$('area').onchange=()=>{checkpoint();state.area=$('area').value;selected='';renderRows();renderMap();persist();};$('search').oninput=renderRows;
$('undo').onclick=()=>{if(!history.length)return;const prior=JSON.parse(history.pop());state=prior.state;slides=prior.slides;selected='';sync();persist();notify('Last change undone.');};
$('sample').onclick=()=>{checkpoint();state.values[state.view]={};const fs=features();fs.slice(0,3).forEach((f,i)=>state.values[state.view][f.id]=[10,55,100][i]);state.title='Example map';state.subtitle='Demonstration values — replace with your own data';state.source='Example data (not real statistics)';sync();persist();notify('Loaded example values. Undo restores previous data.');};
$('clear').onclick=()=>{checkpoint();state.values[state.view]={};renderRows();renderMap();persist();notify('Values cleared for this view. Undo is available.');};
$('csv-template').onclick=()=>download('kashmir-'+state.view+'-template.csv',C.csv(csvRows(true)),'text/csv');$('csv-open').onclick=()=>$('csv-file').click();$('csv-apply').onclick=()=>applyCSV($('csv-text').value);
$('csv-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('CSV must be under 2 MB.');applyCSV(await file.text());}catch(err){notify(err.message);}e.target.value='';};
$('save-project').onclick=()=>{download('kashmir-map-project.json',JSON.stringify({type:'kashmir-map-studio',version:1,state,slides},null,2),'application/json');notify('Project downloaded, including values, styles and snapshots.');};$('open-project').onclick=()=>$('project-file').click();
$('project-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error('Project must be under 5 MB.');const loaded=project(JSON.parse(await file.text()));checkpoint();state=loaded.state;slides=loaded.slides;selected='';sync();persist();notify('Project opened.');}catch(err){notify('Could not open project: '+err.message);}e.target.value='';};
$('add-slide').onclick=()=>{if(slides.length>=50){notify('Maximum 50 snapshots per project.');return;}checkpoint();slides.push({name:state.title||modes[state.view],state:clone(state)});renderSlides();persist();notify('Snapshot saved in this project.');};
$('export-open').onclick=()=>$('export-dialog').showModal();$('export-close').onclick=()=>$('export-dialog').close();$('export-svg').onclick=()=>download('kashmir-map.svg',svgString(),'image/svg+xml');$('export-csv').onclick=()=>download('kashmir-data.csv',C.csv(csvRows()),'text/csv');
$('export-geojson').onclick=()=>{const output={type:'FeatureCollection',metadata:{...D[state.view].metadata,title:state.title,source:state.source,author:state.author,value_prefix:state.prefix,value_suffix:state.suffix,loc_source:state.loc?D.loc.metadata:undefined},features:features().map(f=>({...f,properties:{...f.properties,value:value(f)}})).concat(state.loc?D.loc.features:[])};download('kashmir-data.geojson',JSON.stringify(output),'application/geo+json');};
$('export-png').onclick=()=>{const url=URL.createObjectURL(new Blob([svgString()],{type:'image/svg+xml'}));const img=new Image();img.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1800;canvas.getContext('2d').drawImage(img,0,0,2000,1800);canvas.toBlob(blob=>{if(blob)download('kashmir-map.png',blob,'image/png');else notify('PNG export failed. Try SVG export.');});}catch(e){notify('PNG export failed: '+e.message);}finally{URL.revokeObjectURL(url);}};img.onerror=()=>{URL.revokeObjectURL(url);notify('PNG export failed. Try SVG export.');};img.src=url;};
function setZoom(z){zoom=Math.max(.5,Math.min(2.5,z));$('artboard').style.width=(Math.min(850,$('canvas-scroll').clientWidth-80)*zoom)+'px';$('zoom-value').textContent=Math.round(zoom*100)+'%';}
$('zoom-in').onclick=()=>setZoom(zoom+.2);$('zoom-out').onclick=()=>setZoom(zoom-.2);$('fit').onclick=()=>{zoom=1;$('artboard').style.width='';$('zoom-value').textContent='100%';};
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>switchTab(b.dataset.tab);
const launch=new URLSearchParams(location.search);
if(Object.hasOwn(modes,launch.get('view'))){state.view=launch.get('view');state.area='';}
if(state.view!=='provinces'&&['jk',...D.regions.features.map(f=>f.id)].includes(launch.get('area')))state.area=launch.get('area');
sync();
if(['data','style','layers','slides'].includes(launch.get('panel')))switchTab(launch.get('panel'));
if(launch.get('import')==='1'){switchTab('data');$('csv-text').closest('details').open=true;$('csv-text').focus();}
})();
