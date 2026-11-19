import assert from 'node:assert/strict';
import { TEST_TOPIC } from '../server/ingest.ts';
import { chooseLatest, forwardTestMessage } from '../server/firebaseTelemetry.ts';

const history = new Map();
let latest = null;
const store = {
  async saveHistory(key, point) { history.set(key, point); },
  async advanceLatest(sample) {
    const next = chooseLatest(latest, sample);
    if (next) latest = next;
    return Boolean(next);
  },
};
const time = Date.now();
const payload = (offset, level = 68) => Buffer.from(JSON.stringify({
  version: 1, timestamp: new Date(time + offset).toISOString(),
  level, wellWaterDepthM: 12, flow: 12.4, chlorine: .65,
  pump: 'running', dosing: 'active',
}));
assert.equal(await forwardTestMessage('pozoagua/otro', payload(0), store), undefined);
await assert.rejects(forwardTestMessage(TEST_TOPIC, payload(0, 101), store));
assert.equal(history.size, 0);
assert.equal((await forwardTestMessage(TEST_TOPIC, payload(0), store)).updatedLatest, true);
assert.equal(latest.level.value, 68);
assert.equal(latest.level.quality, 'simulated');
assert.deepEqual(history.get(String(time)), {
  timestamp: time, level: 68, flow: 12.4, chlorine: .65, quality: 'simulated',
});
assert.equal((await forwardTestMessage(TEST_TOPIC, payload(0), store)).updatedLatest, false);
assert.equal(history.size, 1);
assert.equal((await forwardTestMessage(TEST_TOPIC, payload(-1000, 40), store)).updatedLatest, false);
assert.equal(history.size, 2);
assert.equal(latest.level.value, 68);
latest.level.quality = 'good';
assert.equal((await forwardTestMessage(TEST_TOPIC, payload(1000), store)).updatedLatest, false);
assert.equal(latest.level.quality, 'good');
console.log('OK: contrato Firebase, tópico, validación, duplicados y orden de las lecturas.');
