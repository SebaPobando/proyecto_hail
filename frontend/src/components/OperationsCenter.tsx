import { useState, type FormEvent } from 'react';
import { StatusBadge } from '../design-system';
import { alarmTotals, canOperate, priorityLabel, priorityTone, workPriorityLabel, workStatusLabel } from '../services/alarms';
import { downloadCsv } from '../services/exportCsv';
import {
  addWorkItemNote, createWorkItem, getConnectivity, listWorkItems, updateWorkItem,
  type AlarmSummary, type Connectivity, type ProjectSummary, type WorkItem, type WorkPriority, type WorkStatus,
} from '../services/hail';
import { useRouteValue } from '../services/navigation';
import { assets, searchAssets } from '../services/operations';
import type { DataStatus } from '../services/projectStatus';
import { usePolling } from '../services/usePolling';
import AlarmsPanel from './AlarmsPanel';
import './operationsCenter.css';

export const operationPages = ['Resumen', 'Alarmas', 'Instalaciones', 'Equipos', 'Seguimiento', 'Conectividad'] as const;
export type OperationPage = typeof operationPages[number];

const date = (value?: string | null) => (value ? new Date(value).toLocaleString('es-CL') : 'Sin lectura');
const subtitles: Record<OperationPage, string> = {
  Resumen: 'Una vista de tus instalaciones, datos y trabajo pendiente.',
  Alarmas: 'Alarmas evaluadas por Hail según las reglas de cada señal. Reconócelas para dejar constancia de quién se hizo cargo.',
  Instalaciones: 'Abre una instalación para consultar su HMI y sus indicadores.',
  Equipos: 'Inventario de ingeniería y acceso a cada proceso.',
  Seguimiento: 'Revisiones e intervenciones compartidas con todo el equipo de cada instalación.',
  Conectividad: 'Distingue disponibilidad de datos de estado físico del proceso.',
};
const deviceKinds: Record<string, string> = { gateway: 'Gateway', plc: 'PLC', meter: 'Medidor', other: 'Otro' };

export function workerLabel(worker: Connectivity['worker']): { label: string; tone: 'ok' | 'warning' | 'critical' | 'stopped' } {
  if (!worker) return { label: 'No iniciado', tone: 'stopped' };
  if (!worker.online) return { label: 'Sin señal de vida', tone: 'critical' };
  if (!worker.broker_connected) return { label: 'Broker desconectado', tone: 'warning' };
  return { label: 'En línea', tone: 'ok' };
}

function ConnectivityPage({ projects }: { projects: ProjectSummary[] }) {
  const slugs = projects.map(project => project.slug);
  const poll = usePolling(
    signal => Promise.all(slugs.map(slug => getConnectivity(slug, signal))),
    15_000,
    `connectivity:${slugs.join('|')}`,
    slugs.length > 0,
  );
  const results = poll.data;
  const worker = results?.[0]?.worker ?? null;
  const workerState = workerLabel(worker);
  return <>
    <div className="ops-notice">Hail solo observa lo que le llega: un dispositivo "sin comunicación" significa que no han llegado sus mensajes en el último minuto, no que el equipo esté apagado. El estado físico del PLC y de la red del cliente no se diagnostica desde aquí.</div>
    {poll.error && <p role="alert" className="ops-notice">No se pudo consultar la conectividad. {poll.error.message}</p>}
    <section className="ops-panel">
      <h2>Recepción de datos (MQTT)</h2>
      <p><StatusBadge tone={workerState.tone}>{workerState.label}</StatusBadge></p>
      <p>{worker
        ? <>Última señal de vida: {date(worker.last_heartbeat)} · Último mensaje recibido: {date(worker.last_message_at)}
          {worker.messages_accepted != null && <> · Mensajes aceptados: {worker.messages_accepted} · rechazados: {worker.messages_rejected}</>}</>
        : 'El servicio que recibe los mensajes MQTT no ha reportado actividad. Con el simulador directo (sin broker) es lo esperado.'}</p>
    </section>
    <div className="ops-table"><table>
      <thead><tr><th>Instalación</th><th>Dispositivo</th><th>Tipo</th><th>Estado</th><th>Última comunicación</th></tr></thead>
      <tbody>{projects.flatMap((project, index) => (results?.[index]?.devices ?? []).map(device => <tr key={`${project.slug}/${device.code}`}>
        <th>{project.name}</th>
        <td><b>{device.code}</b> · {device.name}</td>
        <td>{deviceKinds[device.kind] ?? device.kind}</td>
        <td><StatusBadge tone={device.online ? 'ok' : device.last_seen_at ? 'critical' : 'stopped'}>{device.online ? 'Comunicando' : device.last_seen_at ? 'Sin comunicación' : 'Nunca ha enviado datos'}</StatusBadge></td>
        <td>{date(device.last_seen_at)}</td>
      </tr>))}</tbody>
    </table>{!results && !poll.error && <p className="ops-empty" role="status">Consultando…</p>}</div>
    <section className="ops-panel">
      <h2>Cadena de datos</h2>
      <div className="ops-pipeline">{['Equipo / PLC', 'Gateway', 'Broker MQTT', 'Recepción (worker)', 'Base de datos y web'].map((step, i) => <span key={step}><small>0{i + 1}</small>{step}</span>)}</div>
      <p>Hail ve los tramos 3 a 5: el broker, el worker que recibe los mensajes y la base de datos. Los tramos 1 y 2 se infieren por la llegada de mensajes de cada dispositivo.</p>
    </section>
  </>;
}

