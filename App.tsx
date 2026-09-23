import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { TabBar, type TabKey } from './src/components/TabBar';
import { AppStoreProvider, useAppStore } from './src/store/AppStore';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetailScreen';
import { NutritionScreen } from './src/screens/NutritionScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PlansScreen } from './src/screens/PlansScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { RunScreen } from './src/screens/RunScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';
import { colors } from './src/theme';
import type { Route } from './src/types';
import { confirmAction } from './src/utils/confirm';

export default function App() {
  return <AppStoreProvider><StatusBar style="dark" /><AppShell /></AppStoreProvider>;
}

function AppShell() {
  const { ready, profile } = useAppStore();
  const [tab, setTab] = useState<TabKey>('today');
  const [route, setRoute] = useState<Route>({ name: 'tabs' });

  const returnToTabs = useCallback(() => setRoute({ name: 'tabs' }), []);
  const returnFromActiveSession = useCallback(() => {
    if (route.name === 'training' && route.exerciseId) {
      setRoute({ name: 'exercise', exerciseId: route.exerciseId });
      return;
    }
    returnToTabs();
  }, [returnToTabs, route]);
  const leaveActiveSession = useCallback(() => {
    confirmAction('结束本次记录？', '尚未保存的训练内容会丢失。', returnFromActiveSession, {
      cancelLabel: '继续训练',
      confirmLabel: '结束并返回',
      destructive: true,
    });
  }, [returnFromActiveSession]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !ready) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!profile) {
        Alert.alert('退出涅槃？', '建立档案后即可生成个人训练计划。', [
          { text: '继续建档', style: 'cancel' },
          { text: '退出', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      }
      if (route.name === 'training' || route.name === 'run') {
        leaveActiveSession();
        return true;
      }
      if (route.name !== 'tabs') {
        returnToTabs();
        return true;
      }
      if (tab !== 'today') {
        setTab('today');
        return true;
      }
      Alert.alert('退出涅槃？', '确认结束本次使用吗？', [
        { text: '取消', style: 'cancel' },
        { text: '退出', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    });
    return () => subscription.remove();
  }, [leaveActiveSession, profile, ready, returnToTabs, route.name, tab]);

  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.ink} size="large" /></View>;
  if (!profile) return <><StatusBar style="light" /><OnboardingScreen /></>;

  if (route.name === 'exercise') return <><StatusBar style="light" /><ExerciseDetailScreen exerciseId={route.exerciseId} onBack={returnToTabs} onStart={(exerciseId) => setRoute({ name: 'training', workoutId: `single_${exerciseId}`, exerciseId })} /></>;
  if (route.name === 'training') return <><StatusBar style="light" /><TrainingScreen workoutId={route.workoutId} exerciseId={route.exerciseId} setMultiplier={route.setMultiplier} rirTarget={route.rirTarget} onBack={returnFromActiveSession} onComplete={() => { setTab('progress'); returnToTabs(); }} /></>;
  if (route.name === 'run') return <><StatusBar style="light" /><RunScreen onBack={leaveActiveSession} onComplete={() => { setTab('progress'); returnToTabs(); }} /></>;
  if (route.name === 'nutrition') return <NutritionScreen onBack={returnToTabs} />;

  return <View style={styles.root}>
    {tab === 'today' ? <TodayScreen onStart={(workoutId, setMultiplier, rirTarget) => setRoute({ name: 'training', workoutId, setMultiplier, rirTarget })} onRun={() => setRoute({ name: 'run' })} onPlans={() => setTab('plans')} onNutrition={() => setRoute({ name: 'nutrition' })} /> : null}
    {tab === 'plans' ? <PlansScreen /> : null}
    {tab === 'progress' ? <ProgressScreen onOpen={(exerciseId) => setRoute({ name: 'exercise', exerciseId })} /> : null}
    {tab === 'profile' ? <ProfileScreen onPlans={() => setTab('plans')} onNutrition={() => setRoute({ name: 'nutrition' })} /> : null}
    <TabBar active={tab} onChange={setTab} />
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.paper }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper } });
