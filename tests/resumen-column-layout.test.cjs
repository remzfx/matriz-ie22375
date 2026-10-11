const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),html=read('registro.html');
const ui=new Function('require','__dirname',read('tests/registro-academic-model.test.cjs').split('\nfor(const level')[0]+'\nreturn ui;')(require,__dirname);
function view(){const f=ui();f.c.estudiantes=()=>[{idSiagie:'summary-1',orden:217,nombre:'Synthetic Long Student Name With Several Words'}];f.c.renderAvance();return {...f,rendered:f.el('avanceBox').innerHTML};}
function css(selector){const start=html.indexOf(selector);assert.ok(start>=0,selector);return html.slice(start,html.indexOf('}',start)+1);}
test('Summary header and student number/name share left aligned padded column',()=>{
 const f=view();assert.match(f.rendered,/<th class="fin-nom summary-student-header">Estudiante<\/th>/);
 assert.match(f.rendered,/<th class="fin-nom summary-student"><span class="summary-student-order">1<\/span><span class="summary-student-name">Synthetic Long Student Name With Several Words<\/span>/);
 const rule=css('.fin-grid th.summary-student,');assert.match(rule,/text-align:left/);assert.match(rule,/padding-left:12px;padding-right:12px/);
});
test('Long summary names wrap naturally at adequate width without mobile shrinking override',()=>{
 const rule=css('.fin-grid th.summary-student,');assert.match(rule,/min-width:180px/);assert.match(rule,/white-space:normal;overflow-wrap:anywhere/);
 assert.match(css('.summary-student-order,.summary-student-name'),/display:block;text-align:left;white-space:normal/);
 assert.ok(html.indexOf('.fin-grid th.summary-student,')>html.indexOf('min-width:104px; width:104px; max-width:104px'));
});
test('Reference header and every student value use the differentiated centered class',()=>{
 const f=view();assert.match(f.rendered,/<th class="summary-reference">Promedio referencial<small[^>]*>Dato informativo · no SIAGIE/);assert.match(f.rendered,/<td class="summary-reference">—<\/td>/);
 const rule=css('.fin-grid .summary-reference');assert.match(rule,/text-align:center;vertical-align:middle/);assert.match(rule,/width:160px;min-width:150px;max-width:180px/);
});
test('Soft background covers reference header/body and subtle left border separates it',()=>{
 const rule=css('.fin-grid .summary-reference');assert.match(rule,/background:#f0f7ff/);assert.match(rule,/border-left:2px solid #cbd5e1/);
 assert.doesNotMatch(rule,/:nth-child|thead|tbody/);assert.doesNotMatch(html,/th.av-prom-col/);
});
for(const mode of ['letra','num'])test('Reference styling does not change '+mode+' results or create writes',()=>{
 const f=ui();f.c.modoCalif=mode;f.comps.forEach(cp=>f.grade(cp,15));const expected=f.c.promReferencialAlumno(f.id),before=JSON.stringify(f.c.store);f.c.renderAvance();
 const value=mode==='num'&&expected.exacto&&expected.prom!==''?expected.prom+' → '+expected.letra:expected.letra;
 assert.ok(f.el('avanceBox').innerHTML.includes('<td class="summary-reference">'+value+'</td>'));assert.equal(JSON.stringify(f.c.store),before);assert.equal(f.calls.length,0);
});
test('Summary remains readonly and does not disclose or edit competence conclusions',()=>{
 const f=ui();f.grade(f.comps[0],8);f.conclusion(f.comps[0],'Synthetic hidden conclusion');f.c.renderAvance();
 assert.doesNotMatch(f.el('avanceBox').innerHTML,/Synthetic hidden conclusion|<textarea|<select|<input|academic-conclusion/);
});
test('Printed summary retains student/reference classes and border even without background colors',()=>{
 const f=view();let prints=0;f.c.print=()=>prints++;const src=html.slice(html.indexOf('function imprimirResumen()'),html.indexOf('\n}',html.indexOf('function imprimirResumen()'))+2);vm.runInContext(src,f.c);f.c.imprimirResumen();
 assert.equal(prints,1);assert.match(f.el('printArea').innerHTML,/summary-student-header|summary-student-order|summary-reference/);
 assert.match(css('#printArea .fin-grid .summary-student,'),/text-align:left/);
 const rule=css('#printArea .fin-grid .summary-reference');assert.match(rule,/text-align:center;vertical-align:middle/);assert.match(rule,/background:#f4f8fc!important/);assert.match(rule,/border-left:2px solid #94a3b8!important/);assert.match(rule,/print-color-adjust:exact/);
});
test('Order fallback stays readable without mutating the protected roster',()=>{
 const f=ui(),student={idSiagie:'orderless',nombre:'Synthetic orderless name'},before=JSON.stringify(student);f.c.estudiantes=()=>[student];f.c.renderAvance();assert.match(f.el('avanceBox').innerHTML,/summary-student-order">1<\/span>/);assert.equal(JSON.stringify(student),before);
});

for(const mode of ['letra','num'])for(const [note,level] of [[18,'AD'],[15,'A'],[12,'B'],[8,'C'],[null,'Pendiente']])test('Summary '+mode+' '+level+' uses centered competence cell without changing result',()=>{
 const f=ui();f.c.modoCalif=mode;if(note!==null)f.grade(f.comps[0],note);const before=JSON.stringify(f.c.store);f.c.renderAvance();const cell=f.el('avanceBox').innerHTML.match(/<td class="summary-competence">([\s\S]*?)<\/td>/);assert.ok(cell);assert.ok(cell[1].includes('<span>'+level+'</span>'));if(mode==='num'&&note!==null)assert.ok(cell[1].includes('<strong>'+note+' → </strong>'));assert.equal((f.el('avanceBox').innerHTML.match(/<td class="summary-competence">/g)||[]).length,f.comps.length);assert.equal(JSON.stringify(f.c.store),before);assert.equal(f.calls.length,0);
});
test('Not-worked and pending results share middle/center alignment with reference, without widening rows',()=>{const f=ui();f.c.setCompetenciaTrabajada(f.comps[0],false);const before=JSON.stringify(f.c.store);f.c.renderAvance();assert.match(f.el('avanceBox').innerHTML,/<td class="summary-competence">No trabajada este bimestre<\/td>/);assert.match(css('.fin-grid td.summary-competence'),/vertical-align:middle;text-align:center/);assert.doesNotMatch(css('.fin-grid td.summary-competence'),/width|height|padding|font-size|overflow/);assert.equal(JSON.stringify(f.c.store),before);});
test('Print copies centered competence classes, preserving A4 print function and all other presentation',()=>{
 const f=ui();f.grade(f.comps[0],15);f.c.print=()=>{};const start=html.indexOf('function imprimirResumen()');vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),f.c);f.c.imprimirResumen();assert.match(f.el('printArea').innerHTML,/<td class="summary-competence">/);
 const old=require('node:child_process').execFileSync('git',['show','8726757011c8c259667741791b60644b20247053:registro.html'],{encoding:'utf8',maxBuffer:4*1024*1024});
 const normalized=x=>x.replace(/\r\n/g,'\n');const restored=normalized(html).replace('  .fin-grid td.summary-competence{vertical-align:middle;text-align:center;}\n','').replaceAll('<td class="summary-competence">','<td>');const summary=x=>x.slice(x.indexOf('function renderAvance()'),x.indexOf('const MOBILE_APP_STORES')).replace('al.numeroVisual??i+1','al.orden??i+1');assert.equal(summary(restored),summary(normalized(old)));const styles=x=>x.slice(x.indexOf('.fin-grid th.summary-student,'),x.indexOf('.asis-chip'));assert.equal(styles(restored),styles(normalized(old)));
});
