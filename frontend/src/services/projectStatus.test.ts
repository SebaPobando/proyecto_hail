import { describe, expect, it } from 'vitest';
import { iso, reading, snapshot } from '../test/fixtures';
import { lastReadingTime, summarizeLatest } from './projectStatus';

describe('summarizeLatest', () => {
  it('distingue en línea, simulación, datos antiguos, sin datos y calidad dudosa', () => {
    expect(summarizeLatest(snapshot([reading('A', 1)]))).toMatchObject({ label: 'En línea', tone: 'ok', live: true });
    expect(summarizeLatest(snapshot([reading('A', 1, { quality: 'simulated' })]))).toMatchObject({ label: 'Simulación', live: false });
    expect(summarizeLatest(snapshot([reading('A', 1, { stale: true })]))).toMatchObject({ label: 'Datos antiguos', tone: 'stale' });
    expect(summarizeLatest(snapshot([reading('A', null)]))).toMatchObject({ label: 'Sin datos' });
    expect(summarizeLatest(snapshot([reading('A', 1), reading('B', 2, { quality: 'bad' })]))).toMatchObject({ label: 'Calidad dudosa', live: false });
  });

  it('un error de consulta no se presenta como "sin datos"', () => {
    expect(summarizeLatest(null, new Error('caído'))).toMatchObject({ label: 'Sin respuesta del servidor', tone: 'critical' });
    expect(summarizeLatest(null)).toMatchObject({ label: 'Consultando…' });
  });

  it('informa la lectura más reciente aunque esté vencida', () => {
    const readings = [reading('A', 1, { time: iso(-90_000), stale: true }), reading('B', 2, { time: iso(-60_000), stale: true })];
    expect(lastReadingTime(readings)).toBe(iso(-60_000));
  });
});
