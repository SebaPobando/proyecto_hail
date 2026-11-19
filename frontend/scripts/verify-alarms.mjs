import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createAlarmScenario, filterAlarmSnapshot, alarmSummary, withinAlarmRange } = await server.ssrLoadModule('/src/services/alarms.ts');
  const now = Date.parse('2026-11-15T18:30:24Z');
  const snapshot = createAlarmScenario(now);
  const filters = { state: 'all', priority: 'all', range: 'today' };
  assert.deepEqual(alarmSummary(snapshot, now), { critical: 1, warning: 2, events: 8 });
  let result = filterAlarmSnapshot(snapshot, filters, now);
  assert.equal(result.alarms.length, 3);
  assert.equal(result.events.length, 8);
  result = filterAlarmSnapshot(snapshot, { ...filters, priority: 'critical' }, now);
  assert.equal(result.alarms.length, 1);
  assert.equal(result.events.length, 2);
  result = filterAlarmSnapshot(snapshot, { ...filters, priority: 'warning', state: 'active' }, now);
  assert.equal(result.alarms.length, 2);
  assert.equal(result.events.length, 2);
  result = filterAlarmSnapshot(snapshot, { ...filters, state: 'normalized' }, now);
  assert.equal(result.alarms.length, 0);
  assert.equal(result.events.length, 3);
  assert.equal(filterAlarmSnapshot(snapshot, { ...filters, range: '7d' }, now).events.length, 10);
  assert.equal(filterAlarmSnapshot(snapshot, { ...filters, range: '24h' }, now).events.length, 8);
  assert(result.events.every((event, i) => !i || Date.parse(event.timestamp) <= Date.parse(result.events[i-1].timestamp)));
  // A las 00:05 de Santiago, 23:59 pertenece al día anterior aunque sea el mismo día UTC.
  const midnight = Date.parse('2026-11-16T03:05:00Z');
  assert(!withinAlarmRange('2026-11-16T02:59:00Z', 'today', midnight));
  assert(withinAlarmRange('2026-11-16T02:59:00Z', '24h', midnight));
  assert(!withinAlarmRange('2026-11-16T03:06:00Z', '7d', midnight));
  assert(!withinAlarmRange('invalid', 'today', midnight));
  const empty = { ...snapshot, alarms: [], events: [] };
  assert.deepEqual(alarmSummary(empty, now), { critical: 0, warning: 0, events: 0 });
  assert.deepEqual(filterAlarmSnapshot(empty, filters, now), { alarms: [], events: [] });
  console.log('OK: contadores, filtros combinados, 3 rangos, orden, medianoche de Santiago, datos futuros y resultados vacíos.');
} finally { await server.close(); }
