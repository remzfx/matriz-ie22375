// Exact UI/summary-only delta; no canEdit, CAS or academic algorithm may change.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),base='96829312848251fdea6cdb787dfe2a75da2b1314';
const digest=s=>crypto.createHash('sha256').update(s).digest('hex'),old=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function connection(s){s=s.replace(/\r\n/g,'\n');if(!s.includes('function reviewSummary('))return s;assert.equal(digest(s.trim()),'b3a7d664aebd4076086fc72b23b9586b8f728eb81f14b10bfdf7054deeb6a100');return old('registro-connection.js');}
function recovery(s){s=s.replace(/\r\n/g,'\n');if(!s.includes('function reviewMessage('))return s;assert.equal(digest(s.trim()),'2989d844a7ae9fe8974a0d5ff2c0fbef5d69ad9a10fe58f90ef0b022e857bfd4');return old('registro-recovery-ui.js');}
function html(s){s=s.replace(/\r\n/g,'\n');const added=",resumen:typeof IERegistroConnection!=='undefined'?IERegistroConnection.reviewSummary(reconciliation.conflicts):null";if(!s.includes(added))return s;
 for(const [name,hash]of Object.entries({prepararVersionAcademica:'7e469e8e58ead2797a430b26b2579e5449685a25a2148f2672639c0982048809',renderSesiones:'39cdf67843352360356c02824132fc4d2701d5c61b957b7e3879af89ee5ac1e1'})){const a=s.indexOf('function '+name+'(');assert.equal(digest(s.slice(a,s.indexOf('\n}',a)+2)),hash,'Exact reviewed Phase 2 function: '+name);}
 assert.equal(s.split(added).length,3);s=s.split(added).join('');return s.replace('if (sesionActiva && hayNotasPendientes() && !registroSoloLectura())','if (sesionActiva && hayNotasPendientes())');
}
module.exports={connection,recovery,html};
