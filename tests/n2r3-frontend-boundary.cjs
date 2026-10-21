// Exact N2-R3 frontend hooks only.
'use strict';
const edits = [
  [
    "      const original = leerNota(store.finales, finalKey(cp, studentKey(al))) || {};\n      if (dir.letra || (dir.nota !== '' && dir.nota != null)) { nota = original.origen==='letra'?'':(dir.nota !== '' && dir.nota != null ? dir.nota : ''); letra = dir.letra; }\n",
    "      const original = leerNota(store.finales, finalKey(cp, studentKey(al))) || {};\n      if (dir.nota !== '' && dir.nota != null) { nota = original.origen==='letra'?'':dir.nota; letra = dir.letra; }\n"
  ]
];
module.exports = source => {
  let s = source.replace(/\r\n/g, '\n');
  for (const [current, previous] of edits) {
    if (s.includes(current)) s = s.replace(current, previous);
  }
  return s;
};
