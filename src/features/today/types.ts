export type TodayTrainingProps = {
  viewDate: Date | null;
  onViewDateChange: (date: Date | null) => void;
  onStart: (
    workoutId: string,
    setMultiplier?: number,
    rirTarget?: number,
    equipmentPlan?: import('../../domain/training/equipment/equipmentTraining').EquipmentSessionPlan,
  ) => void;
  onOpenExercise: (exerciseId: string) => void;
};
