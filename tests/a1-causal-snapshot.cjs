// Historical source guards allow only the exact causal group correction.
// All other reconciliation code and consumers must still match their baseline.
const assert=require('node:assert/strict');
const added=`      // Comparar cada representación con su misma ruta, incluyendo ausencias.
      // La divergencia histórica interna no demuestra una edición concurrente.
      const sameGroup=(a,z)=>paths.every(p=>equal(a.get(p),z.get(p)));
      if(sameGroup(l,r)||b&&(sameGroup(l,b)||sameGroup(r,b)))return;
      // Cambios bilaterales en diferentes claves de la misma identidad
      // requieren revisar el conjunto; no decidir por marcas de tiempo.`;
module.exports=(file,source)=>{if(file==='matrix-registry-import.js')source=require('./notas2-frontend-boundary.cjs')('matrix',source);
 if(file==='sw.js')return require('./phase2-boundary.cjs').sw(source);
 if(file==='apps-script/Codigo.js')return require('./registro-phase1-snapshot.cjs').backend(source);
 if(file!=='registro-reconcile.js')return source;
 source=require('./registro-phase1-snapshot.cjs').reconcile(source);
 source=source.replace(/\r\n/g,'\n');assert.equal(source.split(added).length,2,'Exactly one approved causal group correction');
 return source.replace(added,'      // Diferentes claves de una misma identidad no son cambios disjuntos.');
};
