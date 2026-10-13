/* Helpers de integración sintética; ninguna conexión externa. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('registro.html');
function extract(name){const re=new RegExp('^(?:async )?function '+name+'\\(','m'),m=re.exec(html);if(!m)throw Error(name);const line=html.slice(m.index,html.indexOf('\n',m.index));if(line.trimEnd().endsWith('}'))return line;return html.slice(m.index,html.indexOf('\n}',m.index)+2);}
function engine(c){vm.runInContext(read('registro-reconcile.js'),c);c.IERegistroReconcile=c.window&&c.window.IERegistroReconcile||c.IERegistroReconcile;c.bajarRegistroNube=c.bajarRegistroNube||(()=>{});c.subirRegistroNube=c.subirRegistroNube||(()=>{});c.retirarVerificacionNube=c.retirarVerificacionNube||(()=>{});c.URLSearchParams=URLSearchParams;if(c.sesionActiva===undefined)c.sesionActiva=null;c.renderSesiones=c.renderSesiones||(()=>{});c.renderAsistencia=c.renderAsistencia||(()=>{});return c.IERegistroReconcile;}
function core(c){engine(c);for(const n of ['baselineAcademica','dirtyAcademico','leerEstadoRemotoAcademico','aplicarRegistroConciliado','pintarRegistroConciliado','confirmarRegistroConciliado','prepararVersionAcademica'])vm.runInContext(extract(n),c);}
// Existing transversal tests isolate their adapter: model the prepared academic snapshot,
// preserving original tests for late edits and calls, while A1 tests exercise the real core.
function mockUpload(c,baseline){const api=engine(c);c.prepararVersionAcademica=async()=>{
  const local=api.copy(c.sliceRegistroArea());let remote={};try{remote=JSON.parse(baseline.baseline);}catch(e){}
  c.prepararVersionAcademica.plan={key:c.cloudClaveReg(),token:(c.getLoginSession()||{}).token||'',localSignature:api.signature(local),local,payload:local,remote:{version:baseline.version,payload:remote}};return true;
};c.confirmarRegistroConciliado=(p,r)=>{baseline.version=r.version;baseline.baseline=c.IERegistroAcademico.canonical(r.payload);return api.signature(c.sliceRegistroArea())===p.localSignature;};}
module.exports={engine,core,mockUpload,extract};
