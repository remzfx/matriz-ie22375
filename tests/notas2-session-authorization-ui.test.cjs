'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('registro-notas2-ui.js','utf8');
const fn=name=>{const at=source.indexOf(' function '+name+'(');assert.ok(at>=0);return source.slice(at,source.indexOf('\n }',at)+3);};
function fixture(){let now=1000,actor='user|token|profile|epoch',authorized=true;const session={user:'synthetic',role:'docente',nivel:'secundaria',permisosVersion:1},ctx={nivel:'secundaria',bim:'III',grado:3,seccion:'A',area:'Matemática'};
 const c=vm.createContext({scopeAuthorization:null,root:{IEAcademicResetClient:{epoch:()=>null}},Date:{now:()=>now},prefetchOwner:()=>actor,navigator:{onLine:true},authorized:()=>authorized,getLoginSession:()=>session,ctxBase:()=>ctx});
 vm.runInContext("const authorizationKey=c=>[c.nivel,c.bim,Number(c.grado),['UNICA','ÚNICA'].includes(String(c.seccion).toUpperCase())?'ÚNICA':String(c.seccion).toUpperCase(),c.area].join('||');"+fn('acceptContextAuthorization')+fn('contextAuthorization'),c);
 const a={schema:1,user:'synthetic',role:'docente',nivel:'secundaria',permisosVersion:1,issuedAt:5000,expiresAt:155000,epoch:null,contexts:['secundaria||III||3||A||Matemática']};
 return {c,session,a,install:()=>c.acceptContextAuthorization({epoch:null,contextAuthorization:a},1000,actor),now:v=>now=v,actor:v=>actor=v,auth:v=>authorized=v};
}
test('server scope only covers exact contexts and retains its original deadline',()=>{
 const f=fixture();f.install();assert.equal(f.c.contextAuthorization().until,151000);assert.equal(f.c.contextAuthorization({nivel:'secundaria',bim:'III',grado:4,seccion:'A',area:'Matemática'}),null);
 f.now(150000);assert.equal(f.c.contextAuthorization().until,151000);f.now(151000);assert.equal(f.c.contextAuthorization(),null);
});
for(const field of ['schema','user','role','nivel','permisosVersion','epoch','expiresAt','contexts'])test('malformed or foreign '+field+' never authorizes a cached visit',()=>{
 const f=fixture();f.a[field]=field==='contexts'?['x'.repeat(1025)]:field==='expiresAt'?999999999:'foreign';f.install();assert.equal(f.c.contextAuthorization(),null);
});
for(const changed of ['actor','offline','authorization','generation'])test('scope is unusable after '+changed+' changes',()=>{
 const f=fixture();f.install();if(changed==='actor')f.actor('other-token');if(changed==='offline')f.c.navigator.onLine=false;if(changed==='authorization')f.auth(false);if(changed==='generation')f.c.root.IEAcademicResetClient.epoch=()=> 'a'.repeat(32);assert.equal(f.c.contextAuthorization(),null);
});

test('protected local work is never described as a prepared reserve',()=>{
 const f=fixture();f.install();f.c.IERegistroNotas2Prefetch=require('../registro-notas2-prefetch.js');f.c.cloudClaveReg=()=> 'secundaria||III||3||A||Matemática';f.c.get=()=>({status:()=>({panels:{calificar:{pending:false},promedios:{pending:false}}})});f.c.screenPending=()=>false;f.c.prefetch={availability:()=>({state:'reserved',reserved:true,protectedLocal:true})};vm.runInContext(fn('preparation'),f.c);assert.equal(f.c.preparation().state,'local');f.auth(false);f.c.prefetch.availability=()=>{throw Error('Must not touch other receipts while roster switches');};assert.equal(f.c.preparation().reason,'authorization');
});

test('old backend without an explicit scope keeps the authenticated fallback',()=>{const f=fixture();f.c.acceptContextAuthorization({epoch:null},1000,'user|token|profile|epoch');assert.equal(f.c.contextAuthorization(),null);});
for(const until of [1000,1001])test('reserve publication rechecks authorization deadline '+until,()=>{
 const text=fs.readFileSync('registro-notas2-ui.js','utf8'),start=text.indexOf('beforeApply:()=>{'),end=text.indexOf('},hasExisting:',start),guard=text.slice(start+'beforeApply:()=>{'.length,end);
 const receiptGuards=new Map([['key',{signature:'empty',authorizedUntil:until}]]),memory={nota:'A'};const c=vm.createContext({key:'key',root:{},tutor:()=>false,receiptGuards,Date:{now:()=>1000},model:{signature:()=> 'empty'},academicContext:()=>({}),ctxBase:()=>({}),screenPending:()=>false,memory});
 const helper=text.indexOf(' function missingRoster(');assert.ok(helper>=0);vm.runInContext(text.slice(helper,text.indexOf('\n',helper)),c);
 if(until===1000)assert.throws(()=>vm.runInContext(guard,c),{code:'READ_AUTH_EXPIRED'});else assert.doesNotThrow(()=>vm.runInContext(guard,c));assert.deepEqual(memory,{nota:'A'});
});
