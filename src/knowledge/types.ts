export type KnowledgeNote = {
  path: string;
  title: string;
  kind: string;
  sha256: string;
  markdown: string;
};
export type SeedConflict = {
  incoming: KnowledgeNote | null;
  reason: 'modified' | 'deleted_locally' | 'removed_upstream';
};
export type KnowledgeVault = {
  version: number;
  id: string;
  name: string;
  documents: KnowledgeNote[];
  seed?: {
    revision: string;
    name: string;
    notes: Record<string, string>;
    conflicts: Record<string, SeedConflict>;
  };
};
