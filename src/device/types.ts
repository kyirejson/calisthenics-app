export type PhoneResult = { ok: boolean; code?: string; status?: string; message?: string; replayed?: boolean; [key: string]: unknown };
export type PhoneStatus = PhoneResult & { native: boolean; enabled: boolean; accessibilityGranted: boolean; connected: boolean; locked: boolean; mode: 'foreground'; consentAccepted?: boolean; appScope?: string; systemActions?: Array<{ id: number; label: string }> };
export type PhoneCommand = { type: 'open' | 'ui' | 'gesture' | 'global' | 'sequence'; operationKey: string; [key: string]: unknown };
export type PhoneTransport = {
  status(): Promise<PhoneStatus>;
  findApps(query: string, offset: number): Promise<PhoneResult>;
  screen(requestId: string, executionId: string, offset: number, packageName?: string, visualText?: boolean): Promise<PhoneResult>;
  executeAndObserve(requestId: string, executionId: string, command: PhoneCommand): Promise<PhoneResult>;
  receipts(requestId: string): Promise<Array<Record<string, unknown>>>;
  cancel(executionId: string): Promise<void>; finish(executionId: string): Promise<void>;
  onCancelled(executionId: string, callback: () => void): () => void;
  onStatusChanged(callback: () => void): () => void;
  consent(enabled: boolean): Promise<void>; permission(): Promise<void>; clear(): Promise<void>;
};
