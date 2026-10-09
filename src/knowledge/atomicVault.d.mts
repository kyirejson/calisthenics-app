import type { KnowledgeVault } from './types';
export function validateVault(vault:KnowledgeVault):KnowledgeVault;
export function createAtomicVaultWriter(io:{readJournal():Promise<string|null>;isRollback():Promise<boolean>;apply(vault:KnowledgeVault|null,id:string,previous:KnowledgeVault|null):Promise<void>;removeJournal():Promise<void>;prepare(text:string):Promise<void>;markRollback():Promise<void>}):{recover():Promise<void>;write(before:KnowledgeVault|null,after:KnowledgeVault):Promise<void>};
