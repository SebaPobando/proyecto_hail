import { useState } from 'react';
import { StatusBadge } from '../design-system';
import { downloadCsv } from '../services/exportCsv';
import { getConnectivity, type Connectivity, type ProjectSummary } from '../services/hail';
import { assets, readWorkItems, searchAssets, type WorkItem } from '../services/operations';
import type { DataStatus } from '../services/projectStatus';
import { usePolling } from '../services/usePolling';
import './operationsCenter.css';

export const operationPages = ['Resumen', 'Instalaciones', 'Equipos', 'Seguimiento', 'Conectividad'] as const;
export type OperationPage = typeof operationPages[number];

const date = (value?: string | null) => (value ? new Date(value).toLocaleString('es-CL') : 'Sin lectura');
const subtitles: Record<OperationPage, string> = {
  Resumen: 'Una vista de tus instalaciones, datos y trabajo pendiente.',
  Instalaciones: 'Abre una instalación para consultar su HMI y sus indicadores.',
  Equipos: 'Inventario de ingeniería y acceso a cada proceso.',
  Seguimiento: 'Organiza revisiones e intervenciones con una bitácora por equipo.',
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

export default function OperationsCenter({ page, projects, userId, statuses, openProject, showPage }: {
  page: OperationPage;
  projects: ProjectSummary[];
  userId: string;
  statuses: Record<string, DataStatus>;
  openProject: (slug: string) => void;
  showPage: (page: OperationPage) => void;
}) {
  const allowed = projects.map(project => project.slug);
  const names = Object.fromEntries(projects.map(project => [project.slug, project.name]));
  const key = `operations-work-v1:${userId}`;
  const [allItems, setItems] = useState<WorkItem[]>(() => readWorkItems(key));
  const [saveError, setSaveError] = useState('');
  const items = allItems.filter(item => allowed.includes(item.project));
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [workFilter, setWorkFilter] = useState('Todos');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [expanded, setExpanded] = useState('');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState(false);
  const [draftProject, setDraftProject] = useState(allowed[0] ?? '');
  const catalog = searchAssets(allowed, filter, search);
  const asset = assets.find(a => `${a.project}/${a.id}` === selectedAsset && allowed.includes(a.project));
  const open = items.filter(item => item.status !== 'Resuelto');
  const liveCount = allowed.filter(slug => statuses[slug]?.live).length;

  const persist = (next: WorkItem[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setItems(next);
      setSaveError('');
      return true;
    } catch {
      setSaveError('No se pudo guardar en este navegador. Exporta tus registros antes de continuar.');
      return false;
    }
  };
  const change = (id: string, update: Partial<WorkItem>, text: string) => persist(allItems.map(item =>
    item.id === id && allowed.includes(item.project) ? { ...item, ...update, events: [...item.events, { at: new Date().toISOString(), text }] } : item));
  const exportWork = () => downloadCsv('seguimiento-local.csv', [
    ['Fuente', 'Registros manuales de este navegador; no son alarmas de campo'],
    ['Instalación', 'Equipo', 'Asunto', 'Prioridad', 'Estado', 'Responsable', 'Fecha objetivo', 'Creado', 'Bitácora'],
    ...items.map(i => [names[i.project], i.asset, i.title, i.priority, i.status, i.owner, i.due, i.created, i.events.map(e => `${e.at}: ${e.text}`).join(' | ')]),
  ]);
  const list = items.filter(i => (filter === 'all' || i.project === filter) && (workFilter === 'Todos' || i.status === workFilter)
    && `${i.title} ${i.asset} ${i.owner}`.toLowerCase().includes(search.toLowerCase()));

  const cards = <div className="ops-installations">{projects.map(project => {
    const status = statuses[project.slug];
    return <article className="ops-installation" key={project.slug}>
      {project.image && <img src={`/projects/${project.image}`} alt={`Vista representativa de ${project.name}`}/>}
      <div>
        {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        <h2>{project.name}</h2>
        <p>{project.description}</p>
        <dl>
          <div><dt>Cliente</dt><dd>{project.organization.name}</dd></div>
          <div><dt>Pendientes manuales</dt><dd>{open.filter(i => i.project === project.slug).length}</dd></div>
        </dl>
        <small>Última lectura: {date(status?.lastTime)}</small>
        <button onClick={() => openProject(project.slug)}>Abrir supervisión <span>↗</span></button>
      </div>
    </article>;
  })}</div>;

  return <section className="ops-center" aria-label="Centro de operaciones">
    <div className="ops-heading">
      <div><p>SUPERVISIÓN INDUSTRIAL / {page.toUpperCase()}</p><h1>{page === 'Resumen' ? 'Centro de operaciones' : page}</h1><span>{subtitles[page]}</span></div>
      <button className="ops-primary" onClick={() => { showPage('Seguimiento'); setDraft(true); }} disabled={!allowed.length}>＋ Registrar seguimiento</button>
    </div>
    {saveError && <p role="alert" className="ops-notice">{saveError}</p>}

    {page === 'Resumen' && <>
      <div className="ops-kpis">{([
        ['Instalaciones asignadas', allowed.length, 'Acceso según tu cuenta'],
        ['Con datos de campo en línea', liveCount, 'No cuenta datos simulados'],
        ['Equipos catalogados', assets.filter(a => allowed.includes(a.project)).length, 'Inventario de ingeniería'],
        ['Seguimientos abiertos', open.length, 'Registros locales manuales'],
      ] as const).map(([title, value, caption]) => <article key={title}><span>{title}</span><strong>{value}</strong><small>{caption}</small></article>)}</div>
      <div className="ops-section-title"><h2>Tus instalaciones</h2><button onClick={() => showPage('Conectividad')}>Ver conectividad →</button></div>
      {cards}
      <div className="ops-bottom">
        <section className="ops-panel"><h2>Próximas acciones</h2>{open.length
          ? open.slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 4).map(i => <button className="ops-action-row" key={i.id} onClick={() => { showPage('Seguimiento'); setExpanded(i.id); }}>
            <span><b>{i.title}</b><small>{names[i.project]} · {i.owner || 'Sin responsable'}</small></span><span>{i.due || 'Sin fecha'}</span>
          </button>)
          : <div className="ops-empty">No hay seguimientos registrados.<p>Registra una revisión o una tarea de puesta en marcha para comenzar.</p></div>}
        </section>
        <section className="ops-panel"><h2>Estado de la operación</h2>
          <p>Los estados de cada instalación se calculan con las lecturas que recibe Hail: "Simulación" indica datos de prueba y "Datos antiguos", que no llegan lecturas recientes.</p>
          <p>Las alarmas de campo llegan en la próxima fase. Este resumen no certifica ausencia de alarmas.</p>
          <button onClick={() => showPage('Equipos')}>Consultar inventario →</button>
        </section>
      </div>
    </>}

    {page === 'Instalaciones' && cards}

    {(page === 'Equipos' || page === 'Seguimiento') && <div className="ops-filters">
      <label>Instalación<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas las asignadas</option>{projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
      <label>Buscar<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={page === 'Equipos' ? 'Tag, equipo o categoría' : 'Asunto, equipo o responsable'}/></label>
      {page === 'Seguimiento' && <label>Estado<select value={workFilter} onChange={e => setWorkFilter(e.target.value)}>{['Todos', 'Pendiente', 'En atención', 'Resuelto'].map(s => <option key={s}>{s}</option>)}</select></label>}
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
        <p>{items.filter(i => i.project === asset.project && i.asset === asset.id).length} seguimientos locales asociados.</p>
        <button onClick={() => openProject(asset.project)}>Abrir HMI</button>
      </section>}
    </>}

    {page === 'Seguimiento' && <>
      <div className="ops-notice">Bitácora local · guardada en este navegador para tu cuenta. No se sincroniza con otros usuarios ni envía notificaciones. Exporta una copia para conservarla.</div>
      <div className="ops-section-title"><h2>Revisiones e intervenciones</h2><button disabled={!items.length} onClick={exportWork}>Exportar bitácora CSV</button></div>
      {draft && <form className="ops-panel ops-work-form" onSubmit={e => {
        e.preventDefault();
        const values = new FormData(e.currentTarget);
        const project = String(values.get('project'));
        if (!allowed.includes(project)) return;
        const now = new Date().toISOString();
        const entry: WorkItem = {
          id: crypto.randomUUID(), project, asset: String(values.get('asset')), title: String(values.get('title')).trim(),
          priority: String(values.get('priority')) as WorkItem['priority'], status: 'Pendiente', owner: String(values.get('owner')).trim(),
          due: String(values.get('due')), created: now, events: [{ at: now, text: 'Seguimiento manual creado' }],
        };
        if (!entry.title) return;
        if (persist([entry, ...allItems])) setDraft(false);
      }}>
        <h3>Nuevo seguimiento manual</h3>
        <label>Instalación<select name="project" value={draftProject} onChange={e => setDraftProject(e.target.value)}>{projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
        <label>Equipo<select name="asset" key={draftProject}><option value="">Instalación general</option>{assets.filter(a => a.project === draftProject).map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}</select></label>
        <label className="ops-wide">Asunto<input name="title" required maxLength={160} placeholder="Ej. Verificar señal de nivel del estanque"/></label>
        <label>Responsable<input name="owner" maxLength={100} placeholder="Nombre del responsable"/></label>
        <label>Fecha objetivo<input name="due" type="date"/></label>
        <label>Prioridad<select name="priority"><option>Normal</option><option>Alta</option></select></label>
        <div className="ops-wide"><button className="ops-primary">Guardar en este navegador</button><button type="button" onClick={() => setDraft(false)}>Cancelar</button></div>
      </form>}
      <div className="ops-work-list">{list.map(i => <article className="ops-panel" key={i.id}>
        <div className="ops-section-title">
          <div><span className="ops-badge">{i.priority} · {i.status}</span><h3>{i.title}</h3><small>{names[i.project]} / {i.asset || 'General'} · {i.owner || 'Sin responsable'} · Fecha objetivo: {i.due || 'Sin fecha'}</small></div>
          <button onClick={() => { setExpanded(expanded === i.id ? '' : i.id); setNote(''); }}>Bitácora {expanded === i.id ? '−' : '＋'}</button>
        </div>
        <label>Estado del seguimiento <select value={i.status} onChange={e => change(i.id, { status: e.target.value as WorkItem['status'] }, `Estado cambiado a ${e.target.value}`)}>{['Pendiente', 'En atención', 'Resuelto'].map(s => <option key={s}>{s}</option>)}</select></label>
        {expanded === i.id && <div className="ops-timeline">
          {i.events.map((event, n) => <div key={n}><small>{date(event.at)}</small><p>{event.text}</p></div>)}
          <form onSubmit={e => { e.preventDefault(); if (note.trim() && change(i.id, {}, note.trim())) setNote(''); }}>
            <label>Añadir nota<textarea value={note} maxLength={1500} required onChange={e => setNote(e.target.value)}/></label>
            <button>Añadir a bitácora</button>
          </form>
        </div>}
      </article>)}{!list.length && <div className="ops-panel ops-empty">No hay seguimientos que mostrar.</div>}</div>
    </>}

    {page === 'Conectividad' && <ConnectivityPage projects={projects}/>}
    {!allowed.length && <p className="ops-empty">Tu cuenta no tiene instalaciones asignadas.</p>}
  </section>;
}
