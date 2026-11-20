/**
 * Medidores eléctricos: arma cada medidor a partir de sus dispositivos (API de
 * proyecto) y de la lectura actual. Las señales siguen la convención del
 * backend: `<CÓDIGO>-<VARIABLE>`, por ejemplo `MED-01-VAN`.
 */
import type { Device, HistoryBucket, HistoryResponse, LatestReading } from './hail';

export const METER_SIGNALS = {
  voltage: 'VAN',
  lineVoltage: 'VAB',
  current: 'IA',
  power: 'P',
  factor: 'FP',
  frequency: 'F',
  thd: 'THDV',
  energy: 'E',
} as const;
export type MeterField = keyof typeof METER_SIGNALS;

export type Meter = Record<MeterField, number | null> & {
  code: string;
  /** Prefijo de los tags de sus señales, por ejemplo MED-01. */
  prefix: string;
  name: string;
  model: string;
  /** Llegaron lecturas suyas dentro del plazo de vigencia. */
  online: boolean;
  /** Las lecturas vigentes son simuladas. */
  simulated: boolean;
  lastTime: string | null;
};

export const meterTag = (meter: Pick<Meter, 'prefix'>, field: MeterField) => `${meter.prefix}-${METER_SIGNALS[field]}`;

/** Un medidor por dispositivo de tipo medidor. Una lectura vencida se muestra como "—", nunca como valor actual. */
export function buildMeters(devices: readonly Device[], readings: readonly LatestReading[]): Meter[] {
  const byTag = new Map(readings.map(reading => [reading.tag, reading]));
  return devices
    .filter(device => device.kind === 'meter')
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(device => {
      const prefix = device.code.toUpperCase();
      const own = (Object.keys(METER_SIGNALS) as MeterField[]).map(field => [field, byTag.get(`${prefix}-${METER_SIGNALS[field]}`)] as const);
      const fresh = own.filter(([, reading]) => reading && !reading.stale && reading.value !== null);
      const times = own.flatMap(([, reading]) => (reading?.time ? [Date.parse(reading.time)] : []));
      const values = Object.fromEntries(own.map(([field, reading]) => [field, reading && !reading.stale ? reading.value : null])) as Record<MeterField, number | null>;
      return {
        ...values,
        code: device.code,
        prefix,
        name: device.name,
        model: device.hardware_model,
        online: fresh.length > 0,
        simulated: fresh.length > 0 && fresh.every(([, reading]) => reading!.quality === 'simulated'),
        lastTime: times.length ? new Date(Math.max(...times)).toISOString() : null,
      };
    });
}

export type SeriesRow<K extends string> = { timestamp: number } & Record<K, number | null>;

/** Une varias series del historial por intervalo; lo que falta queda en null y se dibuja como hueco. */
export function mergeSeries<K extends string>(response: HistoryResponse, columns: Record<K, string>): SeriesRow<K>[] {
  const keys = Object.keys(columns) as K[];
  const rows = new Map<number, SeriesRow<K>>();
  for (const key of keys) {
    const series = response.series.find(item => item.tag === columns[key]);
    for (const bucket of series?.points ?? []) {
      const timestamp = Date.parse(bucket.time);
      let row = rows.get(timestamp);
      if (!row) {
        row = { timestamp, ...Object.fromEntries(keys.map(k => [k, null])) } as SeriesRow<K>;
        rows.set(timestamp, row);
      }
      (row as Record<string, number | null>)[key] = bucket.avg;
    }
  }
  return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export interface SeriesSummary {
  min: number | null;
  max: number | null;
  /** Promedio ponderado por la cantidad de muestras de cada intervalo. */
  avg: number | null;
  /** Intervalos con al menos una muestra. */
  buckets: number;
  samples: number;
}

export function summarizeBuckets(points: readonly HistoryBucket[]): SeriesSummary {
  if (!points.length) return { min: null, max: null, avg: null, buckets: 0, samples: 0 };
  let min = Infinity;
  let max = -Infinity;
  let weighted = 0;
  let samples = 0;
  for (const point of points) {
    min = Math.min(min, point.min);
    max = Math.max(max, point.max);
    weighted += point.avg * point.count;
    samples += point.count;
  }
  return { min, max, avg: samples ? weighted / samples : null, buckets: points.length, samples };
}
