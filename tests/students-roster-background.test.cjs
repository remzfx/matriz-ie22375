'use strict';
// Actual student module, isolated stores and fake transport. Never accesses a personal profile or backend.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const fixture=new Function('require','__dirname',fs.readFileSync('tests/students-client.test.cjs','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
async function setup(){const f=fixture('docente');await f.c.IEStudents.loadRoster('III');return f;}
for(const kind of ['missing','denied','offline','wrong-bim','invalid'])test('isolated '+kind+' roster read never changes the verified visible roster or storage',async()=>{
 const f=await setup(),before=JSON.stringify([...f.memory]),visible=JSON.stringify(f.c.IEStudents.peekRoster('III'));
 f.c.fetch=async()=>{if(kind==='offline')throw Error('Synthetic offline');return {ok:true,json:async()=>kind==='missing'?{ok:true,bimestre:'I',inicializada:true,padronInicializado:false,estudiantes:[]}:kind==='denied'?{ok:false,code:'SESSION'}:kind==='invalid'?{}:{ok:true,bimestre:'II',inicializada:true,padronInicializado:true,estudiantes:[]}};};
 await assert.rejects(f.c.IEStudents.readRoster('I'));assert.equal(JSON.stringify([...f.memory]),before);assert.equal(JSON.stringify(f.c.IEStudents.peekRoster('III')),visible);
});
test('a successful isolated read returns its confirmed bimestre but never publishes it into the visible cache',async()=>{
 const f=await setup(),before=JSON.stringify([...f.memory]);let body;
 f.c.fetch=async(_,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,bimestre:'I',version:'roster-I',inicializada:true,padronInicializado:true,estudiantes:[{nivel:'secundaria',grado:1,seccion:'A',idSiagie:'synthetic',nombre:'FICTICIO'}]})};};
 const result=await f.c.IEStudents.readRoster('I');assert.equal(result.bimestre,'I');assert.equal(result.padronInicializado,true);assert.equal(JSON.stringify([...f.memory]),before);assert.equal(f.c.IEStudents.peekRoster('I'),null);assert.equal(body.action,'loadstudents');assert.equal(body.bimestre,'I');
});
test('late isolated roster from a previous account is rejected before it can be published',async()=>{
 const f=await setup();let release;f.c.fetch=async()=>new Promise(resolve=>release=()=>resolve({ok:true,json:async()=>({ok:true,bimestre:'I',inicializada:true,padronInicializado:true,estudiantes:[]})}));
 const p=f.c.IEStudents.readRoster('I');f.memory.set('ie22375_session_v1',JSON.stringify({...f.session,token:'other-synthetic-token'}));const before=JSON.stringify([...f.memory]);release();await assert.rejects(p,e=>e.code==='SESSION');assert.equal(JSON.stringify([...f.memory]),before);
});
