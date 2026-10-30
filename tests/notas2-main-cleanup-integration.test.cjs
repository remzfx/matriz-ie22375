'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),inline=require('./registro-inline-modules.cjs');
const approved='c8a00c8dc30d952f2ec02b03de5848f03b2abc23';
test('integration keeps retired duplicates absent and executes the approved connection implementation inline',()=>{
 for(const name of inline.names)assert.equal(fs.existsSync(name),false,name);
 const before=execFileSync('git',['show',approved+':registro-connection.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n').trim();
 assert.equal(inline.read('registro-connection.js').trim(),before);
 assert.equal(typeof inline.load('registro-connection.js').create,'function');
});
test('integration leaves SIN_PADRON, local epoch persistence and context notices exactly unchanged',()=>{
 for(const file of ['registro.html','registro-notas2-ui.js','registro-notas2.js','registro-notas2-prefetch.js']){
  const before=execFileSync('git',['show',approved+':'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
  assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),before,file);
 }
});
