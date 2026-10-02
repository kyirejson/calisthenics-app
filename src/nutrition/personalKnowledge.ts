import type { Goal, Profile } from '../types';
import { equipmentSplitFrequencies, equipmentSplitConfig } from '../data/equipmentTraining';
import type { AssistantConversation, AssistantFact } from './assistantState';

export type PersonalTrainingProfile = {
  version: 1; topic: Goal; updatedAt: string;
  objective: string; schedule: string; environment: string; baseline: string;
  priorities: string; restrictions: string; diet: string;
};
export const personalQuestions = [
  { field: 'objective', title: '你现在最想练出什么结果？', choices: ['增肌', '力量', '减脂保肌', '自重技能'] },
  { field: 'schedule', title: '每周通常能练几次，哪几天？', choices: [] },
  { field: 'environment', title: '在哪里练，有哪些器械？', choices: ['健身房', '家中', '户外', '暂不确定'] },
  { field: 'baseline', title: '当前训练基础是什么？', choices: ['持续训练中', '刚恢复训练', '暂不填写'] },
  { field: 'priorities', title: '最想加强哪里？哪些动作不喜欢？', choices: ['均衡发展', '胸部', '肩部', '背部', '腿部', '手臂', '核心', '自重技能'] },
  { field: 'restrictions', title: '有哪些需要长期避开的训练限制？', choices: ['无已知限制', '暂不填写'] },
] as const;
export type PersonalField = typeof personalQuestions[number]['field'] | 'diet';
export function normalizePersonalProfile(raw: unknown): PersonalTrainingProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (p.version !== 1 || !['weight_loss', 'street_mastery', 'equipment', 'fat_loss', 'gain', 'strength'].includes(String(p.topic))
    || typeof p.updatedAt !== 'string' || !Number.isFinite(Date.parse(p.updatedAt))) return null;
  const values: Record<string, string> = {};
  for (const key of [...personalQuestions.map(q => q.field), 'diet']) {
    if (typeof p[key] !== 'string' || Array.from(p[key]).length > 240 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(p[key])) return null;
    values[key] = p[key].trim();
  }
  return { version: 1, topic: p.topic as Goal, updatedAt: p.updatedAt, ...values } as PersonalTrainingProfile;
}
export function prefillPersonalProfile(profile: Profile, saved?: PersonalTrainingProfile | null): PersonalTrainingProfile {
  return saved || { version: 1, topic: profile.goal, updatedAt: new Date().toISOString(),
    objective: profile.goal === 'equipment' ? '增肌' : profile.goal === 'street_mastery' ? '自重技能' : '减脂保肌',
    schedule: `每周${profile.frequency}次` + (profile.equipmentTrainingDays && profile.goal === 'equipment' ? ' · ' + profile.equipmentTrainingDays.map(d => '周' + '日一二三四五六'[d]).join('、') : ''),
    environment: '', baseline: '', priorities: '', restrictions: '', diet: '' };
}
export function personalFrequencyChoices(profile: Profile): readonly number[] {
  return profile.goal === 'equipment' ? equipmentSplitFrequencies[equipmentSplitConfig(profile)] : profile.goal === 'street_mastery' ? [2, 3, 6] : [2, 3, 4, 5, 6];
}
export function memoryTokens(value: string): string[] {
  const expanded = value.normalize('NFKC').toLowerCase().replace(/忌口/g, '忌口不吃').replace(/锁骨部/g, '锁骨部上胸').replace(/饮食喜好/g, '饮食喜好喜欢');
  const result = new Set<string>();
  for (const word of expanded.match(/[a-z0-9]+|[\p{Script=Han}]+/gu) || []) {
    if (/^[a-z0-9]+$/.test(word)) result.add(word);
    else {
      const chars = Array.from(word);
      if (chars.length === 1) result.add(word);
      for (let i = 0; i < chars.length - 1; i++) result.add(chars[i] + chars[i + 1]);
    }
  }
  return [...result].slice(0, 300);
}
export function selectPersonalFacts(facts: AssistantFact[], question: string): AssistantFact[] {
  const mandatory = facts.filter(f => ['avoid', 'allergy', 'need'].includes(f.kind));
  if (mandatory.length > 40) throw new Error('长期约束超过本次上下文容量，请先整理重复记忆；没有丢弃或删除记忆。');
  const tokens = new Set(memoryTokens(question));
  const optional = facts.filter(f => !mandatory.includes(f)).map(f => ({ f, score: memoryTokens(f.text).filter(t => tokens.has(t)).length }))
    .sort((a, b) => b.score - a.score || b.f.createdAt.localeCompare(a.f.createdAt)).slice(0, 40 - mandatory.length).map(r => r.f);
  return [...mandatory, ...optional];
}
export function memoryTimeRange(question: string, now = new Date()): { start: string; end: string } | undefined {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (/上周/u.test(question)) { start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7); end.setTime(start.getTime()); end.setDate(end.getDate() + 7); }
  else if (/昨天/u.test(question)) { start.setDate(start.getDate() - 1); }
  else if (/今天/u.test(question)) end.setDate(end.getDate() + 1);
  else return undefined;
  return { start: start.toISOString(), end: end.toISOString() };
}
export type MemoryEvidence = Pick<AssistantConversation, 'id' | 'createdAt' | 'question' | 'answer' | 'topic'>;
export function evidenceFromTurns(turns: AssistantConversation[]): MemoryEvidence[] {
  return turns.slice(0, 8).map(t => ({ id: t.id, createdAt: t.createdAt, topic: t.topic, question: Array.from(t.question).slice(0, 320).join(''), answer: t.answer }));
}
