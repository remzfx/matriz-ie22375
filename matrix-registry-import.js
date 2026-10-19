/* B2: solo lecturas protegidas y aplicación local explícita; datos privados en memoria. */
(function(g){
  'use strict';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(),copy=x=>JSON.parse(JSON.stringify(x)),stamp=x=>JSON.stringify(x);
  const empty=()=>({inicio:0,proceso:0,previsto:0,destacado:0}),levels={C:'inicio',B:'proceso',A:'previsto',AD:'destacado'};
  function context(c){return {...c,grado:String(c.grado),seccion:norm(c.seccion)};}
  function same(a,b){return a.nivel===b.nivel&&String(a.bim||a.bimestre)===String(b.bim||b.bimestre)&&String(a.grado)===String(b.grado)&&norm(a.seccion)===norm(b.seccion);}
  function roster(list,c){
    const found=new Map();for(const al of list||[]){if(!same({...c,nivel:al.nivel||c.nivel,grado:al.grado,seccion:al.seccion},c))continue;const id=g.studentKey(al);if(found.has(id)){const prior=found.get(id);if(id.startsWith('nom:')||norm(prior.nombre)!==norm(al.nombre)||(prior.codigoEstudiante&&al.codigoEstudiante&&prior.codigoEstudiante!==al.codigoEstudiante))throw Error('Identidad duplicada en el padrón.');continue;}found.set(id,al);}
    const result=[...found.values()],codes=new Set();for(const al of result)if(al.codigoEstudiante){const code=String(al.codigoEstudiante);if(codes.has(code))throw Error('Código duplicado en el padrón.');codes.add(code);}return result;
  }
  function read(p,map,key,al,students){return g.IEStudentIdentity.leer(map,key,al,p.meta&&p.meta.studentAliases,students.filter(x=>g.IEStudentIdentity.normalizarNombre(x.nombre)===g.IEStudentIdentity.normalizarNombre(al.nombre)).length===1);}
  function payloadFor(p,c){const out={...p};for(const field of ['finales','grades','concComp','competenciasEstado']){out[field]={};for(const [key,value] of Object.entries(p[field]||{})){const parts=key.split('||');if(!same({nivel:parts[0],bim:parts[1],grado:parts[2],seccion:parts[3]},c)||parts[4]!==c.area)continue;parts[2]=c.grado;parts[3]=c.seccion;const normalized=parts.join('||');if(out[field][normalized]&&stamp(out[field][normalized])!==stamp(value))throw Error('Claves duplicadas de contexto en conflicto.');out[field][normalized]=value;}}return out;}
  function effective(p,c,comp,al,students,normalized=false){
    if(!normalized)p=payloadFor(p,c);
    const model=g.IERegistroAcademico,grading=g.IERegistroEvaluacion;if(!model.worked(p,c,comp))return {pending:'No trabajada'};
    const key=model.key(c,comp,g.studentKey(al)),direct=read(p,p.finales,key,al,students);let level='';
    function number(v){if(!v||v.borrado)return null;if(v.nota20!==''&&v.nota20!=null){const n=Number(v.nota20);if(!Number.isFinite(n)||n<0||n>20)throw Error('Nota fuera de rango.');return n;}const n=grading.letterToNum(v.nivel);return n===''?null:Number(n);}
    if(direct){const n=number(direct);level=direct.nivel||(n==null?'':grading.numToLetter(n));if(!levels[level])return {pending:'Directo inválido'};}
    else if(p.meta?.notas2?.adopted!==true){const seen=new Set(),nums=[];for(const s of p.sessions||[]){if(!same(s,c)||s.area!==c.area||s.comp!==comp)continue;const k=[c.nivel,c.bim,c.grado,c.seccion,c.area,comp,s.capacidad,s.fecha,g.studentKey(al)].join('||');if(seen.has(k))return {pending:'Sesión duplicada'};seen.add(k);const n=number(read(p,p.grades,k,al,students));if(n!=null)nums.push(n);}if(nums.length)level=grading.numToLetter(Math.round(nums.reduce((a,b)=>a+b,0)/nums.length));}
    if(!levels[level])return {pending:'Sin calificación'};
    if(model.requiresConclusion(c.nivel,level)){const conclusion=read(p,p.concComp,key,al,students);if(!conclusion||!String(conclusion.texto||'').trim())return {level,pending:'Conclusión pendiente en Registro'};}
    return {level};
  }
  function plan(response,list,c,catalog,current){
    if(!response||!response.ok||response.soportaModeloAcademico!==true||!Array.isArray(response.items))throw Error('La nube no confirmó el contrato académico.');
    const students=roster(list,c);if(!students.length)throw Error('El padrón del aula no está confirmado o está vacío.');
    const items=new Map(),conflicts=new Set();for(const item of response.items){if(!same(item,c)||!catalog[item.area])throw Error('Respuesta de otro contexto o área no autorizada.');const prior=items.get(item.area);if(prior&&stamp(prior)!==stamp(item))conflicts.add(item.area);else items.set(item.area,item);}
    const rows=[];for(const [area,comps] of Object.entries(catalog)){if(area==='Competencias Transversales')continue;const item=items.get(area);let payload,invalid;try{if(item)payload=payloadFor(item.payload||{},{...c,area});}catch(e){invalid=e.message;}for(const comp of comps){const previous={...empty(),...((current[area]||{})[comp]||{})},counts=empty(),reasons=new Set();let pending=0;
      if(!item||conflicts.has(area)){pending=students.length;reasons.add(item?'Registros de nube en conflicto':'Área sin registro en nube');}
      else if(invalid){pending=students.length;reasons.add(invalid);}
      else for(const al of students){try{const result=effective(payload,{...c,area},comp,al,students,true);if(result.level)counts[levels[result.level]]++;if(result.pending){pending++;reasons.add(result.pending);}}catch(e){pending++;reasons.add(e.message);}}
      const changed=Object.keys(counts).some(k=>Number(previous[k]||0)!==counts[k]),conflict=changed&&Object.keys(counts).some(k=>Number(previous[k]||0)>0);
      rows.push({area,comp,total:students.length,counts,pending,reasons:[...reasons],previous,changed,conflict,version:item?Number(item.ts)||0:0});
    }}return {rows,students,source:stamp(response),roster:stamp(students)};
  }
  function create(options){let busy=null,active=null,generation=0;
    function token(){return g.IEStudents.validToken();}
    async function request(action,c,t){const response=await g.fetch(options.api,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},cache:'no-store',body:JSON.stringify({action,token:t,nivel:c.nivel,bimestre:c.bim,grado:c.grado,seccion:c.seccion})});if(!response.ok)throw Error('No se pudo verificar la nube (HTTP '+response.status+').');const data=JSON.parse(await response.text());if(!data.ok){if(data.code==='SESSION')g.IEStudents.clear();throw Error(data.error||'Lectura no autorizada.');}return data;}
    async function load(){const c=context(options.context()),t=token(),local=stamp(options.current());if(!t)throw Error('Sesión vencida.');
      const [response,base,periods]=await Promise.all([request('loadreg',c,t),g.IEStudents.loadRoster(c.bim),request('loadperiodos',c,t)]);
      if(t!==token()||stamp(context(options.context()))!==stamp(c))throw Error('Cambió el contexto o la sesión. Vuelva a consultar.');
      if(!base||base.bimestre!==c.bim||base.padronInicializado===false||base.inicializada===false)throw Error('El padrón del bimestre no está confirmado.');
      if(base.offline)throw Error('No se pudo verificar el padrón en nube. Se conserva la matriz anterior.');
      const catalog=options.catalog(),p=plan(response,((base||{})[c.nivel]||{}).estudiantes,c,catalog,JSON.parse(local));
      return {c,t,local,catalog:stamp(catalog),rosterVersion:base&&base.version,period:periods.periodos&&periods.periodos.bimestres&&periods.periodos.bimestres[c.bim],...p};
    }
    function show(p){const dialog=document.createElement('dialog');dialog.style.cssText='width:min(1100px,96vw);max-height:90vh;padding:16px;border:1px solid #cbd5e1;border-radius:12px;';
      const text=(tag,value,parent=dialog)=>{const el=document.createElement(tag);el.textContent=value;parent.appendChild(el);return el;};
      const title=text('h2','Vista previa · Desde Registro en nube');title.tabIndex=-1;title.autofocus=true;text('p',p.c.nivel+' · '+p.c.grado+'° '+p.c.seccion+' · Bimestre '+p.c.bim+' · Solo se aplican conteos localmente. Las conclusiones permanecen en Registro.');
      const hint=text('p','Los reemplazos divergentes requieren seleccionar expresamente cada fila. Pendientes y áreas ausentes se conservan.');
      const wrap=text('div','');wrap.style.overflowX='auto';const table=text('table','',wrap);table.style.cssText='width:100%;min-width:960px;border-collapse:collapse';const head=text('tr','',table);['Aplicar','Área / competencia','Estudiantes','AD / A / B / C','Pendientes','Matriz anterior AD / A / B / C','Diferencias / versión'].forEach(x=>text('th',x,head));
      const selected=[];p.rows.forEach(row=>{const tr=text('tr','',table),td=text('td','',tr),check=document.createElement('input');check.type='checkbox';check.style.cssText='width:24px;height:24px;margin:10px';check.disabled=!!row.pending||!row.changed;check.checked=!check.disabled&&!row.conflict;td.appendChild(check);selected.push({row,check});
        [row.area+' · '+row.comp,row.total,[row.counts.destacado,row.counts.previsto,row.counts.proceso,row.counts.inicio].join(' / '),row.pending+' · '+row.reasons.join(', '),[row.previous.destacado,row.previous.previsto,row.previous.proceso,row.previous.inicio].join(' / '),(row.conflict?'Reemplazo divergente':row.changed?'Nuevo conteo':'Sin cambios')+' · v'+row.version].forEach((x,i)=>{const cell=text('td',String(x),tr);cell.style.cssText='padding:8px;border-bottom:1px solid #cbd5e1;'+([1,2,4].includes(i)?'white-space:nowrap;':'');});});
      const cancel=text('button','Cancelar'),apply=text('button','Aplicar seleccionados al dispositivo');for(const b of [cancel,apply])b.style.cssText='min-height:44px;padding:10px;margin:6px';
      let applied=false,applying=false;apply.disabled=p.period!=='abierto'||(g.IEStudents.session()||{}).role!=='admin';if(apply.disabled)hint.textContent='Solo Admin puede aplicar, en un bimestre abierto. Esta vista es de consulta.';
      const close=()=>{generation++;active=null;dialog.close();dialog.remove();};cancel.onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
      apply.onclick=async()=>{if(applied||applying)return;const chosen=selected.filter(x=>x.check.checked&&!x.check.disabled).map(x=>x.row);if(!chosen.length){hint.textContent='Seleccione filas disponibles para aplicar.';return;}if(!g.confirm('¿Aplicar '+chosen.length+' competencias seleccionadas a esta matriz local? Se reemplazarán sus conteos anteriores. No se enviarán notas a la nube.'))return;
        const gen=generation;applying=true;apply.disabled=true;hint.textContent='Verificando nuevamente nube, padrón y contexto…';try{const fresh=await load();if(gen!==generation||fresh.t!==p.t||stamp(fresh.c)!==stamp(p.c)||fresh.local!==p.local||fresh.source!==p.source||fresh.roster!==p.roster||fresh.rosterVersion!==p.rosterVersion||fresh.catalog!==p.catalog||fresh.period!=='abierto'||(g.IEStudents.session()||{}).role!=='admin')throw Error('Cambió la nube, matriz, padrón, permisos o contexto. Cancele y vuelva a consultar.');options.apply(chosen);applied=true;close();options.notify('Conteos aplicados localmente. No se enviaron datos a la nube.');}catch(e){hint.textContent=e.message;apply.disabled=false;}finally{applying=false;}};
      document.body.appendChild(dialog);dialog.showModal();active=dialog;return dialog;
    }
    function open(){if(busy)return busy;if(active)return Promise.resolve(active);const gen=++generation;busy=(async()=>{try{const p=await load();if(gen!==generation)return null;return show(p);}catch(e){options.notify(e.message);return null;}finally{busy=null;}})();return busy;}
    return {open};
  }
  g.IEMatrixRegistryImport={plan,effective,create};
})(window);
