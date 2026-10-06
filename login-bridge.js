// Transporte de login; solo memoria, nunca almacenamiento de credenciales.
(function(global) {
  'use strict';
  const CHANNEL = 'IE22375_LOGIN_BRIDGE_V1';
  const PARENTS = ['https://matriz.biblioteca360.com','https://biblioteca360.com','https://www.biblioteca360.com','https://remzfx.github.io'];
  function create(api, mode = 'login') {
    if (!['login','students','transversales'].includes(mode)) return null;
    if (!PARENTS.includes(global.location.origin) || !global.crypto || !global.crypto.getRandomValues) return null;
    const random = new Uint8Array(16); global.crypto.getRandomValues(random);
    const nonce = Array.from(random, n => n.toString(16).padStart(2,'0')).join('');
    const url = new URL(api);
    if (url.origin !== 'https://script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) return null;
    url.search = ''; url.hash = '';
    url.searchParams.set('bridge',mode + '-v1');
    url.searchParams.set('parentOrigin',global.location.origin);
    url.searchParams.set('nonce',nonce);
    const frame = global.document.createElement('iframe');
    frame.hidden = true; frame.title = 'Verificación de acceso'; frame.referrerPolicy = 'no-referrer';
    let peer = null, origin = '', ready = false, failed = false, sequence = 0;
    const pending = new Map(), waiters = new Set();
    function finish(id, error, value) {
      const task = pending.get(id); if (!task) return;
      pending.delete(id); clearTimeout(task.timer);
      if (error) task.reject(error); else task.resolve(value);
    }
    function fault(code) { const e = new Error('No se pudo completar la solicitud mediante el puente seguro.'); e.code = code; e.retryable = true; return e; }
    function availability(value) { waiters.forEach(fn=>fn(value)); waiters.clear(); }
    function belongsToFrame(source) {
      try {
        for (let i=0; source && i<5; i++,source=source.parent) {
          if (source === frame.contentWindow) return true;
          if (source.parent === source) break;
        }
      } catch(e) {}
      return false;
    }
    function googleOrigin(value) {
      return value === 'https://script.google.com' || value === 'https://script.googleusercontent.com' ||
        /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(value);
    }
    function receive(event) {
      const data = event.data;
      if (!data || data.channel !== CHANNEL || data.nonce !== nonce || !googleOrigin(event.origin) || !belongsToFrame(event.source)) return;
      if (peer && (event.source !== peer || event.origin !== origin)) return;
      if (data.type === 'ready' && !peer) {
        peer = event.source; origin = event.origin;
        peer.postMessage({channel:CHANNEL,type:'init',nonce:nonce},origin);
      } else if (data.type === 'ack' && peer) { ready = true; availability(true); }
      else if (ready && pending.has(data.id)) {
        if (data.type === 'result' && data.result && typeof data.result.ok === 'boolean') finish(data.id,null,data.result);
        else if (data.type === 'error') finish(data.id,fault('BRIDGE_ERROR'));
      }
    }
    global.addEventListener('message',receive);
    frame.addEventListener('error',()=>{ready=false;failed=true;availability(false);pending.forEach((task,id)=>finish(id,fault('BRIDGE_UNAVAILABLE')));});
    frame.src = url.href; global.document.body.appendChild(frame);
    function send(type, body) {
        if (!ready || (mode === 'login' && pending.size)) return Promise.reject(fault('BRIDGE_UNAVAILABLE'));
        const id = ++sequence;
        return new Promise((resolve,reject)=>{
          pending.set(id,{resolve:resolve,reject:reject,timer:setTimeout(()=>{if (mode === 'login') ready=false;finish(id,fault('BRIDGE_TIMEOUT'));},mode === 'login' ? 18000 : 12000)});
          try { peer.postMessage({channel:CHANNEL,type:type,nonce:nonce,id:id,body:body},origin); }
          catch(e) { ready=false;finish(id,fault('BRIDGE_ERROR')); }
        });
    }
    return {
      ready:()=>ready,
      whenReady:()=>ready || failed ? Promise.resolve(ready) : new Promise(resolve=>{
        const done=value=>{clearTimeout(timer);waiters.delete(done);resolve(value);};
        const timer=setTimeout(()=>done(false),12000);waiters.add(done);
      }),
      login:(tipo,usuario,password)=>mode === 'login' ? send('login',{tipo,usuario,password}) : Promise.reject(fault('BRIDGE_UNAVAILABLE')),
      loadStudents:body=>mode === 'students' ? send('students',{token:body.token,bimestre:body.bimestre || ''}) : Promise.reject(fault('BRIDGE_UNAVAILABLE')),
      transversales:body=>mode === 'transversales' ? send('transversales',body) : Promise.reject(fault('BRIDGE_UNAVAILABLE'))
    };
  }
  global.IELoginBridge = {create:create};
})(window);
