import {useState} from 'react';
import './processVariables.css';
export type ProcessVariable={id:string;tag:string;label:string;value:string;unit:string;note?:string};
export function normalizeVariableSelection(saved:unknown,ids:string[],defaults:string[]):string[]{
 if(!Array.isArray(saved))return defaults;
 const selected=ids.filter(id=>saved.includes(id));return selected.length?selected:defaults;
}
export default function ProcessVariables({project,variables,defaults}:{project:string;variables:ProcessVariable[];defaults:string[]}){
 const key=`process-variables-v1:${project}`;
 const [selected,setSelected]=useState<string[]>(()=>{try{return normalizeVariableSelection(JSON.parse(localStorage.getItem(key)||'null'),variables.map(v=>v.id),defaults);}catch{return defaults;}});
 const [warning,setWarning]=useState('');
 const save=(ids:string[])=>{setSelected(ids);try{localStorage.setItem(key,JSON.stringify(ids));setWarning('');}catch{setWarning('La selección se aplicó, pero no se pudo guardar en este navegador.');}};
 return <div className="process-variable-picker"><details><summary>Personalizar variables <span>{selected.length} de {variables.length}</span></summary><div className="process-variable-options"><p>Escoge las lecturas de este panel. No modifica las señales, alarmas ni la adquisición de datos.</p>{variables.map(v=><label key={v.id}><input type="checkbox" checked={selected.includes(v.id)} disabled={selected.length===1&&selected.includes(v.id)} onChange={e=>save(e.target.checked?[...selected,v.id]:selected.filter(id=>id!==v.id))}/><span><b>{v.tag}</b> · {v.label}{v.note&&<small>{v.note}</small>}</span></label>)}<div><button onClick={()=>save(variables.map(v=>v.id))}>Mostrar todas</button><button onClick={()=>save(defaults)}>Restablecer</button></div><small>Selección guardada en este navegador. Mantén al menos una variable visible.</small></div></details>{warning&&<p role="status">{warning}</p>}<dl className="selected-process-variables">{variables.filter(v=>selected.includes(v.id)).map(v=><div key={v.id}><dt><b>{v.tag}</b><span>{v.label}</span></dt><dd>{v.value}<small>{v.unit}</small></dd>{v.note&&<p>{v.note}</p>}</div>)}</dl></div>;
}
