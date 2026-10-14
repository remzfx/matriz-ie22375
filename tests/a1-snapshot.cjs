// Historical presentation snapshots retain their original checks outside A1.
const {execFileSync}=require('node:child_process'),{extract}=require('./reconcile-fixture.cjs');
const base='2806f4d19afdfc7f5e9967c1a4e04b138088eed0';
const previous=execFileSync('git',['show',base+':registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function oldFunction(n){const start=previous.indexOf('function '+n+'(');return (previous.slice(start-6,start)==='async '?'async ':'')+previous.slice(start,previous.indexOf('\n}',start)+2);}
function currentFunction(s,n){const start=s.indexOf('function '+n+'(');return (s.slice(start-6,start)==='async '?'async ':'')+s.slice(start,s.indexOf('\n}',start)+2);}
module.exports=function withoutA1(s){s=require('./b1-snapshot.cjs')(s).replace(/\r\n/g,'\n');
  for(const n of ['subirRegistroNube','bajarRegistroNube','prepararVersionAcademica'])s=s.replace(currentFunction(s,n),oldFunction(n));
  for(const n of ['leerEstadoRemotoAcademico','aplicarRegistroConciliado','recuperarBorradorAcademico','pintarRegistroConciliado','confirmarRegistroConciliado'])s=s.replace(currentFunction(s,n)+'\n','');
  return s.replace('<script src="registro-reconcile.js" defer></script>','').replace(/  <div class="shell shell-work px-3"><button[^\n]*recuperarBorradorAcademico\(\)[^\n]*\n/,'');
};
