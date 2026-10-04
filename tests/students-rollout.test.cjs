const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hashes={"registro.html":"d2c076fa3716cd31bd98e1aa16ae070dbd87145ae9df64a7821b81f9aa97b302","primaria.html":"7bcb74c5d10edca97c2d8dd7db2f05e10b71da7b42d2aa256c9e39ee5837c915","secundaria.html":"a29131d76c22c31296b53d70eaea74a4831861c6cf7ec480aedd9ff497af98b1","auxiliar.html":"a3fca28e533ce8ed05525fcf9b900536d84ba3c18a677174481d42e511b9b4b1","photochecks.html":"03734f0646db1f28277f82b38dab3875d1cfa242aab00962f04dc4c983711e26"};
for(const [file,hash]of Object.entries(hashes))test(file+': stage A preserves the production consumer byte for byte',()=>assert.equal(crypto.createHash('sha256').update(read(file)).digest('hex'),hash));
function fixture(){
 const els=new Map();function el(id){if(!els.has(id))els.set(id,{value:'primaria',checked:false,textContent:''});return els.get(id);}
 const calls=[],parseOptions=[],window={parseCSV:(text,options)=>{parseOptions.push(options);return [{nivel:el('importNivel').value,grado:1,seccion:'Única',orden:1,nombre:'Synthetic SIAGIE'}];}};
 const c=vm.createContext({window,document:{getElementById:el},IEStudents:{load:async()=>{calls.push('load');return {inicializada:false,version:''};},initialize:async(base,version)=>{calls.push({base,version});}},confirm:()=>true});
 new vm.Script(read('students-migration.js')).runInContext(c);return {c,window,calls,parseOptions,el,api:window.IEMigrateStudents};
}
const file={files:[{text:async()=> 'NumeroDeOrden;ApellidoPaterno;EstadoMatricula\nsynthetic'}]};
test('Stage A keeps the public JSON and embedded rosters unchanged, including the unresolved count difference',()=>{
 const publicBase=JSON.parse(read('bd_oficial_2026.json'));
 const total=b=>b.primaria.estudiantes.length+b.secundaria.estudiantes.length;
 assert.equal(total(publicBase),407);
 for(const file of ['admin.html','registro.html']){
  const source=read(file),match=source.match(/^const BD_EMP(?:OTRADA)? = (.*);$/m);
  assert.equal(!!match,true);assert.equal(total(JSON.parse(match[1])),408);
 }
});
test('Stage A imports only explicit SIAGIE selections, and never reads embedded/local rosters',async()=>{
 const s=fixture();assert.equal(s.calls.length,0);
 await s.api.inicializar();assert.equal(s.calls.length,0);
 await s.api.importar({files:[{text:async()=>'{"primaria":{"estudiantes":[]}}'}]},'primaria');
 assert.match(s.el('migracionEstado').textContent,/CSV SIAGIE vigente/);
 await s.api.importar(file,'primaria');await s.api.importar(file,'secundaria');
 assert.deepEqual(s.parseOptions,[{includeTransferred:true},{includeTransferred:true}]);
 await s.api.inicializar();assert.equal(s.calls.length,0);
 s.el('migracionRevisada').checked=true;await s.api.inicializar();
 assert.equal(s.calls.length,2);assert.equal(s.calls[1].base.primaria.estudiantes[0].nombre,'Synthetic SIAGIE');
 assert.equal(s.calls[1].base.secundaria.estudiantes[0].nivel,'secundaria');assert.equal(s.el('importNivel').value,'primaria');
 assert.doesNotMatch(read('students-migration.js'),/BD_EMP|localStorage\s*\.|bd_oficial/);
});
test('Initial migration refuses an existing private base and never overwrites it',async()=>{
 const s=fixture();await s.api.importar(file,'primaria');await s.api.importar(file,'secundaria');s.el('migracionRevisada').checked=true;
 s.c.IEStudents.load=async()=>({inicializada:true,version:'existing'});await s.api.inicializar();
 assert.match(s.el('migracionEstado').textContent,/ya está inicializada/);assert.equal(s.calls.length,0);
});
test('Offline cache cannot confirm or initialize the private production base',async()=>{
 const s=fixture();s.c.IEStudents.load=async()=>({offline:true,inicializada:true});await s.api.verificar();assert.match(s.el('migracionEstado').textContent,/requiere conexión/);
 await s.api.importar(file,'primaria');await s.api.importar(file,'secundaria');s.el('migracionRevisada').checked=true;
 await s.api.inicializar();assert.match(s.el('migracionEstado').textContent,/requiere conexión/);assert.equal(s.calls.length,0);
});
test('Missing new backend only affects manual migration controls, not the existing Admin import/save flow',async()=>{
 const s=fixture();s.c.IEStudents.load=async()=>{throw Error('Backend not deployed');};await s.api.verificar();assert.equal(s.el('migracionEstado').textContent,'Backend not deployed');
 const admin=read('admin.html');assert.match(admin,/const BD_EMPOTRADA = /);assert.match(admin,/function procesarImport\(/);assert.match(admin,/function guardarBD\(/);
 assert.doesNotMatch(admin,/IEStudents\.load\(|cargarEstudiantesAdmin\(/);
 new vm.Script(read('students.js'));new vm.Script(read('students-migration.js'));
});
