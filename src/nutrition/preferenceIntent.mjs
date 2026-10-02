// Shared by the app and server: settings come from explicit statements, not model guesses.
const objectives = { fat_loss: '减脂', muscle_gain: '增肌', maintain: '维持', performance: '运动表现' };
const patterns = { balanced: '均衡', vegetarian: '蛋奶素', low_carb: '低碳', keto: '生酮' };
const allergies = { milk: '牛奶', egg: '鸡蛋', soy: '大豆', wheat: '小麦', peanut: '花生', tree_nut: '树坚果', fish: '鱼类', shellfish: '贝类' };
export const screeningStatement = '我已核对，无孕期哺乳、需饮食管理的疾病、降糖用药、SGLT2用药或进食障碍';
/** @param {unknown} value */
export function normalizePreferencePatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = ['objective', 'pattern', 'allergens', 'removeAllergens', 'activity', 'riskFlags', 'noListedRisks'];
  if (!Object.keys(value).length || Object.keys(value).some(k => !allowed.includes(k))) return null;
  if ('objective' in value && !Object.keys(objectives).includes(String(value.objective))) return null;
  if ('pattern' in value && !Object.keys(patterns).includes(String(value.pattern))) return null;
  if ('activity' in value && !['sedentary', 'light', 'active'].includes(String(value.activity))) return null;
  for (const key of ['allergens', 'removeAllergens']) if (key in value && (!Array.isArray(value[key]) || !value[key].length || value[key].length > 8 || value[key].some(a => !Object.keys(allergies).includes(a)))) return null;
  if ('allergens' in value && 'removeAllergens' in value) return null;
  if ('riskFlags' in value && (!Array.isArray(value.riskFlags) || !value.riskFlags.length || value.riskFlags.some(r => !['pregnancy', 'medical_condition', 'glucose_medication', 'sglt2', 'eating_disorder'].includes(r)))) return null;
  if ('noListedRisks' in value && (value.noListedRisks !== true || 'riskFlags' in value)) return null;
  return { ...value };
}
/** @param {string} question */
export function explicitPreferenceIntent(question) {
  const remove = question.trim().match(/^(?:请)?(?:删除|移除|取消)(牛奶|鸡蛋|大豆|小麦|花生|树坚果|鱼类|贝类)(?:的)?过敏原(?:记录|设置)?[。！!]*$/u);
  if (remove) return { type: 'set_preferences', patch: { removeAllergens: [Object.keys(allergies).find(key => allergies[key] === remove[1])] } };
  if (question.length > 1000 || /[？?]|(?:怎么|如何|是否|能否|可以吗|建议|假如|如果|朋友|他说|她说|以前|曾经|取消)|吗[。！!]*$/u.test(question)) return null;
  /** @type {Record<string, any>} */
  const patch = {};
  const matches = [
    ['objective', /(?:营养目标|饮食目标|目标)(?:设为|设置为|改为|改成|调整为|是|为|[:：])\s*(减脂|减肥|增肌|维持(?:体重)?|运动表现)/u, { '减脂': 'fat_loss', '减肥': 'fat_loss', '增肌': 'muscle_gain', '维持': 'maintain', '维持体重': 'maintain', '运动表现': 'performance' }],
    ['pattern', /(?:饮食模式|饮食方式|饮食)(?:设为|设置为|改为|改成|采用|选择|是|为|[:：])\s*(均衡|蛋奶素|素食|低碳|生酮)/u, { '均衡': 'balanced', '蛋奶素': 'vegetarian', '素食': 'vegetarian', '低碳': 'low_carb', '生酮': 'keto' }],
    ['activity', /(?:活动程度|日常活动)(?:设为|设置为|改为|是|为|[:：])\s*(久坐|轻度活动|活跃)/u, { '久坐': 'sedentary', '轻度活动': 'light', '活跃': 'active' }],
  ];
  for (const [field, regex, mapping] of matches) {
    const match = question.match(regex);
    if (match && !/(?:不|别|不要|取消|不能)[^，。；;]{0,15}$/u.test(question.slice(0, match.index))) patch[field] = mapping[match[1]];
  }
  // One clause per declaration; negative, hypothetical and old history are not positives.
  const allergens = [];
  for (const clause of question.split(/[，,。；;\n]/u)) {
    const match = clause.trim().match(/^(?:请记住[：:]?|记住[：:]?)?(?:我对|我有|过敏原(?:添加|是|为|[:：]))(.{1,60}?)(?:过敏)?$/u);
    if (!match || !/过敏/u.test(clause) || /不|没|无|曾|以前|可能|取消|并非/u.test(clause)) continue;
    const aliases = { milk: /牛奶|乳制品/u, egg: /鸡蛋|蛋类/u, soy: /大豆|黄豆/u, wheat: /小麦/u, peanut: /花生/u, tree_nut: /树坚果|杏仁|核桃|腰果/u, fish: /鱼类/u, shellfish: /贝类|虾|蟹/u };
    for (const [key, regex] of Object.entries(aliases)) if (regex.test(match[1])) allergens.push(key);
  }
  if (allergens.length) patch.allergens = [...new Set(allergens)];
  if (question.trim().replace(/[。！!]+$/u, '') === screeningStatement) patch.noListedRisks = true;
  else {
    const risks = [];
    for (const clause of question.split(/[，,。；;\n]/u)) {
      if (!/^我(?:有|正在|处于|服用|使用)/u.test(clause.trim()) || /不|没|无|曾|以前|可能/u.test(clause)) continue;
      if (/孕期|怀孕|哺乳/u.test(clause)) risks.push('pregnancy');
      if (/需饮食管理的疾病|糖尿病|肾病|正在接受治疗/u.test(clause)) risks.push('medical_condition');
      if (/降糖药|胰岛素/u.test(clause)) risks.push('glucose_medication');
      if (/SGLT2/iu.test(clause)) risks.push('sglt2');
      if (/进食障碍/u.test(clause)) risks.push('eating_disorder');
    }
    if (risks.length) patch.riskFlags = [...new Set(risks)];
  }
  const normalized = normalizePreferencePatch(patch);
  return normalized ? { type: 'set_preferences', patch: normalized } : null;
}
/** @param {Record<string, any>} patch */
export function preferencePatchSummary(patch) {
  return [patch.objective && '营养目标：' + objectives[patch.objective], patch.pattern && '饮食模式：' + patterns[patch.pattern], patch.activity && '活动程度：' + ({ sedentary: '久坐', light: '轻度活动', active: '活跃' })[patch.activity], patch.allergens && '添加过敏原：' + patch.allergens.map(a => allergies[a]).join('、'), patch.removeAllergens && '移除过敏原记录：' + patch.removeAllergens.map(a => allergies[a]).join('、'), patch.riskFlags && '记录需专业饮食指导的健康情况', patch.noListedRisks && '已核对上述五类健康情况，均无'].filter(Boolean).join('\n');
}
