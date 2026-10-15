// Publish only public assets, never source caches, environments or test files.
const fs=require('node:fs'),path=require('node:path');
fs.mkdirSync('dist',{recursive:true});
for(const name of ['index.html','landing.css','districts.html'])fs.copyFileSync(name,path.join('dist',name));
fs.cpSync('assets','dist/assets',{recursive:true});
// Publish generated GeoJSON only; raw OSM caches remain private to the build.
const geoDirectory=path.join('dist','geojson');
fs.mkdirSync(geoDirectory,{recursive:true});
const datasets=fs.readdirSync('output').filter(name=>name.endsWith('.geojson')).sort().map(name=>{
  const source=path.join('output',name);
  const data=JSON.parse(fs.readFileSync(source,'utf8'));
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Invalid GeoJSON: '+name);
  fs.copyFileSync(source,path.join(geoDirectory,name));
  return {name,url:'/geojson/'+name,features:data.features.length,bytes:fs.statSync(source).size};
});
const attribution='Map data © OpenStreetMap contributors, ODbL 1.0';
fs.writeFileSync(path.join(geoDirectory,'index.json'),JSON.stringify({attribution,licence_url:'https://www.openstreetmap.org/copyright',notes:'Approximate disputed boundaries. District inventory is incomplete. Province groupings use modern boundaries and include Aksai Chin in Frontier Province. Empty collections are retained for unavailable coverage.',datasets},null,2));
fs.writeFileSync(path.join(geoDirectory,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Public GeoJSON · Kashmir Ke Waris</title><link rel="icon" href="/assets/chinar.svg"><style>body{max-width:960px;margin:40px auto;padding:0 20px;font:16px system-ui;color:#193f36;background:#faf8f2}p{line-height:1.6}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px 8px;border-bottom:1px solid #ddd}a{color:#126f78}code{overflow-wrap:anywhere}td:first-child{overflow-wrap:anywhere}</style></head><body><a href="/">← Kashmir Ke Waris</a><h1>Public GeoJSON downloads</h1><p>Use these URLs directly in mapping tools or JavaScript fetch requests. No account or API key is required. <a href="index.json">Machine-readable dataset index</a>.</p><p>${attribution}. <a href="https://www.openstreetmap.org/copyright">Licence and attribution</a>. Boundaries are approximate and disputed; district coverage is incomplete. Province groupings use modern geometry, with Aksai Chin in Frontier Province. Collections with zero features indicate unavailable or empty coverage.</p><table><thead><tr><th>Dataset</th><th>Features</th><th>Size</th></tr></thead><tbody>${datasets.map(d=>`<tr><td><a href="${d.url}">${d.name}</a></td><td>${d.features}</td><td>${Math.round(d.bytes/1024)} KB</td></tr>`).join('')}</tbody></table></body></html>`);
console.log('Static site prepared in dist/');
