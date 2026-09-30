import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { askNutritionAgent, type AdviceContext, type AdviceTurn, type NutritionAdvice } from '../../nutrition/agentClient';
import type { MealAdjustmentDraft, MealDraftResult } from '../../nutrition/adjustments';
import type { NutritionAgentAction } from '../../nutrition/types';
import { shortAssistantReply, type AssistantIntent } from '../../nutrition/assistantState';
import { assistantFoodWarnings } from '../../nutrition/assistantFood';
import { FOODS } from '../../nutrition/catalog';
import { localWeightDate } from '../../data/weightTrend';
import { useAppStore } from '../../store/AppStore';
import { MealDraftContent } from './MealDraftPreview';
import { AssistantIntakeDraft } from './AssistantIntakeDraft';
import { useNutritionVoice } from './useNutritionVoice';
import { AppGlyph } from '../AppGlyph';
import { appPalette as c, progressPageLayout } from '../../theme';

type Message = { id: string; question: string; reply: NutritionAdvice; proposal?: MealDraftResult; date: string };
const factLabels = { like: '喜好', avoid: '忌口', need: '需求', allergy: '过敏' } as const;
export function NutritionAgentModal({ context, onPrepare, onApply, onClose }: {
  context: AdviceContext; onClose: () => void; onPrepare: (action: NutritionAgentAction) => MealDraftResult; onApply: (draft: MealAdjustmentDraft) => Promise<void>;
}) {
  const { nutritionJournal, setAssistantConsent, appendAssistantConversation, saveAssistantFact, deleteAssistantFact, clearAssistantHistory } = useAppStore();
  const assistant = nutritionJournal.assistant;
  const [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [view, setView] = useState<'chat' | 'memory'>('chat'), [gate, setGate] = useState<'send' | 'voice' | null>(null);
  const [referencesOpen, setReferencesOpen] = useState<string | null>(null), [confirmClear, setConfirmClear] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => assistant.conversations.map(t => ({ id: t.id, question: t.question, reply: { answer: shortAssistantReply(t.answer), sources: [] }, date: localWeightDate(new Date(t.createdAt)) })));
  const latest = useRef({ context, onPrepare, assistant }); latest.current = { context, onPrepare, assistant };
  const pending = useRef<AbortController | null>(null), mounted = useRef(true), mutating = useRef(false), scroll = useRef<ScrollView>(null);
  const voice = useNutritionVoice(text => setQuestion(text.slice(0, 1000)), setError);
  useEffect(() => {
    mounted.current = true;
    const changed = () => { if (AppState.currentState === 'background' || AppState.currentState === 'inactive' || (Platform.OS === 'web' && document.hidden)) pending.current?.abort(); };
    const sub = AppState.addEventListener('change', changed); if (Platform.OS === 'web') document.addEventListener('visibilitychange', changed);
    return () => { mounted.current = false; pending.current?.abort(); sub.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', changed); };
  }, []);
  const close = () => { if (mutating.current) return; mounted.current = false; pending.current?.abort(); voice.abort(); onClose(); };
  const mutate = async (operation: () => Promise<void>) => {
    if (mutating.current || pending.current) return; mutating.current = true; setBusy(true); setError('');
    try { await operation(); } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '保存失败，请重试。'); }
    finally { mutating.current = false; if (mounted.current) setBusy(false); }
  };
  const send = async (consented = false) => {
    const text = question.trim(); if (!text || pending.current || mutating.current || voice.listening) return;
    if (!consented && !latest.current.assistant.consentAt) { setGate('send'); return; }
    const controller = new AbortController(), requestContext = latest.current.context, signature = JSON.stringify(requestContext);
    const history: AdviceTurn[] = latest.current.assistant.conversations.slice(-3).flatMap(t => [{ role: 'user' as const, content: t.question }, { role: 'assistant' as const, content: t.answer }]);
    pending.current = controller; setBusy(true); setError(''); setGate(null);
    try {
      const reply = await askNutritionAgent(text, requestContext, controller.signal, history, latest.current.assistant.facts);
      if (!mounted.current || controller.signal.aborted) return;
      if (JSON.stringify(latest.current.context) !== signature) throw new Error('资料或饮食记录已变化，请重新发送。');
      let proposal = reply.action ? latest.current.onPrepare(reply.action) : undefined;
      if (proposal?.status === 'ready') {
        const meal = proposal.draft.meal;
        const warnings = assistantFoodWarnings(meal.ingredients.map(p => ({ request: { name: '', state: 'unknown' as const, quantity: null, unit: null }, food: FOODS.find(f => f.id === p.foodId) ?? null, grams: p.grams, estimated: true })), nutritionJournal.preferences, latest.current.assistant.facts);
        if (warnings.length) proposal = { status: 'no_candidate', message: '草案涉及已记住的忌口或过敏需求，未采用。' };
      }
      const id = 'assistant-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), date = localWeightDate(new Date());
      mutating.current = true;
      try { await appendAssistantConversation({ id, question: text, answer: reply.answer, createdAt: new Date().toISOString() }); }
      finally { mutating.current = false; }
      if (!mounted.current) return;
      setMessages(previous => [...previous.slice(-29), { id, question: text, reply, proposal, date }]); setQuestion('');
    } catch (reason) { if (mounted.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : '暂时无法连接，请重试。'); }
    finally { pending.current = null; if (mounted.current) setBusy(false); }
  };
  const startVoice = () => {
    if (busy) return;
    if (!assistant.consentAt) { setGate('voice'); return; }
    setError(''); void voice.start(question);
  };
  const accept = async () => {
    if (mutating.current) return; const action = gate; mutating.current = true; setBusy(true); setError('');
    try { await setAssistantConsent(true); setGate(null); if (mounted.current) { mutating.current = false; setBusy(false); if (action === 'voice') void voice.start(question); else void send(true); } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '同意未保存，请重试。'); }
    finally { mutating.current = false; if (mounted.current && !pending.current) setBusy(false); }
  };
  const remember = (id: string, intent: Extract<AssistantIntent, { type: 'remember' }>) => void mutate(async () => {
    await saveAssistantFact({ id: 'fact-' + id, kind: intent.kind, text: intent.text, createdAt: new Date().toISOString() });
    setMessages(current => current.map(m => m.id === id ? { ...m, reply: { ...m.reply, answer: '已记住，可在“记忆”中查看或删除。', intent: undefined } } : m));
  });
  return <Modal visible animationType="slide" onRequestClose={close}>
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}><View style={s.flex}><Text style={s.eyebrow}>UNCOVER · ASSISTANT</Text><Text style={s.title}>营养助手</Text></View><Pressable accessibilityRole="button" accessibilityLabel={view === 'chat' ? '查看助手记忆' : '返回助手对话'} disabled={busy} onPress={() => { voice.abort(); setView(v => v === 'chat' ? 'memory' : 'chat'); }} style={s.headerButton}><Text style={s.lime}>{view === 'chat' ? '记忆 ' + assistant.facts.length : '对话'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="关闭营养助手" disabled={mutating.current} onPress={close} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
      <ScrollView ref={scroll} style={s.flex} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (view === 'chat') scroll.current?.scrollToEnd({ animated: true }); }}>
        {view === 'memory' ? <>
          <Text style={s.section}>已记住的需求</Text>
          {!assistant.facts.length ? <Text style={s.muted}>说“记住我不吃香菜”，确认后会保存在本机。</Text> : assistant.facts.map(f => <View key={f.id} style={s.memoryRow}><View style={s.flex}><Text style={s.small}>{factLabels[f.kind]}</Text><Text style={s.text}>{f.text}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={'删除助手记忆' + f.text} disabled={busy} onPress={() => void mutate(() => deleteAssistantFact(f.id))} style={s.headerButton}><AppGlyph name="trash" color={c.muted} /></Pressable></View>)}
          <Text style={s.small}>过敏记忆可加入已有营养设置；删除记忆不会自动撤销设置中的过敏原。</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="清空助手对话" disabled={busy} onPress={() => setConfirmClear(true)} style={s.secondary}><Text style={s.text}>清空对话 · 保留饮食记录与偏好</Text></Pressable>
          {confirmClear ? <View style={s.card}><Text style={s.text}>清空本机保存的助手对话？</Text><View style={s.row}><Pressable accessibilityRole="button" onPress={() => setConfirmClear(false)} style={s.secondary}><Text style={s.text}>取消</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="确认清空助手对话" disabled={busy} onPress={() => void mutate(async () => { await clearAssistantHistory(); setMessages([]); setConfirmClear(false); })} style={s.secondary}><Text style={s.lime}>确认清空</Text></Pressable></View></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="撤回助手联网同意" disabled={busy || !assistant.consentAt} onPress={() => void mutate(() => setAssistantConsent(false))} style={s.secondary}><Text style={s.muted}>撤回联网同意</Text></Pressable>
        </> : <>
          {!messages.length ? <View style={s.prompts}><Text style={s.emptyTitle}>说一句，就能开始</Text>{['早餐吃了两个水煮鸡蛋，帮我记录', '记住我不吃香菜', '囚徒健身的六练怎么安排？'].map(text => <Pressable accessibilityRole="button" accessibilityLabel={text} key={text} style={s.prompt} onPress={() => setQuestion(text)}><Text style={s.text}>{text}</Text><AppGlyph name="chevron" size={16} /></Pressable>)}</View> : null}
          {messages.map(message => <View key={message.id} style={s.message}><View style={s.question}><Text style={s.text}>{message.question}</Text></View><View style={s.answer}><Text selectable testID="assistant-reply" style={s.answerText}>{message.reply.answer}</Text>
            {message.reply.intent?.type === 'log_intake' ? <AssistantIntakeDraft intent={message.reply.intent} id={'intake-' + message.id} date={message.date} onSaved={() => { if (mounted.current) setMessages(current => current.map(m => m.id === message.id ? { ...m, reply: { ...m.reply, answer: '已记录这一餐，可在今日饮食中查看。' } } : m)); }} /> : message.reply.intent?.type === 'remember' ? <View style={s.card}><Text style={s.small}>待记住 · {factLabels[message.reply.intent.kind]}</Text><Text style={s.text}>{message.reply.intent.text}</Text><Pressable accessibilityRole="button" accessibilityLabel="确认助手记忆" disabled={busy} onPress={() => remember(message.id, message.reply.intent as Extract<AssistantIntent, { type: 'remember' }>)} style={s.bright}><Text style={s.dark}>确认记住</Text></Pressable></View> : null}
            {message.proposal ? <View style={s.card}>{message.proposal.status === 'ready' ? <MealDraftContent draft={message.proposal.draft} onApply={onApply} /> : <Text style={s.muted}>{message.proposal.message}</Text>}</View> : null}
            {message.reply.sources.length || message.reply.references?.length ? <Pressable accessibilityRole="button" accessibilityLabel="查看助手回答依据" onPress={() => setReferencesOpen(v => v === message.id ? null : message.id)} style={s.sourceButton}><AppGlyph name="info" size={15} color={c.muted} /><Text style={s.small}>查看依据</Text></Pressable> : null}
            {referencesOpen === message.id ? <View style={s.card}>{message.reply.references?.map(ref => <View key={ref.id}><Text style={s.lime}>{ref.title}</Text><Text style={s.small}>原文第{ref.lineStart}—{ref.lineEnd}行 · 作者观点，非医学处方</Text><Text style={s.muted}>{ref.excerpt}</Text></View>)}{message.reply.sources.map(source => <Pressable accessibilityRole="link" key={source.url} onPress={() => void Linking.openURL(source.url).catch(() => setError('暂时无法打开来源。'))} style={s.sourceButton}><Text style={s.lime}>{source.title} ↗</Text></Pressable>)}</View> : null}
          </View></View>)}
          {busy ? <View style={s.row}><ActivityIndicator color={c.lime} /><Text style={s.muted}>正在处理…</Text></View> : null}
          {gate ? <View style={s.card} testID="assistant-network-consent"><Text style={s.muted}>提问、近期对话和偏好经营养服务处理；系统语音识别可能联网。记忆保存在本机。</Text><View style={s.row}><Pressable accessibilityRole="button" disabled={busy} onPress={() => setGate(null)} style={s.secondary}><Text style={s.text}>取消</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="同意并开始" disabled={busy} onPress={() => void accept()} style={s.bright}><Text style={s.dark}>同意并开始</Text></Pressable></View></View> : null}
        </>}
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      </ScrollView>
      {view === 'chat' ? <View style={s.composer}><Pressable accessibilityRole="button" accessibilityLabel={voice.listening ? '结束助手语音输入' : '助手语音输入'} disabled={busy} onPress={startVoice} style={[s.voice, voice.listening && s.recording]}><AppGlyph name="microphone" color={voice.listening ? c.onLime : c.lime} size={22} /></Pressable><TextInput accessibilityLabel="营养问题" placeholder={voice.listening ? '正在听，请描述这一餐…' : '描述饮食，或告诉我你的需求'} placeholderTextColor={c.muted} value={question} onChangeText={setQuestion} multiline maxLength={1000} editable={!busy && !voice.listening} style={s.input} /><Pressable accessibilityRole="button" accessibilityLabel="发送营养问题" disabled={busy || voice.listening || !question.trim()} onPress={() => void send()} style={[s.send, (busy || voice.listening || !question.trim()) && s.disabled]}><AppGlyph name="send" color={c.onLime} /></Pressable></View> : null}
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background, paddingTop: 20 }, flex: { flex: 1, minWidth: 0 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 18, width: '100%', maxWidth: progressPageLayout.content.maxWidth, alignSelf: 'center' }, eyebrow: { color: c.muted, fontSize: 9, letterSpacing: 1.1 }, title: { color: c.text, fontSize: 25, fontWeight: '900', marginTop: 5 }, headerButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, close: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 25, color: c.text }, content: { width: '100%', maxWidth: progressPageLayout.content.maxWidth, alignSelf: 'center', padding: 16, gap: 16 },
  section: { color: c.text, fontSize: 18, fontWeight: '800' }, text: { color: c.text, fontSize: 13, lineHeight: 21 }, answerText: { color: c.text, fontSize: 15, lineHeight: 25 }, small: { color: c.muted, fontSize: 10, lineHeight: 17 }, muted: { color: c.muted, fontSize: 12, lineHeight: 20 }, lime: { color: c.lime, fontSize: 12, fontWeight: '700' }, dark: { color: c.onLime, fontWeight: '800', fontSize: 12 }, card: { padding: 12, gap: 10, borderWidth: 1, borderColor: c.border, borderRadius: 14 }, row: { flexDirection: 'row', gap: 10, alignItems: 'center' }, memoryRow: { flexDirection: 'row', gap: 10, padding: 14, alignItems: 'center', borderRadius: 16, backgroundColor: c.card }, secondary: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, alignItems: 'center', justifyContent: 'center' }, bright: { minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' },
  prompts: { gap: 10, paddingVertical: 28 }, emptyTitle: { color: c.text, fontSize: 20, fontWeight: '800', marginBottom: 10 }, prompt: { backgroundColor: c.card, padding: 14, borderRadius: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between' }, message: { gap: 10 }, question: { alignSelf: 'flex-end', backgroundColor: c.raised, padding: 12, borderRadius: 16, maxWidth: '90%' }, answer: { backgroundColor: c.card, borderRadius: 18, padding: 14, gap: 12 }, sourceButton: { minHeight: 36, flexDirection: 'row', gap: 6, alignItems: 'center' }, error: { color: c.warning, fontSize: 12, lineHeight: 20 }, composer: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 20, width: '100%', maxWidth: progressPageLayout.content.maxWidth, alignSelf: 'center', alignItems: 'flex-end' }, voice: { width: 44, height: 48, borderRadius: 14, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }, recording: { backgroundColor: c.lime }, input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 110, borderRadius: 14, padding: 12, backgroundColor: c.card, color: c.text, borderWidth: 1, borderColor: c.border, fontSize: 13 }, send: { width: 44, height: 48, borderRadius: 14, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .4 },
});
