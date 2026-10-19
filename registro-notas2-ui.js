/* Integración Notas 2.0: una sesión volátil por ámbito; nunca crea borradores persistentes. */
(function(root){
 'use strict';
 const model=root.IERegistroNotas2;
 if(!model||!root.IERegistroConnection){registroDependenciaFallida();return;}
 const clients=new Map();let memoryLoaded=false,protectedDisk=null,painting=false,timer=null,connection,activeKey='',lastEditable=false;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const currentPanel=()=>document.getElementById('panelAsistencia')?.classList.contains('on')?'asistencia':document.getElementById('panelCalificar')?.classList.contains('on')?'calificar':'promedios';
 const binding=()=>cloudClaveReg()+'|'+((getLoginSession()||{}).token||'');
 const tutor=()=>document.getElementById('registroTutorPanel')?.hidden===false;
 function authorized(){const s=getLoginSession()||{};return !!(s.token&&['admin','docente'].includes(s.role)&&typeof IEStudents!=='undefined'&&IEStudents.validToken()===s.token&&padronBimestre===ctxBase().bim&&tokenPadron===s.token&&areaActual&&areas().includes(areaActual)&&registroLocal.matches());}
 function readonly(){return esVistaAdmin()||!bimestreHabilitado(ctxBase().bim)||registroConsultaHistorica();}
 function capture(){const p=sliceRegistroArea(),prefix=prefijoReg();p.calificarEstado=Object.fromEntries(Object.entries(store.calificarEstado||{}).filter(([k])=>k.startsWith(prefix)));return p;}
 function apply(p){
  const prefix=prefijoReg(),c=ctxBase();
  for(const [field,value]of Object.entries(p)){
   if(model.fields.asistencia.includes(field))continue;
   if(field==='sessions'){store.sessions=(store.sessions||[]).filter(s=>!IERegistroGrading.sessionsFor([s],c,s.comp).length).concat(copy(value));continue;}
   store[field]=store[field]||{};for(const k of Object.keys(store[field]))if(k.startsWith(prefix))delete store[field][k];Object.assign(store[field],copy(value));
  }
  if(model.fields.asistencia.some(f=>p[f]))mergeRegistroPayload(Object.fromEntries(model.fields.asistencia.map(f=>[f,p[f]||{}])));
  if(p.sessions){sesionActiva=null;notas={};capsElegidas=[];}
 }
 async function request(body,options){
  const c=ctxBase(),session=getLoginSession()||{},response=await fetch(CLOUD_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',signal:options.signal,body:JSON.stringify({...body,token:session.token,nivel:c.nivel,bimestre:c.bim,grado:c.grado,seccion:c.seccion,area:c.area,docente:session.nombre||''})});
  let data;try{data=JSON.parse(await response.text());}catch(_){const e=Error('Respuesta del servidor inválida. Edición pausada.');e.code='INVALID_RESPONSE';throw e;}
  if(!response.ok){const e=Error('No se pudo confirmar el servidor (HTTP '+response.status+').');e.code=response.status===401||response.status===403?'SESSION':'HTTP';throw e;}return data;
 }
 function get(){
  if(!authorized()||tutor())return null;const key=binding();
  if(!clients.has(key))clients.set(key,model.create({key:cloudClaveReg(),binding,authorized,readonly,capture,apply,request,hasExisting:name=>(name==='calificar'?['grades']:name==='promedios'?['finales','concComp']:['asistencia']).some(f=>Object.keys(capture()[f]||{}).length),confirm:async info=>confirm('Bajar Nube reemplazará los cambios sin guardar de '+info.panels.join(', ')+'. Última confirmación: '+Object.values(info.at).filter(Boolean).map(x=>new Date(x).toLocaleString('es-PE')).join(', ')+'. ¿Continuar?'),changed:()=>{if(key===binding())paint();},error:e=>{if(key!==binding())return;toast(e.message);if(['SESSION','DENIED'].includes(e.code))retirarVerificacionNube((getLoginSession()||{}).token,ctxBase().bim,{code:e.code});}}));
  return clients.get(key);
 }
 function collect(){const pane=currentPanel();if(!canEdit(pane))return false;const selector=pane==='calificar'?'.cal-nota':pane==='promedios'?'#finLista .fin-nota':'.asis-input';if(pane!=='asistencia'&&Array.from(document.querySelectorAll(selector)).some(el=>!el.readOnly&&el.value!==''&&(!Number.isFinite(Number(el.value))||Number(el.value)<0||Number(el.value)>20))){toast('Corrige las notas inválidas antes de guardar.');return false;}recolectarPantalla(pane);return true;}
 function persist(){
  if(protectedDisk===null){const raw=registroLocal.read();try{protectedDisk=raw?JSON.parse(raw):{};}catch(_){throw Error('No se puede interpretar el almacenamiento anterior; no se sobrescribió.');}}
  const next=copy(protectedDisk);
  for(const f of model.fields.asistencia){const value=store[f];if(value!==undefined&&(Object.keys(value).length||Object.prototype.hasOwnProperty.call(protectedDisk,f)))next[f]=copy(value);}
  if(JSON.stringify(next)!==JSON.stringify(protectedDisk)){registroLocal.write(JSON.stringify(next));protectedDisk=next;}

 }
 function officialOnly(){if(registroHistoricoProyectando)return !!metaRegistro()?.notas2;const state=get()?.status();return !!state&&state.panels.promedios.version!==null&&(!state.legacy||state.processed);}
 function worked(comp,panel=currentPanel(),c=ctxBase()){
  const key=[c.nivel,c.bim,c.grado,c.seccion,c.area,comp].join('||');const map=panel==='calificar'?(store.calificarEstado||store.competenciasEstado):store.competenciasEstado;return !map||map[key]?.trabajada!==false;
 }
 function canEdit(panel=currentPanel()){if(tutor())return !!connection?.canEdit();return !!connection?.canEdit()&&!!get()?.canEdit(panel);}
 function render(){if(tutor()){if(connection?.canEdit())tutorRegistroController?.refresh?.();else document.querySelectorAll('#transRows input,#transRows textarea,#transRows select,#transRows button').forEach(el=>el.disabled=true);return;}if(painting)return;painting=true;try{renderSesiones();renderStudents();if(currentPanel()==='promedios')renderFinales();if(document.getElementById('panelAvance')?.classList.contains('on'))renderAvance();if(currentPanel()==='asistencia')renderAsistencia();sincronizarEdicionRegistro();}finally{painting=false;}}
 function paint(){
  const s=get()?.status(),pane=currentPanel(),label=document.getElementById('registroSaveState');if(label&&s){label.textContent=['calificar','promedios'].map(n=>{const p=s.panels[n];return (n==='calificar'?'Calificar':'Promedios')+': '+(p.pending?'Cambios sin guardar':p.at?'Guardado '+new Date(p.at).toLocaleString('es-PE'):'Sin guardado confirmado');}).join(' · ')+(s.legacy?' · Consulta histórica: Procesar y Guardar Promedios para iniciar Notas 2.0.':'');}
  if(label&&typeof IERegistroTransversales!=='undefined'&&IERegistroTransversales.current()?.dirty)label.textContent+=' · Aportes transversales pendientes.';
  const save=document.querySelector('#registroRecoveryControls [onclick="IERegistroNotas2UI.save()"]'),process=document.querySelector('#registroRecoveryControls [onclick="IERegistroNotas2UI.process()"]'),down=document.querySelector('#registroRecoveryControls [onclick="IERegistroNotas2UI.download()"]');
  if(save){save.disabled=!canEdit(pane);save.querySelector('span').textContent=pane==='asistencia'?'Guardar local':'Guardar';}
  if(process){process.hidden=pane==='asistencia'||tutor();process.disabled=!connection?.canEdit()||!s||s.busy||s.readonly||readonly();}
  if(down)down.disabled=!authorized()||!!s?.busy||tutor();
  const edit=canEdit();if(edit!==lastEditable&&!painting){lastEditable=edit;render();}
 }
 async function save(){
  const client=get(),pane=currentPanel();if(!client||!canEdit(pane))return false;
  if(pane==='asistencia'){guardarAsistencia();persist();toast('Asistencia guardada localmente.');return true;}
  if(!collect())return false;if(pane==='calificar')saveCapsElegidas();
  const adapter=typeof IERegistroTransversales==='undefined'?null:IERegistroTransversales;if(adapter){try{adapter.capture();}catch(e){toast(e.message);return false;}}
  const ok=await client.save(pane);let transOK=true;if(ok&&adapter?.current()?.dirty){try{transOK=await adapter.save();}catch(_){transOK=false;}}if(ok)toast('Guardado confirmado por el servidor: '+(pane==='calificar'?'Calificar':'Promedios')+'.'+(!transOK?' Aportes transversales pendientes; conserva esta pestaña.':''));paint();return ok&&transOK;
 }
 async function uploadAttendance(){const client=get();if(!client||!canEdit('asistencia'))return false;guardarAsistencia();const ok=await client.save('asistencia');if(ok)toast('Asistencia confirmada por el servidor.');return ok;}
 async function download(){const client=get();if(!client)return false;if(canEdit())collect();const ok=await client.load({manual:true,panel:currentPanel()});if(ok){render();toast('Se restauró la última versión confirmada.');}return ok;}
 async function process(){const client=get();if(!client||!connection?.canEdit()||readonly())return false;if(!confirm('Procesar a Promedios reemplazará las notas anteriores, incluidos los directos, de las competencias trabajadas en esta área y bimestre. Sin evidencias quedarán vacías. Las conclusiones se conservan. No se guardará en nube. ¿Continuar?'))return false;
  const ok=client.process({context:ctxBase(),competencies:competencias(),students:estudiantes().map(studentKey),now:Date.now,calculate:(p,comp,id)=>IERegistroGrading.calculated(IERegistroGrading.sessionsFor(p.sessions,ctxBase(),comp).map(s=>leerNota(p.grades,[s.nivel,s.bim,s.grado,s.seccion,s.area,s.comp,s.capacidad,s.fecha,id].join('||'))),IERegistroEvaluacion)});if(ok){showPanel('fin');render();toast('Promedios procesados. Pendientes de Guardar.');}return ok;
 }
 function setWorked(comp,active){if(!canEdit()||!competencias().includes(comp))return false;const key=prefijoReg()+comp;if(worked(comp,'calificar')===active)return false;store.calificarEstado=store.calificarEstado||{};store.calificarEstado[key]={trabajada:active,ts:Date.now()};paint();return true;}
 function refresh(force=false){if(painting)return;const key=binding();if(key!==activeKey){activeKey=key;connection?.invalidate();}clearTimeout(timer);timer=setTimeout(()=>connection?.check(false,force),30);paint();}
 connection=IERegistroConnection.create({binding:()=>binding()+(tutor()?'|tutor|'+document.getElementById('transAula').value+'|'+document.getElementById('transBim').value:''),authorized:()=>tutor()?!!getLoginSession()?.token:authorized(),readonly,retain:()=>{if(canEdit())collect();},online:()=>navigator.onLine!==false,visible:()=>document.visibilityState!=='hidden',changed:value=>{const box=document.getElementById('registroConnectionStatus'),text=document.getElementById('registroConnectionText');if(box)box.dataset.state=value.state;if(text)text.textContent=({connected:'Conectado — notas verificadas.',pending:'Conectado — cambios sin guardar.',checking:'Verificando conexión…',offline:'Conexión perdida. Estamos intentando reconectar…',server:'Servidor no disponible — edición pausada.',session:'Sesión inválida — vuelve a iniciar sesión.',readonly:'Bimestre cerrado — solo lectura.',review:'Conflicto pendiente — consulta la nube antes de guardar.'})[value.state];if(!['connected','pending'].includes(value.state))get()?.pause();paint();},verify:async({valid})=>{
  if(tutor())return tutorRegistroController?.verifyConnection?await tutorRegistroController.verifyConnection({valid,review:false}):{ok:false};
  if(!await sincronizarPeriodosNube(true)||!valid())return {ok:false};const c=get();if(!c)return {ok:false,code:'SESSION'};const initialized=c.status().panels.calificar.version!==null,ok=await c.load({verify:initialized});if(!valid())return {ok:false};const s=c.status();if(ok)render();return {ok,code:s.readonly?'CLOSED':s.state==='session'?'SESSION':undefined,conflict:s.state==='conflict',pending:false};
 }});
 const api={save,download,process,collect,worked,setWorked,canEdit,officialOnly,persist,refresh,keepMemory(){if(memoryLoaded)return true;memoryLoaded=true;return false;},current:get,panel:currentPanel};root.IERegistroNotas2UI=api;
 // Existing tutor controls call this API only to verify their connection, never to write academic notes.
 root.IERegistroRecovery={refresh,automatic:()=>connection.check(),resolve:()=>connection.check(true,true),local:save,upload:()=>currentPanel()==='asistencia'?uploadAttendance():save(),recover:download};
 document.addEventListener('DOMContentLoaded',()=>{
  const review=document.getElementById('registroConnectionReview');if(review){review.textContent='Verificar conexión';review.onclick=()=>connection.check(true,true);}
  for(const id of ['registroConflictOffer','registroUndoOffer','registroDraftOffer','registroLegacyReview','registroConnectionBackups']){const el=document.getElementById(id);if(el)el.hidden=true;}
  const retry=document.getElementById('registroRetryOffer');if(retry){retry.hidden=false;retry.onclick=()=>connection.check(true,true);}
  const block=e=>{if(canEdit())return;const write=e.target?.closest?.('.cal-nota,.fin-nota,.academic-conclusion,.asis-input,[data-val],[data-av],[data-adel],[data-delfecha],[data-an],[data-final-toggle],.fin-bulk-actions');if(write){e.preventDefault();e.stopImmediatePropagation();}};
  for(const type of ['beforeinput','click','change'])document.addEventListener(type,block,true);
  document.addEventListener('input',()=>{paint();});document.addEventListener('change',()=>refresh());document.addEventListener('click',()=>paint());document.addEventListener('ie22375:registro-ready',()=>refresh());
  window.addEventListener('offline',()=>connection.pause('offline'));window.addEventListener('online',()=>refresh(true));window.addEventListener('focus',()=>refresh());window.addEventListener('storage',e=>{if(e.key==='ie22375_session_v1')connection.pause('session');});
  const footer=document.getElementById('registroAcademicFooter');if(footer&&typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{const main=document.querySelector('main');if(main)main.style.paddingBottom=(footer.hidden?0:footer.getBoundingClientRect().height+12)+'px';}).observe(footer);
  refresh();
 });
})(window);
