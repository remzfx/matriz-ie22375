/* Reset-aware transport. No cleanup until the authenticated server confirms a reset.
 * Never uploads grades or clears profiles/caches. Attendance remains accessible.
 */
(function(root){
 'use strict';
 const marker='ie22375_academic_epoch_v1',model=root.IEAcademicReset;
 const academic=new Set(['loadnotas2','savenotas2','savereg','savearea','loadreg','loadnivel','load','loadtransversales','loadtransversalesaulas','loadtransversalexport','savetransversalaporte','savetransversalfinal','procesartransversales']);
 function localValue(key,value,epoch){return epoch&&value.academicEpoch!==epoch?{...model.local(key,value),academicEpoch:epoch}:value;}
 async function sanitizeStorage(storage,epoch){
  const changes=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!model.localKey(key))continue;const raw=storage.getItem(key),next=JSON.stringify(localValue(key,JSON.parse(raw),epoch));changes.push({key,raw,next});}
  // Validate everything before replacing anything; no new archive/undo copy on disk.
  for(const c of changes){if(storage.getItem(c.key)!==c.raw)throw Error('Otra pestaña modificó el registro.');storage.setItem(c.key,c.next);if(storage.getItem(c.key)!==c.next)throw Error('No se confirmó la retirada local.');}
 }
 async function sanitizeDrafts(indexedDB,epoch){
  if(!indexedDB)return;
  // Open only this dedicated DB, never delete it or databases belonging to attendance.
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('ie22375_emergency_v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=r.onblocked=()=>reject(Error('No se pudo verificar el borrador local.'));});
  try{await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),r=store.getAll();r.onsuccess=()=>{try{for(const row of r.result)if(row.academicEpoch!==epoch)store.put({...model.clean(row),academicEpoch:epoch});}catch(e){tx.abort();reject(e);}};tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('No se confirmó la retirada del borrador.'));});}finally{db.close();}
 }
 function install(o){
  const native=o.fetch;let pageEpoch=o.local.getItem(marker),flight=null,blocked=false,draftsVerified=false;
  function stop(){blocked=true;const e=Error('Reinicio académico: vuelve a abrir el módulo. Asistencia conservada.');e.code='ACADEMIC_RESET';throw e;}
  async function accept(data){
   if(blocked)stop();
   if(!data?.ok||data.academicReset!==1||!(data.epoch===null||/^[a-f0-9]{32}$/.test(data.epoch)))throw Error('No se verificó el estado académico.');
   if(data.epoch&&data.phase!=='complete')throw Error('Limpieza académica en curso. Escrituras pausadas.');
   if(data.epoch&&data.epoch!==pageEpoch){
    await sanitizeStorage(o.local,data.epoch);await sanitizeStorage(o.session,data.epoch);await sanitizeDrafts(o.indexedDB,data.epoch);
    o.local.setItem(marker,data.epoch);if(o.local.getItem(marker)!==data.epoch)throw Error('No se confirmó la nueva generación local.');
    blocked=true;o.reload();stop();
   }
   if(data.epoch&&!draftsVerified){await sanitizeDrafts(o.indexedDB,data.epoch);draftsVerified=true;}
   return data.epoch;
  }
  async function ensure(url,token){
   if(blocked)stop();if(!flight)flight=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
     const r=await native(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',signal:controller.signal,body:JSON.stringify({action:'academicstate',token})});
     if(!r.ok)throw Error('No se verificó el estado académico.');return accept(await r.json());
    }finally{clearTimeout(timer);}
   })().finally(()=>{flight=null;});return flight;
  }
  async function fetch(url,options){
   let body;try{body=JSON.parse(options?.body);}catch(_){return native(url,options);}
   const action=String(body.action||'').toLowerCase();if(!academic.has(action)||!body.token)return native(url,options);
   // Attendance-only saves never need an academic generation or academic cleanup.
   if(action==='savenotas2'&&body.panel==='asistencia')return native(url,options);
   const epoch=await ensure(url,body.token);
   return native(url,{...options,body:JSON.stringify({...body,...(epoch?{academicEpoch:epoch}:{})})});
  }
  return {fetch,ensure,accept,epoch:()=>pageEpoch};
 }
 const api={install,sanitizeStorage,sanitizeDrafts,localValue,marker};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else if(model&&root.fetch&&root.localStorage){
  const prototype=root.Storage.prototype,get=prototype.getItem,set=prototype.setItem;
  const storage=s=>({get length(){return s.length;},key:i=>s.key(i),getItem:k=>get.call(s,k),setItem:(k,v)=>set.call(s,k,v)});
  const controller=install({fetch:root.fetch.bind(root),local:storage(root.localStorage),session:storage(root.sessionStorage),indexedDB:root.indexedDB,reload:()=>root.location.reload()});
  // An old tab can rewrite a pre-reset disk entry after cleanup. New readers reject its
  // missing/older generation before the application can load any grades from it.
  prototype.getItem=function(key){const raw=get.call(this,key),epoch=controller.epoch();if(raw&&model.localKey(key)&&epoch){const next=JSON.stringify(localValue(key,JSON.parse(raw),epoch));if(next!==raw)set.call(this,key,next);return next;}return raw;};
  prototype.setItem=function(key,value){const epoch=controller.epoch();if(model.localKey(key)&&epoch)value=JSON.stringify({...JSON.parse(value),academicEpoch:epoch});return set.call(this,key,value);};
  root.fetch=controller.fetch;root.IEAcademicResetClient=controller;
 }
})(typeof window==='undefined'?globalThis:window);
