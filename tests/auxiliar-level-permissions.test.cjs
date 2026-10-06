const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
// Reuse the existing synthetic Sheets fixture without importing/registering its tests.
const fixtureSource=read('tests/backend-students.test.cjs').split('\ntest(')[0];
const studentsFixture=new Function('require','__dirname',fixtureSource+'\nreturn studentsFixture;')(require,__dirname);
function backend(){
 const s=studentsFixture(),rows=s.tables.get('ConfigSistema').rows;rows.splice(rows.findIndex(r=>r[0]==='AUXILIAR_ACCESOS'),1);
 s.sheet('AsistenciaIngreso',[['clave','fecha','nivel','grado','seccion','nombre','marca','hora','via','ts','motivo'],
  ['primary','2026-10-05','primaria',1,'Única','Synthetic Primary','P','','',1,''],['secondary','2026-10-05','secundaria',1,'A','Synthetic Secondary','P','','',1,'']]);
 s.sheet('WhatsappGrupos',[['clave','ts','json'],['WA_GRUPOS',1,JSON.stringify([{nivel:'primaria',grado:1,seccion:'Única',link:'synthetic-primary'},{nivel:'secundaria',grado:1,seccion:'A',link:'synthetic-secondary'}])]]);
 s.version=0;
 s.configure=(user,niveles,activo=true,extra={})=>{
  const data=s.post({action:'saveauxiliar',token:s.admin,version:s.version,auxiliar:{user,nombre:'Synthetic Auxiliary',password:'synthetic-pass',niveles,activo,...extra}});
  if(data.ok)s.version=data.version;return data;
 };
 s.login=user=>s.post({action:'login',tipo:'auxiliar',usuario:user,password:'synthetic-pass'});
 s.accounts=()=>{assert.equal(s.configure('pri',['primaria']).ok,true);assert.equal(s.configure('sec',['secundaria']).ok,true);assert.equal(s.configure('both',['primaria','secundaria']).ok,true);assert.equal(s.configure('inactive',['primaria'],false).ok,true)};
 return s;
}
for(const [user,niveles] of [['pri',['primaria']],['sec',['secundaria']],['both',['primaria','secundaria']]]){
 test('Auxiliar '+user+': login exposes only the assigned levels, signed role and minimal session',()=>{
  const s=backend();s.accounts();const res=s.login(user);assert.equal(res.ok,true);assert.deepEqual(res.niveles,niveles);assert.equal(res.role,'auxiliar');assert.notEqual(res.nivel,'colegio');
  const claims=s.c.validarToken_(res.token);assert.deepEqual(clone(claims.niveles),niveles);assert.equal(claims.permisosVersion,s.version);
  for(const field of ['pass','password','passHash','auxiliares','secret'])assert.equal(res[field],undefined);
 });
 test('Auxiliar '+user+': loadstudents never returns a level outside the server profile',()=>{
  const s=backend();s.accounts();const res=s.load(s.login(user).token,{role:'admin',niveles:['primaria','secundaria']});assert.equal(res.ok,true);
  assert.deepEqual([...new Set(res.estudiantes.map(a=>a.nivel))],niveles);
 });
 for(const action of ['loadasis','loadwa'])for(const method of ['GET','POST'])test(user+' '+method+' '+action+': server scope and forged filters',()=>{
  const s=backend();s.accounts();const token=s.login(user).token,run=p=>method==='GET'?s.get(p):s.post(p);
  const res=run({action,token,role:'admin',niveles:['primaria','secundaria']});assert.equal(res.ok,true);
  assert.deepEqual([...new Set((res.items||res.grupos).map(i=>i.nivel))],niveles);
  if(niveles.length===1)assert.equal(run({action,token,nivel:niveles[0]==='primaria'?'secundaria':'primaria'}).ok,false);
  else assert.ok((run({action,token,nivel:'primaria'}).items||run({action,token,nivel:'primaria'}).grupos).every(i=>i.nivel==='primaria'));
 });
 test('Auxiliar '+user+': saveasis accepts authorized items and rejects an unauthorized mixed batch atomically',()=>{
  const s=backend();s.accounts();const token=s.login(user).token;
  const item=n=>({fecha:'2026-10-06',nivel:n,grado:1,seccion:n==='primaria'?'Única':'A',nombre:'Synthetic Student',marca:'P'});
  assert.equal(s.post({action:'saveasis',token,items:[item(niveles[0])]}).ok,true);
  const before=s.state.writes;
  if(niveles.length===1){assert.equal(s.post({action:'saveasis',token,role:'admin',items:[item(niveles[0]),item(niveles[0]==='primaria'?'secundaria':'primaria')]}).ok,false);assert.equal(s.state.writes,before);}
  else assert.equal(s.post({action:'saveasis',token,items:[item('primaria'),item('secundaria')]}).ok,true);
 });
}
test('Inactive, missing and wrong-password auxiliaries cannot login',()=>{
 const s=backend();s.accounts();assert.equal(s.login('inactive').ok,false);assert.equal(s.login('missing').ok,false);assert.equal(s.post({action:'login',tipo:'auxiliar',usuario:'pri',password:'wrong'}).ok,false);
});
for(const change of ['levels','inactive','deleted','password'])test('Admin '+change+' change revokes existing auxiliary tokens on every protected route',()=>{
 const s=backend();s.accounts();const token=s.login('pri').token;
 if(change==='deleted'){const res=s.post({action:'saveauxiliar',token:s.admin,version:s.version,eliminar:true,auxiliar:{user:'pri'}});assert.equal(res.ok,true)}
 else assert.equal(s.configure('pri',change==='levels'?['secundaria']:['primaria'],change!=='inactive',change==='password'?{password:'changed-synthetic'}:{}).ok,true);
 assert.equal(s.c.validarToken_(token),null);
 for(const action of ['loadstudents','loadasis','loadwa','saveasis'])assert.equal(s.post({action,token,items:[]}).ok,false);
 assert.equal(s.load(s.admin).estudiantes.length,7);assert.ok(s.c.validarToken_(s.primary));
});
test('Auxiliary Admin API rejects non-admin, active empty levels, unknown levels and conflicting writes without exposing credentials',()=>{
 const s=backend();s.accounts();const token=s.login('pri').token;
 assert.equal(s.post({action:'loadauxiliares',token}).ok,false);assert.equal(s.post({action:'saveauxiliar',token,version:s.version,auxiliar:{user:'forged'}}).ok,false);
 const before=s.state.writes;assert.equal(s.configure('empty',[]).ok,false);assert.equal(s.configure('invalid',['colegio']).ok,false);assert.equal(s.state.writes,before);
 assert.equal(s.post({action:'saveauxiliar',token:s.admin,version:0,auxiliar:{user:'pri'}}).ok,false);
 const data=s.post({action:'loadauxiliares',token:s.admin});assert.equal(data.ok,true);assert.doesNotMatch(JSON.stringify(data),/synthetic-pass|passHash|password|TOKEN_SECRET/);
 const raw=s.c.obtenerAuxiliaresConfig_();assert.ok(raw.auxiliares.every(a=>a.passHash&&!a.password&&!a.pass));
});
test('Old global auxiliary password grants nothing until Admin explicitly migrates and assigns levels',()=>{
 const s=backend();s.c.PropertiesService.getScriptProperties().setProperty('IE22375_AUXILIAR_PASS','synthetic-legacy');
 const login=()=>s.post({action:'login',tipo:'auxiliar',usuario:'auxiliar',password:'synthetic-legacy'});
 assert.equal(login().ok,false);assert.equal(s.post({action:'loadauxiliares',token:s.admin}).legacyPendiente,true);
 assert.equal(s.configure('auxiliar',['primaria'],true,{password:'',usarClaveAnterior:true}).ok,true);
 const profile=login();assert.equal(profile.ok,true);assert.deepEqual(profile.niveles,['primaria']);assert.equal(s.load(profile.token,{nivel:'secundaria'}).ok,false);
 assert.equal(s.c.validarToken_(s.token('auxiliar','auxiliar',{permisosVersion:0})),null);
});
test('Admin keeps both student, attendance and WhatsApp levels; Auxiliar cannot write WhatsApp configuration',()=>{
 const s=backend();s.accounts();assert.equal(s.load(s.admin).estudiantes.length,7);assert.equal(s.get({action:'loadasis',token:s.admin}).items.length,2);assert.equal(s.get({action:'loadwa',token:s.admin}).grupos.length,2);
 assert.equal(s.post({action:'savewa',token:s.login('both').token,grupos:[]}).ok,false);
 assert.equal(s.post({action:'savewa',token:s.admin,grupos:[]}).ok,true);
});
for(const mode of ['absent','expired','tampered','old-global'])test('Auxiliary scope rejects '+mode+' tokens without returning data',()=>{
 const s=backend();s.accounts();const token=mode==='absent'?'':mode==='expired'?s.token('pri','auxiliar',{permisosVersion:s.version,exp:Date.now()-1}):mode==='tampered'?s.login('pri').token+'x':s.token('auxiliar','auxiliar',{permisosVersion:0});
 for(const action of ['loadstudents','loadasis','loadwa','saveasis']){const res=s.post({action,token,items:[]});assert.equal(res.ok,false);assert.equal(res.estudiantes,undefined);assert.equal(res.items,undefined);assert.equal(res.grupos,undefined);}
});

