// Deterministic fake clock, actual A1/B1 adapter/core and synthetic data only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const fixture=new Function('require','__dirname',read('tests/registro-recovery-ui.test.cjs').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
const baseline=()=>execFileSync('git',['show','d3d4412f48d7ef86b0f3deb076d6b591c192c155:registro-recovery-ui.js'],{encoding:'utf8'});
const flush=async()=>{for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));};
function setup({source,count=40,competencies=5,authenticated=true,slow=false,offline=false}={}){
 let now=1800000000000,finish,valid=authenticated;const counts={requests:0,writes:0,indexedDB:0,serializations:0,hashes:0,renders:0,statusWrites:0},copy=x=>JSON.parse(JSON.stringify(x));
 const f=fixture(null,{boot:false,source,prepare(c,{timers,intervals,db,r,f}){
  c.Date=class extends Date{static now(){return now;}};
  c.setTimeout=(fn,ms)=>{const t={fn,ms,at:now+ms};timers.push(t);return t;};
  c.setInterval=(fn,ms)=>{intervals.push({fn,ms,next:now+ms});};
  c.clearTimeout=t=>{if(t)t.cancelled=true;};
  c.tokenPadron='synthetic-token';c.IEStudents={validToken:()=>valid?'synthetic-token':'',peekRoster:()=>valid?{synthetic:true}:null};
  if(!authenticated)c.getLoginSession=()=>null;
  c.JSON={parse:JSON.parse,stringify:(...args)=>{counts.serializations++;return JSON.stringify(...args);}};
  const digest=c.crypto.subtle.digest.bind(c.crypto.subtle);c.crypto={subtle:{digest:(...args)=>{counts.hashes++;return digest(...args);}}};
  const open=db.open.bind(db);db.open=(...args)=>{const req=open(...args);let handler;Object.defineProperty(req,'onsuccess',{set(fn){handler=fn;},get(){return()=>{const d=req.result,tx=d.transaction.bind(d);d.transaction=(...args)=>{counts.indexedDB++;return tx(...args);};handler();};}});return req;};
  const el=c.document.getElementById('registroSaveState');let text=el.textContent;Object.defineProperty(el,'textContent',{get:()=>text,set:v=>{text=v;counts.statusWrites++;}});
  c.pintarRegistroConciliado=()=>counts.renders++;
  const roster=Array.from({length:count},(_,i)=>({idSiagie:'synthetic-'+(i+1),nombre:'ESTUDIANTE FICTICIO '+(i+1),grado:1,seccion:'A',orden:i+1}));c.estudiantes=()=>roster;
  c.store.finales={};c.store.concComp={};
  for(let j=0;j<competencies;j++)for(const al of roster){const k=c.cloudClaveReg()+'||Competencia ficticia '+j+'||id:'+al.idSiagie;c.store.finales[k]={nivel:'A',nota20:15,origen:'numero'};c.store.concComp[k]={texto:'Conclusión ficticia completa '+j};}
  const b=c.baselineAcademica();b.version=1;b.basePayload=copy(c.sliceRegistroArea());b.baseline=c.IERegistroAcademico.canonical(b.basePayload);r.payload=copy(b.basePayload);c.saveStore();
  const fetch=c.fetchLecturaNube;c.fetchLecturaNube=async(...args)=>{counts.requests++;if(offline)throw Error('Synthetic offline');if(slow)await new Promise(resolve=>finish=resolve);return fetch(...args);};
  const send=c.fetch;c.fetch=(...args)=>{counts.writes++;return send(...args);};
 }});
 const reset=()=>Object.keys(counts).forEach(k=>counts[k]=0);reset();
 async function tick(ms){const end=now+ms;while(true){const tasks=f.timers.filter(t=>!t.cancelled&&!t.done&&t.at<=end),ins=f.intervals.filter(t=>t.next<=end),at=Math.min(...tasks.map(t=>t.at),...ins.map(t=>t.next));if(!Number.isFinite(at))break;now=at;for(const t of tasks.filter(t=>t.at===at)){t.done=true;const p=t.fn();if(!slow)await p;}for(const t of ins.filter(t=>t.next===at)){t.next+=t.ms;const p=t.fn();if(!slow)await p;}await flush();}now=end;await flush();}
 return {f,counts,reset,tick,boot:async()=>{f.events.DOMContentLoaded();await flush();},finish:()=>finish?.(),expire:()=>valid=false,status:()=>f.c.document.getElementById('registroSaveState').textContent};
}
async function measure(source,count){const h=setup({source,count}),results={};await h.boot();await h.tick(1000);results.initial={...h.counts};h.reset();await h.tick(60000);results.idle={...h.counts};h.reset();h.f.c.seccion='B';if(h.f.api.refresh)h.f.api.refresh();else h.f.events.change({type:'change',target:{closest:()=>null}});await h.tick(1000);results.context={...h.counts};const absent=setup({source,count,authenticated:false});await absent.boot();await absent.tick(60000);results.absent={...absent.counts,status:absent.status()};const slow=setup({source,count,slow:true});await slow.boot();await slow.tick(1000);await slow.tick(60000);results.slow={...slow.counts};slow.finish();await flush();const offline=setup({source,count,offline:true});await offline.boot();await offline.tick(1000);offline.reset();await offline.tick(60000);results.offlineIdle={...offline.counts};h.expire();h.reset();if(h.f.api.refresh)h.f.api.refresh();else await h.f.api.automatic();await h.tick(60000);results.expired={...h.counts,status:h.status()};return results;}
module.exports={setup,measure,baseline,flush};
if(require.main===module)(async()=>{const report={baseline:'d3d4412f48d7ef86b0f3deb076d6b591c192c155',competencies:5,counts:{}};for(const n of [30,40])report.counts[n]={before:await measure(baseline(),n),after:await measure(read('registro-recovery-ui.js'),n)};process.stdout.write(JSON.stringify(report,null,2)+'\n');})();
