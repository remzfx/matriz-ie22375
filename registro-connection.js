/* Diagnóstico temporal optativo: solo memoria, sin identidad ni transporte. */
(function(root){
 'use strict';
 const capacity=300,states=['checking','connected','pending','offline','server','session','readonly','review','ready','conflict','closed'];
 const reasons=['enabled','permissions','readonly','conflict','client-state','client-legacy','client-busy','context-change','expiration','no-grant','disposed','review','server','offline','session','period-verification','unknown'];
 let active=false,origin=0,sequence=0,contextSequence=0,dropped=0,rows=[],contexts=new WeakMap(),run={},observed={};
 const flag=v=>typeof v==='boolean'?v:null,choice=(v,list)=>list.includes(v)?v:null;
 function record(event,s={},detail={}){if(!active)return null;try{
  if(!s.context||typeof s.context!=='object')return null;
  let context=contexts.get(s.context);if(!context){context={id:'c'+(++contextSequence),last:{},expired:false};contexts.set(s.context,context);}
  if(event==='lease-expired')context.expired=true;else if(s.until>Date.now())context.expired=false;
  const layer=choice(detail.layer,['connection','ui']),panel=choice(detail.panel,['calificar','promedios','asistencia','resumen']);
  let reason=choice(detail.reason,reasons);if(reason==='no-grant'&&context.expired)reason='expiration';
  const row={event:choice(event,['gate','connection','context','lease-expired','academicstate-start','academicstate-end','roster-start','roster-end','verification-rejected','page-hidden','page-visible']),context:context.id,layer,panel,
   state:choice(s.state,states),validUntilMs:Number.isFinite(s.until)&&s.until>0?s.until-origin:null,expired:context.expired||!!(s.until>0&&s.until<=Date.now()),
   authorized:flag(detail.authorized),allowed:flag(detail.allowed),clientState:choice(detail.clientState,states),clientReadonly:flag(detail.clientReadonly),clientBusy:flag(detail.clientBusy),
   canEdit:flag(detail.canEdit),reason,verification:Number.isSafeInteger(detail.verification)&&detail.verification>0?detail.verification:null,
   outcome:choice(detail.outcome,['ok','permissions','context-change','invalid-response','generation','timeout','error'])};
  if(!row.event)return null;
  if(event==='gate'){
   const key=layer+'|'+panel,prior=observed[key],signature=JSON.stringify(row);if(context.last[key]===signature)return null;
   context.last[key]=signature;observed[key]={canEdit:row.canEdit,context:context.id};
   if(prior?.canEdit===true&&row.canEdit===false){row.event='edit-blocked';if(prior.context!==context.id)row.reason='context-change';}
  }
  row.atMs=Date.now()-origin;if(rows.length===capacity){rows.shift();dropped++;}rows.push(row);return row;
 }catch(_){return null;}}
 const capture=()=>JSON.parse(JSON.stringify({schema:1,active,capacity,dropped,events:rows}));
 root.IERegistroEditTrace=Object.freeze({enabled:()=>active,start(){origin=Date.now();sequence=contextSequence=dropped=0;rows=[];contexts=new WeakMap();run={};observed={};active=true;return {active,capacity};},stop(){active=false;},clear(){active=false;rows=[];contexts=new WeakMap();run={};observed={};dropped=0;},capture,export:()=>JSON.stringify(capture(),null,2),record,
  begin(s){if(!active)return null;const ticket={id:++sequence,run,context:s?.context};record('academicstate-start',s,{verification:ticket.id});return ticket;},
  end(ticket,s,outcome){if(ticket&&ticket.run===run&&active){const changed=ticket.context!==s?.context;record('academicstate-end',changed?{context:ticket.context,state:null,until:0}:s,{verification:ticket.id,outcome:changed?'context-change':outcome});}}});
})(typeof window==='undefined'?globalThis:window);
/* Conexión obligatoria de Registro. Solo coordina lecturas; nunca escribe datos académicos. */
(function(root){
 'use strict';let active=null;
 function create(o){
  const now=o.now||Date.now,set=o.setTimeout||setTimeout,clear=o.clearTimeout||clearTimeout;
  const interval=o.interval||120000,lease=o.lease||150000;let state='checking',binding='',until=0,flight=null,timer=null,epoch=0,attempt=0,disposed=false,expired=false,published='',retentionFailed=false;
  const grants=new Map();let expiryTimer=null,diagnosticContext={},diagnosticGate=null;
  const trace=root.IERegistroEditTrace;
  function diagnosticState(){return {context:diagnosticContext,state,until,gate:diagnosticGate};}
  const online=()=>o.online?o.online():true;
  function watchLease(){clear(expiryTimer);expiryTimer=null;if(until>now()){const key=binding;expiryTimer=set(()=>{expiryTimer=null;if(key===binding&&now()>=until){trace.record('lease-expired',diagnosticState(),{reason:'expiration'});grants.delete(key);emit('checking');}},until-now());}}
  function snapshot(){return {state,validUntil:until,pending:state==='pending',retentionFailed,binding};}
  function emit(next){state=next;if(next!=='connected'&&next!=='pending'&&!(next==='checking'&&now()<until)){until=0;clear(expiryTimer);grants.delete(binding);}if(['offline','server','session'].includes(next))grants.clear();const stamp=binding+'|'+next+'|'+(now()<until);if(stamp!==published){published=stamp;trace.record('connection',diagnosticState());o.changed?.(snapshot());}}
  function scope(){const current=o.binding();if(binding!==current){binding=current;diagnosticContext={};diagnosticGate=null;epoch++;until=0;expired=false;retentionFailed=false;state='checking';for(const [key,g]of grants)if(g.until<=now())grants.delete(key);const saved=grants.get(current);if(saved&&online()&&o.authorized()&&(!o.allowed||o.allowed())){until=saved.until;state=saved.state;}watchLease();trace.record('context',diagnosticState(),{reason:'context-change'});}return current;}
  function canEdit(){let same=null,authorized=null,allowed=null;
   const result=!disposed&&!expired&&(same=binding===o.binding())&&(authorized=o.authorized())&&(allowed=!o.allowed||o.allowed())&&(state==='connected'||state==='pending'||state==='checking')&&now()<until;
   if(trace.enabled()){
    const reason=result?'enabled':disposed?'disposed':expired?'permissions':same===false?'context-change':!authorized?'permissions':!allowed?'readonly':!['connected','pending','checking'].includes(state)?state:until>0?'expiration':'no-grant';
    diagnosticGate={authorized:typeof authorized==='boolean'?authorized:null,allowed:typeof allowed==='boolean'?allowed:null,canEdit:!!result,reason};trace.record('gate',diagnosticState(),{layer:'connection',...diagnosticGate});
   }return result;
  }
  function arm(ms){clear(timer);if(disposed||expired)return;timer=set(()=>{timer=null;if(o.visible&&!o.visible()){arm(interval);return;}check(false,true);},ms);}
  function pause(reason='offline'){
   if(disposed)return;scope();try{if(canEdit())o.retain?.();}catch(e){retentionFailed=true;reason='review';}
   epoch++;emit(reason);arm(Math.min(60000,15000*2**Math.min(attempt++,2)));
  }
  async function check(review=false,force=false){
   if(disposed)return false;if(o.defer?.())return false;scope();if(retentionFailed){emit('review');return false;}if(expired){emit('session');return false;}
   if(!o.authorized()){emit(o.readonly?.()?'readonly':'session');return false;}
   if(!online()){pause('offline');return false;}
   while(flight){const p=flight.promise;if(!review&&flight.key===binding)return p;await p;if(disposed)return false;scope();}if(!force&&!review&&canEdit()){arm(Math.min(interval,Math.max(0,until-now()-30000)));return true;}
   try{if(review&&canEdit())o.retain?.();}catch(e){retentionFailed=true;emit('review');return false;}
   const priorPending=state==='pending'||canEdit();
   const id=++epoch,key=binding;clear(timer);emit('checking');
   const same=()=>!disposed&&id===epoch&&key===o.binding();const valid=()=>same()&&o.authorized();
   const task={key,owner:o.owner?.()};flight=task;task.promise=(async()=>{try{
    const result=await o.verify({review,valid,force});if(['SESSION','DENIED'].includes(result?.code)&&o.owner&&task.owner===o.owner()){expired=true;epoch++;emit('session');return false;}if(!same())return false;
    if(result?.code==='SESSION'||result?.code==='DENIED'){expired=true;emit('session');return false;}
    if(!o.authorized()){if(o.defer?.())return false;emit('session');return false;}
    if(result?.code==='CLOSED'){emit('readonly');return false;}
    if(!result?.ok){emit(result?.conflict?'review':result?.code==='LOCAL_STORAGE'?'review':'server');return false;}
    if(result.conflict||(result.pending&&!review&&!priorPending)){emit('review');return false;}
    until=Math.min(now()+lease,Number.isFinite(result.validUntil)?result.validUntil:Infinity);if(until<=now()){emit('checking');return false;}grants.set(key,{until,state:result.pending?'pending':'connected'});watchLease();attempt=0;emit(result.pending?'pending':'connected');return true;
   }catch(e){if(valid()){if(['SESSION','DENIED'].includes(e.code)){expired=true;emit('session');}else emit(online()?'server':'offline');}return false;
   }finally{if(flight===task){flight=null;if(!disposed&&(binding!==o.binding()||(id!==epoch&&state==='checking'))){check(false,false);}else arm(state==='connected'||state==='pending'?Math.min(interval,Math.max(1000,until-now()-30000)):Math.min(60000,15000*2**Math.min(attempt++,2)));}}})();return task.promise;
  }
  const api={check,pause,canEdit,snapshot,diagnosticState,dispose(){disposed=true;epoch++;clear(timer);clear(expiryTimer);grants.clear();flight=null;},changed(pending=true){if(canEdit())emit(pending?'pending':'connected');},select(){scope();emit(state);if(canEdit())arm(Math.min(interval,Math.max(0,until-now()-30000)));},invalidate(){scope();epoch++;until=0;emit('checking');}};active=api;return api;
 }
 root.IERegistroConnection={create,canEdit:()=>!!active&&active.canEdit(),current:()=>active};
 if(typeof module!=='undefined')module.exports=root.IERegistroConnection;
})(typeof window==='undefined'?globalThis:window);
