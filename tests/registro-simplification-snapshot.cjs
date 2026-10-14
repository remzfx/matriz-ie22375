// Historical guards allow only the new footer and the two tested local adapters.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const old=execFileSync('git',['show','c6139fd461f7af9ea2c5a3f1268a9c41318acef9:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const block=s=>{const a=s.indexOf('      <div class="grid grid-cols-'),b=s.indexOf('      </div>',a)+12;return s.slice(a,b);};
const modules=['registro-drafts.js','registro-recovery-ui.js'].map(f=>'<script>\n'+fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n')+'\n</script>').join('\n');
const added='<!-- Inicio simplificación docente: dependencia separada, sin cambiar handlers académicos. -->\n'+modules+'\n<!-- Fin simplificación docente. -->\n';
module.exports=s=>{
 s=s.replace(/\r\n/g,'\n');if(!s.includes('<!-- Inicio simplificación docente:')){assert.ok(!s.includes('onclick="IERegistroRecovery.'),'No partial removal of recovery additions');return s;}
 assert.equal(s.split(added).length,2,'Exact tested adapter code embedded once');
 const footer=block(s);for(const name of ['recover','local','upload','drafts','resolve'])assert.ok(footer.includes('IERegistroRecovery.'+name+'()'));
 assert.equal((footer.match(/<button/g)||[]).length,5,'Three primary actions plus two conditional offers');
 const recovery=old.split('\n').find(l=>l.includes('onclick="recuperarBorradorAcademico()"'))+'\n';
 s=s.replace(added,'').replace(footer,block(old));s=s.replace('  <div id="registroAcademicFooter"',recovery+'  <div id="registroAcademicFooter"');
 for(const name of ['bajarRegistroNube','prepararVersionAcademica','confirmarRegistroConciliado']){
  const extract=x=>{const start=x.search(new RegExp('^(?:async )?function '+name+'\\(','m'));return x.slice(start,x.indexOf('\n}',start)+2);};
  const original=extract(old);let expected=original;
  if(name==='bajarRegistroNube')expected=expected.replace('async function bajarRegistroNube() {',"async function bajarRegistroNube(options) {\n  options=options||{};bajarRegistroNube.resultado=null;")
   .replace('prepararVersionAcademica())','prepararVersionAcademica(options))')
   .replace('    const applied=confirmarRegistroConciliado(plan,plan.remote);',"    if(options.validar&&!options.validar())return false;\n    const applied=confirmarRegistroConciliado(plan,plan.remote,options);\n    bajarRegistroNube.resultado={key:plan.key,token:plan.token,estado:applied?'verificado':'pendiente'};")
   .replace("}catch(e){toast(e.message||'No se pudo bajar. Trabajo local conservado.');return false;}})();","}catch(e){bajarRegistroNube.resultado={estado:'fallo'};if(!options.automatico)toast(e.message||'No se pudo bajar. Trabajo local conservado.');return false;}})();");
  else if(name==='confirmarRegistroConciliado')expected=expected.replace('function confirmarRegistroConciliado(plan,remote){','function confirmarRegistroConciliado(plan,remote,options){\n  options=options||{};').replace('    saveStore();',"    saveStore();if(options.validarPersistencia&&!options.validarPersistencia())throw Error('No se verificó el guardado local.');");
  else expected=expected.replace('async function prepararVersionAcademica(){','async function prepararVersionAcademica(options){\n  options=options||{};')
   .replace('localSignature===IERegistroReconcile.signature(sliceRegistroArea());','localSignature===IERegistroReconcile.signature(sliceRegistroArea())&&(!options.validar||options.validar());')
   .replace('  const remote=await leerEstadoRemotoAcademico(c,key,token);',"  const remote=await leerEstadoRemotoAcademico(c,key,token);\n  if(options.validar&&!current())throw Error('El borrador cambió. Tus notas locales están conservadas.');")
   .replace('  const choices=await IERegistroReconcile.choose(reconciliation.conflicts,current,{roster:estudiantes(),aliases:local.meta&&local.meta.studentAliases});',"  if(options.automatico&&reconciliation.conflicts.length){bajarRegistroNube.resultado={key,token,estado:'conflicto',conflictos:reconciliation.conflicts.length};return false;}\n  const choices=options.automatico?{}:await IERegistroReconcile.choose(reconciliation.conflicts,current,{roster:estudiantes(),aliases:local.meta&&local.meta.studentAliases});");
  if(name==='prepararVersionAcademica')expected=expected.replace("  if(!choices){toast('Conflicto pendiente.","  if(!choices){bajarRegistroNube.resultado={key,token,estado:current()?'conflicto':'pendiente',conflictos:reconciliation.conflicts.length};toast('Conflicto pendiente.");
  if(name==='prepararVersionAcademica')expected=expected.replace('  try{saveStore();}catch(e){store.academicSync[key]=previous;',"  try{saveStore();if(options.validarPersistencia&&!options.validarPersistencia())throw Error('No se verificó el respaldo local.');}catch(e){store.academicSync[key]=previous;");
  assert.equal(extract(s),expected,'Only reviewed automatic-download options differ in '+name);s=s.replace(expected,original);
 }
 const eventLine="  if(typeof document.dispatchEvent==='function'&&typeof Event!=='undefined')document.dispatchEvent(new Event('ie22375:registro-ready'));\n";
 assert.equal(s.split(eventLine).length,2,'Exactly one presentation readiness event');
 const sync=x=>{const start=x.indexOf('function sincronizarEdicionRegistro()');return x.slice(start,x.indexOf('\n}',start)+2);};
 const expected=sync(old).replace("  document.querySelectorAll('.cal-nota,.fin-nota,.academic-conclusion').forEach(el => { if (bloquearLocal) el.readOnly = true; });","  document.querySelectorAll('.cal-nota,.fin-nota,.academic-conclusion').forEach(el => { if (bloquearLocal) el.readOnly = true; });\n"+eventLine.trimEnd());
 assert.equal(sync(s),expected,'Only presentation readiness event differs in edition synchronization');
 return s.replace(eventLine,'');
};
