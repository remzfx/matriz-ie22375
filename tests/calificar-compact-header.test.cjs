'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const current=require('./notas2-session-authorization-boundary.cjs')('registro.html',fs.readFileSync('registro.html','utf8')),before=execFileSync('git',['show','9d81f20:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
test('compact header changes only reviewed HTML/CSS; every inline script and academic handler is unchanged',()=>{
 const scripts=s=>[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[0]);assert.deepEqual(scripts(current),scripts(before));
 const normalize=require('./academic-save-modal-boundary.cjs');assert.equal(normalize('registro.html',current),normalize('registro.html',before));
 assert.notEqual(normalize('registro.html',current.replace("onclick=\"setModoCalif('num')\"","onclick=\"setModoCalif('letra')\"")),normalize('registro.html',before));
});
test('session state remains generated inside the same live container with the same chip/open/delete events',()=>{
 const block=s=>s.slice(s.indexOf('function renderSesiones()'),s.indexOf('function abrirSesionFecha('));assert.equal(block(current),block(before));
 assert.match(current,/#listaSesiones \{display:contents;\}/);assert.match(current,/#listaSesiones > \[role="status"\].*order:0/);
 assert.match(current,/#listaSesiones > \.sess-chip \{order:2;/);assert.match(current,/sessions-chip-break" aria-hidden="true"/);
 for(const id of ['listaSesiones','lblSinSesiones','lblSesionActiva','lblEscala'])assert.equal((current.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
});
test('compact heading retains both mode controls, help text and dynamic date/capacity label',()=>{
 const controls=s=>[...s.matchAll(/<button[^>]+data-modo="(?:letra|num)"[^>]*>[^<]*<\/button>/g)].map(m=>m[0]);assert.deepEqual(controls(current),controls(before));
 assert.match(current,/calificar-heading-context[\s\S]*id="lblSesionActiva"/);
 assert.match(current,/calificar-heading-help[\s\S]*id="lblEscala"/);
 assert.ok(current.includes('Cambiar entre Letras y 0–20 solo cambia la forma de calificar; no modifica las notas ya guardadas.'));
 assert.match(current,/#wrapCalificar \.calificar-heading \{display:flex;flex-wrap:wrap;/);
});
