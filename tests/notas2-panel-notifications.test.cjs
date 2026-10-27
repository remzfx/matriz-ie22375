'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const fixture=new Function('require',fs.readFileSync('tests/notas2-ui.test.cjs','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require);
test('active panel summary is isolated while the global diagnostic retains all panel states',async()=>{
 const f=fixture();f.g.IERegistroTransversales=undefined;f.g.renderAsistencia=()=>{};
 await f.api.current().load();const key=f.prefix+'C1||id:synthetic';
 f.data.finales[key]={nivel:'A',nota20:15,origen:'letra'};
 const before=JSON.stringify(f.data),requests=f.requests.length;
 for(const [pane,label]of [['calificar','Calificar'],['promedios','Promedios'],['asistencia','Asistencia']]){
  f.pane(pane);f.api.refresh();const summary=f.elements.registroSaveState.textContent;
  assert.match(summary,new RegExp('^'+label+': '));
  for(const other of ['Calificar','Promedios','Asistencia'].filter(x=>x!==label))assert.doesNotMatch(summary,new RegExp(other+':'));
  if(pane==='promedios')assert.match(summary,/Cambios sin guardar/);else assert.doesNotMatch(summary,/Cambios sin guardar/);
 }
 assert.equal(JSON.stringify(f.data),before);assert.equal(f.requests.length,requests);assert.equal(f.diskWrites.length,0);
 const c=vm.createContext({window:null});c.window=c;vm.runInContext(fs.readFileSync('registro-sync-diagnostic-ui.js','utf8'),c);
 const s=f.api.status(),html=c.IERegistroSyncDiagnosticUI.buildDialogContent({model:'notas2',state:'conflict',panels:s.panels,saveSummary:'Asistencia: Sin guardado confirmado'});
 assert.match(html,/Diagnóstico global/);assert.match(html,/Estado del panel activo/);
 for(const panel of ['calificar','promedios','asistencia'])assert.match(html,new RegExp(panel+': versión confirmada'));
 assert.match(html,/Conflicto CAS/);assert.match(html,/Cambios sin guardar/);
});
test('saving Calificar does not clear pending Promedios or show its confirmation in Calificar',async()=>{
 const f=fixture();f.g.IERegistroTransversales=undefined;await f.api.current().load();
 f.data.grades[f.prefix+'C1||Cap1||2026-10-24||id:synthetic']={nivel:'B',nota20:12};
 f.data.finales[f.prefix+'C1||id:synthetic']={nivel:'A',nota20:15};
 f.pane('calificar');assert.equal(await f.api.save(),true);
 assert.equal(f.api.current().pending('promedios'),true);
 assert.match(f.elements.registroSaveState.textContent,/^Calificar: Guardado /);
 assert.doesNotMatch(f.elements.registroSaveState.textContent,/Promedios/);
 assert.equal(f.requests.filter(x=>x.action==='savenotas2'&&x.panel==='promedios').length,0);
});
