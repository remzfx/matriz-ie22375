'use strict';
// Exact presentation deltas for historical goldens. Runtime tests exercise raw sources.
const assert=require('node:assert/strict'),edits={
  "registro.html": [
    [
      "\n  /* Read feedback: presentation only, no progress estimates or timing controller. */\n  .registro-read-wait {display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:112px;max-width:100%;padding:16px 12px;border:1px solid #e0f2fe;border-radius:12px;background:#f8fcff;color:#0f172a;text-align:center;font:inherit;box-sizing:border-box;}\n  .registro-read-spinner {display:block;width:26px;height:26px;flex:0 0 auto;box-sizing:border-box;border:3px solid #dbeafe;border-top-color:#0284c7;border-radius:50%;animation:registroReadSpin .85s linear infinite;}\n  .registro-read-copy {display:flex;flex-direction:column;gap:3px;min-width:0;max-width:100%;overflow-wrap:anywhere;}\n  .registro-read-copy strong {font-size:14px;font-weight:700;line-height:1.4;}\n  .registro-read-copy [data-read-detail] {font-size:12px;color:#64748b;line-height:1.45;}\n  .registro-read-wait.compact {min-height:0;flex-direction:row;gap:8px;padding:7px 10px;margin:4px 0;}\n  .registro-read-wait.compact .registro-read-spinner {width:18px;height:18px;border-width:2px;}\n  .registro-read-wait.compact strong {font-size:12px;}\n  @keyframes registroReadSpin {to{transform:rotate(360deg)}}\n  @media(prefers-reduced-motion:reduce){.registro-read-spinner{animation:none;}}\n  @media print{.registro-read-wait{display:none!important;}}\n",
      ""
    ],
    [
      "                <div id=\"finContextStatus\" hidden></div>\n",
      "                <span id=\"finContextStatus\" role=\"status\" class=\"text-xs text-slate-500\" hidden>Verificando datos…</span>\n"
    ],
    [
      "        <div id=\"comparativoBimStatus\" hidden></div>\n",
      ""
    ],
    [
      "        <div id=\"asisContextStatus\" hidden></div>\n",
      ""
    ],
    [
      "      <div id=\"calContextStatus\" hidden></div>\n",
      ""
    ],
    [
      "  if(typeof IERegistroNotas2UI!=='undefined'&&!registroHistoricoProyectando&&IERegistroNotas2UI.current()?.status()?.panels.calificar.version==null){renderEsperaRegistro(box,'calContextLoading');return;}\n  box.setAttribute?.('aria-busy','false');\n",
      ""
    ],
    [
      "function indicadorCargaRegistro(detalle,compacto=false){\n return '<div data-registro-read-wait class=\"registro-read-wait'+(compacto?' compact':'')+'\"><span class=\"registro-read-spinner\" aria-hidden=\"true\"></span><div class=\"registro-read-copy\"><strong>Espere, sincronizando información…</strong><span data-read-detail>'+escapeRegistro(detalle)+'</span></div></div>';\n}\nfunction pintarCargaRegistro(box,detalle,pendiente,compacto=false){\n if(!box)return;box.setAttribute?.('role','status');box.setAttribute?.('aria-live','polite');box.setAttribute?.('aria-atomic','true');box.setAttribute?.('aria-busy',String(!!pendiente));\n if(!pendiente){box.textContent=detalle||'';return;}\n const text=box.querySelector?.('[data-read-detail]');if(text)text.textContent=detalle;else box.innerHTML=indicadorCargaRegistro(detalle,compacto);\n}\nfunction renderEsperaRegistro(box,id){\n if(!box)return;const state=typeof IERegistroNotas2UI==='undefined'?null:IERegistroNotas2UI.readStatus?.();box.innerHTML='<div id=\"'+id+'\"></div>';\n pintarCargaRegistro(document.getElementById(id)||box,state?.detail||'Recuperando información del servidor',!!state?.pending);\n box.setAttribute?.('aria-busy',String(!!state?.pending));\n}\n",
      ""
    ],
    [
      "   const box=document.getElementById(ids[nombre]);if(box&&!(box.dataset?.historicalReadSequence===String(registroHistoricoSecuencia)&&box.dataset.historicalReadContext===cloudClaveReg()))box.innerHTML='';return false;\n",
      "   const box=document.getElementById(ids[nombre]);if(box)box.innerHTML='';return false;\n"
    ],
    [
      " const grids=['stuList','finLista','asisLista'].map(id=>document.getElementById(id)).filter(Boolean);\n if(!historicoLecturaPreparada(c,token))for(const box of grids){if(!box.dataset)box.dataset={};box.dataset.historicalReadSequence=String(seq);box.dataset.historicalReadContext=key;pintarCargaRegistro(box,'Recuperando información del servidor',true);}\n",
      ""
    ],
    [
      " }catch(e){if(actual()){registroHistoricoActual=null;estadoPadron('Consulta histórica no disponible: '+e.message,true);for(const box of grids)pintarCargaRegistro(box,'No se pudo recuperar la información. Consulte el diagnóstico.',false);}return false;}finally{if(seq===registroHistoricoSecuencia&&key===cloudClaveReg())for(const box of grids){if(box.dataset?.historicalReadSequence===String(seq)){delete box.dataset.historicalReadSequence;delete box.dataset.historicalReadContext;box.setAttribute?.('aria-busy','false');if(box.querySelector?.('[data-registro-read-wait]'))pintarCargaRegistro(box,'',false);}}}\n",
      " }catch(e){if(actual()){registroHistoricoActual=null;estadoPadron('Consulta histórica no disponible: '+e.message,true);}return false;}\n"
    ],
    [
      " const status=document.getElementById('comparativoBimStatus');if(status){status.hidden=true;pintarCargaRegistro(status,'',false);}\n",
      ""
    ],
    [
      " const status=document.getElementById('comparativoBimStatus');\n if(Array.from({length:numero-1},(_,i)=>({...c,bim:['I','II','III'][i]})).some(p=>!historicoLecturaPreparada(p,token))){if(status){status.dataset.readSequence=String(seq);status.dataset.readContext=clave;status.hidden=false;pintarCargaRegistro(status,'Preparando comparativo bimestral',true,true);}renderFinales();}\n",
      " if(Array.from({length:numero-1},(_,i)=>({...c,bim:['I','II','III'][i]})).some(p=>!historicoLecturaPreparada(p,token)))renderFinales();\n"
    ],
    [
      " }catch(e){if(actual()){comparativoBimDatos={};toast('Comparativo histórico no disponible: '+e.message+' No se modificaron notas.');renderComparativoBim();}}finally{if(status?.dataset.readSequence===String(seq)){status.hidden=true;pintarCargaRegistro(status,'',false);}}\n",
      " }catch(e){if(actual()){comparativoBimDatos={};toast('Comparativo histórico no disponible: '+e.message+' No se modificaron notas.');renderComparativoBim();}}\n"
    ],
    [
      "  if(typeof comparativoBimContexto!=='undefined'&&comparativoBimContexto&&(comparativoBimContexto!==cloudClaveReg()||comparativoBimToken!==IEStudents.validToken()||!comparativoVigente())){comparativoBimActivo=false;comparativoBimDatos={};comparativoBimContexto='';comparativoBimSecuencia++;const status=document.getElementById('comparativoBimStatus');if(status){status.hidden=true;pintarCargaRegistro(status,'',false);}}\n",
      "  if(typeof comparativoBimContexto!=='undefined'&&comparativoBimContexto&&(comparativoBimContexto!==cloudClaveReg()||comparativoBimToken!==IEStudents.validToken()||!comparativoVigente())){comparativoBimActivo=false;comparativoBimDatos={};comparativoBimContexto='';comparativoBimSecuencia++;}\n"
    ],
    [
      "    renderEsperaRegistro(box,'finContextLoading');\n",
      "    box.setAttribute?.('aria-busy','true');box.innerHTML='<p id=\"finContextLoading\" role=\"status\" class=\"text-sm text-slate-500 p-3\">Verificando datos…</p>';\n"
    ],
    [
      "  if(typeof IERegistroNotas2UI!=='undefined'&&!registroHistoricoProyectando&&IERegistroNotas2UI.current()?.status()?.panels.asistencia.version==null){renderEsperaRegistro(document.getElementById('asisLista'),'asisContextLoading');return;}\n  document.getElementById('asisLista')?.setAttribute?.('aria-busy','false');\n",
      ""
    ]
  ],
  "registro-notas2-ui.js": [
    [
      " let criticalSaveContext=null,scopeAuthorization=null,accessRead=null;\n",
      " let criticalSaveContext=null,scopeAuthorization=null;\n"
    ],
    [
      " // Presentation observes existing promises/states; never starts a read or grants access.\n function readStatus(){\n  const pane=currentPanel(),s=get()?.status(),conn=connection?.snapshot?.(),c=ctxBase(),aula=c.grado+'.º '+c.seccion;\n  const error=['session','server','offline','review'].find(v=>conn?.state===v||s?.state===v||(v==='review'&&s?.state==='conflict'));\n  const missing=['calificar','promedios','asistencia'].includes(pane)&&s?.panels[pane]?.version==null;\n  const access=accessRead?.key===binding()&&!connection?.canEdit(),load=s?.state==='checking'&&!!s.busy,roster=typeof cargandoEstudiantes!=='undefined'&&cargandoEstudiantes;\n  const prepared=load&&missing&&prefetch?preparation().state==='prepared':false;\n  const pending=pane!=='resumen'&&!tutor()&&!error&&!save.pending&&!uploadAttendance.pending&&(access||load&&!prepared||roster&&missing);\n  const detail=error?({session:'Sesión inválida — vuelve a iniciar sesión.',server:'Servidor no disponible — edición pausada.',offline:'Conexión perdida. Estamos intentando reconectar…',review:'Conflicto de versiones — consulta la nube antes de guardar.'})[error]:access?'Verificando acceso a '+aula+' · Bimestre '+c.bim:download.pending&&load?'Recuperando información del servidor':load?'Cargando '+(pane==='asistencia'?'asistencia':'calificaciones')+' de '+aula:roster?'Recuperando información del servidor':'Información pendiente de verificación. Consulte la nubecita.';\n  return {pending:!!pending,detail,missing,pane,error};\n }\n function paintReadFeedback(){\n  const state=readStatus(),slots={calificar:['calContextLoading','calContextStatus'],promedios:['finContextLoading','finContextStatus'],asistencia:['asisContextLoading','asisContextStatus']};\n  const draw=(box,detail,pending,compact=false)=>{if(typeof pintarCargaRegistro==='function')pintarCargaRegistro(box,detail,pending,compact);else if(box)box.textContent=detail;};\n  for(const [pane,[gridId,noticeId]]of Object.entries(slots)){\n   const active=pane===state.pane,grid=document.getElementById(gridId),notice=document.getElementById(noticeId);\n   if(grid){draw(grid,active?state.detail:'',active&&state.pending);grid.parentElement?.setAttribute?.('aria-busy',String(active&&state.pending));}\n   if(notice){notice.hidden=!active||!state.pending||state.missing;if(!notice.hidden)draw(notice,state.detail,true,true);else draw(notice,'',false,true);}\n  }\n  const comparison=document.getElementById('comparativoBimStatus');if(comparison&&!comparison.hidden&&(state.error||comparison.dataset.readContext!==cloudClaveReg())){comparison.hidden=true;draw(comparison,'',false,true);}\n }\n",
      ""
    ],
    [
      "  paintReadFeedback();\n",
      "  const loading=document.getElementById('finContextLoading'),verification=document.getElementById('finContextStatus');\n  if(loading)loading.textContent=effectiveState==='checking'?(prepared?.reason!=='authorization'&&prepared?.state==='preparing'?'Aula en preparación — recuperando datos autorizados…':'Verificando acceso a '+ctxBase().grado+'° '+ctxBase().seccion+' · Bim '+ctxBase().bim+'… Las calificaciones se mostrarán al confirmar la autorización.'):effectiveMsg;\n  if(verification)verification.hidden=pane!=='promedios'||!!loading||effectiveState!=='checking';\n"
    ],
    [
      "  const operation={key:binding()};if(!lease){accessRead=operation;paintReadFeedback();}\n  let periods,permission;try{[periods,permission]=lease?[true,{ok:true}]:await Promise.all([sincronizarPeriodosNube(true),verifyPermission(valid)]);}finally{if(accessRead===operation)accessRead=null;paintReadFeedback();}\n  if(permission.code==='SESSION')return permission;if(!valid())return {ok:false};if(!permission.ok)return permission;if(!periods)return {ok:false};\n",
      "  const [periods,permission]=lease?[true,{ok:true}]:await Promise.all([sincronizarPeriodosNube(true),verifyPermission(valid)]);if(permission.code==='SESSION')return permission;if(!valid())return {ok:false};if(!permission.ok)return permission;if(!periods)return {ok:false};\n"
    ],
    [
      " const api={readStatus,confirmedVersions,preparation:root.IERegistroNotas2Prefetch?preparation:undefined,saving:()=>!!(save.pending||uploadAttendance.pending),savingContext:()=>criticalSaveContext?copy(criticalSaveContext):null,prefetchStatus:()=>prefetch?{...prefetch.stats(),rosterRequests,rosterUnavailable:[...rosterUnavailable].map(([bimestre,code])=>({bimestre,code})),rosterContexts:contextRosters.size,rosterRetainedBytes:rosterBytes}:null,save,download,process,collect,screenPending,status:viewStatus,worked,setWorked,canEdit,officialOnly,persist,refresh,pendingPanels,hasPending,reconcileHistorical,activePending:()=>{const pane=currentPanel();return pane==='resumen'?false:pane==='calificar'?(!!get()?.status()?.panels.calificar?.pending||(typeof IERegistroTransversales!=='undefined'&&!!IERegistroTransversales.current()?.dirty)):!!get()?.status()?.panels[pane]?.pending;},keepMemory(){if(memoryLoaded)return true;memoryLoaded=true;return false;},current:get,panel:currentPanel};root.IERegistroNotas2UI=api;\n",
      " const api={confirmedVersions,preparation:root.IERegistroNotas2Prefetch?preparation:undefined,saving:()=>!!(save.pending||uploadAttendance.pending),savingContext:()=>criticalSaveContext?copy(criticalSaveContext):null,prefetchStatus:()=>prefetch?{...prefetch.stats(),rosterRequests,rosterUnavailable:[...rosterUnavailable].map(([bimestre,code])=>({bimestre,code})),rosterContexts:contextRosters.size,rosterRetainedBytes:rosterBytes}:null,save,download,process,collect,screenPending,status:viewStatus,worked,setWorked,canEdit,officialOnly,persist,refresh,pendingPanels,hasPending,reconcileHistorical,activePending:()=>{const pane=currentPanel();return pane==='resumen'?false:pane==='calificar'?(!!get()?.status()?.panels.calificar?.pending||(typeof IERegistroTransversales!=='undefined'&&!!IERegistroTransversales.current()?.dirty)):!!get()?.status()?.panels[pane]?.pending;},keepMemory(){if(memoryLoaded)return true;memoryLoaded=true;return false;},current:get,panel:currentPanel};root.IERegistroNotas2UI=api;\n"
    ]
  ]
};
module.exports=(file,source)=>{source=require('./roster-persistence-boundary.cjs')(file,source);let s=require('./comparativo-parallel-boundary.cjs')(file,source);for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique read-feedback presentation delta');s=s.replace(current,previous);}return s;};
