'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const base='256a6c2888f3395b1597ef399329aeab0eb5b76d',root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const old=f=>execFileSync('git',['show',base+':'+f],{cwd:root,encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function declaration(s,name){const m=new RegExp('^( *)(?:async )?function '+name+'\\(','m').exec(s);assert.ok(m,name);const end=s.indexOf('\n'+m[1]+'}',m.index)+m[1].length+2;return s.slice(m.index,end);}
const removed={'primaria.html':['setTotalEstudiantes','setNombreDocente'],'secundaria.html':['setTotalEstudiantes']};
for(const [file,names]of Object.entries(removed))test(file+': only approved dead declarations are removed, all remaining source stays identical',()=>{
 let expected=old(file);for(const name of names)expected=expected.replace(declaration(expected,name)+'\n','');assert.equal(read(file),expected);
 for(const name of names)assert.doesNotMatch(read(file),new RegExp('\\b'+name+'\\b'));
});
for(const file of ['primaria.html','secundaria.html'])test(file+': active roster and teacher readers preserve historical state without setters',()=>{
 function run(source){const state={bimestre:'III',grado:file==='primaria.html'?'PRIMERO':'1°',seccion:'A',areaActual:'Matemática',totalesPorAula:{'II|1|A':31},totalesPorAulaTs:{old:123},docentesPorAula:{old:'DOCENTE HISTORICO FICTICIO'},docentesPorAulaTs:{old:456},datos:{historical:{conclusion:'FICTICIA'}}},before=JSON.stringify(state),fields={totalEstudiantes:{},nombreDocente:{},totalEstudiantesFuente:{}},calls=[];
 const c=vm.createContext({estado:state,baseOficialEstudiantes:[{grado:1,seccion:'A'},{grado:1,seccion:'A'},{grado:2,seccion:'A'}],document:{getElementById:id=>fields[id]},IEMatrixTeachers:{nombre:(...args)=>{calls.push(args);return 'DOCENTE FICTICIO';},peek:()=>true},fetch(){throw Error('No remote writes');},localStorage:{setItem(){throw Error('No local persistence during reading');}}});
 const names=file==='primaria.html'?['getTotalEstudiantes','getNombreDocente','syncInputTotalEstudiantes','syncInputDocente']:['normalizarSeccionBD','totalEstudiantesDesdeBD','getTotalEstudiantes','getDocenteArea','syncInputTotalEstudiantes'];
 names.forEach(n=>vm.runInContext(declaration(source,n).trim(),c));c.syncInputTotalEstudiantes();const total=c.getTotalEstudiantes(),teacher=file==='primaria.html'?(c.syncInputDocente(),c.getNombreDocente()):c.getDocenteArea('Matemática');assert.equal(total,2);assert.equal(teacher,'DOCENTE FICTICIO');assert.equal(JSON.stringify(state),before);return JSON.parse(JSON.stringify({total,teacher,fields,calls,state}));}
 assert.deepEqual(run(read(file)),run(old(file)));
});
