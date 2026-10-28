'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),core=require('../registro-notas2.js');
const fixture=new Function('require','__dirname',fs.readFileSync('tests/backend-notas2.test.cjs','utf8').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
const copy=x=>JSON.parse(JSON.stringify(x));
test('two simulated PCs use the new scope but backend panel CAS still rejects stale confirmed versions',async()=>{
 const s=fixture(true),scope=s.post({action:'academicstate',token:s.secondary,contextAuthorization:1}).contextAuthorization;
 assert.ok(scope.contexts.includes(s.key));const calls=[];
 function pc(){const data=Object.fromEntries(Object.values(core.fields).flat().map(f=>[f,f==='sessions'?[]:{}]));const client=core.create({key:s.key,binding:()=>s.key,authorized:()=>scope.expiresAt>Date.now()&&scope.contexts.includes(s.key),readonly:()=>false,capture:()=>data,apply:p=>Object.assign(data,p),request:async body=>{calls.push(body.action);return s.request(body.action,body);},confirm:()=>false});return {client,data};}
 const A=pc(),B=pc();assert.equal(await A.client.load(),true);assert.equal(await B.client.load(),true);assert.equal(s.state.writes,0);
 Object.assign(A.data,s.averages());Object.assign(B.data,s.averages({nota20:12,nivel:'B',origen:'numero',ts:1}));
 assert.equal(await A.client.save('promedios'),true);const previous=copy(B.data);assert.equal(await B.client.save('promedios'),false);
 assert.equal(B.client.status().state,'conflict');assert.deepEqual(B.data,previous);assert.equal(s.payload().finales[s.fk].nivel,'A');assert.equal(calls.filter(a=>a==='savenotas2').length,2);
});
