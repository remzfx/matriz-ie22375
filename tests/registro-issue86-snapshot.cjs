// Strict allowlist for printing only; all academic/backend historical guards remain active.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=require('node:child_process').execFileSync('git',['show','8d2c1dbf8254f3c9757f7ae97a0479eb4fa5c794:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const fn=(s,n)=>{const a=s.indexOf('function '+n+'(');return s.slice(a,s.indexOf('\n}',a)+2);};
module.exports=source=>{
 let s=source.replace(/\r\n/g,'\n');if(!s.includes('/* Vista integral de Calificar:'))return s;
 const file=fs.readFileSync(path.join(__dirname,'..','registro-calificar-print.js'),'utf8').trim().replace(/\r\n/g,'\n'),script='<script>\n'+file+'\n</script>\n';
 assert.equal(s.split(script).length,2,'Exact tested print builder embedded once');s=s.replace(script,'');
 const css=require('../registro-calificar-print.js').css+'\n';assert.equal(s.split(css).length,2);s=s.replace(css,'');
 for(const [name,hash]of Object.entries({prepararImpresion:'3bc442c7449dd33a2420313038a808a7214ef14b8cd532a8783a0c1b525fa4fc',abrirSelectorImpresionCalificar:'18f2cbb71344f5b1e82f928f1b3268fc4976ed879cdd899890cf044ce22b5046'})){
  const current=fn(s,name);assert.equal(crypto.createHash('sha256').update(current).digest('hex'),hash,'Only approved print wrapper/selector: '+name);s=s.replace(current,fn(base,name));
 }
 const anchor=base.split('\n').find(l=>l.includes('id="lblSinSesiones"')),button=base.split('\n').find(l=>l.includes('>Imprimir detalle de evidencias</button>'));
 assert.equal(s.split(anchor).length,2);return s.replace(anchor+'\n',anchor+'\n'+button+'\n');
};
