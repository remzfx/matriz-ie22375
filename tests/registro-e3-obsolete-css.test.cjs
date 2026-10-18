'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n'),before=execFileSync('git',['show','f55a680:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const pattern=/^  \.av-(?:card|comp|meta|badge|ev|stu)(?::last-child)? \{[^\n]*\}\n/gm;
test('E3 permits only the seven obsolete CSS rules to change from the approved HEAD',()=>{
 assert.equal((before.match(pattern)||[]).length,7);const current=read('registro.html'),left=(current.match(pattern)||[]).length;assert.equal(left,0,'all and only the obsolete rules are removed');assert.equal(current,before.replace(pattern,''));
});
test('target classes have no HTML, executable template or external-module consumer',()=>{
 const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.(html|js)$/.test(f)&&!/^tests\/|^docs\/|^vendor\/|^preview-/.test(f));
 for(const file of files){const executable=read(file).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');assert.doesNotMatch(executable,/\bav-(?:card|comp|meta|badge|ev|stu)\b/,file);assert.doesNotMatch(executable,/['"]av['"]\s*\+\s*['"]-/,file+' dynamic prefix');}
});
test('live academic and print producers remain separate from the old cards',()=>{
 assert.match(read('registro.html'),/class="summary-competence"/);assert.match(read('conclusion-suggestions.js'),/final-conclusion/);assert.match(read('registro-calificar-print.js'),/print-sign/);
 assert.doesNotMatch(read('registro-calificar-print.js'),/\bav-(?:card|comp|meta|badge|ev|stu)\b/);
});
