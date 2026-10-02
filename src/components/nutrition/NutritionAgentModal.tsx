import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { askNutritionAgent, getNutritionServiceStatus, type AdviceContext, type AdviceTurn, type NutritionAdvice } from '../../nutrition/agentClient';
import type { MealDraftResult } from '../../nutrition/adjustments';
import type { NutritionAgentAction } from '../../nutrition/types';
import { assistantAuthorization, normalizeAssistantIntent, shortAssistantReply, type AssistantIntent } from '../../nutrition/assistantState';
import { explicitPreferenceIntent, preferencePatchSummary, screeningStatement } from '../../nutrition/preferenceIntent.mjs';
import { objectiveLabels, patternLabels } from '../../nutrition/labels';
import { archiveCursor } from '../../nutrition/assistantArchiveCore';
import { assistantDataBasis } from '../../nutrition/assistantAuthorization';
import { evidenceFromTurns, selectPersonalFacts } from '../../nutrition/personalKnowledge';
import { assistantTrainingSnapshot } from '../../nutrition/assistantTraining';
import { PersonalKnowledgeForm } from './PersonalKnowledgeForm';
import { assistantFoodWarnings } from '../../nutrition/assistantFood';
import { FOODS } from '../../nutrition/catalog';
import { localWeightDate } from '../../data/weightTrend';
import { useAppStore } from '../../store/AppStore';
import { MealDraftContent } from './MealDraftPreview';
import { AssistantIntakeDraft } from './AssistantIntakeDraft';
import { useNutritionVoice } from './useNutritionVoice';
import { AppGlyph } from '../AppGlyph';
import { appPalette as c, progressPageLayout } from '../../theme';

