import type { KnowledgeVault } from './types';

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties: boolean;
    };
  };
};

export const knowledgeTools: ToolDefinition[];
export function executeKnowledgeTool(name: string, input: unknown, load: () => Promise<KnowledgeVault[]>, signal?: AbortSignal): Promise<unknown>;
