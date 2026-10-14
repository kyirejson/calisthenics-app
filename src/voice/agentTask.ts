import { runAgentTurn } from '../integrations/runAgentTurn';
import { appRepository } from '../store/runtime';
import { voiceTransport } from './transport';
import { subscribeConnection } from '../integrations/connectionRuntime.mjs';
import { createVoiceDialogue } from './dialogue';

export const voiceAgentTask = createVoiceDialogue({
  active: id => voiceTransport.active(id), reply: (id, text) => voiceTransport.reply(id, text),
  subscribeReset: subscribeConnection,
  turn: ({ messages, requestId, controller }) => runAgentTurn({ repository: appRepository, messages, requestId, executionId: requestId, controller, restoreUi: false }),
});
