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
    ['TC-01', 'Tecle eléctrico'], ['BB-01', 'Descargador big bag'], ['TZ-01', 'Tamizador 1'], ['TZ-02', 'Tamizador 2'],
    ['ES-01', 'Esclusa 1'], ['ES-02', 'Esclusa 2'], ['ES-03', 'Esclusa superior'], ['DH-01', 'Deshumidificador'],
    ['SP-01', 'Soplador'], ['MZ-01', 'Mezcladora'], ['EN-01', 'Ensacadora'],
  ].map(([id, name]) => ({ id, name, category: 'Proceso', project: 'nutrial', source: 'Referencia de ingeniería Nutrial' })),
];

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchAssets(allowed: readonly string[], project: string, search: string) {
  return assets.filter(asset => allowed.includes(asset.project)
    && (project === 'all' || asset.project === project)
    && normalize(`${asset.id} ${asset.name} ${asset.category}`).includes(normalize(search)));
}
