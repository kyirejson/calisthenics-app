export type Goal = 'strength' | 'gain' | 'cut' | 'health';

export type Profile = {
  name: string;
  sex: 'male' | 'female';
  age: number;
  height: number;
  weight: number;
  goal: Goal;
  frequency: number;
  levels: Record<string, number>;
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

export type SetLog = { reps: number; completed: boolean };

export type SessionExercise = {
  exerciseId: string;
  name: string;
  category: string;
  sets: SetLog[];
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
};

export type Settings = {
  vibration: boolean;
  restSeconds: number;
  sound: boolean;
};

export type Route =
  | { name: 'tabs' }
  | { name: 'exercise'; exerciseId: string }
  | { name: 'training'; workoutId: string }
  | { name: 'run' }
  | { name: 'plans' };
