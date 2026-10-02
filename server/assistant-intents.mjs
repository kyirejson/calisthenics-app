export function hasAllergyNegation(question) {
  return /不过敏|不(?:是|对).{0,50}过敏|没有.{0,50}过敏|并非.{0,50}过敏|无.{0,30}过敏|(?:not|no).{0,30}allerg/iu.test(question);
}
export function explicitMemoryIntent(question) {
  const text = question.trim().replace(/[。！!]+$/u, '');
  if (hasAllergyNegation(text)) return null;
  const patterns = [
    ['allergy', /^(?:请)?(?:记住[，,:：]?\s*)?我(?:对|有)?(.{1,50}?)(?:过敏)$/u],
    ['avoid', /^(?:请)?(?:记住[，,:：]?\s*)?我(?:不吃|忌口|不喜欢吃)(.{1,50})$/u],
    ['like', /^(?:请)?(?:记住[，,:：]?\s*)?我(?:喜欢(?:吃)?|爱吃|偏爱)(.{1,50})$/u],
    ['need', /^(?:请)?记住[，,:：]?\s*(.{1,60})$/u],
  ];
  for (const [kind, regex] of patterns) { const match = text.match(regex); if (match) return { type: 'remember', kind, text: match[1].trim() }; }
  return null;
}
export function validateAssistantIntent(value, input) {
  if (input.assistantMode !== true || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.type === 'set_preferences') {
    const grounded = explicitPreferenceIntent(input.question);
    return grounded && JSON.stringify(value) === JSON.stringify(grounded) ? grounded : null;
  }
  if (value.type === 'remember') {
    if (value.kind === 'allergy' && (hasAllergyNegation(input.question) || /没有|不是|并非|不过敏|不$/u.test(value.text))) return null;
    if (Object.keys(value).some(k => !['type', 'kind', 'text'].includes(k)) || !['like', 'avoid', 'need', 'allergy'].includes(value.kind) || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 80 || !input.question.includes(value.text.trim())) return null;
    return { type: 'remember', kind: value.kind, text: value.text.trim() };
  }
  if (value.type !== 'log_intake' || Object.keys(value).some(k => !['type', 'slot', 'items'].includes(k)) || !(value.slot === null || ['breakfast', 'lunch', 'snack', 'dinner'].includes(value.slot)) || !Array.isArray(value.items) || !value.items.length || value.items.length > 8 || !/吃了|喝了|吃过|喝过|刚吃|刚喝|记录|记餐|添加|已吃|已喝|吃的是|喝的是|ate|drank|log/iu.test(input.question)) return null;
  const items = [];
  for (const row of value.items) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(k => !['name', 'state', 'quantity', 'unit'].includes(k)) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 80 || !['raw', 'cooked', 'unknown'].includes(row.state) || !(row.quantity === null || typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0 && row.quantity <= 2000) || !(row.unit === null || ['g', 'ml', 'piece', 'bowl', 'serving', 'package'].includes(row.unit))) return null;
    items.push({ name: row.name.trim(), state: row.state, quantity: row.quantity, unit: row.unit });
  }
  return { type: 'log_intake', slot: value.slot, items };
}
import { explicitPreferenceIntent } from '../src/nutrition/preferenceIntent.mjs';
