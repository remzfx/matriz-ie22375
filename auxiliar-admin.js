/* Administración privada: nunca se reciben ni se almacenan contraseñas en las listas. */
let auxiliaresAdmin=[],versionAuxiliares=0,auxiliaresOcupado=false;
function estadoAuxiliares(m){document.getElementById('auxEstado').textContent=m;}
function aplicarAuxiliares(data){
  auxiliaresAdmin=data.auxiliares;versionAuxiliares=data.version;
  document.getElementById('auxLegacyWrap').hidden=!data.legacyPendiente;
  renderAuxiliares();
}
async function solicitudAuxiliares(action,extra){
  const data=await IEStudents.fetchJSON(CLOUD_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({},extra,{action,token:tokenSesionAdmin()})),cache:'no-store'});
  if(!data.ok)throw new Error(data.error||'No se pudo sincronizar auxiliares.');
  return data;
}
async function cargarAuxiliares(){
  if(auxiliaresOcupado)return false;auxiliaresOcupado=true;
  estadoAuxiliares('Cargando configuración privada…');
  try{aplicarAuxiliares(await solicitudAuxiliares('loadauxiliares'));estadoAuxiliares('Configuración verificada con el servidor.');}
  catch(e){estadoAuxiliares(e.message);return false;}
  finally{auxiliaresOcupado=false;}
}
function limpiarAuxiliar(){
  ['auxNombre','auxUser','auxPassword'].forEach(id=>{document.getElementById(id).value='';});
  document.getElementById('auxUser').readOnly=false;
  ['auxPrimaria','auxSecundaria','auxLegacy'].forEach(id=>{document.getElementById(id).checked=false;});
  document.getElementById('auxActivo').checked=true;
}
async function guardarAuxiliarAdmin(){
  if(auxiliaresOcupado)return false;
  const niveles=['primaria','secundaria'].filter(n=>document.getElementById(n==='primaria'?'auxPrimaria':'auxSecundaria').checked);
  const auxiliar={nombre:document.getElementById('auxNombre').value.trim(),user:document.getElementById('auxUser').value.trim(),password:document.getElementById('auxPassword').value,
    niveles,activo:document.getElementById('auxActivo').checked,usarClaveAnterior:document.getElementById('auxLegacy').checked};
  if(auxiliar.activo&&!niveles.length){estadoAuxiliares('Selecciona al menos un nivel para un auxiliar activo.');return false;}
  auxiliaresOcupado=true;document.getElementById('auxGuardar').disabled=true;
  try{aplicarAuxiliares(await solicitudAuxiliares('saveauxiliar',{auxiliar,version:versionAuxiliares}));limpiarAuxiliar();estadoAuxiliares('Guardado en servidor. Las sesiones anteriores de auxiliares quedan revocadas.');}
  catch(e){estadoAuxiliares(e.message);return false;}
  finally{auxiliaresOcupado=false;document.getElementById('auxGuardar').disabled=false;}
}
function editarAuxiliar(user){
  const a=auxiliaresAdmin.find(a=>a.user===decodeURIComponent(user));if(!a)return;
  limpiarAuxiliar();document.getElementById('auxUser').value=a.user;document.getElementById('auxUser').readOnly=true;
  document.getElementById('auxNombre').value=a.nombre;document.getElementById('auxActivo').checked=a.activo;
  document.getElementById('auxPrimaria').checked=a.niveles.includes('primaria');document.getElementById('auxSecundaria').checked=a.niveles.includes('secundaria');
}
async function eliminarAuxiliar(user){
  if(auxiliaresOcupado||!confirm('¿Eliminar este auxiliar y revocar las sesiones anteriores de auxiliares?'))return false;
  auxiliaresOcupado=true;
  try{aplicarAuxiliares(await solicitudAuxiliares('saveauxiliar',{auxiliar:{user:decodeURIComponent(user)},eliminar:true,version:versionAuxiliares}));limpiarAuxiliar();estadoAuxiliares('Auxiliar eliminado en el servidor.');}
  catch(e){estadoAuxiliares(e.message);return false;}
  finally{auxiliaresOcupado=false;}
}
function textoAuxiliar(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderAuxiliares(){
  document.getElementById('auxLista').innerHTML=auxiliaresAdmin.map(a=>'<div class="card p-3"><b>'+textoAuxiliar(a.nombre)+'</b> · '+textoAuxiliar(a.user)+' · '+a.niveles.map(textoAuxiliar).join(', ')+' · '+(a.activo?'Activo':'Inactivo')+
    ' <button class="btn" onclick="editarAuxiliar(\''+encodeURIComponent(a.user)+'\')">Editar</button> <button class="btn" onclick="eliminarAuxiliar(\''+encodeURIComponent(a.user)+'\')">Eliminar</button></div>').join('')||'<p>No hay auxiliares configurados. Admin conserva acceso a ambos niveles.</p>';
}
