'use strict';
// Only the no-grant recovery path; real UI/controller, synthetic clock/transport.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const source=fs.readFileSync('tests/notas2-active-renewal.test.cjs','utf8').split('\nfor(const latency')[0];
const {fixture,clock}=new Function('require',source+'\nreturn {fixture,clock};')(require);
const base='4919300328b7c1b2a37fa0d1ba35ac3a117e738e';
function setup({legacy=false,baseline=false}={}){
 // Substitute only the reviewed modules for the before/after comparison.
 const prefix=source;
 const old={};if(baseline)for(const file of ['registro-connection.js','registro-notas2-ui.js'])old[file]=execFileSync('git',['show',base+':'+file],{encoding:'utf8',maxBuffer:4000000});
 const req=name=>name==='node:fs'?{...fs,readFileSync:(file,...args)=>{const text=old[file]??fs.readFileSync(file,...args);return file==='tests/notas2-connection-integration.test.cjs'?text.replace("bim:'III',grado:1,seccion:'A'","bim:'III',grado:3,seccion:'A'"):text;}}:require(name);
 const f=new Function('require',prefix+'\nreturn fixture;')(req)(),events=new Map(),add=f.g.document.addEventListener;
 f.g.document.addEventListener=(event,fn,...args)=>{if(!events.has(event))events.set(event,[]);events.get(event).push(fn);return add(event,fn,...args);};
 if(legacy){const fetch=f.g.fetch;f.g.fetch=async(u,o)=>{const r=await fetch(u,o);if(JSON.parse(o.body).action!=='academicstate')return r;const data=JSON.parse(await r.text());delete data.contextAuthorization;return {...r,text:async()=>JSON.stringify(data)};};}
 f.start();
 return {...f,visibility(value){f.g.document.visibilityState=value;for(const handler of events.get('visibilitychange')||[])handler();}};
}
for(const legacy of [false,true])for(const beforeExpiry of [false,true])test((legacy?'legacy backend':'shared scope')+': recover on visible return '+(beforeExpiry?'before':'after')+' expiry without waiting for the deferred heartbeat',async()=>{
 const measurements=[];
 for(const baseline of [true,false]){
  const f=setup({legacy,baseline});await f.boot();const work=JSON.stringify(f.data),until=f.connection.snapshot().validUntil;f.g.IERegistroEditTrace.start();f.api.canEdit();
  await f.c.advance(until-40000-f.c.now());f.visibility('hidden');await f.c.advance(10000);
  const returned=until+(beforeExpiry?-5000:10000);await f.c.advance(returned-f.c.now());f.visibility('visible');
  await f.c.advance(2000);
  assert.equal(f.api.canEdit(),beforeExpiry);assert.equal(f.connection.snapshot().validUntil,beforeExpiry?until:0);
  await f.c.advance(3000);
  if(!baseline){assert.equal(f.api.canEdit(),true);assert.equal(f.requests.filter(b=>b.action==='academicstate').length,2);}
  else{
   assert.equal(f.connection.snapshot().state,'checking');assert.equal(f.connection.snapshot().validUntil,0);assert.equal(f.api.canEdit(),false);
   assert.equal(f.connection.snapshot().retentionFailed,false);assert.equal(f.api.current().status().state,'ready');assert.equal(f.api.current().status().readonly,false);assert.equal(f.api.current().status().busy,false);
   assert.equal(f.requests.filter(b=>b.action==='academicstate').length,1);
   // Starting observation after expiration reproduces the reported no-grant
   // snapshot; it cannot reconstruct an earlier expiry event retroactively.
   f.g.IERegistroEditTrace.start();f.api.canEdit();const row=f.g.IERegistroEditTrace.capture().events.find(e=>e.layer==='ui');
   assert.equal(row.reason,'no-grant');assert.equal(row.authorized,true);assert.equal(row.allowed,true);assert.equal(row.clientState,'ready');assert.equal(row.clientReadonly,false);assert.equal(row.clientBusy,false);
  }
  if(!baseline&&beforeExpiry)assert.equal(f.c.trace.some(e=>e.event==='state'&&e.at>=returned&&e.canEdit===false),false);
  if(!baseline){const events=f.g.IERegistroEditTrace.capture().events;assert.ok(events.some(e=>e.event==='page-hidden'));assert.ok(events.some(e=>e.event==='page-visible'));}
  const atReturn=f.c.now();await f.c.advance(until+95000-f.c.now());assert.equal(f.api.canEdit(),true);
  assert.equal(f.requests.filter(b=>b.action==='academicstate').length,2);assert.equal(f.requests.filter(b=>b.action==='loadnotas2').length,1);assert.equal(f.requests.some(b=>b.action.startsWith('save')),false);assert.equal(JSON.stringify(f.data),work);
  measurements.push({baseline,until,returned,observedAt:atReturn,states:f.c.trace.filter(e=>e.event==='state').map(e=>({at:e.at,state:e.state,until:e.validUntil,canEdit:e.canEdit})),academicstate:2,loadnotas2:1,writes:0});
 }
 console.log(JSON.stringify({legacy,beforeExpiry,measurements}));
});
test('a compatible backend without shared scope grants and renews an already loaded client',async()=>{
 const f=setup({legacy:true});await f.boot();const original=f.connection.snapshot().validUntil,work=JSON.stringify(f.data);assert.ok(original>f.c.now());const task=f.connection.check(false,true);await f.c.advance(4000);assert.equal(await task,true);assert.ok(f.connection.snapshot().validUntil>original);assert.equal(f.api.current().status().state,'ready');assert.equal(f.requests.filter(b=>b.action==='loadnotas2').length,1);assert.equal(JSON.stringify(f.data),work);
});
function controllerFixture(verify){const c=clock(),g={Date:c.Date,module:{exports:{}}};vm.createContext(g);vm.runInContext(fs.readFileSync('registro-connection.js','utf8'),g);let calls=0;const conn=g.module.exports.create({now:c.now,setTimeout:c.set,clearTimeout:c.clear,binding:()=> 'same-anonymous-context',authorized:()=>true,allowed:()=>true,verify:args=>verify({c,args,call:++calls})});return {c,conn,calls:()=>calls};}
test('a settled verification with an expired deadline schedules its retry instead of granting invalid time',async()=>{
 const f=controllerFixture(async({c,call})=>({ok:true,validUntil:call===1?-1:c.now()+150000}));assert.equal(await f.conn.check(),false);assert.equal(f.conn.snapshot().state,'checking');assert.equal(f.conn.snapshot().validUntil,0);assert.equal(f.conn.canEdit(),false);await f.c.advance(15000);assert.equal(f.calls(),2);assert.equal(f.conn.canEdit(),true);
});
test('a discarded same-context epoch verification starts a fresh verification and cannot grant its old result',async()=>{
 const f=controllerFixture(async({c,args})=>{await c.delay(4000);return {ok:args.valid(),validUntil:c.now()+150000};});const task=f.conn.check();f.conn.invalidate();await f.c.advance(4000);assert.equal(await task,false);assert.equal(f.conn.canEdit(),false);await f.c.advance(4000);assert.equal(f.calls(),2);assert.equal(f.conn.canEdit(),true);
});
test('historical allowlist accepts only the literal recovery fix and keeps the inline controller identical',()=>{
 const normalize=require('./notas2-no-grant-recovery-boundary.cjs');
 for(const file of ['registro-connection.js','registro.html','registro-notas2-ui.js']){
  const text=fs.readFileSync(file,'utf8'),prior=execFileSync('git',['show',base+':'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');assert.equal(normalize(file,text),prior);
  const marker=file==='registro-notas2-ui.js'?"document.visibilityState==='hidden'":"if(!force&&!review&&canEdit())";assert.ok(text.includes(marker));assert.notEqual(normalize(file,text.replace(marker,'false')),prior);
 }
 const html=fs.readFileSync('registro.html','utf8').replace(/\r\n/g,'\n'),module=fs.readFileSync('registro-connection.js','utf8').replace(/\r\n/g,'\n').trim();assert.equal(html.split('<script>\n'+module+'\n</script>').length,2);
});
