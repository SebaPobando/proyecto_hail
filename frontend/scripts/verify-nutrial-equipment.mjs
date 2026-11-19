import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {default:Equipment,filterSignals}=await server.ssrLoadModule('/src/components/NutrialEquipment.tsx');
 assert.equal(filterSignals('all','all','').length,58);
 assert.equal(filterSignals('all','AI','').length,3);
 assert.equal(filterSignals('BB-01','AI','peso')[0].address,'IW96');
 assert.equal(filterSignals('all','all','inexistente').length,0);
 assert(filterSignals('all','all','presion').some(s=>s.tag==='AI_PT01_Presion'));
 const html=renderToStaticMarkup(createElement(Equipment));
 assert(html.includes('Exportar selección CSV'));
 const {default:Hmi}=await server.ssrLoadModule('/src/components/NutrialHmi.tsx');
 const process=renderToStaticMarkup(createElement(Hmi));
 assert(process.includes('nutrial-bottom-panels'));assert(!process.includes('Tag / dirección'));
 console.log('OK: 58 señales, filtros combinados y búsqueda sin acentos; tabla separada del Proceso.');
}finally{await server.close()}
