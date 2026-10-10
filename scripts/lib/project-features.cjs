const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const features = {
  history: ['src/screens/DataScreen.tsx', 'src/features/history/useTrainingHistory.ts', 'src/features/history/TrainingHistoryDay.tsx', 'src/features/history/styles.ts'],
  progression: ['src/screens/ProgressScreen.tsx', 'src/features/progression/useProgressionBrowser.ts', 'src/features/progression/RouteViews.tsx', 'src/features/progression/styles.ts'],
  training: ['src/screens/TrainingScreen.tsx', 'src/features/training/useTrainingSession.ts', 'src/features/training/TrainingDialogs.tsx', 'src/features/training/styles.ts'],
  chat: ['src/integrations/DeepseekChat.tsx', 'src/features/chat/useChatSession.ts', 'src/features/chat/useChatAttachments.ts', 'src/features/chat/ChatMessages.tsx', 'src/features/chat/ChatComposer.tsx', 'src/features/chat/ChatMark.tsx', 'src/features/chat/ChatInputChrome.tsx', 'src/features/chat/ChatInputChrome.web.tsx', 'src/features/chat/styles.ts'],
  today: ['src/screens/TodayTrainingScreen.tsx', 'src/features/today/useTodayTraining.ts', 'src/features/today/types.ts'],
};
exports.features = features;
exports.readFeature = name => {
  if (!features[name]) throw Error('Unknown feature: ' + name);
  return features[name].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
};
