'use strict';
// Exact bounded-reader/presentation deltas for historical goldens; runtime tests use raw functions.
const assert=require('node:assert/strict'),edits={
  "registro.html": [
    [
      " return '<div data-registro-read-wait class=\"registro-read-wait'+(compacto?' compact':'')+'\"><span class=\"registro-read-spinner\" aria-hidden=\"true\"></span><div class=\"registro-read-copy\"><strong>'+escapeRegistro(tituloCargaRegistro(detalle))+'</strong><span data-read-detail>'+escapeRegistro(detalle)+'</span></div></div>';\n",
      " return '<div data-registro-read-wait class=\"registro-read-wait'+(compacto?' compact':'')+'\"><span class=\"registro-read-spinner\" aria-hidden=\"true\"></span><div class=\"registro-read-copy\"><strong>Espere, sincronizando información…</strong><span data-read-detail>'+escapeRegistro(detalle)+'</span></div></div>';\n"
    ],
    [
      "function tituloCargaRegistro(detalle){return String(detalle).startsWith('Verificando acceso')?'Verificando acceso…':detalle==='Preparando comparativo bimestral'?'Preparando comparativo bimestral…':'Espere, sincronizando información…';}\n",
      ""
    ],
    [
      " const text=box.querySelector?.('[data-read-detail]');if(text){text.textContent=detalle;const title=box.querySelector?.('strong');if(title)title.textContent=tituloCargaRegistro(detalle);}else box.innerHTML=indicadorCargaRegistro(detalle,compacto);\n",
      " const text=box.querySelector?.('[data-read-detail]');if(text)text.textContent=detalle;else box.innerHTML=indicadorCargaRegistro(detalle,compacto);\n"
    ],
    [
      "  // At most two independent periods in flight; each retains its own roster and authenticated reader.\n  for(let first=1;first<numero;first+=2){\n   if(!vigente())return;\n   const batch=await Promise.all(Array.from({length:Math.min(2,numero-first)},async(_,offset)=>{\n    const i=first+offset,prior={...c,bim:['','I','II','III'][i]},cached=historicoLecturaPreparada(prior,token),cachedUntil=cached?registroHistoricoCache.get([prior.nivel,prior.bim,prior.grado,prior.seccion,prior.area].join('||'))?.until:0,proof=cached||await leerRegistroHistorico(prior,token);\n    return {i,prior,cachedUntil,proof,roster:historicoFirmaPadron(prior),local:historicoFirmaLocal(prior)};\n   }));\n   if(!vigente())return;\n   for(const {i,prior,cachedUntil,proof,roster,local}of batch){\n    proofs.push({c:prior,roster,local,cachedUntil});\n    datos[i]={};comps.forEach(cp=>{datos[i][cp]={};alumnos.forEach(al=>{const prior=comparativoAlumnoAnterior(al,proof.roster);datos[i][cp][studentKey(al)]=prior?comparativoNotaAnterior(proof.payload,proof.c,cp,prior,proof.roster):'';});});\n   }\n",
      "  for(let i=1;i<numero;i++){\n   const prior={...c,bim:['','I','II','III'][i]},cached=historicoLecturaPreparada(prior,token),cachedUntil=cached?registroHistoricoCache.get([prior.nivel,prior.bim,prior.grado,prior.seccion,prior.area].join('||'))?.until:0,proof=cached||await leerRegistroHistorico(prior,token);if(!vigente())return;\n   proofs.push({c:prior,roster:historicoFirmaPadron(prior),local:historicoFirmaLocal(prior),cachedUntil});\n   datos[i]={};comps.forEach(cp=>{datos[i][cp]={};alumnos.forEach(al=>{const prior=comparativoAlumnoAnterior(al,proof.roster);datos[i][cp][studentKey(al)]=prior?comparativoNotaAnterior(proof.payload,proof.c,cp,prior,proof.roster):'';});});\n"
    ]
  ]
};
module.exports=(file,source)=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique bounded comparative delta');s=s.replace(current,previous);}return s;};
