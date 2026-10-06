const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const studentsFixture=new Function('require','__dirname',read('tests/backend-students.test.cjs').split('\ntest(')[0]+'\nreturn studentsFixture;')(require,__dirname);
const indexFixture=new Function('require','__dirname',read('tests/auxiliar-production-diagnostic.test.cjs').split('\nfor(const nivel')[0]+'\nreturn fixture;')(require,__dirname);
const API='https://script.google.com/macros/s/synthetic-deployment/exec',ORIGIN='https://matriz.biblioteca360.com',CHILD='https://n-synthetic-0lu-script.googleusercontent.com';
const CHANNEL='IE22375_LOGIN_BRIDGE_V1';
function backend() {
  const s=studentsFixture();s.c.Date={now:()=>1800000000000};
  const props=s.c.PropertiesService.getScriptProperties();
  props.setProperty('IE22375_ADMIN_PASS','synthetic-login-value');props.setProperty('IE22375_PIP_PASS','synthetic-login-value');
  s.docentes[0].pass='synthetic-login-value';s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.cacheEntries.clear();
  return s;
}
function bridgeFixture(server=backend(),mode='login') {
  let parentReceive,childReceive,frameError,success,failure,blocked=false;
  const sent=[],rpc=[],callbacks=[],timers=new Map(),parent={},outer={},child={};
  parent.parent=parent;outer.parent=parent;child.parent=outer;
  parent.location={origin:ORIGIN};parent.crypto=crypto.webcrypto;
  parent.addEventListener=(type,fn)=>{assert.equal(type,'message');parentReceive=fn};
  child.addEventListener=(type,fn)=>{assert.equal(type,'message');childReceive=fn};
  parent.postMessage=(data,target)=>{if(target===ORIGIN)parentReceive({source:child,origin:CHILD,data:clone(data)})};
  outer.postMessage=()=>{};
  child.postMessage=(data,target)=>{sent.push(clone(data));if(target===CHILD)childReceive({source:parent,origin:ORIGIN,data:clone(data)})};
  const frame={contentWindow:outer,addEventListener:(type,fn)=>{assert.equal(type,'error');frameError=fn}};
  parent.document={createElement:tag=>{assert.equal(tag,'iframe');return frame},body:{appendChild:value=>assert.equal(value,frame)}};
  const c=vm.createContext({window:parent,URL,Uint8Array,setTimeout:(fn,ms)=>{const id=timers.size+1;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(read('login-bridge.js'),c);const api=parent.IELoginBridge.create(API,mode);
  const config={origin:ORIGIN,nonce:new URL(frame.src).searchParams.get('nonce'),mode};
  const runner={withSuccessHandler:fn=>{success=fn;return runner},withFailureHandler:fn=>{failure=fn;return runner},loginBridgeAutenticar:body=>{rpc.push(clone(body));callbacks.push(success);if(!blocked)success(server.c.loginBridgeAutenticar(body))},studentsBridgeCargar:body=>{rpc.push(clone(body));callbacks.push(success);if(!blocked)success(server.c.studentsBridgeCargar(body))}};
  const inner=vm.createContext({window:child,google:{script:{run:runner}}});
  const start=()=>vm.runInContext('('+server.c.loginBridgeFrame_.toString()+')('+JSON.stringify(config)+')',inner);
  const msg=(type,extra={})=>({channel:CHANNEL,nonce:config.nonce,type,...extra});
  return {api,frame,config,parent,outer,child,sent,rpc,timers,start,msg,server,
    receiveParent:event=>parentReceive(event),receiveChild:event=>childReceive(event),unavailable:()=>frameError(),block:()=>{blocked=true},resolve:body=>success(body),resolveRpc:(index,body)=>callbacks[index](body),fail:()=>failure(new Error('private error must not escape'))};
}
test('bridge handshake binds the sandbox descendant, source, origin and random session nonce before login',async()=>{
  const s=bridgeFixture();assert.equal(s.api.ready(),false);assert.match(s.config.nonce,/^[a-f0-9]{32}$/);
  s.start();assert.equal(s.api.ready(),true);assert.equal(s.sent[0].type,'init');
  const result=await s.api.login('admin','admin','synthetic-login-value');assert.equal(result.ok,true);assert.equal(s.rpc.length,1);
  assert.notEqual(bridgeFixture().config.nonce,s.config.nonce);
});
for(const kind of ['origin','source','nonce'])test('parent rejects incorrect '+kind+' during handshake and result',async()=>{
  const s=bridgeFixture(),bad=()=>({source:kind==='source'?{parent:null}:s.child,origin:kind==='origin'?'https://evil.example':CHILD,data:s.msg('ready',kind==='nonce'?{nonce:'0'.repeat(32)}:{})});
  s.receiveParent(bad());assert.equal(s.api.ready(),false);assert.equal(s.sent.length,0);
  s.start();s.block();let finished=false;const task=s.api.login('admin','admin','synthetic-login-value').then(v=>{finished=true;return v});
  const login=s.sent.at(-1),event=bad();event.data=s.msg('result',{id:login.id,result:{ok:true,token:'untrusted'}});if(kind==='nonce')event.data.nonce='0'.repeat(32);
  s.receiveParent(event);await Promise.resolve();assert.equal(finished,false);
  s.resolve({ok:false,error:'Rejected'});assert.equal((await task).ok,false);
});
for(const kind of ['origin','source','nonce'])test('iframe rejects incorrect '+kind+' before calling authentication RPC',()=>{
  const s=bridgeFixture();s.start();
  const data=s.msg('login',{id:1,body:{tipo:'admin',usuario:'admin',password:'synthetic-login-value'}});if(kind==='nonce')data.nonce='0'.repeat(32);
  s.receiveChild({source:kind==='source'?s.outer:s.parent,origin:kind==='origin'?'https://evil.example':ORIGIN,data});assert.equal(s.rpc.length,0);
});
test('credentials never appear in iframe URL or storage; only exact postMessage target origins are used',async()=>{
  const s=bridgeFixture();s.start();await s.api.login('docente','test-primary','synthetic-login-value');
  assert.deepEqual([...new URL(s.frame.src).searchParams.keys()].sort(),['bridge','nonce','parentOrigin']);
  assert.doesNotMatch(s.frame.src,/test-primary|synthetic-login-value|token|password|usuario/);
  assert.doesNotMatch(read('login-bridge.js'),/localStorage|sessionStorage|postMessage\([^\n]*['"]\*['"]/);
  assert.doesNotMatch(s.server.c.loginBridgeFrame_.toString(),/localStorage|sessionStorage|['"]\*['"]/);
});
for(const [role,user,password] of [['admin','admin','synthetic-login-value'],['docente','test-primary','synthetic-login-value'],['auxiliar','auxiliar','synthetic-aux-password'],['pip','pip','synthetic-login-value']])test(role+': bridge returns exactly responderLogin_ model and signed authorization',async()=>{
  const s=bridgeFixture();s.start();const body={tipo:role,usuario:user,password};
  const expected=clone(s.server.c.responderLogin_(body)),actual=await s.api.login(role,user,password);
  assert.deepEqual(actual,expected);assert.equal(actual.role,role);assert.equal(actual.tokenExp,1800000000000+12*60*60*1000);
  assert.equal(actual.password,undefined);assert.equal(actual.pass,undefined);
});
test('incorrect bridge credentials return denial once without retry or fetch fallback',async()=>{
  const s=bridgeFixture();s.start();const f=indexFixture('primaria');f.context.puente=s.api;f.run('puenteLogin=puente');
  const before=f.calls.length,result=await f.context.loginBackend('admin','admin','wrong-synthetic-value');
  assert.equal(result.ok,false);assert.equal(s.rpc.length,1);assert.equal(f.calls.length,before);
});
test('bridge unavailable or iframe load error falls back to the existing fetch without waiting',async()=>{
  for(const fail of [false,true]) {
    const s=bridgeFixture();if(fail){s.start();s.unavailable();}const f=indexFixture('primaria');f.context.puente=s.api;f.run('puenteLogin=puente');
    assert.equal((await f.context.loginBackend('auxiliar','diagnostic-aux','synthetic-pass')).ok,true);
    assert.equal(f.calls.filter(c=>c.body.action==='login').length,1);assert.equal(s.rpc.length,0);
  }
});
test('RPC transport failure never causes a second authentication request through fetch',async()=>{
  const s=bridgeFixture();s.start();s.block();const f=indexFixture('primaria');f.context.puente=s.api;f.run('puenteLogin=puente');
  const before=f.calls.length,task=f.context.loginBackend('admin','admin','synthetic-login-value');s.fail();
  await assert.rejects(task,e=>e.code==='BRIDGE_ERROR');assert.equal(s.rpc.length,1);assert.equal(f.calls.length,before);
});
test('bridge keeps the 18-second deadline, makes one RPC and ignores its late response',async()=>{
  const s=bridgeFixture();s.start();s.block();const task=s.api.login('admin','admin','synthetic-login-value');
  const rejection=assert.rejects(task,e=>e.code==='BRIDGE_TIMEOUT');
  assert.equal(s.timers.size,1);const timer=[...s.timers.values()][0];assert.equal(timer.ms,18000);
  timer.fn();await rejection;assert.equal(s.api.ready(),false);assert.equal(s.rpc.length,1);
  s.resolve({ok:true,token:'late-token'});assert.equal(s.api.ready(),false);
});
test('obsolete request id cannot complete a later bridge login',async()=>{
  const s=bridgeFixture();s.start();await s.api.login('admin','admin','synthetic-login-value');s.block();let done=false;
  const task=s.api.login('admin','admin','synthetic-login-value').then(r=>{done=true;return r});
  s.receiveParent({source:s.child,origin:CHILD,data:s.msg('result',{id:1,result:{ok:true,token:'obsolete'}})});
  await Promise.resolve();assert.equal(done,false);s.resolve({ok:false,error:'Rejected'});await task;
});
test('old login reply cannot replace a newly stored session and password never persists',async()=>{
  const s=bridgeFixture();s.start();s.block();const f=indexFixture('primaria');f.context.puente=s.api;f.run('puenteLogin=puente');
  const task=f.context.intentarLogin();f.context.setSession({role:'admin',user:'admin',token:'new-session',tokenExp:Date.now()+60000,ts:Date.now()});
  s.resolve({ok:true,role:'auxiliar',user:'old-user',token:'old-session',tokenExp:Date.now()+60000});await task;
  assert.equal(f.context.getSession().token,'new-session');assert.doesNotMatch([...f.stored.values(),...f.local.values()].join(''),/synthetic-pass|password/);
});
test('successful bridge login uses the unchanged index session model without persisting password',async()=>{
  const s=bridgeFixture();s.start();const f=indexFixture('primaria');f.context.puente=s.api;f.run('puenteLogin=puente');
  f.el('inpTipo').value='admin';f.el('inpDocUser').value='admin';f.el('inpPass').value='synthetic-login-value';f.el('inpRecordar').checked=true;
  await f.context.intentarLogin();assert.equal(f.context.getSession().role,'admin');assert.equal(f.context.getSession().token,s.server.c.responderLogin_({tipo:'admin',usuario:'admin',password:'synthetic-login-value'}).token);
  assert.doesNotMatch([...f.stored.values(),...f.local.values()].join(''),/synthetic-login-value|password/);
});
test('doGet exposes HtmlService only for the specific bridge parameter and validated origin/nonce',()=>{
  const s=backend();s.c.HtmlService={XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput:html=>({html,setXFrameOptionsMode(mode){assert.equal(mode,'ALLOWALL');return this},setTitle(){return this}})};
  const view=s.c.doGet({parameter:{bridge:'login-v1',parentOrigin:ORIGIN,nonce:'a'.repeat(32)}});
  assert.match(view.html,/google\.script\.run/);new vm.Script(view.html.match(/<script>([\s\S]*)<\/script>/)[1]);
  for(const parameter of [{bridge:'other'},{bridge:'login-v1',parentOrigin:'https://evil.example',nonce:'a'.repeat(32)},{bridge:'login-v1',parentOrigin:ORIGIN,nonce:'<script>'}])
    assert.equal(s.c.doGet({parameter}).html,undefined);
});
