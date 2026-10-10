const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const {grid,dom}=new Function('require','__dirname',read('tests/transversales-grid.test.cjs').split('\ntest(')[0]+'\nreturn {grid,dom};')(require,__dirname);
const areas={'Arte y Cultura':'ART','Ciencia y Tecnología':'CYT','Ciencias Sociales':'CCSS','Comunicación':'COM','Desarrollo Personal, Ciudadanía y Cívica':'DPCC','Educación Física':'EFIS','Educación Religiosa':'REL','Educación para el Trabajo':'EPT','Inglés':'ING','Matemática':'MAT'};
function draw(f,data=clone(f.server.load('admin'))){const box=dom()('div');f.f.c.window.IETransversales.editor(box,data,f.server.ctx,true);return box;}
const cells=box=>box.querySelectorAll('td').filter(x=>x.className==='trans-area-cell');
for(const [official,short] of Object.entries(areas))test('Tutor header '+official+' uses '+short+' with official title',()=>{
 const f=grid(),data=clone(f.data);data.areas=Object.keys(areas);const before=JSON.stringify(data),box=draw(f,data),head=box.querySelectorAll('th').find(x=>x.className==='trans-area-header'&&x.title===official);
 assert.ok(head);assert.equal(head.textContent,short);assert.equal(head.title,official);assert.equal(JSON.stringify(data),before);
});
test('Missing contributions show only em dash without details, arrows or pending label',()=>{
 const f=grid(),empty=cells(f.box).filter(x=>x.textContent==='—');assert.equal(empty.length,2);empty.forEach(cell=>{assert.equal(cell.children.length,0);assert.equal(cell.querySelectorAll('details').length,0);assert.equal(cell.querySelectorAll('summary').length,0);});
});
for(const level of ['AD','A','B','C'])test('Real '+level+' contribution opens only its level without prefixed arrow',()=>{
 const f=grid();assert.equal(f.server.aporte('math',level).ok,true);const box=draw(f),cell=cells(box).find(x=>x.querySelectorAll('summary').length);
 const summary=cell.querySelectorAll('summary')[0];assert.equal(summary.textContent,level);assert.equal(cell.querySelectorAll('details')[0].className,'trans-detail');
 assert.ok(cell.querySelectorAll('p').some(p=>p.textContent.includes('Matemática · Synthetic Math')));
});
test('C lacking required teacher conclusion shows C warning and preserves official pending validation',()=>{
 const f=grid();f.server.aporte('math','C');const a=f.server.load('math').aportes[0],e=clone(a.evidencia);e.conclusiones={};assert.equal(f.server.route('savetransversalaporte','math',{area:'Matemática',version:a.version,evidencia:e}).ok,true);
 const data=f.server.load('math'),box=draw(f,data),cell=cells(box).find(x=>x.querySelectorAll('summary').length);assert.equal(cell.querySelectorAll('summary')[0].textContent,'C ⚠');
 assert.ok(data.aportesPendientes.some(p=>p.area==='Matemática'&&p.motivo==='Aporte C pendiente de conclusión'));
});
test('Complete value remains visible even when another assigned teacher has no contribution',()=>{
 const f=grid(),data=clone(f.data);data.aportesPendientes.push({id:f.server.id,comp:'tic',area:'Matemática',user:'synthetic-second',motivo:'Sin aporte'});
 assert.equal(cells(draw(f,data)).find(x=>x.querySelectorAll('summary').length).querySelectorAll('summary')[0].textContent,'A');assert.ok(data.aportesPendientes.some(p=>p.user==='synthetic-second'));
});
for(const file of ['registro.html','transversales.html'])test(file+': narrow centered areas remove native markers while retaining student width and scroll',()=>{
 const css=read(file);assert.match(css,/th.trans-area-header,\.trans-grid td.trans-area-cell\{width:56px;min-width:48px;[^}]*text-align:center;vertical-align:middle/);
 assert.match(css,/trans-area-cell>.trans-detail>summary\{[^}]*list-style:none;min-width:0/);assert.match(css,/summary::-webkit-details-marker\{display:none\}/);
 assert.match(css,/trans-student\{[^}]*min-width:220px;[^}]*text-align:left/);assert.match(css,/overflow-x:auto/);
});
test('Rendering compact areas never rewrites canonical contribution names, history or versions',()=>{
 const f=grid(),data=clone(f.data),before=JSON.stringify(data),history=JSON.stringify([...f.server.tables].map(([name,s])=>[name,s.rows])),writes=f.server.state.writes;draw(f,data);
 assert.equal(JSON.stringify(data),before);assert.equal(JSON.stringify([...f.server.tables].map(([name,s])=>[name,s.rows])),history);assert.equal(f.server.state.writes,writes);assert.equal(data.aportes[0].area,'Matemática');
});
