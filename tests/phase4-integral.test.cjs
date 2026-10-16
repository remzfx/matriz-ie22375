// Phase4 only: compose approved real A1/client/backend fixtures, no production transport.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const world=new Function('require','__dirname',read('tests/academic-identity-roundtrip.test.cjs').split('\ntest(')[0]+'\nreturn world;')(require,__dirname);
const {create}=require('../registro-connection.js');

test('Phase4 A → B → A: required connection plus real backend preserves concurrent draft until explicit A1 review',async()=>{
 const w=world(),a=w.device();w.fill(a,15);assert.equal(await a.c.subirRegistroNube(),true);
 const b=w.device();assert.equal(await b.c.bajarRegistroNube({automatico:true}),true);
 w.fill(a,12);w.fill(b,18);assert.equal(await b.c.subirRegistroNube(),true);
 const writes=w.r.writes,before=JSON.stringify(a.c.store.finales);
 const gate=create({binding:()=> 'synthetic-A',authorized:()=>true,setTimeout:()=>0,clearTimeout(){},verify:async({review})=>{
  const ok=await a.c.bajarRegistroNube({automatico:!review});return {ok,conflict:!ok,pending:a.c.dirty};
 }});
 assert.equal(await gate.check(),false);assert.equal(gate.snapshot().state,'review');assert.equal(gate.canEdit(),false);
 assert.equal(JSON.stringify(a.c.store.finales),before);assert.equal(w.data().payload.finales[a.key].nota20,18);assert.equal(w.r.writes,writes);
 a.c.IERegistroReconcile.choose=async cs=>Object.fromEntries(cs.map(c=>[c.path,'remote']));
 assert.equal(await gate.check(true),true);assert.equal(a.c.store.finales[a.key].nota20,18);assert.equal(a.c.dirty,false);assert.equal(w.r.writes,writes);
 const clean=w.device(a.disk);assert.equal(await clean.c.bajarRegistroNube({automatico:true}),true);assert.equal(clean.c.store.finales[clean.key].nota20,18);assert.equal(clean.choices.length,0);assert.equal(w.r.writes,writes);gate.dispose();
});

test('Phase4 silent backend outage: 120s heartbeat pauses while read is outstanding; expired lease and failed read never signal success',async()=>{
 const w=world(),a=w.device();w.fill(a,15);assert.equal(await a.c.subirRegistroNube(),true);
 let now=0,available=true,finish;const timers=[],states=[];
 const gate=create({binding:()=> 'synthetic-A',authorized:()=>true,online:()=>true,now:()=>now,setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout(){},
  verify:async()=>{if(!available)return new Promise(r=>finish=r);return {ok:await a.c.bajarRegistroNube({automatico:true})};},changed:s=>states.push(s.state)});
 assert.equal(await gate.check(),true);const before=JSON.stringify(a.c.store.finales),writes=w.r.writes;available=false;
 now=119999;assert.equal(gate.canEdit(),true,'Documented detection window, not an instantaneous network guarantee');assert.equal(timers.at(-1).ms,120000);
 now=120000;timers.at(-1).fn();assert.equal(gate.snapshot().state,'checking');assert.equal(gate.canEdit(),false);
 now=150001;assert.equal(gate.canEdit(),false);finish({ok:false,code:'TIMEOUT'});await new Promise(r=>setImmediate(r));assert.equal(gate.snapshot().state,'server');assert.equal(states.at(-1),'server');assert.equal(JSON.stringify(a.c.store.finales),before);assert.equal(w.r.writes,writes);
 const b=w.device();assert.equal(await b.c.bajarRegistroNube({automatico:true}),true);w.fill(b,12);assert.equal(await b.c.subirRegistroNube(),true);available=true;const confirmed=w.r.writes;
 assert.equal(gate.canEdit(),false);assert.equal(await gate.check(),true);assert.equal(a.c.store.finales[a.key].nota20,12);assert.equal(w.r.writes,confirmed);gate.dispose();
});
