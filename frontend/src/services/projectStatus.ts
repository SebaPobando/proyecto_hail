import type { StatusTone } from '../design-system';
import { getLatest, type LatestReading, type LatestSnapshot, type ProjectStatus, type ProjectSummary } from './hail';
import { usePolling } from './usePolling';

export interface DataStatus {
  label: string;
  tone: StatusTone;
  /** Hay lecturas actuales de campo (no simuladas) y de calidad válida. */
  live: boolean;
  /** Fecha de la lectura más reciente del proyecto, actual o no. */
  lastTime: string | null;
}

/** Lecturas que la pantalla puede presentar como actuales. */
export const freshReadings = (readings: readonly LatestReading[]) =>
  readings.filter(reading => !reading.stale && reading.value !== null);

export function lastReadingTime(readings: readonly LatestReading[]): string | null {
  let latest: string | null = null;
  for (const reading of readings) {
    if (reading.time && (latest === null || Date.parse(reading.time) > Date.parse(latest))) latest = reading.time;
  }
  return latest;
}

/**
 * Resume el estado de los datos de un proyecto a partir de su lectura actual.
 * Describe la disponibilidad de los datos en Hail, no el estado físico del proceso.
 */
export function summarizeLatest(snapshot: LatestSnapshot | null, error: Error | null = null): DataStatus {
  const lastTime = snapshot ? lastReadingTime(snapshot.readings) : null;
  if (error) return { label: 'Sin respuesta del servidor', tone: 'critical', live: false, lastTime };
  if (!snapshot) return { label: 'Consultando…', tone: 'stopped', live: false, lastTime };
  if (!lastTime) return { label: 'Sin datos', tone: 'stopped', live: false, lastTime };
  const fresh = freshReadings(snapshot.readings);
  if (!fresh.length) return { label: 'Datos antiguos', tone: 'stale', live: false, lastTime };
  if (fresh.some(reading => reading.quality === 'bad' || reading.quality === 'uncertain')) {
    return { label: 'Calidad dudosa', tone: 'warning', live: false, lastTime };
  }
  if (fresh.every(reading => reading.quality === 'simulated')) {
    return { label: 'Simulación', tone: 'simulated', live: false, lastTime };
  }
  return { label: 'En línea', tone: 'ok', live: true, lastTime };
}

export const projectStatusLabel: Record<ProjectStatus, string> = {
  development: 'En desarrollo',
  demo: 'Demostración',
  live: 'En operación',
};

/** Estado de datos de varios proyectos, consultado cada 15 s. */
export function useProjectsDataStatus(projects: readonly ProjectSummary[], enabled = true) {
  const slugs = projects.map(project => project.slug);
  const poll = usePolling(
    signal => Promise.allSettled(slugs.map(slug => getLatest(slug, signal))),
    15_000,
    `status:${slugs.join('|')}`,
    enabled && slugs.length > 0,
  );
  const statuses: Record<string, DataStatus> = {};
  slugs.forEach((slug, index) => {
    const result = poll.data?.[index];
    statuses[slug] = !result
      ? summarizeLatest(null, poll.error)
      : result.status === 'fulfilled'
        ? summarizeLatest(result.value)
        : summarizeLatest(null, result.reason instanceof Error ? result.reason : new Error('Sin respuesta'));
  });
  return statuses;
}
