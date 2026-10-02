import { loadPrisonerKnowledge } from './prisoner-knowledge.mjs';

export function loadAssistantBooks(options = {}) {
  const prisoner = loadPrisonerKnowledge(options.knowledgeIndex);
  return {
    counts: { prisoner: prisoner.count },
    status: { prisoner: prisoner.status },
    ready: prisoner.status.available,
    retrieve(question, currentQuestion = question) {
      // Never use a different training system as a fallback for equipment questions.
      if (/施瓦辛格|阿诺德|arnold/iu.test(currentQuestion)) return [];
      const hint = /囚徒|街头健身|六艺|十式|器械|杠铃|哑铃|卧推|硬拉/iu.test(currentQuestion) ? currentQuestion : question;
      if (!/囚徒|街头健身|六艺|十式/iu.test(hint)
        && /器械|杠铃|哑铃|卧推|硬拉|划船|健美|侧平举|弯举|腿弯举|腿屈伸|三头下压/iu.test(hint)) return [];
      return prisoner.retrieve(question);
    },
  };
}
