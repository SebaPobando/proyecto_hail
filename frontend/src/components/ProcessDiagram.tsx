import type { Telemetry } from '../services/types';
import { pumpStatus } from './equipmentStatus';
import SubmersiblePump from './SubmersiblePump';
import WellLevelSensor from './WellLevelSensor';
import TankLevelSensor from './TankLevelSensor';
function Label({ x, y, width, lines }: { x: number; y: number; width: number; lines: string[] }) {
  return <g><rect x={x} y={y} width={width} height={lines.length * 24 + 12} rx="5" fill="#0c2637" stroke="#d5e3eb" strokeWidth="1.6"/>{lines.map((line, i) => <text key={line} x={x + width / 2} y={y + 26 + i * 24} textAnchor="middle" fontSize={i === 0 && lines.length === 1 ? 22 : 20} fontWeight={i === 0 && lines.length === 1 ? 600 : 400}>{line}</text>)}</g>;
}
export default function ProcessDiagram({ data }: { data?: Telemetry | null }) {
  const tankLevel = Math.max(0, Math.min(100, (data?.level.value ?? 0)));
  const wellDepth = Math.max(0, Math.min(50, (data?.wellWaterDepthM.value ?? 0)));
  const waterY = 337 - (337 - 156) * tankLevel / 100;
  // La profundidad aumenta hacia abajo, desde la boca hasta el espejo de agua.
  const wellWaterY = 349 + (549 - 349) * wellDepth / 50;
  const pump = data ? pumpStatus[data.states.pump] : { label: 'Desconocido' };
  return <svg className="process-svg" viewBox="0 0 1170 610" role="img" aria-label={!data ? 'Proceso de agua potable. Sin datos actuales; niveles y estados desconocidos' : `Proceso de captación desde pozo de 50 metros, bomba P-101 ${pump.label.toLowerCase()}, tratamiento de cloro y estanque al ${(data?.level.value ?? 0).toFixed(1)} por ciento`}>
    <defs><clipPath id="tank-interior"><rect x="905" y="156" width="205" height="181"/></clipPath><pattern id="soil" width="31" height="29" patternUnits="userSpaceOnUse"><rect width="31" height="29" fill="#655c59"/><circle cx="7" cy="9" r="2.5" fill="#4e4948"/><circle cx="23" cy="23" r="2" fill="#514b49"/></pattern></defs>
    <path d="M0 535H1170V610H0Z" fill="#50565b"/><path d="M0 535H1170" stroke="#959ea3" strokeWidth="7"/>
    <path d="M0 345H82V353H181V345H251V566Q251 574 235 574H0Z" fill="url(#soil)" stroke="#958a80"/>
    <path d="M0 345H80M183 345H251" stroke="#759841" strokeWidth="6"/>
    <path d="M87 349V548H177V349" fill="#89776b" stroke="#c1afa0" strokeWidth="5"/>
    {data && wellDepth < 50 && <path d={`M90 ${wellWaterY}H175V549H90Z`} fill="#079cdd"/>}
    {data && wellWaterY + 3 < 549 && <path d={`M95 ${wellWaterY+3}V549`} stroke="#36b5ea" strokeWidth="5"/>}
    <path d="M134 443V311Q134 288 158 288H852Q875 288 875 267V152Q875 134 891 134H927" fill="none" stroke="#bee1ed" strokeWidth="13" strokeLinejoin="round"/>
    <path d="M134 443V311Q134 288 158 288H852Q875 288 875 267V152Q875 134 891 134H927" fill="none" stroke="#23abed" strokeWidth="8" strokeLinejoin="round"/>
    {data?.states.pump === 'running' && data.flow.value > 0 && [250, 480, 650, 830].map(x => <path key={x} className="flow-chevron" d={`M${x} 279l8 9-8 9`} fill="none" stroke="#ecfaff" strokeWidth="3"/>)}
    <WellLevelSensor depthM={data?.wellWaterDepthM.value} waterY={wellWaterY} available={!!data}/>
    <SubmersiblePump state={data?.states.pump}/>
    <Label x={48} y={530} width={170} lines={['Pozo Profundo', '(50 m)']}/>
    <g transform="translate(365 280)"><path d="M-39-6V23M39-6V23" stroke="#aab8c1" strokeWidth="8"/><circle r="28" fill="#aebdc6" stroke="#d9e3e9" strokeWidth="3"/><circle r="23" fill="#8b9da9" stroke="#577184"/><rect x="-15" y="-13" width="30" height="19" fill="#087ab2" stroke="#263e4c" strokeWidth="2"/><circle cy="16" r="3" fill="#08a9ed" stroke="#163b50"/><path d="M0-29V-48M-10 36H10" stroke="#d9e3e9" strokeWidth="4"/>{[-18,18].map(x=><circle key={x} cx={x} cy="10" r="2" fill="#405a69"/>)}</g>
    <Label x={312} y={196} width={106} lines={['FT-101']}/><text x="365" y="353" textAnchor="middle" fontSize="22">Caudalímetro</text>
    <g><rect x="476" y="82" width="70" height="90" rx="7" fill="#c2cfd6" stroke="#e3edf2" strokeWidth="3"/><path d="M479 124Q493 119 507 124T543 124V168H479Z" fill="#149fe5"/><path d="M485 87V167" stroke="#fff" strokeOpacity=".3" strokeWidth="5"/><path d="M503 80V65H520V80M506 173V182H517V173" stroke="#c3cfd7" strokeWidth="4"/><path d="M512 182V226Q512 240 525 240H549M570 248V286" fill="none" stroke="#ffc733" strokeWidth="7"/><path d="M512 182V226Q512 240 525 240H549" fill="none" stroke="#fff0b3" strokeWidth="2"/><rect x="550" y="206" width="44" height="42" rx="3" fill="#f5b719" stroke="#ffda66" strokeWidth="2"/><path d="M560 212V240M577 215H588M577 222H588M577 229H588M577 236H588" stroke="#6c5317" strokeWidth="2"/><rect x="560" y="199" width="16" height="5" fill="#f6bd28"/><rect x="562" y="280" width="17" height="17" fill="#a9bac4" stroke="#d5dfe5"/></g>
    <Label x={565} y={76} width={107} lines={['D-101', 'Clorador', '(NaOCl)']}/>
    <g transform="translate(750 287)"><rect x="-40" y="-34" width="80" height="69" rx="4" fill="#9cabb6" stroke="#d5e0e7" strokeWidth="2"/><rect x="-26" y="-24" width="52" height="33" fill="#08659a" stroke="#dbe8ef" strokeWidth="2"/><text y="1" textAnchor="middle" fontSize="23">Cl₂</text><path d="M0-34V-52" stroke="#d6e2e8" strokeWidth="2"/>{[-21,0,21].map((x,i)=><circle key={x} cx={x} cy="23" r="3.6" fill={i===0?'#b3c4cd':i===1?'#73a769':'#65bed8'} stroke="#355166"/>)}</g>
    <Label x={691} y={198} width={119} lines={['AIT-101']}/><text x="750" y="356" textAnchor="middle" fontSize="22"><tspan x="750">Analizador</tspan><tspan x="750" dy="26">de Cloro</tspan></text>
    <g stroke="#bdc9d1" strokeWidth="11" fill="none"><path d="M914 331L895 536M1097 332L1115 536"/><path d="M912 349L1103 464M1100 349L904 464M906 461H1105" strokeWidth="8"/></g>
    <g fill="#aebcc6" stroke="#d0dae0" strokeWidth="2"><path d="M883 506H928L931 546H878Z"/><path d="M1084 506H1126L1135 546H1080Z"/></g>
    <g fill="none" stroke="#e9b62d" strokeWidth="3" aria-label="Escalera vertical"><path d="M1116 132V484M1137 132V484"/>{Array.from({length:15},(_,i)=><path key={i} d={`M1116 ${139+i*23}H1137`}/>)}</g>
    <path d="M903 146Q1008 89 1112 146Z" fill="#b5c2cb" stroke="#dae3e8" strokeWidth="2"/><rect x="903" y="145" width="209" height="191" fill="#afbec9" stroke="#657e8f" strokeWidth="3"/>
    <g clipPath="url(#tank-interior)">{tankLevel > 0 && <path d={`M904 ${waterY}H1113V337H904Z`} fill="#129fe7"/>}<rect x="923" y="155" width="15" height="185" fill="#fff" opacity=".12"/></g>
    <path d="M903 146H1112M903 336H1112" stroke="#354d5f" strokeWidth="4"/><rect x="895" y="294" width="221" height="18" fill="#99abb8" stroke="#c9d7e0"/>
    {!data && <text x="1007" y="235" textAnchor="middle" fontSize="20" fill="#193b4e">Nivel desconocido</text>}
    <TankLevelSensor waterY={waterY} available={!!data}/>
    <Label x={970} y={23} width={97} lines={['LT-101']}/><Label x={916} y={548} width={179} lines={['Estanque Elevado', '50 m³']}/>
  </svg>;
}

