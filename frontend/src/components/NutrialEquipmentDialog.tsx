import {useEffect,useRef} from 'react';
import {equipment,filterSignals} from './NutrialEquipment';
export default function NutrialEquipmentDialog({tag,onClose,onSignals}:{tag:string;onClose:()=>void;onSignals:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const signals=filterSignals(tag,'all','');
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className="nutrial-equipment-dialog" aria-labelledby="equipment-dialog-title" onCancel={onClose} onClose={onClose}><header><div><small>FICHA DE EQUIPO · NUTRIAL</small><h2 id="equipment-dialog-title">{tag} · {equipment.find(e=>e[0]===tag)?.[1]}</h2></div><button onClick={onClose} aria-label="Cerrar ficha">✕</button></header><p>Referencia de ingeniería · lista de E/S Rev. A. Los valores de operación son simulados.</p><dl><div><dt>Señales asociadas</dt><dd>{signals.length}</dd></div><div><dt>Controlador de referencia</dt><dd>Siemens S7-1200</dd></div><div><dt>Modelo y potencia</dt><dd>Pendientes de validación documental</dd></div></dl><h3>Señales del equipo</h3><div className="nutrial-dialog-signals">{signals.length?<table><thead><tr><th>Tag / dirección</th><th>Descripción</th></tr></thead><tbody>{signals.map(s=><tr key={s.tag}><td><b>{s.tag}</b><small>{s.type} · {s.address}</small></td><td>{s.description}</td></tr>)}</tbody></table>:<p>Sin señales asociadas en la lista de E/S disponible.</p>}</div><footer><button onClick={onSignals}>Abrir Equipos y señales</button><button onClick={onClose}>Cerrar</button></footer></dialog>;
}
