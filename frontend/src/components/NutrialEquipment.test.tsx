import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Signal } from '../services/hail';
import NutrialEquipment, { filterSignals } from './NutrialEquipment';

// La misma lista de E/S que carga seed_demo en el backend, con la forma de /api/projects/nutrial/signals.
const seed = JSON.parse(readFileSync(new URL('../../../backend/apps/projects/seed_data/nutrial_signals.json', import.meta.url), 'utf8')) as
  { number: number; type: string; address: string; tag: string; description: string; module: string; device: string; logic: string | null }[];
const signals: Signal[] = seed.map(row => ({
  tag: row.tag, description: row.description, kind: row.type, unit: '', min_value: null, max_value: null, decimals: 0,
  address: row.address ?? '', module: row.module ?? '', field_device: row.device ?? '', logic: row.logic ?? '', position: row.number, device: 'plc-01',
}));

describe('señales de Nutrial', () => {
  it('filtra por equipo, tipo y texto sin acentos', () => {
    expect(filterSignals(signals, 'all', 'all', '')).toHaveLength(58);
    expect(filterSignals(signals, 'all', 'AI', '')).toHaveLength(3);
    expect(filterSignals(signals, 'BB-01', 'AI', 'peso')[0].address).toBe('IW96');
    expect(filterSignals(signals, 'all', 'all', 'inexistente')).toHaveLength(0);
    expect(filterSignals(signals, 'all', 'all', 'presion').some(s => s.tag === 'AI_PT01_Presion')).toBe(true);
  });

  it('dibuja la tabla con la exportación', () => {
    const html = renderToStaticMarkup(createElement(NutrialEquipment, { signals }));
    expect(html).toContain('Exportar selección CSV');
    expect(html).toContain('58 señales encontradas');
  });
});
