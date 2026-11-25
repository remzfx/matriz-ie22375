'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../aip-colegiado.js');

const base={id:'prueba',name:'Colegiado ficticio',active:true,mode:'rotativo',start:'2026-12-21',end:'2027-01-31',levels:['pri','sec'],day:0,hours:{pri:{all:[1,2]},sec:{all:[5,6]}},include:[],exclude:[]};
const occurrences=(rule,level)=>model.dates(rule).filter(d=>model.hoursOn(rule,d,level).length);
test('rotación estable de lunes a viernes y retorno al lunes entre meses y años',()=>{
 assert.deepEqual(occurrences(base,'pri'),['2026-12-21','2026-12-29','2027-01-06','2027-01-14','2027-01-22','2027-01-25']);
 assert.deepEqual(occurrences({...base,day:3},'sec'),['2026-12-24','2027-01-01','2027-01-04','2027-01-12','2027-01-20','2027-01-28']);
 const truncated={...base,start:'2026-12-23'};
 assert.equal(occurrences(truncated,'pri')[0],'2026-12-29');
});
test('diario y semanal fijo con horas independientes por nivel',()=>{
 const daily={...base,mode:'diario',end:'2026-12-27'};
 assert.equal(occurrences(daily,'pri').length,5);
 assert.deepEqual(model.hoursOn(daily,'2026-12-21','pri'),[1,2]);
 assert.deepEqual(model.hoursOn(daily,'2026-12-21','sec'),[5,6]);
 assert.deepEqual(occurrences({...base,mode:'semanal',day:2,end:'2027-01-07'},'sec'),['2026-12-23','2026-12-30','2027-01-06']);
});
test('personalizado une horas específicas sin duplicar y da prioridad a exclusiones',()=>{
 const custom={...base,levels:['pri'],mode:'personalizado',hours:{pri:{0:[1],2:[3],extra:[1,2]}},include:['2026-12-21','2026-12-24'],exclude:['2026-12-23']};
 assert.equal(model.validate(custom),'');
 assert.deepEqual(model.hoursOn(custom,'2026-12-21','pri'),[1,2]);
 assert.deepEqual(model.hoursOn(custom,'2026-12-24','pri'),[1,2]);
 assert.deepEqual(model.hoursOn(custom,'2026-12-23','pri'),[]);
 assert.deepEqual(model.hoursOn(custom,'2026-12-21','sec'),[]);
});
test('valida estructura, fechas, niveles, recreo, duplicados de ID y disponibilidad horaria',()=>{
 const invalid=[{start:'2026-02-30'},{end:'2025-01-01'},{day:5},{mode:'otro'},{levels:['ambos']},{hours:{pri:{all:['R']}}},{include:['2026-12-26']},{times:{pri:{1:'incorrecto'}}}];
 for(const change of invalid)assert.equal(model.read([{...base,...change}]),null);
 assert.equal(model.read([base,{...base}]),null);
 assert.equal(model.read([]).length,0);
 assert.equal(model.read([base])[0],base);
 assert.match(model.validate(base,{pri:[[1,'08:00']],sec:[[5,'15:00'],[6,'16:00']]}),/horas pedagógicas/);
});

const dailyHours={pri:{0:[1],1:[2],2:[3],3:[4],4:[5]},sec:{0:[7],1:[6],2:[5],3:[4],4:[3]}};
test('rotativo usa horas independientes y recupera lunes original tras cinco semanas, entre años',()=>{
 const rule={...base,hours:dailyHours};
 assert.equal(model.validate(rule),'');
 const dates=occurrences(rule,'pri');
 assert.deepEqual(dates,occurrences(base,'pri'));
 for(const date of dates)for(const level of rule.levels)
  assert.deepEqual(model.hoursOn(rule,date,level),dailyHours[level][model.calendarDay(date).weekday]);
 assert.deepEqual(model.hoursOn(rule,'2027-01-25','pri'),[1]);
});
test('rotación iniciada en cada día y con inicio de periodo a mitad de semana conserva secuencia',()=>{
 for(let day=0;day<5;day++){
  const rule={...base,day,hours:dailyHours};
  assert.deepEqual(occurrences(rule,'pri'),occurrences({...base,day},'pri'));
  for(const date of occurrences(rule,'pri'))assert.deepEqual(model.hoursOn(rule,date,'sec'),dailyHours.sec[model.calendarDay(date).weekday]);
 }
 const truncated={...base,start:'2026-12-23',hours:dailyHours};
 assert.deepEqual(occurrences(truncated,'pri'),occurrences({...base,start:'2026-12-23'},'pri'));
});
test('diario resuelve cada nivel y día sin heredar horas de otros días, conserva vacíos',()=>{
 const rule={...base,mode:'diario',hours:structuredClone(dailyHours)};
 for(const date of model.dates(rule))for(const level of rule.levels)
  assert.deepEqual(model.hoursOn(rule,date,level),dailyHours[level][model.calendarDay(date).weekday]);
 rule.hours.pri[1]=[];delete rule.hours.sec[1];
 assert.deepEqual(model.hoursOn(rule,'2026-12-22','pri'),[]);
 assert.deepEqual(model.hoursOn(rule,'2026-12-22','sec'),[]);
 assert.deepEqual(model.hoursOn(rule,'2026-12-26','pri'),[]);
});
test('rechaza recreo, días inválidos y mezcla ambigua all/días; conserva semanal y personalizado',()=>{
 for(const mode of ['diario','rotativo']){
  for(const rows of [{0:['R']},{5:[1]},{0:[1],all:[2]},{extra:[1]},{}])
   assert.notEqual(model.validate({...base,mode,hours:{...dailyHours,pri:rows}}),'');
  assert.equal(model.validate({...base,mode,hours:dailyHours}), '');
 }
 assert.equal(model.validate({...base,mode:'semanal'}),'');
 assert.notEqual(model.validate({...base,mode:'semanal',hours:dailyHours}),'');
 assert.deepEqual(model.hoursOn({...base,mode:'semanal'},'2026-12-21','pri'),[1,2]);
});
test('excluir una fecha no desplaza la rotación posterior y persistencia JSON conserva días/niveles',()=>{
 const rule={...base,hours:dailyHours,exclude:['2026-12-29']};
 const restored=model.read(JSON.parse(JSON.stringify([rule])))[0];
 assert.deepEqual(restored,rule);
 assert.deepEqual(occurrences(restored,'pri'),occurrences({...base,hours:dailyHours},'pri').filter(d=>d!=='2026-12-29'));
 assert.deepEqual(model.hoursOn(restored,'2027-01-06','sec'),[5]);
});
