'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const motor=require('../aip-distribucion.js'),stats=require('../aip-estadisticas.js');
const edge=(date,h1,teacher,course='MAT',section='1A')=>({date,h1,h2:h1+1,teacher,course,section});
const hour=(date,h,teacher,course='MAT',section='1A')=>({...edge(date,h,teacher,course,section),hour:h});
const run=(history,opportunities)=>{const input={history,opportunities},rows=motor.solve(input);motor.validate(input,rows);return rows;};

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
 const history=[hour('2026-03-02',1,'A'),hour('2026-05-04',1,'A')];
 const repeat=edge('2026-04-03',1,'A'), other=edge('2026-04-03',1,'B','MAT','1A');
 assert.equal(run(history,[repeat,other])[0].teacher,'B');
 const rows=run(history,[repeat]);
 assert.equal(rows.length,0,'spare time does not justify repeating an already covered combination');
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
 const history=[hour('2026-01-05',1,'A'),hour('2026-01-05',3,'B')];
 const opportunities=['2026-03-02','2026-05-04','2026-07-06','2026-09-07']
  .flatMap(date=>['A','B'].map(teacher=>edge(date,1,teacher)));
 const rows=run(history,opportunities);
 assert.deepEqual(rows.map(r=>r.teacher),['A','B','A','B']);
 assert.deepEqual(run(history,[...opportunities].reverse()),rows);
});
test('course, section and combination totals resolve equivalent spare choices',()=>{
 const date='2026-05-04';
 for(const [left,right] of [[['COM','1A'],['MAT','1A']],[['COM','1A'],['COM','2A']]]){
  const history=[1,2,3].map(h=>hour('2026-01-05',h,'A',...left)).concat(hour('2026-02-02',1,'A',...right));
  assert.deepEqual(run(history,[edge(date,1,'A',...left),edge(date,1,'A',...right)]),[edge(date,1,'A',...right)]);
 }
 const history=[
  hour('2026-01-05',1,'A','COM','1A'),hour('2026-01-05',2,'A','COM','1A'),
  hour('2026-02-02',1,'A','MAT','2A'),hour('2026-02-02',2,'B','MAT','2A')
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
 const input={history:[],opportunities:[a,b,c]};
 for(const rows of [[a,b],[a,c],[{...a,course:'CX'}]])assert.throws(()=>motor.validate(input,rows),/límite|disponible/);
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
