/* Criterio extraído de Registro: numToLetter, letterToNum, promedioNums y notaDesdeSesiones.
 * La misma función se incluye en Codigo.js; una regresión comprueba igualdad exacta. */
function registroEvaluacion_() {
  function numToLetter(n) { n=Number(n);if(isNaN(n)||n<0||n>20)return '';return n>=18?'AD':n>=14?'A':n>=11?'B':'C'; }
  function letterToNum(L) { return ({AD:19,A:15,B:12,C:8})[L] ?? ''; }
  function promedioNums(arr) { const v=arr.filter(x=>x!==''&&x!=null&&!isNaN(Number(x))).map(Number);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):null; }
  function valor(raw) {
    if(!raw||!['letra','num'].includes(raw.modo))return null;
    if(raw.modo==='letra')return ['AD','A','B','C'].includes(raw.valor)?{modo:'letra',valor:raw.valor,nivel:raw.valor}:null;
    if(raw.valor===''||raw.valor==null||(typeof raw.valor!=='number'&&typeof raw.valor!=='string'))return null;
    const entrada=Number(raw.valor);if(!Number.isFinite(entrada)||entrada<0||entrada>20)return null;
    const n=Math.round(entrada);return {modo:'num',valor:n,nota20:n,nivel:numToLetter(n)};
  }
  const COMP={tic:'Se desenvuelve en los entornos virtuales generados por las TIC',autonomia:'Gestiona su aprendizaje de manera autónoma'};
  const CAPS={tic:['Personaliza entornos virtuales','Gestiona información del entorno virtual','Interactúa en entornos virtuales','Crea objetos virtuales en diversos formatos'],autonomia:['Define metas de aprendizaje','Organiza acciones estratégicas para alcanzar sus metas de aprendizaje','Monitorea y ajusta su desempeño durante el proceso de aprendizaje']};
  function sessionKey(s) { return JSON.stringify([s.fecha,s.comp,s.capacidad]); }
  function resultados(evidencia,ids) {
    const valores={},estadisticas={};
    ids.forEach(id=>{valores[id]={};estadisticas[id]={};Object.keys(COMP).forEach(comp=>{
      const nums=[],caps=new Set();let evidencias=0;
      (evidencia.sessions||[]).filter(s=>s.comp===comp).forEach(s=>{
        const g=((evidencia.grades||{})[sessionKey(s)]||{})[id];if(!g)return;
        const n=g.nota20!=null&&g.nota20!==''?Number(g.nota20):letterToNum(g.nivel);
        if(n!==''&&Number.isFinite(n)){nums.push(n);caps.add(s.capacidad);evidencias++;}
      });
      const promedio=promedioNums(nums);
      if(promedio!=null)valores[id][comp]={modo:'num',valor:promedio,nota20:promedio,nivel:numToLetter(promedio)};
      estadisticas[id][comp]={evidencias,capacidades:[...caps],totalCapacidades:CAPS[comp].length};
    });});
    return {valores,estadisticas};
  }
  return {numToLetter,letterToNum,promedioNums,valor,COMP,CAPS,sessionKey,resultados};
}
if(typeof window!=='undefined')window.IERegistroEvaluacion=registroEvaluacion_();
