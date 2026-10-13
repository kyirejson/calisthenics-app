import type { DailyWorkoutEdits, Goal, Profile, Settings, TrainingSession } from '../types';
import type { Food, MealSlot, NutritionJournal, NutritionPreferences } from '../nutrition/types';
import type { IntakeInput } from '../nutrition/journal';
export const storageKeys = {
  profile: 'user_profile',
  sessions: 'sessions',
  sessionsBackup: 'sessions_before_checked_only_v1',
  settings: 'settings',
  dailyEdits: 'daily_workout_edits',
  nutrition: 'nutrition_journal_v1',
  trainingTransaction: 'training_write_ahead_v1',
} as const;
export type StoreState = {
  ready: boolean;
  profile: Profile | null;
  sessions: TrainingSession[];
  settings: Settings;
  dailyEdits: DailyWorkoutEdits;
  nutritionJournal: NutritionJournal;
  nutritionStorageIssue: string;
  storageIssues: Record<string, string>;
};
export type StoreActions = {
  retryStorageLoading(): Promise<void>;
  saveProfile(profile: Profile): Promise<void>;
  patchProfile(patch: Partial<Profile> | ((current: Profile) => Partial<Profile>)): Promise<void>;
  switchTrainingGoal(goal: Goal): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  saveSession(session: TrainingSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
  addDailyExercise(date: string, workoutId: string, exerciseId: string): Promise<void>;
  removeDailyExercise(date: string, workoutId: string, exerciseId: string): Promise<void>;
  resetTrainingDay(date: string): Promise<void>;
  setPhotoConsent(consent: boolean): Promise<void>;
  saveNutritionPreferences(preferences: NutritionPreferences): Promise<void>;
  saveIntakeEntry(input: IntakeInput): Promise<void>;
  applyMealOperations(input: unknown, requestId: string, signal?: AbortSignal): Promise<import('../nutrition/mealOperations').MealWriteResult>;
  deleteIntakeEntry(id: string): Promise<void>;
  saveCustomFood(food: Food): Promise<void>;
  deleteCustomFood(id: string): Promise<void>;
  captureNutritionTarget(): Promise<void>;
  confirmNutritionLogging(date: string, slot: MealSlot | 'day', confirmed: boolean): Promise<void>;
  setNutritionMealStatus(
    date: string,
    slot: MealSlot,
    status: 'not_eaten' | 'unrecorded',
  ): Promise<void>;
  exportData(): Promise<string>;
  clearData(): Promise<void>;
};
export type StoreValue = StoreState & StoreActions;
export type AppStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiSet(pairs: Array<[string, string]>): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
};
export type DomainContext = {
  storage: AppStorage;
  read(): StoreState;
  commit(change: Partial<StoreState>): void;
  guard(): void;
  assertWritable(key: string): void;
};
