const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Worker } = require('node:worker_threads');

const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../apps-script/Codigo.js'), 'utf8');
const cached = JSON.stringify({ docentes: [], ts: 1234 });

test('concurrent cache hits return without requesting ScriptLock or Sheets', async () => {
  const shared = new SharedArrayBuffer(3 * Int32Array.BYTES_PER_ELEMENT);
  const counters = new Int32Array(shared);
  const workers = [];
  const ready = [];
  const done = [];
  const workerCode = `
    const {parentPort, workerData} = require('node:worker_threads');
    const vm = require('node:vm');
    const assert = require('node:assert/strict');
    const counters = new Int32Array(workerData.shared);
    const context = vm.createContext({
      CacheService: {getScriptCache: () => ({get: () => workerData.cached})},
      LockService: {getScriptLock() {Atomics.add(counters, 1, 1); throw Error('Hit requested lock');}},
      SpreadsheetApp: {getActiveSpreadsheet() {Atomics.add(counters, 2, 1); throw Error('Hit requested Sheets');}}
    });
    new vm.Script(workerData.source).runInContext(context);
    parentPort.postMessage('ready');
    Atomics.wait(counters, 0, 0);
    for (let i = 0; i < 20; i++) assert.equal(context.obtenerDocentesConfig_().ts, 1234);
    parentPort.postMessage('done');
  `;
  try {
    for (let i = 0; i < 16; i++) {
      const worker = new Worker(workerCode, {eval: true, workerData: {source, cached, shared}});
      workers.push(worker);
      ready.push(new Promise((resolve, reject) => {
        worker.on('message', message => {if (message === 'ready') resolve();});
        worker.on('error', reject);
      }));
      done.push(new Promise((resolve, reject) => {
        worker.on('error', reject);
        worker.on('exit', code => code === 0 ? resolve() : reject(Error('Worker exited: ' + code)));
      }));
    }
    const completion = Promise.all(done);
    completion.catch(() => {});
    await Promise.all(ready);
    Atomics.store(counters, 0, 1);
    Atomics.notify(counters, 0, 16);
    await completion;
    assert.equal(counters[1], 0, '320 hits across 16 workers must request zero locks');
    assert.equal(counters[2], 0, '320 hits across 16 workers must request zero Sheets reads');
  } finally {
    await Promise.all(workers.map(worker => worker.terminate()));
  }
});

test('a cache miss checks again after acquiring the lock', () => {
  let value = null;
  let locks = 0;
  let released = 0;
  const context = vm.createContext({
    CacheService: {getScriptCache: () => ({get: () => value, put() {assert.fail('Second hit must not repopulate cache');}})},
    LockService: {getScriptLock: () => ({
      waitLock() {locks++; value = cached;}, // Simulate another invocation filling it while waiting.
      releaseLock() {released++;}
    })},
    SpreadsheetApp: {getActiveSpreadsheet() {assert.fail('Second hit must not read Sheets');}}
  });
  new vm.Script(source).runInContext(context);
  assert.equal(context.obtenerDocentesConfig_().ts, 1234);
  assert.equal(locks, 1);
  assert.equal(released, 1);
});

test('a persistent cache miss reads and populates only while holding the lock', () => {
  let held = false;
  let gets = 0;
  let reads = 0;
  let puts = 0;
  const context = vm.createContext({
    CacheService: {getScriptCache: () => ({
      get() {gets++; return null;},
      put(key, value, ttl) {assert.equal(held, true); assert.equal(ttl, 600); assert.equal(JSON.parse(value).ts, 0); puts++;}
    })},
    LockService: {getScriptLock: () => ({
      waitLock() {assert.equal(held, false); held = true;},
      releaseLock() {assert.equal(held, true); held = false;}
    })},
    SpreadsheetApp: {getActiveSpreadsheet() {
      assert.equal(held, true); reads++;
      return {getSheetByName: () => ({getLastRow: () => 1})};
    }}
  });
  new vm.Script(source).runInContext(context);
  assert.equal(context.obtenerDocentesConfig_().ts, 0);
  assert.equal(gets, 2);
  assert.equal(reads, 1);
  assert.equal(puts, 1);
  assert.equal(held, false);
});

