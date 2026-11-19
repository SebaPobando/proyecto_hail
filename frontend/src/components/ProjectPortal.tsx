import OperationsCenter, { operationPages, type OperationPage } from './OperationsCenter';
import { useEffect, type ReactNode } from 'react';
import './projectPortal.css';
import {useRouteValue} from '../services/navigation';
import type {Telemetry} from '../services/types';
import ElectricalOverview from './ElectricalOverview';
import NutrialHmi from './NutrialHmi';
import './visualIdentity.css';
import { HailLogo } from '../design-system';

const projects = [
  { id: 'aguapozo', title: 'AguaPozo', category: 'Agua potable', image: 'aguapozo.jpg', alt: 'Diagrama HMI del pozo y del estanque elevado', description: 'Captación, tratamiento y almacenamiento. Consulta niveles, caudal y cloro residual.', status: 'HMI disponible' },
  { id: 'medidores-electricos', title: 'Medidores Eléctricos', category: 'Energía', image: 'medidores.svg', alt: 'Ilustración de un panel con medidores eléctricos', description: 'Supervisión de cinco medidores, consumo, potencia y calidad eléctrica por equipo.', status: 'Demostración' },
  { id: 'nutrial', title: 'Nutrial', category: 'Proceso industrial', image: 'nutrial.svg', alt: 'Esquema de tolva, transporte, mezcladora y ensacado', description: 'Línea de sustitutos lácteos en polvo. Tamizado, transporte neumático, mezclado y ensacado.', status: 'En desarrollo' },
] as const;
export type ProjectId = typeof projects[number]['id'];
export const projectIds = projects.map(project => project.id);

function PortalIcon({ project }: { project?: ProjectId }) {
  const paths = {
    aguapozo: 'M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z',
    'medidores-electricos': 'm13 2-8 12h6l-1 8 9-12h-6l1-8Z',
    nutrial: 'M3 21V9l6 3V8l6 4V4h4l2 17H3Zm4-5v2m4-2v2m4-2v2',
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d={project ? paths[project] : 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'}/>
  </svg>;
}

export default function ProjectPortal({ allowed, role, logout, renderWater, onProjectChange, initialProject = null, userId = 'preview', waterData, waterStatus = 'Sin datos', accessWarning = '' }: {
  userId?: string; allowed: ProjectId[]; role: string; logout: ReactNode; renderWater: (back: ReactNode) => ReactNode;
  waterData?: Telemetry | null; waterStatus?: string; accessWarning?: string;
  initialProject?: ProjectId | null;
  onProjectChange?: (project: ProjectId | null) => void;
}) {
  const [operation,setOperation]=useRouteValue('section','Resumen',[...operationPages]);
  const [route,setRoute]=useRouteValue('project',initialProject??'', ['',...projectIds]);
  const [view,setView]=useRouteValue('view','portal',['portal','standalone']);
  const selected=projectIds.includes(route as ProjectId)?route as ProjectId:null;
  const setSelected=(id:ProjectId|null)=>setRoute(id??'');
  useEffect(()=>{onProjectChange?.(selected&&allowed.includes(selected)?selected:null);},[selected,allowed.join('|')]);
  function navigate(id: ProjectId | null) { setSelected(id); onProjectChange?.(id); }
  const visibleProjects = projects.filter(item => allowed.includes(item.id));
  const project = visibleProjects.find(item => item.id === selected);
  const back = <button className="project-back" type="button" onClick={() => navigate(null)}>← Mis proyectos</button>;


  const standalone=view==='standalone'&&!!project;
  function detachedLink(id:ProjectId){const params=new URLSearchParams(typeof window==='undefined'?'':window.location.hash.slice(1));params.set('project',id);params.set('view','standalone');return `${typeof window==='undefined'?'':window.location.pathname+window.location.search}#${params.toString()}`;}
  return <div className={`project-portal${standalone?' project-standalone':''}`}>
    <header className="portal-header"><strong>Supervisión industrial IoT</strong><div>{standalone&&<button onClick={()=>setView('portal')}>Mostrar menú de proyectos</button>}<span>{role}</span>{logout}</div></header>
    <div className="portal-layout">
      <aside className="portal-sidebar" aria-label="Menú lateral">
        <div className="portal-brand"><HailLogo height={42} tagline="Centro de operaciones" /></div><nav className="portal-menu" aria-label="Navegación de proyectos">
          {operationPages.map(page=><button key={page} type="button" aria-current={!project&&operation===page?'page':undefined} onClick={()=>{setOperation(page);navigate(null);}}><PortalIcon/>{page==='Resumen'?'Centro de operaciones':page}</button>)}
          {visibleProjects.length > 0 && <p className="portal-menu-heading">Instalaciones</p>}
          {visibleProjects.map(item => <button key={item.id} type="button" aria-current={project?.id === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
            <PortalIcon project={item.id}/>{item.title}
          </button>)}
        </nav><div className="sidebar-footer"><span className="sidebar-avatar">SP</span><div>{role}<small>Acceso a proyectos asignados</small></div></div>
      </aside>
    <main className="portal-content">
      {accessWarning && <p className="portal-notice" role="alert">{accessWarning}</p>}
      {selected&&!project&&<p role="alert">Este proyecto no está asignado a tu cuenta.</p>}
      {project ? <>
        <div className="portal-intro"><div><p>{project.category}</p><h1>{project.title}</h1></div><div className="project-view-actions"><span className="project-status">{project.status}</span>{!standalone&&<a href={detachedLink(project.id)} target="_blank" rel="noopener noreferrer">Abrir en otra pestaña ↗</a>}</div></div>
        {project.id === 'aguapozo' ? <div className="portal-water">{renderWater(back)}</div> : project.id === 'medidores-electricos' ? <ElectricalOverview/> :
          <NutrialHmi/>}
      </> : <OperationsCenter key={userId} page={operation as OperationPage} allowed={allowed} userId={userId} waterData={waterData} waterStatus={waterStatus} openProject={navigate} showPage={setOperation}/>}
    </main>
    </div>
  </div>;
}
