import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {default:Center,operationPages}=await server.ssrLoadModule('/src/components/OperationsCenter.tsx');
 const {searchAssets,validWorkItem,readWorkItems}=await server.ssrLoadModule('/src/services/operations.ts');
 assert.equal(searchAssets(['aguapozo'],'all','').length,6);
 assert.equal(searchAssets(['aguapozo'],'nutrial','').length,0);
 assert.equal(searchAssets(['aguapozo'],'all','dosificacion').length,1);
 assert(!validWorkItem({id:'invalid'}));
 const entry={id:'1',project:'aguapozo',asset:'P-101',title:'Revisión',priority:'Alta',status:'Pendiente',owner:'Técnico',due:'',created:'2026-11-17',events:[]};
 assert(validWorkItem(entry));
 global.localStorage={getItem:key=>key==='operations-work-v1:a'?JSON.stringify([entry,{bad:true}]):'[]'};
 assert.equal(readWorkItems('operations-work-v1:a').length,1);assert.equal(readWorkItems('operations-work-v1:b').length,0);
 for(const page of operationPages){
 const html=renderToStaticMarkup(createElement(Center,{page,allowed:['aguapozo'],userId:'b',waterStatus:'Datos antiguos',waterData:null,openProject:()=>{},showPage:()=>{}}));
 assert(html.includes('Centro de operaciones')||html.includes(page));
 assert(!html.includes('MED-01'));assert(!html.includes('MZ-01'));
 }
 const html=renderToStaticMarkup(createElement(Center,{page:'Seguimiento',allowed:['nutrial'],userId:'a',waterStatus:'Sin datos',openProject:()=>{},showPage:()=>{}}));
 assert(!html.includes('Revisión'));assert(!html.includes('P-101'));
 console.log('OK: cinco vistas, filtro de permisos, inventario, registros por cuenta y validación de almacenamiento.');
}finally{await server.close();}
