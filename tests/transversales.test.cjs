const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const studentsFixture=new Function('require','__dirname',read('tests/backend-students.test.cjs').split('\ntest(')[0]+'\nreturn studentsFixture;')(require,__dirname);
const {extract,fixture:client}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('\ntest(')[0]+'\nreturn {extract,fixture};')(require,__dirname);
function fixture(){
  const s=studentsFixture(),docs=[s.docentes[0],
    {user:'math',nombre:'Synthetic Math',pass:'synthetic-only',nivel:'secundaria',areas:['Matemática'],aulas:['2|A'],asignaciones:{'Matemática':['2|A']},tutorAulas:['2|A']},
    {user:'communication',nombre:'Synthetic Communication',pass:'synthetic-only',nivel:'secundaria',asignaciones:{'Comunicación':['2|A']},tutorAulas:[]},
    {user:'ef',nombre:'Synthetic EF',pass:'synthetic-only',nivel:'secundaria',asignaciones:{'Educación Física':['2|A']}},
    {user:'other',nombre:'Synthetic Other',pass:'synthetic-only',nivel:'secundaria',asignaciones:{'Matemática':['2|B']},tutorAulas:[]}];
  s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(docs);s.cacheEntries.clear();
  const roster=[{nivel:'secundaria',grado:2,seccion:'A',orden:1,nombre:'Synthetic Student A',idSiagie:'synthetic-a',codigoEstudiante:'code-a'},{nivel:'secundaria',grado:2,seccion:'B',orden:1,nombre:'Synthetic Student B',idSiagie:'synthetic-b'}];
  assert.equal(s.post({action:'savestudents',token:s.admin,version:s.load(s.admin).version,base:{primaria:s.base.primaria,secundaria:{estudiantes:roster}}}).ok,true);
  const id='id:synthetic-a',ctx={grado:2,seccion:'A',bimestre:'I'},token=user=>s.token(user,user==='admin'?'admin':user==='pip'?'pip':user==='auxiliar'?'auxiliar':'docente');
  const route=(action,user,args={})=>s.post({action,token:token(user),...ctx,...args});
  const load=user=>route('loadtransversales',user,{area:user==='communication'?'Comunicación':user==='ef'?'Educación Física':'Matemática'});
  function aporte(user,value,modo=typeof value==='number'?'num':'letra'){
    const area=user==='communication'?'Comunicación':user==='ef'?'Educación Física':'Matemática',before=load(user),core=s.c.registroEvaluacion_();
    const prev=(before.aportes||[]).find(a=>a.user===user&&a.area===area),sessions=['tic','autonomia'].map(comp=>({fecha:'2026-10-14',comp,capacidad:core.CAPS[comp][0]}));
    const grades=Object.fromEntries(sessions.map(session=>[core.sessionKey(session),{[id]:{modo,valor:value}}]));
    return route('savetransversalaporte',user,{area,version:prev?prev.version:0,evidencia:{schema:1,sessions,grades}});
  }
  function final(user,value,justificacion='Evidencias colegiadas del bimestre',snapshot=load(user),conclusion=''){
    return route('savetransversalfinal',user,{version:snapshot.version,versionAportes:snapshot.versionAportes,finales:{[id]:{tic:{modo:typeof value==='number'?'num':'letra',valor:value,justificacion,conclusion},autonomia:{modo:typeof value==='number'?'num':'letra',valor:value,justificacion,conclusion}}}});
  }
  const confirm=(user,action,snapshot=load(user))=>route(action,user,{version:snapshot.version,versionAportes:snapshot.versionAportes});
  return {...s,docs,ctx,id,roster,token,route,load,aporte,final,confirm};
}
test('Math 2A contribution is protected by exact area/aula/user and never stored in RegistroNotas',()=>{
  const s=fixture();assert.equal(s.aporte('math',18).ok,true);const before=s.state.writes;
  for(const forged of [{grado:2,seccion:'B',area:'Matemática'},{area:'Comunicación'},{nivel:'primaria',area:'Matemática'}])assert.equal(s.route('savetransversalaporte','math',{...forged,version:0,valores:{}}).ok,false);
  assert.equal(s.state.writes,before);assert.equal(s.tables.get('RegistroNotas').rows.length,1);
  const row=s.tables.get('TransversalesAportes').rows[1];assert.equal(row[6],'math');assert.doesNotMatch(JSON.stringify(row),/token|synthetic-only/);
});
test('different areas retain independent originals; changing final cannot overwrite contributions',()=>{
  const s=fixture();s.aporte('math',18);s.aporte('communication','A');
  const before=JSON.stringify(s.tables.get('TransversalesAportes').rows);assert.equal(s.final('math',13).ok,true);
  assert.equal(JSON.stringify(s.tables.get('TransversalesAportes').rows),before);assert.equal(s.load('math').aportes.length,2);
  const records=s.load('math').aportes;assert.equal(records.find(a=>a.area==='Matemática').valores[s.id].tic.nota20,18);assert.equal(records.find(a=>a.area==='Comunicación').evidencia.grades[s.c.registroEvaluacion_().sessionKey({fecha:'2026-10-14',comp:'tic',capacidad:s.c.registroEvaluacion_().CAPS.tic[0]})][s.id].valor,'A');
});
for(const [n,level] of [[18,'AD'],[14,'A'],[11,'B'],[10,'C'],[0,'C'],[20,'AD']])test('equivalence '+n+' agrees with existing Registro exactly',()=>{
  const s=fixture(),f=client();f.run(extract('registro.html','numToLetter'));f.run(read('transversales-client.js'));const raw={modo:'num',valor:n};
  assert.equal(s.c.transversalValor_(raw).nivel,level);assert.equal(f.c.window.IETransversales.valor(raw).nivel,f.c.numToLetter(n));assert.deepEqual(clone(s.c.transversalValor_(raw)),clone(f.c.window.IETransversales.valor(raw)));
});
test('predominant level suggests without averaging; ties, dispersion and missing areas alert',()=>{
  const s=fixture();s.aporte('math','A');s.aporte('communication','A');s.aporte('ef','B');let r=s.load('pip').resultados[s.id].tic.resumen;
  assert.equal(r.sugerencia,'A');assert.deepEqual(clone(r.conteo),{AD:0,A:2,B:1,C:0});assert.equal(r.recibidos,3);assert.equal(r.alerta,false);assert.equal(s.load('pip').resultados[s.id].tic.final,null);
  s.aporte('ef','C');r=s.load('pip').resultados[s.id].tic.resumen;assert.equal(r.dispersion,true);assert.equal(r.alerta,true);
  s.aporte('communication','C');s.aporte('ef','B');r=s.load('pip').resultados[s.id].tic.resumen;assert.equal(r.sugerencia,null);assert.equal(r.empate,true);
  const missing=fixture();missing.aporte('math','A');assert.equal(missing.load('pip').resultados[missing.id].tic.resumen.faltan.length,2);
});
test('human numeric B may override suggested A with justification; originals and suggestion stay intact',()=>{
  const s=fixture();['math','communication','ef'].forEach(u=>s.aporte(u,'A'));
  assert.equal(s.final('math',13,'').ok,false);const out=s.final('math',13);assert.equal(out.ok,true);
  const r=out.resultados[s.id].tic;assert.equal(r.resumen.sugerencia,'A');assert.equal(r.final.sugerencia,'A');assert.equal(r.final.nivel,'B');assert.equal(r.final.nota20,13);assert.equal(r.listo,false);
});
test('alert never blocks final but requires justification; no suggestion and missing contributions also require it',()=>{
  const s=fixture();s.aporte('math','AD');s.aporte('communication','C');assert.equal(s.final('pip','B','').ok,false);assert.equal(s.final('pip','B').ok,true);
  const empty=fixture();assert.equal(empty.final('math','A','').ok,false);assert.equal(empty.final('math','A').ok,true);
});
test('only assigned tutor and PIP may decide, ordinary teachers/other rooms/Admin/Auxiliar cannot impersonate',()=>{
  const s=fixture();assert.equal(s.route('loadtransversalesaulas','communication').ok,false);
  for(const user of ['communication','other','admin','auxiliar','test-primary'])assert.equal(s.final(user,'A').ok,false);
  assert.equal(s.route('loadtransversales','math',{grado:2,seccion:'B',area:'Matemática'}).ok,false);
  assert.equal(s.route('loadtransversales','other',{grado:2,seccion:'A',area:'Matemática'}).ok,false);
  assert.equal(s.final('pip','A').ok,true);assert.equal(s.confirm('admin','confirmtransversaltutor').ok,false);assert.equal(s.confirm('admin','confirmtransversalaip').ok,false);
  assert.equal(s.confirm('communication','confirmtransversaltutor').ok,false);assert.equal(s.confirm('math','confirmtransversalaip').ok,false);
  const pip=s.route('loadtransversalesaulas','pip');assert.deepEqual(clone(pip.aulas),['2|A','2|B']);assert.equal(JSON.stringify(pip).includes('Synthetic Student'),false);
});
test('SIAGIE readiness requires independent Tutor plus AIP on exactly the same final and contribution version',()=>{
  const s=fixture();s.aporte('math','A');s.final('math','A');let out=s.confirm('math','confirmtransversaltutor');assert.equal(out.ok,true);assert.equal(out.resultados[s.id].tic.listo,false);assert.match(out.resultados[s.id].tic.estado,/AIP/);
  out=s.confirm('pip','confirmtransversalaip');assert.equal(out.ok,true);assert.equal(out.resultados[s.id].tic.listo,true);assert.equal(out.resultados[s.id].tic.final.tutor.role,'docente');assert.equal(out.resultados[s.id].tic.final.aip.role,'pip');
});
test('editing final or justification resets both confirmations; old decisions remain append history',()=>{
  const s=fixture();s.aporte('math','A');s.final('math','A');s.confirm('math','confirmtransversaltutor');s.confirm('pip','confirmtransversalaip');const old=JSON.stringify(s.tables.get('TransversalesConsolidado').rows);
  const out=s.final('pip',13,'Nuevas evidencias consideradas');assert.equal(out.ok,true);assert.equal(out.resultados[s.id].tic.final.tutor,null);assert.equal(out.resultados[s.id].tic.final.aip,null);assert.equal(out.resultados[s.id].tic.listo,false);
  assert.ok(JSON.stringify(s.tables.get('TransversalesConsolidado').rows).startsWith(old.slice(0,-1)));
});
test('new contribution makes previously confirmed decision obsolete, retained and unexportable',()=>{
  const s=fixture();s.aporte('math','A');s.final('math','A');s.confirm('math','confirmtransversaltutor');s.confirm('pip','confirmtransversalaip');s.aporte('communication','B');const out=s.route('loadtransversalexport','admin'),r=out.resultados[s.id].tic;
  assert.equal(r.final.nivel,'A');assert.equal(r.listo,false);assert.equal(r.estado,'Requiere nueva confirmación');assert.equal(s.confirm('pip','confirmtransversalaip').ok,false);
  assert.equal(s.final('math','A').ok,true);s.confirm('math','confirmtransversaltutor');assert.equal(s.confirm('pip','confirmtransversalaip').resultados[s.id].tic.listo,true);
});
test('optimistic version detects concurrent edits and confirmations without silent last-write-wins',()=>{
  const s=fixture();s.aporte('math','A');const snapshot=s.load('math');assert.equal(s.final('math','A',undefined,snapshot).ok,true);assert.equal(s.final('pip','B',undefined,snapshot).code,'CONFLICT');
  const both=s.load('math');assert.equal(s.confirm('math','confirmtransversaltutor',both).ok,true);assert.equal(s.confirm('pip','confirmtransversalaip',both).code,'CONFLICT');
});
test('closed and blocked bimestres reject contributions, decisions and confirmations, keeping confirmed records read-only',()=>{
  const s=fixture();s.aporte('math','A');s.final('math','A');s.confirm('math','confirmtransversaltutor');s.confirm('pip','confirmtransversalaip');
  for(const state of ['cerrado','bloqueado']){s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({bimestres:{I:state}});const before=s.state.writes;
    assert.equal(s.aporte('math','B').code,'PERIOD');assert.equal(s.final('pip','B').code,'PERIOD');assert.equal(s.confirm('math','confirmtransversaltutor').code,'PERIOD');assert.equal(s.state.writes,before);assert.equal(s.load('pip').resultados[s.id].tic.listo,true);assert.equal(s.load('pip').abierto,false);
  }
});
test('one active tutor per normalized aula; changing tutor revokes prior signed sessions',()=>{
  const s=fixture(),login=s.c.responderLogin_({tipo:'docente',usuario:'math',password:'synthetic-only'});assert.deepEqual(clone(login.tutorAulas),['2|A']);
  s.docs[2].tutorAulas=['2|a'];assert.equal(s.post({action:'savedoc',token:s.admin,docentes:s.docs}).ok,false);
  s.docs[1].tutorAulas=[];assert.equal(s.post({action:'savedoc',token:s.admin,docentes:s.docs,ts:1000}).ok,true);assert.equal(s.post({action:'loadtransversalesaulas',token:login.token}).code,'SESSION');
});
test('ordinary secondary CT route cannot write legacy blocks and existing historical records remain byte-identical',()=>{
  const s=fixture();s.docs[1].asignaciones['Competencias Transversales']=['2|A'];s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docs);s.cacheEntries.clear();
  assert.equal(s.post(s.body('savereg',{token:s.admin,nivel:'secundaria',grado:2,seccion:'A',area:'Competencias Transversales'})).ok,true);const before=JSON.stringify(s.tables.get('RegistroNotas').rows);
  for(const action of ['savereg','saveArea'])assert.equal(s.post(s.body(action,{token:s.token('math'),nivel:'secundaria',grado:2,seccion:'A',area:'Competencias Transversales'})).ok,false);
  s.aporte('math','A');s.final('pip',13);assert.equal(JSON.stringify(s.tables.get('RegistroNotas').rows),before);assert.equal(s.post({action:'loadreg',token:s.admin,nivel:'secundaria'}).items.length,1);
});
test('unknown student identities and arbitrary competency/payload or RPC actions are rejected',()=>{
  const s=fixture();assert.equal(s.route('savetransversalaporte','math',{area:'Matemática',version:0,valores:{'id:synthetic-b':{tic:{modo:'letra',valor:'A'}}}}).ok,false);
  for(const action of ['savedoc','savestudents','saveaip','loadstudents'])assert.equal(s.c.transversalesBridgeEjecutar({action,token:s.admin}).code,'METHOD');
  assert.equal(s.route('savetransversalaporte','math',{area:'Matemática',version:0,valores:{[s.id]:{unknown:{modo:'letra',valor:'A'}}}}).ok,false);
});
test('transversal identity matches existing student identity rules including accents, commas and stable keys',()=>{
  const s=fixture(),f=client();f.run(read('student-identity.js'));for(const al of [{nombre:'Synthetic, Á Student'},{nombre:'Synthetic',idSiagie:' stable-id '},{nombre:'Synthetic',codigoEstudiante:' code '}])assert.equal(s.c.transversalIdentidad_(al),f.c.window.studentKey(al));
});

