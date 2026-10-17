import type { MusicProvider } from './preferences';
export type MusicResult = { ok: boolean; code?: string; status?: string; message?: string; replayed?: boolean; [key: string]: unknown };
export type MusicCapability = {
  provider: MusicProvider; installed: boolean; version?: string; searchIntent: boolean;
  native: boolean; accessibilityGranted: boolean; accessibilityConnected: boolean; notificationAccess: boolean; screenConsent: boolean; playbackConsent: boolean;
  taskNotificationsEnabled?: boolean; message?: string;
  screenConsentAccepted?: boolean; playbackConsentAccepted?: boolean; backgroundConsentAccepted?: boolean;
  backgroundEnabled?: boolean; backgroundSupported?: boolean; executionMode?: 'foreground' | 'background';
  shizukuInstalled?: boolean; shizukuRunning?: boolean; shizukuGranted?: boolean; backgroundDisplayId?: number; androidApi?: number;
};
export type MusicCommand = {
  type: 'open' | 'ui' | 'control'; provider: MusicProvider; operationKey: string;
  uri?: string; query?: string; title?: string; artist?: string; focus?: string;
  snapshotId?: string; nodeId?: string; action?: string; text?: string; positionMs?: number; mediaId?: string;
};
export type MusicTransport = {
  capabilities(provider: MusicProvider): Promise<MusicCapability>;
  screen(provider: MusicProvider, offset: number): Promise<MusicResult>;
  playback(provider: MusicProvider): Promise<MusicResult>;
  execute(requestId: string, command: MusicCommand, executionId?: string): Promise<MusicResult>;
  executeAndObserve(requestId: string, command: MusicCommand, executionId?: string): Promise<MusicResult>;
  receipts(requestId: string): Promise<Array<Record<string, unknown>>>;
  cancel(requestId: string): Promise<void>;
  returnToApp(requestId: string, executionId?: string): Promise<void>;
  finishWithoutUi(requestId: string, executionId?: string): Promise<void>;
  onCancelled(executionId: string, callback: () => void): () => void;
  consent(value: boolean): Promise<void>;
  backgroundConsent(value: boolean): Promise<void>;
  onStatusChanged(callback: () => void): () => void;
  playbackConsent(value: boolean): Promise<void>;
  permission(kind: 'accessibility' | 'notifications' | 'task_notifications' | 'shizuku' | 'shizuku_setup'): Promise<void>;
  clear(): Promise<void>;
};
