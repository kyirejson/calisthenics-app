/** Only public HTTPS citations, never model-supplied local or executable links. */
/** @param {unknown} value @returns {value is string} */
export function publicSourceURL(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[\s\u0000-\u001f]/u.test(value)) return false;
  try {
    const u = new URL(value), h = u.hostname.toLowerCase();
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443')
      && h.includes('.') && !h.includes(':') && !/^\d+\./u.test(h)
      && !/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/u.test(h);
  } catch { return false; }
}
