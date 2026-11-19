import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: ProcessDiagram } = await server.ssrLoadModule('/src/components/ProcessDiagram.tsx');
  const { sampleSimulation } = await server.ssrLoadModule('/src/services/simulation.ts');
  const initial = sampleSimulation(0);
  const unavailable = renderToStaticMarkup(React.createElement(ProcessDiagram, { data: null }));
  assert(unavailable.includes('Nivel desconocido'));
  assert(unavailable.includes('data-pump-state="unknown"'));
  assert(unavailable.includes('—'));
  assert(!unavailable.includes('flow-chevron'));
  assert(!unavailable.includes('fill="#079cdd"') && !unavailable.includes('fill="#129fe7"'));
  assert(!unavailable.includes('En marcha'));

  assert.equal(initial.wellWaterDepthM.value, 12);
  function renderLevels(level, depth) {
    return renderToStaticMarkup(React.createElement(ProcessDiagram, { data: {
      ...initial, level: { ...initial.level, value: level },
      wellWaterDepthM: { ...initial.wellWaterDepthM, value: depth },
    } }));
  }
  const low = renderLevels(20, 25);
  const high = renderLevels(80, 5);
  for (const start of [90, 904]) {
    const surface = html => Number(html.match(new RegExp(`d="M${start} ([\\d.]+)H`))[1]);
    assert(surface(low) > surface(high), 'El espejo de agua debe bajar al disminuir el llenado');
  }
  const empty = renderLevels(0, 50);
  assert(!empty.includes('fill="#079cdd"') && !empty.includes('fill="#129fe7"'));
  for (let second = 0; second <= 86400; second += 31) {
    const value = sampleSimulation(second).wellWaterDepthM.value;
    assert(value >= 11 && value <= 13);
  }
  for (const [state, label, color] of [['running', 'En marcha', '#78bd39'], ['stopped', 'Detenida', '#9aadb9'], ['fault', 'Falla', '#ef5350']]) {
    const data = { ...initial, states: { ...initial.states, pump: state } };
    const html = renderToStaticMarkup(React.createElement(ProcessDiagram, { data }));
    assert(html.includes(`data-pump-state="${state}"`));
    assert(html.includes(label));
    assert(html.includes(`fill="${color}"`));
    assert.equal(html.includes('class="flow-chevron"'), state === 'running');
    assert(html.includes('LT-102'));
    assert(!html.includes('Profundidad desde boca'));
    assert(html.includes('data-equipment="tank-level-sensor"'));
  }
  const noFlow = renderToStaticMarkup(React.createElement(ProcessDiagram, { data: { ...initial, flow: { ...initial.flow, value: 0 } } }));
  assert(!noFlow.includes('class="flow-chevron"'));
  console.log('OK: dos sensores, profundidad simulada 11–13 m, tres estados de bomba y flechas condicionadas por marcha y caudal.');
} finally {
  await server.close();
}
