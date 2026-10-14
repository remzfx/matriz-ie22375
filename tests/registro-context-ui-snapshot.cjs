// Historical snapshots remove only the context presentation added in reviewed HEAD 9d1a62c.
// Production stays unchanged; print regressions use raw current source.
const {execFileSync}=require('node:child_process');
const base=execFileSync('git',['show','d5957d038b73022aaeb9e1437a9b690a550782ee:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const fn=(s,n)=>{const a=s.indexOf('function '+n+'(');return a<0?'':s.slice(a,s.indexOf('\n}',a)+2);};
module.exports=s=>{
 s=s.replace(/\r\n/g,'\n');
 // Reverse only the approved 0d20b14 presentation changes outside the visual CSS block.
 // Current raw markup/styles are asserted separately in registro-final-audit.test.cjs.
 s=s.replace('grid-column:1 / -1; justify-self:start;', 'grid-column:1 / -1; justify-self:center;');
 const comparative='<button type="button" class="fin-comparativo-toggle" id="btnComparativoBim" aria-pressed="false" onclick="alternarComparativoBim()">Comparativo bimestral</button>';
 if(s.includes('            '+comparative+'\n            <div class="fin-header-controls">')){
  s=s.replace('            '+comparative+'\n','');
  s=s.replace('                <div class="fin-mode-info" id="finModeInfo"></div>', '                '+comparative+'<div class="fin-mode-info" id="finModeInfo"></div>');
 }
 const ca=s.indexOf('    /* Botones compactos:'),cb=s.indexOf('    .registro-datos-meta',ca);if(ca>=0)s=s.slice(0,ca)+s.slice(cb);
 const a=s.indexOf('// Presentación únicamente: nunca altera las reglas'),b=s.indexOf('function pintarBimestresRegistro(',a);if(a>=0)s=s.slice(0,a)+s.slice(b);
 for(const n of ['cambiarBimestreRegistro','pintarBimestresRegistro','llenarAulasPadron','onGrado','onContexto']){const f=fn(s,n);if(f)s=s.replace(f,fn(base,n));}
 const block=x=>{const a=x.indexOf('<div class="registro-datos-grid">'),b=x.indexOf('<div class="registro-datos-meta">',a);return a<0?'':x.slice(a,b);};if(block(s))s=s.replace(block(s),block(base));
 return s;
};
