export type Goal = 'weight_loss' | 'fat_loss' | 'gain' | 'strength' | 'street_mastery';
export type NutritionGoal = 'rapid_loss' | 'fat_loss' | 'muscle_gain' | 'performance' | 'maintain';
export type DietPattern = 'balanced_cn' | 'high_protein' | 'low_carb' | 'keto';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite' | 'supermax';

export type Profile = {
  name: string;
  sex: 'male' | 'female';
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
  planId: string;
  planStartedAt: string;
};

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
  estimatedMinutes: number;
  slots: WorkoutSlot[];
};

export type SetLog = {
  reps: number;
  completed: boolean;
  unit?: 'reps' | 'seconds' | 'steps' | 'meters';
  completedAt?: string;
};

export type SessionExercise = {
  exerciseId: string;
  name: string;
  category: string;
  sets: SetLog[];
  targetSnapshot?: { sets: number; value: number; unit: 'reps' | 'seconds' | 'steps' | 'meters' };
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
  quality?: 'solid' | 'hard' | 'pain';
  completion?: 'complete' | 'partial';
  trainingDate?: string;
};

export type DailyWorkoutEdits = Record<string, { date: string; workoutId: string; exerciseIds: string[] }>;

export type Settings = {
  vibration: boolean;
  restSeconds: number;
};

export type Route =
  | { name: 'tabs' }
  | { name: 'exercise'; exerciseId: string }
  | { name: 'training'; workoutId: string; exerciseId?: string; setMultiplier?: number; rirTarget?: number }
  | { name: 'run' }
  | { name: 'nutrition' };
