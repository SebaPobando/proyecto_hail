import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProcessVariables, { normalizeVariableSelection as normalize } from './ProcessVariables';

afterEach(() => vi.unstubAllGlobals());

describe('ProcessVariables', () => {
  it('normaliza la selección guardada', () => {
    expect(normalize(['a', 'wrong', 'a'], ['a', 'b'], ['b'])).toEqual(['a']);
    expect(normalize([], ['a', 'b'], ['b'])).toEqual(['b']);
    expect(normalize(null, ['a', 'b'], ['b'])).toEqual(['b']);
  });

  it('respeta la selección guardada y mantiene al menos una variable visible', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(['b']), setItem: () => undefined });
    const html = renderToStaticMarkup(createElement(ProcessVariables, { project: 'test', defaults: ['a'], variables: [
      { id: 'a', tag: 'A', label: 'Primera', value: '123', unit: 'm' },
      { id: 'b', tag: 'B', label: 'Segunda', value: '456', unit: '%' },
    ] }));
    expect(html).not.toContain('123');
    expect(html).toContain('456');
    expect(html).toContain('disabled=""');
  });
});
