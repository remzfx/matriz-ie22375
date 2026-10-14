/* Adaptador frontend: operaciones explícitas y timers exclusivamente locales. */
(function(){
 'use strict';let service,timer,offerKey='',lastPeriodic=Date.now(),lastDisk;const observed=new Map();try{lastDisk=localStorage.getItem(NOTAS_KEY);}catch(_){}
 const copy=x=>IERegistroReconcile.copy(x),context=()=>cloudClaveReg()+'|'+((getLoginSession()||{}).token||'');
 const volatileEntries=new Map();
 function pendingTrans(){const token=(getLoginSession()||{}).token,entry=typeof IERegistroTransversales==='undefined'?null:IERegistroTransversales.current?.();if(entry?.dirty)volatileEntries.set(entry,token);return [...volatileEntries].some(([e,t])=>t===token&&e.dirty);}
 function refreshWarning(){const el=document.getElementById('registroEmergencyWarning');if(el){el.hidden=!pendingTrans();el.textContent=el.hidden?'':'Aportes transversales pendientes SIN respaldo de emergencia. Recuperar Nube y Revisar borradores solo protegen el registro académico. No cierres ni cambies de aula, área o bimestre: conserva esta pestaña y confirma el envío de esos aportes.';}}
 const state=text=>{const el=document.getElementById('registroSaveState');refreshWarning();if(el)el.textContent=text+(pendingTrans()?' · Aporte transversal pendiente: conserva esta pestaña.':'');};
 function guard(){const ses=getLoginSession();return !!(ses&&ses.token&&['admin','docente'].includes(ses.role)&&nivel&&areaActual&&areas().includes(areaActual)&&bimestreHabilitado(ctxBase().bim)&&!registroSoloLectura()&&!bimCerradoDocente()&&padronBimestre===ctxBase().bim&&!subirRegistroNube.pending&&!bajarRegistroNube.pending&&document.getElementById('registroTutorPanel')?.hidden!==false);}
 function capture(){
  const persisted=localStorage.getItem(NOTAS_KEY);if(persisted!==lastDisk&&persisted!==JSON.stringify(store))throw Error('Otro registro cambió en este navegador. Conserva las pestañas y revisa antes de guardar.');lastDisk=persisted;
  const invalid=Array.from(document.querySelectorAll('.cal-nota,.fin-nota')).some(el=>{const rendered=el.dataset?.registroContexto||el.closest?.('#finLista')?.dataset?.registroContexto;if(rendered&&rendered!==cloudClaveReg()||el.readOnly)return false;return el.value!==''&&(!Number.isFinite(Number(el.value))||Number(el.value)<0||Number(el.value)>20);});
  if(invalid)throw Error('Nota inválida: conserva esta pestaña y corrige antes de guardar.');
  if(guardarTodo()===false)throw Error('No se confirmó el guardado local. Conserva esta pestaña.');
  lastDisk=localStorage.getItem(NOTAS_KEY);
  const ses=getLoginSession();return {context:context(),key:cloudClaveReg(),owner:ses.user,role:ses.role,payload:copy(sliceRegistroArea()),baseline:copy(baselineAcademica())};
 }
 async function scope(snapshot){const ses=getLoginSession()||{},user=snapshot?snapshot.owner:ses.user,role=snapshot?snapshot.role:ses.role,key=snapshot?snapshot.key:cloudClaveReg();if(!user)throw Error('No se identificó al usuario del respaldo.');const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user+'|'+role));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')+'|'+key;}
 const disk=typeof IERegistroDrafts==='undefined'?null:IERegistroDrafts.storage(window.indexedDB);
 async function backup(snapshot,kind){const key=await scope(snapshot),safe=copy(snapshot);safe.context=snapshot.key;delete safe.owner;delete safe.role;return disk.put(key,safe,kind);}
 function compare(diff,kind){return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:760px;width:calc(100% - 24px);max-height:85vh;border:0;border-radius:14px;padding:16px';
  const title=document.createElement('h2');title.id='registroRecoveryTitle';title.tabIndex=-1;title.textContent=kind==='nube'?'Recuperar Nube':'Recuperar borrador de emergencia';dialog.setAttribute('aria-labelledby',title.id);dialog.append(title);
  const warning=document.createElement('p'),c=ctxBase();warning.textContent='Bimestre '+c.bim+' · '+c.grado+'.º '+c.seccion+' · '+c.area+'. Reemplazo voluntario de notas, evidencias y conclusiones. Se conservará un respaldo verificado. La asistencia local se conserva. No se subirá nada a la nube.';dialog.append(warning);
  const undo=document.createElement('p');undo.textContent='Para deshacer después, incluso al reabrir: pulsa Revisar borradores y compara el respaldo anterior a esta recuperación. No borres los datos locales; los respaldos duran hasta siete días y pueden caducar antes por cuota o límite de 40 snapshots.';dialog.append(undo);
  if(pendingTrans()){const alert=document.createElement('p');alert.style.cssText='background:#fef2f2;color:#991b1b;padding:10px;font-weight:bold';alert.textContent='Tus aportes transversales pendientes NO quedan respaldados ni se recuperan aquí. Esta acción solo reemplaza datos académicos. Conserva la pestaña y confirma el envío de esos aportes antes de cambiar contexto o cerrar.';dialog.append(alert);}
  const list=document.createElement('div');list.style.cssText='overflow:auto;max-height:50vh';
  for(const row of diff){const p=document.createElement('p');p.style.cssText='border-bottom:1px solid #ddd;padding:8px;font-size:12px;overflow-wrap:anywhere';
   const view=['sessions','capsSel'].includes(row.field)?{title:row.field==='sessions'?'Sesiones de evaluación':'Capacidades seleccionadas',local:JSON.stringify(row.local),remote:JSON.stringify(row.remote)}:IERegistroReconcile.conflictView({path:JSON.stringify([row.field,row.key]),local:row.local,remote:row.remote},{roster:estudiantes(),aliases:sliceRegistroArea().meta?.studentAliases});
   p.textContent=view.title+'\nLocal: '+view.local+'\n'+(kind==='nube'?'Nube: ':'Borrador: ')+view.remote;p.style.whiteSpace='pre-wrap';list.append(p);}dialog.append(list);
  const cancel=document.createElement('button'),accept=document.createElement('button');cancel.textContent='Cancelar';accept.textContent='Confirmar reemplazo local';for(const b of [cancel,accept]){b.type='button';b.style.cssText='min-height:44px;margin:6px;padding:8px';dialog.append(b);}
  let done=false;const finish=value=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(value);};cancel.onclick=()=>finish(false);accept.onclick=()=>finish(true);dialog.oncancel=e=>{e.preventDefault();finish(false);};document.body.append(dialog);dialog.showModal();title.focus();
 });}
 async function apply(remote,candidate,local){
  const previous=copy(store),raw=localStorage.getItem(NOTAS_KEY),payload=copy(remote.payload);
  for(const field of ['asistencia','asisFechas','asisFechasEstado'])payload[field]=copy(local.payload[field]||{});
  try{
   aplicarRegistroConciliado(payload,true);const b=baselineAcademica();
   if(!candidate){b.version=remote.version;b.basePayload=copy(remote.payload);b.baseline=IERegistroAcademico.canonical(remote.payload);delete b.attempt;}
   else{const original=candidate.snapshot.baseline||{};b.version=original.version??null;if(original.basePayload)b.basePayload=copy(original.basePayload);else delete b.basePayload;b.baseline=original.baseline||IERegistroAcademico.canonical(local.payload);delete b.attempt;}
   b.recovery={local:copy(local.payload),base:local.baseline.basePayload||null,remote:copy(remote.payload)};saveStore();
   if(localStorage.getItem(NOTAS_KEY)!==JSON.stringify(store))throw Error('No se verificó el reemplazo local.');lastDisk=localStorage.getItem(NOTAS_KEY);dirtyAcademico();pintarRegistroConciliado();
  }catch(e){store=previous;try{if(raw!==null)localStorage.setItem(NOTAS_KEY,raw);}catch(_){}throw Error('Recuperación no confirmada. Borrador conservado; no cierres la pestaña.');}
 }
 function init(){if(!disk)return null;if(!service)service=IERegistroDrafts.controller({context,guard,capture,read:()=>leerEstadoRemotoAcademico(ctxBase(),cloudClaveReg(),(getLoginSession()||{}).token),backup,apply,confirm:compare,state,changed:()=>IERegistroAcademico.canonical(sliceRegistroArea())!==baselineAcademica().baseline,baseline:()=>IERegistroReconcile.signature(baselineAcademica().basePayload||{})});return service;}
 async function recover(){refreshWarning();if(!guard()){state('Recuperación no disponible: revisa sesión, permisos, bimestre y padrón.');return false;}return init()?service.recover():state('Recuperación no disponible. Conserva el borrador.');}
 async function local(){if(!guard())return false;try{capture();if(typeof IERegistroTransversales!=='undefined')IERegistroTransversales.capture();state('Guardado local · pendiente de subir');await init()?.emergency();return true;}catch(e){state(e.message);return false;}}
 async function upload(){if(!guard()||init()?.busy())return false;if(registroNubeNoVerificada()){state('Guardado local pendiente: verifica la conexión y el padrón antes de subir.');return false;}const key=context();state('Guardando localmente…');try{if(!await guardarRegistroIntegrado()){state('Guardado local o aporte pendiente: revisa el aviso y conserva esta pestaña.');return false;}state('Guardado local · pendiente de subir');const ok=await subirRegistroNube();if(key===context())state(ok?'Actualizado en nube':'Guardado local · pendiente de subir: revisa el aviso');return ok;}catch(e){state('No se confirmó la subida. Conserva esta pestaña.');return false;}}
 async function drafts(){refreshWarning();if(!guard()||!init())return false;try{const key=await scope(),rows=await disk.list(key);for(const r of rows){if(!guard()||key!==await scope())return false;if(IERegistroDrafts.differences(sliceRegistroArea(),r.snapshot.payload).length){return service.recover(r);}}state('No hay borradores diferentes para este contexto.');return false;}catch(e){state(e.message);return false;}}
 function schedule(event){refreshWarning();const target=event?.target;if(!target)return;
  const field=target.closest?.('.cal-nota,.fin-nota,.academic-conclusion,.asis-input,#registroAcademicoPanel input,#registroAcademicoPanel textarea'),button=event.type==='click'&&target.closest?.('[data-val],[data-av],[data-adel],.eq-letter,[data-final-toggle],[onclick*="calificarAreaMasiva"],[onclick*="quitarAreaMasiva"],[onclick*="quitarFinalManual"],[onclick*="activarSesion"],[onclick*="borrarSesion"]');
  const rendered=field?.dataset?.registroContexto||field?.closest?.('#finLista')?.dataset?.registroContexto;if(rendered&&rendered!==cloudClaveReg())return;
  if(!field&&!button)return;if(event.type==='click'&&!button)return;if(!guard())return;const key=context(),sig=IERegistroReconcile.signature(sliceRegistroArea());
  if(button&&observed.get(key)===sig)return;observed.set(key,sig);clearTimeout(timer);timer=setTimeout(async()=>{if(key===context()){await init()?.emergency();if(key===context())observed.set(key,IERegistroReconcile.signature(sliceRegistroArea()));}},2500);
 }
 window.IERegistroRecovery={recover,local,upload,drafts};
 document.addEventListener('DOMContentLoaded',()=>{
  const footer=document.getElementById('registroAcademicFooter'),fit=()=>{const main=document.querySelector?.('main');if(main&&footer?.getBoundingClientRect)main.style.paddingBottom=(footer.getBoundingClientRect().height+12)+'px';};fit();if(typeof ResizeObserver!=='undefined'&&footer)new ResizeObserver(fit).observe(footer);else window.addEventListener('resize',fit);
  document.addEventListener('input',schedule);document.addEventListener('change',schedule);document.addEventListener('click',schedule);
  document.addEventListener('click',refreshWarning,true);document.addEventListener('change',refreshWarning,true);window.addEventListener('beforeunload',refreshWarning);
  if(guard())observed.set(context(),IERegistroReconcile.signature(sliceRegistroArea()));refreshWarning();
  setInterval(async()=>{refreshWarning();if(!guard()||!init())return;const binding=context(),key=await scope();if(binding!==context())return;if(key!==offerKey){try{const rows=await disk.list(key);if(binding!==context()||!guard())return;offerKey=key;if(rows.some(r=>IERegistroDrafts.differences(sliceRegistroArea(),r.snapshot.payload).length))state('Hay borradores de emergencia: pulsa Revisar borradores para comparar.');}catch(e){if(binding===context())state(e.message);}}if(Date.now()-lastPeriodic>=300000){lastPeriodic=Date.now();service.emergency(true);}},5000);
 });
})();