const bridgeFixture=new Function('require','__dirname',read('tests/login-html-bridge.test.cjs').split('\ntest(')[0]+'\nreturn bridgeFixture;')(require,__dirname);
function transport(role='admin'){
 const server=fixture(),f=client(role),b=bridgeFixture(server,'transversales');
 f.session.token=server.token(role==='docente'?'math':role);f.storage.setItem('ie22375_session_v1',JSON.stringify(f.session));
 f.c.window.IELoginBridge={create:()=>b.api};f.c.document.body={};f.run(read('transversales-client.js'));
 return {server,f,b,api:f.c.window.IETransversales};
}
for(const role of ['admin','docente','pip'])test(role+': transversales uses protected ready bridge once, deduplicates concurrent reads and exposes no URL/storage data',async()=>{
 const {server,f,b,api}=transport(role);b.start();
 const args={...server.ctx,area:'Matemática'},a=api.request('loadtransversales',args),c=api.request('loadtransversales',args);assert.equal(a,c);
 const out=await a;assert.equal(out.ok,true);assert.equal(b.rpc.length,1);assert.equal(f.calls.length,0);
 assert.doesNotMatch(b.frame.src,/token|Synthetic|synthetic-a|Matemática/);assert.equal([...f.memory.keys()].filter(k=>k!=='ie22375_session_v1').length,0);
 assert.equal(b.rpc[0].token,f.session.token);assert.deepEqual(clone(out),clone(server.route('loadtransversales',role==='docente'?'math':role,{area:'Matemática'})));
});
test('transversales unavailable bridge falls back once to existing POST without retry or sensitive URL',async()=>{
 const {f,b,api,server}=transport();b.unavailable();await api.request('loadtransversales',server.ctx);
 assert.equal(f.calls.length,1);assert.equal(b.rpc.length,0);const {url,options}=f.calls[0];assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');assert.doesNotMatch(url,/token|Synthetic|synthetic-a/);assert.equal(JSON.parse(options.body).token,f.session.token);
});
test('transversales discards late RPC results after a session token changes',async()=>{
 const {f,b,api,server}=transport();b.start();b.block();const task=api.request('loadtransversales',server.ctx);
 await Promise.resolve();f.storage.setItem('ie22375_session_v1',JSON.stringify({...f.session,token:server.token('pip','pip')}));
 b.resolve(server.load('admin'));await assert.rejects(task,/sesión cambió/);assert.equal(f.calls.length,0);
});
for(const state of ['cold','hot'])test('savedoc with '+state+' configuration cache revokes old tutor token immediately',()=>{
 const s=fixture(),login=s.c.responderLogin_({tipo:'docente',usuario:'math',password:'synthetic-only'});if(state==='cold')s.cacheEntries.clear();
 s.docs[1].tutorAulas=[];assert.equal(s.post({action:'savedoc',token:s.admin,docentes:s.docs,ts:1}).ok,true);
 assert.equal(s.post({action:'loadtransversalesaulas',token:login.token}).code,'SESSION');
 const fresh=s.c.responderLogin_({tipo:'docente',usuario:'math',password:'synthetic-only'});assert.deepEqual(clone(fresh.tutorAulas),[]);assert.notEqual(fresh.permisosVersion,login.permisosVersion);
});
test('Registro context changes retain the separate in-memory transversal draft',()=>{
 const f=client('docente');let captured=0;const draft={tic:'A'};
 f.c.IERegistroTransversales={capture:()=>captured++,draft};f.run(extract('registro.html','cerrarTransversalesRegistro'));
 assert.equal(f.c.cerrarTransversalesRegistro(),true);assert.equal(captured,1);assert.equal(f.c.IERegistroTransversales.draft,draft);
});

