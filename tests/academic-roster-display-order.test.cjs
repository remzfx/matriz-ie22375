const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {fixture:client,extract}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('function checkRequest')[0]+'\nreturn {fixture:fixture,extract};')(require,__dirname);
const clone=x=>JSON.parse(JSON.stringify(x));
function students(nivel,total,trasladados){return Array.from({length:total},(_,i)=>({nivel,grado:i<Math.ceil(total/2)?1:2,seccion:'A',orden:i*2+1,nombre:'Synthetic '+nivel+' '+i,idSiagie:nivel+'-id-'+i,codigoEstudiante:nivel+'-code-'+i,estadoMatricula:i%Math.floor(total/trasladados)===0&&i<Math.floor(total/trasladados)*trasladados?'TRASLADADO':'DEFINITIVA'}));}
function base(){return {inicializada:true,version:'synthetic-base',primaria:{estudiantes:students('primaria',150,4)},secundaria:{estudiantes:students('secundaria',265,8)}};}
function roster(bim='III'){const b=base();for(const n of ['primaria','secundaria'])b[n].estudiantes=b[n].estudiantes.filter(a=>a.estadoMatricula==='DEFINITIVA');return {...b,bimestre:bim,padronInicializado:true};}
function page(){
 const s=client(),el=id=>s.c.document.getElementById(id),requests=[];
 const token=s.c.IEStudents.validToken();let current=token;
 s.c.IEStudents.validToken=()=>current;
 for(const [id,value] of Object.entries({consultaBimestre:'III',consultaTipo:'vigentes',filtroNivel:'secundaria',filtroGrado:'',filtroSeccion:'',filtroBuscar:''}))el(id).value=value;
 s.c.IEStudents.loadRoster=async b=>{requests.push('roster:'+b);return roster(b);};
 s.c.IEStudents.inspect=async()=>{requests.push('inspect');return base();};
 s.c.IEStudents.save=()=>assert.fail('No writes from queries');s.c.confirm=()=>true;
 s.run("let estado=IEStudents.empty(),baseCargada=true,baseInicializada=true,baseVersion='original',bdPendiente=false,bdGuardando=false,consultaBase=null,consultaClave='',consultaToken='',consultaSecuencia=0,modoEdicionBase=false;function fillFiltros(){}function estadoBD(){}function aplicarBaseServidor(b){estado=b;}function permitirEdicionBD(){return true;}function saveEstado(){throw Error('Query attempted mutation');}");
 for(const name of ['escapeConsulta','estudiantesDe','estudiantesConsulta','renderTabla','consultarEstudiantes','iniciarConsultaEstudiantes','leerPeriodosConsultaAdmin','activarEdicionBase','eliminarAlumno','agregarAlumno','guardarBD'])s.run(extract('admin.html',name));
 return {...s,el,requests,token,changeToken:v=>current=v};
}
for(const [nivel,total,vigentes,trasladados] of [['primaria',150,146,4],['secundaria',265,257,8]])test(nivel+': synthetic complete, active and transferred counts stay separated',async()=>{
 const p=page();p.el('filtroNivel').value=nivel;
 await p.c.consultarEstudiantes();assert.equal(p.c.estudiantesConsulta(nivel).length,vigentes);
 p.el('consultaTipo').value='todos';await p.c.consultarEstudiantes();assert.equal(p.c.estudiantesConsulta(nivel).length,total);
 p.el('consultaTipo').value='trasladados';await p.c.consultarEstudiantes();assert.equal(p.c.estudiantesConsulta(nivel).length,trasladados);
 assert.match(p.el('consultaFuente').textContent,/BASE_ACTUAL.*Verificado por servidor.*415 registros.*403 DEFINITIVA.*12 trasladados/);
 assert.deepEqual(p.requests,['roster:III','inspect','inspect']);assert.equal(p.run('estado.primaria.estudiantes.length'),0);
});
test('visual order closes gaps and restarts per level/grade/section without modifying SIAGIE fields',()=>{
 const p=page(),input=[{nivel:'secundaria',grado:4,seccion:'B',orden:13,idSiagie:'s-d',codigoEstudiante:'cd',nombre:'Synthetic D'},{nivel:'secundaria',grado:4,seccion:'B',orden:10,idSiagie:'s-a',codigoEstudiante:'ca',nombre:'Synthetic A'},{nivel:'secundaria',grado:4,seccion:'B',orden:11,idSiagie:'s-b',nombre:'Synthetic B'},{nivel:'secundaria',grado:4,seccion:'A',orden:20,nombre:'Synthetic Other'},{nivel:'primaria',grado:4,seccion:'B',orden:1,nombre:'Synthetic Primary'}],before=JSON.stringify(input);
 const rows=clone(p.c.IEStudentIdentity.numbered(input));assert.equal(JSON.stringify(input),before);
 assert.deepEqual(rows.filter(a=>a.nivel==='secundaria'&&a.seccion==='B').map(a=>[a.orden,a.numeroVisual]),[[10,1],[11,2],[13,3]]);
 assert.equal(rows.filter(a=>a.seccion==='A')[0].numeroVisual,1);assert.equal(rows.find(a=>a.nivel==='primaria').numeroVisual,1);
 for(const al of input){const r=rows.find(a=>a.nombre===al.nombre);assert.equal(r.idSiagie,al.idSiagie);assert.equal(r.codigoEstudiante,al.codigoEstudiante);assert.equal(p.c.studentKey(r),p.c.studentKey(al));}
});
test('search and classroom filters preserve the number assigned in the full classroom',async()=>{
 const p=page();await p.c.consultarEstudiantes();const rows=p.c.IEStudentIdentity.numbered(p.c.estudiantesConsulta('secundaria'));
 const al=rows.filter(a=>a.grado===1)[4];p.el('filtroGrado').value='1';p.el('filtroSeccion').value='A';p.el('filtroBuscar').value=al.nombre;p.c.renderTabla();
 assert.match(p.el('bdBody').innerHTML,new RegExp('<td>'+al.numeroVisual+'</td>'));assert.equal(al.numeroVisual,5);
 assert.doesNotMatch(p.el('bdBody').innerHTML,/>Quitar<|onclick=/);assert.equal(p.run('modoEdicionBase'),false);
});
for(const bim of ['I','II'])test(bim+' without its own roster explicitly labels fallback without showing it',async()=>{
 const p=page();p.el('consultaBimestre').value=bim;p.c.IEStudents.loadRoster=async()=>({...base(),bimestre:bim,padronInicializado:false});await p.c.consultarEstudiantes();
 assert.match(p.el('consultaFuente').textContent,/Este bimestre no tiene padrón académico propio/);assert.equal(p.c.estudiantesConsulta('secundaria').length,0);assert.doesNotMatch(p.el('bdBody').innerHTML,/Synthetic/);
});
test('open period comes from server configuration, not a fixed III default',async()=>{
 const p=page();p.el('consultaBimestre').value='';p.c.bajarPeriodosNube=async()=>({bimestres:{I:'cerrado',II:'cerrado',III:'cerrado',IV:'abierto'}});
 await p.c.iniciarConsultaEstudiantes();assert.equal(p.el('consultaBimestre').value,'IV');assert.deepEqual(p.requests,['roster:IV']);
});
test('manual choice during period lookup wins over late automatic default',async()=>{
 const p=page();p.el('consultaBimestre').value='';let resolve;p.c.bajarPeriodosNube=()=>new Promise(r=>resolve=r);
 const pending=p.c.iniciarConsultaEstudiantes();p.el('consultaBimestre').value='II';await p.c.consultarEstudiantes();resolve({bimestres:{III:'abierto'}});await pending;
 assert.equal(p.el('consultaBimestre').value,'II');assert.deepEqual(p.requests,['roster:II']);
});
test('late response of another bimestre cannot replace the current roster',async()=>{
 const p=page(),pending=[];p.c.IEStudents.loadRoster=b=>new Promise(resolve=>pending.push({b,resolve}));
 const first=p.c.consultarEstudiantes();p.el('consultaBimestre').value='IV';const second=p.c.consultarEstudiantes();
 pending[1].resolve(roster('IV'));await second;const before=p.el('bdBody').innerHTML;pending[0].resolve(roster('III'));await first;
 assert.equal(p.el('bdBody').innerHTML,before);assert.equal(p.run('consultaBase.bimestre'),'IV');
});
test('same-context duplicate refresh cannot overwrite a later response',async()=>{
 const p=page(),r=[];p.c.IEStudents.loadRoster=()=>new Promise(resolve=>r.push(resolve));const a=p.c.consultarEstudiantes(),b=p.c.consultarEstudiantes();
 const recent=roster();recent.version='new';r[1](recent);await b;r[0](roster());await a;assert.equal(p.run('consultaBase.version'),'new');
});
test('temporary error and cached fallback never replace a verified same-context roster silently',async()=>{
 const p=page();await p.c.consultarEstudiantes();const before=JSON.stringify(p.run('consultaBase'));
 p.c.IEStudents.loadRoster=async()=>({...base(),bimestre:'III',padronInicializado:false,offline:true});await p.c.consultarEstudiantes();assert.equal(JSON.stringify(p.run('consultaBase')),before);assert.match(p.el('consultaFuente').textContent,/Sin verificación nueva/);
 p.c.IEStudents.loadRoster=async()=>{throw Error('Synthetic network error');};await p.c.consultarEstudiantes();assert.equal(JSON.stringify(p.run('consultaBase')),before);assert.match(p.el('consultaFuente').textContent,/Reintenta/);
});
test('cache roster is explicitly unverified and never enables editing',async()=>{
 const p=page();p.c.IEStudents.loadRoster=async()=>({...roster(),offline:true});await p.c.consultarEstudiantes();assert.match(p.el('consultaFuente').textContent,/Caché autorizada, servidor no verificado/);assert.equal(p.el('edicionBaseControles').hidden,true);assert.doesNotMatch(p.el('bdBody').innerHTML,/>Quitar</);
});
test('expired or changed token removes the query authority, including late responses',async()=>{
 const p=page();await p.c.consultarEstudiantes();let resolve;p.c.IEStudents.loadRoster=()=>new Promise(r=>resolve=r);const pending=p.c.consultarEstudiantes();p.changeToken('');resolve(roster());await pending;
 assert.equal(p.c.estudiantesConsulta('secundaria').length,0);assert.doesNotMatch(p.el('bdBody').innerHTML,/Synthetic/);assert.match(p.el('consultaFuente').textContent,/sesión cambió/);
});
test('explicit session rejection clears the displayed roster; queries and read-only CRUD do not write',async()=>{
 const p=page();await p.c.consultarEstudiantes();p.c.IEStudents.loadRoster=async()=>{throw Object.assign(Error('Synthetic revoked'),{code:'SESSION'});};await p.c.consultarEstudiantes();assert.equal(p.c.estudiantesConsulta('secundaria').length,0);assert.match(p.el('consultaFuente').textContent,/Sesión rechazada/);
 p.c.agregarAlumno();p.c.eliminarAlumno('secundaria','synthetic');await p.c.guardarBD();assert.equal(p.run('modoEdicionBase'),false);
});
test('exceptional editing needs confirmation and a fresh protected complete base',async()=>{
 const p=page();p.c.confirm=()=>false;await p.c.activarEdicionBase();assert.equal(p.requests.length,0);
 p.c.confirm=()=>true;await p.c.activarEdicionBase();assert.deepEqual(p.requests,['inspect']);assert.equal(p.run('modoEdicionBase'),true);assert.equal(p.c.estudiantesConsulta('secundaria').length,265);assert.equal(p.el('edicionBaseControles').hidden,false);
});
test('roster queries do not mutate closed or other quarterly data and recompute each quarter',async()=>{
 const p=page(),third=roster(),fourth=roster('IV');fourth.secundaria.estudiantes.splice(2,1);const before=JSON.stringify([third,fourth]);p.c.IEStudents.loadRoster=async b=>b==='III'?third:fourth;
 await p.c.consultarEstudiantes();p.el('consultaBimestre').value='IV';await p.c.consultarEstudiantes();assert.equal(JSON.stringify([third,fourth]),before);assert.equal(p.c.IEStudentIdentity.numbered(p.c.estudiantesConsulta('secundaria')).filter(a=>a.grado===1)[2].numeroVisual,3);
});
test('Registro all views/print share numbered classroom; identity keeps historical grade and attendance keys',()=>{
 const p=page(),list=roster().secundaria.estudiantes;const numbered=p.c.IEStudentIdentity.numbered(list,'secundaria'),al=numbered[3],raw=list.find(a=>a.idSiagie===al.idSiagie),key=p.c.studentKey(raw),grades={[key]:{valor:'A'}},attendance={[key]:{marca:'P'}};
 assert.deepEqual(grades[p.c.studentKey(al)],{valor:'A'});assert.deepEqual(attendance[p.c.studentKey(al)],{marca:'P'});
 assert.match(extract('registro.html','estudiantes'),/IEStudentIdentity.numbered/);assert.match(extract('registro.html','renderAvance'),/al.numeroVisual/);assert.doesNotMatch(extract('registro.html','renderAvance'),/al.orden/);
 for(const name of ['renderStudents','renderFinales','renderAsistencia','prepararImpresion','imprimirResumen'])assert.match(extract('registro.html',name),/estudiantes\(\)|avanceBox/);
});
test('Auxiliar numbers before search and its report uses the same visual numbers; Tutor includes the dependency',()=>{
 assert.match(extract('auxiliar.html','alumnosAula'),/IEStudentIdentity.numbered/);assert.match(extract('auxiliar.html','renderLista'),/al.numeroVisual/);assert.match(read('auxiliar.html'),/lineas.push\(al.numeroVisual/);
 for(const file of ['admin.html','registro.html','auxiliar.html','transversales.html'])assert.match(read(file),/<script src="student-identity.js"/);
 assert.match(read('transversales-client.js'),/IEStudentIdentity.numbered\(data.estudiantes\)/);
});
test('worker refresh v25 keeps private exclusions and shared numbering precached',()=>{const sw=read('sw.js');assert.match(sw,/CACHE_PREFIX \+ 'v25'/);assert.match(sw,/'\.\/student-identity.js'/);assert.match(sw,/MAX_STATIC_AGE_MS = 7 \*/);});

test('an exceptional draft can be hidden for read-only consultation and resumed without losing its original version',async()=>{
 const p=page();p.run("estado={primaria:{estudiantes:[]},secundaria:{estudiantes:[{nivel:'secundaria',grado:1,seccion:'A',orden:5,nombre:'Synthetic Draft',idSiagie:'draft'}]}};bdPendiente=true;baseVersion='original-draft';modoEdicionBase=true");
 await p.c.consultarEstudiantes();assert.equal(p.run('modoEdicionBase'),false);assert.equal(p.run('estado.secundaria.estudiantes[0].nombre'),'Synthetic Draft');
 const before=p.requests.length;await p.c.activarEdicionBase();assert.equal(p.run('modoEdicionBase'),true);assert.equal(p.requests.length,before);assert.equal(p.run('baseVersion'),'original-draft');assert.equal(p.c.estudiantesConsulta('secundaria')[0].idSiagie,'draft');
});
test('actual printed Resumen uses consecutive visual numbers rather than original SIAGIE gaps',()=>{
 const ui=new Function('require','__dirname',read('tests/registro-academic-model.test.cjs').split('\nfor(const level')[0]+'\nreturn ui;')(require,__dirname),f=ui(),p=page();
 const input=[{nivel:'secundaria',grado:2,seccion:'A',orden:10,idSiagie:'synthetic-print-a',nombre:'Synthetic Print A'},{nivel:'secundaria',grado:2,seccion:'A',orden:13,idSiagie:'synthetic-print-b',nombre:'Synthetic Print B'}],before=JSON.stringify(input);
 f.c.estudiantes=()=>p.c.IEStudentIdentity.numbered(input);f.c.print=()=>{};vm.runInContext(extract('registro.html','imprimirResumen'),f.c);f.c.imprimirResumen();
 assert.deepEqual([...f.el('printArea').innerHTML.matchAll(/bimestral-number">(\d+)</g)].map(m=>Number(m[1])),[1,2]);assert.equal(JSON.stringify(input),before);
});

test('actual Auxiliar attendance report numbers the complete classroom with no gaps',()=>{
 const p=page();p.run("let BD={secundaria:{estudiantes:[{nivel:'secundaria',grado:2,seccion:'A',orden:13,nombre:'Synthetic Later',idSiagie:'later'},{nivel:'secundaria',grado:2,seccion:'A',orden:10,nombre:'Synthetic First',idSiagie:'first'}]}};function getRec(){return {marca:'P'};}");
 p.c.IEAuxPermissions.permite=()=>true;p.run(extract('auxiliar.html','textoListaAula'));const report=p.c.textoListaAula('secundaria',2,'A','2026-10-10');
 assert.match(report.txt,/1\. Synthetic First/);assert.match(report.txt,/2\. Synthetic Later/);assert.doesNotMatch(report.txt,/undefined|13\. |10\. /);assert.equal(p.run('BD.secundaria.estudiantes[0].orden'),13);
});

test('Admin status distinguishes source totals from the selected list and table filters for every query type',async()=>{
 const p=page();
 for(const [tipo,source,total,list] of [['vigentes','PADRON_III',403,403],['trasladados','BASE_ACTUAL',415,12],['todos','BASE_ACTUAL',415,415]]){
  p.el('consultaTipo').value=tipo;await p.c.consultarEstudiantes();
  const status=p.el('consultaFuente').textContent;
  assert.ok(status.startsWith(source+' · Verificado por servidor'));
  assert.ok(status.includes('Total '+(tipo==='vigentes'?'del padrón':'de la base')+': '+total+' registros'));
  assert.ok(status.includes('Listado '+tipo[0].toUpperCase()+tipo.slice(1)+': '+list+' registros (ambos niveles)'));
  assert.equal(['primaria','secundaria'].reduce((n,nivel)=>n+p.c.estudiantesConsulta(nivel).length,0),list);
  if(tipo==='trasladados'){assert.match(p.el('bdCount').textContent,/^8 alumno/);p.el('filtroBuscar').value='not present';p.c.renderTabla();assert.match(p.el('bdCount').textContent,/^0 alumno/);p.el('filtroBuscar').value='';}
 }
});
test('Admin cached roster status retains explicit source and unverified state alongside its list count',async()=>{
 const p=page();p.c.IEStudents.loadRoster=async()=>({...roster(),offline:true});await p.c.consultarEstudiantes();
 assert.match(p.el('consultaFuente').textContent,/PADRON_III · Caché autorizada, servidor no verificado · Total del padrón: 403 registros.*Listado Vigentes: 403 registros \(ambos niveles\)/);
});
