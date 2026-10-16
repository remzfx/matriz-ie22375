// Focused diagnostic: all identities/records/storage are fictitious, no transport.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const identity=require('../academic-identity.js'),api=require('../registro-reconcile.js'),copy=api.copy;
const context={nivel:'secundaria',bim:'III',grado:1,seccion:'A',area:'Área ficticia'},comp='Competencia ficticia',roster=[{...context,idSiagie:'fake-1',codigoEstudiante:'fake-code',nombre:'Estudiante Ficticio',orden:1}],prefix=Object.values(context).join('||')+'||'+comp+'||',id=prefix+'id:fake-1',old=prefix+'Estudiante Ficticio';
const box=vm.createContext({window:{IEAcademicIdentity:identity}});vm.runInContext(fs.readFileSync('registro-reconcile.js','utf8'),box);const client=box.window.IERegistroReconcile;
const conflict=(a,b)=>({path:JSON.stringify(['finales',id]),local:a,remote:b});

test('Explanations change only the view and one modal paragraph; equality, projection, A1, CAS and originals remain exact',()=>{
 const current=fs.readFileSync('registro-reconcile.js','utf8').replace(/\r\n/g,'\n'),old=require('./reconciliation-ui-boundary.cjs')(current);
 assert.equal(current.split('  function conflictView(')[0],old.split('  function conflictView(')[0]);
 const start=current.indexOf('    const alternatives=c.candidates?'),end=current.indexOf('\n  }\n  function choose(',start);
 const normalized=current.slice(0,start)+'    return {title,local:value(c.local),remote:value(c.remote)};'+current.slice(end);
 const paragraph="        const explanation=document.createElement('p');explanation.className='academic-conflict-explanation';explanation.textContent=view.explanation;field.appendChild(explanation);\n";
 const labelFix="normalize(al.nombre)===normalize(decode(tail.replace(/^nom:/,'')))",oldLabel="[al.nombre,...(context.aliases&&context.aliases[id]||[])].some(n=>normalize(n)===normalize(decode(tail.replace(/^nom:/,''))))";
 assert.equal(normalized.replace(paragraph,'').replace(labelFix,oldLabel),old);assert.equal(fs.readFileSync('academic-identity.js','utf8'),fs.readFileSync('apps-script/AcademicIdentity.js','utf8'));
});

test('Verified identical letter grades with different reference numbers/timestamps collapse safely; originals remain untouched',()=>{
 const raw={finales:{[id]:{nivel:'A',nota20:14,origen:'letra',ts:1},[old]:{nivel:'A',nota20:15,origen:'letra',ts:999,_ts:8,registroVersion:3}}},before=copy(raw);
 const p=client.academicPlan(null,{},raw,roster,context,[comp]);assert.equal(p.conflicts.length,0);assert.equal(Object.keys(p.resolve().finales).length,1);assert.deepEqual(raw,before);
 const numeric={finales:{[id]:{nivel:'A',nota20:15,origen:'numero'},[old]:{nivel:'A',nota20:15,origen:'numero',ts:99}}};assert.equal(identity.project(numeric,roster,context,[comp]).conflicts.length,0);
});

test('Same A with exact 14/15 remains a real review; explanation identifies exact numeric difference',()=>{
 const a={nivel:'A',nota20:14,origen:'numero'},b={nivel:'A',nota20:15,origen:'numero'},raw={finales:{[id]:a,[old]:b}},p=client.academicPlan(null,{},raw,roster,context,[comp]);assert.equal(p.conflicts.length,1);assert.throws(()=>p.resolve());
 const view=api.conflictView(conflict(a,b),{roster});assert.match(view.local,/Nota: 14/);assert.match(view.remote,/Nota: 15/);assert.match(view.explanation,/nota exacta de 0–20/);assert.match(view.explanation,/14.*15/);
});

