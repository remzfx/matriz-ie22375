// Only B2's reviewed importer and static dependency are excluded from older snapshots.
const {execFileSync}=require('node:child_process');
// Exact E2-A dead utility hunks only; current behavior is tested separately.
const utilityHunks={"primaria.html":[["        /** Trunca texto largo para UI (mantiene completo en title/tooltip) */\n\n        function abrevArea(nombre) {","        /** Trunca texto largo para UI (mantiene completo en title/tooltip) */\n        function truncarTexto(texto, max) {\n            const t = String(texto || '').trim();\n            if (!max || t.length <= max) return t;\n            return t.slice(0, Math.max(1, max - 1)).trimEnd() + '…';\n        }\n\n        function abrevArea(nombre) {"],["\n\n        function actualizarTotalEstudiantes() { syncInputTotalEstudiantes(); }","\n        function actualizarNombreDocente() { syncInputDocente(); }\n\n        function actualizarTotalEstudiantes() { syncInputTotalEstudiantes(); }"]],"secundaria.html":[["        /** Trunca texto largo para UI (mantiene completo en title/tooltip) */\n\n        function abrevArea(nombre) {","        /** Trunca texto largo para UI (mantiene completo en title/tooltip) */\n        function truncarTexto(texto, max) {\n            const t = String(texto || '').trim();\n            if (!max || t.length <= max) return t;\n            return t.slice(0, Math.max(1, max - 1)).trimEnd() + '…';\n        }\n\n        function abrevArea(nombre) {"]]};
function restoreUtilities(file,text){for(const [removed,original]of utilityHunks[file]||[])if(!text.includes(original))text=text.replace(removed,original);return text;}
module.exports=(file,text)=>{
 let s=restoreUtilities(file,text.replace(/\r\n/g,'\n'));if(file==='apps-script/Codigo.js')s=require('./registro-phase1-snapshot.cjs').backend(s);if(file==='sw.js')return require('./phase2-boundary.cjs').sw(s).replace(" './matrix-registry-import.js',",'');
 if(!['primaria.html','secundaria.html'].includes(file))return s;
 const previous=execFileSync('git',['show','e41a9853eb79847dce35c0dda926c29b25bd9971:'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 const importer=x=>{const start=x.indexOf('        function traerDesdeRegistro() {');return x.slice(start,x.indexOf('\n        }\n',start)+11);};
 s=s.replace('        let importadorRegistroMatriz = null;\n','').replace(importer(s)+'\n',importer(previous));
 for(const name of ['student-identity.js','registro-academic-model.js','registro-evaluation.js','matrix-registry-import.js'])s=s.replace('<script src="'+name+'"></script>\n','');
 return s;
};

module.exports.restoreUtilities=restoreUtilities;
