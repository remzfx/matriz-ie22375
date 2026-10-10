const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {fixture,extract}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('function checkRequest')[0]+'\nreturn {fixture,extract};')(require,__dirname);
const synthetic=()=>({ok:true,version:'synthetic-server',inicializada:true,estudiantes:[{nivel:'primaria',grado:1,seccion:'Única',orden:1,nombre:'Synthetic Primary',idSiagie:'synthetic-p',estadoMatricula:'DEFINITIVA'},{nivel:'secundaria',grado:1,seccion:'A',orden:1,nombre:'Synthetic Secondary',idSiagie:'synthetic-s',estadoMatricula:'DEFINITIVA'}]});
function page({missing=false}={}){
 const s=fixture(),html=read('admin.html'),scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].map(m=>m[1]);
 s.c.window.parseCSV=()=>{const nivel=s.c.document.getElementById('importNivel').value;return [{nivel,grado:1,seccion:'A',orden:1,nombre:'Synthetic CSV '+nivel,idSiagie:'csv-'+nivel,estadoMatricula:'DEFINITIVA'}];};
 // The external module is evaluated only if the page actually includes it.
 for(const src of scripts)if(src==='students-migration.js'&&!missing)s.run(read(src));
 s.c.IEMigrateStudents=s.c.window.IEMigrateStudents;
 s.run('let estado=null,baseVersion="",baseCargada=false,baseInicializada=false,bdPendiente=false,bdGuardando=false;function actualizarResumen(){};function fillFiltros(){};function renderTabla(){};function estadoBD(){};');
 for(const name of ['verificarModuloEstudiantesAdmin','aplicarBaseServidor','cargarEstudiantesAdmin'])s.run(extract('admin.html',name));
 return s;
}
test('Admin includes all used migration methods through an ordered blocking dependency before initialization',()=>{
 const html=read('admin.html'),tags=[...html.matchAll(/<script\b([^>]*)src="([^"]+)"([^>]*)>/g)],tag=tags.filter(m=>m[2]==='students-migration.js');
 assert.equal(tag.length,1);assert.doesNotMatch(tag[0][0],/\b(?:async|defer)\b/);
 assert.ok(html.indexOf('src="students.js"')<tag[0].index);
 assert.ok(tag[0].index<html.indexOf('verificarModuloEstudiantesAdmin();'));
 assert.ok(html.indexOf('verificarModuloEstudiantesAdmin();')<html.lastIndexOf('cargarEstudiantesAdmin();'));
 const s=page();assert.equal(s.c.verificarModuloEstudiantesAdmin(),true);
 for(const match of html.matchAll(/IEMigrateStudents\.(\w+)\(/g))assert.equal(typeof s.c.window.IEMigrateStudents[match[1]],'function',match[1]);
});
test('Loaded dependency makes a forced new read update Primaria/Secundaria/Servidor without writes',async()=>{
 const s=page();assert.equal(s.c.verificarModuloEstudiantesAdmin(),true);
 await s.c.IEStudents.load();const before=s.calls.length;s.calls.length=0;
 await s.c.cargarEstudiantesAdmin({forceNetwork:true});
 assert.equal(before,1);assert.equal(s.calls.length,1);
 assert.equal(JSON.parse(s.calls[0].options.body).action,'loadstudents');
 assert.match(s.elements.get('gestionPrimaria').textContent,/1 estudiantes.*servidor/);
 assert.match(s.elements.get('gestionSecundaria').textContent,/1 estudiantes.*servidor/);
 assert.equal(s.elements.get('gestionServidor').textContent,'Verificado en esta consulta');
});
test('Actual included module preserves CSV previews, compares identities and queries roster read-only',async()=>{
 const s=page(),api=s.c.window.IEMigrateStudents;
 const file={files:[{text:async()=> 'NumeroDeOrden;ApellidoPaterno;EstadoMatricula\nsynthetic'}]};
 await api.importar(file,'primaria');await api.importar(file,'secundaria');assert.equal(s.calls.length,0);
 await api.verificar();assert.match(s.elements.get('gestionComparacion').textContent,/Comparación informativa/);
 assert.match(s.elements.get('migracionPreview-primaria').textContent,/Synthetic CSV primaria/);
 assert.match(s.elements.get('migracionPreview-secundaria').textContent,/Synthetic CSV secundaria/);
 s.c.document.getElementById('migracionBimestre').value='III';s.c.window.CLOUD_API_URL='https://synthetic.invalid';
 s.c.fetch=async(url,options)=>{if(options.method==='POST'){s.calls.push({url,options});const data=JSON.parse(options.body);return {ok:true,json:async()=>({...synthetic(),bimestre:data.bimestre,padronInicializado:true})};}return {ok:true,json:async()=>({ok:true,periodos:{bimestres:{III:'abierto'}}})};};
 await api.verificarPadron();assert.match(s.elements.get('gestionPadronEstado').textContent,/III.*abierto.*Padrón verificado: 2/);
 assert.ok(s.calls.every(c=>JSON.parse(c.options.body).action==='loadstudents'));
});
test('Missing dependency reproduces the original failure and displays error without false verification',()=>{
 const s=page({missing:true}),controls=[{disabled:false},{disabled:false}];s.c.document.querySelectorAll=()=>controls;
 assert.equal(s.c.window.IEMigrateStudents,undefined);
 assert.equal(s.c.verificarModuloEstudiantesAdmin(),false);
 assert.match(s.elements.get('gestionServidor').textContent,/No se pudo cargar.*students-migration.js/);
 assert.match(s.elements.get('migracionEstado').textContent,/No se verificaron/);
 assert.equal(s.elements.get('gestionPrimaria').textContent,'No verificado');assert.equal(s.elements.get('gestionSecundaria').textContent,'No verificado');
 assert.ok(controls.every(c=>c.disabled));assert.equal(s.calls.length,0);
});
test('A partially initialized module is rejected and cannot falsely verify indicators after a successful read',async()=>{
 const s=page();s.c.window.IEMigrateStudents={mostrarBase(){throw Error('Incomplete module must never render verification');}};s.c.IEMigrateStudents=s.c.window.IEMigrateStudents;
 assert.equal(s.c.verificarModuloEstudiantesAdmin(),false);
 await s.c.cargarEstudiantesAdmin({forceNetwork:true});assert.match(s.elements.get('gestionServidor').textContent,/No se pudo cargar/);
 assert.match(read('admin.html'),/<script src="students-migration.js" onerror="window\.__IEStudentsMigrationLoadError=true"><\/script>/);
});
