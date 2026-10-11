// Análisis local: compila sintaxis, nunca ejecuta módulos ni consulta servicios.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');

function attributes(raw) {
  const out = Object.create(null);
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of raw.matchAll(pattern)) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return out;
}

function localDependency(root, file, reference) {
  if (!reference) throw Error('dependencia sin ruta');
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  const target = path.resolve(clean.startsWith('/') ? root : path.dirname(path.join(root, file)), '.' + (clean.startsWith('/') ? clean : path.sep + clean));
  const relative = path.relative(root, target);
  if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw Error('dependencia fuera del repositorio');
  // Comprobar mayúsculas también en Windows: GitHub Pages usa rutas sensibles a ellas.
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    if (!fs.readdirSync(current).includes(segment)) throw Error('dependencia ausente o con mayúsculas incorrectas');
    current = path.join(current, segment);
  }
  if (!fs.statSync(current).isFile()) throw Error('la dependencia no es un archivo');
  return relative;
}

function compile(code, filename, module = false) {
  if (!module) { new vm.Script(code, {filename}); return; }
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {input:code, encoding:'utf8'});
  if (result.status !== 0) throw Error('sintaxis de módulo JavaScript inválida');
}

function inspect(root, files) {
  const result = {javascript:0, inline:0, dependencies:0, errors:[]};
  const check = (file, operation) => { try { operation(); } catch (error) { result.errors.push(file + ': ' + error.message); } };
  for (const file of files) {
    if (!/\.(?:[cm]?js|gs|html)$/i.test(file)) continue;
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (!/\.html$/i.test(file)) {
      check(file, () => compile(source, file, /\.mjs$/i.test(file)));
      result.javascript++;
      continue;
    }
    for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const attrs = attributes(match[1]);
      if (Object.hasOwn(attrs, 'src')) {
        check(file, () => { if (localDependency(root, file, attrs.src) !== null) result.dependencies++; });
      } else if (!attrs.type || /^(?:module|(?:application|text)\/(?:java|ecma)script)$/i.test(attrs.type)) {
        check(file, () => compile(match[2], file + ':inline', attrs.type === 'module'));
        result.inline++;
      }
    }
    for (const match of source.matchAll(/<link\b([^>]*)>/gi)) {
      const attrs = attributes(match[1]);
      if (/(?:^|\s)(?:stylesheet|modulepreload|manifest)(?:\s|$)/i.test(attrs.rel || '') && attrs.href) {
        check(file, () => { if (localDependency(root, file, attrs.href) !== null) result.dependencies++; });
      }
    }
  }
  return result;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const listed = spawnSync('git', ['ls-files', '-z'], {cwd:root, encoding:'utf8'});
  if (listed.status !== 0) { console.error('No se pudo obtener el inventario versionado.'); process.exitCode = 1; }
  else {
    const result = inspect(root, listed.stdout.split('\0').filter(Boolean));
    console.log('Sintaxis: ' + result.javascript + ' archivos JS/GS; ' + result.inline + ' scripts inline. Dependencias locales: ' + result.dependencies + '.');
    for (const error of result.errors) console.error(error);
    if (result.errors.length) process.exitCode = 1;
  }
}
module.exports = {attributes, localDependency, inspect};
