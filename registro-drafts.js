/* Borradores locales y recuperación voluntaria; no contiene transporte de escritura. */
(function(root){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x)),ttl=7*86400000;
 function storage(indexedDB,now=Date.now){
  let connection;
  async function db(){if(!indexedDB)throw Error('IndexedDB no disponible. Conserva esta pestaña.');if(!connection)connection=new Promise((resolve,reject)=>{const r=indexedDB.open('ie22375_emergency_v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('No se pudo abrir el respaldo local.'));r.onblocked=()=>reject(Error('Respaldo local bloqueado.'));});return connection;}
  async function run(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('drafts',mode);let result;const r=fn(t.objectStore('drafts'));r.onsuccess=()=>result=r.result;r.onerror=()=>reject(Error('No se pudo leer/escribir el respaldo.'));t.oncomplete=()=>resolve(result);t.onabort=t.onerror=()=>reject(Error('No se confirmó el respaldo persistente.'));});}
  async function list(scope){return (await run('readonly',s=>s.getAll())).filter(r=>r.scope===scope&&now()-r.created<ttl).sort((a,b)=>b.created-a.created);}
  async function put(scope,snapshot,kind='emergency'){
   const created=now(),record={id:scope+'|'+created+'|'+Math.random().toString(36).slice(2),scope,created,kind,snapshot:copy(snapshot)};
   await run('readwrite',s=>s.put(record));const read=await run('readonly',s=>s.get(record.id));if(JSON.stringify(read)!==JSON.stringify(record))throw Error('No se verificó el respaldo persistente.');
   const all=await run('readonly',s=>s.getAll()),own=all.filter(r=>r.scope===scope).sort((a,b)=>b.created-a.created);
   // Solo borra snapshots de esta base dedicada, nunca notas oficiales/localStorage.
   for(const r of own.filter((r,i)=>r.id!==record.id&&(now()-r.created>=ttl||i>=39)))await run('readwrite',s=>s.delete(r.id));
   return record;
  }
  return {put,list};
 }
 function differences(local,remote){const out=[];for(const field of ['grades','finales','concComp','concArea','competenciasEstado','sessions','capsSel']){
   const l=local[field]||{},r=remote[field]||{};if(Array.isArray(l)||Array.isArray(r)){if(root.IERegistroReconcile.signature({[field]:l})!==root.IERegistroReconcile.signature({[field]:r}))out.push({field,key:'Sesiones',local:l,remote:r});continue;}
   for(const key of [...new Set([...Object.keys(l),...Object.keys(r)])].sort())if(!root.IERegistroReconcile.equal(l[key],r[key]))out.push({field,key,local:l[key],remote:r[key]});
  }return out;}
 function controller(d){let busy=false,saving=false,lastSignature=null;
  const signature=x=>root.IERegistroReconcile.signature(x.payload);
  const valid=(initial)=>d.guard()&&d.context()===initial.context&&signature(d.capture())===signature(initial);
  async function recover(candidate){if(saving){d.state('Espera mientras se verifica el respaldo local.');return false;}if(busy||!d.guard())return false;busy=true;try{
   const validSource=()=>!candidate?.validate||candidate.validate();
   const local=copy(d.capture()),remote=candidate?{payload:candidate.snapshot.payload,version:null,exists:true}:await d.read();
   if(!valid(local)||!validSource())throw Error('El contexto o borrador cambió. Recuperación cancelada.');
   const undo=!!(candidate?.undo&&candidate.kind==='before-recovery');
   if(!remote.exists||!remote.payload||(!undo&&!['grades','finales','concComp','concArea','sessions','competenciasEstado','capsSel'].some(k=>Object.keys(remote.payload[k]||{}).length)))throw Error('No hay notas/evidencias recuperables confirmadas. No se reemplazaron notas.');
   const diff=differences(local.payload,remote.payload);if(!diff.length){d.state('Sin diferencias de notas.');return true;}
   if(!await d.confirm(diff,undo?'undo':candidate?.kind==='legacy'?'legacy':candidate?'borrador':'nube'))return false;
   if(!valid(local)||!validSource())throw Error('El borrador cambió durante la comparación.');
   const backup=await d.backup(local,'before-recovery');if(!valid(local)||!validSource())throw Error('Cambió el contexto mientras se verificaba el respaldo.');
   if(!candidate){const check=await d.read();if(check.version!==remote.version||root.IERegistroReconcile.signature(check.payload)!==root.IERegistroReconcile.signature(remote.payload))throw Error('La nube cambió. Compara nuevamente antes de recuperar.');}
   if(!valid(local)||!validSource())throw Error('Cambió el borrador o los permisos.');
   await d.apply(remote,candidate,local,backup);d.state('Cambios pendientes de subir');return true;
  }catch(e){d.state(e.message);return false;}finally{busy=false;}}
  async function emergency(periodic=false){if(busy||saving||!d.guard())return false;saving=true;let snapshot;try{snapshot=copy(d.capture());const sig=signature(snapshot);if(!periodic&&sig===lastSignature)return false;if(periodic&&(d.changed?!d.changed():sig===d.baseline()))return false;await d.backup(snapshot,periodic?'periodic':'emergency');if(d.context()!==snapshot.context||!d.guard())return false;lastSignature=sig;d.state((d.changed?!d.changed():sig===d.baseline())?'Guardado en esta computadora':'Cambios pendientes de subir');return true;}catch(e){if(!snapshot||d.context()===snapshot.context)d.state(e.message);return false;}finally{saving=false;}}
  return {recover,emergency,busy:()=>busy||saving};
 }
 root.IERegistroDrafts={storage,controller,differences,ttl};if(typeof module!=='undefined')module.exports=root.IERegistroDrafts;
})(typeof window==='undefined'?globalThis:window);
