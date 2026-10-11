const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const {extract}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('function fixture')[0]+'\nreturn {extract};')(require,__dirname);
const sample='Muñoz, Ángela O\'Neil & "especial" <synthetic data-note="literal"> &lt;';
const encoded=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Inspect inert generated fragments; never execute their content or contact services.
const decoded=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[e]));
function attrs(tag){return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],decoded(m[2])]));}
function safe(html,value=sample){assert.ok(html.includes(encoded(value)));assert.doesNotMatch(html,/<synthetic\b|data-note="literal"/);}
function page(file,names,extra={}){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){}},querySelectorAll:()=>[]});return elements.get(id);};
 const c=vm.createContext({Date,encodeURIComponent,decodeURIComponent,document:{getElementById:el},...extra});
 for(const n of names)vm.runInContext(extract(file,n),c);
 return {c,el};
}

for(const value of ['Muñoz, Ángela O\'Neil', '& < > " \'', sample])test('Admin teacher render encodes text and ID while Edit/Delete retain the original value: '+value.slice(0,12),()=>{
 const edits=[],deletes=[],d={id:value,nombre:value,user:value,nivel:value,pass:'synthetic-not-a-real-credential',asignaciones:{[value]:[value+'|A']},tutorAulas:[value],aportesTransversales:{[value]:[value]}};
 const p=page('admin.html',['escapeConsulta','renderDocentes'],{loadDocentes:()=>[d],editarDocente:id=>edits.push(id),eliminarDocente:id=>deletes.push(id)});
 p.c.renderDocentes();const html=p.el('docLista').innerHTML;safe(html,value);
 const id=attrs(html.match(/<div[^>]*data-doc-id[^>]*>/)[0])['data-doc-id'];assert.equal(id,value);
 const row={getAttribute:()=>id};
 for(const action of ['edit','del'])p.el('docLista').onclick({target:{closest:s=>s==='[data-doc-id]'?row:s==='.btn-doc-'+action?{}:null}});
 assert.deepEqual(edits,[value]);assert.deepEqual(deletes,[value]);assert.match(html,/>Editar<|>Eliminar</);
 assert.deepEqual(d.asignaciones,{[value]:[value+'|A']});
});
for(const nivel of ['primaria','secundaria'])test('Teacher fallback areas/grades/classrooms are encoded: '+nivel,()=>{
 const d={id:'synthetic',user:sample,nivel,grados:[sample],areas:[sample],aulas:[sample+'|B'],tutorAulas:[],aportesTransversales:{}};
 const p=page('admin.html',['escapeConsulta','renderDocentes'],{loadDocentes:()=>[d]});p.c.renderDocentes();safe(p.el('docLista').innerHTML);
});
test('SIAGIE template status encodes all five dynamic fields without changing the read request',async()=>{
 const item={nivel:sample,bimestre:sample,grado:sample,seccion:sample,filename:sample+'.xlsx'},calls=[];
 const p=page('admin.html',['escapeConsulta','listarPlantillasSiagie'],{CLOUD_API_URL:'https://synthetic.invalid',fetchLecturaNube:async url=>{calls.push(url);return {text:async()=>JSON.stringify({items:[item]})};}});
 await p.c.listarPlantillasSiagie();const html=p.el('tplLista').innerHTML;safe(html);
 assert.equal((html.match(/&lt;synthetic/g)||[]).length,5);assert.equal(calls.length,1);assert.match(calls[0],/action=loadtplstatus/);
});

