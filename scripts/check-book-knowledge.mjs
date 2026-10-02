import { loadAssistantBooks } from '../server/book-knowledge.mjs';

// No listener, model call, secret value or book content is exposed.
const knowledge = loadAssistantBooks();
console.log(JSON.stringify({ ready: knowledge.ready, knowledge: knowledge.status }, null, 2));
if (!knowledge.ready) {
  console.error('Prisoner knowledge is unavailable. Provision an authorized index through NUTRITION_PRISONER_INDEX or NUTRITION_KNOWLEDGE_DIR.');
  process.exitCode = 1;
}
