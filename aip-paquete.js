/* The AIP backend stores one opaque JSON payload in a Sheets cell. */
(function(root){
 'use strict';
 const limit=49000,expandedLimit=2000000,encoding='gzip-base64-v1';
 async function collect(stream){
  const reader=stream.getReader(),chunks=[];
  let size=0;
  try{
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.length;
    if(size>expandedLimit){await reader.cancel();throw new Error('El plan AIP supera el tamaño admitido.');}
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
 }
 async function encode(payload){
  const raw=JSON.stringify(payload);
  if(raw.length<=limit)return payload;
  if(typeof CompressionStream!=='function')throw new Error('Este navegador no puede compactar el plan anual. El plan quedó guardado localmente.');
  const bytes=new TextEncoder().encode(raw);
  if(bytes.length>expandedLimit)throw new Error('El plan AIP supera el tamaño admitido. El plan quedó guardado localmente.');
  const compact=await collect(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));
  let binary='';
  for(let i=0;i<compact.length;i+=8192)binary+=String.fromCharCode(...compact.subarray(i,i+8192));
  const packageAip={aipEncoding:encoding,data:btoa(binary)};
  if(JSON.stringify(packageAip).length>limit)throw new Error('El plan supera el espacio disponible en la nube. El plan quedó guardado localmente.');
  return packageAip;
 }
 async function decode(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Paquete AIP inválido.');
  if(!Object.hasOwn(payload,'aipEncoding'))return payload;
  if(payload.aipEncoding!==encoding||typeof payload.data!=='string'||payload.data.length>limit||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.data)||typeof DecompressionStream!=='function')throw new Error('Formato de plan AIP no compatible.');
  const bytes=Uint8Array.from(atob(payload.data),char=>char.charCodeAt(0));
  const raw=await collect(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
  const plan=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(!plan?.plan||typeof plan.plan!=='object'||Array.isArray(plan.plan))throw new Error('Plan AIP compacto inválido.');
  return plan;
 }
 root.IEAipPaquete={encode,decode,limit};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.IEAipPaquete;
})(typeof window==='undefined'?globalThis:window);
