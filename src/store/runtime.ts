import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearRetiredAssistantStorage } from './retiredAssistantStorage';
import { resetConnection } from '../integrations/connectionRuntime.mjs';
import { createAppRepository } from './repository';

// One repository per JS runtime: UI and headless voice tasks must share write queues.
export const appRepository = createAppRepository(AsyncStorage, {
  clearRetired: clearRetiredAssistantStorage,
  clearRunning: async () => (await import('../running/transport')).runningTransport.clear(),
  clearMusic: async () => {
    await (await import('../device/transport')).phoneTransport.clear();
    await (await import('../voice/transport')).voiceTransport.clear();
    await (await import('../agent/runtime')).agentConversation.clear();
    await (await import('../reminders/transport')).reminderTransport.clear();
    await (await import('../agent/usageRuntime')).clearAgentUsage();
    await (await import('../device/workflowRuntime')).phoneWorkflows.clear();
    await (await import('../music/transport')).musicTransport.clear();
  },
  resetConnection: async () => {
    await (await import('../integrations/credentials')).loadConnection();
    await resetConnection();
  },
  clearMemory: async () => (await import('../memory/storage')).clearMemory(),
  deletePhotos: async ids => (await import('../nutrition/photoStorage')).deleteStoredPhotos(ids),
});
