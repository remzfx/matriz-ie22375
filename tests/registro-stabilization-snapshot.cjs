// Normalize only explicitly authorized confirmation/print changes for historical contracts.
// Raw current functions are tested in registro-stabilization.test.cjs.
const {execFileSync}=require('node:child_process');
const base=execFileSync('git',['show','8dadbdabd5ff020eca199d363df47b853f628e6f:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
function fn(s,n){const i=s.indexOf('function '+n+'(');return i<0?'':s.slice(i,s.indexOf('\n}',i)+2);}
module.exports=s=>{
 s=require('./registro-simplification-snapshot.cjs')(s);
 s=require('./registro-context-ui-snapshot.cjs')(s);
 let a=s.indexOf('let registroHistoricoActual=');if(a<0)a=s.indexOf('let comparativoBimActivo=');const b=s.indexOf('function renderFinales()',a);if(a>=0&&b>=a)s=s.slice(0,a-1)+s.slice(b);
 s=s.replace('<button type="button" class="fin-comparativo-toggle" id="btnComparativoBim" aria-pressed="false" onclick="alternarComparativoBim()">Comparativo bimestral</button>','');
 for(const n of ['prepararImpresion','imprimirResumen','renderStudents','renderFinales','seleccionarFinalReversible','recolectarPantalla','guardarFinales','registroSoloLectura','pintarPadronInmediato','cargarPadronRegistro','pintarBimestresRegistro','onContexto','bajarRegistroNube','renderAvance','renderAsistencia','renderSesiones','abrirSesionFecha']){const current=fn(s,n);if(current)s=s.replace(current,fn(base,n));}
 for(const n of ['confirmarEdicionNumerica','imprimirPestanaActiva','abrirSelectorImpresionCalificar','imprimirAsistenciaRegistro']){const current=fn(s,n);if(current)s=s.replace(current+'\n','');}
 return s.replace('onclick="imprimirPestanaActiva()">🖨 Imprimir / PDF','onclick="imprimirResumen()">🖨 Imprimir / PDF');
};
