// Exact N2-R3 backend hooks only.
'use strict';
const edits = [
  [
    "    function projected(payload,enforceResolved){const result=identity.project(payload,roster.estudiantes,context,competencies);if(result.conflicts.length||(enforceResolved&&result.unresolved.length))throw Error(result.conflicts.length?'Notas históricas ambiguas: requieren revisión explícita.':'Identidades históricas pendientes de revisión.');return result;}\n",
    "    function projected(payload){const result=identity.project(payload,roster.estudiantes,context,competencies);if(result.conflicts.length||result.unresolved.length)throw Error('Identidades históricas pendientes de revisión.');return result.payload;}\n"
  ],
  [
    "      const proj=projected(payload,false),p=payloadRegistroLectura_(proj.payload,{sesion:{role:permission.role}},ctx);\n",
    "      const p=payloadRegistroLectura_(projected(payload),{sesion:{role:permission.role}},ctx);\n"
  ],
  [
    "      model.validate(p,context);notas2Validar_(p,context,competencies);if(proj.unresolved.length)p.meta=Object.assign({},p.meta||{},{unresolvedIdentities:proj.unresolved});\n",
    "      model.validate(p,context);notas2Validar_(p,context,competencies);\n"
  ],
  [
    "    const candidate=projected(next,true).payload;\n",
    "    const candidate=projected(next);\n"
  ],
  [
    "  const hasNumber=v.nota20!==''&&v.nota20!=null,level=typeof v.nivel==='string'?v.nivel.toUpperCase():v.nivel;if(!hasNumber&&(!level||level===''))continue;\n",
    "  const hasNumber=v.nota20!==''&&v.nota20!=null,level=v.nivel;\n"
  ]
];
module.exports = source => {
  let s = source.replace(/\r\n/g, '\n');
  for (const [current, original] of edits) {
    if (s.includes(current)) s = s.replace(current, original);
  }
  return s;
};
