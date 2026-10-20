// N2-F P1: actual read-only capability readers, with synthetic DOM/storage/transport.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copy=x=>JSON.parse(JSON.stringify(x));
const fixture=new Function('require',fs.readFileSync('tests/notas2-ui.test.cjs','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require);
const {extract}=require('./registro-visual-demo.cjs'),source=fs.readFileSync('registro.html','utf8');
function setup(){
 const f=fixture(),g=f.g,date='2026-10-01',comp='Competencia ficticia';f.pane('calificar');g.IERegistroTransversales=undefined;g.IERegistroGrading=require('../registro-grading.js');
 f.elements.inpFecha={value:date};f.elements.selComp={value:comp};g.esCompetenciaTransversal=()=>false;g.registroSoloLectura=()=>!f.api.canEdit('calificar');let localWrites=0;g.saveStore=()=>localWrites++;
 for(const name of ['keyCapsHoy','normCapItem','tieneCapSel','loadCapsElegidas','saveCapsElegidas'])vm.runInContext(extract(source,name),g);
 f.remote.sessions=[{...g.ctxBase(),comp,capacidad:'Capacidad uno',fecha:date,unidad:'U5'},{...g.ctxBase(),comp,capacidad:'Capacidad dos',fecha:date,unidad:'U5'},{...g.ctxBase(),comp,capacidad:'Otro día',fecha:'2026-10-02'}];
 f.remote.capsSel[f.prefix+date]=[{comp,cap:'Capacidad uno',origen:'academica'},{comp,cap:'Capacidad dos',origen:'academica'}];f.remote.capsSel[f.prefix+'2026-10-02']=[{comp,cap:'Otro día',origen:'academica'}];
 f.remote.grades[f.prefix+comp+'||Capacidad uno||'+date+'||id:synthetic']={nivel:'A',nota20:15,origen:'letra'};
 return {...f,date,comp,localWrites:()=>localWrites};
}
for(const mode of ['first-PC-load','verified-refresh','manual-download'])test('N2-F P1 '+mode+' restores columns and active session without writes',async()=>{
 const f=setup(),before=copy(f.remote);assert.equal(await f.api.current().load(),true);
 if(mode!=='first-PC-load'){f.g.capsElegidas=[];f.g.sesionActiva=null;if(mode==='verified-refresh')assert.equal(await f.api.current().load({verify:true}),true);else assert.equal(await f.api.download(),true);}
 assert.deepEqual(copy(f.g.capsElegidas).map(x=>x.cap),['Capacidad uno','Capacidad dos']);assert.equal(f.g.sesionActiva.fecha,f.date);assert.equal(f.g.sesionActiva.comp,f.comp);assert.equal(f.g.sesionActiva.unidad,'U5');assert.equal(f.g.sesionActiva.capacidad,'Capacidad uno');
 assert.equal(f.api.current().pending('calificar'),false);assert.equal(f.requests.filter(x=>x.action==='savenotas2').length,0);assert.equal(f.localWrites(),0);assert.deepEqual(f.remote,before);
});
test('N2-F P1 Save after verification preserves confirmed capabilities and evidence',async()=>{const f=setup();await f.api.current().load();await f.api.current().load({verify:true});const before=copy(f.remote);assert.equal(await f.api.save(),true);assert.deepEqual(f.remote.capsSel,before.capsSel);assert.deepEqual(f.remote.grades,before.grades);assert.equal(f.requests.filter(x=>x.action==='savenotas2').length,1);});
test('N2-F P1 restoration respects selected date and does not import another day or context',async()=>{const f=setup();f.elements.inpFecha.value='2026-10-02';f.remote.sessions.push({...f.remote.sessions[0],area:'Another area',capacidad:'Foreign'});await f.api.current().load();assert.deepEqual(copy(f.g.capsElegidas).map(x=>x.cap),['Otro día']);assert.equal(f.g.sesionActiva.fecha,'2026-10-02');assert.equal(f.g.sesionActiva.capacidad,'Otro día');assert.equal(f.localWrites(),0);});
test('N2-F P1 empty selected date has no stale active session or invented columns',async()=>{const f=setup();f.elements.inpFecha.value='2026-10-03';f.g.sesionActiva={fecha:f.date,comp:f.comp,capacidad:'Stale'};await f.api.current().load();assert.deepEqual(copy(f.g.capsElegidas),[]);assert.equal(f.g.sesionActiva,null);assert.equal(f.localWrites(),0);});
