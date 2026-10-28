/* Conexión obligatoria de Registro. Solo coordina lecturas; nunca escribe datos académicos. */
(function(root){
 'use strict';let active=null;
 function create(o){
  const now=o.now||Date.now,set=o.setTimeout||setTimeout,clear=o.clearTimeout||clearTimeout;
  const interval=o.interval||120000,lease=o.lease||150000;let state='checking',binding='',until=0,flight=null,timer=null,epoch=0,attempt=0,disposed=false,expired=false,published='',retentionFailed=false;
  const grants=new Map();let expiryTimer=null;
  const online=()=>o.online?o.online():true;
  function watchLease(){clear(expiryTimer);expiryTimer=null;if(until>now()){const key=binding;expiryTimer=set(()=>{expiryTimer=null;if(key===binding&&now()>=until){grants.delete(key);emit('checking');}},until-now());}}
  function snapshot(){return {state,validUntil:until,pending:state==='pending',retentionFailed,binding};}
  function emit(next){state=next;if(next!=='connected'&&next!=='pending'&&!(next==='checking'&&now()<until)){until=0;clear(expiryTimer);grants.delete(binding);}if(['offline','server','session'].includes(next))grants.clear();const stamp=binding+'|'+next+'|'+(now()<until);if(stamp!==published){published=stamp;o.changed?.(snapshot());}}
  function scope(){const current=o.binding();if(binding!==current){binding=current;epoch++;until=0;expired=false;retentionFailed=false;state='checking';for(const [key,g]of grants)if(g.until<=now())grants.delete(key);const saved=grants.get(current);if(saved&&online()&&o.authorized()&&(!o.allowed||o.allowed())){until=saved.until;state=saved.state;}watchLease();}return current;}
  function canEdit(){return !disposed&&!expired&&binding===o.binding()&&o.authorized()&&(!o.allowed||o.allowed())&&(state==='connected'||state==='pending'||state==='checking')&&now()<until;}
  function arm(ms){clear(timer);if(disposed||expired)return;timer=set(()=>{timer=null;if(o.visible&&!o.visible()){arm(interval);return;}check(false,true);},ms);}
  function pause(reason='offline'){
   if(disposed)return;scope();try{if(canEdit())o.retain?.();}catch(e){retentionFailed=true;reason='review';}
   epoch++;emit(reason);arm(Math.min(60000,15000*2**Math.min(attempt++,2)));
  }
  async function check(review=false,force=false){
   if(disposed)return false;scope();if(retentionFailed){emit('review');return false;}if(expired){emit('session');return false;}
   if(!o.authorized()){emit(o.readonly?.()?'readonly':'session');return false;}
   if(!online()){pause('offline');return false;}
   while(flight){const p=flight.promise;if(!review&&flight.key===binding)return p;await p;if(disposed)return false;scope();}if(!force&&!review&&canEdit())return true;
   try{if(review&&canEdit())o.retain?.();}catch(e){retentionFailed=true;emit('review');return false;}
   const priorPending=state==='pending'||canEdit();
   const id=++epoch,key=binding;clear(timer);emit('checking');
   const same=()=>!disposed&&id===epoch&&key===o.binding();const valid=()=>same()&&o.authorized();
   const task={key,owner:o.owner?.()};flight=task;task.promise=(async()=>{try{
    const result=await o.verify({review,valid,force});if(['SESSION','DENIED'].includes(result?.code)&&o.owner&&task.owner===o.owner()){expired=true;epoch++;emit('session');return false;}if(!same())return false;
    if(result?.code==='SESSION'||result?.code==='DENIED'){expired=true;emit('session');return false;}
    if(!o.authorized()){emit('session');return false;}
    if(result?.code==='CLOSED'){emit('readonly');return false;}
    if(!result?.ok){emit(result?.conflict?'review':result?.code==='LOCAL_STORAGE'?'review':'server');return false;}
    if(result.conflict||(result.pending&&!review&&!priorPending)){emit('review');return false;}
    until=Math.min(now()+lease,Number.isFinite(result.validUntil)?result.validUntil:Infinity);if(until<=now()){emit('checking');return false;}grants.set(key,{until,state:result.pending?'pending':'connected'});watchLease();attempt=0;emit(result.pending?'pending':'connected');return true;
   }catch(e){if(valid()){if(['SESSION','DENIED'].includes(e.code)){expired=true;emit('session');}else emit(online()?'server':'offline');}return false;
   }finally{if(flight===task){flight=null;if(!disposed&&(binding!==o.binding()||(id!==epoch&&state==='checking'))){check(false,false);}else arm(state==='connected'||state==='pending'?Math.min(interval,Math.max(1000,until-now()-30000)):Math.min(60000,15000*2**Math.min(attempt++,2)));}}})();return task.promise;
  }
  const api={check,pause,canEdit,snapshot,dispose(){disposed=true;epoch++;clear(timer);clear(expiryTimer);grants.clear();flight=null;},changed(pending=true){if(canEdit())emit(pending?'pending':'connected');},select(){scope();emit(state);if(canEdit())arm(Math.min(interval,Math.max(0,until-now()-30000)));},invalidate(){scope();epoch++;until=0;emit('checking');}};active=api;return api;
 }
 root.IERegistroConnection={create,canEdit:()=>!!active&&active.canEdit(),current:()=>active};
 if(typeof module!=='undefined')module.exports=root.IERegistroConnection;
})(typeof window==='undefined'?globalThis:window);
