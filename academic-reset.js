/* Academic reset primitives. Pure: never accesses storage, network or production data. */
(function(root){
 'use strict';
 const academic=['sessions','grades','finales','concComp','concArea','capsSel','calificarEstado','competenciasEstado','directos','conclusiones','academicHistory','externalDriveBackup','fuentesHistoricas','historicalConflicts','historicalCoincidences'];
 const attendance=['asistencia','asisFechas','asisFechasEstado'];
 const copy=x=>JSON.parse(JSON.stringify(x));
 function clean(value){
  if(Array.isArray(value))return value.map(clean);
  if(!value||typeof value!=='object')return value;
  const out={};for(const [k,v]of Object.entries(value)){
   if(/^asis|asistencia/i.test(k)){out[k]=copy(v);continue;}
   if(academic.includes(k))continue;
   // Old baselines/drafts may encode a complete payload as JSON text.
   if(typeof v==='string'&&['raw','signature','baseline','lastDisk'].includes(k)){
    try{out[k]=JSON.stringify(clean(JSON.parse(v)));}catch(_){throw Error('Borrador codificado no verificable.');}
   }else out[k]=clean(v);
  }return out;
 }
 function registration(payload,epoch,version,previousVersion=version){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Registro inválido.');
  const known=[...academic,...attendance,'meta','studentAliases','modeloAcademico','ts','_ts','registroVersion'];
  if(Object.keys(payload).some(k=>!known.includes(k)))throw Error('Campo de RegistroNotas no inventariado.');
  if(payload.meta&&(typeof payload.meta!=='object'||Array.isArray(payload.meta)||Object.keys(payload.meta).some(k=>!['docente','studentAliases','notas2','academicHistory','externalDriveBackup'].includes(k))))throw Error('Metadato académico no inventariado.');
  const out=clean(payload);for(const k of attendance)if(JSON.stringify(out[k])!==JSON.stringify(payload[k]))throw Error('Cambió asistencia.');
  out.sessions=[];for(const k of ['grades','finales','concComp','concArea','capsSel','calificarEstado','competenciasEstado'])out[k]={};
  out.modeloAcademico=1;out.meta=out.meta||{};
  out.meta.notas2={schema:1,adopted:true,academicEpoch:epoch,calificar:{version,at:null},promedios:{version,at:null},asistencia:copy(payload.meta?.notas2?.asistencia||{version:previousVersion,at:previousVersion||null})};
  return out;
 }
 function local(key,value){
  const out=clean(value);
  if(/^matriz_(SEC_)?IE22375/.test(key)){out.datos={};out.ultimaModificacion=0;}
  return out;
 }
 const localKey=k=>/^ie22375_registro_notas_v2(?::|$)/.test(k)||/^matriz_(SEC_)?IE22375/.test(k);
 const api={academic,attendance,clean,registration,local,localKey};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IEAcademicReset=api;
})(typeof window==='undefined'?globalThis:window);
