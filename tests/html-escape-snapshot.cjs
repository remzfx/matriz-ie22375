// Historic presentation snapshots accept only these exact PR73 encoding edits.
// Actual encoded output and handlers are covered by frontend-html-escape.test.cjs.
const edits = [
  [
    "  selGrado.innerHTML = grados.map(g => `<option value=\"${escapeRegistro(g)}\">${escapeRegistro(g)}°</option>`).join('');\n",
    "  selGrado.innerHTML = grados.map(g => `<option value=\"${g}\">${g}°</option>`).join('');\n"
  ],
  [
    "  document.getElementById('selSeccion').innerHTML = secs.map(s => `<option value=\"${escapeRegistro(s)}\">${escapeRegistro(s)}</option>`).join('');\n",
    "  document.getElementById('selSeccion').innerHTML = secs.map(s => `<option value=\"${s}\">${s}</option>`).join('');\n"
  ],
  [
    "    return `<button type=\"button\" class=\"area-btn ${on}\" data-a=\"${encodeURIComponent(a)}\" onclick=\"setArea(decodeURIComponent(this.dataset.a))\">${escapeRegistro(short)}</button>`;\n",
    "    return `<button type=\"button\" class=\"area-btn ${on}\" data-a=\"${encodeURIComponent(a)}\" onclick=\"setArea(decodeURIComponent(this.dataset.a))\">${short}</button>`;\n"
  ],
  [
    "  const option=c=>`<option value=\"${escapeRegistro(c)}\">${escapeRegistro(c)}${!esCompetenciaTransversal(c)&&!competenciaTrabajada(c)?' · No trabajada este bimestre':''}</option>`;\n",
    "  const option=c=>`<option value=\"${c.replace(/\"/g,'&quot;')}\">${c}${!esCompetenciaTransversal(c)&&!competenciaTrabajada(c)?' · No trabajada este bimestre':''}</option>`;\n"
  ],
  [
    "    caps.map(c => '<option value=\"'+escapeRegistro(c)+'\">'+escapeRegistro(c)+'</option>').join('') +\n",
    "    caps.map(c => '<option value=\"'+c.replace(/\"/g,'&quot;')+'\">'+c+'</option>').join('') +\n"
  ],
  [
    "      <button type=\"button\" data-fecha=\"${escapeRegistro(f)}\" style=\"border:0;background:transparent;font:inherit;font-weight:700;cursor:pointer;padding:0;color:inherit\">Sesión ${escapeRegistro(f)}</button>\n      <button type=\"button\" title=\"Borrar el día\" data-delfecha=\"${escapeRegistro(f)}\" style=\"border:0;background:#fee2e2;color:#b91c1c;border-radius:999px;width:18px;height:18px;line-height:18px;font-size:11px;font-weight:900;cursor:pointer;padding:0\">×</button>\n",
    "      <button type=\"button\" data-fecha=\"${f}\" style=\"border:0;background:transparent;font:inherit;font-weight:700;cursor:pointer;padding:0;color:inherit\">Sesión ${f}</button>\n      <button type=\"button\" title=\"Borrar el día\" data-delfecha=\"${f}\" style=\"border:0;background:#fee2e2;color:#b91c1c;border-radius:999px;width:18px;height:18px;line-height:18px;font-size:11px;font-weight:900;cursor:pointer;padding:0\">×</button>\n"
  ],
  [
    "      '<div class=\"fin-caps\">'+escapeRegistro(col.comp||'')+'<br>'+escapeRegistro(col.cap||'')+'</div></th>';\n",
    "      '<div class=\"fin-caps\">'+(col.comp||'')+'<br>'+(col.cap||'')+'</div></th>';\n"
  ],
  [
    "    let tds = '<td class=\"fin-nom\"><div class=\"text-[10px] text-slate-400 font-bold\">'+(i+1)+'</div><div class=\"font-bold text-xs leading-tight\">'+escapeRegistro(al.nombre)+'</div></td>';\n",
    "    let tds = '<td class=\"fin-nom\"><div class=\"text-[10px] text-slate-400 font-bold\">'+(i+1)+'</div><div class=\"font-bold text-xs leading-tight\">'+al.nombre+'</div></td>';\n"
  ],
  [
    "    head += '<th><label class=\"worked-label\"><input type=\"checkbox\" data-trabajada=\"'+encodeURIComponent(cp)+'\" '+(competenciaTrabajada(cp)?'checked':'')+' '+(bloqueado?'disabled':'')+'><span>'+escapeRegistro(cp)+'</span></label>'+(!competenciaTrabajada(cp)?'<small>No trabajada este bimestre</small>':'')+'</th>';\n",
    "    head += '<th><label class=\"worked-label\"><input type=\"checkbox\" data-trabajada=\"'+encodeURIComponent(cp)+'\" '+(competenciaTrabajada(cp)?'checked':'')+' '+(bloqueado?'disabled':'')+'><span>'+cp+'</span></label>'+(!competenciaTrabajada(cp)?'<small>No trabajada este bimestre</small>':'')+'</th>';\n"
  ],
  [
    "    let tds = '<td class=\"fin-nom\"><div class=\"text-[10px] text-slate-400 font-bold\">'+(i+1)+'</div><div class=\"font-bold text-xs leading-tight\">'+escapeRegistro(al.nombre)+'</div></td>';\n",
    "    let tds = '<td class=\"fin-nom\"><div class=\"text-[10px] text-slate-400 font-bold\">'+(i+1)+'</div><div class=\"font-bold text-xs leading-tight\">'+al.nombre+'</div></td>';\n"
  ],
  [
    "        <button type=\"button\" class=\"asis-date-btn ${on}\" data-af=\"${escapeRegistro(f)}\">${escapeRegistro(f)}</button>\n        <button type=\"button\" title=\"Quitar fecha\" data-adel=\"${escapeRegistro(f)}\" style=\"border:0;background:#fee2e2;color:#b91c1c;border-radius:999px;width:18px;height:18px;font-weight:900;cursor:pointer;line-height:18px;padding:0\">×</button>\n",
    "        <button type=\"button\" class=\"asis-date-btn ${on}\" data-af=\"${f}\">${f}</button>\n        <button type=\"button\" title=\"Quitar fecha\" data-adel=\"${f}\" style=\"border:0;background:#fee2e2;color:#b91c1c;border-radius:999px;width:18px;height:18px;font-weight:900;cursor:pointer;line-height:18px;padding:0\">×</button>\n"
  ],
  [
    "  lista.innerHTML = `<div class=\"text-[11px] font-bold text-slate-500 mb-2\">Marcando: ${escapeRegistro(asisFechaActiva)}</div>` +\n",
    "  lista.innerHTML = `<div class=\"text-[11px] font-bold text-slate-500 mb-2\">Marcando: ${asisFechaActiva}</div>` +\n"
  ],
  [
    "      const horaTxt = rec.hora ? `<span class=\"text-[10px] text-slate-500 font-bold\">${escapeRegistro(rec.hora)}</span>` : '';\n",
    "      const horaTxt = rec.hora ? `<span class=\"text-[10px] text-slate-500 font-bold\">${rec.hora}</span>` : '';\n"
  ],
  [
    "          <div class=\"flex-1 min-w-0 font-bold text-sm truncate\">${escapeRegistro(al.nombre)} ${horaTxt}</div>\n",
    "          <div class=\"flex-1 min-w-0 font-bold text-sm truncate\">${al.nombre} ${horaTxt}</div>\n"
  ],
  [
    "    ? grados.map(g => '<option value=\"'+escapeAuxiliar(g)+'\">'+escapeAuxiliar(g)+'°</option>').join('')\n",
    "    ? grados.map(g => '<option value=\"'+g+'\">'+g+'°</option>').join('')\n"
  ],
  [
    "  document.getElementById('selSeccion').innerHTML = secs.map(s => '<option value=\"'+escapeAuxiliar(s)+'\">'+escapeAuxiliar(s)+'</option>').join('');\n",
    "  document.getElementById('selSeccion').innerHTML = secs.map(s => '<option value=\"'+s+'\">'+s+'</option>').join('');\n"
  ],
  [
    "function escapeAuxiliar(value) { return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }\n\n",
    ""
  ],
  [
    "      const hora = rec.hora ? '<span class=\"text-[10px] text-slate-500 font-bold\">'+escapeAuxiliar(rec.hora)+'</span>' : '';\n      const enc = escapeAuxiliar(encodeURIComponent(al.nombre));\n",
    "      const hora = rec.hora ? '<span class=\"text-[10px] text-slate-500 font-bold\">'+rec.hora+'</span>' : '';\n      const enc = encodeURIComponent(al.nombre);\n"
  ],
  [
    "        ? '<input class=\"mt-1 text-xs w-full\" data-motivo=\"'+enc+'\" placeholder=\"Motivo de la justificación\" value=\"'+escapeAuxiliar(rec.motivo||'')+'\">'\n",
    "        ? '<input class=\"mt-1 text-xs w-full\" data-motivo=\"'+enc+'\" placeholder=\"Motivo de la justificación\" value=\"'+(rec.motivo||'').replace(/\"/g,'&quot;')+'\">'\n"
  ],
  [
    "        '<div class=\"text-xs font-bold text-slate-400 w-6\">'+escapeAuxiliar(al.numeroVisual)+'</div>' +\n        '<div class=\"flex-1 min-w-0 font-bold text-sm truncate\">'+escapeAuxiliar(al.nombre)+' '+hora+'</div>' +\n",
    "        '<div class=\"text-xs font-bold text-slate-400 w-6\">'+al.numeroVisual+'</div>' +\n        '<div class=\"flex-1 min-w-0 font-bold text-sm truncate\">'+al.nombre+' '+hora+'</div>' +\n"
  ]
];
module.exports = source => {
  source=source.replace(/\r\n/g,'\n');
  for (const [encoded,original] of edits) source=source.replaceAll(encoded,original);
  return source;
};
