import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, scanFromURLAsync, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { analyzeFoodPhoto, getNutritionServiceStatus, lookupFoodBarcode, readFoodLabel, type PhotoCaptureResult } from '../../nutrition/agentClient';
import { validFoodBarcode } from '../../nutrition/foodImport';
import type { CapturedNutritionPhoto } from '../../nutrition/photoStorage';
import { compressPhoto, removeOwnedCacheFile } from './foodPhoto';
import { AppGlyph } from '../AppGlyph';
import { useAppStore } from '../../store/AppStore';

export type FoodCaptureMode = 'food' | 'label' | 'barcode';
export type FoodCaptureResult = PhotoCaptureResult & { frame?: CapturedNutritionPhoto };
type Props = { initialMode?: FoodCaptureMode; packagingOnly?: boolean; onResult: (result: FoodCaptureResult) => void; onBusyChange?: (busy: boolean) => void };
type Phase = 'idle' | 'selecting' | 'processing' | 'analyzing';
const barcodeTypes: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'itf14'];
const modes: { value: FoodCaptureMode; label: string; hint: string }[] = [
  { value: 'food', label: '食物', hint: '让餐盘完整入镜' },
  { value: 'label', label: '营养标签', hint: '对准成分表，拍清表头与单位' },
  { value: 'barcode', label: '条码', hint: '对准商品条码，自动查询食品' },
];
const c = { paper: '#0D1114', card: '#1B2028', raised: '#222833', line: '#343C48', ink: '#F4F6FA', muted: '#A8B1BF', lime: '#C7F548' };
const isForeground = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive' && !(Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden);

