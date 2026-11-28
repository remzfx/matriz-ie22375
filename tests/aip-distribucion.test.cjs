'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const motor=require('../aip-distribucion.js'),stats=require('../aip-estadisticas.js');
const edge=(date,h1,teacher,course='MAT',section='1A')=>({date,h1,h2:h1+1,teacher,course,section});
const hour=(date,h,teacher,course='MAT',section='1A')=>({...edge(date,h,teacher,course,section),hour:h});
const targetOf=(...rows)=>rows.map(motor.key);
const pair=(date,h,teacher,course,section)=>[hour(date,h,teacher,course,section),hour(date,h+1,teacher,course,section)];
const run=(history,opportunities,target=targetOf(...opportunities))=>{const input={history,opportunities,target},rows=motor.solve(input);motor.validate(input,rows);return rows;};

test('the preview timetable has stable course-section owners and no teacher crossings',()=>{
 const timetable=require('./fixtures/aip-horario-realista.cjs');
 const owners=new Map(),teachers=new Map();
 for(const shifts of Object.values(timetable))for(const slot of Object.values(shifts)){
  const available=new Set();
  for(const [section,{area,doc,docenteId}] of Object.entries(slot)){
   assert.equal(available.has(docenteId),false,'simultaneous assignment for '+doc);
   available.add(docenteId);
   const key=area+'|'+section;
   if(owners.has(key))assert.equal(owners.get(key),docenteId,key+' changes teacher');
   owners.set(key,docenteId);
   if(!teachers.has(docenteId))teachers.set(docenteId,{courses:new Set(),sections:new Set()});
   teachers.get(docenteId).courses.add(area);teachers.get(docenteId).sections.add(section);
  }
 }
 assert.equal(owners.size,54);
 assert.equal(owners.get('CCSS|5U'),'fixture-03');
 assert.ok([...teachers.values()].some(t=>t.courses.size>1&&t.sections.size>1));
});

