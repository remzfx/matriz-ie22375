'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const base='391e5d0418b563302b19c65c07aa1d2ddb3c5e18',read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const previous=f=>execFileSync('git',['show',base+':'+f],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function declaration(s,name){const m=new RegExp('^( *)(?:async )?function '+name+'\\(','m').exec(s);if(!m)return '';const first=s.indexOf('\n',m.index),end=s.slice(m.index,first).trimEnd().endsWith('}')?first:s.indexOf('\n'+m[1]+'}',first)+m[1].length+2;return s.slice(m.index,end);}
const candidates={'primaria.html':['truncarTexto','actualizarNombreDocente','cerrarComparativo','setTotalEstudiantes','setNombreDocente'],'secundaria.html':['truncarTexto','cerrarComparativo','setTotalEstudiantes'],'admin.html':['exportarHorario','importarHorario']};
for(const [file,names]of Object.entries(candidates))test(file+': only the approved unused utilities can differ from E1',()=>{
 let expected=previous(file);for(const name of names){const old=declaration(expected,name),current=declaration(read(file),name);assert.ok(old,name);if(!current)expected=expected.replace(old+'\n','');else assert.equal(current,old);}
 assert.equal(read(file),expected);
});
test('candidate functions have no production references beyond their declarations',()=>{
 const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.(js|html)$/.test(f)&&!/^tests\/|^docs\/|^vendor\//.test(f));
 const source=files.map(f=>[f,read(f)]);
 for(const names of Object.values(candidates))for(const name of names){for(const [file,s]of source){const without=s.replace(declaration(s,name),'');assert.doesNotMatch(without,new RegExp('\\b'+name+'\\b'),file+' has a consumer of '+name);}}
});
for(const file of ['primaria.html','secundaria.html'])test(file+': characterize old truncation and keep data intact',()=>{
 const c=vm.createContext({});vm.runInContext(declaration(previous(file),'truncarTexto').trim(),c);
 for(const text of ['',null,'Álvarez Ñandú y nombre largo','Texto <sintético> & "comillas"'])for(const max of [undefined,0,1,5,80]){const raw=String(text||'').trim(),expected=!max||raw.length<=max?raw:raw.slice(0,Math.max(1,max-1)).trimEnd()+'…';assert.equal(c.truncarTexto(text,max),expected);}
});
test('old teacher alias only delegates to the still-active teacher renderer',()=>{let calls=0;const c=vm.createContext({syncInputDocente(){calls++;}});vm.runInContext(declaration(previous('primaria.html'),'actualizarNombreDocente').trim(),c);c.actualizarNombreDocente();assert.equal(calls,1);assert.match(read('primaria.html'),/function syncInputDocente\(/);});
test('comparative close helpers remain intact while the baseline navigation exit is not certified',()=>{
 for(const file of ['primaria.html','secundaria.html'])assert.equal(declaration(read(file),'cerrarComparativo'),declaration(previous(file),'cerrarComparativo'));
});
test('Admin active schedule edit/save works without the disconnected import/export helpers',()=>{
 const state=new Map(),els=new Map(),writes=[],c=vm.createContext({localStorage:{getItem:k=>state.get(k)||null,setItem:(k,v)=>{state.set(k,v);writes.push(k);}},document:{getElementById:id=>{if(!els.has(id))els.set(id,{value:'',innerHTML:''});return els.get(id);}},alert(){},fetch(){throw Error('No remote writes');}});
 vm.runInContext("const HORARIO_KEY='synthetic-schedule';",c);
 for(const name of ['horarioDefecto','loadHorario','saveHorarioObj','initHorarioUI','renderReglasHorario','agregarReglaHorario','borrarReglaHorario','guardarHorario'])vm.runInContext(declaration(read('admin.html'),name).trim(),c);
 c.initHorarioUI();c.document.getElementById('horPriDesde').value='07:45';c.document.getElementById('horSecHasta').value='13:30';c.guardarHorario();assert.equal(c.loadHorario().defaults.primaria.desde,'07:45');assert.equal(c.loadHorario().defaults.secundaria.hasta,'13:30');
 for(const [id,value]of Object.entries({exNivel:'secundaria',exGrado:'1',exSec:'A',exDesde:'12:40',exHasta:'13:20'}))c.document.getElementById(id).value=value;
 c.agregarReglaHorario();assert.equal(c.loadHorario().extras.length,1);assert.match(c.document.getElementById('listaReglasHorario').innerHTML,/12:40/);c.borrarReglaHorario(0);assert.equal(c.loadHorario().extras.length,0);assert.ok(writes.every(k=>k==='synthetic-schedule'));
});
module.exports={base,read,previous,declaration,candidates};
