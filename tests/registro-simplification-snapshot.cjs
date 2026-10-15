// Historical guards allow only the new footer and the two tested local adapters.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const old=execFileSync('git',['show','c6139fd461f7af9ea2c5a3f1268a9c41318acef9:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const block=s=>{const a=s.indexOf('  <div id="registroAcademicFooter"'),b=s.indexOf('\n</div>\n',a);return s.slice(a,b);};
const footerCSS="  /* Recovery footer: compact opaque actions, horizontal scrolling only in the action bar. */\n  #registroAcademicFooter {background:#fff;}\n  #registroAcademicFooter > .shell {display:block;box-sizing:border-box;width:100%;padding-top:6px;padding-bottom:6px;}\n  #registroRecoveryControls {min-width:0;max-width:100%;}\n  #registroRecoveryControls .registro-recovery-actions {display:flex;flex-wrap:nowrap;align-items:center;gap:6px;box-sizing:border-box;width:100%;max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;padding:4px 2px;scrollbar-width:thin;scrollbar-color:#94a3b8 #f1f5f9;}\n  #registroRecoveryControls .registro-recovery-actions::-webkit-scrollbar {height:6px;}\n  #registroRecoveryControls .registro-recovery-actions::-webkit-scrollbar-thumb {background:#94a3b8;border-radius:6px;}\n  #registroRecoveryControls .registro-recovery-actions:focus-visible {outline:2px solid #0284c7;outline-offset:-2px;}\n  #registroRecoveryControls .registro-recovery-actions button {display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;min-height:44px;padding:6px 9px;font-size:11px;white-space:nowrap;}\n  #registroRecoveryControls .registro-action-icon {width:18px;height:18px;flex:0 0 18px;pointer-events:none;}\n  #registroRecoveryControls button[hidden],#registroEmergencyWarning[hidden] {display:none!important;}\n  #registroSaveState {display:block;margin-top:3px;font-size:10px;line-height:1.25;color:#64748b;overflow-wrap:anywhere;}\n  #registroEmergencyWarning {margin:4px 0 0;padding:6px 8px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:11px;line-height:1.3;overflow-wrap:anywhere;}\n  @media(max-width:640px){#registroRecoveryControls .registro-recovery-actions {flex-wrap:nowrap;gap:4px;}}\n  /* End recovery footer. */\n";
const modules=['registro-drafts.js','registro-recovery-ui.js'].map(f=>'<script>\n'+fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n')+'\n</script>').join('\n');
const added='<!-- Inicio simplificación docente: dependencia separada, sin cambiar handlers académicos. -->\n'+modules+'\n<!-- Fin simplificación docente. -->\n';
module.exports=s=>{
 s=require('./registro-pr84-snapshot.cjs')(s);
 s=s.replace(/\r\n/g,'\n');if(!s.includes('<!-- Inicio simplificación docente:')){assert.ok(!s.includes('onclick="IERegistroRecovery.'),'No partial removal of recovery additions');return s;}
 s=require('./registro-read-deadline-snapshot.cjs')(s);
 // Historical comparison only: the obsolete Classroom callback was removed from production.
 s=s.replace('  aplicarRestriccionNivel();\n  configurarAccesosAppsMoviles();','  aplicarRestriccionNivel();\n  restaurarCursos();\n  configurarAccesosAppsMoviles();');
 assert.equal(s.split(added).length,2,'Exact tested adapter code embedded once');
 assert.equal(s.split(footerCSS).length,2,'Exact compact footer CSS');s=s.replace(footerCSS,'');
 const footer=block(s);for(const name of ['recover','local','upload','drafts','resolve','undo'])assert.ok(footer.includes('IERegistroRecovery.'+name+'()'));
 assert.equal((footer.match(/<button/g)||[]).length,7,'Three primary actions plus contextual conflict, retry, draft and undo');
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
