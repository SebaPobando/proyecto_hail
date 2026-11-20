import { tokens } from '../design-system';
import type { EquipmentStates } from '../services/types';

/** Etiqueta y color de indicador del estado de la bomba (colores ISA-101 del design system). */
export const pumpStatus: Record<EquipmentStates['pump'], { label: string; color: string }> = {
  running: { label: 'En marcha', color: tokens.status.ok },
  stopped: { label: 'Detenida', color: tokens.status.stopped },
  fault: { label: 'Falla', color: tokens.status.critical },
};
