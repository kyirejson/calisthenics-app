import { assistantFoodChoices } from '../nutrition/assistantFood';
import type { Food } from '../nutrition/types';
import type { AssistantIntent } from '../nutrition/assistantState';
import type { AssistantTrainingSnapshot } from '../nutrition/assistantTraining';
export function offlineFoodIntent(text: string, custom: Food[] = []): AssistantIntent | null {
  const match = text.trim().match(/^(?:(早餐|早饭|午餐|午饭|晚餐|晚饭|加餐)[，,\s]*)?(?:我)?(?:今天)?(?:吃了|喝了|记录)(.{1,400}?)(?:[，,\s]*帮我记录)?[。！!]?$/iu);
  if (!match || /没吃|没有|如果|昨天|以前|明天|建议|吗|[？?]/u.test(text)) return null;
  const exact = (value: string) => value.replace(/[\s（）()、，,]/g, '').toLowerCase();
  const parts = match[2].split(/(?:[，,、]|还有|和)/u).map(v => v.trim());
  if (parts.length > 8 || parts.some(v => !v)) return null;
  const items: Extract<AssistantIntent, { type: 'log_intake' }>['items'] = [];
  for (const part of parts) {
    const count = '(\\d+(?:\\.\\d+)?|半|[一二两三四五六七八九十]{1,3})', unit = '(克|g|毫升|ml|公斤|千克|斤|两|个|碗|份)';
    const leading = part.match(new RegExp('^' + count + '\\s*' + unit + '\\s*(.{1,80})$', 'iu'));
    const trailing = !leading && part.match(new RegExp('^(.{1,80}?)\\s*' + count + '\\s*' + unit + '$', 'iu'));
    const rawName = leading ? leading[3] : trailing ? trailing[1] : part;
    const state = /^熟|水煮|白煮|煮鸡蛋/u.test(rawName) ? 'cooked' : /^生/u.test(rawName) ? 'raw' : 'unknown';
    const name = rawName.replace(/^[生熟](?=米饭|鸡胸肉|牛肉|猪肉|鱼肉)/u, ''), choices = assistantFoodChoices(name, state, custom);
    if (!choices.some(food => [food.name, ...food.aliases].some(alias => exact(alias) === exact(name)))) return null;
    const amount = leading?.[1] || trailing && trailing[2], units = leading?.[2] || trailing && trailing[3];
    if (amount && !/^(?:\d+(?:\.\d+)?|半|[一二两三四五六七八九]|[一二两三四五六七八九]?十[一二三四五六七八九]?)$/u.test(amount)) return null;
    const digit = (value: string) => '零一二三四五六七八九'.indexOf(value.replace('两', '二'));
    const number = !amount ? null : amount === '半' ? .5 : /^[\d.]+$/.test(amount) ? Number(amount) : amount.includes('十') ? (amount.split('十')[0] ? digit(amount.split('十')[0]) : 1) * 10 + (amount.split('十')[1] ? digit(amount.split('十')[1]) : 0) : digit(amount);
    if (number !== null && (!Number.isFinite(number) || number <= 0)) return null;
    const weight = units && /克|g|公斤|千克|斤|两/iu.test(units);
    const quantity = number === null ? null : number * (units === '斤' ? 500 : units === '两' ? 50 : /公斤|千克/u.test(units || '') ? 1000 : 1);
    if (quantity !== null && quantity > 2000) return null;
    items.push({ name, quantity, unit: !units ? null : weight ? 'g' : /毫升|ml/iu.test(units) ? 'ml' : units === '个' ? 'piece' : units === '碗' ? 'bowl' : 'serving', state });
  }
  const slot = ({ 早餐: 'breakfast', 早饭: 'breakfast', 午餐: 'lunch', 午饭: 'lunch', 晚餐: 'dinner', 晚饭: 'dinner', 加餐: 'snack' } as const)[match[1] as '早餐'];
  return { type: 'log_intake', slot: slot || null, items };
}
export function offlineTrainingAnswer(question: string, snapshot: AssistantTrainingSnapshot | null): string | null {
  if (!snapshot) return null;
  if (/^(?:我)?今天(?:练什么|训练安排|的训练|训练计划)[？?。]?$/u.test(question.trim())) {
    const day = snapshot.week.find(d => d.date === snapshot.date); if (!day) return '本机没有今天的排期，请先打开训练计划。';
    return `本机课表：${day.title}\n` + (day.actions.length ? day.actions.map(a => `• ${a.name}：${a.sets}组 × ${a.value}${a.unit === 'reps' ? '次' : a.unit === 'seconds' ? '秒' : a.unit === 'steps' ? '步' : '米'}`).join('\n') : '今天没有安排动作工作组。') + '\n这是计划，不代表已经完成训练。';
  }
  if (/^(?:我的)?(?:本周|这周)训练(?:安排|计划)[？?。]?$/u.test(question.trim())) return '本机周课表：\n' + snapshot.week.map(d => `• ${d.date} · ${d.title}`).join('\n');
  return null;
}
export const OFFLINE_HELP = '目前云端暂不可用，但本机功能仍可使用。你可以问“今天练什么”，说“早餐没吃”，或说“吃了100克熟米饭、两个水煮鸡蛋”一次记录多种食品；食品不明确会先让你选择，不会猜营养值。未知菜品也可按食材分别输入，联网搜索需要恢复连接。';
