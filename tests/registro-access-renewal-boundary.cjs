'use strict';
// Exact access-renewal presentation delta (silent renewal over loaded context) for historical comparisons only. Runtime tests use raw sources.
const assert=require('node:assert/strict'),edits={
 "registro-notas2-ui.js": [
  [
   "  const accessCheck=accessRead?.key===binding()&&!connection?.canEdit(),load=s?.state==='checking'&&!!s.busy,roster=visibleRosterRead();\n  // Renewing authorization over an already loaded context is reported only by the cloud; editing stays gated by the connection.\n  const access=accessCheck&&(missing||load||roster);\n",
   "  const access=accessRead?.key===binding()&&!connection?.canEdit(),load=s?.state==='checking'&&!!s.busy,roster=visibleRosterRead();\n"
  ]
 ]
};
module.exports=(file,source)=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique access renewal delta');s=s.replace(current,previous);}return s;};
module.exports.edits=edits;
