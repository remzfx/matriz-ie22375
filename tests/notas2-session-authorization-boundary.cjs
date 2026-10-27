'use strict';
// Exact session-scope deltas for historical comparisons only. Security/runtime tests use raw sources.
const assert=require('node:assert/strict'),edits={
  "apps-script/Codigo.js": [
    [
      "function obtenerPeriodosConfig_(soloLectura) {\n  const sh = soloLectura ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConfigSistema') : asegurarConfig_();\n  if (!sh) return null;",
      "function obtenerPeriodosConfig_() {\n  const sh = asegurarConfig_();"
    ],
    [
      "function academicResetRead_(body){\n const access=sesionLectura_(body.token,['admin','docente']);if(!access)return {ok:false,code:'SESSION',error:'Sesión inválida.'};\n const state=academicResetState_(),out={ok:true,academicReset:1,...state};\n if(body.contextAuthorization===1&&access.sesion.role==='docente'&&(!state.epoch||state.phase==='complete'))out.contextAuthorization=academicContextAuthorization_(access,state);\n return out;\n}\n// Optional, read-only lease. Does not replace authorization on any read/save endpoint.\nfunction academicContextAuthorization_(access,state){\n const doc=access.docente,session=access.sesion,nivel=String(doc.nivel||'').toLowerCase(),catalog=registroAcademico_().catalog[nivel]||{},periods=obtenerPeriodosConfig_(true)?.bimestres||{};\n const mapping=nivel==='primaria'?asignacionesPrimaria_(doc):doc.asignaciones,explicit=mapping&&Object.keys(mapping).length,contexts=new Set();\n for(const area of Object.keys(catalog)){\n  if(area==='Competencias Transversales')continue;\n  const aulas=explicit?mapping[area]:Array.isArray(doc.areas)&&doc.areas.includes(area)?doc.aulas:[];\n  for(const aula of Array.isArray(aulas)?aulas:[]){\n   const parts=String(aula).split('|');if(parts.length!==2)continue;\n   const numero=gradoEscritura_(parts[0]),seccion=seccionEscritura_(parts[1]),ctx={nivel,numero,grado:String(numero),seccion,area};\n   if(!puedeLeerContexto_(access,ctx))continue;\n   for(const bim of ['I','II','III','IV'])if(periods[bim]==='abierto')contexts.add([nivel,bim,numero,seccion,area].join('||'));\n   if(contexts.size>4096)return null;\n  }\n }\n const issuedAt=Date.now();return {schema:1,user:normalizarUsuario_(session.user),role:session.role,nivel,permisosVersion:Number(session.permisosVersion),issuedAt,expiresAt:Math.min(issuedAt+150000,Number(session.exp)),epoch:state.epoch,contexts:[...contexts].sort()};\n}",
      "function academicResetRead_(body){if(!sesionLectura_(body.token,['admin','docente']))return {ok:false,code:'SESSION',error:'Sesión inválida.'};return {ok:true,academicReset:1,...academicResetState_()};}"
    ]
  ],
  "registro-connection.js": [
    [
      "arm(state==='connected'||state==='pending'?Math.min(interval,Math.max(1000,until-now()-30000)):Math.min(60000,15000*2**Math.min(attempt++,2)))",
      "arm(state==='connected'||state==='pending'?interval:Math.min(60000,15000*2**Math.min(attempt++,2)))"
    ],
    [
      "until=Math.min(now()+lease,Number.isFinite(result.validUntil)?result.validUntil:Infinity);if(until<=now()){emit('checking');return false;}grants.set(key,{until,state:result.pending?'pending':'connected'});",
      "until=now()+lease;grants.set(key,{until,state:result.pending?'pending':'connected'});"
    ],
    [
      "o.verify({review,valid,force})",
      "o.verify({review,valid})"
    ]
  ],
  "registro-notas2-ui.js": [
    [
      "const expected=receiptGuards.get(key);receiptGuards.delete(key);if(expected?.authorizedUntil!=null&&expected.authorizedUntil<=Date.now()){const e=Error('La autorización caducó antes de aplicar la reserva; se deben verificar nuevamente los permisos.');e.code='READ_AUTH_EXPIRED';throw e;}if(expected!==undefined",
      "const expected=receiptGuards.get(key);receiptGuards.delete(key);if(expected!==undefined"
    ],
    [
      "{const grant=contextAuthorization(c),reserved=await prefetch.acquire(c);if(reserved){receiptGuards.set(key,{signature:reserved.signature,...(grant?{authorizedUntil:grant.until}:{})});return reserved.response;}}",
      "{const reserved=await prefetch.acquire(c);if(reserved){receiptGuards.set(key,{signature:reserved.signature});return reserved.response;}}"
    ],
    [
      "const a=prefetch?.availability(c),lease=contextAuthorization(c),known=a?.state==='known';\n  if(a?.protectedLocal)return {state:'local',snapshot:true};",
      "const a=prefetch?.availability(c),lease=contextAuthorization(c),known=a?.state==='known';"
    ],
    [
      "if(ok&&!esVistaAdmin()&&lastView!==viewStamp(s))render();return {ok,code:",
      "if(ok&&!esVistaAdmin())render();return {ok,code:"
    ],
    [
      " function preparation(c=ctxBase()){\n  // The visible roster may be switching; a presentation query must not prune other-period receipts.\n  if(!authorized())return {state:'preparing',reason:'authorization'};\n  const key=",
      " function preparation(c=ctxBase()){\n  const key="
    ],
    [
      "if(loading)loading.textContent=effectiveState==='checking'?(prepared?.reason!=='authorization'&&prepared?.state==='preparing'?'Aula en preparación — recuperando datos autorizados…':'Verificando acceso a '+ctxBase().grado+'° '+ctxBase().seccion+' · Bim '+ctxBase().bim+'… Las calificaciones se mostrarán al confirmar la autorización.'):effectiveMsg;",
      "if(loading)loading.textContent=effectiveState==='checking'?'Verificando acceso a '+ctxBase().grado+'° '+ctxBase().seccion+' · Bim '+ctxBase().bim+'… Las calificaciones se mostrarán al confirmar la autorización.':effectiveMsg;"
    ],
    [
      "const prepared=prefetch&&!tutor()?preparation():null;\n  if(effectiveState==='connected'&&prepared?.state==='prepared')effectiveMsg='Aula preparada — copia consultada; Guardar revalidará la versión.';\n  updateSyncIndicator(effectiveState,effectiveMsg,otherPending);",
      "updateSyncIndicator(effectiveState,effectiveMsg,otherPending);"
    ],
    [
      "const api={preparation:root.IERegistroNotas2Prefetch?preparation:undefined,saving:",
      "const api={saving:"
    ],
    [
      " function preparation(c=ctxBase()){\n  const key=IERegistroNotas2Prefetch.key(c),local=key===cloudClaveReg()&&get()?.status().panels;\n  if(local&&Object.values(local).some(p=>p.pending)||key===cloudClaveReg()&&(screenPending('calificar')||screenPending('promedios')))return {state:'local',snapshot:true};\n  const a=prefetch?.availability(c),lease=contextAuthorization(c),known=a?.state==='known';\n  if((a?.reserved||known)&&lease)return {state:'prepared',snapshot:true,consultedAt:a.consultedAt,authorizedUntil:lease.until};\n  if(['failed','deferred','incompatible','historical'].includes(a?.state))return {state:'unavailable',reason:a.state};\n  return {state:'preparing',reason:!lease?'authorization':a?.state||'unknown'};\n }\n async function verifyPermission(valid){",
      " async function verifyPermission(valid){"
    ],
    [
      "  if(!prefetch||!backgroundEligible()||!root.IEAcademicResetClient?.readOnly)return;",
      "  if(!prefetch||!backgroundEligible()||get()?.status().legacy||!root.IEAcademicResetClient?.readOnly)return;"
    ],
    [
      "changed:value=>{if(['session','server','offline'].includes(value.state)){scopeAuthorization=null;prefetch?.pause();}const box=document.getElementById('registroConnectionStatus')",
      "changed:value=>{const box=document.getElementById('registroConnectionStatus')"
    ],
    [
      "return {ok:true,code:s.state==='session'?'SESSION':cerrado||s.readonly?'CLOSED':undefined,conflict:s.state==='conflict',pending:false,...(lease?{validUntil:lease.until}:{})};",
      "return {ok:true,code:s.state==='session'?'SESSION':cerrado||s.readonly?'CLOSED':undefined,conflict:s.state==='conflict',pending:false};"
    ],
    [
      "return {ok,code:s.state==='session'?'SESSION':(ok&&(s.readonly||readonly()))?'CLOSED':undefined,conflict:s.state==='conflict',pending:false,...(lease?{validUntil:lease.until}:{})};",
      "return {ok,code:s.state==='session'?'SESSION':(ok&&(s.readonly||readonly()))?'CLOSED':undefined,conflict:s.state==='conflict',pending:false};"
    ],
    [
      "const lease=!force&&!review?contextAuthorization():null;\n  const [periods,permission]=lease?[true,{ok:true}]:await Promise.all([sincronizarPeriodosNube(true),verifyPermission(valid)]);",
      "const [periods,permission]=await Promise.all([sincronizarPeriodosNube(true),verifyPermission(valid)]);"
    ],
    [
      "verify:async({valid,review,force})=>{",
      "verify:async({valid,review})=>{"
    ],
    [
      "overheadBytes:()=>rosterBytes+(scopeAuthorization?.bytes||0),",
      "overheadBytes:()=>rosterBytes,"
    ],
    [
      "   if(profile!==prefetchOwner())return {ok:false};acceptContextAuthorization(data,started,profile);\n   return {ok:true};\n  }catch(_){scopeAuthorization=null;return {ok:false};}finally{clearTimeout(timeout);}",
      "   return {ok:true};\n  }catch(_){return {ok:false};}finally{clearTimeout(timeout);}"
    ],
    [
      "if(response.status===401||response.status===403||['SESSION','DENIED'].includes(data?.code)){scopeAuthorization=null;prefetch?.pause();return {ok:false,code:'SESSION'};}",
      "if(response.status===401||response.status===403||['SESSION','DENIED'].includes(data?.code))return {ok:false,code:'SESSION'};"
    ],
    [
      "body:JSON.stringify({action:'academicstate',token:session.token,contextAuthorization:1})",
      "body:JSON.stringify({action:'academicstate',token:session.token})"
    ],
    [
      "const key=binding(),actor=owner(),profile=prefetchOwner(),started=Date.now(),session=getLoginSession()||{},controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);",
      "const key=binding(),actor=owner(),session=getLoginSession()||{},controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);"
    ],
    [
      " // A server-issued scope is kept only in this page and tied to the exact actor/profile/generation.\n const authorizationKey=c=>[c.nivel,c.bim,Number(c.grado),['UNICA','ÚNICA'].includes(String(c.seccion).toUpperCase())?'ÚNICA':String(c.seccion).toUpperCase(),c.area].join('||');\n function contextAuthorization(c=ctxBase()){\n  const a=scopeAuthorization;if(!a||a.actor!==prefetchOwner()||a.until<=Date.now()||navigator.onLine===false||!authorized()||a.epoch!==(root.IEAcademicResetClient?.epoch?.()||null)||!a.contexts.has(authorizationKey(c)))return null;\n  return a;\n }\n function acceptContextAuthorization(data,started,actor){\n  const a=data.contextAuthorization,s=getLoginSession()||{};\n  scopeAuthorization=null;\n  if(!a||a.schema!==1||a.role!=='docente'||s.role!==a.role||a.user!==String(s.user||'').trim().toLowerCase()||a.nivel!==s.nivel||a.permisosVersion!==s.permisosVersion||a.epoch!==data.epoch||!Number.isSafeInteger(a.issuedAt)||!Number.isSafeInteger(a.expiresAt)||a.expiresAt<=a.issuedAt||a.expiresAt-a.issuedAt>150000||!Array.isArray(a.contexts)||a.contexts.length>4096||a.contexts.some(k=>typeof k!=='string'||k.length>1024))return;\n  const until=started+a.expiresAt-a.issuedAt;if(until<=Date.now())return;\n  scopeAuthorization={actor,until,epoch:a.epoch,contexts:new Set(a.contexts),bytes:JSON.stringify(a).length*2};\n }\n async function verifyPermission(valid){",
      " async function verifyPermission(valid){"
    ],
    [
      "let criticalSaveContext=null,scopeAuthorization=null;",
      "let criticalSaveContext=null;"
    ]
  ],
  "registro-notas2-prefetch.js": [
    [
      "return {state:r?'reserved':known?'known':candidate?'incompatible':e?.state||'unknown',reserved:!!r,protectedLocal:!!r&&(r.local||!!o.hasLocal(c)||r.signature!==o.localSignature(c)),consultedAt:r?.at??null,expiresAt:r?.expires??null};",
      "return {state:r?'reserved':known?'known':candidate?'incompatible':e?.state||'unknown',reserved:!!r,consultedAt:r?.at??null,expiresAt:r?.expires??null};"
    ],
    [
      "   sync();const c=context(raw),k=key(c),candidate=receipts.get(k),known=!!o.isKnown?.(c),e=records.get(k);\n   // Presentation checks one receipt only; expiry/identity checks remain mandatory on acquire().\n   const r=candidate&&candidate.identity===identity&&candidate.expires>now()&&candidate.proof===proof(c)&&o.allowed(c)&&!known?candidate:null;\n   return {state:r?'reserved':known?'known':candidate?'incompatible':e?.state||'unknown',reserved:!!r,consultedAt:r?.at??null,expiresAt:r?.expires??null};",
      "   sync();prune();const c=context(raw),k=key(c),r=receipts.get(k),e=records.get(k);\n   return {state:r?'reserved':o.isKnown?.(c)?'known':e?.state||'unknown',reserved:!!r,consultedAt:r?.at??null,expiresAt:r?.expires??null};"
    ],
    [
      "return {start,select,prefetch,acquire,pause,hold,release,availability,availableBytes:",
      "return {start,select,prefetch,acquire,pause,hold,release,availableBytes:"
    ],
    [
      "  function availability(raw){\n   sync();prune();const c=context(raw),k=key(c),r=receipts.get(k),e=records.get(k);\n   return {state:r?'reserved':o.isKnown?.(c)?'known':e?.state||'unknown',reserved:!!r,consultedAt:r?.at??null,expiresAt:r?.expires??null};\n  }\n  function stats(){",
      "  function stats(){"
    ]
  ]
};
edits['registro.html']=edits['registro-connection.js'];
module.exports=(file,source)=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique reviewed session authorization delta');s=s.replace(current,previous);}return s;};