const exportFixture=new Function('require','__dirname',read('tests/registro-roster-identity.test.cjs').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
for(const stage of ['confirmed','confirmed-C','obsolete','pending','pending-cancel','unlinked-accept','unlinked-cancel','empty','ambiguous-name','ambiguous-code','ambiguous-id'])test('real Admin SIAGIE export '+stage+' uses only current confirmed finals and preserves academic export',async()=>{
 const server=fixture();['math','communication','ef'].forEach(u=>server.aporte(u,stage==='confirmed-C'?'C':'A'));server.final('math',stage==='confirmed-C'?'C':13,stage==='confirmed-C'?'Justificación colegiada distinta':undefined,undefined,stage==='confirmed-C'?'Necesita acompañamiento para desarrollar las capacidades evaluadas.':'');server.confirm('math','confirmtransversaltutor');
 if(!stage.startsWith('pending'))server.confirm('pip','confirmtransversalaip');if(stage==='obsolete')server.aporte('ef','B');
 const f=exportFixture(),ctx={nivel:'secundaria',bim:'I',grado:2,seccion:'A'},academic={finales:{'secundaria||I||2||A||Matemática||Resuelve||id:synthetic-a':{nivel:'AD'}}};
 const sheet=()=>({'!ref':'A1:E3',A3:{v:'synthetic-a'},C3:{v:'Synthetic Student A'},D3:{v:'C'},E3:{v:'Legacy conclusion must not survive'}}),mate=sheet(),tic=sheet(),auto=sheet(),wb={SheetNames:['MATE','DESEN TIC','GEST AUTO'],Sheets:{MATE:mate,'DESEN TIC':tic,'GEST AUTO':auto}};
 const unlinked=stage.startsWith('unlinked')||stage.startsWith('ambiguous'),partial=unlinked||stage==='obsolete'||stage.startsWith('pending'),students=clone(server.roster);
 if(unlinked||stage==='empty'){
   for(const ws of [mate,tic,auto]){ws['!ref']='A1:E6';ws.D4={v:'C'};ws.E4={v:'Unlinked legacy conclusion'};}
   if(unlinked){
     for(const ws of [mate,tic,auto]){ws.A4={v:'missing-id'};ws.B4={v:'missing-code'};ws.C4={v:'Synthetic Missing Student'};}
     if(stage.startsWith('ambiguous')){
       students.push({grado:2,seccion:'A',nombre:'Synthetic Homonym',idSiagie:'duplicate-id',codigoEstudiante:'duplicate-code'}, {grado:2,seccion:'A',nombre:'Synthetic Homonym',idSiagie:'duplicate-id',codigoEstudiante:'duplicate-code'});
       for(const ws of [mate,tic,auto]){if(stage==='ambiguous-name')ws.C4.v='Synthetic Homonym';if(stage==='ambiguous-code')ws.B4.v='duplicate-code';if(stage==='ambiguous-id')ws.A4.v='duplicate-id';}
     }
   }
   // Row 5 is entirely empty; row 6 has no identity but stale grade cells. Neither is a student pending.
   for(const ws of [tic,auto]){ws.D6={v:'C'};ws.E6={v:'Identity-free legacy conclusion'};}
 }
 let exported=0,reads=0,downloads=0;const confirmations=[];
 f.c.XLSX={read:()=>wb,write:()=>{exported++;return new Uint8Array()},utils:{decode_range:()=>({s:{r:0},e:{r:unlinked||stage==='empty'?5:2}}),encode_cell:({r,c})=>String.fromCharCode(65+c)+(r+1)}};
 f.c.Blob=Blob;f.c.atob=atob;f.c.URL={createObjectURL:()=> 'synthetic'};f.c.document.createElement=()=>({click(){downloads++;}});f.c.confirm=message=>{confirmations.push(message);assert.match(f.el('tplMsg').textContent,/Transversales pendientes:/);assert.equal(exported,0);return !stage.endsWith('-cancel')};
 f.c.ctxTpl=()=>ctx;f.c.areasDeNivel=()=>['Matemática','Competencias Transversales'];f.c.COMPS_SIAGIE={'Matemática':['Resuelve'],'Competencias Transversales':['TIC','Autonomía']};
 f.c.areaDeHojaAdm=name=>name==='MATE'?{area:'Matemática',only:null}:{area:'Competencias Transversales',only:name==='DESEN TIC'?0:1};
 f.c.normNomAdm=f.c.IEStudentIdentity.normalizarNombre;
 f.c.fetchRegAula=async()=>[{area:'Matemática',payload:academic},{area:'Competencias Transversales',payload:{finales:{'secundaria||I||2||A||Competencias Transversales||TIC||id:synthetic-a':{nivel:'AD'}}}}];
 f.c.IEStudents.loadRoster=async()=>({primaria:{estudiantes:[]},secundaria:{estudiantes:students}});
 f.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify({ok:true,b64:Buffer.from('synthetic').toString('base64')})});f.c.CLOUD_API_URL='synthetic';
 f.c.IETransversales={request:async(action,data)=>{reads++;return server.route(action,'admin',data)}};
 for(const name of ['numToLetterAdm','promedioAdm','letraDesdePayload','concDesdePayload','vaciarSiagieOficial'])f.run(extract('admin.html',name));
 await f.c.vaciarSiagieOficial();assert.equal(exported,stage.endsWith('-cancel')?0:1);assert.equal(downloads,exported);assert.equal(reads,2);assert.equal(mate.D3.v,'AD');
 for(const ws of [tic,auto]){if(stage==='confirmed-C'){assert.equal(ws.E3.v,'Necesita acompañamiento para desarrollar las capacidades evaluadas.');assert.notEqual(ws.E3.v,'Justificación colegiada distinta');}else assert.equal(ws.E3,undefined);if(!stage.startsWith('pending')&&stage!=='obsolete')assert.equal(ws.D3.v,stage==='confirmed-C'?'C':'B');else assert.equal(ws.D3,undefined);}
 if(unlinked||stage==='empty'){
   for(const ws of [tic,auto]){assert.equal(ws.D4,undefined);assert.equal(ws.E4,undefined);assert.equal(ws.D6,undefined);assert.equal(ws.E6,undefined);}
   assert.equal(mate.D4.v,'C');assert.equal(mate.E4.v,'Unlinked legacy conclusion');
   assert.doesNotMatch(f.el('tplMsg').textContent,/fila 5|fila 6/);
   if(unlinked){assert.match(f.el('tplMsg').textContent,/Alumno\/fila no vinculada al padrón · DESEN TIC · fila 4/);assert.match(f.el('tplMsg').textContent,/Alumno\/fila no vinculada al padrón · GEST AUTO · fila 4/);}
 }
 if(partial){
   assert.equal(confirmations.length,1);assert.equal(confirmations[0],'Hay competencias transversales pendientes. Este archivo será parcial y todavía no está listo como registro completo para SIAGIE. ¿Generar de todas formas las áreas disponibles?');
   assert.match(f.el('tplMsg').textContent,/NO listo para envío completo a SIAGIE/);if(!unlinked)assert.match(f.el('tplMsg').textContent,/Synthetic Student A/);assert.doesNotMatch(f.el('tplMsg').textContent,/Registro oficial listo/);
   if(!stage.endsWith('-cancel'))assert.match(f.el('tplMsg').textContent,/^Archivo parcial generado/);
 }else{assert.equal(confirmations.length,0);assert.match(f.el('tplMsg').textContent,/^Registro oficial listo.*Suba este archivo a SIAGIE/);}
});

