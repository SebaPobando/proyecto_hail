import './hmiLayout.css';
export default function HmiNavigation({items,value,onChange}:{items:{id:string;label:string}[];value:string;onChange:(id:string)=>void}) {
 return <div className="hmi-navigation" role="group" aria-label="Pantallas de supervisión">{items.map(item=><button key={item.id} type="button" aria-pressed={value===item.id} onClick={()=>onChange(item.id)}>{item.label}</button>)}</div>;
}
