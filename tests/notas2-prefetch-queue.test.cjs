'use strict';
// Real progressive coordinator and N2 contract; synthetic service, clocks and identities only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const queue=require('../registro-notas2-prefetch.js'),core=require('../registro-notas2.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const A={nivel:'secundaria',bim:'III',grado:1,seccion:'A',area:'Matemática'},B={...A,seccion:'B'},C={...A,grado:2},D={...A,grado:3};
function reply(c){return {ok:true,notas2:1,key:queue.key(c),exists:true,legacy:false,readonly:false,versions:{calificar:3,promedios:5,asistencia:2},at:{calificar:3,promedios:5,asistencia:2},payload:{...Object.fromEntries(Object.values(core.fields).flat().map(f=>[f,f==='sessions'?[]:{}])),finales:{[queue.key(c)+'||Competencia||id:synthetic']:{nivel:'A',nota20:15,origen:'letra'}}}};}
const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Synthetic queue did not reach the expected bounded state');};
function fixture(options={}){
 let owner='synthetic-owner-token-epoch',online=true,hold=false,signature='empty',local=false,proof='roster-1',denied=0,active=0,peak=0;
 const known=new Set([queue.key(A)]),requests=[],pending=[];
 const c=queue.create({gap:0,...options,identity:()=>owner,allowed:c=>online&&c.bim!=='II',isKnown:c=>known.has(queue.key(c)),canRun:()=>online,localSignature:()=>signature,hasLocal:()=>local,contextIdentity:()=>proof,fingerprint:core.signature,denied:()=>denied++,validate:(r,c)=>core.validateRead(r,queue.key(c)),read:async(context,signal)=>{
  const request={context,signal,owner};requests.push(request);active++;peak=Math.max(peak,active);
  try{return hold?await new Promise(resolve=>pending.push({request,resolve})):reply(context);}finally{active--;}
 }});
 return {c,known,requests,pending,hold:v=>hold=v,owner:v=>owner=v,online:v=>online=v,proof:v=>proof=v,signature:v=>signature=v,local:v=>local=v,denied:()=>denied,peak:()=>peak};
}
test('queue enumerates all ordinary primary grades 1–6 and secondary 1–5 without implicit permissions',async()=>{
 for(const level of ['primaria','secundaria']){
  const grades=Array.from({length:level==='primaria'?6:5},(_,i)=>i+1),section=level==='primaria'?'Única':'A';
  const assignments={'Matemática':grades.map(g=>g+'|'+section),'Comunicación':grades.filter(g=>g%2).map(g=>g+'|'+section)};
  const profile={nivel:level,role:'docente',token:'synthetic',grados:grades,asignaciones:assignments};
  const rows=grades.map(grado=>({nivel:level,grado,seccion:section})),contexts=queue.enumerate(profile,{I:rows,III:rows},{[level]:{'Matemática':[],'Comunicación':[],'Competencias Transversales':[]}});
  const f=fixture();f.known.clear();f.known.add(queue.key(contexts[0]));f.c.start(contexts[0],contexts);await wait(()=>f.c.stats().completed===contexts.length-1);
  assert.equal(f.requests.length,contexts.length-1);assert.equal(new Set(f.requests.map(r=>queue.key(r.context))).size,f.requests.length);assert.equal(f.peak(),1);assert.ok(f.c.stats().retainedBytes<=f.c.stats().limits.maxBytes);
  f.c.dispose();
 }
});
test('rapid A → B → C → A cancels foreign work and ignores its late response',async()=>{
 const f=fixture();f.hold(true);f.c.start(A,[A,B,C,D]);await wait(()=>f.pending.length===1);const old=f.pending[0];
 f.c.select(B);f.c.select(C);f.known.add(queue.key(C));f.c.start(C,[A,B,C,D]);f.c.select(A);f.c.start(A,[A,B,C,D]);
 assert.equal(old.request.signal.aborted,true);f.hold(false);old.resolve(reply(B));for(const p of f.pending.slice(1))p.resolve(reply(p.request.context));
 await wait(()=>!f.c.stats().pending);assert.ok(f.c.stats().reads<=6);assert.equal(f.c.stats().states.reading||0,0);f.c.dispose();
});
test('queue does not change raw fields or pending conclusions while other contexts arrive',async()=>{
 const local={input:'17',focus:'same-field',conclusion:'Conclusión ficticia pendiente',notes:{A:12}},before=copy(local),f=fixture();f.c.start(A,[A,B,C,D]);await wait(()=>f.c.stats().completed===3);assert.deepEqual(local,before);assert.equal(f.requests.length,3);f.c.dispose();
});
test('known contexts, repeated start and valid reservations do not produce duplicate downloads',async()=>{
 const f=fixture();f.c.start(A,[A,B,C,D]);await wait(()=>f.c.stats().completed===3);for(let i=0;i<20;i++)f.c.start(A,[A,B,C,D]);assert.equal(await f.c.prefetch(B),true);assert.equal(f.requests.length,3);assert.ok(f.c.stats().avoided>0);f.c.dispose();
});
test('global request budget is never reset by start, resume, focus-like calls or failed contexts',async()=>{
 const f=fixture({maxReads:2});f.c.start(A,[A,B,C,D]);await wait(()=>f.c.stats().reads===2&&!f.c.stats().pending);for(let i=0;i<10;i++){f.c.resume();f.c.start(A,[A,B,C,D]);}assert.equal(f.requests.length,2);assert.equal(await f.c.prefetch(D),false);assert.equal(f.c.stats().budgetExhausted,true);f.c.dispose();
});
test('global memory stays bounded; consuming B frees capacity for the remaining queue',async()=>{
 const size=(JSON.stringify(reply(B)).length+'empty'.length+core.signature(reply(B).payload).length)*2,f=fixture({maxBytes:size*2+20});
 f.c.start(A,[A,B,C,D]);await wait(()=>f.c.stats().reservations===2&&!f.c.stats().pending);assert.equal(f.requests.length,2);assert.ok(f.c.stats().peakBytes<=size*2+20);
 await f.c.acquire(B);f.known.add(queue.key(B));f.c.start(B,[A,B,C,D]);await wait(()=>f.c.stats().completed===3);assert.equal(f.requests.length,3);assert.ok(f.c.stats().peakBytes<=size*2+20);f.c.dispose();
});
test('expiry frees memory without automatically refreshing already completed contexts',async()=>{
 let now=0;const f=fixture({now:()=>now,maxAge:50});f.c.start(A,[A,B,C]);await wait(()=>f.c.stats().reservations===2);now=51;assert.equal(f.c.stats().reservations,0);for(let i=0;i<5;i++)f.c.start(A,[A,B,C]);assert.equal(f.requests.length,2);assert.equal(f.c.stats().states.expired,2);f.c.dispose();
});
for(const operation of ['save','recovery'])test(operation+' suspends the queue, aborts foreign reads and resumes only after release',async()=>{
 const f=fixture();f.hold(true);f.c.start(A,[A,B,C]);await wait(()=>f.pending.length===1);f.c.hold(operation);assert.equal(f.pending[0].request.signal.aborted,true);
 f.pending[0].resolve(reply(B));f.hold(false);f.c.start(A,[A,B,C]);await new Promise(r=>setImmediate(r));assert.equal(f.requests.length,1);f.c.release(operation);await wait(()=>f.c.stats().completed===2);assert.ok(f.requests.length<=3);f.c.dispose();
});
test('closed period and unsupported route cannot enter an allowed reading queue',async()=>{
 const f=fixture();f.c.start(A,[A,{...B,bim:'II'},C]);await wait(()=>f.c.stats().completed===1);assert.equal(f.requests.length,1);assert.equal(f.requests[0].context.bim,'III');
 const profile={role:'docente',token:'synthetic',nivel:'secundaria',asignaciones:{'Competencias Transversales':['1|A']}};assert.deepEqual(queue.enumerate(profile,{III:[{nivel:'secundaria',grado:1,seccion:'A'}]},{secundaria:{'Competencias Transversales':[]}}),[]);f.c.dispose();
});
test('local drafts may be read for review but can never be overwritten by automatic reserve consumption',async()=>{
 const f=fixture();f.local(true);f.c.start(A,[A,B]);await wait(()=>f.c.stats().reservations===1);await assert.rejects(f.c.acquire(B),e=>e.code==='PREFETCH_LOCAL');assert.equal(f.requests.length,1);assert.equal(f.c.stats().reservations,0);f.c.dispose();
});
test('roster proof change invalidates both a receipt and an in-flight response',async()=>{
 const f=fixture();await f.c.prefetch(B);f.proof('roster-2');assert.equal(await f.c.acquire(B),null);f.c.release('foreground');f.hold(true);const p=f.c.prefetch(C);f.proof('roster-3');f.pending[0].resolve(reply(C));assert.equal(await p,false);assert.equal(f.c.stats().reservations,0);f.c.dispose();
});
test('owner change discards earlier responses without revoking the new owner',async()=>{
 const f=fixture();f.hold(true);const p=f.c.prefetch(B);const old=f.pending[0];f.owner('other-owner');f.c.select(A);old.resolve({ok:false,code:'SESSION'});assert.equal(await p,false);assert.equal(f.denied(),0);assert.equal(f.c.stats().reservations,0);f.c.dispose();
});
test('disconnect/reconnect is bounded and never authorizes a write or an old response',async()=>{
 const f=fixture();f.hold(true);const p=f.c.prefetch(B);f.online(false);f.c.pause();f.pending[0].resolve(reply(B));assert.equal(await p,false);f.online(true);f.hold(false);f.c.resume();f.c.start(A,[A,B,C]);await wait(()=>f.c.stats().completed===2);assert.ok(f.requests.length<=3);assert.equal(f.c.stats().reservations,2);f.c.dispose();
});
test('default pacing leaves a bounded gap between background requests',async()=>{
 let now=0;const timers=[],f=fixture({gap:500,now:()=>now,setTimeout:(fn,ms)=>{const t={fn,ms,active:true};timers.push(t);return t;},clearTimeout:t=>{if(t)t.active=false;}});
 f.c.start(A,[A,B,C]);await new Promise(r=>setImmediate(r));assert.equal(f.requests.length,1);const next=timers.findLast(t=>t.active&&t.ms===500);assert.ok(next);now=500;next.fn();await new Promise(r=>setImmediate(r));assert.equal(f.requests.length,2);f.c.dispose();
});
test('reserved notes defer attendance; only a fresh ordinary panel read may authorize its editing',async()=>{
 const r=reply(B),data={...copy(r.payload),asistencia:{local:{marca:'P'}}};let defer=true;const client=core.create({key:r.key,binding:()=>r.key,authorized:()=>true,readonly:()=>false,capture:()=>data,request:async()=>copy(r),apply:p=>Object.assign(data,p),deferReadPanel:n=>defer&&n==='asistencia'});
 assert.equal(await client.load(),true);assert.deepEqual(data.asistencia,{local:{marca:'P'}});assert.equal(client.status().panels.asistencia.version,null);assert.equal(client.canEdit('asistencia'),false);assert.equal(client.canEdit('promedios'),true);
 const finals=copy(data.finales);defer=false;r.payload.asistencia={remote:{marca:'T'}};assert.equal(await client.load({panel:'asistencia'}),true);assert.deepEqual(data.finales,finals);assert.equal(client.canEdit('asistencia'),true);assert.deepEqual(data.asistencia,{remote:{marca:'T'}});
});
test('zero request budget and admission limits are explicit, without hiding enumerated contexts',async()=>{
 const disabled=fixture({maxReads:0});disabled.c.start(A,[A,B,C,D]);assert.equal(disabled.requests.length,0);assert.equal(disabled.c.stats().enumerated,4);assert.equal(disabled.c.stats().budgetExhausted,true);disabled.c.dispose();
 const bounded=fixture({maxContexts:2});bounded.c.start(A,[A,B,C,D]);await wait(()=>bounded.c.stats().completed===1);assert.equal(bounded.c.stats().enumerated,4);assert.equal(bounded.c.stats().admitted,2);assert.equal(bounded.c.stats().deferredContexts,2);bounded.c.dispose();
});
test('the global memory budget includes external roster bytes and exposes remaining capacity',async()=>{
 const f=fixture({maxBytes:1000,overheadBytes:()=>999});assert.equal(f.c.availableBytes(),1);assert.equal(await f.c.prefetch(B),false);assert.equal(f.c.stats().totalRetainedBytes,999);assert.equal(f.c.stats().retainedBytes,0);f.c.dispose();
});
test('historical loading delegates to the existing reader without a recursive render/paint loop',async()=>{
 const fs=require('node:fs'),factory=new Function('require',fs.readFileSync('tests/notas2-connection-integration.test.cjs','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require),f=factory();await f.check();
 const before=JSON.stringify(f.data);let renders=0;f.nodes.finLista={dataset:{registroContexto:'previous-open-context'}};f.g.renderFinales=()=>renders++;
 f.g.registroConsultaHistorica=()=>true;f.g.bimestreHabilitado=()=>false;f.g.padronBimestre='II';f.g.ctxBase=()=>({...A,bim:'II'});f.g.cloudClaveReg=()=>queue.key({...A,bim:'II'});
 assert.doesNotThrow(()=>f.api.refresh());assert.ok(renders<=1);assert.equal(f.nodes.finLista.dataset.registroContexto,'previous-open-context');assert.equal(f.api.canEdit('promedios'),false);assert.equal(JSON.stringify(f.data),before);assert.equal(f.requests.filter(b=>b.action==='savenotas2').length,0);
});
