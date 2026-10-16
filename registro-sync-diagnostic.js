/* Optional, manual read-only diagnostic. Never loaded automatically; no writes/backups/logs. */
(function(root){
 'use strict';
 const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const modules={grades:'calificar',sessions:'calificar',capsSel:'calificar',finales:'promedios',concComp:'conclusiones',concArea:'conclusiones',asistencia:'asistencia',asisFechas:'asistencia',asisFechasEstado:'asistencia',competenciasEstado:'configuracion'};
 const count=p=>Object.fromEntries(['sessions','grades','finales','concComp','asistencia','capsSel'].map(f=>[f,Object.keys(p?.[f]||{}).length]));
 const safeCode=e=>['SESSION','DENIED','CLOSED','TIMEOUT','HTTP','READ_INVALID','READ_MISSING','READ_STALE','READ_VERSION','READ_INCOMPLETE','READ_EMPTY','READ_BASE','READ_CORRUPT','CONTEXT_CHANGED','UNAVAILABLE','DUPLICATE','API_INCOMPATIBLE'].includes(e?.code)?e.code:'UNAVAILABLE';
 function analyze(input){
  const {reconcile:r,identity,model}=input.apis,local=copy(input.local),remote=copy(input.remote),baseline=copy(input.baseline||{}),context=copy(input.context);
  const result={schema:1,readOnly:true,counts:{local:count(local),cloud:count(remote.payload)},period:{server:['abierto','cerrado','bloqueado'].includes(input.period)?input.period:'desconocido',closed:['abierto','cerrado','bloqueado'].includes(input.period)?['cerrado','bloqueado'].includes(input.period):null},connection:{state:['checking','connected','pending','offline','server','review','session','readonly'].includes(input.connection?.state)?input.connection.state:'desconocido',leaseExpired:!!input.connection?.leaseExpired,retentionFailed:!!input.connection?.retentionFailed},conflicts:{total:0,byModule:{},causes:{},fields:{}},identities:{unresolvedLocal:0,unresolvedCloud:0},versions:{local:Number.isFinite(baseline.version)?baseline.version:null,cloud:Number.isFinite(remote.version)?remote.version:null},legacyLocal:!!input.legacyLocal,diskMatchesMemory:input.diskMatchesMemory??null,domChangedControls:input.domChangedControls||0,status:'unverified'};
  const add=(object,k)=>object[k]=(object[k]||0)+1;
  try{
   r.validateRemote(remote,baseline);
   let base=baseline.basePayload||null;
   if(baseline.attempt&&model.canonical(remote.payload)===model.canonical(baseline.attempt.payload)&&remote.version>baseline.attempt.version)base=baseline.attempt.local;
   const l=identity.project(local,input.roster,context,input.competencies,base),p=identity.project(remote.payload,input.roster,context,input.competencies,base);
   result.identities.unresolvedLocal=l.unresolved.length;result.identities.unresolvedCloud=p.unresolved.length;
   const plan=r.academicPlan(base,local,remote.payload,input.roster,context,input.competencies,{sharedAttendance:true,reviewAbsence:true,cleanAcademic:baseline.version!=null&&model.canonical(local)===baseline.baseline});
   result.conflicts.total=plan.conflicts.length;
   for(const c of plan.conflicts){
    const causes=new Set(),changedFields=new Set(),paths=c.paths||[c.path],fields=new Set(paths.map(path=>JSON.parse(path)[0])),affected=new Set([...fields].map(f=>modules[f]||'otros'));
    if(c.candidates)affected.add('identidades');for(const m of affected)add(result.conflicts.byModule,m);
    const values=c.candidates?c.candidates.map(x=>x.value):[c.local,c.remote];let found=false;
    for(let i=1;i<values.length;i++){
     const a=values[0],b=values[i];if(r.equal(a,b))continue;
     if(a===undefined||b===undefined){causes.add('ausencia_sin_borrado');found=true;continue;}
     if(a?.borrado||b?.borrado){causes.add('borrado');found=true;}
     for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){
      if(['ts','_ts','registroVersion'].includes(k)||k==='nota20'&&a?.origen==='letra'&&b?.origen==='letra'||r.equal(a?.[k],b?.[k]))continue;
      // Never export arbitrary keys, values, paths, names, IDs or text from records.
      changedFields.add(['nivel','nota20','origen','borrado','texto','trabajada','marca','hora'].includes(k)?k:'campo_adicional');
      const cause=k==='origen'?'origen':k==='nota20'?(a?.origen==='numero'&&b?.origen==='numero'&&typeof a[k]==='number'&&typeof b[k]==='number'?'numero_exacto':typeof a?.[k]!==typeof b?.[k]?'tipo':'referencia_o_origen_no_verificado'):'contenido';causes.add(cause);found=true;
     }
    }
    if(c.candidates)causes.add('representaciones_verificadas_sin_vigencia');
    if(!found)causes.add('revision_de_conjunto');for(const cause of causes)add(result.conflicts.causes,cause);for(const field of changedFields)add(result.conflicts.fields,field);
   }
   result.status=plan.conflicts.length?'review':'no_conflicts';
   result.pendingEquivalentToCloud=!plan.conflicts.length?r.signature(plan.resolve())===r.signature(plan.remote):null;
  }catch(e){result.status='read_rejected';result.code=safeCode(e);}
  result.blocks={period:result.period.closed,synchronization:result.status!=='no_conflicts'||!result.pendingEquivalentToCloud||['checking','offline','server','review','session','desconocido'].includes(result.connection.state)||result.connection.leaseExpired||result.connection.retentionFailed};
  return result;
 }
 function snapshot(){
  const session=getLoginSession(),c=ctxBase(),key=[c.nivel,c.bim,c.grado,c.seccion,c.area].join('||'),prefix=key+'||',aula=[c.nivel,c.bim,c.grado,c.seccion].join('||');
  if(!session?.token||!['admin','docente'].includes(session.role)||!registroLocal.matches()||tokenPadron!==session.token||padronBimestre!==c.bim)throw {code:'SESSION'};
  const local={modeloAcademico:1,sessions:(store.sessions||[]).filter(s=>[s.nivel,s.bim,s.grado,s.seccion,s.area].join('||')===key),asisFechas:{[aula]:store.asisFechas?.[aula]||[]}};
  for(const f of ['grades','finales','concComp','concArea','competenciasEstado','capsSel','asistencia','asisFechasEstado'])local[f]=Object.fromEntries(Object.entries(store[f]||{}).filter(([k])=>k.startsWith((['asistencia','asisFechasEstado'].includes(f)?aula+'||':prefix))));
  const meta=store.meta?.[key];local.meta={...(meta&&typeof meta==='object'?meta:{docente:meta||''}),studentAliases:store.studentAliases?.[[c.nivel,c.grado,c.seccion].join('||')]||{}};
  const roster=(bdEstudiantes[c.nivel]?.estudiantes||[]).filter(a=>String(a.grado)===String(c.grado)&&a.seccion===c.seccion);
  const controls=Array.from(document.querySelectorAll('.cal-nota,.fin-nota,.academic-conclusion,.asis-input'),n=>({value:n.value,initial:n.defaultValue}));
  const connection=root.IERegistroConnection?.current()?.snapshot(),b=store.academicSync?.[key]||{};
  return copy({context:c,key,session,local,baseline:{version:b.version,basePayload:b.basePayload,baseline:b.baseline,attempt:b.attempt},roster,competencies:competencias(),connection:{state:connection?.state,leaseExpired:connection?.validUntil?Date.now()>=connection.validUntil:false,retentionFailed:connection?.retentionFailed},legacyLocal:!!localStorage.getItem('ie22375_registro_notas_v2'),diskMatchesMemory:localStorage.getItem(NOTAS_KEY)===JSON.stringify(store),domChangedControls:controls.filter(x=>x.value!==x.initial).length,controls});
 }
 async function runPage(){
  // The returned object is aggregated/redacted; raw snapshots live only in this invocation.
  let before;try{before=snapshot();}catch(e){return {schema:1,readOnly:true,status:'unavailable',code:safeCode(e)};}
  const stamp=JSON.stringify({...before,connection:undefined}),current=()=>JSON.stringify({...snapshot(),connection:undefined})===stamp;
  async function read(action){
   const body={action,token:before.session.token,...(action==='loadreg'?{nivel:before.context.nivel,bimestre:before.context.bim,grado:String(before.context.grado),seccion:before.context.seccion,area:before.context.area}:{})};
   const response=await fetch(CLOUD_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw {code:'HTTP'};const data=await response.json();if(!data?.ok)throw {code:data?.code};return data;
  }
  try{
   const data=await read('loadreg'),period=await read('loadperiodos');if(!current())throw {code:'CONTEXT_CHANGED'};
   if(!data.soportaModeloAcademico||data.identidadAcademica!==1)throw {code:'API_INCOMPATIBLE'};
   if(!Array.isArray(data.items))throw {code:'READ_INVALID'};const rows=data.items.filter(x=>x.clave===before.key);if(rows.length>1)throw {code:'DUPLICATE'};
   const row=rows[0];if(row&&(typeof row.ts!=='number'||!Number.isFinite(row.ts)||row.ts<0))throw {code:'READ_INVALID'};
   const status=period.periodos?.bimestres?.[before.context.bim];
   const report=analyze({...before,connection:snapshot().connection,remote:{version:row?row.ts:0,payload:row?row.payload:{},exists:!!row},period:['abierto','cerrado','bloqueado'].includes(status)?status:undefined,apis:{reconcile:root.IERegistroReconcile,identity:root.IEAcademicIdentity,model:root.IERegistroAcademico}});
   if(!current())throw {code:'CONTEXT_CHANGED'};return report;
  }catch(e){return {schema:1,readOnly:true,status:'unavailable',code:e?.name==='TimeoutError'?'TIMEOUT':safeCode(e)};}
 }
 root.IERegistroSyncDiagnostic={analyze,runPage};if(typeof module!=='undefined')module.exports=root.IERegistroSyncDiagnostic;
})(typeof window==='undefined'?globalThis:window);
