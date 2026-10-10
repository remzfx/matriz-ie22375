/* Ayudas de conclusiones: se guarda el texto elegido o escrito. Sin datos privados. */
(function(global){
  'use strict';
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function suggestions(comp){
    if(/TIC|entornos virtuales/i.test(comp))return ['Requiere apoyo para seleccionar y organizar información digital de manera segura.','Necesita acompañamiento para crear contenidos digitales y compartirlos responsablemente.','Requiere actividades guiadas para interactuar y resolver tareas en entornos virtuales.'];
    if(/autónoma|Gestiona su aprendizaje/i.test(comp))return ['Necesita acompañamiento para definir metas de aprendizaje y planificar acciones.','Requiere apoyo para revisar sus avances y ajustar las estrategias que utiliza.','Necesita orientación para organizar su tiempo y completar las tareas acordadas.'];
    return ['Requiere actividades guiadas para desarrollar «'+comp+'» y explicar sus avances.','Necesita acompañamiento y práctica progresiva en «'+comp+'», con retroalimentación oportuna.','Requiere apoyo para aplicar lo aprendido en «'+comp+'» a situaciones cercanas.'];
  }
  const quick=['No logró el propósito propuesto.','No presenta evidencia para evaluar la competencia.','No asistió.'];
  function html(comp){return '<select class="conclusion-suggestion" aria-label="Sugerencia de conclusión"><option value="">Seleccionar una sugerencia</option>'+quick.concat(suggestions(comp)).map(text=>'<option value="'+esc(text)+'">'+esc(text)+'</option>').join('')+'<option value="custom">Escribir tu propia conclusión</option></select>';}
  function connect(select,field){select.disabled=field.disabled||field.readOnly;select.onchange=()=>{if(field.disabled||field.readOnly)return;if(select.value&&select.value!=='custom'){if(field.value.trim()&&field.value!==select.value&&(!global.confirm||!global.confirm('¿Reemplazar la conclusión escrita?'))){select.value='';return;}field.value=select.value;if(field.oninput)field.oninput();if(field.onchange)field.onchange();}if(field.focus)field.focus();};}
  function bind(root){root.querySelectorAll('.conclusion-suggestion').forEach(select=>{const field=select.closest('label').querySelector('textarea');if(field)connect(select,field);});}
  function mount(field,comp){const select=document.createElement('select');select.className='conclusion-suggestion';const options=[['','Seleccionar una sugerencia'],...quick.concat(suggestions(comp)).map(text=>[text,text]),['custom','Escribir tu propia conclusión']];options.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.appendChild(option);});field.parentElement.insertBefore(select,field);connect(select,field);return select;}
  function compactHtml(comp,value,attrs,locked){
    const options=quick.concat(suggestions(comp)),custom=!!value&&!options.includes(value),selected=custom?'custom':value;
    const field=custom?'<textarea class="academic-conclusion" '+attrs+' maxlength="2000" rows="3" required '+(locked?'readonly':'')+' placeholder="Escriba su conclusión...">'+esc(value)+'</textarea>':'';
    return '<div class="final-conclusion" data-text="'+esc(value)+'"><label>Conclusión<select class="academic-conclusion-choice" data-reg-write '+attrs+' '+(locked?'disabled':'')+'><option value="">Seleccionar conclusión</option>'+options.concat(['custom']).map(text=>'<option value="'+esc(text)+'" '+(selected===text?'selected':'')+'>'+esc(text==='custom'?'Escribir tu propia conclusión':text)+'</option>').join('')+'</select></label>'+field+'</div>';
  }
  function bindCompact(root,save){
    root.querySelectorAll('.academic-conclusion-choice').forEach(select=>{
      const block=select.closest('.final-conclusion');let current=block.dataset.text||'',previous=select.value;
      function editor(){
        let field=block.querySelector('textarea');
        if(!field){field=document.createElement('textarea');field.className='academic-conclusion';field.dataset.id=select.dataset.id;field.dataset.comp=select.dataset.comp;field.maxLength=2000;field.rows=3;field.required=true;field.placeholder='Escriba su conclusión...';field.value=current;block.appendChild(field);}
        field.readOnly=select.disabled;const grow=()=>{field.style.height='auto';field.style.height=Math.max(54,field.scrollHeight||54)+'px';};
        field.oninput=()=>{if(field.readOnly||select.disabled)return;if(save(select,field.value)!==false)current=field.value;grow();};grow();return field;
      }
      if(previous==='custom')editor();
      select.onchange=()=>{
        if(select.disabled)return;
        if(select.value==='custom'){previous='custom';editor().focus();return;}
        const next=select.value;
        if(!next&&current){select.value=previous;return;}
        if(current.trim()&&current!==next&&(!global.confirm||!global.confirm('¿Reemplazar la conclusión escrita?'))){select.value=previous;return;}
        if(current!==next&&save(select,next)===false){select.value=previous;return;}
        current=next;previous=next;const field=block.querySelector('textarea');if(field)field.remove();
      };
    });
  }
  global.IEConclusionSuggestions={suggestions,html,bind,mount,compactHtml,bindCompact};
})(window);