function auxiliary(){
 const al={nombre:sample,numeroVisual:1},rec={marca:'J',hora:sample,motivo:sample,ts:123},writes=[];
 const p=page('auxiliar.html',['escapeAuxiliar','renderLista'],{ctx:()=>({nivel:'primaria',grado:1,seccion:'Única',fecha:'2026-10-11'}),alumnosAula:()=>[al],getRec:()=>rec,
 setRec:(a,marca,via,motivo)=>{writes.push({a,marca,via,motivo});rec.marca=marca;rec.motivo=motivo;},prompt:()=>sample,toast(){}});
 return {...p,al,rec,writes};
}
test('Auxiliar names, hours and justification values render literally; dataset round-trips intact',()=>{
 const p=auxiliary();p.c.renderLista();const html=p.el('lista').innerHTML;safe(html);
 const input=attrs(html.match(/<input[^>]+>/)[0]);assert.equal(input.value,sample);assert.equal(decodeURIComponent(input['data-motivo']),sample);
 const buttons=[...html.matchAll(/<button[^>]+>/g)].map(m=>attrs(m[0]));assert.deepEqual(buttons.map(a=>a['data-v']),['P','F','T','J']);
 for(const b of buttons)assert.equal(decodeURIComponent(b['data-n']),sample);
 assert.equal(p.rec.ts,123);assert.equal(p.writes.length,0);
});
test('Auxiliar justification edits and P/F/T/J handlers preserve raw values and student selection',()=>{
 const p=auxiliary();p.c.renderLista();let html=p.el('lista').innerHTML;
 const a=attrs(html.match(/<input[^>]+>/)[0]),input={value:sample+' & more',getAttribute:()=>a['data-motivo']};
 p.el('lista').onchange({target:{closest:()=>input}});assert.equal(p.writes[0].motivo,input.value);assert.equal(p.writes[0].a,p.al);
 const button=attrs(html.match(/<button[^>]+>/)[0]);
 p.el('lista').onclick({target:{closest:()=>({dataset:{n:button['data-n'],v:button['data-v']}})}});
 assert.equal(p.writes[1].marca,'P');assert.equal(p.writes[1].a,p.al);assert.equal(p.rec.ts,123);
});
test('Auxiliar section option preserves the original value rather than decoding entities twice',()=>{
 const p=page('auxiliar.html',['escapeAuxiliar','onGrado'],{IEAuxPermissions:{permite:()=>true},ctx:()=>({nivel:'primaria',grado:1}),BD:{primaria:{estudiantes:[{grado:1,seccion:sample}]}},renderLista(){}});
 p.el('selGrado').value='1';p.el('selNivel').value='primaria';p.c.onGrado();safe(p.el('selSeccion').innerHTML);assert.equal(attrs(p.el('selSeccion').innerHTML).value,sample);
});

