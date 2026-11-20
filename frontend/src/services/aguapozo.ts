/**
 * Adaptador de AguaPozo: convierte la lectura actual y el historial de la API
 * al formato `Telemetry` / `HistoryPoint` que usa la HMI del pozo.
 */
import { getHistory, type HistoryResponse, type LatestReading, type LatestSnapshot } from './hail';
import type { DataQuality, EquipmentStates, HistoryPoint, HistoryService, Measurement, Telemetry } from './types';

export const AGUAPOZO_TAGS = {
  level: 'LT-101',
  wellWaterDepthM: 'LT-102',
  flow: 'FT-101',
  chlorine: 'AIT-101',
  pump: 'P-101',
  dosing: 'D-101',
} as const;

/** Señales con historial en Tendencias, en el orden de las tarjetas. */
export const TREND_TAGS = { level: AGUAPOZO_TAGS.level, flow: AGUAPOZO_TAGS.flow, chlorine: AGUAPOZO_TAGS.chlorine } as const;

const PUMP: Record<number, EquipmentStates['pump']> = { 0: 'stopped', 1: 'running', 2: 'fault' };
const DOSING: Record<number, EquipmentStates['dosing']> = { 0: 'inactive', 1: 'active', 2: 'fault' };

function measurement(reading: LatestReading): Measurement {
  const quality: DataQuality = reading.stale ? 'stale' : reading.quality ?? 'bad';
  return { value: reading.value as number, quality };
}

/**
 * Devuelve null si falta cualquiera de las seis señales o un estado no es
 * reconocible: la HMI muestra entonces "sin datos" en vez de un valor inventado.
 */
export function toWaterTelemetry(snapshot: LatestSnapshot | null): Telemetry | null {
  if (!snapshot) return null;
  const byTag = new Map(snapshot.readings.map(reading => [reading.tag, reading]));
  const read = Object.fromEntries(Object.entries(AGUAPOZO_TAGS).map(([key, tag]) => [key, byTag.get(tag)])) as
    Record<keyof typeof AGUAPOZO_TAGS, LatestReading | undefined>;
  const all = Object.values(read);
  if (all.some(reading => !reading || reading.value === null || !reading.time)) return null;
  const pump = PUMP[Math.round(read.pump!.value!)];
  const dosing = DOSING[Math.round(read.dosing!.value!)];
  if (!pump || !dosing) return null;

  const timestamp = new Date(Math.max(...all.map(reading => Date.parse(reading!.time!)))).toISOString();
  const communication: EquipmentStates['communication'] = all.every(reading => reading!.stale)
    ? 'disconnected'
    : all.some(reading => reading!.quality === 'simulated') ? 'simulated' : 'connected';
  return {
    timestamp,
    level: measurement(read.level!),
    wellWaterDepthM: measurement(read.wellWaterDepthM!),
    flow: measurement(read.flow!),
    chlorine: measurement(read.chlorine!),
    states: { pump, dosing, communication },
  };
}

/** Une las series del historial por intervalo. Un intervalo sin datos de una señal queda en null (hueco). */
export function mergeTrendHistory(response: HistoryResponse): HistoryPoint[] {
  const points = new Map<number, HistoryPoint>();
  for (const [metric, tag] of Object.entries(TREND_TAGS) as [keyof typeof TREND_TAGS, string][]) {
    const series = response.series.find(item => item.tag === tag);
    for (const bucket of series?.points ?? []) {
      const timestamp = Date.parse(bucket.time);
      const point = points.get(timestamp) ?? { timestamp, level: null, flow: null, chlorine: null, quality: 'good' };
      point[metric] = bucket.avg;
      points.set(timestamp, point);
    }
  }
  return [...points.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function createApiHistory(slug: string): HistoryService {
  return {
    async queryHistory({ from, to, maxPoints = 241 }) {
      const response = await getHistory(slug, {
        tags: Object.values(TREND_TAGS),
        start: new Date(from),
        end: new Date(to),
        points: Math.min(maxPoints, 2000),
      });
      return mergeTrendHistory(response);
    },
  };
}
