'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const before=execFileSync('git',['show','47d357a:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const after=fs.readFileSync(path.join(__dirname,'..','registro.html'),'utf8').replace(/\r\n/g,'\n');
const dirty="function markDirty() {\n  dirty = true;\n}\n",noop="function renderChipsCaps() { /* las columnas de la grilla ya muestran competencia y capacidad */ }\n";
test('E1 production change is exclusively two dead declarations and eight empty calls',()=>{
 assert.equal(before.split(dirty).length-1,1);assert.equal(before.split(noop).length-1,1);
 assert.equal((before.match(/^ *renderChipsCaps\(\);\n/gm)||[]).length,8);
 assert.equal(after,before.replace(dirty,'').replace(noop,'').replace(/^ *renderChipsCaps\(\);\n/gm,''));
 assert.doesNotMatch(after,/\b(?:markDirty|renderChipsCaps)\b/);
 assert.match(after,/function dirtyAcademico\(/);assert.match(after,/let dirty\s*=/);
});
test('removed empty renderer never reads state, DOM, storage or transport',()=>{
 const c=vm.createContext({});for(const key of ['document','store','capsElegidas','fetch','localStorage','sessionStorage'])Object.defineProperty(c,key,{get(){throw Error('Unexpected access '+key);}});
 vm.runInContext(noop,c);for(let i=0;i<8;i++)vm.runInContext('renderChipsCaps()',c);
});
test('historical golden normalization restores only the approved E1 deletions',()=>{
 const {historicalContent}=require('./registro-script-fixture.cjs');assert.equal(historicalContent(after),historicalContent(before));
 const changed=after.replace('if (registroSoloLectura()) return false;','if (false) return false;');assert.notEqual(historicalContent(changed),historicalContent(before),'unrelated editing guard change remains detectable');
});
