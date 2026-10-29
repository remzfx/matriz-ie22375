'use strict';
// Exact roster-wait/presentation deltas; runtime tests use raw production modules.
const assert=require('node:assert/strict'),edits={
  "registro-connection.js": [
    [
      "   if(disposed)return false;if(o.defer?.())return false;scope();if(retentionFailed){emit('review');return false;}if(expired){emit('session');return false;}\n",
      "   if(disposed)return false;scope();if(retentionFailed){emit('review');return false;}if(expired){emit('session');return false;}\n"
    ],
    [
      "    if(!o.authorized()){if(o.defer?.())return false;emit('session');return false;}\n",
      "    if(!o.authorized()){emit('session');return false;}\n"
    ]
  ],
  "registro-notas2-ui.js": [
    [
      "  const pending=pane!=='resumen'&&!tutor()&&!error&&!save.pending&&!uploadAttendance.pending&&(access||load&&!prepared||roster);\n  const detail=error?({session:'Sesión inválida — vuelve a iniciar sesión.',server:'Servidor no disponible — edición pausada.',offline:'Conexión perdida. Estamos intentando reconectar…',review:'Conflicto de versiones — consulta la nube antes de guardar.'})[error]:access?'Verificando acceso a '+aula+' · Bimestre '+c.bim:download.pending&&load?'Recuperando información del servidor':load?'Cargando '+(pane==='asistencia'?'asistencia':'calificaciones')+' de '+aula:roster?'Cargando padrón de '+aula+' · Bimestre '+c.bim:'Información pendiente de verificación. Consulte la nubecita.';\n",
      "  const pending=pane!=='resumen'&&!tutor()&&!error&&!save.pending&&!uploadAttendance.pending&&(access||load&&!prepared||roster&&missing);\n  const detail=error?({session:'Sesión inválida — vuelve a iniciar sesión.',server:'Servidor no disponible — edición pausada.',offline:'Conexión perdida. Estamos intentando reconectar…',review:'Conflicto de versiones — consulta la nube antes de guardar.'})[error]:access?'Verificando acceso a '+aula+' · Bimestre '+c.bim:download.pending&&load?'Recuperando información del servidor':load?'Cargando '+(pane==='asistencia'?'asistencia':'calificaciones')+' de '+aula:roster?'Recuperando información del servidor':'Información pendiente de verificación. Consulte la nubecita.';\n"
    ],
    [
      "  ind.style.cssText='cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:4px;vertical-align:middle;background:#0f172a;border:1px solid #475569;font:inherit;position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);right:10px;z-index:50;min-width:44px;min-height:44px;justify-content:center;border-radius:50%;box-sizing:border-box;';\n",
      "  ind.style.cssText='cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:4px;vertical-align:middle;background:transparent;border:0;font:inherit;';\n"
    ],
    [
      " connection=IERegistroConnection.create({owner,defer:()=>!tutor()&&typeof cargandoEstudiantes!=='undefined'&&cargandoEstudiantes&&!authorized()&&!!getLoginSession()?.token&&IEStudents.validToken()===getLoginSession().token,binding:()=>binding()+(tutor()?'|tutor|'+document.getElementById('transAula').value+'|'+document.getElementById('transBim').value:''),authorized:()=>{if(tutor())return !!getLoginSession()?.token;if(esVistaAdmin()){const s=getLoginSession()||{};return !!(s.token&&s.role==='admin'&&typeof IEStudents!=='undefined'&&IEStudents.validToken()===s.token&&padronBimestre===ctxBase().bim&&tokenPadron===s.token&&registroLocal.matches());}return authorized();},readonly,allowed:()=>tutor()?!esVistaAdmin()&&bimestreHabilitado(document.getElementById('transBim')?.value):!readonly(),retain:()=>{if(canEdit())collect();},online:()=>navigator.onLine!==false,visible:()=>document.visibilityState!=='hidden',changed:value=>{if(['session','server','offline'].includes(value.state)){scopeAuthorization=null;prefetch?.pause();}const box=document.getElementById('registroConnectionStatus'),text=document.getElementById('registroConnectionText');if(box){box.dataset.state=value.state;box.style.display='none';}const statusMap={connected:'Conectado — notas verificadas.',pending:'Conectado — cambios sin guardar.',checking:'Verificando conexión…',offline:'Conexión perdida. Estamos intentando reconectar…',server:'Servidor no disponible — edición pausada.',session:'Sesión inválida — vuelve a iniciar sesión.',readonly:esVistaAdmin()?'Vista Administrador — solo lectura.':'Bimestre cerrado — solo lectura.',review:'Conflicto de versiones — consulta la nube antes de guardar.'};const msg=statusMap[value.state]||value.state;if(text)text.textContent=msg;lastConnectionState=value.state;/* Connectivity gates editing without changing academic errors, CAS or in-flight epochs. */const retryBtn=document.getElementById('registroRetryOffer');if(retryBtn)retryBtn.hidden=true;paint();if(value.state==='connected'||value.state==='pending')startPrefetch();},verify:async({valid,review,force})=>{\n",
      " connection=IERegistroConnection.create({owner,binding:()=>binding()+(tutor()?'|tutor|'+document.getElementById('transAula').value+'|'+document.getElementById('transBim').value:''),authorized:()=>{if(tutor())return !!getLoginSession()?.token;if(esVistaAdmin()){const s=getLoginSession()||{};return !!(s.token&&s.role==='admin'&&typeof IEStudents!=='undefined'&&IEStudents.validToken()===s.token&&padronBimestre===ctxBase().bim&&tokenPadron===s.token&&registroLocal.matches());}return authorized();},readonly,allowed:()=>tutor()?!esVistaAdmin()&&bimestreHabilitado(document.getElementById('transBim')?.value):!readonly(),retain:()=>{if(canEdit())collect();},online:()=>navigator.onLine!==false,visible:()=>document.visibilityState!=='hidden',changed:value=>{if(['session','server','offline'].includes(value.state)){scopeAuthorization=null;prefetch?.pause();}const box=document.getElementById('registroConnectionStatus'),text=document.getElementById('registroConnectionText');if(box){box.dataset.state=value.state;box.style.display='none';}const statusMap={connected:'Conectado — notas verificadas.',pending:'Conectado — cambios sin guardar.',checking:'Verificando conexión…',offline:'Conexión perdida. Estamos intentando reconectar…',server:'Servidor no disponible — edición pausada.',session:'Sesión inválida — vuelve a iniciar sesión.',readonly:esVistaAdmin()?'Vista Administrador — solo lectura.':'Bimestre cerrado — solo lectura.',review:'Conflicto de versiones — consulta la nube antes de guardar.'};const msg=statusMap[value.state]||value.state;if(text)text.textContent=msg;lastConnectionState=value.state;/* Connectivity gates editing without changing academic errors, CAS or in-flight epochs. */const retryBtn=document.getElementById('registroRetryOffer');if(retryBtn)retryBtn.hidden=true;paint();if(value.state==='connected'||value.state==='pending')startPrefetch();},verify:async({valid,review,force})=>{\n"
    ]
  ],
  "registro.html": [
    [
      "   if(disposed)return false;if(o.defer?.())return false;scope();if(retentionFailed){emit('review');return false;}if(expired){emit('session');return false;}\n",
      "   if(disposed)return false;scope();if(retentionFailed){emit('review');return false;}if(expired){emit('session');return false;}\n"
    ],
    [
      "    if(!o.authorized()){if(o.defer?.())return false;emit('session');return false;}\n",
      "    if(!o.authorized()){emit('session');return false;}\n"
    ],
    [
      "function tituloCargaRegistro(detalle){return String(detalle).startsWith('Verificando acceso')?'Verificando acceso…':String(detalle).startsWith('Cargando padrón')?'Cargando padrón…':detalle==='Preparando comparativo bimestral'?'Preparando comparativo bimestral…':'Espere, sincronizando información…';}\n",
      "function tituloCargaRegistro(detalle){return String(detalle).startsWith('Verificando acceso')?'Verificando acceso…':detalle==='Preparando comparativo bimestral'?'Preparando comparativo bimestral…':'Espere, sincronizando información…';}\n"
    ]
  ]
};
module.exports=(file,source)=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique roster heartbeat delta');s=s.replace(current,previous);}return s;};