function dom(){
 function el(tag){const e={style:{},tagName:tag,children:[],value:'',disabled:false,textContent:'',setAttribute(){},appendChild(x){this.children.push(x);return x},replaceChildren(){this.children=[]},querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)])}};return e;}
 return el;
}
test('real evidence grid retains numeric originals on view switch, rounds edited grade, saves only own area/user',async()=>{
 const server=fixture();server.aporte('math',18);server.aporte('communication',14);
 const f=client('docente'),el=dom();f.session.user='math';f.storage.setItem('ie22375_session_v1',JSON.stringify(f.session));f.c.document.createElement=el;
 f.run(read('transversales-client.js'));const box=el('div'),editor=f.c.window.IETransversales.editor(box,clone(server.load('math')),{...server.ctx,area:'Matemática'},false);
 const mode=box.querySelectorAll('select')[0];assert.equal(box.querySelectorAll('select')[2].value,'AD');mode.value='num';mode.onchange();const grade=box.querySelectorAll('input').find(e=>e.type==='number');assert.equal(grade.value,18);assert.equal(editor.dirty(),false);
 grade.value='13.5';grade.onchange();assert.equal(editor.dirty(),true);
 let payload;const signed=server.token('math');f.c.window.IEStudents.validToken=()=>signed;f.c.window.IEStudents.fetchJSON=async(url,options)=>{payload=JSON.parse(options.body);const result=server.post(payload);assert.equal(result.ok,true,result.error);return result};
 // Recreate with stable token: session switch is deliberately rejected by the original editor.
 f.c.window.IEStudents.validToken=()=>f.session.token;f.session.token=signed;f.storage.setItem('ie22375_session_v1',JSON.stringify(f.session));
 const fresh=el('div'),active=f.c.window.IETransversales.editor(fresh,clone(server.load('math')),{...server.ctx,area:'Matemática'},false);fresh.querySelectorAll('select')[0].value='num';fresh.querySelectorAll('select')[0].onchange();const input=fresh.querySelectorAll('input').find(e=>e.type==='number');input.value='13.5';input.onchange();
 await fresh.querySelectorAll('button').find(b=>b.textContent==='Guardar sesión y evidencias del área').onclick();assert.equal(payload.action,'savetransversalaporte');const core=server.c.registroEvaluacion_(),key=core.sessionKey(payload.evidencia.sessions.find(s=>s.comp==='tic'));assert.equal(payload.evidencia.grades[key][server.id].valor,14);assert.equal(active.dirty(),false);
 assert.equal(server.load('math').aportes.find(a=>a.user==='communication').valores[server.id].tic.valor,14);
});
test('real consolidation editor never prefills a suggestion, blocks confirmation with unsaved final and is read-only for closed periods/Admin',async()=>{
 const server=fixture();server.aporte('math','A');const f=client('docente'),el=dom();f.c.document.createElement=el;f.run(read('transversales-client.js'));
 const box=el('div'),edit=f.c.window.IETransversales.editor(box,clone(server.load('math')),server.ctx,true);
 const input=box.querySelectorAll('select')[1];assert.equal(input.value,'');input.value='B';input.onchange();assert.equal(edit.dirty(),true);
 const confirm=box.querySelectorAll('button').find(b=>b.textContent==='Tutor confirma');await confirm.onclick();assert.equal(f.calls.length,0);
 const closed=clone(server.load('pip'));closed.abierto=false;const cbox=el('div');f.c.window.IETransversales.editor(cbox,closed,server.ctx,true);assert.ok(cbox.querySelectorAll('select').slice(1).every(e=>e.disabled));assert.ok(cbox.querySelectorAll('button').every(e=>e.disabled));
 const abox=el('div');f.c.window.IETransversales.editor(abox,clone(server.load('admin')),server.ctx,true);assert.equal(abox.querySelectorAll('button').length,0);assert.ok(abox.querySelectorAll('select').slice(1).every(e=>e.disabled));
});