type WorkFilters = { project: string; search: string; status: string };

/** Bitácora compartida: la ven todos los que tienen acceso a la instalación; escriben los operadores. */
function WorkLog({ projects, filters, draft, setDraft }: {
  projects: ProjectSummary[]; filters: WorkFilters; draft: boolean; setDraft: (open: boolean) => void;
}) {
  const poll = usePolling(signal => listWorkItems({ signal }), 15_000, 'work-items');
  const operable = projects.filter(canOperate);
  const names = Object.fromEntries(projects.map(project => [project.slug, project.name]));
  const bySlug = new Map(projects.map(project => [project.slug, project]));
  const [draftProject, setDraftProject] = useState(operable[0]?.slug ?? '');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const items = (poll.data ?? []).filter(item => bySlug.has(item.project));
  const list = items.filter(i => (filters.project === 'all' || i.project === filters.project)
    && (filters.status === 'Todos' || workStatusLabel[i.status] === filters.status)
    && `${i.title} ${i.asset} ${i.owner}`.toLowerCase().includes(filters.search.toLowerCase()));

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      poll.refresh();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const ok = await run(() => createWorkItem({
      project: String(values.get('project')),
      asset: String(values.get('asset')),
      title: String(values.get('title')).trim(),
      priority: String(values.get('priority')) as WorkPriority,
      owner: String(values.get('owner')).trim(),
      due_date: String(values.get('due')) || null,
    }));
    if (ok) setDraft(false);
  }

  const exportWork = () => downloadCsv('bitacora.csv', [
    ['Fuente', 'Bitácora compartida de Hail'],
    ['Instalación', 'Equipo', 'Asunto', 'Prioridad', 'Estado', 'Responsable', 'Fecha objetivo', 'Creado', 'Creado por', 'Bitácora'],
    ...list.map(i => [names[i.project], i.asset, i.title, workPriorityLabel[i.priority], workStatusLabel[i.status], i.owner, i.due_date ?? '',
      i.created_at, i.created_by ?? '', i.events.map(e => `${e.created_at} ${e.author ?? ''}: ${e.text}`).join(' | ')]),
  ]);

  return <>
    <div className="ops-notice">Bitácora compartida: la ve todo el equipo con acceso a cada instalación y cada cambio queda con autor y hora. {!operable.length && 'Tu rol permite verla; escribir requiere rol de operador.'}</div>
    <div className="ops-section-title"><h2>Revisiones e intervenciones</h2><button disabled={!list.length} onClick={exportWork}>Exportar bitácora CSV</button></div>
    {error && <p role="alert" className="ops-notice">{error}</p>}
    {poll.error && <p role="alert" className="ops-notice">No se pudo cargar la bitácora. {poll.error.message}</p>}
    {draft && operable.length > 0 && <form className="ops-panel ops-work-form" onSubmit={submit}>
      <h3>Nuevo seguimiento</h3>
      <label>Instalación<select name="project" value={draftProject} onChange={e => setDraftProject(e.target.value)}>{operable.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
      <label>Equipo<select name="asset" key={draftProject}><option value="">Instalación general</option>{assets.filter(a => a.project === draftProject).map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}</select></label>
      <label className="ops-wide">Asunto<input name="title" required maxLength={160} placeholder="Ej. Verificar señal de nivel del estanque"/></label>
      <label>Responsable<input name="owner" maxLength={100} placeholder="Nombre del responsable"/></label>
      <label>Fecha objetivo<input name="due" type="date"/></label>
      <label>Prioridad<select name="priority"><option value="normal">Normal</option><option value="high">Alta</option></select></label>
      <div className="ops-wide"><button className="ops-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar seguimiento'}</button><button type="button" onClick={() => setDraft(false)}>Cancelar</button></div>
    </form>}
    <div className="ops-work-list">{list.map(i => {
      const writable = canOperate(bySlug.get(i.project));
      return <article className="ops-panel" key={i.id}>
        <div className="ops-section-title">
          <div><span className="ops-badge">{workPriorityLabel[i.priority]} · {workStatusLabel[i.status]}</span><h3>{i.title}</h3>
            <small>{names[i.project]} / {i.asset || 'General'} · {i.owner || 'Sin responsable'} · Fecha objetivo: {i.due_date ?? 'Sin fecha'}{i.alarm_id ? ' · Nació de una alarma' : ''}</small></div>
          <button onClick={() => setExpanded(expanded === i.id ? null : i.id)}>Bitácora ({i.events.length}) {expanded === i.id ? '−' : '＋'}</button>
        </div>
        <label>Estado del seguimiento <select value={i.status} disabled={!writable || busy} onChange={e => void run(() => updateWorkItem(i.id, { status: e.target.value as WorkStatus }))}>
          {(Object.keys(workStatusLabel) as WorkStatus[]).map(status => <option key={status} value={status}>{workStatusLabel[status]}</option>)}
        </select></label>
        {expanded === i.id && <div className="ops-timeline">
          {i.events.map((event, n) => <div key={n}><small>{date(event.created_at)} · {event.author ?? 'usuario eliminado'}</small><p>{event.text}</p></div>)}
          {writable && <form onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const text = String(new FormData(form).get('note')).trim();
            if (text && await run(() => addWorkItemNote(i.id, text))) form.reset();
          }}>
            <label>Añadir nota<textarea name="note" maxLength={1500} required/></label>
            <button disabled={busy}>Añadir a bitácora</button>
          </form>}
        </div>}
      </article>;
    })}{poll.data && !list.length && <div className="ops-panel ops-empty">No hay seguimientos que mostrar.</div>}
    {!poll.data && !poll.error && <p role="status">Cargando bitácora…</p>}</div>
  </>;
}

