'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const text=fs.readFileSync('tests/notas2-active-renewal.test.cjs','utf8').split('\nfor(const latency')[0];
const {fixture,clock}=new Function('require',text+'\nreturn {fixture,clock};')(require);
const base='a226ab74a36f69c305472a455f6ad3dd7067b275';
function isolated(source=fs.readFileSync('registro-connection.js','utf8')){
 const c=clock(),g={Date:c.Date,module:{exports:{}},fetch(){throw Error('Unexpected network');},setTimeout(){throw Error('Unexpected diagnostic timer');},indexedDB:{open(){throw Error('Unexpected database');}},localStorage:{getItem(){throw Error('Unexpected storage');}}};
 vm.createContext(g);vm.runInContext(source,g);return {c,g,trace:g.IERegistroEditTrace,create:g.module.exports.create};
}
test('off by default; enabling captures real UI renewal without changing controls, requests, values or deadlines',async()=>{
 const results=[];
 for(const enabled of [false,true]){
  const f=fixture(),trace=f.g.IERegistroEditTrace;assert.equal(trace.enabled(),false);if(enabled)trace.start();
  await f.boot();await f.c.advance(120000-f.c.now());assert.equal(f.api.canEdit(),true);await f.c.advance(4000);
  results.push({data:JSON.stringify(f.data),requests:JSON.stringify(f.requests),periods:f.periodReads(),deadline:f.connection.snapshot().validUntil,canEdit:f.api.canEdit(),disabled:f.button.disabled,readonly:f.input.readOnly});
  const capture=trace.capture();
  if(!enabled)assert.equal(capture.events.length,0);
  else{
   const start=capture.events.filter(e=>e.event==='academicstate-start'),end=capture.events.filter(e=>e.event==='academicstate-end');
   assert.equal(start.length,2);assert.equal(end.length,2);assert.deepEqual(end.map(e=>e.verification),start.map(e=>e.verification));assert.ok(end.every(e=>e.outcome==='ok'));
   assert.ok(capture.events.some(e=>e.state==='checking'&&e.canEdit===true));assert.equal(capture.events.some(e=>e.event==='edit-blocked'),false);
   assert.doesNotMatch(trace.export(),/fictitious|synthetic|Matemática|Conclusión|token|student|grades|finales/i);
   console.log(JSON.stringify({syntheticRenewalCapture:capture.events.filter(e=>e.event.startsWith('academicstate'))}));
  }
 }
 assert.deepEqual(results[0],results[1]);
});
test('diagnostic does not repeat authorized/allowed/binding predicates or alter their short-circuit order',async()=>{
 const previous=execFileSync('git',['show',base+':registro-connection.js'],{encoding:'utf8'}),runs=[];
 for(const [source,enabled]of [[previous,false],[undefined,false],[undefined,true]]){
  const f=isolated(source),calls=[],state={authorized:true,allowed:true},conn=f.create({now:f.c.now,setTimeout:f.c.set,clearTimeout:f.c.clear,binding:()=>{calls.push('binding');return 'PRIVATE_BINDING_TOKEN';},authorized:()=>{calls.push('authorized');return state.authorized;},allowed:()=>{calls.push('allowed');return state.allowed;},verify:async()=>({ok:true})});
  if(enabled)f.trace.start();await conn.check();const values=[conn.canEdit()];state.authorized=false;values.push(conn.canEdit());state.authorized=true;state.allowed=false;values.push(conn.canEdit());runs.push({calls,values,deadline:conn.snapshot().validUntil});
 }
 assert.deepEqual(runs[1],runs[0]);assert.deepEqual(runs[2],runs[0]);
});
test('same-context failure is attributed to academicstate error then server, preserving pending work',async()=>{
 const f=fixture(),trace=f.g.IERegistroEditTrace;trace.start();await f.boot();const before=JSON.stringify(f.data);f.mode('error');await f.c.advance(124000-f.c.now());
 const events=trace.capture().events,end=events.find(e=>e.event==='academicstate-end'&&e.outcome==='error'),blocked=events.find(e=>e.event==='edit-blocked'&&e.layer==='ui');
 assert.ok(end);assert.equal(blocked.reason,'server');assert.equal(blocked.context,end.context);assert.equal(blocked.state,'server');assert.equal(blocked.authorized,true);assert.equal(blocked.allowed,true);assert.equal(JSON.stringify(f.data),before);
 assert.ok(events.indexOf(end)<events.indexOf(blocked));console.log(JSON.stringify({syntheticBlockingCapture:events.filter(e=>e.atMs>=120000)}));
});
test('connection transitions distinguish expiry, permissions, readonly and context without exposing the binding',async()=>{
 for(const reason of ['expiration','permissions','readonly','context-change']){
  const f=isolated();let authorized=true,allowed=true,key='PRIVATE_OWNER_TOKEN_A',checks=0;const conn=f.create({now:f.c.now,setTimeout:f.c.set,clearTimeout:f.c.clear,binding:()=>key,authorized:()=>authorized,allowed:()=>allowed,verify:async()=>{checks++;if(reason==='expiration'&&checks>1)return new Promise(()=>{});return {ok:true};}});f.trace.start();await conn.check();assert.equal(conn.canEdit(),true);
  if(reason==='expiration')await f.c.advance(150000);if(reason==='permissions')authorized=false;if(reason==='readonly')allowed=false;if(reason==='context-change')key='PRIVATE_OTHER_TOKEN_B';
  assert.equal(conn.canEdit(),false);assert.equal(f.trace.capture().events.find(e=>e.event==='edit-blocked').reason,reason);assert.doesNotMatch(f.trace.export(),/PRIVATE|TOKEN/);
 }
});
test('UI captures academic conflict and client state independently of the connection lease',async()=>{
 for(const reason of ['conflict','client-state','readonly']){
  const f=fixture(),trace=f.g.IERegistroEditTrace;trace.start();await f.boot();const before=JSON.stringify(f.data),client=f.api.current();
  if(reason==='conflict'){const status=client.status;client.status=()=>({...status(),state:'conflict'});}
  if(reason==='client-state')client.pause();if(reason==='readonly')f.closed(true);
  assert.equal(f.api.canEdit(),false);const blocked=trace.capture().events.find(e=>e.event==='edit-blocked'&&e.layer==='ui');assert.equal(blocked.reason,reason);assert.equal(JSON.stringify(f.data),before);
 }
});
test('bounded buffer, predicate deduplication, explicit export and stop/clear never access persistence or network',()=>{
 const f=isolated(),trace=f.trace;trace.start();const context={};
 for(let i=0;i<400;i++)trace.record('connection',{context,state:i%2?'connected':'checking',until:150000});
 assert.equal(trace.capture().events.length,300);assert.equal(trace.capture().dropped,100);
 for(let i=0;i<1000;i++)trace.record('gate',{context,state:'connected',until:150000},{layer:'connection',canEdit:true,authorized:true,allowed:true,reason:'enabled'});
 assert.equal(trace.capture().dropped,101);assert.equal(trace.capture().events.length,300);
 const copy=trace.capture();copy.events[0].reason='PRIVATE';assert.doesNotMatch(trace.export(),/PRIVATE/);assert.deepEqual(JSON.parse(trace.export()),JSON.parse(JSON.stringify(trace.capture())));
 trace.stop();const stopped=trace.export();trace.record('connection',{context,state:'server',until:0});assert.equal(trace.export(),stopped);trace.clear();assert.equal(trace.capture().events.length,0);assert.equal(trace.enabled(),false);
});
test('unknown fields and throwing getters cannot leak data or break diagnostic callers',()=>{
 const f=isolated();f.trace.start();const context={private:'PRIVATE_NOTE'};
 f.trace.record('gate',{context,state:'PRIVATE_NAME',until:'PRIVATE_TOKEN'},{layer:'PRIVATE',panel:'PRIVATE',canEdit:'PRIVATE',authorized:'PRIVATE',clientState:'PRIVATE',reason:'PRIVATE',payload:{private:'PRIVATE'}});
 assert.doesNotMatch(f.trace.export(),/PRIVATE|payload/);assert.doesNotThrow(()=>f.trace.record('gate',Object.defineProperty({context},'state',{get(){throw Error('PRIVATE');}})));
 assert.equal(f.trace.capture().events.length,1);
});
test('verification tickets do not mix captures after restart or attribute a previous response to a new context',()=>{
 const f=isolated(),trace=f.trace,a={context:{},state:'checking',until:100},b={context:{},state:'connected',until:200};trace.start();const old=trace.begin(a);trace.start();trace.end(old,a,'ok');assert.equal(trace.capture().events.length,0);
 const current=trace.begin(a);trace.end(current,b,'ok');const events=trace.capture().events;assert.equal(events.length,2);assert.equal(events[0].context,events[1].context);assert.equal(events[1].outcome,'context-change');assert.equal(events[1].validUntilMs,null);
});
test('period validation failure is distinguishable from a successful academicstate',async()=>{
 const f=fixture(),trace=f.g.IERegistroEditTrace;trace.start();await f.boot();const before=JSON.stringify(f.data);f.g.sincronizarPeriodosNube=async()=>false;await f.c.advance(124000-f.c.now());
 const events=trace.capture().events;assert.ok(events.some(e=>e.event==='academicstate-end'&&e.atMs===124000&&e.outcome==='ok'));assert.ok(events.some(e=>e.event==='verification-rejected'&&e.reason==='period-verification'));assert.equal(f.api.canEdit(),false);assert.equal(JSON.stringify(f.data),before);
});
test('timeout, malformed response and denial produce safe outcomes with identical decisions enabled or disabled',async()=>{
 for(const mode of ['timeout','invalid-response','permissions']){
  const results=[];
  for(const enabled of [false,true]){
   const f=fixture(),trace=f.g.IERegistroEditTrace;if(enabled)trace.start();await f.boot();const before=JSON.stringify(f.data),native=f.g.fetch;
   f.g.fetch=async(u,o)=>{const b=JSON.parse(o.body);if(b.action!=='academicstate')return native(u,o);f.requests.push(b);await f.c.delay(4000);
    if(mode==='timeout')throw Object.assign(Error('PRIVATE_EXCEPTION'),{name:'AbortError'});
    return {ok:mode!=='permissions',status:mode==='permissions'?403:200,text:async()=>mode==='permissions'?JSON.stringify({ok:false,code:'DENIED',private:'PRIVATE_RESPONSE'}):'<PRIVATE_HTML>'};
   };
   await f.c.advance(124000-f.c.now());assert.equal(JSON.stringify(f.data),before);results.push({state:f.connection.snapshot().state,canEdit:f.api.canEdit(),reads:f.requests.length,deadline:f.connection.snapshot().validUntil});
   if(enabled){assert.equal(trace.capture().events.filter(e=>e.event==='academicstate-end').at(-1).outcome,mode);assert.doesNotMatch(trace.export(),/PRIVATE|fictitious|Matemática/);}
  }
  assert.deepEqual(results[0],results[1]);
 }
});
test('historical allowlist restores only the exact diagnostic delta; raw inline controller is identical',()=>{
 const normalize=require('./notas2-edit-trace-boundary.cjs');
 for(const file of ['registro-connection.js','registro.html','registro-notas2-ui.js']){
  const source=fs.readFileSync(file,'utf8'),previous=execFileSync('git',['show',base+':'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');assert.equal(normalize(file,source),previous);
  const marker=file==='registro-notas2-ui.js'?"if(!valid()||binding()!==key)":"(authorized=o.authorized())";assert.ok(source.includes(marker));assert.notEqual(normalize(file,source.replace(marker,'false')),previous);
 }
 const html=fs.readFileSync('registro.html','utf8').replace(/\r\n/g,'\n'),module=fs.readFileSync('registro-connection.js','utf8').replace(/\r\n/g,'\n').trim();assert.equal(html.split('<script>\n'+module+'\n</script>').length,2);
});
