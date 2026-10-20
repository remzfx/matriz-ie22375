'use strict';
// Historical comparisons only. Runtime tests always execute the unmodified backend.
const assert=require('node:assert/strict');
const additions=[
 "    ...(payload.calificarEstado ? {calificarEstado: mapaContexto(payload.calificarEstado, true)} : {}),\n",
 "    if (['loadnotas2','savenotas2'].includes(action)) return responder_(notas2Ruta_(body));\n",
 "        if(prev.meta&&prev.meta.notas2)return responder_({ok:false,code:'NOTAS2_REQUIRED',error:'Este registro requiere Notas 2.0; no se modificó.'});\n"
];
module.exports=source=>{
 let s=source.replace(/\r\n/g,'\n');
 if(!additions.some(line=>s.includes(line)))return s;
 for(const line of additions){assert.equal(s.split(line).length,2,'Exact N2-G.18A backend hook, once only');s=s.replace(line,'');}
 return s;
};
