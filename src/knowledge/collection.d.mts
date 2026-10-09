import type { KnowledgeNote, KnowledgeVault } from './types';
export type NoteInput={path:string;markdown:string};
export function validateLibraryId(id:string):string;
export function noteFromInput(input:NoteInput):KnowledgeNote;
export function folderEntries(library:KnowledgeVault,folder?:string):{type:'folder'|'note';path:string;title:string;count:number}[];
export function createKnowledgeStore(adapter:{resetLegacy():Promise<void>;readAll():Promise<KnowledgeVault[]>;writeVault(vault:KnowledgeVault):Promise<void>},seeds:KnowledgeVault[]|(()=>Promise<KnowledgeVault[]>)):{list():Promise<KnowledgeVault[]>;create(name:string):Promise<KnowledgeVault>;importNotes(id:string,inputs:NoteInput[]):Promise<KnowledgeVault>;resolveConflict(id:string,path:string,choice:'local'|'incoming'):Promise<KnowledgeVault>};
