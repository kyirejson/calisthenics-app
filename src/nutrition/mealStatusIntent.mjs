const names = { 早餐: 'breakfast', 早饭: 'breakfast', 午餐: 'lunch', 午饭: 'lunch', 加餐: 'snack', 晚餐: 'dinner', 晚饭: 'dinner' };
const meal = '(早餐|早饭|午餐|午饭|加餐|晚餐|晚饭)';

/** Only unambiguous current-day facts are executable. Questions, plans, habits,
 * other people and mixed statements continue to the model, without a guessed write. */
export function explicitMealStatusIntent(question) {
  if (typeof question !== 'string') return null;
  const text = question.trim().replace(/[，,。！!\s]/gu, '').replace(/(?:请)?(?:帮我)?(?:记录一下|记录|记一下|记上|记下)$/u, '');
  const match = text.match(new RegExp('^(?:今天|今日)?(?:我)?(?:今天|今日)?' + meal + '(?:我)?(?:没吃|没有吃|没吃过|没有吃过)$', 'u'))
    || text.match(new RegExp('^(?:今天|今日)?我(?:今天|今日)?(?:没吃|没有吃|没吃过|没有吃过)' + meal + '$', 'u'));
  if (match) return { type: 'meal_status', slot: names[match[1]], status: 'not_eaten' };
  const undo = text.match(new RegExp('^(?:今天|今日)?' + meal + '(?:改为未记录|撤销没吃|撤销状态)$', 'u'));
  return undo ? { type: 'meal_status', slot: names[undo[1]], status: 'unrecorded' } : null;
}

export function mealStatusReply(intent, saved = false) {
  const label = Object.keys(names).find(name => names[name] === intent.slot);
  if (intent.status === 'not_eaten') return saved ? `已将今天${label}标为没吃；其他餐可按需记录。` : `明白，你今天${label}没吃。确认后只记录这餐状态，其他餐不用补填。`;
  return saved ? `已撤销今天${label}的核对状态，食品记录保留。` : `确认后撤销今天${label}的核对状态，不删除食品记录。`;
}
