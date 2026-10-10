/* Adaptador visual del Registro. Aportes privados en memoria, separados del store académico. */
(function(global){
  'use strict';
  const core=global.IERegistroEvaluacion, drafts=new Map();
  let active=null,serial=0;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanText=x=>x.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
  // Solo contenido editable; orden, equivalencias y metadatos del servidor no son cambios.
  function canonical(evidence){
    const value=v=>{const n=core.valor(v);return n?[n.modo,n.valor]:null;};
    const sessions=(evidence.sessions||[]).map(s=>[s.fecha,s.comp,s.capacidad]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const grades=Object.entries(evidence.grades||{}).flatMap(([k,students])=>Object.entries(students).map(([id,v])=>[k,id,value(v)])).filter(x=>x[2]);
    const directos=Object.entries(evidence.directos||{}).flatMap(([id,comps])=>Object.entries(comps).map(([comp,v])=>[id,comp,value(v)])).filter(x=>x[2]);
    const conclusiones=Object.entries(evidence.conclusiones||{}).flatMap(([id,comps])=>Object.entries(comps).map(([comp,text])=>[id,comp,cleanText(text)])).filter(x=>x[2]);
    const sorted=xs=>xs.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify({sessions,grades:sorted(grades),directos:sorted(directos),conclusiones:sorted(conclusiones)});
  }
  function reconcile(e){const invalid=Object.keys(e.invalid).length>0;e.dirty=invalid||canonical(e.evidence)!==e.baseline;if(!invalid&&e.notice&&e.notice.kind==='invalid'){e.notice={message:e.dirty?'Competencias transversales con cambios sin guardar.':'Aportes transversales sin cambios pendientes.',attention:false};if(current()===e)syncStatus();}}
  function context(){const c=ctxBase();return {bimestre:c.bim,grado:c.grado,seccion:c.seccion,area:c.area};}
  function key(){return JSON.stringify([IEStudents.validToken(),context()]);}
  function eligible(){const s=getLoginSession();return nivel==='secundaria'&&s&&s.role==='docente'&&areaActual&&(s.aportesTransversales&&s.aportesTransversales[areaActual]||[]).includes(String(ctxBase().grado)+'|'+String(ctxBase().seccion));}
  function current(){return eligible()?drafts.get(key()):null;}
  function editable(e=current()){return !!(e&&e.loaded&&!e.denied&&e.data.abierto&&e.data.soportaDirectos===true&&e.token===IEStudents.validToken()&&!registroSoloLectura()&&!bimCerradoDocente());}
  function syncStatus(){const e=current(),notice=e&&e.notice,el=document.getElementById('registroTransStatus'),box=document.getElementById('registroTransAviso');if(el)el.textContent=notice?notice.message:'';if(box)box.hidden=!(notice&&notice.attention);}
  function status(message,attention=false,kind=''){const e=current();if(e)e.notice={message,attention,kind};syncStatus();}
  function refreshSummary(){const panel=document.getElementById('panelAvance');if(panel&&panel.classList.contains('on'))summary(document.getElementById('avanceBox'));}
  function paint(){if(!eligible())return;
    if(typeof guardarTodo==='function'&&!registroSoloLectura()&&guardarTodo()===false){status('No se pudo conservar el trabajo académico local. Mantén esta pestaña abierta y reintenta.',true);refreshSummary();return;}
    loadCapsElegidas();renderStudents();renderSesiones();if(document.getElementById('panelFinales').classList.contains('on'))renderFinales();if(document.getElementById('panelAvance').classList.contains('on'))renderAvance();}
  function adopt(e,data){
    const s=getLoginSession(),own=data.aportes.find(a=>a.user===String(s.user||'').trim().toLowerCase().replace(/^@+/,'')&&a.area===e.ctx.area);
    e.data=data;e.version=own?own.version:0;e.evidence=copy(own&&own.evidencia||{schema:1,sessions:[],grades:{}});
    e.evidence.directos=e.evidence.directos||{};e.evidence.conclusiones=e.evidence.conclusiones||{};e.loaded=true;e.denied=false;e.dirty=false;e.revision=0;e.invalid={};e.conflict=false;e.loadFailed=false;e.baseline=canonical(e.evidence);
  }
  async function load(force=false,verify=false){
    if(!eligible())return;
    capture();const k=key(),contextChanged=active!==k;active=k;let e=drafts.get(k);
    if(e&&e.pending)return e.pending;
    if(e&&e.loaded&&!e.denied&&!force&&!verify&&!contextChanged){syncStatus();paint();return e;}
    if(e&&e.dirty&&force&&!confirm('Hay un borrador transversal sin guardar. ¿Recargar y reemplazarlo después de revisar el conflicto?'))return e;
    if(!e){e={id:++serial,invalid:{},ctx:context(),token:IEStudents.validToken(),evidence:{schema:1,sessions:[],grades:{},directos:{}},loaded:false,dirty:false};drafts.set(k,e);}
    if(e.loaded)paint();
    const revision=e.revision||0;
    status('Cargando competencias transversales…');
    refreshSummary();
    e.pending=(async()=>{try{
      const data=await IETransversales.request('loadtransversales',e.ctx);
      if(e.token!==IEStudents.validToken())return;
      if(e.loaded&&((e.dirty&&!force)||e.revision!==revision)){
        const own=data.aportes.find(a=>a.user===String(getLoginSession().user||'').trim().toLowerCase().replace(/^@+/,'')&&a.area===e.ctx.area);
        e.data.abierto=data.abierto;e.data.soportaDirectos=data.soportaDirectos;e.data.soportaConclusiones=data.soportaConclusiones;
        e.conflict=Number(own?own.version:0)!==Number(e.version);
        if(active===k&&key()===k){status(!data.soportaDirectos?'El backend aún no admite promedios transversales directos. Aportes visibles en solo lectura.':!data.soportaConclusiones?'El backend aún no admite conclusiones del docente. El envío integral está pendiente.':e.conflict?'CONFLICT: el aporte cambió en otro dispositivo. Recarga y revisa; tu borrador se conserva.':'Borrador transversal conservado; cambios pendientes de guardar.',e.conflict||!data.soportaDirectos||!data.soportaConclusiones);paint();}
        return;
      }
      adopt(e,data);if(active===k&&key()===k){status(!data.soportaDirectos?'El backend aún no admite promedios transversales directos. Aportes visibles en solo lectura; las áreas académicas siguen disponibles.':!data.soportaConclusiones?'El backend aún no admite conclusiones del docente. Consulta disponible; envío integral pendiente de actualización.':data.abierto?'Aportes transversales del área disponibles.':'Competencias transversales · Solo lectura',!data.soportaDirectos||!data.soportaConclusiones);paint();refreshSummary();}
    }catch(err){e.loadFailed=true;if(err.code==='CONFLICT')e.conflict=true;if(err.code==='SESSION'){e.denied=true;e.loaded=false;}if(active===k&&key()===k)status('No se pudieron cargar las competencias transversales. Las áreas académicas siguen disponibles. '+(err.code==='CONFLICT'?'CONFLICT: recarga y revisa.':err.code==='SESSION'?'Sesión transversal rechazada. Vuelve a iniciar sesión.':''),true);}
    finally{e.pending=null;if(active===k&&key()===k)refreshSummary();}})();return e.pending;
  }
  function changed(e){reconcile(e);e.revision=(e.revision||0)+1;if(!e.notice||!e.notice.attention)status(e.dirty?'Competencias transversales con cambios sin guardar.':'Aportes transversales sin cambios pendientes.');}
  function session(comp,cap,fecha){return {comp:claveCompetenciaTransversal(comp),capacidad:cap,fecha};}
  function add(comp,cap,fecha){const e=current();if(!editable(e))return false;const s=session(comp,cap,fecha);if(!core.CAPS[s.comp]||!core.CAPS[s.comp].includes(cap))return false;const k=core.sessionKey(s);if(!e.evidence.sessions.some(x=>core.sessionKey(x)===k)){e.evidence.sessions.push(s);changed(e);}return true;}
  function columns(fecha){const e=current();return e&&e.loaded?e.evidence.sessions.filter(s=>s.fecha===fecha).map(s=>({comp:core.COMP[s.comp],cap:s.capacidad,origen:'transversal'})):[];}
  function sessions(){const e=current();return e&&e.loaded?e.evidence.sessions.map(s=>({...ctxBase(),...s,comp:core.COMP[s.comp],bim:e.ctx.bimestre,origen:'transversal'})):[];}
  function remove(comp,cap,fecha){const e=current();if(!editable(e))return false;const s=session(comp,cap,fecha),k=core.sessionKey(s);e.evidence.sessions=e.evidence.sessions.filter(x=>core.sessionKey(x)!==k);delete e.evidence.grades[k];Object.keys(e.invalid).filter(x=>x.startsWith(k+'|')).forEach(x=>delete e.invalid[x]);changed(e);return true;}
  function removeDate(fecha){const e=current();if(!editable(e))return;columns(fecha).forEach(c=>remove(c.comp,c.cap,fecha));}
  function identity(al,e=current()){if(!e||!e.loaded)return '';const ids=e.data.estudiantes;const expected=studentKey(al);const exact=ids.find(a=>a.id===expected);return exact?exact.id:'';}
  function setGrade(e,k,id,raw){
    if(!editable(e)||!e.data.estudiantes.some(a=>a.id===id))return false;
    const v=raw.valor===''?null:core.valor(raw),prev=(e.evidence.grades[k]||{})[id];
    if(raw.valor!==''&&!v){e.invalid[k+'|'+id]=String(raw.valor);changed(e);status('La nota transversal debe estar entre 0 y 20 o ser AD/A/B/C.',true,'invalid');return false;}
    delete e.invalid[k+'|'+id];if((!v&&!prev)||(v&&prev&&v.modo===prev.modo&&v.valor===prev.valor)){reconcile(e);return false;}
    if(v){e.evidence.grades[k]=e.evidence.grades[k]||{};e.evidence.grades[k][id]=v;}
    else{delete e.evidence.grades[k][id];if(!Object.keys(e.evidence.grades[k]).length)delete e.evidence.grades[k];}
    changed(e);return true;
  }
  function setDirect(e,id,comp,raw){
    if(!editable(e)||!e.data.estudiantes.some(a=>a.id===id)||!core.COMP[comp])return false;
    const v=raw.valor===''?null:core.valor(raw),prev=(e.evidence.directos[id]||{})[comp];
    if(raw.valor!==''&&!v){e.invalid['directo:'+comp+'|'+id]=String(raw.valor);changed(e);status('El promedio transversal debe estar entre 0 y 20 o ser AD/A/B/C.',true,'invalid');return false;}
    delete e.invalid['directo:'+comp+'|'+id];
    if((!v&&!prev)||(v&&prev&&v.modo===prev.modo&&v.valor===prev.valor)){reconcile(e);return false;}
    if(v){e.evidence.directos[id]=e.evidence.directos[id]||{};e.evidence.directos[id][comp]=v;}
    else{delete e.evidence.directos[id][comp];if(!Object.keys(e.evidence.directos[id]).length)delete e.evidence.directos[id];}
    changed(e);return true;
  }
  function result(e=current()){if(!e||!e.loaded)return null;const calc=core.resultados(e.evidence,e.data.estudiantes.map(a=>a.id)).valores,values=copy(calc),origins={};e.data.estudiantes.forEach(a=>{origins[a.id]={};Object.keys(core.COMP).forEach(c=>{const d=(e.evidence.directos[a.id]||{})[c];if(d)values[a.id][c]=d;if(values[a.id][c])origins[a.id][c]=d?'directo':'evidencias';});});return {calculados:calc,valores:values,origenes:origins};}
  function setConclusion(e,id,comp,text){
    if(!editable(e)||!e.data.soportaConclusiones||!e.data.estudiantes.some(a=>a.id===id)||!core.COMP[comp]||typeof text!=='string')return false;
    const value=cleanText(text),k='conclusion:'+comp+'|'+id,prev=((e.evidence.conclusiones||{})[id]||{})[comp]||'';
    if(value.length>2000){e.invalid[k]=text;changed(e);status('Conclusión descriptiva demasiado extensa (máximo 2000 caracteres).',true,'invalid');return false;}
    delete e.invalid[k];if(value===prev){reconcile(e);return false;}
    e.evidence.conclusiones=e.evidence.conclusiones||{};
    if(value){e.evidence.conclusiones[id]=e.evidence.conclusiones[id]||{};e.evidence.conclusiones[id][comp]=value;}
    else if(e.evidence.conclusiones[id]){delete e.evidence.conclusiones[id][comp];if(!Object.keys(e.evidence.conclusiones[id]).length)delete e.evidence.conclusiones[id];}
    changed(e);return true;
  }
  function missingConclusions(e=current()){const r=result(e);return !!r&&e.data.estudiantes.some(a=>Object.keys(core.COMP).some(comp=>{const v=(r.valores[a.id]||{})[comp];return v&&v.nivel==='C'&&!(((e.evidence.conclusiones||{})[a.id]||{})[comp]||'').trim();}));}
  function input(v,id,comp,k,direct=false,calculated=null){
    const e=current(),disabled=!editable(e),attrs=' data-trans-entry="'+(e?e.id:0)+'" data-trans-id="'+esc(id)+'" data-trans-comp="'+comp+'"'+(k?' data-trans-key="'+esc(k)+'"':'');
    const visible=v||(direct?calculated:null);
    if(modoCalif==='letra')return '<div class="fin-cell"'+attrs+'>'+['C','B','A','AD'].map(l=>'<button type="button" class="chip nivel-'+l.toLowerCase()+(visible&&visible.nivel===l?' on':'')+'" data-trans-val="'+l+'" '+(disabled?'disabled':'')+'>'+l+'</button>').join('')+(direct&&v?'<button type="button" data-trans-val="" '+(disabled?'disabled':'')+'>Quitar directo</button>':'')+'</div>';
    return '<div class="fin-cell"'+attrs+'><input class="'+(direct?'trans-direct-num':'trans-nota')+'" type="number" min="0" max="20" step="any"'+attrs+' value="'+esc(e&&Object.prototype.hasOwnProperty.call(e.invalid,(k||'directo:'+comp)+'|'+id)?e.invalid[(k||'directo:'+comp)+'|'+id]:(v&&v.modo==='num'?v.valor:''))+'" '+(disabled?'readonly':'')+' aria-label="'+esc(core.COMP[comp])+'"><small>'+(v?v.nivel:'—')+'</small>'+(direct&&v?'<button type="button" data-trans-val="" '+(disabled?'disabled':'')+'>Quitar directo</button>':'')+'</div>';
  }
  function cell(al,col,fecha){const e=current(),id=identity(al,e),s=session(col.comp,col.cap,fecha),k=core.sessionKey(s),v=e&&((e.evidence.grades||{})[k]||{})[id];return '<td>'+input(v,id,s.comp,k)+'</td>';}
  function bind(root){
    root.querySelectorAll('[data-trans-val]').forEach(b=>b.onclick=()=>{const p=b.parentElement,e=current();if(!e)return;const raw={modo:'letra',valor:b.dataset.transVal};if(p.dataset.transKey){const prev=(e.evidence.grades[p.dataset.transKey]||{})[p.dataset.transId];if(prev&&prev.nivel===raw.valor)return;setGrade(e,p.dataset.transKey,p.dataset.transId,raw);}else setDirect(e,p.dataset.transId,p.dataset.transComp,raw);paint();});
    root.querySelectorAll('.trans-nota,.trans-direct-num').forEach(el=>{el.oninput=()=>{const e=current();if(!e)return;const raw={modo:'num',valor:el.value};if(el.dataset.transKey)setGrade(e,el.dataset.transKey,el.dataset.transId,raw);else setDirect(e,el.dataset.transId,el.dataset.transComp,raw);};el.onchange=()=>{el.oninput();paint();};});
  }
  function capture(){
    const e=drafts.get(active);if(!e||!editable(e))return;
    document.querySelectorAll('.trans-conclusion').forEach(el=>{if(String(e.id)===el.dataset.transEntry&&!el.readOnly)setConclusion(e,el.dataset.transId,el.dataset.transComp,el.value);});
    document.querySelectorAll('.trans-nota,.trans-direct-num').forEach(el=>{
      if(String(e.id)!==el.dataset.transEntry||el.readOnly)return;
      const id=el.dataset.transId,comp=el.dataset.transComp,k=el.dataset.transKey,raw={modo:'num',valor:el.value};
      const prev=k?(e.evidence.grades[k]||{})[id]:(e.evidence.directos[id]||{})[comp],v=core.valor(raw);
      if(raw.valor===''&&(!prev||prev.modo==='letra'))return;
      if(v&&prev&&v.modo===prev.modo&&v.valor===prev.valor)return;
      if(k)setGrade(e,k,id,raw);else setDirect(e,id,comp,raw);
    });
  }
  function finals(root){
    const e=current();if(!e||!e.loaded)return;const r=result(e);const table=root.querySelector('table'),thead=table&&table.querySelector('thead'),rows=table&&table.querySelectorAll('tbody tr');if(!thead||!rows)return;
    const academic=competencias().length+1;
    const group=document.createElement('tr');group.innerHTML='<th colspan="'+academic+'">Competencias del área</th><th colspan="2">COMPETENCIAS TRANSVERSALES — APORTE DEL ÁREA</th>';thead.insertBefore(group,thead.firstChild);
    const header=thead.querySelectorAll('tr')[1];header.insertAdjacentHTML('beforeend','<th>TIC</th><th>Gestiona su aprendizaje</th>');
    estudiantes().forEach((al,i)=>{const id=identity(al,e);if(!rows[i])return;Object.keys(core.COMP).forEach(c=>{const d=(e.evidence.directos[id]||{})[c],calc=(r.calculados[id]||{})[c];rows[i].insertAdjacentHTML('beforeend','<td>'+input(d,id,c,'',true,calc)+(calc?'<small>Cal '+(modoCalif!=='letra'&&calc.nota20!=null?calc.nota20+' · ':'')+calc.nivel+'</small>':'')+'</td>');});});bind(root);
  }
  function summary(root){
    if(!eligible()||!root)return;const table=root.querySelector('table');if(!table)return;
    const head=table.querySelector('thead tr'),rows=table.querySelectorAll('tbody tr'),e=current(),r=result(e);
    if(!head.querySelector('[data-trans-summary]'))head.insertAdjacentHTML('beforeend','<th data-trans-summary="tic">TIC</th><th data-trans-summary="autonomia">Gestiona su aprendizaje</th>');
    estudiantes().forEach((al,i)=>{const row=rows[i];if(!row)return;const id=identity(al,e);
      Object.keys(core.COMP).forEach(comp=>{let cell=row.querySelector('[data-trans-summary="'+comp+'"]');if(!cell){cell=document.createElement('td');cell.dataset.transSummary=comp;row.appendChild(cell);}
        if(!r){cell.textContent=e&&e.denied?'Sesión rechazada':e&&e.loadFailed?'Pendiente · Reintentar':'Cargando…';return;}
        const v=(r.valores[id]||{})[comp],required=v&&v.nivel==='C',text=((e.evidence.conclusiones||{})[id]||{})[comp]||'',k='conclusion:'+comp+'|'+id;
        const field=required?'<label>Conclusión descriptiva · Obligatoria para C'+(global.IEConclusionSuggestions?global.IEConclusionSuggestions.html(core.COMP[comp]):'')+'<textarea class="trans-conclusion" data-trans-entry="'+e.id+'" data-trans-id="'+esc(id)+'" data-trans-comp="'+comp+'" maxlength="2000" required '+(!editable(e)||!e.data.soportaConclusiones?'readonly':'')+'>'+esc(Object.prototype.hasOwnProperty.call(e.invalid,k)?e.invalid[k]:text)+'</textarea></label>':text?'<small>Conclusión conservada como borrador</small>':'';
        cell.innerHTML=(v?(modoCalif==='num'&&v.modo==='num'?esc(v.valor)+' → ':'')+esc(v.nivel):'Sin aporte')+'<small>'+(v?(r.origenes[id][comp]==='directo'?'Directo':'Evidencias'):'')+'</small>'+field;
        cell.querySelectorAll('.trans-conclusion').forEach(el=>el.oninput=()=>{const live=current();if(live&&String(live.id)===el.dataset.transEntry)setConclusion(live,el.dataset.transId,el.dataset.transComp,el.value);});
      });
    });
    if(global.IEConclusionSuggestions)global.IEConclusionSuggestions.bind(root);
  }
  async function save(integral=false){
    capture();const e=current();if(!e)return true;if(e.conflict){status('CONFLICT: recarga y revisa el aporte; tu borrador se conserva.',true);return false;}if(e.saving){const ok=await e.saving;return ok&&!e.dirty;}if(!e.dirty)return true;if(Object.keys(e.invalid).length){status('Hay notas transversales inválidas. Corrige los valores antes de guardar; el borrador se conserva.',true,'invalid');return false;}
    if(!e.data.soportaConclusiones&&Object.keys(e.evidence.conclusiones||{}).length){status('El backend aún no admite conclusiones del docente. Se conserva el borrador; reintenta tras su actualización.',true);return false;}
    if(!editable(e)||registroNubeNoVerificada()){status('Las notas del área se guardaron localmente, pero las competencias transversales aún no se pudieron guardar. Reintenta cuando se verifique el servidor.',true);return false;}
    const revision=e.revision,payload=copy(e.evidence);e.saving=(async()=>{try{const data=await IETransversales.request('savetransversalaporte',{...e.ctx,version:e.version,evidencia:payload,envioIntegral:integral});if(e.token!==IEStudents.validToken())return false;
      const own=data.aportes.find(a=>a.user===String(getLoginSession().user||'').trim().toLowerCase().replace(/^@+/,'')&&a.area===e.ctx.area);e.version=own?own.version:e.version;e.data=data;e.baseline=canonical(own.evidencia);if(e.revision===revision)e.evidence=copy(own.evidencia);reconcile(e);if(current()===e){status(e.dirty?'Guardado; hay cambios posteriores pendientes.':'Competencias transversales guardadas.');paint();}return true;
    }catch(err){if(err.code==='CONFLICT')e.conflict=true;if(err.code==='SESSION')e.denied=true;if(current()===e)status(err.code==='CONFLICT'?'CONFLICT: el aporte cambió en otro dispositivo. Recarga y revisa; tu borrador sigue en esta pestaña.':'Las notas del área se guardaron localmente, pero las competencias transversales aún no se pudieron guardar. Reintenta.',true);return false;}finally{e.saving=null;}})();return e.saving;
  }
  async function syncForUpload(){
    if(!eligible())return true;
    const k=key();capture();const e=current();if(e&&e.saving)await e.saving;
    if(key()!==k)return false;
    if(current())current().loadFailed=false;
    await load(false,true);
    const live=current();if(key()!==k||!editable(live)||live.loadFailed||live.conflict||!live.data.soportaConclusiones)return false;
    if(live.data.estudiantes.some(a=>Object.keys(core.COMP).some(comp=>!(result(live).valores[a.id]||{})[comp]))||missingConclusions(live)){status('Faltan resultados transversales o conclusión descriptiva para C. El aporte queda pendiente; las notas académicas siguen disponibles.',true);refreshSummary();return false;}
    const ok=await save(true);return ok&&key()===k&&!live.dirty&&!live.conflict&&!live.denied&&!missingConclusions(live);
  }
  if(global.addEventListener)global.addEventListener('beforeunload',event=>{if([...drafts.values()].some(e=>e.dirty)){event.preventDefault();event.returnValue='';}});
  global.IERegistroTransversales={eligible,load,current,editable,columns,sessions,add,remove,removeDate,cell,bind,finals,summary,save,capture,result,setDirect,setConclusion,missingConclusions,identity,syncStatus,syncForUpload};
})(window);