export default function OperationsCenter({ page, projects, statuses, alarms, openProject, showPage }: {
  page: OperationPage;
  projects: ProjectSummary[];
  statuses: Record<string, DataStatus>;
  alarms: AlarmSummary[];
  openProject: (slug: string) => void;
  showPage: (page: OperationPage) => void;
}) {
  const allowed = projects.map(project => project.slug);
  const names = Object.fromEntries(projects.map(project => [project.slug, project.name]));
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [workFilter, setWorkFilter] = useState('Todos');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [draft, setDraft] = useState(false);
  const [alarmProject, setAlarmProject] = useRouteValue('alarmProject', 'all', ['all', ...allowed]);
  const catalog = searchAssets(allowed, filter, search);
  const asset = assets.find(a => `${a.project}/${a.id}` === selectedAsset && allowed.includes(a.project));
  const liveCount = allowed.filter(slug => statuses[slug]?.live).length;
  const totals = alarmTotals(alarms, allowed);
  const alarmOf = (slug: string) => alarms.find(row => row.project === slug);
  const anyOperable = projects.some(canOperate);

  const cards = <div className="ops-installations">{projects.map(project => {
    const status = statuses[project.slug];
    const alarm = alarmOf(project.slug);
    return <article className="ops-installation" key={project.slug}>
      {project.image && <img src={`/projects/${project.image}`} alt={`Vista representativa de ${project.name}`}/>}
      <div>
        <div className="ops-badges">
          {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
          {alarm && <StatusBadge tone={priorityTone[alarm.highest_priority]}>{alarm.open === 1 ? '1 alarma' : `${alarm.open} alarmas`}</StatusBadge>}
        </div>
        <h2>{project.name}</h2>
        <p>{project.description}</p>
        <dl>
          <div><dt>Cliente</dt><dd>{project.organization.name}</dd></div>
          <div><dt>Alarmas sin reconocer</dt><dd>{alarm?.unacknowledged ?? 0}</dd></div>
        </dl>
        <small>Última lectura: {date(status?.lastTime)}</small>
        <button onClick={() => openProject(project.slug)}>Abrir supervisión <span>↗</span></button>
      </div>
    </article>;
  })}</div>;

  return <section className="ops-center" aria-label="Centro de operaciones">
    <div className="ops-heading">
      <div><p>SUPERVISIÓN INDUSTRIAL / {page.toUpperCase()}</p><h1>{page === 'Resumen' ? 'Centro de operaciones' : page}</h1><span>{subtitles[page]}</span></div>
      <button className="ops-primary" onClick={() => { showPage('Seguimiento'); setDraft(true); }} disabled={!anyOperable}>＋ Registrar seguimiento</button>
    </div>

    {page === 'Resumen' && <>
      <div className="ops-kpis">{([
        ['Instalaciones asignadas', allowed.length, 'Acceso según tu cuenta'],
        ['Con datos de campo en línea', liveCount, 'No cuenta datos simulados'],
        ['Alarmas abiertas', totals.open, `${totals.unacknowledged} sin reconocer`],
        ['Equipos catalogados', assets.filter(a => allowed.includes(a.project)).length, 'Inventario de ingeniería'],
      ] as const).map(([title, value, caption]) => <article key={title} className={title === 'Alarmas abiertas' && totals.unacknowledged ? 'is-alarm' : undefined}>
        <span>{title}</span><strong>{value}</strong><small>{caption}</small>
      </article>)}</div>
      <div className="ops-section-title"><h2>Tus instalaciones</h2><button onClick={() => showPage('Conectividad')}>Ver conectividad →</button></div>
      {cards}
      <div className="ops-bottom">
        <section className="ops-panel"><h2>Alarmas que requieren atención</h2>{alarms.length
          ? alarms.map(row => <button className="ops-action-row" key={row.project} onClick={() => { setAlarmProject(row.project); showPage('Alarmas'); }}>
            <span><b>{names[row.project]}</b><small>{row.unacknowledged} sin reconocer · {row.active} activas</small></span>
            <StatusBadge tone={priorityTone[row.highest_priority]}>Prioridad {priorityLabel[row.highest_priority].toLowerCase()}</StatusBadge>
          </button>)
          : <div className="ops-empty">No hay alarmas abiertas.<p>Las alarmas se evalúan con las reglas configuradas para cada señal en la administración.</p></div>}
        </section>
        <section className="ops-panel"><h2>Estado de la operación</h2>
          <p>Los estados de cada instalación se calculan con las lecturas que recibe Hail: "Simulación" indica datos de prueba y "Datos antiguos", que no llegan lecturas recientes.</p>
          <p>Una instalación sin reglas de alarma configuradas no generará alarmas: revisa sus señales en la administración.</p>
          <button onClick={() => showPage('Seguimiento')}>Ver bitácora →</button>
        </section>
      </div>
    </>}

    {page === 'Alarmas' && <>
      <div className="ops-filters">
        <label>Instalación<select value={alarmProject} onChange={e => setAlarmProject(e.target.value)}><option value="all">Todas las asignadas</option>{projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
      </div>
      <AlarmsPanel key={alarmProject} projects={projects} project={alarmProject === 'all' ? undefined : alarmProject} showProject={alarmProject === 'all'}/>
    </>}

    {page === 'Instalaciones' && cards}

    {(page === 'Equipos' || page === 'Seguimiento') && <div className="ops-filters">
      <label>Instalación<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas las asignadas</option>{projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
      <label>Buscar<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={page === 'Equipos' ? 'Tag, equipo o categoría' : 'Asunto, equipo o responsable'}/></label>
      {page === 'Seguimiento' && <label>Estado<select value={workFilter} onChange={e => setWorkFilter(e.target.value)}>{['Todos', ...Object.values(workStatusLabel)].map(s => <option key={s}>{s}</option>)}</select></label>}
      <button onClick={() => { setFilter('all'); setSearch(''); setWorkFilter('Todos'); }}>Limpiar</button>
    </div>}

    {page === 'Equipos' && <>
      <div className="ops-section-title"><span>{catalog.length} equipos de referencia</span><button onClick={() => downloadCsv('inventario.csv', [['Tag', 'Equipo', 'Instalación', 'Categoría', 'Origen'], ...catalog.map(a => [a.id, a.name, names[a.project], a.category, a.source])])}>Exportar inventario CSV</button></div>
      <div className="ops-table"><table>
        <thead><tr><th>Tag</th><th>Equipo</th><th>Instalación</th><th>Categoría</th><th>Ficha</th></tr></thead>
        <tbody>{catalog.map(a => <tr key={`${a.project}/${a.id}`}><td><b>{a.id}</b></td><td>{a.name}</td><td>{names[a.project]}</td><td>{a.category}</td><td><button onClick={() => setSelectedAsset(`${a.project}/${a.id}`)}>Ver ficha</button></td></tr>)}</tbody>
      </table>{!catalog.length && <p className="ops-empty">Sin equipos que coincidan con la búsqueda.</p>}</div>
      {asset && <section className="ops-panel">
        <div className="ops-section-title"><h2>{asset.id} · {asset.name}</h2><button onClick={() => setSelectedAsset('')}>Cerrar ficha</button></div>
        <p>{asset.source} · {names[asset.project]}</p>
        <p>Serie, fecha de instalación y mantenimiento: pendientes de levantamiento en terreno.</p>
        <button onClick={() => openProject(asset.project)}>Abrir HMI</button>
      </section>}
    </>}

    {page === 'Seguimiento' && <WorkLog projects={projects} filters={{ project: filter, search, status: workFilter }} draft={draft} setDraft={setDraft}/>}

    {page === 'Conectividad' && <ConnectivityPage projects={projects}/>}
    {!allowed.length && <p className="ops-empty">Tu cuenta no tiene instalaciones asignadas.</p>}
  </section>;
}
