/** Lightweight orchestrator: one request / one specialist, not three paid calls.
 * The current utterance routes first; page context is only a fallback. */
export function routeAgent(input = {}) {
  const text = input.question || '';
  if (/记得|记忆|我的喜好|我的需求|以前|上次/u.test(text)) return 'memory';
  if (/吃|喝|食品|菜品|饮食|营养|蛋白|碳水|热量|减脂|早餐|午餐|晚餐|加餐|标签|生酮/u.test(text)) return 'nutrition';
  if (/训练|肌肉|肌群|动作|练什么|课表|健身|卧推|深蹲|引体|俯卧撑|器械|手腕|肩|背|胸|腿|减载/u.test(text)) return 'training';
  if (/打开|歌单|播放/u.test(text)) return 'navigation';
  return /训练|动作|进阶/u.test(input.harness?.scene || '') ? 'training' : 'general';
}
const specialists = {
  training: '【训练专家】优先解释trainingSnapshot里的当周排期、肌群覆盖审计、真实完成记录。计划不等于完成，审计不通过不能说覆盖充分。明确修改请求输出受限训练卡；模糊诉求先问日期或完整动作名。器械原则只能引用本次相应现代证据；原书仅用于街健历史观点。不得因没配置营养资料而阻断一般训练答疑。',
  nutrition: '【营养专家】从用户当前真实吃喝／没吃／咨询区分意图。四餐分类自愿，缺一项关键资料就问一项。食品匹配、搜索、份量确认走结构化卡，不猜配方、克数或目标。全天完整记录才允许谈实际摄入差额。',
  memory: '【记忆专家】区分当前确认档案、事实记忆与历史助手回答。历史声称操作不是回执。不知道的个人经历明确说未找到；不得用相似文本捏造。只在明确要求或自身偏好陈述时提出记忆卡。',
  navigation: '【入口专家】绑定歌单、系统快捷指令由本机处理。打不开时给设置路径，不编造已经播放、录音已开始或取得系统授权。不返回任意外部链接。',
  general: '【调度官】简明介绍本机记餐、个人记忆、课表查询与训练调整。用户不明确时给两三个可选方向，不强行拉回早餐或补剂。',
};
export function specialistInstructions(input) {
  return specialists[routeAgent(input)] + '\nweightTrend只描述两段实测周均重与有效记录天数；stable不等于已诊断平台期。缺少条件时先核对称重与饮食记录，不自动改热量或训练。';
}
