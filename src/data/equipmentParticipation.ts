// Training participation is independent of browsing emphasis tags.
export const trainingRegionMuscle = {
  chest_upper: 'chest', chest_middle: 'chest', chest_lower: 'chest', shoulders_front: 'frontDelts', shoulders_side: 'sideDelts', shoulders_rear: 'rearDelts',
  shoulders_rotator: 'rotator', shoulders_scapular: 'scapular', back_lats: 'lats', back_upper: 'upperBack', back_erectors: 'erectors', back_traps: 'traps',
  legs_quads: 'quads', legs_hamstrings: 'hamstrings', legs_glutes: 'glutes', legs_abductors: 'abductors', legs_adductors: 'adductors', legs_gastrocnemius: 'gastrocnemius',
  legs_soleus: 'soleus', legs_tibialis: 'tibialis', core_abs: 'abs', core_obliques: 'obliques', core_stability: 'coreStability', arms_biceps: 'biceps',
  arms_triceps: 'triceps', arms_brachialis: 'brachialis', arms_forearms: 'forearms', arms_wrist_extensors: 'wristExtensors',
} as const;
export type TrainingRegion = keyof typeof trainingRegionMuscle;

export const equipmentTrainingRegions: Record<string, TrainingRegion[]> = {};
const assign = (regions: TrainingRegion[], ids: string[]) => {
  for (const id of ids) equipmentTrainingRegions['equipment_' + id] = regions;
};
assign(["chest_upper"], ["chest_01","chest_02","chest_10","chest_14","chest_19"]);
assign(["chest_middle"], ["chest_03","chest_04","chest_05","chest_08","chest_09","chest_11","chest_15","chest_16","chest_18","chest_20"]);
assign(["chest_lower"], ["chest_06","chest_07","chest_12","chest_13","chest_17"]);
assign(["shoulders_side"], ["shoulders_01","shoulders_02","shoulders_09","shoulders_12","shoulders_14"]);
assign(["shoulders_rear"], ["shoulders_03","shoulders_05","shoulders_07","shoulders_08"]);
assign(["shoulders_front"], ["shoulders_04","shoulders_06","shoulders_10","shoulders_11","shoulders_13"]);
assign(["back_lats"], ["back_01","back_03","back_04","back_07","back_13","back_17"]);
assign(["back_upper"], ["back_02","back_05","back_06","back_08","back_09","back_11","back_14","back_15"]);
assign(["back_erectors", "legs_hamstrings", "legs_glutes"], ["back_10","back_12"]);
assign(["legs_hamstrings"], ["legs_01","legs_10"]);
assign(["legs_quads"], ["legs_02","legs_03","legs_07","legs_08","legs_12","legs_13","legs_15","legs_16","legs_17","legs_18","legs_19"]);
assign(["legs_hamstrings","legs_glutes"], ["legs_04","legs_21"]);
assign(["legs_glutes"], ["legs_05","legs_14"]);
assign(["legs_adductors"], ["legs_09"]);
assign(["legs_soleus"], ["legs_11"]);
assign(["core_abs"], ["core_01","core_02","core_03","core_05","core_11","core_12"]);
assign(["core_stability"], ["core_04","core_09","core_13"]);
assign(["core_obliques"], ["core_06","core_08","core_10"]);
assign(["core_obliques","core_stability"], ["core_07","core_14"]);
assign(["arms_triceps"], ["arms_01","arms_02","arms_03","arms_04","arms_05","arms_06","arms_15","arms_20"]);
assign(["arms_biceps"], ["arms_07","arms_08","arms_10","arms_11","arms_13","arms_14","arms_16","arms_18","arms_19"]);
assign(["arms_brachialis"], ["arms_09","arms_17","arms_21"]);
assign(["arms_forearms"], ["arms_12"]);
assign(["shoulders_rotator"], ["shoulders_15","shoulders_16"]);
assign(["shoulders_scapular"], ["shoulders_17"]);
assign(["back_traps"], ["back_16"]);
assign(["legs_abductors"], ["legs_20"]);
assign(["legs_tibialis"], ["legs_22"]);
assign(["arms_wrist_extensors"], ["arms_22"]);
assign(["legs_gastrocnemius","legs_soleus"], ["legs_06"]);
