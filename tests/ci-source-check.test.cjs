const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {inspect} = require('../scripts/check-source.cjs');

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ie22375-ci-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), {recursive:true});
    fs.writeFileSync(path.join(root, name), text);
  }
  return inspect(root, Object.keys(files));
}

test('CI detects invalid JS and inline syntax without executing either', t => {
  const r = fixture(t, {'module.js':'throw Error("must not execute");', 'bad.cjs':'const x = ;', 'page.html':'<script>const y = ;</script>'});
  assert.equal(r.errors.length, 2); assert.equal(r.javascript, 2); assert.equal(r.inline, 1);
});
test('CI catches missing local script dependencies including nested relative paths', t => {
  const r = fixture(t, {'pages/page.html':'<script src="../missing.js"></script>'});
  assert.match(r.errors[0], /dependencia ausente/);
});
test('CI preserves case-sensitive paths on every OS', t => {
  const r = fixture(t, {'Module.js':'const x=1;', 'page.html':'<script src="module.js"></script>'});
  assert.match(r.errors[0], /mayúsculas/);
});
test('CI handles queries, external scripts, data scripts and local styles without network', t => {
  const r = fixture(t, {'app.js':'const x=1;', 'style.css':'', 'page.html':'<script src=app.js?v=1></script><script src="https://synthetic.invalid/external.js"></script><script type="application/json">{"not":"JS"}</script><link rel="stylesheet" href="style.css">'});
  assert.deepEqual(r.errors, []); assert.equal(r.dependencies, 2); assert.equal(r.inline, 0);
});
test('CI accepts module syntax and rejects missing stylesheet or escaping paths', t => {
  const r = fixture(t, {'page.html':'<script type="module">export const x=1;</script><script src="../outside.js"></script><link rel="stylesheet" href="missing.css">'});
  assert.equal(r.inline, 1); assert.equal(r.errors.length, 2); assert.match(r.errors[0], /fuera del repositorio/);
});
test('CI rejects invalid module syntax, Apps Script syntax and empty script sources', t => {
  const r = fixture(t, {'bad.gs':'function bad( {', 'page.html':'<script type="module">export const = ;</script><script src=""></script>'});
  assert.equal(r.errors.length, 3);
});
test('CI resolves nested relative and repository-root references without executing scripts', t => {
  const r = fixture(t, {'app.js':'throw Error("must not execute");', 'pages/page.html':'<script src="../app.js"></script><script src="/app.js"></script>'});
  assert.deepEqual(r.errors, []); assert.equal(r.dependencies, 2);
});
