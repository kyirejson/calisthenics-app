import { normalizeAssistantState, withAssistantFact, type AssistantConversation, type AssistantFact } from '../nutrition/assistantState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DailyWorkoutEdits, Profile, Settings, TrainingSession } from '../types';
import { cleanSession, dailyWorkoutKey, normalizeTrainingSessions, withoutTrainingDay } from '../data/sessionRecords';
import { normalizeDietPattern, normalizeNutritionGoal } from '../nutrition/legacyProfile';
import { progressionSeries } from '../data/progression';
import { PERSONAL_PLAN_ID, RETIRED_PLAN_ID, recommendPlanId } from '../data/trainingPlans';
import { preferredSessionMinutes } from '../data/trainingPrescription';
import { emptyNutritionJournal, normalizeNutritionJournal } from '../nutrition/engine';
import { withCustomFood, withFavoriteMeal, withIntakeEntry, withMealRevision, withNutritionPreferences, withoutCustomFood, withoutFavoriteMeal, withoutIntakeEntry, withoutMealOverride, type IntakeInput } from '../nutrition/journal';
import { createNutritionTargetSnapshot, withDailyTargetSnapshot, withMealLoggingConfirmation, withNutritionTrainingTime } from '../nutrition/timeline';
import { getNutritionTrainingContext } from '../nutrition/training';
import { withAppliedMealDraft, type MealAdjustmentDraft } from '../nutrition/adjustments';
import { localWeightDate } from '../data/weightTrend';
import type { Food, IntakeEntry, MealSlot, NutritionJournal, NutritionPreferences, TrainingTime } from '../nutrition/types';
import { normalizeBodyMetrics } from '../nutrition/profileBody';
import { normalizeRunningGoal } from '../data/runGoals';
import { referencedPhotoIds } from '../nutrition/photoMetadata';

const KEYS = {
  profile: 'user_profile',
  sessions: 'sessions',
  sessionsBackup: 'sessions_before_checked_only_v1',
  settings: 'settings',
  dailyEdits: 'daily_workout_edits',
  nutrition: 'nutrition_journal_v1',
};

const defaultSettings: Settings = { vibration: true, restSeconds: 120 };

