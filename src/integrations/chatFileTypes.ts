export type FileSource = { name: string; size: number; uri: string; file?: File };
export type ChatAttachment = { id: string; name: string; size: number; kind: string; text: string };
export type DraftAttachment = ChatAttachment & { source: FileSource; status: 'reading' | 'ready' | 'error'; error?: string };
