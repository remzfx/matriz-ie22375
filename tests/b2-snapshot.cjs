// Only B2's reviewed importer and static dependency are excluded from older snapshots.
const {execFileSync}=require('node:child_process');
module.exports=(file,text)=>{
 let s=text.replace(/\r\n/g,'\n');if(file==='sw.js')return s.replace(" './matrix-registry-import.js',",'');
 if(!['primaria.html','secundaria.html'].includes(file))return s;
 const previous=execFileSync('git',['show','e41a9853eb79847dce35c0dda926c29b25bd9971:'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 const importer=x=>{const start=x.indexOf('        function traerDesdeRegistro() {');return x.slice(start,x.indexOf('\n        }\n',start)+11);};
 s=s.replace('        let importadorRegistroMatriz = null;\n','').replace(importer(s)+'\n',importer(previous));
 for(const name of ['student-identity.js','registro-academic-model.js','registro-evaluation.js','matrix-registry-import.js'])s=s.replace('<script src="'+name+'"></script>\n','');
 return s;
};
