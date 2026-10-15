/* Persistencia por cuenta. Los datos anteriores sin propietario nunca se adoptan automáticamente. */
(function(root){
 'use strict';
 const legacyKey='ie22375_registro_notas_v2';
 function owner(session){return session&&['admin','docente'].includes(session.role)&&session.user?JSON.stringify([session.role,String(session.user)]):null;}
 function create(storage,session){
  const initial=owner(session()),key=legacyKey+':owner:'+encodeURIComponent(initial||'sin-sesion');let observed;
  try{observed=storage.getItem(key);}catch(_){}
  const matches=()=>!!initial&&owner(session())===initial;
  function check(){if(!matches())throw Error('La cuenta cambió. Abre Registro nuevamente; el trabajo de la cuenta anterior está conservado.');}
  function read(){check();const raw=storage.getItem(key);if(raw!==observed)throw Error('Otra pestaña cambió este registro. Conserva las pestañas y revisa antes de guardar.');return raw;}
  function write(raw){read();storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('No se pudo verificar el guardado local. Conserva esta pestaña.');observed=raw;}
  function verified(raw){return matches()&&raw===observed;}
  function legacy(){check();if(session().role!=='admin')throw Error('Solo Admin puede revisar datos anteriores sin propietario.');const raw=storage.getItem(legacyKey);if(!raw)return null;return {raw,store:JSON.parse(raw)};}
  return {key,matches,read,write,verified,legacy,hasLegacy:()=>!!storage.getItem(legacyKey)};
 }
 root.IERegistroLocalStore={create};if(typeof module!=='undefined')module.exports=root.IERegistroLocalStore;
})(typeof window==='undefined'?globalThis:window);
