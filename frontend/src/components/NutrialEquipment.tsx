import { useState } from 'react';
import type { Signal } from '../services/hail';
import { downloadCsv } from '../services/exportCsv';
/** Equipos según el diagrama de proceso PROYEC 01-2026, Rev. C (01-11-2026): tag, nombre y datos de placa conocidos. */
export const equipment = [
  ['TC-01','Tecle eléctrico','Capacidad por definir'],
  ['BB-01','Descargador big bag','Rosca dosificadora con VDF · pesaje por diferencia · lote 500 kg'],
  ['TV-01','Tolva de sacos','Descarga manual de sacos, con rejilla · sin E/S'],
  ['TZ-01','Tamizador 1','Línea big bag · motovibrador Italvibras MVSI 3/300, 260 W'],
  ['TZ-02','Tamizador 2','Ingreso manual · 1 motovibrador (por confirmar)'],
  ['ES-01','Esclusa 1','Paso horizontal · Bühler MPSH-LP'],
  ['ES-02','Esclusa 2','Paso horizontal · modelo por confirmar'],
  ['ES-03','Esclusa superior','Entrada mezcladora'],
  ['DH-01','Deshumidificador','Trotec TTR 800 (adsorción) · 750 m³/h de aire seco'],
  ['SP-01','Soplador','Lóbulos Repicky · potencia por definir'],
  ['MZ-01','Mezcladora','Horizontal Bühler DFML-1000 · 18,5 kW · mezclado 60 s'],
  ['ES-04','Esclusa inferior','Descarga mezcladora · sin E/S en la lista Rev. A'],
  ['EN-01','Ensacadora','Bühler MWPF-W con control MEAG-P · 6 kW instalados'],
] as const;
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Señales de un equipo (por su tag en la descripción o en el nombre de la señal), tipo y texto libre. */
export function filterSignals(signals:readonly Signal[],equipmentId:string,type:string,search:string){return signals.filter(s=>(equipmentId==='all'||s.description.includes(equipmentId)||s.tag.includes(equipmentId.replace('-','')))&&(type==='all'||s.kind===type)&&normalize([s.tag,s.description,s.address,s.field_device,s.module].join(' ')).includes(normalize(search.trim())));}
export default function NutrialEquipment({signals,initialEquipment='all'}:{signals:readonly Signal[];initialEquipment?:string}){
 const [selected,setSelected]=useState(initialEquipment);const [type,setType]=useState('all');const [search,setSearch]=useState('');
 const rows=filterSignals(signals,selected,type,search);
 const group=filterSignals(signals,selected,'all','');
 return <section className="nutrial-equipment">
 <div className="nutrial-equipment-filters"><label>Equipo<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">Todos · incluye señales generales</option>{equipment.map(([id,name])=><option key={id} value={id}>{id} · {name}</option>)}</select></label><label>Tipo de señal<select value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option>{['DI','DO','AI','AO'].map(t=><option key={t}>{t}</option>)}</select></label><label>Buscar<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tag, descripción, dirección o módulo"/></label><button onClick={()=>{setSelected('all');setType('all');setSearch('')}}>Limpiar filtros</button></div>
 <section className="nutrial-panel"><h3>{selected==='all'?'Inventario de señales':`${selected} · ${equipment.find(e=>e[0]===selected)?.[1]}`}</h3><div className="nutrial-equipment-profile"><p>{selected==='all'?'Lista de E/S · Rev. A · CPU Siemens S7-1200':equipment.find(e=>e[0]===selected)?.[2]}</p><div>{['DI','DO','AI','AO'].map(t=><span key={t}>{t}: <b>{group.filter(s=>s.kind===t).length}</b></span>)}</div><p>Referencia de ingeniería. Las direcciones y salidas se consultan sin enviar comandos. Lista cargada desde Hail; los valores de campo llegan cuando se conecte el PLC.</p></div></section>
 <div className="nutrial-equipment-results"><span role="status">{rows.length} señales encontradas</span><button disabled={!rows.length} onClick={()=>downloadCsv(`nutrial-senales-${selected}.csv`,[['Fuente','Lista E/S Nutrial Rev. A; referencia de ingeniería'],['Tag','Tipo','Dirección','Descripción','Módulo','Elemento','Lógica'],...rows.map(s=>[s.tag,s.kind,s.address,s.description,s.module,s.field_device,s.logic])])}>Exportar selección CSV</button></div>
 <div className="nutrial-panel nutrial-table-scroll" tabIndex={0} role="region" aria-label="Señales de Nutrial"><table><thead><tr><th>Tag / dirección</th><th>Tipo</th><th>Descripción</th><th>Módulo / elemento</th><th>Lógica</th></tr></thead><tbody>{rows.map(s=><tr key={s.tag}><td><strong>{s.tag}</strong><small>{s.address}</small></td><td>{s.kind}</td><td>{s.description}</td><td>{s.module}<small>{s.field_device}</small></td><td>{s.logic||'—'}</td></tr>)}{rows.length===0&&<tr><td colSpan={5}>No hay señales que coincidan con los filtros.</td></tr>}</tbody></table></div>
 </section>;
}
