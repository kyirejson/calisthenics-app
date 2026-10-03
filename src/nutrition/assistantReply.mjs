// Transport/resource protection only, not an instruction to write short answers.
export const MAX_ASSISTANT_REPLY_LENGTH = 8000;
export function normalizeAssistantReply(value) {
  const text = value.trim();
  return text.length <= MAX_ASSISTANT_REPLY_LENGTH ? text : '服务返回内容异常偏大，请重试；没有改动记录。';
}

/** Keep complete recent user/assistant pairs inside the existing request budget.
 * Full replies remain in the local archive; only context sent to the model is bounded. */
export function boundedAdviceHistory(history) {
  const result = [];
  for (let i = history.length - 2; i >= 0 && result.length < 12; i -= 2) {
    const user = history[i], assistant = history[i + 1];
    if (user.role !== 'user' || assistant.role !== 'assistant') continue;
    const pair = [{ role: 'user', content: user.content.slice(0, 1000) }, { role: 'assistant', content: assistant.content.slice(0, 1800) }];
    const next = [...pair, ...result];
    if (JSON.stringify(next).length > 9000) break;
    result.unshift(...pair);
  }
  return result;
}
