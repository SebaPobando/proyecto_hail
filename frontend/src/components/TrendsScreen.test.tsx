import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TrendsScreen from './TrendsScreen';

describe('TrendsScreen', () => {
  it('muestra las tres tendencias y los períodos aunque no haya lectura actual', () => {
    const html = renderToStaticMarkup(createElement(TrendsScreen, { data: null, historyService: { queryHistory: async () => [] } }));
    for (const label of ['LT-101', 'FT-101', 'AIT-101', 'Sin lectura actual', '7 días', '—']) expect(html).toContain(label);
    expect(html.match(/Cargando historial/g)).toHaveLength(3);
  });
});
