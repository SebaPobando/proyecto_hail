import { describe, expect, it } from 'vitest';
import { aguapozoReadings, iso, reading, snapshot } from '../test/fixtures';
import { mergeTrendHistory, toWaterTelemetry } from './aguapozo';

describe('toWaterTelemetry', () => {
  it('traduce tags y estados al formato de la HMI', () => {
    const data = toWaterTelemetry(snapshot(aguapozoReadings()));
    expect(data).toMatchObject({
      level: { value: 68.2, quality: 'good' },
      wellWaterDepthM: { value: 12.1 },
      flow: { value: 12.4 },
      chlorine: { value: 0.65 },
      states: { pump: 'running', dosing: 'active', communication: 'connected' },
    });
  });

  it('marca la comunicación como simulada si hay lecturas simuladas', () => {
    const data = toWaterTelemetry(snapshot(aguapozoReadings({ quality: 'simulated' })));
    expect(data?.states.communication).toBe('simulated');
    expect(data?.level.quality).toBe('simulated');
  });

  it('una lectura vencida queda con calidad stale y, si todas lo están, sin comunicación', () => {
    const data = toWaterTelemetry(snapshot(aguapozoReadings({ stale: true })));
    expect(data?.level.quality).toBe('stale');
    expect(data?.states.communication).toBe('disconnected');
  });

  it('usa la lectura más reciente como fecha', () => {
    const readings = aguapozoReadings();
    readings[2] = reading('FT-101', 12.4, { time: iso(-200) });
    expect(toWaterTelemetry(snapshot(readings))?.timestamp).toBe(iso(-200));
  });

  it('devuelve null si falta una señal o un estado no se reconoce', () => {
    expect(toWaterTelemetry(null)).toBeNull();
    expect(toWaterTelemetry(snapshot(aguapozoReadings().filter(r => r.tag !== 'AIT-101')))).toBeNull();
    const unknownPump = aguapozoReadings().map(r => (r.tag === 'P-101' ? { ...r, value: 7 } : r));
    expect(toWaterTelemetry(snapshot(unknownPump))).toBeNull();
    const fault = aguapozoReadings().map(r => (r.tag === 'P-101' ? { ...r, value: 2 } : r));
    expect(toWaterTelemetry(snapshot(fault))?.states.pump).toBe('fault');
  });
});

describe('mergeTrendHistory', () => {
  it('une las series por intervalo y deja huecos donde falta una señal', () => {
    const points = mergeTrendHistory({
      start: iso(-120_000), end: iso(), bucket_seconds: 60,
      series: [
        { tag: 'LT-101', unit: '%', points: [{ time: iso(-120_000), avg: 60, min: 59, max: 61, count: 6 }, { time: iso(-60_000), avg: 61, min: 60, max: 62, count: 6 }] },
        { tag: 'FT-101', unit: 'm³/h', points: [{ time: iso(-60_000), avg: 12, min: 12, max: 12, count: 6 }] },
        { tag: 'AIT-101', unit: 'mg/L', points: [] },
      ],
    });
    expect(points).toEqual([
      { timestamp: Date.parse(iso(-120_000)), level: 60, flow: null, chlorine: null, quality: 'good' },
      { timestamp: Date.parse(iso(-60_000)), level: 61, flow: 12, chlorine: null, quality: 'good' },
    ]);
  });
});
