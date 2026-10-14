const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{fixture,build}=require('./registro-full-visual-fixture.cjs');
const src=fs.readFileSync(path.join(__dirname,'..','registro.html'),'utf8').replace(/\r\n/g,'\n'),css=src.match(/<style>([\s\S]*?)<\/style>/)[1];
const cases=[['secundaria','Educación para el Trabajo (EPT)',1],['secundaria','Arte y Cultura',2],['secundaria','Comunicación',3],['secundaria','Matemática',4],['primaria','Arte y Cultura',2],['primaria','Comunicación',3],['primaria','Matemática',4],['primaria','Personal Social',5]];
for(const [level,area,n]of cases)for(const viewport of [1366,390])for(const closed of [false,true])test('Full Registro structural fixture '+level+' '+n+' competences '+viewport+'px '+(closed?'closed':'open'),()=>{
 const f=fixture(level,area,closed);assert.equal(f.comps.length,n);const before=JSON.stringify(f.c.store),calls=f.calls.length;
 f.c.renderStudents();f.c.renderFinales();f.c.renderAvance();f.c.renderAsistencia();
 const cal=f.el('stuList').innerHTML,final=f.el('finLista').innerHTML,summary=f.el('avanceBox').innerHTML,asis=f.el('asisLista').innerHTML;
 assert.equal((cal.match(/data-val="/g)||[]).length,40*n*4);assert.equal((cal.match(/<tr>/g)||[]).length,41);assert.equal((summary.match(/class="summary-competence"/g)||[]).length,40*n);
 for(const al of f.alumnos)for(const s of [cal,final,summary,asis])assert.ok(s.includes(al.nombre));assert.match(final,/Conclusión ficticia extensa/);assert.doesNotMatch(summary,/Conclusión ficticia extensa|<textarea|<input/);
 assert.equal((asis.match(/data-av="/g)||[]).length,160);assert.match(asis,/07:30/);assert.deepEqual(['aP','aF','aT','aJ'].map(id=>f.el(id).textContent),[10,10,10,10]);
 if(closed){assert.equal((cal.match(/ disabled>/g)||[]).length,40*n*4);f.el('asisLista').onclick({target:{closest:()=>({dataset:{an:encodeURIComponent(f.c.studentKey(f.alumnos[0])),av:'F'}})}});}
 assert.equal(JSON.stringify(f.c.store),before);assert.equal(f.calls.length,calls);
 assert.match(css,/#stuList \.fin-cell:has\(> button\[data-val\]\) \{display:grid;grid-template-columns:repeat\(4,40px\);gap:4px;width:172px/);
 if(viewport===390)assert.match(css,/@media\(max-width:640px\) \{\s*#stuList \.fin-grid \.fin-nom \{width:120px;min-width:120px;max-width:120px;/);
});
test('Calificar has scoped horizontal touch controls, complete names and internal table scrolling',()=>{
 assert.match(css,/#stuList \.fin-cell > \.chip\[data-val\] \{[^}]*width:40px;min-width:40px;min-height:40px;[^}]*border-radius:10px/);assert.match(css,/#stuList \.chip\[data-val\]\.on \{box-shadow:none/);assert.match(css,/#stuList \.chip\[data-val\]:focus-visible \{outline:3px/);assert.match(css,/\.fin-wrap \{ overflow-x:auto/);assert.match(css,/#stuList \{min-width:0;max-width:100%;/);assert.match(css,/#stuList \.fin-grid \.fin-nom \.font-bold \{white-space:normal;overflow-wrap:anywhere/);assert.ok(40*4+4*3===172);assert.ok(172+6*2<=200);
});
test('Attendance names cannot be ellipsized, its mark controls and footer keep 44px targets',()=>{
 assert.match(css,/#asisLista \.truncate \{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;/);assert.match(css,/#asisLista \.stu-row > \.flex \{display:grid;grid-template-columns:24px minmax\(0,1fr\) auto;/);assert.match(css,/#asisLista \.asis-chip \{box-sizing:border-box;min-width:44px;height:44px;/);assert.match(css,/#registroAcademicFooter button \{min-height:44px;/);
});
test('Entire production change since reviewed PR head is CSS only: renderers, handlers, markup, A1 B1 B2 unchanged',()=>{
 const base='f75a52e2510f7ca982e7172b16900626ab7a6eb8',old=execFileSync('git',['show',base+':registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');const strip=s=>s.replace(/<style>[\s\S]*?<\/style>/,'');assert.equal(strip(src),strip(old));for(const p of ['apps-script/Codigo.js','registro-reconcile.js','registro-transversales.js','matrix-registry-import.js','students.js','sw.js','primaria.html','secundaria.html'])assert.equal(fs.readFileSync(path.join(__dirname,'..',p),'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n'));
});
test('Fixture contains real data/form/footer and all four actual renderers, remains offline and synthetic',()=>{
 const html=build();assert.match(html,/default-src 'none'/);for(const id of ['registroDatosPanel','inpFecha','selUnidad','selComp','selCap','stuList','finLista','avanceBox','asisLista','registroAcademicFooter'])assert.ok(html.includes('id="'+id+'"'),id);for(const text of ['Guardar','Subir Nube','Bajar Nube','ESTUDIANTE FICTICIO','Conclusión ficticia'])assert.ok(html.includes(text));assert.doesNotMatch(html,/<script|https:\/\/script.google/);
});

test('Standalone fixture generator accepts its output path without confusing it with backend source',()=>{
 const os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'pr81-ficticio-')),file=path.join(dir,'fixture.html');try{execFileSync(process.execPath,[path.join(__dirname,'registro-full-visual-fixture.cjs'),file,'secundaria','Comunicación','closed']);const html=fs.readFileSync(file,'utf8');assert.match(html,/3 competencias · cerrado/);assert.match(html,/data-val="C" disabled/);assert.match(html,/ESTUDIANTE FICTICIO/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

function contrast(a,b){const lum=h=>{const rgb=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [level,bg,fg,border]of [['c','#fee2e2','#991b1b','#fca5a5'],['b','#fef3c7','#92400e','#fcd34d'],['a','#dcfce7','#166534','#86efac'],['ad','#e0f2fe','#075985','#7dd3fc']])test('Soft selected '+level.toUpperCase()+' is scoped to academic controls with legible contrast',()=>{
 assert.ok(src.includes(':is(#stuList,#finLista) .chip[data-val].nivel-'+level+'.on {background:'+bg+';color:'+fg+';border-color:'+border+';}'));assert.ok(contrast(bg,fg)>=4.5);if(level==='ad')assert.notEqual(bg,'#dcfce7');
});
test('Unselected academic decisions are neutral without heavy borders/shadows and keep compact touch targets',()=>{
 assert.match(css,/:is\(#stuList,#finLista\) \.chip\[data-val\],#panelFinales \.fin-bulk-actions \.chip \{background:#f8fafc;color:#475569;border:1px solid #cbd5e1;box-shadow:none;touch-action:manipulation;/);assert.match(css,/#finLista \.final-grade > \.fin-cell > \.chip\[data-val\] \{width:40px;min-width:40px;min-height:40px;height:40px;justify-self:center;border-radius:10px;/);assert.match(css,/#stuList \.fin-cell > \.chip\[data-val\] \{box-sizing:border-box;width:40px;min-width:40px;min-height:40px;height:40px;/);assert.match(css,/#finLista \.final-grade \{width:188px;min-width:188px;/);assert.match(css,/#finLista \.final-grade \{width:182px;min-width:182px;/);assert.doesNotMatch(css,/#finLista \.nivel-(a|b|ad)\.on \{background:#(4d7c0f|c2410c|15803d)/);
});
