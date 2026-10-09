import type { KnowledgeNote, KnowledgeVault } from './types';
export type ResolvedLink={path:string;type:'note'|'attachment';heading:string};
export type NoteLink={target:string;label:string;embed:boolean};
export type IndexedNote=KnowledgeNote & {headings:string[];links:(NoteLink & {resolved:ResolvedLink|null})[];backlinks:{path:string;title:string}[]};
export function normalizedPath(value:string):string;
export function resolveLink(vault:KnowledgeVault,from:string,target:string):ResolvedLink|null;
export function noteLinks(markdown:string):NoteLink[];
export function indexVault(vault:KnowledgeVault):IndexedNote[];
export function searchNotes(documents:IndexedNote[],query:string):{document:IndexedNote;score:number;excerpt:string}[];
