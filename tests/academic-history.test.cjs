// Fictitious classes and in-memory Sheets only; never invokes production.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
function world(source){
 let fixture=read('tests/backend-write-auth.test.cjs').split('\nfor (const action')[0];
 if(source)fixture=fixture.replace(/^const source = .*;$/m,'const source = suppliedSource;');
 const s=new Function('require','__dirname','suppliedSource',fixture+'\nreturn setup();')(require,__dirname,source);
 Object.assign(s.c.Utilities,{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,value)=>[...crypto.createHash(alg).update(value).digest()]});
 const comps=s.c.registroAcademico_().catalog.secundaria['Matemática'],ctx={nivel:'secundaria',bimestre:'III',grado:1,seccion:'A',area:'Matemática'},clave='secundaria||III||1||A||Matemática';
 const roster=Array.from({length:30},(_,i)=>({nivel:'secundaria',grado:1,seccion:'A',idSiagie:'history-fake-'+i,nombre:'Estudiante Ficticio '+i,codigoEstudiante:'code-fake-'+i}));
 s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({bimestres:{III:'abierto'}});s.c.hojaEstudiantes_=()=>({});s.c.leerPadronEstudiantes_=()=>({estudiantes:roster});
 const faults={};let created=0,archiveReads=0;
 const insert=s.c.SpreadsheetApp.getActiveSpreadsheet().insertSheet;
 const ss=s.c.SpreadsheetApp.getActiveSpreadsheet();s.c.SpreadsheetApp.getActiveSpreadsheet=()=>({...ss,insertSheet(name){const sheet=insert(name);created++;let max=1000;sheet.getMaxRows=()=>max;sheet.insertRowsAfter=(after,n)=>{assert.equal(after,max);max+=n;};const range=sheet.getRange.bind(sheet);
   sheet.getRange=(r,c,nr=1,nc=1)=>{const result=range(r,c,nr,nc),get=result.getValues.bind(result),set=result.setValues.bind(result);
    result.getValues=()=>{archiveReads++;if(faults.read)throw Error('Synthetic archive read failure');return get();};
    result.setValues=values=>{assert.equal(s.state.held,true);if(faults.write){const partial=values.slice(0,1);if(faults.partial)range(r,c,1,nc).setValues(partial);throw Error('Synthetic archive write failure');}return set(values);};
    result.createTextFinder=value=>({matchEntireCell(){return this;},matchCase(){return this;},findAll:()=>sheet.rows.slice(r-1,r-1+nr).flatMap((row,i)=>String(row[c-1])===value?[{getRow:()=>r+i}]:[])});return result;};return sheet;}});
 const get=()=>{const row=s.tables.get('RegistroNotas').rows[1];return row?{version:row[7],payload:JSON.parse(row[8])}:null;};
 const payload=n=>({modeloAcademico:1,finales:Object.fromEntries(roster.flatMap(al=>comps.map(cp=>[clave+'||'+cp+'||id:'+al.idSiagie,{nivel:n===15?'A':'B',nota20:n,origen:'numero',ts:1}]))),concComp:Object.fromEntries(roster.flatMap(al=>comps.map(cp=>[clave+'||'+cp+'||id:'+al.idSiagie,{texto:'Conclusión sintética.',ts:1}]))),asistencia:{'secundaria||III||1||A||2026-10-12||id:history-fake-0':{marca:'P',ts:1}},asisFechas:{'secundaria||III||1||A':['2026-10-12']},meta:{}});
 const send=(n,extra={})=>s.post({action:'savereg',token:s.secondary,...ctx,modeloAcademico:1,identidadAcademica:1,envioIntegral:true,version:get()?.version||0,payload:payload(n),...extra});
 return {...s,ctx,clave,roster,comps,faults,get,payload,send,created:()=>created,archiveReads:()=>archiveReads};
}
test('reproduction at reviewed head: successive legitimate uploads block because history grows inside RegistroNotas',()=>{
 const before=execFileSync('git',['show','873c33109323756419ca9b697190b627f7cd252f:apps-script/Codigo.js'],{encoding:'utf8',maxBuffer:4000000}),w=world(before);
 let failedAt=0;const sizes=[];for(let i=0;i<12;i++){const response=w.send(i%2?12:15);if(!response.ok){assert.match(response.error,/límite seguro/);failedAt=i+1;break;}sizes.push(JSON.stringify(w.get().payload).length);}
 assert.ok(failedAt>1&&failedAt<=12);assert.ok(sizes.length===1||sizes.at(-1)>sizes[0]);assert.equal(w.tables.has('RegistroHistorialAcademico'),false);
 console.log('Synthetic reproduction: blocked upload '+failedAt+'; active row '+sizes[0]+' → '+sizes.at(-1)+' chars.');
});
test('60 successive teacher uploads keep the active cell bounded and every original version recoverable',()=>{
 const w=world(),versions=[],sizes=[];let initial;
 for(let i=0;i<60;i++){const previous=w.get();if(previous)versions.push(previous.version);const response=w.send(i%2?12:15);assert.equal(response.ok,true,response.error);assert.deepEqual(response.identityHistory,[]);const current=w.get();if(!initial)initial=copy(current.payload);sizes.push(JSON.stringify(current.payload).length);assert.equal(current.payload.finales[Object.keys(current.payload.finales)[0]].nota20,i%2?12:15);}
 const current=w.get(),archive=w.tables.get('RegistroHistorialAcademico'),history=copy(w.c.leerHistorialAcademico_(w.clave,current.payload.meta.academicHistory));assert.equal(history.length,59);assert.deepEqual(history.map(x=>x.version),versions);assert.ok(Math.max(...sizes)<49000);assert.ok(sizes.at(-1)<38000);assert.equal(w.created(),1);assert.ok(archive.rows.length>50);assert.ok(archive.rows.slice(1).every(row=>row[6].length<=30000));
 const restored=copy(current.payload);for(const delta of history.slice().reverse()){for(const [f,keys]of Object.entries(delta.added||{}))for(const key of keys)delete restored[f][key];for(const [f,values]of Object.entries(delta.originals||{}))Object.assign(restored[f]||=( {}),copy(values));if(delta.sessions!==null&&delta.sessions!==undefined)restored.sessions=copy(delta.sessions);}
 assert.deepEqual(restored.finales,initial.finales);assert.deepEqual(current.payload.concComp,initial.concComp);assert.deepEqual(current.payload.asistencia,initial.asistencia);assert.deepEqual(current.payload.asisFechas,initial.asisFechas);
 console.log('Fixed synthetic class: 60/60 uploads; max active cell '+Math.max(...sizes)+' chars; '+history.length+' original versions recoverable.');
});
test('no-op, rejected CAS, denied permissions, closed bimestre and read-only downloads never append history',()=>{
 const w=world();assert.equal(w.send(15).ok,true);const before=JSON.stringify(w.tables.get('RegistroNotas').rows),writes=w.state.writes;
 assert.equal(w.send(15).unchanged,true);assert.equal(w.send(12,{version:0}).code,'CONFLICT');assert.equal(w.send(12,{token:'synthetic-invalid'}).ok,false);const open=w.c.bimestreAbierto_;w.c.bimestreAbierto_=()=>false;assert.equal(w.send(12).readonly,true);w.c.bimestreAbierto_=open;
 for(let i=0;i<3;i++)assert.equal(w.post({action:'loadreg',token:w.secondary,...w.ctx}).ok,true);assert.equal(w.created(),0);assert.equal(w.state.writes,writes);assert.equal(JSON.stringify(w.tables.get('RegistroNotas').rows),before);assert.deepEqual(copy(w.c.leerHistorialAcademico_(w.clave,[])),[]);assert.equal(w.created(),0);
});
test('a lost active-write response reuses the verified archive block on explicit retry',()=>{
 const w=world();assert.equal(w.send(15).ok,true);const reg=w.tables.get('RegistroNotas'),getRange=reg.getRange.bind(reg),before=JSON.stringify(reg.rows);let fail=true;
 reg.getRange=(...args)=>{const r=getRange(...args),set=r.setValues.bind(r);r.setValues=values=>{if(fail)throw Error('Synthetic active commit failed');return set(values);};return r;};
 assert.equal(w.send(12).ok,false);assert.equal(JSON.stringify(reg.rows),before);const archive=w.tables.get('RegistroHistorialAcademico'),rows=copy(archive.rows),writes=w.state.writes;fail=false;
 assert.equal(w.send(12).ok,true);assert.deepEqual(archive.rows,rows);assert.equal(w.state.writes,writes+1);assert.equal(w.get().payload.finales[Object.keys(w.get().payload.finales)[0]].nota20,12);assert.equal(w.c.leerHistorialAcademico_(w.clave,w.get().payload.meta.academicHistory).length,1);
});
function seedLargeLegacy(w){
 const payload=w.payload(15);delete payload.concComp;assert.equal(w.send(15,{payload}).ok,true);const row=w.tables.get('RegistroNotas').rows[1],old=JSON.parse(row[8]),names=Object.keys(old.finales).slice(0,30);
 old.meta.academicHistory=[{version:0,originals:{concComp:Object.fromEntries(names.map(key=>[key,{texto:'Conclusión anterior ficticia. '.repeat(27)}]))},added:{},sessions:null}];row[8]=JSON.stringify(old);assert.ok(row[8].length<49000);return copy(old.meta.academicHistory);
}
test('partial archive failure leaves active notes and inline legacy history intact; retry retains the orphan without duplication',()=>{
 const w=world(),legacy=seedLargeLegacy(w),before=JSON.stringify(w.tables.get('RegistroNotas').rows);w.faults.write=true;w.faults.partial=true;
 const next=w.payload(12);delete next.concComp;const failed=w.send(12,{payload:next});assert.equal(failed.code,'HISTORY_ARCHIVE');assert.equal(JSON.stringify(w.tables.get('RegistroNotas').rows),before);const archive=w.tables.get('RegistroHistorialAcademico');assert.equal(archive.rows.length,2);const orphan=copy(archive.rows[1]);w.faults.write=false;
 assert.equal(w.send(12,{payload:next}).ok,true);assert.deepEqual(archive.rows[1],orphan);const history=copy(w.c.leerHistorialAcademico_(w.clave,w.get().payload.meta.academicHistory));assert.equal(history.length,legacy.length+1);assert.deepEqual(history.slice(0,legacy.length),legacy);
});
for(const failure of ['read','missing','corrupt','wrong-context'])test('archive '+failure+' failure rejects a new upload without losing current data or returning false recovery',()=>{
 const w=world();assert.equal(w.send(15).ok,true);assert.equal(w.send(12).ok,true);const current=w.get(),ref=current.payload.meta.academicHistory[0],archive=w.tables.get('RegistroHistorialAcademico'),before=JSON.stringify(w.tables.get('RegistroNotas').rows);
 if(failure==='read')w.faults.read=true;else if(failure==='missing')archive.rows.splice(ref.row-1,ref.parts);else if(failure==='corrupt')archive.rows[ref.row-1][6]+='changed';else archive.rows[ref.row-1][1]='different-synthetic-context';
 assert.equal(w.send(15).code,'HISTORY_ARCHIVE');assert.equal(JSON.stringify(w.tables.get('RegistroNotas').rows),before);assert.throws(()=>w.c.leerHistorialAcademico_(w.clave,current.payload.meta.academicHistory));
});
test('client cannot replace the archive pointer/history, and teacher reads/acks never expose originals',()=>{
 const w=world();assert.equal(w.send(15).ok,true);assert.equal(w.send(12).ok,true);const ref=copy(w.get().payload.meta.academicHistory[0]),payload=w.payload(15);payload.meta.academicHistory=[{academicArchive:1,id:'forged'}];assert.equal(w.send(15,{payload}).ok,true);
 const current=w.get(),history=w.c.leerHistorialAcademico_(w.clave,current.payload.meta.academicHistory);assert.equal(history.length,2);assert.ok(w.tables.get('RegistroHistorialAcademico').rows.some(row=>row[0]===ref.id));
 const teacher=w.post({action:'loadreg',token:w.secondary,...w.ctx});assert.equal(teacher.ok,true);assert.deepEqual(teacher.items[0].payload.meta.academicHistory,[]);assert.doesNotMatch(JSON.stringify(teacher),/academicArchive|originals|sha256/);
});
test('a full current payload is rejected before creating an archive; original notes remain available',()=>{
 const w=world();assert.equal(w.send(15).ok,true);const before=JSON.stringify(w.tables.get('RegistroNotas').rows),payload=w.payload(12);payload.meta.observacion='x'.repeat(49000);const response=w.send(12,{payload});assert.equal(response.ok,false);assert.match(response.error,/límite seguro/);assert.equal(w.created(),0);assert.equal(JSON.stringify(w.tables.get('RegistroNotas').rows),before);
});
test('schema collision is not overwritten, and archive capacity grows by adding empty rows only',()=>{
 const w=world();assert.equal(w.send(15).ok,true);const sh=w.c.SpreadsheetApp.getActiveSpreadsheet().insertSheet('RegistroHistorialAcademico');sh.appendRow(['other-schema']);const before=copy(sh.rows);assert.equal(w.send(12).code,'HISTORY_ARCHIVE');assert.deepEqual(sh.rows,before);
 sh.rows[0]=['id','clave','version','parte','total','sha256','json'];let max=1,growth=0;sh.getMaxRows=()=>max;sh.insertRowsAfter=(after,n)=>{assert.equal(after,max);growth+=n;max+=n;};assert.equal(w.send(12).ok,true);assert.ok(growth>0);assert.equal(w.c.leerHistorialAcademico_(w.clave,w.get().payload.meta.academicHistory).length,1);
});
test('chunk boundaries retain full Unicode text and read-only recovery validates a whole chain',()=>{
 const w=world(),legacy=seedLargeLegacy(w),row=w.tables.get('RegistroNotas').rows[1],p=JSON.parse(row[8]);p.meta.academicHistory[0].originals.unicode='A'.repeat(29000)+'😀ñ\n" & <ficticio>';row[8]=JSON.stringify(p);
 const next=w.payload(12);delete next.concComp;assert.equal(w.send(12,{payload:next}).ok,true);const archive=w.tables.get('RegistroHistorialAcademico');for(const r of archive.rows.slice(1)){assert.ok(r[6].startsWith('j:'));assert.ok(!/[\uD800-\uDBFF]$/.test(r[6]));}const writes=w.state.writes,history=copy(w.c.leerHistorialAcademico_(w.clave,w.get().payload.meta.academicHistory));assert.equal(history[0].originals.unicode,p.meta.academicHistory[0].originals.unicode);assert.deepEqual(history[0].originals.concComp,legacy[0].originals.concComp);assert.equal(w.state.writes,writes);
});
test('real client: lost acknowledgement, automatic download and a new PC recover confirmed notes without another upload',async()=>{
 const w=world();assert.equal(w.send(15).ok,true);const sessions=new Function('require','__dirname',read('tests/a1-diagnostic-sessions.test.cjs').split('\ntest(')[0]+'\nreturn {session,cloud};')(require,__dirname);let posts=0;
 function device(){const f=sessions.session(sessions.cloud()),c=f.c;c.estudiantes=()=>w.roster;c.getLoginSession=()=>({role:'docente',token:w.secondary});c.fetchLecturaNube=async()=>({status:200,text:async()=>JSON.stringify(w.post({action:'loadreg',token:w.secondary,...w.ctx}))});c.fetch=async(url,opts)=>{posts++;const response=w.post(JSON.parse(opts.body));assert.equal(response.ok,true,response.error);throw Error('Synthetic lost acknowledgement');};return f;}
 const a=device();assert.equal(await a.c.bajarRegistroNube({automatico:true}),true);a.c.store.finales=copy(w.payload(12).finales);a.c.saveStore();assert.equal(await a.c.subirRegistroNube(),false);assert.equal(posts,1);assert.ok(w.get().payload.meta.academicHistory[0].academicArchive);
 const archiveBefore=JSON.stringify(w.tables.get('RegistroHistorialAcademico').rows);assert.equal(await a.c.bajarRegistroNube({automatico:true}),true);const b=device();assert.equal(await b.c.bajarRegistroNube({automatico:true}),true);for(const key of Object.keys(w.payload(12).finales))assert.equal(b.c.store.finales[key].nota20,12);assert.equal(posts,1);assert.equal(b.c.dirty,false);assert.equal(a.c.dirty,false);assert.equal(JSON.stringify(w.tables.get('RegistroHistorialAcademico').rows),archiveBefore);
});
test('gradual single-cell edits retain recent inline history and earlier blocks in exact order, without no-op writes',()=>{
 const w=world(),versions=[];assert.equal(w.send(15).ok,true);const key=Object.keys(w.payload(15).finales)[0];
 for(let i=0;i<100;i++){versions.push(w.get().version);const payload=w.payload(15);payload.finales[key]={nivel:i%2?'A':'B',nota20:i%2?15:12,origen:'numero',ts:i};const response=w.send(15,{payload});assert.equal(response.ok,true,response.error);assert.ok(JSON.stringify(w.get().payload).length<49000);}
 const current=w.get(),history=copy(w.c.leerHistorialAcademico_(w.clave,current.payload.meta.academicHistory));assert.equal(history.length,100);assert.deepEqual(history.map(x=>x.version),versions);assert.ok(current.payload.meta.academicHistory[0].academicArchive);assert.ok(current.payload.meta.academicHistory.length>1);const writes=w.state.writes,reads=w.archiveReads();assert.equal(w.send(15,{payload:current.payload}).unchanged,true);assert.equal(w.state.writes,writes);assert.equal(w.archiveReads(),reads);
});
test('legacy client cannot introduce a forged server-managed archive reference when creating a row',()=>{
 const w=world(),payload=w.payload(15);payload.meta={observacion:'Preserved synthetic field',academicHistory:[{academicArchive:1,id:'foreign-ref'}]};const response=w.send(15,{identidadAcademica:undefined,payload});assert.equal(response.ok,true,response.error);assert.equal(w.get().payload.meta.academicHistory,undefined);assert.equal(w.get().payload.meta.observacion,'Preserved synthetic field');assert.equal(w.created(),0);
});
