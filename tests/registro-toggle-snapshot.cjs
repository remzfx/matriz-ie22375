// Historical snapshots restore only the two renderers and helper changed by reversible selection.
// Current behavior is exercised against raw source in registro-reversible-selection.test.cjs.
const {execFileSync}=require('node:child_process');
const base=execFileSync('git',['show','6590d4b143556862d517531fafebe99c3be05014:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function fn(s,n){const i=s.indexOf('function '+n+'(');return s.slice(i,s.indexOf('\n}',i)+2);}
module.exports=s=>{s=s.replace(/\r\n/g,'\n');for(const n of ['renderStudents','renderFinales'])if(s.includes('function '+n+'('))s=s.replace(fn(s,n),fn(base,n));if(s.includes('function seleccionarFinalReversible('))s=s.replace(fn(s,'seleccionarFinalReversible')+'\n','');if(!s.includes('.final-grade .fin-clear-direct{')){const rules=base.split('\n').filter(x=>x.includes('.final-grade .fin-clear-direct'));s=s.replace('  .final-conclusion{text-align:left;',rules.join('\n')+'\n  .final-conclusion{text-align:left;');}return s;};
