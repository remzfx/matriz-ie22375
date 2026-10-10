const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
function fixture() {
  const scope='https://synthetic.example/matriz-ie22375/',handlers={},stores=new Map(),calls=[],lifecycle=[];
  let now=Date.now(),network=async req=>new Response(req.url.endsWith('.js')?'/* original JavaScript */':'<html>static</html>',
    {headers:{'Content-Type':req.url.endsWith('.js')?'application/javascript':'text/html'}});
  const key=req=>new URL(typeof req==='string'?req:req.url,scope).href;
  function cache(name) {
    if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);
    return {put:async(req,response)=>entries.set(key(req),response.clone()),match:async req=>entries.get(key(req))?.clone(),delete:async req=>entries.delete(key(req))};
  }
  const context=vm.createContext({URL,Request,Response,Headers,Set,Promise,Date:{now:()=>now},
    self:{registration:{scope},addEventListener:(name,handler)=>{handlers[name]=handler},skipWaiting:async()=>{lifecycle.push('skipWaiting')},clients:{claim:async()=>{lifecycle.push('claim')}}},
    caches:{open:async name=>cache(name),keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)},
    fetch:async(req,options)=>{calls.push({req,options});return network(req,options);}});
  vm.runInContext(source,context);
  async function dispatch(type,data={}) {
    const pending=[];let response;
    handlers[type]({...data,waitUntil:promise=>pending.push(promise),respondWith:promise=>{response=promise}});
    const result=response?await response:undefined;await Promise.all(pending);return result;
  }
  return {scope,stores,calls,lifecycle,cache,dispatch,request:file=>new Request(new URL(file,scope)),offline:()=>{network=async()=>{throw Error('offline')}},
    network:fn=>{network=fn},advance:ms=>{now+=ms},now:()=>now};
}

test('SW precaches critical JavaScript and matrix-teachers.js offline returns JavaScript',async()=>{
  const s=fixture();await s.dispatch('install');
  for(const file of ['registro-transversales.js','registro-evaluation.js','matrix-teachers.js','students.js','student-identity.js','students-migration.js','aula_innovacion.js'])
    assert.ok(s.calls.some(call=>call.req.url.endsWith('/'+file)));
  s.offline();const response=await s.dispatch('fetch',{request:s.request('matrix-teachers.js')});
  assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/javascript/);
  assert.equal(await response.text(),'/* original JavaScript */');
});
test('SW offline missing or HTML-corrupted JavaScript cache never falls back to index.html',async()=>{
  const s=fixture();await s.dispatch('install');s.offline();
  const cache=s.cache('matriz-ie22375-v14');
  await cache.put(s.request('matrix-teachers.js'),new Response('<html>wrong cached page</html>',
    {headers:{'Content-Type':'text/html','X-IE-Cached-At':String(s.now())}}));
  for(const file of ['matrix-teachers.js','uncached.js','another.mjs']) {
    const response=await s.dispatch('fetch',{request:s.request(file)});
    assert.equal(response.type,'error');assert.doesNotMatch(await response.text(),/<html|<!doctype/i);
  }
});
test('SW network-first refreshes static JS and uses the new code after reconnection',async()=>{
  const s=fixture();await s.dispatch('install');
  s.network(async()=>new Response('/* revised JavaScript */',{headers:{'Content-Type':'text/javascript'}}));
  const live=await s.dispatch('fetch',{request:s.request('matrix-teachers.js')});assert.equal(await live.text(),'/* revised JavaScript */');
  assert.equal(s.calls.at(-1).options.cache,'no-store');
  s.offline();const cached=await s.dispatch('fetch',{request:s.request('matrix-teachers.js')});assert.equal(await cached.text(),'/* revised JavaScript */');
});
test('SW rejects a network HTML response to a JavaScript request and recovers valid cached JS',async()=>{
  const s=fixture();await s.dispatch('install');s.network(async()=>new Response('<html>wrong route</html>',{headers:{'Content-Type':'text/html'}}));
  const response=await s.dispatch('fetch',{request:s.request('matrix-teachers.js')});assert.equal(await response.text(),'/* original JavaScript */');
});
test('SW expires static versions after seven days and cleans previous application caches',async()=>{
  const s=fixture();s.cache('matriz-ie22375-v1');s.cache('unrelated-cache');await s.dispatch('install');await s.dispatch('activate');
  assert.equal(s.stores.has('matriz-ie22375-v1'),false);assert.equal(s.stores.has('unrelated-cache'),true);
  s.advance(8*24*60*60*1000);s.offline();const response=await s.dispatch('fetch',{request:s.request('matrix-teachers.js')});
  assert.equal(response.type,'error');assert.equal(await s.cache('matriz-ie22375-v14').match(s.request('matrix-teachers.js')),undefined);
});
test('SW neither caches private API responses nor uses HTML fallback for APIs or POST',async()=>{
  const s=fixture();await s.dispatch('install');
  const api=s.request('api?action=loadperiodos');
  s.network(async()=>new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}}));
  await s.dispatch('fetch',{request:api});assert.equal(await s.cache('matriz-ie22375-v14').match(api),undefined);
  s.offline();const response=await s.dispatch('fetch',{request:api});assert.equal(response.type,'error');
  assert.equal(await s.dispatch('fetch',{request:new Request(api.url,{method:'POST',body:'synthetic'})}),undefined);
  for(const url of ['https://synthetic-api.example/exec','https://synthetic-cdn.example/library.js']) {
    const before=s.calls.length;
    assert.equal(await s.dispatch('fetch',{request:new Request(url)}),undefined);
    assert.equal(s.calls.length,before);
  }
});

