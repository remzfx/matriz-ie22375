/* Precarga N2 progresiva, acotada y separada de la edición. Solo lecturas reservadas en memoria. */
(function(root){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x)),key=c=>[c.nivel,c.bim,c.grado,c.seccion,c.area].join('||');
 const section=s=>['Única','UNICA','ÚNICA'].includes(s)?'ÚNICA':String(s);
 function context(c){
  if(!c||!['primaria','secundaria'].includes(c.nivel)||!['I','II','III','IV'].includes(c.bim)||!Number.isInteger(Number(c.grado))||Number(c.grado)<1||Number(c.grado)>(c.nivel==='primaria'?6:5)||typeof c.seccion!=='string'||!c.seccion||typeof c.area!=='string'||!c.area||/[|\u0000-\u001f]/.test(c.area+c.seccion))throw Error('Contexto de precarga inválido.');
  return Object.freeze({nivel:c.nivel,bim:c.bim,grado:Number(c.grado),seccion:c.seccion,area:c.area});
 }
 function enumerate(profile,rosters,catalog){
  if(profile?.role!=='docente'||!profile.token||!catalog[profile.nivel])return [];
  const result=new Map(),explicit=profile.asignaciones&&Object.keys(profile.asignaciones).length;
  for(const [bim,rows]of Object.entries(rosters||{}))for(const row of rows||[]){
   if(row.nivel!==profile.nivel)continue;
   for(const area of Object.keys(catalog[profile.nivel])){
    if(area==='Competencias Transversales')continue;
    const aula=String(row.grado)+'|'+section(row.seccion);let allowed=false;
    if(explicit)allowed=Array.isArray(profile.asignaciones[area])&&profile.asignaciones[area].some(a=>{const p=String(a).split('|');return p.length===2&&String(Number(p[0].replace('°','')))+'|'+section(p[1])===aula;});
    else if(profile.nivel==='primaria')allowed=(profile.grados||[]).map(Number).includes(Number(row.grado))&&section(row.seccion)==='ÚNICA'&&area!=='Educación Física';
    else allowed=(profile.areas||[]).includes(area)&&(profile.aulas||[]).some(a=>{const p=String(a).split('|');return p.length===2&&String(Number(p[0].replace('°','')))+'|'+section(p[1])===aula;});
    if(profile.nivel==='primaria'&&(!(profile.grados||[]).map(Number).includes(Number(row.grado))||section(row.seccion)!=='ÚNICA'))allowed=false;
    if(allowed){const c=context({nivel:row.nivel,bim,grado:row.grado,seccion:row.seccion,area});result.set(key(c),c);}
   }
  }return [...result.values()];
 }
 function create(o){
  const now=o.now||Date.now,set=o.setTimeout||setTimeout,clear=o.clearTimeout||clearTimeout;
  const limits={maxAge:o.maxAge??300000,maxBytes:o.maxBytes??16*1024*1024,maxReceiptBytes:o.maxReceiptBytes??2*1024*1024,maxReads:o.maxReads??192,maxAttempts:o.maxAttempts??2,gap:o.gap??500,maxContexts:o.maxContexts??256};
  const records=new Map(),receipts=new Map(),holds=new Set(),observed=new Set();
  let identity='',serial=0,task=null,visible='',paused=false,reads=0,avoided=0,timer=null,expiryTimer=null,nextAt=0,peakBytes=0,peakTotalBytes=0,completed=0,cacheHits=0;
  const bytes=()=>[...receipts.values()].reduce((n,r)=>n+r.bytes,0);
  const proof=c=>o.contextIdentity?.(c)||'';
  const overhead=()=>Math.max(0,Number(o.overheadBytes?.())||0),totalBytes=()=>bytes()+overhead();
  function cancel(){serial++;if(task){const t=task;task=null;nextAt=now()+limits.gap;t.entry.state=t.entry.attempts<limits.maxAttempts?'queued':'deferred';t.controller.abort();}}
  function sync(){
   const next=o.identity();if(identity!==next){cancel();clear(timer);clear(expiryTimer);timer=expiryTimer=null;identity=next;records.clear();receipts.clear();holds.clear();observed.clear();visible='';paused=false;reads=avoided=peakBytes=peakTotalBytes=completed=cacheHits=0;nextAt=0;}
  }
  function expiration(){
   clear(expiryTimer);expiryTimer=null;if(!receipts.size)return;
   const deadline=Math.min(...[...receipts.values()].map(r=>r.expires));
   expiryTimer=set(()=>{expiryTimer=null;prune();pump();},Math.max(1,deadline-now()));expiryTimer?.unref?.();
  }
  function prune(){
   sync();for(const [k,r]of receipts)if(r.identity!==identity||r.expires<=now()||r.proof!==proof(r.context)||!o.allowed(r.context)||o.isKnown?.(r.context)){receipts.delete(k);const e=records.get(k);if(e)e.state=o.isKnown?.(r.context)?'known':r.expires<=now()?'expired':'incompatible';}
   expiration();
  }
  const runnable=()=>!paused&&!holds.size&&(!o.canRun||o.canRun());
  function schedule(ms){clear(timer);timer=set(()=>{timer=null;pump();},Math.max(0,ms));timer?.unref?.();}
  function entry(c){const k=key(c);observed.add(k);if(!records.has(k)){if(records.size>=limits.maxContexts)return null;records.set(k,{context:c,state:'queued',attempts:0});}return records.get(k);}
  function select(c){sync();visible=key(c);holds.add('foreground');clear(timer);timer=null;if(task&&key(task.context)!==visible)cancel();}
  function pause(){
   sync();paused=true;cancel();clear(timer);clear(expiryTimer);timer=expiryTimer=null;
   for(const k of receipts.keys()){const e=records.get(k);if(e)e.state=e.attempts<limits.maxAttempts?'queued':'deferred';}receipts.clear();
  }
  function hold(reason){sync();holds.add(reason);cancel();clear(timer);timer=null;}
  function release(reason){sync();holds.delete(reason);pump();}
  async function prefetch(raw){
   sync();prune();const c=context(raw),k=key(c);if(receipts.has(k)){avoided++;return true;}
   if(task){if(key(task.context)===k){avoided++;return task.promise;}return false;}
   const e=entry(c);if(!e||!runnable()||totalBytes()>=limits.maxBytes||reads>=limits.maxReads||e.attempts>=limits.maxAttempts||!o.allowed(c)||['consumed','known','expired','incompatible','failed','deferred'].includes(e.state))return false;
   const actor=identity,id=++serial,signature=o.localSignature(c),local=!!o.hasLocal(c),rosterProof=proof(c),controller=new AbortController();
   const current=()=>actor===o.identity()&&actor===identity&&id===serial&&!paused&&rosterProof===proof(c)&&o.allowed(c);
   const t={context:c,controller,promise:null,entry:e};task=t;e.state='reading';e.attempts++;reads++;
   t.promise=(async()=>{let timeout,aborted;try{
    const cancelled=new Promise((_,reject)=>{aborted=()=>{const error=Error('Lectura cancelada.');error.code='ABORT';reject(error);};controller.signal.addEventListener('abort',aborted,{once:true});timeout=set(()=>{const error=Error('La precarga no respondió.');error.code='TIMEOUT';reject(error);controller.abort();},o.timeout||18000);});
    const r=await Promise.race([o.read(c,controller.signal),cancelled]);if(!current())return false;
    const value=o.validate(r,c);if(value.legacy){e.state='historical';return false;}
    const json=JSON.stringify(value),remoteSignature=o.fingerprint?.(value.payload)||'',cost=(json.length+signature.length+remoteSignature.length)*2;
    if(cost>limits.maxReceiptBytes||totalBytes()+cost>limits.maxBytes){e.state='deferred';return false;}
    receipts.set(k,{context:c,identity:actor,proof:rosterProof,signature,remoteSignature,versions:copy(value.versions),at:now(),expires:now()+limits.maxAge,json,local,bytes:cost});
    e.state='reserved';completed++;peakBytes=Math.max(peakBytes,bytes());peakTotalBytes=Math.max(peakTotalBytes,totalBytes());expiration();return true;
   }catch(error){
    if(actor===o.identity()&&['SESSION','DENIED','ACADEMIC_RESET'].includes(error.code)){pause();o.denied?.(error);}
    else if(current())e.state=error.code==='ABORT'?'queued':'failed';return false;
   }finally{clear(timeout);controller.signal.removeEventListener('abort',aborted);if(task===t){task=null;nextAt=now()+limits.gap;schedule(limits.gap);}}
   })();return t.promise;
  }
  function pump(){
   sync();prune();if(task||!runnable()||reads>=limits.maxReads||totalBytes()>=limits.maxBytes)return;
   if(now()<nextAt){schedule(nextAt-now());return;}
   // Do not spend another read when the remaining memory cannot hold a typical receipt.
   const average=receipts.size?Math.ceil(bytes()/receipts.size):0;if(average&&totalBytes()+average>limits.maxBytes)return;
   for(const e of records.values()){
    if(e.state!=='queued'||key(e.context)===visible)continue;
    if(!o.allowed(e.context)){e.state='incompatible';continue;}
    if(o.isKnown?.(e.context)){e.state='known';avoided++;continue;}
    if(e.attempts>=limits.maxAttempts){e.state='deferred';continue;}
    void prefetch(e.context);return;
   }
  }
  function start(c,candidates){
   sync();visible=key(c);holds.delete('foreground');
   for(const raw of candidates){const candidate=context(raw);if(!o.allowed(candidate))continue;const e=entry(candidate);if(e&&key(candidate)===visible){if(o.isKnown?.(candidate))e.state='known';else if(e.state==='queued')e.state='visible';}else if(e?.state==='visible')e.state=o.isKnown?.(candidate)?'known':'queued';}
   pump();
  }
  async function acquire(c){
   sync();select(c);if(task&&key(task.context)===key(c))await task.promise;
   prune();const k=key(c),r=receipts.get(k);if(!r)return null;
   receipts.delete(k);const e=records.get(k);if(e)e.state='consumed';expiration();
   if(paused||r.identity!==identity||r.proof!==proof(c)||!o.allowed(c))return null;
   if(r.local||o.hasLocal(c)||r.signature!==o.localSignature(c)){const error=Error('Existe trabajo local protegido. La reserva no lo reemplazó; requiere revisión.');error.code='PREFETCH_LOCAL';throw error;}
   cacheHits++;return {response:JSON.parse(r.json),signature:r.signature};
  }
  function stats(){
   sync();prune();const states={};for(const e of records.values())states[e.state]=(states[e.state]||0)+1;
   return {reads,avoided,cacheHits,enumerated:observed.size,admitted:records.size,deferredContexts:observed.size-records.size,completed,pending:!!task,reserved:!!receipts.size,reservations:receipts.size,retainedBytes:bytes(),totalRetainedBytes:totalBytes(),peakBytes,peakTotalBytes,queued:states.queued||0,states,paused,holds:[...holds],budgetExhausted:reads>=limits.maxReads,limits:{...limits},target:task?key(task.context):null};
  }
  return {start,select,prefetch,acquire,pause,hold,release,availableBytes:()=>Math.max(0,limits.maxBytes-totalBytes()),resume(){sync();paused=false;},stats,dispose(){pause();records.clear();holds.clear();clear(timer);clear(expiryTimer);}};
 }
 const api={key,context,enumerate,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IERegistroNotas2Prefetch=api;
})(typeof window==='undefined'?globalThis:window);
