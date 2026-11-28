/* Pure annual allocation. The calendar adapter owns timetable and reservation rules. */
(function(root){
 'use strict';
 const key=(r)=>JSON.stringify([r.teacher,r.course,r.section]);
 const month=r=>r.date.slice(0,7);
 const monthly=r=>month(r)+'|'+key(r);
 const schoolMonth=ym=>{const n=Number(ym.slice(5,7));return n>=3&&n<=12;};
 const inSchoolYear=r=>schoolMonth(month(r));
 const cell=(date,hour)=>date+'|'+hour;
 const compare=(a,b)=>String(a)<String(b)?-1:String(a)>String(b)?1:0;
 const serial=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7));
 const axes=['teacher','section','course'];
 function count(map,k,n=1){map.set(k,(map.get(k)||0)+n);}
 function addHours(state,r,hours){
  axes.forEach((field,i)=>count(state.counts[i],r[field],hours));
  count(state.combos,key(r),hours);
  count(state.months,monthly(r),hours);
 }
 function summarize(history,selected){
  const state={counts:axes.map(()=>new Map()),combos:new Map(),months:new Map()};
  history.forEach(r=>addHours(state,r,1));selected.forEach(r=>addHours(state,r,2));
  return state;
 }
 const equityGain=(hours,delta)=>Math.log1p(delta/(1+hours));
 function shiftMonth(id,offset){
  const index=serial(id)+offset-1,y=Math.floor(index/12),m=index%12+1;
  return y+'-'+String(m).padStart(2,'0')+id.slice(7);
 }
 const chronological=(a,b)=>compare(a.date,b.date)||a.h1-b.h1||compare(key(a),key(b));
 const startsAfter=(r,close)=>!close||r.date>close.date||(r.date===close.date&&r.h1>close.h2);
 const endSlot=r=>cell(r.date,String(r.h2).padStart(2,'0'));
 const blockId=r=>JSON.stringify([r.date,r.h1,r.h2,key(r)]);
 function resources(r){return [cell(r.date,r.h1),cell(r.date,r.h2),'round|'+key(r)];}
 function extendCoverage(rows,byResource,frequency){
  const occupied=new Map(),assigned=new Map(),trail=[];
  function write(row,add){
   if(add)assigned.set(key(row),row);else assigned.delete(key(row));
   for(const id of resources(row)){
    if(add)occupied.set(id,row);else occupied.delete(id);
   }
  }
  for(const row of rows)write(row,true);
  // A failed branch rolls back every displaced row. The bounds apply per
  // evaluated prefix, keeping the yearly search responsive in the browser.
  let budget=12000,attempts;
  function place(combo,ancestors){
   if(assigned.has(combo))return true;
   if(ancestors.size>=8)return false;
   const path=new Set(ancestors).add(combo);
   for(const row of byResource.get('round|'+combo)||[]){
    if(--budget<0||--attempts<0)return false;
    const displaced=new Set(resources(row).map(id=>occupied.get(id)).filter(Boolean));
    if([...displaced].some(other=>path.has(key(other))))continue;
    const checkpoint=trail.length;
    for(const other of displaced){write(other,false);trail.push([other,true]);}
    write(row,true);trail.push([row,false]);
    if([...displaced].every(other=>place(key(other),path)))return true;
    while(trail.length>checkpoint)write(...trail.pop());
   }
   return false;
  }
  const pending=[...frequency.keys()].filter(id=>!assigned.has(id))
   .sort((a,b)=>frequency.get(a)-frequency.get(b)||compare(a,b));
  for(let pass=0;pass<3&&budget>0;pass++){
   const before=assigned.size;
   for(const id of pending){
    if(budget<=0)break;
    attempts=1200;
    place(id,new Set());
    trail.length=0;
   }
   if(assigned.size===before)break;
  }
  return [...assigned.values()];
 }
 function optimize(history,opportunities,last){
  const fixed=summarize(history,[]),used=new Set(history.map(r=>cell(r.date,r.hour)));
  const edges=opportunities.filter(r=>!fixed.months.has(monthly(r))&&!used.has(cell(r.date,r.h1))&&!used.has(cell(r.date,r.h2)));
  const frequency=new Map(),teacherSlots=new Map(),byResource=new Map();
  for(const r of edges){
   count(frequency,key(r));
   if(!teacherSlots.has(r.teacher))teacherSlots.set(r.teacher,new Set());
   teacherSlots.get(r.teacher).add(cell(r.date,r.h1));
   for(const resource of resources(r)){
    if(!byResource.has(resource)) byResource.set(resource,[]);
    byResource.get(resource).push(r);
   }
  }
  const teacherFrequency=new Map([...teacherSlots].map(([id,slots])=>[id,slots.size]));
  function rank(a,b){
   return teacherFrequency.get(a.teacher)-teacherFrequency.get(b.teacher)||frequency.get(key(a))-frequency.get(key(b))||
    compare(last.get(key(a))?.date||'',last.get(key(b))?.date||'')||chronological(a,b);
  }
  edges.sort(rank);
  for(const list of byResource.values())list.sort(rank);
  const slotCost=new Map(edges.map(r=>[r,Date.parse(r.date)/86400000*100+r.h2]));
  function evaluateChanges(state,removed,added,base){
   const changes=axes.map(()=>new Map()),months=new Map(),combos=new Map();
   function move(rows,delta){
    for(const r of rows){
     axes.forEach((field,i)=>count(changes[i],r[field],delta));
     count(months,monthly(r),delta);count(combos,key(r),delta);
    }
   }
   move(removed,-2);move(added,2);
   const next=base.slice();
   next[0]+=added.length-removed.size;
   for(const [i,delta] of changes.entries())for(const [id,hours] of delta){
    const before=state.counts[i].get(id)||0,after=before+hours;
    const coverage=Number(after>0)-Number(before>0);
    next[i===0?3:4]+=coverage;
    next[i===0?5:6]+=equityGain(before,hours);
   }
   for(const [rows,sign] of [[removed,-1],[added,1]])for(const row of rows){
    next[1]-=sign*slotCost.get(row);
    next[2]+=sign/frequency.get(key(row));
    next[8]-=sign*(last.get(key(row))?Number(last.get(key(row)).date.replaceAll('-','')):0);
   }
   for(const [id,hours] of combos)next[7]+=equityGain(state.combos.get(id)||0,hours);
   const touched=new Set([...months.keys()].flatMap(id=>[id,shiftMonth(id,-1)]));
   for(const id of touched){
    const other=shiftMonth(id,1),a=state.months.get(id)||0,b=state.months.get(other)||0;
    next[9]+=Number(a>0&&b>0)-Number(a+(months.get(id)||0)>0&&b+(months.get(other)||0)>0);
   }
   return next;
  }
  function better(a,b){for(let i=0;i<a.length;i++){if(Math.abs(a[i]-b[i])>1e-9)return a[i]>b[i];}return false;}
  let current=[],occupancy=new Map();
  const index=rows=>new Map(rows.flatMap(r=>resources(r).map(k=>[k,r])));
  const add=(r)=>{current.push(r);resources(r).forEach(k=>occupancy.set(k,r));};
  // Seed in three coverage passes, with scarce choices first and stable ties.
  const seeded=axes.map(()=>new Set());
  for(let priority=0;priority<3;priority++)for(const r of edges){
   if(resources(r).some(k=>occupancy.has(k))) continue;
   if(priority===0&&seeded[0].has(r.teacher))continue;
   if(priority===1&&seeded[1].has(r.section)&&seeded[2].has(r.course))continue;
   add(r);axes.forEach((f,i)=>seeded[i].add(r[f]));
  }
  let state=summarize(history,current);
  let value=evaluateChanges(fixed,new Set(),current,[0,0,0,fixed.counts[0].size,
    fixed.counts[1].size+fixed.counts[2].size,0,0,0,0,0]);
  // Insert a different edge, displace conflicts, then repair through every freed resource.
  // The bounded neighborhood handles both competing starts and displaced combinations.
  for(let pass=0;pass<3;pass++){
   let improved=false;
   for(const edge of edges){
    const blocked=new Set(resources(edge).map(k=>occupancy.get(k)).filter(Boolean));
    if(blocked.has(edge))continue;
    const occupiedAfterRemoval=k=>occupancy.has(k)&&!blocked.has(occupancy.get(k));
    const edgeResources=new Set(resources(edge));
    const alternatives=new Set([...blocked].flatMap(r=>resources(r).flatMap(k=>(byResource.get(k)||[]).slice(0,12))));
    const candidates=[...alternatives].filter(r=>!resources(r).some(k=>occupiedAfterRemoval(k)||edgeResources.has(k))).sort(rank);
    const variants=[[edge]];
    for(const first of candidates.slice(0,8)){
     const added=[edge,first],local=new Set([...edgeResources,...resources(first)]);
     for(const other of candidates){
      if(added.length>=1+blocked.size)break;
      if(resources(other).some(k=>local.has(k)))continue;
      added.push(other);resources(other).forEach(k=>local.add(k));
     }
     variants.push(added);
    }
    let best=null,bestValue=value;
    for(const added of variants){
     const next=evaluateChanges(state,blocked,added,value);
     if(better(next,bestValue)){best=added;bestValue=next;}
    }
    if(best){
     current=current.filter(r=>!blocked.has(r)).concat(best);
     state=summarize(history,current);value=bestValue;occupancy=index(current);improved=true;
    }
   }
   if(!improved)break;
  }
  return extendCoverage(current,byResource,frequency).sort(chronological);
 }
 function completeBlocks(history,consecutive=(a,b)=>b===a+1){
  const ordered=history.slice().sort((a,b)=>compare(a.date,b.date)||a.hour-b.hour);
  const blocks=[];
  for(let i=0;i+1<ordered.length;i++){
   const a=ordered[i],b=ordered[i+1];
   if(a.date!==b.date||b.hour!==a.hour+1||key(a)!==key(b)||!consecutive(a.hour,b.hour))continue;
   blocks.push({...a,h1:a.hour,h2:b.hour});i++;
  }
  return blocks;
 }
 function readExclusions(value){
  const result={};
  if(!value||typeof value!=='object'||Array.isArray(value))return result;
  for(const [year,rows] of Object.entries(value)){
   if(!/^\d{4}$/.test(year)||!Array.isArray(rows))continue;
   const accepted=new Map();
   for(const row of rows){
    if(typeof row?.id!=='string'||typeof row.reason!=='string'||!row.reason.trim()||
       row.reason.length>240||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))||row.by!=='pip')continue;
    accepted.set(row.id,{id:row.id,reason:row.reason.trim(),at:row.at,by:row.by});
   }
   if(accepted.size)result[year]=[...accepted.values()];
  }
  return result;
 }
 function rounds(target,blocks){
  const universe=new Set(target),pending=new Set(universe),completed=[],credits=new Map(),anomalies=[],complete=new Map();
  let start=null;
  for(const row of blocks.slice().sort(chronological)){
   const id=key(row);
   count(complete,id);
   if(!inSchoolYear(row)||!universe.has(id))continue;
   if(!pending.delete(id)){anomalies.push({row,round:completed.length+1});continue;}
   start ||= row;
   credits.set(blockId(row),{row,round:completed.length+1});
   if(pending.size===0){
    completed.push({start,close:row});
    start=null;
    for(const combination of universe)pending.add(combination);
   }
  }
  return {completed,credits,anomalies,complete,pending,start,target:universe};
 }
 function solve({history,opportunities,target,consecutive}){
  const universe=new Set(target),preserved=completeBlocks(history,consecutive).filter(inSchoolYear);
  const schoolOpportunities=opportunities.filter(inSchoolYear);
  const rows=[],calendar=history.slice(),last=new Map();
  let close=null;
  while(universe.size){
   const existing=preserved.filter(row=>startsAfter(row,close)&&universe.has(key(row)));
   const eligible=schoolOpportunities.filter(row=>startsAfter(row,close)&&universe.has(key(row)));
   const ends=[...new Set([...existing,...eligible].map(endSlot))].sort(compare);
   if(!ends.length)break;
   function propose(end){
    const within=row=>compare(endSlot(row),end)<=0;
    const first=new Map();
    for(const row of existing)if(within(row)&&!first.has(key(row)))first.set(key(row),row);
    const proposed=optimize(calendar,eligible.filter(row=>within(row)&&!first.has(key(row))),last);
    const covered=[...first.values(),...proposed].sort(chronological);
    return {proposed,covered};
   }
   let choice=propose(ends.at(-1));
   if(!choice.covered.length)break;
   // Seek the earliest prefix with the best coverage found, even if a round
   // stays open. Every accepted prefix preserves or improves that coverage.
   let lo=choice.covered.length-1,hi=ends.indexOf(endSlot(choice.covered.at(-1)))-1;
   while(lo<=hi){
    const mid=Math.floor((lo+hi)/2),candidate=propose(ends[mid]);
    if(candidate.covered.length<choice.covered.length){lo=mid+1;continue;}
    choice=candidate;hi=ends.indexOf(endSlot(choice.covered.at(-1)))-1;
   }
   for(const row of choice.proposed){
    rows.push(row);calendar.push({...row,hour:row.h1},{...row,hour:row.h2});
   }
   if(choice.covered.length!==universe.size)break;
   for(const row of choice.covered)last.set(key(row),row);
   close=choice.covered.at(-1);
  }
  return rows.sort(chronological);
 }
 function adjacentMonths(months){
  const groups=new Map(),out=[];
  for(const [entry,hours] of months){
   if(!hours)continue;
   const m=entry.slice(0,7),combo=entry.slice(8);
   if(!groups.has(combo))groups.set(combo,[]);
   groups.get(combo).push(m);
  }
  for(const [combo,dates] of groups) {
   dates.sort();
   for(let i=1;i<dates.length;i++)if(serial(dates[i])-serial(dates[i-1])===1)out.push({combo,previous:dates[i-1],month:dates[i]});
  }
  return out;
 }
 function validate({history,opportunities,target,consecutive,protectedBlocks=[]},rows){
  const allowed=new Set(opportunities.map(blockId));
  const used=new Set(history.map(r=>cell(r.date,r.hour)));
  const months=summarize(history,[]).months;
  for(const r of rows){
   if(!inSchoolYear(r))throw new Error('El bloque está fuera del periodo escolar de marzo a diciembre.');
   if(!allowed.has(blockId(r))||r.h2!==r.h1+1||(consecutive&&!consecutive(r.h1,r.h2))||
      used.has(cell(r.date,r.h1))||used.has(cell(r.date,r.h2))||(months.get(monthly(r))||0)+2>2){
    throw new Error('La propuesta contiene un bloque no disponible o supera el límite mensual.');
   }
   used.add(cell(r.date,r.h1));used.add(cell(r.date,r.h2));count(months,monthly(r),2);
  }
  const state=rounds(target,[...completeBlocks(history,consecutive),...rows]);
  if(rows.some(r=>!state.credits.has(blockId(r))))throw new Error('La propuesta repite una combinación o adelanta una ronda.');
  const affected=new Set(protectedBlocks.filter(id=>!state.credits.has(id)).map(id=>JSON.parse(id)[0].slice(0,7)));
  if(affected.size)throw new Error('La regeneración interrumpe una ronda de un mes posterior. Incluye estos meses en la regeneración conjunta: '+[...affected].sort(compare).join(', ')+'.');
  return {...summarize(history,rows),rounds:state};
 }
 const api={key,month,monthly,compare,schoolMonth,solve,validate,summarize,adjacentMonths,completeBlocks,rounds,readExclusions};
 root.IEAipDistribucion=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
