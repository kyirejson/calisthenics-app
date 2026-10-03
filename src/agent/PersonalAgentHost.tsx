import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useAppStore } from '../store/AppStore';
import { useUpdateBlock } from '../components/AppUpdates';
import { NutritionAgentModal } from '../components/nutrition/NutritionAgentModal';
import { localWeightDate } from '../data/weightTrend';
import { prepareMealAdjustment } from '../nutrition/adjustments';
import { getNutritionTrainingContext } from '../nutrition/training';
import { personalAgentContext } from './context';
import { subscribeAgentEvents } from './events';
import { agentNudge } from './proactive';
import { consumeSystemCommand } from './systemChannel';
import { loadAgentConnection } from './credentials';
import { AgentFloatingDock } from './AgentFloatingDock';
import { clearConnectionReturn, consumeConnectionReturn } from './settingsResume';
type Channel = { openAgent: (scene?: string, text?: string) => void; setAgentScene: (scene: string) => void };
const ChannelContext = createContext<Channel | null>(null);
export function usePersonalAgent() { const value = useContext(ChannelContext); if (!value) throw new Error('PersonalAgentHost missing'); return value; }
export function PersonalAgentHost({ children }: { children: React.ReactNode }) {
  const { profile, sessions, dailyEdits, nutritionJournal, setAgentPreferences } = useAppStore();
  const [opened, setOpened] = useState(false), [scene, setScene] = useState('今日训练'), [initialText, setInitialText] = useState('');
  const [initialView, setInitialView] = useState<'chat' | 'connection'>('chat');
  const [now, setNow] = useState(() => new Date()), [nudgeError, setNudgeError] = useState('');
  const date = localWeightDate(now);
  useUpdateBlock(opened);
  const openAgent = useCallback((nextScene?: string, text = '') => { if (nextScene) setScene(nextScene); setInitialText(text); setInitialView('chat'); setOpened(true); }, []);
  useEffect(() => { void loadAgentConnection().catch(() => undefined); }, []);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      setNow(new Date()); void consumeSystemCommand().then(text => { if (alive && text !== null) openAgent('系统快捷指令', text); }).catch(() => undefined);
      if (AppState.currentState === 'active' || AppState.currentState == null) void consumeConnectionReturn().then(resume => { if (alive && resume) { setInitialView('connection'); setOpened(true); } }).catch(() => undefined);
    };
    refresh();
    const unsubscribe = subscribeAgentEvents(refresh);
    const timer = setInterval(refresh, 30000), sub = AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
    const receive = ({ url }: { url: string }) => {
      try { const value = new URL(url); if (value.protocol === 'uncover:' && (value.hostname === 'assistant' || value.pathname === '/assistant')) openAgent('系统快捷指令', (value.searchParams.get('text') || '').slice(0, 1000)); } catch { /* Unrelated or malformed links never execute. */ }
    };
    const linkSub = Linking.addEventListener('url', receive); void Linking.getInitialURL().then(url => { if (url) receive({ url }); }).catch(() => undefined);
    return () => { alive = false; clearInterval(timer); sub.remove(); linkSub.remove(); unsubscribe(); };
  }, [openAgent]);
  const context = useMemo(() => profile ? personalAgentContext(profile, nutritionJournal, sessions, dailyEdits, date) : null, [profile, nutritionJournal, sessions, dailyEdits, date]);
  const channel = useMemo(() => ({ openAgent, setAgentScene: setScene }), [openAgent]);
  const nudge = profile ? agentNudge(profile, nutritionJournal, sessions, now) : null;
  const dismiss = async () => {
    if (!nudge) return;
    try { await setAgentPreferences(current => ({ dismissed: [...current.dismissed, nudge.id] })); setNudgeError(''); }
    catch { setNudgeError('暂未保存忽略状态，请重试。'); }
  };
  return <ChannelContext.Provider value={channel}>
    {children}
    {profile && !opened ? <AgentFloatingDock anchor={nutritionJournal.assistant.agentPreferences?.dockAnchor} onAnchor={dockAnchor => setAgentPreferences({ dockAnchor })} onOpen={question => question ? openAgent('主动关怀', question) : openAgent()} nudge={nudge} onDismiss={dismiss} error={nudgeError} /> : null}
    {opened && profile && context ? <NutritionAgentModal scene={scene} initialQuestion={initialText} initialView={initialView} context={context} onClose={() => { setOpened(false); void clearConnectionReturn().catch(() => undefined); }} onPrepare={action => prepareMealAdjustment(profile, nutritionJournal, getNutritionTrainingContext(profile, sessions, dailyEdits, date), date, action)} /> : null}
  </ChannelContext.Provider>;
}
