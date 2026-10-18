'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const before=execFileSync('git',['show','076da3b:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n'),current=read('registro.html');
const clone=x=>JSON.parse(JSON.stringify(x));
function extract(source,name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);const line=source.slice(start,source.indexOf('\n',start));return line.endsWith('}')?line:source.slice(start,source.indexOf('\n}',start)+2);}
function fixture(source,level='secundaria',sessions=[],selected=[]){
 const context={nivel:level,bim:'III',grado:1,seccion:'A',area:'Área ficticia'},elements={selCap:{value:''},selComp:{value:''},selUnidad:{value:''},inpCapacidad:{value:''},inpFecha:{value:'2026-10-01'}};
 let remote=0;const c=vm.createContext({store:{sessions:structuredClone(sessions)},capsElegidas:structuredClone(selected),ctxBase:()=>context,esCompetenciaTransversal:comp=>comp==='TIC ficticia',document:{getElementById:id=>elements[id]},fetch(){remote++;throw Error('No remote calls allowed');},effects:[]});c.window=c;
 vm.runInContext(read('registro-grading.js'),c);
 if(source.includes('function renderChipsCaps()'))vm.runInContext(extract(source,'renderChipsCaps'),c);
 for(const name of ['normCapItem','tieneCapSel','capacidadElegida','capsDeComp','onSesionChange','abrirSesionFecha'])vm.runInContext(extract(source,name),c);
 Object.assign(c,{loadCapsElegidas(){c.effects.push('load');c.capsElegidas=structuredClone(selected);},saveCapsElegidas(){c.effects.push('save');},renderStudents(){c.effects.push('render');},renderSesiones(){c.effects.push('sessions');},fillCaps(){c.effects.push('fill');}});
 return {c,context,elements,remote:()=>remote};
}
for(const level of ['primaria','secundaria'])test(level+': historical capability normalization preserves raw names, fallback and origin',()=>{
 const a=fixture(before,level),b=fixture(current,level);
 for(const x of [null,undefined,'',' Capacidad antigua ',{cap:'Capacidad',comp:'Competencia'},{cap:'Capacidad',comp:'TIC ficticia'},{cap:'Capacidad'},{cap:''},{cap:0},{cap:'__proto__'},{}])for(const fallback of [undefined,'Competencia histórica','TIC ficticia']){
  const original=JSON.stringify(x);assert.deepEqual(clone(b.c.normCapItem(x,fallback)),clone(a.c.normCapItem(x,fallback)));assert.equal(JSON.stringify(x),original);
 }
});
for(const level of ['primaria','secundaria'])test(level+': opening a historical date retains first active session, units and transversal columns',()=>{
 const s={...fixture(before,level).context,comp:'Competencia',capacidad:'Capacidad',fecha:'2026-10-01',unidad:'U6'};
 for(const sessions of [[],[s,{...s},{...s,grado:'1',comp:'Otra',unidad:'U7'}]]){
  const a=fixture(before,level,sessions),b=fixture(current,level,sessions),trans={...s,comp:'TIC ficticia',capacidad:'TIC'};
  for(const f of [a,b])f.c.IERegistroTransversales={sessions:()=>[trans]};
  a.c.abrirSesionFecha(s.fecha);b.c.abrirSesionFecha(s.fecha);
  assert.deepEqual(clone(b.c.sesionActiva),clone(a.c.sesionActiva));assert.deepEqual(clone(b.c.capsElegidas),clone(a.c.capsElegidas));assert.deepEqual(clone(b.c.effects),clone(a.c.effects));assert.deepEqual(b.elements,a.elements);assert.equal(b.remote(),0);
 }
});
test('pure session preparation accepts frozen inputs and keeps original duplicates and order',()=>{
 const api=require('../registro-grading.js'),context=Object.freeze(fixture(before).context),s=Object.freeze({...context,fecha:'2026-10-01',comp:'Competencia',capacidad:'Capacidad'}),sessions=Object.freeze([s,s]);
 assert.deepEqual(api.sessionsOn(sessions,context,s.fecha),[s,s]);assert.deepEqual(api.sessionsOn(sessions,context,'different'),[]);
 assert.deepEqual(api.capabilitiesFor(sessions,context,s.comp),[{capacidad:'Capacidad',fecha:s.fecha}]);
 const item=Object.freeze({comp:'Competencia',cap:'Capacidad'});assert.deepEqual(api.normalizeCapability(item,'',()=>false),{...item,origen:'academica'});
 assert.equal(sessions.length,2);
});
test('capability choice trims only the selected value and uses custom text only for Otra',()=>{
 const a=fixture(before),b=fixture(current);
 for(const value of ['', ' Capacidad oficial ', '__otra__'])for(const custom of ['', ' Texto libre con ñ y < > ']){
  for(const f of [a,b]){f.elements.selCap.value=value;f.elements.inpCapacidad.value=custom;}
  assert.equal(b.c.capacidadElegida(),a.c.capacidadElegida());
 }
 assert.equal(b.remote(),0);
});
for(const level of ['primaria','secundaria'])test(level+': context/day preparation keeps duplicates, selection order and current handler effects',()=>{
 const f=fixture(before,level),s={...f.context,comp:'Competencia',capacidad:' Capacidad antigua ',fecha:'2026-10-01'};
 const sessions=[s,{...s},{...s,grado:'1',capacidad:'Otra'}, {...s,capacidad:''},{...s,fecha:'2026-09-01'},...['nivel','bim','grado','seccion','area'].map(k=>({...s,[k]:'different'}))];
 const selected=[{comp:'Otra competencia',cap:'Otra',origen:'academica'}];
 const a=fixture(before,level,sessions,selected),b=fixture(current,level,sessions,selected),initial=JSON.stringify(b.c.store);
 assert.deepEqual(clone(b.c.capsDeComp('Competencia')),clone(a.c.capsDeComp('Competencia')));
 a.c.onSesionChange();b.c.onSesionChange();assert.deepEqual(clone(b.c.capsElegidas),clone(a.c.capsElegidas));assert.deepEqual(clone(b.c.effects),['load','save','render']);
 assert.equal(JSON.stringify(b.c.store),initial);assert.equal(b.remote(),0);
 assert.equal(b.c.capsElegidas.filter(x=>x.cap===s.capacidad).length,1);
});
test('capacity summary keeps first historical date, trims for display only and never weights evidence',()=>{
 const s={...fixture(before).context,comp:'Competencia',capacidad:' Capacidad ',fecha:'2026-10-02'};
 const sessions=[s,{...s,capacidad:'Capacidad',fecha:'2026-10-01'},{...s,capacidad:'Otra',fecha:''},{...s,capacidad:'constructor'}];
 const a=fixture(before,'secundaria',sessions),b=fixture(current,'secundaria',sessions);
 assert.deepEqual(clone(b.c.capsDeComp('Competencia')),clone(a.c.capsDeComp('Competencia')));
 assert.deepEqual(clone(b.c.capsDeComp('Competencia')),[{capacidad:'Capacidad',fecha:'2026-10-02'},{capacidad:'Otra',fecha:''}]);
 assert.equal(b.c.store.sessions.length,4);assert.equal(b.remote(),0);
});
