/* Administrative editor-only operation. Not exposed through doGet/doPost.
 * Read-only prepare; explicit fingerprint + confirmation required to execute.
 * No backups, archive copies or automatic retries are created.
 */
function academicResetJson_(raw){const p=JSON.parse(String(raw));if(!p||typeof p!=='object'||Array.isArray(p))throw Error('JSON académico inválido.');return p;}
function academicResetHash_(value){return calcularSha256Hex_(JSON.stringify(value));}
function academicResetSnapshot_(){
 const ss=SpreadsheetApp.getActiveSpreadsheet(),sheets=ss.getSheets().map(sh=>{const name=sh.getName(),range=sh.getDataRange(),sheet={name,id:sh.getSheetId(),rows:range.getValues()};if(name==='PRIMARIA'||name==='SECUNDARIA')sheet.formulas=range.getFormulas();return sheet;});
 return {id:ss.getId(),sheets};
}
function academicResetStatistics_(sheet){
 // Institutional legacy aggregate tables inspected read-only, 2026-10-23.
 // Only the verified headers-only state is classified. Populated tables require review.
 const header=['timestamp','bimestre','grado',...(sheet.name==='SECUNDARIA'?['seccion']:[]),'area','docente','n_estudiantes','competencia','logro','cantidad','porcentaje','clave'];
 const blank=v=>v===''||v===null||v===undefined,actual=sheet.rows[0]||[];
 if(header.some((value,i)=>actual[i]!==value)||actual.slice(header.length).some(v=>!blank(v)))throw Error('Hoja '+sheet.name+' no clasificada: encabezado institucional inesperado.');
 if(!Array.isArray(sheet.formulas))throw Error('Hoja '+sheet.name+' no clasificada: falta inventario de fórmulas.');
 if(sheet.formulas.some(row=>row.some(v=>!blank(v))))throw Error('Hoja '+sheet.name+' no clasificada: contiene fórmulas; requiere revisión.');
 if(sheet.rows.slice(1).some(row=>row.some(v=>!blank(v))))throw Error('Hoja '+sheet.name+' no clasificada: contiene datos; requiere revisión protegida.');
 return {kind:'headers-only-derived-statistics',columns:header.length,dataRows:0};
}
function academicResetNoAttendance_(value){
 if(value&&typeof value==='object')for(const [k,v]of Object.entries(value)){if(/^asis|asistencia/i.test(k))throw Error('Asistencia en almacén académico; requiere clasificación.');academicResetNoAttendance_(v);}
}
function academicResetLegacyMatrix_(raw){
 const p=academicResetJson_(raw),known=['bimestre','grado','seccion','totalEstudiantes','nombreDocente','areaActual','datos'];
 if(Object.keys(p).some(k=>!known.includes(k))||known.some(k=>!Object.prototype.hasOwnProperty.call(p,k)))throw Error('Campo de matriz Estados no inventariado.');
 if(!['I','II','III','IV'].includes(p.bimestre)||['grado','seccion','nombreDocente','areaActual'].some(k=>typeof p[k]!=='string')||!Number.isSafeInteger(p.totalEstudiantes)||p.totalEstudiantes<0)throw Error('Contexto de matriz Estados no clasificado.');
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);academicResetNoAttendance_(p);
 if(!object(p.datos))throw Error('Datos de matriz Estados no clasificados.');
 for(const aula of Object.values(p.datos)){
  if(!object(aula))throw Error('Aula de matriz Estados no clasificada.');
  for(const area of Object.values(aula)){
   if(!object(area))throw Error('Área de matriz Estados no clasificada.');
   for(const counts of Object.values(area))if(!object(counts)||Object.keys(counts).length!==4||['inicio','proceso','previsto','destacado'].some(k=>!Number.isSafeInteger(counts[k])||counts[k]<0))throw Error('Conteos de matriz Estados no clasificados.');
  }
 }
 return {...p,datos:{}};
}
function academicResetTransversalPayloads_(rows,col){
 const parts=new Map(),commits=[],result=[],used=new Set();
 for(const row of rows){
  if(row.every(v=>v===''))continue;const p=academicResetJson_(row[col]);
  if(p._ieTransversalParte===1){
   const key=String(row[0]);if(parts.has(key)||typeof p.data!=='string'||Object.keys(p).some(k=>!['_ieTransversalParte','data'].includes(k)))throw Error('Fragmento transversal inválido o duplicado.');parts.set(key,{row,data:p.data});
  }else if(p._ieTransversalBloque===1){
   if(!Number.isSafeInteger(p.partes)||p.partes<1||p.partes>512||Object.keys(p).some(k=>!['_ieTransversalBloque','partes'].includes(k)))throw Error('Bloque transversal inválido.');commits.push({row,p});
  }else result.push(p);
 }
 for(const {row,p}of commits){
  const joined=[];for(let i=0;i<p.partes;i++){
   const key=String(row[0])+'||@parte||'+row[col-1]+'||'+i,part=parts.get(key);
   if(!part||used.has(key)||JSON.stringify(part.row.slice(1,col))!==JSON.stringify(row.slice(1,col)))throw Error('Bloque transversal incompleto o inconsistente.');used.add(key);joined.push(part.data);
  }
  result.push(academicResetJson_(joined.join('')));
 }
 if(used.size!==parts.size)throw Error('Fragmento transversal huérfano.');return result;
}
function academicResetProtected_(snapshot){
 const gradingOnly=['RegistroHistorialAcademico','TransversalesAportes','TransversalesConsolidado','TransversalesProcesado'];
 return academicResetHash_(snapshot.sheets.filter(s=>s.name!=='AcademicResetControl').map(s=>({name:s.name,id:s.id,formulas:s.formulas,rows:gradingOnly.includes(s.name)?[s.rows[0]]:s.name==='Estados'?s.rows.map((r,i)=>i?[...r.slice(0,2),academicResetLegacyMatrix_(r[2]),...r.slice(3)]:r):s.name==='EstadosAreas'?s.rows.map((r,i)=>i?r.slice(0,9):r):s.name==='RegistroNotas'?s.rows.map((r,i)=>i?[...r.slice(0,7),Object.fromEntries(IEAcademicReset.attendance.map(k=>[k,academicResetJson_(r[8])[k]])),academicResetJson_(r[8]).meta?.studentAliases,academicResetJson_(r[8]).meta?.docente]:r):s.rows})));
}
function academicResetPlan_(snapshot,epoch,now){
 if(!/^[a-f0-9]{32}$/.test(epoch)||!Number.isSafeInteger(now)||now<=0)throw Error('Generación inválida.');
 const requests=[],counts={},classifications={},driveIds=new Set(),keys=new Set();
 const cell=v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v)}});
 function put(sh,row,col,values){requests.push({updateCells:{range:{sheetId:sh.id,startRowIndex:row,endRowIndex:row+1,startColumnIndex:col,endColumnIndex:col+values.length},rows:[{values:values.map(cell)}],fields:'userEnteredValue'}});}
 const noAttendance=academicResetNoAttendance_;
 function schema(sh,header){if(header.some((v,i)=>sh.rows[0]?.[i]!==v)||sh.rows.some(row=>row.slice(header.length).some(v=>v!=='')))throw Error('Esquema de '+sh.name+' inesperado.');}
 for(const sh of snapshot.sheets){
  counts[sh.name]=0;
  if(sh.name==='RegistroNotas'){
   if(JSON.stringify(sh.rows[0])!==JSON.stringify(['clave','nivel','bimestre','grado','seccion','area','docente','ts','json']))throw Error('Esquema de RegistroNotas inesperado.');
   for(let r=1;r<sh.rows.length;r++){
    const row=sh.rows[r];if(row.every(v=>v===''))continue;
    if(row.length>9&&row.slice(9).some(v=>v!==''))throw Error('Columnas adicionales no inventariadas.');
    const p=academicResetJson_(row[8]),version=Number(row[7]);
    if(!Number.isSafeInteger(version)||version<0||row[0]!==row.slice(1,6).join('||'))throw Error('Clave o versión inválida.');
    if(keys.has(row[0]))throw Error('Filas duplicadas: clasificar asistencia antes de continuar.');keys.add(row[0]);
    if(p.meta?.externalDriveBackup?.fileId)driveIds.add(p.meta.externalDriveBackup.fileId);
    for(const panel of ['calificar','promedios','asistencia']){const confirm=p.meta?.notas2?.[panel];if(confirm&&(!Number.isSafeInteger(confirm.version)||confirm.version<0||confirm.version>=Number.MAX_SAFE_INTEGER||confirm.at!=null&&!Number.isFinite(confirm.at)))throw Error('Confirmación de versión inválida.');}
    const v=Math.max(now,version+1,...Object.values(p.meta?.notas2||{}).filter(v=>v&&typeof v==='object').map(v=>Number(v.version)||0).map(v=>v+1)),next=IEAcademicReset.registration(p,epoch,v,version),raw=JSON.stringify(next);
    if(!Number.isSafeInteger(v))throw Error('Versión de reinicio inválida.');
    if(raw.length>49000)throw Error('Registro supera el límite de celda.');
    put(sh,r,7,[v,raw]);counts[sh.name]++;
   }
  }else if(sh.name==='Estados'){
   schema(sh,['nivel','actualizado','json']);
   for(let r=1;r<sh.rows.length;r++){const row=sh.rows[r];if(row.every(v=>v===''))continue;if(!['primaria','secundaria'].includes(row[0]))throw Error('Nivel de matriz Estados no clasificado.');put(sh,r,2,[JSON.stringify(academicResetLegacyMatrix_(row[2]))]);counts[sh.name]++;}
  }else if(sh.name==='EstadosAreas'){
   schema(sh,['clave','nivel','bimestre','grado','seccion','area','docente','totalEstudiantes','actualizado','json']);
   for(let r=1;r<sh.rows.length;r++){if(sh.rows[r].every(v=>v===''))continue;const p=academicResetJson_(sh.rows[r][9]);noAttendance(p);put(sh,r,9,['{}']);counts[sh.name]++;}
  }else if(['RegistroHistorialAcademico','TransversalesAportes','TransversalesConsolidado','TransversalesProcesado'].includes(sh.name)){
   // These sheets contain only grading. Never clear an unrecognized mixed schema.
   const col=sh.name==='RegistroHistorialAcademico'?6:sh.name==='TransversalesAportes'?8:6;
   schema(sh,sh.name==='RegistroHistorialAcademico'?['id','clave','version','parte','total','sha256','json']:sh.name==='TransversalesAportes'?['clave','bimestre','grado','seccion','areaOrigen','docente','user','ts','json']:['clave','bimestre','grado','seccion','versionAportes','ts','json']);
   if(sh.name==='RegistroHistorialAcademico'){
    // History chunks must be reconstructed before examining their contents.
    const groups={};for(const row of sh.rows.slice(1)){if(row.every(v=>v===''))continue;if(typeof row[col]!=='string'||!row[col].startsWith('j:'))throw Error('Historial no verificable.');const key=JSON.stringify(row.slice(0,3));(groups[key]||(groups[key]=[])).push(row);}
    for(const rows of Object.values(groups)){rows.sort((a,b)=>a[3]-b[3]);if(rows.length!==rows[0][4]||rows.some((r,i)=>r[3]!==i||r[4]!==rows.length||r[5]!==rows[0][5]))throw Error('Historial incompleto.');const raw=rows.map(r=>r[col].slice(2)).join('');if(calcularSha256Hex_(raw)!==rows[0][5]||calcularSha256Hex_(JSON.stringify([rows[0][1],rows[0][2],raw]))!==rows[0][0])throw Error('No se verificó la integridad del historial.');const history=JSON.parse(raw);if(!Array.isArray(history))throw Error('Historial no clasificado.');noAttendance(history);}
   }else for(const value of academicResetTransversalPayloads_(sh.rows.slice(1),col))noAttendance(value);
   if(sh.rows.length>1)requests.push({repeatCell:{range:{sheetId:sh.id,startRowIndex:1,endRowIndex:sh.rows.length,startColumnIndex:0,endColumnIndex:col+1},cell:{},fields:'userEnteredValue'}});
   counts[sh.name]=sh.rows.length-1;
  }else if(sh.name==='PRIMARIA'||sh.name==='SECUNDARIA'){
   classifications[sh.name]=academicResetStatistics_(sh); // No mutation or request for either sheet.
  }else if(!['AcademicResetControl','EstudiantesBase','DocentesAcceso','ConfigSistema','AsistenciaIngreso','SiagiePlantillas','AipPlan','WhatsappGrupos'].includes(sh.name)){
   throw Error('Hoja histórica no clasificada. No ejecutar hasta verificar su esquema.');
  }
 }
 let control=snapshot.sheets.find(s=>s.name==='AcademicResetControl');
 if(!control){let id=1932237500;while(snapshot.sheets.some(s=>s.id===id))id++;control={id,name:'AcademicResetControl'};requests.push({addSheet:{properties:{sheetId:id,title:control.name,gridProperties:{rowCount:2,columnCount:5}}}});}
 put(control,0,0,['schema','epoch','at','phase','files']);put(control,1,0,[1,epoch,now,'blocked','[]']);
 return {requests,counts,classifications,keys:[...keys],driveIds:[...driveIds],fingerprint:academicResetHash_(snapshot)};
}
function academicResetArchiveJson_(raw){const p=academicResetJson_(raw),next=IEAcademicReset.registration(p,'00000000000000000000000000000000',1);delete next.meta.notas2;if(p.meta?.notas2?.asistencia)next.meta.notas2={schema:p.meta.notas2.schema,asistencia:JSON.parse(JSON.stringify(p.meta.notas2.asistencia))};return JSON.stringify(next);}
function academicResetFiles_(plan){
 const ids=new Set(plan.driveIds),it=DriveApp.searchFiles("trashed = false and title contains 'RESPALDO_HISTORICO_22375_'");
 const prefixes=plan.keys.map(k=>'RESPALDO_HISTORICO_22375_'+k.replace(/\|\|/g,'_').normalize('NFD').replace(/[\u0300-\u036f]/g,'')+'_');
 while(it.hasNext()){const f=it.next();if(!prefixes.some(p=>f.getName().startsWith(p)))throw Error('Archivo histórico sin contexto verificado; requiere clasificación.');ids.add(f.getId());if(ids.size>200)throw Error('Demasiados archivos; requiere planificación por volumen.');}
 const files=[];for(const id of ids){const file=DriveApp.getFileById(id);if(!prefixes.some(p=>file.getName().startsWith(p)))throw Error('Referencia a un archivo fuera del alcance verificado.');const raw=file.getBlob().getDataAsString();if(raw.length>2000000)throw Error('Archivo demasiado grande.');files.push({id,hash:academicResetHash_(raw),next:academicResetArchiveJson_(raw)});}
 return files;
}
// Only spreadsheet owner in the Apps Script editor. No token or user-supplied role grants access.
function academicResetOwner_(){const active=Session.getActiveUser().getEmail(),effective=Session.getEffectiveUser().getEmail(),owner=DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).getOwner().getEmail();if(!active||active!==effective||active!==owner)throw Error('Solo el propietario en el editor puede preparar/ejecutar.');}
function prepararLimpiezaCalificaciones_(){
 academicResetOwner_();const current=academicResetState_();if(current.epoch)return {ok:true,alreadyApplied:true,epoch:current.epoch};
 const epoch=Utilities.getUuid().replace(/-/g,''),now=Date.now(),snapshot=academicResetSnapshot_(),plan=academicResetPlan_(snapshot,epoch,now),files=academicResetFiles_(plan);
 return {ok:true,mode:'dry-run',epoch,at:now,fingerprint:plan.fingerprint,filesFingerprint:academicResetHash_(files.map(f=>({id:f.id,hash:f.hash}))),counts:plan.counts,classifications:plan.classifications,files:files.length};
}
function ejecutarLimpiezaCalificaciones_(approval){
 academicResetOwner_();if(!approval||approval.confirmation!=='ELIMINAR SOLO CALIFICACIONES')throw Error('Confirmación explícita requerida.');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const current=academicResetState_();if(current.epoch){if(current.epoch!==approval.epoch)throw Error('Otra operación ya fue aplicada.');if(current.phase==='complete')return {ok:true,alreadyApplied:true,epoch:current.epoch};return academicResetFinishFiles_(current);}
  const snapshot=academicResetSnapshot_(),plan=academicResetPlan_(snapshot,approval.epoch,approval.at),files=academicResetFiles_(plan);
  if(plan.fingerprint!==approval.fingerprint||academicResetHash_(files.map(f=>({id:f.id,hash:f.hash})))!==approval.filesFingerprint)throw Error('Cambió el inventario. Sin ejecución.');
  const controlId=plan.requests.find(r=>r.addSheet)?.addSheet?.properties.sheetId||snapshot.sheets.find(s=>s.name==='AcademicResetControl').id;
  const manifest={protectedFingerprint:academicResetProtected_(snapshot),files:files.map(f=>({id:f.id,before:f.hash,after:academicResetHash_(f.next)}))};
  if(JSON.stringify(manifest).length>49000)throw Error('Manifiesto demasiado grande.');
  plan.requests.push({updateCells:{range:{sheetId:controlId,startRowIndex:1,endRowIndex:2,startColumnIndex:4,endColumnIndex:5},rows:[{values:[{userEnteredValue:{stringValue:JSON.stringify(manifest)}}]}],fields:'userEnteredValue'}});
  // Block automatic restorers BEFORE destroying any archive. Marker and all grading rows are
  // committed together by one atomic Sheets batch. Existing assistance cells are never targeted.
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(snapshot.id)+':batchUpdate';
  const response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({requests:plan.requests}),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw Error('No se confirmó la transacción. No reintentar automáticamente; verificar el marcador.');
  if(academicResetState_().epoch!==approval.epoch)throw Error('No se verificó el marcador.');
  return academicResetFinishFiles_(academicResetState_());
 }finally{lock.releaseLock();}
}
function academicResetFinishFiles_(state){
 // Explicit resume only: hashes distinguish already-sanitized files; never repeat the Sheets reset.
 const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AcademicResetControl'),manifest=JSON.parse(sh.getRange(2,5).getValue());
 if(academicResetProtected_(academicResetSnapshot_())!==manifest.protectedFingerprint)throw Error('La integridad protegida requiere revisión. No se habilitó edición académica.');
 for(const ref of manifest.files){
  const file=DriveApp.getFileById(ref.id),raw=file.getBlob().getDataAsString(),hash=academicResetHash_(raw);if(hash===ref.after)continue;
  if(hash!==ref.before)throw Error('Archivo cambió; reinicio bloqueado para revisión.');
  const next=academicResetArchiveJson_(raw);if(academicResetHash_(next)!==ref.after)throw Error('Proyección de archivo distinta.');
  file.setContent(next);if(academicResetHash_(file.getBlob().getDataAsString())!==ref.after)throw Error('No se verificó el archivo.');
 }
 if(academicResetProtected_(academicResetSnapshot_())!==manifest.protectedFingerprint)throw Error('Cambió información protegida durante la retirada de archivos.');
 sh.getRange(2,4).setValue('complete');if(academicResetState_().phase!=='complete')throw Error('No se confirmó la finalización.');
 return {ok:true,epoch:state.epoch,files:manifest.files.length};
}
