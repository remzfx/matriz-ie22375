/* Los claims guían la interfaz; la firma, revocación y alcance los valida el backend. */
(function(global){
  'use strict';
  function niveles(){
    try {
      const token=IEStudents.validToken(); if(!token)return [];
      const s=JSON.parse(atob(token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));
      if(s.role==='admin')return ['primaria','secundaria'];
      if(s.role!=='auxiliar')return [];
      return ['primaria','secundaria'].filter(n=>Array.isArray(s.niveles)&&s.niveles.includes(n));
    } catch(e){return [];}
  }
  function permite(n){return niveles().includes(n);}
  function configurar(){
    const ns=niveles();
    ['selNivel','selNivelGrupos'].forEach(id=>{
      const select=document.getElementById(id),label=document.getElementById(id+'Scope');if(!select)return;
      const anterior=select.value;
      select.innerHTML=ns.map(n=>'<option value="'+n+'">'+(n==='primaria'?'Primaria':'Secundaria')+'</option>').join('');
      select.value=ns.includes(anterior)?anterior:(ns[0]||'');select.hidden=ns.length!==2;
      if(label){label.hidden=ns.length===2;label.textContent=ns.length===1?(ns[0]==='primaria'?'Primaria':'Secundaria'):'Sin niveles autorizados. Vuelve a iniciar sesión.';}
    });
  }
  global.IEAuxPermissions={niveles:niveles,permite:permite,configurar:configurar};
})(window);
