import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import appConfig from '../../app.json';
import { parseRelease, type AvailableUpdate, type Release } from './updatePolicy';
export type { AvailableUpdate } from './updatePolicy';

const releasesUrl = 'https://api.github.com/repos/kyirejson/calisthenics-app/releases?per_page=20';
// Read the installed binary, not the potentially newer JS delivered by OTA.
const currentVersionCode = Number(Application.nativeBuildVersion) || appConfig.expo.android.versionCode;
const stable = Constants.expoConfig?.extra?.updateChannel === 'stable';
const cacheKey = `uncover:update-check:v2:${currentVersionCode}:${stable ? 'stable' : 'preview'}`;
const cacheLifetimeMs = 6 * 60 * 60 * 1000;

export async function checkForUpdates(force = false): Promise<AvailableUpdate | null> {
  if (!force) {
    try {
      const stored = await AsyncStorage.getItem(cacheKey);
      if (stored) {
        const cached = JSON.parse(stored) as { checkedAt: number; releases: Release[] };
        const age = Date.now() - cached.checkedAt;
        if (Number.isFinite(age) && age >= 0 && age < cacheLifetimeMs && Array.isArray(cached.releases)) return newest(cached.releases);
      }
    } catch { /* Invalid cache must not block a live check. */ }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  let releases: Release[];
  try {
    const response = await fetch(releasesUrl, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Release check failed: ${response.status}`);
    releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('Invalid release response');
  } finally { clearTimeout(timeout); }
  const result = newest(releases);
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ checkedAt: Date.now(), releases })).catch(() => undefined);
  return result;
}
function newest(releases: Release[]) {
  return releases.map(release => parseRelease(release, currentVersionCode, stable)).filter((item): item is AvailableUpdate => Boolean(item)).sort((a, b) => b.versionCode - a.versionCode)[0] || null;
}
