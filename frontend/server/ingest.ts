import type { Telemetry } from '../src/services/types.ts';

export const TEST_TOPIC = 'pozoagua/pruebas/v1/telemetria';
export const limits = { level: [0, 100], wellWaterDepthM: [0, 50], flow: [0, Infinity], chlorine: [0, Infinity] } as const;

export function decodeTelemetry(payload: string, now = Date.now()): Telemetry {
  const message = JSON.parse(payload);
  if (message?.version !== 1 || typeof message.timestamp !== 'string') throw new Error('Formato MQTT de prueba inválido');
  const timestamp = Date.parse(message.timestamp);
  if (!Number.isFinite(timestamp) || timestamp > now + 5000 || timestamp < now - 7 * 86_400_000) throw new Error('Fecha de adquisición inválida');
  const measurements = Object.fromEntries(Object.entries(limits).map(([key, [min, max]]) => {
    const value = message[key];
    if (!Number.isFinite(value) || value < min || value > max) throw new Error('Medición inválida: ' + key);
    return [key, { value, quality: 'simulated' }];
  })) as Pick<Telemetry, keyof typeof limits>;
  const { pump, dosing } = message;
  if (!['running', 'stopped', 'fault'].includes(pump) || !['active', 'inactive', 'fault'].includes(dosing)) throw new Error('Estado de equipo inválido');
  return { timestamp: new Date(timestamp).toISOString(), ...measurements, states: { pump, dosing, communication: 'simulated' } };
}