test('SW precaches auxiliar.html and serves its exact static page offline, excluding Admin management',async()=>{
  const s=fixture(),html=fs.readFileSync(path.join(__dirname,'../auxiliar.html'),'utf8');
  s.network(async req=>new Response(req.url.endsWith('auxiliar.html')?html:req.url.endsWith('.js')?'/* JS */':'<html>home</html>',
    {headers:{'Content-Type':req.url.endsWith('.js')?'application/javascript':'text/html'}}));
  await s.dispatch('install');s.offline();
  const response=await s.dispatch('fetch',{request:s.request('auxiliar.html')});
  assert.equal(response.status,200);assert.equal(await response.text(),html);
  assert.ok(s.calls.some(call=>call.req.url.endsWith('/auxiliar.html')));
  assert.equal(s.calls.some(call=>call.req.url.endsWith('/auxiliar-admin.js')),false);
  assert.equal(await s.cache('matriz-ie22375-v14').match(s.request('auxiliar-admin.js')),undefined);
});

test('SW offline auxiliar-permissions.js returns executable JavaScript, never index.html',async()=>{
  const s=fixture(),js=fs.readFileSync(path.join(__dirname,'../auxiliar-permissions.js'),'utf8');
  s.network(async req=>new Response(req.url.endsWith('auxiliar-permissions.js')?js:req.url.endsWith('.js')?'/* JS */':'<html>home</html>',
    {headers:{'Content-Type':req.url.endsWith('.js')?'application/javascript':'text/html'}}));
  await s.dispatch('install');s.offline();
  const response=await s.dispatch('fetch',{request:s.request('auxiliar-permissions.js')}),body=await response.text();
  assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/javascript/);
  assert.equal(body,js);assert.doesNotMatch(body,/<html|<!doctype/i);
  const context={window:{}};vm.runInNewContext(body,context);
  assert.equal(typeof context.window.IEAuxPermissions.configurar,'function');
});

test('SW missing or HTML-corrupted auxiliar-permissions.js never receives the cached home page',async()=>{
  const s=fixture();await s.dispatch('install');s.offline();
  const cache=s.cache('matriz-ie22375-v14'),request=s.request('auxiliar-permissions.js');
  await cache.put(request,new Response('<html>wrong</html>',{headers:{'Content-Type':'text/html','X-IE-Cached-At':String(s.now())}}));
  for(let i=0;i<2;i++){
    const response=await s.dispatch('fetch',{request});
    assert.equal(response.type,'error');assert.doesNotMatch(await response.text(),/<html|<!doctype/i);
  }
  assert.ok(await cache.match(s.request('index.html')));
  assert.equal(await cache.match(request),undefined);
});

