// Strict allowlist for printing only; all academic/backend historical guards remain active.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=require('node:child_process').execFileSync('git',['show','8d2c1dbf8254f3c9757f7ae97a0479eb4fa5c794:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const fn=(s,n)=>{const a=s.indexOf('function '+n+'(');return s.slice(a,s.indexOf('\n}',a)+2);};
module.exports=source=>{
 source=require('./registro-bulk-correction-snapshot.cjs')(source);
 let s=source.replace(/\r\n/g,'\n');
 const start=s.indexOf('  /* Issue86: presentación adaptable;'),end=s.indexOf('  /* Fin Issue86 adaptable. */',start);if(start>=0){const block=s.slice(start,end+'  /* Fin Issue86 adaptable. */\n'.length);assert.equal(crypto.createHash('sha256').update(block).digest('hex'),'e6cd28636bfd385fd7b0a259a4a6adee4963a133d5766e4362e764f7edb2bbb5','Exact presentation-only extension');s=s.replace(block,'');}if(!s.includes('/* Vista integral de Calificar:'))return s;
 const file=require('./calificar-order-boundary.cjs').printer,script='<script>\n'+file+'\n</script>\n';
 assert.equal(s.split(script).length,2,'Exact tested print builder embedded once');s=s.replace(script,'');
 const css=require('../registro-calificar-print.js').css+'\n';assert.equal(s.split(css).length,2);s=s.replace(css,'');
 for(const [name,hash]of Object.entries({prepararImpresion:'7a3b83eee7dfa96068f3631a67dec0d03e866ee63bf4b0a161b21662421d855a',abrirSelectorImpresionCalificar:'874d47b5e329aa8ce0f089125f062acc6077d1fa08a85a8e735258bf0b60a791'})){
  const current=fn(s,name);assert.equal(crypto.createHash('sha256').update(current).digest('hex'),hash,'Only approved print wrapper/selector: '+name);s=s.replace(current,fn(base,name));
 }
 const anchor=base.split('\n').find(l=>l.includes('id="lblSinSesiones"')),button=base.split('\n').find(l=>l.includes('>Imprimir detalle de evidencias</button>'));
 assert.equal(s.split(anchor).length,2);return s.replace(anchor+'\n',anchor+'\n'+button+'\n');
};
