import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { HailLogo } from '../design-system';
import { alarmTotals, priorityLabel } from '../services/alarms';
import { getAlarmSummary, type AlarmSummary, type HmiType, type Me, type ProjectSummary } from '../services/hail';
import { usePolling } from '../services/usePolling';
import { useRouteValue } from '../services/navigation';
import { projectStatusLabel, useProjectsDataStatus } from '../services/projectStatus';
import OperationsCenter, { operationPages, type OperationPage } from './OperationsCenter';
import './alarmsPanel.css';
import './projectPortal.css';
import './visualIdentity.css';

// Cada HMI (y Recharts) se descarga recién al abrir un proyecto que la usa.
const WaterHmi = lazy(() => import('./WaterHmi'));
const ElectricalOverview = lazy(() => import('./ElectricalOverview'));
const NutrialHmi = lazy(() => import('./NutrialHmi'));
const GenericHmi = lazy(() => import('./GenericHmi'));

const roleLabels = { viewer: 'Lector', operator: 'Operador', org_admin: 'Administrador del cliente' } as const;
const roleRank = { viewer: 0, operator: 1, org_admin: 2 } as const;

export function roleLabel(me: Me): string {
  if (me.is_platform_admin) return 'Administrador de plataforma';
  const roles = me.organizations.map(org => org.role).sort((a, b) => roleRank[b] - roleRank[a]);
  return roles.length ? roleLabels[roles[0]] : 'Sin proyectos asignados';
}

export function initials(me: Pick<Me, 'full_name' | 'email'>): string {
  const words = me.full_name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return me.email.slice(0, 2).toUpperCase();
}

const BELL = 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0';

