// Historical guards allow only the new footer and the two tested local adapters.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const old=execFileSync('git',['show','c6139fd461f7af9ea2c5a3f1268a9c41318acef9:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const block=s=>{const a=s.indexOf('      <div class="grid grid-cols-'),b=s.indexOf('      </div>',a)+12;return s.slice(a,b);};
const modules=['registro-drafts.js','registro-recovery-ui.js'].map(f=>'<script>\n'+fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n')+'\n</script>').join('\n');
const added='<!-- Inicio simplificación docente: dependencia separada, sin cambiar handlers académicos. -->\n'+modules+'\n<!-- Fin simplificación docente. -->\n';
module.exports=s=>{
 s=s.replace(/\r\n/g,'\n');if(!s.includes('<!-- Inicio simplificación docente:')){assert.ok(!s.includes('onclick="IERegistroRecovery.'),'No partial removal of recovery additions');return s;}
 assert.equal(s.split(added).length,2,'Exact tested adapter code embedded once');
 const footer=block(s);for(const name of ['subirRegistroNube','bajarRegistroNube']){const button=block(old).split('\n').find(l=>l.includes('onclick="'+name+'()"'));assert.ok(footer.includes(button),'Original cloud action must remain intact');}
 assert.ok(footer.includes('IERegistroRecovery.recover()')&&footer.includes('IERegistroRecovery.local()')&&footer.includes('IERegistroRecovery.upload()')&&footer.includes('IERegistroRecovery.drafts()'));
 return s.replace(added,'').replace(footer,block(old));
};
