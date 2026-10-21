/* Notas 2.0. Nuevo contrato explícito; no modifica rutas antiguas ni migra registros al leer. */
function notas2Ruta_(body) {
  const save=String(body.action).toLowerCase()==='savenotas2',ctx=contextoEscritura_(body,true);
  if(!ctx)return {ok:false,code:'CONTEXT',error:'Contexto académico inválido.'};
  const permission=autorizarEscritura_(body,ctx);
  if(!permission)return {ok:false,code:'SESSION',error:'Sesión inválida o sin autorización.'};
  const context={nivel:ctx.nivel,bim:ctx.bimestre,grado:ctx.grado,seccion:ctx.seccion,area:ctx.area};
  const key=[ctx.nivel,ctx.bimestre,ctx.grado,ctx.seccion,ctx.area].join('||'),prefix=key+'||';
  const fields={calificar:['sessions','grades','capsSel','calificarEstado'],promedios:['finales','concComp','competenciasEstado'],asistencia:['asistencia','asisFechas','asisFechasEstado']};
  if(save&&!Object.prototype.hasOwnProperty.call(fields,body.panel))return {ok:false,code:'PANEL',error:'Panel inválido.'};
  const lock=LockService.getScriptLock();if(save)lock.waitLock(30000);
  try{
    const ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName('RegistroNotas');let row=0,values;
    if(sh&&sh.getLastRow()>1){const rows=sh.getRange(2,1,sh.getLastRow()-1,9).getValues();for(let i=0;i<rows.length;i++)if(String(rows[i][0])===key){if(row)return {ok:false,code:'READ_CORRUPT',error:'Registro duplicado; requiere revisión.'};row=i+2;values=rows[i];}}
    let previous={};if(row){try{previous=JSON.parse(String(values[8]));if(!previous||typeof previous!=='object'||Array.isArray(previous))throw Error();}catch(e){return {ok:false,code:'READ_CORRUPT',error:'Registro ilegible; no se reemplazó información.'};}}
    const oldMeta=previous.meta&&typeof previous.meta==='object'&&!Array.isArray(previous.meta)?previous.meta:{};
    const protocol=oldMeta.notas2&&oldMeta.notas2.schema===1?oldMeta.notas2:null;
    const oldVersion=row?Number(values[7]):0;if(!Number.isSafeInteger(oldVersion)||oldVersion<0)return {ok:false,code:'READ_CORRUPT',error:'Versión académica inválida.'};
    const versions={},at={};for(const p of Object.keys(fields)){versions[p]=protocol?protocol[p]?.version??oldVersion:oldVersion;at[p]=protocol?protocol[p]?.at??null:(oldVersion||null);if(!Number.isSafeInteger(versions[p])||versions[p]<0||at[p]!==null&&!Number.isFinite(at[p]))return {ok:false,code:'READ_CORRUPT',error:'Confirmación previa inválida.'};}
    const legacy=(!protocol||protocol.adopted!==true)&&(['grades','finales','concComp'].some(f=>Object.keys(previous[f]||{}).length)||(previous.sessions||[]).length>0);
    const studentSheet=ss.getSheetByName('EstudiantesBase'),roster=studentSheet&&leerPadronEstudiantes_(studentSheet,ctx.bimestre);
    if(!roster)return {ok:false,code:'ROSTER',error:'No se verificó el padrón autorizado del bimestre.'};
    const model=registroAcademico_(),competencies=(model.catalog[ctx.nivel]||{})[ctx.area];
    if(!competencies)return {ok:false,code:'CONTEXT',error:'Área académica inválida.'};
    const identity=academicIdentityFactory();
    function projected(payload,enforceResolved){const result=identity.project(payload,roster.estudiantes,context,competencies);if(result.conflicts.length||(enforceResolved&&result.unresolved.length))throw Error(result.conflicts.length?'Notas históricas ambiguas: requieren revisión explícita.':'Identidades históricas pendientes de revisión.');return result;}
    function view(payload){
      const proj=projected(payload,false),p=payloadRegistroLectura_(proj.payload,{sesion:{role:permission.role}},ctx);
      for(const f of Object.values(fields).flat())if(p[f]===undefined)p[f]=f==='sessions'?[]:{};
      p.calificarEstado=JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(payload.calificarEstado||p.competenciasEstado||{}).filter(([k])=>k.startsWith(prefix)))));
      model.validate(p,context);notas2Validar_(p,context,competencies);if(proj.unresolved.length)p.meta=Object.assign({},p.meta||{},{unresolvedIdentities:proj.unresolved});
      // Read-only projection; never insert or persist a legacy record here.
      return p;
    }
    function reply(payload){return {ok:true,notas2:1,key:key,exists:!!row,legacy:legacy,readonly:!bimestreAbierto_(ctx.bimestre),versions:versions,at:at,payload:view(payload)};}
    if(!save)return reply(previous);
    if(!bimestreAbierto_(ctx.bimestre))return {ok:false,code:'CLOSED',readonly:true,error:'Bimestre cerrado o bloqueado.'};
    if(!Number.isSafeInteger(body.version)||body.version!==versions[body.panel])return {ok:false,code:'CONFLICT',error:'Otra computadora confirmó una versión posterior. Baje y revise antes de guardar.'};
    if(legacy&&body.panel==='calificar')return {ok:false,code:'LEGACY_REVIEW',error:'Consulte el registro histórico; procese y guarde Promedios explícitamente antes de editar Calificar con Notas 2.0.'};
    const input=body.payload;if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(f=>!fields[body.panel].includes(f))||fields[body.panel].some(f=>!Object.prototype.hasOwnProperty.call(input,f)))return {ok:false,code:'PAYLOAD',error:'El guardado debe contener únicamente el panel seleccionado completo.'};
    const next=JSON.parse(JSON.stringify(previous));
    for(const f of fields[body.panel]){
      const v=input[f];if(f==='sessions'){if(!Array.isArray(v)||v.some(s=>[s.nivel,s.bim,s.grado,s.seccion,s.area].join('||')!==key))throw Error('Sesiones de otro contexto.');}
      else if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>body.panel==='asistencia'?(f==='asisFechas'?k!==[ctx.nivel,ctx.bimestre,ctx.grado,ctx.seccion].join('||'):!k.startsWith([ctx.nivel,ctx.bimestre,ctx.grado,ctx.seccion].join('||')+'||')):!k.startsWith(prefix)))throw Error('Mapa académico de otro contexto.');
      next[f]=JSON.parse(JSON.stringify(v));
    }
    if(body.panel==='calificar')for(const [k,v]of Object.entries(next.calificarEstado))if(!competencies.includes(k.slice(prefix.length))||!v||typeof v.trabajada!=='boolean')throw Error('Estado de competencia inválido.');
    // Do not replace historical/other-panel data to canonicalize them implicitly.
    const candidate=projected(next,true).payload;
    for(const f of fields[body.panel].filter(f=>f!=='calificarEstado'))if(!identity.equal(candidate[f]||{},next[f]||{}))throw Error('La identidad enviada no coincide con el padrón autorizado.');
    model.validate(next,context);notas2Validar_(next,context,competencies);
    if(body.panel!=='asistencia'&&ctx.nivel==='secundaria'&&permission.role==='docente')validarTransversalesObligatorias_(ctx,permission);
    const now=Date.now(),version=Math.max(now,oldVersion+1);if(!Number.isSafeInteger(version))throw Error('Versión fuera de rango.');versions[body.panel]=version;at[body.panel]=now;
    next.modeloAcademico=1;next.meta=Object.assign({},oldMeta,{docente:permission.docente,notas2:{schema:1,adopted:!!protocol?.adopted||body.panel==='promedios'||!legacy,calificar:{version:versions.calificar,at:at.calificar},promedios:{version:versions.promedios,at:at.promedios},asistencia:{version:versions.asistencia,at:at.asistencia}}});
    // Existing history is retained byte-for-byte as data. No new upload-history or archive rows.
    const raw=JSON.stringify(next);if(raw.length>49000)return {ok:false,code:'SIZE',error:'El registro supera el límite seguro; no se borraron antecedentes.'};
    const target=sh||asegurarReg_(),targetRow=row||target.getLastRow()+1;
    target.getRange(targetRow,1,1,9).setValues([[key,ctx.nivel,ctx.bimestre,ctx.grado,ctx.seccion,ctx.area,permission.docente,version,raw]]);
    row=targetRow;
    const response=reply(next);response.legacy=!next.meta.notas2.adopted&&legacy;response.panel=body.panel;return response;
  }catch(e){return {ok:false,code:'NOTAS2',error:e.message||'No se confirmó el guardado.'};}
  finally{if(save)lock.releaseLock();}
}

