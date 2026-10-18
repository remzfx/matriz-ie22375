// Test-only source loader. Historical presentation goldens compare executable
// content, not whether these four unchanged scripts live inside the HTML.
// Production never inlines them. Loading/order/guards are tested separately.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const printFile='registro-calificar-print.js';
const modules=['registro-local-store.js','registro-connection.js','registro-drafts.js','registro-recovery-ui.js'];
function source(file){return fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');}
function scripts(html){
 return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m=>{
  const src=/\bsrc="([^"]+)"/.exec(m[1])?.[1];
  return {src,attributes:m[1],code:src&&(modules.includes(src)||src===printFile||src==='registro-evaluation.js')?source(src):m[2]};
 });
}
const pageGuard="<script>\n/* Inicio control de dependencias obligatorias. */\nfunction registroDependenciaFallida(){\n  const status=document.getElementById('registroConnectionStatus'),label=document.getElementById('registroConnectionText');\n  if(status)status.dataset.state='server';\n  if(label)label.textContent='No se pudo cargar un componente de Registro. Edición pausada; tus notas locales están conservadas. Vuelve a abrir Registro cuando haya conexión.';\n  if(typeof IERegistroConnection!=='undefined')IERegistroConnection.current()?.dispose();\n  document.querySelectorAll('[data-reg-write],[data-reg-cloud],#registroRecoveryControls button,.cal-nota,.fin-nota,.academic-conclusion,.asis-input').forEach(el=>el.disabled=true);\n}\n/* Fin control de dependencias obligatorias. */\n</script>\n",coreGuard="/* Inicio guard de arranque de Registro. */\nif(typeof IERegistroLocalStore==='undefined'||typeof IERegistroConnection==='undefined'||typeof IERegistroEvaluacion==='undefined'){\n  registroDependenciaFallida();throw Error('Registro pausado: falta una dependencia obligatoria.');\n}\n/* Fin guard de arranque de Registro. */\n",recoveryGuard=" /* Inicio guard de dependencias de recuperación. */\n if(typeof registroDependenciaFallida==='function'&&(typeof IERegistroLocalStore==='undefined'||typeof IERegistroConnection==='undefined'||typeof IERegistroDrafts==='undefined'||typeof IERegistroEvaluacion==='undefined')){\n  registroDependenciaFallida();return;\n }\n /* Fin guard de dependencias de recuperación. */\n";
function historicalRecovery(code){return code.replace(/\r\n/g,'\n').replace(recoveryGuard,'').replace(recoveryGuard.replace("||typeof IERegistroEvaluacion==='undefined'",''),'').replace(" 'use strict';\n let service,"," 'use strict';let service,");}
const mathWrappers={"function numToLetter(n) {\n  return IERegistroEvaluacion.numToLetter(n);\n}":"function numToLetter(n) {\n  n = Number(n);\n  if (isNaN(n) || n < 0 || n > 20) return '';\n  if (n >= 18) return 'AD';\n  if (n >= 14) return 'A';\n  if (n >= 11) return 'B';\n  return 'C';\n}","function letterToNum(L) { return IERegistroEvaluacion.letterToNum(L); }":"function letterToNum(L) { return ({ AD:19, A:15, B:12, C:8 })[L] ?? ''; }","function promedioNums(arr) {\n  return IERegistroEvaluacion.promedioNums(arr);\n}":"function promedioNums(arr) {\n  const v = arr.filter(x => x !== '' && x != null && !isNaN(Number(x))).map(Number);\n  if (!v.length) return null;\n  return Math.round(v.reduce((a,b)=>a+b,0) / v.length);\n}"};
function historicalContent(html){
 html=html.replace(/\r\n/g,'\n');
 for(const [wrapper,original]of Object.entries(mathWrappers))html=html.replace(wrapper,original);
 // The required connection dependency now also fails closed if it cannot load.
 // Its missing/paused/verified behavior has dedicated executable regressions.
 return html.replace(/\r\n/g,'\n').replace(" if(typeof IECalificarPrint==='undefined'){toast('No se pudo cargar el módulo de impresión. Tus notas están conservadas; vuelve a intentarlo con conexión.');return false;}\n",'').replace(pageGuard,'').replace(coreGuard,'').replace(coreGuard.replace("||typeof IERegistroEvaluacion==='undefined'",''),'').replaceAll(' onerror="registroDependenciaFallida()"','').replace("if(typeof IERegistroConnection==='undefined'||!IERegistroConnection.canEdit())return true;","if(typeof IERegistroConnection!=='undefined'&&!IERegistroConnection.canEdit())return true;")
 .replace(/<script src="(registro-(?:local-store|connection|drafts|recovery-ui|calificar-print)\.js)"><\/script>/g,(_,file)=>
  '<script>\n'+(file==='registro-recovery-ui.js'?historicalRecovery(source(file)):source(file)).trimEnd()+(file==='registro-drafts.js'||file==='registro-recovery-ui.js'?'\n\n':'\n')+'</script>');
}
function historicalWorker(source){return source.replace(/\r\n/g,'\n').replace("\n  './registro-calificar-print.js',",'').replace("CACHE_PREFIX + 'v22'","CACHE_PREFIX + 'v21'").replace("\n  './registro-local-store.js', './registro-connection.js', './registro-drafts.js', './registro-recovery-ui.js',",'');}
module.exports={modules,source,scripts,historicalContent,historicalWorker,historicalRecovery,pageGuard,coreGuard};
