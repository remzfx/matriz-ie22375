// Exact reviewed Phase 2 boundaries, without masking unrelated historical fixture mutations.
// New regressions always execute raw current sources (browser and backend).
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const files={"html": "registro.html", "reconcile": "registro-reconcile.js", "backend": "apps-script/Codigo.js", "sw": "sw.js", "recovery": "registro-recovery-ui.js"},hashes={"html": "110455359eeb0749ed6cfcbe031952514d6192b5a0bdd28e6534924f65815348", "reconcile": "c68ce0e1633a2d623489f7e88339fa2a7c11507f6ddc47a14c3eab20f5f41aa5", "backend": "d3c33c6ae459b89e3f8fd00b6fdbcc99a6bf54982938aacc3a74b90c8b36220e", "sw": "78cc49ca07f1c51c81b849d7e22780ae6bd9e56c4910810ef68e5cde413deeaf", "recovery": "eba476de38382939a78c653fa03c7a9e8bdb88f0eb0508e0fa7faa96b6c96736"},functions={"subirRegistroNube": "0fb09a4b6a887d97c046372d9be52d40f89225b6b39cbcb74ca2c2363a2bb71a", "leerNota": "7e652fcdcbe17bffa6945e974a869429eb98537d0d5cc6382e0b8b3e69c7b9f6", "leerEstadoRemotoAcademico": "63b82c52b0ff152ce2feb496e99c15cccad1a16b7c30acb13c2df04452bd25fa", "confirmarRegistroConciliado": "a7b779b976288eaa20ba7cbab1d357a3850f28489cc2329aee657114c0ef1cd5", "prepararVersionAcademica": "3d2956570fe2486720199a50a3ec1af70e1b5f52d9d2ff2a882213287a2a6487"},base='c6a8d3a8291d042f214529534d7d358e9b48fae5',memo=new Map();
const markers={html:'src="academic-identity.js"',reconcile:'function academicPlan(',backend:'body.identidadAcademica===1',sw:"'v21'",recovery:'Identidades históricas ambiguas'};
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function original(kind){if(!memo.has(kind))memo.set(kind,execFileSync('git',['show',base+':'+files[kind]],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n'));return memo.get(kind);}
const fn=(s,n)=>{const start=s.search(new RegExp('^(?:async )?function '+n+'\\(','m'));return s.slice(start,s.indexOf('\n}',start)+2);};
function without(kind,source){if(kind==='sw')source=require('./registro-script-fixture.cjs').historicalWorker(source);if(kind==='reconcile')source=require('./reconciliation-ui-boundary.cjs')(source);if(['html','recovery'].includes(kind))source=require('./phase3-boundary.cjs')[kind](source);source=source.replace(/\r\n/g,'\n');if(!source.includes(markers[kind]))return source;
 if(kind==='html'){
  for(const [name,hash]of Object.entries(functions)){const value=fn(source,name);assert.equal(digest(value),hash,'Exact reviewed Phase 2 function: '+name);source=source.replace(value,fn(original('html'),name));}
  const start=source.indexOf('/* Adaptador frontend: operaciones explícitas'),end=source.indexOf('\n</script>',start),adapter=source.slice(start,end).trim();
  assert.equal(digest(adapter+'\n'),hashes.recovery,'Exact Phase 2 recovery adapter');source=source.slice(0,start)+original('recovery').trim()+'\n'+source.slice(end);
  return source.replace('<script src="academic-identity.js" defer></script>','');
 }
 assert.equal(digest(source),hashes[kind],'Exact reviewed Phase 2 diff only: '+files[kind]);return original(kind);
}
module.exports=Object.fromEntries(Object.keys(files).map(k=>[k,s=>without(k,s)]));
