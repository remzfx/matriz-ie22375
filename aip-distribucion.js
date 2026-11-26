/* Pure annual allocation. The calendar adapter owns timetable and reservation rules. */
(function(root){
 'use strict';
 const key=(r)=>JSON.stringify([r.teacher,r.course,r.section]);
 const month=r=>r.date.slice(0,7);
 const monthly=r=>month(r)+'|'+key(r);
 const cell=(date,hour)=>date+'|'+hour;
 const compare=(a,b)=>String(a)<String(b)?-1:String(a)>String(b)?1:0;
 const serial=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7));
 const axes=['teacher','section','course'];
 function count(map,k,n=1){map.set(k,(map.get(k)||0)+n);}
 function summarize(history,selected){
  const counts=axes.map(()=>new Map()),combos=new Map(),months=new Map();
  function add(r,hours){
   axes.forEach((field,i)=>count(counts[i],r[field],hours));
   count(combos,key(r),hours);count(months,monthly(r),hours);
  }
  history.forEach(r=>add(r,1));selected.forEach(r=>add(r,2));
  return {counts,combos,months};
 }
 function shiftMonth(id,offset){
  const index=serial(id)+offset-1,y=Math.floor(index/12),m=index%12+1;
  return y+'-'+String(m).padStart(2,'0')+id.slice(7);
 }
 function resources(r){return [cell(r.date,r.h1),cell(r.date,r.h2),monthly(r)];}
 function solve({history,opportunities}){
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
    compare(a.date,b.date)||a.h1-b.h1||compare(key(a),key(b));
  }
  edges.sort(rank);
  for(const list of byResource.values())list.sort(rank);
  function evaluateChanges(state,removed,added,base){
   const changes=axes.map(()=>new Map()),combos=new Map(),months=new Map();
   function move(rows,delta){
    for(const r of rows){
     axes.forEach((field,i)=>count(changes[i],r[field],delta));
     count(combos,key(r),delta);count(months,monthly(r),delta);
    }
   }
   move(removed,-2);move(added,2);
   const next=base.slice();
   for(const [i,delta] of changes.entries())for(const [id,hours] of delta){
    const before=state.counts[i].get(id)||0,after=before+hours;
    const coverage=Number(after>0)-Number(before>0);
    next[i===0?0:1]+=coverage;
    if(i===0&&!fixed.counts[0].has(id)) next[3]+=coverage/(teacherFrequency.get(id)||1);
    next[4]+=(i===0?2:1)*(Math.log1p(after)-Math.log1p(before));
   }
   for(const [combo,hours] of combos){
    const before=state.combos.get(combo)||0,coverage=Number(before+hours>0)-Number(before>0);
    next[2]+=coverage;
    if(!fixed.combos.has(combo))next[3]+=coverage/(frequency.get(combo)||1);
   }
   const touched=new Set([...months.keys()].flatMap(id=>[id,shiftMonth(id,-1)]));
   for(const id of touched){
    const other=shiftMonth(id,1),a=state.months.get(id)||0,b=state.months.get(other)||0;
    next[5]+=Number(a>0&&b>0)-Number(a+(months.get(id)||0)>0&&b+(months.get(other)||0)>0);
   }
   next[6]+=added.length-removed.size;
   return next;
  }
  function better(a,b){for(let i=0;i<a.length;i++){if(Math.abs(a[i]-b[i])>1e-9)return a[i]>b[i];}return false;}
  let current=[],occupancy=new Map();
  const index=rows=>new Map(rows.flatMap(r=>resources(r).map(k=>[k,r])));
  const add=(r)=>{current.push(r);resources(r).forEach(k=>occupancy.set(k,r));};
  // Seed in three coverage passes, with scarce choices first and stable ties.
  const seeded=axes.map((_,i)=>new Set(fixed.counts[i].keys())),seedCombos=new Set(fixed.combos.keys());
  for(let priority=0;priority<3;priority++)for(const r of edges){
   if(resources(r).some(k=>occupancy.has(k))) continue;
   if(priority===0&&seeded[0].has(r.teacher))continue;
   if(priority===1&&seeded[1].has(r.section)&&seeded[2].has(r.course))continue;
   if(priority===2&&seedCombos.has(key(r)))continue;
   add(r);axes.forEach((f,i)=>seeded[i].add(r[f]));seedCombos.add(key(r));
  }
  let state=summarize(history,current);
  let value=evaluateChanges(fixed,new Set(),current,[fixed.counts[0].size,
    fixed.counts[1].size+fixed.counts[2].size,fixed.combos.size,0,0,-adjacentMonths(fixed.months).length,0]);
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
     // Expanding the core must buy coverage; spare capacity is handled independently.
     if(added.length>blocked.size&&!better(next.slice(0,3),value.slice(0,3)))continue;
     if(better(next,bestValue)){best=added;bestValue=next;}
    }
    if(best){
     current=current.filter(r=>!blocked.has(r)).concat(best);
     state=summarize(history,current);value=bestValue;occupancy=index(current);improved=true;
    }
   }
   if(!improved)break;
  }
  // Fill spare time only when it does not add consecutive-month repetition.
  // The coverage passes above may repeat if necessary to cover someone.
  for(const edge of edges){
   const id=monthly(edge);
   if(resources(edge).some(k=>occupancy.has(k))||state.months.has(shiftMonth(id,-1))||state.months.has(shiftMonth(id,1)))continue;
   add(edge);count(state.months,id,2);
  }
  return current.sort((a,b)=>compare(a.date,b.date)||a.h1-b.h1||compare(key(a),key(b)));
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
 function validate({history,opportunities},rows){
  const allowed=new Set(opportunities.map(r=>JSON.stringify([r.date,r.h1,r.h2,key(r)])));
  const used=new Set(history.map(r=>cell(r.date,r.hour)));
  const months=summarize(history,[]).months;
  for(const r of rows){
   if(!allowed.has(JSON.stringify([r.date,r.h1,r.h2,key(r)]))||r.h2!==r.h1+1||
      used.has(cell(r.date,r.h1))||used.has(cell(r.date,r.h2))||(months.get(monthly(r))||0)+2>2){
    throw new Error('La propuesta contiene un bloque no disponible o supera el límite mensual.');
   }
   used.add(cell(r.date,r.h1));used.add(cell(r.date,r.h2));count(months,monthly(r),2);
  }
  return summarize(history,rows);
 }
 const api={key,month,monthly,compare,solve,validate,summarize,adjacentMonths};
 root.IEAipDistribucion=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
