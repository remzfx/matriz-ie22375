'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const setup=new Function('require','__dirname',fs.readFileSync('tests/backend-read-auth.test.cjs','utf8').split('\nfor (const action')[0]+'\nreturn setup;')(require,__dirname);
function fixture(){const s=setup();s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({bimestres:{I:'abierto',II:'abierto',III:'abierto',IV:'abierto'}});return s;}
for(const role of ['primary','secondary'])test('read-only session scope is exact and bounded: '+role,()=>{
 const s=fixture(),before=JSON.stringify([...s.tables].map(([k,v])=>[k,v.rows])),r=s.post({action:'academicstate',token:s[role],contextAuthorization:1}),a=r.contextAuthorization;
 assert.equal(r.ok,true);assert.equal(a.schema,1);assert.equal(a.role,'docente');assert.equal(a.permisosVersion,1000);assert.ok(a.expiresAt>a.issuedAt&&a.expiresAt-a.issuedAt<=60000);assert.equal(a.epoch,null);
 if(role==='secondary'){assert.equal(a.contexts.length,12);for(const b of ['I','II','III','IV']){
  assert.ok(a.contexts.includes('secundaria||'+b+'||1||A||Matemática'));assert.ok(a.contexts.includes('secundaria||'+b+'||1||B||Matemática'));assert.ok(a.contexts.includes('secundaria||'+b+'||5||ÚNICA||Ciencia y Tecnología'));
  assert.ok(!a.contexts.includes('secundaria||'+b+'||1||A||Ciencia y Tecnología'));
 }}else{assert.ok(a.contexts.length>0);assert.ok(a.contexts.every(k=>k.startsWith('primaria||')&&!k.includes('Educación Física')&&!k.includes('Transversales')&&/\|\|[13]\|\|ÚNICA\|\|/.test(k)));}
 assert.equal(s.state.writes,0);assert.equal(JSON.stringify([...s.tables].map(([k,v])=>[k,v.rows])),before);
 assert.doesNotMatch(JSON.stringify(a),/pass|nombre|token|Test Primary|Test Secondary/);
});
test('closed periods are absent; optional scope does not change legacy academicstate',()=>{
 const s=fixture();s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({bimestres:{I:'cerrado',II:'bloqueado',III:'abierto'}});
 const old=s.post({action:'academicstate',token:s.secondary});assert.deepEqual(old,{ok:true,academicReset:1,epoch:null,phase:null});
 const a=s.post({action:'academicstate',token:s.secondary,contextAuthorization:1}).contextAuthorization;assert.equal(a.contexts.length,3);assert.ok(a.contexts.every(k=>k.includes('||III||')));assert.equal(s.state.writes,0);
});
for(const mode of ['expired','revoked','removed','tampered'])test(mode+' session cannot receive a scope',()=>{
 const s=fixture();let token=s.secondary;
 if(mode==='expired')token=s.token('test-secondary','docente',{exp:Date.now()-1});if(mode==='revoked')token=s.token('test-secondary','docente',{permisosVersion:999});if(mode==='removed')token=s.token('not-present');if(mode==='tampered')token+='x';
 const r=s.post({action:'academicstate',token,contextAuthorization:1});assert.equal(r.ok,false);assert.equal(r.contextAuthorization,undefined);assert.equal(s.state.writes,0);
});
test('blocked academic generation never issues a scope',()=>{
 const s=fixture();s.tables.set('AcademicResetControl',{getRange:()=>({getValues:()=>[[1,'a'.repeat(32),null,'blocked']]})});
 const r=s.post({action:'academicstate',token:s.secondary,contextAuthorization:1});assert.equal(r.phase,'blocked');assert.equal(r.contextAuthorization,undefined);assert.equal(s.state.writes,0);
});

test('scope read with missing configuration never creates a sheet or enables any period',()=>{
 const s=fixture();s.tables.delete('ConfigSistema');const before=JSON.stringify([...s.tables].map(([k,v])=>[k,v.rows]));const r=s.post({action:'academicstate',token:s.secondary,contextAuthorization:1});assert.equal(r.ok,true);assert.deepEqual(r.contextAuthorization.contexts,[]);assert.equal(s.tables.has('ConfigSistema'),false);assert.equal(s.state.writes,0);assert.equal(JSON.stringify([...s.tables].map(([k,v])=>[k,v.rows])),before);
});
