// Local-only browser fixture: exact production gate/session/storage; synthetic profiles/cloud.
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
function fn(source,name){const a=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));if(a<0)throw Error(name);const line=source.slice(a,source.indexOf('\n',a));return line.trimEnd().endsWith('}')?line:source.slice(a,source.indexOf('\n}',a)+2);}
const index=read('index.html'),registro=read('registro.html');
const gate=registro.slice(registro.indexOf('/* Gate de acceso básico IE 22375 */'),registro.indexOf('</script>',registro.indexOf('/* Gate de acceso básico IE 22375 */'))).trim();
const sessionCode="const SESSION_KEY='ie22375_session_v1';let versionSesionLogin=0;\n"+['setSession','clearSession','cerrarSesion','irModulo'].map(n=>fn(index,n)).join('\n')+'\n'+fn(registro,'getLoginSession');
const common=sessionCode+`
const documentId=crypto.randomUUID();
const profile=user=>({role:'docente',user,nivel:'secundaria',token:'synthetic-never-sent-'+user,recordar:false});
const A=profile('synthetic-lifecycle-A'),B=profile('synthetic-lifecycle-B');
function iniciarPuenteLogin(){} // Authentication is intentionally simulated, no credential input.
function show(text){document.getElementById('result').textContent=text+' · documento '+documentId;}
function assert(ok,message){if(!ok)throw Error(message);}
window.onerror=(_,__,___,____,error)=>show('FALLO: '+(error?.message||'error'));
`;
function page(body,code){return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'"><title>PR85 · ciclo de sesión ficticio</title><style>body{font:16px system-ui;margin:24px}button{padding:12px;margin:6px}output{display:block;white-space:pre-wrap;margin:16px 0}</style></head><body><h1>Ciclo de sesión · datos ficticios</h1><output id="result"></output><div id="viewHub"></div><div id="viewLogin"></div><input id="inpPass" type="hidden">'+body+'<script>'+code+'</script></body></html>';}
const indexPage=page('<button onclick="setSession(A);show(\'Login A en este documento; abrir Registro navega\')">Entrar A ficticia</button><button onclick="cerrarSesion();setSession(B);show(\'Cerrar/iniciar B sin recargar index: OK\')">Cerrar sesión e iniciar B</button><button onclick="irModulo(\'registro.html\')">Abrir Registro</button>',common+"\nshow('Login ficticio · sesión '+(getLoginSession()?.user||'nula'));");
function registroPage(seed=''){
 return page('<button onclick="registroLocal.write(JSON.stringify({finales:{synthetic: getLoginSession().user.endsWith(\'A\')?15:18}}));show(\'Guardado de \'+getLoginSession().user+\': \'+registroLocal.read())">Guardar nota ficticia</button><button onclick="clearSession();setSession(B);let blocked=false;try{registroLocal.write(\'{}\')}catch(_){blocked=true}assert(blocked&&!registroLocal.matches(),\'La pestaña antigua debe bloquearse\');show(\'Cambio sin navegar: adaptador anterior BLOQUEADO; abrir Registro nuevamente\')">Cambiar a B sin navegar</button><button onclick="irModulo(\'index.html\')">Volver al login</button><button onclick="cloudAndLegacy()">Verificar nube simulada y legacy</button>',common+'\n'+seed+"\nwindow.__IE_NEED_ROLES=['admin','primaria','secundaria'];\n"+gate+'\n'+read('registro-local-store.js')+'\n'+read('registro-reconcile.js')+'\n'+read('registro-drafts.js')+`
 const registroLocal=IERegistroLocalStore.create(localStorage,getLoginSession);const NOTAS_KEY=registroLocal.key;
 show('Registro nuevo · '+(getLoginSession()?.user||'sin sesión')+' · propietario válido '+registroLocal.matches()+' · notas '+registroLocal.read());
 async function cloudAndLegacy(){try{
  const original=JSON.stringify({finales:{syntheticLegacy:8}});localStorage.setItem('ie22375_registro_notas_v2',original);
  let blocked=false;try{registroLocal.legacy()}catch(_){blocked=true}assert(blocked,'Docente no debe acceder a legacy');
  const before=JSON.parse(registroLocal.read()||'{}'),scope='synthetic-lifecycle|'+NOTAS_KEY,backup=IERegistroDrafts.storage(indexedDB);
  const controller=IERegistroDrafts.controller({context:()=>NOTAS_KEY,guard:()=>registroLocal.matches(),capture:()=>({context:NOTAS_KEY,payload:JSON.parse(registroLocal.read()||'{}')}),read:async()=>({exists:true,version:1,payload:{finales:{synthetic:18}}}),confirm:async()=>true,backup:(snapshot,kind)=>backup.put(scope,snapshot,kind),apply:remote=>registroLocal.write(JSON.stringify(remote.payload)),state:()=>{},changed:()=>false});
  const ok=await controller.recover();assert(ok,'Recuperación ficticia debe completarse');assert(JSON.parse(registroLocal.read()).finales.synthetic===18,'Nota remota ficticia');
  assert(localStorage.getItem('ie22375_registro_notas_v2')===original,'Legacy debe permanecer intacto');
  setSession({role:'admin',user:'synthetic-lifecycle-admin',token:'synthetic-admin',recordar:false});const admin=IERegistroLocalStore.create(localStorage,getLoginSession);
  assert(admin.read()===null,'Admin no debe adoptar automáticamente las notas anteriores');assert(admin.legacy().raw===original,'Admin puede revisar legacy');assert(admin.read()===null,'Revisar legacy no lo transfiere');
  show('Nube ficticia + IndexedDB verificado: OK; legacy solo Admin, sin adopción: OK; nota anterior '+JSON.stringify(before));
 }catch(error){show('FALLO: '+error.message)}}
 `);
}
const pages={'/index.html':indexPage,'/registro.html':registroPage(),'/tab-a.html':registroPage('setSession(A);'),'/tab-b.html':registroPage('setSession(B);')};
module.exports={pages,gate,sessionCode,fn};
if(require.main===module){const server=require('node:http').createServer((req,res)=>{const html=pages[req.url];res.writeHead(html?200:404,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html||'Fixture inexistente');});server.listen(18985,'127.0.0.1',()=>console.log('Fixture aislada: http://127.0.0.1:18985/registro.html'));}
