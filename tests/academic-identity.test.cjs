// Synthetic records only. No production transport, credentials or student data.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const identity=require('../academic-identity.js'),reconcile=require('../registro-reconcile.js');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8'),copy=reconcile.copy;
const roster=[{nivel:'secundaria',grado:1,seccion:'A',idSiagie:'fake-1',codigoEstudiante:'fake-code',nombre:'Estudiante Ficticio Uno'}];
const context={nivel:'secundaria',bim:'III',grado:1,seccion:'A',area:'Comunicación'},comp='Se comunica oralmente en su lengua materna',comps=[comp],prefix=Object.values(context).join('||')+'||'+comp+'||';
const id=prefix+'id:fake-1',code=prefix+'cod:fake-code',name=prefix+roster[0].nombre,note=n=>({nivel:n===15?'A':'B',nota20:n,origen:'numero',ts:n});
const c=vm.createContext({window:{IEAcademicIdentity:identity}});vm.runInContext(read('registro-reconcile.js'),c);const api=c.window.IERegistroReconcile;
test('shared browser/backend identity factory has exact parity',()=>assert.equal(read('academic-identity.js'),read('apps-script/AcademicIdentity.js')));
test('verified ID, code and official current name collapse into one active record, without mutating originals',()=>{
 const original={finales:{[id]:note(15),[code]:note(15),[name]:note(15)},asistencia:{fake:{marca:'P'}},concArea:{fake:{texto:'Histórico'}}},before=copy(original);
 const out=identity.project(original,roster,context,comps);assert.equal(out.conflicts.length,0);assert.deepEqual(out.payload.finales,{[id]:note(15)});assert.deepEqual(original,before);assert.deepEqual(out.payload.asistencia,before.asistencia);assert.deepEqual(out.payload.concArea,before.concArea);
});
test('untrusted aliases, unknown IDs, homonyms and other contexts never grant identity equivalence',()=>{
 const payload={finales:{[prefix+'Nombre anterior no verificado']:note(15),[prefix+'id:unverified']:note(12)},meta:{studentAliases:{'id:fake-1':['Nombre anterior no verificado']}}};
 const out=identity.project(payload,roster,context,comps);assert.deepEqual(out.payload,payload);assert.equal(out.unresolved.length,2);
 const duplicate=[...roster,{...roster[0],idSiagie:'fake-2',codigoEstudiante:'other-code'}];assert.equal(identity.resolver(duplicate,context,comps).canonical('finales',name),null);assert.equal(identity.resolver(roster,{...context,bim:'II'},comps).canonical('finales',id),null);
});
test('explicit competence equivalence only: no positional or fuzzy competence mapping',()=>{
 const cp='Construye su identidad',ctx={...context,area:'Desarrollo Personal, Ciudadanía y Cívica'},p=Object.values(ctx).join('||')+'||';
 const out=identity.project({finales:{[p+'Construye su Identidad||cod:fake-code']:note(15)}},roster,ctx,[cp]);assert.deepEqual(Object.keys(out.payload.finales),[p+cp+'||id:fake-1']);
 assert.equal(identity.resolver(roster,ctx,[cp]).canonical('finales',p+'C1||id:fake-1'),null);
});
test('contradictory historical grades need explicit candidate review, never timestamp/key priority',()=>{
 const remote={finales:{[id]:note(15),[name]:{...note(12),ts:9999999999999}}},before=copy(remote),plan=api.academicPlan(null,{},remote,roster,context,comps);
 assert.equal(plan.conflicts.length,1);const conflict=plan.conflicts[0];assert.equal(conflict.candidates.length,2);assert.throws(()=>plan.resolve(),/identidades/);
 for(const candidate of conflict.candidates){const out=plan.resolve({[conflict.path]:candidate.id});assert.deepEqual(copy(out.finales),{[id]:copy(candidate.value)});}assert.deepEqual(remote,before);
});
test('causal edit of one known representation establishes vigency, not ts',()=>{
 const base={finales:{[id]:note(15),[name]:note(15)}},next=copy(base);next.finales[id]=note(12);
 assert.deepEqual(identity.project(next,roster,context,comps,base).payload.finales,{[id]:note(12)});
 assert.equal(identity.project(next,roster,context,comps).conflicts.length,1);
});
test('clean older PC refreshes without false key conflicts; pending/concurrent edits still require decisions',()=>{
 const base={finales:{[name]:note(15)}},local=copy(base),remote={finales:{[id]:note(12)}};
 assert.deepEqual(copy(api.academicPlan(base,local,remote,roster,context,comps).resolve().finales),remote.finales);
 local.finales[name]={...note(15),nota20:18,nivel:'AD'};const plan=api.academicPlan(base,local,remote,roster,context,comps);assert.equal(plan.conflicts.length,1);assert.throws(()=>plan.resolve(),/sin resolver/);assert.equal(local.finales[name].nota20,18);
});
test('clean identity refresh never bypasses shared attendance decisions',()=>{
 const base={finales:{[name]:note(15)},asistencia:{fake:{marca:'P',ts:1}}},local=copy(base),remote={finales:{[id]:note(12)},asistencia:{fake:{marca:'F',ts:2}}};
 const plan=api.academicPlan(base,local,remote,roster,context,comps,{sharedAttendance:true,cleanAcademic:true});assert.equal(plan.conflicts.length,1);assert.match(plan.conflicts[0].reason,/Asistencia/);
});
test('identity deletion tombstone never revives historical evidence or removes conclusions',()=>{
 const base={grades:{[prefix+'Capacidad||2026-10-12||id:fake-1']:note(15)},finales:{[id]:note(15),[name]:note(15)},concComp:{[id]:{texto:'Conclusión ficticia'}}},local=copy(base);local.finales[id]={borrado:true,ts:1};
 const plan=api.academicPlan(base,local,base,roster,context,comps);const out=plan.resolve();assert.equal(out.finales[id].borrado,true);assert.deepEqual(copy(out.grades),base.grades);assert.deepEqual(copy(out.concComp),base.concComp);
});
test('dry-run is reversible, idempotent and rejects changed or ambiguous inputs; no IO',()=>{
 const original={finales:{[name]:note(15),[code]:note(15)}};const proposal=identity.dryRun(original,roster,context,comps),out=identity.simulate(proposal,original);
 assert.deepEqual(identity.simulate(proposal,out),out);assert.deepEqual(identity.reverse(proposal,out),original);assert.deepEqual(identity.dryRun(out,roster,context,comps).proposed,out);assert.throws(()=>identity.simulate(proposal,{}),/modificada/);assert.throws(()=>identity.reverse(proposal,{}),/cambió/);
 assert.equal(identity.dryRun({finales:{[id]:note(15),[name]:note(12)}},roster,context,comps).proposed,null);
});
test('same letter is not evidence that numeric 14/15 or letter/numeric modes are equivalent',()=>{
 for(const other of [{nivel:'A',nota20:14,origen:'numero'},{nivel:'A',nota20:15,origen:'letra'}])assert.equal(identity.project({finales:{[id]:note(15),[code]:other}},roster,context,comps).conflicts.length,1);
});
test('reused code and an old owner of the same name veto a join instead of assigning notes arbitrarily',()=>{
 const extra={...roster[0],idSiagie:'fake-2',nombre:'Otra Persona Ficticia'},resolve=identity.resolver([...roster,extra],context,comps);assert.equal(resolve.canonical('finales',code),null);
 const p={finales:{[name]:note(15)},meta:{studentAliases:{'id:removed':['Estudiante Ficticio Uno']}}};assert.equal(identity.project(p,roster,context,comps).unresolved.length,1);assert.deepEqual(identity.project(p,roster,context,comps).payload,p);
});
test('evidence sessions and competence state use the same explicit competence equivalence as notes',()=>{
 const ctx={...context,area:'Desarrollo Personal, Ciudadanía y Cívica'},oldComp='Construye su Identidad',cp='Construye su identidad',p=Object.values(ctx).join('||')+'||',payload={sessions:[{...ctx,comp:oldComp,capacidad:'Capacidad ficticia',fecha:'2026-10-12'}],grades:{[p+oldComp+'||Capacidad ficticia||2026-10-12||cod:fake-code']:note(15)},competenciasEstado:{[p+oldComp]:{trabajada:false}}};
 const out=identity.project(payload,roster,ctx,[cp]).payload;assert.equal(out.sessions[0].comp,cp);assert.equal(out.grades[p+cp+'||Capacidad ficticia||2026-10-12||id:fake-1'].nota20,15);assert.equal(out.competenciasEstado[p+cp].trabajada,false);assert.equal(payload.sessions[0].comp,oldComp);
});
test('a changed original history under the same version is not an authorized replacement',()=>{
 const payload={finales:{[id]:note(15)},meta:{academicHistory:[{version:1,originals:{}}]}},changed=copy(payload);changed.meta.academicHistory=[];
 assert.throws(()=>reconcile.validateRemote({version:2,payload:changed,exists:true},{version:2,basePayload:payload}),e=>e.code==='READ_VERSION');
});
