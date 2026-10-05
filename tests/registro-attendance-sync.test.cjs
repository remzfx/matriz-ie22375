const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../registro.html'),'utf8');
function extract(name){
 const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,name);
 return source.slice(start,source.indexOf('\n}',start)+2);
}
const ctx='secundaria||III||4||B',date='2026-10-05',key=ctx+'||'+date+'||id:42';
const clone=x=>JSON.parse(JSON.stringify(x));
function device(){
 let now=1000;const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:id==='selBim'?'III':date,classList:{contains:()=>id==='panelAsistencia'}});return elements.get(id)};
 const store={sessions:[],grades:{},finales:{},concArea:{},meta:{},asistencia:{},asisFechas:{},asisFechasEstado:{}};
 const requests=[],messages=[];
 const c=vm.createContext({store,Date:class extends Date{static now(){return now}},document:{getElementById:el},console,confirm:()=>true,alert:m=>messages.push(m),toast:m=>messages.push(m),
   ctxBase:()=>({nivel:'secundaria',bim:'III',grado:4,seccion:'B',area:'Matemática'}),identidadAlumno:x=>x,
   sessionId:s=>JSON.stringify(s),aliasesAula:()=>({}),metaRegistro:()=>({}),cloudClaveReg:()=>ctx+'||Matemática',prefijoReg:()=>ctx+'||Matemática||',
   registroSoloLectura:()=>false,registroNubeNoVerificada:()=>false,getLoginSession:()=>({token:'synthetic-token'}),guardarTodo(){},saveStore(){},renderSesiones(){},renderStudents(){},estudiantes:()=>[],
   CLOUD_API_URL:'synthetic',fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {text:async()=>JSON.stringify({ok:true})}}
 });
 const run=s=>new vm.Script(s).runInContext(c);
 run("let nivel='secundaria',areaActual='Matemática',padronBimestre='III',asisFechaActiva='2026-10-05',sesionActiva=null,notas={},renderedDates=[];function renderAsistencia(){renderedDates=getAsisFechas().slice()}");
 for(const n of ['tsDe','sliceRegistroArea','mergeRegistroPayload','asisCtxKey','asisMarkKey','asisGet','asisSet','mergeFechasAsistencia','getAsisFechas','agregarFechaAsis','borrarFechaAsis','subirRegistroNube','bajarRegistroNube'])run(extract(n));
 c.horaAhora=()=> '09:00';
 return {c,store,run,requests,messages,el,setTime:n=>now=n};
}

