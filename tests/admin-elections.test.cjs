const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const block = html.match(/      <!-- ELECCIONES ESCOLARES:[\s\S]*?<\/section>\r?\n/)[0];
const script = block.match(/<script>([\s\S]*?)<\/script>/)[1];
// Synthetic deployment ID; never contacted by these tests.
const url = 'https://script.google.com/macros/s/TEST_ELECTIONS_ONLY/exec';
function run(...configuration) {
  const nodes = {};
  for (const id of ['electionsVoting', 'electionsResults', 'electionsStatus']) {
    nodes[id] = { attrs: { 'aria-disabled': 'true', tabindex: '-1' },
      classList: { remove() {}, add() {} },
      removeAttribute(key) { delete this.attrs[key]; } };
  }
  const source = configuration.length ? script.replace(/const ELECTIONS_WEB_APP_URL = '[^']*';/,
    `const ELECTIONS_WEB_APP_URL = ${JSON.stringify(configuration[0])};`) : script;
  vm.runInNewContext(source,
    { URL, document: { getElementById: id => nodes[id] } });
  return nodes;
}
test('Unconfigured electoral links remain disabled without href, including before JavaScript', () => {
  const nodes = run('');
  for (const id of ['electionsVoting', 'electionsResults']) {
    assert.equal(nodes[id].href, undefined);
    assert.equal(nodes[id].attrs['aria-disabled'], 'true');
    const anchor = block.match(new RegExp(`<a id="${id}"[^>]*>`))[0];
    assert.doesNotMatch(anchor, /\bhref=/);
    assert.match(anchor, /aria-disabled="true"/);
  }
  assert.match(nodes.electionsStatus.textContent, /Configuración pendiente/);
});
test('Official configuration produces the exact requested destinations without pending configuration', () => {
  // Inspect strings only; the official deployment is never contacted.
  const official = 'https://script.google.com/macros/s/AKfycbzkKW4XhcP2wEQtVsspBYfPLdXXb0mp-s71-BSgCIybUJTWoCajSKpn0XaYJ71rXMfiYg/exec';
  const nodes = run();
  assert.equal(nodes.electionsVoting.href, official);
  assert.equal(nodes.electionsResults.href, official + '?vista=resultados');
  assert.deepEqual(nodes.electionsVoting.attrs, {});
  assert.deepEqual(nodes.electionsResults.attrs, {});
  assert.doesNotMatch(nodes.electionsStatus.textContent, /Configuración pendiente/);
  assert.match(nodes.electionsStatus.textContent, /publicación de resultados depende de la aplicación electoral/);
  assert.doesNotMatch(block.split('<script>')[0], /Configuración pendiente/);
});
test('One configured exec URL produces separate secure voting and results links', () => {
  const nodes = run(url);
  assert.equal(nodes.electionsVoting.href, url);
  assert.equal(nodes.electionsResults.href, url + '?vista=resultados');
  for (const id of ['electionsVoting', 'electionsResults']) {
    assert.deepEqual(nodes[id].attrs, {});
    assert.match(block.match(new RegExp(`<a id="${id}"[^>]*>`))[0],
      /target="_blank" rel="noopener noreferrer"/);
  }
  assert.match(nodes.electionsStatus.textContent, /publicación de resultados depende de la aplicación electoral/);
});
test('Invalid, unsafe or non-exec configuration cannot enable either link', () => {
  for (const invalid of ['javascript:alert(1)', '/exec', 'https://example.com/exec',
    url.replace('https:', 'http:'), url.replace('/exec', '/dev'),
    url.replace('script.google.com', 'script.google.com.evil.test'),
    url.replace('script.google.com', 'user:secret@script.google.com'),
    url + '?token=synthetic', url + '#fragment']) {
    const nodes = run(invalid);
    assert.equal(nodes.electionsVoting.href, undefined);
    assert.equal(nodes.electionsResults.href, undefined);
    assert.match(nodes.electionsStatus.textContent, /Configuración pendiente/);
  }
});
test('Electoral section uses responsive cards and only URL/DOM access, without persistence or transport', () => {
  assert.match(block, /grid sm:grid-cols-2 gap-3/);
  assert.equal((block.match(/min-h-\[44px\]/g) || []).length, 2);
  assert.doesNotMatch(script, /fetch|XMLHttpRequest|Storage|indexedDB|window\.open|session|token/i);
  assert.equal((html.match(/const ELECTIONS_WEB_APP_URL\s*=/g) || []).length, 1);
  assert.ok(html.indexOf(block) > html.indexOf('id="tab-menu"'));
  assert.ok(html.indexOf(block) < html.indexOf('id="tab-bd"'));
});
test('Existing administrator source including authorization and academic actions is byte-equivalent', () => {
  const baseline = execFileSync('git', ['show', '5214dfc117803b55d1d87839a90de6188505e33d:admin.html'],
    { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
  assert.equal(html.replace(block, '').replace(/\r\n/g, '\n'), baseline);
  const strip = require('./admin-elections-boundary.cjs');
  const current = html.replace(/\r\n/g, '\n');
  assert.equal(strip(current), baseline);
  assert.notEqual(strip(current.replace('SISTEMA DE VOTACIÓN', 'Unexpected mutation')), baseline);
  assert.notEqual(strip(current + '\n/* unrelated mutation */'), baseline);
});
