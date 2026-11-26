(function(root){
 'use strict';
 const motor=root.IEAipDistribucion||(typeof require==='function'?require('./aip-distribucion.js'):null);
 const fields=['teacher','course','section'];
 const distinct=(rows,field)=>new Set(rows.map(r=>r[field]));
 function monthlyExcesses(history){
  const counts=new Map();
  for(const row of history){
   const id=motor.monthly(row);
   if(!counts.has(id))counts.set(id,{hours:0,manual:0,inherited:0});
   const count=counts.get(id);
   count.hours++;
   count[row.manual===true?'manual':'inherited']++;
  }
  return [...counts].filter(([,count])=>count.hours>2);
 }
 function unusedBlocks(state,months,opportunities,alternatives){
  const bySlot=new Map(),slot=r=>r.date+'|'+r.h1;
  for(const row of opportunities){
   const id=slot(row);
   if(!bySlot.has(id))bySlot.set(id,[]);
   if(state.target.has(motor.key(row)))bySlot.get(id).push(row);
  }
  const credits=[...state.credits.values()],pending=new Set(state.target);
  let index=0;
  return alternatives.slice().sort((a,b)=>motor.compare(a.date,b.date)||a.h1-b.h1).map(block=>{
   while(index<credits.length){
    const {row}=credits[index];
    if(row.date>block.date||(row.date===block.date&&row.h2>=block.h1))break;
    pending.delete(motor.key(row));
    if(!pending.size)for(const id of state.target)pending.add(id);
    index++;
   }
   const candidates=bySlot.get(slot(block))||[];
   const active=candidates.filter(r=>pending.has(motor.key(r)));
   let reason;
   if(!block.h2)reason='Sin segundo tramo libre y consecutivo';
   else if(!bySlot.has(slot(block)))reason='Sin candidato compatible para el bloque';
   else if(!candidates.length)reason='Candidatos excluidos por el PIP';
   else if(!active.length)reason='Candidatos ya acreditados en la ronda activa';
   else if(active.every(r=>months.has(motor.monthly(r))))reason='Límite mensual comprometido';
   else reason='Oportunidad compatible sin asignar en la búsqueda';
   return {...block,reason};
  });
 }
 function report({catalog,history,opportunities,from,to,filter={},consecutive=(a,b)=>b===a+1}){
  const allowed=r=>fields.every(f=>!filter[f]||r[f]===filter[f]);
  const inRange=r=>motor.month(r)>=from&&motor.month(r)<=to;
  const annual=history.filter(allowed),period=annual.filter(inRange),open=opportunities.filter(r=>inRange(r)&&allowed(r));
  const registered=catalog.filter(allowed);
  const combos=new Map(registered.map(r=>[motor.key(r),r]));
  for(const r of annual)if(!combos.has(motor.key(r)))combos.set(motor.key(r),r);
  const totals=motor.summarize(annual,[]),selected=motor.summarize(period,[]);
  const byCombo=new Map(),blocks=new Map();
  for(const r of annual){
   const k=motor.key(r);
   if(!byCombo.has(k))byCombo.set(k,[]);
   byCombo.get(k).push(r);
  }
  for(const rows of byCombo.values()){
   rows.sort((a,b)=>motor.compare(a.date,b.date)||a.hour-b.hour);
   let prev;
   for(const r of rows){
    if(inRange(r)&&(!prev||r.date!==prev.date||!consecutive(prev.hour,r.hour)))blocks.set(r.teacher,(blocks.get(r.teacher)||0)+1);
    prev=r;
   }
  }
  const options=new Set(open.map(motor.key)),covered=new Set(period.map(motor.key));
  const measures=fields.map(field=>{
   const all=distinct(registered,field),available=distinct(open,field),attended=distinct(period,field);
   return {total:all.size,attended:[...all].filter(x=>attended.has(x)).length,
    pending:[...all].filter(x=>!attended.has(x)).length,
    compatible:available.size,compatibleAttended:[...available].filter(x=>attended.has(x)).length};
  });
  measures.push({total:registered.length,attended:registered.filter(r=>covered.has(motor.key(r))).length,
   pending:registered.filter(r=>!covered.has(motor.key(r))).length,
   compatible:options.size,compatibleAttended:[...options].filter(k=>covered.has(k)).length});
  const mapTables=fields.map(field=>{
   const identities=new Map([...combos.values()].map(r=>[r[field],r]));
   return [...identities].map(([id,row])=>{
    const yearRows=annual.filter(r=>r[field]===id),periodRows=period.filter(r=>r[field]===id);
    const compatible=open.filter(r=>r[field]===id);
    const last=[...yearRows].reverse().find(r=>motor.month(r)<=to)?.date||'—';
    const next=yearRows.find(r=>motor.month(r)>to)?.date||'—';
    return {id,row,hours:periodRows.length,annual:yearRows.length,last,next,blocks:blocks.get(id)||0,
     courses:[...distinct(periodRows,'course')].sort(),sections:[...distinct(periodRows,'section')].sort(),teachers:distinct(periodRows,'teacher').size,
     coverage:periodRows.length?'Atención programada':compatible.length?'Pendiente':'Sin bloque compatible en el periodo',opportunities:compatible.length,
     months:[...distinct(yearRows.map(r=>({...r,month:motor.month(r)})),'month')].sort()};
   });
  });
  const repeats=motor.adjacentMonths(totals.months),excesses=monthlyExcesses(annual);
  return {hours:period.length,measures,tables:mapTables,matrix:[...combos].map(([id,row])=>({id,row,
   annual:totals.combos.get(id)||0,hours:selected.combos.get(id)||0,
   months:Object.fromEntries([...totals.months].filter(([k])=>k.slice(8)===id).map(([k,h])=>[k.slice(0,7),h])),
   excesses:Object.fromEntries(excesses.filter(([k])=>k.slice(8)===id).map(([k,counts])=>[k.slice(0,7),counts])),
   repeats:repeats.filter(r=>r.combo===id).map(r=>r.month)}))};
 }
 root.IEAipEstadisticas={report,monthlyExcesses,unusedBlocks};
 if(typeof module!=='undefined'&&module.exports) module.exports=root.IEAipEstadisticas;
})(typeof window==='undefined'?globalThis:window);
