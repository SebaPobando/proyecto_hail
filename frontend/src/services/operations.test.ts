import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWorkItems, searchAssets, validWorkItem } from './operations';

afterEach(() => vi.unstubAllGlobals());

describe('inventario y bitácora local', () => {
  it('filtra el inventario por permisos, instalación y texto sin acentos', () => {
    expect(searchAssets(['aguapozo'], 'all', '')).toHaveLength(6);
    expect(searchAssets(['aguapozo'], 'nutrial', '')).toHaveLength(0);
    expect(searchAssets(['aguapozo'], 'all', 'dosificacion')).toHaveLength(1);
  });

  it('descarta registros guardados con forma inválida', () => {
    const entry = { id: '1', project: 'aguapozo', asset: 'P-101', title: 'Revisión', priority: 'Alta', status: 'Pendiente', owner: 'Técnico', due: '', created: '2026-11-17', events: [] };
    expect(validWorkItem(entry)).toBe(true);
    expect(validWorkItem({ id: 'x' })).toBe(false);
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === 'a' ? JSON.stringify([entry, { bad: true }]) : 'no-es-json') });
    expect(readWorkItems('a')).toHaveLength(1);
    expect(readWorkItems('b')).toEqual([]);
  });
});
