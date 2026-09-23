import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Profile, Settings, TrainingSession } from '../types';
import { normalizeDietPattern, normalizeNutritionGoal } from '../data/nutritionPlanner';
import { progressionSeries } from '../data/progression';
import { getTrainingPlan, recommendPlanId } from '../data/trainingPlans';

const KEYS = {
  profile: 'user_profile',
  sessions: 'sessions',
  settings: 'settings',
};

const defaultSettings: Settings = { vibration: true, restSeconds: 60 };

function normalizeSettings(raw: Partial<Settings> & Record<string, unknown>): Settings {
  const restSeconds = Number(raw.restSeconds);
  return {
    vibration: raw.vibration !== false,
    restSeconds: Number.isFinite(restSeconds) ? Math.max(15, Math.min(300, Math.round(restSeconds))) : defaultSettings.restSeconds,
  };
}

function normalizeProfile(raw: Partial<Profile> & Record<string, unknown>): Profile {
  const legacyGoal = raw.goal;
  const goal: Profile['goal'] = legacyGoal === 'gain' || legacyGoal === 'strength' || legacyGoal === 'health'
    ? legacyGoal
    : 'fat_loss';
  const frequency = Math.max(1, Math.min(6, Number(raw.frequency) || 3));
  const experience: Profile['experience'] = raw.experience === 'intermediate' || raw.experience === 'advanced'
    ? raw.experience
    : raw.experience === 'beginner'
      ? 'beginner'
      : frequency <= 3 ? 'beginner' : frequency <= 5 ? 'intermediate' : 'advanced';
  const levels = { ...(raw.levels || {}) } as Record<string, number>;
  progressionSeries.forEach((series) => { if (!levels[series.key]) levels[series.key] = 1; });
  const storedPlanStart = typeof raw.planStartedAt === 'string' ? raw.planStartedAt : '';
  const planStartedAt = storedPlanStart && !Number.isNaN(Date.parse(storedPlanStart)) ? storedPlanStart : new Date().toISOString();
  const base: Omit<Profile, 'planId'> = {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : '训练者',
    sex: raw.sex === 'female' ? 'female' as const : 'male' as const,
    age: Number(raw.age) || 28,
    height: Number(raw.height) || 170,
    weight: Number(raw.weight) || 65,
    goal,
    nutritionGoal: normalizeNutritionGoal(raw.nutritionGoal || legacyGoal),
    dietPattern: normalizeDietPattern(raw.dietPattern),
    frequency,
    levels,
    experience,
    planStartedAt,
  };
  const requestedPlanId = typeof raw.planId === 'string' ? raw.planId : recommendPlanId(base);
  const plan = getTrainingPlan(requestedPlanId);
  return { ...base, planId: plan.id, frequency: plan.frequency };
}

type StoreValue = {
  ready: boolean;
  profile: Profile | null;
  sessions: TrainingSession[];
  settings: Settings;
  saveProfile: (profile: Profile) => Promise<void>;
  saveSession: (session: TrainingSession) => Promise<void>;
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

  useEffect(() => {
    AsyncStorage.multiGet(Object.values(KEYS))
      .then((pairs) => {
        const map = Object.fromEntries(pairs);
        if (map[KEYS.profile]) {
          const migrated = normalizeProfile(JSON.parse(map[KEYS.profile]!));
          setProfile(migrated);
          void AsyncStorage.setItem(KEYS.profile, JSON.stringify(migrated));
        }
        if (map[KEYS.sessions]) setSessions(JSON.parse(map[KEYS.sessions]!));
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

  const saveSession = useCallback(async (session: TrainingSession) => {
    const next = [session, ...sessions.filter((item) => item.id !== session.id)];
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(next));
    setSessions(next);
  }, [sessions]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = normalizeSettings({ ...settings, ...patch });
    await AsyncStorage.setItem(KEYS.settings, JSON.stringify(next));
    setSettings(next);
  }, [settings]);

  const exportData = useCallback(
    () => JSON.stringify({ formatVersion: '2.0-mobile', exportDate: new Date().toISOString(), data: { user_profile: profile, sessions, settings } }, null, 2),
    [profile, sessions, settings],
  );

  const clearData = useCallback(async () => {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    setProfile(null);
    setSessions([]);
    setSettings(defaultSettings);
  }, []);

  const value = useMemo(() => ({ ready, profile, sessions, settings, saveProfile, saveSession, updateSettings, exportData, clearData }), [ready, profile, sessions, settings, saveProfile, saveSession, updateSettings, exportData, clearData]);
  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export function useAppStore() {
  const value = useContext(Store);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}
