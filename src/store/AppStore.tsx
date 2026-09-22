import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Profile, Settings, TrainingSession } from '../types';

const KEYS = {
  profile: 'user_profile',
  sessions: 'sessions',
  settings: 'settings',
};

const defaultSettings: Settings = { vibration: true, restSeconds: 60, sound: true };

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
        if (map[KEYS.profile]) setProfile(JSON.parse(map[KEYS.profile]!));
        if (map[KEYS.sessions]) setSessions(JSON.parse(map[KEYS.sessions]!));
        if (map[KEYS.settings]) setSettings({ ...defaultSettings, ...JSON.parse(map[KEYS.settings]!) });
      })
      .catch((error) => console.warn('读取本地数据失败', error))
      .finally(() => setReady(true));
  }, []);

  const saveProfile = useCallback(async (next: Profile) => {
    setProfile(next);
    await AsyncStorage.setItem(KEYS.profile, JSON.stringify(next));
  }, []);

  const saveSession = useCallback(async (session: TrainingSession) => {
    setSessions((current) => {
      const next = [session, ...current.filter((item) => item.id !== session.id)];
      void AsyncStorage.setItem(KEYS.sessions, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void AsyncStorage.setItem(KEYS.settings, JSON.stringify(next));
      return next;
    });
  }, []);

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
