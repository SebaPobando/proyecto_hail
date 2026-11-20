import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { tokens } from '../design-system';
import { telemetry } from '../test/fixtures';
import ProcessDiagram from './ProcessDiagram';

const render = (data: Parameters<typeof ProcessDiagram>[0]['data']) => renderToStaticMarkup(createElement(ProcessDiagram, { data }));
const WATER = ['fill="#079cdd"', 'fill="#129fe7"'];

describe('ProcessDiagram', () => {
  it('sin datos no dibuja agua, flujo ni estado de bomba', () => {
    const html = render(null);
    expect(html).toContain('Nivel desconocido');
    expect(html).toContain('data-pump-state="unknown"');
    expect(html).not.toContain('flow-chevron');
    expect(html).not.toContain('En marcha');
    WATER.forEach(fill => expect(html).not.toContain(fill));
  });

  it('el espejo de agua baja al disminuir el llenado del estanque y del pozo', () => {
    const levels = (level: number, depth: number) => render(telemetry({
      level: { value: level, quality: 'good' }, wellWaterDepthM: { value: depth, quality: 'good' },
    }));
    const low = levels(20, 25);
    const high = levels(80, 5);
    for (const start of [90, 904]) {
      const surface = (html: string) => Number(html.match(new RegExp(`d="M${start} ([\\d.]+)H`))![1]);
      expect(surface(low)).toBeGreaterThan(surface(high));
    }
    const empty = levels(0, 50);
    WATER.forEach(fill => expect(empty).not.toContain(fill));
  });

  it.each([
    ['running', 'En marcha', tokens.status.ok],
    ['stopped', 'Detenida', tokens.status.stopped],
    ['fault', 'Falla', tokens.status.critical],
  ] as const)('bomba %s: etiqueta, color y flechas de flujo', (pump, label, color) => {
    const html = render(telemetry({ states: { pump, dosing: 'active', communication: 'connected' } }));
    expect(html).toContain(`data-pump-state="${pump}"`);
    expect(html).toContain(label);
    expect(html).toContain(`fill="${color}"`);
    expect(html.includes('class="flow-chevron"')).toBe(pump === 'running');
    expect(html).toContain('LT-102');
    expect(html).toContain('data-equipment="tank-level-sensor"');
  });

  it('sin caudal no dibuja flechas aunque la bomba marche', () => {
    expect(render(telemetry({ flow: { value: 0, quality: 'good' } }))).not.toContain('class="flow-chevron"');
  });
});
