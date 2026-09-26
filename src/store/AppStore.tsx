import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DailyWorkoutEdits, Profile, Settings, TrainingSession } from '../types';
import { cleanSession, dailyWorkoutKey, normalizeTrainingSessions, withoutTrainingDay } from '../data/sessionRecords';
import { normalizeDietPattern, normalizeNutritionGoal } from '../data/nutritionPlanner';
import { progressionSeries } from '../data/progression';
import { PERSONAL_PLAN_ID, RETIRED_PLAN_ID, recommendPlanId } from '../data/trainingPlans';
import { preferredSessionMinutes } from '../data/trainingPrescription';

const KEYS = {
  profile: 'user_profile',
  sessions: 'sessions',
  sessionsBackup: 'sessions_before_checked_only_v1',
  settings: 'settings',
  dailyEdits: 'daily_workout_edits',
};

const defaultSettings: Settings = { vibration: true, restSeconds: 120 };

function normalizeSettings(raw: Partial<Settings> & Record<string, unknown>): Settings {
  const restSeconds = Number(raw.restSeconds);
  return {
    vibration: raw.vibration !== false,
    restSeconds: Number.isFinite(restSeconds) ? Math.max(15, Math.min(300, Math.round(restSeconds))) : defaultSettings.restSeconds,
  };
}

function normalizeProfile(raw: Partial<Profile> & Record<string, unknown>): Profile {
  const legacyGoal: unknown = raw.goal;
  const goal: Profile['goal'] = legacyGoal === 'health' ? 'street_mastery'
    : legacyGoal === 'gain' || legacyGoal === 'strength' || legacyGoal === 'street_mastery' || legacyGoal === 'weight_loss'
      ? legacyGoal : 'fat_loss';
  const storedFrequency = Math.max(2, Math.min(6, Number(raw.frequency) || 3));
  const frequency = goal === 'street_mastery' && ![2, 3, 6].includes(storedFrequency) ? 3 : storedFrequency;
  const experience: Profile['experience'] = raw.experience === 'intermediate' || raw.experience === 'advanced' || raw.experience === 'elite' || raw.experience === 'supermax'
    ? raw.experience
    : raw.experience === 'beginner'
      ? 'beginner'
      : frequency <= 2 ? 'beginner' : frequency <= 3 ? 'intermediate' : 'advanced';
  const levels = { ...(raw.levels || {}) } as Record<string, number>;
  progressionSeries.forEach((series) => { if (!levels[series.key]) levels[series.key] = 1; });
  const planLevels = { ...(raw.planLevels || {}) } as Record<string, number>;
  // Existing installs had no separate training variant; offer the common squat
  // starting point without changing verified progression levels.
  if (!raw.planLevels && (levels.squat || 1) === 1) planLevels.squat = 5;
  if (!raw.planLevels && (levels.pull || 1) > 2) planLevels.pull = 2;
  const restOptions = goal === 'street_mastery' ? [120, 180, 240, 300] : [90, 120, 150, 180, 240];
  const trainingRestSeconds = restOptions.includes(Number(raw.trainingRestSeconds)) ? Number(raw.trainingRestSeconds) : goal === 'street_mastery' ? 180 : 120;
  const storedPlanStart = typeof raw.planStartedAt === 'string' ? raw.planStartedAt : '';
  const planId = goal === 'street_mastery' && raw.planId === RETIRED_PLAN_ID ? RETIRED_PLAN_ID : recommendPlanId({ goal });
  const migratingLegacyPlan = goal === 'weight_loss' && raw.planId !== PERSONAL_PLAN_ID;
  const planStartedAt = !migratingLegacyPlan && storedPlanStart && !Number.isNaN(Date.parse(storedPlanStart)) ? storedPlanStart : new Date().toISOString();
  const weightHistory = Array.isArray(raw.weightHistory)
    ? raw.weightHistory.filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry?.date) && Number.isFinite(entry?.kg) && entry.kg >= 30 && entry.kg <= 300).slice(-180)
    : [];
  const base: Omit<Profile, 'planId'> = {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : '训练者',
    sex: raw.sex === 'female' ? 'female' as const : 'male' as const,
    age: Number(raw.age) || 28,
    height: Number(raw.height) || 170,
    weight: Number(raw.weight) || 65,
    weightHistory,
    goal,
    nutritionGoal: goal === 'weight_loss' ? 'rapid_loss' : goal === 'street_mastery' ? 'performance' : normalizeNutritionGoal(raw.nutritionGoal || legacyGoal),
    dietPattern: normalizeDietPattern(raw.dietPattern),
    frequency,
    sessionMinutes: preferredSessionMinutes(raw),
    levels,
    planLevels,
    trainingRestSeconds,
    neckBridgeConsent: raw.neckBridgeConsent === true && (levels.bridge || 1) >= 6,
    experience,
    planStartedAt,
  };
  return { ...base, planId };
}

