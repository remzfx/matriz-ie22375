const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function fixture(){
 const els=new Map();function el(id){if(!els.has(id))els.set(id,{value:'primaria',checked:false,textContent:''});return els.get(id);}
 const calls=[],parseOptions=[],window={parseCSV:(text,options)=>{parseOptions.push(options);return [{nivel:el('importNivel').value,grado:1,seccion:'Única',orden:1,nombre:'Synthetic SIAGIE'}];}};
 const c=vm.createContext({window,document:{getElementById:el},IEStudents:{load:async()=>{calls.push('load');return {inicializada:false,version:''};},initialize:async(base,version)=>{calls.push({base,version});}},confirm:()=>true});
 new vm.Script(read('students-migration.js')).runInContext(c);return {c,window,calls,parseOptions,el,api:window.IEMigrateStudents};
}
const file={files:[{text:async()=> 'NumeroDeOrden;ApellidoPaterno;EstadoMatricula\nsynthetic'}]};
test('Manual initialization imports only explicit SIAGIE selections, and never reads embedded/local rosters',async()=>{
 const s=fixture();assert.equal(s.calls.length,0);
 await s.api.inicializar();assert.equal(s.calls.length,0);
 await s.api.importar({files:[{text:async()=>'{"primaria":{"estudiantes":[]}}'}]},'primaria');
 assert.match(s.el('migracionEstado').textContent,/CSV SIAGIE vigente/);
 await s.api.importar(file,'primaria');await s.api.importar(file,'secundaria');
 assert.deepEqual(JSON.parse(JSON.stringify(s.parseOptions)),[{includeTransferred:true},{includeTransferred:true}]);
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
