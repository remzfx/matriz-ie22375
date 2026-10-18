/* Preparación de sesiones y cálculo puro. Entradas del adaptador; sin DOM, estado o transporte. */
(function(root){
 'use strict';
 function inContext(s,c){
  return s.nivel===c.nivel&&s.bim===c.bim&&String(s.grado)===String(c.grado)&&s.seccion===c.seccion&&s.area===c.area;
 }
 function sessionsFor(sessions,c,comp){return (sessions||[]).filter(s=>inContext(s,c)&&s.comp===comp);}
 function sessionsOn(sessions,c,date){return (sessions||[]).filter(s=>inContext(s,c)&&s.fecha===date);}
 function capabilityValue(selected,custom){return (selected==='__otra__'?(custom||''):(selected||'')).trim();}
 function normalizeCapability(item,fallback,isTransversal){
  if(!item)return null;
  if(typeof item==='string')return normalizeCapability({comp:fallback||'',cap:item},undefined,isTransversal);
  if(!item.cap)return null;
  const comp=item.comp||fallback||'';
  return {comp,cap:item.cap,origen:isTransversal(comp)?'transversal':'academica'};
 }
 function capabilitiesFor(sessions,c,comp){
  const seen={},out=[];
  sessionsFor(sessions,c,comp).forEach(s=>{
   const cap=(s.capacidad||'').trim();
   if(!cap||seen[cap])return;
   seen[cap]=1;out.push({capacidad:cap,fecha:s.fecha||''});
  });
  return out;
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
 const api={sessionsFor,sessionsOn,capabilityValue,normalizeCapability,capabilitiesFor,direct,calculated,effective};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IERegistroGrading=api;
})(typeof window==='undefined'?globalThis:window);
