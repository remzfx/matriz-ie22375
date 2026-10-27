/* One reusable, presentation-only save dialog. No transport or storage access. */
(function(root){
 'use strict';
 let dialog,icon,message,detail,closeButton,previousFocus,sequence=0,pending=false,panelLabel='Registro';
 function mount(){
  if(dialog||typeof document.createElement!=='function'||!document.head||!document.body)return;
  const style=document.createElement('style');style.textContent='#academicSaveDialog{box-sizing:border-box;position:fixed;inset:0;margin:auto;width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;border:1px solid #e2e8f0;border-radius:20px;padding:28px 24px;background:#fff;color:#0f172a;font:inherit;text-align:center;box-shadow:0 18px 60px #0f172a26}#academicSaveDialog::backdrop{background:#0f172a70}#academicSaveDialog [data-save-icon]{display:block;box-sizing:border-box;width:44px;height:44px;margin:0 auto 18px;border:4px solid #dbeafe;border-top-color:#0284c7;border-radius:50%;animation:academicSaveSpin 1s linear infinite}#academicSaveDialog[data-state="success"] [data-save-icon]{border:0;animation:none;color:#15803d;background:#f0fdf4;font-size:34px;line-height:44px}#academicSaveDialog[data-state="unconfirmed"] [data-save-icon]{border:0;animation:none;color:#a16207;background:#fffbeb;font-size:30px;line-height:44px}#academicSaveDialog h2{font-size:18px;line-height:1.5;font-weight:700;margin:0;overflow-wrap:anywhere;outline:none}#academicSaveDialog p{font-size:14px;line-height:1.5;color:#475569;margin:12px 0}#academicSaveDialog button{font:inherit;min-height:44px;margin-top:8px;padding:10px 24px;border:0;border-radius:10px;background:#075985;color:white;cursor:pointer}#academicSaveDialog button:focus-visible{outline:3px solid #38bdf8;outline-offset:3px}@keyframes academicSaveSpin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#academicSaveDialog [data-save-icon]{animation-duration:2.5s}}';document.head.appendChild(style);
  dialog=document.createElement('dialog');dialog.id='academicSaveDialog';dialog.setAttribute('aria-labelledby','academicSaveMessage');dialog.setAttribute('aria-describedby','academicSaveDetail');
  icon=document.createElement('span');icon.dataset.saveIcon='';icon.setAttribute('aria-hidden','true');
  message=document.createElement('h2');message.id='academicSaveMessage';message.tabIndex=-1;
  detail=document.createElement('p');detail.id='academicSaveDetail';detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');
  closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='Continuar';closeButton.onclick=()=>{if(!pending)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});document.addEventListener('keydown',e=>{if(dialog.open&&e.key==='Tab'){e.preventDefault();(pending?message:closeButton).focus();}},true);
  dialog.addEventListener('close',()=>{if(previousFocus?.isConnected&&!previousFocus.disabled)previousFocus.focus();});
  dialog.append(icon,message,detail,closeButton);document.body.appendChild(dialog);
 }
 function begin(panel){
  if(pending)return null;panelLabel=({calificar:'Calificar',promedios:'Promedios',asistencia:'Asistencia'})[panel]||'Registro';pending=true;const id=++sequence;try{mount();}catch(e){pending=false;throw e;}if(!dialog)return id;
  previousFocus=document.activeElement;dialog.dataset.state='pending';dialog.setAttribute('aria-busy','true');icon.textContent='';message.textContent='Guardando datos... Espere, no cierre ni cambie de grado';detail.textContent=panelLabel+': estamos guardando los datos en la nube.';closeButton.hidden=true;
  if(!dialog.open)dialog.showModal();message.focus();return id;
 }
 function finish(id,confirmed){
  if(id!==sequence||!pending)return;pending=false;if(!dialog)return;
  dialog.dataset.state=confirmed?'success':'unconfirmed';dialog.setAttribute('aria-busy','false');icon.textContent=confirmed?'✓':'!';message.textContent=confirmed?'¡Guardado confirmado en la nube!':'Guardado no confirmado. Sus cambios locales están protegidos';detail.textContent=panelLabel+': '+(confirmed?'Los datos se guardaron correctamente en la nube.':'No se reenviará automáticamente. Consulte el diagnóstico antes de reintentar.');closeButton.hidden=false;closeButton.focus();
 }
 root.IEAcademicSaveFeedback={begin,finish,focus:()=>{if(dialog?.open)(pending?message:closeButton).focus();},busy:()=>pending};
})(window);
/* Integración Notas 2.0: una sesión volátil por ámbito; nunca crea borradores persistentes. */
(function(root){
 'use strict';
 const model=root.IERegistroNotas2;
 if(!model||!root.IERegistroConnection){registroDependenciaFallida();return;}
 let criticalSaveContext=null;
 const clients=new Map();let memoryLoaded=false,protectedDisk=null,painting=false,timer=null,connection,activeKey='',renderedPaused=false,lastView='';
 const pausedControls=new WeakMap();
 const copy=x=>JSON.parse(JSON.stringify(x));
 const currentPanel=()=>document.getElementById('panelAsistencia')?.classList.contains('on')?'asistencia':document.getElementById('panelCalificar')?.classList.contains('on')?'calificar':document.getElementById('panelAvance')?.classList.contains('on')?'resumen':'promedios';
 const binding=()=>{const s=getLoginSession()||{};return [cloudClaveReg(),s.token||'',s.user||'',s.role||''].join('|');};
 const owner=()=>{const s=getLoginSession()||{};return [s.token||'',s.user||'',s.role||''].join('|');};
 const receiptGuards=new Map(),contextRosters=new Map(),rosterAttempts=new Set(),rosterUnavailable=new Map();let prefetch=null,rosterActor='',rosterFlight=null,rosterRequests=0,rosterBytes=0,candidateStamp='',candidateList=[],candidateKeys=new Set();
 const tutor=()=>document.getElementById('registroTutorPanel')?.hidden===false;
 function authorized(){const s=getLoginSession()||{};return !!(s.token&&['admin','docente'].includes(s.role)&&typeof IEStudents!=='undefined'&&IEStudents.validToken()===s.token&&padronBimestre===ctxBase().bim&&tokenPadron===s.token&&areaActual&&areas().includes(areaActual)&&registroLocal.matches());}
 function readonly(){return esVistaAdmin()||!bimestreHabilitado(ctxBase().bim)||registroConsultaHistorica();}
 function capture(){const p=sliceRegistroArea(),prefix=prefijoReg();p.calificarEstado=Object.fromEntries(Object.entries(store.calificarEstado||{}).filter(([k])=>k.startsWith(prefix)));if(p.asisFechas)p.asisFechas=Object.fromEntries(Object.entries(p.asisFechas).filter(([,v])=>Array.isArray(v)&&v.length>0));if(p.capsSel)p.capsSel=Object.fromEntries(Object.entries(p.capsSel).filter(([,v])=>Array.isArray(v)&&v.length>0));return p;}
 function apply(p){
  const prefix=prefijoReg(),c=ctxBase();
  for(const [field,value]of Object.entries(p)){
   if(model.fields.asistencia.includes(field))continue;
   if(field==='sessions'){store.sessions=(store.sessions||[]).filter(s=>!IERegistroGrading.sessionsFor([s],c,s.comp).length).concat(copy(value));continue;}
   store[field]=store[field]||{};for(const k of Object.keys(store[field]))if(k.startsWith(prefix))delete store[field][k];Object.assign(store[field],copy(value));
  }
  if(model.fields.asistencia.some(f=>p[f]))mergeRegistroPayload(Object.fromEntries(model.fields.asistencia.map(f=>[f,p[f]||{}])));
  if(p.sessions){
   const date=document.getElementById('inpFecha')?.value||'',previous=sesionActiva;
   const sessions=IERegistroGrading.sessionsOn(store.sessions,c,date),selected=sessions.find(s=>s.comp===previous?.comp&&s.capacidad===previous?.capacidad)||sessions[0];
   sesionActiva=selected?{fecha:date,unidad:selected.unidad??'',comp:selected.comp,capacidad:selected.capacidad}:null;
   notas={};loadCapsElegidas();
  }
 }
 function captureContext(c){
  const prefix=[c.nivel,c.bim,c.grado,c.seccion,c.area].join('||'),aula=[c.nivel,c.bim,c.grado,c.seccion].join('||'),p={};
  for(const [name,list]of Object.entries(model.fields))for(const field of list){
   if(field==='sessions')p[field]=(store.sessions||[]).filter(s=>[s.nivel,s.bim,s.grado,s.seccion,s.area].join('||')===prefix);
   else p[field]=Object.fromEntries(Object.entries(store[field]||{}).filter(([k,v])=>(name==='asistencia'?(k===aula||k.startsWith(aula+'||')):k.startsWith(prefix+'||'))&&(!Array.isArray(v)||v.length)));
  }return p;
 }
 function academicContext(c){const p=captureContext(c);return Object.fromEntries([...model.fields.calificar,...model.fields.promedios].map(f=>[f,p[f]]));}
 function prefetchOwner(){const s=getLoginSession()||{};return JSON.stringify([owner(),s.permisosVersion,CLOUD_API_URL,root.IEAcademicResetClient?.epoch?.()||null,s.nivel,s.grados,s.areas,s.aulas,s.asignaciones]);}
 function syncRosters(){const actor=prefetchOwner();if(actor!==rosterActor){rosterActor=actor;contextRosters.clear();rosterAttempts.clear();rosterUnavailable.clear();rosterFlight=null;rosterRequests=0;rosterBytes=0;candidateStamp='';}return actor;}
 function rememberRoster(bim,base){
  const session=getLoginSession()||{},rows=base?.[session.nivel]?.estudiantes;
  if(!Array.isArray(rows))return;
  const version=String(base.version||model.signature(rows.map(r=>[r.idSiagie,r.codigoEstudiante,r.grado,r.seccion])));
  if(contextRosters.get(bim)?.version===version)return;
  const next={version,rows:copy(rows)},size=JSON.stringify(next).length*2,proposed=new Map(contextRosters);proposed.set(bim,next);const nextBytes=JSON.stringify([...proposed.values()]).length*2;
  if(size>1024*1024||nextBytes>4*1024*1024||prefetch&&nextBytes-rosterBytes>prefetch.availableBytes())return;
  contextRosters.set(bim,next);rosterUnavailable.delete(bim);rosterBytes=nextBytes;candidateStamp='';
 }
 function candidates(){
  syncRosters();if(!root.IERegistroNotas2Prefetch||!root.IERegistroAcademico||!authorized()||tutor())return [];
  const c=ctxBase(),periods=loadPeriodosAdmin()?.bimestres||{};
  if(padronBimestre===c.bim&&typeof padronVerificadoServidor!=='undefined'&&padronVerificadoServidor)rememberRoster(c.bim,bdEstudiantes);
  const rosters=Object.fromEntries([...contextRosters].filter(([bim])=>periods[bim]==='abierto').map(([bim,r])=>[bim,r.rows]));
  const stamp=JSON.stringify([rosterActor,periods,[...contextRosters].map(([bim,r])=>[bim,r.version])]);
  if(stamp!==candidateStamp){candidateStamp=stamp;candidateList=IERegistroNotas2Prefetch.enumerate(getLoginSession(),rosters,IERegistroAcademico.catalog);candidateKeys=new Set(candidateList.map(IERegistroNotas2Prefetch.key));}
  return candidateList;
 }
 function backgroundEligible(){return !!connection?.canEdit()&&connection.snapshot().state!=='checking'&&get()?.status().state==='ready'&&!get()?.status().busy&&!save.pending&&!download.pending&&!uploadAttendance.pending&&!tutor()&&navigator.onLine!==false&&document.visibilityState!=='hidden';}
 async function prepareRosters(){
  const actor=syncRosters();if(rosterFlight||typeof IEStudents.readRoster!=='function')return;
  const missing=['I','II','III','IV'].filter(b=>bimestreHabilitado(b)&&!contextRosters.has(b)&&!rosterAttempts.has(b));if(!missing.length)return;
  prefetch.hold('roster');const task={};rosterFlight=task;
  task.promise=(async()=>{try{for(const bim of missing){
   if(actor!==prefetchOwner()||!backgroundEligible())break;
   rosterAttempts.add(bim);rosterRequests++;
   try{const base=await IEStudents.readRoster(bim);
    if(actor!==prefetchOwner())return;
    if(base.offline||base.bimestre!==bim||base.padronInicializado!==true)continue;
    rememberRoster(bim,base);if(!contextRosters.has(bim))rosterUnavailable.set(bim,'MEMORY');
   }catch(e){rosterUnavailable.set(bim,e.code||'SERVER');if(actor!==prefetchOwner())return;if(['SESSION','DENIED'].includes(e.code)){prefetch.pause();connection?.pause('session');break;}}
  }}finally{if(rosterFlight===task){rosterFlight=null;prefetch.release('roster');if(actor===prefetchOwner()&&backgroundEligible())prefetch.start(ctxBase(),candidates());}}})();
  return task.promise;
 }
 async function requestFor(c,session,body,options,background=false){
  if(owner()!==[session.token||'',session.user||'',session.role||''].join('|')){const e=Error('La sesión cambió antes de la lectura.');e.code='SESSION';throw e;}
  const actor=owner(),init={method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',signal:options.signal,body:JSON.stringify({...body,token:session.token,nivel:c.nivel,bimestre:c.bim,grado:c.grado,seccion:c.seccion,area:c.area,docente:session.nombre||''})};
  const response=await (background?root.IEAcademicResetClient.readOnly(CLOUD_API_URL,init):fetch(CLOUD_API_URL,init));
  if(owner()!==actor){const e=Error('La sesión cambió.');e.code='SESSION';throw e;}
  let data;try{data=JSON.parse(await response.text());}catch(_){const e=Error('Respuesta del servidor inválida. Edición pausada.');e.code='INVALID_RESPONSE';throw e;}
  if(!response.ok){const e=Error('No se pudo confirmar el servidor (HTTP '+response.status+').');e.code=response.status===401||response.status===403?'SESSION':'HTTP';throw e;}return data;
 }
 async function request(body,options){
  const c=Object.freeze({...ctxBase()}),session={...getLoginSession()},key=binding();receiptGuards.delete(key);
  if(body.action==='loadnotas2'&&prefetch){
   prefetch.select(c);
   if(currentPanel()!=='asistencia'&&clients.get(key)?.status().panels.calificar.version==null){const reserved=await prefetch.acquire(c);if(reserved){receiptGuards.set(key,{signature:reserved.signature});return reserved.response;}}
  }
  return requestFor(c,session,body,options);
 }
 function startPrefetch(){
  if(!prefetch||!backgroundEligible()||get()?.status().legacy||!root.IEAcademicResetClient?.readOnly)return;
  prefetch.resume();const list=candidates();void prepareRosters();prefetch.start(ctxBase(),list);
 }
 if(root.IERegistroNotas2Prefetch)prefetch=IERegistroNotas2Prefetch.create({
  identity:prefetchOwner,overheadBytes:()=>rosterBytes,canRun:backgroundEligible,contextIdentity:c=>contextRosters.get(c.bim)?.version||'',isKnown:c=>clients.get([IERegistroNotas2Prefetch.key(c),getLoginSession()?.token||'',getLoginSession()?.user||'',getLoginSession()?.role||''].join('|'))?.status().panels.calificar.version!=null,fingerprint:model.signature,
  allowed:c=>{candidates();return authorized()&&candidateKeys.has(IERegistroNotas2Prefetch.key(c));},
  localSignature:c=>model.signature(academicContext(c)),hasLocal:c=>Object.values(academicContext(c)).some(v=>Object.keys(v).length),
  read:(c,signal)=>requestFor(c,{...getLoginSession()},{action:'loadnotas2'},{signal},true),
  validate:(r,c)=>{model.validateRead(r,IERegistroNotas2Prefetch.key(c));const roster=(contextRosters.get(c.bim)?.rows||[]).filter(a=>Number(a.grado)===Number(c.grado)&&a.seccion===c.seccion);IERegistroAcademico.validate(copy(r.payload),c);const resolved=IEAcademicIdentity.project(r.payload,roster,c,IERegistroAcademico.catalog[c.nivel][c.area]);if(resolved.conflicts.length||resolved.unresolved.length)throw Error('Identidades pendientes de revisión.');return r;},
  denied:e=>connection?.pause(e.code==='ACADEMIC_RESET'?'server':'session')
 });
 async function verifyPermission(valid){
  const key=binding(),actor=owner(),session=getLoginSession()||{},controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch(CLOUD_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',signal:controller.signal,body:JSON.stringify({action:'academicstate',token:session.token})});
   const data=JSON.parse(await response.text());if(owner()!==actor)return {ok:false};
   if(response.status===401||response.status===403||['SESSION','DENIED'].includes(data?.code))return {ok:false,code:'SESSION'};
   if(!valid()||binding()!==key)return {ok:false};
   if(!response.ok||data?.ok!==true||data.academicReset!==1||!(data.epoch===null||typeof data.epoch==='string'&&/^[a-f0-9]{32}$/.test(data.epoch)))return {ok:false};
   const localEpoch=root.IEAcademicResetClient?.epoch?.()||null;
   if(data.epoch&&data.phase!=='complete')return {ok:false,code:'ACADEMIC_RESET'};
   const initialized=clients.get(key)?.status()?.panels.calificar.version!=null;
   // First load still passes through the existing reset-aware transport; a live context never crosses generations silently.
   if(data.epoch!==localEpoch&&(initialized||typeof root.IEAcademicResetClient?.ensure!=='function'))return {ok:false,code:'ACADEMIC_RESET'};
   return {ok:true};
  }catch(_){return {ok:false};}finally{clearTimeout(timeout);}
 }
 function screenPending(panel=currentPanel()){
  const selector=panel==='calificar'?'.cal-nota':panel==='promedios'?'#finLista .fin-nota,#finLista .academic-conclusion':'';if(!selector)return false;
  return Array.from(document.querySelectorAll(selector)).some(el=>{
   const scope=el.dataset?.registroContexto||el.closest?.('#finLista')?.dataset?.registroContexto;if(scope&&scope!==cloudClaveReg())return false;
   if(typeof el.defaultValue!=='string'||!el.validity?.badInput&&el.value===el.defaultValue)return false;
   if(el.validity?.badInput)return true;
   try{
    const data=panel==='calificar'?el.dataset:(el.closest?.('[data-fin][data-comp]')?.dataset||el.dataset),comp=decodeURIComponent(data.comp||''),id=decodeURIComponent(data.nom||data.fin||data.id||'');
    if(el.matches?.('.academic-conclusion'))return el.value.trim()!==concCompAlumno(comp,id);
    const key=panel==='calificar'?capKeyHoy(comp,decodeURIComponent(data.cap||''),id):finalKey(comp,id),record=leerNota(panel==='calificar'?store.grades:store.finales,key);
    return el.value===''?!!record:!record||record.origen==='letra'||!Number.isFinite(Number(el.value))||Math.round(Number(el.value))!==Number(record.nota20);
   }catch(_){return true;}
  });
 }
 function get(){
  if(!authorized()||tutor())return null;const key=binding();if(!activeKey)activeKey=key;
  if(!clients.has(key))clients.set(key,model.create({key:cloudClaveReg(),binding,authorized,readonly,capture,apply,request,deferReadPanel:name=>name==='asistencia'&&receiptGuards.has(key),beforeApply:()=>{const expected=receiptGuards.get(key);receiptGuards.delete(key);if(expected!==undefined&&(expected.signature!==model.signature(academicContext(ctxBase()))||screenPending('calificar')||screenPending('promedios'))){const e=Error('El borrador cambió. La precarga no reemplazó datos locales.');e.code='PREFETCH_LOCAL';throw e;}},hasExisting:name=>(name==='calificar'?['grades']:name==='promedios'?['finales','concComp']:['asistencia']).some(f=>Object.keys(capture()[f]||{}).length),confirm:async info=>confirm('Bajar Nube reemplazará los cambios sin guardar de '+info.panels.join(', ')+'. Última confirmación: '+Object.values(info.at).filter(Boolean).map(x=>new Date(x).toLocaleString('es-PE')).join(', ')+'. ¿Continuar?'),changed:()=>{if(key===binding())paint();},error:e=>{receiptGuards.delete(key);if(key!==binding())return;toast(e.message);if(['SESSION','DENIED'].includes(e.code))retirarVerificacionNube((getLoginSession()||{}).token,ctxBase().bim,{code:e.code});}}));
  return clients.get(key);
 }
 function collect(silent=false){const pane=currentPanel();if(!canEdit(pane))return false;const selector=pane==='calificar'?'.cal-nota':pane==='promedios'?'#finLista .fin-nota':'.asis-input';if(pane!=='asistencia'&&Array.from(document.querySelectorAll(selector)).some(el=>!el.readOnly&&el.value!==''&&(!Number.isFinite(Number(el.value))||Number(el.value)<0||Number(el.value)>20))){if(!silent)toast('Corrige las notas inválidas antes de guardar.');return false;}recolectarPantalla(pane);return true;}
 function persist(){
  if(protectedDisk===null){const raw=registroLocal.read();try{protectedDisk=raw?JSON.parse(raw):{};}catch(_){throw Error('No se puede interpretar el almacenamiento anterior; no se sobrescribió.');}}
  const next=copy(protectedDisk);
  for(const f of model.fields.asistencia){const value=store[f];if(value!==undefined&&(Object.keys(value).length||Object.prototype.hasOwnProperty.call(protectedDisk,f)))next[f]=copy(value);}
  if(JSON.stringify(next)!==JSON.stringify(protectedDisk)){registroLocal.write(JSON.stringify(next));protectedDisk=next;}

 }
 function officialOnly(){if(registroHistoricoProyectando)return metaRegistro()?.notas2?.adopted===true;const state=get()?.status();return !!state&&state.panels.promedios.version!==null&&(!state.legacy||state.processed);}
 function worked(comp,panel=currentPanel(),c=ctxBase()){
  const key=[c.nivel,c.bim,c.grado,c.seccion,c.area,comp].join('||');const map=panel==='calificar'?(store.calificarEstado||store.competenciasEstado):store.competenciasEstado;return !map||map[key]?.trabajada!==false;
 }
 function canEdit(panel=currentPanel()){if(panel==='resumen')return false;if(tutor())return !!connection?.canEdit();const c=get();if(c?.status()?.state==='conflict')return false;return !!connection?.canEdit()&&!!c?.canEdit(panel);}
 function viewStamp(s){return JSON.stringify([binding(),currentPanel(),s?.legacy,s?.processed,Object.values(s?.panels||{}).map(p=>p.version)]);}
 function render(){lastView=viewStamp(get()?.status());renderedPaused=!canEdit();if(tutor()){if(connection?.canEdit())tutorRegistroController?.refresh?.();else document.querySelectorAll('#transRows input,#transRows textarea,#transRows select,#transRows button').forEach(el=>el.disabled=true);return;}if(painting)return;painting=true;try{renderSesiones();renderStudents();if(currentPanel()==='promedios')renderFinales();if(document.getElementById('panelAvance')?.classList.contains('on'))renderAvance();if(currentPanel()==='asistencia')renderAsistencia();sincronizarEdicionRegistro();}finally{painting=false;paint();}}
 function paint(){
  const s=get()?.status(),pane=currentPanel(),label=document.getElementById('registroSaveState');if(label&&s){const p=s.panels[pane];label.textContent=p?({calificar:'Calificar',promedios:'Promedios',asistencia:'Asistencia'})[pane]+': '+(p.pending?'Cambios sin guardar':p.at?'Guardado '+new Date(p.at).toLocaleString('es-PE'):'Sin guardado confirmado'):'Resumen — consulta de solo lectura.';if(pane==='promedios'&&s.legacy)label.textContent+=' · Consulta histórica: Procesar y Guardar Promedios para iniciar Notas 2.0.';if(pane==='promedios'&&s.historicalConflicts?.length)label.textContent+=' · '+s.historicalConflicts.length+' notas históricas pendientes de decisión explícita.';}
  if(label&&typeof IERegistroTransversales!=='undefined'&&IERegistroTransversales.current()?.dirty)label.textContent+=' · Aportes transversales pendientes.';
  const connState=connection?.snapshot?.()?.state||'checking';
  const paneNames={calificar:'Calificar',promedios:'Promedios',asistencia:'Asistencia',resumen:'Resumen'};
  const activePending=pane==='resumen'?false:screenPending(pane)||(pane==='calificar'?(!!s?.panels.calificar?.pending||(typeof IERegistroTransversales!=='undefined'&&!!IERegistroTransversales.current()?.dirty)):!!s?.panels[pane]?.pending);
  const otherPending=[];
  if(s){for(const [name,p] of Object.entries(s.panels)){if(name===pane)continue;const isDirty=p.pending||screenPending(name)||(name==='calificar'&&typeof IERegistroTransversales!=='undefined'&&!!IERegistroTransversales.current()?.dirty);if(isDirty)otherPending.push(paneNames[name]||name);}}
  const isConflict=s?.state==='conflict'||connState==='review';
  const rosterRetry=document.getElementById('retryRoster'),rosterError=rosterRetry?.hidden===false;
  const errorState=['session','server','offline'].find(state=>connState===state||s?.state===state)||(rosterError?'server':null);
  const isReadonly=connState==='readonly'||(s?.panels.promedios.version!=null&&s.readonly)||readonly();
  let effectiveState='connected',effectiveMsg='Conectado — notas verificadas.';
  if(isConflict){effectiveState='review';effectiveMsg='Conflicto de versiones — consulta la nube antes de guardar.';}
  else if(errorState){effectiveState=errorState;const statusMap={offline:'Conexión perdida. Estamos intentando reconectar…',server:'Servidor no disponible — edición pausada.',session:'Sesión inválida — vuelve a iniciar sesión.'};effectiveMsg=statusMap[errorState];}
  else if(isReadonly){effectiveState='readonly';effectiveMsg=esVistaAdmin()?'Vista Administrador — solo lectura.':'Bimestre cerrado — solo lectura.';}
  else if(connState==='checking'||s?.state==='checking'||pane==='asistencia'&&s?.panels.asistencia.version===null){effectiveState='checking';effectiveMsg='Verificando conexión…';}
  else if(activePending){effectiveState='pending';effectiveMsg='Conectado — cambios sin guardar.';}
  else{effectiveState='connected';effectiveMsg=otherPending.length>0?'Conectado — '+(paneNames[pane]||'Notas')+' al día. ('+otherPending.join(', ')+' con cambios sin guardar).':'Conectado — notas verificadas.';}
  updateSyncIndicator(effectiveState,effectiveMsg,otherPending);
  const loading=document.getElementById('finContextLoading'),verification=document.getElementById('finContextStatus');
  if(loading)loading.textContent=effectiveState==='checking'?'Verificando acceso a '+ctxBase().grado+'° '+ctxBase().seccion+' · Bim '+ctxBase().bim+'… Las calificaciones se mostrarán al confirmar la autorización.':effectiveMsg;
  if(verification)verification.hidden=pane!=='promedios'||!!loading||effectiveState!=='checking';
  const save=document.querySelector('#registroRecoveryControls [onclick="IERegistroNotas2UI.save()"]'),process=document.querySelector('#registroRecoveryControls [onclick="IERegistroNotas2UI.process()"]'),down=document.querySelector('#registroRecoveryControls [onclick="IERegistroNotas2UI.download()"]');
  const isResumen=pane==='resumen';if(save){save.disabled=isResumen||!canEdit(pane)||isConflict;save.hidden=isResumen;save.querySelector('span').textContent=pane==='asistencia'?'Guardar local':'Guardar';}
  if(process){process.hidden=tutor()||(pane!=='calificar'&&pane!=='asistencia');process.querySelector('span').textContent=pane==='asistencia'?'Subir Nube':'Procesar a Promedios';process.disabled=!connection?.canEdit()||!s||s.busy||s.readonly||readonly()||isConflict||pane==='asistencia'&&!canEdit('asistencia');}
  if(down){down.disabled=isResumen||!authorized()||!!s?.busy||tutor();down.hidden=isResumen;}
  const retryBtn=document.getElementById('registroRetryOffer');if(retryBtn)retryBtn.hidden=true; // Recovery is available from the cloud diagnostic.
  const histConflicts=s?.historicalConflicts||[];const conflictBtn=document.getElementById('registroConflictOffer');
  if(conflictBtn){if(histConflicts.length>0&&pane==='promedios'){conflictBtn.hidden=false;conflictBtn.style.display='inline-flex';const txt=conflictBtn.querySelector('span');if(txt)txt.textContent='Revisar notas históricas ('+histConflicts.length+')';conflictBtn.onclick=()=>reconcileHistorical();}else if(!isConflict){conflictBtn.hidden=true;conflictBtn.style.display='none';}}
  const edit=canEdit(),key=binding();
  document.querySelectorAll('#stuList button,#stuList input,#finLista button,#finLista input,#finLista textarea,#finLista select,#asisLista button').forEach(el=>{if(!edit){if(!pausedControls.has(el))pausedControls.set(el,{key,disabled:el.disabled,readOnly:el.readOnly});if(el.tagName==='BUTTON'||el.type==='checkbox'||el.tagName==='SELECT')el.disabled=true;else el.readOnly=true;}else{const prior=pausedControls.get(el);if(prior?.key===key){el.disabled=prior.disabled;el.readOnly=prior.readOnly;pausedControls.delete(el);}}});
  const finBox=document.getElementById('finLista'),contextChanged=pane==='promedios'&&!registroConsultaHistorica()&&!!finBox&&finBox.dataset?.registroContexto!==cloudClaveReg();if((lastView!==viewStamp(s)||contextChanged||edit&&renderedPaused)&&!painting)render();
 }
 async function save(){
  const client=get(),pane=currentPanel();if(pane==='resumen'||!client||!canEdit(pane))return false;
  if(pane==='asistencia'){guardarAsistencia();persist();toast('Asistencia guardada localmente.');return true;}
  if(save.pending)return false;save.pending=true;criticalSaveContext=copy(ctxBase());prefetch?.hold('save');let notice,confirmed=false;const key=binding();try{
  notice=root.IEAcademicSaveFeedback.begin(pane);
  if(!await connection.check(false,true)||key!==binding()||pane!==currentPanel()||client!==get()||!canEdit(pane))return false;
  if(!collect())return false;if(pane==='calificar')saveCapsElegidas();root.IEAcademicSaveFeedback.focus();
  if(client.status().legacy&&pane==='promedios'&&!client.pending(pane)&&!client.status().processed){toast('No hay cambios pendientes para guardar en Promedios.');return false;}
  const adapter=typeof IERegistroTransversales==='undefined'?null:IERegistroTransversales;if(adapter){try{adapter.capture();}catch(e){toast(e.message);return false;}}
  const ok=await client.save(pane);let transOK=true;
  const sameOperation=()=>key===binding()&&pane===currentPanel()&&client===get();
  if(ok&&sameOperation()&&adapter?.current()?.dirty){try{transOK=await adapter.save();}catch(_){transOK=false;}}
  confirmed=ok&&transOK&&sameOperation()&&!client.pending(pane);
  if(confirmed){if(pane==='promedios')toast('Promedios guardados exitosamente',3000);else toast('Guardado confirmado por el servidor: Calificar.');}
  else if(ok)toast(!transOK?'Aportes transversales pendientes; conserva esta pestaña.':'Guardado no confirmado. Sus cambios locales están protegidos');
  paint();return confirmed;
  }catch(_){toast('Guardado no confirmado. Sus cambios locales están protegidos');return false;}finally{save.pending=false;criticalSaveContext=null;prefetch?.release('save');root.IEAcademicSaveFeedback.finish(notice,confirmed);paint();}
 }
 async function uploadAttendance(){const client=get(),key=binding();if(!client||!canEdit('asistencia')||uploadAttendance.pending)return false;uploadAttendance.pending=true;prefetch?.hold('attendance-save');try{if(!await connection.check(false,true)||key!==binding()||client!==get()||!canEdit('asistencia'))return false;guardarAsistencia();const ok=await client.save('asistencia');if(ok)toast('Asistencia confirmada por el servidor.');return ok;}finally{uploadAttendance.pending=false;prefetch?.release('attendance-save');}}
 async function download(){const client=get(),pane=currentPanel();if(pane==='resumen'||!client||download.pending)return false;download.pending=true;prefetch?.hold('recovery');try{if(canEdit())collect();const ok=await client.load({manual:true,panel:pane});if(ok){render();toast('Se restauró la última versión confirmada.');}return ok;}finally{download.pending=false;prefetch?.release('recovery');if(prefetch&&backgroundEligible())startPrefetch();}}
 async function process(){if(currentPanel()==='asistencia')return uploadAttendance();const client=get();if(!client||!connection?.canEdit()||readonly())return false;if(!confirm('Procesar a Promedios reemplazará las notas anteriores, incluidos los directos, de las competencias trabajadas en esta área y bimestre. Sin evidencias quedarán vacías. Las conclusiones se conservan. No se guardará en nube. ¿Continuar?'))return false;if(!connection.canEdit())return false;if(canEdit())collect();
  const ok=client.process({context:ctxBase(),competencies:competencias(),students:estudiantes().map(studentKey),now:Date.now,calculate:(p,comp,id)=>IERegistroGrading.calculated(IERegistroGrading.sessionsFor(p.sessions,ctxBase(),comp).map(s=>leerNota(p.grades,[s.nivel,s.bim,s.grado,s.seccion,s.area,s.comp,s.capacidad,s.fecha,id].join('||'))),IERegistroEvaluacion)});if(ok){showPanel('fin');render();toast('Promedios procesados. Pendientes de Guardar.');}return ok;
 }
 function setWorked(comp,active){const pane=currentPanel();if(!['calificar','promedios'].includes(pane)||!canEdit(pane)||!competencias().includes(comp)||typeof active!=='boolean')return false;const key=prefijoReg()+comp,field=pane==='calificar'?'calificarEstado':'competenciasEstado';if(worked(comp,pane)===active)return false;store[field]=store[field]||{};store[field][key]={trabajada:active,ts:Date.now()};if(pane==='promedios')renderFinales();paint();return true;}
 function refresh(force=false){if(painting)return;const key=binding();if(activeKey&&key!==activeKey){activeKey=key;lastConnectionState=null;prefetch?.select(ctxBase());if(connection?.select)connection.select();else connection?.invalidate();}else if(!activeKey){activeKey=key;}const attendanceMissing=currentPanel()==='asistencia'&&get()?.status().panels.asistencia.version===null;if(attendanceMissing)prefetch?.select(ctxBase());clearTimeout(timer);timer=setTimeout(()=>connection?.check(false,force||attendanceMissing),30);paint();}
 let lastConnectionState=null;
 function ensureSyncIndicator(){
  if(typeof document==='undefined'||!document.createElement)return null;
  let ind=document.getElementById('hdrSyncIndicator');
  if(ind)return ind;
  const hdr=document.getElementById('appHdr');
  if(!hdr)return null;
  ind=document.createElement('button');
  ind.type='button';
  ind.id='hdrSyncIndicator';
  ind.className='sync-indicator inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ml-2 align-middle';
  ind.setAttribute('aria-live','polite');
  ind.setAttribute('aria-label','Estado de sincronización');
  ind.style.cssText='cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:4px;vertical-align:middle;background:transparent;border:0;font:inherit;';
  ind.innerHTML='<svg class="sync-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:middle;"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg><span class="sync-dot" style="width:6px;height:6px;border-radius:50%;display:inline-block;background-color:#38bdf8;"></span><span class="sync-other-dot" style="width:4px;height:4px;border-radius:50%;display:none;background-color:#f59e0b;margin-left:1px;vertical-align:middle;"></span>';
  ind.onclick=()=>{
   if(window.IERegistroSyncDiagnosticUI){
    window.IERegistroSyncDiagnosticUI.run();
   }else if(typeof toast==='function'){
    toast(ind.title||'Conectado');
   }
  };
  const titleDiv=hdr.querySelector('#hdrTitulo')?.previousElementSibling;
  if(titleDiv){
   titleDiv.style.display='inline-flex';
   titleDiv.style.alignItems='center';
   titleDiv.appendChild(ind);
  }else{
   hdr.querySelector('.shell')?.appendChild(ind);
  }
  return ind;
 }
 function updateSyncIndicator(state,message,otherPending=[]){
  const ind=ensureSyncIndicator();
  if(!ind)return;
  ind.dataset.state=state;
  ind.title=message||state;
  ind.setAttribute('aria-label','Estado de sincronización: '+ind.title+'. Abrir diagnóstico.');
  const dot=ind.querySelector('.sync-dot');
  if(!dot)return;
  if(state==='connected'){
   ind.style.color='#6ee7b7';dot.style.backgroundColor='#10b981';dot.style.animation='none';
  }else if(state==='pending'){
   ind.style.color='#fde68a';dot.style.backgroundColor='#f59e0b';dot.style.animation='none';
  }else if(state==='checking'){
   ind.style.color='#fde68a';dot.style.backgroundColor='#f59e0b';dot.style.animation='pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite';
  }else if(['offline','server','session','review','conflict'].includes(state)){
   ind.style.color='#fca5a5';dot.style.backgroundColor='#ef4444';dot.style.animation='none';
  }else if(state==='readonly'){
   ind.style.color='#cbd5e1';dot.style.backgroundColor='#94a3b8';dot.style.animation='none';
  }else{
   ind.style.color='#94a3b8';dot.style.backgroundColor='#64748b';dot.style.animation='none';
  }
  const otherDot=ind.querySelector('.sync-other-dot');
  if(otherDot){if(state==='connected'&&otherPending&&otherPending.length>0){otherDot.style.display='inline-block';otherDot.style.backgroundColor='#f59e0b';otherDot.title='Cambios sin guardar en: '+otherPending.join(', ');}else{otherDot.style.display='none';}}
 }
 function ensureSecondaryDiagnostic(){
  if(typeof document==='undefined'||!document.createElement)return;
  const box=document.getElementById('registroConnectionStatus');
  const diagBtn=document.getElementById('registroConnectionDiagnostic');
  if(box&&diagBtn&&!document.getElementById('registroDiagDetails')){
   const details=document.createElement('details');
   details.id='registroDiagDetails';
   details.className='w-full text-xs text-slate-600 mt-1';
   const summary=document.createElement('summary');
   summary.className='cursor-pointer text-slate-700 font-medium hover:underline py-0.5';
   summary.textContent='Opciones de diagnóstico y soporte';
   const content=document.createElement('div');
   content.className='flex flex-wrap gap-2 pt-1';
   details.appendChild(summary);
   details.appendChild(content);
   const backupsBtn=document.getElementById('registroConnectionBackups');
   if(backupsBtn)content.appendChild(backupsBtn);
   content.appendChild(diagBtn);
   box.appendChild(details);
  }
 }
 connection=IERegistroConnection.create({owner,binding:()=>binding()+(tutor()?'|tutor|'+document.getElementById('transAula').value+'|'+document.getElementById('transBim').value:''),authorized:()=>{if(tutor())return !!getLoginSession()?.token;if(esVistaAdmin()){const s=getLoginSession()||{};return !!(s.token&&s.role==='admin'&&typeof IEStudents!=='undefined'&&IEStudents.validToken()===s.token&&padronBimestre===ctxBase().bim&&tokenPadron===s.token&&registroLocal.matches());}return authorized();},readonly,allowed:()=>tutor()?!esVistaAdmin()&&bimestreHabilitado(document.getElementById('transBim')?.value):!readonly(),retain:()=>{if(canEdit())collect();},online:()=>navigator.onLine!==false,visible:()=>document.visibilityState!=='hidden',changed:value=>{const box=document.getElementById('registroConnectionStatus'),text=document.getElementById('registroConnectionText');if(box){box.dataset.state=value.state;box.style.display='none';}const statusMap={connected:'Conectado — notas verificadas.',pending:'Conectado — cambios sin guardar.',checking:'Verificando conexión…',offline:'Conexión perdida. Estamos intentando reconectar…',server:'Servidor no disponible — edición pausada.',session:'Sesión inválida — vuelve a iniciar sesión.',readonly:esVistaAdmin()?'Vista Administrador — solo lectura.':'Bimestre cerrado — solo lectura.',review:'Conflicto de versiones — consulta la nube antes de guardar.'};const msg=statusMap[value.state]||value.state;if(text)text.textContent=msg;lastConnectionState=value.state;/* Connectivity gates editing without changing academic errors, CAS or in-flight epochs. */const retryBtn=document.getElementById('registroRetryOffer');if(retryBtn)retryBtn.hidden=true;paint();if(value.state==='connected'||value.state==='pending')startPrefetch();},verify:async({valid,review})=>{
  if(tutor())return tutorRegistroController?.verifyConnection?await tutorRegistroController.verifyConnection({valid,review:false}):{ok:false};
  const [periods,permission]=await Promise.all([sincronizarPeriodosNube(true),verifyPermission(valid)]);if(permission.code==='SESSION')return permission;if(!valid())return {ok:false};if(!permission.ok)return permission;if(!periods)return {ok:false};
  if(esVistaAdmin())return {ok:true,code:'CLOSED',pending:false};
  const c=get();if(!c)return {ok:false,code:'SESSION'};const initialized=c.status().panels.calificar.version!==null;
  const attendanceMissing=initialized&&currentPanel()==='asistencia'&&c.status().panels.asistencia.version===null;
  if(!initialized||attendanceMissing){const ok=await c.load(attendanceMissing?{panel:'asistencia',verify:true}:{});if(!valid())return {ok:false};const s=c.status();if(ok&&!esVistaAdmin())render();return {ok,code:s.state==='session'?'SESSION':(ok&&(s.readonly||readonly()))?'CLOSED':undefined,conflict:s.state==='conflict',pending:false};}
  const s=c.status(),cerrado=typeof bimestreHabilitado==='function'&&!bimestreHabilitado(ctxBase().bim);
  return {ok:true,code:s.state==='session'?'SESSION':cerrado||s.readonly?'CLOSED':undefined,conflict:s.state==='conflict',pending:false};
 }});
 function viewStatus(){const s=get()?.status();if(s)for(const [name,p]of Object.entries(s.panels))p.pending=p.pending||screenPending(name);return s;}
 function pendingPanels(){const s=get()?.status();if(!s)return [];const names={calificar:'Calificar',promedios:'Promedios',asistencia:'Asistencia'};const list=[];for(const [name,p] of Object.entries(s.panels)){const isDirty=p.pending||screenPending(name)||(name==='calificar'&&typeof IERegistroTransversales!=='undefined'&&!!IERegistroTransversales.current()?.dirty);if(isDirty)list.push(names[name]||name);}return list;}
 function hasPending(){return pendingPanels().length>0||screenPending('calificar')||screenPending('promedios');}
 async function reconcileHistorical(){
  const client=get();if(!client)return false;const s=client.status();const conflicts=s.historicalConflicts||[];
  if(!conflicts.length){if(typeof toast==='function')toast('No hay conflictos históricos pendientes.');return true;}
  const roster=typeof estudiantes==='function'?estudiantes():[];
  const choices=await (root.IERegistroReconcile?.choose||IERegistroReconcile.choose)(conflicts,()=>client.status().state!=='closed',{roster});
  if(!choices)return false;
  store.finales=store.finales||{};let count=0;const resolvedPaths=[];
  for(const c of conflicts){
   const choiceId=choices[c.path];if(!choiceId)continue;
   const candidate=c.candidates?.find(x=>x.id===choiceId);if(!candidate)continue;
   const [field,canonicalKey]=JSON.parse(c.path);
   if(field==='finales'){
    const chosen=JSON.parse(JSON.stringify(candidate.value));
    chosen.conciliacionTs=Date.now();
    chosen.conciliacionOpcion=candidate.id||candidate.label;
    store.finales[canonicalKey]=chosen;
    count++;
    resolvedPaths.push(c.path);
   }
  }
  if(resolvedPaths.length===conflicts.length){
   client.clearHistoricalConflicts?.();
  }else if(resolvedPaths.length>0){
   client.clearHistoricalConflicts?.(resolvedPaths);
  }
  render();paint();
  if(typeof toast==='function')toast(count+' calificaciones históricas seleccionadas. Guarde Promedios para confirmar.');
  return true;
 }
 const api={saving:()=>!!(save.pending||uploadAttendance.pending),savingContext:()=>criticalSaveContext?copy(criticalSaveContext):null,prefetchStatus:()=>prefetch?{...prefetch.stats(),rosterRequests,rosterUnavailable:[...rosterUnavailable].map(([bimestre,code])=>({bimestre,code})),rosterContexts:contextRosters.size,rosterRetainedBytes:rosterBytes}:null,save,download,process,collect,screenPending,status:viewStatus,worked,setWorked,canEdit,officialOnly,persist,refresh,pendingPanels,hasPending,reconcileHistorical,activePending:()=>{const pane=currentPanel();return pane==='resumen'?false:pane==='calificar'?(!!get()?.status()?.panels.calificar?.pending||(typeof IERegistroTransversales!=='undefined'&&!!IERegistroTransversales.current()?.dirty)):!!get()?.status()?.panels[pane]?.pending;},keepMemory(){if(memoryLoaded)return true;memoryLoaded=true;return false;},current:get,panel:currentPanel};root.IERegistroNotas2UI=api;
 // Existing tutor controls call this API only to verify their connection, never to write academic notes.
 root.IERegistroRecovery={refresh,automatic:()=>connection.check(),resolve:()=>{const s=get()?.status();if(s?.historicalConflicts?.length)return reconcileHistorical();connection.invalidate();return connection.check(true,true);},local:save,upload:()=>currentPanel()==='asistencia'?uploadAttendance():save(),recover:download};
 document.addEventListener('DOMContentLoaded',()=>{
  const review=document.getElementById('registroConnectionReview');if(review){review.textContent='Verificar conexión';review.onclick=()=>connection.check(true,true);}
  ensureSyncIndicator();ensureSecondaryDiagnostic();
  // Keep state nodes for existing guards/readers; expose their details only in the cloud diagnostic.
  for(const id of ['studentsStatus','retryRoster','registroSaveState']){const el=document.getElementById(id);if(el?.style)el.style.display='none';}
  const toastEl=document.getElementById('toast');
  if(toastEl&&typeof MutationObserver!=='undefined'){
   toastEl.style.display=toastEl.classList.contains('hidden')?'none':'block';
   new MutationObserver(()=>{toastEl.style.display=toastEl.classList.contains('hidden')?'none':'block';}).observe(toastEl,{attributes:true,attributeFilter:['class']});
  }
  const initBox=document.getElementById('registroConnectionStatus');if(initBox)initBox.style.display='none';
  for(const id of ['registroConflictOffer','registroUndoOffer','registroDraftOffer','registroLegacyReview']){const el=document.getElementById(id);if(el)el.hidden=true;}
  const retry=document.getElementById('registroRetryOffer');if(retry){retry.hidden=true;retry.onclick=()=>connection.check(true,true);}
   document.querySelectorAll('#registroAccionesAcademicas button').forEach(b=>b.addEventListener('click',()=>paint()));
  const block=e=>{if(canEdit()&&!api.saving())return;const write=e.target?.closest?.('.cal-nota,.fin-nota,.academic-conclusion,.asis-input,[data-val],[data-av],[data-adel],[data-delfecha],[data-an],[data-final-toggle],.fin-bulk-actions');if(write){e.preventDefault();e.stopImmediatePropagation();}};
  for(const type of ['beforeinput','click','change'])document.addEventListener(type,block,true);
  document.addEventListener('input',()=>{paint();});document.addEventListener('change',()=>refresh());document.addEventListener('click',()=>paint());document.addEventListener('ie22375:registro-ready',()=>refresh());
  window.addEventListener('offline',()=>{prefetch?.pause();connection.pause('offline');});window.addEventListener('online',()=>refresh(true));window.addEventListener('focus',()=>refresh());window.addEventListener('storage',e=>{if(e.key==='ie22375_session_v1'){prefetch?.pause();connection.pause('session');}});
  const footer=document.getElementById('registroAcademicFooter');if(footer&&typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{const main=document.querySelector('main');if(main)main.style.paddingBottom=(footer.hidden?0:footer.getBoundingClientRect().height+12)+'px';}).observe(footer);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')prefetch?.hold('hidden');else{prefetch?.release('hidden');if(prefetch&&backgroundEligible())startPrefetch();}});
  window.addEventListener('beforeunload',e=>{if(api.saving()||api.hasPending()){e.preventDefault();e.returnValue='';return '';}});
  refresh();
 });
})(window);