test('Attendance: a newer local mark beats an older cloud download',()=>{
 const d=device();d.store.asistencia[key]={marca:'P',hora:'09:00',ts:200};
 d.c.mergeRegistroPayload({asistencia:{[key]:{marca:'F',hora:'',ts:100}}});
 assert.equal(d.store.asistencia[key].marca,'P');assert.equal(d.store.asistencia[key].ts,200);
});
test('Attendance: a newer cloud mark replaces an older local mark',()=>{
 const d=device();d.store.asistencia[key]={marca:'P',hora:'09:00',ts:100};
 d.c.mergeRegistroPayload({asistencia:{[key]:{marca:'T',hora:'09:15',ts:200}}});
 assert.deepEqual(d.store.asistencia[key],{marca:'T',hora:'09:15',ts:200});
});
test('Legacy string and object attendance remain readable without timestamp; unknown-age cloud cannot overwrite versioned local marks',()=>{
 const d=device();d.c.mergeRegistroPayload({asistencia:{[key]:'P',[ctx+'||2026-10-06||id:43']:{marca:'T',hora:'09:05'}}});
 assert.deepEqual(clone(d.c.asisGet(d.store.asistencia[key])),{marca:'P',hora:''});
 assert.deepEqual(clone(d.c.asisGet(d.store.asistencia[ctx+'||2026-10-06||id:43'])),{marca:'T',hora:'09:05'});
 assert.deepEqual(clone(d.c.getAsisFechas()),['2026-10-05','2026-10-06']);
 d.store.asistencia[key]={marca:'J',ts:200};d.c.mergeRegistroPayload({asistencia:{[key]:'F'}});assert.equal(d.store.asistencia[key].marca,'J');
 d.c.mergeRegistroPayload({asistencia:{[ctx+'||2026-10-06||id:43']:{marca:'P',ts:200}}});assert.equal(d.store.asistencia[ctx+'||2026-10-06||id:43'].marca,'P');
});
test('Attendance timestamp ties preserve local values, including two records with unknown age',()=>{
 const d=device();d.store.asistencia[key]='P';d.c.mergeRegistroPayload({asistencia:{[key]:'F'}});assert.equal(d.store.asistencia[key],'P');
 d.store.asistencia[key]={marca:'P',ts:200};d.c.mergeRegistroPayload({asistencia:{[key]:{marca:'F',ts:200}}});assert.equal(d.store.asistencia[key].marca,'P');
});
test('Local attendance changes receive monotonic timestamps and clearing a mark prevents cloud resurrection',()=>{
 const d=device();d.c.asisSet('id:42','P');assert.equal(d.store.asistencia[key].ts,1000);
 d.c.asisSet('id:42','');assert.equal(d.store.asistencia[key].ts,1001);assert.equal(d.store.asistencia[key].borrado,true);
 d.c.mergeRegistroPayload({asistencia:{[key]:{marca:'P',ts:1000}}});assert.equal(d.c.asisGet(d.store.asistencia[key]).marca,'');
 const other=device();other.c.mergeRegistroPayload(clone(d.c.sliceRegistroArea()));assert.equal(other.store.asistencia[key].borrado,true);
});
test('Attendance dates upload/download as a union for the exact aula/bimestre only',()=>{
 const a=device();a.store.asisFechas[ctx]=[date];a.store.asisFechas['secundaria||III||4||BA']=['2026-10-06'];
 a.store.asistencia[key]={marca:'P',ts:1};a.store.asistencia['secundaria||III||4||BA||'+date+'||id:99']={marca:'P',ts:1};
 const payload=clone(a.c.sliceRegistroArea());assert.deepEqual(payload.asisFechas,{[ctx]:[date]});assert.deepEqual(Object.keys(payload.asistencia),[key]);
 const b=device();b.store.asisFechas[ctx]=['2026-10-07'];b.store.asisFechas['secundaria||IV||4||B']=['2026-11-01'];
 b.c.mergeRegistroPayload(payload);assert.deepEqual(clone(b.c.getAsisFechas()),[date,'2026-10-07']);assert.deepEqual(b.store.asisFechas['secundaria||IV||4||B'],['2026-11-01']);
});
test('Another device restores attendance dates and marks through the real cloud upload/download consumers',async()=>{
 const a=device();a.c.agregarFechaAsis();a.c.asisSet('id:42','P');await a.c.subirRegistroNube();
 assert.equal(a.requests.length,1);const upload=a.requests[0];assert.equal(upload.action,'savereg');assert.equal(upload.token,'synthetic-token');
 assert.deepEqual(upload.payload.asisFechas,{[ctx]:[date]});
 const b=device();b.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify({ok:true,items:[{area:'Matemática',bimestre:'III',grado:4,seccion:'B',payload:upload.payload}]})});
 await b.c.bajarRegistroNube();assert.deepEqual(clone(b.c.getAsisFechas()),[date]);assert.deepEqual(clone(b.run('renderedDates')),[date]);
 assert.equal(b.store.asistencia[key].marca,'P');assert.equal(b.store.asistencia[key].ts,1000);
});
test('A locally deleted date and its marks are not restored by an older cloud payload',()=>{
 const d=device();d.c.agregarFechaAsis();d.c.asisSet('id:42','P');const old=clone(d.c.sliceRegistroArea());
 d.setTime(2000);d.c.borrarFechaAsis(date);d.c.mergeRegistroPayload(old);
 assert.deepEqual(clone(d.c.getAsisFechas()),[]);assert.equal(d.c.asisGet(d.store.asistencia[key]).marca,'');
 const other=device();other.c.mergeRegistroPayload(old);other.c.mergeRegistroPayload(clone(d.c.sliceRegistroArea()));
 assert.deepEqual(clone(other.c.getAsisFechas()),[]);assert.equal(other.c.asisGet(other.store.asistencia[key]).marca,'');
});
test('An explicitly re-added date with a newer timestamp survives an older deletion',()=>{
 const d=device();d.c.agregarFechaAsis();d.c.borrarFechaAsis(date);const deleted=clone(d.c.sliceRegistroArea());
 d.setTime(3000);d.c.agregarFechaAsis();d.c.mergeRegistroPayload(deleted);assert.deepEqual(clone(d.c.getAsisFechas()),[date]);
});
