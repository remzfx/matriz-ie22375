/* Diagnóstico de sincronización — Interfaz accesible sin DevTools */
(function(root){
 'use strict';

  const SAFE_CODES = new Set([
   'SESSION','DENIED','CLOSED','TIMEOUT','HTTP','READ_INVALID','READ_MISSING',
   'READ_STALE','READ_VERSION','READ_INCOMPLETE','READ_EMPTY','READ_BASE',
   'READ_CORRUPT','CONTEXT_CHANGED','UNAVAILABLE','DUPLICATE','API_INCOMPATIBLE',
   'MODULE_MISSING'
  ]);
  const safeErrorCode = code => SAFE_CODES.has(String(code)) ? String(code) : 'UNAVAILABLE';

 function escapeHtml(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 }

 function buildDialogContent(report){
  const p = report?.period || {};
  const c = report?.connection || {};
  const conf = report?.conflicts || {};
  const causes = conf.causes || {};
  const byModule = conf.byModule || {};

  // Error view if unavailable or read rejected
  if(report?.status === 'unavailable' || report?.status === 'read_rejected'){
   return '<div style="color:#991b1b;background:#fef2f2;padding:12px;border-radius:8px;border:1px solid #fecaca;margin-bottom:12px">'
    + '<h3 style="margin:0 0 6px 0;font-size:14px;font-weight:700">No se pudo completar la consulta de lectura ('+escapeHtml(safeErrorCode(report?.code))+')</h3>'
    + '<p style="margin:0;font-size:12px">Conserva esta pestaña abierta. No recargues la página ni limpies la memoria caché.</p></div>';
  }

  // 1. Estado administrativo real
  let periodHtml = '';
  if(p.closed === true){
   periodHtml = '<div style="padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-weight:600;margin-bottom:8px">🔴 Cierre administrativo en servidor: Bimestre '+escapeHtml(p.server)+' (Solo lectura oficial por Administración)</div>';
  } else if(p.closed === false){
   periodHtml = '<div style="padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;color:#166534;font-weight:600;margin-bottom:8px">🟢 Servidor: Bimestre '+escapeHtml(p.server).toUpperCase()+' (Abierto en backend)</div>';
  } else {
   periodHtml = '<div style="padding:8px 12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;color:#334155;margin-bottom:8px">⚪ Estado de periodo en servidor: '+escapeHtml(p.server||'desconocido')+'</div>';
  }

  // 2. Motivo de bloqueo y diferenciación (reutilizando la claridad de PR #97)
  let blockHtml = '';
  if(report?.blocks?.synchronization){
   let reason = 'Edición pausada por sincronización.';
   if(c.state === 'review' || report.status === 'review'){
    reason = 'Edición pausada por revisión de sincronización. Hay discrepancias entre el trabajo local y la nube que requieren revisión explícita para proteger las notas.';
   } else if(c.state === 'offline'){
    reason = 'Sin conexión a internet. Edición pausada para proteger notas locales.';
   } else if(c.state === 'session'){
    reason = 'Sesión vencida o no autorizada.';
   }
   blockHtml = '<div style="padding:8px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;color:#9a3412;margin-bottom:8px">'
    + '<strong>⚠️ Motivo de pausa:</strong> '+escapeHtml(reason);
   if(p.closed === false){
    blockHtml += '<div style="margin-top:6px;font-size:12px;color:#7c2d12;background:#ffedd5;padding:6px 8px;border-radius:4px">'
     + 'ℹ️ <em>Aclaración:</em> Si la pantalla muestra «Bimestre cerrado por administración», se debe al bloqueo preventivo de sincronización. En el servidor el bimestre permanece <strong>ABIERTO</strong>.</div>';
   }
   blockHtml += '</div>';
  } else if(!report?.blocks?.period){
   blockHtml = '<div style="padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;color:#166534;margin-bottom:8px">🟢 Sin bloqueos activos de sincronización.</div>';
  }

  // 3. Conflictos agregados por módulo
  let modulesHtml = '<div style="margin-bottom:8px"><strong>Conflictos confirmados ('+Number(conf.total||0)+'):</strong>';
  if(conf.total > 0){
   modulesHtml += '<ul style="margin:4px 0 0 16px;padding:0;list-style-type:disc">';
   for(const [mod, count] of Object.entries(byModule)){
    const modLabel = mod === 'promedios' ? 'Promedios' : mod === 'calificar' ? 'Calificar' : mod === 'asistencia' ? 'Asistencia' : mod === 'identidades' ? 'Identidades' : mod;
    modulesHtml += '<li><strong>'+escapeHtml(modLabel)+':</strong> '+count+' conflicto(s)</li>';
   }
   modulesHtml += '</ul>';
  } else {
   modulesHtml += ' <span style="color:#166534">0 conflictos confirmados</span></div>';
  }
  if(conf.total > 0) modulesHtml += '</div>';

  // 4. Causas identificadas
  let causesHtml = '';
  if(Object.keys(causes).length > 0){
   const causeLabels = {
    origen: 'Origen de calificación diferente (Letra vs. Número)',
    numero_exacto: 'Valores numéricos diferentes entre copia local y nube',
    ausencia_sin_borrado: 'Dato presente en un lado y ausente en el otro sin marca de borrado',
    borrado: 'Registro eliminado en un lado pero activo en el otro',
    tipo: 'Tipo de dato divergente',
    representaciones_verificadas_sin_vigencia: 'Notas vinculadas a nombres históricos anteriores a SIAGIE',
    revision_de_conjunto: 'Revisión de conjunto requerida'
   };
   causesHtml = '<div style="margin-bottom:8px"><strong>Causas identificadas:</strong><ul style="margin:4px 0 0 16px;padding:0;list-style-type:disc">';
   for(const [cause, count] of Object.entries(causes)){
    causesHtml += '<li>'+escapeHtml(causeLabels[cause] || cause)+' ('+count+')</li>';
   }
   causesHtml += '</ul></div>';
  }

  // 5. Almacenamiento anterior y controles en edición
  let storageHtml = '<div style="margin-bottom:12px;font-size:12px;color:#475569">';
  if(report?.legacyLocal){
   storageHtml += '<p style="margin:2px 0;color:#b45309">⚠️ <strong>Almacenamiento anterior:</strong> Se detectó almacenamiento anterior protegido en este navegador.</p>';
  } else {
   storageHtml += '<p style="margin:2px 0">Almacenamiento anterior: Sin registros anteriores en este navegador.</p>';
  }
  if(report?.domChangedControls > 0){
   storageHtml += '<p style="margin:2px 0;color:#d97706">ℹ️ Hay '+report.domChangedControls+' control(es) en pantalla cuyo valor difiere del valor inicial cargado.</p>';
  }
  storageHtml += '</div>';

  return periodHtml + blockHtml + modulesHtml + causesHtml + storageHtml;
 }

 function showDialog(report){
  if(typeof document === 'undefined') return;
  const existing = document.getElementById('registroDiagnosticModal');
  if(existing) existing.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'registroDiagnosticModal';
  dialog.style.cssText = 'max-width:620px;width:calc(100% - 24px);max-height:85vh;overflow:auto;padding:20px;border-radius:12px;border:1px solid #cbd5e1;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1);font-family:system-ui,-apple-system,sans-serif;color:#1e293b;';

  const title = document.createElement('h2');
  title.style.cssText = 'font-size:16px;font-weight:700;margin:0 0 12px 0;display:flex;align-items:center;gap:8px;';
  title.innerHTML = '<span>Diagnóstico de sincronización</span><span style="font-size:11px;font-weight:400;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:9999px">Solo lectura</span>';
  dialog.appendChild(title);

  const content = document.createElement('div');
  content.style.cssText = 'font-size:13px;line-height:1.5;';
  content.innerHTML = buildDialogContent(report);
  dialog.appendChild(content);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap;border-top:1px solid #e2e8f0;padding-top:12px;';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copiar informe para soporte';
  copyBtn.style.cssText = 'min-height:44px;padding:8px 16px;border-radius:6px;border:1px solid #0284c7;background:#0284c7;color:#fff;font-weight:600;font-size:12px;cursor:pointer;';
  copyBtn.onclick = async () => {
   const text = JSON.stringify(report, null, 2);
   try {
    if(navigator.clipboard && navigator.clipboard.writeText){
     await navigator.clipboard.writeText(text);
    } else {
     const ta = document.createElement('textarea');
     ta.value = text;
     ta.style.position = 'fixed';
     ta.style.opacity = '0';
     document.body.appendChild(ta);
     ta.select();
     document.execCommand('copy');
     ta.remove();
    }
    const prev = copyBtn.textContent;
    copyBtn.textContent = '✓ ¡Informe copiado!';
    copyBtn.style.background = '#16a34a';
    copyBtn.style.borderColor = '#16a34a';
    setTimeout(()=>{
     copyBtn.textContent = prev;
     copyBtn.style.background = '#0284c7';
     copyBtn.style.borderColor = '#0284c7';
    }, 2000);
   } catch(_) {
    alert('No se pudo copiar automáticamente. Puedes seleccionar el contenido en pantalla.');
   }
  };
  actions.appendChild(copyBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Cerrar';
  closeBtn.style.cssText = 'min-height:44px;padding:8px 16px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-weight:600;font-size:12px;cursor:pointer;';
  closeBtn.onclick = () => { dialog.close(); dialog.remove(); };
  actions.appendChild(closeBtn);

  dialog.appendChild(actions);
  document.body.appendChild(dialog);
  dialog.showModal();
 }

 async function run(){
  const btn = document.getElementById('registroConnectionDiagnostic');
  const prevText = btn ? btn.textContent : '';
  if(btn){
   btn.disabled = true;
   btn.textContent = 'Diagnosticando…';
  }
  let report;
  try {
   if(typeof root.IERegistroSyncDiagnostic === 'undefined' || typeof root.IERegistroSyncDiagnostic.runPage !== 'function'){
    throw {code:'MODULE_MISSING'};
   }
   report = await root.IERegistroSyncDiagnostic.runPage();
  } catch(e) {
   report = {schema:1,readOnly:true,status:'unavailable',code:safeErrorCode(e?.code)};
  } finally {
   if(btn){
    btn.disabled = false;
    btn.textContent = prevText || 'Diagnosticar sincronización';
   }
  }
  if(report && report.code){
   report.code = safeErrorCode(report.code);
  }
  showDialog(report);
  return report;
 }

 function init(){
  const btn = document.getElementById('registroConnectionDiagnostic');
  if(btn && !btn.dataset.bound){
   btn.dataset.bound = 'true';
   btn.onclick = () => run();
  }
 }

 if(typeof document !== 'undefined'){
  if(document.readyState === 'loading'){
   document.addEventListener('DOMContentLoaded', init);
  } else {
   init();
  }
  document.addEventListener('ie22375:registro-ready', init);
 }

 root.IERegistroSyncDiagnosticUI = {run, showDialog, buildDialogContent, init};
})(typeof window === 'undefined' ? globalThis : window);
