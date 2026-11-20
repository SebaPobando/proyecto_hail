import { describe, expect, it } from 'vitest';
import { NOW, iso, telemetry } from '../test/fixtures';
import { isUsable, telemetryStatus, validTelemetry } from './quality';

describe('calidad de la telemetría de AguaPozo', () => {
  it('acepta una lectura válida y la vence a los 30 s', () => {
    const sample = telemetry();
    expect(validTelemetry(sample)).toBe(true);
    expect(telemetryStatus(sample, NOW)).toBe('En línea');
    expect(telemetryStatus(sample, NOW + 31_000)).toBe('Datos antiguos');
    expect(isUsable(telemetryStatus(sample, NOW + 31_000))).toBe(false);
  });

  it('detecta desconexión, valores imposibles y fechas futuras', () => {
    expect(telemetryStatus(telemetry({ states: { pump: 'running', dosing: 'active', communication: 'disconnected' } }), NOW)).toBe('Sin comunicación');
    expect(validTelemetry(telemetry({ level: { value: Number.NaN, quality: 'good' } }))).toBe(false);
    expect(validTelemetry(telemetry({ level: { value: 120, quality: 'good' } }))).toBe(false);
    expect(telemetryStatus(telemetry({ timestamp: iso(6000) }), NOW)).toBe('Datos inválidos');
  });

  it('distingue simulación de datos reales', () => {
    const simulated = telemetry({ flow: { value: 12, quality: 'simulated' } });
    expect(telemetryStatus(simulated, NOW)).toBe('Simulación');
    expect(isUsable('Simulación')).toBe(true);
    expect(telemetryStatus(telemetry({ chlorine: { value: 0.6, quality: 'bad' } }), NOW)).toBe('Calidad no válida');
  });
});
