import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createSimulatedHistory } = await server.ssrLoadModule('/src/services/history.ts');
  const { sampleSimulation } = await server.ssrLoadModule('/src/services/simulation.ts');
  const initial = sampleSimulation(0);
  const start = Date.parse(initial.timestamp);
  const history = createSimulatedHistory(initial);
  for (const hours of [1, 8, 24, 168]) {
    const query = { from: start - hours * 3_600_000, to: start, maxPoints: 241 };
    const points = await history.queryHistory(query);
    assert.equal(points.length, 241);
    assert.equal(points[0].timestamp, query.from);
    assert.equal(points.at(-1).timestamp, start);
    assert.equal(points.at(-1).level, initial.level.value);
    assert.equal(points.at(-1).flow, initial.flow.value);
    assert.equal(points.at(-1).chlorine, initial.chlorine.value);
    assert.deepEqual(await history.queryHistory(query), points, 'Cambiar de período no debe regenerar el archivo');
    assert(points.every((p, i) => p.quality === 'simulated' && p.level >= 0 && p.level <= 100 && p.flow > 0 && p.chlorine > 0 && (!i || p.timestamp > points[i - 1].timestamp)));
  }
  const next = { ...sampleSimulation(90), timestamp: new Date(start + 90_000).toISOString() };
  history.record(next);
  const recent = await history.queryHistory({ from: start, to: start + 90_000 });
  assert.equal(recent.at(-1).timestamp, start + 90_000);
  assert.equal(recent.at(-1).level, next.level.value);
  assert.deepEqual(await history.queryHistory({ from: start + 120_000, to: start + 180_000 }), []);
  await assert.rejects(history.queryHistory({ from: start, to: start }));
  await assert.rejects(history.queryHistory({ from: start - 1000, to: start, maxPoints: 1 }));
  console.log('OK: cuatro períodos, rangos, orden, historial estable, extremo actual, ausencia de datos futuros y validación de consultas.');
} finally { await server.close(); }
