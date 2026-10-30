'use strict';
// Exact CSS-only delta aligning «Comparativo bimestral» with the bulk row, for historical comparisons only.
const assert=require('node:assert/strict'),edits={
 "registro.html": [
  [
   "#panelFinales .fin-header-main > .fin-comparativo-toggle {flex:0 0 auto;align-self:flex-start;white-space:nowrap;margin:2px 4px 0;}",
   "#panelFinales .fin-header-main > .fin-comparativo-toggle {flex:0 0 auto;align-self:center;white-space:nowrap;margin:0 4px;}"
  ]
 ]
};
module.exports=(file,source)=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique comparativo align delta');s=s.replace(current,previous);}return s;};
module.exports.edits=edits;