function PortalIcon({ hmi, path }: { hmi?: HmiType; path?: string }) {
  const paths: Record<HmiType, string> = {
    aguapozo: 'M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z',
    electrical: 'm13 2-8 12h6l-1 8 9-12h-6l1-8Z',
    nutrial: 'M3 21V9l6 3V8l6 4V4h4l2 17H3Zm4-5v2m4-2v2m4-2v2',
    generic: 'M4 5h16v14H4zM4 10h16M9 10v9',
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d={path ?? (hmi ? paths[hmi] : 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z')}/>
  </svg>;
}

/** Aviso sobre cada HMI cuando el proyecto tiene alarmas abiertas. */
function AlarmStrip({ summary, onOpen }: { summary?: AlarmSummary; onOpen: () => void }) {
  if (!summary) return null;
  return <div className={`alarm-strip alarm-strip--${summary.highest_priority}`} role="status">
    <strong>{summary.open === 1 ? '1 alarma abierta' : `${summary.open} alarmas abiertas`}</strong>
    <span>{summary.unacknowledged} sin reconocer · prioridad más alta: {priorityLabel[summary.highest_priority].toLowerCase()}</span>
    <button className="ds-button ds-button--secondary ds-button--sm" type="button" onClick={onOpen}>Ver alarmas</button>
  </div>;
}

function ProjectHmi({ project, back }: { project: ProjectSummary; back: ReactNode }) {
  switch (project.hmi_type) {
    case 'aguapozo': return <div className="portal-water"><WaterHmi project={project} back={back}/></div>;
    case 'electrical': return <ElectricalOverview project={project}/>;
    case 'nutrial': return <NutrialHmi project={project}/>;
    default: return <GenericHmi project={project}/>;
  }
}

export default function ProjectPortal({ me, projects, logout }: { me: Me; projects: ProjectSummary[]; logout: ReactNode }) {
  const slugs = projects.map(project => project.slug);
  const [operation, setOperation] = useRouteValue('section', 'Resumen', [...operationPages]);
  const [route, setRoute] = useRouteValue('project', '', ['', ...slugs]);
  const [view, setView] = useRouteValue('view', 'portal', ['portal', 'standalone']);
  const project = projects.find(item => item.slug === route);
  const statuses = useProjectsDataStatus(projects, !project);
  const alarmPoll = usePolling(getAlarmSummary, 10_000, `alarm-summary:${me.id}`, projects.length > 0);
  const alarmSummary = alarmPoll.data ?? [];
  const totals = alarmTotals(alarmSummary);
  const navigate = (slug: string | null) => setRoute(slug ?? '');
  const back = <button className="project-back" type="button" onClick={() => navigate(null)}>← Mis proyectos</button>;
  const standalone = view === 'standalone' && !!project;
  const role = roleLabel(me);

  useEffect(() => {
    document.title = project ? `${project.name} · Hail` : 'Hail · Supervisión industrial';
  }, [project]);

  function openAlarms(slug: string) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.delete('project');
    params.delete('view');
    params.set('section', 'Alarmas');
    params.set('alarmProject', slug);
    window.location.hash = params.toString();
  }

  function detachedLink(slug: string) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set('project', slug);
    params.set('view', 'standalone');
    return `${window.location.pathname}${window.location.search}#${params.toString()}`;
  }

  return <div className={`project-portal${standalone ? ' project-standalone' : ''}`}>
    <header className="portal-header">
      <strong>Supervisión industrial IoT</strong>
      <div>
        {standalone && <button onClick={() => setView('portal')}>Mostrar menú de proyectos</button>}
        {me.is_platform_admin && <a href="/admin/" target="_blank" rel="noopener noreferrer">Administración ↗</a>}
        <span>{role}</span>
        {logout}
      </div>
    </header>
    <div className="portal-layout">
      <aside className="portal-sidebar" aria-label="Menú lateral">
        <div className="portal-brand"><HailLogo height={42} tagline="Centro de operaciones" /></div>
        <nav className="portal-menu" aria-label="Navegación de proyectos">
          {operationPages.map(page => <button key={page} type="button" aria-current={!project && operation === page ? 'page' : undefined} onClick={() => { setOperation(page); navigate(null); }}>
            <PortalIcon path={page === 'Alarmas' ? BELL : undefined}/>{page === 'Resumen' ? 'Centro de operaciones' : page}
            {page === 'Alarmas' && totals.unacknowledged > 0 && <span className="alarm-count" aria-label={`${totals.unacknowledged} sin reconocer`}>{totals.unacknowledged}</span>}
          </button>)}
          {projects.length > 0 && <p className="portal-menu-heading">Instalaciones</p>}
          {projects.map(item => <button key={item.slug} type="button" aria-current={project?.slug === item.slug ? 'page' : undefined} onClick={() => navigate(item.slug)}>
            <PortalIcon hmi={item.hmi_type}/>{item.name}
          </button>)}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-avatar" aria-hidden="true">{initials(me)}</span>
          <div>{me.full_name || me.email}<small>{role}</small></div>
        </div>
      </aside>
      <main className="portal-content">
        {project ? <>
          <div className="portal-intro">
            <div><p>{project.category}</p><h1>{project.name}</h1></div>
            <div className="project-view-actions">
              <span className="project-status">{projectStatusLabel[project.status]}</span>
              {!standalone && <a href={detachedLink(project.slug)} target="_blank" rel="noopener noreferrer">Abrir en otra pestaña ↗</a>}
            </div>
          </div>
          <AlarmStrip summary={alarmSummary.find(row => row.project === project.slug)} onOpen={() => openAlarms(project.slug)}/>
          <Suspense fallback={<p role="status">Cargando pantalla…</p>}><ProjectHmi project={project} back={back}/></Suspense>
        </> : <OperationsCenter key={me.id} page={operation as OperationPage} projects={projects} statuses={statuses} alarms={alarmSummary} openProject={navigate} showPage={setOperation}/>}
        {!projects.length && <p className="ops-empty">Tu cuenta todavía no tiene proyectos asignados. Pide acceso al administrador.</p>}
      </main>
    </div>
  </div>;
}

