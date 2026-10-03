import { assistantAuthorization, normalizeAssistantState, type AssistantAuthorization, type AssistantConversation, type AssistantFact } from '../nutrition/assistantState';
import { assistantArchive } from '../nutrition/assistantArchive';
import { ASSISTANT_PAGE_SIZE, type ArchiveQuery } from '../nutrition/assistantArchiveCore';
import { normalizePersonalProfile, type PersonalTrainingProfile } from '../nutrition/personalKnowledge';
import { assistantDataBasis, assistantOperationPayload, authorizeAssistantOperation, type AssistantOperation } from '../nutrition/assistantAuthorization';
import { withAssistantPreferences } from '../nutrition/assistantPreferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DailyWorkoutEdits, Goal, Profile, Settings, TrainingSession } from '../types';
import { cleanSession, dailyWorkoutKey, normalizeTrainingSessions, withoutTrainingDay } from '../data/sessionRecords';
import { exercises } from '../data/catalog';
import { defaultSettings, normalizeSettings, normalizeProfile, normalizeDailyEdits } from './profile';
import { loadStoredDomain } from './storage';
import { emptyNutritionJournal, normalizeNutritionJournal } from '../nutrition/engine';
import { withCustomFood, withIntakeEntry, withMealRevision, withNutritionPreferences, withoutCustomFood, withoutIntakeEntry, withoutMealOverride, type IntakeInput } from '../nutrition/journal';
import { createNutritionTargetSnapshot, withDailyTargetSnapshot, withMealLoggingConfirmation, withMealStatus } from '../nutrition/timeline';
import { mealStatusReply } from '../nutrition/mealStatusIntent.mjs';
import { baseDailyEditDate, effectiveDailyEdits, effectiveTrainingProfile } from '../agent/trainingOverlay';
import { prepareTrainingAdjustment } from '../agent/trainingActions';
import { musicURLs, normalizeAgentPreferences, type AgentPreferences } from '../agent/music';
import { Linking, Platform } from 'react-native';
import { getNutritionTrainingContext } from '../nutrition/training';
import { publishAgentEvent } from '../agent/events';
import { resetAgentConnection } from '../agent/connectionRuntime.mjs';
import { withAppliedMealDraft, type MealAdjustmentDraft } from '../nutrition/adjustments';
import { localWeightDate } from '../data/weightTrend';
import type { Food, MealSlot, NutritionJournal, NutritionPreferences } from '../nutrition/types';
import { referencedPhotoIds } from '../nutrition/photoMetadata';
import { withRememberedFact, withoutRememberedFact } from '../nutrition/assistantMemory';

import { captureTrainingTopic, switchTrainingTopic } from '../data/trainingTopicProfiles';

const KEYS = {
  profile: 'user_profile',
  sessions: 'sessions',
  sessionsBackup: 'sessions_before_checked_only_v1',
  settings: 'settings',
  dailyEdits: 'daily_workout_edits',
  nutrition: 'nutrition_journal_v1',
};


const exerciseIds = new Set(exercises.map(exercise => exercise.id));

