// The linked project ID is public metadata; credentials never belong in app config.
module.exports = ({ config }) => {
  const projectId = process.env.EXPO_PROJECT_ID || config.extra?.eas?.projectId;
  const channel = process.env.EAS_BUILD_PROFILE === 'production' ? 'production' : (process.env.EXPO_UPDATE_CHANNEL || 'preview');
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) throw new Error('EXPO_PROJECT_ID must be the Expo project UUID');
  return {
    ...config,
    extra: { ...config.extra, updateChannel: channel === 'production' ? 'stable' : 'preview', ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      enabled: Boolean(projectId),
      ...(projectId ? { url: `https://u.expo.dev/${projectId}` } : {}),
      checkAutomatically: 'NEVER',
      fallbackToCacheTimeout: 0,
      requestHeaders: { 'expo-channel-name': channel },
    },
  };
};
