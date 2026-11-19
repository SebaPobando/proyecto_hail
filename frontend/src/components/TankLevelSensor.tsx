/** Medición sin contacto desde el techo del estanque hasta el espejo de agua. */
export default function TankLevelSensor({ waterY, available = true }: { waterY: number; available?: boolean }) {
  return <g data-equipment="tank-level-sensor">
    <title>LT-101 · Sensor de nivel sin contacto, ultrasónico o radar, sobre el agua</title>
    <text x="1019" y="12" textAnchor="middle" fontSize="16">Nivel sin contacto</text>
    <path d="M1019 77V57" stroke="#dbe6eb" strokeWidth="2"/>
    <rect x="1009" y="77" width="20" height="28" rx="3" fill="#9aadb9" stroke="#d5e0e7" strokeWidth="2"/>
    <rect x="1014" y="105" width="10" height="43" fill="#9aadb9" stroke="#d5e0e7" strokeWidth="1.5"/>
    <path d="M1013 147L1006 161H1032L1025 147Z" fill="#b7c8d2" stroke="#d5e0e7" strokeWidth="1.5"/>
    {available && <><path d={`M1019 166V${waterY-2}M1012 166L993 ${waterY-2}M1026 166L1045 ${waterY-2}`} fill="none" stroke="#334f62" strokeWidth="1.8" strokeDasharray="5 5"/>
    <path d={`M1001 ${waterY-2}H1037`} stroke="#d9edf6" strokeWidth="2"/></>}
  </g>;
}
