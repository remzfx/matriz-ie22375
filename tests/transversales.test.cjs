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
    const area=user==='communication'?'Comunicación':user==='ef'?'Educación Física':'Matemática',before=load(user);
    const prev=(before.aportes||[]).find(a=>a.user===user&&a.area===area);
    return route('savetransversalaporte',user,{area,version:prev?prev.version:0,valores:{[id]:{tic:{modo,valor:value},autonomia:{modo,valor:value}}}});
  }
  function final(user,value,justificacion='Evidencias colegiadas del bimestre',snapshot=load(user)){
    return route('savetransversalfinal',user,{version:snapshot.version,versionAportes:snapshot.versionAportes,finales:{[id]:{tic:{modo:typeof value==='number'?'num':'letra',valor:value,justificacion},autonomia:{modo:typeof value==='number'?'num':'letra',valor:value,justificacion}}}});
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
  const records=s.load('math').aportes;assert.equal(records.find(a=>a.area==='Matemática').valores[s.id].tic.nota20,18);assert.equal(records.find(a=>a.area==='Comunicación').valores[s.id].tic.valor,'A');
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
test('Registro preserves an unsaved transversal draft on context changes or reopen until explicitly discarded',async()=>{
 const f=client('docente');f.run("let areaActual='Matemática',registroTransSolicitud=0,registroTransEditor={dirty:()=>true},registroTransContexto={bim:'III',grado:2,seccion:'A',area:'Matemática'};function ctxBase(){return {nivel:'secundaria',bim:'III',grado:2,seccion:'A',area:areaActual}};function areas(){return ['Matemática']}");
 f.c.confirm=()=>false;f.run(extract('registro.html','cerrarTransversalesRegistro'));f.run(extract('registro.html','abrirTransversalesRegistro'));
 f.elements.set('registroTransRows',{innerHTML:'draft remains'});f.c.IETransversales={request:()=>{throw Error('must not load');}};
 f.run("areaActual='Comunicación'");assert.equal(f.c.cerrarTransversalesRegistro(),false);assert.equal(f.run('areaActual'),'Matemática');assert.equal(f.elements.get('registroTransRows').innerHTML,'draft remains');assert.equal(f.run('registroTransEditor.dirty()'),true);
 await f.c.abrirTransversalesRegistro();assert.equal(f.elements.get('registroTransRows').innerHTML,'draft remains');
 f.c.confirm=()=>true;assert.equal(f.c.cerrarTransversalesRegistro(),true);assert.equal(f.elements.get('registroTransRows').innerHTML,'');assert.equal(f.run('registroTransEditor'),null);
});

const exportFixture=new Function('require','__dirname',read('tests/registro-roster-identity.test.cjs').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
for(const stage of ['confirmed','confirmed-C','obsolete','pending'])test('real Admin SIAGIE export '+stage+' uses only current confirmed finals and preserves academic export',async()=>{
 const server=fixture();['math','communication','ef'].forEach(u=>server.aporte(u,stage==='confirmed-C'?'C':'A'));server.final('math',stage==='confirmed-C'?'C':13,stage==='confirmed-C'?'':undefined);server.confirm('math','confirmtransversaltutor');
 if(stage!=='pending')server.confirm('pip','confirmtransversalaip');if(stage==='obsolete')server.aporte('ef','B');
 const f=exportFixture(),ctx={nivel:'secundaria',bim:'I',grado:2,seccion:'A'},academic={finales:{'secundaria||I||2||A||Matemática||Resuelve||id:synthetic-a':{nivel:'AD'}}};
 const sheet=()=>({'!ref':'A1:E3',A3:{v:'synthetic-a'},C3:{v:'Synthetic Student A'},D3:{v:'C'},E3:{v:'Legacy conclusion must not survive'}}),mate=sheet(),tic=sheet(),auto=sheet(),wb={SheetNames:['MATE','DESEN TIC','GEST AUTO'],Sheets:{MATE:mate,'DESEN TIC':tic,'GEST AUTO':auto}};
 let exported=0,reads=0;
 f.c.XLSX={read:()=>wb,write:()=>{exported++;return new Uint8Array()},utils:{decode_range:()=>({s:{r:0},e:{r:2}}),encode_cell:({r,c})=>String.fromCharCode(65+c)+(r+1)}};
 f.c.Blob=Blob;f.c.atob=atob;f.c.URL={createObjectURL:()=> 'synthetic'};f.c.document.createElement=()=>({click(){}});f.c.confirm=()=>true;
 f.c.ctxTpl=()=>ctx;f.c.areasDeNivel=()=>['Matemática','Competencias Transversales'];f.c.COMPS_SIAGIE={'Matemática':['Resuelve'],'Competencias Transversales':['TIC','Autonomía']};
 f.c.areaDeHojaAdm=name=>name==='MATE'?{area:'Matemática',only:null}:{area:'Competencias Transversales',only:name==='DESEN TIC'?0:1};
 f.c.normNomAdm=f.c.IEStudentIdentity.normalizarNombre;
 f.c.fetchRegAula=async()=>[{area:'Matemática',payload:academic},{area:'Competencias Transversales',payload:{finales:{'secundaria||I||2||A||Competencias Transversales||TIC||id:synthetic-a':{nivel:'AD'}}}}];
 f.c.IEStudents.loadRoster=async()=>({primaria:{estudiantes:[]},secundaria:{estudiantes:server.roster}});
 f.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify({ok:true,b64:Buffer.from('synthetic').toString('base64')})});f.c.CLOUD_API_URL='synthetic';
 f.c.IETransversales={request:async(action,data)=>{reads++;return server.route(action,'admin',data)}};
 for(const name of ['letraDesdePayload','concDesdePayload','vaciarSiagieOficial'])f.run(extract('admin.html',name));
 await f.c.vaciarSiagieOficial();assert.equal(exported,1);assert.equal(reads,2);assert.equal(mate.D3.v,'AD');
 for(const ws of [tic,auto]){assert.equal(ws.E3,undefined);if(stage.startsWith('confirmed'))assert.equal(ws.D3.v,stage==='confirmed-C'?'C':'B');else assert.equal(ws.D3,undefined);}
 if(!stage.startsWith('confirmed'))assert.match(f.el('tplMsg').textContent,/Transversales pendientes:.*Synthetic Student A/);
});