function extract(file,name){const src=read(file),start=src.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,name);const line=src.slice(start).split('\n')[0];if(line.trimEnd().endsWith('}'))return line;return src.slice(start,src.indexOf('\n}',start)+2);}
function client(niveles=['primaria'],role='auxiliar'){
 const token=Buffer.from(JSON.stringify({role,niveles,exp:Date.now()+3600000})).toString('base64url')+'.synthetic';
 const data=new Map([['ie22375_session_v1',JSON.stringify({token,role,niveles})]]),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:id.includes('Nivel')?niveles[0]||'primaria':id==='inpFecha'?'2026-10-05':'1',innerHTML:'',textContent:'',hidden:false});return elements.get(id)};
 const c=vm.createContext({window:{},document:{getElementById:el},sessionStorage:storage,localStorage:storage,atob,Date,setTimeout,clearTimeout,console,toast(){},URLSearchParams,
  hoyISO:()=> '2026-10-05',horaAhora:()=> '09:00',ventanasDe:()=>[{hasta:'08:00'}],hmAMin:()=>480,minutosAhora:()=>600,renderLista(){},fetch:async()=>({ok:true,json:async()=>({ok:true})})});
 const run=s=>new vm.Script(s).runInContext(c);run(read('students.js'));c.IEStudents=c.window.IEStudents;run(read('auxiliar-permissions.js'));c.IEAuxPermissions=c.window.IEAuxPermissions;
 run("let BD={primaria:{estudiantes:[{nivel:'primaria',grado:1,seccion:'Única',nombre:'Synthetic Primary'}]},secundaria:{estudiantes:[{nivel:'secundaria',grado:1,seccion:'A',nombre:'Synthetic Secondary'}]}},ASIS_KEY='synthetic-attendance';");
 for(const name of ['todosAlumnos','jornadaCerrada','loadAsis','saveAsis','asisKey','setRec','completarFaltasAlSubir','onNivel','onGrado','ctx','loadGruposWa','textoListaAula','recToItem','subirTodoNube','bajarNube','tokenSesionAuxiliar'])run(extract('auxiliar.html',name));
 run("const WA_KEY='synthetic-wa',CLOUD_API_URL='synthetic';");
 return {c,run,el,data,storage,token};
}
for(const levels of [['primaria'],['secundaria'],['primaria','secundaria']])test('Auxiliary UI for '+levels.join('+')+' shows a selector only for two authorized levels',()=>{
 const s=client(levels);s.c.IEAuxPermissions.configurar();assert.equal(s.el('selNivel').hidden,levels.length!==2);assert.equal(s.el('selNivelGrupos').hidden,levels.length!==2);
 for(const level of ['primaria','secundaria'])assert.equal(s.el('selNivel').innerHTML.includes('value="'+level+'"'),levels.includes(level));
 assert.equal(s.c.todosAlumnos().length,levels.length);
});
test('Admin UI retains both selectors; old auxiliary token without assigned levels fails closed',()=>{
 const admin=client([],'admin');admin.c.IEAuxPermissions.configurar();assert.equal(admin.el('selNivel').hidden,false);assert.equal(admin.c.todosAlumnos().length,2);
 const old=client([]);old.c.IEAuxPermissions.configurar();assert.equal(old.c.todosAlumnos().length,0);assert.equal(old.el('selNivel').value,'');
});
test('Manipulating DOM or session profile cannot select, write or upload an unassigned auxiliary level',async()=>{
 const s=client();s.storage.setItem('ie22375_session_v1',JSON.stringify({token:s.token,role:'admin',niveles:['primaria','secundaria']}));
 s.el('selNivel').value='secundaria';assert.equal(s.c.onNivel(),false);assert.throws(()=>s.c.ctx(),/no autorizado/);
 assert.equal(s.c.setRec({nivel:'secundaria',grado:1,seccion:'A',nombre:'Synthetic Secondary'},'P'),false);
 let calls=0;s.c.fetch=async()=>{calls++};assert.equal(await s.c.subirTodoNube(),false);assert.equal(await s.c.bajarNube(),false);assert.equal(calls,0);
});
for(const level of ['primaria','secundaria'])test('Automatic absences never affect the other level: '+level,()=>{
 const s=client([level]);assert.equal(s.c.completarFaltasAlSubir(),1);
 const all=clone(s.c.loadAsis());assert.equal(Object.keys(all).length,1);assert.ok(Object.keys(all)[0].includes('||'+level+'||'));
 assert.equal(s.c.jornadaCerrada({nivel:level==='primaria'?'secundaria':'primaria'}),false);
});
test('Auxiliary WhatsApp cache and text creation cannot expose groups/students of another level',()=>{
 const s=client();s.storage.setItem('synthetic-wa',JSON.stringify([{nivel:'primaria',link:'synthetic-primary'},{nivel:'secundaria',link:'synthetic-secondary'}]));
 assert.deepEqual(clone(s.c.loadGruposWa()).map(g=>g.nivel),['primaria']);assert.throws(()=>s.c.textoListaAula('secundaria',1,'A','2026-10-05'),/no autorizado/);
});
test('Auxiliary whole upload omits historical local records from forbidden levels',async()=>{
 const s=client();s.storage.setItem('synthetic-attendance',JSON.stringify({'2026-10-05||primaria||1||Única||Synthetic Primary':{marca:'P'},'2026-10-05||secundaria||1||A||Synthetic Secondary':{marca:'P'}}));
 let body;s.c.fetch=async(url,opts)=>{body=JSON.parse(opts.body);return {text:async()=>JSON.stringify({ok:true,guardados:1})}};
 await s.c.subirTodoNube();assert.equal(body.items.length,1);assert.equal(body.items[0].nivel,'primaria');
});
test('Auxiliary account Admin form does not submit an active account without selected levels',async()=>{
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:'synthetic',checked:id==='auxActivo',disabled:false});return elements.get(id)};
 let calls=0;const c=vm.createContext({document:{getElementById:el},IEStudents:{fetchJSON:async()=>{calls++}},CLOUD_API_URL:'synthetic',tokenSesionAdmin:()=> 'synthetic'});
 new vm.Script(read('auxiliar-admin.js')).runInContext(c);assert.equal(await c.guardarAuxiliarAdmin(),false);assert.equal(calls,0);assert.match(el('auxEstado').textContent,/al menos un nivel/);
});