type StoreValue = {
  ready: boolean;
  profile: Profile | null;
  sessions: TrainingSession[];
  settings: Settings;
  dailyEdits: DailyWorkoutEdits;
  saveProfile: (profile: Profile) => Promise<void>;
  saveSession: (session: TrainingSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addDailyExercise: (date: string, workoutId: string, exerciseId: string) => Promise<void>;
  removeDailyExercise: (date: string, workoutId: string, exerciseId: string) => Promise<void>;
  resetTrainingDay: (date: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  exportData: () => string;
  clearData: () => Promise<void>;
};

const Store = createContext<StoreValue | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [dailyEdits, setDailyEdits] = useState<DailyWorkoutEdits>({});
  const journal = useRef({ sessions: [] as TrainingSession[], edits: {} as DailyWorkoutEdits });
  const pendingJournal = useRef(Promise.resolve());

  useEffect(() => {
    AsyncStorage.multiGet(Object.values(KEYS))
      .then(async (pairs) => {
        const map = Object.fromEntries(pairs);
        if (map[KEYS.profile]) {
          const migrated = normalizeProfile(JSON.parse(map[KEYS.profile]!));
          setProfile(migrated);
          void AsyncStorage.setItem(KEYS.profile, JSON.stringify(migrated));
        }
        if (map[KEYS.sessions]) {
          const raw = map[KEYS.sessions]!;
          journal.current.sessions = normalizeTrainingSessions(JSON.parse(raw));
          setSessions(journal.current.sessions);
          const normalized = JSON.stringify(journal.current.sessions);
          if (normalized !== raw) {
            // Preserve a recovery copy before removing obsolete empty/unchecked records.
            const backupKey = KEYS.sessionsBackup;
            if (!(await AsyncStorage.getItem(backupKey))) await AsyncStorage.setItem(backupKey, raw);
            await AsyncStorage.setItem(KEYS.sessions, normalized);
          }
        }
        if (map[KEYS.dailyEdits]) {
          journal.current.edits = JSON.parse(map[KEYS.dailyEdits]!);
          setDailyEdits(journal.current.edits);
        }
        if (map[KEYS.settings]) {
          const migrated = normalizeSettings(JSON.parse(map[KEYS.settings]!));
          setSettings(migrated);
          void AsyncStorage.setItem(KEYS.settings, JSON.stringify(migrated));
        }
      })
      .catch((error) => console.warn('读取本地数据失败', error))
      .finally(() => setReady(true));
  }, []);

  const saveProfile = useCallback(async (next: Profile) => {
    const normalized = normalizeProfile(next);
    await AsyncStorage.setItem(KEYS.profile, JSON.stringify(normalized));
    setProfile(normalized);
  }, []);

  // Serialize journal mutations so rapid saves/deletes cannot restore stale records.
  const updateJournal = useCallback((change: (current: typeof journal.current) => typeof journal.current) => {
    const operation = pendingJournal.current.then(async () => {
      const next = change(journal.current);
      await AsyncStorage.multiSet([[KEYS.sessions, JSON.stringify(next.sessions)], [KEYS.dailyEdits, JSON.stringify(next.edits)]]);
      journal.current = next;
      setSessions(next.sessions);
      setDailyEdits(next.edits);
    });
    pendingJournal.current = operation.catch(() => undefined);
    return operation;
  }, []);

  const saveSession = useCallback((session: TrainingSession) => updateJournal((current) => {
    const cleaned = cleanSession(session);
    if (cleaned.kind !== 'running' && !cleaned.exercises.length) return { ...current, sessions: current.sessions.filter((item) => item.id !== cleaned.id) };
    return { ...current, sessions: [cleaned, ...current.sessions.filter((item) => item.id !== cleaned.id)] };
  }), [updateJournal]);

  const deleteSession = useCallback((id: string) => updateJournal((current) => ({ ...current, sessions: current.sessions.filter((session) => session.id !== id) })), [updateJournal]);
  const addDailyExercise = useCallback((date: string, workoutId: string, exerciseId: string) => updateJournal((current) => {
    const key = dailyWorkoutKey(date, workoutId);
    return { ...current, edits: { ...current.edits, [key]: { date, workoutId, exerciseIds: [...new Set([...(current.edits[key]?.exerciseIds || []), exerciseId])] } } };
  }), [updateJournal]);
  const removeDailyExercise = useCallback((date: string, workoutId: string, exerciseId: string) => updateJournal((current) => {
    const key = dailyWorkoutKey(date, workoutId);
    const edits = { ...current.edits };
    if (edits[key]) {
      const exerciseIds = edits[key].exerciseIds.filter((id) => id !== exerciseId);
      if (exerciseIds.length) edits[key] = { date, workoutId, exerciseIds };
      else delete edits[key];
    }
    return { ...current, edits };
  }), [updateJournal]);
  const resetTrainingDay = useCallback((date: string) => updateJournal((current) => withoutTrainingDay(current.sessions, current.edits, date)), [updateJournal]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = normalizeSettings({ ...settings, ...patch });
    await AsyncStorage.setItem(KEYS.settings, JSON.stringify(next));
    setSettings(next);
  }, [settings]);

  const exportData = useCallback(
    () => JSON.stringify({ formatVersion: '2.1-mobile', exportDate: new Date().toISOString(), data: { user_profile: profile, sessions, settings, daily_workout_edits: dailyEdits } }, null, 2),
    [profile, sessions, settings, dailyEdits],
  );

  const clearData = useCallback(async () => {
    await pendingJournal.current;
    await AsyncStorage.multiRemove(Object.values(KEYS));
    setProfile(null);
    setSessions([]);
    setSettings(defaultSettings);
    journal.current = { sessions: [], edits: {} };
    setDailyEdits({});
  }, []);

  const value = useMemo(() => ({ ready, profile, sessions, settings, dailyEdits, saveProfile, saveSession, deleteSession, addDailyExercise, removeDailyExercise, resetTrainingDay, updateSettings, exportData, clearData }), [ready, profile, sessions, settings, dailyEdits, saveProfile, saveSession, deleteSession, addDailyExercise, removeDailyExercise, resetTrainingDay, updateSettings, exportData, clearData]);
  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export function useAppStore() {
  const value = useContext(Store);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}
