import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readKnowledgeCollection } from './lib/knowledge/seed-files.mjs';
import { writeKnowledgeBundles } from './lib/knowledge/bundle-writer.mjs';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.length !== 2) throw Error('knowledge:build 从 knowledge/libraries 构建；导入新源目录请使用 knowledge:import。');
console.log(JSON.stringify(writeKnowledgeBundles(project, readKnowledgeCollection(project))));
