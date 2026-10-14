import { runAgentTurn } from '../integrations/runAgentTurn';
import { appRepository } from '../store/runtime';
import { voiceTransport } from './transport';
import { subscribeConnection } from '../integrations/connectionRuntime.mjs';
import { createVoiceDialogue } from './dialogue';
import { agentConversation } from '../agent/runtime';

// Installed even for a headless JS runtime. Opening the panel later reads this same snapshot.
let lastSequence = -1;
const present = (event: import('./transport').VoiceEvent) => {
  if (event.sequence < lastSequence) return;
  lastSequence = event.sequence;
  if (event.kind === 'interrupt' && event.requestId) agentConversation.interrupt(event.requestId);
  if (event.kind === 'transcript') {
    const alreadyRecorded = event.requestId && agentConversation.getSnapshot().turns.some(turn => turn.role === 'user' && turn.requestId === event.requestId);
    agentConversation.preview(event.segmentId || '', alreadyRecorded ? '' : event.text || '');
  }
  agentConversation.voice(event);
};
let eventQueue = Promise.resolve();
const receive = (event: import('./transport').VoiceEvent) => {
  // Storage is loaded first; an early native event must never overwrite the saved context with an empty array.
  eventQueue = eventQueue.then(async () => { await agentConversation.load(); present(event); }).catch(() => {});
};
voiceTransport.subscribeEvents(receive);
void voiceTransport.dialogue().then(receive).catch(() => {});

export const voiceAgentTask = createVoiceDialogue({
  conversation: agentConversation,
  active: id => voiceTransport.active(id), reply: (id, text) => voiceTransport.reply(id, text),
  cancel: id => voiceTransport.cancel(id),
  subscribeReset: subscribeConnection,
  turn: ({ messages, requestId, controller, ...progress }) => runAgentTurn({ repository: appRepository, messages, requestId, executionId: requestId, controller, ...progress, responseMode: 'voice', restoreUi: false }),
});
