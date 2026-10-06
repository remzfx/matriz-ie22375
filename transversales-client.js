/* Transporte y editores de transversales. Datos privados solo en memoria; sesiones existentes. */
(function(global){
  'use strict';
  const API='https://script.google.com/macros/s/AKfycbxI0pfjZfeecboqvwx4YOjcvyGTGVa1smmyyE9kNQCmNgNL3tDXwFlPUL0i1DJ2DwBNIg/exec';
  const COMP={tic:'Se desenvuelve en entornos virtuales generados por las TIC',autonomia:'Gestiona su aprendizaje de manera autónoma'};
  const ACTIONS=['loadtransversales','loadtransversalesaulas','savetransversalaporte','savetransversalfinal','confirmtransversaltutor','confirmtransversalaip','loadtransversalexport'];
  let bridge=null;const pending=new Map();
  function valor(raw){
    if(!raw||!['letra','num'].includes(raw.modo))return null;
    if(raw.modo==='letra')return ['AD','A','B','C'].includes(raw.valor)?{modo:'letra',valor:raw.valor,nivel:raw.valor}:null;
    if(raw.valor===''||raw.valor==null||(typeof raw.valor!=='number'&&typeof raw.valor!=='string'))return null;
    const n=Number(raw.valor);return Number.isFinite(n)&&n>=0&&n<=20?{modo:'num',valor:n,nota20:n,nivel:n>=18?'AD':n>=14?'A':n>=11?'B':'C'}:null;
  }
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
  function text(tag,value,parent){const el=document.createElement(tag);el.textContent=value;if(parent)parent.appendChild(el);return el;}
  function control(record,mode,change,parent){
    const el=document.createElement(mode==='letra'?'select':'input');
    if(mode==='letra'){['','AD','A','B','C'].forEach(v=>{const opt=document.createElement('option');opt.value=v;opt.textContent=v||'—';el.appendChild(opt);});el.value=record&&record.nivel||'';}
    else{el.type='number';el.min=0;el.max=20;el.step=1;el.value=record&&record.nota20!=null?record.nota20:'';}
    el.setAttribute('aria-label','Calificación final o aporte');el.onchange=()=>change({modo:mode,valor:el.value});parent.appendChild(el);return el;
  }
  function editor(container,data,ctx,final){
    let mode='letra',draft={},busy=false;
    const toolbar=text('div','',container),modeEl=document.createElement('select');
    [['letra','Letras'],['num','0–20']].forEach(([v,label])=>{const opt=document.createElement('option');opt.value=v;opt.textContent=label;modeEl.appendChild(opt);});toolbar.appendChild(modeEl);
    text('p','18–20 → AD · 14–17 → A · 11–13 → B · 0–10 → C. Cambiar el modo no modifica valoraciones guardadas.',container);
    const message=text('p','',container),rows=text('div','',container),buttons=text('div','',container);
    function changed(id,comp,raw){draft[id]=draft[id]||{};draft[id][comp]=Object.assign({},draft[id][comp]||(final?(data.resultados[id][comp].final||{}):((own().valores[id]||{})[comp]||{})),raw);}
    function own(){const user=String((global.IEStudents.session()||{}).user||'').trim().toLowerCase();return data.aportes.find(a=>a.area===ctx.area&&String(a.user).trim().toLowerCase()===user)||{version:0,valores:{}};}
    function draw(){
      rows.replaceChildren();data.estudiantes.forEach(al=>{
        const card=text('article','',rows);text('h3',al.nombre,card);
        Object.entries(COMP).forEach(([comp,label])=>{
          const cell=text('div','',card);text('h4',label,cell);
          const result=final?data.resultados[al.id][comp]:null,record=(draft[al.id]||{})[comp]||(final?result.final:(own().valores[al.id]||{})[comp]);
          if(final){
            text('strong','Aportes de las áreas',cell);
            result.resumen.aportes.forEach(a=>text('p',a.area+': '+a.valor.valor+' → '+a.valor.nivel,cell));
            text('p','AD: '+result.resumen.conteo.AD+' · A: '+result.resumen.conteo.A+' · B: '+result.resumen.conteo.B+' · C: '+result.resumen.conteo.C,cell);
            text('p','Aportes recibidos: '+result.resumen.recibidos+(result.resumen.faltan.length?' · Faltan: '+result.resumen.faltan.join(', '):''),cell);
            text('strong','Sugerencia del sistema: '+(result.resumen.sugerencia||'Sin sugerencia automática'),cell);
            if(result.resumen.alerta)text('p','⚠ Requiere revisión colegiada',cell);
            text('p','Calificación final consolidada',cell);text('p',result.estado,cell);
            if(result.final)text('p','Decisión guardada: '+result.final.valor+' → '+result.final.nivel+' · '+result.final.justificacion,cell);
          }else if(record)text('p','Original: '+record.valor+' → '+record.nivel,cell);
          const enabled=data.abierto&&(final?data.puedeFinal:true)&&!busy;
          const input=control(record,mode,raw=>changed(al.id,comp,raw),cell);input.disabled=!enabled;
          if(final){const just=document.createElement('textarea');just.placeholder='Justificación breve';just.value=record&&record.justificacion||'';just.disabled=!enabled;just.onchange=()=>changed(al.id,comp,{justificacion:just.value});cell.appendChild(just);}
        });
      });
      modeEl.disabled=busy;buttons.querySelectorAll('button').forEach(b=>{b.disabled=busy||!data.abierto;});
    }
    async function act(action){
      if(busy)return;
      if(action.startsWith('confirm')&&Object.keys(draft).length){message.textContent='Guarda la decisión final antes de confirmar.';return;}
      const payload=Object.assign({},ctx,{version:data.version,versionAportes:data.versionAportes});
      if(action==='savetransversalaporte'){
        payload.version=own().version;payload.valores=JSON.parse(JSON.stringify(own().valores));
        Object.entries(draft).forEach(([id,comps])=>{payload.valores[id]=Object.assign({},payload.valores[id]||{},comps);});
      }else if(action==='savetransversalfinal'){if(!Object.keys(draft).length){message.textContent='Sin decisiones nuevas para guardar.';return;}payload.finales=draft;}
      busy=true;draw();message.textContent='Guardando…';
      try{data=await request(action,payload);draft={};message.textContent='Guardado. Las confirmaciones corresponden a esta versión.';}catch(e){if(e.code==='SESSION'){data.estudiantes=[];draft={};}message.textContent=e.code==='CONFLICT'?'CONFLICT: cambió en otro dispositivo. Recarga y revisa antes de guardar.':e.message;}
      finally{busy=false;draw();}
    }
    if(final?data.puedeFinal:true){const save=text('button',final?'Guardar decisión final':'Guardar aportes del área',buttons);save.type='button';save.onclick=()=>act(final?'savetransversalfinal':'savetransversalaporte');}
    if(final&&data.puedeTutor){const b=text('button','Tutor confirma',buttons);b.type='button';b.onclick=()=>act('confirmtransversaltutor');}
    if(final&&data.puedeAip){const b=text('button','AIP confirma',buttons);b.type='button';b.onclick=()=>act('confirmtransversalaip');}
    modeEl.onchange=()=>{mode=modeEl.value;draw();};
    draw();return {dirty:()=>Object.keys(draft).length>0};
  }
  async function init(){
    const msg=document.getElementById('transStatus'),aula=document.getElementById('transAula'),bim=document.getElementById('transBim'),box=document.getElementById('transRows');if(!msg)return;
    let serial=0,active=null,selected=null;
    async function load(){
      if(active&&active.dirty()&&!confirm('Hay cambios sin guardar. ¿Descartarlos y recargar?')){if(selected){aula.value=selected.aula;bim.value=selected.bim;}return;}
      selected={aula:aula.value,bim:bim.value};active=null;
      const seq=++serial,p=aula.value.split('|');box.replaceChildren();msg.textContent='Cargando aula…';
      try{const ctx={grado:p[0],seccion:p[1],bimestre:bim.value},data=await request('loadtransversales',ctx);if(seq!==serial)return;active=editor(box,data,ctx,true);msg.textContent=data.abierto?'Revisa evidencias antes de confirmar.':'Bimestre cerrado/bloqueado · Solo lectura';}
      catch(e){if(seq===serial)msg.textContent=e.message;}
    }
    try{
      const data=await request('loadtransversalesaulas');
      if(!data.aulas.length){msg.textContent='No tiene aulas de tutoría autorizadas.';return;}
      data.aulas.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v.replace('|','° ');aula.appendChild(o);});
      ['I','II','III','IV'].forEach(v=>{const o=document.createElement('option');o.value=v;const state=(data.periodos&&data.periodos.bimestres||{})[v]||'bloqueado';o.textContent=v+' · '+state+(state==='abierto'?'':' 🔒');bim.appendChild(o);});
      aula.onchange=load;bim.onchange=load;document.getElementById('transReload').onclick=load;await load();
    }catch(e){msg.textContent=e.message;}
  }
  global.IETransversales={request,valor,COMP,editor,init};
  if(document.body)start();else if(document.addEventListener)document.addEventListener('DOMContentLoaded',start,{once:true});
})(window);
