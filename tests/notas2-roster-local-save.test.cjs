'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const fixture=new Function('require',fs.readFileSync('tests/notas2-ui.test.cjs','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require);
const local=require('./registro-inline-modules.cjs').load('registro-local-store.js');
function setup(){const f=fixture(),epoch='a'.repeat(32),map=new Map(),session=()=>({user:'synthetic',role:'docente'});const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,JSON.stringify({...JSON.parse(v),academicEpoch:epoch}))};f.g.registroLocal=local.create(storage,session);f.g.IEAcademicResetClient={epoch:()=>epoch};f.data.asistencia={synthetic:{marca:'P'}};return {f,epoch,map,storage};}
test('N2 attendance persistence agrees with the active generation interceptor without losing original data',()=>{const {f,epoch}=setup();f.api.persist();assert.equal(JSON.parse(f.g.registroLocal.read()).academicEpoch,epoch);f.api.persist();});
test('another tab still blocks persistence and preserves the local draft',()=>{const {f,map}=setup();f.api.persist();map.set(f.g.registroLocal.key,JSON.stringify({academicEpoch:'a'.repeat(32),asistencia:{other:'J'}}));f.data.asistencia.mine={marca:'P'};assert.throws(()=>f.api.persist(),/Otra pestaña/);assert.equal(f.data.asistencia.mine.marca,'P');assert.equal(JSON.parse(map.get(f.g.registroLocal.key)).asistencia.other,'J');});


test('epoch-compatible persistence preserves existing academic originals and confirms only attendance changes',()=>{
 const {f,map,storage,epoch}=setup();
 const original={academicEpoch:epoch,grades:{original:{nivel:'C'}},finales:{original:{nivel:'A'}},concComp:{original:{texto:'Ficticia'}}};
 storage.setItem(f.g.registroLocal.key,JSON.stringify(original));
 f.g.registroLocal=local.create(storage,()=>({user:'synthetic',role:'docente'}));
 f.api.persist();const saved=JSON.parse(map.get(f.g.registroLocal.key));
 for(const field of ['grades','finales','concComp'])assert.deepEqual(saved[field],original[field]);
 assert.equal(saved.asistencia.synthetic.marca,'P');assert.equal(saved.academicEpoch,epoch);assert.equal(f.requests.length,0);
});
test('exact reviewed persistence deltas normalize to the approved base and expose unrelated mutations',()=>{
 const normalize=require('./notas2-roster-local-save-boundary.cjs'),exec=require('node:child_process').execFileSync;
 for(const file of ['registro.html','registro-notas2-ui.js']){
  const source=fs.readFileSync(file,'utf8'),before=exec('git',['show','90b9396:'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
  assert.equal(normalize(file,source),before);
  const marker=file==='registro.html'?"throw errorPadronLocal('saveStore', e)":"if(epoch)next.academicEpoch=epoch";
  assert.ok(source.includes(marker));assert.notEqual(normalize(file,source.replace(marker,'/* unsafe mutation */')),before);
 }
});
