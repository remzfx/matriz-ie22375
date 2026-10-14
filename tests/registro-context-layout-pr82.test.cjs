const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const source=fs.readFileSync(path.join(__dirname,'..','registro.html'),'utf8').replace(/\r\n/g,'\n'),normalize=require('./registro-context-layout-snapshot.cjs');
const old=execFileSync('git',['show','c0e7d47b27fdbd9abd138963a93427d797d42971:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
test('PR82 context layout normalization allows only approved markup/CSS; all academic scripts stay identical',()=>{
 assert.equal(normalize(source),old);assert.deepEqual([...source.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]),[...old.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]));
});
test('PR82 raw context has three independent direct grid columns: Bimestre, Grado and Sección',()=>{
 const start=source.indexOf('        <div class="registro-datos-grid">'),end=source.indexOf('        <div class="registro-datos-meta">',start),fragment=source.slice(start,end),columns=[];let depth=0;
 for(const m of fragment.matchAll(/<div\b[^>]*>|<\/div>/g)){if(m[0].startsWith('</'))depth--;else{if(depth===1)columns.push({start:m.index,tag:m[0]});depth++;}}
 assert.equal(depth,0);assert.equal(columns.length,3);assert.ok(fragment.slice(columns[0].start,columns[1].start).includes('id="selBim"'));assert.ok(fragment.slice(columns[1].start,columns[2].start).includes('id="selGrado"'));assert.ok(fragment.slice(columns[2].start).includes('id="selSeccion"'));assert.equal(columns[2].tag,'<div id="wrapSeccion">');
});
test('PR82 native Grade/Section selects are hidden by initial CSS; compact controls and exact events remain present',()=>{
 assert.match(source,/\.registro-datos-grid \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\); column-gap:24px;row-gap:10px;align-items:start; \}/);
 const hidden=source.match(/\.registro-datos-grid #selGrado,\.registro-datos-grid #selSeccion \{([^}]+)\}/);assert.ok(hidden);for(const rule of ['position:absolute','width:1px','height:1px','opacity:0','pointer-events:none'])assert.ok(hidden[1].includes(rule));assert.ok(source.indexOf(hidden[0])<source.indexOf('<body'));
 for(const [id,event] of [['selBim','cambiarBimestreRegistro()'],['selGrado','onGrado()'],['selSeccion','onContexto()']]){assert.equal((source.match(new RegExp('id="'+id+'"','g'))||[]).length,1);assert.ok(source.includes('<select id="'+id+'" onchange="'+event+'"></select>'));}
 for(const id of ['registroBotonesBim','registroBotonesGrado','registroBotonesSeccion'])assert.equal((source.match(new RegExp('id="'+id+'"','g'))||[]).length,1);assert.match(source,/\.registro-opcion \{min-width:34px;min-height:33px/);
});
test('PR82 snapshot guard rejects unapproved context events, spacing and duplicate hiding; never conceals academic changes',()=>{
 assert.throws(()=>normalize(source.replace('onchange="onGrado()"','onchange="onContexto()"')),/approved context/);
 assert.throws(()=>normalize(source.replace('column-gap:24px;row-gap:10px;align-items:start;','column-gap:2px;row-gap:10px;align-items:start;')),/approved context grid/);
 const line=source.split('\n').find(l=>l.startsWith('    .registro-datos-grid #selGrado,'));assert.throws(()=>normalize(source.replace(line,line+'\n'+line)),/native-select hiding/);
 const changed=source.replace('async function prepararVersionAcademica(){','async function prepararVersionAcademica(){\n  throw Error("Synthetic mutation");');assert.notEqual(normalize(changed),old);
});
