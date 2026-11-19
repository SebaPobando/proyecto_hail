import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {default:Hmi}=await server.ssrLoadModule('/src/components/NutrialHmi.tsx');
 const {nutrialSimulation:sim}=await server.ssrLoadModule('/src/services/nutrialSimulation.ts');
 const html=renderToStaticMarkup(createElement(Hmi));
 for(const tag of ['BB-01','ES-03','MZ-01','EN-01','Tendencias','Alarmas']) if(!html.includes(tag)) throw Error('Missing '+tag);
 for(const h of [1,8,24,168]) {const end=Date.now();const samples=sim.history(h,end);if(samples[0].timestamp!==end-h*3600000||samples.at(-1).timestamp!==end)throw Error('Bad history period'); if(samples.some(s=>s.weight<0||s.weight>2000||s.pressure<0||s.pressure>1000))throw Error('Range');}
 console.log('OK: Nutrial SVG and navigation render; history periods and sensor ranges verified.');
}finally{await server.close()}
