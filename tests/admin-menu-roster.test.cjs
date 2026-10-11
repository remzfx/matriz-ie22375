const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {page,base,roster,extract}=new Function('require','__dirname',read('tests/academic-roster-display-order.test.cjs').split('for(const [nivel,total')[0]+'\nreturn {page,base,roster,extract};')(require,__dirname);
function menu(){
 const p=page(),calls=[];
 p.run("let resumenMenuAdmin={token:'',base:null,padron:null,bimestre:'',baseEstado:'Pendiente',padronEstado:'Pendiente'},resumenMenuSecuencia=0;");
 p.c.IEStudents.peek=()=>null;p.c.IEStudents.load=async()=>{calls.push('base');return base();};
 p.c.IEStudents.loadRoster=async b=>{calls.push('roster:'+b);return roster(b);};
 p.c.bajarPeriodosNube=async()=>{calls.push('periodos');return {anio:2026,bimestres:{I:'cerrado',II:'cerrado',III:'abierto',IV:'bloqueado'}};};
 for(const name of ['conteosResumenAdmin','actualizarResumen','cargarResumenMenuAdmin'])p.run(extract('admin.html',name));
 return {...p,calls};
}
test('Admin menu distinguishes historical 415, actual academic 403 and transferred 12 from protected separate sources',async()=>{
 const p=menu(),before=p.run('JSON.stringify(estado)');await p.c.cargarResumenMenuAdmin();
 assert.match(p.el('statAlumnos').textContent,/BASE_ACTUAL.*150 Primaria \/ 265 Secundaria \/ Total 415 · Verificado por servidor/);
 assert.match(p.el('statVigentes').textContent,/III Bimestre.*146 Primaria \/ 257 Secundaria \/ Total 403.*PADRON_III · Verificado por servidor/);
 assert.match(p.el('statTrasladados').textContent,/4 Primaria \/ 8 Secundaria \/ Total 12 · Verificado por servidor/);
 assert.match(p.el('resumenRapido').innerHTML,/Resumen académico — III Bimestre.*146 estudiantes vigentes.*257 estudiantes vigentes.*Total institucional: 403/);
 assert.match(p.el('resumenRapido').innerHTML,/Base histórica — BASE_ACTUAL:.*415 estudiantes, incluidos 12 trasladados/);
 assert.equal(p.run('JSON.stringify(estado)'),before);assert.deepEqual(p.calls,['base','periodos','roster:III']);
});
test('quick classroom counts use the real roster, not base entries excluded by transfers',async()=>{
 const p=menu();await p.c.cargarResumenMenuAdmin();const rows=roster(),html=p.el('resumenRapido').innerHTML;
 for(const n of ['primaria','secundaria']){const expected=rows[n].estudiantes.filter(a=>a.grado===1).length;assert.ok(html.includes('1° A: '+expected));}
 const original=base().secundaria.estudiantes.filter(a=>a.grado===1).length;assert.notEqual(original,roster().secundaria.estudiantes.filter(a=>a.grado===1).length);
});
test('menu counts derive from roster response and never infer academic membership by subtracting current transfers',async()=>{
 const p=menu(),actual=roster();actual.secundaria.estudiantes.pop();p.c.IEStudents.loadRoster=async()=>actual;
 await p.c.cargarResumenMenuAdmin();assert.match(p.el('statVigentes').textContent,/146 Primaria \/ 256 Secundaria \/ Total 402/);assert.match(p.el('statAlumnos').textContent,/Total 415/);
});
test('menu chooses IV from live period configuration and labels its exact quarterly source',async()=>{
 const p=menu();p.c.bajarPeriodosNube=async()=>({bimestres:{I:'cerrado',II:'cerrado',III:'cerrado',IV:'abierto'}});
 await p.c.cargarResumenMenuAdmin();assert.deepEqual(p.calls,['base','roster:IV']);assert.match(p.el('statVigentes').textContent,/IV Bimestre.*PADRON_IV/);assert.doesNotMatch(p.el('resumenRapido').innerHTML,/III Bimestre/);
});
test('menu missing own roster labels uninitialized without using BASE_ACTUAL as academic enrollment',async()=>{
 const p=menu();p.c.IEStudents.loadRoster=async b=>({...base(),bimestre:b,padronInicializado:false});await p.c.cargarResumenMenuAdmin();
 assert.match(p.el('statVigentes').textContent,/III Bimestre: — · Padrón no inicializado/);assert.doesNotMatch(p.el('statVigentes').textContent,/415|403|150|265/);assert.doesNotMatch(p.el('resumenRapido').innerHTML,/estudiantes vigentes|1° A:/);assert.match(p.el('statAlumnos').textContent,/Total 415/);
});
test('no active period is invented from stored configuration when server period lookup fails',async()=>{
 const p=menu();p.c.localStorage.setItem('ie22375_admin_periodos',JSON.stringify({bimestres:{III:'abierto'}}));p.c.bajarPeriodosNube=async()=>null;
 await p.c.cargarResumenMenuAdmin();assert.deepEqual(p.calls,['base']);assert.match(p.el('statVigentes').textContent,/No se pudo verificar el bimestre abierto/);assert.doesNotMatch(p.el('statVigentes').textContent,/III Bimestre|Total 403/);
});
test('all closed periods result in no roster lookup or fabricated academic totals',async()=>{
 const p=menu();p.c.bajarPeriodosNube=async()=>({bimestres:{I:'cerrado',II:'cerrado',III:'cerrado',IV:'cerrado'}});await p.c.cargarResumenMenuAdmin();
 assert.deepEqual(p.calls,['base']);assert.match(p.el('statVigentes').textContent,/No hay bimestre abierto/);assert.equal(p.run('resumenMenuAdmin.padron'),null);
});
test('menu authorized cache is labeled unverified for both sources, including immediately during slow recheck',async()=>{
 const p=menu();p.c.IEStudents.peek=()=>base();let resolve;p.c.IEStudents.load=()=>new Promise(r=>resolve=r);p.c.IEStudents.loadRoster=async b=>({...roster(b),offline:true});
 const pending=p.c.cargarResumenMenuAdmin();assert.match(p.el('statAlumnos').textContent,/Total 415 · Caché autorizada; servidor no verificado/);assert.doesNotMatch(p.el('statAlumnos').textContent,/Verificado por servidor/);
 resolve({...base(),offline:true});await pending;assert.match(p.el('statVigentes').textContent,/Total 403.*Caché autorizada; servidor no verificado/);assert.match(p.el('resumenRapido').innerHTML,/Caché autorizada; servidor no verificado/);
});
test('fresh menu network errors never reuse old confirmed totals as currently server verified',async()=>{
 const p=menu();await p.c.cargarResumenMenuAdmin();p.c.IEStudents.load=async()=>{throw Error('Synthetic network error');};p.c.IEStudents.loadRoster=async()=>{throw Error('Synthetic roster error');};
 await p.c.cargarResumenMenuAdmin(true);for(const id of ['statAlumnos','statVigentes']){assert.match(p.el(id).textContent,/No se pudo verificar.*Reintenta/);assert.doesNotMatch(p.el(id).textContent,/Verificado por servidor|Total 415|Total 403/);}
});
test('expired token does not read cached data or start new menu requests',async()=>{
 const p=menu();p.c.IEStudents.peek=()=>base();p.changeToken('');await p.c.cargarResumenMenuAdmin();assert.equal(p.calls.length,0);assert.doesNotMatch(p.el('statAlumnos').textContent,/415|Verificado por servidor/);assert.match(p.el('statVigentes').textContent,/iniciar sesión/);
});
test('menu response from previous session is discarded and does not restore former counts',async()=>{
 const p=menu();let resolve;p.c.IEStudents.load=()=>new Promise(r=>resolve=r);const pending=p.c.cargarResumenMenuAdmin();await Promise.resolve();p.changeToken('new-synthetic-token');resolve(base());await pending;
 assert.doesNotMatch(p.el('statAlumnos').textContent,/415|Verificado por servidor/);assert.doesNotMatch(p.el('statVigentes').textContent,/403|Verificado por servidor/);
});
test('explicit authorization rejection clears historical and academic menu counts',async()=>{
 const p=menu();p.c.IEStudents.peek=()=>base();p.c.IEStudents.load=async()=>{throw Object.assign(Error('Synthetic revoked'),{code:'SESSION'});};await p.c.cargarResumenMenuAdmin();
 assert.match(p.el('statAlumnos').textContent,/Sesión rechazada/);assert.doesNotMatch(p.el('statAlumnos').textContent,/415/);assert.equal(p.run('resumenMenuAdmin.padron'),null);
});
test('late III roster cannot overwrite refreshed IV roster or its aula counts',async()=>{
 const p=menu(),pending=[];let bim='III';p.c.bajarPeriodosNube=async()=>({bimestres:{[bim]:'abierto'}});p.c.IEStudents.loadRoster=b=>new Promise(resolve=>pending.push({b,resolve}));
 const first=p.c.cargarResumenMenuAdmin();while(pending.length<1)await Promise.resolve();bim='IV';const second=p.c.cargarResumenMenuAdmin(true);while(pending.length<2)await Promise.resolve();
 pending[1].resolve(roster('IV'));await second;const html=p.el('resumenRapido').innerHTML;pending[0].resolve(roster('III'));await first;assert.equal(p.el('resumenRapido').innerHTML,html);assert.match(p.el('statVigentes').textContent,/IV Bimestre.*PADRON_IV/);
});
test('repeated menu opening while pending deduplicates its reads and period lookup is shared with students consultation',async()=>{
 const p=menu();let resolve;p.c.bajarPeriodosNube=()=>{p.calls.push('periodos');return new Promise(r=>resolve=r);};const first=p.c.cargarResumenMenuAdmin(),second=p.c.cargarResumenMenuAdmin();assert.equal(first,second);assert.deepEqual(p.calls,['base','periodos']);
 p.el('consultaBimestre').value='';const consultation=p.c.iniciarConsultaEstudiantes();assert.deepEqual(p.calls,['base','periodos']);resolve({bimestres:{III:'abierto'}});await Promise.all([first,consultation]);assert.equal(p.calls.filter(x=>x==='periodos').length,1);
});
test('menu lookup and refresh remain read-only and leave base/padrones/edit drafts unchanged',async()=>{
 const p=menu(),full=base(),quarter=roster(),before=JSON.stringify([full,quarter]);p.c.IEStudents.load=async()=>full;p.c.IEStudents.loadRoster=async()=>quarter;
 for(const action of ['save','initialize','restore','sync','seedRoster','enrich'])p.c.IEStudents[action]=()=>assert.fail('Unexpected write: '+action);
 p.run("bdPendiente=true;estado.secundaria.estudiantes=[{nombre:'Synthetic Draft',idSiagie:'draft'}];baseVersion='draft-original'");await p.c.cargarResumenMenuAdmin();await p.c.cargarResumenMenuAdmin(true);
 assert.equal(JSON.stringify([full,quarter]),before);assert.equal(p.run('baseVersion'),'draft-original');assert.equal(p.run('estado.secundaria.estudiantes[0].idSiagie'),'draft');assert.equal(p.run('bdPendiente'),true);
});
test('menu card keeps student navigation and responsive wrapping with distinct accessible counts',()=>{
 const html=read('admin.html'),start=html.indexOf('<button class="card p-4 text-left hover:ring-2 hover:ring-sky-300" onclick="showTab(\'bd\')">'),card=html.slice(start,html.indexOf('</button>',start)+9);
 for(const id of ['statAlumnos','statVigentes','statTrasladados'])assert.match(card,new RegExp('break-words[^>]*id="'+id+'"'));
 assert.match(html,/grid sm:grid-cols-2 gap-3/);assert.match(html,/flex flex-wrap items-center justify-between gap-2/);assert.doesNotMatch(card,/min-width:\s*\d+px|white-space:\s*nowrap/);
});

test('server period timeout terminates the academic menu lookup without assuming III',async()=>{
 const p=menu();let timeout;p.c.setTimeout=(fn,ms)=>{assert.equal(ms,12000);timeout=fn;return 1;};p.c.clearTimeout=()=>{};p.c.bajarPeriodosNube=()=>new Promise(()=>{});
 const pending=p.c.cargarResumenMenuAdmin();timeout();await pending;assert.match(p.el('statVigentes').textContent,/No se pudo verificar el bimestre abierto/);assert.equal(p.calls.filter(c=>c.startsWith('roster:')).length,0);assert.match(p.el('statAlumnos').textContent,/Total 415 · Verificado por servidor/);
});
