// Historical goldens exclude only the exact, independently tested empty-input guards.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const hashes={recolectarPantalla:'05755171c9ea44b4fd3f8cd597e3b122a273880f5002230cfc1c41ec052c9e7d',guardarFinales:'188baeebdd613112b2a792959f7fa5af67a1ca310ad0273450336a1c60b0408d'},base='96829312848251fdea6cdb787dfe2a75da2b1314';let previous;
const fn=(s,n)=>{const a=s.indexOf('function '+n+'(');return s.slice(a,s.indexOf('\n}',a)+2);};
module.exports=(s,options={})=>{s=require('./notas2-frontend-boundary.cjs')('html',s);s=s.replace(/\r\n/g,'\n');
 s=s.replace('<button type="button" id="registroConnectionDiagnostic">Diagnosticar sincronización</button>','');
 s=s.replace('<script src="registro-sync-diagnostic.js" defer></script><script src="registro-sync-diagnostic-ui.js" defer></script>','');
 if(!options.keepConnection){
  const curConn=fs.readFileSync(path.join(__dirname,'..','registro-connection.js'),'utf8').trim().replace(/\r\n/g,'\n');
  const oldConn=execFileSync('git',['show',base+':registro-connection.js'],{encoding:'utf8',maxBuffer:4000000}).trim().replace(/\r\n/g,'\n');
  s=s.replace('<script>\n'+curConn+'\n</script>','<script>\n'+oldConn+'\n</script>');
 }
 if(!s.includes('!previo || previo.borrado || previo.origen'))return s;
 if(!previous)previous=execFileSync('git',['show',base+':registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 for(const [name,hash]of Object.entries(hashes)){const value=fn(s,name);assert.equal(crypto.createHash('sha256').update(value).digest('hex'),hash,'Exact empty input correction: '+name);s=s.replace(value,fn(previous,name));}return s;
};
