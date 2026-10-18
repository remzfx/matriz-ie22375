/* Adaptador frontend: operaciones explícitas y timers exclusivamente locales. */
(function(){
 'use strict';let service,timer,lastDisk,refreshTimer,periodicTimer,expiryTimer,expiryToken='';const observed=new Map();try{lastDisk=localStorage.getItem(NOTAS_KEY);}catch(_){}
 const copy=x=>IERegistroReconcile.copy(x),context=()=>{const s=getLoginSession()||{};return cloudClaveReg()+'|'+(s.token||'')+'|'+(s.user||'')+'|'+(s.role||'');};
 function authenticated(){const s=getLoginSession();return !!(s?.token&&['admin','docente'].includes(s.role)&&typeof IEStudents!=='undefined'&&IEStudents.validToken()===s.token&&(typeof registroLocal==='undefined'||registroLocal.matches()));}
 function text(el,value){if(el&&el.textContent!==value)el.textContent=value;}
 const volatileEntries=new Map();
 function pendingTrans(){const token=(getLoginSession()||{}).token,entry=typeof IERegistroTransversales==='undefined'?null:IERegistroTransversales.current?.();if(entry?.dirty)volatileEntries.set(entry,token);return [...volatileEntries].some(([e,t])=>t===token&&e.dirty);}
 function refreshWarning(){const pending=pendingTrans(),status=document.getElementById('registroSaveState'),suffix=' · Aporte transversal pendiente: conserva esta pestaña.';if(status?.textContent)text(status,status.textContent.replace(suffix,'')+(pending?suffix:''));const el=document.getElementById('registroEmergencyWarning');if(el){el.hidden=!pending;text(el,el.hidden?'':'Aportes transversales pendientes SIN respaldo de emergencia. Recuperar Nube, Deshacer recuperación y Recuperar borrador solo protegen el registro académico. No cierres ni cambies de aula, área o bimestre: conserva esta pestaña y confirma el envío de esos aportes.');}}
 const state=text=>{if(text==='Cambios pendientes de subir')text=pendingAcademic()?pendingLabel():'Notas actualizadas';const el=document.getElementById('registroSaveState');refreshWarning();if(el){const value=text+(pendingTrans()?' · Aporte transversal pendiente: conserva esta pestaña.':'');if(el.textContent!==value)el.textContent=value;}};
 function guard(){const ses=getLoginSession();return !!(authenticated()&&ses&&ses.token&&['admin','docente'].includes(ses.role)&&nivel&&areaActual&&areas().includes(areaActual)&&bimestreHabilitado(ctxBase().bim)&&!registroSoloLectura()&&!bimCerradoDocente()&&padronBimestre===ctxBase().bim&&!subirRegistroNube.pending&&!bajarRegistroNube.pending&&document.getElementById('registroTutorPanel')?.hidden!==false);}
 function capture(){
  const persisted=localStorage.getItem(NOTAS_KEY);if(!diskSafe())throw Error('Otro registro cambió en este navegador. Conserva las pestañas y revisa antes de guardar.');lastDisk=persisted;
  const invalid=Array.from(document.querySelectorAll('.cal-nota,.fin-nota')).some(el=>{const rendered=el.dataset?.registroContexto||el.closest?.('#finLista')?.dataset?.registroContexto;if(rendered&&rendered!==cloudClaveReg()||el.readOnly)return false;return el.value!==''&&(!Number.isFinite(Number(el.value))||Number(el.value)<0||Number(el.value)>20);});
  if(invalid)throw Error('Nota inválida: conserva esta pestaña y corrige antes de guardar.');
  if(guardarTodo()===false)throw Error('No se confirmó el guardado local. Conserva esta pestaña.');
  lastDisk=localStorage.getItem(NOTAS_KEY);
  const ses=getLoginSession();return {context:context(),key:cloudClaveReg(),owner:ses.user,role:ses.role,payload:copy(sliceRegistroArea()),baseline:copy(baselineAcademica())};
 }
 const ownerHashes=new Map(),draftMemo=new Map();let draftRevision=0;
 function invalidateDraft(){draftRevision++;draftMemo.clear();}
 async function scope(snapshot){const ses=getLoginSession()||{},user=snapshot?snapshot.owner:ses.user,role=snapshot?snapshot.role:ses.role,key=snapshot?snapshot.key:cloudClaveReg();if(!user)throw Error('No se identificó al usuario del respaldo.');const owner=user+'|'+role;if(!ownerHashes.has(owner)){const result=crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner)).then(hash=>[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join(''));ownerHashes.set(owner,result);result.catch(()=>ownerHashes.delete(owner));}return await ownerHashes.get(owner)+'|'+key;}
 let connection=null;
 const tutorVisible=()=>document.getElementById('registroTutorPanel')?.hidden===false;
 const connectionContext=()=>context()+(tutorVisible()?'|tutor|'+document.getElementById('transAula').value+'|'+document.getElementById('transBim').value:'');
 function connectionReadable(){if(!tutorVisible())return readable();const ses=getLoginSession(),aula=document.getElementById('transAula').value;return !!(authenticated()&&ses.role==='docente'&&(ses.tutorAulas||[]).includes(aula)&&document.getElementById('transBim').value);}

 function connectionState(value){
  const panel=document.getElementById('registroConnectionStatus'),label=document.getElementById('registroConnectionText'),review=document.getElementById('registroConnectionReview');
  const hasRealConflict=()=>{const res=bajarRegistroNube?.resultado;return !!(res?.estado==='conflicto'&&Number.isInteger(res?.conflictos)&&res.conflictos>0);};
  const reviewLabel=hasRealConflict()?'Conflicto pendiente — requiere revisión. Tus cambios locales están conservados.':'Cambios locales pendientes de revisión. Tus cambios locales están conservados.';
  const labels={readonly:'Bimestre cerrado — solo lectura.',connected:'Conectado — notas verificadas.',pending:'Guardado local — pendiente de subir.',checking:'Verificando conexión…',offline:'Conexión perdida. Estamos intentando reconectar… Sin conexión — edición pausada.',server:'Servidor no disponible — edición pausada. Estamos intentando reconectar…',session:'Sesión vencida o sin autorización — vuelve a iniciar sesión.',review:reviewLabel};
  if(panel)panel.dataset.state=value.state;if(label)text(label,value.retentionFailed?'No se pudo proteger la entrada iniciada. Edición pausada: conserva esta pestaña y consulta los respaldos.':labels[value.state]);if(review)review.hidden=value.state!=='review';
  document.querySelectorAll('#registroRecoveryControls button[onclick*=".local("],#registroRecoveryControls button[onclick*=".upload("]').forEach(el=>el.disabled=!['connected','pending'].includes(value.state));
  if(tutorVisible()){if(['connected','pending'].includes(value.state))tutorRegistroController?.refresh?.();else document.querySelectorAll('#transRows input,#transRows textarea,#transRows select,#transRows button').forEach(el=>el.disabled=true);}
  else if(['connected','pending'].includes(value.state)&&typeof pintarRegistroConciliado==='function')pintarRegistroConciliado();
  if(typeof sincronizarEdicionRegistro==='function')sincronizarEdicionRegistro();
 }
 if(typeof IERegistroConnection!=='undefined')connection=IERegistroConnection.create({binding:connectionContext,authorized:connectionReadable,readonly:()=>typeof registroConsultaHistorica==='function'&&registroConsultaHistorica(),online:()=>typeof navigator==='undefined'||navigator.onLine!==false,visible:()=>document.visibilityState!=='hidden',retain:()=>{if(guard())capture();},changed:connectionState,verify:async({review,valid})=>{
  if(tutorVisible())return tutorRegistroController?.verifyConnection?await tutorRegistroController.verifyConnection({valid,review}):{ok:false};
  if(typeof sincronizarPeriodosNube==='function'){if(!await sincronizarPeriodosNube(true)||!valid())return {ok:false};const estado=loadPeriodosAdmin()?.bimestres?.[ctxBase().bim];if(!['abierto','cerrado','bloqueado'].includes(estado))return {ok:false};if(estado!=='abierto')return {ok:false,code:'CLOSED'};}
  consulted.delete(context());
  if(review&&pendingAcademic()&&!confirm('Hay cambios locales pendientes. Se verificará la nube y se conservarán mediante conciliación segura. No se subirá nada. ¿Revisar y continuar?'))return {ok:false,conflict:true};
  const ok=await (review?resolve(valid):automatic(valid));const result=bajarRegistroNube.resultado;
  const protocol=prepararVersionAcademica.plan?.remote?.identityProtocol===true;
  return {ok:!!ok&&valid()&&protocol,conflict:result?.estado==='conflicto',pending:pendingAcademic()||pendingTrans(),code:result?.code||(!protocol?'API_INCOMPATIBLE':undefined)};
 }});
 const disk=typeof IERegistroDrafts==='undefined'?null:IERegistroDrafts.storage(window.indexedDB);
 async function backup(snapshot,kind){const key=await scope(snapshot),safe=copy(snapshot);safe.context=snapshot.key;delete safe.owner;delete safe.role;const result=await disk.put(key,safe,kind);invalidateDraft();return result;}
 function compare(diff,kind){return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:760px;width:calc(100% - 24px);max-height:85vh;border:0;border-radius:14px;padding:16px';
  const title=document.createElement('h2');title.id='registroRecoveryTitle';title.tabIndex=-1;title.textContent=kind==='nube'?'Recuperar Nube':kind==='undo'?'Deshacer recuperación':kind==='legacy'?'Revisar datos anteriores sin propietario':'Recuperar borrador de emergencia';dialog.setAttribute('aria-labelledby',title.id);dialog.append(title);
  const warning=document.createElement('p'),c=ctxBase();warning.textContent='Bimestre '+c.bim+' · '+c.grado+'.º '+c.seccion+' · '+c.area+'. Reemplazo voluntario de notas, evidencias y conclusiones. Se conservará un respaldo verificado. La asistencia local se conserva. No se subirá nada a la nube.';dialog.append(warning);
  const undo=document.createElement('p');undo.textContent='Para deshacer después, incluso al reabrir: pulsa Deshacer recuperación y compara el respaldo anterior a este reemplazo. No borres los datos locales; los respaldos duran hasta siete días y pueden caducar antes por cuota o límite de 40 respaldos.';dialog.append(undo);
  if(pendingTrans()){const alert=document.createElement('p');alert.style.cssText='background:#fef2f2;color:#991b1b;padding:10px;font-weight:bold';alert.textContent='Tus aportes transversales pendientes NO quedan respaldados ni se recuperan aquí. Esta acción solo reemplaza datos académicos. Conserva la pestaña y confirma el envío de esos aportes antes de cambiar contexto o cerrar.';dialog.append(alert);}
  const list=document.createElement('div');list.style.cssText='overflow:auto;max-height:50vh';
  for(const row of diff){const p=document.createElement('p');p.style.cssText='border-bottom:1px solid #ddd;padding:8px;font-size:12px;overflow-wrap:anywhere';
   const view=['sessions','capsSel'].includes(row.field)?{title:row.field==='sessions'?'Sesiones de evaluación':'Capacidades seleccionadas',local:JSON.stringify(row.local),remote:JSON.stringify(row.remote)}:IERegistroReconcile.conflictView({path:JSON.stringify([row.field,row.key]),local:row.local,remote:row.remote},{roster:estudiantes(),aliases:sliceRegistroArea().meta?.studentAliases});
   p.textContent=view.title+'\nLocal: '+view.local+'\n'+(kind==='nube'?'Nube: ':kind==='undo'?'Antes de recuperar: ':'Borrador: ')+view.remote;p.style.whiteSpace='pre-wrap';list.append(p);}dialog.append(list);
  const cancel=document.createElement('button'),accept=document.createElement('button');cancel.textContent='Cancelar';accept.textContent=kind==='undo'?'Confirmar deshacer':'Confirmar reemplazo local';for(const b of [cancel,accept]){b.type='button';b.style.cssText='min-height:44px;margin:6px;padding:8px';dialog.append(b);}
  let done=false;const finish=value=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(value);};cancel.onclick=()=>finish(false);accept.onclick=()=>finish(true);dialog.oncancel=e=>{e.preventDefault();finish(false);};document.body.append(dialog);dialog.showModal();title.focus();
 });}
 async function apply(remote,candidate,local,backupRecord){
  const previous=copy(store),raw=localStorage.getItem(NOTAS_KEY),payload=copy(remote.payload);
  for(const field of ['asistencia','asisFechas','asisFechasEstado'])payload[field]=copy(local.payload[field]||{});
  try{
   aplicarRegistroConciliado(payload,true);const b=baselineAcademica();
   if(!candidate){b.version=remote.version;b.basePayload=copy(remote.rawPayload||remote.payload);b.baseline=IERegistroAcademico.canonical(remote.payload);delete b.attempt;}
   else{const original=candidate.undo?local.baseline:candidate.snapshot.baseline||{};b.version=original.version??null;if(original.basePayload)b.basePayload=copy(original.basePayload);else delete b.basePayload;b.baseline=original.baseline||IERegistroAcademico.canonical(local.payload);delete b.attempt;}
   b.recovery={local:copy(local.payload),base:local.baseline.basePayload||null,remote:copy(remote.payload)};
   if(candidate?.undo)b.voluntaryRecovery={undone:true,created:backupRecord?.created??Date.now()};else if(backupRecord?.id)b.voluntaryRecovery={id:backupRecord.id,created:backupRecord.created};saveStore();
   if(localStorage.getItem(NOTAS_KEY)!==JSON.stringify(store))throw Error('No se verificó el reemplazo local.');lastDisk=localStorage.getItem(NOTAS_KEY);invalidateDraft();dirtyAcademico();pintarRegistroConciliado();
  }catch(e){store=previous;try{if(typeof registroLocal!=='undefined')registroLocal.write(raw===null?JSON.stringify(previous):raw);else if(raw!==null)localStorage.setItem(NOTAS_KEY,raw);}catch(_){}throw Error('Recuperación no confirmada. Borrador conservado; no cierres la pestaña.');}
 }
 function init(){if(!disk)return null;if(!service)service=IERegistroDrafts.controller({context,guard,capture,read:async()=>{const remote=await leerEstadoRemotoAcademico(ctxBase(),cloudClaveReg(),(getLoginSession()||{}).token),projected=IEAcademicIdentity.project(remote.payload,estudiantes(),ctxBase(),competencias());if(projected.conflicts.length)throw Error('Identidades históricas ambiguas: usa Revisar conflictos. Borrador conservado.');return {...remote,rawPayload:remote.payload,payload:projected.payload};},backup,apply,confirm:compare,state,changed:()=>pendingAcademic(),baseline:()=>IERegistroReconcile.signature(baselineAcademica().basePayload||{})});return service;}
 async function recover(){refreshWarning();if(!guard()){state('Recuperación no disponible: revisa sesión, permisos, bimestre y padrón.');return false;}if(!init())return state('Recuperación no disponible. Conserva el borrador.');const ok=await service.recover();invalidateDraft();await offerDraft();queueRefresh();return ok;}
 function diskSafe(){const raw=localStorage.getItem(NOTAS_KEY);return typeof registroLocal!=='undefined'?registroLocal.verified(raw):raw===lastDisk||raw===JSON.stringify(store);}
 function rememberDisk(){const raw=localStorage.getItem(NOTAS_KEY);if(raw===JSON.stringify(store))lastDisk=raw;}
 function material(payload){const p=JSON.parse(IERegistroAcademico.canonical(payload||{}));for(const field of ['grades','finales','concComp','concArea','competenciasEstado','capsSel']){p[field]=p[field]||{};for(const [key,v]of Object.entries(payload?.[field]||{}))if(v?.borrado)p[field][key]={borrado:true};}for(const [key,v]of Object.entries(p.capsSel||{})){if(Array.isArray(v)&&!v.length)delete p.capsSel[key];else if(Array.isArray(v))for(const item of v)if(item?.comp&&item.cap&&item.origen==='academica')delete item.origen;}return p;}
 function different(a,b){return IERegistroDrafts.differences(material(a),material(b)).length>0;}
 function recoverable(payload,local=sliceRegistroArea()){
  if(!payload)return false;const candidate=material(payload),current=material(local);
  // A subset offers nothing to recover. Divergent values remain available for explicit comparison.
  return ['grades','finales','concComp','concArea','competenciasEstado','sessions','capsSel'].some(field=>{
   const a=candidate[field]||{},b=current[field]||{};
   if(Array.isArray(a))return a.some(value=>!(Array.isArray(b)&&b.some(existing=>IERegistroReconcile.equal(existing,value))));
   return Object.entries(a).some(([key,value])=>Array.isArray(value)?value.some(item=>!(Array.isArray(b[key])&&b[key].some(existing=>IERegistroReconcile.equal(existing,item)))):!IERegistroReconcile.equal(value,b[key]));
  });
 }
 function selectBackups(rows,local){
  const b=baselineAcademica(),pointer=b.voluntaryRecovery;let undo=pointer?rows.find(r=>r.id===pointer.id&&r.kind==='before-recovery'):null;
  // Older voluntary recoveries can be matched only to their verified persisted before/after pair.
  if(!pointer&&rows.some(r=>r.kind==='before-recovery')&&b.recovery?.local&&b.recovery?.remote&&!different(local,b.recovery.remote))undo=rows.find(r=>r.kind==='before-recovery'&&!different(r.snapshot.payload,b.recovery.local));
  const threshold=pointer?.created??undo?.created??-Infinity;
  const covered={},ordered=rows.filter(r=>['emergency','periodic'].includes(r.kind)&&r.created>threshold).sort((a,b)=>b.created-a.created);let draft=null;
  for(const row of ordered){
   const candidate=material(row.snapshot.payload),available=copy(candidate);
   for(const field of ['grades','finales','concComp','concArea','competenciasEstado','sessions','capsSel']){
    const values=candidate[field]||{};covered[field]=covered[field]||(Array.isArray(values)?[]:{});
    if(Array.isArray(values)){available[field]=values.filter(v=>!covered[field].some(x=>IERegistroReconcile.equal(x,v)));covered[field].push(...values);}
    else for(const [key,value]of Object.entries(values)){
     if(Array.isArray(value)){const newer=covered[field][key]||[];available[field][key]=value.filter(v=>!newer.some(x=>IERegistroReconcile.equal(x,v)));covered[field][key]=[...newer,...value];}
     else{if(Object.hasOwn(covered[field],key))delete available[field][key];covered[field][key]=true;}
    }
   }
   if(recoverable(available,local)){draft=row;break;}
  }
  // A voluntary recovery supersedes old values, but must not hide unique missing data.
  if(!draft&&Number.isFinite(threshold)){
   const current=material(local),before=material(undo?.snapshot.payload||{});
   draft=rows.filter(r=>['emergency','periodic'].includes(r.kind)&&r.created<=threshold).sort((a,b)=>b.created-a.created).find(row=>{
    const available=material(row.snapshot.payload);
    for(const field of ['grades','finales','concComp','concArea','competenciasEstado','sessions','capsSel']){
     const a=available[field]||{},b=current[field]||{},c=before[field]||{};
     if(Array.isArray(a))available[field]=a.filter(v=>![...(Array.isArray(b)?b:[]),...(Array.isArray(c)?c:[])].some(x=>IERegistroReconcile.equal(x,v)));
     else for(const [key,value]of Object.entries(a))if(Array.isArray(value))a[key]=value.filter(v=>[...(b[key]||[]),...(c[key]||[])].every(x=>!IERegistroReconcile.equal(x,v)));else if(Object.hasOwn(b,key)||Object.hasOwn(c,key))delete a[key];
    }
    return recoverable(available,local);
   })||null;
  }
  return {undo:undo&&different(local,undo.snapshot.payload)?{...undo,undo:true}:null,draft:draft||null};
 }
 let pendingFields=[];
 function pendingLabel(){return pendingFields.length===1&&pendingFields[0]==='capsSel'?'Configuración de capacidades pendiente de subir':'Cambios pendientes de subir';}
 function pendingAcademic(payload=sliceRegistroArea()){
  const b=baselineAcademica(),canonical=IERegistroAcademico.canonical(payload),deleted=['grades','finales','concComp','concArea','competenciasEstado','capsSel'].some(f=>Object.values(payload[f]||{}).some(v=>v?.borrado));pendingFields=[];
  if(canonical===b.baseline&&!deleted)return false;
  let base;try{base=b.basePayload||JSON.parse(b.baseline);}catch(_){pendingFields=['base no verificada'];return true;}
  const normalize=p=>{const c=JSON.parse(IERegistroAcademico.canonical(p));delete c.meta;for(const field of ['asisFechas','capsSel'])for(const k of Object.keys(c[field]||{}))if(Array.isArray(c[field][k])&&!c[field][k].length)delete c[field][k];for(const selection of Object.values(c.capsSel||{}))if(Array.isArray(selection))for(const item of selection)if(item&&typeof item==='object'&&item.comp&&item.cap&&item.origen==='academica')delete item.origen;return c;},local=normalize(payload),remote=normalize(base);
  pendingFields=[...new Set([...Object.keys(local),...Object.keys(remote)])].filter(f=>!IERegistroReconcile.equal(local[f],remote[f]));
  for(const f of ['grades','finales','concComp','concArea','competenciasEstado','capsSel']){const tombstones=p=>Object.fromEntries(Object.entries(p[f]||{}).filter(([,v])=>v?.borrado).map(([k])=>[k,true]));if(!IERegistroReconcile.equal(tombstones(payload),tombstones(base))&&!pendingFields.includes(f))pendingFields.push(f);}
  return pendingFields.length>0;
 }
 async function local(){if(!guard()||init()?.busy())return false;const binding=context();try{invalidateDraft();capture();const ok=await guardarRegistroIntegrado(connection?{soloLocal:true}:undefined);if(binding!==context())return false;rememberDisk();if(ok)connection?.changed(pendingAcademic()||pendingTrans());state(ok?(pendingAcademic()?'Cambios pendientes de subir':'Guardado en esta computadora'):'Guardado en esta computadora · aporte transversal pendiente');await init()?.emergency();queueRefresh();return ok;}catch(e){state(e.message);return false;}finally{queueRefresh();}}
 async function upload(){if(!guard()||init()?.busy())return false;if(registroNubeNoVerificada()){state('Sin conexión. Tus notas locales están conservadas');return false;}const binding=context();try{if(!diskSafe())throw Error('Otro registro cambió en este navegador. Conserva las pestañas y revisa antes de guardar.');const ok=await subirRegistroNube();if(binding===context()){rememberDisk();invalidateDraft();if(ok)connection?.changed(pendingAcademic()||pendingTrans());queueRefresh();state(ok&&!pendingAcademic()?'Notas actualizadas':'Cambios pendientes de subir');}return ok;}catch(e){if(binding===context())state('No se confirmó la subida. Tus notas locales están conservadas');return false;}finally{queueRefresh();}}
 async function inspectBackups(){
  if(!authenticated()||!disk||connection?.snapshot().state==='session')return false;const binding=context(),rows=await disk.list(await scope());if(binding!==context()||!authenticated())return false;
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:720px;width:calc(100% - 24px);max-height:80vh;overflow:auto;padding:16px';
  const title=document.createElement('h2');title.textContent='Respaldos locales — solo consulta';dialog.append(title);
  const body=document.createElement('pre');body.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';body.textContent=rows.length?rows.map(r=>'Respaldo '+new Date(r.created).toLocaleString('es-PE')+' · '+r.kind+'\n'+JSON.stringify(r.snapshot.payload,null,2)).join('\n\n'):'No hay respaldos locales para este contexto.';dialog.append(body);
  const close=document.createElement('button');close.type='button';close.textContent='Cerrar';close.style.minHeight='44px';close.onclick=()=>{dialog.close();dialog.remove();};dialog.append(close);document.body.append(dialog);dialog.showModal();return true;
 }
 async function restore(kind){if(connection&&!connection.canEdit())return inspectBackups();refreshWarning();if(!guard()||!init()||service.busy())return false;try{const binding=context(),key=await scope(),rows=await disk.list(key);if(binding!==context()||!guard())return false;let candidate=selectBackups(rows,sliceRegistroArea())[kind];const legacy=baselineAcademica().recovery;if(!candidate&&kind==='draft'&&!baselineAcademica().voluntaryRecovery&&recoverable(legacy?.local))candidate={snapshot:{payload:copy(legacy.local),baseline:{version:baselineAcademica().version,basePayload:copy(legacy.base),baseline:IERegistroAcademico.canonical(legacy.base||{})}}};if(!candidate){state(kind==='undo'?'No hay un respaldo anterior recuperable.':'No hay borradores diferentes recientes para este contexto.');await offerDraft();return false;}const ok=await service.recover(candidate);invalidateDraft();await offerDraft();queueRefresh();return ok;}catch(e){state(e.message);return false;}}
 async function drafts(){return restore('draft');}
 async function undo(){return restore('undo');}
 async function legacy(){
  if(!guard()||!init()||service.busy()||typeof registroLocal==='undefined'||getLoginSession()?.role!=='admin')return false;
  try{
   const original=registroLocal.legacy();if(!original)return false;
   if(!confirm('Estos datos antiguos no tienen propietario verificable. Solo continúa si corresponden al contexto seleccionado. Se compararán y respaldarán antes de reemplazar notas locales. No se subirá nada. ¿Revisarlos?'))return false;
   const c=ctxBase(),prefix=cloudClaveReg()+'||',payload=copy(sliceRegistroArea());
   for(const field of ['grades','finales','concComp','concArea','competenciasEstado','capsSel'])payload[field]=Object.fromEntries(Object.entries(original.store[field]||{}).filter(([key])=>key.startsWith(prefix)));
   payload.sessions=(original.store.sessions||[]).filter(s=>s.nivel===c.nivel&&s.bim===c.bim&&String(s.grado)===String(c.grado)&&s.seccion===c.seccion&&s.area===c.area);
   payload.meta=payload.meta||{};payload.meta.studentAliases=payload.meta.studentAliases||{};
   const aula=[c.nivel,c.grado,c.seccion].join('||');
   for(const aliases of [original.store.meta?.[cloudClaveReg()]?.studentAliases,original.store.studentAliases?.[aula]])for(const [id,names]of Object.entries(aliases||{}))if(Array.isArray(names))payload.meta.studentAliases[id]=[...new Set([...(payload.meta.studentAliases[id]||[]),...names.filter(n=>typeof n==='string')])];
   if(!recoverable(payload)){state('No hay datos anteriores recuperables para este contexto.');return false;}
   const candidate={kind:'legacy',snapshot:{payload,baseline:copy(baselineAcademica())},validate:()=>registroLocal.legacy()?.raw===original.raw};
   const ok=await service.recover(candidate);invalidateDraft();await offerDraft();queueRefresh();return ok;
  }catch(e){state('No se recuperaron datos anteriores: '+e.message);return false;}
 }
 const consulted=new Set();let checking=false,activeBinding='',generation=0;
 function track(){const binding=context();if(binding!==activeBinding){if(checking)state('Notas locales conservadas · verificación del contexto actual pendiente');activeBinding=binding;generation++;diagnostic=null;pendingFields=[];consulted.delete(binding);for(const id of ['registroConflictOffer','registroDraftOffer','registroUndoOffer']){const el=document.getElementById(id);if(el)el.hidden=true;}invalidateDraft();clearTimeout(periodicTimer);periodicTimer=null;}return generation;}
 function readable(){const ses=getLoginSession();return !!(authenticated()&&ses?.token&&['admin','docente'].includes(ses.role)&&nivel&&areaActual&&areas().includes(areaActual)&&padronBimestre===ctxBase().bim&&typeof tokenPadron!=='undefined'&&tokenPadron===ses.token&&typeof IEStudents!=='undefined'&&IEStudents.validToken()===ses.token&&IEStudents.peekRoster(ctxBase().bim)&&!(typeof registroConsultaHistorica==='function'&&registroConsultaHistorica())&&document.getElementById('registroTutorPanel')?.hidden!==false);}
 function academicEmpty(payload){return !(payload.sessions||[]).length&&['grades','finales','concComp','concArea','competenciasEstado'].every(field=>Object.keys(payload[field]||{}).length===0)&&Object.values(payload.capsSel||{}).every(v=>Array.isArray(v)&&v.length===0);}
 function retryOffer(show){const el=document.getElementById('registroRetryOffer');if(el)el.hidden=!show;}
 function hideConflict(){const offer=document.getElementById('registroConflictOffer');if(offer)offer.hidden=true;}
 function storageBlocked(){hideConflict();state('No se pudo verificar el guardado local. Tus notas están conservadas; no cierres esta pestaña.');}
 function syncState(ok){retryOffer(!ok&&bajarRegistroNube.resultado?.estado==='fallo');const result=bajarRegistroNube.resultado,offer=document.getElementById('registroConflictOffer'),current=result?.key===cloudClaveReg()&&result?.token===(getLoginSession()||{}).token,conflict=current&&result?.estado==='conflicto'&&Number.isInteger(result.conflictos)&&result.conflictos>0;if(offer)offer.hidden=!conflict;if(conflict){state('Hay notas diferentes que necesitan revisión');return;}if(ok&&current&&result.estado==='verificado'){const payload=sliceRegistroArea(),pending=pendingAcademic(payload),plan=typeof prepararVersionAcademica==='undefined'?null:prepararVersionAcademica.plan,empty=academicEmpty(payload)&&plan?.key===result.key&&plan?.token===result.token&&plan.remote?.payload&&academicEmpty(plan.remote.payload);state(empty?'Sin notas registradas'+(pending?' · '+pendingLabel():''):pending?'Cambios pendientes de subir':'Notas actualizadas');return;}state(current&&result?.estado==='pendiente'?'Cambios pendientes de subir':result?.estado==='fallo'?(result.code==='TIMEOUT'?'La verificación tardó demasiado. Tus notas locales están conservadas; reintenta.':'Sin conexión. Tus notas locales están conservadas'):'No se pudo verificar el registro actual. Tus notas locales están conservadas');}

 let diagnostic=null;
 async function automatic(connectionCheck){const epoch=track(),binding=context();if(!authenticated()){inactive();return false;}if(!readable()||checking||consulted.has(binding)||service?.busy()||subirRegistroNube.pending||bajarRegistroNube.pending)return false;checking=true;consulted.add(binding);pendingFields=[];const started=Date.now(),timings={};let phase='preparacion',phaseAt=started,finished=false;const fase=next=>{if(finished)return;const now=Date.now();timings[phase]=(timings[phase]||0)+now-phaseAt;phase=next;phaseAt=now;};try{if(!diskSafe()){storageBlocked();return false;}retryOffer(false);state('Verificando notas…');const ok=await bajarRegistroNube({automatico:true,timeoutMs:15000,fase,validarPersistencia:()=>localStorage.getItem(NOTAS_KEY)===JSON.stringify(store),validar:()=>track()===epoch&&binding===context()&&readable()&&diskSafe()&&(!connectionCheck||connectionCheck())});if(binding===context()&&epoch===track()&&authenticated()){rememberDisk();invalidateDraft();syncState(ok);}else if(!authenticated())inactive();return ok;}catch(e){if(!authenticated())inactive();else if(binding===context()&&epoch===track())state('Sin conexión. Tus notas locales están conservadas');return false;}finally{const stoppedAt=phase;fase('terminado');finished=true;if(binding===context()&&epoch===generation)diagnostic={elapsedMs:Date.now()-started,phase:stoppedAt,phases:timings,outcome:bajarRegistroNube.resultado?.code||bajarRegistroNube.resultado?.estado||'sin resultado',pendingFields:pendingFields.slice()};checking=false;if(binding!==context()||epoch!==generation||!consulted.has(binding))queueRefresh();}}
 async function resolve(connectionCheck){if(!readable()||checking||service?.busy()||subirRegistroNube.pending||bajarRegistroNube.pending)return false;const epoch=track(),binding=context();if(!diskSafe()){storageBlocked();return false;}checking=true;try{const ok=await bajarRegistroNube({timeoutMs:15000,validarPersistencia:()=>localStorage.getItem(NOTAS_KEY)===JSON.stringify(store),validar:()=>track()===epoch&&binding===context()&&readable()&&diskSafe()&&(!connectionCheck||connectionCheck())});if(binding===context()&&epoch===track()&&authenticated()){rememberDisk();invalidateDraft();syncState(ok);}else if(!authenticated())inactive();return ok;}finally{checking=false;if(binding!==context()||epoch!==generation||!consulted.has(binding))queueRefresh();}}
 async function offerDraft(){const draft=document.getElementById('registroDraftOffer'),undo=document.getElementById('registroUndoOffer'),binding=context();if(!guard()||!init()){if(draft)draft.hidden=true;if(undo)undo.hidden=true;return false;}const revision=draftRevision,stamp=binding+'|'+generation+'|'+revision;let memo=draftMemo.get(stamp);if(!memo||memo.until<=Date.now()){
  memo={until:Infinity,pending:(async()=>{const key=await scope(),rows=await disk.list(key);if(binding!==context()||revision!==draftRevision||!guard())return null;memo.until=rows.length?Math.min(...rows.map(r=>r.created+IERegistroDrafts.ttl)):Infinity;return selectBackups(rows,sliceRegistroArea());})()};draftMemo.set(stamp,memo);memo.pending.catch(()=>draftMemo.delete(stamp));
 }const candidates=await memo.pending;if(!candidates||binding!==context()||revision!==draftRevision||!guard())return false;if(draft)draft.hidden=!candidates.draft;if(undo)undo.hidden=!candidates.undo;return !!(candidates.draft||candidates.undo);}
 let padronRetryTimer=null,padronAttempts=0;
 function clearPadronRetry(){clearTimeout(padronRetryTimer);padronRetryTimer=null;padronAttempts=0;}
 function armPadronRetry(){
  if(padronRetryTimer||padronAttempts>=10)return;
  padronRetryTimer=setTimeout(()=>{
   padronRetryTimer=null;padronAttempts++;
   if(connection?connectionReadable():readable())queueRefresh();
   else if(padronAttempts<10)armPadronRetry();
  },1000);
 }
 function inactive(){retryOffer(false);clearPadronRetry();clearTimeout(refreshTimer);clearTimeout(timer);clearTimeout(periodicTimer);clearTimeout(expiryTimer);refreshTimer=timer=periodicTimer=expiryTimer=null;expiryToken='';for(const id of ['registroDraftOffer','registroConflictOffer','registroUndoOffer']){const el=document.getElementById(id);if(el)el.hidden=true;}if(typeof registroLocal!=='undefined'&&!registroLocal.matches()){const app=document.getElementById('viewApp');if(app)app.style.display='none';state('La cuenta cambió. Abre Registro nuevamente; las notas anteriores están conservadas.');return;}state('Inicia sesión para cargar tus notas');}
 function armExpiry(){const token=(getLoginSession()||{}).token;if(token===expiryToken)return;expiryToken=token;clearTimeout(expiryTimer);try{const claims=JSON.parse(atob(token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/'))),ms=Number(claims.exp)-Date.now();if(ms>0)expiryTimer=setTimeout(()=>{track();if(!authenticated())inactive();else queueRefresh();},Math.min(ms+1,2147483647));}catch(_){} }
 function queueRefresh(force=false){track();if(connection&&!force){const current=connection.snapshot();if(current.binding===connectionContext()&&['server','offline','review','session','readonly'].includes(current.state)){clearTimeout(refreshTimer);return;}}if(!authenticated()){inactive();return;}armExpiry();if(force){consulted.delete(context());connection?.invalidate();}if(!(connection?connectionReadable():readable())){if(connection&&typeof registroConsultaHistorica==='function'&&registroConsultaHistorica())connection.pause('readonly');const isHist=typeof registroConsultaHistorica==='function'&&registroConsultaHistorica();state(isHist?'Solo lectura':'Esperando el padrón autorizado para cargar tus notas');const label=document.getElementById('registroConnectionText');if(label&&connection?.snapshot().state==='checking')text(label,isHist?'Bimestre cerrado — solo lectura.':'Esperando padrón autorizado…');if(connection)armPadronRetry();return;}clearPadronRetry();clearTimeout(refreshTimer);const binding=context(),epoch=generation;refreshTimer=setTimeout(async()=>{refreshTimer=null;if(binding!==context()||epoch!==track())return;await (connection?connection.check():automatic());if(binding!==context()||epoch!==track()||bajarRegistroNube.resultado?.estado==='fallo')return;try{await offerDraft();}catch(_){state('No se pudo verificar el respaldo local. Conserva esta pestaña.');}},180);}
 function armPeriodic(){if(periodicTimer||!guard())return;const binding=context();periodicTimer=setTimeout(async()=>{periodicTimer=null;if(binding!==context()||!guard())return;await init()?.emergency(true);if(binding===context()&&guard()&&pendingAcademic())armPeriodic();queueRefresh();},300000);}
 function schedule(event){refreshWarning();const target=event?.target;if(!target)return;
  const field=target.closest?.('.cal-nota,.fin-nota,.academic-conclusion,.asis-input,#registroAcademicoPanel input,#registroAcademicoPanel textarea'),button=event.type==='click'&&target.closest?.('[data-val],[data-av],[data-adel],.eq-letter,[data-final-toggle],[onclick*="calificarAreaMasiva"],[onclick*="quitarAreaMasiva"],[onclick*="quitarFinalManual"],[onclick*="activarSesion"],[onclick*="borrarSesion"]');
  const rendered=field?.dataset?.registroContexto||field?.closest?.('#finLista')?.dataset?.registroContexto;if(rendered&&rendered!==cloudClaveReg())return;
  if(!field&&!button)return;if(event.type==='click'&&!button)return;if(!guard())return;const key=context(),sig=button?IERegistroReconcile.signature(sliceRegistroArea()):null;
  if(button&&observed.get(key)===sig)return;observed.set(key,sig);invalidateDraft();armPeriodic();clearTimeout(timer);timer=setTimeout(async()=>{if(key===context()){await init()?.emergency();if(key===context()){observed.set(key,IERegistroReconcile.signature(sliceRegistroArea()));queueRefresh();}}},2500);
 }
 window.IERegistroRecovery={recover,local,upload,drafts,undo,legacy,automatic:connection?()=>connection.check():automatic,resolve:connection?()=>connection.check(true,true):resolve,refresh:queueRefresh,review:offerDraft,diagnostic:()=>diagnostic&&copy(diagnostic)};
 document.addEventListener('DOMContentLoaded',()=>{
  if(typeof registroLocal!=='undefined'){try{const el=document.getElementById('registroLegacyWarning');if(el)el.hidden=!registroLocal.hasLegacy();const button=document.getElementById('registroLegacyReview');if(button){button.hidden=getLoginSession()?.role!=='admin';button.style.display=button.hidden?'none':'inline-flex';}}catch(_){state('No se pudo revisar el almacenamiento anterior. Conserva esta pestaña.');}}
  const review=document.getElementById('registroConnectionReview');if(review)review.onclick=()=>connection?.check(true,true);const backups=document.getElementById('registroConnectionBackups');if(backups)backups.onclick=inspectBackups;
  const footer=document.getElementById('registroAcademicFooter'),fit=()=>{const main=document.querySelector?.('main');if(main&&footer?.getBoundingClientRect){const space=footer.hidden?0:footer.getBoundingClientRect().height+12;main.style.paddingBottom=space+'px';if(document.documentElement?.style)document.documentElement.style.scrollPaddingBottom=space+'px';}};fit();if(typeof ResizeObserver!=='undefined'&&footer)new ResizeObserver(fit).observe(footer);else{window.addEventListener('resize',fit);if(typeof MutationObserver!=='undefined'&&footer)new MutationObserver(fit).observe(footer,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});}
  if(connection){const stop=e=>{const target=e.target;if(connection.canEdit())return;const navigation=target?.closest?.('#registroConnectionReview,#registroConnectionStatus,#areaBtns,#registroAccionesAcademicas,#registro-datos,#transReload,#transAula,#transBim');if(navigation)return;const academic=target?.closest?.('.cal-nota,.fin-nota,.academic-conclusion,.asis-input,[data-av],[data-adel],[data-delfecha],[data-an],[data-val],[data-final-toggle],[data-reg-write],.fin-bulk-actions,#registroTutorPanel input,#registroTutorPanel textarea,#registroTutorPanel button,#registroTutorPanel select');if(academic){e.preventDefault();e.stopImmediatePropagation();}};for(const name of ['beforeinput','click','change'])document.addEventListener(name,stop,true);}
  document.addEventListener('input',schedule);const selected=e=>{const before=activeBinding;schedule(e);if(before!==context()||e.target?.closest?.('#transAula,#transBim'))queueRefresh(true);};document.addEventListener('change',selected);document.addEventListener('click',selected);
  document.addEventListener('click',refreshWarning,true);document.addEventListener('change',refreshWarning,true);window.addEventListener('beforeunload',refreshWarning);
  document.addEventListener('ie22375:registro-ready',()=>queueRefresh());document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')queueRefresh();else connection?.pause('checking');});window.addEventListener('focus',()=>queueRefresh());window.addEventListener('online',()=>queueRefresh(true));window.addEventListener('offline',()=>connection?.pause('offline'));window.addEventListener('storage',e=>{if(['ie22375_session_v1','ie22375_students_session_v1',NOTAS_KEY].includes(e.key)){invalidateDraft();queueRefresh();}});
  if(guard())observed.set(context(),IERegistroReconcile.signature(sliceRegistroArea()));refreshWarning();queueRefresh();

 });
})();