test('Same A and same displayed number with different origins keeps the explicit Letras versus numeric decision',()=>{
 const a={nivel:'A',nota20:15,origen:'letra'},b={nivel:'A',nota20:15,origen:'numero'};assert.equal(identity.project({finales:{[id]:a,[old]:b}},roster,context,[comp]).conflicts.length,1);
 assert.match(api.conflictView(conflict(a,b),{roster}).explanation,/origen de la nota.*Letras, Numérica/);
});

test('Reproduction: identical visible grades conceal an additional field; UI names it without inventing academic equivalence',()=>{
 const a={nivel:'A',nota20:15,origen:'numero'},b={...a,revisionFicticia:'por verificar'},view=api.conflictView(conflict(a,b),{roster});
 assert.equal(view.local,view.remote);assert.equal(api.equal(a,b),false);assert.match(view.explanation,/campo adicional «revisionFicticia»/);assert.match(view.explanation,/se ven iguales.*detalles técnicos/);
 const typed=api.conflictView(conflict(a,{...a,nota20:'15'}),{roster});assert.equal(typed.local,typed.remote);assert.match(typed.explanation,/valor y tipo/);
});

test('Deletion and unverified student identity are never hidden or inferred from identical visible levels',()=>{
 const a={nivel:'A',nota20:15,origen:'numero'},b={borrado:true},view=api.conflictView(conflict(a,b),{roster});assert.equal(view.remote,'Eliminado');assert.match(view.explanation,/estado de borrado/);
 const unknown=prefix+'Nombre histórico sin verificar',raw={finales:{[id]:a,[unknown]:a},meta:{studentAliases:{'id:fake-1':['Nombre histórico sin verificar']}}};const p=identity.project(raw,roster,context,[comp]);assert.equal(p.unresolved.length,1);assert.ok(p.payload.finales[unknown]);
 const unknownView=api.conflictView({path:JSON.stringify(['finales',unknown]),local:a,remote:a},{roster,aliases:raw.meta.studentAliases});assert.match(unknownView.explanation,/identidad no está verificada/);assert.doesNotMatch(unknownView.title,/Estudiante Ficticio/);
});

test('Old unowned local storage is independent of cloud historical keys; it is not auto-adopted or deleted',()=>{
 const {create}=require('../registro-local-store.js'),legacyKey='ie22375_registro_notas_v2',raw=JSON.stringify({finales:{fictitious:{nivel:'C'}}}),memory=new Map([[legacyKey,raw]]);let writes=0;
 const local=create({getItem:k=>memory.get(k)||null,setItem:(k,v)=>{writes++;memory.set(k,v);}},()=>({role:'docente',user:'fake-teacher'}));assert.equal(local.hasLegacy(),true);assert.equal(local.read(),null);assert.throws(()=>local.legacy(),/Solo Admin/);assert.equal(memory.get(legacyKey),raw);assert.equal(writes,0);
});

test('Clean new PC automatically reads confirmed equivalent historical letters without conflict, pending changes or uploads',async()=>{
 const path=require('node:path'),{session,cloud}=new Function('require','__dirname',fs.readFileSync(path.join(__dirname,'a1-diagnostic-sessions.test.cjs'),'utf8').split('\ntest(')[0]+'\nreturn {session,cloud};')(require,__dirname),r=cloud(),f=session(r);
 r.payload=copy(f.c.sliceRegistroArea());const legacy=f.key.slice(0,f.key.lastIndexOf('||')+2)+f.roster[0].nombre;r.payload.finales={[f.key]:{nivel:'A',nota20:14,origen:'letra',ts:1},[legacy]:{nivel:'A',nota20:15,origen:'letra',ts:2}};const before=copy(r.payload);
 for(let i=0;i<2;i++)assert.equal(await f.c.bajarRegistroNube({automatico:true}),true);
 assert.equal(f.choices.length,0);assert.equal(f.c.dirty,false);assert.equal(r.writes,0);assert.equal(Object.keys(f.c.store.finales).length,1);assert.deepEqual(copy(f.c.baselineAcademica().basePayload),before);assert.deepEqual(r.payload,before);
});