for(const [entrada,nivel,normalizado] of [[13.4,'B',13],[13.5,'A',14],[17.5,'AD',18]])test('numeric '+entrada+' rounds exactly as Registro before deriving level in frontend/backend and persisted decisions',()=>{
 const s=fixture(),f=client();f.run(extract('registro.html','numToLetter'));f.run(extract('registro.html','pad2'));f.run(read('transversales-client.js'));
 const expected={modo:'num',valor:normalizado,nota20:normalizado,nivel};
 assert.deepEqual(clone(s.c.transversalValor_({modo:'num',valor:entrada})),expected);assert.deepEqual(clone(f.c.window.IETransversales.valor({modo:'num',valor:entrada})),expected);
 assert.equal(Number(f.c.pad2(entrada)),normalizado);assert.equal(f.c.numToLetter(Number(f.c.pad2(entrada))),nivel);
 assert.equal(s.aporte('math',entrada).aportes[0].valores[s.id].tic.valor,normalizado);
 assert.equal(s.final('pip',entrada).resultados[s.id].tic.final.valor,normalizado);
});
for(const entrada of [-0.1,20.1,-1,21])test('numeric '+entrada+' is rejected before rounding in both layers and cannot be stored',()=>{
 const s=fixture(),f=client();f.run(read('transversales-client.js'));assert.equal(s.c.transversalValor_({modo:'num',valor:entrada}),null);assert.equal(f.c.window.IETransversales.valor({modo:'num',valor:entrada}),null);
 assert.equal(s.aporte('math',entrada).ok,false);assert.equal(s.final('pip',entrada).ok,false);assert.equal(s.tables.has('TransversalesAportes'),false);assert.equal(s.tables.has('TransversalesConsolidado'),false);
});
function confirmed(s=fixture()){['math','communication','ef'].forEach(u=>s.aporte(u,'A'));s.final('math','A');s.confirm('math','confirmtransversaltutor');s.confirm('pip','confirmtransversalaip');return s;}
for(const justificacion of ['', 'Justificación colegiada sin conclusión'])test('suggested C without descriptive conclusion cannot be confirmed or ready: '+JSON.stringify(justificacion),()=>{
 const s=fixture();['math','communication','ef'].forEach(u=>s.aporte(u,'C'));
 const out=s.final('math','C',justificacion,undefined,'   ');assert.equal(out.ok,true);const r=out.resultados[s.id].tic;
 assert.equal(r.resumen.sugerencia,'C');assert.equal(r.resumen.alerta,false);assert.equal(r.final.conclusion,'');assert.equal(r.listo,false);assert.equal(r.estado,'Conclusión descriptiva obligatoria para nivel C');
 const writes=s.state.writes;for(const [user,action] of [['math','confirmtransversaltutor'],['pip','confirmtransversalaip']]){const rejected=s.confirm(user,action);assert.equal(rejected.ok,false);assert.equal(rejected.error,'Conclusión descriptiva obligatoria para nivel C');}assert.equal(s.state.writes,writes);
});
test('C conclusion and collegiate justification remain separate; conclusion-only change resets both confirmations and preserves history',()=>{
 const s=fixture();['math','communication','ef'].forEach(u=>s.aporte(u,'C'));const conclusion='Requiere acompañamiento para organizar sus metas.',just='Decisión colegiada fundamentada.';
 assert.equal(s.final('math','C',just,undefined,conclusion).ok,true);s.confirm('math','confirmtransversaltutor');let out=s.confirm('pip','confirmtransversalaip');assert.equal(out.ok,true);assert.equal(out.resultados[s.id].tic.listo,true);assert.equal(out.resultados[s.id].tic.final.conclusion,conclusion);assert.equal(out.resultados[s.id].tic.final.justificacion,just);
 const before=JSON.stringify(s.tables.get('TransversalesConsolidado').rows),version=out.version;
 out=s.final('pip','C',just,undefined,conclusion+' Seguimiento semanal.');const f=out.resultados[s.id].tic.final;assert.ok(out.version>version);assert.equal(f.tutor,null);assert.equal(f.aip,null);assert.equal(out.resultados[s.id].tic.listo,false);assert.equal(f.justificacion,just);assert.ok(JSON.stringify(s.tables.get('TransversalesConsolidado').rows).startsWith(before.slice(0,-1)));
 s.confirm('math','confirmtransversaltutor');assert.equal(s.confirm('pip','confirmtransversalaip').resultados[s.id].tic.listo,true);
});
test('legacy C with Tutor/AIP confirmations and justification but no conclusion fails closed on load and export',()=>{
 const s=confirmed(),row=s.tables.get('TransversalesConsolidado').rows.at(-1),finales=JSON.parse(row[6]);for(const f of Object.values(finales[s.id])){f.nivel='C';f.valor='C';delete f.conclusion;}row[6]=JSON.stringify(finales);
 for(const out of [s.load('pip'),s.route('loadtransversalexport','admin')]){assert.equal(out.resultados[s.id].tic.listo,false);assert.equal(out.resultados[s.id].tic.estado,'Conclusión descriptiva obligatoria para nivel C');}
 assert.equal(s.c.transversalListo_(finales[s.id].tic,row[4]),false);
});
for(const level of ['AD','A','B'])test('final '+level+' needs no descriptive conclusion',()=>{
 const s=fixture();['math','communication','ef'].forEach(u=>s.aporte(u,level));assert.equal(s.final('math',level,'').ok,true);s.confirm('math','confirmtransversaltutor');const out=s.confirm('pip','confirmtransversalaip');assert.equal(out.ok,true);assert.equal(out.resultados[s.id].tic.listo,true);assert.equal(out.resultados[s.id].tic.final.conclusion,'');
});
test('Tutor/AIP editor exposes distinct conclusion and justification; closed period keeps both read-only',()=>{
 const s=fixture();['math','communication','ef'].forEach(u=>s.aporte(u,'C'));s.final('math','C','Justificación independiente',undefined,'Conclusión del estudiante');
 const f=client(),el=dom();f.c.document.createElement=el;f.run(read('transversales-client.js'));
 for(const user of ['math','pip']){const data=clone(s.load(user)),box=el('div');f.c.window.IETransversales.editor(box,data,s.ctx,true);const fields=box.querySelectorAll('textarea');assert.equal(fields.length,4);assert.equal(fields[0].placeholder,'Justificación de la decisión colegiada');assert.equal(fields[0].value,'Justificación independiente');assert.equal(fields[1].placeholder,'Conclusión descriptiva');assert.equal(fields[1].value,'Conclusión del estudiante');assert.ok(fields.every(x=>!x.disabled));
 data.abierto=false;const closed=el('div');f.c.window.IETransversales.editor(closed,data,s.ctx,true);assert.ok(closed.querySelectorAll('textarea').every(x=>x.disabled));}
 s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({bimestres:{I:'cerrado'}});assert.equal(s.final('pip','C','Justificación independiente',undefined,'Cambio prohibido').code,'PERIOD');assert.equal(s.load('pip').resultados[s.id].tic.final.conclusion,'Conclusión del estudiante');
});
function saveDocs(s){assert.equal(s.post({action:'savedoc',token:s.admin,docentes:s.docs}).ok,true);return s.load('pip');}
for(const edit of ['primary','password','other-name','other-room','order','own-name','extra-room'])test('class fingerprint ignores unrelated configuration edit: '+edit,()=>{
 const s=fixture();
 if(edit==='order'){s.docs[1].asignaciones['Matemática'].push('3|B');s.docs[1].asignaciones['Ciencia y Tecnología']=['3|B','2|A'];s.docs[1].tutorAulas.push('3|B');s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docs);s.cacheEntries.clear();}
 confirmed(s);const before=s.load('pip');
 if(edit==='primary')s.docs[0].grados=[2,5];
 if(edit==='password')s.docs[1].pass='changed-synthetic-value';
 if(edit==='other-name')s.docs[4].nombre='Synthetic Renamed Other';
 if(edit==='other-room')s.docs[4].asignaciones={'Ciencia y Tecnología':['3|B']};
 if(edit==='order'){s.docs.reverse();s.docs.forEach(d=>{if(d.tutorAulas)d.tutorAulas.reverse();if(d.asignaciones)d.asignaciones=Object.fromEntries(Object.entries(d.asignaciones).reverse().map(([a,rows])=>[a,rows.slice().reverse()]));});}
 if(edit==='own-name')s.docs[1].nombre='Synthetic Renamed Same Person';
 if(edit==='extra-room'){s.docs[1].asignaciones['Matemática'].push('3|B');s.docs[1].asignaciones['Ciencia y Tecnología']=['3|B'];}
 const after=saveDocs(s);assert.equal(after.ok,true);assert.equal(after.versionAportes,before.versionAportes);assert.equal(after.resultados[s.id].tic.listo,true);assert.deepEqual(clone(after.resultados[s.id].tic.final),clone(before.resultados[s.id].tic.final));
});
for(const edit of ['math-teacher','remove-area','add-area','tutor'])test('class fingerprint invalidates confirmed final only for relevant edit: '+edit,()=>{
 const s=confirmed(),before=s.load('pip');
 if(edit==='math-teacher'){delete s.docs[1].asignaciones['Matemática'];s.docs[1].areas=[];s.docs[1].aulas=[];s.docs[4].asignaciones['Matemática']=['2|A'];}
 if(edit==='remove-area')s.docs[2].asignaciones={'Comunicación':['2|B']};
 if(edit==='add-area')s.docs[4].asignaciones['Ciencia y Tecnología']=['2|A'];
 if(edit==='tutor'){s.docs[1].tutorAulas=[];s.docs[2].tutorAulas=['2|A'];}
 const after=saveDocs(s);assert.notEqual(after.versionAportes,before.versionAportes);assert.equal(after.resultados[s.id].tic.listo,false);assert.match(after.resultados[s.id].tic.estado,/Requiere nueva confirmación/);assert.deepEqual(clone(after.resultados[s.id].tic.final),clone(before.resultados[s.id].tic.final));
});
test('bimestre roster version change invalidates confirmed final without rewriting its trace',()=>{
 const s=confirmed(),before=s.load('pip'),padron=s.post({action:'loadstudents',token:s.admin,bimestre:'I'});
 assert.equal(s.post({action:'syncstudents',token:s.admin,bimestre:'I',version:padron.version,base:{primaria:s.base.primaria,secundaria:{estudiantes:s.roster}}}).ok,true);
 const after=s.load('pip');assert.notEqual(after.versionAportes,before.versionAportes);assert.equal(after.resultados[s.id].tic.listo,false);assert.deepEqual(clone(after.resultados[s.id].tic.final),clone(before.resultados[s.id].tic.final));
});

