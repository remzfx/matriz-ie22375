const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=new Function('require','__dirname',read('tests/registro-academic-model.test.cjs').split('\nfor(const level')[0]+'\nreturn ui;')(require,__dirname);
const values={AD:18,A:15,B:12,C:8};
function view(level='secundaria',grade='C',text=''){
 const f=ui(level),cp=f.comps[0];f.c.competencias=()=>[cp];if(grade)f.grade(cp,values[grade]);if(text)f.conclusion(cp,text);
 const html=()=>{f.c.renderFinales();return f.el('finLista').innerHTML;};return {...f,cp,html};
}
function control(f,stored='',locked=false){
 let field=null;const select={value:stored?(f.c.IEConclusionSuggestions.suggestions(f.cp).concat(['No logró el propósito propuesto.','No presenta evidencia para evaluar la competencia.','No asistió.']).includes(stored)?stored:'custom'):'',disabled:locked,dataset:{id:encodeURIComponent(f.id),comp:encodeURIComponent(f.cp)},closest:()=>block};
 function makeField(){return {style:{},dataset:{},value:'',scrollHeight:72,focus(){this.focused=true;},remove(){field=null;}};}
 const block={dataset:{text:stored},querySelector:()=>field,appendChild(x){field=x;}};
 f.c.document.createElement=()=>makeField();let confirmations=0,decision=true;f.c.confirm=()=>{confirmations++;return decision;};
 f.c.IEConclusionSuggestions.bindCompact({querySelectorAll:()=>[select]},(el,text)=>f.c.setConclusionAcademica(decodeURIComponent(el.dataset.comp),decodeURIComponent(el.dataset.id),text));
 return {select,field:()=>field,confirmations:()=>confirmations,decision:value=>decision=value,choose:value=>{select.value=value;select.onchange();}};
}
for(const level of ['primaria','secundaria'])for(const grade of ['', 'AD','A','B','C'])for(const mode of ['letra','num'])test(level+' '+(grade||'empty')+' '+mode+': conclusion visibility follows shared authority',()=>{
 const f=view(level,grade);f.c.modoCalif=mode;const html=f.html(),required=f.c.IERegistroAcademico.requiresConclusion(level,grade);
 if(required){assert.match(html,/final-conclusion/);assert.equal((html.match(/<select/g)||[]).length,1);assert.doesNotMatch(html,/<textarea/);}
 else assert.doesNotMatch(html,/Conclusión|final-conclusion|has-conclusion|<select|<textarea|<details/);
});
for(const level of ['primaria','secundaria'])for(const option of ['No logró el propósito propuesto.','No presenta evidencia para evaluar la competencia.','No asistió.'])test(level+': predefined option saves only concComp without textarea: '+option,()=>{
 const f=view(level),x=control(f);x.choose(option);assert.equal(f.c.store.concComp[f.key(f.cp)].texto,option);assert.equal(x.field(),null);assert.equal(x.select.value,option);
 const html=f.html();assert.match(html,new RegExp('value="'+option.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'" selected'));assert.doesNotMatch(html,/<textarea/);assert.deepEqual(JSON.parse(JSON.stringify(f.c.store.concArea)),{});
});
test('Existing pedagogical suggestion loads selected without a duplicated textarea',()=>{
 const f=view(),text=f.c.IEConclusionSuggestions.suggestions(f.cp)[0];f.conclusion(f.cp,text);const html=f.html();assert.ok(html.includes('value="'+text+'" selected'));assert.doesNotMatch(html,/<textarea/);
});
test('Custom selection creates one editable three-row textarea with 2000 limit and saves text',()=>{
 const f=view(),x=control(f);const before=JSON.stringify(f.c.store.concComp);x.choose('custom');assert.equal(JSON.stringify(f.c.store.concComp),before);
 const field=x.field();assert.equal(field.maxLength,2000);assert.equal(field.rows,3);assert.equal(field.required,true);assert.equal(field.placeholder,'Escriba su conclusión...');
 field.value='Synthetic own conclusion';field.oninput();assert.equal(f.c.store.concComp[f.key(f.cp)].texto,field.value);assert.equal(x.confirmations(),0);
});
test('Existing custom conclusion reloads custom mode, escaped text and one textarea',()=>{
 const f=view('secundaria','C','Custom <text> & "value"');const html=f.html();assert.match(html,/value="custom" selected/);assert.equal((html.match(/<textarea/g)||[]).length,1);assert.match(html,/Custom &lt;text&gt; &amp; &quot;value&quot;/);assert.doesNotMatch(html,/Conclusión descriptiva/);
});
for(const decision of [false,true])test('Custom to predefined confirms and preserves mode on cancellation: '+decision,()=>{
 const f=view('secundaria','C','Existing custom'),x=control(f,'Existing custom');x.decision(decision);x.choose('No asistió.');
 assert.equal(x.confirmations(),1);assert.equal(f.c.concCompAlumno(f.cp,f.id),decision?'No asistió.':'Existing custom');assert.equal(x.select.value,decision?'No asistió.':'custom');
 if(decision)assert.equal(x.field(),null);else assert.equal(x.field().value,'Existing custom');
});
test('Predefined to custom keeps existing text, only changes visual mode and does not dirty data',()=>{
 const f=view('secundaria','C','No asistió.'),x=control(f,'No asistió.');const before=JSON.stringify(f.c.store);x.choose('custom');assert.equal(x.field().value,'No asistió.');assert.equal(JSON.stringify(f.c.store),before);
});
test('Blank placeholder never silently clears an existing conclusion',()=>{
 const f=view('secundaria','C','No asistió.'),x=control(f,'No asistió.');x.choose('');assert.equal(x.select.value,'No asistió.');assert.equal(f.c.concCompAlumno(f.cp,f.id),'No asistió.');
});
for(const [level,grade] of [['secundaria','C'],['primaria','B']])test(level+': conclusion survives grade to A and back without cloud writes',()=>{
 const f=view(level,grade,'Synthetic retained conclusion'),before=JSON.stringify(f.c.store.concComp);f.grade(f.cp,15);assert.doesNotMatch(f.html(),/final-conclusion|Synthetic retained/);assert.equal(JSON.stringify(f.c.store.concComp),before);
 f.grade(f.cp,values[grade]);assert.match(f.html(),/Synthetic retained conclusion/);assert.equal(JSON.stringify(f.c.store.concComp),before);assert.equal(f.calls.length,0);
});
test('Readonly compact selector and field cannot replace a stored conclusion',()=>{
 const f=view('secundaria','C','Keep readonly'),x=control(f,'Keep readonly',true);x.choose('No asistió.');x.field().value='Forged';x.field().oninput();assert.equal(f.c.concCompAlumno(f.cp,f.id),'Keep readonly');assert.equal(x.confirmations(),0);
});
test('Lateral wrapper stays within the same competence cell with no extra column or sliced closing tag',()=>{
 const f=view(),html=f.html();assert.match(html,/<td><div class="final-cell-layout has-conclusion"><div class="final-grade">[\s\S]*?<div class="final-conclusion"/);assert.equal((html.match(/<td[ >]/g)||[]).length,2);
 const src=read('registro.html');assert.doesNotMatch(src,/tds\.slice\(0,-5\)/);assert.match(src,/grid-template-columns:100px minmax\(0,1fr\)/);assert.match(src,/@media\(max-width:640px\)\{\.final-conclusion\{grid-column:1 \/ -1;grid-row:2/);assert.match(src,/worked-label\{[^}]*flex-direction:column/);
});
test('Calculated C also requires compact conclusion without creating a direct override',()=>{
 const f=view('secundaria','');f.c.notaDesdeSesiones=()=>({nota:8,letra:'C'});assert.match(f.html(),/final-conclusion/);assert.deepEqual(JSON.parse(JSON.stringify(f.c.store.finales)),{});
});
test('Resumen still hides custom conclusions, selectors and textareas',()=>{
 const f=view('secundaria','C','Private own conclusion');f.c.renderAvance();assert.doesNotMatch(f.el('avanceBox').innerHTML,/Private own conclusion|<textarea|<select|academic-conclusion/);
});
for(const mode of ['letra','num'])test('Mixed C/A/B/AD rows keep identical fixed grade zone in '+mode,()=>{
 const f=view(),students=['C','A','B','AD'].map((level,i)=>({idSiagie:'layout-'+i,nombre:'Synthetic '+level}));
 f.c.estudiantes=()=>students;f.c.modoCalif=mode;
 students.forEach((al,i)=>{const id=f.c.studentKey(al);f.c.store.finales[f.c.finalKey(f.cp,id)]={nota20:values[['C','A','B','AD'][i]],nivel:['C','A','B','AD'][i],origen:'numero'};});
 const html=f.html(),rows=[...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)][0][1].match(/<tr>[\s\S]*?<\/tr>/g);
 assert.equal(rows.length,4);rows.forEach(row=>{assert.equal((row.match(/class="final-grade"/g)||[]).length,1);assert.match(row,/<td><div class="final-cell-layout(?: has-conclusion)?"><div class="final-grade">/);});
 assert.equal((html.match(/class="final-conclusion"/g)||[]).length,1);
 const css=read('registro.html');assert.match(css,/\.final-cell-layout\{display:grid;grid-template-columns:100px minmax\(0,1fr\)/);assert.match(css,/\.final-grade\{grid-column:1;width:100px;min-width:100px;/);
 assert.doesNotMatch(css,/\.final-cell-layout\.has-conclusion\{/);
});
test('Conclusion removal leaves identical grade controls and no conditional centering',()=>{
 const f=view(),before=f.html().match(/<div class="final-grade">([\s\S]*?)<\/div><div class="final-conclusion"/)[1];
 f.grade(f.cp,15);const after=f.html();assert.match(after,/<div class="final-cell-layout"><div class="final-grade">/);assert.doesNotMatch(after,/final-conclusion/);
 f.grade(f.cp,8);assert.equal(f.html().match(/<div class="final-grade">([\s\S]*?)<\/div><div class="final-conclusion"/)[1],before);
 const css=read('registro.html').slice(read('registro.html').indexOf('.final-cell-layout'),read('registro.html').indexOf('.summary-stats'));
 assert.doesNotMatch(css,/justify-content:space-between|justify-content:center|grid-template-columns:auto/);
});
test('Flexible conclusion cannot impose its long text intrinsic width on the grade column',()=>{
 const f=view('secundaria','C','Synthetic text '.repeat(100));assert.match(f.html(),/final-conclusion/);
 const css=read('registro.html');assert.match(css,/\.final-conclusion\{[^}]*min-width:0;width:100%;max-width:180px/);
 assert.match(css,/\.final-conclusion select,\.final-conclusion textarea\{[^}]*width:100%;min-width:0;box-sizing:border-box/);
 assert.match(css,/\.final-conclusion select\{[^}]*overflow:hidden;text-overflow:ellipsis;white-space:nowrap/);
 assert.match(css,/grid-template-columns:100px minmax\(0,1fr\)/);
});
test('Mobile moves only conclusion to second row and preserves the 100px grade track',()=>{
 const css=read('registro.html');assert.match(css,/@media\(max-width:640px\)\{\.final-conclusion\{grid-column:1 \/ -1;grid-row:2;\}\}/);
 assert.doesNotMatch(css,/@media\(max-width:640px\)\{\.final-cell-layout/);
 assert.match(css,/\.final-grade > \.fin-cell\{width:100%;min-width:0;\}/);
 assert.match(css,/\.final-grade button\{max-width:100%;overflow-wrap:anywhere;\}/);
});
