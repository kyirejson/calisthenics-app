import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../components/ui';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { TrainingSession } from '../types';
import { showMessage } from '../utils/confirm';

type Point = { latitude: number; longitude: number };

export function RunScreen({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const { profile, saveSession } = useAppStore();
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const watch = useRef<Location.LocationSubscription | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const startedAt = useRef<Date | null>(null);
  const statusRef = useRef<'idle' | 'running' | 'paused'>('idle');

  useEffect(() => () => watch.current?.remove(), []);
  useEffect(() => { if (status !== 'running') return; const id = setInterval(() => setElapsed((v) => v + 1), 1000); return () => clearInterval(id); }, [status]);

  const begin = async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    if (result.status !== 'granted') { setPermission('denied'); showMessage('需要定位权限', '开启定位后才能计算跑步距离和实时配速。'); return; }
    setPermission('granted'); startedAt.current = new Date(); statusRef.current = 'running'; setStatus('running');
    watch.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 3 }, (location) => {
      if (statusRef.current !== 'running' || (location.coords.accuracy ?? 999) > 35) return;
      const next = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      if (lastPoint.current) setDistance((value) => value + haversine(lastPoint.current!, next));
      lastPoint.current = next;
    });
  };
  const togglePause = () => {
    const nextStatus = statusRef.current === 'running' ? 'paused' : 'running';
    statusRef.current = nextStatus;
    lastPoint.current = null;
    setStatus(nextStatus);
  };
  const finish = async () => {
    statusRef.current = 'paused';
    watch.current?.remove(); watch.current = null;
    const km = distance / 1000; const calories = Math.round((profile?.weight || 65) * km * 1.02);
    const session: TrainingSession = { id: `run_${Date.now()}`, workoutId: 'outdoor_run', workoutName: '户外跑步', startedAt: (startedAt.current || new Date()).toISOString(), completedAt: new Date().toISOString(), durationSeconds: elapsed, exercises: [], totalReps: 0, kind: 'running', distanceKm: Number(km.toFixed(2)), calories };
    await saveSession(session); onComplete();
  };
  const km = distance / 1000; const paceSeconds = km > 0.03 ? elapsed / km : 0;

  return <LinearGradient colors={['#151712', '#252A1D']} style={styles.gradient}><SafeAreaView style={styles.safe}>
    <View style={styles.top}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.title}>户外跑步</Text><View style={{ width: 42 }} /></View>
    <View style={styles.signal}><View style={[styles.signalDot, permission === 'granted' && { backgroundColor: colors.lime }]} /><Text style={styles.signalText}>{permission === 'granted' ? 'GPS 已连接' : permission === 'denied' ? 'GPS 未授权' : '等待开始'}</Text></View>
    <View style={styles.main}><Text style={styles.distance}>{km.toFixed(2)}</Text><Text style={styles.distanceUnit}>公里</Text><View style={styles.stats}><RunMetric label="用时" value={formatTime(elapsed)} /><View style={styles.statLine} /><RunMetric label="平均配速" value={paceSeconds ? `${Math.floor(paceSeconds / 60)}′${String(Math.floor(paceSeconds % 60)).padStart(2, '0')}″` : `--′--″`} /><View style={styles.statLine} /><RunMetric label="预计消耗" value={`${Math.round((profile?.weight || 65) * km * 1.02)} kcal`} /></View></View>
    <View style={styles.controls}>{status === 'idle' ? <Button label="开始记录" variant="lime" onPress={() => void begin()} /> : <View style={styles.controlRow}><Pressable onPress={togglePause} style={styles.roundSecondary}><Text style={styles.roundText}>{status === 'running' ? '暂停' : '继续'}</Text></Pressable><Pressable onPress={() => void finish()} style={styles.roundPrimary}><Text style={styles.finishIcon}>■</Text><Text style={styles.finishText}>结束</Text></Pressable></View>}<Text style={styles.note}>请在安全环境中运动，跑步时不要操作手机</Text></View>
  </SafeAreaView></LinearGradient>;
}

function RunMetric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function formatTime(s: number) { return `${String(Math.floor(s / 3600)).padStart(2,'0')}:${String(Math.floor((s % 3600) / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`; }
function haversine(a: Point, b: Point) { const rad = Math.PI / 180; const dLat = (b.latitude - a.latitude) * rad; const dLon = (b.longitude - a.longitude) * rad; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
const styles = StyleSheet.create({
  gradient: { flex: 1 }, safe: { flex: 1 }, top: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2F322B', alignItems: 'center', justifyContent: 'center' }, backText: { color: '#FFFFFF', fontSize: 34, lineHeight: 37 }, title: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 }, signal: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2D26', paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill }, signalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#777A71', marginRight: 7 }, signalText: { color: '#BFC2B8', fontSize: 11, fontWeight: '700' }, main: { flex: 1, alignItems: 'center', justifyContent: 'center' }, distance: { color: '#FFFFFF', fontSize: 92, lineHeight: 101, letterSpacing: -5, fontWeight: '900' }, distanceUnit: { color: colors.lime, fontSize: 14, fontWeight: '900', letterSpacing: 2 }, stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginHorizontal: 24, marginTop: 55 }, metric: { flex: 1, alignItems: 'center' }, metricValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' }, metricLabel: { color: '#979A91', fontSize: 10, marginTop: 7 }, statLine: { width: 1, height: 36, backgroundColor: '#3A3D35' }, controls: { padding: 24, paddingBottom: 22 }, controlRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 30 }, roundSecondary: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#34372F', alignItems: 'center', justifyContent: 'center' }, roundText: { color: '#FFFFFF', fontWeight: '900' }, roundPrimary: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, finishIcon: { color: colors.ink, fontSize: 14 }, finishText: { color: colors.ink, fontWeight: '900', marginTop: 4 }, note: { color: '#777A71', fontSize: 10, textAlign: 'center', marginTop: 22 },
});
