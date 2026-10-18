'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const base='256a6c2888f3395b1597ef399329aeab0eb5b76d',root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const old=f=>execFileSync('git',['show',base+':'+f],{cwd:root,encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function declaration(s,name){const m=new RegExp('^( *)(?:async )?function '+name+'\\(','m').exec(s);assert.ok(m,name);const end=s.indexOf('\n'+m[1]+'}',m.index)+m[1].length+2;return s.slice(m.index,end);}
const removed={'admin.html':['subirPlantillaSiagie']};
for(const [file,names]of Object.entries(removed))test(file+': only approved dead declarations are removed, all remaining source stays identical',()=>{
 let expected=old(file);for(const name of names)expected=expected.replace(declaration(expected,name)+'\n','');assert.equal(read(file),expected);
 for(const name of names)assert.doesNotMatch(read(file),new RegExp('\\b'+name+'\\b'));
});
function upload(source,kind){const requests=[],messages={textContent:''},file={name:'PLANTILLA FICTICIA.xlsx',arrayBuffer:async()=>Uint8Array.from([1,2,3]).buffer};let enrich=0,renders=0;
 const els={tplNivel:{value:'primaria'},tplBim:{value:'III'},fixture:{files:kind==='missing'?[]:[file]},msg_fixture:messages};
 const c=vm.createContext({window:{},document:{getElementById:id=>els[id]},CLOUD_API_URL:'https://fixture.invalid/api',tokenSesionAdmin:()=>{if(kind==='session')throw Error('Sesión inválida');return 'synthetic-token';},btoa:s=>Buffer.from(s,'binary').toString('base64'),fetch:async(url,opts)=>{requests.push(JSON.parse(opts.body));if(kind==='network')throw Error('Red ficticia');return {text:async()=>JSON.stringify(kind==='rejected'?{ok:false,error:'Rechazo ficticio'}:{ok:true})};},enriquecerIdentidadesDesdeMatriz:async()=>{enrich++;return {enriquecidosBase:2,enriquecidosPadron:2};},renderAulasSiagie(){renders++;},localStorage:{setItem(){throw Error('Unexpected local persistence');}}});
 vm.runInContext(declaration(source,'subirPlantillaAula').trim(),c);
 return c.subirPlantillaAula('1','Única','fixture').then(()=>({requests,messages,enrich,renders}));
}
for(const kind of ['ok','missing','session','network','rejected'])test('Admin active per-class SIAGIE upload remains equivalent: '+kind,async()=>{
 const a=await upload(read('admin.html'),kind),b=await upload(old('admin.html'),kind);a.requests.forEach(r=>delete r.ts);b.requests.forEach(r=>delete r.ts);assert.deepEqual(a,b);
 if(kind==='ok'){assert.equal(a.requests.length,1);assert.equal(a.requests[0].action,'savetpl');assert.equal(a.requests[0].token,'synthetic-token');assert.equal(a.requests[0].grado,'1');assert.equal(a.requests[0].seccion,'Única');assert.equal(a.enrich,1);assert.match(a.messages.textContent,/Guardado/);}
 if(['missing','session'].includes(kind))assert.equal(a.requests.length,0);
 if(kind!=='ok'){assert.equal(a.enrich,0);assert.doesNotMatch(a.messages.textContent,/^Guardado:/);}
});
