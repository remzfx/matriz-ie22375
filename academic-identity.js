/* Pure identity projection. No transport, storage, timestamps or permissions. */
function academicIdentityFactory() {
  'use strict';
  const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/,/g,' ').replace(/\s+/g,' ').trim();
  const key=a=>a.idSiagie?'id:'+encodeURIComponent(String(a.idSiagie).trim()):a.codigoEstudiante?'cod:'+encodeURIComponent(String(a.codigoEstudiante).trim()):'nom:'+encodeURIComponent(norm(a.nombre));
  const fields=['grades','finales','concComp','competenciasEstado'];
  function clean(x){if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object'){if(x.borrado)return {borrado:true};const o=Object.create(null);Object.keys(x).sort().filter(k=>!['ts','_ts','registroVersion'].includes(k)).forEach(k=>o[k]=clean(x[k]));if(o.origen==='letra')delete o.nota20;return o;}return x;}
  const equal=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
  // Versioned, explicit spelling equivalences. Never infer C1/C2 or fuzzy matches.
  const equivalents=[['Construye su Identidad','Construye su identidad']];
  function resolver(roster,context,competencies,aliases={}){
    const prefix=[context.nivel,context.bim,context.grado,context.seccion,context.area].join('||')+'||',owners=new Map();
    function add(alias,id){if(!owners.has(alias))owners.set(alias,new Set());owners.get(alias).add(id);}
    (roster||[]).filter(a=>(!a.nivel||a.nivel===context.nivel)&&String(a.grado)===String(context.grado)&&norm(a.seccion)===norm(context.seccion)).forEach(a=>{
      const id=key(a);add(id,id);if(a.codigoEstudiante)add('cod:'+encodeURIComponent(String(a.codigoEstudiante).trim()),id);add('nom:'+encodeURIComponent(norm(a.nombre)),id);
    });
    // Aliases may veto a doubtful name join, but never create one.
    Object.entries(aliases||{}).forEach(([owner,names])=>{if(!/^(id:|cod:)/.test(owner)||!Array.isArray(names))return;for(const name of names){const alias='nom:'+encodeURIComponent(norm(name)),ids=owners.get(alias),known=owners.get(owner);if(ids&&(!known||[...ids].some(id=>!known.has(id))))ids.add('unverified-owner:'+owner);}});
    const comps=new Map((competencies||[]).map(c=>[c,c]));
    equivalents.forEach(pair=>{const present=pair.filter(c=>comps.has(c));if(present.length===1)pair.forEach(c=>comps.set(c,present[0]));});
    function canonical(field,k){
      if(!fields.includes(field)||!k.startsWith(prefix))return null;
      const p=k.split('||'),expected=field==='grades'?9:field==='competenciasEstado'?6:7;if(p.length!==expected||!comps.has(p[5]))return null;
      if(field==='competenciasEstado'){p[5]=comps.get(p[5]);return p.join('||');}
      let tail=p.at(-1);if(!/^(id:|cod:|nom:)/.test(tail))tail='nom:'+encodeURIComponent(norm(tail));
      else if(tail.startsWith('nom:')){try{tail='nom:'+encodeURIComponent(norm(decodeURIComponent(tail.slice(4))));}catch(_){return null;}}
      const ids=owners.get(tail);if(!ids||ids.size!==1)return null;
      p[5]=comps.get(p[5]);p[p.length-1]=[...ids][0];return p.join('||');
    }
    return {canonical,prefix,competence:c=>comps.get(c)||c};
  }
  function project(payload,roster,context,competencies,base){
    const p=copy(payload||{}),resolve=resolver(roster,context,competencies,p.meta&&p.meta.studentAliases),groups=new Map(),conflicts=[],unresolved=[];
    fields.forEach(f=>Object.entries(p[f]||{}).forEach(([k,value])=>{
      const canonical=resolve.canonical(f,k);if(!canonical){if(k.startsWith(resolve.prefix))unresolved.push([f,k]);return;}
      const path=JSON.stringify([f,canonical]);if(!groups.has(path))groups.set(path,[]);groups.get(path).push({key:k,value});
    }));
    groups.forEach((records,path)=>{
      const [f,k]=JSON.parse(path);let selected=records[0];
      if(!records.every(r=>equal(r.value,selected.value))){
        // Only a verified causal base proves a unilateral edit, never ts or key priority.
        const changed=base&&records.filter(r=>has(base[f]||{},r.key)&&!equal(r.value,base[f][r.key]));
        const unchangedOrKnown=base&&records.every(r=>has(base[f]||{},r.key));
        if(unchangedOrKnown&&changed.length===1)selected=changed[0];
        else {conflicts.push({path,records:copy(records)});selected=null;}
      }
      records.forEach(r=>delete p[f][r.key]);if(selected)p[f][k]=copy(selected.value);
    });
    if(Array.isArray(p.sessions))p.sessions.forEach(s=>{if([s.nivel,s.bim,s.grado,s.seccion,s.area].join('||')+'||'===resolve.prefix)s.comp=resolve.competence(s.comp);});
    Object.entries(p.capsSel||{}).forEach(([k,items])=>{if(k.startsWith(resolve.prefix)&&Array.isArray(items))items.forEach(item=>{if(item&&typeof item==='object'&&item.comp)item.comp=resolve.competence(item.comp);});});
    return {payload:p,conflicts,unresolved,groups};
  }
  function dryRun(payload,roster,context,competencies){
    const result=project(payload,roster,context,competencies);
    return {schema:1,mode:'dry-run',original:copy(payload),proposed:result.conflicts.length?null:result.payload,conflicts:result.conflicts,unresolved:result.unresolved};
  }
  function simulate(proposal,current){if(proposal.mode!=='dry-run'||!proposal.proposed||JSON.stringify(current)!==JSON.stringify(proposal.original)&&JSON.stringify(current)!==JSON.stringify(proposal.proposed))throw Error('Propuesta ambigua o base modificada.');return copy(proposal.proposed);}
  function reverse(proposal,current){if(JSON.stringify(current)!==JSON.stringify(proposal.proposed))throw Error('La simulación cambió; no restaurar a ciegas.');return copy(proposal.original);}
  return {schema:1,project,resolver,dryRun,simulate,reverse,equal};
}
if(typeof module!=='undefined'&&module.exports)module.exports=academicIdentityFactory();
(typeof window!=='undefined'?window:globalThis).IEAcademicIdentity=academicIdentityFactory();
