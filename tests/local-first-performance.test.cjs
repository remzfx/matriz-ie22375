const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function extract(src,name){
  const start=src.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,name);
  const indent=src.slice(src.lastIndexOf('\n',start-1)+1,start), first=src.indexOf('{',start);let depth=0;
  for(let i=first;i<src.length;i++){if(src[i]==='{')depth++;else if(src[i]==='}'&&!--depth)return src.slice(start,i+1);}throw Error('unclosed');
}
for(const [file,level] of [['primaria.html','primaria'],['secundaria.html','secundaria']]) {
  test(file+' opens from authorized cache before a slow server and replaces it without reload',async()=>{
    const src=read(file),events=[];let resolve;
    const cached={primaria:{estudiantes:[]},secundaria:{estudiantes:[]}};cached[level].estudiantes=[{nombre:'Local'}];
    const fresh={primaria:{estudiantes:[]},secundaria:{estudiantes:[]}};fresh[level].estudiantes=[{nombre:'Cloud'}];
    const c=vm.createContext({document:{getElementById:()=>({textContent:''})},IEStudents:{peek:()=>cached,load:()=>new Promise(r=>resolve=r)},mostrarToast(){},syncInputTotalEstudiantes(){events.push('render')},renderizarAreas(){},renderizarResumen(){},renderizarCompetencias(){},renderizarAreaHeader(){},console});
    vm.runInContext('let baseOficialEstudiantes=[];let estado={areaActual:null};'+extract(src,'estadoEstudiantes')+';'+extract(src,'cargarBaseOficialCache')+';'+extract(src,'cargarBaseOficialEstudiantes'),c);
    assert.equal(c.cargarBaseOficialCache(),true);assert.equal(vm.runInContext('baseOficialEstudiantes[0].nombre',c),'Local');
    const pending=c.cargarBaseOficialEstudiantes();assert.equal(vm.runInContext('baseOficialEstudiantes[0].nombre',c),'Local');
    resolve(fresh);await pending;assert.equal(vm.runInContext('baseOficialEstudiantes[0].nombre',c),'Cloud');
  });
  test(file+' first visit supports fast response and does not invent an empty-cache success',async()=>{
    const src=read(file),fresh={primaria:{estudiantes:[]},secundaria:{estudiantes:[]}};fresh[level].estudiantes=[{nombre:'Cloud'}];
    const c=vm.createContext({document:{getElementById:()=>({textContent:''})},IEStudents:{peek:()=>null,load:async()=>fresh},mostrarToast(){},syncInputTotalEstudiantes(){},renderizarAreas(){},renderizarResumen(){},renderizarCompetencias(){},renderizarAreaHeader(){},console});
    vm.runInContext('let baseOficialEstudiantes=[];let estado={areaActual:null};'+extract(src,'estadoEstudiantes')+';'+extract(src,'cargarBaseOficialCache')+';'+extract(src,'cargarBaseOficialEstudiantes'),c);
    assert.equal(c.cargarBaseOficialCache(),false);await c.cargarBaseOficialEstudiantes();assert.equal(vm.runInContext('baseOficialEstudiantes.length',c),1);
  });
}
test('Registro explicitly paints a valid roster cache before awaiting network',()=>{
  const src=read('registro.html'),body=extract(src,'cargarPadronRegistro');
  assert.ok(body.indexOf('pintarPadronInmediato(cache')<body.indexOf('await IEStudents.loadRoster'));
  assert.match(body,/vigente[\s\S]*pintarPadronInmediato\(vigente/);
});
test('loadstudents read path precedes and bypasses ScriptLock while write paths retain it',()=>{
  const src=read('apps-script/Codigo.js'),body=extract(src,'estudiantesRuta_');
  assert.ok(body.indexOf('if (lectura)')<body.indexOf('LockService.getScriptLock()'));
  assert.match(body,/if \(lectura\)[\s\S]*return respuesta;[\s\S]*LockService\.getScriptLock/);
});
test('remembered-session policy keeps 12-hour signed tokens and documents silent revalidation',()=>{
  assert.match(read('apps-script/Codigo.js'),/TOKEN_TTL_MS = 12 \* 60 \* 60 \* 1000/);
  assert.match(read('docs/sesion-recordada.md'),/revalidaci.n silenciosa/i);
});
