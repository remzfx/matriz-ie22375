'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const fixture=new Function('require',fs.readFileSync('tests/notas2-connection-integration.test.cjs','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require);
for(const denied of [false,true])test('context wait names its destination and '+(denied?'keeps denial visible without applying a reserve':'does not bypass authenticated verification'),async()=>{
 const f=fixture(),before=JSON.stringify(f.data),original=f.g.fetch;let release;
 f.nodes.finContextLoading={textContent:''};
 f.g.fetch=async(u,o)=>{if(JSON.parse(o.body).action==='academicstate'){
  await new Promise(r=>release=r);
  if(denied)return {ok:false,status:403,text:async()=>JSON.stringify({ok:false,code:'DENIED'})};
 }return original(u,o);};
 const checking=f.check();
 assert.match(f.nodes.finContextLoading.textContent,/Verificando acceso a 1.º A · Bimestre III/);
 assert.equal(f.api.readStatus().pending,true);
 assert.equal(f.api.canEdit('promedios'),false);assert.equal(JSON.stringify(f.data),before);
 assert.equal(f.requests.filter(b=>b.action==='loadnotas2').length,0);
 release();assert.equal(await checking,!denied);
 if(denied){assert.match(f.nodes.finContextLoading.textContent,/Sesión inválida/);assert.equal(f.api.current().status().panels.promedios.version,null);}
 assert.equal(f.requests.filter(b=>b.action==='savenotas2').length,0);
});
