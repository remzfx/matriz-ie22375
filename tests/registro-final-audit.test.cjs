const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {fixture}=require('./registro-full-visual-fixture.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8').replace(/\r\n/g,'\n');
const src=read('registro.html'),reviewed='0d20b1483bc13ce23d7b5337490d772a8e6315f3';
test('Final stabilization preserves ALL reviewed production source, backend, A1/B1/B2 and SW byte-for-byte',()=>{
 for(const p of ['registro.html','apps-script/Codigo.js','registro-reconcile.js','registro-transversales.js','registro-academic-model.js','students.js','matrix-registry-import.js','primaria.html','secundaria.html','auxiliar.html','sw.js'])assert.equal(read(p),execFileSync('git',['show',reviewed+':'+p],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n'),p);
});
test('Current comparative control is unique and in the main header, outside the auxiliary information row',()=>{
 const a=src.indexOf('<header class="fin-header">'),h=src.slice(a,src.indexOf('</header>',a));
 assert.equal((src.match(/id="btnComparativoBim"/g)||[]).length,1);
 assert.match(h,/<\/div>\s*<button[^>]*id="btnComparativoBim"[^>]*onclick="alternarComparativoBim\(\)"/);
 assert.ok(h.indexOf('btnComparativoBim')>h.indexOf('id="finResumen"'));
 assert.ok(h.indexOf('btnComparativoBim')<h.indexOf('fin-header-controls'));
});
test('Approved 34px letters preserve 12px text, fixed grade geometry and focus indication',()=>{
 assert.match(src,/grid-template-columns:repeat\(4,34px\)/);
 assert.match(src,/width:34px;min-width:34px;min-height:34px;height:34px;justify-self:center;border-radius:9px;font-size:12px/);
 for(const w of [188,182]){assert.match(src,new RegExp('\\.final-grade \\{width:'+w+'px;min-width:'+w+'px;'));assert.ok(34*4+2*3<=w);}
 assert.match(src,/#finLista \.chip\[data-val\]:focus-visible \{outline:3px solid #0369a1/);
});
test('Student ordinal stays beside the sticky two-line name with approved desktop/mobile widths',()=>{
 for(const w of [202,150])assert.match(src,new RegExp('\\.fin-nom \\{width:'+w+'px;min-width:'+w+'px;max-width:'+w+'px;'));
 assert.match(src,/td\.fin-nom > div:first-child \{position:absolute;left:6px;top:50%;transform:translateY\(-50%\)/);
 assert.match(src,/td\.fin-nom > \.font-bold \{display:-webkit-box;[^}]*line-clamp:2;[^}]*overflow-wrap:anywhere;white-space:normal/);
 assert.match(src,/td\.fin-nom \{position:sticky;padding:5px 6px 5px 25px/);
});
test('Historical indicators start below C and never recenter across the grade block',()=>{
 assert.match(src,/:not\(\[data-val\]\) \{ grid-column:1 \/ -1; justify-self:start/);
 assert.match(src,/\.comp-hist-line\{display:flex;align-self:flex-start;align-items:center;justify-content:flex-start;[^}]*width:142px;max-width:100%;[^}]*text-align:left/);
});
test('Compact conclusions and full print text use separate scoped styles',()=>{
 assert.match(src,/#finLista \.final-conclusion select \{height:32px;min-height:32px;max-width:132px/);
 const print=src.slice(src.indexOf('  /* Solo impresión Promedios:'),src.indexOf('/* Fin Visual Registro'));
 assert.match(print,/#printArea \.promedios-print/);assert.match(print,/font-size:7.5pt/);assert.match(print,/white-space:pre-wrap/);assert.doesNotMatch(print,/line-clamp|text-overflow:ellipsis|max-height|overflow:hidden/);
});
const areas=[['secundaria','Educación para el Trabajo (EPT)',1],['secundaria','Arte y Cultura',2],['secundaria','Comunicación',3],['secundaria','Matemática',4],['primaria','Personal Social',5]];
for(const [level,area,n]of areas)for(const closed of [false,true])test('Current raw Promedios '+level+' '+n+' competencies '+(closed?'closed':'open')+' preserves identity, data and readonly scope',()=>{
 const f=fixture(level,area,closed),before=JSON.stringify(f.c.store),calls=f.calls.length;
 assert.equal(f.comps.length,n);f.c.renderFinales();const h=f.el('finLista').innerHTML;
 const rows=h.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>[\s\S]*?<\/tr>/g);assert.equal(rows.length,40);
 for(const [i,row]of rows.entries()){assert.ok(row.includes(f.alumnos[i].nombre));assert.equal((row.match(/class="final-cell-layout(?: has-conclusion)?"/g)||[]).length,n);assert.equal((row.match(/data-val="/g)||[]).length,n*4);if(closed)assert.equal((row.match(/data-val="[^"]+"[^>]* disabled/g)||[]).length,n*4);}
 assert.equal(JSON.stringify(f.c.store),before);assert.equal(f.calls.length,calls);
});
