// Exact N2-R3/N2-R6 backend hooks only.
'use strict';
module.exports = source => {
  let s = require('./notas2-worked-boundary.cjs')('apps-script/Notas2.js',source);

  // Strip historical projection and reply
  const b1Start = '    function proyectarHistorico_(payload){';
  const b1End = '    if(!save)return reply(previous);';
  const target1 = "    function projected(payload){const result=identity.project(payload,roster.estudiantes,context,competencies);if(result.conflicts.length||result.unresolved.length)throw Error('Identidades históricas pendientes de revisión.');return result.payload;}\n" +
    "    function view(payload){\n" +
    "      const p=payloadRegistroLectura_(projected(payload),{sesion:{role:permission.role}},ctx);\n" +
    "      for(const f of Object.values(fields).flat())if(p[f]===undefined)p[f]=f==='sessions'?[]:{};\n" +
    "      p.calificarEstado=JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(payload.calificarEstado||p.competenciasEstado||{}).filter(([k])=>k.startsWith(prefix)))));\n" +
    "      model.validate(p,context);notas2Validar_(p,context,competencies);\n" +
    "      // Read-only projection; never insert or persist a legacy record here.\n" +
    "      return p;\n" +
    "    }\n" +
    "    function reply(payload){return {ok:true,notas2:1,key:key,exists:!!row,legacy:legacy,readonly:!bimestreAbierto_(ctx.bimestre),versions:versions,at:at,payload:view(payload)};}\n" +
    "    if(!save)return reply(previous);";

  if (s.includes(b1Start) && s.includes(b1End)) {
    const curBlock = s.slice(s.indexOf(b1Start), s.indexOf(b1End) + b1End.length);
    s = s.replace(curBlock, target1);
  }

  // Strip legacy promedios validation and Drive backup
  const b2Start = "    if(legacy&&body.panel==='promedios'&&hist&&hist.divergencias.length){\n";
  const b2End = "    const raw=JSON.stringify(next);";
  if (s.includes(b2Start) && s.includes(b2End)) {
    const curB2 = s.slice(s.indexOf(b2Start), s.indexOf(b2End));
    s = s.replace(curB2, '');
  }

  // Strip enforceResolved
  s = s.replace("    const candidate=projected(next,true).payload;\n", "    const candidate=projected(next);\n");

  // Strip notas2Validar_ level normalization
  s = s.replace("  const hasNumber=v.nota20!==''&&v.nota20!=null,level=typeof v.nivel==='string'?v.nivel.toUpperCase():v.nivel;if(!hasNumber&&(!level||level===''))continue;\n", "  const hasNumber=v.nota20!==''&&v.nota20!=null,level=v.nivel;\n");

  // Strip helper functions at the end
  const b5 = '\nfunction calcularSha256Hex_(str){';
  if (s.includes(b5)) {
    s = s.slice(0, s.indexOf(b5));
  }

  return s;
};
