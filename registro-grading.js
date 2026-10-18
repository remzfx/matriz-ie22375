/* Cálculo académico puro. Entradas leídas por el adaptador; sin DOM, estado o transporte. */
(function(root){
 'use strict';
 function sessionsFor(sessions,c,comp){
  return (sessions||[]).filter(s=>s.nivel===c.nivel&&s.bim===c.bim&&String(s.grado)===String(c.grado)&&s.seccion===c.seccion&&s.area===c.area&&s.comp===comp);
 }
 function direct(record,math){
  if(!record)return {nota:'',letra:''};
  const nota=record.nota20!==''&&record.nota20!=null&&!isNaN(Number(record.nota20))?Number(record.nota20):'';
  return {nota,letra:record.nivel||(nota!==''?math.numToLetter(nota):'')};
 }
 function calculated(records,math){
  const nums=[];
  records.forEach(g=>{
   if(!g)return;
   if(g.nota20!==''&&g.nota20!=null&&!isNaN(Number(g.nota20)))nums.push(Number(g.nota20));
   else if(g.nivel){const n=math.letterToNum(g.nivel);if(n!=='')nums.push(Number(n));}
  });
  const nota=math.promedioNums(nums);
  return {nota:nota==null?'':nota,letra:nota==null?'':math.numToLetter(nota)};
 }
 function effective(worked,direct,calculated,math){
  if(!worked)return {nota:'',letra:'',src:''};
  if(direct.letra)return {nota:direct.nota!==''?direct.nota:math.letterToNum(direct.letra),letra:direct.letra,src:'P'};
  if(calculated.nota!==''&&calculated.nota!=null)return {nota:calculated.nota,letra:calculated.letra,src:'C'};
  return {nota:'',letra:'',src:''};
 }
 const api={sessionsFor,direct,calculated,effective};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IERegistroGrading=api;
})(typeof window==='undefined'?globalThis:window);
