// Publish only public assets, never source caches, environments or test files.
const fs=require('node:fs'),path=require('node:path');
fs.mkdirSync('dist',{recursive:true});
for(const name of ['index.html','landing.css','districts.html'])fs.copyFileSync(name,path.join('dist',name));
fs.cpSync('assets','dist/assets',{recursive:true});
console.log('Static site prepared in dist/');
