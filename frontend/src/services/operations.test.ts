import { describe, expect, it } from 'vitest';
import { searchAssets } from './operations';

describe('inventario de referencia', () => {
  it('filtra por permisos, instalación y texto sin acentos', () => {
    expect(searchAssets(['aguapozo'], 'all', '')).toHaveLength(6);
    expect(searchAssets(['aguapozo'], 'nutrial', '')).toHaveLength(0);
    expect(searchAssets(['aguapozo'], 'all', 'dosificacion')).toHaveLength(1);
  });
});
