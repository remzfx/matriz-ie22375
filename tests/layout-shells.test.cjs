const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),base='0c6c39732e64ef670b4f106f369cf9df0f7c58ca';
const original=p=>execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}).replace(/\r\n/g,'\n');
const modules={'index.html':'ops','registro.html':'work','admin.html':'wide','auxiliar.html':'ops','aula_innovacion.html':'wide','primaria.html':'wide','secundaria.html':'wide','photochecks.html':'wide','transversales.html':'wide'};

test('screen-only shells have functional width limits, fluid gutters and precedence over Tailwind utilities',()=>{
 const css=read('layout-shells.css');assert.match(css,/@media screen\s*\{/);assert.doesNotMatch(css,/@media print|!important|overflow:\s*hidden|zoom:|transform:|font|color:/);
 for(const [kind,width] of Object.entries({auth:560,ops:820,work:1400,wide:1400}))assert.match(css,new RegExp('\\.shell\\.shell-'+kind+'\\s*\\{\\s*max-width:\\s*'+width+'px;'));
 assert.match(css,/width: 100%/);assert.match(css,/min-width: 0/);assert.match(css,/box-sizing: border-box/);assert.match(css,/padding-inline: clamp\(12px, 2vw, 24px\)/);
});
for(const [file,shell] of Object.entries(modules))test(file+' uses its functional main shell and a single shared stylesheet',()=>{
 const html=read(file);assert.equal((html.match(/href="layout-shells.css"/g)||[]).length,1);assert.match(html,new RegExp('<main\\b[^>]*class="[^"\\n]*shell shell-'+shell));
 if(file!=='transversales.html')assert.match(html.slice(html.indexOf('<header'),html.indexOf('</header>')),new RegExp('shell shell-'+shell));
});
test('login stays compact inside shell-auth and Registro entry selector uses the simple form shell',()=>{
 assert.match(read('index.html'),/id="viewLogin" class="shell shell-auth /);assert.match(read('index.html'),/<div class="w-full max-w-sm">/);assert.match(read('registro.html'),/id="viewHome" class="hidden shell shell-auth /);
});
test('HTML changes are limited to shells, stylesheet links and approved caption/subtitle presentation; business logic is identical',()=>{
 for(const file of Object.keys(modules)){
  let actual=read(file).replace(/\r\n/g,'\n').replace(/shell shell-(?:auth|ops|work|wide) /g,'').replace(/ class="shell shell-wide"/g,'').replace(/  <link rel="stylesheet" href="layout-shells.css" \/>\n/g,'');
  if(file==='index.html')actual=actual.replace('Aportes · revisión Tutor + Admin','Aportes · consolidación Tutor + AIP');
  if(file==='registro.html')actual=actual.replace('<small style="display:block;font-size:10px;font-weight:600">Dato informativo · no SIAGIE</small>','<small>Dato informativo · no SIAGIE</small>');
  assert.equal(actual,original(file),file);
 }
});
test('Registro shares shell-work across header, context, all panels main and lower bar without per-tab widths',()=>{
 const html=read('registro.html'),wrappers=html.match(/<(?:div|main)\b[^>]*class="[^"\n]*max-w-3xl[^"\n]*"[^>]*>/g);assert.equal(wrappers.length,4);wrappers.forEach(tag=>assert.match(tag,/shell shell-work/));
 const start=html.indexOf('<main class="shell shell-work'),main=html.slice(html.indexOf('>',start)+1,html.indexOf('</main>',start));assert.doesNotMatch(main,/max-w-3xl|shell shell-(?:wide|ops|auth)/g);for(const panel of ['panelCalificar','panelFinales','panelAvance','panelAsistencia'])assert.match(main,new RegExp('id="'+panel+'"'));
});
test('Hub transversal caption reflects Tutor and Admin review without obsolete AIP attribution',()=>{
 const module=read('index.html').match(/transversales:\s*\{[^}]+\}/)[0];assert.match(module,/desc:'Aportes · revisión Tutor \+ Admin'/);assert.doesNotMatch(module,/AIP|Tutor \+ AIP/);
});
test('Resumen keeps one referential average column and renders its informational subtitle on a smaller separate line',()=>{
 const html=read('registro.html'),headers=[...html.matchAll(/<th>Promedio referencial([\s\S]*?)<\/th>/g)];assert.equal(headers.length,1);assert.match(headers[0][1],/^<small style="display:block;font-size:10px;font-weight:600">Dato informativo · no SIAGIE<\/small>$/);assert.doesNotMatch(headers[0][1],/<th|<td/);
});
test('Apps Script tree is unchanged from the verified main base',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',base,'apps-script/'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 for(const file of files)assert.equal(read(file).replace(/\r\n/g,'\n'),original(file),file);
});
test('critical tables retain horizontal scroll, minimum column sizes and sticky student styling',()=>{
 for(const file of ['registro.html','transversales.html','primaria.html','secundaria.html','admin.html'])assert.match(read(file),/overflow-x(?::\s*auto|-auto)/,file);
 assert.match(read('registro.html'),/\.fin-wrap \{ overflow-x:auto/);assert.match(read('registro.html'),/\.fin-grid th\.fin-nom[^\n]*position:sticky; left:0/);assert.match(read('transversales.html'),/\.trans-grid-wrap\{overflow-x:auto/);assert.match(read('transversales.html'),/\.trans-grid\{[^}]*min-width:900px/);
});
test('Photochecks keeps exact print rules, QR dimensions and legacy print wrapper widths',()=>{
 const old=original('photochecks.html'),now=read('photochecks.html').replace(/\r\n/g,'\n');assert.equal(now.match(/<style>([\s\S]*?)<\/style>/)[1],old.match(/<style>([\s\S]*?)<\/style>/)[1]);assert.match(now,/<main class="shell shell-wide max-w-4xl mx-auto px-4 py-4">/);
});
test('SW changes only static version and shared stylesheet entry, preserving API transport and cache policy',()=>{
 const sw=read('sw.js').replace(/\r\n/g,'\n');assert.match(sw,/CACHE_PREFIX \+ 'v14'/);assert.match(sw,/'\.\/layout-shells.css'/);assert.equal(sw.replace("CACHE_PREFIX + 'v14'","CACHE_PREFIX + 'v13'").replace("'./layout-shells.css', ",''),original('sw.js'));
});
test('v14 installs actual shared CSS and serves it offline without caching external Apps Script POST',async()=>{
 const setup=new Function('require','__dirname',read('tests/service-worker-static.test.cjs').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname),s=setup(),css=read('layout-shells.css');
 s.network(async req=>new Response(req.url.endsWith('.css')?css:req.url.endsWith('.js')?'/* JS */':'<html>static</html>',{headers:{'Content-Type':req.url.endsWith('.css')?'text/css':req.url.endsWith('.js')?'application/javascript':'text/html'}}));
 s.cache('matriz-ie22375-v13');await s.dispatch('install');await s.dispatch('activate');assert.equal(s.stores.has('matriz-ie22375-v13'),false);assert.equal(s.stores.has('matriz-ie22375-v14'),true);
 s.offline();const response=await s.dispatch('fetch',{request:s.request('layout-shells.css')});assert.equal(await response.text(),css);assert.equal(response.headers.get('Content-Type'),'text/css');
 const req=new Request('https://script.google.com/macros/s/synthetic/exec',{method:'POST',body:'synthetic'});assert.equal(await s.dispatch('fetch',{request:req}),undefined);assert.equal(await s.cache('matriz-ie22375-v14').match(req),undefined);
});
