/**
 * Espejo en TypeScript de tokens.css, para gráficos (Recharts) y SVG donde no
 * conviene usar variables CSS. scripts/verify-design-tokens.mjs comprueba que
 * ambos archivos coincidan.
 */
export const color = {
  blue50: '#ebf3fc',
  blue100: '#d6e6f8',
  blue200: '#a9cbf0',
  blue300: '#73a9e5',
  blue400: '#3684d6',
  blue500: '#005cbd',
  blue600: '#004fa3',
  blue700: '#003f85',
  royal: '#0031a1',
  navy: '#000e8b',
  deep: '#0b337a',
  ink: '#0b1f3a',
  orange400: '#f78c1e',
  orange500: '#f86419',
  orange600: '#fa3d15',
  gray200: '#d7e3f1',
  gray300: '#b9cbdc',
  gray400: '#8ba0b6',
  gray500: '#56708b',
  gray700: '#34506e',
} as const;

/** Colores de estado: los mismos indicadores en HMI, tablas y gráficos. */
export const status = {
  ok: '#78bd39',
  stopped: '#9aadb9',
  warning: '#ffb819',
  critical: '#ed353b',
  simulated: '#5b3fb0',
} as const;

/** Series de gráficos: distinguibles entre sí y sin el naranja de marca. */
export const chartSeries = ['#005cbd', '#13a3b2', '#7a4fd1', '#5f7487'] as const;

/** Fases eléctricas A, B, C y neutro (convención de colores fija en todo el sistema). */
export const phaseColors = { A: '#005cbd', B: '#c97a00', C: '#2e8540', N: '#5f7487' } as const;