// Use the existing curriculum/conversion model; this validates partial saves, not SIAGIE completeness.
function notas2Validar_(payload,context,competencies){
 const math=registroEvaluacion_();
 for(const field of ['grades','finales'])for(const v of Object.values(payload[field]||{})){
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Nota académica inválida.');
  if(v.borrado===true)continue;
  if(v.origen!==undefined&&!['letra','numero'].includes(v.origen))throw Error('Modo de nota inválido.');
  const hasNumber=v.nota20!==''&&v.nota20!=null,level=typeof v.nivel==='string'?v.nivel.toUpperCase():v.nivel;if(!hasNumber&&(!level||level===''))continue;
  if(hasNumber&&(!Number.isFinite(Number(v.nota20))||Number(v.nota20)<0||Number(v.nota20)>20))throw Error('Nota fuera de 0–20.');
  if(level!==undefined&&level!==''&&!['AD','A','B','C'].includes(level))throw Error('Nivel de logro inválido.');
  if(!hasNumber&&!['AD','A','B','C'].includes(level))throw Error('Nota sin valor.');
  if(hasNumber&&level&&v.origen!=='letra'&&math.numToLetter(Number(v.nota20))!==level)throw Error('Nota y nivel inconsistentes.');
  if(v.conclusion!==undefined&&(typeof v.conclusion!=='string'||v.conclusion.length>2000))throw Error('Conclusión inválida.');
 }
 for(const session of payload.sessions||[]){if(!session||!competencies.includes(session.comp)||typeof session.capacidad!=='string'||!session.capacidad.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(session.fecha))throw Error('Sesión de evaluación inválida.');}
}
