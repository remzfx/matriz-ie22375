// Shared synthetic integration fixture: uses dependencies declared by the actual page.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {scripts}=require('./registro-script-fixture.cjs'),copy=require('../registro-reconcile.js').copy;
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const dependency=file=>{const entries=scripts(read('registro.html')).filter(s=>s.src===file);if(entries.length!==1)throw Error('Expected one dependency: '+file);return entries[0].code;};
const fixture=new Function('require','__dirname',read('tests/registro-recovery-ui.test.cjs').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
function ui(){let online=true;const f=fixture(null,{boot:false,source:dependency('registro-recovery-ui.js'),prepare(c){
 vm.runInContext(dependency('registro-connection.js'),c);const before=c.registroSoloLectura;c.registroSoloLectura=()=>before()||!c.IERegistroConnection.canEdit();c.navigator={get onLine(){return online}};c.IEStudents.peekRoster=()=>({synthetic:true});c.tokenPadron='synthetic-token';
 const originalStorage=c.localStorage,other=new Map();c.PERIODOS_CLOUD_KEY='synthetic-periods';c.localStorage={getItem:k=>k===c.NOTAS_KEY?originalStorage.getItem(k):other.get(k)||null,setItem:(k,v)=>k===c.NOTAS_KEY?originalStorage.setItem(k,v):other.set(k,v)};vm.runInContext(require('./reconcile-fixture.cjs').extract('loadPeriodosAdmin'),c);c.IEStudents.fetchJSON=async()=>({ok:true,periodos:{anio:2026,bimestres:{III:'abierto'}}});vm.runInContext(require('./reconcile-fixture.cjs').extract('sincronizarPeriodosNube'),c);c.sincronizarEdicionRegistro=()=>{};c.pintarRegistroConciliado=()=>{};const el=c.document.getElementById;c.document.getElementById=id=>{const n=el(id);if(!n.dataset)n.dataset={};return n;};
 const payload=c.sliceRegistroArea(),b=c.baselineAcademica();b.version=1;b.basePayload=copy(payload);b.baseline=c.IERegistroAcademico.canonical(payload);c.saveStore();
 }});f.r.payload=copy(f.c.sliceRegistroArea());return {...f,online:v=>online=v,connection:f.c.IERegistroConnection.current()};}
module.exports={ui};
