'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const base='9b740af5408b1d5fb87f85ede5078d17ec45b1c8',old=f=>execFileSync('git',['show',base+':'+f],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
const boundary=require('./notas2-frontend-boundary.cjs'),stripBackend=require('./n2r3-backend-boundary.cjs');
for(const file of ['admin.html','primaria.html','secundaria.html','aula_innovacion.js','apps-script/Codigo.js','apps-script/Notas2.js','registro-local-store.js','registro-drafts.js','registro-recovery-ui.js','registro-calificar-print.js','registro-evaluation.js','registro-academic-model.js'])test('selective integration preserves '+file+' exactly',()=>{
 const raw=file==='apps-script/Notas2.js'?stripBackend(read(file)):read(file);
 assert.equal(raw,old(file));
});
for(const [kind,file]of [['html','registro.html'],['matrix','matrix-registry-import.js'],['sw','sw.js']])test('historical boundary excludes exact '+kind+' hooks without hiding unrelated source mutations',()=>{
 const raw=kind==='html'?read(file).replace(read('registro-connection.js').trim(),old('registro-connection.js').trim()):read(file);assert.equal(boundary(kind,raw),old(file));assert.equal(boundary(kind,old(file)),old(file));assert.notEqual(boundary(kind,raw+'\n/* unrelated synthetic mutation */'),old(file));
});
test('legacy styles/helpers and print implementation survive; only one active N2 synchronizer is initialized',()=>{
 const s=read('registro.html');for(const name of ['av-card','av-comp','av-meta','av-badge','av-ev','av-stu'])assert.match(s,new RegExp('\\.'+name+'\\b'));
 for(const name of ['markDirty','renderChipsCaps'])assert.match(s,new RegExp('function '+name+'\\('));
 assert.equal((s.match(/function create\(o\)/g)||[]).length,(old('registro.html').match(/function create\(o\)/g)||[]).length);
 assert.ok(s.includes('data-notas2="1"'));assert.ok(s.indexOf('src="registro-notas2-ui.js"')<s.indexOf('/* Adaptador frontend: operaciones explícitas'));
 assert.match(s,/dataset\?\.notas2==='1'\)\{if\(typeof IERegistroNotas2UI==='undefined'\)registroDependenciaFallida\(\);return;/);
 const original=read('registro-calificar-print.js').trim();assert.ok(s.includes(original));assert.equal((s.match(/src="registro-notas2-ui.js"/g)||[]).length,1);
});
test('missing mandatory calculation dependency pauses startup before academic state can be initialized',()=>{
 const s=read('registro.html'),a=s.indexOf('/* Dependencias obligatorias de la integración'),b=s.indexOf('const registroLocal =',a),guard=s.slice(a,b);let blocked=0;
 const g={IERegistroLocalStore:{},IERegistroConnection:{},IERegistroEvaluacion:{},registroDependenciaFallida(){blocked++;}};
 assert.throws(()=>vm.runInNewContext(guard,g),/falta una dependencia/);assert.equal(blocked,1);assert.equal(g.store,undefined);
});
test('matrix importer preserves historical calculation but adopted rows cannot invent live Promedios',()=>{
 const s=read('matrix-registry-import.js');assert.match(s,/else if\(p\.meta\?\.notas2\?\.adopted!==true\)/);assert.equal(boundary('matrix',s),old('matrix-registry-import.js'));
});

const setup=new Function('require','__dirname',read('tests/service-worker-static.test.cjs').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
const coupled=['registro.html','registro-notas2.js','registro-notas2-ui.js','registro-grading.js','registro-sync-diagnostic.js','registro-sync-diagnostic-ui.js','matrix-registry-import.js'];
const serve=s=>s.network(async req=>{const file=new URL(req.url).pathname.split('/').at(-1)||'index.html',js=file.endsWith('.js'),css=file.endsWith('.css');return new Response(fs.existsSync(path.join(root,file))?read(file):'<html>synthetic</html>',{headers:{'Content-Type':js?'application/javascript':css?'text/css':'text/html'}});});
test('v21 to v25 atomically installs exact N2 resources, retains historical resources and removes only application caches',async()=>{
 const s=setup();s.cache('matriz-ie22375-v21');s.cache('unrelated-user-cache');serve(s);await s.dispatch('install');assert.deepEqual(s.lifecycle,['skipWaiting']);
 assert.equal(s.stores.has('matriz-ie22375-v21'),true);await s.dispatch('activate');assert.equal(s.stores.has('matriz-ie22375-v21'),false);assert.equal(s.stores.has('unrelated-user-cache'),true);
 s.offline();for(const file of coupled.concat('aula_innovacion.js')){const r=await s.dispatch('fetch',{request:s.request(file)});assert.equal(r.status,200);assert.equal(await r.text(),read(file));assert.match(r.headers.get('content-type'),file.endsWith('.js')?/javascript/:/html/);}
});
for(const file of coupled)test('failed v25 install of '+file+' leaves installed v21 available',async()=>{
 const s=setup();const previous=s.cache('matriz-ie22375-v21');await previous.put(s.request('index.html'),new Response('previous synthetic page',{headers:{'Content-Type':'text/html'}}));
 s.network(async req=>{if(req.url.endsWith('/'+file))throw Error('Synthetic unavailable asset');return new Response(req.url.endsWith('.js')?'/* JS */':'<html>static</html>',{headers:{'Content-Type':req.url.endsWith('.js')?'application/javascript':'text/html'}});});
 await assert.rejects(s.dispatch('install'));assert.equal(s.lifecycle.includes('skipWaiting'),false);assert.equal(s.stores.has('matriz-ie22375-v21'),true);assert.equal(await (await previous.match(s.request('index.html'))).text(),'previous synthetic page');
});
test('v25 retains network-first, seven-day TTL, all main resources and private POST exclusion',async()=>{
 const config=s=>{const c={self:{registration:{scope:'https://fiction.invalid/'},addEventListener(){}},URL};vm.runInNewContext(s+'\nglobalThis.result={files:PRECACHE,ttl:MAX_STATIC_AGE_MS};',c);return c.result;};const before=config(old('sw.js')),after=config(read('sw.js'));
 assert.equal(after.ttl,before.ttl);for(const f of before.files)assert.ok(after.files.includes(f));
 const s=setup();serve(s);await s.dispatch('install');const count=s.calls.length;assert.equal(await s.dispatch('fetch',{request:new Request('https://academic.invalid/exec',{method:'POST',body:'synthetic'})}),undefined);assert.equal(s.calls.length,count);
});
