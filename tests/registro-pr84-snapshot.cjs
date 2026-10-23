// Exact allowlist for PR84 persistence wrappers/copy; never masks academic handler changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=require('node:child_process').execFileSync('git',['show','e3243fe74a0aee6981f8173835f4cb183b3622df:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const fn=(s,n)=>{const a=s.indexOf('function '+n+'(');return s.slice(a,s.indexOf('\n}',a)+2);};
module.exports=source=>{
 source=require('./registro-phase1-snapshot.cjs')(source);
 source=require('./registro-issue86-snapshot.cjs')(source);
 let s=source.replace(/\r\n/g,'\n');if(!s.includes('const registroLocal = IERegistroLocalStore.create('))return s;
 const module='<script>\n'+fs.readFileSync(path.join(__dirname,'..','registro-local-store.js'),'utf8').trim().replace(/\r\n/g,'\n')+'\n</script>\n';
 assert.equal(s.split(module).length,2,'Exact tested owner persistence embedded once');s=s.replace(module,'');
 const expected={
  loadStore:fn(base,'loadStore').replace('function loadStore() {',"function loadStore() {\n  if(typeof registroLocal!=='undefined'&&!registroLocal.matches())throw Error('La cuenta cambió. Abre Registro nuevamente; las notas anteriores están conservadas.');")
   .replace('const raw = localStorage.getItem(NOTAS_KEY);',"const raw = typeof registroLocal!=='undefined'?registroLocal.read():localStorage.getItem(NOTAS_KEY);")
   .replace('} catch(e) {}',"} catch(e) {if(typeof registroLocal!=='undefined')throw e;}"),
  saveStore:fn(base,'saveStore').replace('  localStorage.setItem(NOTAS_KEY, JSON.stringify(store));',"  if(typeof registroLocal!=='undefined')registroLocal.write(JSON.stringify(store));\n  else localStorage.setItem(NOTAS_KEY, JSON.stringify(store));"),
  registroSoloLectura:fn(base,'registroSoloLectura').replace('function registroSoloLectura() {',"function registroSoloLectura() {\n  if(typeof registroLocal!=='undefined'&&!registroLocal.matches())return true;")
 };
 for(const [name,value]of Object.entries(expected)){assert.equal(fn(s,name),value,'PR84 exact persistence boundary: '+name);s=s.replace(value,fn(base,name));}
 s=s.replace('const registroLocal = IERegistroLocalStore.create(localStorage,getLoginSession);\nconst NOTAS_KEY = registroLocal.key;',"const NOTAS_KEY = 'ie22375_registro_notas_v2';");
 const banner='      <p id="registroLegacyWarning" hidden class="text-xs text-amber-800 p-2">Hay datos anteriores sin propietario verificable. Se conservan intactos; consulta con Admin para revisarlos. <button id="registroLegacyReview" hidden style="display:none;min-height:44px" type="button" class="btn btn-ghost" onclick="IERegistroRecovery.legacy()">Revisar datos anteriores · Admin</button></p>\n';
 assert.equal(s.split(banner).length,2);s=s.replace(banner,'');
 s=s.replace('Nota directa de Promedios prevalece · Cal = calculado desde Calificar','Promedio directo prevalece sobre evidencias');
 return s.replaceAll(' title="Calculado desde Calificar; no es una nota directa">Cal ','>Cal ');
};
module.exports.reviewed=source=>{
 let s=module.exports(source);
 for(const name of ['registro-drafts.js','registro-recovery-ui.js']){
  const raw=require('./academic-reset-boundary.cjs')(name,fs.readFileSync(path.join(__dirname,'..',name),'utf8'));const current=(name==='registro-recovery-ui.js'?require('./phase2-boundary.cjs').recovery(raw):raw).replace(/\r\n/g,'\n');
  const previous=require('node:child_process').execFileSync('git',['show','e3243fe74a0aee6981f8173835f4cb183b3622df:'+name],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  assert.equal(s.split(current).length,2,'Exact PR84 adapter before historical icon comparison');s=s.replace(current,previous);
 }
 return s;
};
