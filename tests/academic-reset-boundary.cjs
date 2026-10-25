'use strict';
// Exact reset-only hooks for historical snapshots. Runtime/security tests use raw files.
const assert=require('node:assert/strict');
const edits={
 "apps-script/Codigo.js": [
  [
   "function transversalesBridgeEjecutar(body) { return body?.action==='academicstate'?academicResetRead_(body):transversalesRuta_(body || {}); }\n",
   "function transversalesBridgeEjecutar(body) { return transversalesRuta_(body || {}); }\n"
  ],
  [
   "    if(escritura){const resetStopped=academicResetGuard_(body);if(resetStopped)return resetStopped;}\n",
   ""
  ],
  [
   "// Academic reset fence: read directly, never from a potentially stale cache.\nfunction academicResetRead_(body){if(!sesionLectura_(body.token,['admin','docente']))return {ok:false,code:'SESSION',error:'Sesión inválida.'};return {ok:true,academicReset:1,...academicResetState_()};}\nfunction academicResetState_(){\n const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AcademicResetControl');if(!sh)return {epoch:null,phase:null};\n const row=sh.getRange(2,1,1,4).getValues()[0];\n if(row[0]!==1||!/^[a-f0-9]{32}$/.test(row[1])||!['blocked','complete'].includes(row[3]))throw Error('Control académico inválido. Escritura pausada.');\n return {epoch:row[1],phase:row[3]};\n}\nfunction academicResetGuard_(body){\n // The attendance panel cannot carry grades and keeps its original CAS version.\n if(String(body.action).toLowerCase()==='savenotas2'&&body.panel==='asistencia')return null;\n const s=academicResetState_();if(!s.epoch)return null;\n const legacy=String(body.action).toLowerCase()==='savereg';\n return s.phase!=='complete'||legacy||body.academicEpoch!==s.epoch?{ok:false,code:'ACADEMIC_RESET',error:'Se reinició el registro académico. Vuelve a abrir el módulo; no se subieron datos anteriores.'}:null;\n}\n",
   ""
  ],
  [
   "  let academicMatrixLock;\n",
   ""
  ],
  [
   "    if(action==='academicstate'){\n      return responder_(academicResetRead_(body));\n    }\n",
   ""
  ],
  [
   "        const resetStopped=academicResetGuard_(body);if(resetStopped)return responder_(resetStopped);\n",
   ""
  ],
  [
   "    {const lock=LockService.getScriptLock();lock.waitLock(30000);academicMatrixLock=lock;const stopped=academicResetGuard_(body);if(stopped)return responder_(stopped);}\n",
   ""
  ],
  [
   "  finally {if(academicMatrixLock)academicMatrixLock.releaseLock();}\n",
   ""
  ]
 ],
 "apps-script/Notas2.js": [
  [
   "    if(save){const resetStopped=academicResetGuard_(body);if(resetStopped)return resetStopped;}\n",
   ""
  ]
 ],
 "registro.html": [
  [
   "<script src=\"academic-reset.js\"></script>\n<script src=\"academic-reset-client.js\"></script>\n",
   ""
  ],
  [
   "let store = { sessions: [], grades: {}, meta: {}, ...(typeof IEAcademicResetClient!=='undefined'&&IEAcademicResetClient.epoch()?{academicEpoch:IEAcademicResetClient.epoch()}:{}) };\n",
   "let store = { sessions: [], grades: {}, meta: {} };\n"
  ],
  [
   "  async function list(scope){const epoch=root.IEAcademicResetClient?.epoch();return (await run('readonly',s=>s.getAll())).filter(r=>(!epoch||r.academicEpoch===epoch)&&r.scope===scope&&now()-r.created<ttl).sort((a,b)=>b.created-a.created);}\n",
   "  async function list(scope){return (await run('readonly',s=>s.getAll())).filter(r=>r.scope===scope&&now()-r.created<ttl).sort((a,b)=>b.created-a.created);}\n"
  ],
  [
   "   const epoch=root.IEAcademicResetClient?.epoch();if(epoch)record.academicEpoch=epoch;\n",
   ""
  ]
 ],
 "sw.js": [
  [
   "const CACHE = CACHE_PREFIX + 'v26';\n",
   "const CACHE = CACHE_PREFIX + 'v25';\n"
  ],
  [
   "  './academic-reset.js', './academic-reset-client.js',\n",
   ""
  ]
 ],
 "admin.html": [
  [
   "<script src=\"academic-reset.js\"></script>\n<script src=\"academic-reset-client.js\"></script>\n",
   ""
  ]
 ],
 "primaria.html": [
  [
   "<script src=\"academic-reset.js\"></script>\n<script src=\"academic-reset-client.js\"></script>\n",
   ""
  ],
  [
   "            ...(typeof IEAcademicResetClient!=='undefined'&&IEAcademicResetClient.epoch()?{academicEpoch:IEAcademicResetClient.epoch()}:{}),\n",
   ""
  ]
 ],
 "secundaria.html": [
  ["<button onclick=\"bajarNube()\" class=\"bg-sky-500/90 hover:bg-sky-500 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition\" title=\"Descargar datos con sesión válida, incluso en bimestres cerrados (solo lectura)\">",
   "<button onclick=\"bajarNube()\" class=\"bg-sky-500/90 hover:bg-sky-500 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition\" title=\"Cargar desde Google Sheets\">"],
  ["async function bajarNube() {\n            if (!(window.__IE_SES && window.__IE_SES.token)) {\n                mostrarToast('Inicia sesión para consultar los datos de la nube.', 'error');\n                return;\n            }\n",
   "async function bajarNube() {\n"],
  ["mostrarToast('Descargadas ' + n + ' área(s) de la nube para consulta' + (periodoSoloLecturaActual() ? ' · Bimestre cerrado, solo lectura' : ''), 'success');",
   "mostrarToast('Combinadas ' + n + ' área(s). N° est.: ' + (totRes.aplicados || 0) + ' de nube, ' + (totRes.respetados || 0) + ' locales más recientes', 'success');"],
  [
   "<script src=\"academic-reset.js\"></script>\n<script src=\"academic-reset-client.js\"></script>\n",
   ""
  ],
  [
   "            ...(typeof IEAcademicResetClient!=='undefined'&&IEAcademicResetClient.epoch()?{academicEpoch:IEAcademicResetClient.epoch()}:{}),\n",
   ""
  ]
 ],
 "transversales.html": [
  [
   "<script src=\"academic-reset.js\"></script>\n<script src=\"academic-reset-client.js\"></script>\n",
   ""
  ]
 ],
 "transversales-client.js": [
  [
   "    if(transport&&global.IEAcademicResetClient){const epoch=await global.IEAcademicResetClient.accept(await transport.transversales({action:'academicstate',token}));if(token!==global.IEStudents.validToken())throw new Error('La sesión cambió.');if(epoch)body.academicEpoch=epoch;}\n",
   ""
  ]
 ],
 "registro-drafts.js": [
  [
   "  async function list(scope){const epoch=root.IEAcademicResetClient?.epoch();return (await run('readonly',s=>s.getAll())).filter(r=>(!epoch||r.academicEpoch===epoch)&&r.scope===scope&&now()-r.created<ttl).sort((a,b)=>b.created-a.created);}\n",
   "  async function list(scope){return (await run('readonly',s=>s.getAll())).filter(r=>r.scope===scope&&now()-r.created<ttl).sort((a,b)=>b.created-a.created);}\n"
  ],
  [
   "   const epoch=root.IEAcademicResetClient?.epoch();if(epoch)record.academicEpoch=epoch;\n",
   ""
  ]
 ]
};
module.exports=(file,source)=>{let s=require('./registro-continuity-stage1-boundary.cjs')(file,require('./notas2-prefetch-boundary.cjs')(file,source));for(const [next,previous]of edits[file]||[]){if(s.includes(next)){assert.equal(s.split(next).length,2,'Reset hook occurs once');s=s.replace(next,previous);}}return s;};
