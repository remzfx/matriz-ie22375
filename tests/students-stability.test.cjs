const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const {studentsFixture}=new Function('require','__dirname',read('tests/backend-students.test.cjs').split("test('loadstudents uses canonical")[0]+'\nreturn {studentsFixture};')(require,__dirname);
const {fixture,extract}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('function checkRequest')[0]+'\nreturn {fixture,extract};')(require,__dirname);
for(const phase of ['before-data','after-base','after-roster','during-publication','after-confirmation','after-confirm-flush'])test('Commit protocol fault: '+phase+' never exposes a partial pair',()=>{
 const s=studentsFixture();s.c.bimestreAbierto_=()=>true;
 const seeded=s.post({action:'seedstudentsroster',token:s.admin,version:s.init.version,bimestre:'III'});assert.equal(seeded.ok,true);
 const oldBase=s.load(s.admin),oldRoster=s.load(s.admin,{bimestre:'III'});
 const sh=s.tables.get('EstudiantesBase'),append=sh.appendRow;let versions=new Set(),committed=false;
 sh.appendRow=row=>{
  if(row[0].startsWith('DATOS_')){
   versions.add(row[1]);
   if(phase==='before-data'||(phase==='after-base'&&versions.size===2))throw Error('Synthetic fault');
  }
  if(row[0]==='ESTUDIANTES_COMMIT'){
   if(phase==='after-roster')throw Error('Synthetic fault');
   if(phase==='during-publication'){append([row[0],row[1],'{']);throw Error('Synthetic partial marker');}
   append(row);committed=true;if(phase==='after-confirmation')throw Error('Synthetic uncertain acknowledgement');return;
  }
  append(row);
 };
 s.c.SpreadsheetApp.flush=()=>{if(committed&&phase==='after-confirm-flush')throw Error('Synthetic confirmation acknowledgement');};
 const next=clone(s.base);next.secundaria.estudiantes[0].estadoMatricula='TRASLADADO';
 const res=s.post({action:'syncstudents',token:s.admin,version:s.init.version,bimestre:'III',base:next});
 assert.equal(res.ok,false);assert.equal(res.code,'SYNC_UNCONFIRMED');assert.match(res.error,/Consulta/);
 const actual=s.load(s.admin),roster=s.load(s.admin,{bimestre:'III'});
 if(committed){assert.notEqual(actual.version,oldBase.version);assert.notEqual(roster.version,oldRoster.version);assert.equal(actual.estudiantes.length,7);assert.equal(roster.estudiantes.length,6);assert.ok(actual.operacionConfirmada);assert.equal(actual.operacionConfirmada,roster.operacionConfirmada);}
 else {assert.equal(actual.version,oldBase.version);assert.equal(roster.version,oldRoster.version);assert.deepEqual(actual.estudiantes,oldBase.estudiantes);assert.deepEqual(roster.estudiantes,oldRoster.estudiantes);}
 assert.equal(s.state.held,false);
});
test('Valid commit changes both pointers together and legacy or unrelated frozen pointers stay readable',()=>{
 const s=studentsFixture();s.c.bimestreAbierto_=b=>b==='I';
 s.c.escribirVersionEstudiantes_(s.tables.get('EstudiantesBase'),s.c.normalizarBaseEstudiantes_({base:s.base}),['PADRON_II']);
 const before=s.load(s.admin,{bimestre:'II'}),sh=s.tables.get('EstudiantesBase'),rows=sh.rows.length;
 const r=s.post({action:'syncstudents',token:s.admin,version:s.init.version,bimestre:'I',base:s.base});
 assert.equal(r.ok,true);assert.equal(sh.rows.slice(rows).filter(r=>r[0]==='ESTUDIANTES_COMMIT').length,1);
 assert.equal(sh.rows.slice(rows).filter(r=>['BASE_ACTUAL','PADRON_I'].includes(r[0])).length,0);
 assert.equal(s.load(s.admin).version,r.version);assert.equal(s.load(s.admin,{bimestre:'I'}).version,r.padron.version);assert.ok(r.operacionConfirmada);assert.equal(r.operacionConfirmada,r.padron.operacionConfirmada);
 const after=s.load(s.admin,{bimestre:'II'});assert.equal(after.version,before.version);assert.deepEqual(after.estudiantes,before.estudiantes);
});
test('Closed roster enrichment rejects before modifying the base, roster or grades',()=>{
 const s=studentsFixture(),sh=s.tables.get('EstudiantesBase');
 s.c.escribirVersionEstudiantes_(sh,s.c.normalizarBaseEstudiantes_({base:s.base}),['PADRON_II']);
 const before=JSON.stringify([...s.tables].map(([k,v])=>[k,v.rows]));
 const r=s.post({action:'enrichstudents',token:s.admin,version:s.init.version,bimestre:'II',nivel:'primaria',grado:1,seccion:'Única',identidades:[{nombre:'Synthetic Student 0',idSiagie:'synthetic-new'}]});
 assert.equal(r.code,'PERIOD_CLOSED');assert.equal(JSON.stringify([...s.tables].map(([k,v])=>[k,v.rows])),before);
});
for(const ambiguity of ['homonyms','duplicate-input','conflicting-id','used-id','similar-name'])test('Identity review '+ambiguity+' prevents ambiguous association',()=>{
 const s=studentsFixture();let list=clone(s.base.primaria.estudiantes),ids=[{nombre:'Synthetic Student 0',idSiagie:'synthetic-new'}];
 if(ambiguity==='homonyms')list.push({...list[0],orden:9});
 if(ambiguity==='duplicate-input')ids.push({...ids[0]});
 if(ambiguity==='conflicting-id')list[0].idSiagie='existing-id';
 if(ambiguity==='used-id')list[1].idSiagie='synthetic-new';
 if(ambiguity==='similar-name')ids[0].nombre='Synthetic Student O';
 const body={nivel:'primaria',grado:1,seccion:'Única',identidades:ids};
 if(ambiguity==='similar-name'){assert.equal(s.c.enriquecerListaIdentidades_(list,body).enriquecidos,0);return;}
 assert.throws(()=>s.c.enriquecerListaIdentidades_(list,body),/ambigu|Homón|conflicto|duplicad/i);
});
test('Ambiguous open roster rejects enrichment before publishing an otherwise valid base',()=>{
 const s=studentsFixture(),roster=s.c.normalizarBaseEstudiantes_({base:s.base});roster.push({...roster[0],orden:9});
 s.c.escribirVersionEstudiantes_(s.tables.get('EstudiantesBase'),roster,['PADRON_I']);
 const writes=s.state.writes,r=s.post({action:'enrichstudents',token:s.admin,version:s.init.version,bimestre:'I',nivel:'primaria',grado:1,seccion:'Única',identidades:[{nombre:'Synthetic Student 0',idSiagie:'new'}]});
 assert.equal(r.ok,false);assert.equal(s.state.writes,writes);assert.equal(s.load(s.admin).version,s.init.version);
});
function adminFixture(){
 const requests=[],messages=[],s=fixture();let token='synthetic-admin';
 const base={version:'old',inicializada:true,primaria:{estudiantes:[{nombre:'Synthetic cached'}]},secundaria:{estudiantes:[]}};
 s.c.IEStudents={peek:()=>clone(base),validToken:()=>token,load:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),empty:()=>({})};
 s.c.document.getElementById=()=>({textContent:''});
 s.run('let modoEdicionBase=true;let estado=null,baseVersion="",baseCargada=false,baseInicializada=false,bdPendiente=false,bdGuardando=false;function actualizarResumen(){};function fillFiltros(){};function renderTabla(){};');
 s.c.estadoBD=m=>messages.push(m);
 for(const n of ['aplicarBaseServidor','cargarEstudiantesAdmin','saveEstado','guardarBD'])s.run(extract('admin.html',n));
 s.c.permitirEdicionBD=()=>true;
 return {s,requests,messages,base,changeToken:v=>token=v};
}
test('Cache-first edit survives late response with original version and revision',async()=>{
 const f=adminFixture(),task=f.s.c.cargarEstudiantesAdmin();
 f.s.run('estado.primaria.estudiantes[0].nombre="Synthetic draft";saveEstado();');
 f.requests[0].resolve({...clone(f.base),version:'server-new'});await task;
 assert.equal(f.s.run('estado.primaria.estudiantes[0].nombre'),'Synthetic draft');assert.equal(f.s.run('baseVersion'),'old');assert.equal(f.s.run('bdPendiente'),true);
 assert.match(f.messages.at(-1),/no reemplazó tus modificaciones/);
});
test('Two inverted responses apply only the newest request',async()=>{
 const f=adminFixture(),one=f.s.c.cargarEstudiantesAdmin(),two=f.s.c.cargarEstudiantesAdmin();
 f.requests[1].resolve({...clone(f.base),version:'newest'});await two;
 f.requests[0].resolve({...clone(f.base),version:'older'});await one;
 assert.equal(f.s.run('baseVersion'),'newest');
});
test('Network error and save conflict preserve local draft and base version',async()=>{
 const f=adminFixture(),task=f.s.c.cargarEstudiantesAdmin();f.s.run('estado.primaria.estudiantes[0].nombre="Synthetic draft";saveEstado();');
 f.requests[0].reject(Error('Synthetic network'));await task;
 f.s.c.IEStudents.save=async()=>{throw Error('CONFLICT: base cambió');};await f.s.c.guardarBD();
 assert.equal(f.s.run('estado.primaria.estudiantes[0].nombre'),'Synthetic draft');assert.equal(f.s.run('bdPendiente'),true);assert.equal(f.s.run('baseVersion'),'old');
});
test('No pending edits allows reload, explicit discard needs confirmation and cancellation retains draft',async()=>{
 const f=adminFixture();let task=f.s.c.cargarEstudiantesAdmin();f.requests[0].resolve({...clone(f.base),version:'fresh'});await task;assert.equal(f.s.run('baseVersion'),'fresh');
 f.s.c.saveEstado();f.s.c.confirm=()=>false;await f.s.c.cargarEstudiantesAdmin();assert.equal(f.requests.length,1);assert.equal(f.s.run('bdPendiente'),true);
 f.s.c.confirm=()=>true;task=f.s.c.cargarEstudiantesAdmin();f.requests[1].resolve({...clone(f.base),version:'discarded'});await task;assert.equal(f.s.run('bdPendiente'),false);assert.equal(f.s.run('baseVersion'),'discarded');
});
for(const token of ['other-token',''])test('Session change '+JSON.stringify(token)+' prevents old response applying without deleting draft',async()=>{
 const f=adminFixture(),task=f.s.c.cargarEstudiantesAdmin();f.s.c.saveEstado();f.changeToken(token);
 f.requests[0].resolve({...clone(f.base),version:'must-not-apply'});await task;
 assert.equal(f.s.run('baseVersion'),'old');assert.equal(f.s.run('bdPendiente'),true);assert.equal(f.s.run('baseCargada'),false);assert.match(f.messages.at(-1),/sesión cambió/);
});
test('Unconfirmed write is not retried and keeps authorized cache for read-only verification',async()=>{
 const s=fixture();await s.c.IEStudents.load();let writes=0;
 s.c.fetch=async()=>{writes++;return {ok:true,json:async()=>({ok:false,code:'SYNC_UNCONFIRMED',error:'Consulta base y padrón.'})};};
 await assert.rejects(s.c.IEStudents.sync({},'old','III'),e=>e.code==='SYNC_UNCONFIRMED');
 assert.equal(writes,1);assert.ok(s.c.IEStudents.peek());
});
test('Template upload distinguishes saved file from rejected identifier association',async()=>{
 const s=fixture(),message={textContent:''},input={files:[{name:'synthetic.xlsx',arrayBuffer:async()=>new ArrayBuffer(0)}]};
 s.c.document.getElementById=id=>id==='input'?input:id==='msg_input'?message:{value:'I'};
 s.c.CLOUD_API_URL='https://synthetic.invalid';s.c.tokenSesionAdmin=()=> 'synthetic';s.c.btoa=btoa;
 s.c.fetch=async()=>({text:async()=>JSON.stringify({ok:true})});s.c.enriquecerIdentidadesDesdeMatriz=async()=>{throw Error('PERIOD_CLOSED');};s.c.renderAulasSiagie=()=>{};
 s.run(extract('admin.html','subirPlantillaAula'));await s.c.subirPlantillaAula(1,'A','input');
 assert.match(message.textContent,/Plantilla guardada; asociación.*no completada/);assert.doesNotMatch(message.textContent,/ID SIAGIE asociados/);
});

