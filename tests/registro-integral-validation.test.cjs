const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const setup=new Function('require','__dirname',read('tests/backend-write-auth.test.cjs').split('\nfor (const action')[0]+'\nreturn setup;')(require,__dirname);
function fixture(level='primaria'){
 const s=setup(),seccion=level==='primaria'?'Única':'A',area=level==='primaria'?'Comunicación':'Matemática';
 s.c.Utilities.getUuid=()=> 'synthetic-private-roster';
 const alumno={nivel:level,grado:1,seccion,orden:1,nombre:'Synthetic Student',idSiagie:'synthetic'};
 s.c.escribirVersionEstudiantes_(s.c.hojaEstudiantes_(),[alumno],['BASE_ACTUAL']);
 const c={nivel:level,bim:'I',grado:1,seccion,area},core=s.c.registroAcademico_(),comps=core.catalog[level][area],key=cp=>core.key(c,cp,'id:synthetic');
 const payload={finales:Object.fromEntries(comps.map(cp=>[key(cp),{nota20:15,nivel:'A',origen:'numero'}])),concComp:{},competenciasEstado:{}};
 const req={action:'savereg',token:level==='primaria'?s.primary:s.secondary,nivel:level,bimestre:'I',grado:1,seccion,area,modeloAcademico:1,version:0,envioIntegral:true,payload};
 return {s,c,core,comps,key,payload,req,send:()=>s.post(req)};
}
test('Registro has no visible historical B/average conclusion rule or obsolete daily modal',()=>{
 const html=read('registro.html'),visible=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ');
 assert.doesNotMatch(visible,/primaria\s*:?[\s]*B\s*o\s*C|en primaria también si es B|conclusión\s*(?:del|por)\s*promedio|si el promedio es/i);
 assert.match(visible,/obligatoria únicamente cuando una competencia tiene nivel C/);
 for(const symbol of ['requiereConclusion','modalConc','modalCtx','cerrarModal','.av-conc','function concAreaKey'])assert.ok(!html.includes(symbol),symbol);
 for(const name of ['recolectarPantalla','renderAvance','setConclusionAcademica']){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);assert.doesNotMatch(html.slice(start,end),/store\.concArea\s*\[[^\]]+\]\s*=/);}
 assert.match(html,/concArea/); // Historical loading/merge remains supported.
 assert.match(html,/envioIntegral: true/);
});
test('backend declares exactly one shared academic implementation',()=>assert.equal((read('apps-script/Codigo.js').match(/function registroAcademico_\s*\(/g)||[]).length,1));
test('client and backend catalog, canonical, worked, conclusion and validation have behavioral parity',()=>{
 const c=vm.createContext({window:{}});vm.runInContext(read('registro-academic-model.js'),c);
 const client=c.window.IERegistroAcademico,server=setup().c.registroAcademico_();
 assert.equal(JSON.stringify(client.catalog),JSON.stringify(server.catalog));
 for(const level of ['primaria','secundaria']){
  const ctx={nivel:level,bim:'III',grado:2,seccion:'A',area:'Matemática'},cp=client.catalog[level]['Matemática'][0],k=client.key(ctx,cp,'id:1');
  for(const original of [{},{finales:{[k]:{origen:'letra',nivel:'B',nota20:12,ts:99}}},{finales:{[k]:{origen:'numero',nivel:'A',nota20:14,ts:1}},concArea:{old:{texto:'history'}}},{competenciasEstado:{[client.key(ctx,cp)]:{trabajada:false,ts:8}},concComp:{[k]:{texto:' Text\r\nline ',ts:6}},meta:{studentAliases:{'id:1':['Previous Name']}}},{finales:{[k]:{borrado:true,ts:7}},concComp:{[k]:{texto:'',borrado:true}}}]){
   const a=JSON.parse(JSON.stringify(original)),b=JSON.parse(JSON.stringify(original));client.validate(a,ctx);server.validate(b,ctx);
   assert.equal(client.canonical(a),server.canonical(b));assert.equal(client.worked(a,ctx,cp),server.worked(b,ctx,cp));assert.equal(client.conclusion(a,ctx,cp,'id:1'),server.conclusion(b,ctx,cp,'id:1'));
  }
  const invalid={competenciasEstado:{[k]:{trabajada:false}}};assert.throws(()=>client.validate(invalid,ctx));assert.throws(()=>server.validate(invalid,ctx));
 }
});
for(const level of ['primaria','secundaria']){
 test(level+': active incomplete integral is rejected without record writes',()=>{const f=fixture(level);delete f.payload.finales[f.key(f.comps[0])];const before=f.s.state.writes;const out=f.send();assert.equal(out.ok,false);assert.match(out.error,/falta resultado/);assert.equal(f.s.state.writes,before);});
 test(level+': active C requires its own conclusion, never concArea',()=>{const f=fixture(level),k=f.key(f.comps[0]);f.payload.finales[k]={nota20:8,nivel:'C'};f.payload.concArea={old:{texto:'Not official'}};const out=f.send();assert.equal(out.ok,false);assert.match(out.error,/conclusión específica/);f.payload.concComp[k]={texto:'Own competence conclusion'};assert.equal(f.send().ok,true);});
 test(level+': B needs no conclusion and accepts official integral',()=>{const f=fixture(level);f.payload.finales[f.key(f.comps[0])]={nota20:12,nivel:'B'};assert.equal(f.send().ok,true);});
 test(level+': inactive empty competence is accepted',()=>{const f=fixture(level);delete f.payload.finales[f.key(f.comps[0])];f.payload.competenciasEstado[f.core.key(f.c,f.comps[0])]={trabajada:false};assert.equal(f.send().ok,true);});
 test(level+': referential average neither completes nor blocks official competence results',()=>{const f=fixture(level);f.payload.promedioReferencial={nivel:'C'};assert.equal(f.send().ok,true);const g=fixture(level);delete g.payload.finales[g.key(g.comps[0])];g.payload.promedioReferencial={nivel:'AD',nota20:20};assert.equal(g.send().ok,false);});
 test(level+': evidence is a valid effective result and a direct takes precedence',()=>{const f=fixture(level),cp=f.comps[0],prefix=f.core.prefix(f.c)+cp;delete f.payload.finales[f.key(cp)];f.payload.sessions=[{...f.c,comp:cp,capacidad:'Synthetic capacity',fecha:'2026-10-07'}];f.payload.grades={[prefix+'||Synthetic capacity||2026-10-07||id:synthetic']:{nota20:8,nivel:'C'}};assert.equal(f.send().ok,false);f.payload.finales[f.key(cp)]={nota20:15,nivel:'A'};assert.equal(f.send().ok,true);});
}
test('integral uses private selected-bimester roster instead of client student list',()=>{const f=fixture();f.s.c.Utilities.getUuid=()=> 'synthetic-frozen-roster';f.s.c.escribirVersionEstudiantes_(f.s.c.hojaEstudiantes_(),[{nivel:'primaria',grado:1,seccion:'Única',nombre:'Other Synthetic',orden:1,idSiagie:'other'}],['PADRON_I']);f.payload.estudiantes=[{idSiagie:'synthetic'}];assert.equal(f.send().ok,false);});
test('explicit partial synchronization remains compatible with incomplete drafts',()=>{const f=fixture();f.req.envioIntegral=false;f.payload.finales={};assert.equal(f.send().ok,true);});
test('unchanged incomplete draft cannot bypass later integral validation',()=>{const f=fixture();f.req.envioIntegral=false;f.payload.finales={};const out=f.send();assert.equal(out.ok,true);f.req.version=out.version;f.req.envioIntegral=true;assert.equal(f.send().ok,false);});
test('integral preserves historical name-key grade/conclusion compatibility',()=>{const f=fixture(),cp=f.comps[0];delete f.payload.finales[f.key(cp)];const k=f.core.prefix(f.c)+cp+'||Synthetic Student';f.payload.finales[k]={nivel:'C',nota20:8};f.payload.concComp[k]={texto:'Own historical competence conclusion'};assert.equal(f.send().ok,true);});
test('integral never accepts foreign context or revoked teacher authority',()=>{for(const kind of ['foreign','revoked']){const f=fixture();if(kind==='foreign')f.req.grado=2;else f.req.token=f.s.token('test-primary','docente',{permisosVersion:999});const before=f.s.state.writes;assert.equal(f.send().ok,false);assert.equal(f.s.state.writes,before);}});
test('empty legacy direct falls back to valid evidence instead of rejecting a complete integral',()=>{const f=fixture(),cp=f.comps[0];f.payload.finales[f.key(cp)]={nivel:'',nota20:''};f.payload.sessions=[{...f.c,comp:cp,capacidad:'Cap',fecha:'2026-10-07'}];f.payload.grades={[f.core.prefix(f.c)+cp+'||Cap||2026-10-07||id:synthetic']:{nivel:'B',nota20:12}};assert.equal(f.send().ok,true);});
test('stable-id tombstone does not revive a historical name direct',()=>{const f=fixture(),cp=f.comps[0];f.payload.finales[f.key(cp)]={borrado:true};f.payload.finales[f.core.prefix(f.c)+cp+'||Synthetic Student']={nivel:'A'};assert.equal(f.send().ok,false);});
test('corrected student name still reads historical alias note and own conclusion',()=>{const f=fixture(),cp=f.comps[0],k=f.core.prefix(f.c)+cp+'||Previous Synthetic Name';delete f.payload.finales[f.key(cp)];f.payload.meta={studentAliases:{'id:synthetic':['Previous Synthetic Name']}};f.payload.finales[k]={nivel:'C'};f.payload.concComp[k]={texto:'Historical own conclusion'};assert.equal(f.send().ok,true);});
test('code identity fallback remains supported when the private roster has no SIAGIE ID',()=>{const f=fixture();f.s.c.Utilities.getUuid=()=> 'synthetic-code-roster';f.s.c.escribirVersionEstudiantes_(f.s.c.hojaEstudiantes_(),[{nivel:'primaria',grado:1,seccion:'Única',orden:1,nombre:'Synthetic Student',codigoEstudiante:'CODE'}],['BASE_ACTUAL']);f.payload.finales=Object.fromEntries(f.comps.map(cp=>[f.core.prefix(f.c)+cp+'||cod:CODE',{nivel:'A'}]));assert.equal(f.send().ok,true);});
test('integral validates every private-roster student, including an omitted second student',()=>{const f=fixture();f.s.c.Utilities.getUuid=()=> 'synthetic-two-students';f.s.c.escribirVersionEstudiantes_(f.s.c.hojaEstudiantes_(),[{nivel:'primaria',grado:1,seccion:'Única',orden:1,nombre:'Synthetic Student',idSiagie:'synthetic'},{nivel:'primaria',grado:1,seccion:'Única',orden:2,nombre:'Second Synthetic',idSiagie:'second'}],['BASE_ACTUAL']);assert.equal(f.send().ok,false);});
test('closed bimestre remains readonly before integral validation or writes',()=>{const f=fixture();f.req.bimestre='II';const before=f.s.state.writes;const out=f.send();assert.equal(out.ok,false);assert.equal(out.readonly,true);assert.equal(f.s.state.writes,before);});
