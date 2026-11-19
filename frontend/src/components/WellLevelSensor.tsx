/** Sonda hidrostática. La lectura representa distancia desde la boca al espejo de agua. */
export default function WellLevelSensor({ depthM, waterY, available = true }: { depthM?: number; waterY: number; available?: boolean }) {
  return <g data-equipment="well-level-sensor">
    <title>{`LT-102 · Sonda hidrostática sumergida · Espejo de agua a ${(depthM?.toFixed(1) ?? '—')} metros desde la boca del pozo`}</title>
    <rect x="12" y="179" width="217" height="72" rx="5" fill="#0c2637" stroke="#d5e3eb" strokeWidth="1.6"/>
    <text x="26" y="203" fontSize="21" fontWeight="600">LT-102 · Nivel pozo</text>
    <text x="26" y="234" fontSize="27" fontWeight="600">{(depthM?.toFixed(1) ?? '—')} m</text>
    <path d="M106 251V333" fill="none" stroke="#c4d5de" strokeWidth="1.5" strokeDasharray="4 4"/>
    {available && <path d={`M63 349H83M63 ${waterY}H89M69 349V${waterY}M65 355L69 349L73 355M65 ${waterY-6}L69 ${waterY}L73 ${waterY-6}`} fill="none" stroke="#d6e6ee" strokeWidth="1.5"/>}
    <rect x="96" y="333" width="20" height="12" rx="2" fill="#8da2b1" stroke="#d2e0e8" strokeWidth="1.5"/>
    <path d="M106 345V466" stroke="#102c3f" strokeWidth="5"/>
    <path d="M106 345V466" stroke="#c4d5de" strokeWidth="2"/>
    <rect x="100" y="466" width="12" height="37" rx="3" fill="#bdcbd5" stroke="#17384c" strokeWidth="2"/>
    <path d="M102 474H110M102 479H110M102 484H110" stroke="#537084" strokeWidth="1.5"/>
    <path d="M102 499H110" stroke="#31566c" strokeWidth="3"/>
  </g>;
}
