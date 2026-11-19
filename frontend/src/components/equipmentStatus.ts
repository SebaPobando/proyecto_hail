import type { EquipmentStates } from '../services/types';
export const pumpStatus: Record<EquipmentStates['pump'], { label: string; color: string }> = {
  running: { label: 'En marcha', color: '#78bd39' },
  stopped: { label: 'Detenida', color: '#9aadb9' },
  fault: { label: 'Falla', color: '#ef5350' },
};
