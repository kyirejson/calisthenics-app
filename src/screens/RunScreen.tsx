import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppGlyph } from '../components/AppGlyph';
import { useAppStore } from '../store/AppStore';
import { useRunRecorder } from '../running/RunRecorderHost';
import { RunMap } from '../running/RunMap';
import { RunFocus, runGoals } from '../running/RunFocus';
import { RunRecordDetail } from '../running/RunRecordDetail';
import { RunOptionsPanel } from '../running/RunOptionsPanel';
import { mapPosition } from '../running/locationStatus';
import { paceLabel, runClock, usablePoint, runMeasurement, type RunMode } from '../running/model';
import { appPalette as c } from '../theme';
import { confirmAction } from '../utils/confirm';

export function RunScreen({ visible }: { visible: boolean }) {
  const run = useRunRecorder(), { sessions } = useAppStore(state => ({ sessions: state.sessions }));
  const [height, setHeight] = useState(650), [width, setWidth] = useState(390);
  const [chosenMode, setChosenMode] = useState<RunMode>('outdoor'), [distanceOpen, setDistanceOpen] = useState(false), [manualDistance, setManualDistance] = useState(''), [distanceError, setDistanceError] = useState('');
  const [focus, setFocus] = useState(false), [goalOpen, setGoalOpen] = useState(false), [goalIndex, setGoalIndex] = useState(0), [countdown, setCountdown] = useState<number | null>(null), [receiptId, setReceiptId] = useState<string | null>(null);
  const lastActiveId = useRef<string | undefined>(undefined);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { snapshot, analysis } = run;
  const receipt = sessions.find(session => session.id === receiptId);
  useEffect(() => {
    if (snapshot.phase !== 'idle') { lastActiveId.current = snapshot.id; return; }
    if (lastActiveId.current && sessions.some(session => session.id === lastActiveId.current)) {
      setReceiptId(lastActiveId.current); setFocus(false); lastActiveId.current = undefined;
    }
  }, [snapshot.phase, snapshot.id, sessions]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { setCountdown(null); void run.start(chosenMode); return; }
    const timer = setTimeout(() => setCountdown(value => value === null ? null : value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, chosenMode]);
  useEffect(() => { if (!visible) { setCountdown(null); setFocus(false); } }, [visible]);
  const active = snapshot.phase !== 'idle', recording = snapshot.phase === 'running', paused = snapshot.phase === 'paused', pendingSave = snapshot.phase === 'finished';
  const indoor = (active ? snapshot.mode : chosenMode) === 'indoor';
  const fresh = usablePoint(snapshot.preview) && (snapshot.preview?.ageMs ?? 16000) <= 15000;
  const status = run.busy ? '正在处理…' : run.location.title;
  const currentPace = indoor ? recording ? snapshot.stepCurrentPace : null : recording && fresh && analysis.lastPoint && snapshot.elapsedMs - analysis.lastPoint.elapsedMs < 15000 ? analysis.currentPace : null;
  const measurement = runMeasurement(snapshot, analysis);
  const averagePace = measurement.averagePace;
  const distanceText = measurement.distanceKm === undefined ? '—' : measurement.distanceKm.toFixed(2);
  const distanceFont = Math.floor(Math.max(26, Math.min(height < 600 ? 42 : 56, ((width - 48) * 1.3 / 3.3 - 8) / (distanceText.length * 0.6))));
  useEffect(() => { if (!visible) run.stopPreview(); return run.stopPreview; }, [visible, run.stopPreview]);
  const retryLocation = () => {
    if (!run.location.settings || Platform.OS === 'web') { void run.locate(); return; }
    const open = Platform.OS === 'android' && snapshot.location?.enabled === false && snapshot.location.permission
      ? Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS') : Linking.openSettings();
    void open.catch(() => undefined);
  };
  const finish = () => {
    if (indoor) {
      void (async () => { if (recording && !await run.pause()) return; setManualDistance(''); setDistanceError(''); setDistanceOpen(true); })();
      return;
    }
    void confirmAction('结束并保存跑步？', '保存用时和已测得的路段；未定位的距离不会编造。暂停时间不计入跑步。', () => { void run.save(); }, { confirmLabel: '结束并保存' });
  };
  const saveIndoor = () => {
    const value = manualDistance.trim(), distance = value === '' ? undefined : Number(value);
    if (value && (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(distance) || distance! < 0 || distance! > 1000)) { setDistanceError('请输入 0–1000 公里，或留空只保存用时。'); return; }
    setDistanceOpen(false); void run.save(distance);
  };
  return <View testID="running-screen" style={s.root} onLayout={event => { setHeight(event.nativeEvent.layout.height); setWidth(event.nativeEvent.layout.width); }}>
    <View style={s.head}>
      <View style={s.headLabel}><Text style={s.title}>跑步</Text>
        <View style={s.modeSwitch}>{(['outdoor', 'indoor'] as const).map(mode => <Pressable key={mode} accessibilityRole="button" accessibilityLabel={mode === 'outdoor' ? '选择户外跑' : '选择室内跑'} disabled={active} accessibilityState={{ selected: (active ? snapshot.mode : chosenMode) === mode }} onPress={() => { setChosenMode(mode); run.stopPreview(); }} style={[s.modeChoice, (active ? snapshot.mode : chosenMode) === mode && s.modeSelected]}><Text style={[s.modeChoiceText, (active ? snapshot.mode : chosenMode) === mode && { color: c.onLime }]}>{mode === 'outdoor' ? '户外' : '室内'}</Text></Pressable>)}</View>
      </View>
      <View style={s.headActions}>
        <Pressable accessibilityRole="switch" accessibilityLabel={snapshot.options?.voice !== false ? '关闭跑步语音播报' : '开启跑步语音播报'} accessibilityState={{ checked: snapshot.options?.voice !== false, disabled: run.busy || !run.ready }} disabled={run.busy || !run.ready} onPress={() => { void run.setVoice(snapshot.options?.voice === false); }} style={s.iconControl}><AppGlyph name={snapshot.options?.voice !== false ? 'speaker' : 'speakerOff'} size={23} color={snapshot.options?.voice !== false ? c.lime : c.muted} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="打开跑步设置" onPress={() => setOptionsOpen(true)} style={s.iconControl}><AppGlyph name="settings" size={22} color={c.muted} /></Pressable>
        {active ? <Pressable accessibilityRole="button" accessibilityLabel="进入跑步全屏" onPress={() => setFocus(true)} style={s.iconControl}><AppGlyph name="expand" size={20} color={c.muted} /></Pressable> : null}
      </View>
    </View>
    <ScrollView testID="running-page-content" showsVerticalScrollIndicator={false} style={s.body} contentContainerStyle={s.bodyContent}>
    <View style={[s.mapArea, height < 600 && { minHeight: 120 }]}>{indoor ? <View style={s.indoorArea}><AppGlyph name="run" size={50} color={c.lime} /><Text style={s.indoorTitle}>专注跑步，无需 GPS</Text><Text style={s.indoorHint}>跑步机 · 室内训练</Text><Text style={s.indoorHint}>{snapshot.options?.stepTracking ? `${snapshot.stepCount || 0} 步 · ${snapshot.options.stepLengthM ? '距离按校准步长估算' : '未校准步长，仅计步'}` : '先记录用时，结束后填写距离'}</Text></View> : visible && !focus ? <RunMap position={mapPosition(snapshot)} segments={analysis.segments} splits={analysis.splits} status={status} good={run.location.good} onLocate={() => { void run.locate(); }} interactive /> : null}</View>
    <View style={s.readout}>
      <View style={s.stats}>
        <View style={s.distance}><Text testID="run-distance" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.distanceValue, { fontSize: distanceFont, lineHeight: distanceFont + 9 }]}>{distanceText}</Text><Text style={s.distanceUnit}>公里</Text></View>
        <View style={s.metric}><Text testID="run-duration" numberOfLines={1} adjustsFontSizeToFit style={[s.metricValue, (width < 360 || snapshot.elapsedMs >= 3600000) && { fontSize: 16 }]}>{runClock(snapshot.elapsedMs)}</Text><Text style={s.caption}>用时</Text></View>
        <View style={s.metric}><Text testID="run-average-pace" numberOfLines={1} adjustsFontSizeToFit style={[s.metricValue, width < 360 && { fontSize: 16 }]}>{paceLabel(averagePace)}</Text><Text style={s.caption}>{measurement.source === 'steps' ? '估算平均配速 /km' : '平均配速 /km'}</Text></View>
      </View>
      <View style={s.mode}><AppGlyph name="run" size={20} color={c.text} /><Pressable accessibilityRole="button" accessibilityLabel="设置跑步目标" disabled={active} onPress={() => setGoalOpen(true)}><Text style={s.modeLabel}>{runGoals[goalIndex].label + (active ? '' : ' ▾')}</Text></Pressable>{active ? <Text testID="run-current-pace" accessibilityLabel={(indoor ? '估算' : '') + '当前配速 ' + paceLabel(currentPace)} style={s.currentPace}>{paceLabel(currentPace)}<Text style={s.caption}> /km</Text></Text> : null}<Text style={[s.modeHint, recording && { color: c.lime }]}>{active ? recording ? '正在跑步' : snapshot.autoPaused ? '已自动暂停' : paused ? '跑步已暂停' : '等待保存' : indoor ? measurement.source === 'steps' ? '计步估算 · 可手动校正' : '距离可手动填写' : '可直接开始计时'}</Text></View>
      {snapshot.autoPaused ? <Text style={s.endHint}>已自动暂停 · 重新跑动后自动继续，也可手动继续</Text> : null}
      {run.error || snapshot.interrupted || (!indoor && run.location.detail) ? <View style={s.issue} accessibilityRole="alert"><Text style={s.issueText}>{run.error || (snapshot.interrupted ? '上次记录已恢复为暂停，不计入 App 中断期间的时间。' : run.location.detail)}</Text>{!indoor ? <Pressable accessibilityRole="button" accessibilityLabel={run.location.settings && Platform.OS !== 'web' ? '打开系统定位设置' : '重试跑步定位'} onPress={retryLocation} style={s.settings}><Text style={s.settingsText}>{run.location.settings && Platform.OS !== 'web' ? '定位设置' : '重试定位'}</Text></Pressable> : null}</View> : null}
    </View>
    </ScrollView>
    <View style={s.dock} testID="run-control-dock">
      {!active ? <Pressable accessibilityRole="button" accessibilityLabel="开始跑步" disabled={run.busy || !run.ready} onPress={() => setCountdown(3)} style={({ pressed }) => [s.primary, s.start, pressed && s.pressed, (run.busy || !run.ready) && s.disabled]}>{run.busy ? <ActivityIndicator color={c.onLime} /> : <><Text style={s.play}>▶</Text><Text style={s.primaryText}>开始跑步</Text></>}</Pressable> : <View style={s.runControls}>
        <Pressable accessibilityRole="button" accessibilityLabel={pendingSave ? '重试保存跑步' : paused ? '继续跑步' : '暂停跑步'} disabled={run.busy} onPress={() => { void (pendingSave ? run.save() : paused ? run.resume() : run.pause()); }} style={({ pressed }) => [s.primary, pressed && s.pressed, run.busy && s.disabled]}>{run.busy ? <ActivityIndicator color={c.onLime} /> : <><AppGlyph name={recording ? 'pause' : pendingSave ? 'check' : 'run'} color={c.onLime} size={22} /><Text style={s.primaryText}>{pendingSave ? '重试保存' : paused ? '继续' : '暂停'}</Text></>}</Pressable>
        {!pendingSave ? <Pressable accessibilityRole="button" accessibilityLabel="结束并保存跑步" disabled={run.busy} onPress={finish} style={({ pressed }) => [s.end, pressed && s.pressed, run.busy && s.disabled]}><AppGlyph name="stop" size={20} color={c.text} /><Text style={s.endText}>结束</Text></Pressable> : null}
      </View>}
      {Platform.OS === 'web' ? <Text style={s.endHint}>浏览器仅支持前台记录；后台跑步请使用 Android 安装包</Text> : null}
    </View>
    <RunFocus visible={focus && active} goal={runGoals[goalIndex]} onClose={() => setFocus(false)} onFinish={finish} />
    <RunOptionsPanel visible={optionsOpen} onClose={() => setOptionsOpen(false)} />
    <Modal visible={goalOpen} transparent animationType="fade" onRequestClose={() => setGoalOpen(false)}><View style={s.formOverlay}><View style={s.distanceForm}><Text style={s.title}>本次跑步目标</Text>{runGoals.map((goal, index) => <Pressable key={goal.label} accessibilityRole="radio" accessibilityState={{ checked: goalIndex === index }} onPress={() => { setGoalIndex(index); setGoalOpen(false); }} style={s.goalChoice}><Text style={[s.historyText, goalIndex === index && { color: c.lime }]}>{goal.label}{goalIndex === index ? ' ✓' : ''}</Text></Pressable>)}<Text style={s.caption}>达成目标后可以继续跑，不会自动结束记录。</Text><Pressable accessibilityRole="button" accessibilityLabel="取消设置跑步目标" onPress={() => setGoalOpen(false)} style={s.close}><Text style={s.historyText}>取消</Text></Pressable></View></View></Modal>
    <Modal visible={countdown !== null} transparent onRequestClose={() => setCountdown(null)}><View style={s.countdown}><Text style={s.title}>准备开跑</Text><Text testID="run-countdown" style={s.countdownValue}>{countdown}</Text><Pressable accessibilityRole="button" accessibilityLabel="取消开始跑步" onPress={() => setCountdown(null)} style={s.close}><Text style={s.settingsText}>取消</Text></Pressable></View></Modal>
    <Modal visible={!!receipt} animationType="slide" onRequestClose={() => setReceiptId(null)}><View style={s.historyRoot}><View style={s.historyHeading}><Text style={s.title}>跑步已保存</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭跑步总结" onPress={() => setReceiptId(null)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View><ScrollView contentContainerStyle={s.historyContent}>{receipt ? <RunRecordDetail session={receipt} /> : null}</ScrollView></View></Modal>
    <Modal visible={distanceOpen} transparent animationType="fade" onRequestClose={() => setDistanceOpen(false)}><KeyboardAvoidingView style={s.formOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="always" keyboardDismissMode="none"><View style={s.distanceForm}><Text style={s.title}>保存室内跑</Text><Text style={s.caption}>{measurement.source === 'steps' ? `计步估算 ${distanceText} 公里。填写跑步机距离可覆盖估算，留空保留估算。` : '计时已暂停。可填写跑步机显示的公里数，也可留空只保存用时。'}</Text><TextInput accessibilityLabel="室内跑距离（公里，可选）" placeholder="例如 3.50" placeholderTextColor={c.muted} keyboardType="decimal-pad" value={manualDistance} onChangeText={value => { setManualDistance(value); setDistanceError(''); }} style={s.distanceInput} />{distanceError ? <Text accessibilityRole="alert" style={[s.issueText, { flex: 0 }]}>{distanceError}</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel="保存室内跑" onPress={saveIndoor} style={[s.primary, { flex: 0 }]}><Text style={s.primaryText}>保存记录</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="返回跑步" onPress={() => setDistanceOpen(false)} style={s.close}><Text style={s.historyText}>返回跑步</Text></Pressable></View></ScrollView></KeyboardAvoidingView></Modal>

  </View>;
}
const s = StyleSheet.create({
  headActions: { flexDirection: 'row', alignItems: 'center' }, iconControl: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, body: { flex: 1 }, bodyContent: { flexGrow: 1 },
  goalChoice: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: c.border }, countdown: { flex: 1, backgroundColor: '#0D1114F5', alignItems: 'center', justifyContent: 'center', gap: 30 }, countdownValue: { color: c.lime, fontSize: 110, fontWeight: '900' },
  root: { flex: 1, minHeight: 0, backgroundColor: c.background, width: '100%', maxWidth: 440, alignSelf: 'center', paddingBottom: 80 },
  modeSwitch: { flexDirection: 'row', gap: 3 }, modeChoice: { paddingHorizontal: 10, minHeight: 44, justifyContent: 'center', borderRadius: 9 }, modeSelected: { backgroundColor: c.lime }, modeChoiceText: { fontSize: 12, color: c.muted },
  indoorArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#17221E' }, indoorTitle: { fontSize: 18, fontWeight: '800', color: c.text }, indoorHint: { fontSize: 12, color: c.muted },
  formOverlay: { flex: 1, padding: 24, backgroundColor: '#000000AA' }, formContent: { flexGrow: 1, justifyContent: 'center' }, distanceForm: { alignSelf: 'center', width: '100%', maxWidth: 400, backgroundColor: c.card, padding: 22, borderRadius: 20, gap: 14 }, distanceInput: { color: c.text, fontSize: 24, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, minHeight: 56, borderTopWidth: 1, borderTopColor: '#27302E' }, headLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }, title: { fontSize: 18, lineHeight: 26, fontWeight: '800', color: c.text }, historyText: { color: c.text, fontSize: 12 },
  mapArea: { flex: 1, minHeight: 180, overflow: 'hidden', marginHorizontal: 16, borderRadius: 16 }, readout: { paddingHorizontal: 16 }, stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, minHeight: 94 }, distance: { flexDirection: 'column', alignItems: 'flex-start', flex: 1.3, minWidth: 0, marginRight: 9, gap: 3 }, distanceValue: { fontSize: 49, lineHeight: 58, fontWeight: '900', color: '#F6F8EF', letterSpacing: -1.4, fontVariant: ['tabular-nums'], flexShrink: 1 }, distanceUnit: { color: c.muted, fontSize: 12, lineHeight: 18 }, metric: { flex: 1, minWidth: 0, paddingLeft: 10, gap: 4, borderLeftWidth: 1, borderLeftColor: '#3D4845' }, metricValue: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }, caption: { fontSize: 10, lineHeight: 16, color: c.muted },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#27322F' }, modeLabel: { color: c.text, fontSize: 13, fontWeight: '700' }, currentPace: { color: c.lime, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }, modeHint: { marginLeft: 'auto', color: c.muted, fontSize: 10 },
  dock: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8 }, primary: { flex: 1, minHeight: 54, backgroundColor: c.lime, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, start: { marginRight: 66, flex: 0 }, primaryText: { color: c.onLime, fontSize: 19, lineHeight: 26, fontWeight: '800' }, play: { color: c.onLime, fontSize: 22 }, runControls: { flexDirection: 'row', gap: 12 }, end: { width: '35%', minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#71807D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, endText: { color: c.text, fontSize: 16, fontWeight: '700' }, endHint: { color: c.muted, fontSize: 9, lineHeight: 16, textAlign: 'right', marginTop: 5 }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 },
  issue: { paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }, issueText: { flex: 1, color: '#D8BD82', fontSize: 11, lineHeight: 16 }, settings: { padding: 5 }, settingsText: { color: c.lime, fontSize: 11 },
  historyRoot: { flex: 1, backgroundColor: c.background, paddingTop: 35 }, historyHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }, close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, closeText: { color: c.muted, fontSize: 29 }, historyContent: { padding: 20, gap: 12 },
});