test('Current base can enrich when no historical roster is targeted, without creating a closed roster',()=>{
 const s=studentsFixture(),before=s.state.writes;
 const r=s.post({action:'enrichstudents',token:s.admin,version:s.init.version,bimestre:'II',nivel:'primaria',grado:1,seccion:'Única',identidades:[{nombre:'Synthetic Student 0',idSiagie:'synthetic-new'}]});
 assert.equal(r.ok,true);assert.equal(r.enriquecidosBase,1);assert.equal(r.enriquecidosPadron,0);
 assert.equal(s.load(s.admin).estudiantes[0].idSiagie,'synthetic-new');assert.equal(s.load(s.admin,{bimestre:'II'}).padronInicializado,false);
 assert.ok(s.state.writes>before);assert.equal(s.tables.get('EstudiantesBase').rows.some(r=>r[0]==='PADRON_II'),false);
});
test('Successful identity association preserves reported counts and separate cache versions',async()=>{
 const s=fixture();s.c.fetch=async()=>({ok:true,json:async()=>({ok:true,inicializada:true,version:'new-base',estudiantes:[],enriquecidosBase:2,enriquecidosPadron:1,padron:{ok:true,inicializada:true,bimestre:'I',version:'new-roster',estudiantes:[],padronInicializado:true}})});
 const r=await s.c.IEStudents.enrich('old','I','primaria',1,'A',[{nombre:'Synthetic',idSiagie:'synthetic'}]);
 assert.equal(r.enriquecidosBase,2);assert.equal(r.enriquecidosPadron,1);assert.equal(s.c.IEStudents.peek().version,'new-base');assert.equal(s.c.IEStudents.peekRoster('I').version,'new-roster');
});
