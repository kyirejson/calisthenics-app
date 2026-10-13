/** Explicit local control commands only, never infer intent from ordinary conversation. */
export function isClearContextCommand(text: string): boolean {
  const command = text.trim().toLowerCase();
  return command === '/clear' || command === '清空上下文';
}
