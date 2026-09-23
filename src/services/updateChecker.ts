import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../app.json';

export type AvailableUpdate = {
  tag: string;
  title: string;
  version: string;
  versionCode: number;
  apkUrl: string;
};

type GitHubRelease = {
  tag_name: string;
  name: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{ name: string; browser_download_url: string }>;
};

type CachedResult = { checkedAt: number; update: AvailableUpdate | null };

const releasesUrl = 'https://api.github.com/repos/kyirejson/calisthenics-app/releases?per_page=20';
const downloadPrefix = 'https://github.com/kyirejson/calisthenics-app/releases/download/';
const cacheKey = 'uncover:update-check:v1';
const promptedKey = 'uncover:last-update-prompt';
const cacheLifetimeMs = 6 * 60 * 60 * 1000;
const currentVersionCode = appConfig.expo.android.versionCode;

function parseRelease(release: GitHubRelease): AvailableUpdate | null {
  if (release.draft || (appConfig.expo.extra.updateChannel === 'stable' && release.prerelease)) return null;
  const versionCode = Number(release.body?.match(/^Android versionCode:\s*(\d+)\s*$/mi)?.[1]);
  const version = release.body?.match(/^App version:\s*([^\s]+)\s*$/mi)?.[1];
  const apk = release.assets.find((asset) =>
    asset.name.toLocaleLowerCase().endsWith('.apk')
    && asset.browser_download_url.startsWith(downloadPrefix),
  );
  if (!Number.isInteger(versionCode) || !version || !apk || versionCode <= currentVersionCode) return null;
  return { tag: release.tag_name, title: release.name, version, versionCode, apkUrl: apk.browser_download_url };
}

export async function checkForUpdates(force = false): Promise<AvailableUpdate | null> {
  if (!force) {
    const stored = await AsyncStorage.getItem(cacheKey);
    if (stored) {
      try {
        const cached = JSON.parse(stored) as CachedResult;
        if (Number.isFinite(cached.checkedAt) && Date.now() - cached.checkedAt < cacheLifetimeMs) {
          return cached.update && cached.update.versionCode > currentVersionCode ? cached.update : null;
        }
      } catch {
        // A damaged cache should not block a fresh release check.
      }
    }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  let releases: GitHubRelease[];
  try {
    const response = await fetch(releasesUrl, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub release check failed: ${response.status}`);
    releases = await response.json() as GitHubRelease[];
  } finally {
    clearTimeout(timeout);
  }
  if (!Array.isArray(releases)) throw new Error('GitHub release response is invalid');
  const update = releases.map(parseRelease).filter((item): item is AvailableUpdate => Boolean(item))
    .sort((left, right) => right.versionCode - left.versionCode)[0] || null;
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ checkedAt: Date.now(), update } satisfies CachedResult));
  return update;
}

export async function markUpdatePrompted(tag: string): Promise<boolean> {
  if (await AsyncStorage.getItem(promptedKey) === tag) return false;
  await AsyncStorage.setItem(promptedKey, tag);
  return true;
}
