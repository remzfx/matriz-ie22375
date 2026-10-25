/* Precarga N2 limitada a una segunda aula. Solo lecturas reservadas en memoria. */
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
    if(profile.nivel==='primaria'&&!(profile.grados||[]).map(Number).includes(Number(row.grado)))allowed=false;
    if(allowed){const c=context({nivel:row.nivel,bim,grado:row.grado,seccion:row.seccion,area});result.set(key(c),c);}
   }
  }return [...result.values()];
 }
 function create(o){
  let identity='',serial=0,task=null,receipt=null,target=null,attempted=false,paused=false,reads=0;
  const now=o.now||Date.now,maxAge=o.maxAge||90000,maxBytes=o.maxBytes||2*1024*1024;
  function sync(){const next=o.identity();if(identity!==next){identity=next;serial++;task?.controller.abort();task=null;receipt=null;target=null;attempted=false;paused=false;}return next;}
  function select(c){sync();const k=key(c);if(task&&key(task.context)!==k){serial++;task.controller.abort();task=null;}}
  function pause(){sync();serial++;task?.controller.abort();task=null;receipt=null;paused=true;}
  async function prefetch(raw){
   sync();const c=context(raw);if(paused||task||receipt||!o.allowed(c)||o.hasLocal(c))return false;
   const actor=identity,id=++serial,signature=o.localSignature(c),controller=new AbortController();
   const current=()=>actor===o.identity()&&actor===identity&&id===serial&&!paused&&o.allowed(c);
   const t={context:c,controller,promise:null};task=t;reads++;
   t.promise=(async()=>{let timer,aborted;try{
    const cancelled=new Promise((_,reject)=>{aborted=()=>{const e=Error('Lectura cancelada.');e.code='ABORT';reject(e);};controller.signal.addEventListener('abort',aborted,{once:true});timer=(o.setTimeout||setTimeout)(()=>{const e=Error('La precarga no respondió.');e.code='TIMEOUT';reject(e);controller.abort();},o.timeout||18000);});
    const r=await Promise.race([o.read(c,controller.signal),cancelled]);if(!current())return false;
    const value=o.validate(r,c);if(value.legacy)return false;
    const json=JSON.stringify(value);if(json.length*2>maxBytes)return false;
    receipt={context:c,identity:actor,signature,at:now(),json};return true;
   }catch(e){if(actor===o.identity()&&['SESSION','DENIED','ACADEMIC_RESET'].includes(e.code)){pause();o.denied?.(e);}return false;}finally{(o.clearTimeout||clearTimeout)(timer);controller.signal.removeEventListener('abort',aborted);if(task===t)task=null;}})();return t.promise;
  }
  function start(visible,candidates){
   sync();if(paused||attempted)return;
   if(!target)target=candidates.find(c=>c.nivel===visible.nivel&&c.bim===visible.bim&&(Number(c.grado)!==Number(visible.grado)||section(c.seccion)!==section(visible.seccion))&&o.allowed(c)&&!o.hasLocal(c));
   if(target&&key(target)!==key(visible)){attempted=true;void prefetch(target);}
  }
  async function acquire(c){
   sync();select(c);if(task&&key(task.context)===key(c))await task.promise;
   sync();const r=receipt;if(!r||key(r.context)!==key(c))return null;
   receipt=null;if(paused||r.identity!==identity||now()-r.at>maxAge||!o.allowed(c))return null;
   if(r.signature!==o.localSignature(c)){const e=Error('El trabajo local cambió durante la precarga. Se conserva sin reemplazar.');e.code='PREFETCH_LOCAL';throw e;}
   return {response:JSON.parse(r.json),signature:r.signature};
  }
  return {start,select,prefetch,acquire,pause,resume(){sync();if(paused){paused=false;attempted=false;}},stats(){sync();return {reads,pending:!!task,reserved:!!receipt,retainedBytes:receipt?receipt.json.length*2:0,target:target?key(target):null};}};
 }
 const api={key,context,enumerate,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IERegistroNotas2Prefetch=api;
})(typeof window==='undefined'?globalThis:window);