type StoreValue = {
  ready: boolean;
  profile: Profile | null;
  sessions: TrainingSession[];
  settings: Settings;
  dailyEdits: DailyWorkoutEdits;
  nutritionJournal: NutritionJournal;
  nutritionStorageIssue: string;
  storageIssues: Record<string, string>;
  retryStorageLoading: () => Promise<void>;
  setPhotoConsent: (consent: boolean) => Promise<void>;
  setAssistantConsent: (consent: boolean) => Promise<void>;
  appendAssistantConversation: (turn: AssistantConversation) => Promise<void>;
  saveAssistantFact: (fact: AssistantFact) => Promise<void>;
  deleteAssistantFact: (id: string) => Promise<void>;
  clearAssistantHistory: () => Promise<void>;
  readAssistantHistory: (query?: ArchiveQuery) => Promise<AssistantConversation[]>;
  setAssistantAuthorization: (mode: AssistantAuthorization['mode']) => Promise<void>;
  setAgentPreferences: (patch: Partial<AgentPreferences> | ((current: AgentPreferences) => Partial<AgentPreferences>)) => Promise<void>;
  savePersonalTrainingProfile: (profile: PersonalTrainingProfile) => Promise<void>;
  executeAssistantOperation: (operation: AssistantOperation) => Promise<void>;
  saveNutritionPreferences: (preferences: NutritionPreferences) => Promise<void>;
  saveIntakeEntry: (input: IntakeInput) => Promise<void>;
  deleteIntakeEntry: (id: string) => Promise<void>;
  setPlannedMealRevision: (date: string, slot: MealSlot, revision: number) => Promise<void>;
  saveCustomFood: (food: Food) => Promise<void>;
  deleteCustomFood: (id: string) => Promise<void>;
  captureNutritionTarget: () => Promise<void>;
  confirmNutritionLogging: (date: string, slot: MealSlot | 'day', confirmed: boolean) => Promise<void>;
  setNutritionMealStatus: (date: string, slot: MealSlot, status: 'not_eaten' | 'unrecorded') => Promise<void>;
  applyNutritionMealDraft: (draft: MealAdjustmentDraft) => Promise<void>;
  resetNutritionMeal: (date: string, slot: MealSlot) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  patchProfile: (patch: Partial<Profile> | ((current: Profile) => Partial<Profile>)) => Promise<void>;
  switchTrainingGoal: (goal: Goal) => Promise<void>;
  saveSession: (session: TrainingSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addDailyExercise: (date: string, workoutId: string, exerciseId: string) => Promise<void>;
  removeDailyExercise: (date: string, workoutId: string, exerciseId: string) => Promise<void>;
  resetTrainingDay: (date: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  exportData: () => Promise<string>;
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
  const recoveryRaw = useRef<Record<string, string>>({});
  const [storageIssues, setStorageIssues] = useState<Record<string, string>>({});
  const issuesRef = useRef<Record<string, string>>({});
  const pendingNutrition = useRef(Promise.resolve());
  const pendingTrainingAdjustments = useRef(0);
  const pendingAccount = useRef(Promise.resolve());
  const settingsRef = useRef(defaultSettings);
  const clearing = useRef(false);
  const loading = useRef(false);
  const reloading = useRef(false);
  const archiveReady = useRef(false);
  const archiveLoading = useRef<Promise<void> | null>(null);
  const initializeArchive = async () => {
    if (issuesRef.current.assistant_archive) throw new Error(issuesRef.current.assistant_archive);
    if (archiveReady.current) return;
    if (!archiveLoading.current) archiveLoading.current = assistantArchive.migrate(nutritionRef.current.assistant.conversations)
      .then(() => { archiveReady.current = true; }).finally(() => { archiveLoading.current = null; });
    await archiveLoading.current;
  };
  const persistedNutrition = (value: NutritionJournal) => JSON.stringify(archiveReady.current ? { ...value, assistant: { ...value.assistant, conversations: [] } } : value);

  const loadData = useCallback(async () => {
    loading.current = true;
    issuesRef.current = {};
    recoveryRaw.current = {};
    const object = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('数据文件结构无法识别。');
      return value as Record<string, unknown>;
    };
    const loaders = [
      { key: KEYS.profile, read: () => loadStoredDomain(AsyncStorage, KEYS.profile, raw => normalizeProfile(object(raw))),
        commit: (value: unknown) => { profileRef.current = value as Profile; setProfile(value as Profile); } },
      { key: KEYS.sessions, read: () => loadStoredDomain(AsyncStorage, KEYS.sessions, raw => {
          if (!Array.isArray(raw)) throw new Error('训练文件结构无法识别。');
          return normalizeTrainingSessions(raw);
        }, { backupKey: KEYS.sessionsBackup }),
        commit: (value: unknown) => { journal.current.sessions = value as TrainingSession[]; setSessions(journal.current.sessions); } },
      { key: KEYS.dailyEdits, read: () => loadStoredDomain(AsyncStorage, KEYS.dailyEdits, normalizeDailyEdits),
        commit: (value: unknown) => { journal.current.edits = value as DailyWorkoutEdits; setDailyEdits(journal.current.edits); } },
      { key: KEYS.settings, read: () => loadStoredDomain(AsyncStorage, KEYS.settings, raw => normalizeSettings(object(raw))),
        commit: (value: unknown) => { settingsRef.current = value as Settings; setSettings(settingsRef.current); } },
      { key: KEYS.nutrition, read: () => loadStoredDomain(AsyncStorage, KEYS.nutrition, raw => {
          const input = object(raw) as Record<string, unknown>;
          if (input.version !== 1 || !Array.isArray(input.entries)) throw new Error('饮食文件结构无法识别。');
          const normalized = normalizeNutritionJournal(input);
          if (normalized.entries.length !== input.entries.length) throw new Error('饮食记录存在无法安全加载的条目。');
          return normalized;
        }, { migrate: false }),
        commit: (value: unknown) => { nutritionRef.current = value as NutritionJournal; setNutritionJournal(nutritionRef.current); } },
    ];
    await Promise.all(loaders.map(async loader => {
      const result = await loader.read();
      if (result.value !== undefined) loader.commit(result.value);
      if (result.issue) {
        issuesRef.current[loader.key] = result.issue;
        if (result.raw !== undefined) recoveryRaw.current[loader.key] = result.raw;
        console.warn('本地数据已进入恢复保护：' + loader.key);
      }
    })).then(async () => {
      if (!issuesRef.current[KEYS.nutrition]) {
        try {
          await initializeArchive();
          if (nutritionRef.current.assistant.conversations.length) {
            // The independent archive is committed before retiring the old JSON path.
            await AsyncStorage.setItem(KEYS.nutrition, persistedNutrition(nutritionRef.current));
          }
          const conversations = (await assistantArchive.list()).reverse();
          nutritionRef.current = { ...nutritionRef.current, assistant: { ...nutritionRef.current.assistant, conversations } };
          setNutritionJournal(nutritionRef.current);
        } catch (error) { issuesRef.current.assistant_archive = error instanceof Error ? error.message : '长期记忆读取失败，旧对话仍保留。'; }
      }
      try {
        const backup = await AsyncStorage.getItem(KEYS.sessionsBackup);
        if (backup) recoveryRaw.current[KEYS.sessionsBackup] = backup;
      } catch { console.warn('历史训练迁移备份暂不可读取。'); }
      setStorageIssues({ ...issuesRef.current });
      setNutritionStorageIssue(issuesRef.current[KEYS.nutrition] || '');
      loading.current = false;
      setReady(true);
    });
  }, []);
  useEffect(() => { void loadData(); }, [loadData]);
  const retryStorageLoading = useCallback(async () => {
    if (clearing.current || loading.current || reloading.current) return;
    reloading.current = true;
    try {
      await Promise.all([pendingJournal.current, pendingNutrition.current, pendingAccount.current]);
      setReady(false);
      profileRef.current = null; setProfile(null);
      journal.current = { sessions: [], edits: {} }; setSessions([]); setDailyEdits({});
      settingsRef.current = defaultSettings; setSettings(defaultSettings);
      nutritionRef.current = emptyNutritionJournal(); setNutritionJournal(nutritionRef.current);
      archiveReady.current = false;
      await loadData();
    } finally { reloading.current = false; }
  }, [loadData]);

  const assertWritable = (key: string) => {
    if (loading.current) throw new Error('正在加载本地数据，请稍后重试。');
    if (issuesRef.current[key]) throw new Error(issuesRef.current[key]);
  };

  const updateProfile = useCallback((change: (current: Profile | null) => Profile) => {
    if (pendingTrainingAdjustments.current) return Promise.reject(new Error('正在保存训练调整，请完成后再修改档案。'));
    if (clearing.current) return Promise.reject(new Error('正在清除数据，请稍后重试。'));
    if (reloading.current) return Promise.reject(new Error('正在重新加载数据，请稍后重试。'));
    const operation = pendingAccount.current.then(async () => {
      assertWritable(KEYS.profile);
      const next = change(profileRef.current);
      const current = profileRef.current;
      const normalized = normalizeProfile({ ...next, topicPlans: {
        ...current?.topicPlans, ...next.topicPlans,
        ...(current && current.goal !== next.goal ? { [current.goal]: captureTrainingTopic(current) } : {}),
      } });
      await AsyncStorage.setItem(KEYS.profile, JSON.stringify(normalized));
      profileRef.current = normalized;
      setProfile(normalized);
    });
    pendingAccount.current = operation.catch(() => undefined);
    return operation;
  }, []);

  // Full snapshots are only accepted when creating an absent profile.
  const saveProfile = useCallback((next: Profile) => updateProfile(current => {
    if (current) throw new Error('档案已存在，请只提交需要修改的字段。');
    return next;
  }), [updateProfile]);
  const patchProfile = useCallback((patch: Partial<Profile> | ((current: Profile) => Partial<Profile>)) => updateProfile(current => {
    if (!current) throw new Error('请先建立个人资料');
    const changes = typeof patch === 'function' ? patch(current) : patch;
    if (changes.goal !== undefined && changes.goal !== current.goal) throw new Error('请通过专题切换入口更改训练目标。');
    return { ...current, ...changes };
  }), [updateProfile]);
  const switchTrainingGoal = useCallback((goal: Goal) => updateProfile(current => {
    if (!current) throw new Error('请先建立个人资料');
    return switchTrainingTopic(current, goal);
  }), [updateProfile]);

  // Serialize journal mutations so rapid saves/deletes cannot restore stale records.
  const updateJournal = useCallback((change: (current: typeof journal.current) => typeof journal.current) => {
    if (pendingTrainingAdjustments.current) return Promise.reject(new Error('正在保存训练调整，请完成后再修改训练记录。'));
    if (clearing.current) return Promise.reject(new Error('正在清除数据，请稍后重试。'));
    if (reloading.current) return Promise.reject(new Error('正在重新加载数据，请稍后重试。'));
    const operation = pendingJournal.current.then(async () => {
      const next = change(journal.current);
      const pairs: Array<[string, string]> = [];
      if (next.sessions !== journal.current.sessions) { assertWritable(KEYS.sessions); pairs.push([KEYS.sessions, JSON.stringify(next.sessions)]); }
      if (next.edits !== journal.current.edits) { assertWritable(KEYS.dailyEdits); pairs.push([KEYS.dailyEdits, JSON.stringify(next.edits)]); }
      if (pairs.length) await AsyncStorage.multiSet(pairs);
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
  }).then(() => publishAgentEvent({ kind: 'training_saved', id: session.id, at: Date.now() })), [updateJournal]);

  const deleteSession = useCallback((id: string) => updateJournal((current) => ({ ...current, sessions: current.sessions.filter((session) => session.id !== id) })), [updateJournal]);
  const addDailyExercise = useCallback((date: string, workoutId: string, exerciseId: string) => updateJournal((current) => {
    if (!exerciseIds.has(exerciseId)) throw new Error('此动作已不在动作库中。');
    date = baseDailyEditDate(effectiveTrainingProfile(profileRef.current, nutritionRef.current.assistant), date);
    const key = dailyWorkoutKey(date, workoutId);
    return { ...current, edits: { ...current.edits, [key]: { date, workoutId, exerciseIds: [...new Set([...(current.edits[key]?.exerciseIds || []), exerciseId])] } } };
  }), [updateJournal]);
  const removeDailyExercise = useCallback((date: string, workoutId: string, exerciseId: string) => updateJournal((current) => {
    date = baseDailyEditDate(effectiveTrainingProfile(profileRef.current, nutritionRef.current.assistant), date);
    const key = dailyWorkoutKey(date, workoutId);
    const edits = { ...current.edits };
    if (edits[key]) {
      const exerciseIds = edits[key].exerciseIds.filter((id) => id !== exerciseId);
      if (exerciseIds.length) edits[key] = { date, workoutId, exerciseIds };
      else delete edits[key];
    }
    return { ...current, edits };
  }), [updateJournal]);
  const resetTrainingDay = useCallback((date: string) => updateJournal(current => {
    const owner = baseDailyEditDate(effectiveTrainingProfile(profileRef.current, nutritionRef.current.assistant), date);
    return { sessions: withoutTrainingDay(current.sessions, {}, date).sessions, edits: withoutTrainingDay([], current.edits, owner).edits };
  }), [updateJournal]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    if (clearing.current) return Promise.reject(new Error('正在清除数据，请稍后重试。'));
    if (reloading.current) return Promise.reject(new Error('正在重新加载数据，请稍后重试。'));
    const operation = pendingAccount.current.then(async () => {
      assertWritable(KEYS.settings);
      const next = normalizeSettings({ ...settingsRef.current, ...patch });
      await AsyncStorage.setItem(KEYS.settings, JSON.stringify(next));
      settingsRef.current = next;
      setSettings(next);
    });
    pendingAccount.current = operation.catch(() => undefined);
    return operation;
  }, []);

  // One persisted document + a serialized queue prevents fast taps from losing meals.
  const updateNutrition = useCallback((change: (current: NutritionJournal) => NutritionJournal | Promise<NutritionJournal>, rollbackArchive?: () => Promise<void>) => {
    if (clearing.current) return Promise.reject(new Error('正在清除数据，请稍后重试。'));
    if (reloading.current) return Promise.reject(new Error('正在重新加载数据，请稍后重试。'));
    if (issuesRef.current[KEYS.nutrition]) return Promise.reject(new Error('饮食文件无法完整读取，已暂停保存以保留原始数据；请先导出备份并核对。'));
    const operation = pendingNutrition.current.then(async () => {
      assertWritable(KEYS.nutrition);
      let next: NutritionJournal;
      try {
        next = await change(nutritionRef.current);
        if (next !== nutritionRef.current) {
          const persisted = persistedNutrition(next);
          if (persisted !== persistedNutrition(nutritionRef.current)) await AsyncStorage.setItem(KEYS.nutrition, persisted);
        }
      } catch (error) {
        if (rollbackArchive) {
          try { await rollbackArchive(); }
          catch { throw new Error('档案未保存，相关对话恢复也失败；请先导出备份并重试。'); }
        }
        throw error;
      }
      if (next === nutritionRef.current) return;
      const retainedPhotos = new Set(referencedPhotoIds(next));
      const removedPhotos = referencedPhotoIds(nutritionRef.current).filter(id => !retainedPhotos.has(id));
      const changedTurns = next.assistant.conversations.filter(turn => nutritionRef.current.assistant.conversations.some(old => old.id === turn.id && old.answer !== turn.answer));
      const addedEntries = next.entries.filter(entry => !nutritionRef.current.entries.some(old => old.id === entry.id));
      nutritionRef.current = next;
      setNutritionJournal(next);
      for (const entry of addedEntries) publishAgentEvent({ kind: 'intake_saved', id: entry.id, at: Date.now() });
      if (archiveReady.current && changedTurns.length) {
        try { for (const turn of changedTurns) await assistantArchive.put(turn); }
        catch { console.warn('业务已保存，但对话回执归档未更新；实际业务记录仍为准。'); }
      }
      if (removedPhotos.length) {
        try { const { deleteStoredPhotos } = await import('../nutrition/photoStorage'); await deleteStoredPhotos(removedPhotos); }
        catch { console.warn('饮食记录已保存，但本机照片清理未完成。'); }
      }
    });
    pendingNutrition.current = operation.catch(() => undefined);
    return operation;
  }, []);
  const setPhotoConsent = useCallback((consent: boolean) => updateNutrition(current => ({ ...current, photoConsentAt: consent ? new Date().toISOString() : null })), [updateNutrition]);
  const setAssistantConsent = useCallback((consent: boolean) => updateNutrition(current => ({ ...current, assistant: { ...current.assistant, consentScope: 2, consentAt: consent ? new Date().toISOString() : null } })), [updateNutrition]);
  const appendAssistantConversation = useCallback((turn: AssistantConversation) => updateNutrition(current => {
    return initializeArchive().then(async () => {
      await assistantArchive.put(turn);
      // This is a display page only; all original turns live in the archive.
      const conversations = [...current.assistant.conversations.filter(t => t.id !== turn.id), turn].slice(-ASSISTANT_PAGE_SIZE);
      return { ...current, assistant: normalizeAssistantState({ ...current.assistant, conversations }) };
    });
  }), [updateNutrition]);
  const saveAssistantFact = useCallback((fact: AssistantFact) => updateNutrition(current => withRememberedFact(current, fact)), [updateNutrition]);
  const deleteAssistantFact = useCallback((id: string) => {
    let removed: AssistantConversation[] = [];
    return updateNutrition(async current => {
      const fact = current.assistant.facts.find(f => f.id === id); if (!fact) return current;
      await initializeArchive();
      removed = (await assistantArchive.exportAll()).filter(t => t.question.includes(fact.text) || t.answer.includes(fact.text));
      await assistantArchive.forget(fact.text);
      const next = withoutRememberedFact(current, id);
      const personalProfiles = Object.fromEntries(Object.entries(next.assistant.personalProfiles || {}).map(([topic, p]) => [topic, p && Object.fromEntries(Object.entries(p).map(([key, value]) => [key, typeof value === 'string' && !['topic', 'updatedAt'].includes(key) && value.includes(fact.text) ? '' : value]))]));
      const receipts = Object.fromEntries(Object.entries(next.assistant.receipts || {}).map(([key, r]) => [key, r.kind === 'remember' && r.payload.includes(fact.text) ? { ...r, payload: '<forgotten>' } : r]));
      return { ...next, assistant: normalizeAssistantState({ ...next.assistant, personalProfiles, receipts, conversations: next.assistant.conversations.filter(t => !t.question.includes(fact.text) && !t.answer.includes(fact.text)) }) };
    }, async () => { for (const turn of removed) await assistantArchive.put(turn); });
  }, [updateNutrition]);
  const clearAssistantHistory = useCallback(() => updateNutrition(async current => {
    await initializeArchive(); await assistantArchive.clear();
    return { ...current, assistant: { ...current.assistant, conversations: [] } };
  }), [updateNutrition]);
  const readAssistantHistory = useCallback(async (query?: ArchiveQuery) => {
    await pendingNutrition.current;
    if (clearing.current || reloading.current || loading.current) throw new Error('本地数据正在处理，请稍后重试。');
    assertWritable(KEYS.nutrition); await initializeArchive(); return assistantArchive.list(query);
  }, []);
  const setAssistantAuthorization = useCallback((mode: AssistantAuthorization['mode']) => updateNutrition(current => {
    if (!['request_confirmation', 'full_access'].includes(mode)) throw new Error('权限设置无效。');
    const old = assistantAuthorization(current.assistant);
    if (old.mode === mode) return current;
    if (old.policyVersion >= Number.MAX_SAFE_INTEGER) throw new Error('权限版本已达到上限。');
    return { ...current, assistant: { ...current.assistant, authorization: { mode, policyVersion: old.policyVersion + 1 } } };
  }), [updateNutrition]);
  const savePersonalTrainingProfile = useCallback((input: PersonalTrainingProfile) => updateNutrition(current => {
    const personal = normalizePersonalProfile(input);
    if (!personal || personal.topic !== profileRef.current?.goal) throw new Error('专题或档案已变化，请重新打开问卷。');
    return { ...current, assistant: { ...current.assistant, personalProfiles: { ...current.assistant.personalProfiles, [personal.topic]: personal } } };
  }), [updateNutrition]);
  const setAgentPreferences = useCallback((patch: Partial<AgentPreferences> | ((current: AgentPreferences) => Partial<AgentPreferences>)) => updateNutrition(current => {
    const preferences = normalizeAgentPreferences(current.assistant.agentPreferences);
    return { ...current, assistant: { ...current.assistant, agentPreferences: normalizeAgentPreferences({ ...preferences, ...(typeof patch === 'function' ? patch(preferences) : patch) }) } };
  }), [updateNutrition]);
  const executeAssistantOperation = useCallback((operation: AssistantOperation) => {
    let externalDispatched = false;
    const adjustsTraining = operation.kind === 'training_adjustment';
    if (adjustsTraining) pendingTrainingAdjustments.current++;
    return updateNutrition(async current => {
    await Promise.all([pendingAccount.current, pendingJournal.current]);
    const effectiveProfile = effectiveTrainingProfile(profileRef.current, current.assistant);
    const effectiveEdits = effectiveDailyEdits(journal.current.edits, effectiveProfile);
    if (authorizeAssistantOperation(current.assistant, operation, assistantDataBasis(current, effectiveProfile, journal.current.sessions, effectiveEdits)) === 'replay') return current;
    let next: NutritionJournal;
    if (operation.kind === 'open_music') {
      if (operation.playlist !== current.assistant.agentPreferences?.musicPlaylist) throw Error('歌单已变化，请重新请求。');
      const urls = musicURLs(operation.playlist);
      const native = Platform.OS !== 'web' && await Linking.canOpenURL(urls.native).catch(() => false);
      await Promise.all([pendingAccount.current, pendingJournal.current]);
      const liveProfile = effectiveTrainingProfile(profileRef.current, current.assistant);
      authorizeAssistantOperation(current.assistant, operation, assistantDataBasis(current, liveProfile, journal.current.sessions, effectiveDailyEdits(journal.current.edits, liveProfile)));
      await Linking.openURL(native ? urls.native : urls.web);
      externalDispatched = true;
      next = current;
    }
    else if (operation.kind === 'training_adjustment') {
      if (!effectiveProfile) throw Error('请先建立训练档案。');
      const draft = prepareTrainingAdjustment(effectiveProfile, journal.current.sessions, effectiveEdits, operation.draft.intent);
      if (JSON.stringify(draft) !== JSON.stringify(operation.draft)) throw Error('训练草案已变化，请重新生成。');
      next = { ...current, assistant: { ...current.assistant, trainingOverlays: { ...current.assistant.trainingOverlays, [effectiveProfile.goal]: draft.overlay } } };
    }
    else if (operation.kind === 'remember') next = withRememberedFact(current, operation.fact);
    else if (operation.kind === 'set_preferences') next = withAssistantPreferences(current, profileRef.current, operation.patch);
    else if (operation.kind === 'meal_status') {
      if (operation.date !== localWeightDate(new Date())) throw new Error('日期已变化，请重新发送餐次状态。');
      next = withMealStatus(current, operation.date, operation.slot, operation.status);
    }
    else if (operation.kind === 'log_intake') {
      next = withIntakeEntry(current, operation.input);
      next = { ...next, assistant: { ...next.assistant, conversations: next.assistant.conversations.map(turn => operation.input.id === 'intake-' + turn.id ? { ...turn, answer: '已记录这一餐，可在今日饮食中查看。' } : turn) } };
    }
    else {
      if (!profileRef.current || operation.draft.date !== localWeightDate(new Date())) throw new Error('日期或资料已变化，请重新生成草案。');
      const training = getNutritionTrainingContext(effectiveProfile!, journal.current.sessions, effectiveEdits, operation.draft.date);
      next = withAppliedMealDraft(current, effectiveProfile!, training, operation.draft);
    }
    const answer = operation.kind === 'open_music' ? '已向系统请求打开歌单；是否自动播放由音乐 App 决定。' : operation.kind === 'training_adjustment' ? '已保存训练调整：' + operation.draft.summary : operation.kind === 'remember' ? '已记住，可在“记忆”中查看或删除。' : operation.kind === 'set_preferences' ? '已保存营养偏好，参考目标由本机重新计算。' : operation.kind === 'meal_status' ? mealStatusReply(operation, true) : operation.kind === 'meal' ? '已更新推荐菜单；实际摄入记录未改变。' : '已记录这一餐，可在今日饮食中查看。';
    return { ...next, assistant: { ...next.assistant,
      conversations: next.assistant.conversations.map(turn => operation.id === (operation.kind === 'log_intake' ? 'intake-' : operation.kind + '-') + turn.id ? { ...turn, answer } : turn),
      receipts: { ...next.assistant.receipts, [operation.id]: { kind: operation.kind, payload: assistantOperationPayload(operation), createdAt: new Date().toISOString() } } } };
    }).catch(error => {
      if (externalDispatched) throw new Error('系统打开请求已发出，但回执保存失败；请先查看音乐 App，不要重复执行。');
      throw error;
    }).finally(() => { if (adjustsTraining) pendingTrainingAdjustments.current--; });
  }, [updateNutrition]);
  const saveNutritionPreferences = useCallback((preferences: NutritionPreferences) => updateNutrition((current) => withNutritionPreferences(current, preferences)), [updateNutrition]);
  const saveIntakeEntry = useCallback((input: IntakeInput) => updateNutrition((current) => {
    const journal = withIntakeEntry(current, input);
    return { ...journal, assistant: { ...journal.assistant, conversations: journal.assistant.conversations.map(turn => input.id === 'intake-' + turn.id ? { ...turn, answer: '已记录这一餐，可在今日饮食中查看。' } : turn) } };
  }), [updateNutrition]);
  const deleteIntakeEntry = useCallback((id: string) => updateNutrition((current) => withoutIntakeEntry(current, id)), [updateNutrition]);
  const setPlannedMealRevision = useCallback((date: string, slot: MealSlot, revision: number) => updateNutrition(current => withMealRevision(current, date, slot, revision)), [updateNutrition]);
  const saveCustomFood = useCallback((food: Food) => updateNutrition(current => withCustomFood(current, food)), [updateNutrition]);
  const deleteCustomFood = useCallback((id: string) => updateNutrition(current => withoutCustomFood(current, id)), [updateNutrition]);
  const captureNutritionTarget = useCallback(() => updateNutrition(async current => {
    await Promise.all([pendingAccount.current, pendingJournal.current]);
    if (!profileRef.current) return current;
    const now = new Date();
    const date = localWeightDate(now);
    const effective = effectiveTrainingProfile(profileRef.current, current.assistant)!;
    const training = getNutritionTrainingContext(effective, journal.current.sessions, effectiveDailyEdits(journal.current.edits, effective), date);
    return withDailyTargetSnapshot(current, date, createNutritionTargetSnapshot(effective, current, training, now.toISOString()));
  }), [updateNutrition]);
  const confirmNutritionLogging = useCallback((date: string, slot: MealSlot | 'day', confirmed: boolean) => updateNutrition(current => withMealLoggingConfirmation(current, date, slot, confirmed)), [updateNutrition]);
  const setNutritionMealStatus = useCallback((date: string, slot: MealSlot, status: 'not_eaten' | 'unrecorded') => updateNutrition(current => withMealStatus(current, date, slot, status)), [updateNutrition]);
  const applyNutritionMealDraft = useCallback((draft: MealAdjustmentDraft) => updateNutrition(async current => {
    // A pending profile/course save must finish before accepting an old preview.
    await Promise.all([pendingAccount.current, pendingJournal.current]);
    if (!profileRef.current) throw new Error('个人资料已变化，请重新打开饮食页。');
    const date = localWeightDate(new Date());
    if (draft.date !== date) throw new Error('日期已变化，请回到今天并重新生成草案。');
    const effective = effectiveTrainingProfile(profileRef.current, current.assistant)!;
    const training = getNutritionTrainingContext(effective, journal.current.sessions, effectiveDailyEdits(journal.current.edits, effective), date);
    return withAppliedMealDraft(current, effective, training, draft);
  }), [updateNutrition]);
  const resetNutritionMeal = useCallback((date: string, slot: MealSlot) => updateNutrition(current => withoutMealOverride(current, date, slot)), [updateNutrition]);

  const exportData = useCallback(
    async () => {
      await Promise.all([pendingJournal.current, pendingNutrition.current, pendingAccount.current]);
      let archive: AssistantConversation[] = [];
      let archiveError: string | undefined;
      try { await initializeArchive(); archive = await assistantArchive.exportAll(); }
      catch (error) { archiveError = error instanceof Error ? error.message : '助手归档暂不可导出。'; }
      return JSON.stringify({ formatVersion: '2.3-mobile', exportDate: new Date().toISOString(), data: { user_profile: profileRef.current, sessions: journal.current.sessions, settings: settingsRef.current, daily_workout_edits: journal.current.edits, nutrition_journal_v1: JSON.parse(persistedNutrition(nutritionRef.current)), assistant_archive_v2: archive }, ...(archiveError ? { assistantArchiveError: archiveError } : {}),
      ...(Object.keys(recoveryRaw.current).length || Object.keys(issuesRef.current).length ? { recovery: { raw: { ...recoveryRaw.current }, issues: { ...issuesRef.current }, ...(recoveryRaw.current[KEYS.nutrition] ? { nutritionRaw: recoveryRaw.current[KEYS.nutrition] } : {}) } } : {}) }, null, 2);
    },
    [profile, sessions, settings, dailyEdits, nutritionJournal],
  );

  const clearData = useCallback(async () => {
    if (loading.current || reloading.current || clearing.current) throw new Error('正在处理本地数据，请稍后重试。');
    clearing.current = true;
    try {
      await Promise.all([pendingJournal.current, pendingNutrition.current, pendingAccount.current]);
      const photos = referencedPhotoIds(nutritionRef.current);
      await resetAgentConnection();
      const archived = await assistantArchive.exportAll();
      await assistantArchive.clear();
      try { await AsyncStorage.multiRemove(Object.values(KEYS)); }
      catch (error) {
        try { for (const turn of archived) await assistantArchive.put(turn); }
        catch { throw new Error('清除未完成，助手历史恢复也失败；请导出备份核对。'); }
        throw error;
      }
      setProfile(null);
      profileRef.current = null;
      setSessions([]);
      setSettings(defaultSettings);
      settingsRef.current = defaultSettings;
      journal.current = { sessions: [], edits: {} };
      setDailyEdits({});
      nutritionRef.current = emptyNutritionJournal();
      recoveryRaw.current = {};
      issuesRef.current = {};
      setStorageIssues({});
      setNutritionStorageIssue('');
      setNutritionJournal(nutritionRef.current);
      if (photos.length) { try { const { deleteStoredPhotos } = await import('../nutrition/photoStorage'); await deleteStoredPhotos(photos); } catch { console.warn('记录已清除，但本机照片清理未完成。'); } }
    } finally {
      clearing.current = false;
    }
  }, []);

  const assistantMethods = { readAssistantHistory, setAssistantAuthorization, savePersonalTrainingProfile, executeAssistantOperation, setNutritionMealStatus };
  const value = useMemo(() => ({ ...assistantMethods, ready, profile, sessions, settings, dailyEdits, nutritionJournal, nutritionStorageIssue, storageIssues, retryStorageLoading, setPhotoConsent, setAssistantConsent, appendAssistantConversation, saveAssistantFact, deleteAssistantFact, clearAssistantHistory, saveNutritionPreferences, saveIntakeEntry, deleteIntakeEntry, setPlannedMealRevision, saveCustomFood, deleteCustomFood, captureNutritionTarget, confirmNutritionLogging, applyNutritionMealDraft, resetNutritionMeal, saveProfile, patchProfile, switchTrainingGoal, saveSession, deleteSession, addDailyExercise, removeDailyExercise, resetTrainingDay, updateSettings, exportData, clearData }), [ready, profile, sessions, settings, dailyEdits, nutritionJournal, nutritionStorageIssue, storageIssues, retryStorageLoading, setPhotoConsent, setAssistantConsent, appendAssistantConversation, saveAssistantFact, deleteAssistantFact, clearAssistantHistory, saveNutritionPreferences, saveIntakeEntry, deleteIntakeEntry, setPlannedMealRevision, saveCustomFood, deleteCustomFood, captureNutritionTarget, confirmNutritionLogging, applyNutritionMealDraft, resetNutritionMeal, saveProfile, patchProfile, switchTrainingGoal, saveSession, deleteSession, addDailyExercise, removeDailyExercise, resetTrainingDay, updateSettings, exportData, clearData, readAssistantHistory, setAssistantAuthorization, savePersonalTrainingProfile, executeAssistantOperation, setNutritionMealStatus]);
  const exposedValue = useMemo(() => {
    const projectedProfile = effectiveTrainingProfile(value.profile, value.nutritionJournal.assistant);
    return { ...value, setAgentPreferences, profile: projectedProfile, dailyEdits: effectiveDailyEdits(value.dailyEdits, projectedProfile) };
  }, [value, setAgentPreferences]);
  return <Store.Provider value={exposedValue}>{children}</Store.Provider>;
}

export function useAppStore() {
  const value = useContext(Store);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}
