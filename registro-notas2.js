/* Notas 2.0: contrato por panel y sesión en memoria. Sin DOM ni almacenamiento persistente. */
(function(root){
 'use strict';
 const fields={calificar:['sessions','grades','capsSel','calificarEstado'],promedios:['finales','concComp','competenciasEstado'],asistencia:['asistencia','asisFechas','asisFechasEstado']};
 const copy=x=>JSON.parse(JSON.stringify(x));
 function fail(code,message){const e=Error(message);e.code=code;throw e;}
 function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>k!=='ts').sort().map(k=>[k,stable(value[k])]));return value;}
 const signature=value=>JSON.stringify(stable(value));
 function panel(payload,name){if(!fields[name])fail('PANEL','Panel académico inválido.');return Object.fromEntries(fields[name].map(f=>[f,copy(payload[f]||(f==='sessions'?[]:{}))]));}
 function validPayload(p){return p&&typeof p==='object'&&!Array.isArray(p)&&Array.isArray(p.sessions)&&Object.values(fields).flat().filter(f=>f!=='sessions').every(f=>p[f]&&typeof p[f]==='object'&&!Array.isArray(p[f]))&&p.sessions.every(s=>s&&typeof s==='object'&&!Array.isArray(s))&&['grades','finales','concComp','competenciasEstado','calificarEstado'].every(f=>Object.values(p[f]).every(v=>v&&typeof v==='object'&&!Array.isArray(v)));}
 function process(payload,o){
  const next=copy(payload),prefix=[o.context.nivel,o.context.bim,o.context.grado,o.context.seccion,o.context.area].join('||')+'||';
  next.finales=next.finales||{};next.competenciasEstado=next.competenciasEstado||{};
  for(const comp of o.competencies){
   const k=prefix+comp,worked=(payload.calificarEstado||{})[k]?.trabajada!==false;
   next.competenciasEstado[k]={trabajada:worked,ts:o.now()};
   if(!worked)continue;
   for(const id of o.students){const result=o.calculate(payload,comp,id),key=k+'||'+id;
    if(result.nota===''||result.nota==null)next.finales[key]={borrado:true,ts:o.now()};
    else next.finales[key]={nota20:result.nota,nivel:result.letra,origen:'numero',ts:o.now()};
   }
  }
  return next;
 }
 // An absent worked flag and an explicit true have the same existing academic meaning.
 function readSignature(part){
  for(const field of ['calificarEstado','competenciasEstado'])if(part[field])part[field]=Object.fromEntries(Object.entries(part[field]).filter(([,v])=>v.trabajada!==true));
  return signature(part);
 }
 function create(o){
  const initialBinding=o.binding(),entries=Object.fromEntries(Object.keys(fields).map(n=>[n,null]));let state='checking',flight=false,closed=false,epoch=0,legacy=false,processed=false,serverClosed=true;
  const same=()=>!closed&&o.binding()===initialBinding;
  const pending=name=>!!entries[name]&&signature(panel(o.capture(),name))!==entries[name].signature;
  function status(){return {state,busy:flight,legacy,processed,readonly:serverClosed,panels:Object.fromEntries(Object.keys(fields).map(n=>[n,{pending:pending(n),version:entries[n]?.version??null,at:entries[n]?.at??null}]))};}
  function emit(next){state=next;o.changed?.(status());}
  function readable(){if(!same()||!o.authorized())fail('SESSION','La sesión o el contexto cambió.');}
  async function request(body){
   readable();const controller=new AbortController();let timer;
   try{return await Promise.race([o.request(body,{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const e=Error('El servidor no respondió a tiempo.');e.code='TIMEOUT';reject(e);},o.timeout||18000);})]);}
   finally{clearTimeout(timer);}
  }
  function validate(r){
   if(!r||r.ok!==true)fail(r?.code||'SERVER',r?.error||'No se confirmó la operación.');
   if(r.notas2!==1||typeof r.readonly!=='boolean'||typeof r.legacy!=='boolean'||r.key!==o.key||!validPayload(r.payload)||!Object.keys(fields).every(n=>Number.isSafeInteger(r.versions?.[n])&&r.versions[n]>=0&&(r.at?.[n]===null||Number.isFinite(r.at?.[n]))))fail('INCOMPLETE','Respuesta académica incompleta; no se reemplazaron datos.');
   readable();return r;
  }
  async function load(options={}){
   if(flight)return false;readable();const id=++epoch,names=options.panel?[options.panel]:Object.keys(fields);names.forEach(n=>panel({},n));
   if(!same()||id!==epoch)return false;
   const previousState=state;flight=true;emit('checking');
   try{
    const r=validate(await request({action:'loadnotas2'}));if(id!==epoch)return false;
    // Validate every panel before confirmation or any application, including a manual single-panel read.
    for(const name of Object.keys(fields)){
     const entry=entries[name];if(!entry)continue;
     if(r.versions[name]<entry.version)fail('STALE_READ','La lectura recibida es anterior a una versión confirmada. Datos conservados; vuelve a verificar.');
     if(r.versions[name]===entry.version&&readSignature(panel(r.payload,name))!==readSignature(JSON.parse(entry.signature)))fail('INCONSISTENT_READ','La misma versión contiene datos contradictorios. Datos conservados; requiere verificación.');
    }
    if(r.exists!==true&&r.exists!==false)fail('INCOMPLETE','Falta la confirmación de existencia del registro.');
    if(!r.exists&&names.some(n=>entries[n]?.hasContent||!entries[n]&&o.hasExisting?.(n)))fail('MISSING','No existe una copia remota válida. Información anterior conservada.');
    for(const name of names){const part=panel(r.payload,name),meaningful=name==='calificar'?!!(part.sessions.length||Object.keys(part.grades).length):name==='promedios'?!!(Object.keys(part.finales).length||Object.keys(part.concComp).length):!!Object.keys(part.asistencia).length;if(!meaningful&&(entries[name]?.hasContent||!entries[name]&&o.hasExisting?.(name)))fail('EMPTY','Lectura vacía inesperada. La información anterior se conserva.');}
    if(options.manual&&!await o.confirm?.({panels:names,at:r.at})){emit(previousState);return false;}readable();if(id!==epoch)return false;
    serverClosed=r.readonly;legacy=r.legacy;
    const changed=options.verify&&names.some(n=>pending(n)&&r.versions[n]!==entries[n].version);
    if(changed){emit('conflict');return false;}
    const apply=names.filter(n=>!options.verify||!pending(n));
    const updates=Object.assign({},...apply.map(n=>panel(r.payload,n)));
    // Apply is a synchronous atomic adapter; no partial DOM/persistence work here.
    if(apply.length)o.apply(copy(updates));
    for(const name of apply)entries[name]={version:r.versions[name],at:r.at[name],signature:signature(panel(r.payload,name)),hasContent:name==='calificar'?!!(r.payload.sessions.length||Object.keys(r.payload.grades).length):name==='promedios'?!!(Object.keys(r.payload.finales).length||Object.keys(r.payload.concComp).length):!!Object.keys(r.payload.asistencia).length};
    emit('ready');return true;
   }catch(e){if(same())emit(['SESSION','DENIED'].includes(e.code)?'session':e.code==='CONFLICT'?'conflict':'server');o.error?.(e);return false;}
   finally{flight=false;o.changed?.(status());}
  }
  async function save(name){
   panel({},name);if(flight||state!=='ready'||!same()||!o.authorized()||o.readonly()||serverClosed||legacy&&name!=='asistencia'&&(name!=='promedios'||!processed))return false;
   const entry=entries[name];if(!entry)return false;
   const sent=panel(o.capture(),name),id=++epoch;flight=true;o.changed?.(status());
   try{
    const r=validate(await request({action:'savenotas2',panel:name,version:entry.version,payload:sent}));
    if(id!==epoch||r.panel!==name||!Number.isFinite(r.at[name])||r.versions[name]<entry.version||r.versions[name]===entry.version&&signature(sent)!==entry.signature||signature(panel(r.payload,name))!==signature(sent))fail('INCOMPLETE','Confirmación de guardado inválida.');
    // Never overwrite edits made during the request or confirm the other panel.
    entries[name]={version:r.versions[name],at:r.at[name],signature:signature(sent),hasContent:name==='calificar'?!!(sent.sessions.length||Object.keys(sent.grades).length):name==='promedios'?!!(Object.keys(sent.finales).length||Object.keys(sent.concComp).length):!!Object.keys(sent.asistencia).length};legacy=r.legacy;if(name==='promedios')processed=false;serverClosed=r.readonly;emit('ready');return true;
   }catch(e){if(same())emit(['SESSION','DENIED'].includes(e.code)?'session':e.code==='CONFLICT'?'conflict':'server');o.error?.(e);return false;}
   finally{flight=false;o.changed?.(status());}
  }
  function processToAverages(options){if(flight||state!=='ready'||!same()||!o.authorized()||o.readonly()||serverClosed)return false;const before=o.capture(),next=process(before,options);o.apply(panel(next,'promedios'));processed=true;o.changed?.(status());return true;}
  return {load,save,process:processToAverages,pending,status,canEdit:(name)=>state==='ready'&&!flight&&same()&&o.authorized()&&!o.readonly()&&!serverClosed&&(!legacy||name==='asistencia'||name==='promedios'&&processed),pause(){epoch++;emit('offline');},close(){closed=true;epoch++;emit('session');}};
 }
 const api={fields,panel,signature,validPayload,process,create};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IERegistroNotas2=api;
})(typeof window==='undefined'?globalThis:window);
