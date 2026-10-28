'use strict';
// Exact visible-return recovery deltas, without masking authorization guards.
const assert=require('node:assert/strict'),edits={
 "registro-connection.js": [
  [
   "  const row={event:choice(event,['gate','connection','context','lease-expired','academicstate-start','academicstate-end','verification-rejected','page-hidden','page-visible']),context:context.id,layer,panel,",
   "  const row={event:choice(event,['gate','connection','context','lease-expired','academicstate-start','academicstate-end','verification-rejected']),context:context.id,layer,panel,"
  ],
  [
   "   while(flight){const p=flight.promise;if(!review&&flight.key===binding)return p;await p;if(disposed)return false;scope();}if(!force&&!review&&canEdit()){arm(Math.min(interval,Math.max(0,until-now()-30000)));return true;}",
   "   while(flight){const p=flight.promise;if(!review&&flight.key===binding)return p;await p;if(disposed)return false;scope();}if(!force&&!review&&canEdit())return true;"
  ]
 ],
 "registro.html": [
  [
   "  const row={event:choice(event,['gate','connection','context','lease-expired','academicstate-start','academicstate-end','verification-rejected','page-hidden','page-visible']),context:context.id,layer,panel,",
   "  const row={event:choice(event,['gate','connection','context','lease-expired','academicstate-start','academicstate-end','verification-rejected']),context:context.id,layer,panel,"
  ],
  [
   "   while(flight){const p=flight.promise;if(!review&&flight.key===binding)return p;await p;if(disposed)return false;scope();}if(!force&&!review&&canEdit()){arm(Math.min(interval,Math.max(0,until-now()-30000)));return true;}",
   "   while(flight){const p=flight.promise;if(!review&&flight.key===binding)return p;await p;if(disposed)return false;scope();}if(!force&&!review&&canEdit())return true;"
  ]
 ],
 "registro-notas2-ui.js": [
  [
   "  document.addEventListener('visibilitychange',()=>{root.IERegistroEditTrace?.record(document.visibilityState==='hidden'?'page-hidden':'page-visible',connection?.diagnosticState?.());if(document.visibilityState==='hidden')prefetch?.hold('hidden');else{prefetch?.release('hidden');if(prefetch&&backgroundEligible())startPrefetch();refresh();}});",
   "  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')prefetch?.hold('hidden');else{prefetch?.release('hidden');if(prefetch&&backgroundEligible())startPrefetch();}});"
  ]
 ]
};
module.exports=(file,source)=>{let s=source.replace(/\r\n/g,'\n');for(const [current,previous]of edits[file]||[])if(s.includes(current)){assert.equal(s.split(current).length,2,'Unique no-grant recovery delta');s=s.replace(current,previous);}return s;};
