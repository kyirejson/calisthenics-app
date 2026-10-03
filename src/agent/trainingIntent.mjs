const when = '(今天|明天|后天|(?:这|下)周[一二三四五六日天]|周[一二三四五六日天]|\\d{4}-\\d{2}-\\d{2})';
/** Only definite commands, not an injury story, hypothetical or quoted history. */
export function explicitTrainingIntent(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim().replace(/[。！!]+$/u, '').replace(/^(?:请帮我|帮我|请)/u, '');
  let m = text.match(new RegExp('^(?:把)?' + when + '(?:的)?(.{1,100}?)(?:替换成|换成|改成)(.{1,100})$', 'u'));
  if (m && !/[?？]|如果|要不要|能不能/u.test(text) && !/^\d+组$/u.test(m[3])) return { type: 'training_adjustment', operation: 'replace', date: m[1], exercise: m[2], replacement: m[3], sets: null, toDate: null };
  m = text.match(new RegExp('^(?:把)?' + when + '(?:的)?(.{1,100}?)(?:改为|改成)(\\d{1,2})组$', 'u'));
  if (m) return { type: 'training_adjustment', operation: 'sets', date: m[1], exercise: m[2], replacement: null, sets: Number(m[3]), toDate: null };
  m = text.match(new RegExp('^(?:把)?' + when + '(?:的)?(?:训练|课程)(?:移到|改到|调到)' + when + '$', 'u'));
  if (m) return { type: 'training_adjustment', operation: 'postpone', date: m[1], exercise: null, replacement: null, sets: null, toDate: m[2] };
  m = text.match(new RegExp('^(?:把)?' + when + '(?:和|与)' + when + '(?:的)?(?:训练|课程)(?:交换|对调)$', 'u'));
  if (m) return { type: 'training_adjustment', operation: 'reschedule', date: m[1], exercise: null, replacement: null, sets: null, toDate: m[2] };
  m = text.match(new RegExp('^(?:把)?' + when + '(?:的)?(?:训练|课程)(?:推迟到|顺延到)' + when + '$', 'u'));
  if (m) return { type: 'training_adjustment', operation: 'postpone', date: m[1], exercise: null, replacement: null, sets: null, toDate: m[2] };
  m = text.match(new RegExp('^' + when + '(?:的)?(?:训练)?减载$', 'u'));
  if (m) return { type: 'training_adjustment', operation: 'deload', date: m[1], exercise: null, replacement: null, sets: null, toDate: null };
  m = text.match(new RegExp('^(?:撤销|恢复)' + when + '(?:的)?训练调整$', 'u'));
  return m ? { type: 'training_adjustment', operation: 'reset', date: m[1], exercise: null, replacement: null, sets: null, toDate: null } : null;
}
