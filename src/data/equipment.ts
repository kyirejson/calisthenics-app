import type { Exercise } from '../types';
import type { EquipmentGuide } from './equipmentGuidance';
import type { EquipmentRecommendation } from './equipmentRecommendations';
import { equipmentMovements } from './equipmentMovements';
import type { EquipmentGroup } from './equipmentTaxonomy';
export type { EquipmentGroup } from './equipmentTaxonomy';
export { equipmentGroups } from './equipmentTaxonomy';
export type EquipmentMovement = Exercise & { group: EquipmentGroup; targetMuscles: string; guide: EquipmentGuide; recommendation: EquipmentRecommendation };
export function getEquipmentMovement(id: string) { return equipmentMovements.find(movement => movement.id === id); }
export { equipmentMovements };
