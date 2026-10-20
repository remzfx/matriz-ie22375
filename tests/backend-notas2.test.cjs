'use strict';
// Production doPost, authorization, identity and protocol; all Sheets/services are synthetic.
// No frontend modules, network, browser profile or production credentials are used.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const copy=v=>JSON.parse(JSON.stringify(v));
// Reuse the established backend service fixture without registering its other tests.
const setup=new Function('require','__dirname',read('tests/backend-write-auth.test.cjs').split('\nfor (const action')[0]+'\nreturn setup;')(require,__dirname);
const fields={calificar:['sessions','grades','capsSel','calificarEstado'],promedios:['finales','concComp','competenciasEstado'],asistencia:['asistencia','asisFechas','asisFechasEstado']};
const empty=panel=>Object.fromEntries(fields[panel].map(f=>[f,f==='sessions'?[]:{}]));
const grade=(nota20=15,nivel='A')=>({nota20,nivel,origen:'numero',ts:1});
function fixture(secondary=false){
 const s=setup();vm.runInContext(read('apps-script/Notas2.js'),s.c);
 const context=secondary?{nivel:'secundaria',bimestre:'I',grado:1,seccion:'A',area:'Matemática'}:{nivel:'primaria',bimestre:'I',grado:1,seccion:'Única',area:'Comunicación'};
 const key=[context.nivel,context.bimestre,context.grado,context.seccion,context.area].join('||');
 const comp=s.c.registroAcademico_().catalog[context.nivel][context.area][0],id='id:synthetic-1',fk=key+'||'+comp+'||'+id;
 const roster=[{nivel:context.nivel,grado:1,seccion:context.seccion,idSiagie:'synthetic-1',codigoEstudiante:'SYN001',nombre:'ESTUDIANTE FICTICIO'}];
 s.tables.set('EstudiantesBase',{});s.c.leerPadronEstudiantes_=()=>({estudiantes:copy(roster)});
 const request=(action,extra={})=>s.post(s.body(action,{...context,token:secondary?s.secondary:s.primary,...extra}));
 const row=()=>s.tables.get('RegistroNotas').rows.find(r=>r[0]===key);
 const payload=()=>JSON.parse(row()[8]);
 const seed=(p,version=10)=>s.tables.get('RegistroNotas').rows.push([key,context.nivel,'I',1,context.seccion,context.area,'DOCENTE FICTICIO',version,JSON.stringify(p)]);
 const averages=(value=grade())=>({...empty('promedios'),finales:{[fk]:value}});
 const evidence=()=>({...empty('calificar'),sessions:[{nivel:context.nivel,bim:'I',grado:1,seccion:context.seccion,area:context.area,comp,capacidad:'Capacidad ficticia',fecha:'2026-10-01'}],grades:{[key+'||'+comp+'||Capacidad ficticia||2026-10-01||'+id]:grade()},capsSel:{[key+'||2026-10-01']:[{comp,cap:'Capacidad ficticia'}]},calificarEstado:{[key+'||'+comp]:{trabajada:true,ts:1}}});
 const save=(panel,p,version=0,extra={})=>request('savenotas2',{panel,payload:p,version,...extra});
 const unchanged=(fn)=>{const before=JSON.stringify(s.tables.get('RegistroNotas').rows),writes=s.state.writes;const result=fn();assert.equal(JSON.stringify(s.tables.get('RegistroNotas').rows),before);assert.equal(s.state.writes,writes);assert.equal(s.state.held,false);return result;};
 return {...s,context,key,comp,id,fk,roster,request,row,payload,seed,averages,evidence,save,unchanged};
}

