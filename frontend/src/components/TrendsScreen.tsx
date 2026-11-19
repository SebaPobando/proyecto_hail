import { useEffect, useState } from 'react';
import type { HistoryPoint, HistoryService, Telemetry } from '../services/types';
import TrendChart, { InstrumentIcon, metricConfig, type TrendMetric } from './TrendChart';

const periods = [{ label: '1 h', hours: 1 }, { label: '8 h', hours: 8 }, { label: '24 h', hours: 24 }, { label: '7 días', hours: 168 }];
const dateFormat = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export default function TrendsScreen({ data, historyService }: { data?: Telemetry | null; historyService: HistoryService }) {
  const [hours, setHours] = useState(8);
  const [history, setHistory] = useState<{ hours: number; points: HistoryPoint[] } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const refreshBucket = Math.floor(now / 15_000);
  useEffect(() => {
    let cancelled = false;
    const to = now;
    setError(false);
    historyService.queryHistory({ from: to - hours * 3_600_000, to, maxPoints: 241 }).then(points => {
      if (!cancelled) setHistory({ hours, points });
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
    // El historial se consulta cada 15 s; el extremo actual se actualiza cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, refreshBucket, historyService, retry]);
  const from = now - hours * 3_600_000;
  const ready = history?.hours === hours;
  const points = ready ? history.points.filter(point => point.timestamp >= from && point.timestamp <= now) : [];
  if (data && ready) {
    const timestamp = Date.parse(data.timestamp);
    if (timestamp >= from && timestamp <= now && !points.some(point => point.timestamp === timestamp)) {
      points.push({ timestamp, level: data.level.value, flow: data.flow.value, chlorine: data.chlorine.value, quality: data.level.quality });
      points.sort((a, b) => a.timestamp - b.timestamp);
    }
  }
  return <main className="trends-screen" aria-label="Tendencias">
    <div className="trends-toolbar">
      <h2><svg viewBox="0 0 40 36" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M2 2v31h36M7 25l10-11 8 6L36 4M28 4h8v8"/></svg>Tendencias</h2>
      <div className="period-selector" role="group" aria-label="Período de tendencias"><span>Período:</span><div>{periods.map(period => <button key={period.hours} type="button" aria-pressed={hours === period.hours} onClick={() => setHours(period.hours)}>{period.label}</button>)}</div></div>
      <div className="trend-date"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="6" width="26" height="23" rx="2"/><path d="M3 13h26M10 2v8M22 2v8M9 18h4m5 0h4M9 23h4m5 0h4"/></svg>{dateFormat.format(now)}</div>
      <time className="trend-updated" dateTime={data?.timestamp}><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M16 6v11l8 4"/></svg><span>{data ? `Última lectura: ${timeFormat.format(Date.parse(data.timestamp))}` : 'Sin lectura actual'}</span></time>
    </div>
    {!data && <p role="status">Sin datos actuales. Se muestra el historial disponible del período seleccionado.</p>}
    {(['level', 'flow', 'chlorine'] as TrendMetric[]).map(metric => {
      const config = metricConfig[metric];
      return <section className={`trend-card trend-${metric}`} key={metric} aria-labelledby={`heading-${metric}`}>
        <h3 id={`heading-${metric}`}><InstrumentIcon metric={metric}/>{config.tag} – {config.title}</h3>
        <div className="trend-card-body">
          {error ? <div className="trend-message" role="alert">No se pudo cargar el historial.<button onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> : !ready ? <div className="trend-message" role="status">Cargando historial…</div> : points.length === 0 ? <div className="trend-message">Sin datos en este período.</div> : <TrendChart metric={metric} points={points} from={from} to={now} longPeriod={hours === 168}/>}
          <div className="trend-current"><span>{config.current}</span><strong>{data ? data[metric].value.toFixed(config.precision) : '—'} {config.unit}</strong>{metric === 'level' && <div className="trend-volume"><span>Volumen Estimado</span><div><strong>{data ? (data.level.value / 2).toFixed(1) : '—'} m³</strong><span>de 50.0 m³</span></div></div>}</div>
        </div>
      </section>;
    })}
  </main>;
}