function finals(mode){
 const student={nombre:sample,idSiagie:sample},store={finales:{}},writes=[];
 const p=page('registro.html',['escapeRegistro','renderFinales'],{modoCalif:mode,store,loadStore(){},ctxBase:()=>({nivel:'secundaria',grado:1,seccion:'A',bim:'III',area:'Matemática'}),competencias:()=>[sample],capsDeComp:()=>[],bimCerradoDocente:()=>false,
 estudiantes:()=>[student],competenciaTrabajada:()=>true,studentKey:a=>'id:'+a.idSiagie,notaDirectaAlumno:()=>({nota:15,letra:'A'}),notaDesdeSesiones:()=>({nota:15,letra:'A'}),notaCompAlumno:()=>({nota:15,letra:'A'}),leerNota:()=>({nota20:15,nivel:'A',origen:'numero'}),finalKey:(cp,id)=>cp+'||'+id,
 registroSoloLectura:()=>false,IERegistroAcademico:{requiresConclusion:()=>false},baselineAcademica(){},IEConclusionSuggestions:{bindCompact(){}},setConclusionAcademica(){},sincronizarEdicionRegistro(){},pad2:n=>String(n),eqClass:()=> 'eq-a',numeroExactoComp:()=>true,
 toast(){},letterToNum:()=>12,numToLetter:()=> 'B',saveStore:()=>writes.push(true)});
 return {...p,store,writes,student};
}
for(const mode of ['letra','num'])test('Promedios '+mode+' encodes real names/competence headers and retains editable note handlers',()=>{
 const p=finals(mode);p.c.renderFinales();const html=p.el('finLista').innerHTML;safe(html);
 const data=attrs(html.match(/<div[^>]*data-fin[^>]*>/)[0]);assert.equal(decodeURIComponent(data['data-fin']),'id:'+sample);assert.equal(decodeURIComponent(data['data-comp']),sample);
 const cell={dataset:{fin:data['data-fin'],comp:data['data-comp']},querySelector:()=>({})};let handler;
 const control=mode==='letra'?{dataset:{val:'B'},closest:()=>cell,addEventListener:(ev,fn)=>handler=fn}:{value:'12',closest:()=>cell,addEventListener:(ev,fn)=>handler=fn};
 p.el('finLista').querySelectorAll=s=>s===(mode==='letra'?'.fin-cell button[data-val]':'.fin-nota')?[control]:[];
 p.c.renderFinales();handler.call(control);
 assert.equal(p.writes.length,1);const saved=p.store.finales[sample+'||id:'+sample];assert.equal(saved.nivel,'B');assert.equal(saved.nota20,12);
});
for(const readonly of [false,true])test('Registro attendance encodes names/hours/dates and respects readonly='+readonly,()=>{
 const marks=[],date=sample,id='id:'+sample,rec={marca:'J',hora:sample,ts:123};
 const p=page('registro.html',['escapeRegistro','renderAsistencia'],{asisFechaActiva:date,getAsisFechas:()=>[date],hoyISO:()=>date,estudiantes:()=>[{nombre:sample}],studentKey:()=>id,asisMarkKey:(d,n)=>d+'||'+n,leerNota:()=>rec,store:{asistencia:{}},asisGet:x=>x,
 ctxBase:()=>({nivel:'secundaria',grado:1,seccion:'A',bim:'III'}),loadStore(){},registroSoloLectura:()=>readonly,asisSet:(n,m)=>marks.push({n,m}),saveStore(){},sincronizarEdicionRegistro(){}});
 p.c.renderAsistencia();safe(p.el('asisLista').innerHTML);safe(p.el('asisFechas').innerHTML);
 const button=attrs(p.el('asisLista').innerHTML.match(/<button[^>]+>/)[0]);assert.equal(decodeURIComponent(button['data-an']),id);
 const dateAttrs=attrs(p.el('asisFechas').innerHTML.match(/<button[^>]+>/)[0]);assert.equal(dateAttrs['data-af'],date);
 p.el('asisLista').onclick({target:{closest:()=>({dataset:{an:button['data-an'],av:'P'}})}});
 assert.equal(marks.length,readonly?0:1);if(!readonly)assert.deepEqual(marks[0],{n:id,m:'P'});assert.equal(rec.ts,123);
});
test('CNEB competence/capability options encode text and values, keeping the exact selected strings',()=>{
 const p=page('registro.html',['escapeRegistro','fillComps','fillCaps'],{competenciasParaEvaluar:()=>[sample],competencias:()=>[sample],esCompetenciaTransversal:()=>false,competenciaTrabajada:()=>true,capsOficiales:()=>[sample]});
 p.el('selComp').value=sample;p.c.fillComps();for(const id of ['selComp','selCap']){safe(p.el(id).innerHTML);const opts=[...p.el(id).innerHTML.matchAll(/<option[^>]+>/g)].map(m=>attrs(m[0]));assert.ok(opts.some(a=>a.value===sample));}
 assert.match(p.el('selCap').innerHTML,/__otra__/);
});
test('Calificar renders student names and session competence/capability text safely',()=>{
 const p=page('registro.html',['escapeRegistro','renderStudents'],{estudiantes:()=>[{nombre:sample}],colsCalificar:()=>[{comp:sample,cap:sample}],bimCerradoDocente:()=>false,competenciaTrabajada:()=>true,capKeyHoy:()=> 'synthetic-key',studentKey:()=>sample,
 store:{grades:{}},leerNota:()=>({}),modoCalif:'letra',actualizarContadores(){},sincronizarEdicionRegistro(){}});
 p.el('inpFecha').value='2026-10-11';p.c.renderStudents();safe(p.el('stuList').innerHTML);assert.ok((p.el('stuList').innerHTML.match(/&lt;synthetic/g)||[]).length>=3);
});
test('Session dates are literal text and date dataset handlers retain the exact original value',()=>{
 const context={nivel:'secundaria',grado:1,seccion:'A',bim:'III',area:'Matemática'},opened=[],deleted=[];
 const p=page('registro.html',['escapeRegistro','renderSesiones'],{ctxBase:()=>context,store:{sessions:[{...context,fecha:sample,ts:123}]},sesionActiva:null,
 abrirSesionFecha:f=>opened.push(f),borrarSesionFecha:f=>deleted.push(f),sincronizarEdicionRegistro(){}});
 p.c.renderSesiones();safe(p.el('listaSesiones').innerHTML);
 const buttons=[...p.el('listaSesiones').innerHTML.matchAll(/<button[^>]+>/g)].map(m=>attrs(m[0]));
 assert.equal(buttons[0]['data-fecha'],sample);assert.equal(buttons[1]['data-delfecha'],sample);
 for(const [index,selector] of [[0,'button[data-fecha]'],[1,'button[data-delfecha]']]){
  const button={dataset:index?{delfecha:buttons[1]['data-delfecha']}:{fecha:buttons[0]['data-fecha']}};
  p.el('listaSesiones').onclick({target:{closest:s=>s===selector?button:null}});
 }
 assert.deepEqual(opened,[sample]);assert.deepEqual(deleted,[sample]);
});
test('Area labels escape text while the URI dataset preserves area identity',()=>{
 const value='<synthetic> & "ñ"',p=page('registro.html',['escapeRegistro','renderAreas'],{areas:()=>[value],areaActual:value,nivel:'primaria',getLoginSession:()=>null});
 p.el('registroTutorPanel').hidden=true;p.c.renderAreas();safe(p.el('areaBtns').innerHTML,value);
 assert.equal(decodeURIComponent(attrs(p.el('areaBtns').innerHTML)['data-a']),value);
});
test('Promedios readonly handlers do not create academic writes',()=>{
 const p=finals('letra');p.c.registroSoloLectura=()=>true;let handler;
 const button={disabled:false,dataset:{val:'B'},addEventListener:(ev,fn)=>handler=fn};
 p.el('finLista').querySelectorAll=s=>s==='.fin-cell button[data-val]'?[button]:[];p.c.renderFinales();handler.call(button);
 assert.equal(p.writes.length,0);assert.deepEqual(p.store.finales,{});assert.doesNotMatch(p.el('finLista').innerHTML,/data-quitar-directo/);
});
