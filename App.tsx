import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { TabBar, type TabKey } from './src/components/TabBar';
import { AppStoreProvider, useAppStore } from './src/store/AppStore';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetailScreen';
import { ExercisesScreen } from './src/screens/ExercisesScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PlansScreen } from './src/screens/PlansScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { RunScreen } from './src/screens/RunScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';
import { colors } from './src/theme';
import type { Route } from './src/types';

export default function App() {
  return <AppStoreProvider><StatusBar style="dark" /><AppShell /></AppStoreProvider>;
}

function AppShell() {
  const { ready, profile } = useAppStore();
  const [tab, setTab] = useState<TabKey>('today');
  const [route, setRoute] = useState<Route>({ name: 'tabs' });
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.ink} size="large" /></View>;
  if (!profile) return <><StatusBar style="light" /><OnboardingScreen /></>;

  if (route.name === 'exercise') return <ExerciseDetailScreen exerciseId={route.exerciseId} onBack={() => setRoute({ name: 'tabs' })} onStart={(workoutId) => setRoute({ name: 'training', workoutId })} />;
  if (route.name === 'training') return <><StatusBar style="light" /><TrainingScreen workoutId={route.workoutId} onBack={() => setRoute({ name: 'tabs' })} onComplete={() => { setTab('progress'); setRoute({ name: 'tabs' }); }} /></>;
  if (route.name === 'run') return <><StatusBar style="light" /><RunScreen onBack={() => setRoute({ name: 'tabs' })} onComplete={() => { setTab('progress'); setRoute({ name: 'tabs' }); }} /></>;
  if (route.name === 'plans') return <PlansScreen onBack={() => setRoute({ name: 'tabs' })} />;

  return <View style={styles.root}>
    {tab === 'today' ? <TodayScreen onStart={(workoutId) => setRoute({ name: 'training', workoutId })} onRun={() => setRoute({ name: 'run' })} onPlans={() => setRoute({ name: 'plans' })} /> : null}
    {tab === 'progress' ? <ProgressScreen /> : null}
    {tab === 'exercises' ? <ExercisesScreen onOpen={(exerciseId) => setRoute({ name: 'exercise', exerciseId })} /> : null}
    {tab === 'profile' ? <ProfileScreen onPlans={() => setRoute({ name: 'plans' })} /> : null}
    <TabBar active={tab} onChange={setTab} />
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.paper }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper } });
