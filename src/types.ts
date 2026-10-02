export type Goal = 'weight_loss' | 'fat_loss' | 'gain' | 'strength' | 'street_mastery' | 'equipment';
export type NutritionGoal = 'rapid_loss' | 'fat_loss' | 'muscle_gain' | 'performance' | 'maintain';
export type DietPattern = 'balanced_cn' | 'high_protein' | 'low_carb' | 'keto';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite' | 'supermax';
export type EquipmentSplit = 'bro' | 'ppl' | 'upper_lower';
export type EquipmentSpec = 'mini' | 'light' | 'standard' | 'pro' | 'ultra';

export type Profile = {
  name: string;
  sex: 'male' | 'female' | 'unspecified';
  age: number;
  height: number;
  weight: number;
  weightHistory?: Array<{ date: string; kg: number }>;
  goal: Goal;
  nutritionGoal: NutritionGoal;
  dietPattern: DietPattern;
  frequency: number;
  sessionMinutes?: number;
  levels: Record<string, number>;
  planLevels?: Record<string, number>;
  trainingRestSeconds?: number;
  neckBridgeConsent?: boolean;
  experience: ExperienceLevel;
  equipmentSplit?: EquipmentSplit;
  equipmentTrainingDays?: number[];
  equipmentAvailableGear?: string[];
  equipmentPriority?: 'balanced' | 'chest' | 'shoulders' | 'back' | 'legs' | 'core' | 'arms';
  equipmentMovementOverrides?: Record<string, Record<string, string>>;
  planId: string;
  planStartedAt: string;
  topicPlans?: Partial<Record<Goal, TrainingTopicConfig>>;
};

export type TrainingTopicConfig = Pick<Profile, 'frequency' | 'sessionMinutes' | 'trainingRestSeconds' | 'experience' | 'planId' | 'planStartedAt'
  | 'equipmentSplit' | 'equipmentTrainingDays' | 'equipmentAvailableGear' | 'equipmentPriority' | 'equipmentMovementOverrides'>;

export type Exercise = {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  categoryLabel?: string;
  step?: number;
  purpose?: string;
  source?: string;
  riskLevel?: string;
  equipment?: string[];
  keyPoints?: string[];
  commonIssues?: Array<{ problem: string; fix: string }>;
  standards?: Record<string, string>;
  defaultPrescription?: {
    sets?: number;
    repRange?: number[];
    restSeconds?: number;
    tempoDescription?: string;
    rirTarget?: number;
  };
  image?: string;
  realImage?: string;
  isHold?: boolean;
};

export type WorkoutSlot = {
  id: string;
  category: string;
  priority: number;
  prescription?: { sets?: number; restSeconds?: number };
};

export type Workout = {
  id: string;
  name: string;
  description: string;
  // Static templates may carry a legacy estimate; equipment uses its generated timeline.
  estimatedMinutes?: number;
  slots: WorkoutSlot[];
};

export type SetLog = {
  reps: number;
  completed: boolean;
  unit?: 'reps' | 'seconds' | 'steps' | 'meters';
  completedAt?: string;
  loadKg?: number;
  rir?: number;
};

export type SessionExercise = {
  exerciseId: string;
  name: string;
  category: string;
  sets: SetLog[];
  targetSnapshot?: { sets: number; value: number; unit: 'reps' | 'seconds' | 'steps' | 'meters'; repRange?: [number, number]; perSide?: boolean; loadBasis?: 'machine' | 'total' | 'per_hand' | 'bodyweight'; restSeconds?: number; rirTarget?: number };
  constraintsConfirmed?: boolean;
};

export type TrainingSession = {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  exercises: SessionExercise[];
  totalReps: number;
  kind?: 'strength' | 'running';
  distanceKm?: number;
  calories?: number;
  route?: Array<{ latitude: number; longitude: number }>;
  quality?: 'solid' | 'hard' | 'pain';
  completion?: 'complete' | 'partial';
  trainingDate?: string;
  planSnapshot?: EquipmentPlanRecord;
  interactionEvents?: TrainingInteractionEvent[];
};

export type TrainingInteractionEvent = { kind: 'set_completed' | 'set_unchecked' | 'rest_started' | 'transition_started' | 'timer_skipped' | 'timer_extended' | 'timer_paused' | 'timer_resumed' | 'timer_finished' | 'warmup_acknowledged'; at: string; exerciseId?: string; setIndex?: number; plannedSeconds?: number };
export type EquipmentPlanRecord = {
  schemaVersion: 2 | 3 | 4; revision: string; workoutId: string;
  // Read-only compatibility with old timed-session history; new records omit these.
  spec?: EquipmentSpec; budgetSeconds?: number;
  estimate: import('./data/equipmentTimeline').EquipmentEstimate;
  targets: Array<{ id: string; sets: number; range?: [number, number]; restSeconds: number; rir?: number; perSide?: boolean; loadBasis?: 'machine' | 'total' | 'per_hand' | 'bodyweight' }>;
};

export type DailyWorkoutEdits = Record<string, { date: string; workoutId: string; exerciseIds: string[] }>;

export type Settings = {
  vibration: boolean;
  restSeconds: number;
  runningGoal?: import('./data/runGoals').RunningGoal;
};

export type Route =
  | { name: 'tabs' }
  | { name: 'exercise'; exerciseId: string }
  | { name: 'training'; workoutId: string; exerciseId?: string; setMultiplier?: number; rirTarget?: number; equipmentPlan?: import('./data/equipmentTraining').EquipmentSessionPlan }
  | { name: 'run' }
  | { name: 'nutrition' };
