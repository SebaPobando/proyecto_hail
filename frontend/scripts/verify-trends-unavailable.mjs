import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: TrendsScreen } = await server.ssrLoadModule('/src/components/TrendsScreen.tsx');
  const html = renderToStaticMarkup(React.createElement(TrendsScreen, { data: null, historyService: { queryHistory: async () => [] } }));
  for (const label of ['LT-101', 'FT-101', 'AIT-101', 'Sin lectura actual', '7 días', '—']) assert(html.includes(label), label);
  assert.equal((html.match(/Cargando historial/g) || []).length, 3);
  console.log('OK: las tres tendencias y sus períodos se renderizan sin telemetría actual.');
} finally { await server.close(); }
