/* Transporte y editores de transversales. Datos privados solo en memoria; sesiones existentes. */
(function(global){
  'use strict';
  const API='https://script.google.com/macros/s/AKfycbxI0pfjZfeecboqvwx4YOjcvyGTGVa1smmyyE9kNQCmNgNL3tDXwFlPUL0i1DJ2DwBNIg/exec';
  const grading=global.IERegistroEvaluacion,COMP=grading.COMP,CAPS=grading.CAPS;
  const ACTIONS=['loadtransversales','loadtransversalesaulas','savetransversalaporte','savetransversalfinal','procesartransversales','loadtransversalexport'];
  let bridge=null;const pending=new Map();
  function valor(raw){return grading.valor(raw);}
  function start(){if(!bridge&&global.IELoginBridge&&document.body)try{bridge=global.IELoginBridge.create(API,'transversales');}catch(e){}return bridge;}
  async function operation(action,data){
    const token=global.IEStudents.validToken();if(!token)throw new Error('Sesión ausente o vencida.');
    const candidate=start(),transport=candidate&&(candidate.ready()||await candidate.whenReady())?candidate:null;
    if(token!==global.IEStudents.validToken())throw new Error('La sesión cambió.');
    const body=Object.assign({},data,{action,token});
    const result=transport?await transport.transversales(body):await global.IEStudents.fetchJSON(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),cache:'no-store'});
    if(token!==global.IEStudents.validToken())throw new Error('La sesión cambió.');
    if(!result||!result.ok){const e=new Error(result&&result.error||'No se pudo cargar transversales.');e.code=result&&result.code;if(e.code==='SESSION')global.IEStudents.clear();throw e;}
    return result;
  }
  function request(action,data={}){
    if(!ACTIONS.includes(action))return Promise.reject(new Error('Acción no válida.'));
    if(!action.startsWith('load'))return operation(action,data);
    const key=global.IEStudents.validToken()+':'+action+':'+JSON.stringify(data);
    if(!pending.has(key)){const task=operation(action,data).finally(()=>{if(pending.get(key)===task)pending.delete(key);});pending.set(key,task);}return pending.get(key);
  }
  function text(tag,value,parent){const el=document.createElement(tag);el.textContent=value;if(tag==='button'){el.type='button';el.className='btn btn-ghost';el.style.minHeight='44px';}if(parent)parent.appendChild(el);return el;}
  function control(record,mode,change,parent){
    const el=document.createElement(mode==='letra'?'select':'input');
    if(mode==='letra'){['','AD','A','B','C'].forEach(v=>{const opt=document.createElement('option');opt.value=v;opt.textContent=v||'—';el.appendChild(opt);});el.value=record&&record.nivel||'';}
    else{el.type='number';el.min=0;el.max=20;el.step=1;el.value=record&&record.modo==='num'?(record.nota20!=null?record.nota20:record.valor):'';}
    el.setAttribute('aria-label','Calificación final o aporte');el.onchange=()=>{const raw={modo:mode,valor:el.value};change(valor(raw)||raw);};parent.appendChild(el);return el;
  }
  function editor(container,data,ctx,final){
    if(!final)return evidenceEditor(container,data,ctx);
    if(data.flujoTutor!==true){data=Object.assign({},data,{puedeFinal:false,puedeProcesar:false});text('p','Backend anterior: consulta solamente. Requiere actualizar el flujo oficial del Tutor.',container);}
    let mode='letra',draft={},busy=false;const token=global.IEStudents.validToken();
    const toolbar=text('div','',container),modeEl=document.createElement('select');
    [['letra','Letras'],['num','0–20']].forEach(([v,label])=>{const opt=document.createElement('option');opt.value=v;opt.textContent=label;modeEl.appendChild(opt);});toolbar.appendChild(modeEl);
    text('p','18–20 → AD · 14–17 → A · 11–13 → B · 0–10 → C. Cambiar el modo no modifica valoraciones guardadas.',container);
    if(data.politica)text('p','Año lectivo '+data.politica.anio+' · Solo aportes habilitados por Admin. Sugerencia: mayoría de áreas, un voto efectivo (el más reciente) por área; empate sin sugerencia. La decisión oficial pertenece al Tutor.',container);
    const message=text('p','',container),aportesStatus=text('p','',container),rows=text('div','',container),buttons=text('div','',container);
    function procesable(){return token===global.IEStudents.validToken()&&data.flujoTutor&&Array.isArray(data.aportesPendientes)&&data.aportesPendientes.length===0&&data.abierto&&data.puedeProcesar&&(data.tutores||[]).length===1&&!Object.keys(draft).length&&data.estudiantes.length&&data.estudiantes.every(al=>Object.keys(COMP).every(cp=>{const f=data.resultados[al.id][cp].final;return f&&f.versionAportes===data.versionAportes&&(f.nivel!=='C'||String(f.conclusion||'').trim());}));}
    function changed(id,comp,raw){if(token!==global.IEStudents.validToken()||!data.puedeFinal||!data.abierto||busy)return;draft[id]=draft[id]||{};draft[id][comp]=Object.assign({},draft[id][comp]||data.resultados[id][comp].final||{},raw);buttons.querySelectorAll('button').forEach(b=>{if(b.dataset.process)b.disabled=true;});if(raw.modo)draw();}
    function draw(){
      const pendientes=data.aportesPendientes;
      aportesStatus.textContent=!data.puedeFinal?'':!Array.isArray(pendientes)?'No se pudo verificar la integridad de los aportes. Actualiza el backend antes de enviar.':pendientes.length?'Envío oficial bloqueado: '+pendientes.length+' aportes incompletos. '+pendientes[0].nombre+' · '+COMP[pendientes[0].comp]+' · '+pendientes[0].area+(pendientes[0].docente?' · '+pendientes[0].docente:'')+' · '+pendientes[0].motivo+'. Puedes guardar la decisión del Tutor como borrador.':'';
      if(token!==global.IEStudents.validToken()){data.estudiantes=[];draft={};message.textContent='La sesión cambió. Ingresa nuevamente.';}
      rows.replaceChildren();rows.className='trans-grid-wrap';
      const table=text('table','',rows);table.className='trans-grid';const head=text('thead','',table),hr=text('tr','',head);['N°','Estudiante','TIC','Gestiona su aprendizaje','Estado'].forEach(label=>text('th',label,hr));const tbody=text('tbody','',table);
      data.estudiantes.forEach((al,index)=>{
        const card=text('tr','',tbody);text('td',String(index+1),card);const student=text('th',al.nombre,card);student.className='trans-student';student.scope='row';
        Object.entries(COMP).forEach(([comp,label])=>{
          const result=data.resultados[al.id][comp],record=(draft[al.id]||{})[comp]||result.final;
          const td=text('td','',card),cell=text('details','',td);cell.className='trans-detail';
          const received=result.resumen.recibidos,expected=received+result.resumen.faltan.length;
          const summary=text('summary',(record&&record.nivel||result.resumen.sugerencia||'—')+' · '+received+'/'+expected+' aportes'+(result.resumen.alerta?' · ⚠':'')+' · '+result.estado,cell);summary.setAttribute('aria-label',al.nombre+' · '+label+' · ver detalle');
          text('h4',al.nombre+' · '+label,cell);
          {
            text('strong','Aportes de las áreas',cell);
            const aportesAlumno=data.aportes.map(ap=>({area:ap.area,user:ap.user,ts:ap.ts,valor:(ap.valores[al.id]||{})[comp],origen:(ap.origenes&&ap.origenes[al.id]||{})[comp]||'evidencias',conclusion:((((ap.evidencia||{}).conclusiones||{})[al.id]||{})[comp]||'')})).filter(a=>a.valor);
            aportesAlumno.forEach(a=>{
              const aporte=data.aportes.find(x=>x.area===a.area&&x.ts===a.ts);
              text('p',a.area+' · '+(aporte&&aporte.docente||aporte&&aporte.user||'')+': '+(a.valor.modo==='num'?a.valor.valor+' → ':'')+a.valor.nivel+' · '+(a.origen==='directo'?'directo':'evidencias'),cell);
              if(a.valor.nivel==='C')text('p','Conclusión del docente: '+(a.conclusion||'Pendiente'),cell);
              const detail=text('details','',cell);text('summary','Ver evidencias de '+a.area,detail);
              const evidencia=aporte&&aporte.evidencia;
              text('p','Aporte efectivo: '+a.valor.nivel+' · origen: '+(a.origen==='directo'?'nota directa':'evidencias'),detail);
              if(evidencia)(evidencia.sessions||[]).filter(s=>s.comp===comp).forEach(s=>{const g=((evidencia.grades||{})[grading.sessionKey(s)]||{})[al.id];if(g)text('p',s.fecha+' · '+s.capacidad+' · '+g.valor+' → '+g.nivel,detail);});
            });
            Object.entries(data.responsables||{}).forEach(([area,docentes])=>docentes.forEach(doc=>{
              if(!aportesAlumno.some(a=>a.area===area&&a.user===doc.user)&&!result.resumen.sinAporte.includes(area))text('p',area+' · '+doc.nombre+' · Sin aporte',cell);
            }));
            text('p','AD: '+result.resumen.conteo.AD+' · A: '+result.resumen.conteo.A+' · B: '+result.resumen.conteo.B+' · C: '+result.resumen.conteo.C,cell);
            (result.resumen.pendientes||[]).forEach(area=>text('p',area+' · Aporte C pendiente de conclusión',cell));
            (result.resumen.sinAporte||[]).forEach(area=>text('p',area+' · '+((data.responsables&&data.responsables[area]||[]).map(d=>d.nombre).join(', '))+' · Sin aporte',cell));(result.resumen.sinDocente||[]).forEach(area=>text('p',area+' · Sin docente asignado',cell));
            text('p','Aportes recibidos: '+result.resumen.recibidos+(result.resumen.faltan.length?' · Faltan: '+result.resumen.faltan.join(', '):''),cell);
            text('strong','Sugerencia del sistema: '+(result.resumen.sugerencia||'Sin sugerencia automática'),cell);
            if(result.resumen.alerta)text('p','⚠ Requiere revisión colegiada',cell);
            text('p','Calificación final consolidada',cell);text('p',result.estado,cell);
            if(result.final)text('p','Decisión guardada: '+(result.final.modo==='num'?result.final.valor+' → ':'')+result.final.nivel+' · '+result.final.justificacion,cell);
          }
          if(!data.puedeFinal){if(record&&record.conclusion)text('p','Conclusión del Tutor: '+record.conclusion,cell);return;}
          const enabled=data.abierto&&data.puedeFinal&&!busy&&token===global.IEStudents.validToken();
          const input=control(record,mode,raw=>changed(al.id,comp,raw),cell);input.disabled=!enabled;
          [['justificacion','Justificación de la decisión del Tutor'],['conclusion','Conclusión descriptiva']].forEach(([key,label])=>{const wrap=text('label',label,cell),field=document.createElement('textarea');field.setAttribute('aria-label',label);field.placeholder=label;field.value=record&&record[key]||'';field.disabled=!enabled;field.oninput=()=>changed(al.id,comp,{[key]:field.value});wrap.appendChild(field);if(key==='conclusion'&&record&&record.nivel==='C'&&global.IEConclusionSuggestions)global.IEConclusionSuggestions.mount(field,label==='Conclusión descriptiva'?COMP[comp]:label);if(key==='conclusion')text('p','Obligatoria cuando la calificación final es C.',cell);});
        });
        text('td',Object.keys(COMP).map(cp=>data.resultados[al.id][cp].estado).join(' · '),card);
      });
      modeEl.disabled=busy;buttons.querySelectorAll('button').forEach(b=>{b.disabled=busy||!data.abierto||(b.dataset.process&&!procesable());});
    }
    async function act(action){
      if(busy||token!==global.IEStudents.validToken())return;
      if(action==='procesartransversales'&&!procesable()){message.textContent='Completa los aportes obligatorios y guarda las decisiones vigentes antes del envío oficial.';return;}
      if(action!=='savetransversalfinal'&&Object.keys(draft).length){message.textContent='Guarda la decisión final antes de confirmar.';return;}
      const payload=Object.assign({},ctx,{version:data.version,versionAportes:data.versionAportes});
      if(action==='savetransversalfinal'){if(!Object.keys(draft).length){message.textContent='Sin decisiones nuevas para guardar.';return;}payload.finales=draft;}
      busy=true;draw();message.textContent='Guardando…';
      try{data=await request(action,payload);draft={};message.textContent=action==='procesartransversales'?'COMPETENCIAS TRANSVERSALES CONSOLIDADAS POR TUTOR · LISTAS PARA REGISTRO OFICIAL':'Decisión del Tutor guardada. Revisa y envía al registro oficial.';}catch(e){if(e.code==='SESSION'){data.estudiantes=[];draft={};}message.textContent=e.code==='CONFLICT'?'CONFLICT: cambió en otro dispositivo. Recarga y revisa antes de guardar.':e.message;}
      finally{busy=false;draw();}
    }
    if(data.puedeFinal){const save=text('button','Guardar decisión del Tutor',buttons);save.onclick=()=>act('savetransversalfinal');}
    if(data.puedeProcesar){const b=text('button','ENVIAR AL REGISTRO OFICIAL',buttons);b.dataset.process='true';b.onclick=()=>act('procesartransversales');}
    modeEl.onchange=()=>{mode=modeEl.value;draw();};
    draw();return {dirty:()=>Object.keys(draft).length>0,busy:()=>busy};
  }
  function evidenceEditor(container,data,ctx){
    const user=String((global.IEStudents.session()||{}).user||'').trim().toLowerCase(),token=global.IEStudents.validToken();
    let evidence,version,dirty=false,busy=false,mode='letra';
    function adopt(){const own=data.aportes.find(a=>a.area===ctx.area&&String(a.user).trim().toLowerCase()===user);version=own?own.version:0;evidence=JSON.parse(JSON.stringify(own&&own.evidencia||{schema:1,sessions:[],grades:{}}));if(own&&own.legacyValores)message.textContent='Valoraciones anteriores sin sesiones conservadas como históricas. Registra nuevas evidencias.';}
    const toolbar=text('div','',container),modeEl=text('select','',toolbar),date=text('input','',toolbar),compEl=text('select','',toolbar);
    [['letra','Letras'],['num','0–20']].forEach(([v,label])=>{const o=text('option',label,modeEl);o.value=v;});
    date.type='date';const hoy=new Date();date.value=hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0')+'-'+String(hoy.getDate()).padStart(2,'0');date.setAttribute('aria-label','Fecha de sesión transversal');
    Object.entries(COMP).forEach(([v,label])=>{const o=text('option',label,compEl);o.value=v;});compEl.value='tic';compEl.setAttribute('aria-label','Competencia transversal');
    text('p','Selecciona una o varias capacidades de la competencia. Letras y 0–20 solo cambian la vista; no sustituyen notas guardadas.',container);
    const caps=text('div','',container),add=text('button','Agregar capacidades a la grilla',container),history=text('div','',container),message=text('p','',container),grid=text('div','',container),summary=text('div','',container),save=text('button','Guardar sesión y evidencias del área',container);
    add.type=save.type='button';grid.style.overflowX='auto';grid.className='trans-evidence-grid';
    function current(){return evidence.sessions.filter(s=>s.fecha===date.value&&s.comp===compEl.value);}
    function draw(){
      if(token!==global.IEStudents.validToken()){data.estudiantes=[];evidence={schema:1,sessions:[],grades:{}};dirty=false;message.textContent='La sesión cambió. Ingresa nuevamente.';}
      const enabled=data.abierto&&!busy&&token===global.IEStudents.validToken();
      caps.replaceChildren();CAPS[compEl.value].forEach(cap=>{const label=text('label',' '+cap,caps),check=text('input','',label);check.type='checkbox';check.value=cap;check.checked=current().some(s=>s.capacidad===cap);check.disabled=!enabled;check.style.width='20px';check.style.minHeight='20px';label.style.minHeight='44px';label.style.display='flex';label.style.alignItems='center';label.style.gap='8px';});
      history.replaceChildren();text('strong','Sesiones y evidencias anteriores',history);
      const dates=[...new Set(evidence.sessions.map(s=>JSON.stringify([s.fecha,s.comp])))].sort();
      if(!dates.length)text('p','Aún no hay sesiones. Selecciona fecha, competencia y capacidades.',history);
      dates.forEach(key=>{const [fecha,comp]=JSON.parse(key),b=text('button',fecha+' · '+COMP[comp],history);b.type='button';b.disabled=busy;b.onclick=()=>{date.value=fecha;compEl.value=comp;draw();};});
      grid.replaceChildren();const sessions=current();
      if(sessions.length){
        const table=text('table','',grid),head=text('tr','',text('thead','',table));text('th','Estudiante',head);
        sessions.forEach(s=>{const h=text('th',s.capacidad,head),del=text('button','Quitar capacidad y sus notas',h);del.type='button';del.disabled=!enabled;del.onclick=()=>{if(!enabled||!confirm('¿Quitar esta capacidad y sus notas de la sesión? Las demás evidencias se mantienen.'))return;evidence.sessions=evidence.sessions.filter(x=>grading.sessionKey(x)!==grading.sessionKey(s));delete evidence.grades[grading.sessionKey(s)];dirty=true;draw();};});
        const body=text('tbody','',table);data.estudiantes.forEach(al=>{const row=text('tr','',body);text('th',al.nombre,row);sessions.forEach(s=>{
          const key=grading.sessionKey(s),cell=text('td','',row),record=(evidence.grades[key]||{})[al.id];
          const input=control(record,mode,raw=>{if(!enabled)return;if(raw.valor===''){if(evidence.grades[key])delete evidence.grades[key][al.id];}else{const g=valor(raw);if(!g){message.textContent='La nota debe estar entre 0 y 20 o ser AD/A/B/C.';draw();return;}evidence.grades[key]=evidence.grades[key]||{};evidence.grades[key][al.id]=g;}dirty=true;message.textContent='Evidencias sin guardar.';drawSummary();},cell);input.disabled=!enabled;input.setAttribute('aria-label',al.nombre+' · '+s.capacidad);
          if(record)text('small','Valor: '+record.valor+' → '+record.nivel,cell);
        });});
      }else text('p','Agrega las capacidades trabajadas a la grilla de esta fecha.',grid);
      modeEl.disabled=date.disabled=compEl.disabled=busy;add.disabled=!enabled;save.disabled=!enabled||!dirty;drawSummary();
    }
    function drawSummary(){
      summary.replaceChildren();text('strong',dirty?'Resultado bimestral del área · vista previa sin guardar':'Resultado bimestral del área',summary);
      const result=grading.resultados(evidence,data.estudiantes.map(a=>a.id));data.estudiantes.forEach(al=>{const card=text('article','',summary);text('h3',al.nombre,card);Object.entries(COMP).forEach(([comp,label])=>{const stats=result.estadisticas[al.id][comp],v=result.valores[al.id][comp];text('h4',label,card);text('p','Evidencias registradas: '+stats.evidencias+' · Capacidades trabajadas: '+stats.capacidades.length+' de '+stats.totalCapacidades+' · Resultado del área: '+(v?v.nivel:'Sin aporte'),card);});});
      save.disabled=!data.abierto||busy||!dirty||token!==global.IEStudents.validToken();
    }
    add.onclick=()=>{
      if(!data.abierto||busy||token!==global.IEStudents.validToken())return;
      const selected=[...caps.querySelectorAll('input')].filter(c=>c.checked).map(c=>c.value);
      if(!date.value||!selected.length){message.textContent='Selecciona una fecha y al menos una capacidad.';return;}
      let changed=false;selected.forEach(capacidad=>{const s={fecha:date.value,comp:compEl.value,capacidad};if(!evidence.sessions.some(x=>grading.sessionKey(x)===grading.sessionKey(s))){evidence.sessions.push(s);changed=true;}});
      if(changed)dirty=true;draw();
    };
    save.onclick=async()=>{
      if(!data.abierto||busy||!dirty||token!==global.IEStudents.validToken())return;
      busy=true;draw();message.textContent='Guardando sesión y evidencias…';
      try{data=await request('savetransversalaporte',Object.assign({},ctx,{version,evidencia:evidence}));dirty=false;adopt();message.textContent='Guardado. El aporte bimestral se calculó desde tus evidencias.';}
      catch(e){if(e.code==='SESSION'||token!==global.IEStudents.validToken()){data.estudiantes=[];evidence={schema:1,sessions:[],grades:{}};dirty=false;}message.textContent=e.code==='CONFLICT'?'CONFLICT: las evidencias cambiaron. Recarga antes de guardar.':e.message;}
      finally{busy=false;draw();}
    };
    modeEl.onchange=()=>{mode=modeEl.value;draw();};date.onchange=compEl.onchange=draw;
    adopt();if(evidence.sessions.length){date.value=evidence.sessions[0].fecha;compEl.value=evidence.sessions[0].comp;}draw();return {dirty:()=>dirty};
  }
  function init(){
    const msg=document.getElementById('transStatus'),aula=document.getElementById('transAula'),bim=document.getElementById('transBim'),box=document.getElementById('transRows');if(!msg)return;
    let serial=0,active=null,selected=null,disposed=false;const token=global.IEStudents.validToken();
    const warn=event=>{if(active&&active.dirty()){event.preventDefault();event.returnValue='';}};if(global.addEventListener)global.addEventListener('beforeunload',warn);
    const controller={canLeave:()=>!(active&&active.busy())&&(!(active&&active.dirty())||confirm('Hay decisiones del Tutor sin guardar. ¿Descartarlas?')),clear:()=>{disposed=true;++serial;active=null;box.replaceChildren();if(global.removeEventListener)global.removeEventListener('beforeunload',warn);},ready:null};
    async function load(){
      if(disposed)return;if(active&&active.busy()){msg.textContent='Espera a que termine el envío antes de cambiar de aula.';if(selected){aula.value=selected.aula;bim.value=selected.bim;}return;}
      if(active&&active.dirty()&&!confirm('Hay cambios sin guardar. ¿Descartarlos y recargar?')){if(selected){aula.value=selected.aula;bim.value=selected.bim;}return;}
      selected={aula:aula.value,bim:bim.value};active=null;
      const seq=++serial,p=aula.value.split('|');box.replaceChildren();msg.textContent='Cargando aula…';
      try{const ctx={grado:p[0],seccion:p[1],bimestre:bim.value},data=await request('loadtransversales',ctx);if(disposed||seq!==serial)return;active=editor(box,data,ctx,true);msg.textContent=data.abierto?(data.puedeFinal?'Tutor: guarda tu decisión final y envía al registro oficial.':'Consulta de solo lectura · decisiones oficiales del Tutor'):'Bimestre cerrado/bloqueado · Solo lectura';}
      catch(e){if(seq===serial)msg.textContent=e.message;}
    }
    async function initialize(){try{
      const data=await request('loadtransversalesaulas');if(disposed||token!==global.IEStudents.validToken())return;
      aula.replaceChildren();bim.replaceChildren();
      if(!data.aulas.length){msg.textContent='No tiene aulas de tutoría autorizadas.';return;}
      data.aulas.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v.replace('|','° ');aula.appendChild(o);});
      ['I','II','III','IV'].forEach(v=>{const o=document.createElement('option');o.value=v;const state=(data.periodos&&data.periodos.bimestres||{})[v]||'bloqueado';o.textContent=v+' · '+state+(state==='abierto'?'':' 🔒');bim.appendChild(o);});
      aula.onchange=load;bim.onchange=load;document.getElementById('transReload').onclick=load;await load();
    }catch(e){if(disposed)return;msg.textContent=e.message;document.getElementById('transReload').onclick=initialize;}}
    controller.ready=initialize();return controller;
  }
  global.IETransversales={request,valor,COMP,CAPS,editor,init};
  if(document.body)start();else if(document.addEventListener)document.addEventListener('DOMContentLoaded',start,{once:true});
})(window);