// Every entry point uses this session. A mode change updates scanner props, not the camera instance.
export function FoodCaptureCamera({ initialMode = 'food', packagingOnly = false, onResult, onBusyChange }: Props) {
  const { nutritionJournal, setPhotoConsent } = useAppStore();
  const consent = !!nutritionJournal.photoConsentAt;
  const [mode, setMode] = useState(initialMode), [managingConsent, setManagingConsent] = useState(false), [savingConsent, setSavingConsent] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(isForeground), [cameraOn, setCameraOn] = useState(false), [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back'), [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle'), [error, setError] = useState(''), [barcode, setBarcode] = useState('');
  const [photo, setPhoto] = useState<CapturedNutritionPhoto | null>(null);
  const [checking, setChecking] = useState(true), [connected, setConnected] = useState(false);
  const camera = useRef<CameraView | null>(null), alive = useRef(true), foreground = useRef(isForeground());
  const generation = useRef(0), selection = useRef(0), working = useRef(false), consentWrite = useRef(false), lastScan = useRef('');
  const request = useRef<AbortController | null>(null), health = useRef<AbortController | null>(null);
  const callbacks = useRef({ onResult, onBusyChange }); callbacks.current = { onResult, onBusyChange };
  const currentMode = useRef(mode); currentMode.current = mode;
  const busy = phase !== 'idle', needsVision = mode !== 'barcode';
  const available = consent && active && !busy && !savingConsent;
  const valid = (ticket: number) => alive.current && foreground.current && ticket === generation.current;
  const setWorkPhase = (value: Phase) => { setPhase(value); callbacks.current.onBusyChange?.(value !== 'idle'); };
  const cancel = useCallback(() => { generation.current++; request.current?.abort(); request.current = null; working.current = false; }, []);
  const changeConsent = async (granted: boolean) => {
    if (consentWrite.current) return;
    consentWrite.current = true; setSavingConsent(true); setError('');
    if (!granted) {
      selection.current++; cancel(); setWorkPhase('idle'); setCameraOn(false); setReady(false); setTorch(false); setPhoto(null);
    }
    try {
      await setPhotoConsent(granted);
      if (alive.current) setManagingConsent(false);
    } catch {
      if (alive.current) setError('授权未能保存，请重试；保存成功前不会开始联网识别。');
    } finally {
      consentWrite.current = false;
      if (alive.current) setSavingConsent(false);
    }
  };
  const checkService = useCallback(async () => {
    health.current?.abort(); const controller = new AbortController(); health.current = controller; setChecking(true);
    try { const status = await getNutritionServiceStatus(controller.signal); if (alive.current && !controller.signal.aborted) setConnected(status.configured === true); }
    catch { if (alive.current && !controller.signal.aborted) setConnected(false); }
    finally { if (alive.current && !controller.signal.aborted) setChecking(false); }
  }, []);
  useEffect(() => {
    alive.current = true; void checkService();
    const changed = () => {
      foreground.current = isForeground(); if (!alive.current) return; setActive(foreground.current);
      if (!foreground.current) {
        // Native image pickers can temporarily background the app; their result is guarded separately.
        cancel(); health.current?.abort(); setChecking(false); setCameraOn(false); setReady(false); setTorch(false);
        setPhase('idle'); callbacks.current.onBusyChange?.(false);
      }
    };
    const subscription = AppState.addEventListener('change', changed);
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', changed);
    return () => { alive.current = false; selection.current++; cancel(); health.current?.abort(); subscription.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', changed); };
  }, [cancel, checkService]);
  const finish = (ticket: number) => { if (valid(ticket)) { working.current = false; request.current = null; setWorkPhase('idle'); } };
  const deliver = (result: FoodCaptureResult, ticket: number) => {
    if (!valid(ticket)) return;
    setCameraOn(false); setReady(false); setTorch(false); setError(''); finish(ticket); callbacks.current.onResult(result);
  };
  const changeMode = (value: FoodCaptureMode) => {
    if (currentMode.current === value) return;
    currentMode.current = value; selection.current++; cancel(); setWorkPhase('idle'); setMode(value); setPhoto(null); setError(''); lastScan.current = '';
    // Keep the active CameraView mounted and consent intact.
  };
  const enableCamera = async () => {
    if (!available || working.current) return; setError(''); const ticket = generation.current;
    try {
      if (Platform.OS === 'web' && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) throw new Error('网页相机需要 HTTPS 或 localhost，也可从相册选择。');
      const granted = permission?.granted || (await requestPermission()).granted;
      if (!valid(ticket)) return;
      if (!granted) throw new Error('相机权限未开放，请允许相机权限，或从相册选择。');
      if (Platform.OS === 'web' && !(await CameraView.isAvailableAsync())) throw new Error('未发现可用相机，请从相册选择。');
      if (valid(ticket)) { setPhoto(null); setReady(false); setCameraOn(true); }
    } catch (reason) { if (valid(ticket)) setError(reason instanceof Error ? reason.message : '相机无法启动，请从相册选择。'); }
  };
  const lookup = async (value: string, scanned = false) => {
    const code = value.trim();
    if (!available || !alive.current || !foreground.current || working.current || !validFoodBarcode(code) || (scanned && (currentMode.current !== 'barcode' || lastScan.current === code))) return;
    lastScan.current = code; setBarcode(code); setError(''); working.current = true;
    const ticket = ++generation.current, controller = new AbortController(); request.current = controller; setWorkPhase('analyzing');
    try { const draft = await lookupFoodBarcode(code, controller.signal); if (!controller.signal.aborted) deliver({ kind: 'label', draft }, ticket); }
    catch (reason) { if (valid(ticket)) setError(reason instanceof Error ? reason.message : '未查到该商品，请切换营养标签或重试。'); }
    finally { finish(ticket); }
  };
  const analyze = async (frame: CapturedNutritionPhoto, ticket: number, captureMode: FoodCaptureMode) => {
    if (!valid(ticket)) return;
    const controller = new AbortController(); request.current = controller; setWorkPhase('analyzing');
    if (captureMode === 'label') {
      const draft = await readFoodLabel(frame.dataUrl, controller.signal);
      if (!controller.signal.aborted) deliver({ kind: 'label', draft, frame: { ...frame, kind: 'label' } }, ticket);
    } else {
      const result = await analyzeFoodPhoto(frame.dataUrl, controller.signal);
      if (!controller.signal.aborted) deliver({ ...result, frame: { ...frame, kind: result.kind === 'label' ? 'label' : 'food' } }, ticket);
    }
  };
  const processImage = async (image: { uri: string }, ticket: number, captureMode: FoodCaptureMode) => {
    if (!valid(ticket)) return; setWorkPhase('processing');
    if (captureMode === 'barcode') {
      if (Platform.OS === 'ios') throw new Error('请直接对准商品条码自动扫描，或在下方输入条码。iPhone 不支持从照片读取商品条码。');
      const results = await scanFromURLAsync(image.uri, barcodeTypes); if (!valid(ticket)) return;
      const code = results.find(result => barcodeTypes.includes(result.type as BarcodeType) && validFoodBarcode(result.data))?.data;
      if (!code) throw new Error('照片中未找到清晰的商品条码，可重新拍摄、输入条码或切换营养标签。');
      finish(ticket); await lookup(code); return;
    }
    const dataUrl = await compressPhoto(image, 2048); if (!valid(ticket)) return;
    const next = { dataUrl, capturedAt: Date.now() }; setPhoto(next); await analyze(next, ticket, captureMode);
  };
  const capture = async () => {
    if (!available || !camera.current || !ready || working.current || (needsVision && !connected)) return;
    if (mode === 'barcode' && Platform.OS === 'ios') { setError('对准商品条码即可自动扫描，也可在下方输入条码。'); return; }
    const ticket = ++generation.current, captureMode = mode; working.current = true; setWorkPhase('processing'); setError('');
    let ownedUri: string | undefined;
    try {
      const image = await camera.current.takePictureAsync({ quality: .9, exif: false, shutterSound: true }); ownedUri = image?.uri;
      if (!image || !valid(ticket)) return;
      setCameraOn(false); setReady(false); setTorch(false); await processImage(image, ticket, captureMode);
    } catch (reason) { if (valid(ticket)) setError(reason instanceof Error ? reason.message : '未能处理照片，请重拍。'); }
    finally { if (ownedUri) removeOwnedCacheFile(ownedUri); finish(ticket); }
  };
  const pickPhoto = async () => {
    if (!available || working.current || (needsVision && !connected)) return;
    cancel(); setCameraOn(false); setReady(false); setTorch(false); setError('');
    const ownSelection = ++selection.current, captureMode = mode; working.current = true; setWorkPhase('selecting'); let ticket: number | undefined;
    try {
      const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: false, exif: false, quality: 1 });
      if (!alive.current || ownSelection !== selection.current || picked.canceled || !picked.assets[0]) return;
      if (!foreground.current) throw new Error('应用已暂停，请返回后重新选择照片。');
      ticket = ++generation.current; working.current = true; await processImage(picked.assets[0], ticket, captureMode);
    } catch (reason) { if (alive.current && ownSelection === selection.current && (ticket === undefined || valid(ticket))) setError(reason instanceof Error ? reason.message : '无法读取照片，请重试。'); }
    finally { if (ticket !== undefined) finish(ticket); else if (alive.current && ownSelection === selection.current) { working.current = false; setWorkPhase('idle'); } }
  };
  const retry = async () => {
    if (!photo || !available || !connected || working.current) return;
    const ticket = ++generation.current; working.current = true; setError('');
    try { await analyze(photo, ticket, mode); } catch (reason) { if (valid(ticket)) setError(reason instanceof Error ? reason.message : '识别未完成，请重试。'); } finally { finish(ticket); }
  };
  const shutterDisabled = !available || (cameraOn && (!ready || (needsVision && !connected)));
  return <View style={s.root}>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.modes}>{modes.filter(item => !packagingOnly || item.value !== 'food').map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: mode === item.value }} onPress={() => changeMode(item.value)} style={[s.mode, mode === item.value && s.selected]}><Text style={[s.modeText, mode === item.value && s.selectedText]}>{item.label}</Text></Pressable>)}</View>
      <View style={s.preview}>
        {cameraOn && active ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} enableTorch={torch} onCameraReady={() => setReady(true)} onMountError={() => { setCameraOn(false); setReady(false); setError('相机启动失败，请从相册选择或输入条码。'); }} barcodeScannerSettings={{ barcodeTypes }} onBarcodeScanned={mode === 'barcode' && available ? result => { if (barcodeTypes.includes(result.type as BarcodeType) && validFoodBarcode(result.data)) void lookup(result.data, true); } : undefined} />
          : photo ? <Image source={{ uri: photo.dataUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel="待识别的照片" /> : <View style={s.empty}><AppGlyph name="camera" size={48} color={c.muted} /><Text style={s.hint}>{consent ? '点击下方快门开启相机' : '食物、标签、条码 · 一处拍摄'}</Text></View>}
        <View pointerEvents="none" style={[s.brackets, mode === 'barcode' && s.barcodeFrame]}>{(['tl', 'tr', 'bl', 'br'] as const).map(corner => <View key={corner} style={[s.corner, s[corner]]} />)}</View>
        <Text pointerEvents="none" style={s.cameraHint}>{modes.find(item => item.value === mode)?.hint}</Text>
        {cameraOn && Platform.OS !== 'web' ? <Pressable accessibilityRole="button" accessibilityLabel={torch ? '关闭补光灯' : '开启补光灯'} onPress={() => setTorch(value => !value)} style={s.flash}><AppGlyph name="flash" color={torch ? c.lime : c.ink} /></Pressable> : null}
        {busy ? <View style={s.processing}><ActivityIndicator color={c.lime} /><Text style={s.text}>{phase === 'analyzing' ? mode === 'barcode' ? '正在查询食品…' : mode === 'label' ? '正在读取标签…' : '正在识别食材…' : '正在处理照片…'}</Text></View> : null}
      </View>
      {!consent ? <View style={s.card}><Text style={s.hint}>识别时，照片发给营养服务与 AI 提供方；条码经服务查询 Open Food Facts。不发送饮食历史，不自动保存照片。</Text><Action label={savingConsent ? '保存授权中…' : '同意联网，开始拍摄'} primary disabled={savingConsent} onPress={() => void changeConsent(true)} /></View> : <>
        {needsVision && (checking || !connected) ? checking ? <Text style={s.hint}>正在连接营养服务…</Text> : <Action label="营养服务未连接 · 重试" onPress={() => void checkService()} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="管理拍照联网授权" disabled={busy || savingConsent} onPress={() => setManagingConsent(value => !value)} style={s.consentLink}><Text style={s.hint}>管理联网授权</Text></Pressable>
        {managingConsent ? <View style={s.card}><Text style={s.hint}>已同意照片上传识别和条码联网查询。撤回后，下次使用需重新同意。</Text><Action label={savingConsent ? '保存中…' : '撤回拍照联网授权'} disabled={savingConsent} onPress={() => void changeConsent(false)} /></View> : null}
      </>}
      {mode === 'barcode' ? <View style={s.card}><View style={s.barcodeRow}><TextInput accessibilityLabel="商品条码" placeholder="扫不到？输入商品条码" placeholderTextColor={c.muted} value={barcode} onChangeText={setBarcode} editable={!busy} keyboardType="number-pad" maxLength={14} style={s.input} /><Action label="查询商品条码" text="查询" disabled={!available || !validFoodBarcode(barcode.trim())} onPress={() => void lookup(barcode)} /></View><Text style={s.hint}>查不到可切换营养标签 · 结果需核对包装</Text></View> : <Text style={s.centerHint}>{mode === 'label' ? '拍清标签，再核对数值与食用量' : '拍完再核对食材与份量'}</Text>}
      {photo && !busy ? <Action label="重新识别这张照片" onPress={() => void retry()} disabled={!available || !connected} /> : null}
      {permission?.status === 'denied' && !permission.canAskAgain && Platform.OS !== 'web' ? <Action label="打开相机权限设置" onPress={() => void Linking.openSettings()} /> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </ScrollView>
    <View style={s.footer}>
      <Pressable accessibilityRole="button" accessibilityLabel="从相册选择" disabled={!available || (needsVision && !connected) || (mode === 'barcode' && Platform.OS === 'ios')} onPress={() => void pickPhoto()} style={[s.footerButton, (!available || (needsVision && !connected) || (mode === 'barcode' && Platform.OS === 'ios')) && s.disabled]}><AppGlyph name="image" size={24} color={c.ink} /><Text style={s.hint}>相册</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={cameraOn ? '拍摄照片' : '开启相机'} disabled={shutterDisabled} onPress={() => void (cameraOn ? capture() : enableCamera())} style={[s.shutter, shutterDisabled && s.disabled]}><View style={s.shutterInner} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="切换前后摄像头" disabled={!available || !cameraOn} onPress={() => { setReady(false); setTorch(false); setFacing(value => value === 'back' ? 'front' : 'back'); }} style={[s.footerButton, (!available || !cameraOn) && s.disabled]}><AppGlyph name="refresh" size={24} color={c.ink} /><Text style={s.hint}>翻转</Text></Pressable>
    </View>
  </View>;
}
function Action({ label, text = label, onPress, disabled, primary }: { label: string; text?: string; onPress: () => void; disabled?: boolean; primary?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.button, primary && s.primary, disabled && s.disabled]}><Text style={[s.text, primary && s.primaryText]}>{text}</Text></Pressable>; }
const s = StyleSheet.create({
  root: { flex: 1 }, scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 12 },
  modes: { flexDirection: 'row', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 4, gap: 4 }, mode: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, modeText: { color: c.muted, fontSize: 13, fontWeight: '700' }, selected: { backgroundColor: c.lime }, selectedText: { color: c.paper },
  preview: { width: '100%', aspectRatio: .95, backgroundColor: c.card, borderRadius: 20, overflow: 'hidden' }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  brackets: { position: 'absolute', top: '12%', left: '9%', right: '9%', bottom: '16%' }, barcodeFrame: { top: '32%', bottom: '32%' }, corner: { position: 'absolute', width: 28, height: 28, borderColor: c.lime }, tl: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 9 }, tr: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 9 }, bl: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 9 }, br: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 9 },
  cameraHint: { position: 'absolute', bottom: 18, alignSelf: 'center', color: c.ink, fontSize: 12, backgroundColor: 'rgba(0,0,0,.6)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 }, flash: { position: 'absolute', right: 12, top: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(0,0,0,.6)' },
  processing: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,.65)', alignItems: 'center', justifyContent: 'center', gap: 12 }, card: { padding: 12, gap: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 16 }, hint: { color: c.muted, fontSize: 11, lineHeight: 17 }, centerHint: { color: c.muted, fontSize: 11, textAlign: 'center' },
  consentLink: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 2 },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, input: { flex: 1, minWidth: 0, color: c.ink, minHeight: 44, padding: 10, borderWidth: 1, borderColor: c.line, borderRadius: 10, backgroundColor: c.raised },
  button: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card }, text: { color: c.ink, fontSize: 13, fontWeight: '700' }, primary: { backgroundColor: c.lime, borderColor: c.lime }, primaryText: { color: c.paper }, disabled: { opacity: .4 }, error: { color: '#FFADAB', backgroundColor: '#35252B', padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderColor: c.line, paddingHorizontal: 16, paddingVertical: 14 }, footerButton: { minWidth: 56, minHeight: 56, gap: 5, alignItems: 'center', justifyContent: 'center' }, shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, borderColor: c.ink, padding: 5 }, shutterInner: { flex: 1, borderRadius: 32, backgroundColor: c.lime },
});
