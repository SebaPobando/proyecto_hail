import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { color, status } from './tokens';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const cssVar = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1].toLowerCase();

describe('tokens.ts refleja tokens.css', () => {
  const pairs: Record<keyof typeof color, string> = {
    blue50: 'hail-blue-50', blue100: 'hail-blue-100', blue200: 'hail-blue-200', blue300: 'hail-blue-300',
    blue400: 'hail-blue-400', blue500: 'hail-blue-500', blue600: 'hail-blue-600', blue700: 'hail-blue-700',
    royal: 'hail-royal', navy: 'hail-navy', deep: 'hail-deep', ink: 'hail-ink',
    orange400: 'hail-orange-400', orange500: 'hail-orange-500', orange600: 'hail-orange-600',
    gray200: 'hail-gray-200', gray300: 'hail-gray-300', gray400: 'hail-gray-400', gray500: 'hail-gray-500', gray700: 'hail-gray-700',
  };
  it.each(Object.entries(pairs))('%s = --%s', (key, name) => {
    expect(color[key as keyof typeof color]).toBe(cssVar(name));
  });

  it('los estados reutilizan los indicadores del CSS', () => {
    expect(status.ok).toBe(cssVar('status-ok-indicator'));
    expect(status.warning).toBe(cssVar('status-warning-indicator'));
    expect(status.critical).toBe(cssVar('status-critical-indicator'));
    expect(status.stopped).toBe(cssVar('status-stopped-indicator'));
    expect(status.simulated).toBe(cssVar('status-simulated'));
  });
});
