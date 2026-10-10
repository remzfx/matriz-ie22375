/* Ayudas editables: solo se guarda el texto final del textarea. Sin datos privados. */
(function(global){
  'use strict';
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function suggestions(comp){
    if(/TIC|entornos virtuales/i.test(comp))return ['Requiere apoyo para seleccionar y organizar información digital de manera segura.','Necesita acompañamiento para crear contenidos digitales y compartirlos responsablemente.','Requiere actividades guiadas para interactuar y resolver tareas en entornos virtuales.'];
    if(/autónoma|Gestiona su aprendizaje/i.test(comp))return ['Necesita acompañamiento para definir metas de aprendizaje y planificar acciones.','Requiere apoyo para revisar sus avances y ajustar las estrategias que utiliza.','Necesita orientación para organizar su tiempo y completar las tareas acordadas.'];
    return ['Requiere actividades guiadas para desarrollar «'+comp+'» y explicar sus avances.','Necesita acompañamiento y práctica progresiva en «'+comp+'», con retroalimentación oportuna.','Requiere apoyo para aplicar lo aprendido en «'+comp+'» a situaciones cercanas.'];
  }
  function html(comp){return '<select class="conclusion-suggestion" aria-label="Sugerencia de conclusión"><option value="">Seleccionar una sugerencia</option>'+suggestions(comp).map(text=>'<option value="'+esc(text)+'">'+esc(text)+'</option>').join('')+'<option value="custom">Escribir una conclusión personalizada…</option></select>';}
  function connect(select,field){select.disabled=field.disabled||field.readOnly;select.onchange=()=>{if(field.disabled||field.readOnly)return;if(select.value&&select.value!=='custom'){field.value=select.value;if(field.oninput)field.oninput();if(field.onchange)field.onchange();}if(field.focus)field.focus();};}
  function bind(root){root.querySelectorAll('.conclusion-suggestion').forEach(select=>{const field=select.closest('label').querySelector('textarea');if(field)connect(select,field);});}
  function mount(field,comp){const select=document.createElement('select');select.className='conclusion-suggestion';const options=[['','Seleccionar una sugerencia'],...suggestions(comp).map(text=>[text,text]),['custom','Escribir una conclusión personalizada…']];options.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.appendChild(option);});field.parentElement.insertBefore(select,field);connect(select,field);return select;}
  global.IEConclusionSuggestions={suggestions,html,bind,mount};
})(window);