function evidencia(s,items){
 const core=s.c.registroEvaluacion_(),sessions=new Map(),grades={};
 items.forEach(q=>{const session={fecha:q.fecha||'2026-10-14',comp:q.comp||'tic',capacidad:q.capacidad||core.CAPS[q.comp||'tic'][q.cap||0]},key=core.sessionKey(session);sessions.set(key,session);
   if(q.valor!==undefined){grades[key]=grades[key]||{};grades[key][q.id||s.id]={modo:typeof q.valor==='number'?'num':'letra',valor:q.valor};}});
 return {schema:1,sessions:[...sessions.values()],grades};
}
function guardarEvidencia(s,user,raw,extra={}){const area=user==='communication'?'Comunicación':user==='ef'?'Educación Física':'Matemática',prev=(s.load(user).aportes||[]).find(a=>a.area===area&&a.user===user);return s.route('savetransversalaporte',user,{area,version:prev?prev.version:0,evidencia:raw,...extra});}
test('exactly four official TIC capacities and three autonomous-learning capacities are shared with server',()=>{
 const s=fixture(),f=client();assert.equal(s.c.registroEvaluacion_.toString(),f.c.registroEvaluacion_.toString(),'single grading core must stay identical in the complete Apps Script');
 const core=s.c.registroEvaluacion_();assert.equal(core.COMP.tic,'Se desenvuelve en los entornos virtuales generados por las TIC');
 assert.deepEqual(clone(core.CAPS.tic),['Personaliza entornos virtuales','Gestiona información del entorno virtual','Interactúa en entornos virtuales','Crea objetos virtuales en diversos formatos']);
 assert.deepEqual(clone(core.CAPS.autonomia),['Define metas de aprendizaje','Organiza acciones estratégicas para alcanzar sus metas de aprendizaje','Monitorea y ajusta su desempeño durante el proceso de aprendizaje']);
 assert.deepEqual(clone(core.CAPS),clone(f.c.window.IERegistroEvaluacion.CAPS));
});
for(const count of [1,2,4])test('teacher can select '+count+' TIC capacities without requiring the others',()=>{
 const s=fixture(),raw=evidencia(s,Array.from({length:count},(_,cap)=>({cap,valor:'A'}))),out=guardarEvidencia(s,'math',raw);assert.equal(out.ok,true);
 const own=out.aportes[0];assert.equal(own.evidencia.sessions.length,count);assert.equal(own.estadisticas[s.id].tic.evidencias,count);assert.equal(own.estadisticas[s.id].tic.capacidades.length,count);assert.equal(own.valores[s.id].tic.nivel,'A');assert.equal(own.valores[s.id].autonomia,undefined);
});
for(const invalid of ['foreign-capacity','invented-capacity','invalid-date','duplicate-session','grade-without-session','foreign-student','direct-result'])test('backend rejects invalid evidence: '+invalid+' atomically',()=>{
 const s=fixture(),raw=evidencia(s,[{valor:'A'}]);
 if(invalid==='foreign-capacity')raw.sessions[0].capacidad=s.c.registroEvaluacion_().CAPS.autonomia[0];
 if(invalid==='invented-capacity')raw.sessions[0].capacidad='Synthetic invented capacity';
 if(invalid==='invalid-date')raw.sessions[0].fecha='2026-02-30';
 if(invalid==='duplicate-session')raw.sessions.push({...raw.sessions[0]});
 if(invalid==='grade-without-session')raw.sessions=[];
 if(invalid==='foreign-student')raw.grades[Object.keys(raw.grades)[0]]={'id:synthetic-b':{modo:'letra',valor:'A'}};
 const before=s.state.writes,out=invalid==='direct-result'?s.route('savetransversalaporte','math',{area:'Matemática',version:0,valores:{[s.id]:{tic:{modo:'letra',valor:'A'}}}}):guardarEvidencia(s,'math',raw);
 assert.equal(out.ok,false);assert.equal(s.state.writes,before);assert.equal(s.tables.has('TransversalesAportes'),false);
});
test('dates, capacities, competencies and areas retain independent originals and server-owned context',()=>{
 const s=fixture(),raw=evidencia(s,[{fecha:'2026-10-14',comp:'autonomia',cap:0,valor:'A'},{fecha:'2026-10-14',comp:'autonomia',cap:2,valor:13.5},{fecha:'2026-10-15',comp:'autonomia',cap:1,valor:'B'}]);
 raw.sessions.forEach(x=>Object.assign(x,{user:'communication',area:'Comunicación',grado:5,seccion:'B',bimestre:'II',docente:'Forged',ts:1}));raw.finales={[s.id]:{autonomia:{nivel:'AD',valor:20}}};
 const out=guardarEvidencia(s,'math',raw);assert.equal(out.ok,true);const original=JSON.stringify(s.tables.get('TransversalesAportes').rows[1]);
 const own=out.aportes[0];assert.equal(own.evidencia.sessions.length,3);own.evidencia.sessions.forEach(x=>{assert.equal(x.user,'math');assert.equal(x.area,'Matemática');assert.equal(x.grado,2);assert.equal(x.seccion,'A');assert.equal(x.bimestre,'I');assert.equal(x.docente,'Synthetic Math');assert.ok(x.ts>1);});
 const numeric=Object.values(own.evidencia.grades).map(g=>g[s.id]).find(g=>g.modo==='num');assert.equal(numeric.valor,14);assert.equal(numeric.nivel,'A');assert.equal(own.valores[s.id].autonomia.valor,14);assert.equal(own.valores[s.id].tic,undefined);
 guardarEvidencia(s,'communication',evidencia(s,[{comp:'autonomia',valor:'C'}]));assert.equal(JSON.stringify(s.tables.get('TransversalesAportes').rows[1]),original);
 assert.equal(s.load('pip').aportes.find(a=>a.user==='communication').valores[s.id].autonomia.nivel,'C');
});
test('evidence result matches real Registro notaDesdeSesiones, letter midpoints and rounded average for each competence',()=>{
 const s=fixture(),items=[{valor:'AD'},{cap:1,valor:'C'},{fecha:'2026-10-15',valor:13.5},{comp:'autonomia',valor:'B'},{comp:'autonomia',cap:1,valor:8}],out=guardarEvidencia(s,'math',evidencia(s,items)),own=out.aportes[0],f=client();
 f.run("let store={sessions:[],grades:{}};function ctxBase(){return {nivel:'secundaria',bim:'I',grado:2,seccion:'A',area:'Matemática'}};function identidadAlumno(id){return id};function leerNota(map,k){return map[k]}");
 for(const name of ['numToLetter','letterToNum','promedioNums','notaDesdeSesiones'])f.run(extract('registro.html',name));
 f.c.input=clone(own.evidencia);f.c.names=clone(s.c.registroEvaluacion_().COMP);f.run("input.sessions.forEach(s=>{const comp=names[s.comp];store.sessions.push({nivel:'secundaria',bim:'I',grado:2,seccion:'A',area:'Matemática',comp,capacidad:s.capacidad,fecha:s.fecha});Object.entries(input.grades[JSON.stringify([s.fecha,s.comp,s.capacidad])]||{}).forEach(([id,g])=>{store.grades[['secundaria','I',2,'A','Matemática',comp,s.capacidad,s.fecha,id].join('||')]=g;});})");
 for(const comp of ['tic','autonomia']){const original=f.c.notaDesdeSesiones(f.c.names[comp],s.id);assert.equal(own.valores[s.id][comp].nota20,original.nota);assert.equal(own.valores[s.id][comp].nivel,original.letra);}
 assert.notEqual(own.valores[s.id].tic.valor,own.valores[s.id].autonomia.valor);
});
test('ten Math evidences count as one area vote, equal to a single Communication evidence',()=>{
 const s=fixture();guardarEvidencia(s,'math',evidencia(s,Array.from({length:10},(_,i)=>({fecha:'2026-10-'+(14+i),valor:'A'}))));guardarEvidencia(s,'communication',evidencia(s,[{valor:'B'}]));
 const r=s.load('pip').resultados[s.id].tic.resumen;assert.equal(r.recibidos,2);assert.deepEqual(clone(r.conteo),{AD:0,A:1,B:1,C:0});assert.equal(r.sugerencia,null);assert.equal(r.empate,true);
 assert.equal(s.load('pip').aportes.find(a=>a.user==='math').estadisticas[s.id].tic.evidencias,10);assert.equal(s.load('pip').resultados[s.id].autonomia.resumen.recibidos,0);
});
test('selected but ungraded capacities are Sin aporte and leave each competence independently pending',()=>{
 const s=fixture(),out=guardarEvidencia(s,'math',evidencia(s,[{comp:'tic'},{comp:'autonomia',valor:'A'}]));assert.equal(out.aportes[0].valores[s.id].tic,undefined);assert.equal(out.aportes[0].estadisticas[s.id].tic.evidencias,0);
 const all=s.load('pip');assert.ok(all.resultados[s.id].tic.resumen.faltan.includes('Matemática'));assert.ok(!all.resultados[s.id].autonomia.resumen.faltan.includes('Matemática'));
});
for(const change of ['add-date','change-grade-same-level','change-capacity','remove-evidence'])test('evidence '+change+' invalidates Tutor/AIP even if aggregate stays A; append history survives',()=>{
 const s=fixture();guardarEvidencia(s,'math',evidencia(s,[{valor:14},{cap:1,valor:15}]));s.final('math','A');s.confirm('math','confirmtransversaltutor');s.confirm('pip','confirmtransversalaip');
 const before=s.load('pip'),own=s.load('math').aportes.find(a=>a.user==='math'),raw=clone(own.evidencia),original=JSON.stringify(s.tables.get('TransversalesAportes').rows[1]),core=s.c.registroEvaluacion_();
 if(change==='add-date'){const session={fecha:'2026-10-15',comp:'tic',capacidad:core.CAPS.tic[0]};raw.sessions.push(session);raw.grades[core.sessionKey(session)]={[s.id]:{modo:'letra',valor:'A'}};}
 if(change==='change-grade-same-level')raw.grades[core.sessionKey(raw.sessions[0])][s.id]={modo:'num',valor:15};
 if(change==='change-capacity'){const first=raw.sessions[0],grades=raw.grades[core.sessionKey(first)];delete raw.grades[core.sessionKey(first)];first.capacidad=core.CAPS.tic[2];raw.grades[core.sessionKey(first)]=grades;}
 if(change==='remove-evidence'){const first=raw.sessions.shift();delete raw.grades[core.sessionKey(first)];}
 assert.equal(guardarEvidencia(s,'math',raw).ok,true);const after=s.load('pip');assert.equal(after.aportes[0].valores[s.id].tic.nivel,'A');assert.notEqual(after.versionAportes,before.versionAportes);assert.equal(after.resultados[s.id].tic.listo,false);assert.match(after.resultados[s.id].tic.estado,/Requiere nueva confirmación/);assert.deepEqual(clone(after.resultados[s.id].tic.final),clone(before.resultados[s.id].tic.final));assert.equal(JSON.stringify(s.tables.get('TransversalesAportes').rows[1]),original);
});
test('Tutor and AIP can read originals but cannot edit another teacher evidence or forge academic scope',()=>{
 const s=fixture();guardarEvidencia(s,'communication',evidencia(s,[{valor:'B'}]));const original=JSON.stringify(s.tables.get('TransversalesAportes').rows),raw=evidencia(s,[{valor:'A'}]);
 assert.ok(s.load('pip').aportes[0].evidencia);assert.ok(s.load('math').aportes[0].evidencia);
 for(const [user,args] of [['pip',{area:'Comunicación'}],['math',{area:'Comunicación'}],['math',{grado:2,seccion:'B'}],['admin',{}],['auxiliar',{}],['test-primary',{}]])assert.equal(guardarEvidencia(s,user,raw,args).ok,false);
 assert.equal(JSON.stringify(s.tables.get('TransversalesAportes').rows),original);assert.equal(s.load('ef').aportes.length,0);
});
for(const state of ['cerrado','bloqueado'])test(state+': existing evidence, deletion, addition and grade changes are read-only',()=>{
 const s=fixture();guardarEvidencia(s,'math',evidencia(s,[{valor:'A'}]));s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({bimestres:{I:state}});const original=JSON.stringify(s.tables.get('TransversalesAportes').rows);
 assert.equal(guardarEvidencia(s,'math',{schema:1,sessions:[],grades:{}}).code,'PERIOD');assert.equal(guardarEvidencia(s,'math',evidencia(s,[{valor:'B'}])).code,'PERIOD');assert.equal(s.load('math').abierto,false);assert.equal(JSON.stringify(s.tables.get('TransversalesAportes').rows),original);
});
test('direct legacy contributions are retained as historical without becoming fabricated evidence or votes',()=>{
 const s=fixture(),raw={[s.id]:{tic:{modo:'letra',valor:'AD',nivel:'AD'}}};s.tables.set('TransversalesAportes',s.sheet('TransversalesAportes',[['clave','bimestre','grado','seccion','areaOrigen','docente','user','ts','json'],['secundaria||I||2||A||Matemática||math','I',2,'A','Matemática','Synthetic Math','math',1001,JSON.stringify(raw)]]));
 const original=JSON.stringify(s.tables.get('TransversalesAportes').rows),out=s.load('math');assert.deepEqual(clone(out.aportes[0].legacyValores),raw);assert.equal(out.aportes[0].evidencia,null);assert.equal(out.resultados[s.id].tic.resumen.recibidos,0);assert.equal(JSON.stringify(s.tables.get('TransversalesAportes').rows),original);
});

