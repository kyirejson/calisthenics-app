import type { KnowledgeVault } from './types';
export function seedRevision(seed:KnowledgeVault):string;
export function reconcileSeed(local:KnowledgeVault|undefined,incoming:KnowledgeVault):KnowledgeVault;
export function resolveSeedConflict(library:KnowledgeVault,path:string,choice:'local'|'incoming'):KnowledgeVault;
