import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { connect } from 'mqtt';
import { decodeTelemetry, limits, TEST_TOPIC } from './ingest.ts';
import type { Telemetry } from '../src/services/types.ts';

const path = process.env.IOT_DB_PATH ?? '.iot-data/telemetry.sqlite';
if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
db.exec('CREATE TABLE IF NOT EXISTS samples (ts INTEGER PRIMARY KEY, body TEXT NOT NULL)');
const insert = db.prepare('INSERT OR IGNORE INTO samples VALUES (?, ?)');
const latest = db.prepare('SELECT ts, body FROM samples ORDER BY ts DESC LIMIT 1');
const prune = db.prepare('DELETE FROM samples WHERE ts < ?');
const day = 86_400_000;
const client = connect(process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883', {
  username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD,
});
client.on('connect', () => client.subscribe(TEST_TOPIC, { qos: 1 }, error => {
  if (error) console.error('Suscripción MQTT:', error.message);
}));
client.on('error', error => console.error('MQTT:', error.message));
client.on('message', (topic, payload) => {
  if (topic !== TEST_TOPIC || payload.length > 4096) return;
  try {
    const sample = decodeTelemetry(payload.toString());
    insert.run(Date.parse(sample.timestamp), JSON.stringify(sample));
    prune.run(Date.now() - 7 * day);
  } catch (error) { console.warn('Mensaje descartado:', (error as Error).message); }
});

const api = createServer((req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET') return send(405, { error: 'Solo lectura' });
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/telemetry/latest') {
      const row = latest.get() as { ts: number; body: string } | undefined;
      const data = row ? JSON.parse(row.body) as Telemetry : null;
      const stale = !!row && (!client.connected || Date.now() - row.ts > 30_000);
      if (data && stale) for (const key of Object.keys(limits) as (keyof typeof limits)[]) data[key].quality = 'stale';
      return send(200, { data, stale, brokerConnected: client.connected });
    }
    if (url.pathname === '/api/history') {
      const from = Number(url.searchParams.get('from'));
      const to = Number(url.searchParams.get('to'));
      const count = Number(url.searchParams.get('maxPoints') ?? 241);
      if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from <= 0 || to <= from ||
          to - from > 7 * day || !Number.isInteger(count) || count < 2 || count > 2000) return send(400, { error: 'Consulta de historial inválida' });
      const width = Math.max(1, Math.ceil((to - from + 1) / count));
      const rows = db.prepare('SELECT MAX(ts) AS ts FROM samples WHERE ts BETWEEN ? AND ? GROUP BY (ts - ?) / ? ORDER BY ts').all(from, to, from, width);
      const find = db.prepare('SELECT body FROM samples WHERE ts = ?');
      return send(200, rows.map(row => {
        const item = JSON.parse(String(find.get(Number(row.ts))?.body)) as Telemetry;
        return { timestamp: row.ts, level: item.level.value, flow: item.flow.value, chlorine: item.chlorine.value, quality: item.level.quality };
      }));
    }
    return send(404, { error: 'Ruta desconocida' });
  } catch (error) {
    console.error(error);
    return send(500, { error: 'No se pudo consultar la telemetría' });
  }
});
api.listen(Number(process.env.IOT_API_PORT ?? 8787), process.env.IOT_API_HOST ?? '127.0.0.1', () => console.log('API IoT', api.address()));
