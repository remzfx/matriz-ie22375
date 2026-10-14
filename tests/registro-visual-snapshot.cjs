// Preserve historical snapshots outside the explicit read-only visual additions.
const {execFileSync}=require('node:child_process');
const base=execFileSync('git',['show','8439fb47259ad8667842f3f9f5a6bd35ae2e5520:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function fn(s,n){const i=s.indexOf('function '+n+'(');return s.slice(i,s.indexOf('\n}',i)+2);}
module.exports=s=>{
 s=require('./registro-context-layout-snapshot.cjs')(s);
 s=require('./registro-print-snapshot.cjs')(s);
 s=require('./registro-toggle-snapshot.cjs')(s);
 s=s.replace(/\r\n/g,'\n').replace(/\/\* Visual Registro 3\/6\/7\/10:[\s\S]*?\/\* Fin Visual Registro 3\/6\/7\/10\. \*\/\n/,'');
 const header=x=>x.slice(x.indexOf('        <header class="fin-header">'),x.indexOf('        </header>',x.indexOf('        <header class="fin-header">'))+17);
 s=s.replace(header(s),header(base)).replace('        <div id="finEstadisticas"></div>\n','');
 s=s.replace("  const estadisticas = document.getElementById('finEstadisticas');\n  if(estadisticas && typeof estadisticasCompetenciasHTML==='function') estadisticas.innerHTML=estadisticasCompetenciasHTML(comps,alumnos);\n",'');
 s=s.replace(" if(typeof estadisticasCompetenciasHTML==='function')box.innerHTML+=estadisticasCompetenciasHTML(comps,estudiantes());\n",'');
 s=s.replace(' aria-pressed="\'+(L===v)+\'"','');
 s=s.replace("  IEConclusionSuggestions.bindCompact(box,(el,text)=>{const changed=setConclusionAcademica(decodeURIComponent(el.dataset.comp),decodeURIComponent(el.dataset.id),text);if(changed && estadisticas && typeof estadisticasCompetenciasHTML==='function')estadisticas.innerHTML=estadisticasCompetenciasHTML(comps,alumnos);return changed;});", "  IEConclusionSuggestions.bindCompact(box,(el,text)=>setConclusionAcademica(decodeURIComponent(el.dataset.comp),decodeURIComponent(el.dataset.id),text));");
 for(const n of ['datosEstadisticasCompetencias','estadisticasCompetenciasHTML'])if(s.includes('function '+n+'('))s=s.replace(fn(s,n)+'\n','');
 return s;
};
