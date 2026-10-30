// Fuente de los adaptadores de Registro que viven inline en registro.html.
// Los antiguos archivos registro-*.js eran copias que la app no cargaba; los tests
// ahora leen y ejecutan el código real servido dentro de registro.html.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.join(__dirname,'..');
const firstLines={
 "registro-connection.js": "/* Conexión obligatoria de Registro. Solo coordina lecturas; nunca escribe datos académicos. */",
 "registro-drafts.js": "/* Borradores locales y recuperación voluntaria; no contiene transporte de escritura. */",
 "registro-local-store.js": "/* Persistencia por cuenta. Los datos anteriores sin propietario nunca se adoptan automáticamente. */",
 "registro-recovery-ui.js": "/* Adaptador frontend: operaciones explícitas y timers exclusivamente locales. */",
 "registro-calificar-print.js": "/* Vista integral de Calificar: solo lectura; no convierte ni persiste calificaciones. */"
};
const markers=firstLines;
const NOTAS2_GUARD="\n if(document.documentElement?.dataset?.notas2==='1'){if(typeof IERegistroNotas2UI==='undefined')registroDependenciaFallida();return;}";
function blocks(html){const out=[];const re=/<script>\n([\s\S]*?)\n?<\/script>/g;let m;while((m=re.exec(html)))out.push(m[1]);return out;}
function read(name,html){
 if(!(name in markers))throw new Error('Módulo inline desconocido: '+name);
 html=(html??fs.readFileSync(path.join(root,'registro.html'),'utf8')).replace(/\r\n/g,'\n');
 const head=firstLines[name];const found=blocks(html).filter(b=>b.trim().startsWith(head));
 if(found.length!==1)throw new Error('Se esperaba exactamente un bloque inline para '+name+' y hay '+found.length);
 let src=found[0].trim();
 if(name==='registro-recovery-ui.js'){if(!src.includes(NOTAS2_GUARD))throw new Error('Falta el guard Notas2 del adaptador inline');src=src.replace(NOTAS2_GUARD,'');}
 return src+'\n';
}
const cache=new Map();
function load(name,html){if(html===undefined&&cache.has(name))return cache.get(name);const e=compile(name,html);if(html===undefined)cache.set(name,e);return e;}
function compile(name,html){const file=path.join(root,name),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(root);m._compile(read(name,html),file);return m.exports;}
function readFile(p,enc){const n=path.basename(String(p));if(n in markers&&path.resolve(root,String(p))===path.join(root,n))return read(n);return fs.readFileSync(p,enc??"utf8");}
module.exports={read,load,readFile,names:Object.keys(markers),firstLines};