function normalizeSettings(raw: Partial<Settings> & Record<string, unknown>): Settings {
  const restSeconds = Number(raw.restSeconds);
  const runningGoal = normalizeRunningGoal(raw.runningGoal);
  return {
    vibration: raw.vibration !== false,
    restSeconds: Number.isFinite(restSeconds) ? Math.max(15, Math.min(300, Math.round(restSeconds))) : defaultSettings.restSeconds,
    ...(runningGoal ? { runningGoal } : {}),
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
    ...normalizeBodyMetrics(raw),
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
  nutritionJournal: NutritionJournal;
  nutritionStorageIssue: string;
  setPhotoConsent: (consent: boolean) => Promise<void>;
  setAssistantConsent: (consent: boolean) => Promise<void>;
  appendAssistantConversation: (turn: AssistantConversation) => Promise<void>;
  saveAssistantFact: (fact: AssistantFact) => Promise<void>;
  deleteAssistantFact: (id: string) => Promise<void>;
  clearAssistantHistory: () => Promise<void>;
  saveNutritionPreferences: (preferences: NutritionPreferences) => Promise<void>;
  saveIntakeEntry: (input: IntakeInput) => Promise<void>;
  deleteIntakeEntry: (id: string) => Promise<void>;
  setPlannedMealRevision: (date: string, slot: MealSlot, revision: number) => Promise<void>;
  saveCustomFood: (food: Food) => Promise<void>;
  deleteCustomFood: (id: string) => Promise<void>;
  saveFavoriteMeal: (entry: IntakeEntry) => Promise<void>;
  deleteFavoriteMeal: (id: string) => Promise<void>;
  captureNutritionTarget: () => Promise<void>;
  setNutritionTrainingTime: (time: TrainingTime) => Promise<void>;
  confirmNutritionLogging: (date: string, slot: MealSlot | 'day', confirmed: boolean) => Promise<void>;
  applyNutritionMealDraft: (draft: MealAdjustmentDraft) => Promise<void>;
  resetNutritionMeal: (date: string, slot: MealSlot) => Promise<void>;
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
  const profileRef = useRef<Profile | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [dailyEdits, setDailyEdits] = useState<DailyWorkoutEdits>({});
  const journal = useRef({ sessions: [] as TrainingSession[], edits: {} as DailyWorkoutEdits });
  const pendingJournal = useRef(Promise.resolve());
  const [nutritionJournal, setNutritionJournal] = useState<NutritionJournal>(emptyNutritionJournal);
  const nutritionRef = useRef<NutritionJournal>(nutritionJournal);
  const [nutritionStorageIssue, setNutritionStorageIssue] = useState('');
  const nutritionRecoveryRaw = useRef<string | null>(null);
  const pendingNutrition = useRef(Promise.resolve());
  const pendingAccount = useRef(Promise.resolve());
  const settingsRef = useRef(defaultSettings);
  const clearing = useRef(false);

  useEffect(() => {
    AsyncStorage.multiGet(Object.values(KEYS))
      .then(async (pairs) => {
        const map = Object.fromEntries(pairs);
        // A bad nutrition payload must not prevent training/profile data loading.
        if (map[KEYS.nutrition]) {
          try {
            const raw = JSON.parse(map[KEYS.nutrition]!);
            if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 || !Array.isArray(raw.entries)) throw new Error('饮食文件结构无法识别。');
            const normalized = normalizeNutritionJournal(raw);
            if (normalized.entries.length !== raw.entries.length) throw new Error('饮食记录存在无法安全加载的条目。');
            nutritionRef.current = normalized;
            setNutritionJournal(nutritionRef.current);
          } catch {
            nutritionRecoveryRaw.current = map[KEYS.nutrition]!;
            setNutritionStorageIssue('本地饮食文件无法完整读取，原始数据已保留。已暂停饮食写入，请先导出备份并核对数据，不会用空记录覆盖。');
            console.warn('读取本地饮食记录失败，原始数据未覆盖；已暂停保存。');
          }
        }
        if (map[KEYS.profile]) {
          const migrated = normalizeProfile(JSON.parse(map[KEYS.profile]!));
          profileRef.current = migrated;
          setProfile(migrated);
          await AsyncStorage.setItem(KEYS.profile, JSON.stringify(migrated));
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
          settingsRef.current = migrated;
          setSettings(migrated);
          await AsyncStorage.setItem(KEYS.settings, JSON.stringify(migrated));
        }
      })
      .catch((error) => console.warn('读取本地数据失败', error))
      .finally(() => setReady(true));
  }, []);

  const saveProfile = useCallback((next: Profile) => {
    if (clearing.current) return Promise.reject(new Error('正在清除数据，请稍后重试。'));
    const operation = pendingAccount.current.then(async () => {
      const normalized = normalizeProfile(next);
      await AsyncStorage.setItem(KEYS.profile, JSON.stringify(normalized));
      profileRef.current = normalized;
      setProfile(normalized);
    });
    pendingAccount.current = operation.catch(() => undefined);
    return operation;
  }, []);

  // Serialize journal mutations so rapid saves/deletes cannot restore stale records.
  const updateJournal = useCallback((change: (current: typeof journal.current) => typeof journal.current) => {
    if (clearing.current) return Promise.reject(new Error('正在清除数据，请稍后重试。'));
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

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    if (clearing.current) return Promise.reject(new Error('正在清除数据，请稍后重试。'));
    const operation = pendingAccount.current.then(async () => {
      const next = normalizeSettings({ ...settingsRef.current, ...patch });
      await AsyncStorage.setItem(KEYS.settings, JSON.stringify(next));
      settingsRef.current = next;
      setSettings(next);
    });
    pendingAccount.current = operation.catch(() => undefined);
    return operation;
  }, []);

  // One persisted document + a serialized queue prevents fast taps from losing meals.
  const updateNutrition = useCallback((change: (current: NutritionJournal) => NutritionJournal | Promise<NutritionJournal>) => {
    if (clearing.current) return Promise.reject(new Error('正在清除数据，请稍后重试。'));
    if (nutritionRecoveryRaw.current !== null) return Promise.reject(new Error('饮食文件无法完整读取，已暂停保存以保留原始数据；请先导出备份并核对。'));
    const operation = pendingNutrition.current.then(async () => {
      const next = await change(nutritionRef.current);
      if (next === nutritionRef.current) return;
      const retainedPhotos = new Set(referencedPhotoIds(next));
      const removedPhotos = referencedPhotoIds(nutritionRef.current).filter(id => !retainedPhotos.has(id));
      await AsyncStorage.setItem(KEYS.nutrition, JSON.stringify(next));
      nutritionRef.current = next;
      setNutritionJournal(next);
      if (removedPhotos.length) {
        try { const { deleteStoredPhotos } = await import('../nutrition/photoStorage'); await deleteStoredPhotos(removedPhotos); }
        catch { console.warn('饮食记录已保存，但本机照片清理未完成。'); }
      }
    });
    pendingNutrition.current = operation.catch(() => undefined);
    return operation;
  }, []);
  const setPhotoConsent = useCallback((consent: boolean) => updateNutrition(current => ({ ...current, photoConsentAt: consent ? new Date().toISOString() : null })), [updateNutrition]);
  const setAssistantConsent = useCallback((consent: boolean) => updateNutrition(current => ({ ...current, assistant: { ...current.assistant, consentAt: consent ? new Date().toISOString() : null } })), [updateNutrition]);
  const appendAssistantConversation = useCallback((turn: AssistantConversation) => updateNutrition(current => {
    const conversations = [...current.assistant.conversations.filter(t => t.id !== turn.id), turn].slice(-30);
    return { ...current, assistant: normalizeAssistantState({ ...current.assistant, conversations }) };
  }), [updateNutrition]);
  const saveAssistantFact = useCallback((fact: AssistantFact) => updateNutrition(current => {
    const remembered = withAssistantFact(current.assistant, fact);
    const assistant = { ...remembered, conversations: remembered.conversations.map(turn => fact.id === 'fact-' + turn.id ? { ...turn, answer: '已记住，可在“记忆”中查看或删除。' } : turn) };
    const allergenMap = { '牛奶': 'milk', '乳制品': 'milk', '鸡蛋': 'egg', '大豆': 'soy', '小麦': 'wheat', '花生': 'peanut', '坚果': 'tree_nut', '鱼': 'fish', '虾': 'shellfish', '贝类': 'shellfish' } as const;
    const allergens = fact.kind === 'allergy' ? Object.entries(allergenMap).filter(([name]) => fact.text.includes(name)).map(([, value]) => value) : [];
    return { ...current, assistant, ...(current.preferences && allergens.length ? { preferences: { ...current.preferences, allergens: [...new Set([...current.preferences.allergens, ...allergens])] } } : {}) };
  }), [updateNutrition]);
  const deleteAssistantFact = useCallback((id: string) => updateNutrition(current => ({ ...current, assistant: { ...current.assistant, facts: current.assistant.facts.filter(f => f.id !== id) } })), [updateNutrition]);
  const clearAssistantHistory = useCallback(() => updateNutrition(current => ({ ...current, assistant: { ...current.assistant, conversations: [] } })), [updateNutrition]);
  const saveNutritionPreferences = useCallback((preferences: NutritionPreferences) => updateNutrition((current) => withNutritionPreferences(current, preferences)), [updateNutrition]);
  const saveIntakeEntry = useCallback((input: IntakeInput) => updateNutrition((current) => {
    const journal = withIntakeEntry(current, input);
    return { ...journal, assistant: { ...journal.assistant, conversations: journal.assistant.conversations.map(turn => input.id === 'intake-' + turn.id ? { ...turn, answer: '已记录这一餐，可在今日饮食中查看。' } : turn) } };
  }), [updateNutrition]);
  const deleteIntakeEntry = useCallback((id: string) => updateNutrition((current) => withoutIntakeEntry(current, id)), [updateNutrition]);
  const setPlannedMealRevision = useCallback((date: string, slot: MealSlot, revision: number) => updateNutrition(current => withMealRevision(current, date, slot, revision)), [updateNutrition]);
  const saveCustomFood = useCallback((food: Food) => updateNutrition(current => withCustomFood(current, food)), [updateNutrition]);
  const deleteCustomFood = useCallback((id: string) => updateNutrition(current => withoutCustomFood(current, id)), [updateNutrition]);
  const saveFavoriteMeal = useCallback((entry: IntakeEntry) => updateNutrition(current => withFavoriteMeal(current, entry)), [updateNutrition]);
  const deleteFavoriteMeal = useCallback((id: string) => updateNutrition(current => withoutFavoriteMeal(current, id)), [updateNutrition]);
  const captureNutritionTarget = useCallback(() => updateNutrition(async current => {
    await Promise.all([pendingAccount.current, pendingJournal.current]);
    if (!profileRef.current) return current;
    const now = new Date();
    const date = localWeightDate(now);
    const training = getNutritionTrainingContext(profileRef.current, journal.current.sessions, journal.current.edits, date);
    return withDailyTargetSnapshot(current, date, createNutritionTargetSnapshot(profileRef.current, current, training, now.toISOString()));
  }), [updateNutrition]);
  const setNutritionTrainingTime = useCallback((time: TrainingTime) => updateNutrition(current => withNutritionTrainingTime(current, time)), [updateNutrition]);
  const confirmNutritionLogging = useCallback((date: string, slot: MealSlot | 'day', confirmed: boolean) => updateNutrition(current => withMealLoggingConfirmation(current, date, slot, confirmed)), [updateNutrition]);
  const applyNutritionMealDraft = useCallback((draft: MealAdjustmentDraft) => updateNutrition(async current => {
    // A pending profile/course save must finish before accepting an old preview.
    await Promise.all([pendingAccount.current, pendingJournal.current]);
    if (!profileRef.current) throw new Error('个人资料已变化，请重新打开饮食页。');
    const date = localWeightDate(new Date());
    if (draft.date !== date) throw new Error('日期已变化，请回到今天并重新生成草案。');
    const training = getNutritionTrainingContext(profileRef.current, journal.current.sessions, journal.current.edits, date);
    return withAppliedMealDraft(current, profileRef.current, training, draft);
  }), [updateNutrition]);
  const resetNutritionMeal = useCallback((date: string, slot: MealSlot) => updateNutrition(current => withoutMealOverride(current, date, slot)), [updateNutrition]);

  const exportData = useCallback(
    () => JSON.stringify({ formatVersion: '2.3-mobile', exportDate: new Date().toISOString(), data: { user_profile: profile, sessions, settings, daily_workout_edits: dailyEdits, nutrition_journal_v1: nutritionJournal },
      ...(nutritionRecoveryRaw.current !== null ? { recovery: { nutritionRaw: nutritionRecoveryRaw.current, reason: '饮食文件无法完整读取，原始文本保留以便人工恢复。' } } : {}) }, null, 2),
    [profile, sessions, settings, dailyEdits, nutritionJournal],
  );

  const clearData = useCallback(async () => {
    clearing.current = true;
    try {
      await Promise.all([pendingJournal.current, pendingNutrition.current, pendingAccount.current]);
      const photos = referencedPhotoIds(nutritionRef.current);
      await AsyncStorage.multiRemove(Object.values(KEYS));
      setProfile(null);
      profileRef.current = null;
      setSessions([]);
      setSettings(defaultSettings);
      settingsRef.current = defaultSettings;
      journal.current = { sessions: [], edits: {} };
      setDailyEdits({});
      nutritionRef.current = emptyNutritionJournal();
      nutritionRecoveryRaw.current = null;
      setNutritionStorageIssue('');
      setNutritionJournal(nutritionRef.current);
      if (photos.length) { try { const { deleteStoredPhotos } = await import('../nutrition/photoStorage'); await deleteStoredPhotos(photos); } catch { console.warn('记录已清除，但本机照片清理未完成。'); } }
    } finally {
      clearing.current = false;
    }
  }, []);

  const value = useMemo(() => ({ ready, profile, sessions, settings, dailyEdits, nutritionJournal, nutritionStorageIssue, setPhotoConsent, setAssistantConsent, appendAssistantConversation, saveAssistantFact, deleteAssistantFact, clearAssistantHistory, saveNutritionPreferences, saveIntakeEntry, deleteIntakeEntry, setPlannedMealRevision, saveCustomFood, deleteCustomFood, saveFavoriteMeal, deleteFavoriteMeal, captureNutritionTarget, setNutritionTrainingTime, confirmNutritionLogging, applyNutritionMealDraft, resetNutritionMeal, saveProfile, saveSession, deleteSession, addDailyExercise, removeDailyExercise, resetTrainingDay, updateSettings, exportData, clearData }), [ready, profile, sessions, settings, dailyEdits, nutritionJournal, nutritionStorageIssue, setPhotoConsent, setAssistantConsent, appendAssistantConversation, saveAssistantFact, deleteAssistantFact, clearAssistantHistory, saveNutritionPreferences, saveIntakeEntry, deleteIntakeEntry, setPlannedMealRevision, saveCustomFood, deleteCustomFood, saveFavoriteMeal, deleteFavoriteMeal, captureNutritionTarget, setNutritionTrainingTime, confirmNutritionLogging, applyNutritionMealDraft, resetNutritionMeal, saveProfile, saveSession, deleteSession, addDailyExercise, removeDailyExercise, resetTrainingDay, updateSettings, exportData, clearData]);
  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export function useAppStore() {
  const value = useContext(Store);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}
