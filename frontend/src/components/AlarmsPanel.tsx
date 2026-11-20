import { useState, type FormEvent } from 'react';
import { StatusBadge } from '../design-system';
import {
  canOperate, duration, formatValue, needsAck, priorityLabel, priorityRank, priorityTone, raiseLabel, stateLabel,
} from '../services/alarms';
import { acknowledgeAlarm, createWorkItem, listAlarms, type Alarm, type ProjectSummary } from '../services/hail';
import { usePolling } from '../services/usePolling';
import './alarmsPanel.css';

const time = (iso: string) => new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'medium' });

/** Abiertas primero las sin reconocer, luego por prioridad y antigüedad (la más antigua arriba). */
export function sortAlarms(alarms: readonly Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) =>
    Number(needsAck(b.state)) - Number(needsAck(a.state))
    || priorityRank[a.priority] - priorityRank[b.priority]
    || Date.parse(a.raised_at) - Date.parse(b.raised_at));
}

function AlarmRow({ alarm, project, showProject, onChanged }: {
  alarm: Alarm; project?: ProjectSummary; showProject: boolean; onChanged: () => void;
}) {
  const [acking, setAcking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const operable = canOperate(project);

  async function acknowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await acknowledgeAlarm(alarm.id, String(new FormData(event.currentTarget).get('comment') ?? ''));
      setAcking(false);
      onChanged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo reconocer.');
    } finally {
      setBusy(false);
    }
  }

  async function followUp() {
    setBusy(true);
    setError('');
    try {
      await createWorkItem({
        project: alarm.project,
        title: `${alarm.tag}: ${alarm.message || alarm.description}`.slice(0, 160),
        asset: alarm.tag.slice(0, 40),
        priority: alarm.priority === 'high' ? 'high' : 'normal',
        alarm_id: alarm.id,
      });
      setNotice('Seguimiento creado en la bitácora.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo crear el seguimiento.');
    } finally {
      setBusy(false);
    }
  }

  return <article className={`alarm-row alarm-row--${alarm.priority}${needsAck(alarm.state) ? ' is-unacked' : ''}`} aria-label={`Alarma ${alarm.tag}`}>
    <header>
      <StatusBadge tone={priorityTone[alarm.priority]}>Prioridad {priorityLabel[alarm.priority].toLowerCase()}</StatusBadge>
      <span className={`alarm-state alarm-state--${alarm.state}`}>{stateLabel[alarm.state]}</span>
      {alarm.simulated && <StatusBadge tone="simulated">Datos simulados</StatusBadge>}
      {showProject && <span className="alarm-project">{alarm.project_name}</span>}
    </header>
    <h3><span className="alarm-tag">{alarm.tag}</span> {alarm.description}</h3>
    {alarm.message && <p className="alarm-message">{alarm.message}</p>}
    <dl>
      <div><dt>Condición</dt><dd>{alarm.condition}</dd></div>
      <div><dt>{raiseLabel(alarm).label}</dt><dd>{raiseLabel(alarm).value}</dd></div>
      <div><dt>Desde</dt><dd><time dateTime={alarm.raised_at}>{time(alarm.raised_at)}</time></dd></div>
      <div><dt>{alarm.cleared_at ? 'Normalizada' : 'Duración'}</dt><dd>{alarm.cleared_at
        ? <><time dateTime={alarm.cleared_at}>{time(alarm.cleared_at)}</time>{alarm.kind === 'signal' && <> · {formatValue(alarm.clear_value, alarm.unit)}</>}</>
        : duration(alarm.raised_at)}</dd></div>
    </dl>
    {alarm.acknowledged_at && <p className="alarm-ack">Reconocida por {alarm.acknowledged_by ?? 'usuario eliminado'} el {time(alarm.acknowledged_at)}{alarm.ack_comment && <>: “{alarm.ack_comment}”</>}</p>}
    {acking ? <form className="alarm-ack-form" onSubmit={acknowledge}>
      <label>Comentario (opcional)<textarea name="comment" maxLength={500} placeholder="Ej.: voy a revisar la dosificadora" autoFocus/></label>
      <div><button className="ds-button ds-button--primary ds-button--sm" disabled={busy}>{busy ? 'Reconociendo…' : 'Confirmar reconocimiento'}</button>
        <button type="button" className="ds-button ds-button--ghost ds-button--sm" onClick={() => setAcking(false)}>Cancelar</button></div>
    </form> : operable && <div className="alarm-actions">
      {needsAck(alarm.state) && <button className="ds-button ds-button--primary ds-button--sm" onClick={() => setAcking(true)}>Reconocer</button>}
      {!notice && <button className="ds-button ds-button--secondary ds-button--sm" disabled={busy} onClick={() => void followUp()}>Crear seguimiento</button>}
    </div>}
    {notice && <p role="status" className="alarm-notice">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </article>;
}

/**
 * Alarmas abiertas o historial de uno o varios proyectos. Reconocer y crear
 * seguimientos aparece solo para roles que pueden operar.
 */
export default function AlarmsPanel({ projects, project, showProject = false }: {
  projects: readonly ProjectSummary[];
  /** Slug para mostrar un solo proyecto; sin él, todos los de `projects`. */
  project?: string;
  showProject?: boolean;
}) {
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const poll = usePolling(signal => listAlarms({ project, status, signal }), status === 'open' ? 5000 : 30_000, `alarms:${project ?? '*'}:${status}`, true, { kinds: ['alarms'], project });
  const bySlug = new Map(projects.map(item => [item.slug, item]));
  const alarms = (poll.data ?? []).filter(alarm => bySlug.has(alarm.project));
  const shown = status === 'open' ? sortAlarms(alarms) : alarms;
  const unacked = alarms.filter(alarm => needsAck(alarm.state)).length;
  const readOnly = project ? !canOperate(bySlug.get(project)) : projects.every(item => !canOperate(item));

  return <section className="alarms-panel" aria-label="Alarmas">
    <div className="alarms-toolbar">
      <div className="alarms-switch" role="group" aria-label="Mostrar">
        <button aria-pressed={status === 'open'} onClick={() => setStatus('open')}>Abiertas</button>
        <button aria-pressed={status === 'all'} onClick={() => setStatus('all')}>Historial</button>
      </div>
      {status === 'open' && poll.data && <span>{alarms.length} abiertas · {unacked} sin reconocer</span>}
    </div>
    <p className="alarms-note">Avisos solo en pantalla: Hail todavía no envía correos ni mensajes. {readOnly && 'Tu rol permite ver las alarmas; reconocerlas requiere rol de operador.'}</p>
    {poll.error && <p role="alert">No se pudieron consultar las alarmas. {poll.error.message}</p>}
    {!poll.data && !poll.error && <p role="status">Consultando alarmas…</p>}
    {poll.data && !shown.length && <p className="alarms-empty" role="status">{status === 'open'
      ? 'No hay alarmas abiertas según las reglas configuradas en Hail.'
      : 'Todavía no se ha activado ninguna alarma.'}</p>}
    <div className="alarms-list">{shown.map(alarm => <AlarmRow key={alarm.id} alarm={alarm} project={bySlug.get(alarm.project)} showProject={showProject} onChanged={poll.refresh}/>)}</div>
    {status === 'all' && alarms.length >= 200 && <p className="alarms-note">Se muestran las 200 más recientes.</p>}
  </section>;
}
