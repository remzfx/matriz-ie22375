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
    Object.entries(p.meta||{}).forEach(([k,v])=>{if(k!=='docente'&&k!=='studentAliases')out.set(JSON.stringify(['meta',k]),copy(v));});
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
  function plan(base,local,remote,identityGroups=[]){
    const b=base===null?null:flatten(base),l=flatten(local),r=flatten(remote),merged=new Map(),conflicts=[];
    const keys=[...new Set([...(b?b.keys():[]),...l.keys(),...r.keys()])].sort();
    keys.forEach(path=>{
      const lv=l.get(path),rv=r.get(path),bv=b&&b.get(path);
      // El formulario no edita extensiones históricas desconocidas: su ausencia
      // en sliceRegistroArea no representa una orden de borrarlas en el servidor.
      if(JSON.parse(path)[0]==='extra'&&lv===undefined){if(rv!==undefined)merged.set(path,rv);}
      else if(equal(lv,rv)){if(lv!==undefined)merged.set(path,lv);}
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
    if(b)keys.filter(path=>['sessions','asisFechas'].includes(JSON.parse(path)[0])&&b.has(path)).forEach(path=>{
      const localDeleted=!l.has(path),remoteDeleted=!r.has(path);if(localDeleted===remoteDeleted)return;
      const [field,key,date]=JSON.parse(path),prefix=field==='sessions'?key.join('||')+'||':key+'||'+date+'||';
      const dependent=keys.filter(p=>{const [f,k]=JSON.parse(p);return (field==='sessions'?f==='grades':f==='asistencia')&&k.startsWith(prefix);});
      const edited=localDeleted?r:l;if(!dependent.some(p=>!equal(edited.get(p),b.get(p))))return;
      const paths=[path,...dependent];paths.forEach(p=>{merged.delete(p);const i=conflicts.findIndex(c=>c.path===p);if(i>=0)conflicts.splice(i,1);});
      const records=side=>paths.filter(p=>side.has(p)).map(p=>({path:p,value:copy(side.get(p))}));
      conflicts.push({path:JSON.stringify(['deletion',field,key,date]),paths,local:records(l),remote:records(r),reason:'Sesión o fecha eliminada mientras se editaron sus notas o marcas. Elija el conjunto completo.'});
    });
    identityGroups.forEach(paths=>{
      if(conflicts.some(c=>c.paths&&c.paths.some(p=>paths.includes(p))))return;
      // Diferentes claves de una misma identidad no son cambios disjuntos.
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
      });const payload=inflate(result,aliases);dateContexts.forEach(k=>{if(!has(payload.asisFechas,k))payload.asisFechas[k]=[];});return payload;
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
  function choose(conflicts,isCurrent){
    if(!conflicts.length)return Promise.resolve({});
    return new Promise(resolve=>{
      const overlay=document.createElement('div');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Revisar conflictos académicos');
      overlay.style.cssText='position:fixed;inset:0;background:#0f172acc;z-index:100;display:flex;align-items:center;justify-content:center;padding:12px';
      const panel=document.createElement('div');panel.style.cssText='background:white;color:#0f172a;border-radius:12px;padding:16px;max-width:760px;width:100%;max-height:90vh;overflow:auto';overlay.appendChild(panel);
      const heading=document.createElement('h2');heading.textContent='Conflictos pendientes · el trabajo local se conserva';panel.appendChild(heading);
      const help=document.createElement('p');help.textContent='Elige por dato. Ninguna calificación se envía hasta resolver todos los conflictos. Cancelar conserva el borrador.';panel.appendChild(help);
      const choices={},apply=document.createElement('button'),cancel=document.createElement('button'),previous=document.activeElement;
      conflicts.forEach((c,i)=>{
        const field=document.createElement('fieldset'),label=document.createElement('legend');label.textContent=JSON.parse(c.path).join(' · ')+(c.reason?' · '+c.reason:'');field.appendChild(label);
        for(const side of ['local','remote']){
          const row=document.createElement('label'),radio=document.createElement('input'),text=document.createElement('pre');radio.type='radio';radio.name='academic-conflict-'+i;
          text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';text.textContent=(side==='local'?'Este dispositivo: ':'Nube: ')+(c[side]===undefined?'Ausente / eliminación':JSON.stringify(clean(c[side]),null,2));
          radio.onchange=()=>{choices[c.path]=side;apply.disabled=conflicts.some(x=>!choices[x.path]);};row.appendChild(radio);row.appendChild(text);field.appendChild(row);
        }panel.appendChild(field);
      });
      apply.type=cancel.type='button';apply.textContent='Continuar con las decisiones';cancel.textContent='Cancelar';apply.disabled=true;
      for(const btn of [apply,cancel]){btn.style.cssText='padding:10px;margin:6px;border:1px solid #64748b;border-radius:6px';panel.appendChild(btn);}
      let done=false;const finish=value=>{if(done)return;done=true;clearInterval(watch);document.removeEventListener('keydown',key);overlay.remove();if(previous&&previous.focus)previous.focus();resolve(value);};
      const key=e=>{if(e.key==='Escape'){e.preventDefault();finish(null);}if(e.key==='Tab'){const nodes=Array.from(panel.querySelectorAll('input,button')).filter(n=>!n.disabled);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus();}else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}}};
      const watch=setInterval(()=>{if(!isCurrent())finish(null);},300);apply.onclick=()=>finish(isCurrent()?choices:null);cancel.onclick=()=>finish(null);
      document.addEventListener('keydown',key);document.body.appendChild(overlay);cancel.focus();
    });
  }
  const api={copy,equal,signature,plan,identityConflicts,choose,has};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.IERegistroReconcile=api;
})(typeof window!=='undefined'?window:globalThis);