test('SW activating v14 deletes v2, v3 and v4 while preserving the installed cache and unrelated caches',async()=>{
  const s=fixture();s.cache('matriz-ie22375-v2');s.cache('matriz-ie22375-v3');s.cache('matriz-ie22375-v4');s.cache('matriz-ie22375-v5');s.cache('matriz-ie22375-v6');s.cache('matriz-ie22375-v7');s.cache('matriz-ie22375-v9');s.cache('matriz-ie22375-v10');s.cache('matriz-ie22375-v11');s.cache('matriz-ie22375-v13');s.cache('unrelated-cache');
  await s.dispatch('install');await s.dispatch('activate');
  assert.equal(s.stores.has('matriz-ie22375-v2'),false);
  assert.equal(s.stores.has('matriz-ie22375-v3'),false);
  assert.equal(s.stores.has('matriz-ie22375-v4'),false);assert.equal(s.stores.has('matriz-ie22375-v5'),false);
  assert.equal(s.stores.has('matriz-ie22375-v6'),false);
  assert.equal(s.stores.has('matriz-ie22375-v7'),false);assert.equal(s.stores.has('matriz-ie22375-v9'),false);
  assert.equal(s.stores.has('matriz-ie22375-v13'),false);assert.equal(s.stores.has('matriz-ie22375-v11'),false);assert.equal(s.stores.has('matriz-ie22375-v10'),false);assert.equal(s.stores.has('matriz-ie22375-v14'),true);
  assert.equal(s.stores.has('unrelated-cache'),true);
  assert.ok(await s.cache('matriz-ie22375-v14').match(s.request('auxiliar-permissions.js')));
});

test('SW never intercepts Apps Script login or protected student POST requests',async()=>{
  const s=fixture();await s.dispatch('install');const before=s.calls.length;
  const endpoint='https://script.google.com/macros/s/verified-synthetic-deployment/exec';
  for(const action of ['login','loadstudents']){
    const response=await s.dispatch('fetch',{request:new Request(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action})})});
    assert.equal(response,undefined);assert.equal(s.calls.length,before);
    assert.equal(await s.cache('matriz-ie22375-v14').match(new Request(endpoint)),undefined);
  }
});

test('SW installs and returns exact current Auxiliary resources offline; HTML and JS never substitute each other',async()=>{
  const s=fixture(),files=['index.html','students.js','auxiliar.html','auxiliar-permissions.js'];
  const current=new Map(files.map(file=>[file,fs.readFileSync(path.join(__dirname,'..',file),'utf8')]));
  s.network(async req=>{
    const file=new URL(req.url).pathname.split('/').at(-1);
    return new Response(current.get(file)||(file.endsWith('.js')?'/* synthetic JS */':'<html>synthetic</html>'),
      {headers:{'Content-Type':file.endsWith('.js')?'application/javascript':'text/html'}});
  });
  await s.dispatch('install');s.offline();
  for(const file of files){
    const response=await s.dispatch('fetch',{request:s.request(file)});
    assert.equal(await response.text(),current.get(file));
  }
});

test('SW v14 cannot take over before all Auxiliary dependencies install successfully',async()=>{
  const s=fixture();s.cache('matriz-ie22375-v3');
  s.network(async req=>new Response(req.url.endsWith('auxiliar-permissions.js')?'<html>bad script</html>':req.url.endsWith('.js')?'/* JS */':'<html>page</html>',
    {headers:{'Content-Type':req.url.endsWith('.js')&&!req.url.endsWith('auxiliar-permissions.js')?'application/javascript':'text/html'}}));
  await assert.rejects(s.dispatch('install'),/Recurso estático/);
  assert.equal(s.lifecycle.includes('skipWaiting'),false);assert.equal(s.stores.has('matriz-ie22375-v3'),true);
});

test('transversal static dependencies recover offline while private RPC/POST responses never enter CacheStorage',async()=>{
 const s=fixture();await s.dispatch('install');s.offline();
 const js=await s.dispatch('fetch',{request:s.request('transversales-client.js')});assert.match(js.headers.get('Content-Type'),/javascript/);
 const page=await s.dispatch('fetch',{request:s.request('transversales.html')});assert.equal(page.status,200);
 const api=new Request('https://script.google.com/macros/s/synthetic/exec',{method:'POST',body:'synthetic private request'});assert.equal(await s.dispatch('fetch',{request:api}),undefined);assert.equal(await s.cache('matriz-ie22375-v14').match(api),undefined);
});

for(const resource of ['registro.html','registro-academic-model.js','registro-evaluation.js','registro-transversales.js','transversales.html','transversales-client.js'])test('SW v14 installs current coupled grading resource: '+resource,async()=>{const s=fixture();await s.dispatch('install');s.network(async()=>{throw Error('offline')});const response=await s.dispatch('fetch',{request:s.request(resource)});assert.equal(response.ok,true);if(resource.endsWith('.js'))assert.match(response.headers.get('Content-Type'),/javascript/);assert.ok(s.stores.has('matriz-ie22375-v14'));});
