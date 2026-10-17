import { agentStorage } from './storage';
import { createAgentConversation } from './conversation';

export const agentConversation = createAgentConversation(agentStorage);

export async function stopAgentReply() {
  await agentConversation.load();
  agentConversation.interrupt();
  await (await import('../voice/transport')).voiceTransport.cancel();
}
export async function clearAgentContext() {
  // Clearing also repairs an unreadable context file; do not require that file to load first.
  await (await import('../voice/transport')).voiceTransport.cancel();
  await agentConversation.clear();
}