test('N2-G.18A source is the reviewed protocol and exactly the three approved dispatch/read/legacy hooks',()=>{
 const approved='857011a45287682f289ffad2c1bf946bc1dfee23';
 for(const file of ['apps-script/Notas2.js','apps-script/Codigo.js'])assert.equal(read(file).replace(/\r\n/g,'\n'),execFileSync('git',['show',approved+':'+file],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'));
});

test('historical boundary permits exactly three hooks, preserves all unrelated bytes and rejects partial/duplicate hooks',()=>{
 const strip=require('./notas2-backend-boundary.cjs'),raw=read('apps-script/Codigo.js').replace(/\r\n/g,'\n');
 const before=execFileSync('git',['show','cd03df0fb651fd6cfd10a94f9a0dbfe8900f0e30:apps-script/Codigo.js'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
 assert.equal(strip(raw),before);assert.equal(strip(before),before);
 const dispatch="    if (['loadnotas2','savenotas2'].includes(action)) return responder_(notas2Ruta_(body));\n";
 assert.throws(()=>strip(raw.replace(dispatch,'')));assert.throws(()=>strip(raw+dispatch));
 const changed=raw.replace("if (sesion.role !== 'docente') return null;","if (sesion.role !== 'docente') return {}; // synthetic mutation");
 assert.notEqual(changed,raw);assert.notEqual(strip(changed),before,'An unrelated authorization mutation must still fail historical equality');
});

test('read of a new context returns every panel and zero writes, adoption or new rows',()=>{
 const s=fixture(),r=s.unchanged(()=>s.request('loadnotas2'));
 assert.equal(r.ok,true);assert.equal(r.notas2,1);assert.equal(r.key,s.key);assert.equal(r.exists,false);assert.equal(r.legacy,false);assert.equal(r.readonly,false);
 assert.deepEqual(r.versions,{calificar:0,promedios:0,asistencia:0});assert.deepEqual(r.at,{calificar:null,promedios:null,asistencia:null});
 for(const [panel,names]of Object.entries(fields))for(const field of names)assert.deepEqual(r.payload[field],empty(panel)[field]);
 assert.equal(s.tables.get('RegistroNotas').rows.length,1);
});

for(const secondary of [false,true])test((secondary?'Secundaria':'Primaria')+': authenticated teacher saves and another read recovers the exact panel',()=>{
 const s=fixture(secondary),r=s.save('promedios',s.averages());assert.equal(r.ok,true);assert.equal(r.panel,'promedios');assert.ok(r.versions.promedios>0);assert.ok(Number.isFinite(r.at.promedios));
 const loaded=s.unchanged(()=>s.request('loadnotas2'));assert.equal(loaded.payload.finales[s.fk].nivel,'A');assert.equal(loaded.versions.promedios,r.versions.promedios);
 assert.equal(s.row()[6],secondary?'Test Secondary':'Test Primary');assert.equal(s.state.held,false);
});

for(const panel of Object.keys(fields))test(panel+': Admin can save using the same scoped protocol',()=>{
 const s=fixture(),p=panel==='calificar'?s.evidence():panel==='promedios'?s.averages():empty(panel);
 assert.equal(s.save(panel,p,0,{token:s.admin,docente:'DOCENTE FICTICIO ASIGNADO'}).ok,true);assert.equal(s.row()[6],'DOCENTE FICTICIO ASIGNADO');
});

for(const action of ['loadnotas2','savenotas2'])for(const kind of ['missing','altered','expired','revoked','wrong-role','unauthorized-grade','unauthorized-area'])test(action+': rejects '+kind+' without writes',()=>{
 const s=fixture();let extra={};
 if(kind==='missing')extra.token='';if(kind==='altered')extra.token=s.primary+'x';
 if(kind==='expired')extra.token=s.token('test-primary','docente',{exp:Date.now()-1000});
 if(kind==='revoked')extra.token=s.token('test-primary','docente',{permisosVersion:999});
 if(kind==='wrong-role')extra.token=s.token('test-primary','auxiliar');
 if(kind==='unauthorized-grade')extra.grado=2;if(kind==='unauthorized-area')extra.area='Educación Física';
 const r=s.unchanged(()=>s.request(action,{panel:'promedios',version:0,payload:s.averages(),...extra}));assert.equal(r.ok,false);assert.equal(r.payload,undefined);
});

for(const changes of [{grado:5,seccion:'ÚNICA',area:'Matemática'},{grado:1,seccion:'A',area:'Ciencia y Tecnología'}])test('Secundaria cannot combine authorized areas and aulas into a forged assignment '+JSON.stringify(changes),()=>{
 const s=fixture(true);for(const action of ['loadnotas2','savenotas2'])assert.equal(s.unchanged(()=>s.request(action,{...changes,panel:'promedios',payload:s.averages(),version:0})).ok,false);
});

for(const bimestre of ['II','III'])test('closed/blocked '+bimestre+' is readable but rejects every panel save',()=>{
 const s=fixture(),r=s.unchanged(()=>s.request('loadnotas2',{bimestre}));assert.equal(r.ok,true);assert.equal(r.readonly,true);
 for(const panel of Object.keys(fields)){const result=s.unchanged(()=>s.save(panel,empty(panel),0,{bimestre}));assert.equal(result.code,'CLOSED');}
});

test('server derives canonical record and teacher; forged body.clave and body.docente cannot choose another row',()=>{
 const s=fixture(),foreign=['foreign','primaria','I',3,'A','Comunicación','OTHER',10,'{}'];s.tables.get('RegistroNotas').rows.push(copy(foreign));
 const r=s.save('promedios',s.averages(),0,{clave:'foreign',docente:'FORGED'});assert.equal(r.ok,true);assert.equal(r.key,s.key);assert.equal(s.payload().meta.docente,'Test Primary');assert.deepEqual(s.tables.get('RegistroNotas').rows[1],foreign);
});

test('same-panel CAS rejects a stale PC and does not overwrite the first confirmed note',()=>{
 const s=fixture(),a=s.request('loadnotas2'),b=s.request('loadnotas2');assert.equal(s.save('promedios',s.averages(),a.versions.promedios).ok,true);
 assert.equal(s.unchanged(()=>s.save('promedios',s.averages(grade(12,'B')),b.versions.promedios)).code,'CONFLICT');assert.equal(s.payload().finales[s.fk].nivel,'A');
});

test('independent panel CAS composes from current row and preserves the other PC changes',()=>{
 const s=fixture(),a=s.request('loadnotas2'),b=s.request('loadnotas2');let writes=0;const sh=s.tables.get('RegistroNotas'),range=sh.getRange;
 sh.getRange=(...args)=>{const r=range(...args),set=r.setValues;r.setValues=v=>{assert.equal(s.state.held,true);writes++;return set(v);};return r;};
 const first=s.save('calificar',s.evidence(),a.versions.calificar);assert.equal(first.ok,true);
 const second=s.save('promedios',s.averages(),b.versions.promedios);assert.equal(second.ok,true);assert.equal(second.versions.calificar,first.versions.calificar);assert.equal(second.at.calificar,first.at.calificar);
 assert.deepEqual(s.payload().grades,s.evidence().grades);assert.deepEqual(s.payload().capsSel,s.evidence().capsSel);assert.equal(s.payload().finales[s.fk].nivel,'A');assert.equal(writes,2);assert.equal(s.state.held,false);
});

for(const version of [undefined,null,-1,0.5,'0'])test('CAS requires an explicit nonnegative integer version '+String(version),()=>{
 const s=fixture(),body={panel:'promedios',payload:s.averages()};if(version!==undefined)body.version=version;
 assert.equal(s.unchanged(()=>s.request('savenotas2',body)).code,'CONFLICT');
});

test('duplicate request with original CAS cannot silently repeat a confirmed write',()=>{
 const s=fixture(),p=s.averages();assert.equal(s.save('promedios',p).ok,true);assert.equal(s.unchanged(()=>s.save('promedios',p)).code,'CONFLICT');assert.equal(s.tables.get('RegistroNotas').rows.length,2);
});

for(const kind of ['other-panel','foreign-area-key','foreign-session','unknown-student','unknown-competence','invalid-grade','incomplete-panel'])test('rejects '+kind+' payload without modifying the current record',()=>{
 const s=fixture();let panel='promedios',p=s.averages();
 if(kind==='other-panel')p.grades={};if(kind==='foreign-area-key')p.finales={'primaria||I||1||Única||OTHER||C||id:synthetic-1':grade()};
 if(kind==='foreign-session'){panel='calificar';p=s.evidence();p.sessions[0].grado=3;}
 if(kind==='unknown-student')p.finales={[s.key+'||'+s.comp+'||id:not-in-roster']:grade()};
 if(kind==='unknown-competence')p.finales={[s.key+'||NOT-CNEB||'+s.id]:grade()};
 if(kind==='invalid-grade')p.finales[s.fk]=grade(21,'A');if(kind==='incomplete-panel')delete p.concComp;
 assert.equal(s.unchanged(()=>s.save(panel,p)).ok,false);
});

test('missing roster, duplicate rows and corrupt JSON fail closed, with no adoption',()=>{
 for(const kind of ['roster','duplicate','corrupt']){
  const s=fixture();if(kind==='roster')s.tables.delete('EstudiantesBase');
  if(kind==='duplicate'){s.seed({});s.seed({});}if(kind==='corrupt'){s.seed({});s.row()[8]='{';}
  for(const action of ['loadnotas2','savenotas2'])assert.equal(s.unchanged(()=>s.request(action,{panel:'promedios',version:10,payload:s.averages()})).ok,false);
 }
});

test('historical identity projection reads verified name aliases without rewriting originals',()=>{
 const s=fixture(),original={finales:{[s.key+'||'+s.comp+'||ESTUDIANTE FICTICIO']:grade()},meta:{academicHistory:[{original:'FICTICIO'}]}};s.seed(original);
 const r=s.unchanged(()=>s.request('loadnotas2'));assert.equal(r.ok,true);assert.equal(r.legacy,true);assert.equal(r.payload.finales[s.fk].nivel,'A');assert.deepEqual(s.payload(),original);assert.equal(s.payload().meta.notas2,undefined);
});

test('ambiguous historical identity values require review instead of selecting a grade',()=>{
 const s=fixture();s.seed({finales:{[s.fk]:grade(),[s.key+'||'+s.comp+'||ESTUDIANTE FICTICIO']:grade(12,'B')}});
 const r=s.unchanged(()=>s.request('loadnotas2'));assert.equal(r.ok,false);assert.equal(r.payload,undefined);
});

test('legacy Calificar cannot be adopted by writing evidence; explicit Promedios save is required',()=>{
 const s=fixture();s.seed(s.evidence());assert.equal(s.unchanged(()=>s.save('calificar',s.evidence(),10)).code,'LEGACY_REVIEW');
 const r=s.save('promedios',s.averages(),10);assert.equal(r.ok,true);assert.equal(r.legacy,false);assert.equal(s.payload().meta.notas2.adopted,true);assert.deepEqual(s.payload().grades,s.evidence().grades);
});

test('attendance-only save on a legacy context preserves non-adopted academic state',()=>{
 const s=fixture();s.seed(s.evidence());const r=s.save('asistencia',empty('asistencia'),10);assert.equal(r.ok,true);assert.equal(r.legacy,true);assert.equal(s.payload().meta.notas2.adopted,false);assert.deepEqual(s.payload().grades,s.evidence().grades);
});

test('academic save preserves attendance, dates, conclusions, historical metadata and unrelated fields',()=>{
 const s=fixture(),aula=[s.context.nivel,'I',1,s.context.seccion].join('||');
 const original={...s.evidence(),asistencia:{[aula+'||2026-10-01||'+s.id]:{marca:'T',ts:123}},asisFechas:{[aula]:['2026-10-01']},asisFechasEstado:{[aula+'||2026-10-01']:{cerrada:true,ts:123}},concComp:{[s.fk]:{texto:'Conclusión ficticia conservada',ts:2}},concArea:{historia:'Conservada'},meta:{academicHistory:[{original:{nivel:'B'}}],studentAliases:{[s.id]:['ESTUDIANTE FICTICIO']}},customHistorical:{kept:true}};
 s.seed(original);const p=s.averages();p.concComp=copy(original.concComp);assert.equal(s.save('promedios',p,10).ok,true);
 for(const f of ['grades','sessions','capsSel','asistencia','asisFechas','asisFechasEstado','concComp','concArea','customHistorical'])assert.deepEqual(s.payload()[f],original[f]);
 assert.deepEqual(s.payload().meta.academicHistory,original.meta.academicHistory);assert.deepEqual(s.payload().meta.studentAliases,original.meta.studentAliases);assert.equal(s.tables.has('RegistroHistorialAcademico'),false);
});

test('loadreg exposes only authorized calificarEstado after a Notas 2 confirmation',()=>{
 const s=fixture();assert.equal(s.save('calificar',s.evidence()).ok,true);const r=s.unchanged(()=>s.request('loadreg'));assert.equal(r.ok,true);assert.deepEqual(r.items[0].payload.calificarEstado,s.evidence().calificarEstado);
 const c=s.c.contextoEscritura_(s.body('loadreg'),true),foreign='primaria||I||1||Única||OTHER||C';
 const scoped=s.c.payloadRegistroLectura_({calificarEstado:{...s.evidence().calificarEstado,[foreign]:{trabajada:false}}},{sesion:{role:'docente'}},c);assert.deepEqual(Object.keys(scoped.calificarEstado),[s.key+'||'+s.comp]);
});

test('legacy savereg remains compatible until the record participates in Notas 2',()=>{
 const s=fixture();const r=s.request('savereg',{payload:{meta:{observacion:'Ficticia'}}});assert.equal(r.ok,true);assert.equal(s.payload().meta.notas2,undefined);
});

test('savereg cannot overwrite an adopted record even with a current row version',()=>{
 const s=fixture();assert.equal(s.save('promedios',s.averages()).ok,true);
 const r=s.unchanged(()=>s.request('savereg',{modeloAcademico:1,identidadAcademica:1,version:s.row()[7],payload:{}}));assert.equal(r.code,'NOTAS2_REQUIRED');assert.equal(s.payload().finales[s.fk].nivel,'A');
});

test('existing legacy writer guard also covers a non-adopted Notas 2 metadata record',()=>{
 const s=fixture();s.seed(s.evidence());assert.equal(s.save('asistencia',empty('asistencia'),10).ok,true);assert.equal(s.payload().meta.notas2.adopted,false);
 const r=s.unchanged(()=>s.request('savereg',{modeloAcademico:1,version:s.row()[7],payload:{}}));assert.equal(r.code,'NOTAS2_REQUIRED');
});

test('size limit rejects without deleting history or existing academic data',()=>{
 const s=fixture();s.seed({meta:{academicHistory:[{original:'F'.repeat(49000)}]}});
 const r=s.unchanged(()=>s.save('promedios',s.averages(),10));assert.equal(r.code,'SIZE');assert.equal(s.payload().meta.notas2,undefined);
});
