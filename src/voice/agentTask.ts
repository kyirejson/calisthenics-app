import { runAgentTurn } from '../integrations/runAgentTurn';
import { appRepository } from '../store/runtime';
import { voiceTransport } from './transport';
import { subscribeConnectionChanges } from '../integrations/connectionRuntime.mjs';
import { createVoiceDialogue } from './dialogue';
import { agentConversation } from '../agent/runtime';
import { createVoiceTurnAssessor, type VoiceProbe } from './turnAssessment';
import { createDeepseekClient } from '../integrations/deepseekClient.mjs';
import { currentConnection, loadConnection } from '../integrations/credentials';
import { createVoiceEventOrder } from './eventOrder';
import { createVoiceCancellationBus } from './lifecycle';

// Installed even for a headless JS runtime. Opening the panel later reads this same snapshot.
const ordered = createVoiceEventOrder();
const cancellation = createVoiceCancellationBus();
const present = (event: import('./transport').VoiceEvent) => {
  if (event.kind === 'interrupt' && event.requestId) agentConversation.interrupt(event.requestId);
  if (event.kind === 'playback_error' && event.requestId) agentConversation.deliveryError(event.requestId, event.error || '语音播放失败。');
  agentConversation.voice(event);
};
let eventQueue = Promise.resolve();
const receive = (event: import('./transport').VoiceEvent) => {
  if (!ordered(event)) return;
  cancellation.publish(event);
  // Storage is loaded first; an early native event must never overwrite the saved context with an empty array.
  eventQueue = eventQueue.then(async () => { await agentConversation.load(); present(event); }).catch(() => {});
};
voiceTransport.subscribeEvents(receive);
void voiceTransport.dialogue().then(receive).catch(() => {});

const dialogue = createVoiceDialogue({
  conversation: agentConversation,
  active: id => voiceTransport.active(id), reply: (id, text) => voiceTransport.reply(id, text),
  cancel: id => voiceTransport.cancel(id),
  subscribeCancellation: (id, callback) => cancellation.subscribe(id, 'turn', callback),
  prepare: loadConnection,
  subscribeReset: subscribeConnectionChanges,
  turn: ({ messages, requestId, controller, ...progress }) => runAgentTurn({ repository: appRepository, messages, requestId, executionId: requestId, controller, ...progress, responseMode: 'voice', restoreUi: false }),
});
const assess = createVoiceTurnAssessor({
  conversation: agentConversation,
  active: id => voiceTransport.decisionActive(id), decide: (id, action, error) => voiceTransport.decide(id, action, error),
  subscribeCancellation: (id, callback) => cancellation.subscribe(id, 'decision', callback),
  generate: async (messages, signal) => { await loadConnection(); return createDeepseekClient({ config: currentConnection() }).generate(messages, { signal, json: true }); },
});
export const voiceAgentTask = (input: import('./dialogue').VoiceInput | VoiceProbe) => 'kind' in input && input.kind === 'decision' ? assess(input) : dialogue(input);
