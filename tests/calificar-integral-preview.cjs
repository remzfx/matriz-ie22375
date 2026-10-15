// Reproducible offline review artifacts, using existing fictitious roster and actual print wrapper.
const fs=require('node:fs'),path=require('node:path'),{report,build}=require('./registro-bimestral-print-fixture.cjs'),printer=require('../registro-calificar-print.js');
function preview(mode){
 const options={level:mode==='num'?'primaria':'secundaria',area:mode==='num'?'Personal Social':'Matemática',count:mode==='num'?40:30,mode,kind:'bimestre'},f=report(options),original=f.html;
 Object.values(f.c.store.grades).forEach((g,i)=>{const n=[8,12,15,18][i%4];g.nota20=n;g.nivel=f.c.numToLetter(n);g.origen=i%5?'numero':'letra';});f.c.prepararImpresion();
 let html=build(options).replace(original,f.el('printArea').innerHTML).replace('PR81 reporte bimestral ficticio','Issue86 · Calificar integral ficticio').replace('A4 horizontal, 10 mm','A4 horizontal (A3 para grillas amplias), 8 mm');
 return html.replace('</style>',printer.css.replace('@media print','@media screen')+'\n@media screen{#printArea{box-sizing:border-box;max-width:281mm;margin:auto}#printArea:has(.wide){max-width:404mm}.fixture-controls{font-family:Arial,sans-serif}}\n</style>');
}
module.exports=preview;
if(require.main===module)for(const [name,mode]of [['letras','letra'],['numeros','num']])fs.writeFileSync(path.join(__dirname,'..','docs/demos/calificar-integral-'+name+'.html'),preview(mode));
