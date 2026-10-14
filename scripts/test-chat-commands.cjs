const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
require('./lib/register-typescript.cjs')();
const { isClearContextCommand } = require('../src/features/chat/commands.ts');

test('clear context accepts explicit standalone commands, whitespace and English case', () => {
  for (const text of ['/clear', ' /CLEAR\n', '清空上下文', ' 清空上下文 ']) assert.equal(isClearContextCommand(text), true);
});

test('quotes, file text, partial commands and ordinary conversation are not clear commands', () => {
  for (const text of ['', 'clear', '/clear breakfast', '怎么用 /clear？', '请解释清空上下文', '“清空上下文”', '# /clear', '/clear\n还要讨论', '/clearly']) assert.equal(isClearContextCommand(text), false);
});

test('clear command executes locally before model context construction without deleting stored data', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/chat/useChatSession.ts'), 'utf8');
  const branch = source.slice(source.indexOf('if (isClearContextCommand(draft))'), source.indexOf("    setContextNotice('');"));
  for (const operation of ['await clearAgentContext()', "setError('')", "setDraft('')", 'messageRequest.current = null', 'filesRef.current.forEach(remove)']) assert.ok(branch.includes(operation));
  assert.match(branch, /return;/);
  assert.doesNotMatch(branch, /personalChat|executePersonalTool|clearData|editMemory|writeMemory|deleteIntakeEntry|saveSession|loadConnection/);
  assert.ok(source.indexOf('if (isClearContextCommand(draft))') < source.indexOf('agentConversation.begin('));
});
