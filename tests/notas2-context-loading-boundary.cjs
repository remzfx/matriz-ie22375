'use strict';
// Exact approved loading-presentation deltas; functional tests always use raw production sources.
const assert=require('node:assert/strict'),edits=[
 [
  "              <div class=\"fin-header-aux\">\n                <div class=\"fin-mode-info\" id=\"finModeInfo\"></div>\n                <span id=\"finContextStatus\" role=\"status\" class=\"text-xs text-slate-500\" hidden>Verificando datos…</span>\n                <div id=\"finResumen\"></div>\n              </div>\n",
  "              <div class=\"fin-header-aux\">\n                <div class=\"fin-mode-info\" id=\"finModeInfo\"></div>\n                <div id=\"finResumen\"></div>\n              </div>\n"
 ],
 [
  "  const res = document.getElementById('finResumen');\n  const modeInfo = document.getElementById('finModeInfo');\n  // A new context has no confirmed selection yet; never render provisional academic columns.\n  if(typeof IERegistroNotas2UI!=='undefined'&&!registroHistoricoProyectando&&IERegistroNotas2UI.current()?.status()?.panels.promedios.version==null){\n    box.setAttribute?.('aria-busy','true');box.innerHTML='<p id=\"finContextLoading\" role=\"status\" class=\"text-sm text-slate-500 p-3\">Verificando datos…</p>';\n    res.innerHTML='';modeInfo.innerHTML='';const stats=document.getElementById('finEstadisticas');if(stats)stats.innerHTML='';return;\n  }\n  box.setAttribute?.('aria-busy','false');\n  const bloqueado = bimCerradoDocente();\n  const alumnos = estudiantes();\n",
  "  const res = document.getElementById('finResumen');\n  const modeInfo = document.getElementById('finModeInfo');\n  const bloqueado = bimCerradoDocente();\n  const alumnos = estudiantes();\n"
 ]
];
// Exact approved toast-duration delta; no broad function stripping.
edits.push(...[["let store = { sessions: [], grades: {}, meta: {}, ...(typeof IEAcademicResetClient!=='undefined'&&IEAcademicResetClient.epoch()?{academicEpoch:IEAcademicResetClient.epoch()}:{}) };\n\nfunction toast(msg, duration = 1600) {\n  const el = document.getElementById('toast');\n  el.textContent = msg;\n  el.classList.remove('hidden');\n  clearTimeout(toast.timer);\n  toast.timer = setTimeout(() => el.classList.add('hidden'), duration);\n}\n\n", "let store = { sessions: [], grades: {}, meta: {}, ...(typeof IEAcademicResetClient!=='undefined'&&IEAcademicResetClient.epoch()?{academicEpoch:IEAcademicResetClient.epoch()}:{}) };\n\nfunction toast(msg) {\n  const el = document.getElementById('toast');\n  el.textContent = msg;\n  el.classList.remove('hidden');\n  setTimeout(() => el.classList.add('hidden'), 1600);\n}\n\n"]]);
module.exports=source=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits)if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique context-loading hook');s=s.replace(current,previous);}return s;};
