'use strict';
// Deterministic transport clock. Runs the actual historical reader and comparison, never a second algorithm.
const fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process'),{extract}=require('./registro-visual-demo.cjs');
const fixture=new Function('require','__dirname',fs.readFileSync('tests/registro-comparativo-cache.test.cjs','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
const baseline=execFileSync('git',['show','6cb0d5f:registro.html'],{encoding:'utf8',maxBuffer:4000000});
async function measure({before=false,latency=3000,teachers=1,prepared=[],capacity=10}={}){
 let now=1000,active=0,peak=0,queuedPeak=0;const events=[],queue=[],trace=[];
 const enter=()=>{while(queue.length&&active<capacity){const q=queue.shift();active++;peak=Math.max(peak,active);const item={...q,start:now};trace.push(item);events.push({at:now+latency,run:()=>{active--;item.end=now;q.resolve();enter();}});}};
 const wait=(teacher,phase,bim)=>new Promise(resolve=>{queue.push({teacher,phase,bim,resolve});queuedPeak=Math.max(queuedPeak,queue.length+active);enter();});
 const fixtures=Array.from({length:teachers},(_,teacher)=>{const f=fixture();class Clock extends Date{static now(){return now;}}f.c.Date=Clock;
  if(before)vm.runInContext('async '+extract(baseline,'cargarComparativoBim'),f.c);
  const roster=f.c.IEStudents.loadRoster,read=f.c.IEStudents.fetchJSON;
  f.c.IEStudents.loadRoster=async b=>{await wait(teacher,'roster',b);return roster(b);};
  f.c.IEStudents.fetchJSON=async(u,o)=>{const b=JSON.parse(o.body);await wait(teacher,'history',b.bimestre);return read(u,o);};return f;});
 async function settle(task){let done=false,error;task.then(()=>done=true,e=>{done=true;error=e;});for(let step=0;step<10000&&!done;step++){for(let i=0;i<35;i++)await Promise.resolve();if(done)break;events.sort((a,b)=>a.at-b.at);if(!events.length)throw Error('Synthetic clock stalled');now=events[0].at;const due=events.filter(e=>e.at===now);events.splice(0,due.length);for(const e of due)e.run();}if(!done)throw Error('Synthetic clock budget');if(error)throw error;}
 for(const b of prepared)await settle(Promise.all(fixtures.map(f=>f.read(b))));
 const count=trace.length,start=now,snapshots=fixtures.map(f=>JSON.stringify(f.c.store));await settle(Promise.all(fixtures.map(f=>f.compare())));
 const ms=now-start,requests=trace.slice(count).map(({teacher,phase,bim,start,end})=>({teacher,phase,bim,start,end,ms:end-start}));
 for(const [i,f]of fixtures.entries()){if(JSON.stringify(f.c.store)!==snapshots[i]||f.saves()!==0)throw Error('Academic data changed');if(f.run('Object.keys(comparativoBimDatos).length')!==2)throw Error('Incomplete comparison');}
 const reopen=trace.length;await settle(Promise.all(fixtures.map(f=>f.compare())));
 return {before,latency,teachers,prepared,ms,requests:requests.length,trace:requests,peak,queuedPeak,reopenRequests:trace.length-reopen,writes:fixtures.reduce((n,f)=>n+f.saves(),0)};
}
module.exports={measure,fixture};
