import type { ReactNode } from 'react';
import ProjectPortal, { projectIds } from './ProjectPortal';

export default function PortalPreview({ renderWater }: { renderWater: (back: ReactNode) => ReactNode }) {
  return <ProjectPortal initialProject={new URLSearchParams(window.location.search).get('project') === 'electrical' ? 'medidores-electricos' : null} allowed={projectIds} role="Vista de prueba" logout={<a href="/">Ir al inicio de sesión</a>} renderWater={renderWater}/>;
}
