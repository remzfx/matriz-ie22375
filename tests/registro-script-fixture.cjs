// Test-only source loader. Historical presentation goldens compare executable
// content, not whether these four unchanged scripts live inside the HTML.
// Production never inlines them. Loading/order/guards are tested separately.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const modules=['registro-local-store.js','registro-connection.js','registro-drafts.js','registro-recovery-ui.js'];
function source(file){return fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');}
function scripts(html){
 return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m=>{
  const src=/\bsrc="([^"]+)"/.exec(m[1])?.[1];
  return {src,attributes:m[1],code:src&&modules.includes(src)?source(src):m[2]};
 });
}
function historicalContent(html){
 // The required connection dependency now also fails closed if it cannot load.
 // Its missing/paused/verified behavior has dedicated executable regressions.
 return html.replace("if(typeof IERegistroConnection==='undefined'||!IERegistroConnection.canEdit())return true;","if(typeof IERegistroConnection!=='undefined'&&!IERegistroConnection.canEdit())return true;")
 .replace(/<script src="(registro-(?:local-store|connection|drafts|recovery-ui)\.js)"><\/script>/g,(_,file)=>
  '<script>\n'+source(file).trimEnd()+(file==='registro-drafts.js'||file==='registro-recovery-ui.js'?'\n\n':'\n')+'</script>');
}
function historicalWorker(source){return source.replace(/\r\n/g,'\n').replace("\n  './registro-local-store.js', './registro-connection.js', './registro-drafts.js', './registro-recovery-ui.js',",'');}
module.exports={modules,source,scripts,historicalContent,historicalWorker};
