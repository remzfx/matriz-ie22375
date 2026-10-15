/* Vista integral de Calificar: solo lectura; no convierte ni persiste calificaciones. */
(function(root){
 'use strict';
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const css=`/* Calificar integral Issue86 */
 @page calificar-integral {size:A4 landscape;margin:8mm;}
 @page calificar-integral-amplio {size:A3 landscape;margin:8mm;}
 @media print {
  #printArea:has(> .calificar-print) {page:calificar-integral;padding:0!important;}
  #printArea:has(> .calificar-print.wide) {page:calificar-integral-amplio;}
  .calificar-print {font:8pt Arial,Helvetica,sans-serif;line-height:1.15;}
  .calificar-print table {width:100%;border-collapse:collapse;table-layout:fixed;}
  .calificar-print th,.calificar-print td {border:0.25mm solid #64748b;padding:1mm 0.5mm;text-align:center;vertical-align:middle;overflow-wrap:anywhere;}
  .calificar-print thead {display:table-header-group;break-inside:avoid;}
  .calificar-print tr {break-inside:avoid;page-break-inside:avoid;}
  .calificar-print th {background:#edf2f7!important;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
  .calificar-print .student-number {width:7mm;}
  .calificar-print .student-name {width:47mm;text-align:left;white-space:normal;}
  .calificar-print .evidence-title {height:18mm;font-size:6pt;line-height:1.1;}
  .calificar-print .grade {font-size:7pt;white-space:nowrap;}
  .calificar-print.dense .grade {font-size:6pt;padding-left:0;padding-right:0;}
  .calificar-print .result {background:#f1f5f9!important;border-left:0.5mm solid #475569;font-weight:bold;}
  .calificar-print th.result {font-size:6pt;}
  .calificar-print .result small {display:block;font-size:5.5pt;white-space:normal;font-weight:normal;}
  .calificar-print .legend {font-size:7pt;margin:4mm 0;}
  .calificar-print .legend p {margin:1mm 0;break-inside:avoid;}
  .calificar-print .print-hdr h1 {font-size:12pt;}
  .calificar-print .print-hdr h2 {font-size:9pt;}
 }
 /* Fin Calificar integral Issue86 */`;
 function build(o){
  const c=o.context,mode=o.mode==='num'?'num':'letra',unique=new Map();
  for(const s of o.sessions||[])if(s.nivel===c.nivel&&s.bim===c.bim&&String(s.grado)===String(c.grado)&&s.seccion===c.seccion&&s.area===c.area&&s.comp&&(!o.from||s.fecha>=o.from)&&(!o.to||s.fecha<=o.to))unique.set(JSON.stringify([s.comp,s.fecha,s.capacidad]),s);
  const sessions=[...unique.values()].sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||''))||String(a.capacidad||'').localeCompare(String(b.capacidad||'')));
  if((o.from||o.to)&&!sessions.length)return '';
  const comps=[...new Set([...(o.competences||[]),...sessions.map(s=>s.comp)])];
  if(!comps.length)return '';
  const groups=comps.map((name,i)=>({name,code:'C'+(i+1),sessions:sessions.filter(s=>s.comp===name)})),columns=groups.reduce((n,g)=>n+g.sessions.length+1,0);
  const grade=g=>{if(!g||g.borrado)return '—';if(mode==='letra')return g.nivel||(g.nota20!==''&&g.nota20!=null?o.toLetter(g.nota20):'—');return g.origen!=='letra'&&g.nota20!==''&&g.nota20!=null&&Number.isFinite(Number(g.nota20))?String(g.nota20).padStart(2,'0'):g.nivel||'—';};
  const short=text=>{const s=String(text||'Sin capacidad').trim();return s.length>36?s.slice(0,33)+'…':s;};
  let html='<article class="calificar-print'+(columns>28?' wide':'')+(columns>18?' dense':'')+'"><header class="print-hdr"><h1>REGISTRO AUXILIAR INTEGRAL DE EVALUACIÓN</h1><h2>I.E. 22375 Santa Rosa de los Molinos · '+escape(c.area)+'</h2></header>';
  html+='<p>'+escape(c.nivel)+' · '+escape(c.grado)+'° '+escape(c.seccion)+' · Bimestre '+escape(c.bim)+' · Año '+escape(o.year)+' · Docente: '+escape(o.teacher)+' · Escala: '+(mode==='num'?'0–20':'Letras AD/A/B/C')+(o.from?' · Evidencias: '+escape(o.from)+' al '+escape(o.to):' · Evidencias del bimestre')+'</p>';
  if(columns>28)html+='<p>Grilla amplia: formato A3 horizontal. Puede seleccionar día o semana para imprimir menos columnas sin omitir datos del periodo elegido.</p>';
  html+='<table><colgroup><col class="student-number"><col class="student-name">'+Array.from({length:columns},()=>'<col>').join('')+'</colgroup><thead><tr><th rowspan="3" scope="col">N.º</th><th class="student-name" rowspan="3" scope="col">Estudiante</th>'+groups.map(g=>'<th scope="colgroup" colspan="'+(g.sessions.length+1)+'">'+g.code+'</th>').join('')+'</tr><tr>';
  for(const g of groups){const dates=[...new Set(g.sessions.map(s=>s.fecha))];html+=dates.map(date=>'<th scope="colgroup" title="'+escape(date)+'" colspan="'+g.sessions.filter(s=>s.fecha===date).length+'">'+escape(/^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(8)+'/'+date.slice(5,7):date||'Sin fecha')+'</th>').join('')+'<th class="result" rowspan="2" scope="col">Resultado<small>Bimestre '+escape(c.bim)+'</small></th>';}
  html+='</tr><tr>'+groups.map(g=>g.sessions.map((s,i)=>'<th class="evidence-title" scope="col" title="'+escape(s.capacidad)+'">E'+(i+1)+' · '+escape(short(s.capacidad))+'</th>').join('')).join('')+'</tr></thead><tbody>';
  for(const [i,student]of (o.students||[]).entries()){
   const id=o.studentKey(student);html+='<tr data-student="'+escape(id)+'"><th scope="row">'+(i+1)+'</th><td class="student-name">'+escape(student.nombre)+'</td>';
   for(const g of groups){
    for(const s of g.sessions){const key=[c.nivel,c.bim,c.grado,c.seccion,c.area,s.comp,s.capacidad,s.fecha,id].join('||');html+='<td class="grade" data-evidence="'+escape(key)+'">'+escape(grade(o.readGrade(key)))+'</td>';}
    const r=o.result(g.name,id),worked=o.worked(g.name),text=worked?(mode==='num'&&o.exact(g.name,id)&&r.nota!==''&&r.nota!=null?String(r.nota).padStart(2,'0'):r.letra||'—'):'No trabajada';
    html+='<td class="grade result" data-result="'+escape(g.name)+'">'+escape(text)+(worked&&r.letra?'<small>'+(r.src==='P'?'Directa':'Calculada')+'</small>':'')+'</td>';
   }
   html+='</tr>';
  }
  html+='</tbody></table><section class="legend"><p>Resultado = calificación efectiva bimestral; la nota directa de Promedios tiene prioridad. No es un cálculo nuevo del periodo filtrado. — = sin nota. En 0–20 las letras originales se conservan como letras; no se inventan números.</p>';
  for(const g of groups){html+='<p><b>'+g.code+':</b> '+escape(g.name)+'</p>';for(const [i,s]of g.sessions.entries())html+='<p>'+g.code+' / E'+(i+1)+' · '+escape(s.fecha)+' · '+escape(s.capacidad)+'</p>';}
  return html+'</section><footer class="print-sign"><div>Docente responsable<br>'+escape(o.teacher)+'</div><div>V.º B.º Dirección / Coordinación</div></footer></article>';
 }
 root.IECalificarPrint={build,css};if(typeof module!=='undefined')module.exports=root.IECalificarPrint;
})(typeof window==='undefined'?globalThis:window);
