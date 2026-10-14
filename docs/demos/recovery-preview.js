/* Solo datos ficticios. No contacta API; persistencia de prueba aislada por viewport. */
const NOTAS_KEY='synthetic-preview-only',previewAbsent=new URLSearchParams(location.search).get('session')==='absent';
let nivel='secundaria',areaActual='Matemática',padronBimestre='III';
const tokenPadron='synthetic-never-sent',IEStudents={validToken:()=>previewAbsent?'':tokenPadron,peekRoster:()=>previewAbsent?null:({synthetic:true})};
const contextKey='secundaria||III||1||A||Matemática',gradeKey=contextKey+'||Competencia ficticia||id:synthetic-1';
const clone=x=>JSON.parse(JSON.stringify(x)),transversal={dirty:!previewAbsent};
const remote={version:1,payload:{grades:{},finales:{[gradeKey]:{nivel:'B',nota20:12,origen:'numero'}},concComp:{[gradeKey]:{texto:'Conclusión ficticia de nube'}},sessions:[],asistencia:{},asisFechas:{},asisFechasEstado:{},meta:{}}};
const fixtureStorage=window.sessionStorage,fixtureKey='synthetic-preview-'+(innerWidth<600?'mobile':'desktop');
let raw=fixtureStorage.getItem(fixtureKey),store=raw?JSON.parse(raw):{...clone(remote.payload),finales:{[gradeKey]:{nivel:'A',nota20:15,origen:'numero'}},concComp:{[gradeKey]:{texto:'Conclusión ficticia local pendiente'}}};
Object.defineProperty(window,'localStorage',{value:{getItem:()=>raw,setItem:(_k,v)=>{raw=v;fixtureStorage.setItem(fixtureKey,v);}}});
function getLoginSession(){if(previewAbsent)return null;return {role:'docente',user:'synthetic-preview-'+(innerWidth<600?'mobile':'desktop'),token:'synthetic-never-sent'};}
function ctxBase(){return {nivel,bim:'III',grado:1,seccion:'A',area:areaActual};}
function cloudClaveReg(){return contextKey;}
function areas(){return [areaActual];}
function bimestreHabilitado(){return true;}
function registroSoloLectura(){return false;}
function bimCerradoDocente(){return false;}
function registroNubeNoVerificada(){return false;}
function sliceRegistroArea(){return clone(store);}
const baseline={version:1,basePayload:clone(remote.payload),baseline:IERegistroAcademico.canonical(remote.payload)};
function baselineAcademica(){return baseline;}
function guardarTodo(){saveStore();return true;}
function saveStore(){localStorage.setItem(NOTAS_KEY,JSON.stringify(store));}
function aplicarRegistroConciliado(payload){store=clone(payload);}
function dirtyAcademico(){}
function estudiantes(){return [{idSiagie:'synthetic-1',nombre:'ESTUDIANTE FICTICIO UNO',orden:1}];}
function pintarRegistroConciliado(){if(previewAbsent)return;document.getElementById('previewGrade').textContent=store.finales[gradeKey]?.nota20??'—';}
async function leerEstadoRemotoAcademico(){return {exists:true,...clone(remote)};}
async function subirRegistroNube(){return false;}
async function bajarRegistroNube(options){await leerEstadoRemotoAcademico();if(options?.validar&&!options.validar())return false;bajarRegistroNube.resultado={key:cloudClaveReg(),token:getLoginSession()?.token,estado:'verificado'};return true;}
async function guardarRegistroIntegrado(){guardarTodo();return IERegistroTransversales.save();}
const IERegistroTransversales={current:()=>transversal,capture(){},save:async()=>!transversal.dirty};
window.fetch=async()=>{throw Error('La demostración no permite consultas de red.');};
document.getElementById('previewClearPending').onclick=()=>{transversal.dirty=false;document.dispatchEvent(new Event('change'));};
document.getElementById('previewTableBody').innerHTML=Array.from({length:previewAbsent?0:25},(_,i)=>'<tr><td>ESTUDIANTE FICTICIO '+(i+1)+'</td><td>'+(i===0?'<span id="previewGrade">15</span>':'A')+'</td><td>Conclusión ficticia completa para revisión de distribución</td></tr>').join('');
saveStore();pintarRegistroConciliado();
