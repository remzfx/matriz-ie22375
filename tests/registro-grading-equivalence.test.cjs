// Characterization of the approved readers; fictional roster/store, no network.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const previous=execFileSync('git',['show','b7e3619:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const current=read('registro.html'),names=['notaDirectaAlumno','notaDesdeSesiones','notaCompAlumno'];
function extract(s,name){const start=s.indexOf('function '+name+'(');assert.ok(start>=0,name);const line=s.slice(start,s.indexOf('\n',start));return line.endsWith('}')?line:s.slice(start,s.indexOf('\n}',start)+2);}
const copy=x=>structuredClone(x);
function setup(source,options={}){
 const ctx={nivel:options.level||'secundaria',bim:'III',grado:1,seccion:'A',area:'Área ficticia'},comp='Competencia ficticia';
 const student={idSiagie:'synthetic',codigoEstudiante:'synthetic-code',nombre:'ALUMNO FICTICIO ÁLVAREZ',grado:1,seccion:'A'};
 const c=vm.createContext({});c.window=c;vm.runInContext(read('student-identity.js'),c);vm.runInContext(read('registro-evaluation.js'),c);if(source.includes('IERegistroGrading.'))vm.runInContext(read('registro-grading.js'),c);
 const id=c.studentKey(student),prefix=[ctx.nivel,ctx.bim,ctx.grado,ctx.seccion,ctx.area,comp].join('||'),aula=[ctx.nivel,ctx.grado,ctx.seccion].join('||');
 const sessions=(options.sessions||[{...ctx,comp,capacidad:'Capacidad ficticia',fecha:'2026-10-01'}]).map(s=>({...s}));
 const store={sessions,grades:{},finales:{},concComp:{[prefix+'||'+id]:{texto:'Conclusión ficticia conservada'}},asistencia:{unrelated:{marca:'P',ts:1}},academicSync:{unrelated:{version:7}},studentAliases:{[aula]:{[id]:[student.nombre]}}};
 for(const [i,grade]of (options.grades||[]).entries())if(grade!==undefined){const s=sessions[i];store.grades[[ctx.nivel,ctx.bim,ctx.grado,ctx.seccion,ctx.area,s.comp,s.capacidad,s.fecha,options.historical?student.nombre:id].join('||')]=copy(grade);}
 if(options.direct!==undefined)store.finales[prefix+'||'+(options.historical?student.nombre:id)]=copy(options.direct);
 let writes=0;Object.assign(c,{store,modoCalif:options.mode||'letra',ctxBase:()=>ctx,estudiantes:()=>[student],competenciaTrabajada:()=>options.worked!==false,
  numToLetter:c.IERegistroEvaluacion.numToLetter,letterToNum:c.IERegistroEvaluacion.letterToNum,promedioNums:c.IERegistroEvaluacion.promedioNums,
  fetch:()=>{writes++;throw Error('Network forbidden');},saveStore:()=>{writes++;throw Error('Persistence forbidden');},localStorage:{setItem:()=>{writes++;throw Error('Storage forbidden');}}});
 for(const name of ['alumnoIdentidad','identidadAlumno','aliasesAula','leerNota','finalKey',...names])vm.runInContext(extract(source,name),c);
 const reads=[],reader=c.leerNota;c.leerNota=(map,key)=>{reads.push({field:map===store.finales?'finales':'grades',key});return reader(map,key);};
 return {c,ctx,comp,id,store,reads,writes:()=>writes};
}
function compare(options){
 const a=setup(previous,options),b=setup(current,options),before=JSON.stringify(b.store);
 for(const name of names){a.reads.length=b.reads.length=0;const expected=a.c[name](a.comp,a.id),actual=b.c[name](b.comp,b.id);
  for(const key of ['nota','letra','src'])assert.equal(actual[key],expected[key],name+' '+key);
  assert.deepEqual(b.reads,a.reads,name+' reader/key/order');
 }
 assert.equal(JSON.stringify(b.store),before);assert.equal(b.writes(),0);return b;
}

for(const level of ['primaria','secundaria'])for(const mode of ['letra','num'])test(level+' '+mode+': empty, direct and calculated results match previous behavior',()=>{
 const grades=[undefined,{nota20:'',nivel:''},{nota20:0,nivel:'C'},{nivel:'B',origen:'letra'},{nota20:15,nivel:'A'},
  {nota20:'ilegible',nivel:'A'},{nota20:13.5},{nota20:null,nivel:'AD'},{nota20:Infinity,nivel:''},{nota20:NaN,nivel:'B'}, {nota20:8,nivel:'C',borrado:true}];
 for(const grade of grades)for(const direct of grades)compare({level,mode,direct,grades:[grade]});
});

test('valid direct skips evidence reads; inactive competence skips all reads',()=>{
 const a=compare({direct:{nota20:12,nivel:'B'},grades:[{nota20:19,nivel:'AD'}]});a.reads.length=0;
 assert.equal(a.c.notaCompAlumno(a.comp,a.id).src,'P');assert.equal(a.reads.filter(r=>r.field==='grades').length,0);
 const b=compare({worked:false,direct:{nota20:12,nivel:'B'},grades:[{nota20:19,nivel:'AD'}]});b.reads.length=0;
 assert.equal(b.c.notaCompAlumno(b.comp,b.id).src,'');assert.deepEqual(b.reads,[]);
});

test('sessions filter exact scope before resolving identities; all capacities retain their own weight',()=>{
 const f=setup(previous),s=f.store.sessions[0],sessions=[s,{...s,grado:'1',capacidad:'Otra capacidad',fecha:'2026-10-02'},
  {...s,nivel:'primaria'},{...s,bim:'II'},{...s,grado:2},{...s,seccion:'B'},{...s,area:'Otra área'},{...s,comp:'Otra competencia'}];
 const out=compare({sessions,grades:[{nota20:0},{nota20:20}]});out.reads.length=0;
 assert.equal(out.c.notaDesdeSesiones(out.comp,out.id).nota,10);assert.equal(out.reads.length,2);
});

test('verified historical name keys remain readable and originals/conclusions are not rewritten',()=>{
 const f=compare({historical:true,direct:{nota20:15,nivel:'A'},grades:[{nivel:'B',origen:'letra'}]});
 assert.equal(f.c.notaCompAlumno(f.comp,f.id).letra,'A');assert.ok(Object.keys(f.store.finales)[0].endsWith('ALUMNO FICTICIO ÁLVAREZ'));
});

test('deleted direct restores calculated result; duplicate historical sessions retain previous weighting',()=>{
 const f=setup(previous),s=f.store.sessions[0];
 const out=compare({direct:{nota20:19,nivel:'AD',borrado:true},sessions:[s,{...s}],grades:[{nota20:12,nivel:'B'}]});
 assert.equal(out.c.notaCompAlumno(out.comp,out.id).letra,'B');assert.equal(out.c.notaCompAlumno(out.comp,out.id).src,'C');
 const weighted=compare({sessions:[s,{...s},{...s,capacidad:'Otra',fecha:'2026-10-02'}],grades:[{nota20:0},undefined,{nota20:20}]});
 assert.equal(weighted.c.notaDesdeSesiones(weighted.comp,weighted.id).nota,7,'no deduplication or averaging by capacity is introduced');
});
