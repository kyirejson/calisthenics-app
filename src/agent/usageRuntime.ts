import AsyncStorage from '@react-native-async-storage/async-storage';
import { pageUsageReport, usageReport } from './usage.mjs';
const modelKey = 'uncover.agent.usage.v1';
const eventKey = 'uncover.agent.task-events.v1';
type ModelSample = ReturnType<typeof import('./usage.mjs').usageSample>;
type EventSample = ReturnType<typeof import('./usage.mjs').toolSample> | ReturnType<typeof import('./usage.mjs').taskEvent>;
let writes = Promise.resolve(), epoch = 0;
const rows = (raw: string | null): Array<Record<string, unknown>> => {
  const value: unknown = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : [];
};
function append(key: string, sample: ModelSample | EventSample, limit: number) {
  const token = epoch;
  const record = { ...sample, at: 'at' in sample && typeof sample.at === 'number' ? sample.at : Date.now() };
  writes = writes.then(async () => {
    if (token !== epoch) return;
    const saved = rows(await AsyncStorage.getItem(key));
    if (token === epoch) await AsyncStorage.setItem(key, JSON.stringify([...saved.slice(-(limit - 1)), record]));
  }).catch(() => { /* Diagnostic storage must never fail or replay a user task. */ });
}
export function createAgentUsageRecorder() {
  const token = epoch;
  return {
    recordAgentUsage(sample: ModelSample) { if (token === epoch) append(modelKey, sample, 500); },
    recordAgentEvent(sample: EventSample) { if (token === epoch) append(eventKey, sample, 2000); },
  };
}
export async function readAgentUsage(options: unknown = {}) {
  await writes;
  const [models, events] = await Promise.all([AsyncStorage.getItem(modelKey), AsyncStorage.getItem(eventKey)]);
  return pageUsageReport(usageReport(rows(models), rows(events)), options as Record<string, unknown>);
}
export async function clearAgentUsage() {
  epoch++;
  const job = writes.then(() => AsyncStorage.multiRemove([modelKey, eventKey]));
  writes = job.catch(() => {}); await job;
}
