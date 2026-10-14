export type RunVoiceStyle = 'female' | 'male';
export function cleanRunVoiceStyle(value: unknown): RunVoiceStyle {
  if (value === undefined) return 'female'; // Existing preferences need no migration.
  if (value === 'female' || value === 'male') return value;
  throw Error('请选择女声或男声。');
}

/** Only announcement grammar, never user text or exercise interpretation. */
export function runVoiceClips(text: string): string[] {
  const fixed: Record<string, string> = { '开始跑步': 'start', '继续跑步': 'resume', '跑步已暂停': 'pause', '已自动暂停，重新跑动后继续': 'auto_pause', '已自动继续跑步': 'auto_resume' };
  if (fixed[text]) return [fixed[text]];
  const match = /^(您已跑了|计步估算，您已跑了|已记录定位路段)(\d+)公里，用时(\d+)(分钟|分(\d+)秒)。$/.exec(text);
  if (!match) throw Error('跑步播报内容无效。');
  const prefix = match[1] === '您已跑了' ? 'distance' : match[1] === '已记录定位路段' ? 'partial' : 'estimated';
  return [prefix, ...numberClips(Number(match[2])), 'km_time', ...numberClips(Number(match[3])), match[4] === '分钟' ? 'minutes' : 'minute', ...(match[5] ? [...numberClips(Number(match[5])), 'seconds'] : [])];
}
export function numberClips(n: number): string[] {
  if (!Number.isSafeInteger(n) || n < 0 || n > 999999999) throw Error('播报数字超出范围。');
  if (n < 100) return ['n' + n];
  const units = [[100000000, 'hundred_million'], [10000, 'ten_thousand'], [1000, 'thousand'], [100, 'hundred']] as const;
  const [value, key] = units.find(([value]) => n >= value)!;
  const rest = n % value;
  return [...numberClips(Math.floor(n / value)), key, ...(rest ? [...(rest < value / 10 ? ['n0'] : []), ...numberClips(rest)] : [])];
}
