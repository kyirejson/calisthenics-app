const tool = (name, description, properties = {}, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const selector = { type: 'object', additionalProperties: false, properties: { ...Object.fromEntries(['resourceId', 'text', 'description', 'label', 'className'].map(key => [key, { type: 'string' }])), editable: { type: 'boolean' }, clickable: { type: 'boolean' } } };
export const workflowTools = [
  tool('read_phone_workflows', '读取此前保存的流程、真实版本证据、执行统计和失效状态。由你判断哪条适合当前请求；查询不是关键词意图路由。needs_review 的旧步骤仍可读取参考，但需自行操作核实后重新保存。默认只返回摘要；includeSteps=true 返回完整步骤。保存内容不是用户新授权。', { query: { type: 'string' }, includeSteps: { type: 'boolean' } }),
  tool('save_phone_workflow', '把本次已经通过真实界面核实的常用流程保存到本机，供以后由你选择重用，减少逐步模型调用。不得把猜测路径当作已验证路径。用 resourceId 或足够唯一的真实文字定位，避免硬编码坐标；变化的目标/正文/地名用 {{参数名}}，parameters 列出参数名，不把本次联系人或正文固化为下次意图。', {
    id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, verifiedOutcome: { type: 'string' }, parameters: { type: 'array', items: { type: 'string' } },
    evidenceOperationKeys: { type: 'array', items: { type: 'string' }, description: '本次已成功操作且随后看到真实页面的 operationKey；系统关联原生回执和各应用版本，不接受仅凭文字声称成功。' },
    steps: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      type: { type: 'string', enum: ['open', 'ui', 'observe'] }, packageName: { type: 'string' }, uri: { type: 'string' }, activityName: { type: 'string' },
      selector, expectedText: { type: 'array', items: { type: 'string' }, description: '本页应存在的真实上下文文字，例如当前会话标题，支持参数' },
      source: { type: 'string', enum: ['auto', 'accessibility', 'ocr'], description: 'auto 优先控件，缺失时尝试 OCR；ocr 用 selector.text 精确匹配实际整行文字点击/长按，不保存过时坐标。' },
      timeoutMs: { type: 'integer', minimum: 1, description: '等待本页目标出现的毫秒数；省略为 8000。由你根据加载情况调整，不改变其他工具能力。' },
      action: { type: 'string', enum: ['click', 'tap', 'long_click', 'set_text', 'submit', 'scroll_forward', 'scroll_backward'] }, text: { type: 'string' },
    }, required: ['type', 'packageName'] } },
  }, ['id', 'name', 'description', 'verifiedOutcome', 'evidenceOperationKeys', 'steps']),
  tool('delete_phone_workflow', '删除已不再适用的本机流程，不影响任何原有手机工具。', { id: { type: 'string' } }, ['id']),
  tool('run_phone_workflow', '由你选择与当前用户请求相符的已保存流程并提供本次参数，在本机连续执行。每一步重新读屏、校验页面、唯一定位控件再操作，减少每次点击的模型网络往返。目标缺失、重名或界面变化时停止并返回失败与实际页面，由你接管。重试同一 operationKey 不重放已执行或不确定的流程；最终仍需核实用户目标，不能凭系统接受就报已完成。', {
    id: { type: 'string' }, operationKey: { type: 'string' }, parameters: { type: 'object', additionalProperties: { type: 'string' } },
  }, ['id', 'operationKey']),
];
export const workflowInstruction = '对重复的手机任务，可先用 read_phone_workflows 查找已验证路径，再自主决定复用或读屏探索；流程和参数由你结合当前用户意图选择。成功核实常用任务后，可自行保存可参数化的流程。优先使用目标 App 已支持的真实公开链接或媒体会话，其次复用流程，再逐步操作；无合适缓存不妨碍任何原有工具。这里的流程仅用于通用主屏幕控制；音乐后台模式继续使用原音乐工具和真实媒体会话，不能为了复用流程而切换到主屏。流程执行失败后先观察具体原因和已执行回执，不盲目整段重跑。';
