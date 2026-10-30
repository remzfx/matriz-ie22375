'use strict';
// Focused renewal timeline. No real profiles, network, storage or academic writes.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function clock(){let now=0,seq=0;const jobs=new Map(),trace=[];
 class DateClock extends Date{static now(){return now;}}
 const set=(fn,ms)=>{const id=++seq,label=String(fn).includes('grants.delete')?'watchLease':String(fn).includes('check(false,true)')?'renewal':'callback';jobs.set(id,{at:now+ms,fn,label});return id;};
 const clear=id=>jobs.delete(id),delay=ms=>new Promise(r=>set(r,ms));
 async function advance(ms){const end=now+ms;for(let n=0;n<2000;n++){
  for(let i=0;i<30;i++)await Promise.resolve();
  const job=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
  if(!job){now=end;return;}now=job[1].at;jobs.delete(job[0]);if(job[1].label!=='callback')trace.push({at:now,event:job[1].label});job[1].fn();
 }throw Error('Synthetic timer loop');}
 return {Date:DateClock,set,clear,delay,advance,trace,now:()=>now};
}
function fixture({latency=4000,ttl=150000}={}){
 const c=clock(),src=fs.readFileSync('tests/notas2-connection-integration.test.cjs','utf8').split('\ntest(')[0]
  .replace('const g={console,','const g={clock,console,')
  .replace('setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){}','setTimeout:clock.set,clearTimeout:clock.clear');
 const instrument=`\n{const original=IERegistroConnection.create;IERegistroConnection.create=o=>original({...o,changed:s=>{clock.trace.push({at:Date.now(),event:'state',...s,canEdit:IERegistroConnection.current()?.canEdit()});o.changed?.(s);}});}`;
 const req=name=>name==='./registro-inline-modules.cjs'?{...require(name),read:(file,...args)=>{const text=require(name).read(file,...args);return file==='registro-connection.js'?text+instrument:text;},readFile:(file,...args)=>{const text=require(name).readFile(file,...args);return file==='registro-connection.js'?text+instrument:text;}}:name==='node:fs'?{...fs,readFileSync:(file,...args)=>{const text=fs.readFileSync(file,...args);return file==='registro-connection.js'?text+instrument:text;}}:require(name);
 const f=new Function('require','Date','clock',src+'\nreturn fixture;')(req,c.Date,c)(),g=f.g;
 const session={token:'fictitious',user:'synthetic',role:'docente',nivel:'secundaria',permisosVersion:1};g.getLoginSession=()=>session;
 let mode='ok',wait=latency,periodReads=0;
 const native=g.fetch;
 g.sincronizarPeriodosNube=async()=>{periodReads++;await c.delay(wait);return true;};
 g.fetch=async(u,o)=>{
  const body=JSON.parse(o.body);if(body.action!=='academicstate')return native(u,o);
  c.trace.push({at:c.now(),event:'check',state:f.connection.snapshot().state,until:f.connection.snapshot().validUntil,canEdit:f.api.canEdit(),mode});
  await c.delay(wait);
  if(mode==='error'){f.requests.push(body);throw Error('Synthetic unavailable server');}
  if(mode==='revoked'){f.requests.push(body);return {ok:false,status:403,text:async()=>JSON.stringify({ok:false,code:'DENIED'})};}
  const response=await native(u,o),data=JSON.parse(await response.text()),issuedAt=c.now();
  data.contextAuthorization={schema:1,user:session.user,role:session.role,nivel:session.nivel,permisosVersion:1,issuedAt,expiresAt:issuedAt+ttl,epoch:null,contexts:[g.cloudClaveReg()]};
  return {ok:true,status:200,text:async()=>JSON.stringify(data)};
 };
 const button={tagName:'BUTTON',disabled:false,type:'button'},input={tagName:'INPUT',disabled:false,readOnly:false};
 g.document.querySelectorAll=s=>s.startsWith('#stuList button,')?[button,input]:[];
 async function boot(){const task=f.check();await c.advance(wait);assert.equal(await task,true);f.edit();assert.equal(f.api.canEdit(),true);}
 return {...f,c,button,input,boot,mode:v=>mode=v,latency:v=>wait=v,periodReads:()=>periodReads};
}
for(const latency of [4000,7000])test('active editing stays enabled over three scheduled renewals with '+latency+'ms latency',async()=>{
 const f=fixture({latency});await f.boot();const initial=JSON.parse(JSON.stringify(f.data));
 for(const at of [120000,240000,360000]){
  await f.c.advance(at-f.c.now());assert.equal(f.connection.snapshot().state,'checking');assert.equal(f.api.canEdit(),true);assert.equal(f.button.disabled,false);assert.equal(f.input.readOnly,false);
  f.data.finales['synthetic-active-edit-'+at]={nivel:'B',nota20:12,origen:'letra'};
  await f.c.advance(latency);assert.equal(f.api.canEdit(),true);assert.equal(f.button.disabled,false);assert.equal(f.input.readOnly,false);
 }
 for(const [field,value]of Object.entries(initial)){
  if(Array.isArray(value))assert.deepEqual(f.data[field],value);
  else for(const [key,record]of Object.entries(value))assert.deepEqual(f.data[field][key],record);
 }
 assert.equal(f.requests.filter(r=>r.action==='academicstate').length,4);assert.equal(f.periodReads(),4);
 assert.equal(f.requests.filter(r=>r.action==='loadnotas2').length,1);assert.equal(f.requests.some(r=>r.action.startsWith('save')),false);
 assert.equal(f.c.trace.filter(r=>r.event==='watchLease').length,0);
 console.log(JSON.stringify({latency,trace:f.c.trace,checks:4,academicDownloads:1,writes:0}));
});
test('server failure pauses legitimately, preserves edits and retries without academic writes',async()=>{
 const f=fixture();await f.boot();const before=JSON.stringify(f.data);f.mode('error');await f.c.advance(120000-f.c.now());assert.equal(f.api.canEdit(),true);
 await f.c.advance(4000);assert.equal(f.connection.snapshot().state,'server');assert.equal(f.api.canEdit(),false);assert.equal(JSON.stringify(f.data),before);
 f.mode('ok');await f.c.advance(19000);assert.equal(f.api.canEdit(),true);assert.equal(JSON.stringify(f.data),before);assert.equal(f.requests.some(r=>r.action.startsWith('save')),false);
});
test('revocation blocks the same session and retains pending values',async()=>{
 const f=fixture();await f.boot();const before=JSON.stringify(f.data);f.mode('revoked');await f.c.advance(124000-f.c.now());assert.equal(f.connection.snapshot().state,'session');assert.equal(f.api.canEdit(),false);assert.equal(JSON.stringify(f.data),before);const count=f.requests.length;f.mode('ok');await f.c.advance(180000);assert.equal(f.requests.length,count);assert.equal(f.api.canEdit(),false);
});
test('watchLease blocks at the actual deadline while a controller verification is still pending',async()=>{
 // Boundary test of the controller itself: the UI HTTP timeout remains unchanged.
 const c=clock(),create=require('./registro-inline-modules.cjs').load('registro-connection.js').create,work={grade:'A',conclusion:'FICTICIO'},before=JSON.stringify(work);let reads=0;
 const connection=create({now:c.now,setTimeout:c.set,clearTimeout:c.clear,binding:()=> 'synthetic-A',authorized:()=>true,verify:async()=>{reads++;if(reads>1)await c.delay(45000);return {ok:true,validUntil:c.now()+150000};}});
 await connection.check();await c.advance(120000);assert.equal(connection.snapshot().state,'checking');assert.equal(connection.canEdit(),true);
 await c.advance(30000);assert.equal(connection.snapshot().validUntil,0);assert.equal(connection.canEdit(),false);assert.ok(c.trace.some(e=>e.event==='watchLease'&&e.at===150000));
 await c.advance(15000);assert.equal(connection.canEdit(),true);assert.equal(reads,2);assert.equal(JSON.stringify(work),before);connection.dispose();
});
test('a context change during renewal joins the new flight instead of superseding its valid response',async()=>{
 const prior=require('node:child_process').execFileSync('git',['show','06227151383b357f0018e5eb0f4249411c729b01:registro-connection.js'],{encoding:'utf8'}),moduleBefore={exports:{}};
 require('node:vm').runInNewContext(prior,{module:moduleBefore});const measured=[];
 for(const [label,create]of [['before',moduleBefore.exports.create],['after',require('./registro-inline-modules.cjs').load('registro-connection.js').create]]){
  const c=clock(),work={A:{grade:'B'},B:{grade:'A'}},before=JSON.stringify(work);let key='A',reads=0,tail=Promise.resolve();
  const events=[],connection=create({now:c.now,setTimeout:c.set,clearTimeout:c.clear,binding:()=>key,owner:()=> 'synthetic-session',authorized:()=>true,changed:s=>events.push({...s,at:c.now()}),verify:({valid})=>{
   reads++;const task=tail.then(async()=>{await c.delay(4000);return {ok:valid(),validUntil:c.now()+150000};});tail=task;return task;
  }});
  const initial=connection.check();await c.advance(4000);assert.equal(await initial,true);await c.advance(120000);assert.equal(connection.canEdit(),true);
  key='B';connection.select();assert.equal(connection.canEdit(),false);const switched=connection.check();await c.advance(12000);assert.equal(await switched,true);assert.equal(connection.snapshot().binding,'B');assert.equal(connection.canEdit(),true);
  const ready=events.find(e=>e.binding==='B'&&e.state==='connected').at;
  assert.equal(reads,label==='before'?4:3);assert.equal(ready,label==='before'?136000:132000);assert.equal(JSON.stringify(work),before);
  measured.push({label,reads,contextChangedAt:124000,readyAt:ready,blockedMs:ready-124000});connection.dispose();
 }
 console.log(JSON.stringify({serializedSyntheticLatencyMs:4000,contextRace:measured}));
});

test('historical boundary permits only the demonstrated flight-loop change and preserves security differences',()=>{
 const normalize=require('./notas2-active-renewal-boundary.cjs'),git=require('node:child_process').execFileSync;
 for(const file of ['registro-connection.js','registro.html']){
  const source=require('./registro-inline-modules.cjs').readFile(file,'utf8'),prior=git('git',['show','06227151383b357f0018e5eb0f4249411c729b01:'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
  assert.equal(normalize(file,source),prior);
  assert.notEqual(normalize(file,source.replace('await p;if(disposed)return false;scope();','await p;if(disposed)return true;scope();')),prior);
  assert.notEqual(normalize(file,source.replace('if(!o.authorized())','if(false)')),prior);
 }
});
module.exports={fixture,clock};
