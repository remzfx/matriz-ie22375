'use strict';
// Literal navigation deltas only; runtime tests use unmodified production source.
const assert=require('node:assert/strict'),edits=[
 [
  " function refresh(force=false){if(painting)return;\n  // A roster transition is not a rejected session. Wait for its existing read;\n  // authorized()/canEdit() still block the mismatched context throughout the wait.\n  if(!force&&!tutor()&&typeof cargandoEstudiantes!=='undefined'&&cargandoEstudiantes&&!authorized()){clearTimeout(timer);paint();return;}\n  const key=binding();if(activeKey&&key!==activeKey){activeKey=key;lastConnectionState=null;prefetch?.select(ctxBase());if(connection?.select)connection.select();else connection?.invalidate();}else if(!activeKey){activeKey=key;}const attendanceMissing=currentPanel()==='asistencia'&&get()?.status().panels.asistencia.version===null;if(attendanceMissing)prefetch?.select(ctxBase());clearTimeout(timer);timer=setTimeout(()=>connection?.check(false,force||attendanceMissing),30);paint();}",
  " function refresh(force=false){if(painting)return;const key=binding();if(activeKey&&key!==activeKey){activeKey=key;lastConnectionState=null;prefetch?.select(ctxBase());if(connection?.select)connection.select();else connection?.invalidate();}else if(!activeKey){activeKey=key;}const attendanceMissing=currentPanel()==='asistencia'&&get()?.status().panels.asistencia.version===null;if(attendanceMissing)prefetch?.select(ctxBase());clearTimeout(timer);timer=setTimeout(()=>connection?.check(false,force||attendanceMissing),30);paint();}"
 ],
 [
  "  let lease=!force&&!review?contextAuthorization():null;",
  "  const lease=!force&&!review?contextAuthorization():null;"
 ],
 [
  "  // A newly issued scope must also cap this context's grant, not only later visits.\n  lease=lease||contextAuthorization();\n",
  ""
 ]
];
module.exports=(file,source)=>{source=require('./notas2-active-renewal-boundary.cjs')(file,source);let s=source.replace(/\r\n/g,'\n');if(file==='registro-notas2-ui.js')for(const [current,previous]of edits)if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique bimestre navigation delta');s=s.replace(current,previous);}return s;};
