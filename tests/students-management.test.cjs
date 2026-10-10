const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {fixture}=new Function('require','__dirname',read('tests/students-rollout.test.cjs').split('\nconst file=')[0]+'\nreturn {fixture};')(require,__dirname);
const clone=x=>JSON.parse(JSON.stringify(x)),student=(id,extra={})=>({idSiagie:id,nombre:'Synthetic '+id,nivel:'primaria',grado:1,seccion:'A',orden:1,...extra});
const base=(p=[student('p')],s=[student('s',{nivel:'secundaria'})])=>({inicializada:true,version:'synthetic-v',primaria:{estudiantes:p},secundaria:{estudiantes:s}});
const file={files:[{text:async()=> 'NumeroDeOrden;ApellidoPaterno;EstadoMatricula\nsynthetic'}]};
test('Management has four sections, primary stages and closed advanced tools; every legacy handler and DOM id remains',()=>{const html=read('admin.html'),panel=html.slice(html.indexOf('<!-- IMPORT -->'),html.indexOf('<!-- PERIODOS -->'));for(const title of ['GESTIÓN DE ESTUDIANTES','Estado de la base oficial','Actualizar matrícula desde SIAGIE','Padrón del bimestre','Herramientas avanzadas y recuperación'])assert.ok(panel.includes(title));assert.match(panel,/<details class="card students-section students-advanced">/);for(const call of ['IEMigrateStudents.importar','IEMigrateStudents.verificar()','IEMigrateStudents.verificarPadron()','IEMigrateStudents.crearPadron()','IEMigrateStudents.sincronizarPadron()','IEMigrateStudents.inicializar()','procesarImport()','restaurarBDOficial()','cargarEstudiantesAdmin'])assert.ok(panel.includes(call),call);for(const id of ['migracionPreview-primaria','migracionPreview-secundaria','migracionRevisada','migracionBimestre','migracionEstado','importNivel','importFile','importModo','importPreview'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);assert.match(panel,/id="gestionCrearPadron" hidden/);assert.match(html,/@media\(max-width:640px\)\{\.students-indicators,\.students-file-grid\{grid-template-columns:minmax\(0,1fr\)/);});
test('Confirmed server and cached counters remain distinct; cache cannot become comparison authority',()=>{const f=fixture(),b=base();f.api.mostrarBase(b,false);assert.match(f.el('gestionPrimaria').textContent,/1 estudiantes.*caché/);assert.match(f.el('gestionServidor').textContent,/no verificado/);f.api.mostrarBase(b,true);assert.equal(f.el('gestionServidor').textContent,'Verificado en esta consulta');f.api.mostrarBase({...b,offline:true},true);assert.match(f.el('gestionServidor').textContent,/no verificado/);assert.equal(f.calls.length,0);});
test('Error and uninitialized states never invent zero counts as verified',()=>{const f=fixture();f.api.mostrarBase(null,false,'Synthetic network error');assert.equal(f.el('gestionPrimaria').textContent,'No verificado');assert.match(f.el('gestionServidor').textContent,/Error/);f.api.mostrarBase({...base(),inicializada:false},true);assert.match(f.el('gestionServidor').textContent,/pendiente de inicialización/);});
test('ID matching preserves identity through corrected names and order; comparison never mutates students',()=>{const f=fixture(),old=[student('a'),student('retired')],next=[student('a',{nombre:'Corrected name',orden:9}),student('new',{estadoMatricula:'TRASLADADO'})],before=JSON.stringify([old,next]);assert.deepEqual(clone(f.api.compararMatricula(old,next)),{continuan:1,nuevos:1,trasladados:1,ausentes:1,inconsistentes:0,noVerificados:0});assert.equal(JSON.stringify([old,next]),before);assert.equal(f.calls.length,0);});
test('Official code matches when SIAGIE ID is absent',()=>{const f=fixture();assert.equal(f.api.compararMatricula([student('',{codigoEstudiante:'code'})],[student('',{codigoEstudiante:'code',nombre:'Corrected'})]).continuan,1);});
test('Matching names without official IDs are not automatically equal',()=>{const f=fixture(),r=f.api.compararMatricula([student('',{nombre:'Same name'})],[student('',{nombre:'Same name'})]);assert.equal(r.continuan,0);assert.equal(r.noVerificados,1);assert.equal(r.ausentes,null);});
test('Conflicting IDs and duplicate official identities require review rather than merging',()=>{const f=fixture(),r=f.api.compararMatricula([student('old',{codigoEstudiante:'code'})],[student('new',{codigoEstudiante:'code'})]);assert.equal(r.inconsistentes,1);assert.equal(r.continuan,0);assert.equal(r.ausentes,null);assert.equal(f.api.compararMatricula([], [student('a'),student('a')]).inconsistentes,2);});
test('Import previews and changing mirrored bimestres never write; confirmation is still required',async()=>{const f=fixture();await f.api.importar(file,'primaria');await f.api.importar(file,'secundaria');f.api.bimestreVista('III');assert.equal(f.el('migracionBimestre').value,'III');assert.equal(f.el('gestionBimestre').value,'III');assert.equal(f.el('gestionCrearPadron').hidden,true);assert.equal(f.calls.length,0);await f.api.sincronizarPadron();assert.equal(f.calls.length,0);});
for(const estado of ['abierto','cerrado','bloqueado'])test('Create roster presentation is visible only for verified open missing roster: '+estado,async()=>{const f=fixture();f.el('migracionBimestre').value='III';f.window.CLOUD_API_URL='https://synthetic.invalid';f.c.IEStudents.loadRoster=async()=>({...base(),bimestre:'III',padronInicializado:false});f.c.IEStudents.fetchJSON=async()=>({ok:true,periodos:{bimestres:{III:estado}}});await f.api.verificarPadron();assert.equal(f.el('gestionCrearPadron').hidden,estado!=='abierto');assert.match(f.el('gestionPadronEstado').textContent,new RegExp(estado));assert.equal(f.calls.length,0);});
test('Roster offline and failed period checks never reveal a create action or pretend verified state',async()=>{const f=fixture();f.el('migracionBimestre').value='III';f.el('gestionCrearPadron').hidden=true;f.c.IEStudents.loadRoster=async()=>({...base(),offline:true,padronInicializado:false});await f.api.verificarPadron();assert.equal(f.el('gestionCrearPadron').hidden,true);assert.match(f.el('migracionEstado').textContent,/requiere conexión/);});
test('Official synchronization remains behind two reviewed CSVs, fresh inspect and explicit confirmation',async()=>{const f=fixture();await f.api.importar(file,'primaria');await f.api.importar(file,'secundaria');f.el('migracionRevisada').checked=true;f.el('migracionBimestre').value='III';let reads=0,writes=0;f.c.IEStudents.inspect=async()=>{reads++;return base();};f.c.IEStudents.sync=async(data)=>{writes++;assert.equal(data.primaria.estudiantes[0].nombre,'Synthetic SIAGIE');return base();};f.c.confirm=()=>false;await f.api.sincronizarPadron();assert.equal(reads,1);assert.equal(writes,0);f.c.confirm=()=>true;await f.api.sincronizarPadron();assert.equal(writes,1);});

test('Server verification preserves selected CSV previews and their unchanged write payload',async()=>{const f=fixture();await f.api.importar(file,'primaria');await f.api.importar(file,'secundaria');f.c.IEStudents.inspect=async()=>base();await f.api.verificar();assert.match(f.el('migracionPreview-primaria').textContent,/Synthetic SIAGIE/);assert.match(f.el('migracionPreview-secundaria').textContent,/Synthetic SIAGIE/);f.el('migracionRevisada').checked=true;f.el('migracionBimestre').value='III';let sent;f.c.IEStudents.sync=async b=>{sent=b;return base();};await f.api.sincronizarPadron();assert.equal(sent.primaria.estudiantes[0].nombre,'Synthetic SIAGIE');});
function adminLoadFixture(){
 const src=read('admin.html'),extract=n=>{const i=src.indexOf('function '+n+'(');return src.slice(i,src.indexOf('\n}',i)+2);},els=new Map(),el=id=>{if(!els.has(id))els.set(id,{textContent:''});return els.get(id);};let resolve,args;
 const c=vm.createContext({IEStudents:{peek:()=>base(),load:(...a)=>{args=a;return new Promise(r=>resolve=r);},empty:()=>({})},document:{getElementById:el},confirm:()=>true,estadoBD:()=>{},actualizarResumen:()=>{},fillFiltros:()=>{},renderTabla:()=>{},bdGuardando:false,bdPendiente:false,baseCargada:false,baseInicializada:false,baseVersion:'',estado:{}});
 vm.runInContext(extract('aplicarBaseServidor')+'\nasync '+extract('cargarEstudiantesAdmin'),c);return {c,resolve:b=>resolve(b),args:()=>args};
}
test('Late server response preserves pending cache-first edits and their original server version',async()=>{const f=adminLoadFixture(),task=f.c.cargarEstudiantesAdmin({forceNetwork:true});assert.deepEqual(f.args(),[]);f.c.estado.primaria.estudiantes[0].nombre='Synthetic pending edit';f.c.bdPendiente=true;f.resolve(base());await task;assert.equal(f.c.bdPendiente,true);assert.equal(f.c.estado.primaria.estudiantes[0].nombre,'Synthetic pending edit');});

test('Verification preserves a selected CSV independently of the other level',async()=>{const f=fixture();await f.api.importar(file,'primaria');f.c.IEStudents.inspect=async()=>base();await f.api.verificar();assert.match(f.el('migracionPreview-primaria').textContent,/Synthetic SIAGIE/);assert.match(f.el('migracionPreview-secundaria').textContent,/Synthetic s/);assert.equal(f.calls.length,0);});

test('Management includes every institutional icon as a decorative uniform inline SVG',()=>{
 const html=read('admin.html'),panel=html.slice(html.indexOf('<!-- IMPORT -->'),html.indexOf('<!-- PERIODOS -->'));
 for(const name of ['users-round','database','school','graduation-cap','server','refresh-cw','file-up','file-spreadsheet','list-checks','shield-check','calendar-days','settings','alert-triangle']){
  const svg=panel.match(new RegExp('<svg[^>]*data-students-icon="'+name+'"[^>]*>'));
  assert.ok(svg,name);
  for(const attribute of ['viewBox="0 0 24 24"','fill="none"','stroke="currentColor"','stroke-width="2"','aria-hidden="true"','focusable="false"'])assert.ok(svg[0].includes(attribute),name+' '+attribute);
 }
 assert.doesNotMatch(panel,/<(?:img|script)\b|<use\b/i);
});
test('Indicator icons sit outside replaceable values and refresh button retains accessible text and handler',()=>{
 const html=read('admin.html');
 for(const [id,name,label] of [['gestionPrimaria','school','Primaria'],['gestionSecundaria','graduation-cap','Secundaria'],['gestionServidor','server','Servidor']]){
  assert.match(html,new RegExp('<span class="students-indicator-label"><svg[^>]*data-students-icon="'+name+'"[^>]*>[\\s\\S]*?</svg>'+label+'</span><strong id="'+id+'"[^>]*>No verificado</strong>'));
  const f=fixture();f.api.mostrarBase(base(),true);assert.match(f.el(id).textContent,id==='gestionServidor'?/Verificado/:/1 estudiantes/);
 }
 const button=html.match(/<button[^>]*onclick="cargarEstudiantesAdmin\(\{forceNetwork:true\}\)"[^>]*>([\s\S]*?)<\/button>/);
 assert.ok(button);assert.match(button[1],/data-students-icon="refresh-cw"/);assert.match(button[1],/<span>Actualizar consulta<\/span>/);
});
test('Icon layout remains scoped, fixed size and flexible for mobile without external dependencies',()=>{
 const html=read('admin.html');
 assert.match(html,/\.students-management \.students-icon\{width:20px;height:20px;flex:0 0 20px;color:#0284c7/);
 assert.match(html,/\.students-management \.students-icon-heading\{width:22px;height:22px/);
 assert.match(html,/\.students-management \.students-icon-title\{width:24px;height:24px/);
 assert.match(html,/\.students-management \.students-icon-secondary\{color:#64748b/);
 assert.match(html,/\.students-management \.students-with-icon\{display:flex;align-items:center;gap:8px;min-width:0/);
 assert.match(html,/\.students-management \.students-icon-button\{[^}]*max-width:100%;white-space:normal/);
 assert.match(html,/summary>\.students-with-icon\{display:inline-flex;max-width:calc\(100% - 24px\)/);
 assert.match(html,/@media\(max-width:640px\)\{\.students-indicators,\.students-file-grid\{grid-template-columns:minmax\(0,1fr\)/);
});
test('Warning icons accompany existing warning text without turning it into an editable control',()=>{
 const html=read('admin.html'),warnings=[...html.matchAll(/<p class="students-help students-warning">([\s\S]*?)<\/p>/g)];
 assert.equal(warnings.length,2);
 for(const [,body] of warnings){assert.match(body,/data-students-icon="alert-triangle"/);assert.match(body,/<span>/);assert.doesNotMatch(body,/<(?:input|button|select)\b/);}
});
