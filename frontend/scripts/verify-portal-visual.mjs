import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
 const { default: Portal, projectIds } = await server.ssrLoadModule('/src/components/ProjectPortal.tsx');
 const render = allowed => renderToStaticMarkup(createElement(Portal,{allowed,role:'Administrador',logout:null,renderWater:()=>null}));
 const admin = render(projectIds);
 const client = render(['aguapozo']);
 if (!admin.includes('Centro de operaciones') || !admin.includes('Nutrial') || !admin.includes('Medidores Eléctricos')) throw Error('Missing projects');
 if (client.includes('Nutrial') || client.includes('Medidores Eléctricos')) throw Error('Unauthorized project card');
 console.log('OK: portal renders three cards; restricted client sees only AguaPozo.');
} finally { await server.close(); }
