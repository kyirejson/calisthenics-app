import type { NutritionObjective } from './types';

export type NutritionKnowledge = {
  id: string;
  title: string;
  summary: string;
  scope: string;
  sources: { title: string; url: string }[];
  verifiedAt: string;
  reviewStatus: 'source_checked_not_clinically_reviewed';
};

// Versioned local evidence summaries; no personal records, scraped books, or model-generated citations.
// This seed is not a completed RAG service or a professionally reviewed clinical knowledge base.
export const KNOWLEDGE_VERSION = 'nutrition-evidence-2026-09-28';
export const NUTRITION_KNOWLEDGE: NutritionKnowledge[] = [
  {
    id: 'energy-estimate', title: '热量目标是起点，不是实测值',
    summary: '基础代谢用成人公式估算，再结合所选活动程度估算日常消耗。活动程度包含日常训练，记录运动后不再自动加回热量。观察体重、饥饿感和训练表现，不按单日体重波动追着改餐。',
    scope: '一般健康成年人；不适用于儿童、孕期或哺乳期等特殊情况。活动系数及调整幅度是应用起始规则，不是论文对个体的处方。',
    sources: [{ title: 'Mifflin–St Jeor 成人静息能量研究（1990）', url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/' }, { title: 'NIDDK：成人体重规划工具适用范围', url: 'https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner' }],
    verifiedAt: '2026-09-27', reviewStatus: 'source_checked_not_clinically_reviewed',
  },
  {
    id: 'protein-training', title: '先保证全天蛋白质，再考虑补剂',
    summary: '对健康运动者，ISSN 的总体建议范围为每天每公斤体重 1.4–2.0 克蛋白质。普通食物可以帮助满足需求，不能把补剂当作完整饮食。应用采用范围内的起始估算，并限制参考体重和能量占比。',
    scope: '健康运动成年人。肾脏等疾病、药物使用及特殊生理阶段需要个体化专业建议，不能直接套用这一范围。',
    sources: [{ title: 'ISSN：蛋白质与运动立场声明（2017）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/' }],
    verifiedAt: '2026-09-27', reviewStatus: 'source_checked_not_clinically_reviewed',
  },
  {
    id: 'food-measurement', title: '克重、生熟状态和用油都要对上',
    summary: '食材营养值按每 100 克换算；生米和熟饭不能混用。食谱中的油已经计入，额外加的油、酱料和零食要另记。品牌和烹饪差异仍会带来误差，包装食品优先核对营养标签。',
    scope: '本地食材库以 USDA 通用食品为参考，并非中国品牌或外卖的精确测定值。',
    sources: [{ title: 'USDA FoodData Central 数据说明', url: 'https://fdc.nal.usda.gov/data-documentation.html' }],
    verifiedAt: '2026-09-27', reviewStatus: 'source_checked_not_clinically_reviewed',
  },
  {
    id: 'training-timing', title: '训练饮食衔接，不追逐短暂窗口',
    summary: '先满足全天能量与蛋白质需要，再结合训练时间、进餐习惯和胃肠耐受安排。应用读取真实日程与有效训练记录，选择时段后重新分配餐次，不额外加回估算运动热量。',
    scope: '一般健康运动成年人。早中晚的餐次份额和复盘至少四天完整记录均为产品规则，不是研究证明的最佳比例或诊断阈值；完整度依赖用户自行核对。',
    sources: [{ title: 'ISSN：营养时机立场声明（2017）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5596471/' }, { title: 'ISSN：蛋白质与运动立场声明（2017）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/' }],
    verifiedAt: '2026-09-28', reviewStatus: 'source_checked_not_clinically_reviewed',
  },
];

export const OBJECTIVE_EXPLANATIONS: Record<NutritionObjective, string> = {
  fat_loss: '以估计消耗的约 90% 作为起点，保留蛋白质与完整饮食；不通过极端节食或额外惩罚性训练补偿。',
  muscle_gain: '以估计消耗的约 105% 作为起点，配合渐进力量训练；热量盈余不等于一定长肌肉。',
  maintain: '从接近估计消耗开始，观察数周趋势，保持稳定且可持续的饮食。',
  performance: '从接近估计消耗开始，优先保障训练供能和恢复，不因单次训练记录重复增加热量。',
};
