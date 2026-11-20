import { StatusBadge } from '../design-system';
import { getLatest, type LatestReading, type ProjectSummary } from '../services/hail';
import { summarizeLatest } from '../services/projectStatus';
import { usePolling } from '../services/usePolling';

const time = (value: string | null) => (value ? new Date(value).toLocaleString('es-CL') : '—');
const qualityLabels: Record<string, string> = { good: 'Válida', uncertain: 'Dudosa', bad: 'Mala', simulated: 'Simulada' };

export function formatReading(reading: LatestReading): string {
  if (reading.value === null) return '—';
  if (reading.state_label) return reading.state_label;
  const value = reading.value.toLocaleString('es-CL', {
    minimumFractionDigits: reading.decimals,
    maximumFractionDigits: reading.decimals,
  });
  return reading.unit ? `${value} ${reading.unit}` : value;
}

/** Pantalla para proyectos sin HMI propia: la lectura actual de cada señal. */
export default function GenericHmi({ project }: { project: ProjectSummary }) {
  const latest = usePolling(signal => getLatest(project.slug, signal), 5000, `generic:${project.slug}`);
  const summary = summarizeLatest(latest.data, latest.error);
  const readings = latest.data?.readings ?? [];
  return <section className="ds-card generic-hmi" aria-label={`Señales de ${project.name}`}>
    <header className="generic-hmi-header">
      <div><h2>Lectura actual</h2><p>{project.description || 'Valor más reciente de cada señal del proyecto.'}</p></div>
      <StatusBadge tone={summary.tone}>{summary.label}</StatusBadge>
    </header>
    {latest.error && <p role="alert">No se pudieron consultar las lecturas. {latest.error.message}</p>}
    <div className="portal-table-scroll" tabIndex={0} role="region" aria-label="Tabla de señales">
      <table className="ds-table">
        <thead><tr><th>Tag</th><th>Descripción</th><th>Valor</th><th>Calidad</th><th>Última lectura</th></tr></thead>
        <tbody>
          {readings.map(reading => <tr key={reading.tag} className={reading.stale ? 'is-stale' : undefined}>
            <th>{reading.tag}</th>
            <td>{reading.description}</td>
            <td>{reading.stale && reading.value !== null ? <s title="Lectura antigua">{formatReading(reading)}</s> : formatReading(reading)}</td>
            <td>{reading.stale ? (reading.time ? 'Antigua' : 'Sin datos') : qualityLabels[reading.quality ?? ''] ?? '—'}</td>
            <td>{time(reading.time)}</td>
          </tr>)}
          {latest.data && !readings.length && <tr><td colSpan={5}>Este proyecto todavía no tiene señales configuradas.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
