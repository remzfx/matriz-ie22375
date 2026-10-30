'use strict';
// PR121: exact CSS-only delta for adaptive Registro button bars (nav, Promedios header, footer), for historical comparisons only.
const assert=require('node:assert/strict'),edits={
 "registro.html": [
  [
   "  /* Fin Issue86 adaptable. */\n  /* PR121: barras de botones adaptables; envuelven a otra fila en vez de desplazarse. Sin cambios de lógica. */\n  @media screen {\n    #registroAccionesAcademicas {flex-wrap:wrap;overflow:visible;}\n    #registroAccionesAcademicas > button {flex:1 1 100px;}\n    #registroRecoveryControls .registro-recovery-actions {flex-wrap:wrap;overflow:visible;}\n    #panelFinales .fin-header-main {flex-wrap:wrap;align-items:center;justify-content:space-between;column-gap:6px;}\n    #panelFinales .fin-header-main > .fin-comparativo-toggle {margin-left:auto;padding-left:5px;padding-right:5px;}\n    #panelFinales .fin-header-main > .fin-header-context {flex:1 1 250px;min-width:0;}\n    #panelFinales .fin-header-main > .fin-header-controls {flex:0 0 auto;max-width:100%;margin-left:auto;column-gap:6px;}\n    #panelFinales .fin-bulk-actions {flex-wrap:wrap;overflow:visible;column-gap:3px;}\n    #panelFinales .fin-bulk-actions .chip {min-width:34px;padding-left:2px;padding-right:2px;}\n    #panelFinales .fin-remove-bulk,#panelFinales .mode-toggle button {padding-left:5px;padding-right:5px;}\n  }\n",
   "  /* Fin Issue86 adaptable. */\n"
  ]
 ]
};
module.exports=(file,source)=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique PR121 button bars delta');s=s.replace(current,previous);}return s;};
module.exports.edits=edits;
