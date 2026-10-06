const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const fixture=new Function('require','__dirname',read('tests/auxiliar-production-diagnostic.test.cjs').split('\nfor(const nivel')[0]+'\nreturn fixture;')(require,__dirname);
const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
function clock(s){
 let now=0,id=0;const timers=new Map();s.context.performance={now:()=>now};
 s.context.setTimeout=(f,ms)=>{const key=++id;timers.set(key,{f,at:now+ms});return key};s.context.clearTimeout=key=>timers.delete(key);
 return async(ms)=>{const end=now+ms;for(let i=0;i<100;i++){await flush();const due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due){now=end;await flush();return;}now=due[1].at;timers.delete(due[0]);due[1].f();}throw Error('timer runaway');};
}
const ok=()=>({ok:true,status:200,url:'https://script.googleusercontent.com/temporary',redirected:true,headers:new Headers({'Content-Type':'application/json'}),text:async()=>'{"ok":true}'});
const missing=()=>({...ok(),ok:false,status:404,headers:new Headers({'Content-Type':'text/html'}),text:async()=>{throw Error('must not read 404 body')}});
const pending=signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})),{once:true}));

test('Pending warmup is aborted before login POST without waiting for ping',async()=>{
 const s=fixture('primaria');await flush();const requests=[];s.run('loginPrecalentado=false');
 s.context.fetch=async(url,o)=>{requests.push(o);if(o.method==='GET')return pending(o.signal);assert.equal(requests[0].signal.aborted,true);return ok()};
 s.context.precalentarLoginBackend();await s.context.loginBackend('auxiliar','synthetic','synthetic');
 assert.deepEqual(requests.map(r=>r.method),['GET','POST']);assert.equal(s.run('loginWarmup'),null);
});
for(const phase of ['fetch','cuerpo'])test('Login '+phase+' timeout aborts the actual request within 18 seconds',async()=>{
 const s=fixture('primaria');await flush();const tick=clock(s);let signal;
 s.context.fetch=async(url,o)=>{signal=o.signal;return phase==='fetch'?pending(signal):{...ok(),text:()=>pending(signal)}};
 const task=s.context.loginBackendUnaVez('auxiliar','synthetic','synthetic');const rejection=assert.rejects(task,e=>e.code==='TIMEOUT'&&e.fase===phase);
 await tick(17999);assert.equal(signal.aborted,false);await tick(1);await rejection;assert.equal(signal.aborted,true);
 const d=JSON.parse(s.stored.get('ie22375_login_attempts_v1'))[0];assert.equal(d.totalMs,18000);assert.equal(d.fase,phase);assert.equal(d.intento,1);
});
for(const first of ['404','timeout'])test('First '+first+' then success uses exactly two sequential login attempts',async()=>{
 const s=fixture('primaria');await flush();const tick=clock(s),signals=[];
 s.context.fetch=async(url,o)=>{if(signals.length)assert.equal(signals[0].aborted,true);signals.push(o.signal);return signals.length===1?(first==='404'?missing():pending(o.signal)):ok()};
 const task=s.context.loginBackend('auxiliar','synthetic','synthetic');await tick(first==='timeout'?18000:0);assert.equal(signals.length,1);await tick(1199);assert.equal(signals.length,1);await tick(1);
 const value=await task;assert.equal(value.ok,true);assert.equal(value.__retryCount,1);assert.equal(signals.length,2);
 const d=JSON.parse(s.stored.get('ie22375_login_attempts_v1'));assert.deepEqual(d.map(a=>a.intento),[1,2]);assert.deepEqual(d.map(a=>a.code),[first==='404'?'HTTP':'TIMEOUT','OK']);
 if(first==='404'){assert.equal(d[0].status,404);assert.equal(d[0].origin,'https://script.googleusercontent.com');assert.equal(d[0].redirected,true);assert.equal(d[0].contentType,'text/html');assert.equal(d[0].fase,'respuesta');}
});
test('Two timeouts finish after 37.2 seconds with both requests aborted and no third attempt',async()=>{
 const s=fixture('primaria');await flush();const tick=clock(s),signals=[];
 s.context.fetch=(url,o)=>{signals.push(o.signal);return pending(o.signal)};
 const task=s.context.loginBackend('auxiliar','synthetic','synthetic'),rejection=assert.rejects(task,e=>e.code==='TIMEOUT'&&e.intento===2);
 await tick(37200);await rejection;assert.equal(signals.length,2);assert.ok(signals.every(s=>s.aborted));
 assert.deepEqual(JSON.parse(s.stored.get('ie22375_login_attempts_v1')).map(a=>a.totalMs),[18000,18000]);
});
test('Incorrect credentials produce no technical retry',async()=>{
 const s=fixture('primaria');await flush();let n=0;s.context.fetch=async()=>{n++;return {...ok(),text:async()=>'{"ok":false,"error":"Rejected"}'}};
 const value=await s.context.loginBackend('auxiliar','synthetic','synthetic');assert.equal(value.ok,false);assert.equal(n,1);
});
test('Concurrent login invocations share the pending operation',async()=>{
 const s=fixture('primaria');await flush();let release,n=0;s.context.fetch=()=>{n++;return new Promise(r=>release=r)};
 const a=s.context.loginBackend('auxiliar','synthetic','synthetic'),b=s.context.loginBackend('auxiliar','synthetic','synthetic');assert.equal(n,1);release(ok());assert.equal((await a).ok,true);assert.equal((await b).ok,true);
});
for(const code of ['NETWORK','INVALID_RESPONSE'])test('Safe attempt diagnosis records '+code+' without secrets',async()=>{
 const s=fixture('primaria');await flush();s.context.fetch=async()=>{if(code==='NETWORK')throw Error('synthetic-user synthetic-password');return {...ok(),text:async()=>'<html>synthetic-secret</html>'}};
 await assert.rejects(s.context.loginBackendUnaVez('auxiliar','synthetic-user','synthetic-password'),e=>e.code===code);
 const raw=s.stored.get('ie22375_login_attempts_v1'),d=JSON.parse(raw)[0];assert.equal(d.code,code);assert.doesNotMatch(raw,/synthetic|temporary|password|token|usuario|body/);
 assert.deepEqual(Object.keys(d).sort(),['code','contentType','fase','intento','origin','redirected','status','totalMs'].sort());
});
async function remembered(){const s=fixture('primaria');s.el('inpRecordar').checked=true;await s.context.intentarLogin();await flush();s.stored.delete('ie22375_session_v1');return s;}
test('Remembered session paints Hub before verification and never calls login again',async()=>{
 const s=await remembered();let shown=0,release;s.context.mostrarHub=()=>shown++;s.context.IEStudents.preload=()=>new Promise(r=>release=r);
 const before=s.calls.length;assert.equal(s.context.restaurarSesionRecordada(),true);assert.equal(shown,1);assert.equal(s.calls.length,before);release(null);await flush();assert.equal(s.calls.filter(c=>c.body.action==='login').length,1);assert.equal(s.calls.filter(c=>c.body.action==='loadstudents').length,1);
});
test('Remembered verification waits for deferred students.js readiness without delaying Hub',async()=>{
 const s=await remembered();let shown=0,ready,reads=0;s.context.mostrarHub=()=>shown++;s.context.document.readyState='loading';s.context.document.addEventListener=(type,f)=>{assert.equal(type,'DOMContentLoaded');ready=f};s.context.IEStudents.preload=async()=>{reads++;return {inicializada:true}};
 s.context.restaurarSesionRecordada();assert.equal(shown,1);assert.equal(reads,0);ready();await flush();assert.equal(reads,1);
});
test('Confirmed background revocation removes session and cache but preserves attendance',async()=>{
 const s=await remembered();await s.context.ensureBD();s.local.set('ie22375_asistencia_colegio_v1','pending-synthetic');s.configure();s.context.restaurarSesionRecordada();await flush();
 assert.equal(s.context.getSession(),null);assert.equal(s.context.IEStudents.peek(),null);assert.equal(s.local.get('ie22375_asistencia_colegio_v1'),'pending-synthetic');assert.match(s.el('loginErr').textContent,/Vuelve a iniciar sesión/);
});
for(const code of ['HTTP','TIMEOUT','NETWORK'])test('Background '+code+' never logs out a valid remembered session',async()=>{
 const s=await remembered(),token=s.context.getSession().token;s.context.IEStudents.preload=async()=>{throw {code,status:404}};await s.context.precargarAuxiliar(true);assert.equal(s.context.getSession().token,token);
});
test('An old verification rejection never clears a replacement token',async()=>{
 const s=await remembered();let reject;s.context.IEStudents.preload=()=>new Promise((_,r)=>reject=r);const task=s.context.precargarAuxiliar(true);const next={...s.context.getSession(),token:'replacement-synthetic'};s.context.setSession(next);reject({code:'SESSION',authorizationRejected:true});await task;assert.equal(s.context.getSession().token,next.token);
});
test('Explicit logout and token expiry require authentication',async()=>{
 const s=await remembered();s.context.cerrarSesion();assert.equal(s.context.restaurarSesionRecordada(),false);assert.equal(s.local.has('ie22375_session_v1'),false);
 s.context.setSession({role:'auxiliar',ts:Date.now(),recordar:true,token:'synthetic',tokenExp:Date.now()-1});assert.equal(s.context.restaurarSesionRecordada(),false);
});
const bridgeSource=read('tests/auxiliar-local-first.test.cjs');const start=bridgeSource.indexOf('function bridge('),end=bridgeSource.indexOf('\ntest(',start);
const bridge=new Function('read','vm',bridgeSource.slice(start,end)+'\nreturn bridge;')(read,vm);
test('Remembered verification and Auxiliary navigation share the SW v5 preload',async()=>{
 const s=await remembered(),w=bridge(s.server);s.context.navigator={serviceWorker:{controller:w.controller}};s.context.MessageChannel=w.Channel;s.context.restaurarSesionRecordada();await flush();assert.equal(w.requests.length,1);
 const next=vm.createContext({window:{},navigator:s.context.navigator,MessageChannel:w.Channel,document:{getElementById:()=>null},sessionStorage:s.context.sessionStorage,localStorage:s.context.localStorage,atob,Date,setTimeout,clearTimeout});vm.runInContext(read('students.js'),next);
 const task=next.window.IEStudents.load();await flush();assert.equal(w.requests.length,1);w.release();const base=await task;await flush();assert.ok(base.primaria.estudiantes.length>0);assert.equal(s.context.IEStudents.peek().primaria.estudiantes.length,base.primaria.estudiantes.length);
});
for(const failure of ['404','500','timeout'])test('Actual protected background '+failure+' preserves remembered authorization and student cache',async()=>{
 const s=await remembered();await s.context.ensureBD();const token=s.context.getSession().token;const tick=clock(s);
 s.context.fetch=async(url,o)=>failure==='timeout'?pending(o.signal):{...missing(),status:Number(failure)};
 const task=s.context.precargarAuxiliar(true);await tick(failure==='timeout'?25200:1200);await task;
 assert.equal(s.context.getSession().token,token);assert.ok(s.context.IEStudents.peek());
});
test('Explicit SESSION response without explanatory text requires relogin',async()=>{
 const s=await remembered();s.context.fetch=async()=>({...ok(),json:async()=>({ok:false,code:'SESSION'})});
 await s.context.precargarAuxiliar(true);assert.equal(s.context.getSession(),null);assert.match(s.el('loginErr').textContent,/Vuelve a iniciar sesión/);
});
test('Restoration upgrades an in-flight optional preload to mandatory protected verification',async()=>{
 const s=await remembered();let release;s.context.IEStudents.preload=()=>new Promise(r=>release=r);const a=s.context.precargarAuxiliar();s.context.restaurarSesionRecordada();release(null);await a;assert.equal(s.calls.filter(c=>c.body.action==='loadstudents').length,1);
});