function dom(){
 function el(tag){const e={tagName:tag,children:[],value:'',disabled:false,textContent:'',setAttribute(){},appendChild(x){this.children.push(x);return x},replaceChildren(){this.children=[]},querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)])}};return e;}
 return el;
}
test('real contribution editor keeps numeric originals when switching view and edits only its own area/user',async()=>{
 const server=fixture();server.aporte('math',18);server.aporte('communication',14);
 const f=client('docente'),el=dom();f.session.user='math';f.storage.setItem('ie22375_session_v1',JSON.stringify(f.session));f.c.document.createElement=el;
 f.run(read('transversales-client.js'));const box=el('div'),editor=f.c.window.IETransversales.editor(box,clone(server.load('math')),{...server.ctx,area:'Matemática'},false);
 const selector=box.querySelectorAll('select')[0];assert.equal(box.querySelectorAll('select')[1].value,'AD');selector.value='num';selector.onchange();assert.equal(box.querySelectorAll('input')[0].value,18);assert.equal(editor.dirty(),false);
 box.querySelectorAll('input')[0].value='13';box.querySelectorAll('input')[0].onchange();assert.equal(editor.dirty(),true);
 let payload;const signed=server.token('math');f.c.window.IEStudents.validToken=()=>signed;f.c.window.IEStudents.fetchJSON=async(url,options)=>{payload=JSON.parse(options.body);const result=server.post(payload);assert.equal(result.ok,true,result.error);return result};
 await box.querySelectorAll('button')[0].onclick();assert.equal(payload.action,'savetransversalaporte');assert.equal(payload.valores[server.id].tic.valor,'13');assert.equal(payload.valores[server.id].autonomia.valor,18);assert.equal(editor.dirty(),false);
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
