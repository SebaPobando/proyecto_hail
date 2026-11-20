import { describe, expect, it } from 'vitest';
import { detailValues } from '../components/MeterDetail';
import { reportPlan } from '../components/MeterAnalysis';
import { average, onlineTone, thdTone } from '../components/ElectricalOverview';
import { tokens } from '../design-system';
import { iso, reading } from '../test/fixtures';
import type { Device } from './hail';
import { buildMeters, mergeSeries, summarizeBuckets } from './meters';

const device = (code: string, kind = 'meter'): Device => ({ code, name: `Medidor ${code}`, kind, hardware_model: 'Modelo', last_seen_at: null });

describe('buildMeters', () => {
  it('arma un medidor por dispositivo de tipo medidor, ordenado por código', () => {
    const meters = buildMeters([device('med-02'), device('cbox-01', 'gateway'), device('med-01')], [
      reading('MED-01-VAN', 231.2, { quality: 'simulated' }), reading('MED-01-P', 6.1, { quality: 'simulated' }),
      reading('MED-02-VAN', 230, { stale: true, time: iso(-120_000) }),
    ]);
    expect(meters.map(m => m.code)).toEqual(['med-01', 'med-02']);
    expect(meters[0]).toMatchObject({ prefix: 'MED-01', online: true, simulated: true, voltage: 231.2, power: 6.1, current: null });
    // Una lectura vencida no se muestra como valor actual.
    expect(meters[1]).toMatchObject({ online: false, voltage: null, lastTime: iso(-120_000) });
  });

  it('un medidor sin señales queda sin comunicación', () => {
    expect(buildMeters([device('med-05')], [])[0]).toMatchObject({ online: false, simulated: false, lastTime: null });
  });

  it('no infiere fases ni potencias que el equipo no reporta', () => {
    const [meter] = buildMeters([device('med-01')], [reading('MED-01-IA', 10), reading('MED-01-VAN', 230), reading('MED-01-VAB', 400)]);
    const detail = detailValues(meter);
    expect(detail.currents).toEqual([10, null, null, null]);
    expect(detail.voltages).toEqual([230, null, null, 400, null, null]);
    expect(detail.apparent).toBeNull();
    expect(detail.reactive).toBeNull();
  });
});

describe('historial y reportes', () => {
  const bucket = (time: string, avg: number, count = 2) => ({ time, avg, min: avg - 1, max: avg + 1, count });

  it('mergeSeries une columnas por intervalo con huecos en null', () => {
    const rows = mergeSeries({ start: iso(), end: iso(120_000), bucket_seconds: 60, series: [
      { tag: 'MED-01-VAN', unit: 'V', points: [bucket(iso(), 230), bucket(iso(60_000), 231)] },
      { tag: 'MED-01-F', unit: 'Hz', points: [bucket(iso(60_000), 50)] },
    ] }, { va: 'MED-01-VAN', hz: 'MED-01-F' });
    expect(rows).toEqual([
      { timestamp: Date.parse(iso()), va: 230, hz: null },
      { timestamp: Date.parse(iso(60_000)), va: 231, hz: 50 },
    ]);
  });

  it('summarizeBuckets pondera el promedio por muestras y usa mínimos y máximos reales', () => {
    expect(summarizeBuckets([bucket(iso(), 10, 1), bucket(iso(60_000), 20, 3)])).toEqual({ min: 9, max: 21, avg: 17.5, buckets: 2, samples: 4 });
    expect(summarizeBuckets([])).toEqual({ min: null, max: null, avg: null, buckets: 0, samples: 0 });
  });

  it('reportPlan respeta los límites del backend', () => {
    const day = 86_400_000;
    expect(reportPlan(0, day, 15)).toEqual({ points: 96 });
    expect(reportPlan(day, 0, 15)).toHaveProperty('error');
    expect(reportPlan(0, 32 * day, 60)).toHaveProperty('error');
    expect(reportPlan(0, 30 * day, 15)).toHaveProperty('error'); // 2880 intervalos > 2000
    expect(reportPlan(0, 30 * day, 30)).toEqual({ points: 1440 });
  });
});

describe('resumen eléctrico', () => {
  it('el promedio ignora valores ausentes y no inventa un cero', () => {
    expect(average([230, null, 232])).toBe(231);
    expect(average([null])).toBeNull();
  });

  it('colorea con los estados del design system', () => {
    expect(onlineTone(3, 3)).toBe(tokens.status.ok);
    expect(onlineTone(3, 5)).toBe(tokens.status.warning);
    expect(onlineTone(0, 5)).toBe(tokens.status.critical);
    expect(thdTone(2.1)).toBe(tokens.status.ok);
    expect(thdTone(6)).toBe(tokens.status.warning);
    expect(thdTone(9)).toBe(tokens.status.critical);
    expect(thdTone(null)).toBe(tokens.status.stopped);
  });
});
