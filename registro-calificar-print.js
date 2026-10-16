/* Vista integral de Calificar: solo lectura; no convierte ni persiste calificaciones. */
(function(root){
 'use strict';
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const css=`/* Calificar integral Issue86 */
 @page calificar-integral {size:A4 landscape;margin:8mm;}
 @media print {
  #printArea:has(> .calificar-print) {page:calificar-integral;padding:0!important;}
  .calificar-print {font:8pt Arial,Helvetica,sans-serif;line-height:1.15;}
  .calificar-print table {width:100%;border-collapse:collapse;table-layout:fixed;}
  .calificar-print th,.calificar-print td {border:0.25mm solid #64748b;padding:1mm 0.5mm;text-align:center;vertical-align:middle;overflow-wrap:anywhere;}
  .calificar-print thead {display:table-header-group;break-inside:avoid;}
  .calificar-print tr {break-inside:avoid;page-break-inside:avoid;}
  .calificar-print th {background:#edf2f7!important;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
  .calificar-print .date-head {background:#dce8f0!important;}
  .calificar-print .competence-head {background:#e8eee4!important;}
  .calificar-print .evidence-title {background:#f3f4f6!important;}
  .calificar-print .print-block + .print-block {break-before:page;page-break-before:always;}
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
  for(const s of o.sessions||[])if(s.nivel===c.nivel&&s.bim===c.bim&&String(s.grado)===String(c.grado)&&s.seccion===c.seccion&&s.area===c.area&&s.comp)unique.set(JSON.stringify([s.comp,s.fecha,s.capacidad]),s);
  const all=[...unique.values()],comps=[...new Set([...(o.competences||[]),...all.map(s=>s.comp)])];if(!comps.length)return '';
  const capacityOrder=s=>{const selected=o.capsSel?.[[c.nivel,c.bim,c.grado,c.seccion,c.area,s.fecha].join('||')];if(!Array.isArray(selected))return Infinity;const i=selected.findIndex(x=>typeof x==='string'?x===s.capacidad:x?.comp===s.comp&&x.cap===s.capacidad);return i<0?Infinity:i;};
  // Historical sessions without a saved selection retain their original stable order.
  const sessions=all.filter(s=>(!o.from||s.fecha>=o.from)&&(!o.to||s.fecha<=o.to)).sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||''))||(capacityOrder(a)-capacityOrder(b)||0)||comps.indexOf(a.comp)-comps.indexOf(b.comp));
  if((o.from||o.to)&&!sessions.length)return '';
  const groups=comps.map((name,i)=>({name,code:'C'+(i+1),sessions:sessions.filter(s=>s.comp===name)}));
  const key=(s,id)=>[c.nivel,c.bim,c.grado,c.seccion,c.area,s.comp,s.capacidad,s.fecha,id].join('||');
  const grade=g=>{if(!g||g.borrado)return '—';if(mode==='letra')return g.nivel||(g.nota20!==''&&g.nota20!=null?o.toLetter(g.nota20):'—');return g.origen!=='letra'&&g.nota20!==''&&g.nota20!=null&&Number.isFinite(Number(g.nota20))?String(g.nota20).padStart(2,'0'):g.nivel||'—';};
  const short=text=>{const s=String(text||'Sin capacidad').trim();return s.length>36?s.slice(0,33)+'…':s;};
  // Pagination changes presentation only. Continuous date-major blocks retain every evidence.
  const limit=Math.max(1,22-comps.length),blocks=[];for(let i=0;i<sessions.length;i+=limit)blocks.push(sessions.slice(i,i+limit));if(!blocks.length)blocks.push([]);
  const title='<header class="print-hdr"><h1>I.E. N.º 22375 SANTA ROSA DE LOS MOLINOS</h1><h2>REGISTRO AUXILIAR DE EVALUACIÓN – CALIFICAR</h2></header>';
  const meta='<p>'+escape(c.nivel)+' · '+escape(c.grado)+'° '+escape(c.seccion)+' · Área: '+escape(c.area)+' · Bimestre '+escape(c.bim)+' · Año '+escape(o.year)+' · Docente responsable: '+escape(o.teacher)+' · Escala: '+(mode==='num'?'0–20':'Letras AD/A/B/C')+(o.from?' · Evidencias: '+escape(o.from)+' al '+escape(o.to):' · Evidencias del bimestre')+'</p>';
  let html='<article class="calificar-print">';
  for(const [bi,block]of blocks.entries()){
   const last=bi===blocks.length-1,dates=[...new Set(block.map(s=>s.fecha))],columns=block.length+(last?comps.length:0);
   html+='<section class="print-block">'+title+meta+'<p>Bloque '+(bi+1)+' de '+blocks.length+(blocks.length>1?' · Continuación de la misma grilla; se repite la nómina para identificar cada fila.':'')+'</p><table><colgroup><col class="student-number"><col class="student-name">'+Array.from({length:columns},()=>'<col>').join('')+'</colgroup><thead><tr><th rowspan="3" scope="col">N.º</th><th class="student-name" rowspan="3" scope="col">Apellidos y nombres</th>';
   for(const date of dates)html+='<th class="date-head" scope="colgroup" colspan="'+block.filter(s=>s.fecha===date).length+'">'+escape(date||'Sin fecha')+'</th>';
   if(last)html+='<th class="result" scope="colgroup" colspan="'+comps.length+'">Resultados de Calificar<small>Bimestre '+escape(c.bim)+'</small></th>';
   html+='</tr><tr>';
   for(let i=0;i<block.length;){const s=block[i];let end=i+1;while(end<block.length&&block[end].fecha===s.fecha&&block[end].comp===s.comp)end++;html+='<th class="competence-head" scope="colgroup" colspan="'+(end-i)+'">'+groups.find(g=>g.name===s.comp).code+'</th>';i=end;}
   if(last)html+=groups.map(g=>'<th class="result" rowspan="2" scope="col">'+g.code+'</th>').join('');
   html+='</tr><tr>'+block.map(s=>{const g=groups.find(g=>g.name===s.comp),i=g.sessions.indexOf(s);return '<th class="evidence-title" scope="col" title="'+escape(s.capacidad)+'">'+g.code+'/E'+(i+1)+' · '+escape(short(s.capacidad))+'</th>';}).join('')+'</tr></thead><tbody>';
   for(const [i,student]of (o.students||[]).entries()){
    const id=o.studentKey(student);html+='<tr data-student="'+escape(id)+'"><th scope="row">'+(i+1)+'</th><td class="student-name">'+escape(student.nombre)+'</td>';
    for(const s of block)html+='<td class="grade" data-evidence="'+escape(key(s,id))+'">'+escape(grade(o.readGrade(key(s,id))))+'</td>';
    if(last)for(const g of groups){
     const r=o.calculated(g.name,id),d=o.direct(g.name,id),worked=o.worked(g.name),exact=all.filter(s=>s.comp===g.name).every(s=>{const v=o.readGrade(key(s,id));return !v||!v.borrado&&v.origen!=='letra'&&v.nota20!==''&&v.nota20!=null&&Number.isFinite(Number(v.nota20));});
     const text=worked?(mode==='num'&&exact&&r.nota!==''&&r.nota!=null?String(r.nota).padStart(2,'0'):r.letra||'—'):'No trabajada';
     const direct=mode==='num'&&o.exact(g.name,id)&&d.nota!==''&&d.nota!=null?String(d.nota).padStart(2,'0'):d.letra;
     html+='<td class="grade result" data-result="'+escape(g.name)+'">'+escape(text)+(worked?'<small>Cal</small>':'')+(d.letra?'<small>Prom: '+escape(direct)+' · directa</small>':'')+'</td>';
    }
    html+='</tr>';
   }
   html+='</tbody></table></section>';
  }
  html+='<section class="legend"><p>Cal = resultado calculado de Calificar mediante las funciones existentes, para todo el bimestre. Prom = nota directa de Promedios, que conserva su prioridad y no se reemplaza. El filtro solo limita evidencias. — = sin nota. En 0–20 las letras originales se conservan como letras; no se inventan números.</p>';
  for(const g of groups){html+='<p><b>'+g.code+':</b> '+escape(g.name)+'</p>';for(const [i,s]of g.sessions.entries())html+='<p>'+g.code+' / E'+(i+1)+' · '+escape(s.fecha)+' · '+escape(s.capacidad)+'</p>';}
  return html+'</section><footer class="print-sign"><div>Docente responsable<br>'+escape(o.teacher)+'</div><div>V.º B.º Dirección / Coordinación</div></footer></article>';
 }

 root.IECalificarPrint={build,css};if(typeof module!=='undefined')module.exports=root.IECalificarPrint;
})(typeof window==='undefined'?globalThis:window);
