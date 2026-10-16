/* Reconciliación de Registro. No accede a red, cachés, permisos ni almacenamiento. */
(function(global){
  'use strict';
  const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const maps=['grades','finales','concComp','concArea','competenciasEstado','asistencia','asisFechasEstado','capsSel'];
  const ignored=new Set(['ts','_ts','registroVersion']);
  function clean(x){
    if(Array.isArray(x))return x.map(clean);
    if(x&&typeof x==='object'){
      if(x.borrado)return {borrado:true};
      const o=Object.create(null);Object.keys(x).sort().filter(k=>!ignored.has(k)).forEach(k=>o[k]=clean(x[k]));
      // El número de referencia de una letra no es una decisión numérica.
      if(o.origen==='letra')delete o.nota20;
      return o;
    }
    return x;
  }
  const equal=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
  function flatten(p){
    const out=new Map();p=p||{};
    maps.forEach(field=>Object.entries(p[field]||{}).forEach(([key,v])=>out.set(JSON.stringify([field,key]),copy(v))));
    (p.sessions||[]).forEach(s=>{
      const key=JSON.stringify(['sessions',[s.nivel,s.bim,String(s.grado),s.seccion,s.area,s.comp,s.capacidad,s.fecha]]);
      if(out.has(key)&&!equal(out.get(key),s))throw Error('Hay sesiones duplicadas incompatibles. Revise el registro antes de sincronizar.');
      out.set(key,copy(s));
    });
    Object.entries(p.asisFechas||{}).forEach(([aula,dates])=>{
      if(!Array.isArray(dates))throw Error('Fechas de asistencia inválidas.');
      dates.forEach(date=>out.set(JSON.stringify(['asisFechas',aula,date]),true));
    });
    // Alias es información de compatibilidad, no una autorización.
    Object.entries(p.meta||{}).forEach(([k,v])=>{if(k!=='docente'&&k!=='studentAliases'&&k!=='academicHistory')out.set(JSON.stringify(['meta',k]),copy(v));});
    Object.keys(p).filter(k=>!maps.includes(k)&&!['sessions','asisFechas','meta','ts','_ts','registroVersion','modeloAcademico'].includes(k))
      .forEach(k=>out.set(JSON.stringify(['extra',k]),copy(p[k])));
    return out;
  }
  function inflate(atoms,aliases){
    const p=Object.assign(Object.create(null),{modeloAcademico:1,sessions:[],asisFechas:Object.create(null),meta:Object.assign(Object.create(null),{studentAliases:aliases})});maps.forEach(f=>p[f]=Object.create(null));
    atoms.forEach((v,path)=>{if(v===undefined)return;const [f,k,date]=JSON.parse(path);
      if(f==='sessions')p.sessions.push(copy(v));
      else if(f==='asisFechas')(p.asisFechas[k]||(p.asisFechas[k]=[])).push(date);
      else if(f==='extra')p[k]=copy(v);
      else p[f][k]=copy(v);
    });
    return p;
  }
  function aliasesOf(...payloads){
    const out=Object.create(null);payloads.filter(Boolean).forEach(p=>Object.entries(p.meta&&p.meta.studentAliases||{}).forEach(([id,names])=>{
      if(Array.isArray(names))out[id]=[...new Set([...(out[id]||[]),...names.filter(n=>typeof n==='string')])];
    }));return out;
  }
  function signature(p){return JSON.stringify([...flatten(p)].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,clean(v)]));}
  // Read integrity is separate from A1: an absent/corrupt row is not a deletion.
  function readEqual(a,b){
    const project=p=>{p=p||{};const out={...p,meta:{...(p.meta||{})}};delete out.meta.docente;delete out.meta.studentAliases;delete out.modeloAcademico;
      maps.forEach(f=>out[f]=p[f]||{});
      const sessionKey=s=>[s.nivel,s.bim,s.grado,s.seccion,s.area,s.comp,s.capacidad,s.fecha].join('||');
      out.sessions=(p.sessions||[]).slice().sort((x,y)=>sessionKey(x).localeCompare(sessionKey(y)));
      out.asisFechas=Object.fromEntries(Object.entries(p.asisFechas||{}).filter(([,v])=>v.length).map(([k,v])=>[k,[...new Set(v)].sort()]));return out;};
    return equal(project(a),project(b));
  }
  function validateRemote(remote,known={}){
    const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
    const fail=(code,message)=>{const e=Error(message+' Tus notas locales y su base verificada se conservan.');e.code=code;throw e;};
    const p=remote.payload;let b=known.basePayload;
    if(!b&&Number(known.version)>0){try{b=JSON.parse(known.baseline);}catch(_){fail('READ_BASE','No se pudo verificar la base histórica de este registro.');}if(!object(b))fail('READ_BASE','La base histórica es inválida.');}
    if(!object(p))fail('READ_INVALID','Respuesta académica inválida.');
    for(const f of maps)if(p[f]!==undefined&&!object(p[f]))fail('READ_INVALID','Mapa académico inválido.');
    for(const f of ['grades','finales','concComp'])if(Object.values(p[f]||{}).some(v=>!object(v)))fail('READ_INVALID','Registro académico incompleto o inválido.');
    if(p.sessions!==undefined&&(!Array.isArray(p.sessions)||p.sessions.some(s=>!object(s))))fail('READ_INVALID','Sesiones inválidas.');
    if(p.asisFechas!==undefined&&(!object(p.asisFechas)||Object.values(p.asisFechas).some(v=>!Array.isArray(v))))fail('READ_INVALID','Fechas inválidas.');
    if(remote.exists===false&&Number(known.version)>0)fail('READ_MISSING','No se encontró un registro previamente verificado.');
    if(known.version!=null&&remote.version<known.version)fail('READ_STALE','La lectura retrocedió de versión.');
    if(!b)return remote;
    if(remote.version===known.version&&!readEqual(p,b))fail('READ_VERSION','La misma versión contiene datos diferentes.');
    for(const f of [...maps,'sessions'])if(Object.keys(b[f]||{}).length&&p[f]===undefined)fail('READ_INCOMPLETE','La lectura omite información previamente verificada.');
    const fields=['grades','finales','concComp','concArea'];
    const records=x=>fields.flatMap(f=>Object.entries(x[f]||{}).filter(([,v])=>v&&!v.borrado).map(([k])=>[f,k]));
    const previous=records(b);
    if(previous.length&&!records(p).length&&!previous.every(([f,k])=>p[f]&&p[f][k]&&p[f][k].borrado))fail('READ_EMPTY','La lectura está vacía sin borrados explícitos verificables.');
    return remote;
  }
  function plan(base,local,remote,identityGroups=[],options={}){
    const b=base===null?null:flatten(base),l=flatten(local),r=flatten(remote),merged=new Map(),conflicts=[];
    const keys=[...new Set([...(b?b.keys():[]),...l.keys(),...r.keys()])].sort();
    keys.forEach(path=>{
      const lv=l.get(path),rv=r.get(path),bv=b&&b.get(path);
      // El formulario no edita extensiones históricas desconocidas: su ausencia
      // en sliceRegistroArea no representa una orden de borrarlas en el servidor.
      if(JSON.parse(path)[0]==='extra'&&lv===undefined){if(rv!==undefined)merged.set(path,rv);}
      else if(equal(lv,rv)){if(lv!==undefined)merged.set(path,lv);}
      // La versión de un área no demuestra causalidad sobre asistencia compartida.
      // La ausencia en una copia de área tampoco autoriza borrar marcas del aula.
      else if(options.sharedAttendance&&['asistencia','asisFechas','asisFechasEstado'].includes(JSON.parse(path)[0])){
        if(lv===undefined)merged.set(path,rv);
        else if(rv===undefined)merged.set(path,lv);
        else conflicts.push({path,local:copy(lv),remote:copy(rv),unknownBase:true,reason:'Asistencia compartida entre áreas: requiere decisión explícita'});
      }
      else if(options.reviewAbsence&&b&&bv!==undefined&&(lv===undefined||rv===undefined))conflicts.push({path,base:copy(bv),local:copy(lv),remote:copy(rv),reason:'Un dato conocido está ausente sin marca explícita de borrado. Revisa antes de reemplazarlo.'});
      else if(b&&equal(lv,bv)){if(rv!==undefined)merged.set(path,rv);}
      else if(b&&equal(rv,bv)){if(lv!==undefined)merged.set(path,lv);}
      else if(!b&&lv===undefined){merged.set(path,rv);}
      else if(!b&&rv===undefined){merged.set(path,lv);}
      else conflicts.push({path,base:copy(bv),local:copy(lv),remote:copy(rv),unknownBase:!b});
    });
    // Una desactivación concurrente con nuevas evidencias requiere decisión conjunta.
    keys.filter(path=>JSON.parse(path)[0]==='competenciasEstado').forEach(path=>{
      if(conflicts.some(c=>c.path===path))return;
      const [,key]=JSON.parse(path),prefix=key+'||',lv=l.get(path),rv=r.get(path),bv=b&&b.get(path);
      const changedEvidence=side=>keys.some(k=>{const [f,id]=JSON.parse(k);return ['grades','finales','concComp'].includes(f)&&id.startsWith(prefix)&&!equal(side.get(k),b&&b.get(k));});
      if(b&&((lv&&lv.trabajada===false&&!equal(lv,bv)&&changedEvidence(r))||(rv&&rv.trabajada===false&&!equal(rv,bv)&&changedEvidence(l)))){
        merged.delete(path);conflicts.push({path,base:copy(bv),local:copy(lv),remote:copy(rv),reason:'Competencia desactivada y datos editados en otro dispositivo'});
      }
    });
    // Quitar una sesión/fecha también afecta la visibilidad de sus marcas.
    // Una eliminación concurrente con notas nuevas se decide como un conjunto,
    // evitando conservar evidencias huérfanas que no aparecen en la grilla.
    if(b)keys.filter(path=>['sessions','asisFechas'].includes(JSON.parse(path)[0])&&b.has(path)&&!(options.sharedAttendance&&JSON.parse(path)[0]==='asisFechas')).forEach(path=>{
      const localDeleted=!l.has(path),remoteDeleted=!r.has(path);if(localDeleted===remoteDeleted)return;
      const [field,key,date]=JSON.parse(path),prefix=field==='sessions'?key.join('||')+'||':key+'||'+date+'||';
      const dependent=keys.filter(p=>{const [f,k]=JSON.parse(p);return (field==='sessions'?f==='grades':f==='asistencia')&&k.startsWith(prefix);});
      const edited=localDeleted?r:l;if(!dependent.some(p=>!equal(edited.get(p),b.get(p))))return;
      const paths=[path,...dependent];paths.forEach(p=>{merged.delete(p);const i=conflicts.findIndex(c=>c.path===p);if(i>=0)conflicts.splice(i,1);});
      const records=side=>paths.filter(p=>side.has(p)).map(p=>({path:p,value:copy(side.get(p))}));
      conflicts.push({path:JSON.stringify(['deletion',field,key,date]),paths,local:records(l),remote:records(r),reason:'Sesión o fecha eliminada mientras se editaron sus notas o marcas. Elija el conjunto completo.'});
    });
    if(options.sharedAttendance){
      // Una fecha borrada y sus marcas son una única decisión; no dejar marcas
      // ocultas ni restaurar una fecha eliminada desde una copia antigua.
      keys.filter(p=>JSON.parse(p)[0]==='asisFechasEstado').forEach(path=>{
        const [,key]=JSON.parse(path),cut=key.lastIndexOf('||'),aula=key.slice(0,cut),date=key.slice(cut+2);
        const datePath=JSON.stringify(['asisFechas',aula,date]),prefix=key+'||';
        const paths=[path,datePath,...keys.filter(p=>{const [f,k]=JSON.parse(p);return f==='asistencia'&&k.startsWith(prefix);})];
        const deleted=side=>!!(side.get(path)&&side.get(path).borrado);
        const active=side=>side.has(datePath)||paths.some(p=>JSON.parse(p)[0]==='asistencia'&&side.has(p)&&!side.get(p).borrado);
        if(!((deleted(l)&&!deleted(r)&&active(r))||(deleted(r)&&!deleted(l)&&active(l))))return;
        paths.forEach(p=>{merged.delete(p);const i=conflicts.findIndex(c=>c.path===p);if(i>=0)conflicts.splice(i,1);});
        const records=side=>paths.filter(p=>side.has(p)).map(p=>({path:p,value:copy(side.get(p))}));
        conflicts.push({path:JSON.stringify(['deletion','asisFechas',aula,date]),paths,local:records(l),remote:records(r),reason:'Fecha eliminada frente a asistencia existente. Elija la fecha y sus marcas como conjunto.'});
      });
    }
    identityGroups.forEach(paths=>{
      if(conflicts.some(c=>c.paths&&c.paths.some(p=>paths.includes(p))))return;
      // Comparar cada representación con su misma ruta, incluyendo ausencias.
      // La divergencia histórica interna no demuestra una edición concurrente.
      const sameGroup=(a,z)=>paths.every(p=>equal(a.get(p),z.get(p)));
      if(sameGroup(l,r)||b&&(sameGroup(l,b)||sameGroup(r,b)))return;
      // Cambios bilaterales en diferentes claves de la misma identidad
      // requieren revisar el conjunto; no decidir por marcas de tiempo.
      const localRecords=paths.filter(p=>l.has(p)).map(path=>({path,value:l.get(path)}));
      const remoteRecords=paths.filter(p=>r.has(p)).map(path=>({path,value:r.get(path)}));
      const records=localRecords.concat(remoteRecords);
      if(!records.length||records.every(x=>equal(x.value,records[0].value)))return;
      paths.forEach(p=>{merged.delete(p);const i=conflicts.findIndex(c=>c.path===p);if(i>=0)conflicts.splice(i,1);});
      conflicts.push({path:JSON.stringify(['identity',JSON.parse(paths[0])[1]]),paths,local:copy(localRecords),remote:copy(remoteRecords),reason:'La misma identidad tiene representaciones históricas distintas. Elija el conjunto que debe prevalecer.'});
    });
    const aliases=aliasesOf(base,local,remote),dateContexts=new Set([base,local,remote].filter(Boolean).flatMap(p=>Object.keys(p.asisFechas||{})));
    return {conflicts,resolve(choices={}){
      const result=new Map(merged);conflicts.forEach(c=>{
        const choice=choices[c.path];if(choice!=='local'&&choice!=='remote')throw Error('Hay conflictos sin resolver.');
        const v=c[choice];if(c.paths){(v||[]).forEach(record=>result.set(record.path,copy(record.value)));}
        else if(v!==undefined)result.set(c.path,copy(v));
      });const payload=inflate(result,aliases);dateContexts.forEach(k=>{if(!has(payload.asisFechas,k))payload.asisFechas[k]=[];});
      if(options.sharedAttendance)Object.entries(payload.asisFechasEstado).forEach(([key,v])=>{
        if(!v.borrado)return;const cut=key.lastIndexOf('||'),aula=key.slice(0,cut),date=key.slice(cut+2);
        payload.asisFechas[aula]=(payload.asisFechas[aula]||[]).filter(d=>d!==date);
      });return payload;
    }};
  }
  // Nombres heredados se relacionan solo mediante aliases inequívocos existentes.
  // No renombra claves: las diferencias entre representaciones se revisan explícitamente.
  function identityConflicts(local,remote,roster,identity){
    if(!identity)return [];
    const aliases=aliasesOf(local,remote),owners=new Map(),paths=[...flatten(local).keys(),...flatten(remote).keys()];
    const norm=identity.normalizarNombre;
    const codeOwners=new Map();
    (roster||[]).forEach(al=>{const id=global.studentKey(al);if(al.codigoEstudiante){const code='cod:'+encodeURIComponent(String(al.codigoEstudiante).trim());if(!codeOwners.has(code))codeOwners.set(code,new Set());codeOwners.get(code).add(id);}[al.nombre,...(aliases[id]||[])].forEach(n=>{
      const k=norm(n);if(!owners.has(k))owners.set(k,new Set());owners.get(k).add(id);
    });});
    const groups=new Map();paths.forEach(path=>{const [f,k]=JSON.parse(path);if(!['grades','finales','concComp','concArea','asistencia'].includes(f))return;
      const index=k.lastIndexOf('||'),tail=k.slice(index+2);let id=tail;
      if(tail.startsWith('cod:')&&codeOwners.has(tail)){const ids=codeOwners.get(tail);if(ids.size!==1)return;id=[...ids][0];}
      if(!/^(id:|cod:)/.test(tail)){
        let name=tail;if(tail.startsWith('nom:')){try{name=decodeURIComponent(tail.slice(4));}catch(e){return;}}
        const ids=owners.get(norm(name));if(!ids||ids.size!==1)return;id=[...ids][0];
        // No heredar un nombre que ya pertenece a otra identidad oficial histórica.
        if(Object.entries(aliases).some(([owner,names])=>owner!==id&&/^(id:|cod:)/.test(owner)&&names.some(n=>norm(n)===norm(name))))return;
      }
      const logical=JSON.stringify([f,k.slice(0,index+2)+id]);if(!groups.has(logical))groups.set(logical,new Set());groups.get(logical).add(path);
    });
    return [...groups.values()].filter(set=>set.size>1).map(set=>[...set]);
  }
  // Identity is projected only after the raw Phase 1 integrity barrier.
  function academicPlan(base,local,remote,roster,context,competencies,options={}){
    const identity=global.IEAcademicIdentity;
    if(!identity)throw Error('No se cargó el resolvedor académico. Borrador conservado.');
    const b=base&&identity.project(base,roster,context,competencies),l=identity.project(local,roster,context,competencies,base),r=identity.project(remote,roster,context,competencies,base);
    // A clean old PC follows a verified unambiguous remote version, not its old key spelling.
    const complete=!b||['grades','finales','concComp'].every(f=>Object.keys(b.payload[f]||{}).every(k=>has(r.payload[f]||{},k)));
    if(base&&complete&&(readEqual(local,base)||options.cleanAcademic)&&!r.conflicts.length){for(const field of ['grades','finales','concComp']){l.payload[field]=copy(r.payload[field]||{});if(b)b.payload[field]=copy(r.payload[field]||{});}l.conflicts=[];if(b)b.conflicts=[];}
    if(base&&readEqual(remote,base))r.conflicts=r.conflicts.filter(conflict=>{
      const [f,k]=JSON.parse(conflict.path),records=l.groups.get(conflict.path)||[];
      const changed=records.filter(record=>has(base[f]||{},record.key)&&!equal(record.value,base[f][record.key]));
      if(changed.length!==1||l.conflicts.some(c=>c.path===conflict.path))return true;
      // A real local edit establishes intent while the remote group is unchanged.
      // Keep the old value only as the causal baseline, never as a chosen cloud vote.
      r.payload[f]=r.payload[f]||{};r.payload[f][k]=copy(base[f][changed[0].key]);
      if(b){b.payload[f]=b.payload[f]||{};b.payload[f][k]=copy(base[f][changed[0].key]);}return false;
    });
    const ambiguous=new Map();
    for(const [side,projection]of [['local',l],['remote',r]])for(const conflict of projection.conflicts){
      if(!ambiguous.has(conflict.path))ambiguous.set(conflict.path,{path:conflict.path,paths:[conflict.path],candidates:[],reason:'Identidad histórica verificada, pero notas contradictorias sin vigencia demostrada. Requiere revisión.'});
      const c=ambiguous.get(conflict.path);
      for(const record of conflict.records)if(!c.candidates.some(x=>equal(x.value,record.value)))c.candidates.push({id:'candidate:'+c.candidates.length,label:(side==='local'?'Este dispositivo':'Nube')+' · representación '+(c.candidates.length+1),value:copy(record.value),original:record.key});
    }
    for(const c of ambiguous.values()){
      const [f,k]=JSON.parse(c.path);
      for(const [side,projection]of [['local',l],['remote',r]]){
        const value=projection.payload[f]&&projection.payload[f][k];
        if(value!==undefined&&!c.candidates.some(x=>equal(x.value,value)))c.candidates.push({id:'candidate:'+c.candidates.length,label:side==='local'?'Este dispositivo':'Nube',value:copy(value),original:k});
      }
      for(const projection of [b,l,r].filter(Boolean))if(projection.payload[f])delete projection.payload[f][k];
    }
    const merge=plan(b?b.payload:null,l.payload,r.payload,[],options),conflicts=[...ambiguous.values(),...merge.conflicts];
    return {conflicts,remote:r.payload,resolve(choices={}){
      const result=merge.resolve(choices);
      for(const c of ambiguous.values()){
        const choice=c.candidates.find(x=>x.id===choices[c.path]);if(!choice)throw Error('Hay identidades sin resolver.');
        const [f,k]=JSON.parse(c.path);result[f]=result[f]||{};result[f][k]=copy(choice.value);
      }
      return result;
    }};
  }
  function conflictView(c,context={}){
    const path=JSON.parse(c.paths&&c.paths[0]||c.path),field=path[0],parts=typeof path[1]==='string'?path[1].split('||'):[];
    const types={grades:'Evidencia de evaluación',finales:'Calificación directa',concComp:'Conclusión de competencia',concArea:'Conclusión histórica',asistencia:'Marca de asistencia',asisFechas:'Fecha de asistencia',asisFechasEstado:'Estado de fecha',sessions:'Sesión de evaluación',competenciasEstado:'Competencia trabajada',capsSel:'Capacidades',meta:'Contexto del registro'};
    const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
    const tail=parts.at(-1)||'',decode=s=>{try{return decodeURIComponent(s);}catch(e){return s;}};
    const candidates=(context.roster||[]).filter(al=>{
      const id=typeof global.studentKey==='function'?global.studentKey(al):al.idSiagie?'id:'+encodeURIComponent(al.idSiagie):al.codigoEstudiante?'cod:'+encodeURIComponent(al.codigoEstudiante):'nom:'+encodeURIComponent(normalize(al.nombre));
      return id===tail||(al.codigoEstudiante&&tail==='cod:'+encodeURIComponent(al.codigoEstudiante))||normalize(al.nombre)===normalize(decode(tail.replace(/^nom:/,'')));
    });
    const student=candidates.length===1?candidates[0]:null;
    const individual=['grades','finales','concComp','concArea','asistencia'].includes(field);
    let title=types[field]||'Dato del registro';
    if(individual)title+=' · '+(student?student.nombre+' · Orden '+student.orden+(student.idSiagie?' · ID '+student.idSiagie:student.codigoEstudiante?' · Código '+student.codigoEstudiante:''):candidates.length>1?'Estudiante ambiguo: revisar identificación técnica':'Estudiante fuera del padrón actual: revisar identificación técnica');
    if(['grades','finales','concComp','competenciasEstado','capsSel'].includes(field)&&parts[5])title+=' · '+parts[5];
    if(field==='grades'&&parts[6])title+=' · '+parts[6]+' · '+parts[7];
    if(field==='asistencia')title+=' · '+parts[4];
    if(field==='asisFechas')title+=' · '+path[2];
    if(field==='asisFechasEstado')title+=' · '+parts.at(-1);
    if(c.reason)title+=' · '+c.reason;
    function value(v){
      if(v===undefined)return 'Ausente / eliminación';
      if(Array.isArray(v))return v.map(record=>conflictView({path:record.path,local:record.value},context).title+': '+value(record.value)).join('\n');
      if(v&&typeof v==='object'){
        if(v.borrado)return 'Eliminado';
        const lines=[];for(const [key,label] of Object.entries({nivel:'Nivel',nota20:'Nota',valor:'Valor',texto:'Texto',text:'Texto',marca:'Marca',hora:'Hora',trabajada:'Trabajada',fecha:'Fecha',comp:'Competencia',capacidad:'Capacidad',origen:'Modo'}))if(has(v,key))lines.push(label+': '+v[key]);
        return lines.length?lines.join(' · '):'Datos del registro (ver detalles técnicos)';
      }
      return v===true?'Presente':String(v);
    }
    const alternatives=c.candidates?c.candidates.map(x=>x.value):[c.local,c.remote],different=new Set();
    for(let i=1;i<alternatives.length;i++){
      const a=clean(alternatives[0]),b=clean(alternatives[i]);
      if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(!equal(a[k],b[k]))different.add(k);}
      else if(!equal(a,b))different.add('registro');
    }
    const labels={nivel:'nivel de logro',nota20:'nota exacta de 0–20',origen:'origen de la nota (Letras, Numérica o sin verificar)',borrado:'estado de borrado',registro:'presencia o contenido del registro'};
    const fields=[...different].map(k=>labels[k]||'campo adicional «'+k+'»');
    let explanation=fields.length?'Se requiere revisión por diferencias en: '+fields.join('; ')+'. La misma letra visible no demuestra que los registros sean iguales.':'La revisión corresponde al conjunto de datos indicado; las marcas de tiempo y los números de referencia de Letras no deciden la vigencia.';
    if(different.has('nota20'))explanation+=' Compare los números exactos: A con 14 y A con 15 son calificaciones distintas.';
    if(alternatives.some((v,i)=>i&&value(v)===value(alternatives[0])&&!equal(v,alternatives[0])))explanation+=' Las alternativas se ven iguales en el resumen; abra «Identificación y detalles técnicos» para ver el valor y tipo de cada campo.';
    if(individual&&!student)explanation+=' La identidad no está verificada inequívocamente en el padrón mostrado; no se deben asociar estudiantes por suposición.';
    return {title,local:value(c.local),remote:value(c.remote),explanation};
  }
  function choose(conflicts,isCurrent,context={}){
    if(!conflicts.length)return Promise.resolve({});
    return new Promise(resolve=>{
      const overlay=document.createElement('div');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Revisar conflictos académicos');
      overlay.className='academic-conflict-dialog';
      const panel=document.createElement('div');panel.className='academic-conflict-panel';overlay.appendChild(panel);
      const style=document.createElement('style');style.textContent=`
        .academic-conflict-dialog{position:fixed;inset:0;background:#0f172acc;z-index:100;display:flex;align-items:center;justify-content:center;padding:12px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .academic-conflict-dialog,.academic-conflict-dialog *{box-sizing:border-box;}
        .academic-conflict-panel{display:flex;flex-direction:column;min-width:0;width:100%;max-width:800px;max-height:90vh;max-height:90dvh;overflow:hidden;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:12px;}
        .academic-conflict-header{flex-shrink:0;padding:14px 16px 10px;border-bottom:1px solid #e2e8f0;}
        .academic-conflict-header h2{margin:0;font-size:17px;font-weight:600;line-height:1.35;overflow-wrap:anywhere;}
        .academic-conflict-header p{margin:5px 0 0;font-size:13px;line-height:1.4;color:#475569;}
        .academic-conflict-content{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:12px 16px;display:flex;flex-direction:column;gap:10px;}
        .academic-conflict-card{flex-shrink:0;min-width:0;margin:0;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;}
        .academic-conflict-card legend{max-width:100%;padding:0 4px;font-size:13px;font-weight:600;line-height:1.45;white-space:normal;overflow-wrap:anywhere;}
        .academic-conflict-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
        .academic-conflict-option{display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;align-items:start;min-width:0;min-height:44px;padding:9px;margin:0;background:#fff;border:1px solid #cbd5e1;border-radius:7px;cursor:pointer;}
        .academic-conflict-option input{appearance:auto;flex-shrink:0;width:18px;height:18px;margin:1px 0 0;accent-color:#0284c7;}
        .academic-conflict-option strong{display:block;font-size:13px;font-weight:600;line-height:1.4;}
        .academic-conflict-value{margin:3px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.4;}
        .academic-conflict-card details{margin-top:7px;font-size:12px;color:#475569;}
        .academic-conflict-card summary{cursor:pointer;min-height:28px;padding:4px 0;}
        .academic-conflict-card pre{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.4 ui-monospace,monospace;}
        .academic-conflict-footer{flex-shrink:0;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid #e2e8f0;background:#fff;}
        .academic-conflict-footer button{min-height:44px;max-width:100%;margin:0;padding:9px 12px;border:1px solid #64748b;border-radius:7px;background:#fff;color:#334155;font:600 13px/1.4 system-ui,sans-serif;white-space:normal;cursor:pointer;}
        .academic-conflict-footer .academic-conflict-apply{background:#0284c7;border-color:#0284c7;color:#fff;}
        .academic-conflict-footer button:disabled{opacity:.5;cursor:not-allowed;}
        .academic-conflict-dialog button:focus-visible,.academic-conflict-dialog input:focus-visible,.academic-conflict-dialog summary:focus-visible{outline:2px solid #0284c7;outline-offset:3px;}
        .academic-conflict-option:focus-within{border-color:#0284c7;}
        @media(max-width:600px){.academic-conflict-options{grid-template-columns:minmax(0,1fr);}.academic-conflict-header{padding:12px;}.academic-conflict-content{padding:10px 12px;}.academic-conflict-footer{padding:10px 12px;}.academic-conflict-header h2{font-size:16px;}}
      `;overlay.appendChild(style);
      const header=document.createElement('div');header.className='academic-conflict-header';panel.appendChild(header);
      const heading=document.createElement('h2');heading.textContent='Conflictos pendientes · el trabajo local se conserva';header.appendChild(heading);
      const help=document.createElement('p');help.textContent='Elige por dato. Ninguna calificación se envía hasta resolver todos los conflictos. Cancelar conserva el borrador.';header.appendChild(help);
      const content=document.createElement('div');content.className='academic-conflict-content';panel.appendChild(content);
      const choices={},apply=document.createElement('button'),cancel=document.createElement('button'),previous=document.activeElement;
      conflicts.forEach((c,i)=>{
        const view=conflictView(c,context),field=document.createElement('fieldset'),label=document.createElement('legend');field.className='academic-conflict-card';label.textContent=view.title;field.appendChild(label);
        const options=document.createElement('div');options.className='academic-conflict-options';field.appendChild(options);
        for(const side of (c.candidates||['local','remote'])){
          const row=document.createElement('label'),radio=document.createElement('input'),text=document.createElement('div'),source=document.createElement('strong'),value=document.createElement('div');row.className='academic-conflict-option';radio.type='radio';radio.name='academic-conflict-'+i;
          source.textContent=typeof side==='string'?(side==='local'?'Este dispositivo':'Nube'):side.label;value.className='academic-conflict-value';value.textContent=typeof side==='string'?view[side]:conflictView({path:c.path,local:side.value},context).local;text.appendChild(source);text.appendChild(value);
          radio.onchange=()=>{choices[c.path]=typeof side==='string'?side:side.id;apply.disabled=conflicts.some(x=>!choices[x.path]);};row.appendChild(radio);row.appendChild(text);options.appendChild(row);
        }
        const explanation=document.createElement('p');explanation.className='academic-conflict-explanation';explanation.textContent=view.explanation;field.appendChild(explanation);
        const details=document.createElement('details'),summary=document.createElement('summary'),technical=document.createElement('pre');summary.textContent='Identificación y detalles técnicos';technical.textContent=JSON.stringify(c,null,2);details.appendChild(summary);details.appendChild(technical);field.appendChild(details);content.appendChild(field);
      });
      apply.type=cancel.type='button';apply.textContent='Continuar con las decisiones';cancel.textContent='Cancelar';apply.disabled=true;
      const footer=document.createElement('div');footer.className='academic-conflict-footer';apply.className='academic-conflict-apply';footer.appendChild(cancel);footer.appendChild(apply);panel.appendChild(footer);
      let done=false;const finish=value=>{if(done)return;done=true;clearInterval(watch);document.removeEventListener('keydown',key);overlay.remove();if(previous&&previous.focus)previous.focus();resolve(value);};
      const key=e=>{if(e.key==='Escape'){e.preventDefault();finish(null);}if(e.key==='Tab'){const candidates=Array.from(panel.querySelectorAll('input,button,summary')).filter(n=>!n.disabled);const nodes=candidates.filter(n=>{if(n.type!=='radio')return true;const group=candidates.filter(x=>x.type==='radio'&&x.name===n.name);return n===(group.find(x=>x.checked)||group[0]);});if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus();}else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}}};
      const watch=setInterval(()=>{if(!isCurrent())finish(null);},300);apply.onclick=()=>finish(isCurrent()?choices:null);cancel.onclick=()=>finish(null);
      document.addEventListener('keydown',key);document.body.appendChild(overlay);cancel.focus();
    });
  }
  const api={copy,equal,signature,readEqual,validateRemote,plan,identityConflicts,academicPlan,conflictView,choose,has};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.IERegistroReconcile=api;
})(typeof window!=='undefined'?window:globalThis);
