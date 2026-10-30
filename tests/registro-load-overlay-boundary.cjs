'use strict';
// Exact full-screen read-overlay deltas (PR118) for historical comparisons only. Runtime tests use raw sources.
const assert=require('node:assert/strict'),edits={
 "registro-notas2-ui.js": [
  [
   "/* Mandatory-read overlay: same visual language as the save dialog, independent state, presentation only. */\n(function(root){\n 'use strict';\n let box,title,info,key='';\n function mount(){\n  if(box||typeof document.createElement!=='function'||!document.head||!document.body)return;\n  const style=document.createElement('style');style.textContent='#academicLoadOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:#0f172a70}#academicLoadOverlay[hidden]{display:none}#academicLoadOverlay [data-load-card]{box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;border:1px solid #e2e8f0;border-radius:20px;padding:28px 24px;background:#fff;color:#0f172a;text-align:center;box-shadow:0 18px 60px #0f172a26}#academicLoadOverlay [data-load-icon]{display:block;box-sizing:border-box;width:44px;height:44px;margin:0 auto 18px;border:4px solid #dbeafe;border-top-color:#0284c7;border-radius:50%;animation:academicSaveSpin 1s linear infinite}#academicLoadOverlay h2{font-size:18px;line-height:1.5;font-weight:700;margin:0;overflow-wrap:anywhere}#academicLoadOverlay p{font-size:14px;line-height:1.5;color:#475569;margin:12px 0 0}@keyframes academicSaveSpin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#academicLoadOverlay [data-load-icon]{animation-duration:2.5s}}@media print{#academicLoadOverlay{display:none!important}}';document.head.appendChild(style);\n  const node=document.createElement('div');node.id='academicLoadOverlay';node.hidden=true;node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');\n  const card=document.createElement('div');card.dataset.loadCard='';const icon=document.createElement('span');icon.dataset.loadIcon='';icon.setAttribute('aria-hidden','true');\n  title=document.createElement('h2');title.id='academicLoadMessage';info=document.createElement('p');info.id='academicLoadDetail';\n  card.append(icon,title,info);node.appendChild(card);document.body.appendChild(node);box=node;\n }\n function show(message,detail){\n  try{mount();}catch(_){return false;}if(!box)return false;const next=message+'\\n'+detail;\n  if(key!==next){title.textContent=message;info.textContent=detail;key=next;}box.hidden=false;box.setAttribute('aria-busy','true');return true;\n }\n function hide(){if(box&&!box.hidden){box.hidden=true;box.setAttribute('aria-busy','false');}key='';}\n root.IEAcademicLoadFeedback={show,hide,available:()=>{try{mount();}catch(_){}return !!box;},visible:()=>!!box&&!box.hidden};\n})(window);\n/* Integración Notas 2.0",
   "/* Integración Notas 2.0"
  ],
  [
   "  const operation=access||load?(pane==='asistencia'?'asistencia':'calificaciones'):roster?'padron':null,fullscreen=!!pending&&!backgroundRoster&&!!operation&&!!root.IEAcademicLoadFeedback?.available?.();\n  return {state:sinPadron?'SIN_PADRON':null,pending:!!pending,blocking:!!pending&&!backgroundRoster,backgroundRoster,detail,missing,pane,error,operation,fullscreen,context:aula+' · Bimestre '+c.bim};",
   "  return {state:sinPadron?'SIN_PADRON':null,pending:!!pending,blocking:!!pending&&!backgroundRoster,backgroundRoster,detail,missing,pane,error};"
  ],
  [
   "   if(grid){draw(grid,active&&!state.fullscreen?state.detail:'',active&&state.blocking&&!state.fullscreen);",
   "   if(grid){draw(grid,active?state.detail:'',active&&state.blocking);"
  ],
  [
   "notice.hidden=!active||!state.blocking||state.fullscreen||(state.missing&&!!grid);",
   "notice.hidden=!active||!state.blocking||(state.missing&&!!grid);"
  ],
  [
   "  if(state.fullscreen)root.IEAcademicLoadFeedback.show(({padron:'Cargando padrón...',calificaciones:'Cargando calificaciones...',asistencia:'Cargando asistencia...'})[state.operation],state.context);else root.IEAcademicLoadFeedback?.hide();\n",
   ""
  ]
 ],
 "registro.html": [
  [
   "pintarCargaRegistro(document.getElementById(id)||box,state?.fullscreen?'':state?.detail||'Recuperando información del servidor',!!state?.blocking&&!state?.fullscreen);",
   "pintarCargaRegistro(document.getElementById(id)||box,state?.detail||'Recuperando información del servidor',!!state?.blocking);"
  ]
 ]
};
module.exports=(file,source)=>{let s=require('./promedios-comparativo-align-boundary.cjs')(file,source.replace(/\r\n/g,'\n'));for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique read overlay delta');s=s.replace(current,previous);}return s;};
module.exports.edits=edits;
