import type { HistoryPoint, HistoryQuery, Telemetry } from './types';

export const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MINUTE = 60_000;
export const toHistoryPoint = (data: Telemetry): HistoryPoint => ({ timestamp: Date.parse(data.timestamp), level: data.level.value, flow: data.flow.value, chlorine: data.chlorine.value, quality: data.level.quality });

/** Archivo simulado estable: no se regenera al cambiar el período. */
export function createSimulatedHistory(initial: Telemetry) {
  const start = Date.parse(initial.timestamp);
  const points: HistoryPoint[] = [];
  for (let timestamp = start - HISTORY_RETENTION_MS; timestamp < start; timestamp += MINUTE) {
    const hours = (timestamp - start) / 3_600_000;
    const level = hours >= -8 ? 68 + hours * 2.625 : 57 - 10 * Math.cos((hours + 8) * Math.PI / 12);
    points.push({ timestamp, level, flow: 12.4 + 1.2 * Math.sin(hours * 3.1) + .4 * Math.sin(hours * 7), chlorine: .65 + .018 * Math.sin(hours * 4), quality: 'simulated' });
  }
  points.push(toHistoryPoint(initial));
  let latest = toHistoryPoint(initial);
  return {
    record(data: Telemetry) {
      latest = toHistoryPoint(data);
      if (latest.timestamp - points[points.length - 1].timestamp >= MINUTE) points.push(latest);
      // Conservar un punto previo para interpolar el límite izquierdo.
      while (points.length > 1 && points[1].timestamp < latest.timestamp - HISTORY_RETENTION_MS) points.shift();
    },
    async queryHistory({ from, to, maxPoints = 241 }: HistoryQuery): Promise<HistoryPoint[]> {
      if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error('Intervalo de historial inválido');
      if (!Number.isInteger(maxPoints) || maxPoints < 2 || maxPoints > 2000) throw new Error('Cantidad de puntos inválida');
      const source = latest.timestamp > points[points.length - 1].timestamp ? [...points, latest] : points;
      const first = Math.max(from, source[0].timestamp);
      const last = Math.min(to, latest.timestamp);
      if (first > last) return [];
      const result: HistoryPoint[] = [];
      let cursor = 0;
      for (let i = 0; i < maxPoints; i++) {
        const timestamp = first + (last - first) * i / (maxPoints - 1);
        while (cursor < source.length - 2 && source[cursor + 1].timestamp < timestamp) cursor++;
        const a = source[cursor], b = source[Math.min(cursor + 1, source.length - 1)];
        const ratio = b.timestamp === a.timestamp ? 0 : (timestamp - a.timestamp) / (b.timestamp - a.timestamp);
        result.push({ timestamp, level: a.level + (b.level - a.level) * ratio, flow: a.flow + (b.flow - a.flow) * ratio, chlorine: a.chlorine + (b.chlorine - a.chlorine) * ratio, quality: 'simulated' });
      }
      return result;
    },
  };
}
