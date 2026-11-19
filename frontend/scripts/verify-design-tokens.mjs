// Comprueba que los colores de design-system/tokens.ts coincidan con tokens.css.
//   node scripts/verify-design-tokens.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const css = readFileSync(new URL('../src/design-system/tokens.css', import.meta.url), 'utf8');
const cssVar = name => {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert(match, `tokens.css no define --${name}`);
  return match[1].toLowerCase();
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { color } = await server.ssrLoadModule('/src/design-system/tokens.ts');
  const pairs = {
    blue50: 'hail-blue-50', blue100: 'hail-blue-100', blue200: 'hail-blue-200', blue300: 'hail-blue-300',
    blue400: 'hail-blue-400', blue500: 'hail-blue-500', blue600: 'hail-blue-600', blue700: 'hail-blue-700',
    royal: 'hail-royal', navy: 'hail-navy', deep: 'hail-deep', ink: 'hail-ink',
    orange400: 'hail-orange-400', orange500: 'hail-orange-500', orange600: 'hail-orange-600',
    gray200: 'hail-gray-200', gray300: 'hail-gray-300', gray400: 'hail-gray-400', gray500: 'hail-gray-500', gray700: 'hail-gray-700',
  };
  for (const [key, name] of Object.entries(pairs)) assert.equal(color[key], cssVar(name), `${key} ≠ --${name}`);
  // Los estados reutilizan los indicadores definidos en CSS.
  const { status } = await server.ssrLoadModule('/src/design-system/tokens.ts');
  assert.equal(status.ok, cssVar('status-ok-indicator'));
  assert.equal(status.warning, cssVar('status-warning-indicator'));
  assert.equal(status.critical, cssVar('status-critical-indicator'));
  assert.equal(status.stopped, cssVar('status-stopped-indicator'));
  assert.equal(status.simulated, cssVar('status-simulated'));
  console.log('Tokens CSS y TS coinciden.');
} finally {
  await server.close();
}
