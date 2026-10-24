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
module.exports=source=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits)if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique context-loading hook');s=s.replace(current,previous);}return s;};
