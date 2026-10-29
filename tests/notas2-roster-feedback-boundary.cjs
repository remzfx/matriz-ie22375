'use strict';
// Exact scoped roster-feedback deltas; runtime tests use raw production code.
const assert=require('node:assert/strict'),edits={
  "registro-notas2-ui.js": [
    [
      " // Presentation observes existing promises/states; never starts a read or grants access.\n function visibleRosterRead(){return !!(typeof lecturaPadronRegistro!=='undefined'&&lecturaPadronRegistro&&typeof cargandoEstudiantes!=='undefined'&&cargandoEstudiantes&&lecturaPadronRegistro.bimestre===ctxBase().bim&&lecturaPadronRegistro.token===getLoginSession()?.token);}\n function readStatus(){\n",
      " // Presentation observes existing promises/states; never starts a read or grants access.\n function readStatus(){\n"
    ],
    [
      "  const missing=['calificar','promedios','asistencia'].includes(pane)&&s?.panels[pane]?.version==null;\n  const access=accessRead?.key===binding()&&!connection?.canEdit(),load=s?.state==='checking'&&!!s.busy,roster=visibleRosterRead();\n  const prepared=load&&missing&&prefetch?preparation().state==='prepared':false;\n",
      "  const missing=['calificar','promedios','asistencia'].includes(pane)&&s?.panels[pane]?.version==null;\n  const access=accessRead?.key===binding()&&!connection?.canEdit(),load=s?.state==='checking'&&!!s.busy,roster=typeof cargandoEstudiantes!=='undefined'&&cargandoEstudiantes;\n  const prepared=load&&missing&&prefetch?preparation().state==='prepared':false;\n"
    ],
    [
      "  else if(isReadonly){effectiveState='readonly';effectiveMsg=esVistaAdmin()?'Vista Administrador — solo lectura.':'Bimestre cerrado — solo lectura.';}\n  else if(connState==='checking'||s?.state==='checking'||!connection?.canEdit()||pane==='asistencia'&&s?.panels.asistencia.version===null){effectiveState='checking';effectiveMsg=visibleRosterRead()?'Cargando padrón — acceso pendiente de verificación.':accessRead||s?.busy||s?.state==='checking'?'Verificando acceso — edición sujeta a autorización vigente.':'Sin concesión vigente — edición pausada. Abra el diagnóstico.';}\n  else if(activePending){effectiveState='pending';effectiveMsg='Conectado — cambios sin guardar.';}\n",
      "  else if(isReadonly){effectiveState='readonly';effectiveMsg=esVistaAdmin()?'Vista Administrador — solo lectura.':'Bimestre cerrado — solo lectura.';}\n  else if(connState==='checking'||s?.state==='checking'||!connection?.canEdit()||pane==='asistencia'&&s?.panels.asistencia.version===null){effectiveState='checking';effectiveMsg=typeof cargandoEstudiantes!=='undefined'&&cargandoEstudiantes?'Cargando padrón — acceso pendiente de verificación.':accessRead||s?.busy||s?.state==='checking'?'Verificando acceso — edición sujeta a autorización vigente.':'Sin concesión vigente — edición pausada. Abra el diagnóstico.';}\n  else if(activePending){effectiveState='pending';effectiveMsg='Conectado — cambios sin guardar.';}\n"
    ]
  ],
  "registro.html": [
    [
      "let bdEstudiantes = IEStudents.empty();\nlet cargandoEstudiantes = false, lecturaPadronRegistro = null;\nfunction loadBD() { return bdEstudiantes; }\n",
      "let bdEstudiantes = IEStudents.empty();\nlet cargandoEstudiantes = false;\nfunction loadBD() { return bdEstudiantes; }\n"
    ],
    [
      "  }\n  tokenPadron = tokenSolicitud; lecturaPadronRegistro = Object.freeze({solicitud,bimestre,token:tokenSolicitud}); cargandoEstudiantes = true;\n  bloquearRegistroMientrasValida(true);\n",
      "  }\n  tokenPadron = tokenSolicitud; cargandoEstudiantes = true;\n  bloquearRegistroMientrasValida(true);\n"
    ],
    [
      "  } finally {\n    if (solicitud === solicitudPadron) { cargandoEstudiantes = false; lecturaPadronRegistro = null; sincronizarEdicionRegistro(); }\n  }\n",
      "  } finally {\n    if (solicitud === solicitudPadron) { cargandoEstudiantes = false; sincronizarEdicionRegistro(); }\n  }\n"
    ]
  ]
};
module.exports=(file,source)=>{let s=require('./notas2-secondary-roster-boundary.cjs')(file,source).replace(/\r\n/g,'\n');for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique roster feedback delta');s=s.replace(current,previous);}return s;};
