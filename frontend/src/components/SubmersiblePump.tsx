import type { EquipmentStates } from '../services/types';
import { pumpStatus } from './equipmentStatus';

/** Equipo físico e indicador de marcha; solo lectura de telemetría. */
export default function SubmersiblePump({ state }: { state?: EquipmentStates['pump'] }) {
  const status = state ? pumpStatus[state] : { label: 'Desconocido', color: '#9aadb9' };
  return <g data-pump-state={state ?? 'unknown'}>
    <title>{`P-101 · Bomba sumergible · ${status.label}`}</title>
    <g stroke="#d2e0e8" strokeWidth="1.8">
      <path d="M142 450V355H153" fill="none" stroke="#233e50" strokeWidth="3"/>
      <rect x="120" y="451" width="29" height="68" rx="4" fill="#8da2b1"/>
      <rect x="125" y="438" width="19" height="13" fill="#65818f"/>
      <path d="M124 463H145M124 468H145M124 473H145" stroke="#344f61"/>
      <path d="M126 482V509M143 482V509" stroke="#cbdbe5"/>
      <rect x="126" y="519" width="17" height="6" fill="#65818f"/>
      <circle cx="134.5" cy="493" r="6" fill={status.color} stroke="#183344"/>
    </g>
    <path d="M150 495L215 472" fill="none" stroke="#d5e3eb" strokeWidth="1.5"/>
    <rect x="215" y="430" width="180" height="88" rx="5" fill="#0c2637" stroke="#d5e3eb" strokeWidth="1.6"/>
    <text x="229" y="453" fontSize="21" fontWeight="600">P-101</text>
    <text x="229" y="475" fontSize="17">Bomba sumergible</text>
    <rect x="229" y="489" width="12" height="12" rx="2" fill={status.color}/>
    <text x="250" y="501" fontSize="18">{status.label}</text>
  </g>;
}
