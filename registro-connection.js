/* Conexión obligatoria de Registro. Solo coordina lecturas; nunca escribe datos académicos. */
(function(root){
 'use strict';let active=null;
 function create(o){
  const now=o.now||Date.now,set=o.setTimeout||setTimeout,clear=o.clearTimeout||clearTimeout;
  const interval=o.interval||120000,lease=o.lease||150000;let state='checking',binding='',until=0,flight=null,timer=null,epoch=0,attempt=0,disposed=false,expired=false,published='',retentionFailed=false;
  const online=()=>o.online?o.online():true;
  function snapshot(){return {state,validUntil:until,pending:state==='pending',retentionFailed,binding};}
  function emit(next){state=next;if(next!=='connected'&&next!=='pending')until=0;const stamp=binding+'|'+next;if(stamp!==published){published=stamp;o.changed?.(snapshot());}}
  function scope(){const current=o.binding();if(binding!==current){binding=current;epoch++;until=0;expired=false;retentionFailed=false;state='checking';}return current;}
  function canEdit(){return !disposed&&!expired&&binding===o.binding()&&o.authorized()&&(state==='connected'||state==='pending')&&now()<until;}
  function arm(ms){clear(timer);if(disposed||expired)return;timer=set(()=>{timer=null;if(o.visible&&!o.visible()){arm(interval);return;}check(false,true);},ms);}
  function pause(reason='offline'){
   if(disposed)return;scope();try{if(canEdit())o.retain?.();}catch(e){retentionFailed=true;reason='review';}
   epoch++;emit(reason);arm(Math.min(60000,15000*2**Math.min(attempt++,2)));
  }
  async function check(review=false,force=false){
   if(disposed)return false;scope();if(retentionFailed){emit('review');return false;}if(expired){emit('session');return false;}
   if(!o.authorized()){emit(o.readonly?.()?'readonly':'session');return false;}
   if(!online()){pause('offline');return false;}
   if(flight)return flight.promise;if(!force&&!review&&canEdit())return true;
   try{if(canEdit())o.retain?.();}catch(e){retentionFailed=true;emit('review');return false;}
   const id=++epoch,key=binding;clear(timer);emit('checking');
   const same=()=>!disposed&&id===epoch&&key===o.binding();const valid=()=>same()&&o.authorized();
   const task={};flight=task;task.promise=(async()=>{try{
    const result=await o.verify({review,valid});if(!same())return false;
    if(result?.code==='SESSION'||result?.code==='DENIED'){expired=true;emit('session');return false;}
    if(!o.authorized()){emit('session');return false;}
    if(result?.code==='CLOSED'){emit('readonly');return false;}
    if(!result?.ok){emit(result?.conflict?'review':result?.code==='LOCAL_STORAGE'?'review':'server');return false;}
    if(result.conflict||(result.pending&&!review)){emit('review');return false;}
    until=now()+lease;attempt=0;emit(result.pending?'pending':'connected');return true;
   }catch(e){if(valid()){if(['SESSION','DENIED'].includes(e.code)){expired=true;emit('session');}else emit(online()?'server':'offline');}return false;
   }finally{if(flight===task){flight=null;arm(state==='connected'||state==='pending'?interval:Math.min(60000,15000*2**Math.min(attempt++,2)));}}})();return task.promise;
  }
  const api={check,pause,canEdit,snapshot,dispose(){disposed=true;epoch++;clear(timer);flight=null;},changed(pending=true){if(canEdit())emit(pending?'pending':'connected');},invalidate(){scope();epoch++;until=0;emit('checking');}};active=api;return api;
 }
 root.IERegistroConnection={create,canEdit:()=>!!active&&active.canEdit(),current:()=>active};
 if(typeof module!=='undefined')module.exports=root.IERegistroConnection;
})(typeof window==='undefined'?globalThis:window);
