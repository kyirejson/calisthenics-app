import type { Profile, TrainingSession } from '../types';
import type { NutritionJournal } from '../nutrition/types';
import { validHistorySessions, validCompletedSets } from '../data/trainingHistory';
import { overlayDate } from './trainingOverlay';
import { normalizeAgentPreferences } from './music';
import { agentWeightContext } from './weightContext';
export type AgentNudge = { id: string; title: string; question: string };
export function agentNudge(profile: Profile, journal: NutritionJournal, sessions: TrainingSession[], now = new Date()): AgentNudge | null {
  const prefs = normalizeAgentPreferences(journal.assistant.agentPreferences);
  if (!prefs.proactive) return null;
  const date = overlayDate(now), dismissed = new Set(prefs.dismissed);
  const candidates: AgentNudge[] = [];
  const recent = validHistorySessions(sessions, now).filter(s => s.kind !== 'running' && s.exercises.some(e => validCompletedSets(e, undefined, now).length))
    .filter(s => { const elapsed = now.getTime() - Date.parse(s.completedAt); return elapsed >= 45 * 60000 && elapsed <= 4 * 3600000; })
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
  if (recent) candidates.push({ id: 'training:' + recent.id, title: '训练后，要不要一起回顾？', question: '请结合最近的实际训练和已记录饮食，帮我回顾恢复与饮食，不要假设没记录就是没吃。' });
  if (agentWeightContext(profile, now).comparison === 'stable') {
    const monday = new Date(now); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    candidates.push({ id: 'weight:' + overlayDate(monday), title: '近期均重接近，可以核对记录条件', question: '帮我比较最近两周实测体重与饮食训练记录。信息不足时先问记录条件，不直接判定平台期或改热量。' });
  }
  if (now.getHours() >= 20 && journal.entries.some(e => e.date === date) && !journal.days[date]?.completedAt)
    candidates.push({ id: 'review:' + date, title: '要不要回顾今天已记录的饮食？', question: '请回顾今天已记录的饮食，给我一个有依据的建议。不要求补齐四餐，也不把未记录当作没吃。' });
  return candidates.find(c => !dismissed.has(c.id)) || null;
}