type Message = { id: string; question: string; reply: NutritionAdvice; proposal?: MealDraftResult; date: string; createdAt: string; proof?: { basis: string; policyVersion: number; auto: boolean } };
const factLabels = { like: '喜好', avoid: '忌口', need: '需求', allergy: '过敏' } as const;
export function NutritionAgentModal({ context, onPrepare, onClose }: {
  context: AdviceContext; onClose: () => void; onPrepare: (action: NutritionAgentAction) => MealDraftResult;
}) {
  const { profile, sessions, dailyEdits, nutritionJournal, setAssistantConsent, appendAssistantConversation, deleteAssistantFact, clearAssistantHistory, readAssistantHistory, setAssistantAuthorization, executeAssistantOperation } = useAppStore();
  const assistant = nutritionJournal.assistant;
  const [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [view, setView] = useState<'chat' | 'memory' | 'profile'>('chat'), [gate, setGate] = useState<'send' | 'voice' | null>(null);
  const authorization = assistantAuthorization(assistant);
  const snapshotDate = localWeightDate(new Date());
  const snapshot = useMemo(() => profile ? assistantTrainingSnapshot(profile, sessions, dailyEdits) : null, [profile, sessions, dailyEdits, snapshotDate]);
  const basis = assistantDataBasis(nutritionJournal, profile, sessions, dailyEdits);
  const [hasOlder, setHasOlder] = useState(assistant.conversations.length >= 30), [forgetId, setForgetId] = useState<string | null>(null);
  const [knowledgeUnavailable, setKnowledgeUnavailable] = useState(false);
  const [serviceNotice, setServiceNotice] = useState('');
  const [referencesOpen, setReferencesOpen] = useState<string | null>(null), [confirmClear, setConfirmClear] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => assistant.conversations.map(t => ({ id: t.id, question: t.question, reply: { answer: shortAssistantReply(t.answer), sources: [] }, date: localWeightDate(new Date(t.createdAt)), createdAt: t.createdAt })));
  const latest = useRef({ context, onPrepare, assistant, basis, snapshot, profile }); latest.current = { context, onPrepare, assistant, basis, snapshot, profile };
  const pending = useRef<AbortController | null>(null), mounted = useRef(true), mutating = useRef(false), scroll = useRef<ScrollView>(null);
  const loadingOlder = useRef(false);
  const voice = useNutritionVoice(text => setQuestion(text.slice(0, 1000)), setError);
  useEffect(() => {
    mounted.current = true;
    const changed = () => { if (AppState.currentState === 'background' || AppState.currentState === 'inactive' || (Platform.OS === 'web' && document.hidden)) pending.current?.abort(); };
    const sub = AppState.addEventListener('change', changed); if (Platform.OS === 'web') document.addEventListener('visibilitychange', changed);
    return () => { mounted.current = false; pending.current?.abort(); sub.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', changed); };
  }, []);
  useEffect(() => {
    if (!assistant.consentAt) { setServiceNotice(''); return; }
    const controller = new AbortController();
    void getNutritionServiceStatus(controller.signal).then(status => {
      if (!controller.signal.aborted) {
        setKnowledgeUnavailable(status.readiness === 'degraded');
        setServiceNotice(status.configured ? '' : 'AI 服务尚未配置有效密钥；本机档案与手动记餐仍可用。');
      }
    }).catch(reason => { if (!controller.signal.aborted) setServiceNotice(reason instanceof Error ? reason.message : '营养服务暂不可用。'); });
    return () => controller.abort();
  }, [assistant.consentAt]);
  const close = () => { if (mutating.current) return; mounted.current = false; pending.current?.abort(); voice.abort(); onClose(); };
  const mutate = async (operation: () => Promise<void>) => {
    if (mutating.current || pending.current) return; mutating.current = true; setBusy(true); setError('');
    try { await operation(); } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '保存失败，请重试。'); }
    finally { mutating.current = false; if (mounted.current) setBusy(false); }
  };
  const send = async (consented = false) => {
    const text = question.trim(); if (!text || pending.current || mutating.current || voice.active) return;
    const localIntent = normalizeAssistantIntent(explicitPreferenceIntent(text));
    if (!localIntent && !consented && (!latest.current.assistant.consentAt || latest.current.assistant.consentScope !== 2)) { setGate('send'); return; }
    const controller = new AbortController(), requestContext = latest.current.context, signature = JSON.stringify(requestContext), captured = latest.current;
    const policy = assistantAuthorization(captured.assistant);
    pending.current = controller; setBusy(true); setError(''); setGate(null);
    try {
      const recent = await readAssistantHistory({ limit: 6 });
      const recalled = await readAssistantHistory({ question: text, topic: /吃|饮食|忌口|过敏|喜好/u.test(text) ? undefined : captured.profile?.goal, limit: 8 });
      const history: AdviceTurn[] = recent.reverse().flatMap(t => [{ role: 'user' as const, content: t.question }, { role: 'assistant' as const, content: t.answer }]);
      let reply: NutritionAdvice = localIntent ? { answer: '已整理营养偏好，确认内容后保存。', sources: [], intent: localIntent } : await askNutritionAgent(text, requestContext, controller.signal, history, selectPersonalFacts(captured.assistant.facts, text), {
        version: 2, ...policy, personalProfile: captured.profile ? captured.assistant.personalProfiles?.[captured.profile.goal] || null : null,
        evidence: evidenceFromTurns(recalled.filter(t => !recent.some(r => r.id === t.id))), trainingSnapshot: captured.snapshot,
      });
      if (!mounted.current || controller.signal.aborted) return;
      if (JSON.stringify(latest.current.context) !== signature || latest.current.basis !== captured.basis || assistantAuthorization(latest.current.assistant).policyVersion !== policy.policyVersion) throw new Error('资料、记录或权限已变化，请重新发送。');
      let proposal = reply.action ? latest.current.onPrepare(reply.action) : undefined;
      if (proposal?.status === 'ready') {
        const meal = proposal.draft.meal;
        const warnings = assistantFoodWarnings(meal.ingredients.map(p => ({ request: { name: '', state: 'unknown' as const, quantity: null, unit: null }, food: FOODS.find(f => f.id === p.foodId) ?? null, grams: p.grams, estimated: true })), nutritionJournal.preferences, latest.current.assistant.facts);
        if (warnings.length) proposal = { status: 'no_candidate', message: '草案涉及已记住的忌口或过敏需求，未采用。' };
      }
      const id = 'assistant-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), date = localWeightDate(new Date()), createdAt = new Date().toISOString();
      const proof = { basis: captured.basis, policyVersion: policy.policyVersion, auto: policy.mode === 'full_access' };
      mutating.current = true;
      try {
        await appendAssistantConversation({ id, question: text, answer: reply.answer, createdAt, topic: captured.profile?.goal });
        if (proof.auto && reply.intent?.type === 'set_preferences') {
          await executeAssistantOperation({ id: 'set_preferences-' + id, ...proof, confirmed: false, kind: 'set_preferences', patch: reply.intent.patch });
          reply = { ...reply, answer: '已保存营养偏好，参考目标由本机重新计算。', intent: undefined };
        } else if (proof.auto && reply.intent?.type === 'remember') {
          await executeAssistantOperation({ id: 'remember-' + id, ...proof, confirmed: false, kind: 'remember', fact: { id: 'fact-' + id, kind: reply.intent.kind, text: reply.intent.text, createdAt } });
          reply = { ...reply, answer: '已记住，可在“记忆”中查看或删除。', intent: undefined };
        } else if (proof.auto && proposal?.status === 'ready') {
          await executeAssistantOperation({ id: 'meal-' + id, ...proof, confirmed: false, kind: 'meal', draft: proposal.draft });
          reply = { ...reply, answer: '已更新推荐菜单；实际摄入记录未改变。' }; proposal = undefined;
        }
      }
      finally { mutating.current = false; }
      if (!mounted.current) return;
      setMessages(previous => [...previous, { id, question: text, reply, proposal, date, createdAt, proof }]); setQuestion('');
    } catch (reason) { if (mounted.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : '暂时无法连接，请重试。'); }
    finally { pending.current = null; if (mounted.current) setBusy(false); }
  };
  const startVoice = () => {
    if (busy) return;
    if (!assistant.consentAt || assistant.consentScope !== 2) { setGate('voice'); return; }
    setError(''); void voice.start(question);
  };
  const accept = async () => {
    if (mutating.current) return; const action = gate; mutating.current = true; setBusy(true); setError('');
    try { await setAssistantConsent(true); setGate(null); if (mounted.current) { mutating.current = false; setBusy(false); if (action === 'voice') void voice.start(question); else void send(true); } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '同意未保存，请重试。'); }
    finally { mutating.current = false; if (mounted.current && !pending.current) setBusy(false); }
  };
  const remember = (message: Message, intent: Extract<AssistantIntent, { type: 'remember' }>) => void mutate(async () => {
    if (!message.proof) return;
    const id = message.id;
    await executeAssistantOperation({ id: 'remember-' + id, ...message.proof, confirmed: true, kind: 'remember', fact: { id: 'fact-' + id, kind: intent.kind, text: intent.text, createdAt: message.createdAt } });
    setMessages(current => current.map(m => m.id === id ? { ...m, reply: { ...m.reply, answer: '已记住，可在“记忆”中查看或删除。', intent: undefined } } : m));
  });
  const savePreferences = (message: Message, intent: Extract<AssistantIntent, { type: 'set_preferences' }>) => void mutate(async () => {
    if (!message.proof) throw new Error('请重新描述营养偏好。');
    await executeAssistantOperation({ id: 'set_preferences-' + message.id, ...message.proof, confirmed: true, kind: 'set_preferences', patch: intent.patch });
    setMessages(current => current.map(m => m.id === message.id ? { ...m, reply: { ...m.reply, answer: '已保存营养偏好，参考目标由本机重新计算。', intent: undefined } } : m));
  });
  const older = () => void mutate(async () => {
    if (!messages.length) return;
    const rows = await readAssistantHistory({ before: archiveCursor(messages[0]), limit: 30 });
    loadingOlder.current = true;
    setMessages(current => [...rows.reverse().filter(t => !current.some(m => m.id === t.id)).map(t => ({ ...t, date: localWeightDate(new Date(t.createdAt)), reply: { answer: t.answer, sources: [] } })), ...current]);
    setHasOlder(rows.length >= 30);
  });
  const forget = (id: string) => void mutate(async () => {
    const fact = assistant.facts.find(f => f.id === id); if (!fact) return;
    await deleteAssistantFact(id);
    setMessages(current => current.filter(m => !m.question.includes(fact.text) && !m.reply.answer.includes(fact.text))); setForgetId(null);
  });
  return <Modal visible animationType="slide" onRequestClose={close}>
    <KeyboardAvoidingView style={[s.root, Platform.OS === 'android' && { paddingTop: (StatusBar.currentHeight || 24) + 12 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}><View style={s.flex}><Text style={s.eyebrow}>UNCOVER · ASSISTANT</Text><Text style={s.title}>营养助手</Text></View><Pressable accessibilityRole="button" accessibilityLabel={view === 'chat' ? '查看助手记忆' : '返回助手对话'} disabled={busy} onPress={() => { voice.abort(); setView(v => v === 'chat' ? 'memory' : 'chat'); }} style={s.headerButton}><Text style={s.lime}>{view === 'chat' ? '记忆 ' + assistant.facts.length : '对话'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="关闭营养助手" disabled={mutating.current} onPress={close} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
      <ScrollView ref={scroll} style={s.flex} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (loadingOlder.current) { loadingOlder.current = false; return; } if (view === 'chat') scroll.current?.scrollToEnd({ animated: true }); }}>
        {serviceNotice && serviceNotice !== error ? <Text accessibilityRole="alert" style={s.small}>{serviceNotice}</Text> : null}
        {knowledgeUnavailable ? <Text accessibilityRole="alert" style={s.small}>囚徒健身资料未同步，原书检索暂不可用。</Text> : null}
        {view === 'profile' ? <PersonalKnowledgeForm onClose={() => setView('memory')} /> : view === 'memory' ? <>
          <Pressable accessibilityRole="button" accessibilityLabel="建立个人训练知识库" disabled={busy} onPress={() => setView('profile')} style={s.bright}><Text style={s.dark}>{profile && assistant.personalProfiles?.[profile.goal] ? '查看／编辑个人训练档案' : '建立个人训练档案 · 六个问题'}</Text></Pressable>
          <Text style={s.section}>执行权限</Text>
          <View style={s.row}>{([{ mode: 'request_confirmation', label: '询问请求确认' }, { mode: 'full_access', label: '完全访问' }] as const).map(item => <Pressable key={item.mode} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: authorization.mode === item.mode }} disabled={busy} onPress={() => void mutate(() => setAssistantAuthorization(item.mode))} style={[s.secondary, authorization.mode === item.mode && { borderColor: c.lime }]}><Text style={authorization.mode === item.mode ? s.lime : s.text}>{item.label}</Text></Pressable>)}</View>
          <Text style={s.small}>{authorization.mode === 'full_access' ? '明确请求经校验后直接执行；信息不齐仍会询问。' : '修改偏好、记忆、记餐和菜单时先展示草案，请你确认。'}</Text>
          <Text style={s.section}>当前营养偏好</Text>
          <Text style={s.text}>{nutritionJournal.preferences ? objectiveLabels[nutritionJournal.preferences.objective] + ' · ' + patternLabels[nutritionJournal.preferences.pattern] : '尚未建立营养偏好'}</Text>
          <Text style={s.small}>{nutritionJournal.preferences?.allergens.length ? preferencePatchSummary({ allergens: nutritionJournal.preferences.allergens }) : '尚未记录过敏原（不代表无过敏）'}</Text>
          <Text style={s.small}>{nutritionJournal.preferences?.riskFlags.length ? '已记录需专业饮食指导的健康情况；自动目标暂停。' : nutritionJournal.preferences?.screeningCompletedAt ? '健康情况已核对' : '健康情况待确认'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="通过助手修改营养偏好" disabled={busy} onPress={() => { setView('chat'); setQuestion('营养目标设为'); }} style={s.secondary}><Text style={s.lime}>在对话中修改</Text></Pressable>
          <Text style={s.section}>已记住的需求</Text>
          <Text style={s.small}>忘记会清理相关对话；营养偏好的过敏原保留，可在对话中明确更正。已导出的备份需另行处理。</Text>
          {!assistant.facts.length ? <Text style={s.muted}>说“记住我不吃香菜”，保存后可跨会话使用。</Text> : assistant.facts.map(f => <View key={f.id} style={s.memoryRow}><View style={s.flex}><Text style={s.small}>{factLabels[f.kind]}</Text><Text style={s.text}>{f.text}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={'删除助手记忆' + f.text} disabled={busy} onPress={() => authorization.mode === 'full_access' ? forget(f.id) : setForgetId(f.id)} style={s.headerButton}><AppGlyph name="trash" color={c.muted} /></Pressable></View>)}
          {forgetId ? <View style={s.card}><Text style={s.text}>忘记这项信息及包含它的对话？</Text><View style={s.row}><Pressable accessibilityRole="button" disabled={busy} onPress={() => setForgetId(null)} style={s.secondary}><Text style={s.text}>取消</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="确认忘记助手记忆" disabled={busy} onPress={() => forget(forgetId)} style={s.bright}><Text style={s.dark}>确认忘记</Text></Pressable></View></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="清空助手对话" disabled={busy} onPress={() => authorization.mode === 'full_access' ? void mutate(async () => { await clearAssistantHistory(); setMessages([]); setHasOlder(false); }) : setConfirmClear(true)} style={s.secondary}><Text style={s.text}>清空对话 · 保留饮食记录与偏好</Text></Pressable>
          {confirmClear ? <View style={s.card}><Text style={s.text}>清空本机保存的助手对话？</Text><View style={s.row}><Pressable accessibilityRole="button" onPress={() => setConfirmClear(false)} style={s.secondary}><Text style={s.text}>取消</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="确认清空助手对话" disabled={busy} onPress={() => void mutate(async () => { await clearAssistantHistory(); setMessages([]); setHasOlder(false); setConfirmClear(false); })} style={s.secondary}><Text style={s.lime}>确认清空</Text></Pressable></View></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="撤回助手联网同意" disabled={busy || !assistant.consentAt} onPress={() => void mutate(() => setAssistantConsent(false))} style={s.secondary}><Text style={s.muted}>撤回联网同意</Text></Pressable>
        </> : <>
          {!nutritionJournal.preferences?.screeningCompletedAt ? <View style={s.card}><Text style={s.small}>参考目标需要健康情况确认。请核对孕期／哺乳、需饮食管理的疾病、降糖用药、SGLT2用药和进食障碍；如有，请如实告诉助手。</Text><Pressable accessibilityRole="button" accessibilityLabel="填写无上述健康情况声明" disabled={busy} onPress={() => setQuestion(screeningStatement)} style={s.secondary}><Text style={s.lime}>均无 · 填入声明后发送</Text></Pressable></View> : null}
          {hasOlder ? <Pressable accessibilityRole="button" accessibilityLabel="加载更早助手对话" disabled={busy} onPress={older} style={s.secondary}><Text style={s.muted}>加载更早对话</Text></Pressable> : null}
          {!messages.length ? <View style={s.prompts}><Text style={s.emptyTitle}>说一句，就能开始</Text>{['营养目标设为增肌，饮食模式设为均衡', '早餐吃了两个水煮鸡蛋，帮我记录', '记住我不吃香菜', '街头健身的六练怎么安排？', '训练前后怎么安排饮食？'].map(text => <Pressable accessibilityRole="button" accessibilityLabel={text} key={text} style={s.prompt} onPress={() => setQuestion(text)}><Text style={s.text}>{text}</Text><AppGlyph name="chevron" size={16} /></Pressable>)}</View> : null}
          {messages.map(message => <View key={message.id} style={s.message}><View style={s.question}><Text style={s.text}>{message.question}</Text></View><View style={s.answer}><Text selectable testID="assistant-reply" style={s.answerText}>{message.reply.answer}</Text>
            {message.reply.intent?.type === 'set_preferences' ? <View style={s.card}><Text style={s.small}>待保存 · 仅修改明确说出的偏好</Text><Text style={s.text}>{preferencePatchSummary(message.reply.intent.patch)}</Text><Pressable accessibilityRole="button" accessibilityLabel="确认保存营养偏好" disabled={busy} onPress={() => savePreferences(message, message.reply.intent as Extract<AssistantIntent, { type: 'set_preferences' }>)} style={s.bright}><Text style={s.dark}>确认保存</Text></Pressable></View> : null}
            {message.reply.intent?.type === 'log_intake' ? <AssistantIntakeDraft intent={message.reply.intent} id={'intake-' + message.id} date={message.date} proof={message.proof} onSaved={() => { if (mounted.current) setMessages(current => current.map(m => m.id === message.id ? { ...m, reply: { ...m.reply, answer: '已记录这一餐，可在今日饮食中查看。' } } : m)); }} /> : message.reply.intent?.type === 'remember' ? <View style={s.card}><Text style={s.small}>待记住 · {factLabels[message.reply.intent.kind]}</Text><Text style={s.text}>{message.reply.intent.text}</Text><Pressable accessibilityRole="button" accessibilityLabel="确认助手记忆" disabled={busy} onPress={() => remember(message, message.reply.intent as Extract<AssistantIntent, { type: 'remember' }>)} style={s.bright}><Text style={s.dark}>确认记住</Text></Pressable></View> : null}
            {message.proposal ? <View style={s.card}>{message.proposal.status === 'ready' ? <MealDraftContent draft={message.proposal.draft} onApply={async draft => { if (!message.proof) throw new Error('请重新生成草案。'); await executeAssistantOperation({ id: 'meal-' + message.id, ...message.proof, confirmed: true, kind: 'meal', draft }); }} /> : <Text style={s.muted}>{message.proposal.message}</Text>}</View> : null}
            {message.proof ? <Text style={s.small}>基于本机档案、训练快照与相关历史</Text> : null}
            {message.reply.sources.length || message.reply.references?.length ? <Pressable accessibilityRole="button" accessibilityLabel="查看助手回答依据" onPress={() => setReferencesOpen(v => v === message.id ? null : message.id)} style={s.sourceButton}><AppGlyph name="info" size={15} color={c.muted} /><Text style={s.small}>查看依据</Text></Pressable> : null}
            {referencesOpen === message.id ? <View style={s.card}>{message.reply.references?.map(ref => <View key={ref.id}><Text style={s.lime}>{ref.title}</Text><Text style={s.small}>原文第{ref.lineStart}—{ref.lineEnd}行 · 作者观点，非医学处方</Text><Text style={s.muted}>{ref.excerpt}</Text></View>)}{message.reply.sources.map(source => <Pressable accessibilityRole="link" key={source.url} onPress={() => void Linking.openURL(source.url).catch(() => setError('暂时无法打开来源。'))} style={s.sourceButton}><Text style={s.lime}>{source.title} ↗</Text></Pressable>)}</View> : null}
          </View></View>)}
          {busy ? <View style={s.row}><ActivityIndicator color={c.lime} /><Text style={s.muted}>正在处理…</Text></View> : null}
          {gate ? <View style={s.card} testID="assistant-network-consent"><Text style={s.muted}>提问、相关历史、档案偏好与训练摘要发送营养服务。原文留在本机，系统语音识别可能联网。</Text><View style={s.row}><Pressable accessibilityRole="button" disabled={busy} onPress={() => setGate(null)} style={s.secondary}><Text style={s.text}>取消</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="同意并开始" disabled={busy} onPress={() => void accept()} style={s.bright}><Text style={s.dark}>同意并开始</Text></Pressable></View></View> : null}
        </>}
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      </ScrollView>
      {view === 'chat' ? <View style={s.composerArea}>
        {voice.active ? <Text accessibilityLiveRegion="polite" style={s.voiceStatus}>{voice.phase === 'starting' ? '正在准备麦克风 · 再点可取消' : voice.phase === 'stopping' ? '正在整理识别结果…' : '正在听 · 说完点麦克风结束，核对后发送'}</Text> : null}
        <View style={s.composer}><Pressable accessibilityRole="button" accessibilityLabel={voice.phase === 'starting' ? '取消助手语音输入' : voice.active ? '结束助手语音输入' : '助手语音输入'} disabled={busy || voice.phase === 'stopping'} onPress={startVoice} style={[s.voice, voice.active && s.recording]}>{voice.phase === 'starting' || voice.phase === 'stopping' ? <ActivityIndicator color={c.onLime} /> : <AppGlyph name="microphone" color={voice.active ? c.onLime : c.lime} size={22} />}</Pressable><TextInput accessibilityLabel="营养问题" placeholder={voice.active ? '请描述这一餐…' : '描述饮食，或告诉我你的需求'} placeholderTextColor={c.muted} value={question} onChangeText={setQuestion} multiline maxLength={1000} editable={!busy && !voice.active} style={s.input} /><Pressable accessibilityRole="button" accessibilityLabel="发送营养问题" disabled={busy || voice.active || !question.trim()} onPress={() => void send()} style={[s.send, (busy || voice.active || !question.trim()) && s.disabled]}><AppGlyph name="send" color={c.onLime} /></Pressable></View>
      </View> : null}
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  composerArea: { width: '100%', maxWidth: progressPageLayout.content.maxWidth, alignSelf: 'center' },
  voiceStatus: { color: c.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingTop: 8 },
  root: { flex: 1, backgroundColor: c.background, paddingTop: 20 }, flex: { flex: 1, minWidth: 0 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 18, width: '100%', maxWidth: progressPageLayout.content.maxWidth, alignSelf: 'center' }, eyebrow: { color: c.muted, fontSize: 9, letterSpacing: 1.1 }, title: { color: c.text, fontSize: 25, fontWeight: '900', marginTop: 5 }, headerButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, close: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 25, color: c.text }, content: { width: '100%', maxWidth: progressPageLayout.content.maxWidth, alignSelf: 'center', padding: 16, gap: 16 },
  section: { color: c.text, fontSize: 18, fontWeight: '800' }, text: { color: c.text, fontSize: 13, lineHeight: 21 }, answerText: { color: c.text, fontSize: 15, lineHeight: 25 }, small: { color: c.muted, fontSize: 10, lineHeight: 17 }, muted: { color: c.muted, fontSize: 12, lineHeight: 20 }, lime: { color: c.lime, fontSize: 12, fontWeight: '700' }, dark: { color: c.onLime, fontWeight: '800', fontSize: 12 }, card: { padding: 12, gap: 10, borderWidth: 1, borderColor: c.border, borderRadius: 14 }, row: { flexDirection: 'row', gap: 10, alignItems: 'center' }, memoryRow: { flexDirection: 'row', gap: 10, padding: 14, alignItems: 'center', borderRadius: 16, backgroundColor: c.card }, secondary: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, alignItems: 'center', justifyContent: 'center' }, bright: { minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' },
  prompts: { gap: 10, paddingVertical: 28 }, emptyTitle: { color: c.text, fontSize: 20, fontWeight: '800', marginBottom: 10 }, prompt: { backgroundColor: c.card, padding: 14, borderRadius: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between' }, message: { gap: 10 }, question: { alignSelf: 'flex-end', backgroundColor: c.raised, padding: 12, borderRadius: 16, maxWidth: '90%' }, answer: { backgroundColor: c.card, borderRadius: 18, padding: 14, gap: 12 }, sourceButton: { minHeight: 36, flexDirection: 'row', gap: 6, alignItems: 'center' }, error: { color: c.warning, fontSize: 12, lineHeight: 20 }, composer: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 20, width: '100%', maxWidth: progressPageLayout.content.maxWidth, alignSelf: 'center', alignItems: 'flex-end' }, voice: { width: 44, height: 48, borderRadius: 14, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }, recording: { backgroundColor: c.lime }, input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 110, borderRadius: 14, padding: 12, backgroundColor: c.card, color: c.text, borderWidth: 1, borderColor: c.border, fontSize: 13 }, send: { width: 44, height: 48, borderRadius: 14, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .4 },
});
