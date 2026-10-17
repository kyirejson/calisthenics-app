// Official direct-API catalog checked 2026-10-17:
// https://api-docs.deepseek.com/quick_start/pricing/
// Unknown IDs remain usable; absence disables automatic capacity-based compaction, not the model.
export function deepseekContextCapacity(model) {
  return ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp'].includes(model) ? 1_000_000 : null;
}