test('repair recovers the known two-teacher optimum across overlapping starts',()=>{
 const edges=[edge('2026-03-02',1,'A'),edge('2026-03-02',2,'B'),edge('2026-03-03',1,'A')];
 const rows=run([],edges);
 assert.deepEqual(rows.map(x=>[x.teacher,x.date]),[['B','2026-03-02'],['A','2026-03-03']]);
 assert.deepEqual(run([],edges.slice().reverse()),rows);
});
test('also improves a seed where a scarce course occupies the only viable starting pair of another teacher',()=>{
 const edges=[edge('2026-03-02',1,'A'),edge('2026-03-02',2,'B'),edge('2026-03-03',1,'A'),edge('2026-03-02',1,'B')];
 const result=run([],edges);
 assert.equal(new Set(result.map(x=>x.teacher)).size,2);
});
test('past and future history count before choosing a teacher and curricular combination',()=>{
 const history=[hour('2026-03-02',1,'A'),hour('2026-05-04',1,'B','COM','1B')];
 const edges=[edge('2026-04-01',1,'A'),edge('2026-04-01',1,'B','COM','1B'),edge('2026-04-01',1,'C','CYT','2A')];
 assert.equal(run(history,edges)[0].teacher,'C');
 const pairs=[edge('2026-04-02',1,'A','MAT','1A'),edge('2026-04-02',1,'A','CYT','2A')];
 assert.equal(run(history,pairs)[0].course,'CYT');
});
test('three opportunities in one month yield at most two hours even across multiple sections of one teacher',()=>{
 const dates=['2026-03-02','2026-03-09','2026-03-16'];
 const edges=dates.flatMap(date=>[edge(date,1,'A'),edge(date,3,'A','MAT','2A')]);
 const rows=run([],edges);
 assert.equal(rows.length,2);
 assert.equal(new Set(rows.map(motor.key)).size,2);
 assert.equal(run([hour(dates[0],7,'A')],edges).every(x=>x.section==='2A'),true);
 const manual=[3,4,5].map(h=>hour(dates[0],h,'A'));
 assert.equal(run(manual,edges).every(x=>x.section==='2A'),true);
});
test('rotates when alternatives exist and reports adjacent months already programmed',()=>{
 const history=[...pair('2026-03-02',1,'A'),...pair('2026-05-04',1,'A')];
 const repeat=edge('2026-04-03',1,'A'), other=edge('2026-04-03',1,'B','MAT','1A');
 assert.equal(run(history,[repeat,other])[0].teacher,'B');
 const rows=run(history,[repeat],targetOf(repeat,other));
 assert.equal(rows.length,0,'an open round cannot accredit a repeated combination');
 assert.equal(motor.adjacentMonths(motor.summarize(history.concat(hour('2026-04-03',1,'A')),[]).months).length,2);
});
test('spare capacity goes to the less served teacher without reducing coverage',()=>{
 const history=[
  hour('2026-01-05',1,'A'),hour('2026-01-05',2,'A'),
  hour('2026-03-02',1,'A'),hour('2026-03-02',2,'A'),
  hour('2026-03-02',3,'B'),hour('2026-03-02',4,'B')
 ];
 const opportunities=['A','B'].map(teacher=>edge('2026-05-04',1,teacher));
 const rows=run(history,opportunities);
 assert.deepEqual(rows.map(r=>r.teacher),['B']);
 const summary=motor.summarize(history,rows);
 assert.deepEqual(summary.counts.map(m=>m.size),[2,1,1]);
 assert.deepEqual([...summary.counts[0].values()],[4,4]);
 assert.deepEqual(run(history,[...opportunities].reverse()),rows);
});
test('spare allocation rebalances after each consecutive choice',()=>{
 const history=[...pair('2026-01-05',1,'A'),...pair('2026-01-05',3,'B')];
 const opportunities=['2026-03-02','2026-05-04','2026-07-06','2026-09-07']
  .flatMap(date=>['A','B'].map(teacher=>edge(date,1,teacher)));
 const rows=run(history,opportunities);
 assert.deepEqual(rows.map(r=>r.teacher),['A','B','A','B']);
 assert.deepEqual(run(history,[...opportunities].reverse()),rows);
});
test('course, section and combination totals resolve equivalent spare choices',()=>{
 const date='2026-05-04';
 for(const [left,right] of [[['COM','1A'],['MAT','1A']],[['COM','1A'],['COM','2A']]]){
  const history=[1,2,3,4].map(h=>hour('2026-01-05',h,'A',...left)).concat(pair('2026-02-02',1,'A',...right));
  assert.deepEqual(run(history,[edge(date,1,'A',...left),edge(date,1,'A',...right)]),[edge(date,1,'A',...right)]);
 }
 const history=[
  ...pair('2026-01-05',1,'A','COM','1A'),...pair('2026-01-05',3,'A','COM','1A'),
  ...pair('2026-02-02',1,'A','MAT','2A'),...pair('2026-02-02',3,'B','MAT','2A')
 ];
 assert.deepEqual(run(history,[edge(date,1,'A','COM','1A'),edge(date,1,'A','MAT','2A')]),[edge(date,1,'A','MAT','2A')]);
});
test('statistics classify monthly excesses by actual source and keep opportunities separate',()=>{
 const history=[];
 for(const [date,teacher,manuals] of [
  ['2026-03-02','A',[true,true,true]],['2026-03-03','B',[false,false,false]],['2026-03-04','C',[true,false,false]]
 ]){
  manuals.forEach((manual,i)=>history.push({...hour(date,i+1,teacher),manual}));
 }
 const catalog=['A','B','C'].map(teacher=>edge('2026-03-06',1,teacher));
 const result=stats.report({catalog,history,opportunities:catalog.slice(0,1),from:'2026-03',to:'2026-03'});
 assert.deepEqual(result.matrix.map(x=>x.excesses['2026-03']),[
  {hours:3,manual:3,inherited:0},{hours:3,manual:0,inherited:3},{hours:3,manual:1,inherited:2}
 ]);
 assert.equal(result.hours,9);
 assert.equal(result.measures[3].compatible,1);
});
test('validate rejects reused hours, forged slots and over-cap proposals',()=>{
 const a=edge('2026-03-02',1,'A'), b=edge('2026-03-02',2,'B'), c=edge('2026-03-03',1,'A');
 const input={history:[],opportunities:[a,b,c],target:targetOf(a,b,c)};
 for(const rows of [[a,b],[a,c],[{...a,course:'CX'}]])assert.throws(()=>motor.validate(input,rows),/límite|disponible/);
});
test('an augmenting chain moves occupied pairs and recovers the eighth combination',()=>{
 const {dates,starts,slots,sections}=require('./fixtures/aip-cadena-reasignacion.cjs');
 const opportunities=slots.flatMap((indices,i)=>indices.map(j=>edge(dates[j],starts[j],'D'+i,'MAT',sections[i])));
 const target=targetOf(...opportunities),rows=run([],opportunities,target);
 const round=motor.rounds(target,rows);
 assert.equal(rows.length,8);
 assert.equal(round.completed.length,1);
 assert.deepEqual(run([],opportunities.slice().reverse(),target),rows);
});
test('an impossible C keeps the round open while A and B use March opportunities',()=>{
 const dates=['2026-03-16','2026-03-23','2026-04-06','2026-05-04'];
 const opportunities=dates.flatMap(date=>['A','B'].map(teacher=>edge(date,1,teacher)));
 const target=targetOf(...opportunities.slice(0,2),edge(dates[0],3,'C'));
 const rows=run([],opportunities,target);
 assert.deepEqual(rows.map(r=>r.date),dates.slice(0,2));
 assert.deepEqual(run([],opportunities.slice().reverse(),target),rows);
 const state=motor.rounds(target,rows);
 assert.equal(state.completed.length,0);
 assert.deepEqual([...state.pending],[target[2]]);
});
test('an earlier opportunity yields when it would reduce coverage, and incompatible March is skipped',()=>{
 const earlyA=edge('2026-03-16',1,'A'),onlyB=edge('2026-03-16',2,'B'),laterA=edge('2026-04-06',1,'A');
 const latestA=edge('2026-05-04',1,'A'),impossibleC=edge('2026-05-04',3,'C');
 const rows=run([],[earlyA,onlyB,laterA,latestA],targetOf(earlyA,onlyB,impossibleC));
 assert.deepEqual(rows,[onlyB,laterA]);
 const input={history:[hour(earlyA.date,1,'Z')],opportunities:[earlyA,laterA,latestA],target:targetOf(earlyA)};
 const plan=run(input.history,input.opportunities,input.target);
 assert.deepEqual(plan,[laterA,latestA]);
 assert.equal(motor.validate(input,plan).rounds.completed[0].close.date,laterA.date);
});
test('January and February retain their hours without accrediting the school-year round',()=>{
 const past=[...pair('2026-01-05',1,'A'),...pair('2026-02-09',1,'B')];
 const extra=[edge('2026-02-16',1,'A'),edge('2026-03-16',1,'A'),edge('2026-04-06',1,'A')];
 const target=targetOf(past[0],past[2]),input={history:past,opportunities:extra,target};
 const selected=run(past,extra,target),result=motor.validate(input,selected);
 assert.deepEqual(selected,[extra[1]]);
 assert.equal(result.rounds.completed.length,0);
 assert.equal(result.rounds.pending.has(target[1]),true);
 assert.deepEqual([...result.counts[0].values()],[4,2]);
 assert.throws(()=>motor.validate(input,[extra[0]]),/periodo escolar/);
});
test('60 of 60 opens another round after the last June block, even on the same date',()=>{
 const dates=['03','04','05','06'], all=Array.from({length:60},(_,i)=>edge('2026-'+dates[Math.floor(i/15)]+'-'+String(i%15+1).padStart(2,'0'),1,'T'+i));
 const again=edge('2026-06-15',3,'T0'),tooSoon=edge('2026-06-15',1,'T0');
 const target=targetOf(...all);
 const rows=run([],all.concat(again,tooSoon),target);
 const state=motor.rounds(target,rows);
 assert.equal(rows.length,61);
 assert.equal(state.completed.length,1);
 assert.deepEqual(state.completed[0].close,all.at(-1));
 assert.deepEqual(state.start,again);
 assert.equal(state.pending.size,59);
 const incomplete=run([],all.slice(0,-1).concat(again,tooSoon),target);
 assert.equal(incomplete.length,59);
 assert.equal(motor.rounds(target,incomplete).completed.length,0);
});
test('future history and an isolated hour cannot open a round earlier',()=>{
 const old=[...pair('2026-03-02',1,'A'),hour('2026-04-01',1,'B'),...pair('2026-08-18',3,'B')];
 const premature=edge('2026-08-10',1,'A'),sameDayEarly=edge('2026-08-18',1,'A'),eligible=edge('2026-08-18',5,'A');
 const target=targetOf(eligible,edge('2026-08-18',3,'B'));
 const opportunities=[premature,sameDayEarly,eligible];
 const rows=run(old,opportunities,target);
 assert.deepEqual(rows,[eligible]);
 assert.throws(()=>motor.validate({history:old,opportunities,target},[premature]),/adelanta/);
});
test('incompatible combinations remain pending until an explicit valid exclusion',()=>{
 const opportunities=[edge('2026-03-02',1,'A'),edge('2026-04-06',1,'A'),edge('2026-05-04',1,'A')];
 const blocked=edge('2026-03-02',3,'B'),catalog=targetOf(opportunities[0],blocked);
 assert.equal(run([],opportunities,catalog).length,1);
 const entry={id:motor.key(blocked),reason:'No hay dos horas consecutivas',at:'2026-02-15T10:00:00Z',by:'pip'};
 const approvals=motor.readExclusions({2025:[entry],2026:[{...entry,by:'admin'},entry]});
 assert.deepEqual(approvals[2026],[entry]);
 assert.equal(run([],opportunities,catalog.filter(id=>!approvals[2026].some(r=>r.id===id))).length,3);
 assert.equal(run([],opportunities,catalog).length,1);
});
test('history credits complete adjacent blocks, reports duplicates, and keeps partial hours for capacity',()=>{
 const history=[...pair('2026-03-02',1,'A'),...pair('2026-03-09',1,'A'),
  hour('2026-03-12',1,'B'),hour('2026-03-13',2,'B'),...pair('2026-04-06',2,'B'),...pair('2026-05-04',4,'B')];
 const blocks=motor.completeBlocks(history,(a,b)=>b===a+1&&a!==2),target=targetOf(history[0],history.at(-1));
 const state=motor.rounds(target,blocks);
 assert.equal(state.completed.length,1);
 assert.equal(state.completed[0].close.date,'2026-05-04');
 assert.equal(state.anomalies.length,1);
 assert.equal(state.complete.get(motor.key(history[0])),2);
 assert.equal(motor.summarize(history,[]).months.get(motor.monthly(history[4])),2);
});
test('never starts another round before completion and has no fixed round count',()=>{
 const candidates=Array.from({length:10},(_,i)=>edge('2026-'+String(i+3).padStart(2,'0')+'-05',1,'A'));
 const target=targetOf(candidates[0]);
 const rows=run([],candidates,target);
 assert.equal(motor.rounds(target,rows).completed.length,10);
 assert.deepEqual(run([],candidates.slice().reverse(),target),rows);
 const june=edge('2026-06-12',1,'A'), sameMonth=edge('2026-06-19',1,'A'), july=edge('2026-07-03',1,'A');
 assert.deepEqual(run([],[june,sameMonth,july],target),[june,july]);
});
test('rejects a regeneration that would invalidate an accredited block in another month',()=>{
 const a=edge('2026-03-02',1,'A'),b=edge('2026-04-06',1,'B'),later=edge('2026-05-04',1,'B');
 const target=targetOf(a,b),history=[...pair(b.date,1,'B'),...pair(later.date,1,'B')];
 const previous=motor.rounds(target,motor.completeBlocks(pair(a.date,1,'A').concat(history)));
 const protectedBlocks=[...previous.credits].filter(([,credit])=>credit.row.date>=b.date).map(([id])=>id);
 assert.throws(()=>motor.validate({history,opportunities:[],target,protectedBlocks},[]),/mes posterior.*2026-05/);
 assert.equal(motor.validate({history,opportunities:[a],target,protectedBlocks},[a]).rounds.completed.length,1);
});
test('fallback causes follow the round at each block, including same-day closure',()=>{
 const a=edge('2026-03-16',1,'A'),b=edge('2026-03-16',5,'B'),c=edge('2026-03-16',7,'C');
 const target=targetOf(a,b),state=motor.rounds(target,[a,b]);
 const offered=[edge(a.date,3,'A'),c,edge(a.date,9,'A'),edge('2026-04-06',1,'A')];
 const alternatives=[...offered,edge(a.date,11,'A'),{date:a.date,h1:13}].reverse();
 assert.deepEqual(stats.unusedBlocks(state,new Map([[motor.monthly(a),2]]),offered,alternatives).map(x=>x.reason),[
  'Candidatos ya acreditados en la ronda activa','Candidatos excluidos por el PIP','Límite mensual comprometido',
  'Sin candidato compatible para el bloque','Sin segundo tramo libre y consecutivo','Oportunidad compatible sin asignar en la búsqueda'
 ]);
});
test('statistics reconcile teacher, course, section and yearly matrix directly from plan rows',()=>{
 const a=edge('2026-03-02',1,'A'), b=edge('2026-04-02',1,'B','COM','2A'), c=edge('2026-04-02',1,'C','COM','2A');
 const history=[hour(a.date,1,'A'),hour(a.date,2,'A'),hour('2026-04-06',1,'A')];
 const input={history,catalog:[a,b,c],opportunities:[a,b],from:'2026-03',to:'2026-03'};
 const report=stats.report(input);
 assert.deepEqual(report.measures[0],{total:3,attended:1,pending:2,compatible:1,compatibleAttended:1});
 assert.deepEqual(report.tables.map(table=>table[0].hours),[2,2,2]);
 assert.equal(report.tables[0][0].blocks,1);
 assert.equal(report.tables[0][0].next,'2026-04-06');
 assert.deepEqual(report.matrix[0].months,{'2026-03':2,'2026-04':1});
 assert.deepEqual(report.matrix[0].repeats,['2026-04']);
 assert.equal(stats.report({...input,history:history.slice(2)}).matrix[0].annual,1);
 assert.equal(stats.report({...input,filter:{teacher:'B'}}).measures[0].pending,1);
});
test('exact AIP precache extension keeps the historical comparison sensitive to other edits',()=>{
 const source=fs.readFileSync('sw.js','utf8'),boundary=require('./academic-reset-boundary.cjs');
 for(const resource of ['aula_innovacion.html','aip-colegiado.js','aip-distribucion.js','aip-estadisticas.js', 'aip-paquete.js'])assert.ok(source.includes("'./"+resource+"'"));
 assert.notEqual(boundary('sw.js',source.replace('./aip-distribucion.js','./other.js')),boundary('sw.js',source));
});

test('an annual plan above the cell limit round-trips through a bounded compact envelope',async()=>{
 const pack=require('../aip-paquete.js');
 const original={plan:Object.fromEntries(Array.from({length:1200},(_,i)=>['date-'+i,{sec:{1:{tipo:'grupo',texto:'Área ficticia · docente de prueba 17'}}}]))};
 assert.ok(JSON.stringify(original).length>pack.limit);
 const encoded=await pack.encode(original);
 assert.equal(encoded.aipEncoding,'gzip-base64-v1');
 assert.ok(JSON.stringify(encoded).length<=pack.limit);
 assert.deepEqual(await pack.decode(encoded),original);
 const old={plan:{}};
 assert.equal(await pack.encode(old),old);
 assert.equal(await pack.decode(old),old);
 await assert.rejects(pack.decode({...encoded,data:'invalid!!'}),/no compatible/);
});
