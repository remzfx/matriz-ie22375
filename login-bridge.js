// Transporte de login; solo memoria, nunca almacenamiento de credenciales.
(function(global) {
  'use strict';
  const CHANNEL = 'IE22375_LOGIN_BRIDGE_V1';
  const PARENTS = ['https://matriz.biblioteca360.com','https://biblioteca360.com','https://www.biblioteca360.com','https://remzfx.github.io'];
  function create(api) {
    if (!PARENTS.includes(global.location.origin) || !global.crypto || !global.crypto.getRandomValues) return null;
    const random = new Uint8Array(16); global.crypto.getRandomValues(random);
    const nonce = Array.from(random, n => n.toString(16).padStart(2,'0')).join('');
    const url = new URL(api);
    if (url.origin !== 'https://script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) return null;
    url.search = ''; url.hash = '';
    url.searchParams.set('bridge','login-v1');
    url.searchParams.set('parentOrigin',global.location.origin);
    url.searchParams.set('nonce',nonce);
    const frame = global.document.createElement('iframe');
    frame.hidden = true; frame.title = 'Verificación de acceso'; frame.referrerPolicy = 'no-referrer';
    let peer = null, origin = '', ready = false, pending = null, sequence = 0;
    function finish(error, value) {
      if (!pending) return;
      const task = pending; pending = null; clearTimeout(task.timer);
      if (error) task.reject(error); else task.resolve(value);
    }
    function fault(code) { const e = new Error('No se pudo completar el acceso mediante el puente seguro.'); e.code = code; return e; }
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
      } else if (data.type === 'ack' && peer) ready = true;
      else if (ready && pending && data.id === pending.id) {
        if (data.type === 'result' && data.result && typeof data.result.ok === 'boolean') finish(null,data.result);
        else if (data.type === 'error') finish(fault('BRIDGE_ERROR'));
      }
    }
    global.addEventListener('message',receive);
    frame.addEventListener('error',()=>{ready=false;finish(fault('BRIDGE_UNAVAILABLE'));});
    frame.src = url.href; global.document.body.appendChild(frame);
    return {
      ready:()=>ready,
      login:(tipo,usuario,password)=>{
        if (!ready || pending) return Promise.reject(fault('BRIDGE_UNAVAILABLE'));
        const id = ++sequence;
        return new Promise((resolve,reject)=>{
          pending = {id:id,resolve:resolve,reject:reject,timer:setTimeout(()=>{ready=false;finish(fault('BRIDGE_TIMEOUT'));},18000)};
          try { peer.postMessage({channel:CHANNEL,type:'login',nonce:nonce,id:id,body:{tipo:tipo,usuario:usuario,password:password}},origin); }
          catch(e) { ready=false;finish(fault('BRIDGE_ERROR')); }
        });
      }
    };
  }
  global.IELoginBridge = {create:create};
})(window);
