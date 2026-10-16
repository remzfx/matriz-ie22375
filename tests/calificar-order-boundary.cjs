// Exact print-only delta; historical academic/security snapshots retain every other byte.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const base='86e06835c6a42ce90f439d91ca8e39d1cfc8400e',read=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const printer=read('registro-calificar-print.js').trim(),old=read('registro.html'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const wrapper=s=>{const a=s.indexOf('function prepararImpresion(');return s.slice(a,s.indexOf('\n}',a)+2);};
function html(s){s=s.replace(/\r\n/g,'\n');if(!s.includes('const capacityOrder='))return s;
 const start=s.indexOf('/* Vista integral de Calificar:'),end=s.indexOf('\n</script>',start),current=s.slice(start,end).trim();
 assert.equal(hash(current),'a721167af2a55a4f6ed5a420023b0475823a33f6e469b10e02f1b00a258fd164','Exact capacity-order-only builder');
 const fn=wrapper(s);assert.equal(hash(fn),'f799255dc39bdf2f98b91d045316294c7a18bc7ca0ee6760290735e82aba46e5','Exact print capsSel argument');
 return s.replace(current,printer).replace(fn,wrapper(old));
}
module.exports={html,printer};
