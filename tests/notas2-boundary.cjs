// Exact Notas 2.0 additions only; historical tests still compare all unrelated code.
const edits={backend:[
 ["    if (['loadnotas2','savenotas2'].includes(action)) return responder_(notas2Ruta_(body));\n",''],
 ["        if(prev.meta&&prev.meta.notas2)return responder_({ok:false,code:'NOTAS2_REQUIRED',error:'Este registro requiere Notas 2.0; no se modificó.'});\n",'']
]};
module.exports=(kind,source)=>{let s=source.replace(/\r\n/g,'\n');for(const [current,old]of edits[kind]||[])s=s.replace(current,old);return s;};
