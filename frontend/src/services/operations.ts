/**
 * Inventario de referencia del centro de operaciones: la lista de equipos de
 * ingeniería de cada instalación (no los dispositivos que envían datos, que
 * vienen de la API). La bitácora vive en el backend (/api/work-items).
 */
export type Asset = { id: string; project: string; name: string; category: string; source: string };

export const assets: Asset[] = [
  ...[
    ['P-101', 'Bomba sumergible', 'Bombeo'],
    ['LT-101', 'Nivel de estanque', 'Instrumentación'],
    ['LT-102', 'Nivel de pozo', 'Instrumentación'],
    ['FT-101', 'Caudalímetro', 'Instrumentación'],
    ['AIT-101', 'Analizador de cloro', 'Instrumentación'],
    ['D-101', 'Dosificación', 'Tratamiento'],
  ].map(([id, name, category]) => ({ id, name, category, project: 'aguapozo', source: 'Ingeniería AguaPozo' })),
  ...['Accuenergy Acuvim II-R', 'Schneider PM5330', 'CHINT PD7777', 'CHINT PD666', 'CHINT PD666'].map((name, i) => ({
    id: `MED-0${i + 1}`, name, category: 'Medición eléctrica', project: 'medidores-electricos', source: 'Catálogo de medidores',
  })),
  ...[
    ['TC-01', 'Tecle eléctrico'], ['BB-01', 'Descargador big bag'], ['TV-01', 'Tolva de descarga manual de sacos'],
    ['TZ-01', 'Tamizador 1 · Italvibras MVSI 3/300'], ['TZ-02', 'Tamizador 2'], ['ES-01', 'Esclusa · Bühler MPSH-LP'],
    ['ES-02', 'Esclusa 2'], ['ES-03', 'Esclusa superior'], ['DH-01', 'Deshumidificador · Trotec TTR 800'],
    ['SP-01', 'Soplador de lóbulos · Repicky'], ['MZ-01', 'Mezcladora · Bühler DFML-1000'], ['ES-04', 'Esclusa inferior'],
    ['EN-01', 'Ensacadora · Bühler MWPF-W'],
  ].map(([id, name]) => ({ id, name, category: 'Proceso', project: 'nutrial', source: 'Diagrama PROYEC 01-2026 Rev. C' })),
];

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchAssets(allowed: readonly string[], project: string, search: string) {
  return assets.filter(asset => allowed.includes(asset.project)
    && (project === 'all' || asset.project === project)
    && normalize(`${asset.id} ${asset.name} ${asset.category}`).includes(normalize(search)));
}
