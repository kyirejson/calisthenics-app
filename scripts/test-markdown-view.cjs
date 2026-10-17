const test = require('node:test');
const assert = require('node:assert/strict');
const { marked } = require('marked');

test('marked eliminates raw markdown hash symbols from headings', () => {
  const content = '### 标准俯卧撑动作分析\n这是动作指南。';
  const tokens = marked.lexer(content, { gfm: true, breaks: true });
  const heading = tokens.find(t => t.type === 'heading');
  assert.ok(heading, 'Heading token should exist');
  assert.equal(heading.depth, 3);
  assert.equal(heading.text, '标准俯卧撑动作分析');
  assert.ok(!heading.text.includes('#'), 'Heading text must never contain hash symbol');
});

test('marked parses tables, lists, blockquotes and inline emphasis cleanly', () => {
  const markdown = [
    '## 训练计划',
    '',
    '- 动作一：**俯卧撑** 3组',
    '- 动作二：*引体向上* 3组',
    '',
    '> 提示：组间休息 90 秒',
    '',
    '| 动作 | 组数 | 目标次数 |',
    '| :--- | :--- | :--- |',
    '| 深蹲 | 4 | 20次 |',
  ].join('\n');

  const tokens = marked.lexer(markdown, { gfm: true, breaks: true });
  const heading = tokens.find(t => t.type === 'heading');
  assert.ok(heading, 'Heading token should exist');
  assert.equal(heading.depth, 2);
  assert.equal(heading.text, '训练计划');

  const list = tokens.find(t => t.type === 'list');
  assert.ok(list, 'List token should exist');
  assert.equal(list.items.length, 2);

  const blockquote = tokens.find(t => t.type === 'blockquote');
  assert.ok(blockquote, 'Blockquote token should exist');

  const table = tokens.find(t => t.type === 'table');
  assert.ok(table, 'Table token should exist');
  assert.equal(table.header.length, 3);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0][0].text, '深蹲');
});

test('personalChat invokes onToolCall callback for captured tool execution', async () => {
  const { personalChat } = await import('../src/integrations/personalTools.mjs');
  let toolCalled = false;
  let toolName = '';
  let toolArgs = null;

  const output = await personalChat({
    memory: null,
    date: '2026-10-08',
    messages: [{ role: 'user', content: '查一下知识库' }],
    onToolCall: (call) => {
      toolCalled = true;
      toolName = call.name;
      toolArgs = call.args;
    },
    execute: async (name, args) => ({ ok: true, name, args }),
    client: {
      generate: async (messages) => {
        if (!messages.some(message => message.role === 'tool')) {
          return {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'search_knowledge',
                  arguments: JSON.stringify({ query: '俯卧撑' }),
                },
              },
            ],
          };
        }
        return { content: '已查询到俯卧撑动作。' };
      },
    },
  });

  assert.equal(output, '已查询到俯卧撑动作。');
  assert.equal(toolCalled, true);
  assert.equal(toolName, 'search_knowledge');
  assert.deepEqual(toolArgs, { query: '俯卧撑' });
});