function evidenciaUI(s,closed=false){
 const f=client('docente'),el=dom(),signed=s.token('math');f.session.user='math';f.session.token=signed;f.storage.setItem('ie22375_session_v1',JSON.stringify(f.session));f.c.document.createElement=el;
 const requests=[];f.c.window.IEStudents.fetchJSON=async(url,options)=>{requests.push({url,options});return s.post(JSON.parse(options.body));};f.run(read('transversales-client.js'));
 const box=el('div'),data=clone(s.load('math'));if(closed)data.abierto=false;const active=f.c.window.IETransversales.editor(box,data,{...s.ctx,area:'Matemática'},false);return {f,box,active,requests};
}
test('real Registro transversal UI selects multiple capacities, keeps two dates, saves one block and reopens previous evidence',async()=>{
 const s=fixture(),ui=evidenciaUI(s),{box,active,requests}=ui;
 const date=box.querySelectorAll('input').find(e=>e.type==='date');date.value='2026-10-14';date.onchange();
 const comp=box.querySelectorAll('select')[1];comp.value='autonomia';comp.onchange();assert.equal(box.querySelectorAll('input').filter(e=>e.type==='checkbox').length,3);
 const checks=box.querySelectorAll('input').filter(e=>e.type==='checkbox');checks[0].checked=checks[2].checked=true;box.querySelectorAll('button').find(b=>b.textContent==='Agregar capacidades a la grilla').onclick();
 const inputs=box.querySelectorAll('select').slice(2);assert.equal(inputs.length,2);inputs[0].value='A';inputs[0].onchange();inputs[1].value='B';inputs[1].onchange();assert.equal(active.dirty(),true);
 date.value='2026-10-15';date.onchange();box.querySelectorAll('input').filter(e=>e.type==='checkbox')[1].checked=true;box.querySelectorAll('button').find(b=>b.textContent==='Agregar capacidades a la grilla').onclick();
 const input=box.querySelectorAll('select')[2];input.value='AD';input.onchange();await box.querySelectorAll('button').find(b=>b.textContent==='Guardar sesión y evidencias del área').onclick();
 assert.equal(requests.length,1);const payload=JSON.parse(requests[0].options.body);assert.equal(payload.evidencia.sessions.length,3);assert.equal(Object.keys(payload.evidencia.grades).length,3);assert.equal(active.dirty(),false);
 const own=s.load('math').aportes.find(a=>a.user==='math');assert.equal(own.estadisticas[s.id].autonomia.capacidades.length,3);assert.equal(own.estadisticas[s.id].autonomia.evidencias,3);assert.equal(own.valores[s.id].autonomia.nivel,'A');assert.equal(own.valores[s.id].tic,undefined);
 box.querySelectorAll('button').find(b=>b.textContent.startsWith('2026-10-14')).onclick();assert.equal(box.querySelectorAll('select').length,4);assert.equal(box.querySelectorAll('select')[2].value,'A');assert.equal(box.querySelectorAll('select')[3].value,'B');assert.equal(requests.length,1);
 const reopened=evidenciaUI(s);assert.equal(reopened.box.querySelectorAll('select')[2].value,'A');assert.equal(reopened.active.dirty(),false);
});
test('real evidence UI single capacity and deleting a session require save; letters/numbers view does not mutate stored notes',async()=>{
 const s=fixture();guardarEvidencia(s,'math',evidencia(s,[{valor:'A'},{fecha:'2026-10-15',valor:18}]));const original=JSON.stringify(s.tables.get('TransversalesAportes').rows),ui=evidenciaUI(s),{box,active,requests}=ui;
 const mode=box.querySelectorAll('select')[0];mode.value='num';mode.onchange();assert.equal(box.querySelectorAll('input').find(e=>e.type==='number').value,15);mode.value='letra';mode.onchange();assert.equal(active.dirty(),false);assert.equal(JSON.stringify(s.tables.get('TransversalesAportes').rows),original);
 box.querySelectorAll('button').find(b=>b.textContent==='Quitar capacidad y sus notas').onclick();assert.equal(active.dirty(),true);assert.equal(requests.length,0);assert.equal(JSON.stringify(s.tables.get('TransversalesAportes').rows),original);
 await box.querySelectorAll('button').find(b=>b.textContent==='Guardar sesión y evidencias del área').onclick();assert.equal(requests.length,1);assert.equal(s.load('math').aportes[0].evidencia.sessions.length,1);assert.equal(s.load('math').aportes[0].valores[s.id].tic.nivel,'AD');assert.equal(s.tables.get('TransversalesAportes').rows.length,3);
});
test('closed evidence grid allows consulting dates/mode but never adding/deleting/grading/saving',async()=>{
 const s=fixture();guardarEvidencia(s,'math',evidencia(s,[{valor:'A'}]));const {box,active,requests}=evidenciaUI(s,true);
 const add=box.querySelectorAll('button').find(b=>b.textContent==='Agregar capacidades a la grilla'),del=box.querySelectorAll('button').find(b=>b.textContent==='Quitar capacidad y sus notas'),save=box.querySelectorAll('button').find(b=>b.textContent==='Guardar sesión y evidencias del área');assert.ok(add.disabled&&del.disabled&&save.disabled);
 assert.equal(box.querySelectorAll('select')[0].disabled,false);assert.equal(box.querySelectorAll('select')[2].disabled,true);
 add.onclick();del.onclick();await save.onclick();assert.equal(active.dirty(),false);assert.equal(requests.length,0);
});
test('Tutor/AIP evidence detail renders original capacity/date grades as readonly while only final decisions are editable',()=>{
 const s=fixture();guardarEvidencia(s,'math',evidencia(s,[{valor:13.5}]));const f=client('pip'),el=dom();f.c.document.createElement=el;f.run(read('transversales-client.js'));const box=el('div');f.c.window.IETransversales.editor(box,clone(s.load('pip')),s.ctx,true);
 const detail=box.querySelectorAll('details')[0];assert.match(detail.querySelectorAll('summary')[0].textContent,/Ver evidencias de Matemática/);assert.match(detail.querySelectorAll('p')[1].textContent,/2026-10-14.*Personaliza entornos virtuales.*14 → A/);assert.equal(detail.querySelectorAll('select').length,0);assert.equal(detail.querySelectorAll('input').length,0);assert.equal(detail.querySelectorAll('button').length,0);
});

