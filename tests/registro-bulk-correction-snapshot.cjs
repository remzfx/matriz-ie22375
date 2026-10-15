// Exact allowlist for this warning-only change; academic/persistence/print snapshots stay strict.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const base=execFileSync('git',['show','ab40925e4687e90ad99c63a1285b732d492dca97:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const fn=(s,n)=>{const a=s.indexOf('function '+n+'(');return s.slice(a,s.indexOf('\n}',a)+2);};
module.exports=source=>{
 let s=source.replace(/\r\n/g,'\n');if(!s.includes('function primeraCorreccionMasiva('))return s;
 const hashes={"primeraCorreccionMasiva": "74a89ad8993e13b55f2ddc9b6a5a795cd75a73155da57bd7929e1e418b66f8bd", "confirmarEdicionNumerica": "496a106059cecb030cf006ebf3f94edb8c3f9e19619c65224eddad46930996be", "seleccionarFinalReversible": "8b5ba7154ca9a63b8d44f083266b8eedc9406c41895517ba09232a8fabc527fb", "calificarAreaMasiva": "7afd402b946ea137016503f88d660905ae7869e5550d026ce03babf0a8120e19"};
 for(const [n,h]of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(fn(s,n)).digest('hex'),h,'Exact bulk warning change: '+n);
 for(const n of Object.keys(hashes).filter(n=>n!=='primeraCorreccionMasiva'))s=s.replace(fn(s,n),fn(base,n));
 return s.replace('// Oportunidades efímeras: nunca se serializan ni se reconstruyen desde notas.\n'+fn(s,'primeraCorreccionMasiva')+'\n','');
};
