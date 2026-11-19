import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { Aedes } from 'aedes';
import { connect } from 'mqtt';

const broker = await Aedes.createBroker();
const listener = createServer(broker.handle).listen(0, '127.0.0.1');
await once(listener, 'listening');
const mqttUrl = `mqtt://127.0.0.1:${listener.address().port}`;
const child = spawn(process.execPath, ['--experimental-strip-types', 'server/backend.ts'], {
  env: { ...process.env, MQTT_URL: mqttUrl, IOT_API_PORT: '0', IOT_API_HOST: '127.0.0.1', IOT_DB_PATH: ':memory:' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let publisher;
try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('La API no inició')), 10_000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`La API terminó con código ${code}`)); });
    child.stdout.setEncoding('utf8').on('data', data => {
      const match = data.match(/port: (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const base = `http://127.0.0.1:${port}/api`;
  const latest = async () => (await fetch(`${base}/telemetry/latest`)).json();
  publisher = connect(mqttUrl);
  await once(publisher, 'connect');
  const topic = 'pozoagua/pruebas/v1/telemetria';
  const sample = () => ({ version: 1, timestamp: new Date().toISOString(), level: 68, wellWaterDepthM: 12, flow: 12.4, chlorine: .65, pump: 'running', dosing: 'active' });
  const first = sample();
  await publisher.publishAsync(topic, JSON.stringify(first), { qos: 1, retain: true });
  async function waitForReading(timestamp) {
    for (let i = 0; i < 40; i++) {
      const value = await latest();
      if (value.data?.timestamp === timestamp) return value;
      await delay(100);
    }
    throw new Error('No llegó la muestra MQTT a la API');
  }
  assert.equal((await waitForReading(first.timestamp)).stale, false);
  await publisher.endAsync();
  await delay(31_000);
  const stale = await latest();
  assert.equal(stale.brokerConnected, true);
  assert.equal(stale.stale, true);
  assert.equal(stale.data.level.quality, 'stale');
  assert.equal(stale.data.level.value, 68);
  assert.equal(stale.data.timestamp, first.timestamp);
  const history = await (await fetch(`${base}/history?from=${Date.parse(first.timestamp)-1000}&to=${Date.now()}`)).json();
  assert.equal(history.length, 1);
  publisher = connect(mqttUrl);
  await once(publisher, 'connect');
  const next = { ...sample(), level: 69 };
  await publisher.publishAsync(topic, JSON.stringify(next), { qos: 1 });
  const recovered = await waitForReading(next.timestamp);
  assert.equal(recovered.stale, false);
  assert.equal(recovered.data.level.value, 69);
  console.log('OK: publicación MQTT, historial, corte de 31 s y recuperación.');
} finally {
  publisher?.end(true);
  child.kill();
  listener.close();
  broker.close();
}
