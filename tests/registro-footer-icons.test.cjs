const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8').replace(/\r\n/g,'\n'),html=read('registro.html');
const footer=s=>{const a=s.indexOf('  <div id="registroAcademicFooter"');return s.slice(a,s.indexOf('\n</div>\n',a));};
const css=s=>s.slice(s.indexOf('  /* Recovery footer:'),s.indexOf('  /* End recovery footer. */')+'  /* End recovery footer. */\n'.length);
const row=footer(html).match(/<div class="registro-recovery-actions"[^>]*>([\s\S]*?)<\/div>/),buttons=[...row[1].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
const expected=[['download()','cloud-download','Bajar Nube'],['resolve()','git-compare','Revisar diferencias'],['save()','save','Guardar'],['process()','cloud-upload','Procesar a Promedios'],['undo()','undo-2','Deshacer recuperación'],['drafts()','history','Recuperar borrador'],['refresh(true)','refresh-cw','Reintentar notas']];
for(const [i,[handler,icon,label]] of expected.entries())test('footer action '+label+' retains its handler and has its own decorative inline SVG',()=>{
 const [all,attrs,content]=buttons[i];assert.ok(attrs.includes('onclick="'+([0,2,3].includes(i)?'IERegistroNotas2UI.':'IERegistroRecovery.')+handler+'"'));assert.match(content,new RegExp('data-icon="'+icon+'"'));assert.match(content,/viewBox="0 0 24 24"/);assert.match(content,/aria-hidden="true" focusable="false"/);assert.match(content,/stroke="currentColor" stroke-width="2"/);assert.match(content,/<path d="[^"]+"/);assert.ok(content.endsWith('<span>'+label+'</span>'));assert.equal((content.match(/<svg /g)||[]).length,1);assert.doesNotMatch(all,/<use|<image|<script|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
});
test('footer scroller is keyboard focusable, named and has a visible overflow/focus indicator',()=>{
 assert.match(row[0],/role="group"/);assert.match(row[0],/tabindex="0"/);assert.match(row[0],/aria-label="Acciones de notas · desplázate horizontalmente para ver más"/);const c=css(html);assert.match(c,/scrollbar-width:thin;scrollbar-color:/);assert.match(c,/::-webkit-scrollbar \{height:6px;/);assert.match(c,/:focus-visible \{outline:2px solid/);assert.match(c,/padding:4px 2px/);assert.doesNotMatch(c,/scrollbar-width:none|outline:none|scrollbar[^}]*display:none/);
});
test('every combination of contextual controls stays in the same structural row on desktop and 390px',()=>{
 // Structural regression, not a browser measurement: all 16 visibility combinations
 // retain one flex track; no mobile rule permits wrapping or shrinking controls.
 assert.equal(buttons.length,7);const c=css(html),base=c.match(/\.registro-recovery-actions \{([^}]*)\}/)[1],mobile=c.match(/@media\(max-width:640px\)\{[^}]*\{([^}]*)\}/)[1];
 for(const width of [390,1366])for(let mask=0;mask<16;mask++){
  const visible=buttons.filter((b,i)=>![1,4,5,6].includes(i)||(mask&(1<<[1,4,5,6].indexOf(i))));assert.equal(visible.length,3+[0,1,2,3].filter(i=>mask&(1<<i)).length);
  assert.match(base,/display:flex;flex-wrap:nowrap/);if(width<=640)assert.match(mobile,/flex-wrap:nowrap/);assert.match(c,/button \{[^}]*flex:0 0 auto;min-height:44px/);
  assert.match(base,/width:100%;max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden/);for(const b of visible)assert.doesNotMatch(b[1],/basis-full|w-full|grid-row|order-/);
 }
 assert.doesNotMatch(c,/flex-wrap:wrap|flex-direction:column|overflow-x:hidden/);assert.match(c,/button\[hidden\][^{]*\{display:none!important/);
});
test('only the actions track scrolls; opaque footer keeps status/alerts outside and preserves height reservation',()=>{
 const c=css(html),f=footer(html);assert.match(c,/#registroAcademicFooter \{background:#fff;/);assert.equal((c.match(/overflow-x:auto/g)||[]).length,1);assert.doesNotMatch(c,/#registroAcademicFooter[^}]*overflow|#registroRecoveryControls \{[^}]*overflow/);assert.ok(f.indexOf('id="registroSaveState"')>f.indexOf('</div>',f.indexOf('class="registro-recovery-actions"')));assert.ok(f.indexOf('id="registroEmergencyWarning"')>f.indexOf('id="registroSaveState"'));assert.ok(read('registro-recovery-ui.js').includes('footer.getBoundingClientRect().height+12'));
});
test('icons and scrolling do not change any button gate/handler or any academic inline script',()=>{
 const old=execFileSync('git',['show','cd2e3b8c194aa684221f148c2a35ad26a96a6474:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 const strip=s=>s.replace(css(s),'').replace(footer(s),'');assert.equal(strip(require('./registro-pr84-snapshot.cjs').reviewed(html)),strip(old));
 const oldButtons=[...footer(old).matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];assert.deepEqual([...footer(require('./notas2-frontend-boundary.cjs')('html',html)).match(/<div class="registro-recovery-actions"[^>]*>([\s\S]*?)<\/div>/)[1].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(b=>b[1]),oldButtons.map(b=>b[1]));assert.deepEqual([...footer(require('./notas2-frontend-boundary.cjs')('html',html)).match(/<div class="registro-recovery-actions"[^>]*>([\s\S]*?)<\/div>/)[1].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(b=>b[2].replace(/<svg[\s\S]*?<\/svg>|<\/?span>/g,'')),oldButtons.map(b=>b[2]));
});
test('fictitious review fixture includes the exact production footer and CSS without a network dependency',()=>{
 const demo=read('docs/demos/recovery-preview.html');assert.ok(demo.includes(footer(require('./notas2-frontend-boundary.cjs')('html',html))));assert.equal(css(demo),css(html));assert.ok(demo.includes("connect-src 'none'"));assert.doesNotMatch(row[0],/<script|<link/);
});
