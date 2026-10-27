'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),normalize=require('./notas2-session-authorization-boundary.cjs');
for(const file of ['apps-script/Codigo.js','registro-connection.js','registro-notas2-prefetch.js','registro-notas2-ui.js'])test('strict scope boundary preserves every unrelated byte: '+file,()=>{
 const raw=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),before=execFileSync('git',['show','2b43d48:'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');assert.equal(normalize(file,raw),before);assert.equal(normalize(file,before),before);assert.notEqual(normalize(file,raw+'\n/* unreviewed */'),before);
});
for(const [file,a,b]of [['registro-notas2-ui.js',"a.role!=='docente'",'false'],['registro-connection.js','o.verify({review,valid,force})','o.verify({review,valid,force:false})'],['apps-script/Codigo.js',"access.sesion.role==='docente'",'true'],['registro-notas2-prefetch.js','candidate.expires>now()','true']])test('historical allowlist cannot conceal a scope/security mutation '+file,()=>{
 const raw=fs.readFileSync(file,'utf8');assert.ok(raw.includes(a));assert.notEqual(normalize(file,raw.replace(a,b)),normalize(file,raw));
});