test('large bimestral evidence blocks stay below Sheets cell limits and reconstruct without losing originals',()=>{
 const s=fixture(),students=Array.from({length:30},(_,i)=>({nivel:'secundaria',grado:2,seccion:'A',orden:i+1,nombre:'Synthetic Large Student '+i,idSiagie:'large-'+i})),base=s.post({action:'loadstudents',token:s.admin});
 assert.equal(s.post({action:'savestudents',token:s.admin,version:base.version,base:{primaria:s.base.primaria,secundaria:{estudiantes:students}}}).ok,true);
 const items=[];for(let day=1;day<=15;day++)for(let cap=0;cap<4;cap++)for(let i=0;i<30;i++)items.push({fecha:'2026-10-'+String(day).padStart(2,'0'),cap,id:'id:large-'+i,valor:15});
 const out=guardarEvidencia(s,'math',evidencia(s,items));assert.equal(out.ok,true);const sh=s.tables.get('TransversalesAportes');assert.ok(sh.rows.length>3);sh.rows.slice(1).forEach(row=>assert.ok(String(row[8]).length<50000));
 const own=s.load('math').aportes[0];assert.equal(own.evidencia.sessions.length,60);assert.equal(Object.values(own.evidencia.grades).reduce((n,g)=>n+Object.keys(g).length,0),1800);assert.equal(own.estadisticas['id:large-0'].tic.evidencias,60);assert.equal(own.valores['id:large-29'].tic.nivel,'A');
 const snapshot=s.load('pip'),finales={};students.forEach(al=>{finales['id:'+al.idSiagie]={};for(const comp of ['tic','autonomia'])finales['id:'+al.idSiagie][comp]={modo:'letra',valor:'A',justificacion:'Evidencias sintéticas de prueba. '.repeat(45)};});
 assert.equal(s.route('savetransversalfinal','pip',{version:snapshot.version,versionAportes:snapshot.versionAportes,finales}).ok,true);assert.equal(s.confirm('math','confirmtransversaltutor').ok,true);const confirmed=s.confirm('pip','confirmtransversalaip');assert.equal(confirmed.resultados['id:large-29'].tic.listo,true);
 const consolidated=s.tables.get('TransversalesConsolidado');assert.ok(consolidated.rows.length>5);consolidated.rows.slice(1).forEach(row=>assert.ok(String(row[6]).length<50000));
 const before=s.load('pip'),rows=JSON.stringify(sh.rows),append=sh.appendRow;let writes=0;sh.appendRow=function(row){if(++writes===2)throw Error('Synthetic interrupted append');return append.call(sh,row);};
 const changed=clone(own.evidencia),key=Object.keys(changed.grades)[0];changed.grades[key]['id:large-0']={modo:'num',valor:14};assert.equal(guardarEvidencia(s,'math',changed).ok,false);sh.appendRow=append;
 const after=s.load('pip');assert.equal(after.versionAportes,before.versionAportes);assert.deepEqual(clone(after.aportes[0].evidencia),clone(before.aportes[0].evidencia));assert.ok(JSON.stringify(sh.rows).startsWith(rows.slice(0,-1)));
 // Missing part in a committed block must fail closed rather than returning invented/old results.
 const firstPart=sh.rows.findIndex(row=>String(row[0]).includes('||@parte||'));sh.rows.splice(firstPart,1);assert.equal(s.load('pip').ok,false);assert.match(s.load('pip').error,/incompleto/);
});
