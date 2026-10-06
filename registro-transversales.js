/* Adaptador visual del Registro. Aportes privados en memoria, separados del store académico. */
(function(global){
  'use strict';
  const core=global.IERegistroEvaluacion, drafts=new Map();
  let active=null,serial=0;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function context(){const c=ctxBase();return {bimestre:c.bim,grado:c.grado,seccion:c.seccion,area:c.area};}
  function key(){return JSON.stringify([IEStudents.validToken(),context()]);}
  function eligible(){const s=getLoginSession();return nivel==='secundaria'&&s&&s.role==='docente'&&areaActual&&areaActual!=='Competencias Transversales';}
  function current(){return eligible()?drafts.get(key()):null;}
  function editable(e=current()){return !!(e&&e.loaded&&!e.denied&&e.data.abierto&&e.data.soportaDirectos===true&&e.token===IEStudents.validToken()&&!registroSoloLectura()&&!bimCerradoDocente());}
  function status(message){const el=document.getElementById('registroTransStatus');if(el)el.textContent=message;}
  function paint(){if(!eligible())return;
    if(typeof guardarTodo==='function'&&!registroSoloLectura()&&guardarTodo()===false){status('No se pudo conservar el trabajo académico local. Mantén esta pestaña abierta y reintenta.');return;}
    loadCapsElegidas();renderStudents();renderSesiones();if(document.getElementById('panelFinales').classList.contains('on'))renderFinales();if(document.getElementById('panelAvance').classList.contains('on'))renderAvance();}
  function adopt(e,data){
    const s=getLoginSession(),own=data.aportes.find(a=>a.user===String(s.user||'').trim().toLowerCase().replace(/^@+/,'')&&a.area===e.ctx.area);
    e.data=data;e.version=own?own.version:0;e.evidence=copy(own&&own.evidencia||{schema:1,sessions:[],grades:{}});
    e.evidence.directos=e.evidence.directos||{};e.loaded=true;e.denied=false;e.dirty=false;e.revision=0;e.invalid={};
  }
  async function load(force=false){
    if(!eligible())return;
    capture();const k=key(),contextChanged=active!==k;active=k;let e=drafts.get(k);
    if(e&&e.pending)return e.pending;
    if(e&&e.loaded&&!e.denied&&!force&&!contextChanged){paint();return e;}
    if(e&&e.dirty&&force&&!confirm('Hay un borrador transversal sin guardar. ¿Recargar y reemplazarlo después de revisar el conflicto?'))return e;
    if(!e){e={id:++serial,invalid:{},ctx:context(),token:IEStudents.validToken(),evidence:{schema:1,sessions:[],grades:{},directos:{}},loaded:false,dirty:false};drafts.set(k,e);}
    if(e.loaded)paint();
    const revision=e.revision||0;
    status('Cargando competencias transversales…');
    e.pending=(async()=>{try{
      const data=await IETransversales.request('loadtransversales',e.ctx);
      if(e.token!==IEStudents.validToken())return;
      if(e.loaded&&((e.dirty&&!force)||e.revision!==revision)){
        const own=data.aportes.find(a=>a.user===String(getLoginSession().user||'').trim().toLowerCase().replace(/^@+/,'')&&a.area===e.ctx.area);
        e.data.abierto=data.abierto;e.data.soportaDirectos=data.soportaDirectos;
        if(active===k&&key()===k){status(Number(own?own.version:0)!==Number(e.version)?'CONFLICT: el aporte cambió en otro dispositivo. Recarga y revisa; tu borrador se conserva.':'Borrador transversal conservado; cambios pendientes de guardar.');paint();}
        return;
      }
      adopt(e,data);if(active===k&&key()===k){status(!data.soportaDirectos?'El backend aún no admite promedios transversales directos. Aportes visibles en solo lectura; las áreas académicas siguen disponibles.':data.abierto?'Aportes transversales del área disponibles.':'Competencias transversales · Solo lectura');paint();}
    }catch(err){if(err.code==='SESSION'){e.denied=true;e.loaded=false;}if(active===k&&key()===k)status('No se pudieron cargar las competencias transversales. Las áreas académicas siguen disponibles. '+(err.code==='CONFLICT'?'Recarga y revisa.':''));}
    finally{e.pending=null;}})();return e.pending;
  }
  function changed(e){e.dirty=true;e.revision=(e.revision||0)+1;status('Competencias transversales con cambios sin guardar.');}
  function session(comp,cap,fecha){return {comp:claveCompetenciaTransversal(comp),capacidad:cap,fecha};}
  function add(comp,cap,fecha){const e=current();if(!editable(e))return false;const s=session(comp,cap,fecha);if(!core.CAPS[s.comp]||!core.CAPS[s.comp].includes(cap))return false;const k=core.sessionKey(s);if(!e.evidence.sessions.some(x=>core.sessionKey(x)===k)){e.evidence.sessions.push(s);changed(e);}return true;}
  function columns(fecha){const e=current();return e&&e.loaded?e.evidence.sessions.filter(s=>s.fecha===fecha).map(s=>({comp:core.COMP[s.comp],cap:s.capacidad,origen:'transversal'})):[];}
  function sessions(){const e=current();return e&&e.loaded?e.evidence.sessions.map(s=>({...ctxBase(),...s,comp:core.COMP[s.comp],bim:e.ctx.bimestre,origen:'transversal'})):[];}
  function remove(comp,cap,fecha){const e=current();if(!editable(e))return false;const s=session(comp,cap,fecha),k=core.sessionKey(s);e.evidence.sessions=e.evidence.sessions.filter(x=>core.sessionKey(x)!==k);delete e.evidence.grades[k];changed(e);return true;}
  function removeDate(fecha){const e=current();if(!editable(e))return;columns(fecha).forEach(c=>remove(c.comp,c.cap,fecha));}
  function identity(al,e=current()){if(!e||!e.loaded)return '';const ids=e.data.estudiantes;const expected=studentKey(al);const exact=ids.find(a=>a.id===expected);return exact?exact.id:'';}
  function setGrade(e,k,id,raw){if(!editable(e)||!e.data.estudiantes.some(a=>a.id===id))return false;const v=raw.valor===''?null:core.valor(raw);if(raw.valor!==''&&!v){e.invalid[k+'|'+id]=String(raw.valor);changed(e);status('La nota transversal debe estar entre 0 y 20 o ser AD/A/B/C.');return false;}delete e.invalid[k+'|'+id];e.evidence.grades[k]=e.evidence.grades[k]||{};if(v)e.evidence.grades[k][id]=v;else delete e.evidence.grades[k][id];changed(e);return true;}
  function setDirect(e,id,comp,raw){if(!editable(e)||!e.data.estudiantes.some(a=>a.id===id)||!core.COMP[comp])return false;const v=raw.valor===''?null:core.valor(raw);if(raw.valor!==''&&!v){e.invalid['directo:'+comp+'|'+id]=String(raw.valor);changed(e);status('El promedio transversal debe estar entre 0 y 20 o ser AD/A/B/C.');return false;}delete e.invalid['directo:'+comp+'|'+id];e.evidence.directos[id]=e.evidence.directos[id]||{};if(v)e.evidence.directos[id][comp]=v;else delete e.evidence.directos[id][comp];changed(e);return true;}
  function result(e=current()){if(!e||!e.loaded)return null;const calc=core.resultados(e.evidence,e.data.estudiantes.map(a=>a.id)).valores,values=copy(calc),origins={};e.data.estudiantes.forEach(a=>{origins[a.id]={};Object.keys(core.COMP).forEach(c=>{const d=(e.evidence.directos[a.id]||{})[c];if(d)values[a.id][c]=d;if(values[a.id][c])origins[a.id][c]=d?'directo':'evidencias';});});return {calculados:calc,valores:values,origenes:origins};}
  function input(v,id,comp,k,direct=false){
    const e=current(),disabled=!editable(e),attrs=' data-trans-entry="'+(e?e.id:0)+'" data-trans-id="'+esc(id)+'" data-trans-comp="'+comp+'"'+(k?' data-trans-key="'+esc(k)+'"':'');
    if(modoCalif==='letra')return '<div class="fin-cell"'+attrs+'>'+['C','B','A','AD'].map(l=>'<button type="button" class="chip nivel-'+l.toLowerCase()+(v&&v.nivel===l?' on':'')+'" data-trans-val="'+l+'" '+(disabled?'disabled':'')+'>'+l+'</button>').join('')+(direct?'<button type="button" data-trans-val="" '+(disabled?'disabled':'')+'>Quitar directo</button>':'')+'</div>';
    return '<div class="fin-cell"><input class="'+(direct?'trans-direct-num':'trans-nota')+'" type="number" min="0" max="20" step="any"'+attrs+' value="'+esc(e&&Object.prototype.hasOwnProperty.call(e.invalid,(k||'directo:'+comp)+'|'+id)?e.invalid[(k||'directo:'+comp)+'|'+id]:(v?(v.nota20!=null?v.nota20:core.letterToNum(v.nivel)):''))+'" '+(disabled?'readonly':'')+' aria-label="'+esc(core.COMP[comp])+'"><small>'+(v?v.nivel:'—')+'</small></div>';
  }
  function cell(al,col,fecha){const e=current(),id=identity(al,e),s=session(col.comp,col.cap,fecha),k=core.sessionKey(s),v=e&&((e.evidence.grades||{})[k]||{})[id];return '<td>'+input(v,id,s.comp,k)+'</td>';}
  function bind(root){
    root.querySelectorAll('[data-trans-val]').forEach(b=>b.onclick=()=>{const p=b.parentElement,e=current();if(!e)return;const raw={modo:'letra',valor:b.dataset.transVal};if(p.dataset.transKey){const prev=(e.evidence.grades[p.dataset.transKey]||{})[p.dataset.transId];if(prev&&prev.nivel===raw.valor)return;setGrade(e,p.dataset.transKey,p.dataset.transId,raw);}else setDirect(e,p.dataset.transId,p.dataset.transComp,raw);paint();});
    root.querySelectorAll('.trans-nota,.trans-direct-num').forEach(el=>{el.oninput=()=>{const e=current();if(!e)return;const raw={modo:'num',valor:el.value};if(el.dataset.transKey)setGrade(e,el.dataset.transKey,el.dataset.transId,raw);else setDirect(e,el.dataset.transId,el.dataset.transComp,raw);};el.onchange=()=>{el.oninput();paint();};});
  }
  function capture(){
    const e=drafts.get(active);if(!e||!editable(e))return;
    document.querySelectorAll('.trans-nota,.trans-direct-num').forEach(el=>{
      if(String(e.id)!==el.dataset.transEntry||el.readOnly)return;
      const id=el.dataset.transId,comp=el.dataset.transComp,k=el.dataset.transKey,raw={modo:'num',valor:el.value};
      const prev=k?(e.evidence.grades[k]||{})[id]:(e.evidence.directos[id]||{})[comp],v=core.valor(raw);
      if(raw.valor===''&&!prev)return;
      if(prev&&String(raw.valor)===String(prev.nota20!=null?prev.nota20:core.letterToNum(prev.nivel)))return;
      if(v&&prev&&v.modo===prev.modo&&v.valor===prev.valor)return;
      if(k)setGrade(e,k,id,raw);else setDirect(e,id,comp,raw);
    });
  }
  function finals(root){
    const e=current();if(!e||!e.loaded)return;const r=result(e);const table=root.querySelector('table'),thead=table&&table.querySelector('thead'),rows=table&&table.querySelectorAll('tbody tr');if(!thead||!rows)return;
    const academic=competencias().length+1;
    const group=document.createElement('tr');group.innerHTML='<th colspan="'+academic+'">Competencias del área</th><th colspan="2">COMPETENCIAS TRANSVERSALES — APORTE DEL ÁREA</th>';thead.insertBefore(group,thead.firstChild);
    const header=thead.querySelectorAll('tr')[1];header.insertAdjacentHTML('beforeend','<th>TIC</th><th>Gestiona su aprendizaje</th>');
    estudiantes().forEach((al,i)=>{const id=identity(al,e);if(!rows[i])return;Object.keys(core.COMP).forEach(c=>{const d=(e.evidence.directos[id]||{})[c],calc=(r.calculados[id]||{})[c];rows[i].insertAdjacentHTML('beforeend','<td>'+input(d,id,c,'',true)+(calc?'<small>Cal '+(calc.nota20!=null?calc.nota20+' · ':'')+calc.nivel+'</small>':'')+'</td>');});});bind(root);
  }
  function summary(root){const e=current();if(!e||!e.loaded)return;const r=result(e);const box=document.createElement('section');box.className='fin-wrap';box.innerHTML='<h3>APORTE DE COMPETENCIAS TRANSVERSALES DEL ÁREA</h3><table class="fin-grid"><thead><tr><th>Estudiante</th><th>TIC</th><th>Gestión autónoma</th></tr></thead><tbody>'+estudiantes().map(al=>{const id=identity(al,e);return '<tr><th>'+esc(al.nombre)+'</th>'+Object.keys(core.COMP).map(c=>{const v=(r.valores[id]||{})[c];return '<td>'+(v?esc(v.nivel):'—')+'<small>'+(v?(r.origenes[id][c]==='directo'?'Promedio directo':'Evidencias'):'Sin aporte')+'</small></td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';root.appendChild(box);}
  async function save(){
    capture();const e=current();if(!e||!e.dirty)return true;if(Object.keys(e.invalid).length){status('Hay notas transversales inválidas. Corrige los valores antes de guardar; el borrador se conserva.');return false;}if(e.saving)return e.saving;
    if(!editable(e)||registroNubeNoVerificada()){status('Las notas del área se guardaron localmente, pero las competencias transversales aún no se pudieron guardar. Reintenta cuando se verifique el servidor.');return false;}
    const revision=e.revision,payload=copy(e.evidence);e.saving=(async()=>{try{const data=await IETransversales.request('savetransversalaporte',{...e.ctx,version:e.version,evidencia:payload});if(e.token!==IEStudents.validToken())return false;
      const own=data.aportes.find(a=>a.user===String(getLoginSession().user||'').trim().toLowerCase().replace(/^@+/,'')&&a.area===e.ctx.area);e.version=own?own.version:e.version;e.data=data;if(e.revision===revision){e.evidence=copy(own.evidencia);e.dirty=false;}if(current()===e){status(e.dirty?'Guardado; hay cambios posteriores pendientes.':'Competencias transversales guardadas.');paint();}return true;
    }catch(err){if(err.code==='SESSION')e.denied=true;if(current()===e)status(err.code==='CONFLICT'?'CONFLICT: el aporte cambió en otro dispositivo. Recarga y revisa; tu borrador sigue en esta pestaña.':'Las notas del área se guardaron localmente, pero las competencias transversales aún no se pudieron guardar. Reintenta.');return false;}finally{e.saving=null;}})();return e.saving;
  }
  if(global.addEventListener)global.addEventListener('beforeunload',event=>{if([...drafts.values()].some(e=>e.dirty)){event.preventDefault();event.returnValue='';}});
  global.IERegistroTransversales={load,current,editable,columns,sessions,add,remove,removeDate,cell,bind,finals,summary,save,capture,result,setDirect,identity};
})(window);
