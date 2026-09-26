export type Release = { tag_name: string; name: string; body: string | null; draft: boolean; prerelease: boolean; assets: Array<{ name: string; browser_download_url: string }> };
export type AvailableUpdate = { tag: string; title: string; version: string; versionCode: number; apkUrl: string };
const downloadPrefix = 'https://github.com/kyirejson/calisthenics-app/releases/download/';

export function parseRelease(release: Release, currentVersionCode: number, stable: boolean): AvailableUpdate | null {
  if (!release || release.draft || (stable && release.prerelease) || !Array.isArray(release.assets)) return null;
  const versionCode = Number(release.body?.match(/^Android versionCode:\s*(\d+)\s*$/mi)?.[1]);
  const version = release.body?.match(/^App version:\s*([^\s]+)\s*$/mi)?.[1];
  const apk = release.assets.find((asset) => typeof asset.name === 'string' && asset.name.toLowerCase().endsWith('.apk') && asset.browser_download_url?.startsWith(downloadPrefix));
  if (!Number.isSafeInteger(versionCode) || versionCode <= currentVersionCode || !version || !apk) return null;
  return { tag: release.tag_name, title: release.name, version, versionCode, apkUrl: apk.browser_download_url };
}

export function canReloadUpdate(ready: boolean, safeScreen: boolean, foreground: boolean) {
  return ready && safeScreen && foreground;
}
