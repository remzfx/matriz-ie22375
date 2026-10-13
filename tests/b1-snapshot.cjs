// Historical snapshots keep checking all source outside B1, whose behavior is
// tested directly against unmodified source in registro-unified-save-b1.test.cjs.
const {execFileSync}=require('node:child_process');
const previous=execFileSync('git',['show','bd86c257bb2c70c1577df38e4eb64deae6bbaa49:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function extract(s,n){const match=new RegExp('^(?:async )?function '+n+'\\(','m').exec(s);return s.slice(match.index,s.indexOf('\n}',match.index)+2);}
module.exports=function withoutB1(s){
 s=s.replace(/\r\n/g,'\n');
 s=s.replace("  const contextoCalificar = cloudClaveReg();\n",'').replace("    inp.dataset.registroContexto = contextoCalificar;\n",'').replaceAll("      if (contextoCalificar !== cloudClaveReg()) return;\n",'');
 for(const n of ['guardarRegistroIntegrado','recolectarPantalla'])if(s.includes('function '+n+'('))s=s.replace(extract(s,n),extract(previous,n));
 s=s.replace("  if(!box.dataset)box.dataset={};box.dataset.registroContexto=[c.nivel,c.bim,c.grado,c.seccion,c.area].join('||');\n",'').replaceAll('Subir Nube','Nube Subir').replaceAll('Bajar Nube','Nube Bajar').replace('onclick="guardarRegistroIntegrado()"','onclick="guardarRegistroIntegrado(false)"');
 const averages=previous.split('\n').find(x=>x.includes('>Guardar promedios</button>')),attendance=previous.split('\n').find(x=>x.includes("guardarAsistencia(); toast('Asistencia guardada')"));
 if(s.includes('<div id="finLista"')&&!s.includes('>Guardar promedios</button>'))s=s.replace(/(<div id="finLista"[^\n]*\n)/,'$1'+averages+'\n');
 if(s.includes('onclick="agregarFechaAsis()"')&&!s.includes("guardarAsistencia(); toast('Asistencia guardada')"))s=s.replace(/([^\n]*onclick="agregarFechaAsis\(\)"[^\n]*\n)/,'$1'+attendance+'\n');
 return s;
};
